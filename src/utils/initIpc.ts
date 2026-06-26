import { usePlayerController } from "@/core/player/PlayerController";
import * as playerIpc from "@/core/player/PlayerIpc";
import { useLyricManager } from "@/core/player/LyricManager";
import { useBlobURLManager } from "@/core/resource/BlobURLManager";
import { useDataStore, useDouyinStore, useMusicStore, useStatusStore } from "@/stores";
import type { SettingType } from "@/types/main";
import { TASKBAR_IPC_CHANNELS, PERFORMANCE_IPC_CHANNELS, type TaskbarConfig } from "@/types/shared";
import { handleProtocolUrl } from "@/utils/protocol";
import { cloneDeep } from "lodash-es";
import { toRaw } from "vue";
import { toLikeSong } from "./auth";
import { sendTaskbarCoverColor } from "./color";
import { isElectron } from "./env";
import { getPlayerInfoObj } from "./format";
import { openSetting, openUpdateApp } from "./modal";

// 关闭更新状态
const closeUpdateStatus = () => {
  const statusStore = useStatusStore();
  statusStore.updateCheck = false;
};

// 全局 IPC 事件
const initIpc = () => {
  try {
    if (!isElectron) return;
    const player = usePlayerController();
    const statusStore = useStatusStore();

    // 播放
    window.electron.ipcRenderer.on("play", () => player.play());
    // 暂停
    window.electron.ipcRenderer.on("pause", () => player.pause());
    // 播放或暂停
    window.electron.ipcRenderer.on("playOrPause", () => player.playOrPause());
    // 上一曲
    window.electron.ipcRenderer.on("playPrev", () => player.nextOrPrev("prev"));
    // 下一曲
    window.electron.ipcRenderer.on("playNext", () => player.nextOrPrev("next"));
    // 音量加
    window.electron.ipcRenderer.on("volumeUp", () => player.setVolume("up"));
    // 音量减
    window.electron.ipcRenderer.on("volumeDown", () => player.setVolume("down"));
    // 快进 / 快退
    window.electron.ipcRenderer.on("seekForward", () => player.seekBy(5000));
    window.electron.ipcRenderer.on("seekBackward", () => player.seekBy(-5000));
    // 播放模式切换
    window.electron.ipcRenderer.on("changeRepeat", (_, mode) => player.toggleRepeat(mode));
    window.electron.ipcRenderer.on("toggleShuffle", (_, mode) => player.toggleShuffle(mode));
    // 喜欢歌曲
    window.electron.ipcRenderer.on("toggle-like-song", async () => {
      const dataStore = useDataStore();
      const musicStore = useMusicStore();
      await toLikeSong(musicStore.playSong, !dataStore.isLikeSong(musicStore.playSong.id));
    });
    // 开启设置
    window.electron.ipcRenderer.on("openSetting", (_, type: SettingType, scrollTo?: string) =>
      openSetting(type, scrollTo),
    );
    // 桌面歌词开关
    window.electron.ipcRenderer.on("desktop-lyric:toggle", () => player.toggleDesktopLyric());
    // 显式关闭桌面歌词
    window.electron.ipcRenderer.on("desktop-lyric:close", () => player.setDesktopLyricShow(false));
    // 进入性能模式（窗口隐藏到托盘）
    window.electron.ipcRenderer.on(PERFORMANCE_IPC_CHANNELS.ENTER, () => {
      statusStore.setPerformanceMode(true);

      const musicStore = useMusicStore();
      const dataStore = useDataStore();
      const lyricManager = useLyricManager();
      const blobURLManager = useBlobURLManager();
      const douyinStore = useDouyinStore();

      // 获取当前播放歌曲和下一首歌曲的信息
      const currentSong = musicStore.playSong;
      const currentSongId = currentSong?.id;
      const currentSongPath = currentSong?.path || "";

      // 计算下一首歌曲
      const playList = dataStore.playList;
      const playIndex = statusStore.playIndex;
      let nextSongId: number | undefined;
      let nextSongPath = "";
      if (playList?.length && playIndex >= 0) {
        const nextIndex = playIndex + 1 >= playList.length ? 0 : playIndex + 1;
        const nextSong = playList[nextIndex];
        nextSongId = nextSong?.id;
        nextSongPath = nextSong?.path || "";
      }

      // 立即清理歌词缓存，只保留当前播放和下一首歌曲的歌词
      const keepLyricIds = [currentSongId, nextSongId].filter(Boolean) as number[];
      lyricManager.clearExcept(keepLyricIds);

      // 立即清理 Blob URL 缓存，保留当前播放和下一首歌曲的封面
      const keepBlobPaths = [currentSongPath, nextSongPath].filter(Boolean);
      blobURLManager.revokeAllExcept(keepBlobPaths);

      // 清理抖音收藏列表数据，释放内存（数据已缓存到本地文件，恢复时可重新加载）
      if (douyinStore.favoriteList.length > 0) {
        douyinStore.clearFavoriteList();
      }

      // 释放背景图片 Blob URL
      if (statusStore.backgroundImageUrl) {
        URL.revokeObjectURL(statusStore.backgroundImageUrl);
        statusStore.backgroundImageUrl = null;
      }

      // 延迟清理：给 Vue 组件卸载留时间，避免渲染树中断导致内存泄漏
      // 延迟 1000ms 后执行更积极的清理
      setTimeout(() => {
        // 如果已经退出性能模式，跳过清理
        if (!statusStore.performanceMode) return;

        // 强制触发垃圾回收（如果浏览器支持）
        if ((window as unknown as { gc?: () => void }).gc) {
          (window as unknown as { gc: () => void }).gc();
        }
      }, 1000);
    });
    // 退出性能模式（窗口显示）
    window.electron.ipcRenderer.on(PERFORMANCE_IPC_CHANNELS.EXIT, () => {
      statusStore.setPerformanceMode(false);
    });
    // 从托盘恢复窗口（用于缓存判断）
    window.electron.ipcRenderer.on("window:restore-from-tray", () => {
      statusStore.setRestoredFromTray(true);
    });
    // 任务栏歌词开关
    window.electron.ipcRenderer.on("toggle-taskbar-lyric", () => {
      player.toggleTaskbarLyric();
    });

    // 给任务栏歌词初始数据
    window.electron.ipcRenderer.on(TASKBAR_IPC_CHANNELS.REQUEST_DATA, async () => {
      const musicStore = useMusicStore();
      const statusStore = useStatusStore();

      const { name, artist } = getPlayerInfoObj() || {};
      const cover = musicStore.getSongCover("s") || "";

      const configPayload: TaskbarConfig =
        (await window.electron.ipcRenderer.invoke(TASKBAR_IPC_CHANNELS.GET_OPTION)) ?? {};

      const hasYrc = (musicStore.songLyric.yrcData?.length ?? 0) > 0;
      const lyricsPayload = {
        lines: toRaw(hasYrc ? musicStore.songLyric.yrcData : musicStore.songLyric.lrcData) ?? [],
        type: (hasYrc ? "word" : "line") as "line" | "word",
      };

      playerIpc.broadcastTaskbarState({
        type: "full-hydration",
        data: {
          track: {
            title: name || "",
            artist: artist || "",
            cover: cover,
          },
          lyrics: lyricsPayload,
          lyricLoading: statusStore.lyricLoading,
          playback: {
            isPlaying: statusStore.playStatus,
            tick: [
              statusStore.currentTime,
              statusStore.duration,
              statusStore.getSongOffset(musicStore.playSong?.id),
            ],
          },
          config: configPayload,
          themeColor: null, // TODO:
        },
      });

      // 发送封面颜色
      sendTaskbarCoverColor();
    });

    // 请求歌词数据
    window.electron.ipcRenderer.on("desktop-lyric:request-data", () => {
      const musicStore = useMusicStore();
      const statusStore = useStatusStore();
      if (player) {
        const { name, artist } = getPlayerInfoObj() || {};
        window.electron.ipcRenderer.send(
          "desktop-lyric:update-data",
          cloneDeep({
            playStatus: statusStore.playStatus,
            playName: name,
            artistName: artist,
            currentTime: statusStore.currentTime,
            songId: musicStore.playSong?.id,
            songOffset: statusStore.getSongOffset(musicStore.playSong?.id),
            lrcData: musicStore.songLyric.lrcData ?? [],
            yrcData: musicStore.songLyric.yrcData ?? [],
            lyricIndex: statusStore.lyricIndex,
            lyricLoading: statusStore.lyricLoading,
          }),
        );
      }
    });
    // 无更新
    window.electron.ipcRenderer.on("update-not-available", () => {
      closeUpdateStatus();
      statusStore.updateAvailable = false;
      statusStore.updateInfo = null;
      window.$message.success("当前已是最新版本");
    });
    // 有更新
    window.electron.ipcRenderer.on("update-available", (_, info) => {
      closeUpdateStatus();
      statusStore.updateAvailable = true;
      statusStore.updateInfo = info;
      statusStore.updateDownloaded = false;
      statusStore.updateDownloading = false;
      statusStore.updateDownloadProgress = 0;
      // 弹窗提示
      openUpdateApp(info);
    });
    // 更新下载进度
    window.electron.ipcRenderer.on("download-progress", (_, progress) => {
      statusStore.updateDownloading = true;
      statusStore.updateDownloadProgress = Number((progress?.percent || 0).toFixed(1));
    });
    // 更新下载完成
    window.electron.ipcRenderer.on("update-downloaded", () => {
      statusStore.updateDownloading = false;
      statusStore.updateDownloaded = true;
      statusStore.updateDownloadProgress = 100;
    });
    // 更新错误
    window.electron.ipcRenderer.on("update-error", (_, error) => {
      console.error("Error updating:", error);
      closeUpdateStatus();
      statusStore.updateDownloading = false;
      const errorMsg = error?.message || error?.toString() || "未知错误";
      window.$message.error("更新过程出现错误：" + errorMsg);
    });
    // 协议数据
    window.electron.ipcRenderer.on("protocol-url", (_, url) => {
      console.log("📡 Received protocol url:", url);
      handleProtocolUrl(url);
    });
    // 请求播放信息
    window.electron.ipcRenderer.on("request-track-info", () => {
      const musicStore = useMusicStore();
      const statusStore = useStatusStore();
      const { name, artist, album } = getPlayerInfoObj() || {};
      // 获取原始对象
      const playSong = toRaw(musicStore.playSong);
      const songLyric = statusStore.lyricLoading
        ? { lrcData: [], yrcData: [] }
        : toRaw(musicStore.songLyric);
      window.electron.ipcRenderer.send(
        "return-track-info",
        cloneDeep({
          playStatus: statusStore.playStatus,
          playName: name,
          artistName: artist,
          albumName: album,
          currentTime: statusStore.currentTime,
          // 音量及播放速率
          volume: statusStore.playVolume,
          playRate: statusStore.playRate,
          ...playSong,
          // 歌词及加载状态
          lyricLoading: statusStore.lyricLoading,
          lyricIndex: statusStore.lyricIndex,
          ...songLyric,
        }),
      );
    });
  } catch (error) {
    console.log(error);
  }
};

export default initIpc;

import type { PlayModePayload } from "@shared";
import { ipcMain } from "electron";
import { getMainTray } from "../tray";
import { appName } from "../utils/config";
import lyricWindow from "../windows/lyric-window";

// 当前歌曲标题
let currentSongTitle = appName;

/**
 * 获取当前歌曲标题
 * @returns 当前歌曲标题
 */
export const getCurrentSongTitle = () => currentSongTitle;

/**
 * 托盘 IPC
 */
const initTrayIpc = (): void => {
  const tray = getMainTray();

  // 音乐播放状态更改
  ipcMain.on("play-status-change", (_, playStatus: boolean) => {
    const lyricWin = lyricWindow.getWin();
    tray?.setPlayState(playStatus ? "play" : "pause");
    if (!lyricWin) return;
    lyricWin.webContents.send("play-status-change", playStatus);
  });

  // 音乐名称更改
  ipcMain.on("play-song-change", (_, options) => {
    let title = options?.title;
    if (!title) title = appName;
    currentSongTitle = title;
    tray?.setTitle(title);
    tray?.setPlayName(title);
  });

  // 播放模式切换
  ipcMain.on("play-mode-change", (_, data: PlayModePayload) => {
    tray?.setPlayMode(data.repeatMode, data.shuffleMode);
  });

  // 喜欢状态切换
  ipcMain.on("like-status-change", (_, likeStatus: boolean) => {
    tray?.setLikeState(likeStatus);
  });

  // 桌面歌词开关
  ipcMain.on("desktop-lyric:toggle", (_, val: boolean) => {
    tray?.setDesktopLyricShow(val);
  });

  // 锁定/解锁桌面歌词
  ipcMain.on("desktop-lyric:toggle-lock", (_, { lock }: { lock: boolean }) => {
    tray?.setDesktopLyricLock(lock);
  });
};

export default initTrayIpc;

import { useDataStore, useMusicStore, useStatusStore } from "@/stores";
import type { SongType } from "@/types/main";
import type { RepeatModeType, ShuffleModeType } from "@/types/shared/play-mode";
import { isElectron } from "@/utils/env";
import { shuffleArray } from "@/utils/helper";
import axios from "axios";
import type { MessageReactive } from "naive-ui";
import * as playerIpc from "./PlayerIpc";

/**
 * 播放模式管理器
 * 负责循环模式、随机模式的切换逻辑及状态同步
 */
export class PlayModeManager {
  /**
   * 用来管理 AbortController 实例
   */
  private currentAbortController: AbortController | null = null;

  /**
   * 存储当前加载消息的实例
   */
  private loadingMessage: MessageReactive | null = null;

  /**
   * 清除当前的加载消息
   */
  private clearLoadingMessage() {
    if (this.loadingMessage) {
      this.loadingMessage.destroy();
      this.loadingMessage = null;
    }
  }

  /**
   * 切换循环模式
   * @param mode 可选，直接设置目标模式。如果不传，则按 List -> One -> Off 顺序轮转
   */
  public toggleRepeat(mode?: RepeatModeType) {
    const statusStore = useStatusStore();

    if (mode) {
      if (statusStore.repeatMode === mode) return;
      statusStore.repeatMode = mode;
    } else {
      statusStore.toggleRepeat();
    }

    this.syncMediaPlayMode();

    const modeText: Record<RepeatModeType, string> = {
      list: "列表循环",
      one: "单曲循环",
      off: "不循环",
    };
    window.$message.success(modeText[statusStore.repeatMode], { showIcon: false });
  }

  /**
   * 中止之前的请求并清除 Loading 消息
   * @returns 新的 AbortSignal
   */
  private resetCurrentTask(): AbortSignal {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.clearLoadingMessage();
    this.currentAbortController = new AbortController();
    return this.currentAbortController.signal;
  }

  /**
   * 计算下一个随机模式
   */
  public calculateNextShuffleMode(currentMode: ShuffleModeType): ShuffleModeType {
    if (currentMode === "off") return "on";
    if (currentMode === "on") return "off";
    return "off";
  }

  /**
   * 执行开启随机模式的操作
   */
  private async applyShuffleOn(signal: AbortSignal) {
    const dataStore = useDataStore();
    const statusStore = useStatusStore();
    const musicStore = useMusicStore();

    const currentList = [...dataStore.playList];
    // 备份原始列表
    await dataStore.setOriginalPlayList(currentList);

    if (signal.aborted) return;

    // 打乱列表
    const shuffled = shuffleArray(currentList);
    await dataStore.setPlayList(shuffled);

    // 修正当前播放索引
    const idx = shuffled.findIndex((s) => s.id === musicStore.playSong?.id);
    if (idx !== -1) statusStore.playIndex = idx;

    window.$message.success("随机播放已开启", { showIcon: false });
  }

  /**
   * 执行关闭随机模式的操作
   *
   * 会恢复原始列表 和/或 清理推荐歌曲
   */
  private async applyShuffleOff() {
    const dataStore = useDataStore();
    const statusStore = useStatusStore();
    const musicStore = useMusicStore();

    // 恢复原始列表
    const original = await dataStore.getOriginalPlayList();

    if (original && original.length > 0) {
      await dataStore.setPlayList(original);
      const idx = original.findIndex((s) => s.id === musicStore.playSong?.id);
      statusStore.playIndex = idx !== -1 ? idx : 0;
      await dataStore.clearOriginalPlayList();
    } else {
      await dataStore.setPlayList(dataStore.playList);
    }

    window.$message.success("随机播放已关闭", { showIcon: false });
  }

  /**
   * 切换随机模式
   * @param mode 要切换到的随机模式
   */
  public async toggleShuffle(mode: ShuffleModeType) {
    const statusStore = useStatusStore();
    const signal = this.resetCurrentTask();

    const nextMode = mode;
    const currentMode = statusStore.shuffleMode;

    if (nextMode === currentMode) return;

    const previousMode = statusStore.shuffleMode;
    statusStore.shuffleMode = nextMode;
    this.syncMediaPlayMode();

    // 将耗时的数据处理扔到 UI 图标更新后再进行，避免打乱庞大列表导致点击延迟
    setTimeout(async () => {
      if (signal.aborted) return;

      try {
        switch (nextMode) {
          case "on":
            await this.applyShuffleOn(signal);
            break;
          default:
            await this.applyShuffleOff();
            break;
        }
      } catch (e) {
        if (signal.aborted || axios.isCancel(e)) return;

        this.clearLoadingMessage();

        console.error("切换模式时发生错误:", e);

        // 失败回滚
        statusStore.shuffleMode = previousMode;

        const errorMsg = (e as Error).message || "模式切换出错";
        window.$message.error(errorMsg);
      }
    }, 10);
  }

  /**
   * 同步当前的播放模式到媒体控件
   */
  public syncMediaPlayMode() {
    const statusStore = useStatusStore();

    if (isElectron) {
      const shuffle = statusStore.shuffleMode !== "off";
      const repeat =
        statusStore.repeatMode === "list"
          ? "List"
          : statusStore.repeatMode === "one"
            ? "Track"
            : "None";

      playerIpc.sendMediaPlayMode(shuffle, repeat);
    }
  }

  /**
   * 同步播放模式给托盘
   */
  public playModeSyncIpc() {
    const statusStore = useStatusStore();
    if (isElectron) {
      playerIpc.sendPlayMode(statusStore.repeatMode, statusStore.shuffleMode);
    }
  }
}

/**
 * 混合列表算法 (用于心动模式)
 *
 * 保持 sourceList 顺序不变，每隔 interval 首插入一个 recommendation
 * @param sourceList 原始用户列表
 * @param recommendationList 推荐歌曲列表
 * @param interval 插入间隔 (例如 2 表示：用户, 用户, 推荐, 用户, 用户, 推荐...)
 */
export const interleaveLists = (
  sourceList: SongType[],
  recommendationList: SongType[],
  interval: number = 2,
): SongType[] => {
  const result: SongType[] = [];
  let recIndex = 0;

  // 标记推荐歌曲
  const taggedRecs = recommendationList.map((song) => ({
    ...song,
  }));

  sourceList.forEach((song, index) => {
    result.push(song);
    // 每隔 interval 首，且还有推荐歌时，插入一首
    if ((index + 1) % interval === 0 && recIndex < taggedRecs.length) {
      result.push(taggedRecs[recIndex]);
      recIndex++;
    }
  });

  return result;
};

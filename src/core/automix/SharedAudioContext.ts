import { useSettingStore } from "@/stores";
import type { IExtendedAudioContext } from "@/types/audio/context";

/** 共享音频上下文 */
let sharedContext: IExtendedAudioContext | null = null;
/** 主输入节点 */
let masterInput: GainNode | null = null;
/** 主限制器节点 */
let masterLimiter: DynamicsCompressorNode | null = null;

/**
 * 获取共享音频上下文
 * @returns 共享音频上下文
 */
export const getSharedAudioContext = (): IExtendedAudioContext => {
  if (!sharedContext) {
    const settingStore = useSettingStore();
    const AudioContextClass =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }
      ).webkitAudioContext;
    sharedContext = new AudioContextClass({
      latencyHint: settingStore.audioLatencyHint,
    }) as IExtendedAudioContext;
  }
  return sharedContext;
};

/**
 * 获取主输入节点
 * @returns 主输入节点
 */
export const getSharedMasterInput = (): GainNode => {
  const ctx = getSharedAudioContext();
  if (!masterInput) {
    masterInput = ctx.createGain();
    masterLimiter = ctx.createDynamicsCompressor();

    masterLimiter.threshold.value = -1;
    masterLimiter.knee.value = 0;
    masterLimiter.ratio.value = 20;
    masterLimiter.attack.value = 0.003;
    masterLimiter.release.value = 0.25;

    masterInput.connect(masterLimiter);
    masterLimiter.connect(ctx.destination);
  }
  return masterInput;
};

/**
 * 获取主限制器节点
 * @returns 主限制器节点
 */
export const getSharedMasterLimiter = (): DynamicsCompressorNode | null => {
  return masterLimiter;
};

/**
 * 暂停共享音频上下文（性能模式时调用）
 * 暂停音频处理，释放音频线程资源，但不销毁上下文
 */
export const suspendSharedAudioContext = (): void => {
  if (sharedContext && sharedContext.state !== "suspended") {
    sharedContext.suspend();
  }
};

/**
 * 恢复共享音频上下文（退出性能模式时调用）
 * 恢复音频处理，继续播放
 */
export const resumeSharedAudioContext = (): void => {
  if (sharedContext && sharedContext.state === "suspended") {
    sharedContext.resume();
  }
};

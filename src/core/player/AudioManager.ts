import { watch } from "vue";
import { useSettingStore } from "@/stores";
import { TypedEventTarget } from "@/utils/TypedEventTarget";
import { AudioElementPlayer } from "../audio-player/AudioElementPlayer";
import { AUDIO_EVENTS, type AudioEventMap } from "../audio-player/BaseAudioPlayer";
import type {
  EngineCapabilities,
  FadeCurve,
  IPlaybackEngine,
  PauseOptions,
  PlayOptions,
} from "../audio-player/IPlaybackEngine";
import { getSharedAudioContext } from "../automix/SharedAudioContext";

/**
 * 音频管理器
 * 统一的音频播放接口，使用 Web Audio 引擎
 */
class AudioManager extends TypedEventTarget<AudioEventMap> implements IPlaybackEngine {
  /** 当前活动的播放引擎 */
  private engine: IPlaybackEngine;
  /** 待切换的播放引擎 (Crossfade 期间) */
  private pendingEngine: IPlaybackEngine | null = null;
  /** 切换引擎的定时器 */
  private pendingSwitchTimer: ReturnType<typeof setTimeout> | null = null;
  /** 用于清理当前引擎的事件监听器 */
  private cleanupListeners: (() => void) | null = null;
  /** 是否正在进行 Crossfade (避免事件干扰) */
  private isCrossfading: boolean = false;

  /** 主音量 (用于 Crossfade 初始化) */
  private _masterVolume: number = 1.0;

  /** 当前引擎类型：element */
  public readonly engineType: "element";

  /** 引擎能力描述 */
  public readonly capabilities: EngineCapabilities;

  constructor() {
    super();

    this.engine = new AudioElementPlayer();
    this.engineType = "element";

    this.capabilities = this.engine.capabilities;
    this.bindEngineEvents();
  }

  /**
   * 绑定引擎事件，转发到 AudioManager
   */
  private bindEngineEvents() {
    if (this.cleanupListeners) {
      this.cleanupListeners();
    }

    const events = Object.values(AUDIO_EVENTS);
    const handlers: Map<string, EventListener> = new Map();

    events.forEach((eventType) => {
      const handler = (e: Event) => {
        if (
          this.isCrossfading &&
          (eventType === "pause" || eventType === "ended" || eventType === "error")
        ) {
          return;
        }

        const detail = (e as CustomEvent).detail;
        this.dispatch(eventType, detail);
      };
      handlers.set(eventType, handler);
      this.engine.addEventListener(eventType, handler);
    });

    this.cleanupListeners = () => {
      handlers.forEach((handler, eventType) => {
        this.engine.removeEventListener(eventType, handler);
      });
    };
  }

  /**
   * 初始化
   */
  public init(): void {
    this.engine.init();
  }

  /**
   * 销毁引擎
   */
  public destroy(): void {
    this.clearPendingSwitch();
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
    this.engine.destroy();
  }

  /**
   * 释放全局单例
   */
  public dispose(): void {
    this.destroy();
    const win = window as Window & { [AUDIO_MANAGER_KEY]?: AudioManager };
    if (win[AUDIO_MANAGER_KEY] === this) {
      win[AUDIO_MANAGER_KEY] = undefined;
    }
  }

  /**
   * 加载并播放音频
   */
  public async play(url?: string, options?: PlayOptions): Promise<void> {
    await this.engine.play(url, options);
  }

  /**
   * 交叉淡入淡出到下一首
   * @param url 下一首歌曲 URL
   * @param options 配置
   */
  public async crossfadeTo(
    url: string,
    options: {
      duration: number;
      seek?: number;
      autoPlay?: boolean;
      uiSwitchDelay?: number;
      onSwitch?: () => void;
      mixType?: "default" | "bassSwap";
      rate?: number;
      replayGain?: number;
      fadeCurve?: FadeCurve;
    },
  ): Promise<void> {
    console.log(
      `🔀 [AudioManager] Starting Crossfade (duration: ${options.duration}s, type: ${options.mixType})`,
    );
    this.clearPendingSwitch();
    this.isCrossfading = true;

    const newEngine = new AudioElementPlayer();
    newEngine.init();
    this.pendingEngine = newEngine;

    newEngine.setVolume(0);
    if (this.engine.capabilities.supportsRate) {
      const targetRate = options.rate ?? this.getRate();
      newEngine.setRate(targetRate);
    }
    if (options.replayGain !== undefined) {
      newEngine.setReplayGain?.(options.replayGain);
    }
    if (options.mixType === "bassSwap") {
      this.engine.setHighPassQ?.(1.0);
      newEngine.setHighPassQ?.(1.0);
      newEngine.setHighPassFilter?.(400, 0);
    }
    const fadeCurve = options.fadeCurve ?? "equalPower";

    await newEngine.play(url, {
      autoPlay: true,
      seek: options.seek,
      fadeIn: false,
    });

    if (newEngine.rampVolumeTo) {
      newEngine.rampVolumeTo(this._masterVolume, options.duration, fadeCurve);
    } else {
      newEngine.setVolume(this._masterVolume);
    }

    if (options.mixType === "bassSwap") {
      const mid = options.duration * 0.5;
      const release = Math.min(0.6, options.duration * 0.25);
      const t0 = getSharedAudioContext().currentTime + 0.02;
      const tMid = t0 + mid;
      const tReleaseEnd = tMid + release;
      const tEnd = t0 + options.duration;
      const bypassFreq = 10;

      if (this.engine.setHighPassFilterAt && this.engine.rampHighPassFilterToAt) {
        this.engine.setHighPassFilterAt(bypassFreq, t0);
        this.engine.rampHighPassFilterToAt(400, tMid);
      } else {
        this.engine.setHighPassFilter?.(400, mid);
      }

      if (newEngine.setHighPassFilterAt && newEngine.rampHighPassFilterToAt) {
        newEngine.setHighPassFilterAt(400, t0);
        newEngine.setHighPassFilterAt(400, tMid);
        newEngine.rampHighPassFilterToAt(bypassFreq, tReleaseEnd);
        newEngine.setHighPassFilterAt(bypassFreq, tEnd + 0.05);
      }

      if (newEngine.setHighPassQAt) {
        newEngine.setHighPassQAt(0.707, tEnd + 0.05);
      } else {
        newEngine.setHighPassQ?.(0.707);
      }
    }

    const oldEngine = this.engine;
    oldEngine.pause({
      fadeOut: true,
      fadeDuration: options.duration,
      fadeCurve,
      keepContextRunning: true,
    });

    const commitSwitch = () => {
      console.log("🔀 [AudioManager] Committing Crossfade Switch");
      if (this.cleanupListeners) {
        this.cleanupListeners();
        this.cleanupListeners = null;
      }

      this.engine = newEngine;
      this.pendingEngine = null;
      this.isCrossfading = false;
      this.bindEngineEvents();

      try {
        options.onSwitch?.();
      } catch (e) {
        console.error("🔀 [AudioManager] onSwitch callback failed:", e);
      }

      this.dispatch(AUDIO_EVENTS.TIME_UPDATE, undefined);
      this.dispatch(AUDIO_EVENTS.PLAY, undefined);

      if (options.mixType !== "bassSwap") {
        this.engine.setHighPassFilter?.(0, 0);
      }
    };

    const switchDelay = options.uiSwitchDelay ?? 0;
    if (switchDelay > 0) {
      this.pendingSwitchTimer = setTimeout(() => {
        this.pendingSwitchTimer = null;
        commitSwitch();
      }, switchDelay * 1000);
    } else {
      commitSwitch();
    }

    setTimeout(() => oldEngine.destroy(), options.duration * 1000 + 1000);
  }

  /**
   * 恢复播放
   */
  public async resume(options?: { fadeIn?: boolean; fadeDuration?: number }): Promise<void> {
    await this.engine.resume(options);
  }

  /**
   * 暂停音频
   */
  public pause(options?: PauseOptions): void {
    this.engine.pause(options);
  }

  /**
   * 停止播放并将时间重置为 0
   */
  public stop(): void {
    this.clearPendingSwitch();
    this.engine.stop();
  }

  private clearPendingSwitch() {
    if (this.pendingSwitchTimer) {
      clearTimeout(this.pendingSwitchTimer);
      this.pendingSwitchTimer = null;
    }
    this.engine.setHighPassFilter?.(0, 0);
    this.engine.setHighPassQ?.(0.707);
    if (this.pendingEngine) {
      try {
        this.pendingEngine.destroy();
      } catch {
        // ignore
      }
      this.pendingEngine = null;
    }
  }

  /**
   * 跳转到指定时间
   * @param time 时间（秒）
   */
  public seek(time: number): void {
    this.engine.seek(time);
  }

  /**
   * 设置 ReplayGain 增益
   * @param gain 线性增益值
   */
  public setReplayGain(gain: number): void {
    this.engine.setReplayGain?.(gain);
  }

  /**
   * 设置音量
   * @param value 音量值 (0.0 - 1.0)
   */
  public setVolume(value: number): void {
    this._masterVolume = value;
    this.engine.setVolume(value);
  }

  /**
   * 获取当前音量
   */
  public getVolume(): number {
    return this.engine.getVolume();
  }

  /**
   * 设置播放速率
   * @param value 速率 (0.5 - 2.0)
   */
  public setRate(value: number): void {
    this.engine.setRate(value);
  }

  /**
   * 获取当前播放速率
   */
  public getRate(): number {
    return this.engine.getRate();
  }

  /**
   * 设置音频延迟手动补偿
   * @param offset 偏移量 (毫秒)
   */
  public setAudioDelayCompensation(offset: number): void {
    this.engine.setAudioDelayCompensation?.(offset);
  }

  /**
   * 设置输出设备
   */
  public async setSinkId(deviceId: string): Promise<void> {
    await this.engine.setSinkId(deviceId);
  }

  /**
   * 获取频谱数据 (用于可视化)
   */
  public getFrequencyData(): Uint8Array {
    return this.engine.getFrequencyData?.() ?? new Uint8Array(0);
  }

  /**
   * 获取低频音量 [0.0-1.0]
   */
  public getLowFrequencyVolume(): number {
    return this.engine.getLowFrequencyVolume?.() ?? 0;
  }

  /**
   * 设置高通滤波器频率
   */
  public setHighPassFilter(frequency: number, rampTime: number = 0): void {
    this.engine.setHighPassFilter?.(frequency, rampTime);
  }

  public setHighPassQ(q: number): void {
    this.engine.setHighPassQ?.(q);
  }

  /**
   * 设置低通滤波器频率
   */
  public setLowPassFilter(frequency: number, rampTime: number = 0): void {
    this.engine.setLowPassFilter?.(frequency, rampTime);
  }

  public setLowPassQ(q: number): void {
    this.engine.setLowPassQ?.(q);
  }

  /**
   * 设置均衡器增益
   */
  public setFilterGain(index: number, value: number): void {
    this.engine.setFilterGain?.(index, value);
  }

  /**
   * 获取当前均衡器设置
   */
  public getFilterGains(): number[] {
    return this.engine.getFilterGains?.() ?? [];
  }

  /**
   * 获取音频总时长（秒）
   */
  public get duration(): number {
    return this.engine.duration;
  }

  /**
   * 获取当前播放时间（秒）
   */
  public get currentTime(): number {
    return this.engine.currentTime;
  }

  /**
   * 获取是否暂停状态
   */
  public get paused(): boolean {
    return this.engine.paused;
  }

  /**
   * 获取当前播放地址
   */
  public get src(): string {
    return this.engine.src;
  }

  /**
   * 获取音频错误码
   */
  public getErrorCode(): number {
    return this.engine.getErrorCode();
  }

  /**
   * 切换播放/暂停
   */
  public togglePlayPause(): void {
    if (this.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }
}

const AUDIO_MANAGER_KEY = "__SPLAYER_AUDIO_MANAGER__";

/**
 * 获取 AudioManager 实例
 * @returns AudioManager
 */
export const useAudioManager = (): AudioManager => {
  const win = window as Window & { [AUDIO_MANAGER_KEY]?: AudioManager };
  if (!win[AUDIO_MANAGER_KEY]) {
    win[AUDIO_MANAGER_KEY] = new AudioManager();

    const settingStore = useSettingStore();
    watch(
      () => settingStore.audioDelayCompensation,
      (offset) => {
        win[AUDIO_MANAGER_KEY]?.setAudioDelayCompensation(offset);
      },
      { immediate: true },
    );

    console.log(`[AudioManager] 创建新实例, engine: ${win[AUDIO_MANAGER_KEY].engineType}`);
  }
  return win[AUDIO_MANAGER_KEY];
};

/**
 * 释放 AudioManager 全局单例
 */
export const disposeAudioManager = (): void => {
  const win = window as Window & { [AUDIO_MANAGER_KEY]?: AudioManager };
  if (win[AUDIO_MANAGER_KEY]) {
    win[AUDIO_MANAGER_KEY].dispose();
    win[AUDIO_MANAGER_KEY] = undefined;
  }
};
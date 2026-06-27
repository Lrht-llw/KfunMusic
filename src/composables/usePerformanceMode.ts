import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useStatusStore } from "@/stores";

/**
 * 性能模式 composable
 * 用于在窗口隐藏到托盘时减少系统资源占用
 *
 * 优化策略：
 * - 完全卸载主窗口渲染树（保留播放控制）
 * - 隐藏播放控制条、播放列表和全屏播放器
 * - 暂停/关闭主窗口的动画和视觉效果
 * - 保留歌词更新和桌面歌词/任务栏歌词功能
 * - 保留网络请求（封面、歌词获取）
 */
export const usePerformanceMode = () => {
  const statusStore = useStatusStore();
  const { performanceMode } = storeToRefs(statusStore);

  /** 是否处于性能模式 */
  const isPerformanceMode = computed(() => performanceMode.value);

  /** 是否应该完全卸载主窗口渲染树 */
  const shouldHideMainWindow = computed(() => performanceMode.value);

  /** 是否应该隐藏播放控制条 */
  const shouldHidePlayer = computed(() => performanceMode.value);

  /** 是否应该隐藏播放列表 */
  const shouldHidePlaylist = computed(() => performanceMode.value);

  /** 是否应该暂停频谱可视化 */
  const shouldPauseSpectrum = computed(() => performanceMode.value);

  /** 是否应该暂停背景动画（完全隐藏背景组件） */
  const shouldHideBackground = computed(() => performanceMode.value);

  /** 是否应该暂停封面旋转动画 */
  const shouldPauseCoverRotation = computed(() => performanceMode.value);

  /** 是否应该暂停动态封面视频 */
  const shouldPauseDynamicCover = computed(() => performanceMode.value);

  /** 是否应该禁用背景模糊效果（backdrop-filter） */
  const shouldDisableBackgroundBlur = computed(() => performanceMode.value);

  /** 是否应该禁用评论组件 */
  const shouldDisableComment = computed(() => performanceMode.value);

  /** 是否应该隐藏全屏播放器（含 LyricPlayer rAF、PlayerLyric rAF 等） */
  const shouldHideFullPlayer = computed(() => performanceMode.value);

  return {
    isPerformanceMode,
    shouldHideMainWindow,
    shouldHidePlayer,
    shouldHidePlaylist,
    shouldHideFullPlayer,
    shouldPauseSpectrum,
    shouldHideBackground,
    shouldPauseCoverRotation,
    shouldPauseDynamicCover,
    shouldDisableBackgroundBlur,
    shouldDisableComment,
  };
};

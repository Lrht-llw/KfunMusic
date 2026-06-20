/**
 * 性能模式 IPC 通道常量
 * 用于窗口隐藏到托盘时减少系统性能占用
 */
export const PERFORMANCE_IPC_CHANNELS = {
  /** 主进程 -> 渲染进程：进入性能模式 */
  ENTER: "performance-mode:enter",
  /** 主进程 -> 渲染进程：退出性能模式 */
  EXIT: "performance-mode:exit",
} as const;

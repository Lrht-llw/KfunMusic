import type { RepeatModeType, ShuffleModeType } from "@shared";
import {
  app,
  type BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  NativeImage,
  nativeTheme,
  Tray,
} from "electron";
import { join } from "path";
import { trayLog } from "../logger";
import { useStore } from "../store";
import { appName } from "../utils/config";
import lyricWindow from "../windows/lyric-window";

// 播放模式
type PlayState = "play" | "pause" | "loading";

let repeatMode: RepeatModeType = "list";
let shuffleMode: ShuffleModeType = "off";

// 全局数据
let playState: PlayState = "pause";
let playName: string = "未播放歌曲";
let likeSong: boolean = false;
let desktopLyricShow: boolean = false;
let desktopLyricLock: boolean = false;
let taskbarLyricShow: boolean = false;

export interface MainTray {
  setTitle(title: string): void;
  setPlayMode(repeat: RepeatModeType, shuffle: ShuffleModeType): void;
  setLikeState(like: boolean): void;
  setPlayState(state: PlayState): void;
  setPlayName(name: string): void;
  setDesktopLyricShow(show: boolean): void;
  setDesktopLyricLock(lock: boolean): void;
  setTaskbarLyricShow(show: boolean): void;
  initTrayMenu(): void;
  destroyTray(): void;
}

// 托盘单例
let mainTrayInstance: MainTray | null = null;

/**
 * 获取菜单图标
 * 根据系统主题选择合适的图标
 */
const getMenuIcon = (iconName: string): NativeImage | undefined => {
  const isDark = nativeTheme.shouldUseDarkColors;
  const suffix = isDark ? "dark" : "light";
  const iconPath = join(__dirname, `../../public/icons/tray/${iconName}-${suffix}.png`);
  try {
    const image = nativeImage.createFromPath(iconPath);
    return image.resize({ width: 16, height: 16 });
  } catch (error) {
    trayLog.warn(`无法加载菜单图标: ${iconPath}`, error);
    const defaultPath = join(__dirname, `../../public/icons/tray/${iconName}-dark.png`);
    try {
      const image = nativeImage.createFromPath(defaultPath);
      return image.resize({ width: 16, height: 16 });
    } catch (fallbackError) {
      trayLog.error(`无法加载菜单图标后备方案: ${defaultPath}`, fallbackError);
      return undefined;
    }
  }
};

// 托盘菜单
const createTrayMenu = (win: BrowserWindow): MenuItemConstructorOptions[] => {
  /**
   * 获取 {@linkcode RepeatModeType} 对应的显示字符串
   * @param mode 重复模式
   * @returns 对应的显示字符串
   */
  const getRepeatLabel = (mode: RepeatModeType): string => {
    switch (mode) {
      case "one":
        return "单曲循环";
      case "off":
        return "不循环";
      case "list":
      default:
        return "列表循环";
    }
  };

  // 菜单
  const menu: MenuItemConstructorOptions[] = [
    {
      id: "name",
      label: playName,
      icon: getMenuIcon("music"),
      click: () => {
        win.show();
        win.focus();
      },
    },
    {
      type: "separator",
    },
    {
      id: "toggle-like-song",
      label: likeSong ? "从我喜欢中移除" : "添加到我喜欢",
      icon: getMenuIcon(likeSong ? "like" : "unlike"),
      click: () => win.webContents.send("toggle-like-song"),
    },
    {
      id: "shuffle",
      label: shuffleMode === "heartbeat" ? "心动模式" : "随机播放",
      icon: getMenuIcon("shuffle"),
      type: "checkbox",
      checked: shuffleMode !== "off",
      click: () => win.webContents.send("toggleShuffle"),
    },
    {
      id: "repeatMode",
      label: getRepeatLabel(repeatMode),
      icon: getMenuIcon(repeatMode === "one" ? "repeat-once" : "repeat"),
      submenu: [
        {
          label: "列表循环",
          icon: getMenuIcon("repeat"),
          type: "radio",
          checked: repeatMode === "list",
          click: () => win.webContents.send("changeRepeat", "list"),
        },
        {
          label: "单曲循环",
          icon: getMenuIcon("repeat-once"),
          type: "radio",
          checked: repeatMode === "one",
          click: () => win.webContents.send("changeRepeat", "one"),
        },
        {
          label: "关闭循环",
          icon: getMenuIcon("repeat"),
          type: "radio",
          checked: repeatMode === "off",
          click: () => win.webContents.send("changeRepeat", "off"),
        },
      ],
    },
    {
      type: "separator",
    },
    {
      id: "playNext",
      label: "上一曲",
      icon: getMenuIcon("prev"),
      click: () => win.webContents.send("playPrev"),
    },
    {
      id: "playOrPause",
      label: playState === "pause" ? "播放" : "暂停",
      icon: getMenuIcon(playState === "pause" ? "play" : "pause"),
      click: () => win.webContents.send(playState === "pause" ? "play" : "pause"),
    },
    {
      id: "playNext",
      label: "下一曲",
      icon: getMenuIcon("next"),
      click: () => win.webContents.send("playNext"),
    },
    {
      type: "separator",
    },
    {
      id: "toggle-desktop-lyric",
      label: `${desktopLyricShow ? "关闭" : "开启"}桌面歌词`,
      icon: getMenuIcon("lyric"),
      click: () => win.webContents.send("desktop-lyric:toggle"),
    },
    {
      id: "toggle-desktop-lyric-lock",
      label: `${desktopLyricLock ? "解锁" : "锁定"}桌面歌词`,
      icon: getMenuIcon(desktopLyricLock ? "lock" : "unlock"),
      visible: desktopLyricShow,
      click: () => {
        const store = useStore();
        store.set("lyric.config", { ...store.get("lyric.config"), isLock: !desktopLyricLock });
        const config = store.get("lyric.config");
        const lyricWin = lyricWindow.getWin();
        if (!lyricWin) return;
        lyricWin.webContents.send("desktop-lyric:update-option", config);
      },
    },
    {
      id: "toggle-taskbar-lyric",
      label: `${taskbarLyricShow ? "关闭" : "开启"}任务栏歌词`,
      icon: getMenuIcon("lyric"),
      click: () => win.webContents.send("toggle-taskbar-lyric"),
    },
    {
      type: "separator",
    },
    {
      id: "setting",
      label: "全局设置",
      icon: getMenuIcon("setting"),
      click: () => {
        win.show();
        win.focus();
        win.webContents.send("openSetting");
      },
    },
    {
      type: "separator",
    },
    {
      id: "exit",
      label: "退出",
      icon: getMenuIcon("power"),
      click: () => {
        app.quit();
      },
    },
  ];
  return menu;
};

// 创建托盘
class CreateTray implements MainTray {
  // 窗口
  private _win: BrowserWindow;
  // 托盘
  private _tray: Tray;
  // 菜单
  private _menu: MenuItemConstructorOptions[];
  private _contextMenu: Menu;

  constructor(win: BrowserWindow) {
    this._win = win;

    const iconPath = join(__dirname, `../../public/icons/tray/tray.ico`);
    const icon = nativeImage.createFromPath(iconPath).resize({ height: 20, width: 20 });
    this._tray = new Tray(icon);

    this._menu = createTrayMenu(this._win);
    this._contextMenu = Menu.buildFromTemplate(this._menu);
    this.initTrayMenu();
    this.initEvents();
    this._tray.setTitle(appName);
  }
  // 托盘菜单
  public initTrayMenu() {
    this._menu = createTrayMenu(this._win);
    this._contextMenu = Menu.buildFromTemplate(this._menu);
    this._tray.setContextMenu(this._contextMenu);
  }
  // 托盘事件
  private initEvents() {
    // 点击
    this._tray.on("click", () => {
      // 先通知渲染进程从托盘恢复，再显示窗口
      // 这样在 AppLayout 重新挂载时，restoredFromTray 已经是 true
      this._win.webContents.send("window:restore-from-tray");
      this._win.show();
    });

    // 监听系统主题变化，用于菜单图标的更新
    nativeTheme.addListener("updated", () => {
      this.initTrayMenu();
    });
  }

  // 设置标题
  /**
   * 设置标题
   * @param title 标题
   */
  setTitle(title: string) {
    this._tray.setTitle(title);
    this._tray.setToolTip(title);
  }
  /**
   * 设置播放名称
   * @param name 播放名称
   */
  setPlayName(name: string) {
    // 超长处理
    if (name.length > 20) name = name.slice(0, 20) + "...";
    playName = name;
    // 更新菜单
    this.initTrayMenu();
  }
  /**
   * 设置播放状态
   * @param state 播放状态
   */
  setPlayState(state: PlayState) {
    playState = state;
    // 更新菜单
    this.initTrayMenu();
  }
  /**
   * 设置播放模式
   * @param repeat 当前的重复播放模式
   * @param shuffle 当前的随机播放模式
   */
  setPlayMode(repeat: RepeatModeType, shuffle: ShuffleModeType) {
    repeatMode = repeat;
    shuffleMode = shuffle;
    // 更新菜单
    this.initTrayMenu();
  }
  /**
   * 设置喜欢状态
   * @param like 喜欢状态
   */
  setLikeState(like: boolean) {
    likeSong = like;
    // 更新菜单
    this.initTrayMenu();
  }
  /**
   * 桌面歌词开关
   * @param show 桌面歌词开关状态
   */
  setDesktopLyricShow(show: boolean) {
    desktopLyricShow = show;
    // 更新菜单
    this.initTrayMenu();
  }
  /**
   * 锁定桌面歌词
   * @param lock 锁定桌面歌词状态
   */
  setDesktopLyricLock(lock: boolean) {
    desktopLyricLock = lock;
    // 更新菜单
    this.initTrayMenu();
  }

  setTaskbarLyricShow(show: boolean) {
    taskbarLyricShow = show;
    // 更新菜单
    this.initTrayMenu();
  }

  /**
   * 销毁托盘
   */
  destroyTray() {
    this._tray.destroy();
  }
}

/**
 * 初始化托盘
 * @param win 主窗口
 * @returns 托盘实例
 */
export const initTray = (win: BrowserWindow) => {
  try {
    trayLog.info("🚀 Tray Process Startup");
    const tray = new CreateTray(win);
    // 保存单例实例
    mainTrayInstance = tray;
    return tray;
  } catch (error) {
    trayLog.error("❌ Tray Process Error", error);
    return null;
  }
};

/**
 * 获取托盘实例
 * @returns 托盘实例
 */
export const getMainTray = (): MainTray | null => mainTrayInstance;

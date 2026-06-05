import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { createDouyinAPI, getFavoriteListFromFile, type DouyinMusic } from "@/api/douyin";
import { useMusicStore } from "./music";
import { useDataStore } from "./data";
import { usePlayerController } from "@/core/player/PlayerController";
import type { SongType } from "@/types/main";
import { isElectron } from "@/utils/env";

export const useDouyinStore = defineStore("douyin", () => {
  const cookie = ref("");
  const isLoggedIn = computed(() => !!cookie.value.trim());
  const favoriteList = ref<DouyinMusic[]>([]);
  const isLoading = ref(false);
  const hasMore = ref(true);
  const cursor = ref("0");
  const cookieFileExists = ref(false);
  const loadingPage = ref(0);

  const saveCookie = (newCookie: string) => {
    cookie.value = newCookie;
  };

  const clearCookie = () => {
    cookie.value = "";
    favoriteList.value = [];
    cursor.value = "0";
    hasMore.value = true;
  };

  const checkCookieFile = async (): Promise<boolean> => {
    if (!isElectron) {
      cookieFileExists.value = false;
      return false;
    }

    try {
      const exists = await window.api.cookie.fileExists();
      cookieFileExists.value = exists;
      return exists;
    } catch {
      cookieFileExists.value = false;
      return false;
    }
  };

  const loadCookieFromFile = async (): Promise<boolean> => {
    if (!isElectron) {
      return false;
    }

    try {
      const exists = await window.api.cookie.fileExists();
      if (!exists) {
        cookieFileExists.value = false;
        return false;
      }

      cookieFileExists.value = true;
      // 标记为已登录（使用文件中的 Cookie）
      cookie.value = "from_file";
      return true;
    } catch (error) {
      console.error("读取 Cookie 文件失败:", error);
      cookieFileExists.value = false;
      return false;
    }
  };

  // 弹出文件选择对话框，让用户选择 Cookie 文件并自动复制
  const selectAndCopyCookieFile = async (): Promise<{
    success: boolean;
    canceled: boolean;
    message: string;
  }> => {
    if (!isElectron) {
      return { success: false, canceled: false, message: "仅在 Electron 环境下支持" };
    }

    try {
      const result = await window.api.cookie.selectAndCopyFile();

      if (result.canceled) {
        return { success: false, canceled: true, message: result.message };
      }

      if (result.success) {
        cookieFileExists.value = true;
        cookie.value = "from_file";
      }

      return { success: result.success, canceled: false, message: result.message };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("选择并复制 Cookie 文件失败:", errMsg);
      return { success: false, canceled: false, message: errMsg };
    }
  };

  const errorMessage = ref("");

  const clearError = () => {
    errorMessage.value = "";
  };

  const fetchFavoriteList = async (refresh = false) => {
    if (!isElectron) {
      throw new Error("抖音功能仅在 Electron 环境下可用");
    }

    isLoading.value = true;
    clearError();

    try {
      if (refresh) {
        cursor.value = "0";
        hasMore.value = true;
        favoriteList.value = [];
        loadingPage.value = 0;
      }

      // 自动批量加载：循环请求直到 has_more 为 0 或 list 为空
      // 注意：即使 hasMore 为 false，也会至少请求一次（首次请求或加载更多）
      let loopCount = 0;
      const maxLoops = 500; // 安全上限，防止无限循环

      while (hasMore.value && loopCount < maxLoops) {
        if (!hasMore.value && favoriteList.value.length > 0) {
          // 加载更多模式下，如果没有更多了就退出
          break;
        }

        // 根据是否使用文件 Cookie 选择不同的 API
        let result;
        if (cookie.value === "from_file") {
          result = await getFavoriteListFromFile(cursor.value);
        } else {
          const api = createDouyinAPI(cookie.value);
          result = await api.getFavoriteList(cursor.value);
        }

        const list = result.list;

        if (list.length === 0) {
          hasMore.value = false;
          if (favoriteList.value.length === 0) {
            errorMessage.value = "未获取到收藏音乐，可能是 Cookie 已过期或没有收藏音乐";
          }
          break;
        }

        favoriteList.value = [...favoriteList.value, ...list];
        cursor.value = String(result.cursor);
        hasMore.value = result.hasMore;
        loadingPage.value = loopCount + 1;

        loopCount++;

        // 如果是手动点击"加载更多"模式，只加载一页就退出
        if (!refresh) {
          break;
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "获取收藏列表失败";
      console.error("获取抖音收藏列表失败:", errMsg);
      errorMessage.value = errMsg;
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const convertToSong = (music: DouyinMusic): SongType => {
    return {
      id: parseInt(music.id.replace("douyin_", ""), 10) || Date.now(),
      name: music.title,
      artists: music.author,
      album: "抖音收藏",
      cover: music.coverUrl,
      duration: music.duration,
      free: 0,
      mv: null,
      streamUrl: music.audioUrl,
      type: "streaming",
    };
  };

  const playMusic = async (music: DouyinMusic) => {
    const musicStore = useMusicStore();
    const dataStore = useDataStore();
    const player = usePlayerController();

    const song = convertToSong(music);

    await dataStore.setPlayList([song]);

    musicStore.playSong = song;

    await player.playSong({ autoPlay: true });
  };

  return {
    cookie,
    isLoggedIn,
    favoriteList,
    isLoading,
    hasMore,
    cookieFileExists,
    errorMessage,
    loadingPage,
    cursor,
    saveCookie,
    clearCookie,
    checkCookieFile,
    loadCookieFromFile,
    selectAndCopyCookieFile,
    fetchFavoriteList,
    playMusic,
    convertToSong,
    clearError,
  };
});

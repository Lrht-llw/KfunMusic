import { isElectron } from "@/utils/env";

export interface DouyinMusic {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  videoId: string;
}

// TikTokDownloader API 响应格式
interface TikTokDownloaderResponse {
  message: string;
  data: any;
  params: {
    cookie: string;
    proxy: string;
    source: boolean;
    pages: number | null;
    cursor: number;
    count: number;
  };
}

// 抖音收藏音乐响应的原始数据结构（source: true 时）
interface DouyinCollectionData {
  mc_list: DouyinMusicItem[];
  cursor: number;
  has_more: boolean;
}

// 抖音原始音乐数据格式
interface DouyinMusicItem {
  music_id?: string | number;
  id?: string | number;
  title?: string;
  name?: string;
  author?: string;
  singer?: string;
  duration?: number;
  cover_hd?: {
    uri?: string;
    url_list?: string[];
  };
  cover_large?: {
    uri?: string;
    url_list?: string[];
  };
  cover_url?: string;
  cover?: {
    url_list?: string[];
  };
  play_url?: {
    uri?: string;
    url_list?: string[];
  };
  mp3_url?: string;
  url?: string;
  extra?: {
    play_url?: {
      url_list?: string[];
    };
  };
}

// 解析结果
interface ParsedCollectionResult {
  list: DouyinMusic[];
  cursor: number;
  hasMore: boolean;
}

export class DouyinAPI {
  private cookie: string;

  constructor(cookie: string) {
    this.cookie = cookie;
  }

  async getFavoriteList(
    cursor = "0",
    count = 20,
  ): Promise<ParsedCollectionResult> {
    if (!isElectron) {
      throw new Error("抖音功能仅在 Electron 环境下可用");
    }

    try {
      const response = await window.api.douyin.getFavoriteWithCookie(
        this.cookie,
        cursor,
        count,
      );

      return parseTikTokDownloaderResponse(response);
    } catch (error) {
      console.error("抖音 API 调用失败:", error);
      throw error;
    }
  }
}

// 使用 Cookie 文件获取收藏列表（无需手动输入 Cookie）
export async function getFavoriteListFromFile(
  cursor = "0",
  count = 20,
): Promise<ParsedCollectionResult> {
  if (!isElectron) {
    throw new Error("抖音功能仅在 Electron 环境下可用");
  }

  try {
    const response = await window.api.douyin.getFavorite(cursor, count);

    return parseTikTokDownloaderResponse(response);
  } catch (error) {
    console.error("抖音 API 调用失败:", error);
    throw error;
  }
}

// 解析 TikTokDownloader API 响应
function parseTikTokDownloaderResponse(
  response: TikTokDownloaderResponse | null,
): ParsedCollectionResult {
  console.log("[Douyin API] Raw response received:", response);
  console.log("[Douyin API] Response keys:", response ? Object.keys(response) : "null");
  console.log("[Douyin API] response.data:", response?.data);
  console.log("[Douyin API] response.data type:", typeof response?.data);

  if (!response) {
    throw new Error("获取收藏列表失败：无响应");
  }

  if (!response.data) {
    throw new Error(response.message || "获取收藏列表失败");
  }

  // 当 source: true 时，返回的 data 包含 mc_list, cursor, has_more
  const data = response.data as DouyinCollectionData;
  console.log("[Douyin API] Parsed data keys:", Object.keys(data));
  console.log("[Douyin API] data.mc_list type:", typeof data.mc_list, "length:", data.mc_list?.length);

  if (!data.mc_list || !Array.isArray(data.mc_list)) {
    console.log("[Douyin API] mc_list is invalid, returning empty list");
    return { list: [], cursor: data.cursor || 0, hasMore: false };
  }

  console.log("[Douyin API] First music item:", JSON.stringify(data.mc_list[0]).substring(0, 500));

  const list: DouyinMusic[] = data.mc_list.map((item) => {
    // 获取音频 URL
    let audioUrl = "";
    if (item.play_url && item.play_url.url_list && item.play_url.url_list.length > 0) {
      audioUrl = item.play_url.url_list[0];
    } else if (
      item.extra &&
      item.extra.play_url &&
      item.extra.play_url.url_list &&
      item.extra.play_url.url_list.length > 0
    ) {
      audioUrl = item.extra.play_url.url_list[0];
    } else if (item.mp3_url) {
      audioUrl = item.mp3_url;
    } else if (item.url) {
      audioUrl = item.url;
    }

    // 获取封面 URL
    let coverUrl = "";
    if (item.cover_hd && item.cover_hd.url_list && item.cover_hd.url_list.length > 0) {
      coverUrl = item.cover_hd.url_list[0];
    } else if (
      item.cover_large &&
      item.cover_large.url_list &&
      item.cover_large.url_list.length > 0
    ) {
      coverUrl = item.cover_large.url_list[0];
    } else if (item.cover && item.cover.url_list && item.cover.url_list.length > 0) {
      coverUrl = item.cover.url_list[0];
    } else if (item.cover_url) {
      coverUrl = item.cover_url;
    }

    const musicId = item.music_id || item.id || String(Date.now());

    return {
      id: `douyin_${musicId}`,
      title: item.title || item.name || "未知歌曲",
      author: item.author || item.singer || "未知作者",
      coverUrl,
      audioUrl,
      duration: item.duration || 0,
      videoId: String(musicId),
    };
  });

  console.log(`[Douyin API] Parsed ${list.length} music items`);

  return {
    list,
    cursor: data.cursor || 0,
    hasMore: Boolean(data.has_more),
  };
}

export const createDouyinAPI = (cookie: string) => new DouyinAPI(cookie);

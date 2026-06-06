
import axios from "axios";
import { ABogus } from "./aBogus";

// API 端点
const DOUYIN_API = "https://www.douyin.com/aweme/v1/web/music/listcollection/";
const REFERER = "https://www.douyin.com/user/self?showTab=favorite_collection";

// 默认 User-Agent
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BASE_PARAMS: Record<string, string> = {
  device_platform: "webapp",
  aid: "6383",
  channel: "channel_pc_web",
  update_version_code: "170400",
  pc_client_type: "1",
  version_code: "290100",
  version_name: "29.1.0",
  cookie_enabled: "true",
  screen_width: "1536",
  screen_height: "864",
  browser_language: "zh-CN",
  browser_platform: "Win32",
  browser_name: "Chrome",
  browser_version: "139.0.0.0",
  browser_online: "true",
  engine_name: "Blink",
  engine_version: "139.0.0.0",
  os_name: "Windows",
  os_version: "10",
  cpu_core_num: "16",
  device_memory: "8",
  platform: "PC",
  downlink: "10",
  effective_type: "4g",
  round_trip_time: "200",
  msToken: "",
};

// 音乐对象类型
export interface DouyinMusicItem {
  id: number;
  id_str?: string;
  title: string;
  author: string;
  album?: string;
  cover_hd?: {
    uri: string;
    url_list: string[];
  };
  cover_large?: {
    uri: string;
    url_list: string[];
  };
  cover_medium?: {
    uri: string;
    url_list: string[];
  };
  cover_thumb?: {
    uri: string;
    url_list: string[];
  };
  play_url?: {
    uri: string;
    url_list: string[];
  };
  schema_url?: string;
  source_platform?: number;
  start_time?: number;
  end_time?: number;
  duration: number;
  extra?: Record<string, unknown>;
  user_count?: number;
  position?: number;
  collect_stat?: number;
  status?: number;
  offline_desc?: string;
  owner_id?: string;
  owner_nickname?: string;
  is_original?: number;
  mid?: string;
  binded_challenge_id?: number;
  redirect?: boolean;
  is_restricted?: number;
  author_deleted?: boolean;
  is_del_video?: number;
  is_video_self_see?: number;
  owner_handle?: string;
  author_position?: number;
  prevent_download?: number;
  strong_beat_url?: string;
  unshelve_countries?: string;
  prevent_item_download_status?: number;
  external_song_info?: string;
  sec_uid?: string;
  avatar_thumb?: { uri: string; url_list: string[] };
  avatar_medium?: { uri: string; url_list: string[] };
  avatar_large?: { uri: string; url_list: string[] };
  preview_end_time?: number;
  preview_start_time?: number;
  is_commerce_music?: number;
  is_original_sound?: number;
  audition_duration?: number;
  shoot_duration?: number;
  reason_type?: number;
  artists?: string;
  lyric_short_position?: number;
  mute_share?: boolean;
  tag_list?: string;
  dmv_auto_show?: number;
  is_pgc?: number;
  is_matched_metadata?: boolean;
  is_audio_url_with_cookie?: number;
  music_chart_ranks?: string;
  can_background_play?: number;
  music_status?: number;
  video_duration?: number;
  pgc_music_type?: number;
  author_status?: number;
  search_impr?: Record<string, unknown>;
  artist_user_infos?: string;
  dsp_status?: string;
  musician_user_infos?: string;
  luna_info?: string;
  music_collect_count?: number;
  music_cover_atmosphere_color_value?: string;
  show_origin_clip?: number;
  music_recall_source?: string;
  talent_hashtag_name_list?: string;
}

// API 响应类型
export interface DouyinMusicResponse {
  mc_list: DouyinMusicItem[];
  cursor: number;
  has_more: number;
  request_tag?: number;
  [key: string]: unknown;
}

// 服务类
export class DouyinMusicService {
  private aBogus: ABogus;
  private cookie: string;
  private userAgent: string;

  constructor(cookie: string, userAgent: string = DEFAULT_USER_AGENT) {
    this.cookie = cookie;
    this.userAgent = userAgent;
    this.aBogus = new ABogus(userAgent, "Win32");
  }

  // 构建请求参数
  private buildParams(cursor = 0, count = 20): Record<string, string> {
    const params: Record<string, string> = {
      ...BASE_PARAMS,
      cursor: String(cursor),
      count: String(count),
    };

    // 生成 a_bogus 签名
    const paramString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const bogus = this.aBogus.getValue(paramString, "GET");
    params["a_bogus"] = bogus;

    return params;
  }

  // 获取音乐收藏列表
  async getFavoriteList(
    cursor = 0,
    count = 20,
  ): Promise<DouyinMusicResponse> {
    const params = this.buildParams(cursor, count);

    const headers = {
      "User-Agent": this.userAgent,
      Cookie: this.cookie,
      Referer: REFERER,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Connection: "keep-alive",
    };

    try {
      const response = await axios.get(DOUYIN_API, {
        params,
        headers,
        timeout: 15000,
        withCredentials: true,
      });

      const data = response.data;

      // 验证响应结构
      if (!data || typeof data !== "object") {
        throw new Error("响应数据格式错误");
      }

      console.log(
        `[DouyinService] Response top keys: ${Object.keys(data).join(", ")}`,
      );
      if (typeof data.data === "object" && data.data) {
        console.log(
          `[DouyinService] Response.data keys: ${Object.keys(data.data).join(", ")}`,
        );
      }

      // 递归查找包含 mc_list 的对象
      const findMcListContainer = (obj: any): any => {
        if (!obj || typeof obj !== "object") return null;
        if (Array.isArray(obj.mc_list)) return obj;
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === "object") {
            const found = findMcListContainer(obj[key]);
            if (found) return found;
          }
        }
        return null;
      };

      const container = findMcListContainer(data);

      if (!container) {
        // 检查是否有错误信息
        if ("status_code" in data && data.status_code !== 0) {
          throw new Error(`API 错误: ${data.status_msg || data.status_code}`);
        }
        return {
          mc_list: [],
          cursor: 0,
          has_more: 0,
          ...data,
        };
      }

      return {
        mc_list: container.mc_list || [],
        cursor: container.cursor ?? 0,
        has_more: container.has_more ?? 0,
        ...data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.status_msg || error.message;
        throw new Error(`HTTP ${status}: ${message}`);
      }
      throw error;
    }
  }

  // 简化的音乐对象（用于 SPlayer）
  async getSimpleSongs(cursor = 0, count = 20): Promise<{
    list: DouyinMusicItem[];
    cursor: number;
    hasMore: boolean;
  }> {
    const response = await this.getFavoriteList(cursor, count);
    return {
      list: response.mc_list,
      cursor: response.cursor,
      hasMore: Boolean(response.has_more),
    };
  }
}

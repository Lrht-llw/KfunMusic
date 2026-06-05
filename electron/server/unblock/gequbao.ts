import type { SongMatchInfo, SongUrlResult } from "./unblock";
import { isSongMatch } from "./match";
import { serverLog } from "../../main/logger";
import axios from "axios";
import { randomBytes } from "crypto";

/**
 * 搜索歌曲获取 ID
 * @param match 原曲匹配信息
 * @returns 歌曲 ID 或 null
 */
const search = async (match: SongMatchInfo): Promise<string | null> => {
  try {
    const searchUrl = `https://www.gequbao.com/s/${encodeURIComponent(match.keyword)}`;
    const { data } = await axios.get(searchUrl);

    // 匹配歌曲链接和歌名
    // <a href="/music/17165" target="_blank" class="music-link d-block">
    const regex = /<a href="\/music\/(\d+)" target="_blank" class="music-link d-block">\s*([^<]*)/g;
    let hasResult = false;
    // 校验歌名是否与原曲吻合（歌曲宝搜索页无艺术家信息，仅校验歌名）
    for (const m of data.matchAll(regex)) {
      hasResult = true;
      const songName = m[2]?.trim();
      if (songName && isSongMatch(songName, undefined, match)) {
        return m[1];
      }
    }
    if (!hasResult) return null;
    serverLog.warn(`⚠️ Gequbao 搜索结果均不匹配原曲: "${match.songName}"`);
    return null;
  } catch (error) {
    serverLog.error("❌ Get GequbaoSongId Error:", error);
    return null;
  }
};

/**
 * 获取播放 ID
 * @param id 歌曲 ID
 * @returns 播放 ID 或 null
 */
const getPlayId = async (id: string): Promise<string | null> => {
  try {
    const url = `https://www.gequbao.com/music/${id}`;
    const { data } = await axios.get(url);

    // 匹配 window.appData 中的 play_id
    // "play_id":"EFwMVSQDBgsBQV5WBCUDAVkCSQ9WX3kFXV9XEl0KBSEaVldTR19NVndQVlhXRl5cUA=="
    const match = data.match(/"play_id":"(.*?)"/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch (error) {
    serverLog.error("❌ Get GequbaoPlayId Error:", error);
    return null;
  }
};

/**
 * 获取歌曲 URL
 * @param match 原曲匹配信息
 * @returns 包含歌曲 URL 的结果对象
 */
const getGequbaoSongUrl = async (match: SongMatchInfo): Promise<SongUrlResult> => {
  try {
    if (!match.keyword) return { code: 404, url: null };

    // 1. 获取 ID
    const id = await search(match);
    if (!id) return { code: 404, url: null };

    // 2. 获取 play_id
    const playId = await getPlayId(id);
    if (!playId) return { code: 404, url: null };

    // 3. 获取播放链接
    const url = "https://www.gequbao.com/api/play-url";
    const headers = {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "zh-CN,zh;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      pragma: "no-cache",
      priority: "u=1, i",
      "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
      cookie: `server_name_session=${randomBytes(16).toString("hex")}`,
      Referer: `https://www.gequbao.com/music/${id}`,
    };

    const body = `id=${encodeURIComponent(playId)}`;

    const { data } = await axios.post(url, body, { headers });

    if (data.code === 1 && data.data && data.data.url) {
      serverLog.log("🔗 GequbaoSong URL:", data.data.url);
      return { code: 200, url: data.data.url };
    }

    return { code: 404, url: null };
  } catch (error) {
    serverLog.error("❌ Get GequbaoSong URL Error:", error);
    return { code: 404, url: null };
  }
};

export default getGequbaoSongUrl;

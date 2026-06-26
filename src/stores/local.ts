import type { SongType, LocalPlaylistType, LocalLikeDataType } from "@/types/main";
import type { CoverType, ArtistType } from "@/types/main";
import { cloneDeep } from "lodash-es";
import localforage from "localforage";

// localDB
const localDB = localforage.createInstance({
  name: "local-data",
  description: "Local data of the application",
  storeName: "local",
});

/**
 * 生成本地歌单 ID（16位数字）
 * 使用时间戳 + 随机数确保唯一性
 */
const generateLocalPlaylistId = (): number => {
  const timestamp = Date.now().toString(); // 13位
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0"); // 3位
  return parseInt(timestamp + random, 10);
};

/**
 * 创建 localStore 实例
 * @returns localStore 实例
 */
const createLocalStore = () => {
  // 本地歌曲
  const localSongs = ref<SongType[]>([]);
  // 本地歌单
  const localPlaylists = ref<LocalPlaylistType[]>([]);
  // 本地收藏歌曲（我喜欢的音乐）
  const localLikedSongs = ref<SongType[]>([]);
  // 本地收藏数据（歌单、专辑、歌手、视频、播客）
  const localLikedData = ref<LocalLikeDataType>({
    playlists: [],
    albums: [],
    artists: [],
    videos: [],
    radios: [],
  });
  // 是否初始化完成
  const isInitialized = ref(false);

  // 读取本地歌曲
  const readLocalSong = async (): Promise<SongType[]> => {
    try {
      const result = await localDB.getItem("local-songs");
      localSongs.value = (result as SongType[]) || [];
      return localSongs.value;
    } catch (error) {
      console.error("Error reading local songs:", error);
      throw error;
    }
  };

  // 更新本地歌曲
  const updateLocalSong = async (songs: SongType[]) => {
    try {
      await localDB.setItem("local-songs", cloneDeep(songs));
      localSongs.value = songs;
    } catch (error) {
      console.error("Error updating local songs:", error);
      throw error;
    }
  };

  // 读取本地收藏歌曲
  const readLocalLikedSongs = async (): Promise<SongType[]> => {
    try {
      const result = await localDB.getItem("local-liked-songs");
      localLikedSongs.value = (result as SongType[]) || [];
      return localLikedSongs.value;
    } catch (error) {
      console.error("Error reading local liked songs:", error);
      throw error;
    }
  };

  // 保存本地收藏歌曲
  const saveLocalLikedSongs = async () => {
    try {
      await localDB.setItem("local-liked-songs", cloneDeep(localLikedSongs.value));
    } catch (error) {
      console.error("Error saving local liked songs:", error);
      throw error;
    }
  };

  // 添加歌曲到本地收藏
  const addToLocalLikedSongs = async (song: SongType): Promise<boolean> => {
    const exists = localLikedSongs.value.some((s) => s.id === song.id && s.type === song.type);
    if (exists) return false;
    localLikedSongs.value.unshift(song);
    await saveLocalLikedSongs();
    return true;
  };

  // 从本地收藏移除歌曲
  const removeFromLocalLikedSongs = async (songId: number, songType?: string): Promise<boolean> => {
    const index = localLikedSongs.value.findIndex(
      (s) => s.id === songId && (songType ? s.type === songType : true),
    );
    if (index === -1) return false;
    localLikedSongs.value.splice(index, 1);
    await saveLocalLikedSongs();
    return true;
  };

  // 切换歌曲收藏状态
  const toggleLocalLikedSong = async (song: SongType): Promise<boolean> => {
    const exists = localLikedSongs.value.some((s) => s.id === song.id && s.type === song.type);
    if (exists) {
      await removeFromLocalLikedSongs(song.id, song.type);
      return false;
    } else {
      await addToLocalLikedSongs(song);
      return true;
    }
  };

  // 检查歌曲是否已收藏
  const isLocalLikedSong = (songId: number, songType?: string): boolean => {
    return localLikedSongs.value.some(
      (s) => s.id === songId && (songType ? s.type === songType : true),
    );
  };

  // 读取本地收藏数据（歌单、专辑、歌手、视频、播客）
  const readLocalLikedData = async (): Promise<LocalLikeDataType> => {
    try {
      const result = await localDB.getItem("local-liked-data");
      localLikedData.value = (result as LocalLikeDataType) || {
        playlists: [],
        albums: [],
        artists: [],
        videos: [],
        radios: [],
      };
      return localLikedData.value;
    } catch (error) {
      console.error("Error reading local liked data:", error);
      throw error;
    }
  };

  // 保存本地收藏数据
  const saveLocalLikedData = async () => {
    try {
      await localDB.setItem("local-liked-data", cloneDeep(localLikedData.value));
    } catch (error) {
      console.error("Error saving local liked data:", error);
      throw error;
    }
  };

  // 添加到本地收藏歌单
  const addLocalLikedPlaylist = async (playlist: CoverType): Promise<boolean> => {
    const exists = localLikedData.value.playlists.some((p) => p.id === playlist.id);
    if (exists) return false;
    localLikedData.value.playlists.unshift(playlist);
    await saveLocalLikedData();
    return true;
  };

  // 从本地收藏歌单移除
  const removeLocalLikedPlaylist = async (id: number | string): Promise<boolean> => {
    const index = localLikedData.value.playlists.findIndex((p) => p.id === id);
    if (index === -1) return false;
    localLikedData.value.playlists.splice(index, 1);
    await saveLocalLikedData();
    return true;
  };

  // 检查歌单是否已收藏
  const isLocalLikedPlaylist = (id: number | string): boolean => {
    return localLikedData.value.playlists.some((p) => p.id === id);
  };

  // 添加到本地收藏专辑
  const addLocalLikedAlbum = async (album: CoverType): Promise<boolean> => {
    const exists = localLikedData.value.albums.some((a) => a.id === album.id);
    if (exists) return false;
    localLikedData.value.albums.unshift(album);
    await saveLocalLikedData();
    return true;
  };

  // 从本地收藏专辑移除
  const removeLocalLikedAlbum = async (id: number | string): Promise<boolean> => {
    const index = localLikedData.value.albums.findIndex((a) => a.id === id);
    if (index === -1) return false;
    localLikedData.value.albums.splice(index, 1);
    await saveLocalLikedData();
    return true;
  };

  // 检查专辑是否已收藏
  const isLocalLikedAlbum = (id: number | string): boolean => {
    return localLikedData.value.albums.some((a) => a.id === id);
  };

  // 添加到本地收藏歌手
  const addLocalLikedArtist = async (artist: ArtistType): Promise<boolean> => {
    const exists = localLikedData.value.artists.some((a) => a.id === artist.id);
    if (exists) return false;
    localLikedData.value.artists.unshift(artist);
    await saveLocalLikedData();
    return true;
  };

  // 从本地收藏歌手移除
  const removeLocalLikedArtist = async (id: number | string): Promise<boolean> => {
    const index = localLikedData.value.artists.findIndex((a) => a.id === id);
    if (index === -1) return false;
    localLikedData.value.artists.splice(index, 1);
    await saveLocalLikedData();
    return true;
  };

  // 检查歌手是否已收藏
  const isLocalLikedArtist = (id: number | string): boolean => {
    return localLikedData.value.artists.some((a) => a.id === id);
  };

  // 添加到本地收藏视频
  const addLocalLikedVideo = async (video: CoverType): Promise<boolean> => {
    const exists = localLikedData.value.videos.some((v) => v.id === video.id);
    if (exists) return false;
    localLikedData.value.videos.unshift(video);
    await saveLocalLikedData();
    return true;
  };

  // 从本地收藏视频移除
  const removeLocalLikedVideo = async (id: number | string): Promise<boolean> => {
    const index = localLikedData.value.videos.findIndex((v) => v.id === id);
    if (index === -1) return false;
    localLikedData.value.videos.splice(index, 1);
    await saveLocalLikedData();
    return true;
  };

  // 检查视频是否已收藏
  const isLocalLikedVideo = (id: number | string): boolean => {
    return localLikedData.value.videos.some((v) => v.id === id);
  };

  // 添加到本地收藏播客
  const addLocalLikedRadio = async (radio: CoverType): Promise<boolean> => {
    const exists = localLikedData.value.radios.some((r) => r.id === radio.id);
    if (exists) return false;
    localLikedData.value.radios.unshift(radio);
    await saveLocalLikedData();
    return true;
  };

  // 从本地收藏播客移除
  const removeLocalLikedRadio = async (id: number | string): Promise<boolean> => {
    const index = localLikedData.value.radios.findIndex((r) => r.id === id);
    if (index === -1) return false;
    localLikedData.value.radios.splice(index, 1);
    await saveLocalLikedData();
    return true;
  };

  // 检查播客是否已收藏
  const isLocalLikedRadio = (id: number | string): boolean => {
    return localLikedData.value.radios.some((r) => r.id === id);
  };

  // 删除指定歌曲
  const deleteLocalSong = async (index: number) => {
    try {
      const playlist = cloneDeep(localSongs.value);
      playlist.splice(index, 1);
      await localDB.setItem("local-songs", playlist);
      localSongs.value = playlist;
    } catch (error) {
      console.error("Error deleting local song:", error);
      throw error;
    }
  };

  /**
   * 获取封面图片并转为 base64
   * @param coverUrl 封面 URL
   * @returns base64 格式的封面数据，失败返回 undefined
   */
  const fetchCoverAsBase64 = async (coverUrl: string): Promise<string | undefined> => {
    if (!coverUrl || coverUrl.startsWith("data:")) {
      // 已经是 base64 或为空
      return coverUrl || undefined;
    }
    try {
      const response = await fetch(coverUrl);
      if (!response.ok) return undefined;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error fetching cover:", error);
      return undefined;
    }
  };

  /**
   * 更新本地歌单封面
   * @param playlist 歌单对象
   * @param forceUpdate 是否强制更新（即使已有封面）
   */
  const updatePlaylistCover = async (
    playlist: LocalPlaylistType,
    forceUpdate: boolean = false,
  ): Promise<void> => {
    if (!forceUpdate && playlist.cover) return;

    if (playlist.songs.length === 0) {
      playlist.cover = undefined;
      return;
    }

    const firstSong = playlist.songs[0];
    if (firstSong?.cover) {
      const base64Cover = await fetchCoverAsBase64(firstSong.cover);
      if (base64Cover) {
        playlist.cover = base64Cover;
      }
    }
  };

  // 读取本地歌单列表
  const readLocalPlaylists = async (): Promise<LocalPlaylistType[]> => {
    try {
      const result = await localDB.getItem("local-playlists");
      const playlists = (result as LocalPlaylistType[]) || [];

      // 数据迁移：旧格式 songs 是 string[]（ID数组），新格式是 SongType[]
      let needSave = false;
      for (const playlist of playlists) {
        if (playlist.songs.length > 0 && typeof playlist.songs[0] === "string") {
          // 旧格式，尝试从 localSongs 中查找并转换
          const songsMap = new Map(localSongs.value.map((s) => [s.id.toString(), s]));
          playlist.songs = (playlist.songs as unknown as string[])
            .map((songId) => songsMap.get(songId))
            .filter((s): s is SongType => s !== undefined);
          needSave = true;
        }
      }

      localPlaylists.value = playlists;
      isInitialized.value = true;

      if (needSave) {
        await saveLocalPlaylists();
      }

      return localPlaylists.value;
    } catch (error) {
      console.error("Error reading local playlists:", error);
      throw error;
    }
  };

  // 保存本地歌单列表到存储
  const saveLocalPlaylists = async () => {
    try {
      await localDB.setItem("local-playlists", cloneDeep(localPlaylists.value));
    } catch (error) {
      console.error("Error saving local playlists:", error);
      throw error;
    }
  };

  // 创建本地歌单
  const createLocalPlaylist = async (
    name: string,
    description?: string,
  ): Promise<LocalPlaylistType> => {
    const now = Date.now();
    const newPlaylist: LocalPlaylistType = {
      id: generateLocalPlaylistId(),
      name,
      description,
      songs: [],
      createTime: now,
      updateTime: now,
    };
    localPlaylists.value.push(newPlaylist);
    await saveLocalPlaylists();
    return newPlaylist;
  };

  // 更新本地歌单信息
  const updateLocalPlaylist = async (
    id: number,
    data: Partial<Pick<LocalPlaylistType, "name" | "description">>,
  ): Promise<boolean> => {
    const index = localPlaylists.value.findIndex((p) => p.id === id);
    if (index === -1) return false;
    const playlist = localPlaylists.value[index];
    if (data.name !== undefined) playlist.name = data.name;
    if (data.description !== undefined) playlist.description = data.description;
    playlist.updateTime = Date.now();
    await saveLocalPlaylists();
    return true;
  };

  // 删除本地歌单
  const deleteLocalPlaylist = async (id: number): Promise<boolean> => {
    const index = localPlaylists.value.findIndex((p) => p.id === id);
    if (index === -1) return false;
    localPlaylists.value.splice(index, 1);
    await saveLocalPlaylists();
    return true;
  };

  // 添加歌曲到本地歌单
  const addSongsToLocalPlaylist = async (
    playlistId: number,
    songs: SongType[],
  ): Promise<{ success: boolean; addedCount: number }> => {
    const playlist = localPlaylists.value.find((p) => p.id === playlistId);
    if (!playlist) return { success: false, addedCount: 0 };

    // 过滤已存在的歌曲（用 id + type 判断）
    const existingKeys = new Set(playlist.songs.map((s) => `${s.id}_${s.type}`));
    const newSongs = songs.filter((s) => !existingKeys.has(`${s.id}_${s.type}`));
    if (newSongs.length === 0) return { success: true, addedCount: 0 };

    const oldFirstSongId = playlist.songs[0]?.id;
    // 后添加的歌曲放在前面
    playlist.songs.unshift(...newSongs);
    playlist.updateTime = Date.now();
    // 如果第一首歌曲变了（或者之前没有歌曲），则更新封面
    const newFirstSongId = playlist.songs[0]?.id;
    if (oldFirstSongId !== newFirstSongId) {
      await updatePlaylistCover(playlist, true);
    }
    await saveLocalPlaylists();
    return { success: true, addedCount: newSongs.length };
  };

  // 从本地歌单移除歌曲
  const removeSongsFromLocalPlaylist = async (
    playlistId: number,
    songIds: number[],
  ): Promise<boolean> => {
    const playlist = localPlaylists.value.find((p) => p.id === playlistId);
    if (!playlist) return false;

    const idsToRemove = new Set(songIds);
    const oldFirstSongId = playlist.songs[0]?.id;
    playlist.songs = playlist.songs.filter((s) => !idsToRemove.has(s.id));
    playlist.updateTime = Date.now();

    // 如果第一首歌曲变了，更新封面
    const newFirstSongId = playlist.songs[0]?.id;
    if (oldFirstSongId !== newFirstSongId) {
      await updatePlaylistCover(playlist, true);
    }

    await saveLocalPlaylists();
    return true;
  };

  // 获取本地歌单详情（包含歌曲列表）
  const getLocalPlaylistDetail = (
    id: number,
  ): { playlist: LocalPlaylistType; songs: SongType[] } | null => {
    const playlist = localPlaylists.value.find((p) => p.id === id);
    if (!playlist) return null;

    return { playlist, songs: playlist.songs };
  };

  /**
   * 重排本地歌单中的歌曲顺序
   * @param playlistId 歌单 ID
   * @param fromIndex 源位置索引
   * @param toIndex 目标位置索引
   */
  const reorderSongsInLocalPlaylist = async (
    playlistId: number,
    fromIndex: number,
    toIndex: number,
  ): Promise<boolean> => {
    const playlist = localPlaylists.value.find((p) => p.id === playlistId);
    if (!playlist) return false;
    if (fromIndex < 0 || fromIndex >= playlist.songs.length) return false;
    if (toIndex < 0 || toIndex >= playlist.songs.length) return false;
    if (fromIndex === toIndex) return true;

    const [movedSong] = playlist.songs.splice(fromIndex, 1);
    playlist.songs.splice(toIndex, 0, movedSong);
    playlist.updateTime = Date.now();

    await saveLocalPlaylists();
    return true;
  };

  /**
   * 判断是否为本地歌单 ID
   * @param id 歌单 ID
   */
  const isLocalPlaylist = (id: number | string | undefined | null): boolean => {
    if (!id) return false;
    const strId = id.toString();
    if (strId.length !== 16) return false;
    // 检查是否存在于本地歌单列表
    return localPlaylists.value.some((p) => p.id.toString() === strId);
  };

  // 直接初始化数据
  readLocalSong();
  readLocalPlaylists();
  readLocalLikedSongs();
  readLocalLikedData();

  return reactive({
    localSongs,
    localPlaylists,
    localLikedSongs,
    localLikedData,
    isInitialized,
    readLocalSong,
    updateLocalSong,
    deleteLocalSong,
    readLocalPlaylists,
    createLocalPlaylist,
    updateLocalPlaylist,
    deleteLocalPlaylist,
    addSongsToLocalPlaylist,
    removeSongsFromLocalPlaylist,
    reorderSongsInLocalPlaylist,
    getLocalPlaylistDetail,
    isLocalPlaylist,
    readLocalLikedSongs,
    addToLocalLikedSongs,
    removeFromLocalLikedSongs,
    toggleLocalLikedSong,
    isLocalLikedSong,
    saveLocalLikedSongs,
    // 本地收藏数据
    readLocalLikedData,
    // 歌单收藏
    addLocalLikedPlaylist,
    removeLocalLikedPlaylist,
    isLocalLikedPlaylist,
    // 专辑收藏
    addLocalLikedAlbum,
    removeLocalLikedAlbum,
    isLocalLikedAlbum,
    // 歌手收藏
    addLocalLikedArtist,
    removeLocalLikedArtist,
    isLocalLikedArtist,
    // 视频收藏
    addLocalLikedVideo,
    removeLocalLikedVideo,
    isLocalLikedVideo,
    // 播客收藏
    addLocalLikedRadio,
    removeLocalLikedRadio,
    isLocalLikedRadio,
  });
};

// 创建全局的 localStore 实例
const localStoreInstance = createLocalStore();

/**
 * 获取本地歌单存储实例
 * @returns 本地歌单存储实例
 */
export const useLocalStore = () => {
  return localStoreInstance;
};

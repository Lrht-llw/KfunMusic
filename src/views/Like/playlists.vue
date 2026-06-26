<template>
  <div class="like-type">
    <CoverList
      :data="listData"
      type="playlist"
      :hiddenCover="settingStore.hiddenCovers.like"
    />
  </div>
</template>

<script setup lang="ts">
import { useDataStore, useLocalStore, useSettingStore } from "@/stores";

const dataStore = useDataStore();
const localStore = useLocalStore();
const settingStore = useSettingStore();

// 歌单列表（合并在线收藏和本地收藏）
const listData = computed(() => {
  const onlinePlaylists =
    dataStore.userLikeData.playlists?.filter(
      (pl) => pl?.userId !== dataStore.userData.userId,
    ) || [];
  const localPlaylists = localStore.localLikedData.playlists || [];
  return [...onlinePlaylists, ...localPlaylists];
});
</script>

<style lang="scss" scoped>
</style>

<template>
  <div class="like-type">
    <CoverList
      :data="videos"
      cols="2 600:2 800:3 900:4 1200:5 1400:6"
      type="video"
      :hiddenCover="settingStore.hiddenCovers.like"
    />
  </div>
</template>

<script setup lang="ts">
import { useDataStore, useLocalStore, useSettingStore } from "@/stores";
import { computed } from "vue";

const dataStore = useDataStore();
const localStore = useLocalStore();
const settingStore = useSettingStore();

// 合并在线收藏和本地收藏
const videos = computed(() => [
  ...(dataStore.userLikeData.mvs || []),
  ...(localStore.localLikedData.videos || []),
]);
</script>

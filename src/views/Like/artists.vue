<template>
  <div class="like-type">
    <ArtistList
      :data="artists"
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
const artists = computed(() => [
  ...(dataStore.userLikeData.artists || []),
  ...(localStore.localLikedData.artists || []),
]);
</script>

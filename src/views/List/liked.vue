<!-- 我喜欢的音乐 -->
<template>
  <div class="liked-list">
    <ListDetail
      :detail-data="detailData"
      :list-data="listData"
      :loading="showLoading"
      :list-scrolling="listScrolling"
      :search-value="searchValue"
      :config="listConfig"
      :play-button-text="playButtonText"
      :more-options="moreOptions"
      title-text="我喜欢的音乐"
      hide-comment-tab
      @update:search-value="handleSearchUpdate"
      @play-all="playAllSongs"
    />
    <Transition name="fade" mode="out-in">
      <SongList
        v-if="!searchValue || searchData?.length"
        :data="displayData"
        :loading="loading"
        :height="songListHeight"
        :playListId="playlistId"
        :draggable="canDragSort"
        :doubleClickAction="searchData?.length ? 'add' : 'all'"
        @scroll="handleListScroll"
        @removeSong="removeSong"
        @reorder="handleReorder"
      />
      <n-empty
        v-else
        :description="`搜不到关于 ${searchValue} 的任何歌曲呀`"
        style="margin-top: 60px"
        size="large"
      >
        <template #icon>
          <SvgIcon name="SearchOff" />
        </template>
      </n-empty>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { DropdownOption } from "naive-ui";
import { renderIcon } from "@/utils/helper";
import { useLocalStore, useStatusStore } from "@/stores";
import { openBatchList } from "@/utils/modal";
import { useListDetail } from "@/composables/List/useListDetail";
import { useListSearch } from "@/composables/List/useListSearch";
import { useListScroll } from "@/composables/List/useListScroll";
import { useListActions } from "@/composables/List/useListActions";

const localStore = useLocalStore();
const statusStore = useStatusStore();

const {
  detailData,
  listData,
  loading,
  getSongListHeight,
  setDetailData,
  setListData,
  setLoading,
} = useListDetail();
const { searchValue, searchData, displayData, performSearch } =
  useListSearch(listData);
const { listScrolling, handleListScroll } = useListScroll();
const { playAllSongs: playAllSongsAction } = useListActions();

const playlistId = computed(() => undefined);

const canDragSort = computed(() => {
  return !searchValue.value && statusStore.listSortField === "default";
});

const songListHeight = computed(() => getSongListHeight(listScrolling.value));

const listConfig = {
  titleType: "normal" as const,
  showCoverMask: true,
  showPlayCount: true,
  showArtist: false,
  showCreator: true,
  showCount: false,
  searchAlign: "center" as const,
};

const showLoading = computed(() => listData.value.length === 0 && loading.value);

const playButtonText = computed(() => {
  if (showLoading.value) {
    return "正在加载...";
  }
  return "播放";
});

const moreOptions = computed<DropdownOption[]>(() => [
  {
    label: "批量操作",
    key: "batch",
    props: {
      onClick: () => openBatchList(displayData.value, true, -1),
    },
    icon: renderIcon("Batch"),
  },
]);

const handleSearchUpdate = (val: string) => {
  searchValue.value = val;
  performSearch(val);
};

const playAllSongs = useDebounceFn(() => {
  if (!displayData.value?.length) return;
  playAllSongsAction(displayData.value, playlistId.value);
}, 300);

const removeSong = async (ids: number[]) => {
  if (!listData.value) return;
  const newList = listData.value.filter((song) => !ids.includes(song.id));
  setListData(newList);

  for (const id of ids) {
    const song = listData.value.find((s) => s.id === id);
    if (song) {
      await localStore.removeFromLocalLikedSongs(id, song.type);
    }
  }
};

const handleReorder = async (fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) return;

  const newList = [...listData.value];
  const [moved] = newList.splice(fromIndex, 1);
  newList.splice(toIndex, 0, moved);
  setListData(newList);

  localStore.localLikedSongs = newList;
  await localStore.saveLocalLikedSongs();
};

watch(
  () => localStore.localLikedSongs,
  (newSongs) => {
    setListData(newSongs);
    const firstSong = newSongs[0];
    if (firstSong) {
      setDetailData({
        id: firstSong.id,
        cover: firstSong.cover,
        name: "我喜欢的音乐",
        description: `共 ${newSongs.length} 首歌曲`,
        count: newSongs.length,
      });
    } else {
      setDetailData({
        id: "local-liked",
        cover: "/images/album.jpg?asset",
        name: "我喜欢的音乐",
        description: "暂无收藏歌曲",
        count: 0,
      });
    }
  },
  { immediate: true, deep: true },
);

onMounted(() => {
  setLoading(false);
});
</script>

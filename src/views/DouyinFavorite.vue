<template>
  <div class="douyin-favorite">
    <div v-if="!douyinStore.isLoggedIn" class="login-section">
      <div class="login-card">
        <div class="login-icon">
          <SvgIcon name="Music" :size="48" />
        </div>
        <h2>抖音收藏音乐</h2>
        <p>配置抖音 Cookie 后即可播放您收藏的音乐</p>

        <div v-if="isLoadingCookie" class="cookie-file-status loading">
          <n-spin size="small" />
          <span>正在检测 Cookie 文件...</span>
        </div>
        <div v-else-if="douyinStore.cookieFileExists" class="cookie-file-status success">
          <SvgIcon name="CheckCircle" :size="18" />
          <span>已检测到 cookies.txt 文件</span>
        </div>
        <div v-else class="cookie-file-status warning">
          <SvgIcon name="AlertCircle" :size="18" />
          <span>未找到 Cookie 文件，请点击下方按钮选择文件</span>
        </div>

        <div class="button-group cookie-file-actions">
          <n-button type="primary" @click="loadCookieFromFile" :loading="isLoadingCookie">
            <template #icon>
              <SvgIcon name="FolderOpen" :size="18" />
            </template>
            选择 Cookie 文件
          </n-button>
        </div>

        <div class="cookie-input-section">
          <n-input
            v-model:value="cookieInput"
            type="textarea"
            :rows="4"
            placeholder="请粘贴抖音 Cookie（从浏览器开发者工具获取）"
            class="cookie-input"
          />
          <div class="cookie-hint">
            <n-text type="warning">📖 获取教程（Edge 浏览器）：</n-text>
            <n-text depth="3">
              <ol style="margin: 8px 0 0 20px; padding: 0; font-size: 12px;">
                <li>打开 Edge 浏览器，访问 <a href="https://www.douyin.com" target="_blank">抖音网页版</a></li>
                <li>登录你的抖音账号</li>
                <li>按 F12 打开开发者工具</li>
                <li>在开发者工具顶部点击「应用程序」标签页</li>
                <li>在左侧菜单展开「存储」→「Cookie」→「https://www.douyin.com」</li>
                <li>在右侧表格中找到名为 <code>sessionid</code> 的行，复制「值」列的内容</li>
                <li>将复制的内容粘贴到上方输入框中</li>
              </ol>
            </n-text>
          </div>
        </div>

        <div class="button-group">
          <n-button type="primary" @click="saveCookie" :disabled="!cookieInput.trim()">
            保存配置
          </n-button>
        </div>
      </div>
    </div>

    <div v-else class="content-section">
      <div class="header">
        <h2>抖音收藏音乐</h2>
        <div class="header-actions">
          <n-button
            type="primary"
            v-debounce="playAll"
            :disabled="douyinStore.favoriteList.length === 0 || douyinStore.isLoading"
            strong
            secondary
            round
          >
            <template #icon>
              <SvgIcon name="Play" />
            </template>
            播放全部（{{ douyinStore.favoriteList.length }}首）
          </n-button>
          <n-button text @click="refreshList">
            <template #icon>
              <SvgIcon name="Refresh" :size="18" />
            </template>
            刷新
          </n-button>
          <n-button text @click="clearCookie">
            <template #icon>
              <SvgIcon name="Logout" :size="18" />
            </template>
            退出登录
          </n-button>
        </div>
      </div>

      <div v-if="douyinStore.isLoading" class="loading-state">
        <n-skeleton text :rows="10" />
        <p class="loading-text">
          正在加载收藏音乐... 已获取 {{ douyinStore.favoriteList.length }} 首（第 {{ douyinStore.loadingPage || 1 }} 批）
        </p>
      </div>

      <div v-else-if="douyinStore.favoriteList.length === 0" class="empty-state">
        <SvgIcon name="Music" :size="64" class="empty-icon" />
        <p>{{ douyinStore.errorMessage || "暂无收藏音乐" }}</p>
        <n-button v-if="douyinStore.errorMessage" type="primary" @click="refreshList">
          重试
        </n-button>
      </div>

      <div v-else class="music-list">
        <SongList
          :data="convertToSongType(douyinStore.favoriteList)"
          height="auto"
        />

        <div v-if="douyinStore.hasMore" class="load-more">
          <n-button type="primary" @click="loadMore" :loading="douyinStore.isLoading">
            加载更多
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watchEffect } from "vue";
import { useDouyinStore } from "@/stores/douyin";
import SvgIcon from "@/components/Global/SvgIcon.vue";
import SongList from "@/components/List/SongList.vue";
import type { DouyinMusic } from "@/api/douyin";
import type { SongType } from "@/types/main";
import { useMessage } from "naive-ui";
import { usePlayerController } from "@/core/player/PlayerController";

const douyinStore = useDouyinStore();
const message = useMessage();
const player = usePlayerController();

const cookieInput = ref("");
const isLoadingCookie = ref(false);

// 调试日志 - 监控 store 状态变化
watchEffect(() => {
  console.log(
    "[Douyin Debug] isLoggedIn:",
    douyinStore.isLoggedIn,
    "favoriteList.length:",
    douyinStore.favoriteList.length,
    "hasMore:",
    douyinStore.hasMore,
    "isLoading:",
    douyinStore.isLoading,
    "cursor:",
    douyinStore.cursor,
    "errorMessage:",
    douyinStore.errorMessage,
  );
  if (douyinStore.favoriteList.length > 0) {
    console.log(
      "[Douyin Debug] First song in favoriteList:",
      douyinStore.favoriteList[0],
    );
    console.log(
      "[Douyin Debug] Converted first song:",
      convertToSongType([douyinStore.favoriteList[0]])[0],
    );
  }
});

const checkAndLoadCookieFile = async () => {
  isLoadingCookie.value = true;
  await douyinStore.checkCookieFile();

  const loaded = await douyinStore.loadCookieFromFile();
  isLoadingCookie.value = false;

  if (loaded) {
    message.success("Cookie 已从文件自动加载，正在批量获取收藏...");
    await douyinStore.fetchFavoriteList(true);
  }
};

const loadCookieFromFile = async () => {
  isLoadingCookie.value = true;

  try {
    // 先尝试自动检测现有文件（如果已有就直接加载）
    const existing = await douyinStore.loadCookieFromFile();
    if (existing) {
      message.success("Cookie 已加载，正在批量获取收藏...");
      await douyinStore.fetchFavoriteList(true);
      return;
    }

    // 没有现有文件，让用户选择并复制
    const result = await douyinStore.selectAndCopyCookieFile();

    if (result.canceled) {
      // 用户取消了选择，不显示错误
      return;
    }

    if (result.success) {
      message.success(result.message + "，正在批量获取收藏...");
      await douyinStore.fetchFavoriteList(true);
    } else {
      message.error(result.message);
    }
  } catch (error) {
    message.error("加载 Cookie 文件失败");
  } finally {
    isLoadingCookie.value = false;
  }
};

const saveCookie = () => {
  douyinStore.saveCookie(cookieInput.value);
  douyinStore.fetchFavoriteList(true);
};

const clearCookie = () => {
  douyinStore.clearCookie();
  cookieInput.value = "";
};

const refreshList = () => {
  douyinStore.fetchFavoriteList(true);
};

const loadMore = () => {
  douyinStore.fetchFavoriteList();
};

const playAll = async () => {
  if (douyinStore.favoriteList.length === 0) {
    message.warning("没有可播放的音乐");
    return;
  }

  const songs = convertToSongType(douyinStore.favoriteList);
  message.success(`开始播放 ${songs.length} 首抖音收藏音乐`);
  await player.updatePlayList(songs);
};

const convertToSongType = (list: DouyinMusic[]): SongType[] => {
  return list.map((music) => ({
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
  }));
};

onMounted(() => {
  checkAndLoadCookieFile();
});
</script>

<style scoped lang="scss">
.douyin-favorite {
  height: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;

  .login-section {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
  }

  .login-card {
    width: 100%;
    max-width: 500px;
    text-align: center;
    padding: 40px;

    .login-icon {
      margin-bottom: 20px;
      color: #000;
    }

    h2 {
      margin-bottom: 8px;
    }

    p {
      color: #666;
      margin-bottom: 16px;
    }
  }

  .cookie-file-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;

    &.loading {
      background: #f5f5f5;
      color: #666;
    }

    &.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    &.warning {
      background: #fff3e0;
      color: #ef6c00;
    }
  }

  .cookie-file-actions {
    margin-bottom: 20px;
  }

  .cookie-input-section {
    margin-bottom: 24px;

    .cookie-input {
      width: 100%;
    }

    .cookie-hint {
      margin-top: 12px;
      font-size: 12px;
      color: #888;
      text-align: left;
    }
  }

  .button-group {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .content-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;

      h2 {
        margin: 0;
      }

      .header-actions {
        display: flex;
        gap: 8px;
      }
    }

    .loading-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;

      .loading-text {
        text-align: center;
        color: #999;
        font-size: 14px;
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      gap: 16px;

      .empty-icon {
        color: #ccc;
      }

      p {
        color: #999;
        text-align: center;
        max-width: 400px;
      }
    }

    .music-list {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;

      :deep(.song-list) {
        flex: 1;
        min-height: 0;
      }

      .load-more {
        text-align: center;
        padding: 20px;
        flex-shrink: 0;
      }
    }
  }
}
</style>

<!-- 图片组件 -->
<template>
  <div
    ref="imgContainer"
    :key="src"
    class="s-image"
    :class="{ round }"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <!-- 加载图片 -->
    <Transition name="fade">
      <img v-if="!isLoaded" :src="defaultSrc" class="loading" alt="loading" />
    </Transition>
    <!-- 真实图片 -->
    <img
      v-if="imgSrc"
      ref="imgRef"
      :src="imgSrc"
      :key="imgSrc"
      :alt="alt || 'image'"
      :class="['cover', { loaded: isLoaded }]"
      :decoding="decodeAsync ? 'async' : 'auto'"
      :loading="nativeLazy ? 'lazy' : 'eager'"
      :style="{ objectFit: objectFit }"
      :crossorigin="crossorigin"
      @load="imageLoaded"
      @error="imageError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { useDebounceFn } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    /** 图片地址 */
    src: string | undefined;
    /** 默认图片 */
    defaultSrc?: string;
    /** 图片描述 */
    alt?: string;
    /** 图片大小 */
    size?: number;
    /** 图片填充方式 */
    objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
    /** 是否进行可视状态变化 */
    observeVisibility?: boolean;
    /** 在不可视时是否释放图片以回收内存 */
    releaseOnHide?: boolean;
    /** 是否使用浏览器异步解码 */
    decodeAsync?: boolean;
    /** 是否使用原生懒加载 */
    nativeLazy?: boolean;
    /** 跨域 */
    crossorigin?: "" | "anonymous" | "use-credentials" | undefined;
    /** 圆角 */
    round?: boolean;
  }>(),
  {
    defaultSrc: "/images/song.jpg?asset",
    observeVisibility: true,
    releaseOnHide: true,
    decodeAsync: true,
    nativeLazy: true,
    objectFit: "cover",
  },
);

const emit = defineEmits<{
  load: [e: Event];
  error: [e: Event];
  "update:show": [show: boolean];
}>();

const imgRef = ref<HTMLImageElement>();
const imgSrc = ref<string>();
const imgContainer = ref<HTMLImageElement>();
const isLoaded = ref<boolean>(false);
const lastShowState = ref<boolean | null>(null);
const loadToken = ref<number>(0);
const currentToken = ref<number>(0);

const isCanLook = props.observeVisibility ? useElementVisibility(imgContainer, {
  rootMargin: "100px",
}) : ref(true);

const imageLoaded = (e: Event) => {
  if (currentToken.value !== loadToken.value) return;
  if (isLoaded.value) return;
  isLoaded.value = true;
  emit("load", e);
};

const imageError = (e: Event) => {
  if (currentToken.value !== loadToken.value) return;
  isLoaded.value = false;
  if (imgSrc.value !== props.defaultSrc) {
    imgSrc.value = props.defaultSrc;
  }
  emit("error", e);
};

const setImageSrc = (src: string | undefined) => {
  if (src !== undefined) {
    loadToken.value += 1;
    currentToken.value = loadToken.value;
  }
  imgSrc.value = src;
};

const debouncedSetImageSrc = useDebounceFn(setImageSrc, 100);

watch(
  isCanLook,
  (show) => {
    if (!props.observeVisibility) return;
    if (lastShowState.value !== show) {
      lastShowState.value = show;
      emit("update:show", show);
    }
    if (show) {
      if (imgSrc.value !== props.src) {
        debouncedSetImageSrc(props.src);
      }
    } else if (props.releaseOnHide) {
      if (imgSrc.value !== undefined) {
        debouncedSetImageSrc(undefined);
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.src,
  (val) => {
    isLoaded.value = false;
    if (props.observeVisibility) {
      if (isCanLook.value) {
        if (imgSrc.value !== val) {
          debouncedSetImageSrc(val);
        }
      } else {
        if (props.releaseOnHide) {
          if (imgSrc.value !== undefined) {
            debouncedSetImageSrc(undefined);
          }
        }
      }
    } else {
      if (imgSrc.value !== val) {
        debouncedSetImageSrc(val);
      }
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  try {
    if (imgRef.value) {
      imgRef.value.src = "";
    }
  } catch {
    /* empty */
  }
  imgSrc.value = undefined;
  imgRef.value = undefined;
  imgContainer.value = undefined;
});
</script>

<style lang="scss" scoped>
.s-image {
  position: relative;
  width: 100%;
  height: 100%;
  img {
    width: 100%;
    height: 100%;
    overflow: hidden;
    transition: all 0.3s;
  }
  .loading {
    position: absolute;
    // top: 0;
    // left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
  .cover {
    // position: absolute;
    // top: 0;
    // left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    opacity: 0;
    &.loaded {
      opacity: 1;
    }
  }
  &.round {
    border-radius: 50%;
    overflow: hidden;
  }
}
</style>

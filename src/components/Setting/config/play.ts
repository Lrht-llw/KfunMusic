import { useSettingStore } from "@/stores";
import { usePlayerController } from "@/core/player/PlayerController";
import { isElectron } from "@/utils/env";
import { renderOption } from "@/utils/helper";
import { SettingConfig } from "@/types/settings";
import { AI_AUDIO_LEVELS } from "@/utils/meta";
import { openSongUnlockManager } from "@/utils/modal";
import type { SelectOption } from "naive-ui";
import { uniqBy } from "lodash-es";

import { computed, ref } from "vue";

export const usePlaySettings = (): SettingConfig => {
  const settingStore = useSettingStore();
  const player = usePlayerController();

  const outputDevices = ref<SelectOption[]>([]);

  // 获取全部输出设备
  const getOutputDevices = async () => {
    if (!isElectron) return;

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const devices = uniqBy(
        allDevices.filter((device) => device.kind === "audiooutput" && device.deviceId),
        "groupId",
      );
      const outputData = devices.filter((device) => device.kind === "audiooutput");
      outputDevices.value = outputData.map((device) => ({
        label: device.label,
        value: device.deviceId,
      }));

      // 验证已保存的设备是否在当前设备列表中
      if (
        settingStore.playDevice &&
        !outputData.some((d) => d.deviceId === settingStore.playDevice)
      ) {
        settingStore.playDevice = "default";
      }
    } catch (e) {
      console.error("获取 WebAudio 设备失败", e);
    }
  };

  // 切换输出设备
  const playDeviceChange = async (deviceId: string) => {
    const option = outputDevices.value.find((d) => d.value === deviceId);
    const label = option?.label || deviceId;

    try {
      await player.toggleOutputDevice(deviceId);
      settingStore.playDevice = deviceId;
      window.$message.success(`已切换输出设备为 ${label}`);
    } catch (e) {
      window.$message.error(`切换输出设备失败: ${e}`);
    }
  };

  const onActivate = () => {
    if (isElectron) getOutputDevices();
  };

  // 音质数据
  const songLevelData: Record<string, { label: string; tip: string; value: string }> = {
    standard: { label: "标准音质", tip: "标准音质 128kbps", value: "standard" },
    higher: { label: "较高音质", tip: "较高音质 328kbps", value: "higher" },
    exhigh: { label: "极高 (HQ)", tip: "近CD品质的细节体验，最高320kbps", value: "exhigh" },
    lossless: { label: "无损 (SQ)", tip: "高保真无损音质，最高48kHz/16bit", value: "lossless" },
    hires: {
      label: "高解析度无损 (Hi-Res)",
      tip: "更饱满清晰的高解析度音质，最高192kHz/24bit",
      value: "hires",
    },
    jyeffect: {
      label: "高清臻音 (Spatial Audio)",
      tip: "声音听感增强，96kHz/24bit",
      value: "jyeffect",
    },
    jymaster: { label: "超清母带 (Master)", tip: "还原音频细节，192kHz/24bit", value: "jymaster" },
    sky: {
      label: "沉浸环绕声 (Surround Audio)",
      tip: "沉浸式空间环绕音感，最高5.1声道",
      value: "sky",
    },
    vivid: {
      label: "臻音全景声 (Audio Vivid)",
      tip: "极致沉浸三维空间音频，最高7.1.4声道",
      value: "vivid",
    },
    dolby: {
      label: "杜比全景声 (Dolby Atmos)",
      tip: "杜比全景声音乐，沉浸式聆听体验",
      value: "dolby",
    },
  };

  // 动态计算音质选项
  const songLevelOptions = computed(() => {
    const options = Object.values(songLevelData);

    if (settingStore.disableAiAudio) {
      return options.filter((option) => {
        if (option.value === "dolby") return true;
        // 正确的类型转换或检查
        return !AI_AUDIO_LEVELS.includes(option.value);
      });
    }
    return options;
  });

  // 监听 Fuck AI Mode，重置不合法音质
  watch(
    () => settingStore.disableAiAudio,
    (val) => {
      if (!val) return;
      // 正确的类型检查
      if (AI_AUDIO_LEVELS.includes(settingStore.songLevel)) {
        settingStore.songLevel = "hires";
      }
    },
  );

  return {
    onActivate,
    groups: [
      {
        title: "播放控制",
        items: [
          {
            key: "autoPlay",
            label: "自动播放",
            type: "switch",
            description: "启动软件时是否自动播放",
            show: isElectron,
            value: computed({
              get: () => settingStore.autoPlay,
              set: (v) => (settingStore.autoPlay = v),
            }),
            disabled: !isElectron,
          },
          {
            key: "useNextPrefetch",
            label: "下一首歌曲预载",
            type: "switch",
            description: "提前预加载下一首歌曲的播放地址，提升切换速度",
            value: computed({
              get: () => settingStore.useNextPrefetch,
              set: (v) => (settingStore.useNextPrefetch = v),
            }),
          },
          {
            key: "memoryLastSeek",
            label: "记忆上次播放位置",
            type: "switch",
            description: "程序启动时恢复上次播放位置",
            value: computed({
              get: () => settingStore.memoryLastSeek,
              set: (v) => (settingStore.memoryLastSeek = v),
            }),
          },
          {
            key: "preventSleep",
            label: "阻止系统息屏",
            type: "switch",
            description: "是否在播放界面阻止系统息屏",
            value: computed({
              get: () => settingStore.preventSleep,
              set: (v) => (settingStore.preventSleep = v),
            }),
          },
          {
            key: "progressTooltipShow",
            label: "显示进度条悬浮信息",
            type: "switch",
            value: computed({
              get: () => settingStore.progressTooltipShow,
              set: (v) => (settingStore.progressTooltipShow = v),
            }),
            children: [
              {
                key: "progressLyricShow",
                label: "进度条悬浮时显示歌词",
                type: "switch",
                value: computed({
                  get: () => settingStore.progressLyricShow,
                  set: (v) => (settingStore.progressLyricShow = v),
                }),
              },
            ],
          },
          {
            key: "progressAdjustLyric",
            label: "进度调节吸附最近歌词",
            type: "switch",
            description: "进度调节时从当前时间最近一句歌词开始播放",
            value: computed({
              get: () => settingStore.progressAdjustLyric,
              set: (v) => (settingStore.progressAdjustLyric = v),
            }),
          },
          {
            key: "songVolumeFade",
            label: "音乐渐入渐出",
            type: "switch",
            value: computed({
              get: () => settingStore.songVolumeFade,
              set: (v) => (settingStore.songVolumeFade = v),
            }),
            children: [
              {
                key: "songVolumeFadeTime",
                label: "渐入渐出时长",
                type: "input-number",
                description: "单位 ms，最小 200，最大 2000",
                min: 200,
                max: 2000,
                suffix: "ms",
                value: computed({
                  get: () => settingStore.songVolumeFadeTime,
                  set: (v) => (settingStore.songVolumeFadeTime = v),
                }),
              },
            ],
          },
          {
            key: "enableAutomix",
            label: "启用自动混音",
            type: "switch",
            tags: [{ text: "Beta", type: "warning" }],
            description: "是否启用自动混音功能",
            value: computed({
              get: () => settingStore.enableAutomix,
              set: (v) => {
                if (v) {
                  window.$dialog.warning({
                    title: "启用自动混音 (Beta)",
                    content:
                      "可能出现兼容性问题，该功能在早期测试，遇到问题请反馈issue，不保证可以及时处理。效果可能因为歌曲而异，保守策略。",
                    positiveText: "开启",
                    negativeText: "取消",
                    onPositiveClick: () => {
                      settingStore.enableAutomix = true;
                    },
                  });
                } else {
                  settingStore.enableAutomix = v;
                }
              },
            }),
            children: [
              {
                key: "automixMaxAnalyzeTime",
                label: "最大分析时间",
                type: "input-number",
                description: "单位秒，越长越精准但更耗时 (建议 60s)",
                min: 5,
                max: 300,
                suffix: "s",
                value: computed({
                  get: () => settingStore.automixMaxAnalyzeTime,
                  set: (v) => (settingStore.automixMaxAnalyzeTime = v),
                }),
              },
            ],
          },
        ],
      },
      {
        title: "音频设置",
        items: [
          {
            key: "songLevel",
            label: "在线歌曲音质",
            type: "select",
            description: () => songLevelData[settingStore.songLevel]?.tip,
            options: songLevelOptions,
            componentProps: {
              renderOption,
            },
            value: computed({
              get: () => settingStore.songLevel,
              set: (v) => (settingStore.songLevel = v),
            }),
          },
          {
            key: "disableAiAudio",
            label: "Fuck AI Mode",
            type: "switch",
            description:
              "开启后将隐藏部分 AI 增强音质选项（如超清母带、沉浸环绕声等），但会保留杜比全景声",
            value: computed({
              get: () => settingStore.disableAiAudio,
              set: (v) => (settingStore.disableAiAudio = v),
            }),
          },
          {
            key: "disableDjMode",
            label: "Fuck DJ Mode",
            type: "switch",
            description: "歌曲名字带有 DJ 抖音 0.9 0.8 网红 车载 热歌 慢摇 自动跳过",
            value: computed({
              get: () => settingStore.disableDjMode,
              set: (v) => (settingStore.disableDjMode = v),
            }),
          },
          {
            key: "uncensorMaskedProfanity",
            label: "Fuck *** Mode",
            type: "switch",
            description: "把歌词里的 f**k 等屏蔽词还原为原词",
            value: computed({
              get: () => settingStore.uncensorMaskedProfanity,
              set: (v) => (settingStore.uncensorMaskedProfanity = v),
            }),
          },
          {
            key: "audioLatencyHint",
            label: "Web Audio 延迟策略",
            type: "select",
            tags: [{ text: "Beta", type: "warning" }],
            description:
              "调整 Web Audio 的延迟策略，修改后需重启。<br>" +
              "“低延迟模式（interactive）”延迟更低但可能不稳定；<br>" +
              "“高效能模式（playback）”延迟偏高但播放更稳定。<br>" +
              "已针对“高效能模式（playback）”补偿了音频输出延迟，理论上不会造成歌词与音频不同步的问题。",
            options: [
              { label: "低延迟模式（interactive）", value: "interactive" },
              { label: "高效能模式（playback）", value: "playback" },
            ],
            value: computed({
              get: () => settingStore.audioLatencyHint,
              set: (v) => {
                window.$dialog.warning({
                  title: "更改延迟策略",
                  content: "此操作需要重启应用才能生效，是否立即重启？",
                  positiveText: "重启",
                  negativeText: "取消",
                  onPositiveClick: () => {
                    settingStore.audioLatencyHint = v;
                    if (isElectron) {
                      window.electron.ipcRenderer.send("win-restart");
                    } else {
                      window.location.reload();
                    }
                  },
                });
              },
            }),
          },
          {
            key: "audioDelayCompensation",
            label: "音频与歌词同步补偿",
            type: "input-number",
            description:
              "手动补偿音频与歌词进度延迟。<br>正值歌词变快，负值歌词进度变慢。<br>适用于移动端等自动延迟检测不准的设备。",
            tags: [{ text: "Beta", type: "warning" }],
            show: computed(() => settingStore.audioLatencyHint === "playback"),
            min: -1000,
            max: 1000,
            step: 10,
            suffix: "ms",
            value: computed({
              get: () => settingStore.audioDelayCompensation,
              set: (v) => (settingStore.audioDelayCompensation = v ?? 0),
            }),
            defaultValue: 0,
          },
          {
            key: "playSongDemo",
            label: "播放试听",
            type: "switch",
            description: "是否在非会员状态下播放试听歌曲",
            show: !isElectron,
            value: computed({
              get: () => settingStore.playSongDemo,
              set: (v) => (settingStore.playSongDemo = v),
            }),
          },
          {
            key: "playDevice",
            label: "音频输出设备",
            type: "select",
            show: isElectron,
            description: "新增或移除音频设备后请重新打开设置",
            options: outputDevices,
            componentProps: {
              renderOption,
            },
            value: computed({
              get: () => settingStore.playDevice,
              set: (v) => playDeviceChange(v),
            }),
          },
          {
            key: "enableReplayGain",
            label: "音量平衡",
            type: "switch",
            description:
              "平衡不同音频内容之间的音量大小（需要本地歌曲标签中有 replayGain 数据才会生效）",
            value: computed({
              get: () => settingStore.enableReplayGain,
              set: (v) => (settingStore.enableReplayGain = v),
            }),
            children: [
              {
                key: "replayGainMode",
                label: "平衡模式",
                type: "select",
                description: "选择音量平衡的计算基准",
                options: [
                  { label: "单曲 (Track)", value: "track" },
                  { label: "专辑 (Album)", value: "album" },
                ],
                value: computed({
                  get: () => settingStore.replayGainMode,
                  set: (v) => (settingStore.replayGainMode = v),
                }),
              },
            ],
          },
        ],
      },
      {
        title: "音乐解锁",
        tags: [{ text: "Beta", type: "warning" }],
        show: isElectron,
        items: [
          {
            key: "useSongUnlock",
            label: "音乐解锁",
            type: "switch",
            description: "在无法正常播放时进行替换，可能会与原曲不符",
            value: computed({
              get: () => settingStore.useSongUnlock,
              set: (v) => (settingStore.useSongUnlock = v),
            }),
          },
          {
            key: "songUnlockConfig",
            label: "音源配置",
            type: "button",
            description: "配置歌曲解锁的音源顺序或是否启用",
            buttonLabel: "配置",
            action: openSongUnlockManager,
            disabled: computed(() => !settingStore.useSongUnlock),
          },
        ],
      },
    ],
  };
};

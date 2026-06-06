<div align="center">
<img alt="logo" height="100" width="100" src="public/icons/favicon.png" />
<h2> KfunMusic </h2>
<p> 一个简约的音乐播放器 </p>
<br />

[![Stars](https://img.shields.io/github/stars/Lrht-llw/KfunMusic?style=flat)](https://github.com/Lrht-llw/KfunMusic/stargazers)
[![Version](https://img.shields.io/github/v/release/Lrht-llw/KfunMusic)](https://github.com/Lrht-llw/KfunMusic/releases)
[![License](https://img.shields.io/github/license/Lrht-llw/KfunMusic)](https://github.com/Lrht-llw/KfunMusic/blob/dev/LICENSE)
[![Issues](https://img.shields.io/github/issues/Lrht-llw/KfunMusic)](https://github.com/Lrht-llw/KfunMusic/issues)

</div>

## 说明

> \[!IMPORTANT]
>
> ### 关于本项目
>
> - 本项目 **KfunMusic** 基于 [imsyy/SPlayer](https://github.com/imsyy/SPlayer) 二次开发
> - 本项目 **KfunMusic** 参考了 [TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader) 抖音音乐API对接代码（SM3哈希、ABogus签名、douyinMusicService服务类）并对实现原理进行重写
> - 原项目采用 **AGPL-3.0** 协议，本项目（KfunMusic）采用 **GPL-3.0** 协议进行开源

- 本项目采用 [Vue 3](https://cn.vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) + [Naïve UI](https://www.naiveui.com/) + [Electron](https://www.electronjs.org/zh/docs/latest/) 开发
- Node.js 版本要求：>= 20，包管理器：pnpm >= 10
- 默认会构建原生模块，需准备 Rust 工具链；如仅需要网页端构建或暂时跳过，可设置环境变量 `SKIP_NATIVE_BUILD=true`
- 支持客户端，由于设备有限，目前仅保证 Windows 系统的适配，其他平台如遇问题可以提 Issue 或自行解决后选择提 PR

<!--  > 请注意，本项目抛弃了跨平台适配以及网页端适配，仅保证 Windows 系统的适配 -->

- 欢迎各位大佬 `Star` 😍

## 使用方法

- [详情请见](docs/Tutorial.md)

## 🧑‍💻 开发

### 快速开始

1. 安装依赖：`pnpm install`
2. 复制 `.env.example` 为 `.env` 并按需修改
3. 启动开发：`pnpm dev`
4. 构建：
   - `pnpm build:win`

### 跳过原生模块构建

默认会编译 `native/*` 下的原生模块（需要 Rust）。如果你的场景不需要原生能力，可设置 `SKIP_NATIVE_BUILD=true` 后再执行 `pnpm dev` / `pnpm build`。

## 🎉 功能

### KfunMusic 新增

- 🎵 支持抖音收藏音乐播放
- 🎵 支持一键播放全部抖音收藏音乐
- 🎵 支持从文件加载抖音 Cookie（自动复制到项目目录）
- 🎵 支持自动批量加载抖音收藏列表

### 继承自 SPlayer

- ✨ 支持扫码登录
- 📱 支持手机号登录
- 💻 支持桌面歌词
- 💻 支持切换为本地播放器，此模式将不会连接网络
- 🎨 封面主题色自适应，支持全站着色
- 🌚 Light / Dark / Auto 模式自动切换
- 📁 本地歌曲管理及分类（建议先使用 [音乐标签](https://www.cnblogs.com/vinlxc/p/11347744.html) 进行匹配后再使用）
- 📁 本地音乐标签编辑及封面修改
- ➕ 新建歌单及歌单编辑
- ❤️ 收藏 / 取消收藏歌单或歌手
- ☁️ 云盘音乐上传
- 📂 云盘内歌曲播放
- 🔄 云盘内歌曲纠正
- 🗑️ 云盘歌曲删除
- 🌐 支持 Subsonic / Navidrome 等流媒体服务（多服务器支持、自动连接）
- 📝 支持逐字歌词
- 🔄 歌词滚动以及歌词翻译
- 📹 MV 与视频播放
- 🎶 音乐频谱显示
- ⏭️ 音乐渐入渐出
- 🔄 支持 PWA
- 💬 支持评论区
- 🎵 支持 Last.fm Scrobble（播放记录上报）

## ☹️抛弃的功能

- 📅 自动进行每日签到及云贝签到
- 📱 移动端基础适配

## 📦️ 获取

#### 稳定版

通常情况下，可以在 [Releases](https://github.com/Lrht-llw/KfunMusic/releases) 中获取稳定版

## 😘 鸣谢

特此感谢为本项目提供支持与灵感的项目：

- [SPlayer](https://github.com/imsyy/SPlayer) （本项目基于此项目二次开发）
- [TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader) （参考了api对接原理）
- [NeteaseCloudMusicApi](https://github.com/neteasecloudmusicapienhanced/api-enhanced)
- [YesPlayMusic](https://github.com/qier222/YesPlayMusic)
- [UnblockNeteaseMusic](https://github.com/UnblockNeteaseMusic/server)
- [applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics)
- [Vue-mmPlayer](https://github.com/maomao1996/Vue-mmPlayer)
- [refined-now-playing-netease](https://github.com/solstice23/refined-now-playing-netease)
- [material-color-utilities](https://github.com/material-foundation/material-color-utilities)

## 📢 免责声明

本项目部分功能使用了网易云音乐、抖音的第三方 API 服务，**仅供个人学习研究使用，禁止用于商业及非法用途**

同时，本项目开发者承诺 **严格遵守相关法律法规和网易云音乐 API 使用协议、抖音 API 使用协议，不会利用本项目进行任何违法活动。** 如因使用本项目而引起的任何纠纷或责任，均由使用者自行承担。**本项目开发者不承担任何因使用本项目而导致的任何直接或间接责任，并保留追究使用者违法行为的权利**

请使用者在使用本项目时遵守相关法律法规，**不要将本项目用于任何商业及非法用途。如有违反，一切后果由使用者自负。** 同时，使用者应该自行承担因使用本项目而带来的风险和责任。本项目开发者不对本项目所提供的服务和内容做出任何保证

感谢您的理解

## 📜 开源许可

- **本项目仅供个人学习研究使用，禁止用于商业及非法用途**
- 本项目基于 [GNU General Public License (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html) 许可进行开源
  1. **修改和分发：** 任何对本项目的修改和分发都必须基于 GPL-3.0 进行，源代码必须一并提供
  2. **派生作品：** 任何派生作品必须同样采用 GPL-3.0，并在适当的地方注明原始项目的许可证
  3. **免责声明：** 根据 GPL-3.0，本项目不提供任何明示或暗示的担保。请详细阅读 [GNU General Public License (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html) 以了解完整的免责声明内容
  4. **社区参与：** 欢迎社区的参与和贡献，我们鼓励开发者一同改进和维护本项目
  5. **许可证链接：** 请阅读 [GNU General Public License (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html) 了解更多详情


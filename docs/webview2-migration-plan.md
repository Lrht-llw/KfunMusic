# KfunMusic → WebView2 + C# 分阶段迁移规划

> 临时规划文档，评审通过后开始执行，执行完毕可删除。

## 1. 背景与目标

### 现状量化

| 层 | 规模 | 迁移方式 |
|---|---|---|
| 渲染层（Vue 3 + TS） | 155 组件 + 129 TS，约 6.1 万行 | **原样保留** |
| 桥接调用面 | 190 处调用，分布 43 个文件 | 接口签名不变，只换底层实现 |
| 主进程（Electron/Node） | 64 TS，约 8700 行，17 个 IPC 模块 | C# 重写 |
| 内嵌 Fastify 服务器 | 网易云/QQ音乐/解灰/抖音/control 五组 API | 先 sidecar 过渡，后 C# 重写 |
| Rust napi 模块 | 4 个模块，约 5800 行 | C# 重写（SMTC/UIA 在 C# 更简单） |

### 目标

- 动效与交互 **100% 保留**（AMLL 歌词、Automix、全部页面不动）
- 功能逐项对齐，无回归
- 播放态内存 ≤ 550MB，托盘性能模式 ≤ 350MB
- 安装包 ≤ 40MB（不含 WebView2 运行时，走 Evergreen 引导）
- 无 Node.js、无 Electron、无 Rust 构建链

### 非目标

- 不重写任何 Vue 组件
- 不改 UI 布局、交互逻辑、视觉设计
- 不支持 macOS / Linux（WebView2 仅 Windows；跨平台则本方案不成立）

---

## 2. 目标架构

```
┌────────────────────────────────────────────────┐
│  WPF 壳进程 (.NET 8)                            │
│  ├─ 窗口宿主：主窗/桌面歌词窗/任务栏歌词窗        │
│  ├─ 桥接服务：17 个 IPC 模块的 C# 实现           │
│  ├─ 本地服务：SQLite / 下载 / 缓存 / 扫描        │
│  ├─ 系统集成：托盘/快捷键/SMTC/任务栏UIA/更新    │
│  └─ API 客户端：网易云/QQ/抖音直连（第4期后）    │
└───────────────┬────────────────────────────────┘
                │ WebMessage (JSON)
┌───────────────▼────────────────────────────────┐
│  WebView2 渲染层（现有 Vue 应用，零改动）         │
│  └─ 注入脚本提供 window.electron/api/logger     │
└────────────────────────────────────────────────┘

过渡态（第 1~3 期）：Node sidecar 跑现有 Fastify API 服务器
```

## 3. 关键技术决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 壳框架 | **WPF (.NET 8)** | 托盘/多窗口/无边框圆角最成熟；不选 WinUI 3（WebView2 多窗口与托盘坑多） |
| 桥接机制 | **WebMessage（postMessage JSON）** | 与现有 `invoke/handle + send/on` 语义一一对应；AddHostObject 仅用于高频同步调用 |
| 页面加载 | **SetVirtualHostNameToFolderMapping** | dist 直接映射为 `https://app.local/`，免 HTTP 服务器，且可自定义响应头（解决 COOP/COEP） |
| 前端适配 | **注入脚本模拟 window.electron/api/logger** | `AddScriptToExecuteOnDocumentCreated` 注入，190 处调用点零修改 |
| 数据库 | Microsoft.Data.Sqlite | better-sqlite3 的直接对应 |
| 音频分析/扫描 | NAudio + TagLibSharp | 替代 Rust tools 模块 |
| 系统媒体控制 | WinRT SMTC API | 替代 Rust external-media-integration |
| 自动更新 | Velopack | electron-updater 对应 |
| 远程控制 WS | ASP.NET Core WebSocket 或 Fleck | 替代 SocketService |

---

## 4. 分阶段计划

### 第 0 期：可行性验证（Spike）

**目标**：用最便宜的方式证伪/证实关键技术假设，再决定是否投入。

任务：

1. WPF + WebView2 骨架，VirtualHostName 映射加载现有 `dist` 构建产物
2. 注入脚本实现最小桥（`invoke` 一个测试通道，双向通）
3. 验证 AMLL 全屏歌词帧率（对比现版，应一致——同一 Chromium 内核）
4. 验证 ffmpeg.wasm：WebView2 下 SharedArrayBuffer + COOP/COEP 头是否生效
5. 验证无边框圆角透明窗口（桌面歌词窗形态）在 WPF 下的表现
6. 验证 Node sidecar 方案：把 `electron/server` 抽成独立 Node 进程单独启动，前端能连通

**验收门禁**：以上 6 项全部通过；任一不过 → 停下来评估替代方案，不进入第 1 期。

### 第 1 期：壳 + 主链路打通

**目标**：主窗口全功能可用（在线播放、搜索、歌单、登录、设置读写），API 走 Node sidecar。

任务：

- 壳：主窗口（无边框、圆角、最小化到托盘）、单实例锁、便携模式（PORTABLE_EXECUTABLE_DIR 对应逻辑）
- 桥接服务（C# 实现）：`system / window / store / file / cache / lyric / tray / renderer-log`
- 前端注入脚本：完整模拟 `window.electron`（invoke/send/on）、`window.api.store/file`、`window.logger`
- Node sidecar：现有 `electron/server` 原样独立运行，C# 壳负责拉起/守护/随退
- 设置数据迁移：读取现有 electron-store JSON，格式不变

**验收门禁**：主窗口功能清单逐项通过；与现版并行对比播放/搜索/登录无差异。

### 第 2 期：原生能力迁移（去 Rust）

**目标**：系统集成功能全部 C# 化，删除 Rust 构建链。

任务：

| 现有模块 | C# 实现 |
|---|---|
| taskbar-lyric（UIA 探测任务栏） | UIAutomationClient + Win32 P/Invoke |
| external-media-integration（SMTC/Discord） | WinRT SMTC + discord-rpc-csharp |
| tools（音频分析/下载/扫描） | NAudio 分析 + HttpClient 下载 + TagLibSharp 元数据 |
| opencc-wasm（简繁转换） | 词典直接内嵌 C#（数据文件复用） |
| better-sqlite3（两个库） | Microsoft.Data.Sqlite，表结构不变 |
| 快捷键 / 缩略图工具栏 / 托盘 | RegisterHotKey / TaskbarItemInfo 或 Win32 / Hardcodet.NotifyIcon |

**验收门禁**：任务栏歌词定位准确率与现版一致（Win10/Win11 实测）；SMTC 系统媒体面板可控；本地音乐扫描结果与现版一致；内存播放态 ≤ 550MB。

### 第 3 期：多窗口与歌词

**目标**：桌面歌词、任务栏歌词、登录窗全部迁移，窗口间通信打通。

任务：

- 桌面歌词窗：WPF 透明分层窗口 + WebView2（保留现有歌词页与动效）
- 任务栏歌词窗：先沿用 WebView2 窗口保动效；原生小组件留作可选优化项
- 窗口间消息总线：替代 Electron 的 IPC broadcast（主窗播放状态 → 歌词窗）
- 登录窗、加载页迁移

**验收门禁**：歌词显示/翻译/罗马音/锁定/防遮挡与现版一致；多窗内存增量每个 ≤ 150MB。

### 第 4 期：API 去 Node 化

**目标**：删除 Node sidecar，彻底无 Node 依赖。

任务：

1. **接口盘点前置**：grep 统计 `src/api/` 实际用到的全部端点，形成清单（预估三五十个，远小于 NeteaseCloudMusicApi 全量）
2. C# 直连重写：渲染层 `request.ts` 的 baseURL 改为桥接调用，C# 侧 HttpClient 直请求
3. 加密算法移植（对照测试驱动）：
   - 网易云 weapi/eapi/xeapi（AES/RSA）
   - QQ音乐 QRC 解密（TripleDES，参照 `qrc.ts`/`tripledes.ts`）
   - 酷我 DES（`kwDES.js`）
   - 抖音 aBogus 签名 + SM3（`aBogus.ts`/`sm3.ts`）
4. unblock 音源匹配逻辑（`unblock/` 目录）移植
5. 远程控制 control API 迁移到 C# WebSocket

**验收门禁**：每个移植算法与现版做输入/输出对照测试（同一输入同一输出）；sidecar 删除后全部在线功能回归通过；进程列表无 node.exe。

### 第 5 期：优化与发布

**目标**：达到全部量化目标，可发布。

任务：

- 托盘性能模式增强：WebView2 `TrySuspend`（现版做不到的能力，挂起渲染进程）
- .NET 发布裁剪；Native AOT 评估（桥接层若用 COM 反射多则保持普通发布）
- 安装包：WebView2 Evergreen 运行时检测与引导安装
- 用户数据无缝迁移：SQLite 库文件、设置 JSON、缓存目录、抖音 cookie
- 性能实测：冷启动、播放态内存、托盘态内存、切歌流畅度

**验收门禁（总目标）**：

| 指标 | 现版 | 目标 |
|---|---|---|
| 播放态内存 | 实测 1.2~1.8GB | ≤ 550MB |
| 托盘性能模式 | 实测 780MB~1.8GB | ≤ 350MB |
| 安装包体积 | ~200MB | ≤ 40MB |
| 冷启动 | 基线实测 | 不慢于现版 |
| AMLL 歌词帧率 | 基线实测 | 不低于现版 |

---

## 5. 风险清单与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| SharedArrayBuffer / ffmpeg.wasm 在 WebView2 受限 | 高 | 第 0 期第一项验证；备选：C# 侧解码（NAudio）替代 wasm 场景 |
| API 移植工作量失控 | 高 | 第 4 期前先做接口盘点；sidecar 可长期保留作为兜底发布形态 |
| aBogus 等签名算法移植错误 | 中 | 对照测试驱动：固定输入比对现版输出，一致才合入 |
| 任务栏歌词 UIA 在新 Win11 版本失效 | 中 | 与现版同样的风险（现版也是 UIA 方案），策略代码可直接参照移植 |
| WebView2 运行时缺失 | 低 | 安装包内置 Evergreen 引导；Win10 1809+/Win11 大多已预装 |
| 多窗口透明/圆角表现差异 | 低 | 第 0 期验证；WPF 分层窗口是成熟方案 |

## 6. 执行原则

- **每期结束都是可运行、可发布的形态**（sidecar 存在也是合法中间态）
- **新旧并行**：现版 Electron 分支不动，新版独立目录/分支开发，逐功能对照
- **对照测试**：凡移植的算法/接口，必须用现版输出做基准
- 每期验收门禁不过，不进入下一期

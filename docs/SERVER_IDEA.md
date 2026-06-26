# KfunMusic 服务器构想，更新于：2026/6/27

## 项目背景

为了实现数据自主可控，不依赖云音乐进行同步，计划搭建独立的服务器来存储用户数据。

当前收藏数据已完全本地化，详见 [本地数据存储说明](./LOCAL_DATA.md)

---

## 同步方案

### 核心思路

**直接同步两个文件夹，不做细粒度数据对比。**

把 `IndexedDB` 和 `Local Storage` 两个文件夹当作一个整体，打包上传 / 下载覆盖，简单粗暴但有效。

### 同步范围

```
userData/
├── IndexedDB/       ← ✅ 全部同步
├── Local Storage/   ← ✅ 全部同步
├── cookies/         ← ❌ 不同步（隐私数据）
├── douyin-cache/    ← ❌ 不同步（可重新加载）
├── DataCache/       ← ❌ 不同步（可重新生成）
└── logs/            ← ❌ 不同步
```

### 为什么只同步这两个文件夹

| 文件夹            | 内容                                                                        | 重要性   |
| ----------------- | --------------------------------------------------------------------------- | -------- |
| **IndexedDB**     | 我喜欢的音乐、收藏的歌单/专辑/歌手/视频、本地歌单、本地音乐库、歌单列表缓存 | 核心数据 |
| **Local Storage** | 用户设置、播放状态、播放列表、快捷键、主题、登录信息                        | 配置数据 |

**这两个文件夹 = 用户的全部数据**，同步后换机体验完全一致，什么都不会丢。

### 同步原理

```
┌─────────────┐    打包压缩    ┌─────────────┐
│  本地文件夹  │ ─────────────▶ │  压缩包.zip  │
│ IndexedDB   │                └──────┬──────┘
│ Local Storage│                       │
└─────────────┘                       │ 上传/下载
                                      ▼
                              ┌─────────────┐
                              │   服务器     │
                              └─────────────┘
```

### 同步流程

**上传备份：**

1. 用户触发备份（手动 / 自动）
2. 将 `IndexedDB/` 和 `Local Storage/` 两个文件夹打包成 zip
3. 上传到服务器存储
4. 记录备份信息（时间、设备、大小）

**恢复备份：**

1. 用户选择要恢复的备份
2. 下载 zip 到临时目录
3. 标记"下次启动时恢复"
4. 提示用户重启应用
5. 应用启动时：先备份当前数据 → 解压覆盖 → 正常启动

> ⚠️ 注意：应用运行时这两个文件夹的文件被锁定，无法直接写入，必须在重启时替换。

---

## 客户端数据分布

所有数据存储在 Electron 用户数据目录下：

- **正常安装版**：`%APPDATA%\KfunMusic\`
- **便携版**：`程序所在目录\UserData\`

### 数据存储分类

| 数据类型                             | 存储位置         | 存储技术     | 是否同步            |
| ------------------------------------ | ---------------- | ------------ | ------------------- |
| 我喜欢的音乐                         | `IndexedDB/`     | localforage  | ✅ 是               |
| 我的收藏（歌单/专辑/歌手/视频/播客） | `IndexedDB/`     | localforage  | ✅ 是               |
| 本地歌单（含歌曲详情）               | `IndexedDB/`     | localforage  | ✅ 是               |
| 本地音乐库                           | `IndexedDB/`     | localforage  | ✅ 是               |
| 歌单列表缓存                         | `IndexedDB/`     | localforage  | ✅ 是               |
| 用户设置                             | `Local Storage/` | localStorage | ✅ 是               |
| 播放状态/播放列表                    | `Local Storage/` | localStorage | ✅ 是               |
| 快捷键设置                           | `Local Storage/` | localStorage | ✅ 是               |
| 主题/个性化设置                      | `Local Storage/` | localStorage | ✅ 是               |
| 网易云登录 Cookie                    | `Local Storage/` | localStorage | ✅ 是               |
| 抖音 Cookie                          | `cookies/`       | 文件系统     | ❌ 否（隐私数据）   |
| 抖音收藏缓存                         | `douyin-cache/`  | 文件系统     | ❌ 否（可重新加载） |
| 数据缓存                             | `DataCache/`     | 文件系统     | ❌ 否（可重新生成） |
| 日志                                 | `logs/`          | 文件系统     | ❌ 否               |

> **同步核心**：`IndexedDB/` + `Local Storage/` 两个文件夹
> **不同步**：`cookies/`、缓存、日志

---

## 核心功能

### 1. 用户系统

- [x] 用户注册（用户名、密码、邮箱）
- [x] 用户登录（JWT Token 认证）
- [x] 密码加密存储（bcrypt / argon2）
- [ ] 邮箱验证
- [ ] 第三方登录（可选）

### 2. 数据同步

- [ ] 上传数据备份（IndexedDB + Local Storage 打包）
- [ ] 下载数据备份
- [ ] 查看备份列表（按时间排序）
- [ ] 自动备份（应用启动时 / 定时）
- [ ] 手动备份按钮

### 3. 数据导入/导出

- [ ] 导出数据为压缩包（下载到本地）
- [ ] 从压缩包导入数据
- [ ] 从网易云账号导入收藏（需登录，仅用于迁移）

---

## 同步策略

### 触发时机

- 应用启动时自动同步（拉取最新备份）
- 用户手动点击"立即同步"
- 定时自动备份（可选，如每小时一次）
- 应用关闭前自动备份

### 版本管理

- 保留最近 N 个备份（默认 10 个）
- 每个备份带时间戳和设备名称
- 支持恢复到任意历史版本

### 冲突处理

默认策略：**以最新备份为准**

可选策略：

- 保留服务端版本
- 保留本地版本
- 手动选择（弹窗显示备份时间）

---

## 技术方案

### 后端

| 项目     | 技术选型            | 说明            |
| -------- | ------------------- | --------------- |
| 框架     | Fastify / NestJS    | 高性能 API 框架 |
| 数据库   | PostgreSQL / MySQL  | 关系型数据库    |
| 文件存储 | 本地磁盘 / 对象存储 | 备份文件存储    |
| 认证     | JWT                 | 无状态认证      |
| 加密     | bcrypt / argon2     | 密码加密        |

### 部署

| 项目   |
| ------ |
| 服务器 |
| 域名   |
| SSL    |
| 容器化 |

---

## 数据表设计

### 用户表 (users)

```
id              UUID        PRIMARY KEY
username        VARCHAR(50) UNIQUE NOT NULL
email           VARCHAR(100) UNIQUE NOT NULL
password        VARCHAR(255) NOT NULL  # 加密后的密码
storage_used    BIGINT      DEFAULT 0  # 已用存储空间
backup_count    INT         DEFAULT 0  # 备份数量
created_at      TIMESTAMP   DEFAULT NOW()
updated_at      TIMESTAMP   DEFAULT NOW()
```

### 备份表 (backups)

```
id              UUID        PRIMARY KEY
user_id         UUID        FOREIGN KEY -> users.id
filename        VARCHAR(255) NOT NULL  # 备份文件名
file_size       BIGINT      NOT NULL   # 文件大小（字节）
device_name     VARCHAR(100) DEFAULT '' # 设备名称
description     VARCHAR(255) DEFAULT '' # 备注
created_at      TIMESTAMP   DEFAULT NOW()
```

---

## API 设计

### 认证

```
POST   /api/auth/register    # 用户注册
POST   /api/auth/login       # 用户登录
POST   /api/auth/refresh     # 刷新 Token
POST   /api/auth/logout      # 退出登录
```

### 备份

```
GET    /api/backups             # 获取备份列表
POST   /api/backups/upload      # 上传备份文件（multipart/form-data）
GET    /api/backups/:id/download # 下载备份文件
DELETE /api/backups/:id         # 删除指定备份
POST   /api/backups/:id/restore # 恢复指定备份（标记为待恢复，下次启动时生效）
```

### 用户

```
GET    /api/user/profile     # 获取用户信息
PUT    /api/user/profile     # 更新用户信息
DELETE /api/user/account     # 删除账户
GET    /api/user/storage     # 获取存储空间使用情况
```

### 数据导入/导出

```
POST   /api/export           # 导出数据（同上传备份）
POST   /api/import           # 导入数据（同下载备份+恢复）
```

---

## 客户端实现要点

### 关键技术点

**获取用户数据目录：**

```javascript
// 主进程中
const { app } = require("electron");
const userDataPath = app.getPath("userData");
// IndexedDB 路径: `${userDataPath}/IndexedDB`
// Local Storage 路径: `${userDataPath}/Local Storage`
```

**打包压缩：**

- 使用 `archiver` 库打包 zip
- 只包含 `IndexedDB/` 和 `Local Storage/` 两个文件夹
- 压缩级别建议 6-7（平衡速度和大小）

**解压覆盖：**

- 使用 `unzipper` 或 `extract-zip` 解压
- 必须在应用启动早期（主进程 ready 之前）进行
- 先删后解，避免旧文件残留

### 上传备份流程

```
用户触发 → 检查文件可读 → 打包 zip → 计算哈希 →
上传服务器 → 记录备份信息 → 完成
```

详细步骤：

1. 用户手动触发 / 应用关闭前自动触发
2. 检查 `IndexedDB/` 和 `Local Storage/` 文件夹是否存在
3. 使用 archiver 打包为 zip 压缩包
4. 计算文件 MD5/SHA256（用于完整性校验）
5. 上传到服务器（multipart/form-data）
6. 服务器校验哈希，保存文件，记录备份信息
7. 客户端更新本地备份列表

### 恢复备份流程

```
选择备份 → 下载到临时目录 → 校验哈希 → 标记待恢复 →
提示重启 → 启动时替换 → 正常启动
```

详细步骤：

1. 用户从备份列表中选择要恢复的版本
2. 下载 zip 到系统临时目录
3. 校验文件哈希，确保下载完整
4. 在用户数据目录写入 `pending_restore.json` 标记文件
5. 提示用户"重启后生效"，确认后退出应用
6. **下次启动时（主进程最早期）：**
   - 检测到 `pending_restore.json`
   - 先将当前 `IndexedDB/` 和 `Local Storage/` 备份为 `xxx_backup_timestamp/`
   - 删除旧的 `IndexedDB/` 和 `Local Storage/`
   - 解压 zip 到用户数据目录
   - 删除标记文件和临时 zip
   - 继续正常启动

### 自动备份策略

| 触发时机   | 说明                           | 建议              |
| ---------- | ------------------------------ | ----------------- |
| 应用启动时 | 先拉取服务端最新备份，对比时间 | 可选，默认关闭    |
| 应用关闭前 | 自动上传当前数据               | 建议开启          |
| 定时备份   | 每 N 小时备份一次              | 可选，默认 4 小时 |
| 手动备份   | 用户点击"立即备份"按钮         | 必须有            |

### 注意事项

1. **文件锁定问题**：应用运行时 IndexedDB 和 Local Storage 文件被浏览器进程锁定，无法直接写入，恢复必须在启动早期进行
2. **数据安全**：恢复前一定要先备份当前数据，防止恢复失败导致数据丢失
3. **版本兼容**：不同版本的应用可能有不同的数据结构，建议备份文件中记录应用版本号
4. **大文件处理**：如果 IndexedDB 存了很多图片缓存，备份包可能很大，考虑做分片上传或断点续传
5. **数据完整性**：上传和下载后都要校验文件哈希，防止损坏
6. **并发冲突**：多设备同时备份时，以时间最新的为准，不做合并

---

## 开发计划

### Phase 0 - 本地数据标准化（已完成）

- [x] 收藏功能本地化
- [x] 本地歌单支持所有类型歌曲
- [x] 本地数据结构标准化

### Phase 1 - MVP（1-2周）

- [ ] 项目初始化
- [ ] 用户注册/登录
- [ ] 数据库设计
- [ ] 备份上传/下载 API
- [ ] 客户端：登录界面
- [ ] 客户端：手动备份/恢复功能

### Phase 2 - 完善（2-3周）

- [ ] 自动备份（启动时 / 定时）
- [ ] 备份列表管理
- [ ] 存储空间限制
- [ ] 备份版本管理
- [ ] 恢复前自动备份当前数据

### Phase 3 - 高级功能（可选）

- [ ] 从网易云导入收藏
- [ ] 多设备管理
- [ ] 断点续传
- [ ] 增量备份（只同步变更的文件）

---

## 注意

1. **安全性**：所有 API 必须使用 HTTPS，备份文件建议加密存储
2. **隐私**：用户密码必须加密存储，抖音 Cookie 不同步
3. **备份**：定期备份数据库，用户备份文件多副本存储
4. **性能**：大文件上传需要做流处理，避免内存溢出
5. **日志**：记录关键操作日志
6. **离线可用**：断网时功能不受影响，恢复网络后自动同步
7. **数据完整性**：上传/下载后校验文件哈希，确保数据完整
8. **恢复安全**：恢复前自动备份当前数据，恢复失败可回滚

# KfunMusic 服务器构想

## 项目背景

为了实现数据自主可控，不依赖网易云音乐进行同步，计划搭建独立的服务器来存储用户数据。

## 核心功能

### 1. 用户系统

- [x] 用户注册（用户名、密码、邮箱）
- [x] 用户登录（JWT Token 认证）
- [x] 密码加密存储（bcrypt / argon2）
- [ ] 邮箱验证
- [ ] 第三方登录（可选）

### 2. 数据同步

- [ ] 收藏列表同步
- [ ] 歌单数据同步
- [ ] 用户设置同步

> 注：播放记录仅本地存储，不同步到服务器，以减轻服务器压力


## 技术方案

### 后端

| 项目 | 技术选型 | 说明 |
|------|----------|------|
| 框架 | Fastify / NestJS | 高性能 API 框架 |
| 数据库 | PostgreSQL / MySQL | 关系型数据库 |
| ORM | Prisma / TypeORM | 数据库操作 |
| 认证 | JWT | 无状态认证 |
| 加密 | bcrypt / argon2 | 密码加密 |

### 部署

| 项目 | 推荐方案 | 说明 |
|------|----------|------|
| 服务器 | 云服务器（VPS） | 约 ¥30-100/月 |
| 域名 | 可选 | 便于访问 |
| SSL | Let's Encrypt | 免费证书 |
| 容器化 | Docker | 便于部署 |

## 数据表设计

### 用户表 (users)

```
id          UUID        PRIMARY KEY
username    VARCHAR(50) UNIQUE NOT NULL
email       VARCHAR(100) UNIQUE NOT NULL
password    VARCHAR(255) NOT NULL  # 加密后的密码
created_at  TIMESTAMP   DEFAULT NOW()
updated_at  TIMESTAMP   DEFAULT NOW()
```

### 收藏表 (favorites)

```
id          UUID        PRIMARY KEY
user_id     UUID        FOREIGN KEY -> users.id
song_id     VARCHAR(100) NOT NULL  # 歌曲ID
song_info   JSONB      NOT NULL   # 歌曲详细信息
created_at  TIMESTAMP   DEFAULT NOW()

UNIQUE(user_id, song_id)
```

### 歌表格 (playlists)

```
id          UUID        PRIMARY KEY
user_id     UUID        FOREIGN KEY -> users.id
name        VARCHAR(100) NOT NULL
songs       JSONB      NOT NULL   # 歌曲列表
is_public   BOOLEAN    DEFAULT FALSE
created_at  TIMESTAMP   DEFAULT NOW()
updated_at  TIMESTAMP   DEFAULT NOW()
```

### 播放记录表 (play_history) - 仅本地

> 注：播放记录仅存储在本地设备，不同步到服务器

## API 设计

### 认证

```
POST   /api/auth/register    # 用户注册
POST   /api/auth/login       # 用户登录
POST   /api/auth/refresh     # 刷新 Token
POST   /api/auth/logout      # 退出登录
```

### 用户

```
GET    /api/user/profile     # 获取用户信息
PUT    /api/user/profile     # 更新用户信息
DELETE /api/user/account     # 删除账户
```

### 收藏

```
GET    /api/favorites        # 获取收藏列表
POST   /api/favorites        # 添加收藏
DELETE /api/favorites/:id    # 删除收藏
```

### 歌单

```
GET    /api/playlists        # 获取歌单列表
POST   /api/playlists        # 创建歌单
PUT    /api/playlists/:id    # 更新歌单
DELETE /api/playlists/:id    # 删除歌单
```

### 播放记录 - 仅本地

> 注：播放记录仅存储在本地设备，不提供 API

## 开发计划

### Phase 1 - MVP（1-2周）

- [ ] 项目初始化
- [ ] 用户注册/登录
- [ ] 数据库设计
- [ ] 基础 API

### Phase 2 - 数据同步（2-3周）

- [ ] 收藏列表同步
- [ ] 歌单数据同步
- [ ] 用户设置同步
- [ ] 数据导入/导出


## 注意事项

1. **安全性**：所有 API 必须使用 HTTPS
2. **隐私**：用户密码必须加密存储
3. **备份**：定期备份数据库
4. **性能**：做好数据库索引优化
5. **日志**：记录关键操作日志

## 待讨论

- [ ] 服务器部署平台选择
- [ ] 是否需要会员系统
- [ ] 数据迁移方案

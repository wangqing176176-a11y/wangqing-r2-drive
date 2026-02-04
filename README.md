# Qing R2 Cloudy (WanQing's R2 Drive)

一个基于 **Next.js 15** + **Cloudflare Pages Functions** + **R2 Bucket Binding** 的轻量云盘。

核心目标：**部署/配置尽量简单**（不需要 Access Key、不需要 CORS、不需要公网访问域名），同时支持 **大文件分片上传** 与 **24 小时有效的分享下载链接**。

## ✨ 功能特性

- 📂 文件管理：文件夹层级浏览、面包屑导航
- 🚀 上传：
  - 小文件：单次上传
  - 大文件：分片上传（约 70MiB/片）
- 👀 在线预览：图片 / 音视频 / PDF（支持 Range）/ Office（微软在线预览）
- 🔗 分享：复制一个 **24 小时有效**的下载链接，发给任何人都能下载（无需登录）
- 🔐 管理员登录：需要设置 `ADMIN_USERNAME` + `ADMIN_PASSWORD`

## 🛠️ 部署到 Cloudflare Pages（推荐）

### 1) Fork 仓库并创建 Pages 项目

Cloudflare Dashboard → Pages → 创建项目 → 连接 GitHub → 选择你的 fork。

### 2) 构建配置

- Framework preset：`Next.js`
- Build command：`npm run pages:build`
- Build output directory：`.vercel/output/static`
- Compatibility flags：添加 `nodejs_compat`（建议生产/预览都加）

### 3) 绑定 R2 存储桶（必须）

Pages → Settings → Functions → R2 Bucket Bindings：

- Variable name：`BUCKET`（必须是这个名字）
- 选择你的 R2 bucket

### 4) 环境变量（建议）

Pages → Settings → Environment variables：

| 变量名 | 类型建议 | 说明 |
|---|---|---|
| `ADMIN_USERNAME` | Text | 管理员账号 |
| `ADMIN_PASSWORD` | Secret | 管理员密码（开启登录与管理端鉴权） |
| `ADMIN_TOKEN_SECRET` | Secret（可选） | 分享/预览/上传 URL 的 token 签名密钥；不设置时会回退使用 `ADMIN_PASSWORD` |

> 说明：本项目通过 **R2 Binding** 直接访问桶，不需要 `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`Account ID`，也不需要给桶配置 CORS。

### 5) 使用

- 打开站点 → 输入管理员账号/密码 → 进入管理
- 文件列表里点击“复制链接”即可生成 24 小时有效下载链接

## 本地开发

```bash
npm install
npm run dev
```

> 本项目核心能力依赖 Pages 的 R2 Binding；本地开发时需要自行模拟/注入环境。

## ✅ 常见问题

### 1) 能打开页面，但登录后看不到文件列表
- 检查是否绑定了 `BUCKET`（Pages → Settings → Functions → R2 Bucket Bindings）

### 2) 分享链接有效期是多久？
- 默认 **24 小时**（由服务端签发 token 决定）

### 3) 还需要配置桶的 Public Access / 自定义域名吗？
- 不需要。预览和下载都通过站点的 `/api/object` 代理（支持 Range）

## 📄 License

MIT

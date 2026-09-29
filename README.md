# Boardgame Box

基于 Vite 的桌游网页项目，可部署到 Cloudflare Workers 静态资源。首页提供阿瓦隆和炸弹克星入口，游戏分别部署在 `/avalon/` 与 `/bomb-busters/`。

## 本地开发

需要 Node.js 22.12 或更新版本。运行 `npm ci` 安装依赖，再运行 `npm run dev`，打开 http://127.0.0.1:9143/。

阿瓦隆支持 5–10 人线下传屏和 Playweft 房间模式；炸弹克星支持 2–5 人合作传屏和房间模式。运行 npm run build 构建，npm run check 验证生产构建。

每个游戏都有独立的 Vite 配置与 `dist/<game>/` 产物；`src/shared` 提供共用主题和 Playweft 客户端，每款游戏仍独立加载自己的资源。`public/games/<game>` 存放专属 Manifest、Lua 逻辑、帮助页和图标。

## 部署

运行 `npx wrangler deploy` 部署。Wrangler 会先执行 `npm run build`，并将 `dist/` 发布为静态资源。默认发布在站点根路径；若发布到子路径，可设置 `BASE_PATH=/boardgame-box/`。构建会将站点文件放入对应子目录，并把 `_headers` 保留在上传根目录且同步添加路径前缀。

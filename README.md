# Boardgame Box

基于 Vite 的桌游网页项目，可部署到 Cloudflare Workers 静态资源。首页提供阿瓦隆入口，游戏部署路由为 `/avalon/`。

## 本地开发

需要 Node.js 22.12 或更新版本。运行 `npm ci` 安装依赖，再运行 `npm run dev`，打开 http://127.0.0.1:9143/。

阿瓦隆支持 5–10 人线下传屏，也接入 Playweft 房间模式。运行 npm run build 构建，npm run check 验证生产构建。

`src/games/avalon` 是阿瓦隆源码目录，独立 Vite 配置将它构建到 `dist/avalon/`，游戏资源位于 `dist/avalon/assets/`；`public/games/avalon` 存放该游戏专属的 Playweft Manifest、Lua 逻辑和图标。新增游戏时可采用相同结构，让每个游戏独立管理构建配置与静态资源。游戏通过 MessageChannel 接收私有玩家状态和提交动作。

## 部署

运行 `npx wrangler deploy` 部署。Wrangler 会先执行 `npm run build`，并将 `dist/` 发布为静态资源。默认发布在站点根路径；若发布到子路径，可设置 `BASE_PATH=/boardgame-box/`。构建会将站点文件放入对应子目录，并把 `_headers` 保留在上传根目录且同步添加路径前缀。

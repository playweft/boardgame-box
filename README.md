# Boardgame Box

基于 Vite 的桌游网页项目，可部署到 Cloudflare Workers 静态资源。首页提供阿瓦隆、炸弹克星和德州心脏病入口，游戏分别部署在 `/avalon/`、`/bomb-busters/` 与 `/halli-holdem/`。

## 本地开发

需要 Node.js 22.12 或更新版本。运行 `npm ci` 安装依赖，再运行 `npm run dev`，打开 http://127.0.0.1:9143/。

阿瓦隆支持 5–10 人线下传屏和 Playweft 房间模式；炸弹克星支持 2–5 人合作传屏和房间模式。运行 npm run build 构建，npm run check 验证生产构建。

德州心脏病（Halli Hold’em）仅支持 2–8 人 Playweft 房间对局；独立打开游戏页面可查看规则或前往 Playweft 创建房间。自己的底牌始终隐藏，候选牌仅当前玩家可见；房间以服务端处理顺序判定拍铃与抽牌先后。每次放牌后，服务端通过持久化定时器等待 2 秒自动弃牌，再等 3 秒开放下家抽牌；两段等待均可拍铃。抽牌前，下家也能拍铃；放牌者、过晚的拍铃无效且不扣分。漏拍后的爆牌状态保留，下一位放牌者可能承担扣分。完整规则见 `public/halli-holdem/rules.md`。最高分并列时共同获胜。

每个游戏都有独立的 Vite 配置与 `dist/<game>/` 产物；`src/shared` 提供共用主题和 Playweft 客户端，每款游戏仍独立加载自己的资源。`public/<game>` 存放专属 Manifest、Lua 逻辑、帮助页和图标。

## 部署

运行 `npx wrangler deploy` 部署。Wrangler 会先执行 `npm run build`，并将 `dist/` 发布为静态资源。默认发布在站点根路径；若发布到子路径，可设置 `BASE_PATH=/boardgame-box/`。构建会将站点文件放入对应子目录，并把 `_headers` 保留在上传根目录且同步添加路径前缀。

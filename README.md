# Boardgame Box

基于 Vite 和 Preact 的桌游网页合集，支持本地游玩与 Playweft 房间对局，可部署到 Cloudflare Workers 静态资源。

## 游戏

| 游戏 | 路径 | 人数 | 模式 | 规则 |
| --- | --- | --- | --- | --- |
| 阿瓦隆 | `/avalon/` | 5–10 | 本地传屏、房间 | [帮助页](public/avalon/help.html) |
| 炸弹克星 | `/bomb-busters/` | 2–5 | 本地传屏、房间 | [规则](public/bomb-busters/rules.md) |
| 德州心脏病（Halli Hold’em） | `/halli-holdem/` | 2–8 | 房间 | [规则](public/halli-holdem/rules.md) |
| 花砖物语（Azul） | `/azul/` | 2–4 | 本地轮流操作、房间 | [规则](public/azul/rules.md) |
| 璀璨宝石（Splendor） | `/splendor/` | 2–4 | 普通人机、困难人机、本地多人、联机多人 | [规则](public/splendor/rules.md) |

花砖物语采用原版彩色墙面规则，不包含灰色墙面变体与扩展。

璀璨宝石采用基础版 90 张发展卡和 10 位贵族，支持黄金自选支付、超额宝石归还、贵族选择与完整末轮结算。本地自动保存，轮流模式用交接屏幕保护预留牌，人机模式由一名真人与 1–3 名 AI 对战。房间模式由 Lua 服务端校验操作并隐藏其他玩家的预留牌和牌堆顺序。数值牌表在 `src/games/splendor/data.js`，修改后运行 `node dev/sync-splendor-data.js` 同步 Lua 中的牌表，测试会检查两端一致性。

普通人机使用牌路评分，困难人机在此基础上做采样搜索。评分考虑目标牌的购买时间、对手能否抢先购买，以及剩余回合能否收回折扣投资。运行 `node dev/benchmark-splendor-ai.js 24 905173` 可用同一批牌局种子轮换座位，对比搜索版和纯评分版的胜率及出手耗时。

从 Playweft 打开璀璨宝石会直接显示模式菜单。点击「联机多人」时通过 `rooms.create` 提交 2–4 人的房间设置和 Lua 入口，进入平台大厅。

## 本地开发

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

打开 [http://127.0.0.1:6960/](http://127.0.0.1:6960/)。

## 测试与构建

```sh
npm test                  # 规则与联机逻辑测试
npm run build             # 构建到 dist/
npm run check:room-bundle # 构建并检查产物未包含本地测试工具
```

### 阿瓦隆本地联机测试

```sh
npm run dev:room
```

打开 [本地测试台](http://127.0.0.1:6967/__dev/avalon/)，选择 5–10 人并创建对局。测试台使用独立玩家身份、MessagePort 接口和游戏的 Lua 规则引擎，无需启动 Playweft 或登录账号。可通过 `ROOM_LAB_PORT` 调整端口。

- 切换玩家或观战者视角，也可并排显示所有视角。
- 批量完成队伍投票和任务出牌，或在各玩家页面手动操作。
- 使用十六进制种子复现角色分配，勾选“显示调试身份”查看角色。
- 刷新测试台恢复当前对局，点击“重新连接”重载单个玩家视角。

测试台用于本地联机逻辑和界面测试，不模拟平台登录、网络断线或房间持久化。开发工具位于 `dev/room-lab/`，不包含在生产构建中。

## 项目结构

- `src/games/<game>/`：各游戏的界面、客户端逻辑与 Vite 配置。
- `src/shared/`：共用主题、组件和 Playweft 客户端。
- `public/<game>/`：游戏 Manifest、Lua 规则、帮助页和图标。
- `tests/`：自动化测试。
- `dev/room-lab/`：阿瓦隆本地联机测试工具。

各游戏独立构建到 `dist/<game>/`。

## 部署

```sh
npm run deploy
```

Wrangler 会先构建，再将 `dist/` 发布为静态资源。默认部署在站点根路径；部署到子路径时设置 `BASE_PATH`：

```sh
BASE_PATH=/boardgame-box/ npm run deploy
```

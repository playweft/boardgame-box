import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { createRoomLab } from "./runtime.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const lab = createRoomLab();
const port = Number(process.env.ROOM_LAB_PORT || 6967);
const server = await createServer({
  root,
  configFile: fileURLToPath(new URL("../../vite.config.js", import.meta.url)),
  server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [
    {
      name: "avalon-local-room-lab",
      apply: "serve",
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url, "http://localhost");
          if (
            url.pathname === "/__dev/avalon" ||
            url.pathname === "/__dev/avalon/"
          ) {
            request.url = "/dev/room-lab/index.html";
            return next();
          }
          if (!url.pathname.startsWith("/__dev/avalon/api/")) return next();
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          const send = (status, data) => {
            response.statusCode = status;
            response.end(JSON.stringify(data));
          };
          const origin = request.headers.origin;
          if (origin && origin !== `http://${request.headers.host}`)
            return send(403, { error: "测试台只接受同源请求" });
          if (
            request.method !== "POST" ||
            !request.headers["content-type"]?.startsWith("application/json")
          )
            return send(405, { error: "请使用 JSON POST" });
          try {
            let body = "",
              bytes = 0;
            for await (const chunk of request) {
              bytes += chunk.length;
              if (bytes > 32 * 1024) return send(413, { error: "请求过大" });
              body += chunk;
            }
            const params = JSON.parse(body || "{}");
            if (!params || typeof params !== "object" || Array.isArray(params))
              return send(400, { error: "请求必须是对象" });
            if (url.pathname.endsWith("/start"))
              return send(200, await lab.start(params));
            if (url.pathname.endsWith("/action"))
              return send(200, await lab.action(params));
            if (url.pathname.endsWith("/snapshot"))
              return send(200, await lab.snapshot());
            return send(404, { error: "未知测试接口" });
          } catch (error) {
            return send(400, { error: error.message });
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(`\n阿瓦隆本地联机测试台：http://127.0.0.1:${port}/__dev/avalon/\n`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await server.close();
    await lab.close();
    process.exit(0);
  });

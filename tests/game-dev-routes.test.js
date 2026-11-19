import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("the dev server discovers a game added after startup", async t => {
  const root = await mkdtemp(join(tmpdir(), "boardgame-box-routes-"));
  let server;
  t.after(async () => {
    try {
      await server?.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await writeFile(join(root, "index.html"), "<title>Boardgame Box</title>");
  await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(root, "node_modules"), "junction");

  server = await createServer({
    root,
    cacheDir: join(root, ".vite-cache"),
    configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)),
    server: { host: "127.0.0.1", port: 0, watch: null },
  });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const read = async path => {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    return response.text();
  };

  assert.match(await read("/new-game/"), /<title>Boardgame Box<\/title>/);
  const game = join(root, "src", "games", "new-game");
  await mkdir(game, { recursive: true });
  await Promise.all([
    writeFile(join(game, "vite.config.js"), "export default {}"),
    writeFile(join(game, "index.html"), '<title>New game</title><script type="module" src="./main.js"></script>'),
    writeFile(join(game, "help.html"), "<title>Game rules</title>"),
    writeFile(join(game, "main.js"), 'document.title = "Game module loaded";'),
  ]);

  assert.match(await read("/new-game/"), /<title>New game<\/title>/);
  assert.match(await read("/new-game/help.html"), /<title>Game rules<\/title>/);
  assert.match(await read("/new-game/main.js"), /Game module loaded/);
  assert.match(await read("/"), /<title>Boardgame Box<\/title>/);

  const redirect = await fetch(origin + "/new-game?mode=local", { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "/new-game/?mode=local");
  await redirect.body.cancel();
});

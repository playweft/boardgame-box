import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../../dist/", import.meta.url);
const forbidden = ["room-lab", "__lab_budget", "local-player-", "__dev/avalon"].map(value => Buffer.from(value));
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    assert(!path.pathname.includes("/dist/dev/"), `Development directory found: ${path.pathname}`);
    if (entry.isDirectory()) await check(path);
    else {
      const contents = await readFile(path);
      assert(!forbidden.some(marker => contents.includes(marker)), `Room lab code found: ${path.pathname}`);
    }
  }
}
await check(root);
console.log("生产产物检查通过：测试台、模拟身份和本地 Lua 运行器未进入 dist。");

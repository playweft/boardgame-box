import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { LuaFactory } from "wasmoon";

function luaLiteral(value) {
  if (value == null) return "nil";
  if (typeof value === "string") {
    const bytes = [...Buffer.from(value)];
    return '"' + bytes.map(byte => byte >= 32 && byte <= 126 && byte !== 34 && byte !== 92
      ? String.fromCharCode(byte) : "\\" + String(byte).padStart(3, "0")).join("") + '"';
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "{" + value.map(luaLiteral).join(",") + "}";
  return "{" + Object.entries(value).map(([key, entry]) => `[${luaLiteral(key)}]=${luaLiteral(entry)}`).join(",") + "}";
}

// This runner is only imported by the separate development command, never by a game client.
export function createRoomLab() {
  let engine = null;
  let players = [];
  let matchId = null;
  let version = 0;
  let setupSeed = null;
  let log = [];
  let queue = Promise.resolve();
  const serialize = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  async function run(lua, code) {
    const top = lua.global.getTop();
    try { return await lua.doString(code); }
    finally { lua.global.setTop(top); }
  }
  async function snapshot() {
    if (!engine) throw new Error("请先创建测试对局");
    const views = {};
    for (const player of [...players, { id: "observer", name: "观战者" }]) {
      const projected = await run(engine, `return __lab_budget(function() return view(__lab_state, {}, ${luaLiteral({ protocolVersion: 1, matchId, version, serverTime: Date.now(), viewer: { ...player, role: player.id === "observer" ? "spectator" : "player", isOwner: player.id === players[0].id } })}) end)`);
      views[player.id] = projected.state;
    }
    return { matchId, version, setupSeed, players, views, log };
  }
  return {
    start({ count = 5, seed = randomBytes(16).toString("hex") } = {}) {
      return serialize(async () => {
        if (!Number.isInteger(count) || count < 5 || count > 10) throw new Error("阿瓦隆需要 5–10 人");
        if (typeof seed !== "string" || !/^[a-f0-9]{1,32}$/i.test(seed)) throw new Error("种子需为 1–32 位十六进制字符");
        const roster = Array.from({ length: count }, (_, index) => ({ id: `local-player-${index + 1}`, name: `玩家 ${index + 1}`, seat: index + 1 }));
        const nextId = randomUUID();
        const candidate = await new LuaFactory().createEngine();
        try {
          await run(candidate, `
            local hook = debug.sethook
            function __lab_budget(call)
              local fuel = 0
              hook(function() fuel = fuel + 1000; assert(fuel <= 50000, 'instruction quota exceeded') end, '', 1000)
              local ok, result = pcall(call); hook()
              if not ok then error(result) end
              return result
            end
            function __lab_copy(value)
              if type(value) ~= 'table' then return value end
              local result = {}
              for key, entry in pairs(value) do result[key] = __lab_copy(entry) end
              return result
            end
          `);
          await run(candidate, await readFile(new URL("../../public/avalon/game.lua", import.meta.url), "utf8"));
          await run(candidate, `__lab_state=__lab_budget(function() return setup(${luaLiteral({ protocolVersion: 1, players: roster, match: { id: nextId, ownerId: roster[0].id, startedAt: Date.now(), randomSeed: seed } })}).state end)`);
        } catch (error) { candidate.global.close(); throw error; }
        engine?.global.close();
        engine = candidate;
        players = roster;
        matchId = nextId;
        version = 0;
        setupSeed = seed;
        log = [{ at: Date.now(), type: "setup", accepted: true, version }];
        return snapshot();
      });
    },
    action({ actorId, action, matchId: requestedMatch } = {}) {
      return serialize(async () => {
        if (!engine) throw new Error("请先创建测试对局");
        let result;
        if (requestedMatch !== matchId) result = { accepted: false, error: { code: "LOCAL_MATCH_CHANGED", message: "测试对局已重建，请使用新视角" } };
        else {
          const player = players.find(player => player.id === actorId);
          const context = { protocolVersion: 1, matchId, version, actionId: randomUUID(), actionAt: Date.now(), actor: { id: typeof actorId === "string" ? actorId : "observer", role: player ? "player" : "spectator", isOwner: actorId === players[0].id, ...(player || {}) } };
          result = await run(engine, `local result=__lab_budget(function() return on_action(__lab_copy(__lab_state), ${luaLiteral(action)}, ${luaLiteral(context)}) end); if result.accepted then __lab_state=result.state end; return {accepted=result.accepted,error=result.error}`);
          if (result.accepted) version++;
        }
        log = [...log.slice(-79), { at: Date.now(), actorId, type: action?.type || "unknown", accepted: result.accepted, error: result.error?.code, version }];
        return { result, snapshot: await snapshot() };
      });
    },
    snapshot() { return serialize(snapshot); },
    close() { return serialize(() => { engine?.global.close(); engine = null; }); },
  };
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LuaFactory } from "wasmoon";
import { applyAction, canPlace, createGame, FLOOR_COSTS, projectGame, settleRound, WALL_COLORS, wallBonuses, wallScore } from "../src/games/azul/engine.js";

const players = count => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `玩家 ${index + 1}` }));
const act = (state, intent, actor = state.players[state.turn].id) => applyAction(state, actor, { ...intent, round: state.round, step: state.step });
const emptyWall = () => Array.from({ length: 5 }, () => Array(5).fill(false));

function assertConservation(state) {
  const tiles = [...state.bag, ...state.discard, ...state.center, ...state.factories.flat()];
  let markers = Number(state.centerMarker);
  for (const board of Object.values(state.boards)) {
    tiles.push(...board.lines.flat(), ...board.floor.filter(color => color !== -1));
    markers += board.floor.filter(color => color === -1).length;
    board.wall.forEach((row, y) => row.forEach((filled, x) => { if (filled) tiles.push(WALL_COLORS[y][x]); }));
    assert(board.score >= 0);
    assert(board.floor.length <= 7);
    board.lines.forEach((line, row) => {
      assert(line.length <= row + 1);
      assert(new Set(line).size <= 1);
      if (line.length) assert(!board.wall[row][WALL_COLORS[row].indexOf(line[0])]);
    });
  }
  assert.equal(tiles.length, 100);
  for (let color = 0; color < 5; color++) assert.equal(tiles.filter(tile => tile === color).length, 20);
  assert(markers <= 1);
}

function nextIntent(state, offset = 0) {
  if (state.phase === "round_end") return { type: "next_round" };
  const sources = [...state.factories.map((tiles, source) => ({ tiles, source })), { tiles: state.center, source: -1 }].filter(entry => entry.tiles.length);
  const chosen = sources[(state.step + offset) % sources.length];
  const colors = [...new Set(chosen.tiles)];
  const color = colors[(state.round + offset) % colors.length];
  const count = chosen.tiles.filter(tile => tile === color).length;
  const board = state.boards[state.players[state.turn].id];
  const rows = [0, 1, 2, 3, 4].filter(row => canPlace(board, row, color));
  rows.sort((a, b) => {
    const value = row => {
      const remaining = row + 1 - board.lines[row].length;
      return (remaining <= count ? 30 : 0) + board.lines[row].length * 5 - Math.abs(remaining - count) * 2 - row;
    };
    return value(b) - value(a);
  });
  return { type: "draft", source: chosen.source, color, row: rows[0] ?? -1 };
}

test("setup draws 4 tiles per factory for 2–4 players and conserves every color", () => {
  for (const count of [2, 3, 4]) {
    const state = createGame(players(count), "a18c4f092bd771e03aa5c6d9ef104b82");
    assert.equal(state.factories.length, 2 * count + 1);
    assert(state.factories.every(factory => factory.length === 4));
    assert.equal(state.bag.length, 100 - 4 * state.factories.length);
    assert.equal(state.starterId, "p0");
    assertConservation(state);
    assert.deepEqual(state, createGame(players(count), "a18c4f092bd771e03aa5c6d9ef104b82"));
  }
  assert.throws(() => createGame(players(1)));
  assert.throws(() => createGame(players(5)));
  assert.throws(() => createGame([{ id: "same" }, { id: "same" }]));
});

test("factory drafting takes all of one color and moves all others to the center", () => {
  const state = createGame(players(2), "abcd");
  state.factories[0] = [0, 1, 0, 2];
  assert(act(state, { type: "draft", source: 0, color: 0, row: 1 }).accepted);
  assert.deepEqual(state.boards.p0.lines[1], [0, 0]);
  assert.deepEqual(state.center, [1, 2]);
  assert.deepEqual(state.factories[0], []);
  assert.equal(state.turn, 1);
  assert.equal(state.centerMarker, true);
});

test("first center draft places marker before overflow, changes starter, and retains other colors", () => {
  const state = createGame(players(2), "abcd");
  state.center = [2, 2, 1, 2];
  assert(act(state, { type: "draft", source: -1, color: 2, row: 0 }).accepted);
  assert.deepEqual(state.boards.p0.lines[0], [2]);
  assert.deepEqual(state.boards.p0.floor, [-1, 2, 2]);
  assert.equal(state.nextStarterId, "p0");
  assert.equal(state.centerMarker, false);
  assert.deepEqual(state.center, [1]);
  assert(act(state, { type: "draft", source: -1, color: 1, row: 0 }).accepted);
  assert.deepEqual(state.boards.p1.floor, []);
  assert.equal(state.nextStarterId, "p0");
});

test("one draft cannot split across rows; a mismatched, filled or wall-occupied line rejects without mutation", () => {
  const state = createGame(players(2), "abcd"), board = state.boards.p0;
  state.factories[0] = [0, 0, 0];
  board.lines[1] = [1];
  board.lines[2] = [0, 0, 0];
  board.wall[3][WALL_COLORS[3].indexOf(0)] = true;
  for (const row of [1, 2, 3]) {
    const before = structuredClone(state);
    assert.equal(act(state, { type: "draft", source: 0, color: 0, row }).accepted, false);
    assert.deepEqual(state, before);
  }
  assert(act(state, { type: "draft", source: 0, color: 0, row: 0 }).accepted);
  assert.deepEqual(board.lines[0], [0]);
  assert.deepEqual(board.floor, [0, 0]);
  assert.deepEqual(board.lines[4], []);
});

test("players may discard everything; a full floor still grants first-player ownership", () => {
  const state = createGame(players(2), "abcd"), board = state.boards.p0;
  board.floor = [0, 0, 0, 0, 0, 0, 0];
  state.center = [2, 2, 2];
  const discarded = state.discard.length;
  assert(act(state, { type: "draft", source: -1, color: 2, row: -1 }).accepted);
  assert.equal(board.floor.length, 7);
  assert.deepEqual(state.discard.slice(discarded), [2, 2, 2]);
  assert.equal(state.nextStarterId, "p0");
  assert.deepEqual(board.lines.flat(), []);
});

test("scoring counts continuous orthogonal lines, both axes include the new tile", () => {
  const wall = emptyWall();
  wall[2][2] = true;
  assert.equal(wallScore(wall, 2, 2), 1);
  wall[0][2] = wall[4][2] = wall[2][0] = wall[2][4] = true;
  assert.equal(wallScore(wall, 2, 2), 1, "gaps do not connect");
  wall[2][1] = true;
  assert.equal(wallScore(wall, 2, 2), 3);
  wall[1][2] = true;
  assert.equal(wallScore(wall, 2, 2), 6);
  wall[2][3] = wall[3][2] = true;
  assert.equal(wallScore(wall, 2, 2), 10);
  assert.deepEqual(wallBonuses(Array.from({ length: 5 }, () => Array(5).fill(true))), { rows: 5, columns: 5, colors: 5, points: 95 });
});

test("round settlement runs top to bottom, preserves unfinished lines and clamps floor penalties", () => {
  const state = createGame(players(2), "abcd");
  state.boards.p0.lines = [[0], [4, 4], [1], [], []];
  state.boards.p1.floor = [-1, 1, 2, 2, 3, 3, 4];
  settleRound(state);
  assert.equal(state.boards.p0.score, 3, "second placed tile connects to the first vertically");
  assert.deepEqual(state.settlement.results.p0.placements.map(placement => placement.points), [1, 2]);
  assert.deepEqual(state.boards.p0.lines, [[], [], [1], [], []]);
  assert.equal(state.boards.p1.score, 0);
  assert.equal(state.settlement.results.p1.penalty, 14);
  assert.equal(state.settlement.results.p1.delta, 0);
  assert.deepEqual(state.boards.p1.floor, []);
  assert(!state.discard.includes(-1));
});

test("the last draft settles everyone and next round retains partial lines with the new starter", () => {
  const state = createGame(players(2), "abcd");
  state.factories = state.factories.map(() => []);
  state.center = [3];
  state.turn = 1;
  state.boards.p0.lines[2] = [1];
  assert(act(state, { type: "draft", source: -1, color: 3, row: 0 }).accepted);
  assert.equal(state.phase, "round_end");
  assert.equal(state.boards.p1.score, 0, "one wall point minus marker penalty");
  assert(act(state, { type: "next_round" }, "p0").accepted);
  assert.equal(state.round, 2);
  assert.equal(state.turn, 1);
  assert.equal(state.starterId, "p1");
  assert.equal(state.centerMarker, true);
  assert.deepEqual(state.boards.p0.lines[2], [1]);
});

test("bag refills from discard only when empty and allows insufficient supplies", () => {
  const state = createGame(players(2), "abcd");
  state.phase = "round_end";
  state.bag = [4, 4]; state.discard = [0, 1, 2];
  assert(act(state, { type: "next_round" }).accepted);
  assert.deepEqual(state.factories[0].slice(0, 2), [4, 4]);
  assert.equal(state.factories.flat().length, 5);
  assert.equal(state.factories.at(-1).length, 0);
  assert.equal(state.bag.length, 0);
  assert.equal(state.discard.length, 0);
});

test("ending resolves all players, applies each bonus once, and allows a rematch with stale actions blocked", () => {
  const state = createGame(players(2), "abcd");
  state.boards.p0.wall[0] = [true, true, true, true, false];
  state.boards.p0.lines[0] = [4];
  state.boards.p1.lines[0] = [0];
  settleRound(state);
  assert.equal(state.phase, "ended");
  assert.equal(state.boards.p0.score, 7);
  assert.equal(state.boards.p1.score, 1);
  assert.deepEqual(state.winners, ["p0"]);
  const before = structuredClone(state);
  assert.equal(act(state, { type: "next_round" }).accepted, false);
  assert.deepEqual(state, before);
  const oldStep = state.step;
  assert(act(state, { type: "rematch" }).accepted);
  assert.equal(state.round, 1);
  assert.equal(state.step, oldStep + 1);
  assert.equal(state.boards.p0.score, 0);
  assert.deepEqual(state.winners, []);
  assertConservation(state);
  assert.equal(applyAction(state, "p0", { type: "rematch", round: 1, step: oldStep }).accepted, false);
});

test("ties compare completed horizontal rows, then share victory", () => {
  const state = createGame(players(3), "abcd");
  state.boards.p0.wall[0].fill(true);
  state.boards.p1.wall[0].fill(true);
  state.boards.p1.wall[1].fill(true);
  state.boards.p0.score = 10;
  state.boards.p1.score = 8;
  state.boards.p2.score = 12;
  settleRound(state);
  assert.deepEqual(state.winners, ["p1"]);
  const shared = createGame(players(2), "abcd");
  for (const board of Object.values(shared.boards)) board.wall[0].fill(true);
  settleRound(shared);
  assert.deepEqual(shared.winners, ["p0", "p1"]);
});

test("invalid payloads, stale actions, out-of-turn players and observers never mutate state", () => {
  const state = createGame(players(2), "abcd");
  const color = state.factories[0][0];
  const valid = { type: "draft", source: 0, color, row: 0, round: 1, step: 0 };
  const cases = [
    ["observer", valid], ["p1", valid], ["p0", null], ["p0", []], ["p0", { ...valid, type: "bogus" }],
    ...["source", "color", "row", "step", "round"].flatMap(key => [undefined, "0", -99, .5, 999].map(value => ["p0", { ...valid, [key]: value }])),
  ];
  for (const [actor, action] of cases) {
    const before = structuredClone(state);
    assert.equal(applyAction(state, actor, action).accepted, false);
    assert.deepEqual(state, before);
  }
  state.phase = "round_end";
  assert.equal(act(state, { type: "next_round" }, "observer").accepted, false);
  state.phase = "ended";
  assert.equal(act(state, { type: "rematch" }, "observer").accepted, false);
});

test("projection exposes public boards and counts but hides future draws and seed", () => {
  const state = createGame(players(2), "abcd");
  for (const id of ["p0", "p1", "spectator"]) {
    const view = projectGame(state, id);
    for (const key of ["bag", "discard", "seed", "turn"]) assert(!Object.hasOwn(view, key));
    assert.deepEqual(view.counts, { bag: 80, discard: 0 });
    assert.equal(view.canDraft, id === "p0");
  }
});

function luaLiteral(value) {
  if (value == null) return "nil";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return "{" + value.map(luaLiteral).join(",") + "}";
  return "{" + Object.entries(value).map(([key, entry]) => `[${JSON.stringify(key)}]=${luaLiteral(entry)}`).join(",") + "}";
}
function luaCompatible(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.length ? value.map(luaCompatible) : {};
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry != null).map(([key, entry]) => [key, luaCompatible(entry)]));
  return value;
}
async function openLua() {
  const lua = await new LuaFactory().createEngine();
  const execute = lua.doString.bind(lua);
  lua.doString = async source => {
    const top = lua.global.getTop();
    try { return await execute(source); } finally { lua.global.setTop(top); }
  };
  await lua.doString(await readFile(new URL("../public/azul/game.lua", import.meta.url), "utf8"));
  await lua.doString(`function budget(call)
    local fuel = 0
    debug.sethook(function() fuel = fuel + 1000; assert(fuel <= 50000, 'instruction quota exceeded') end, '', 1000)
    local result = call(); debug.sethook(); return result
  end`);
  return lua;
}

test("JS and Lua agree on complete 2–4 player games, conservation, projections, rematches and runtime budget", async () => {
  const lua = await openLua();
  try {
    for (const count of [2, 3, 4]) for (let seed = 1; seed <= 8; seed++) {
      const randomSeed = (seed * 912345).toString(16), roster = players(count);
      let state = createGame(roster, randomSeed);
      const remote = await lua.doString(`state=budget(function() return setup({players=${luaLiteral(roster)},match={randomSeed='${randomSeed}'}}).state end); return state`);
      assert.deepEqual(remote, luaCompatible(state));
      for (let move = 0; state.phase !== "ended"; move++) {
        assert(move < 1000, "game must terminate");
        const actor = state.players[state.turn].id;
        const action = { ...nextIntent(state, seed), round: state.round, step: state.step };
        const result = applyAction(state, actor, action);
        assert(result.accepted);
        const actual = await lua.doString(`local result=budget(function() return on_action(state,${luaLiteral(action)},{actor={id='${actor}'}}) end); state=result.state; return result`);
        assert.deepEqual(actual, luaCompatible(result), `${count} players, seed ${seed}, move ${move}`);
        assertConservation(state);
        if (move % 7 === 0 || state.phase !== "drafting") for (const viewer of [actor, "spectator"]) {
          const visible = await lua.doString(`return budget(function() return view(state,{},{viewer={id='${viewer}'}}).state end)`);
          assert.deepEqual(visible, luaCompatible(projectGame(state, viewer)));
        }
      }
      const restart = { type: "rematch", round: state.round, step: state.step };
      state = applyAction(state, "p0", restart).state;
      assert.deepEqual(await lua.doString(`state=on_action(state,${luaLiteral(restart)},{actor={id='p0'}}).state;return state`), luaCompatible(state));
      assertConservation(state);
    }
  } finally { lua.global.close(); }
});

test("Lua also rejects forged actions and handles full-floor markers and terminal ties", async () => {
  const lua = await openLua();
  try {
    const state = createGame(players(2), "abcd");
    const color = state.factories[0][0];
    const valid = { type: "draft", source: 0, color, row: 0, round: 1, step: 0 };
    const cases = [
      ["spectator", valid], ["p1", valid], ["p0", null], ["p0", { ...valid, source: "0" }],
      ["p0", { ...valid, row: 5 }], ["p0", { ...valid, step: -1 }], ["p0", { type: "next_round", round: 1, step: 0 }],
    ];
    for (const [actor, action] of cases) {
      const before = structuredClone(state);
      const expected = applyAction(state, actor, action);
      assert.deepEqual(await lua.doString(`state=${luaLiteral(before)};return on_action(state,${luaLiteral(action)},{actor={id='${actor}'}})`), expected);
      assert.deepEqual(await lua.doString("return state"), luaCompatible(before));
    }
    for (const fullFloor of [false, true]) {
      const fixture = createGame(players(2), "abcd");
      fixture.factories = fixture.factories.map(() => []);
      fixture.center = [4];
      fixture.boards.p0.wall[0] = [true, true, true, true, false];
      fixture.boards.p1.wall[0].fill(true);
      fixture.boards.p1.score = fullFloor ? 2 : 4;
      if (fullFloor) fixture.boards.p0.floor = Array(7).fill(1);
      const action = { type: "draft", source: -1, color: 4, row: 0, round: 1, step: 0 };
      const before = structuredClone(fixture);
      const expected = applyAction(fixture, "p0", action);
      assert.deepEqual(await lua.doString(`state=${luaLiteral(before)};return budget(function() return on_action(state,${luaLiteral(action)},{actor={id='p0'}}) end)`), luaCompatible(expected));
    }
    assert.equal(await lua.doString("return on_return_to_room({}, {})"), true);
  } finally { lua.global.close(); }
});

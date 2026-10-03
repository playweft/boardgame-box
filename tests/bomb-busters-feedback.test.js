import assert from "node:assert/strict";
import test from "node:test";
import { recentChanges, startsOwnTurn, revealExplosionTargets } from "../src/games/bomb-busters/feedback.js";
import { applyAction, createGame, projectGame } from "../src/games/bomb-busters/engine.js";
import { readFile } from "node:fs/promises";
import { LuaFactory } from "wasmoon";

test("highlight only the latest newly cut wires or public clues", () => {
  const before = { cutWires: [{ id: "old" }], clues: { oldClue: true } };
  const after = { cutWires: [...before.cutWires, { id: "a" }, { id: "b" }], clues: { ...before.clues, newClue: true } };
  assert.deepEqual(recentChanges(before, after), { cutIds: ["a", "b"], clueIds: ["newClue"] });
  assert.deepEqual(recentChanges(after, after), { cutIds: [], clueIds: [] });
  assert.deepEqual(recentChanges(null, after), { cutIds: [], clueIds: [] });
  assert.deepEqual(recentChanges({ cutWires: {}, clues: {} }, after), {
    cutIds: ["old", "a", "b"], clueIds: ["oldClue", "newClue"],
  });
});

test("explosion preview keeps own hand, public clues and cut wires while revealing only the target", () => {
  const game = {
    viewerId: "self", lastAction: { targetIds: ["red"] },
    racks: {
      self: [[{ id: "own", revealed: true, kind: "number", value: 1 }]],
      other: [[
        { id: "red", revealed: true, kind: "red" },
        { id: "hidden", revealed: true, kind: "number", value: 2, tileNumber: "2", infoToken: "2" },
        { id: "slot", empty: true, cutWire: { id: "cut" } },
      ]],
    },
  };
  const preview = revealExplosionTargets(game);
  assert.equal(preview.racks.self[0][0].revealed, true);
  assert.equal(preview.racks.other[0][0].revealed, true);
  assert.equal(preview.racks.other[0][1].revealed, false);
  assert.equal(preview.racks.other[0][1].value, null);
  assert.equal(preview.racks.other[0][1].infoToken, "2");
  assert.equal(preview.racks.other[0][2].cutWire.id, "cut");
  assert.equal(game.racks.other[0][1].revealed, true);
});

test("JS and Lua preserve exact red explosion targets for both cut actions", async () => {
  const players = [{ id: "p0" }, { id: "p1" }];
  for (const type of ["dual_cut", "double_detector"]) {
    const state = createGame(players, Math.random, "p0");
    state.phase = "playing";
    state.wires = { s: { id: "s", kind: "number", value: 1 }, r1: { id: "r1", kind: "red" }, r2: { id: "r2", kind: "red" } };
    state.hands = { p0: ["s"], p1: ["r1", "r2"] };
    state.rackSlots = { p0: [["s"]], p1: [["r1", "r2"]] };
    const result = applyAction(state, "p0", { type, sourceId: "s", targetId: "r1", targetIds: ["r1", "r2"] });
    assert.equal(result.accepted, true);
    assert.deepEqual(projectGame(result.state, "p1").lastAction.targetIds, type === "dual_cut" ? ["r1"] : ["r1", "r2"]);
  }
  const lua = await new LuaFactory().createEngine();
  try {
    await lua.doString(await readFile(new URL("../public/bomb-busters/game.lua", import.meta.url), "utf8"));
    await lua.doString(`
      for _, kind in ipairs({'dual_cut', 'double_detector'}) do
        local state = setup({players = {{id='p0'}, {id='p1'}}, match = {randomSeed='1234'}}).state
        state.phase = 'playing'
        state.turn = 1
        state.wires = {s={id='s', kind='number', value=1}, r1={id='r1', kind='red'}, r2={id='r2', kind='red'}}
        state.hands = {p0={'s'}, p1={'r1', 'r2'}}
        state.rackSlots = {p0={{'s'}}, p1={{'r1', 'r2'}}}
        local result = on_action(state, {type=kind, sourceId='s', targetId='r1', targetIds={'r1', 'r2'}}, {actor={id='p0'}})
        assert(result.accepted and result.state.phase == 'ended')
        local ids = view(result.state, {}, {viewer={id='p1'}}).state.lastAction.targetIds
        assert(ids[1] == 'r1')
        assert(#ids == (kind == 'dual_cut' and 1 or 2))
      end
    `);
  } finally {
    lua.global.close();
  }
});

test("turn notice fires on entering your turn, not repeated updates or game end", () => {
  const own = { ownTurn: true, phase: "playing", currentPlayerId: "self" };
  assert.equal(startsOwnTurn(null, own), true);
  assert.equal(startsOwnTurn({ ...own, ownTurn: false, currentPlayerId: "other" }, own), true);
  assert.equal(startsOwnTurn(own, { ...own }), false);
  assert.equal(startsOwnTurn({ ...own, phase: "setup_info" }, own), true);
  assert.equal(startsOwnTurn(own, { ...own, phase: "ended" }), false);
  assert.equal(startsOwnTurn(own, { ...own, ownTurn: false }), false);
});

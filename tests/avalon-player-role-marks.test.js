import assert from "node:assert/strict";
import test from "node:test";
import { loadPlayerRoleMarks, savePlayerRoleMarks } from "../src/games/avalon/player-role-marks.js";

const scope = { matchId: "match", round: 1, playerId: "viewer" };
const players = ["p1", "p2"], roles = ["merlin", "assassin"];
function store() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test("refresh restores marks, while other viewers, matches and rematches start empty", () => {
  const saved = store(), storage = () => saved;
  savePlayerRoleMarks(scope, { p1: "merlin" }, storage);
  assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, storage), { p1: "merlin" });
  for (const patch of [{ playerId: "other" }, { matchId: "other" }, { round: 2 }])
    assert.deepEqual(loadPlayerRoleMarks({ ...scope, ...patch }, players, roles, storage), {});
  assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, () => store()), {});
  savePlayerRoleMarks(scope, {}, storage);
  assert.equal(saved.values.size, 0);
});

test("restored data accepts only seated players and known roles", () => {
  const saved = store(), storage = () => saved;
  savePlayerRoleMarks(scope, { p1: "merlin", p2: "unknown", outside: "assassin" }, storage);
  assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, storage), { p1: "merlin" });
  for (const content of ["invalid JSON", "null", "[]", "7"]) {
    for (const key of saved.values.keys()) saved.values.set(key, content);
    assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, storage), {});
  }
});

test("faction marks survive refresh and can be replaced with a specific role", () => {
  const saved = store(), storage = () => saved;
  savePlayerRoleMarks(scope, { p1: "good", p2: "evil" }, storage);
  assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, storage), { p1: "good", p2: "evil" });
  savePlayerRoleMarks(scope, { p1: "merlin", p2: "evil" }, storage);
  assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, storage), { p1: "merlin", p2: "evil" });
});

test("unavailable session storage and incomplete room scope do not break the UI", () => {
  const blocked = () => { throw new Error("blocked"); };
  assert.deepEqual(loadPlayerRoleMarks(scope, players, roles, blocked), {});
  assert.doesNotThrow(() => savePlayerRoleMarks(scope, { p1: "merlin" }, blocked));
  for (const patch of [{ matchId: null }, { round: null }, { playerId: null }]) {
    assert.deepEqual(loadPlayerRoleMarks({ ...scope, ...patch }, players, roles, blocked), {});
    assert.doesNotThrow(() => savePlayerRoleMarks({ ...scope, ...patch }, {}, blocked));
  }
});

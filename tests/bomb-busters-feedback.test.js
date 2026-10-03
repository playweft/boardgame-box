import assert from "node:assert/strict";
import test from "node:test";
import { recentChanges, startsOwnTurn } from "../src/games/bomb-busters/feedback.js";

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

test("turn notice fires on entering your turn, not repeated updates or game end", () => {
  const own = { ownTurn: true, phase: "playing", currentPlayerId: "self" };
  assert.equal(startsOwnTurn(null, own), true);
  assert.equal(startsOwnTurn({ ...own, ownTurn: false, currentPlayerId: "other" }, own), true);
  assert.equal(startsOwnTurn(own, { ...own }), false);
  assert.equal(startsOwnTurn({ ...own, phase: "setup_info" }, own), true);
  assert.equal(startsOwnTurn(own, { ...own, phase: "ended" }), false);
  assert.equal(startsOwnTurn(own, { ...own, ownTurn: false }), false);
});

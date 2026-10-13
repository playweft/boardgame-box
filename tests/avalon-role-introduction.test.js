import assert from "node:assert/strict";
import test from "node:test";
import { createRoleIntroduction } from "../src/games/avalon/role-introduction.js";

const scope = { matchId: "match", round: 1, playerId: "p1", hasRole: true, finished: false };
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("identity opens once, including after a refresh or reconnect", () => {
  const saved = storage();
  const first = createRoleIntroduction(() => saved);
  assert.equal(first(scope), true);
  assert.equal(first({ ...scope }), false);
  assert.equal(createRoleIntroduction(() => saved)(scope), false);
  assert.deepEqual([...saved.values.values()], ["1"]);
});

test("new matches, rematches and different players each get their own introduction", () => {
  const saved = storage();
  const claim = createRoleIntroduction(() => saved);
  for (const next of [scope, { ...scope, round: 2 }, { ...scope, matchId: "next" }, { ...scope, playerId: "p2" }]) {
    assert.equal(claim(next), true);
    assert.equal(createRoleIntroduction(() => saved)(next), false);
  }
});

test("loading states, spectators and completed games do not consume an introduction", () => {
  const saved = storage();
  const claim = createRoleIntroduction(() => saved);
  for (const patch of [{ matchId: null }, { round: null }, { playerId: null }, { hasRole: false }, { finished: true }]) {
    assert.equal(claim({ ...scope, ...patch }), false);
  }
  assert.equal(saved.values.size, 0);
  assert.equal(claim(scope), true);
});

test("blocked browser storage falls back to remembering the current session", () => {
  for (const saved of [() => { throw new Error("blocked"); }, () => ({ getItem() { throw new Error("blocked"); } }), () => ({ getItem: () => null, setItem() { throw new Error("full"); } })]) {
    const claim = createRoleIntroduction(saved);
    assert.equal(claim(scope), true);
    assert.equal(claim(scope), false);
  }
});

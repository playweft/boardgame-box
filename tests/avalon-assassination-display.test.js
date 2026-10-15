import assert from "node:assert/strict";
import test from "node:test";
import { createAssassinationDisplay, assassinationRevealDuration } from "../src/games/avalon/assassination-display.js";

const playing = { phase: "assassinate", round: 1, players: [{ id: "p1" }, { id: "p2" }] };
const finished = { ...playing, phase: "game-over", assassinationTarget: "p2", winner: "evil", endReason: "hit", finalRoles: [{ playerId: "p2", roleId: "merlin" }], canRematch: true };

function harness() {
  let now = 0, changes = 0;
  const timers = new Set();
  const display = createAssassinationDisplay({
    onChange: () => changes++, now: () => now,
    schedule(callback, delay) { const timer = { callback, deadline: now + delay }; timers.add(timer); return timer; },
    cancel: timer => timers.delete(timer),
  });
  return {
    display, get changes() { return changes; },
    elapse(ms) { now += ms; },
    tick(ms) {
      now += ms;
      for (const timer of [...timers]) if (now >= timer.deadline) { timers.delete(timer); timer.callback(); }
    },
  };
}

test("a confirmed assassination shows its target before exposing the result, without mutating shared state", () => {
  const h = harness();
  h.display.update(playing, "match");
  h.display.update(finished, "match");
  const reveal = h.display.state(finished);
  assert.equal(reveal.phase, "assassination-result");
  assert.equal(reveal.assassinationTarget, "p2");
  assert.equal(reveal.winner, undefined);
  assert.equal(reveal.endReason, undefined);
  assert.deepEqual(reveal.finalRoles, []);
  assert.equal(reveal.canRematch, false);
  assert.equal(finished.phase, "game-over");
  assert.equal(finished.finalRoles[0].roleId, "merlin");
  h.tick(assassinationRevealDuration - 1);
  h.display.update({ ...finished }, "match");
  assert.equal(h.display.state(finished).phase, "assassination-result");
  h.tick(1);
  assert.equal(h.display.state(finished), finished);
  assert.equal(h.changes, 1);
  h.display.update(finished, "match");
  assert.equal(h.display.state(finished), finished);
});

test("fresh connections and matches load a finished game without replaying the animation", () => {
  const h = harness();
  h.display.update(finished, "match");
  assert.equal(h.display.state(finished), finished);
  h.tick(5000);
  assert.equal(h.changes, 0);
});

test("a rematch or new match cancels a pending reveal and its timer", () => {
  for (const [matchId, round] of [["other", 1], ["match", 2]]) {
    const h = harness();
    h.display.update(playing, "match");
    h.display.update(finished, "match");
    const fresh = { ...playing, phase: "propose", round };
    h.display.update(fresh, matchId);
    assert.equal(h.display.state(fresh), fresh);
    h.tick(5000);
    assert.equal(h.changes, 0);
  }
});

test("resuming after the reveal deadline shows results even if the browser delayed its timer", () => {
  const h = harness();
  h.display.update(playing, "match");
  h.display.update(finished, "match");
  h.elapse(assassinationRevealDuration);
  assert.equal(h.display.state(finished), finished);
  h.tick(1);
  assert.equal(h.changes, 0);
});

test("other endings show results immediately and target zero is still a valid reveal", () => {
  const h = harness();
  h.display.update(playing, "match");
  const ordinary = { ...finished, assassinationTarget: undefined };
  h.display.update(ordinary, "match");
  assert.equal(h.display.state(ordinary), ordinary);
  h.display.update(playing, "match");
  h.display.update({ ...finished, assassinationTarget: 0 }, "match");
  assert.equal(h.display.state(finished).assassinationTarget, 0);
});

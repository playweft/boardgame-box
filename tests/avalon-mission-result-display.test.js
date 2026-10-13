import assert from "node:assert/strict";
import test from "node:test";
import { createMissionResultDisplay } from "../src/games/avalon/mission-result-display.js";

function harness() {
  let now = 0;
  let changes = 0;
  const timers = new Map();
  const display = createMissionResultDisplay({
    onChange: () => changes++,
    now: () => now,
    schedule(callback, delay) {
      const timer = { callback, deadline: now + delay };
      timers.set(timer, timer);
      return timer;
    },
    cancel: timer => timers.delete(timer),
  });
  return {
    display,
    get changes() { return changes; },
    elapseWithoutTimers(ms) { now += ms; },
    tick(ms) {
      now += ms;
      for (const timer of [...timers.values()]) {
        if (timer.deadline <= now) {
          timers.delete(timer);
          timer.callback();
        }
      }
    },
  };
}

const playing = {
  phase: "mission", round: 1, quest: 1, leader: "p1",
  selectedTeam: ["p1", "p3"], missionTeam: ["p1", "p3"],
  votes: { p1: false, p2: true, p3: true }, proposalHistory: [],
};
const completed = {
  ...playing, phase: "propose", quest: 2, leader: "p2", selectedTeam: [], missionTeam: [], votes: undefined,
  lastMission: { number: 1, team: ["p1", "p3"], passed: true, failures: 0, threshold: 1 },
  proposalHistory: [{ quest: 1, approved: true, votes: playing.votes }],
};

test("result display preserves the completed quest and expires at five seconds without extending on updates", () => {
  const h = harness();
  h.display.update(playing, "match");
  h.display.update(completed, "match");
  const result = h.display.state(completed);
  assert.equal(result.phase, "mission-result");
  assert.equal(result.quest, 1);
  assert.equal(result.leader, "p1");
  assert.deepEqual(result.selectedTeam, completed.lastMission.team);
  assert.deepEqual(result.votes, playing.votes);
  assert.equal(completed.phase, "propose");
  h.tick(4999);
  h.display.update({ ...completed }, "match");
  assert.equal(h.display.state(completed).phase, "mission-result");
  h.tick(1);
  assert.equal(h.display.state(completed), completed);
  assert.equal(h.changes, 1);
});

test("continue dismisses only one viewer, keeps shared state unchanged and does not replay on further updates", () => {
  const first = harness(), second = harness();
  for (const h of [first, second]) {
    h.display.update(playing, "match");
    h.display.update(completed, "match");
  }
  first.display.dismiss();
  first.display.update(completed, "match");
  assert.equal(first.display.state(completed), completed);
  assert.equal(second.display.state(completed).phase, "mission-result");
  first.tick(5000);
  assert.equal(first.changes, 1);
});

test("resuming a background page discards an expired result even before its delayed timer fires", () => {
  const h = harness();
  h.display.update(playing, "match");
  h.display.update(completed, "match");
  h.elapseWithoutTimers(5000);
  assert.equal(h.display.state(completed), completed);
  h.tick(1);
  assert.equal(h.changes, 0);
});

test("a submitted next team forces every viewer out of the previous result", () => {
  const h = harness();
  h.display.update(playing, "match");
  h.display.update(completed, "match");
  h.display.update({ ...completed, selectedTeam: ["p1", "p2", "p3"] }, "match");
  assert.equal(h.display.state(completed).phase, "mission-result");
  const nominated = { ...completed, phase: "vote", selectedTeam: ["p1", "p2", "p3"] };
  h.display.update(nominated, "match");
  assert.equal(h.display.state(nominated), nominated);
  h.tick(5000);
  assert.equal(h.changes, 0);
  const skipped = harness();
  skipped.display.update(playing, "match");
  skipped.display.update(nominated, "match");
  assert.equal(skipped.display.state(nominated), nominated);
});

test("reconnects, new matches and rematches discard stale result timers", () => {
  const h = harness();
  h.display.update(completed, "match");
  assert.equal(h.display.state(completed), completed);
  for (const [matchId, round] of [["new-match", 1], ["new-match", 2]]) {
    const active = { ...playing, round };
    h.display.update(active, matchId);
    h.display.update({ ...completed, round }, matchId);
    assert.equal(h.display.state(completed).phase, "mission-result");
    h.display.update({ ...playing, round: round + 1 }, matchId);
    h.tick(5000);
    assert.equal(h.display.state(active), active);
  }
  assert.equal(h.changes, 0);
});

test("terminal mission results preserve the summary until local dismissal, then expose the authoritative next phase", () => {
  for (const phase of ["assassinate", "game-over"]) {
    const h = harness();
    h.display.update(playing, "match");
    const terminal = { ...completed, phase };
    h.display.update(terminal, "match");
    assert.equal(h.display.state(terminal).phase, "mission-result");
    h.display.dismiss();
    assert.equal(h.display.state(terminal).phase, phase);
  }
});

test("an early assassination immediately replaces an unfinished local mission result display", () => {
  const h = harness();
  h.display.update(playing, "match");
  h.display.update(completed, "match");
  assert.equal(h.display.state(completed).phase, "mission-result");
  const assassination = { ...completed, phase: "assassinate" };
  h.display.update(assassination, "match");
  assert.equal(h.display.state(assassination), assassination);
  h.tick(5000);
  assert.equal(h.changes, 0);
});

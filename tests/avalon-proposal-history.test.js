import assert from "node:assert/strict";
import test from "node:test";
import { withProposalLeaders } from "../src/games/avalon/proposal-history.js";

const players = ["p1", "p2", "p3", "p4", "p5"].map(id => ({ id }));
const history = [{ quest: 1, approved: false }, { quest: 1, approved: true }];

test("old proposals retain their original captains after the next mission or proposal starts", () => {
  for (const phase of ["propose", "vote"])
    assert.deepEqual(withProposalLeaders(history, players, "p3", phase).map(item => item.leader), ["p1", "p2"]);
  assert(history.every(item => item.leader === undefined));
});

test("an accepted last proposal keeps its captain during the mission, result and terminal phases", () => {
  for (const phase of ["mission", "mission-result", "assassinate", "game-over", "over"])
    assert.deepEqual(withProposalLeaders(history, players, "p2", phase).map(item => item.leader), ["p1", "p2"]);
});

test("rejected proposals rotate captains even when the fifth rejection ends the game", () => {
  const rejected = Array.from({ length: 5 }, () => ({ approved: false }));
  for (const phase of ["vote-result", "game-over"])
    assert.deepEqual(withProposalLeaders(rejected, players, "p1", phase).map(item => item.leader), ["p1", "p2", "p3", "p4", "p5"]);
});

test("long histories wrap around and stored captains take precedence", () => {
  const old = Array.from({ length: 12 }, (_, index) => ({ approved: index % 3 === 2 }));
  assert.deepEqual(withProposalLeaders(old, players, "p3", "vote").map(item => item.leader), ["p1", "p2", "p3", "p4", "p5", "p1", "p2", "p3", "p4", "p5", "p1", "p2"]);
  const recorded = [{ leader: "p5", approved: true }];
  assert.equal(withProposalLeaders(recorded, players, "p1", "mission")[0], recorded[0]);
  assert.equal(withProposalLeaders(recorded, players, "missing", "mission"), recorded);
  const local = [{ leader: 0, approved: true }];
  assert.equal(withProposalLeaders(local, [{ id: 0 }, { id: 1 }], 1, "mission")[0].leader, 0);
});

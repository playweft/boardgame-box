import assert from "node:assert/strict";
import test from "node:test";
import { actingPlayer, applyAction, createGame, projectGame } from "../src/games/lifeboat/engine.js";
import { computerDelay, describeTurn } from "../src/games/lifeboat/turn-feedback.js";

const roster = Array.from({ length: 4 }, (_, index) => ({ id: `p${index}` }));

test("computer taking a provision moves a card back without revealing its identity", () => {
  const state = createGame(roster, "beef");
  const actor = actingPlayer(state);
  const viewer = roster.find(player => player.id !== actor).id;
  const card = state.offer[0];
  const result = applyAction(state, actor, { step: state.step, type: "take", card });
  assert.equal(result.accepted, true);
  const cue = describeTurn(projectGame(state, viewer), projectGame(result.state, viewer), { type: "take", card });
  assert.deepEqual(cue.transfer, { from: null, to: state.queue[0] });
  assert.match(cue.text, /拿走一张物资牌/);
  assert.equal(JSON.stringify(cue).includes(card), false);
  assert.equal(computerDelay({ type: "take" }), 450);
});

test("a stolen card travels from the former owner to the recipient using public endpoints", () => {
  const before = projectGame(createGame(roster, "beef"), "p0");
  const after = {
    ...before, step: before.step + 1,
    log: [{ type: "mug", from: "captain", to: "mate", card: "knife-1" }],
  };
  const cue = describeTurn(before, after, { type: "mug", card: "knife-1" });
  assert.deepEqual(cue.transfer, { from: "mate", to: "captain" });
  assert.equal(cue.text, "船长从大副那里抢走一张牌");
  assert.equal(JSON.stringify(cue).includes("knife-1"), false);
  assert.equal(computerDelay({ type: "mug" }), 600);
});

test("navigation feedback keeps a public wound change visible through the next computer decision", () => {
  const before = projectGame(createGame(roster, "beef"), "p0");
  const after = {
    ...before, step: before.step + 1, birds: 1,
    log: [{ type: "nav", card: "nav-10", birds: 1 }],
    characters: before.characters.map(person => ({ ...person, wounds: person.id === "mate" ? 1 : 0 })),
  };
  const cue = describeTurn(before, after, { type: "play", card: "nav-10" });
  assert.deepEqual(cue.injuries, ["mate"]);
  assert.equal(cue.text, "航海结算 · 海鸥 +1 · 大副受伤 1 点");
  assert.equal(cue.hold, 850);
});

test("private prompts yield no feedback until they cause a public change", () => {
  const view = { ...projectGame(createGame(roster, "beef"), "p0"), phase: "fight", queue: [] };
  assert.equal(describeTurn(view, { ...view, step: view.step + 1 }, { type: "arm", card: false }), null);
  assert.equal(describeTurn(view, { ...view, step: view.step + 1 }, { type: "drink", uses: [] }), null);
});

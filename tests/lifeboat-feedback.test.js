import assert from "node:assert/strict";
import test from "node:test";
import { actingPlayer, applyAction, createGame, projectGame } from "../src/games/lifeboat/engine.js";
import { computerDelay, describeTurn, navigationCardBetween } from "../src/games/lifeboat/turn-feedback.js";

const roster = Array.from({ length: 4 }, (_, index) => ({ id: `p${index}` }));

test("a resolved navigation card is shown once even if its effects already finished", () => {
  const before = { step: 12, log: [{ type: "nav", card: "nav-1" }] };
  const after = { step: 13, navCard: false, log: [...before.log,
    { type: "flare", card: "nav-2" }, { type: "nav", card: "nav-3" },
  ] };
  assert.equal(navigationCardBetween(before, after), "nav-3");
  assert.equal(navigationCardBetween(after, after), null);
  assert.equal(navigationCardBetween(null, after), null);
  assert.equal(navigationCardBetween(before, { ...after, log: after.log.slice(0, -1) }), null);
});

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
  assert.equal(computerDelay({ type: "take" }), 300);
  assert.equal(cue.hold, 350);
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
  assert.equal(computerDelay({ type: "mug" }), 450);
  assert.equal(cue.hold, 650);
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
  assert.equal(cue.hold, 900);
});

test("private prompts yield no feedback until they cause a public change", () => {
  const view = { ...projectGame(createGame(roster, "beef"), "p0"), phase: "fight", queue: [] };
  assert.equal(describeTurn(view, { ...view, step: view.step + 1 }, { type: "arm", card: false }), null);
  assert.equal(describeTurn(view, { ...view, step: view.step + 1 }, { type: "drink", uses: [] }), null);
});


test("a mugging request shows both public seats without moving a card yet", () => {
  const before = projectGame(createGame(roster, "beef"), "p0");
  const after = { ...before, phase: "answer", step: before.step + 1,
    log: [{ type: "act", id: "mate", act: "mug", target: "lauren" }],
  };
  const cue = describeTurn(before, after, { type: "mug", target: "lauren" });
  assert.equal(cue.text, "大副 → 劳伦 · 抢夺");
  assert.deepEqual(cue.mug, { from: "mate", to: "lauren" });
  assert.equal(cue.transfer, null);
  assert.equal(cue.hold, 800);
});

test("joining a side stays visible and a simultaneous fight result uses the longer hold", () => {
  const before = { ...projectGame(createGame(roster, "beef"), "p0"), queue: ["mate"],
    fight: { attackers: ["captain"], defenders: ["lauren"] }, phase: "fight",
  };
  for (const side of ["attack", "defend"]) {
    const action = { type: "join", side };
    const joined = describeTurn(before, { ...before, step: before.step + 1 }, action);
    assert.equal(joined.joined, "mate");
    assert.equal(joined.hold, 600);
    const resolved = describeTurn(before, { ...before, step: before.step + 1, phase: "action", fight: false,
      log: [{ type: "fight", attacker: "captain", defender: "lauren", attackersWin: side === "attack" }],
    }, action);
    assert.deepEqual(resolved.winners, [side === "attack" ? "captain" : "lauren", "mate"]);
    assert.equal(resolved.hold, 1000);
  }
});

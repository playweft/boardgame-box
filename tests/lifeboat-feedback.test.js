import assert from "node:assert/strict";
import test from "node:test";
import { actingPlayer, applyAction, createGame, projectGame } from "../src/games/lifeboat/engine.js";
import { t } from "../src/games/lifeboat/i18n.js";
import { computerDelay, describeTurn, navigationCardBetween, treatmentBetween } from "../src/games/lifeboat/turn-feedback.js";

const roster = Array.from({ length: 4 }, (_, index) => ({ id: `p${index}` }));

test("treatment playback uses only a visible kit and records recovery before navigation damage", () => {
  const before = {
    step: 12, log: [], characters: [
      { id: "captain", shown: [], hand: false, wounds: 0 },
      { id: "mate", shown: [], hand: [], wounds: 2 },
    ],
  };
  const after = { ...before, step: 13, log: [
    { type: "heal", id: "captain", target: "mate" }, { type: "nav", card: "nav-10" },
  ] };
  assert.deepEqual(treatmentBetween(before, after, "medical-1"), {
    from: "captain", target: "mate", card: undefined, wounds: 1,
  });
  for (const visible of [{ hand: ["medical-1"] }, { shown: ["medical-1"] }]) {
    const visibleBefore = { ...before, characters: [{ ...before.characters[0], ...visible }, before.characters[1]] };
    assert.equal(treatmentBetween(visibleBefore, after)?.card, "medical-1");
  }
  assert.equal(treatmentBetween(after, after), null);
});

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
  assert.ok(cue.parts.some(part => part.icon === "crate" && part.label === "物资牌"));
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
  assert.deepEqual(cue.parts.filter(part => typeof part === "object"), [
    { id: "captain", label: "船长" },
    { id: "mate", label: "大副" },
  ]);
  assert.equal(JSON.stringify(cue).includes("knife-1"), false);
  assert.equal(computerDelay({ type: "mug" }), 450);
  assert.equal(cue.hold, 650);
});

test("navigation feedback keeps a public wound change visible through the next computer decision", () => {
  const before = projectGame(createGame(roster, "beef"), "p0");
  const after = {
    ...before, step: before.step + 1, birds: 1,
    log: [{ type: "act", id: "mate", act: "nothing" }, { type: "nav", card: "nav-10", birds: 1, source: "deck" }],
    characters: before.characters.map(person => ({ ...person, wounds: person.id === "mate" ? 1 : 0 })),
  };
  const cue = describeTurn(before, after, { type: "nothing" });
  assert.deepEqual(cue.injuries, ["mate"]);
  assert.deepEqual(cue.lines.map(line => line.map(part => part.label ?? part).join("")), [
    t("feedback.pass", { name: "大副" }),
    "航海结算，从牌库顶翻开了一张航海牌",
    "海鸥 +1 · 大副受伤 1 点",
  ]);
  assert.ok(cue.lines[1].some(part => part.navigationCard === "nav-10"));
  assert.equal(cue.hold, 900);

  const thirst = describeTurn(after, {
    ...after, step: after.step + 1,
    log: [...after.log, { type: "thirst", id: "mate", wounds: 1 }],
    characters: after.characters.map(person => person.id === "mate" ? { ...person, wounds: 2 } : person),
  }, { type: "drink", uses: [] });
  assert.equal(thirst.text, "大副因口渴受伤 1 点");
  assert.deepEqual(thirst.injuries, ["mate"]);
});

test("navigation feedback identifies the navigator only when someone chose the card", () => {
  const before = projectGame(createGame(roster, "beef"), "p0");
  const after = { ...before, step: before.step + 1 };
  const card = { type: "nav", card: "nav-10", birds: 0 };
  const chosen = describeTurn(before, { ...after, log: [{ ...card, source: "choice", navigator: "stephen" }] });
  assert.equal(chosen.text, "航海结算，斯蒂芬选择了一张航海牌");
  assert.ok(chosen.parts.some(part => part.navigationCard === card.card));
  const automatic = describeTurn(before, { ...after, log: [{ ...card, source: "row" }] });
  assert.equal(automatic.text, "航海结算，翻开了一张航海牌");
});

test("private prompts yield no feedback until they cause a public change", () => {
  const view = { ...projectGame(createGame(roster, "beef"), "p0"), phase: "fight", queue: [] };
  assert.equal(describeTurn(view, { ...view, step: view.step + 1 }, { type: "arm", card: false }), null);
  assert.equal(describeTurn(view, { ...view, step: view.step + 1 }, { type: "drink", uses: [] }), null);
});

test("fight feedback names and illustrates weapons after they become public", () => {
  const before = { ...projectGame(createGame(roster, "beef"), "p0"), phase: "fight", queue: [] };
  const action = { type: "arm", card: "knife-1" };
  const after = { ...before, step: before.step + 1 };
  assert.equal(describeTurn(before, after, action), null);

  const armed = { ...after, characters: after.characters.map(person =>
    person.id === "mate" ? { ...person, shown: [action.card] } : person,
  ) };
  const cue = describeTurn(before, armed, action);
  assert.equal(cue.text, "大副亮出短刀");
  assert.ok(cue.parts.some(part => part.icon === "knife" && part.label === "短刀"));

  const flare = { ...after, log: [...before.log, { type: "fightFlare", id: "mate" }] };
  const fired = describeTurn(before, flare, { type: "arm", card: "flare-1" });
  assert.equal(fired.text, "大副打出信号枪，战力 +8");
  assert.ok(fired.parts.some(part => part.icon === "flare" && part.label === "信号枪"));
});


test("a mugging request shows both public seats without moving a card yet", () => {
  const before = projectGame(createGame(roster, "beef"), "p0");
  const after = { ...before, phase: "answer", step: before.step + 1,
    log: [{ type: "act", id: "mate", act: "mug", target: "lauren" }],
  };
  const cue = describeTurn(before, after, { type: "mug", target: "lauren" });
  assert.equal(cue.text, "大副发起了对劳伦的物资的抢夺");
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

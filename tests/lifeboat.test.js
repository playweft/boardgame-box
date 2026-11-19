import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LuaFactory } from "wasmoon";
import { NAVIGATION, PROVISIONS } from "../src/games/lifeboat/data.js";
import { actingPlayer, applyAction, createGame, projectGame } from "../src/games/lifeboat/engine.js";
import { normalizeRoomView } from "../src/games/lifeboat/room-state.js";

const roster = count => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `玩家 ${index + 1}` }));
const send = (state, actor, action) => applyAction(state, actor, { step: state.step, ...action });

function autoplay(state, limit = 500) {
  let guard = 0;
  while (state.phase !== "ended" && guard < limit) {
    guard += 1;
    const actor = actingPlayer(state);
    let action;
    if (state.phase === "deal") action = { type: "take", card: state.offer[0] };
    else if (state.phase === "action") action = { type: "nothing" };
    else if (state.phase === "row") action = { type: "sort", keep: state.rowChoices.map(() => false) };
    else if (state.phase === "answer") action = { type: "answer", accept: false };
    else if (state.phase === "fight") action = state.fight.stage === "join" ? { type: "join", side: "out" } : { type: "arm", card: false };
    else if (state.phase === "navigate") action = { type: "play", card: state.rowChoices[0] };
    else if (state.phase === "rescue") action = { type: "rescue" };
    else if (state.phase === "thirst") action = { type: "drink", uses: [] };
    else break;
    const result = send(state, actor, action);
    assert.equal(result.accepted, true, `${state.phase} ${action.type} ${result.error?.message ?? ""}`);
    state = result.state;
  }
  return state;
}

test("the basic English boat is four to six people, with the printed deck", () => {
  assert.equal(PROVISIONS.length, 42);
  assert.equal(NAVIGATION.length, 24);
  assert.throws(() => createGame(roster(3), "beef"));
  assert.throws(() => createGame(roster(7), "beef"));
  const state = createGame(roster(4), "beef");
  assert.equal(state.cast.length, 4);
  assert.deepEqual(state.cast, [...state.cast].sort((a, b) =>
    ["lauren", "stephen", "captain", "mate", "frenchy", "kid"].indexOf(a)
    - ["lauren", "stephen", "captain", "mate", "frenchy", "kid"].indexOf(b)));
  assert.equal(state.characters.reduce((sum, entry) => sum + entry.hand.length, 0), 4);
  const view = projectGame(state, "p1");
  assert.equal(view.characters.find(entry => entry.player === "p0").hand, false);
  assert.equal(view.characters.find(entry => entry.player === "p0").love, false);
  assert.ok(view.characters.find(entry => entry.player === "p1").hand);
  assert.equal(view.offer, false);
});

test("four birds end the voyage before any further drowning, and secrets stay hidden until then", () => {
  const landed = autoplay(createGame(roster(6), "beef"));
  assert.equal(landed.outcome, "landed");
  assert.equal(landed.birds, 4);
  assert.ok(landed.scores.every(score => score.total === score.survival + score.love + score.hate + score.loot));
  const before = createGame(roster(5), "c0ffee");
  const hidden = projectGame(before, "spectator");
  assert.ok(hidden.characters.every(entry => entry.hand === false && entry.love === false));
  const revealed = projectGame(landed, "spectator");
  assert.ok(revealed.characters.every(entry => Array.isArray(entry.hand) && entry.love));
});

test("the kid takes a hidden card without a fight, and a refused mugging wounds the losing side", () => {
  let state = createGame(roster(6), "beef");
  while (state.phase === "deal") state = send(state, actingPlayer(state), { type: "take", card: state.offer[0] }).state;
  const bully = state.characters.find(entry => entry.player === actingPlayer(state));
  const target = state.characters.find(entry => entry.id !== bully.id && entry.id !== "kid" && entry.hand.length);
  state = send(state, bully.player, { type: "mug", target: target.id }).state;
  assert.equal(state.phase, "answer");
  state = send(state, target.player, { type: "answer", accept: false }).state;
  while (state.phase === "fight") {
    const action = state.fight.stage === "join" ? { type: "join", side: "out" } : { type: "arm", card: false };
    state = send(state, actingPlayer(state), action).state;
  }
  assert.ok(state.log.some(entry => entry.type === "fight"));
  assert.ok(state.characters.some(entry => entry.wounds > 0));

  const kid = () => state.characters.find(entry => entry.id === "kid");
  const victim = state.characters.find(entry => entry.id !== "kid" && entry.hand.length);
  const before = state.characters.find(entry => entry.id === victim.id).hand.length;
  while (state.phase === "action" && actingPlayer(state) !== kid().player) {
    state = send(state, actingPlayer(state), { type: "nothing" }).state;
  }
  assert.equal(actingPlayer(state), kid().player);
  state = send(state, kid().player, { type: "mug", target: victim.id }).state;
  assert.notEqual(state.phase, "answer");
  assert.ok(state.log.some(entry => entry.type === "mug" && entry.from === "kid"));
  assert.equal(state.characters.find(entry => entry.id === victim.id).hand.length, before - 1);
});

test("stale, foreign and repeated actions leave the boat untouched", () => {
  const initial = createGame(roster(4), "beef");
  const snapshot = structuredClone(initial);
  for (const [actor, action] of [
    ["outsider", { type: "take", card: initial.offer[0] }],
    ["p0", { type: "take", card: "missing" }],
    ["p0", { type: "nothing" }],
    ["p0", { type: "rematch" }],
    ["p0", null],
  ]) {
    const result = action ? send(initial, actor, action) : applyAction(initial, actor, action);
    assert.equal(result.accepted, false);
    assert.deepEqual(initial, snapshot);
  }
});

test("private hands and eligibility stay hidden, including historical room logs", () => {
  const state = createGame(roster(4), "beef");
  const [owner, other] = state.characters;
  state.log = [
    { type: "take", id: owner.id, card: owner.hand[0] },
    { type: "mug", from: owner.id, to: other.id, card: other.hand[0] },
  ];
  state.phase = "thirst";
  state.queue = [owner.id, other.id];
  const observer = projectGame(state, "observer");
  assert.equal(observer.characters[0].hand, false);
  assert.deepEqual(observer.queue, []);
  assert.deepEqual(projectGame(state, owner.player).queue, [owner.id]);
  assert.deepEqual(observer.log, [
    { type: "take", id: owner.id },
    { type: "mug", from: owner.id, to: other.id },
  ]);
});

test("off-turn gifts preserve the turn, and a pending mugging keeps its target card", () => {
  const state = createGame(roster(4), "beef");
  const [active, giver] = state.characters;
  const card = giver.hand[0];
  const gift = { type: "give", card, target: active.id };
  assert.equal(send(state, giver.player, gift).accepted, false);

  state.phase = "action";
  state.queue = [active.id, giver.id];
  const view = projectGame(state, giver.player);
  assert.equal(view.canAct, false);
  assert.equal(view.canTrade, true);
  const given = send(state, giver.player, gift).state;
  assert(given.characters[0].hand.includes(card));
  assert(!given.characters[1].hand.includes(card));
  assert.deepEqual(given.queue, state.queue);

  state.phase = "answer";
  state.demand = { kind: "mug", from: active.id, to: giver.id, card: false };
  state.queue = [giver.id];
  state.savedQueue = [giver.id];
  assert.equal(send(state, giver.player, gift).accepted, false);
  assert.equal(send(state, giver.player, { type: "answer", accept: true }).accepted, true);
  state.phase = "fight";
  assert.equal(send(state, giver.player, gift).accepted, false);
});

test("water can be used on oneself and rejected drafts do not consume water", () => {
  const state = createGame(roster(4), "beef");
  const [owner] = state.characters;
  owner.hand = ["water-1"];
  state.phase = "thirst";
  state.queue = [owner.id];
  state.thirst = [{ id: owner.id, left: 2 }];
  const use = { card: "water-1", for: owner.id };
  assert.equal(send(state, owner.player, { type: "drink", uses: [use, use] }).accepted, false);
  assert.deepEqual(owner.hand, ["water-1"]);
  assert.equal(state.thirst[0].left, 2);
  const next = send(state, owner.player, { type: "drink", uses: [use] }).state;
  assert.equal(next.characters[0].wounds, 1);
  assert(!next.characters[0].hand.includes("water-1"));
});

function luaLiteral(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return "{" + value.map(luaLiteral).join(",") + "}";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value).map(([key, entry]) => `[${luaLiteral(key)}]=${luaLiteral(entry)}`).join(",") + "}";
  }
  return String(value);
}

function align(actual, expected) {
  if (Array.isArray(expected)) {
    let list = actual;
    if (!Array.isArray(list)) {
      if (!list || typeof list !== "object") list = [];
      else {
        const keys = Object.keys(list);
        list = keys.every(key => /^\d+$/.test(key))
          ? keys.sort((a, b) => Number(a) - Number(b)).map(key => list[key])
          : [];
      }
    }
    return list.map((item, index) => align(item, expected[index] ?? expected[0] ?? null));
  }
  if (expected && typeof expected === "object") {
    return Object.fromEntries(Object.keys(expected).map(key => [key, align(actual?.[key], expected[key])]));
  }
  return actual;
}

test("Lua and JS play the same voyage", async () => {
  const lua = await new LuaFactory().createEngine();
  const exec = async source => {
    const top = lua.global.getTop();
    try { return await lua.doString(source); }
    finally { lua.global.setTop(top); }
  };
  try {
    await exec(await readFile(new URL("../public/lifeboat/game.lua", import.meta.url), "utf8"));
    for (const count of [4, 5, 6]) {
      const players = roster(count);
      let state = createGame(players, "beef");
      const remote = await exec(`state=setup({players=${luaLiteral(players)},match={randomSeed="beef"}}).state; return state`);
      assert.deepEqual(align(remote, state), state);
      const initialView = await exec(`return view(state,{},{viewer={id="${actingPlayer(state)}"}}).state`);
      assert.deepEqual(normalizeRoomView(initialView), projectGame(state, actingPlayer(state)));
      let guard = 0;
      while (state.phase !== "ended" && guard < 500) {
        guard += 1;
        const actor = actingPlayer(state);
        let intent;
        if (state.phase === "deal") intent = { type: "take", card: state.offer[0] };
        else if (state.phase === "action") intent = { type: "nothing" };
        else if (state.phase === "navigate") intent = { type: "play", card: state.rowChoices[0] };
        else if (state.phase === "rescue") intent = { type: "rescue" };
        else if (state.phase === "thirst") intent = { type: "drink", uses: [] };
        else break;
        const action = { step: state.step, ...intent };
        const expected = applyAction(state, actor, action);
        const actual = await exec(`local result=on_action(state,${luaLiteral(action)},{actor={id=${JSON.stringify(actor)}}}); if result.accepted then state=result.state end; return result`);
        assert.deepEqual(align(actual, expected), expected, `${count} ${state.phase} ${state.day}`);
        assert.equal(expected.accepted, true);
        state = expected.state;
        const view = await exec(`return view(state,{},{viewer={id="spectator"}}).state`);
        assert.deepEqual(normalizeRoomView(view), projectGame(state, "spectator"));
      }
      assert.equal(state.phase, "ended");
      const rematch = send(state, "p0", { type: "rematch" });
      const remoteRematch = await exec(`local result=on_action(state,{type="rematch",step=${state.step}},{actor={id="p0"}}); if result.accepted then state=result.state end; return result`);
      assert.deepEqual(align(remoteRematch, rematch), rematch);
    }

    const snapshot = createGame(roster(4), "beef");
    const [active, giver] = snapshot.characters;
    snapshot.phase = "action";
    snapshot.queue = [active.id, giver.id];
    snapshot.log = [
      { type: "take", id: giver.id, card: giver.hand[0] },
      { type: "mug", from: giver.id, to: active.id, card: active.hand[0] },
    ];
    const action = { step: snapshot.step, type: "give", card: giver.hand[0], target: active.id };
    const expected = applyAction(snapshot, giver.player, action);
    await exec(`state=${luaLiteral(snapshot)}`);
    const initialView = await exec('return view(state,{},{viewer={id="spectator"}}).state');
    assert.deepEqual(normalizeRoomView(initialView), projectGame(snapshot, "spectator"));
    const result = await exec(`return on_action(state,${luaLiteral(action)},{actor={id=${luaLiteral(giver.player)}}})`);
    assert.deepEqual(align(result, expected), expected);
  } finally {
    lua.global.close();
  }
});

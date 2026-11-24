import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LuaFactory } from "wasmoon";
import { NAVIGATION, PROVISIONS } from "../src/games/lifeboat/data.js";
import { actingPlayer, applyAction, createGame, projectGame } from "../src/games/lifeboat/engine.js";
import { characterName, errorMessage, t } from "../src/games/lifeboat/i18n.js";
import en from "../src/games/lifeboat/locales/en.js";
import zhCN from "../src/games/lifeboat/locales/zh-CN.js";
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

test("the UI translates engine errors and preserves legacy room messages", () => {
  const state = createGame(roster(4), "beef");
  const result = send(state, actingPlayer(state), { type: "take", card: "missing" });
  assert.equal(result.error.code, "PROVISION_NOT_OFFERED");
  assert.equal(errorMessage(result.error), "这张牌不在待分配的物资里");
  assert.equal(errorMessage({ code: "INVALID_ACTION", message: "旧房间的提示" }), "旧房间的提示");
  assert.equal(errorMessage(), "操作失败");
  assert.throws(() => createGame(roster(3), "beef"), error => errorMessage(error) === "需要 4–6 名玩家");
  assert.equal(characterName("lauren"), "劳伦女士");
  assert.equal(characterName("lauren", { short: true }), "劳伦");
  assert.equal(characterName("mate", { short: true }), "大副");
  assert.equal(t("provisions.treasureEffect", { owner: "劳伦女士", value: 3 }), "靠岸时，这张牌值 3 分。劳伦女士持有时翻倍。");
});

test("English and Chinese Lifeboat messages have matching keys and placeholders", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zhCN).sort());
  const placeholders = message => [...message.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(zhCN)) {
    assert.deepEqual(placeholders(en[key]), placeholders(zhCN[key]), key);
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
      const invalidAction = { step: state.step, type: "take", card: "missing" };
      const actor = actingPlayer(state);
      const rejection = await exec(`return on_action(state,${luaLiteral(invalidAction)},{actor={id=${luaLiteral(actor)}}})`);
      assert.deepEqual(rejection, applyAction(state, actor, invalidAction));
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

test("reviewed rules behave the same in local and room games", async t => {
  const lua = await new LuaFactory().createEngine();
  const exec = async source => {
    const top = lua.global.getTop();
    try { return await lua.doString(source); }
    finally { lua.global.setTop(top); }
  };
  const cast = ["lauren", "captain", "mate", "kid"];
  const seat = (state, id) => state.characters.find(entry => entry.id === id);
  const fightResults = state => state.log.filter(entry => entry.type === "fight");

  function tableau({ hand = {}, shown = {}, queue = ["lauren"], nav = [], adjust = () => {} } = {}) {
    const state = createGame(roster(4), "beef", { cast });
    for (const entry of state.characters) {
      entry.hand = hand[entry.id] ?? [];
      entry.shown = shown[entry.id] ?? [];
    }
    const held = state.characters.flatMap(entry => [...entry.hand, ...entry.shown]);
    state.supplyDeck = PROVISIONS.map(card => card.id).filter(id => !held.includes(id));
    state.navDeck = [...nav, ...state.navDeck.filter(id => !nav.includes(id))];
    Object.assign(state, { phase: "action", queue, offer: [] });
    adjust(state);
    return state;
  }

  async function replay(initial) {
    let state = initial;
    await exec(`state=${luaLiteral(state)}`);
    async function act(action, id = state.queue[0], accepted = true) {
      const actor = seat(state, id).player;
      const input = { ...action, step: state.step };
      const expected = applyAction(state, actor, input);
      const actual = await exec(`local r=on_action(state,${luaLiteral(input)},{actor={id=${luaLiteral(actor)}}}); if r.accepted then state=r.state end; return r`);
      assert.deepEqual(align(actual, expected), expected);
      assert.equal(expected.accepted, accepted, expected.error?.message);
      if (expected.accepted) state = expected.state;
      return state;
    }
    async function declineFightChoices() {
      for (let guard = 0; state.phase === "fight"; guard++) {
        assert(guard < cast.length);
        await act(state.fight.stage === "arm" ? { type: "arm", card: false } : { type: "join", side: "out" });
      }
      return state;
    }
    return { act, declineFightChoices };
  }

  try {
    await exec(await readFile(new URL("../public/lifeboat/game.lua", import.meta.url), "utf8"));

    await t.test("two weapons can swing one fight, and a passer can still join after a weapon", async () => {
      const { act, declineFightChoices } = await replay(tableau({
        hand: { lauren: ["knife-1", "oar-1"] }, queue: ["lauren", "mate"],
      }));
      await act({ type: "move", target: "captain" });
      const armed = await act({ type: "answer", accept: false });
      assert.deepEqual(armed.queue, ["lauren"]);
      assert.deepEqual(projectGame(armed, seat(armed, "mate").player).queue, []);
      const spectator = await exec('return view(state,{},{viewer={id="spectator"}}).state');
      assert.deepEqual(normalizeRoomView(spectator), projectGame(armed, "spectator"));
      const knife = await act({ type: "arm", card: "knife-1" });
      assert.deepEqual(knife.log.at(-1), { type: "fightArm", id: "lauren", weapon: "knife" });
      await act({ type: "join", side: "out" }, "mate");
      await act({ type: "join", side: "out" }, "kid");
      const continued = await act({ type: "reveal", card: "oar-1" }, "lauren");
      assert.equal(continued.phase, "fight");
      assert.equal(continued.queue[0], "mate");
      assert.deepEqual(continued.log.at(-1), { type: "fightArm", id: "lauren", weapon: "oar" });
      const publicView = await exec('return view(state,{},{viewer={id="spectator"}}).state');
      assert.deepEqual(normalizeRoomView(publicView), projectGame(continued, "spectator"));
      const settled = await declineFightChoices();
      assert.deepEqual(fightResults(settled)[0], {
        type: "fight", attacker: "lauren", defender: "captain", attackersWin: true,
        attackers: ["lauren"], defenders: ["captain"], attack: 8, defense: 7,
        flareBy: false, losers: ["captain"],
      });
      assert.deepEqual(seat(settled, "lauren").shown, ["knife-1", "oar-1"]);
      assert.equal(seat(settled, "captain").wounds, 1);

      const late = await replay(tableau({ hand: { lauren: ["knife-1"] }, queue: ["lauren", "mate"] }));
      await late.act({ type: "move", target: "captain" });
      await late.act({ type: "answer", accept: false });
      await late.act({ type: "arm", card: false });
      await late.act({ type: "join", side: "out" }, "mate");
      await late.act({ type: "join", side: "attack" }, "kid");
      const beforeJoin = await late.act({ type: "arm", card: "knife-1" }, "lauren");
      const joined = await late.act({ type: "join", side: "defend" }, "mate");
      assert.deepEqual(joined.log.slice(beforeJoin.log.length, beforeJoin.log.length + 2), [
        { type: "fightJoin", id: "mate", side: "defend" }, fightResults(joined)[0],
      ]);
      assert.equal(fightResults(joined)[0].attackersWin, false);
      assert.deepEqual(fightResults(joined)[0].defenders, ["captain", "mate"]);
      assert.equal(fightResults(joined)[0].defense, 15);
      assert.deepEqual(fightResults(joined)[0].losers, ["lauren", "kid"]);
    });

    await t.test("a displayed flare gives no bonus until fired and cannot affect a later fight", async () => {
      const { act, declineFightChoices } = await replay(tableau({
        shown: { lauren: ["flare-1"] }, queue: ["lauren", "mate", "kid"],
      }));
      await act({ type: "move", target: "captain" });
      await act({ type: "answer", accept: false });
      const fired = await act({ type: "arm", card: "flare-1" });
      assert.deepEqual(seat(fired, "lauren").shown, []);
      assert.equal(projectGame(fired, "spectator").fight.flareBy, "lauren");
      const settled = await declineFightChoices();
      assert.equal(fightResults(settled)[0].attackersWin, true);

      await act({ type: "move", target: "lauren" });
      await act({ type: "answer", accept: false });
      assert.equal(fightResults(await declineFightChoices())[1].attackersWin, true);

      const unfired = await replay(tableau({ shown: { lauren: ["flare-1"] }, queue: ["lauren", "mate"] }));
      await unfired.act({ type: "move", target: "captain" });
      await unfired.act({ type: "answer", accept: false });
      const lost = await unfired.declineFightChoices();
      assert.equal(fightResults(lost)[0].attackersWin, false);
      assert.deepEqual(seat(lost, "lauren").shown, ["flare-1"]);
    });

    await t.test("off-turn reveal costs no action and a closed parasol can be passed and opened later", async () => {
      const { act } = await replay(tableau({
        hand: { captain: ["parasol-1"], mate: ["knife-1"] }, queue: ["lauren", "captain", "mate"],
        adjust: state => { seat(state, "mate").wounds = 8; },
      }));
      const revealed = await act({ type: "reveal", card: "parasol-1" }, "captain");
      assert.deepEqual(revealed.queue, ["lauren", "captain", "mate"]);
      assert.deepEqual(seat(revealed, "captain").shown, ["parasol-1"]);
      assert.equal(seat(revealed, "captain").parasol, false);
      await act({ type: "reveal", card: "knife-1" }, "mate", false);
      const passed = await act({ type: "give", card: "parasol-1", target: "lauren" }, "captain");
      assert.equal(seat(passed, "lauren").parasol, false);
      const opened = await act({ type: "parasol" });
      assert.equal(seat(opened, "lauren").parasol, true);
      assert.deepEqual(opened.queue, ["captain", "mate"]);
      const given = await act({ type: "give", card: "parasol-1", target: "captain" }, "lauren");
      assert.equal(seat(given, "lauren").parasol, false);
      assert.equal(seat(given, "captain").parasol, true);
    });

    await t.test("showing the last dark card during an ordinary mugging does not erase the demand", async () => {
      const { act } = await replay(tableau({
        hand: { captain: ["knife-1"] }, queue: ["lauren", "mate"],
      }));
      await act({ type: "mug", target: "captain" });
      const shown = await act({ type: "reveal", card: "knife-1" }, "captain");
      assert.equal(shown.demand.card, "knife-1");
      const accepted = await act({ type: "answer", accept: true });
      assert.deepEqual(seat(accepted, "lauren").hand, ["knife-1"]);
      assert.deepEqual(seat(accepted, "captain").shown, []);
    });

    await t.test("an unconscious character needs a previously displayed preserver", async () => {
      for (const display of ["hand", "shown"]) {
        const { act } = await replay(tableau({
          [display]: { mate: ["preserver-1"] }, nav: ["nav-4"],
          adjust: state => { seat(state, "mate").wounds = 8; },
        }));
        const settled = await act({ type: "nothing" });
        assert.equal(seat(settled, "mate").removed, display === "hand");
      }
    });

    await t.test("parasol protection ends when mugged and spent oars are lost overboard", async () => {
      const mug = await replay(tableau({
        shown: { captain: ["parasol-1"] }, nav: ["nav-8"],
        adjust: state => { seat(state, "captain").parasol = true; },
      }));
      await mug.act({ type: "mug", target: "captain", card: "parasol-1" });
      const mugged = await mug.act({ type: "answer", accept: true });
      assert.equal(seat(mugged, "captain").parasol, false);
      assert.equal(seat(mugged, "captain").wounds, 1);
      assert(seat(mugged, "lauren").hand.includes("parasol-1"));

      const row = await replay(tableau({ hand: { lauren: ["oar-1"] }, nav: ["nav-22"] }));
      const drawing = await row.act({ type: "row" });
      assert.equal(drawing.rowChoices.length, 3);
      assert.deepEqual(seat(drawing, "lauren").shown, ["oar-1"]);
      const overboard = await row.act({ type: "sort", keep: [true, false, false] });
      assert(!seat(overboard, "lauren").shown.includes("oar-1"));
      assert(!seat(overboard, "lauren").hand.includes("oar-1"));
    });

    await t.test("a self-hating character scores for other deaths but excludes the beloved", async () => {
      const { act } = await replay(tableau({
        nav: ["nav-12"],
        adjust: state => {
          state.birds = 3;
          Object.assign(seat(state, "kid"), { hate: "kid", love: "captain" });
          seat(state, "captain").wounds = 8;
          seat(state, "mate").wounds = 9;
        },
      }));
      const ended = await act({ type: "nothing" });
      const { survival, love, hate } = ended.scores.find(score => score.player === seat(ended, "kid").player);
      assert.deepEqual({ survival, love, hate }, { survival: 0, love: 0, hate: 8 });
    });
  } finally {
    lua.global.close();
  }
});

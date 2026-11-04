import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LuaFactory } from "wasmoon";
import { CARDS, COLORS, NOBLES, TOKEN_COLORS, applyAction, costAfterBonuses, createGame, eligibleNobles, paymentFor, projectGame, tokenCount } from "../src/games/splendor/engine.js";

const players = count => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家 ${i + 1}` }));
const act = (state, action, actor = state.players[state.turn].id) => applyAction(state, actor, { ...action, step: state.step, round: state.round });
const zero = () => Object.fromEntries(TOKEN_COLORS.map(c => [c, 0]));
const free = board => { for (const c of COLORS) board.bonuses[c] = 10; };

function conservation(state) {
  for (const color of TOKEN_COLORS) {
    const expected = color === "gold" ? 5 : { 2: 4, 3: 5, 4: 7 }[state.players.length];
    assert.equal(state.bank[color] + state.players.reduce((n, p) => n + state.boards[p.id].tokens[color], 0), expected);
    assert(state.bank[color] >= 0);
  }
  const allCards = [...state.decks.flat(), ...state.market.flat()];
  const allNobles = [...state.nobles];
  for (const board of Object.values(state.boards)) {
    allCards.push(...board.purchased, ...board.reserved); allNobles.push(...board.nobles);
    assert(board.reserved.length <= 3);
    assert(TOKEN_COLORS.every(c => Number.isInteger(board.tokens[c]) && board.tokens[c] >= 0));
    if (state.phase !== "return_tokens") assert(tokenCount(board.tokens) <= 10);
    for (const color of COLORS) assert.equal(board.bonuses[color], board.purchased.filter(c => c.bonus === color).length);
    assert.equal(board.score, [...board.purchased, ...board.nobles].reduce((n, item) => n + item.points, 0));
  }
  assert.equal(allCards.length, 90); assert.equal(new Set(allCards.map(c => c.id)).size, 90);
  assert.equal(allNobles.length, state.players.length + 1); assert.equal(new Set(allNobles.map(n => n.id)).size, allNobles.length);
}

test("base inventory, player-dependent supplies and deterministic setup", () => {
  assert.equal(CARDS.length, 90); assert.equal(new Set(CARDS.map(c => c.id)).size, 90); assert.equal(NOBLES.length, 10);
  for (const [level, count] of [[1, 40], [2, 30], [3, 20]]) for (const color of COLORS)
    assert.equal(CARDS.filter(c => c.level === level && c.bonus === color).length, count / 5);
  // Physical base-card regression: these are often transcribed with the wrong color/cost.
  assert.deepEqual(CARDS.find(c => c.id === "white-L1-03").cost, { white: 0, blue: 0, green: 0, red: 2, black: 1 });
  assert.deepEqual(CARDS.find(c => c.id === "blue-L3-03").cost, { white: 3, blue: 0, green: 3, red: 3, black: 5 });
  assert.equal(CARDS.find(c => c.id === "green-L1-08").cost.black, 2);
  for (const count of [2, 3, 4]) {
    const state = createGame(players(count), "abcdef1234");
    assert.deepEqual(state, createGame(players(count), "abcdef1234"));
    assert.deepEqual(state.decks.map(d => d.length), [36, 26, 16]);
    assert.equal(state.nobles.length, count + 1); assert(state.market.every(r => r.length === 4));
    conservation(state);
  }
  for (const roster of [players(1), players(5), [{ id: "p" }, { id: "p" }], [{ id: "" }, { id: "p" }]]) assert.throws(() => createGame(roster));
});

test("three distinct gems and two same require the exact pre-draw supply", () => {
  const state = createGame(players(2), "123");
  assert(act(state, { type: "take", colors: ["white", "blue", "green"] }).accepted);
  assert.deepEqual(state.boards.p0.tokens, { white: 1, blue: 1, green: 1, red: 0, black: 0, gold: 0 });
  assert.equal(act(state, { type: "take", colors: ["white", "white"] }).accepted, false);
  assert(act(state, { type: "take", colors: ["red", "red"] }).accepted);
  assert.equal(state.bank.red, 2); assert.equal(state.turn, 0); assert.equal(state.round, 2); conservation(state);
  const scarce = createGame(players(2), "123");
  scarce.bank = { white: 0, blue: 2, green: 0, red: 1, black: 0, gold: 5 };
  assert.equal(act(scarce, { type: "take", colors: ["blue"] }).accepted, false);
  assert(act(scarce, { type: "take", colors: ["blue", "red"] }).accepted);
});

test("reserve refills the same slot, blind draws remain secret and gold is optional", () => {
  const state = createGame(players(2), "abcd"), card = state.market[0][1], replacement = state.decks[0].at(-1);
  assert(act(state, { type: "reserve", cardId: card.id }).accepted);
  assert.equal(state.boards.p0.reserved[0].id, card.id); assert.equal(state.market[0][1].id, replacement.id);
  const blind = state.decks[2].at(-1);
  assert(act(state, { type: "reserve", blind: true, level: 3 }).accepted);
  assert.equal(state.boards.p1.reserved[0].id, blind.id); assert.equal(state.boards.p1.tokens.gold, 1);
  for (const viewer of ["p0", "spectator"]) {
    const projected = projectGame(state, viewer);
    assert.deepEqual(projected.boards.p1.reserved, [{ hidden: true, level: 3 }]);
    for (const key of ["decks", "seed", "turn"]) assert(!Object.hasOwn(projected, key));
    assert(!JSON.stringify(projected).includes(blind.id));
  }
  assert.equal(projectGame(state, "p1").boards.p1.reserved[0].id, blind.id);
  for (let i = 0; i < 4; i++) assert(act(state, { type: "reserve", blind: true, level: 1 }).accepted);
  assert.equal(state.bank.gold, 0); assert.equal(state.boards.p1.reserved.length, 3);
  assert.equal(act(state, { type: "reserve", blind: true, level: 2 }).accepted, false);
  conservation(state);
});

test("discounts persist, payment can voluntarily use gold, reserved cards can be bought", () => {
  const state = createGame(players(2), "abcd"), board = state.boards.p0;
  const card = structuredClone(CARDS.find(c => c.id === "white-L1-03"));
  state.market[0][0] = card; state.nobles = [];
  board.bonuses.red = 1; board.tokens.red = 1; board.tokens.black = 1; board.tokens.gold = 1;
  assert.deepEqual(costAfterBonuses(board, card), { white: 0, blue: 0, green: 0, red: 1, black: 1 });
  assert.deepEqual(paymentFor(board, card), { white: 0, blue: 0, green: 0, red: 1, black: 1, gold: 0 });
  assert(act(state, { type: "buy", cardId: card.id, payment: { red: 0, black: 1, gold: 1 } }).accepted);
  assert.equal(board.tokens.red, 1); assert.equal(board.tokens.gold, 0); assert.equal(board.bonuses.red, 1); assert.equal(board.bonuses.white, 1);
  assert.equal(board.purchased[0].id, card.id);
  state.turn = 0; board.reserved.push(state.decks[0].pop()); free(board);
  const held = board.reserved[0];
  assert(act(state, { type: "buy", cardId: held.id }).accepted);
  assert.equal(board.reserved.length, 0); assert.equal(board.purchased.at(-1).id, held.id);
});

test("ten-token cap pauses the turn, allows returning just-taken gems or gold and blocks other actions", () => {
  const state = createGame(players(2), "abcd"), board = state.boards.p0;
  Object.assign(board.tokens, { white: 2, blue: 2, green: 2, black: 2, gold: 1 });
  assert(act(state, { type: "take", colors: ["white", "blue", "red"] }).accepted);
  assert.equal(state.phase, "return_tokens"); assert.equal(state.turn, 0); assert.equal(tokenCount(board.tokens), 12);
  assert.equal(act(state, { type: "return_tokens", tokens: { white: 1 } }).accepted, false);
  assert.equal(act(state, { type: "take", colors: ["red", "red"] }).accepted, false);
  assert(act(state, { type: "return_tokens", tokens: { red: 1, gold: 1 } }).accepted);
  assert.equal(tokenCount(board.tokens), 10); assert.equal(state.turn, 1); assert.equal(state.phase, "playing");
  assert.equal(state.history.length, 1); assert.equal(state.history[0].returned.gold, 1);
  const reserved = createGame(players(2), "abcd");
  Object.assign(reserved.boards.p0.tokens, { white: 3, blue: 3, green: 4 });
  assert(act(reserved, { type: "reserve", blind: true, level: 2 }).accepted);
  assert.equal(reserved.phase, "return_tokens");
  assert(act(reserved, { type: "return_tokens", tokens: { gold: 1 } }).accepted);
  assert.equal(reserved.boards.p0.reserved.length, 1);
});

test("nobles are mandatory, count discounts only, choose at most one after every action", () => {
  const state = createGame(players(2), "abcd"), board = state.boards.p0;
  state.nobles = structuredClone([NOBLES[0], NOBLES[1]]);
  board.tokens.white = board.tokens.blue = 4;
  assert.equal(eligibleNobles(state, "p0").length, 0);
  board.tokens = zero(); board.bonuses.white = board.bonuses.blue = board.bonuses.green = 4;
  assert(act(state, { type: "take", colors: ["red", "black", "green"] }).accepted);
  assert.equal(state.phase, "choose_noble"); assert.equal(state.turn, 0);
  assert.equal(act(state, { type: "choose_noble", nobleId: "bogus" }).accepted, false);
  assert(act(state, { type: "choose_noble", nobleId: NOBLES[1].id }).accepted);
  assert.equal(board.nobles.length, 1); assert.equal(board.score, 3); assert.equal(state.nobles.length, 1); assert.equal(state.turn, 1);
  state.turn = 0;
  assert(act(state, { type: "reserve", blind: true, level: 1 }).accepted);
  assert.equal(board.nobles.length, 2); assert.equal(board.score, 6); assert.equal(state.phase, "playing");
});

test("15 points ends the current round, never grants an extra first-player turn, and resolves ties", () => {
  for (const count of [2, 3, 4]) {
    const state = createGame(players(count), "abcd"); state.nobles = [];
    const onePoint = structuredClone(CARDS.find(c => c.points === 1));
    state.market[0][0] = onePoint; free(state.boards.p0); state.boards.p0.score = 14;
    assert(act(state, { type: "buy", cardId: onePoint.id }).accepted);
    assert.equal(state.endingRound, 1); assert.equal(state.phase, "playing");
    for (let i = 1; i < count; i++) assert(act(state, { type: "reserve", blind: true, level: 1 }).accepted);
    assert.equal(state.phase, "ended"); assert.equal(state.round, 1); assert.deepEqual(state.winners, ["p0"]);
    const oldStep = state.step;
    assert(act(state, { type: "rematch" }, "p1").accepted);
    assert.equal(state.players[0].id, "p1"); assert.equal(state.step, oldStep + 1); conservation(state);
  }
  for (const shared of [false, true]) {
    const state = createGame(players(2), "abcd"); state.nobles = []; state.turn = 1;
    state.boards.p0.score = state.boards.p1.score = 15;
    if (!shared) state.boards.p0.purchased.push(CARDS[0]);
    assert(act(state, { type: "take", colors: ["white", "blue", "red"] }).accepted);
    assert.equal(state.phase, "ended"); assert.deepEqual(state.winners, shared ? ["p0", "p1"] : ["p1"]);
  }
});

test("a noble may trigger 15 points only after its choice and the token return finish", () => {
  const state = createGame(players(2), "abcd"), b = state.boards.p0;
  free(b); b.score = 12; Object.assign(b.tokens, { white: 4, blue: 3, green: 3 });
  assert(act(state, { type: "reserve", blind: true, level: 1 }).accepted);
  assert.equal(state.phase, "return_tokens"); assert.equal(state.endingRound, null);
  assert(act(state, { type: "return_tokens", tokens: { gold: 1 } }).accepted);
  assert.equal(state.phase, "choose_noble"); assert.equal(state.endingRound, null);
  assert(act(state, { type: "choose_noble", nobleId: state.nobles[0].id }).accepted);
  assert.equal(state.endingRound, 1); assert.equal(b.score, 15); assert.equal(state.turn, 1);
});

function luaLiteral(value) {
  if (value == null) return "nil";
  if (typeof value === "string") return '"' + [...Buffer.from(value)].map(b => b >= 32 && b <= 126 && b !== 34 && b !== 92 ? String.fromCharCode(b) : "\\" + String(b).padStart(3, "0")).join("") + '"';
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return "{" + value.map(luaLiteral).join(",") + "}";
  return "{" + Object.entries(value).map(([k, v]) => `[${luaLiteral(k)}]=${luaLiteral(v)}`).join(",") + "}";
}
function compatible(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.length ? value.map(compatible) : {};
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null).map(([k, v]) => [k, compatible(v)]));
  return value;
}
async function openLua() {
  const lua = await new LuaFactory().createEngine();
  const execute = lua.doString.bind(lua);
  lua.doString = async source => { const top = lua.global.getTop(); try { return await execute(source); } finally { lua.global.setTop(top); } };
  await lua.doString(await readFile(new URL("../public/splendor/game.lua", import.meta.url), "utf8"));
  await lua.doString(`function budget(call)
    local fuel=0
    debug.sethook(function() fuel=fuel+1000; assert(fuel<=50000,'instruction quota exceeded') end,'',1000)
    local result=call(); debug.sethook(); return result
  end`);
  return lua;
}

function invalidCases(state) {
  const valid = { type: "take", colors: ["white", "blue", "red"], step: state.step, round: state.round };
  return [
    ["spectator", valid], ["p1", valid], ["p0", null], ["p0", []], ["p0", { ...valid, type: "wat" }],
    ["p0", { ...valid, step: -1 }], ["p0", { ...valid, round: 2 }], ["p0", { ...valid, colors: ["gold"] }],
    ["p0", { ...valid, colors: ["red", "red", "red"] }], ["p0", { ...valid, colors: ["blue"] }],
    ["p0", { ...valid, colors: { 0: "white" } }], ["p0", { ...valid, colors: ["blue", "blue", "green"] }],
    ["p0", { ...valid, type: "reserve", blind: true, level: "1" }], ["p0", { ...valid, type: "reserve", blind: true, level: 4 }],
    ["p0", { ...valid, type: "reserve", cardId: state.decks[0][0].id }],
    ["p0", { ...valid, type: "buy", cardId: state.market[0][0].id, payment: {} }],
    ["p0", { ...valid, type: "buy", cardId: state.market[0][0].id, payment: { gold: -1 } }],
    ["p0", { ...valid, type: "buy", cardId: state.market[0][0].id, payment: { white: "3" } }],
    ["p0", { ...valid, type: "buy", cardId: state.market[0][0].id, payment: { purple: 5 } }],
    ["p0", { ...valid, type: "return_tokens", tokens: {} }], ["p0", { ...valid, type: "choose_noble", nobleId: state.nobles[0].id }],
    ["p0", { ...valid, type: "rematch" }],
  ];
}

test("both runtimes reject forged, stale, out-of-turn and spectator actions without mutation", async () => {
  const lua = await openLua();
  try {
    const state = createGame(players(2), "abcd");
    for (const [actor, action] of invalidCases(state)) {
      const before = structuredClone(state), result = applyAction(state, actor, action);
      assert.equal(result.accepted, false); assert.deepEqual(state, before);
      const remote = await lua.doString(`state=${luaLiteral(before)}; return budget(function() return on_action(state,${luaLiteral(action)},{actor={id=${luaLiteral(actor)}}}) end)`);
      assert.equal(remote.accepted, false); assert.equal(remote.error.code, result.error.code);
      assert.deepEqual(await lua.doString("return state"), compatible(before));
    }
  } finally { lua.global.close(); }
});

test("Lua matches gold substitution, exhausted decks, pending noble choices and final-round ties", async () => {
  const lua = await openLua();
  async function check(state, intent) {
    const before = structuredClone(state), actor = state.players[state.turn].id;
    const action = { ...intent, round: state.round, step: state.step };
    const expected = applyAction(state, actor, action);
    const actual = await lua.doString(`state=${luaLiteral(before)}; local result=budget(function() return on_action(state,${luaLiteral(action)},{actor={id='${actor}'}}) end); return result`);
    assert.deepEqual(actual, compatible(expected));
    return expected;
  }
  try {
    const payment = createGame(players(2), "abcd"), b = payment.boards.p0;
    const card = structuredClone(CARDS.find(c => c.id === "white-L1-03"));
    payment.nobles = []; payment.market[0][0] = card; payment.decks[0] = [];
    Object.assign(b.tokens, { red: 2, black: 1, gold: 2 });
    assert.equal((await check(payment, { type: "buy", cardId: card.id, payment: { red: 0, black: 1, gold: 2 } })).accepted, true);
    assert.equal(payment.market[0].length, 3);
    assert.equal((await check(payment, { type: "reserve", blind: true, level: 1 })).accepted, false);
    const pending = createGame(players(2), "abcd");
    free(pending.boards.p0); pending.boards.p0.score = 12;
    Object.assign(pending.boards.p0.tokens, { white: 4, blue: 3, green: 3 });
    assert((await check(pending, { type: "reserve", blind: true, level: 2 })).accepted);
    assert((await check(pending, { type: "return_tokens", tokens: { gold: 1 } })).accepted);
    assert.equal(pending.phase, "choose_noble");
    assert.equal((await check(pending, { type: "choose_noble", nobleId: "nope" })).accepted, false);
    assert((await check(pending, { type: "choose_noble", nobleId: pending.nobles[0].id })).accepted);
    assert.equal(pending.endingRound, 1);
    pending.boards.p1.score = 15;
    assert((await check(pending, { type: "take", colors: ["white", "blue", "red"] })).accepted);
    assert.equal(pending.phase, "ended"); assert.deepEqual(pending.winners, ["p0", "p1"]);
  } finally { lua.global.close(); }
});

// This small policy exercises complete games; it is not part of the shipped client.
function nextIntent(state) {
  const id = state.players[state.turn].id, b = state.boards[id];
  if (state.phase === "choose_noble") return { type: "choose_noble", nobleId: eligibleNobles(state, id)[0].id };
  const cards = [...b.reserved, ...state.market.flat()];
  const deficit = card => COLORS.reduce((sum, c) => sum + Math.max(0, card.cost[c] - b.bonuses[c] - b.tokens[c]), 0) - b.tokens.gold;
  cards.sort((a, c) => deficit(a) - deficit(c) || c.points - a.points || a.level - c.level);
  if (state.phase === "return_tokens") {
    const returned = zero(), remaining = { ...b.tokens }, due = costAfterBonuses(b, cards[0]);
    while (tokenCount(returned) < tokenCount(b.tokens) - 10) {
      const color = TOKEN_COLORS.filter(c => remaining[c] > 0).sort((a, c) =>
        (remaining[c] - (due[c] ?? 20)) - (remaining[a] - (due[a] ?? 20)))[0];
      returned[color]++; remaining[color]--;
    }
    return { type: "return_tokens", tokens: returned };
  }
  const affordable = cards.filter(c => paymentFor(b, c));
  if (affordable.length) {
    affordable.sort((a, c) => c.points - a.points || a.level - c.level);
    return { type: "buy", cardId: affordable[0].id };
  }
  const due = costAfterBonuses(b, cards[0]);
  const available = COLORS.filter(c => state.bank[c] > 0).sort((a, c) =>
    (due[c] - b.tokens[c]) - (due[a] - b.tokens[a]) || state.bank[c] - state.bank[a]);
  if (b.reserved.length < 3 && state.bank.gold > 0 && (state.step % 5 === 0 || !available.length))
    return { type: "reserve", cardId: state.market.flat().find(c => c.id === cards[0].id)?.id || state.market[0][0].id };
  if (state.bank[available[0]] >= 4 && due[available[0]] - b.tokens[available[0]] >= 2) return { type: "take", colors: [available[0], available[0]] };
  if (available.length) return { type: "take", colors: available.slice(0, 3) };
  return { type: "reserve", blind: true, level: 1 };
}

test("JS and Lua agree through complete 2–4 player games, private views, conservation, quota and rematches", async () => {
  const lua = await openLua();
  try {
    for (const count of [2, 3, 4]) for (const seed of ["abcd", "deadbeef", "abcdef0123456789"]) {
      const roster = players(count), state = createGame(roster, seed);
      const remote = await lua.doString(`state=budget(function() return setup({players=${luaLiteral(roster)},match={randomSeed='${seed}'}}).state end); return state`);
      assert.deepEqual(remote, compatible(state));
      for (let move = 0; state.phase !== "ended"; move++) {
        assert(move < 800, `game must terminate: ${count} players, ${seed}`);
        const actor = state.players[state.turn].id, action = { ...nextIntent(state), step: state.step, round: state.round };
        const expected = applyAction(state, actor, action); assert(expected.accepted, expected.error?.message);
        const actual = await lua.doString(`local result=budget(function() return on_action(state,${luaLiteral(action)},{actor={id='${actor}'}}) end); state=result.state; return result`);
        assert.deepEqual(actual, compatible(expected), `${count} players, ${seed}, move ${move}`); conservation(state);
        if (move % 11 === 0 || state.phase !== "playing") for (const viewer of [actor, "spectator"]) {
          const visible = await lua.doString(`return budget(function() return view(state,{},{viewer={id='${viewer}'}}).state end)`);
          assert.deepEqual(visible, compatible(projectGame(state, viewer)));
          assert.equal(projectGame(state, "spectator").canAct, false);
        }
      }
      const action = { type: "rematch", step: state.step, round: state.round };
      const expected = applyAction(state, "p0", action);
      const actual = await lua.doString(`local result=budget(function() return on_action(state,${luaLiteral(action)},{actor={id='p0'}}) end); state=result.state; return result`);
      assert.deepEqual(actual, compatible(expected)); conservation(state);
    }
    assert.equal(await lua.doString("return on_return_to_room({}, {})"), true);
  } finally { lua.global.close(); }
});

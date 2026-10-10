import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LuaFactory } from "wasmoon";
import {
  applyAction,
  applyTimer,
  compareHands,
  createGame,
  evaluateHand,
  evaluateFixedHand,
  PLAYER_COUNTS,
  projectGame,
  strongest,
  tableResults,
  WINDOW_TIMER_ID,
} from "../src/games/halli-holdem/engine.js";

const players = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `玩家 ${index + 1}`,
    seat: index + 1,
  }));
const cards = (text) =>
  text
    ? text.split(" ").map((token) => ({
        rank:
          { A: 14, K: 13, Q: 12, J: 11, T: 10 }[token.slice(0, -1)] ||
          Number(token.slice(0, -1)),
        suit: { s: "spades", h: "hearts", c: "clubs", d: "diamonds" }[
          token.at(-1)
        ],
      }))
    : [];
const act = (state, actorId, action) =>
  applyAction(state, actorId, {
    ...action,
    round: state.round,
    step: state.step,
  });

function finishBellWait(state) {
  while (["hidden", "revealed"].includes(state.window?.stage)) {
    applyTimer(
      state,
      {
        id: WINDOW_TIMER_ID,
        payload: {
          round: state.round,
          step: state.step,
          stage: state.window.stage,
        },
      },
      { firedAt: state.window.untilAt },
    );
  }
}

function refresh(state) {
  state.fixedResults = tableResults(state, state.fixed, true);
  state.fixedStrength = strongest(state.fixedResults);
  state.dynamicResults = tableResults(state, state.dynamic);
  state.dynamicStrength = strongest(state.dynamicResults);
  return state;
}

function fixture({
  fixed = "2s 4h 6c 8d Ts",
  dynamic = "",
  hands = ["Ks Kh", "Qs Qh", "Js Jh"],
  phase = "before_draw",
  candidates = [],
} = {}) {
  const state = createGame(players(hands.length), 1234);
  state.turn = 0;
  state.roundStarterId = "p0";
  state.fixed = cards(fixed);
  state.dynamic = cards(dynamic);
  state.hands = Object.fromEntries(
    hands.map((hand, index) => [`p${index}`, cards(hand)]),
  );
  state.phase = phase;
  state.candidates = candidates;
  return refresh(state);
}

// Independent oracle: every legal five-card subset must contain a hole card.
function constrainedFixedHand(holes, board) {
  const pool = [...holes, ...board];
  let best = [0];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) {
            if (a >= holes.length) continue;
            const hand = evaluateHand(
              [a, b, c, d, e].map((index) => pool[index]),
            );
            if (compareHands(hand, best) > 0) best = hand;
          }
  return best;
}

const suits = ["spades", "hearts", "clubs", "diamonds"];
const strongFixedBoards = [
  ...suits.flatMap((suit) =>
    Array.from({ length: 10 }, (_, index) =>
      Array.from({ length: 5 }, (_, offset) => ({
        rank: index + 5 - offset === 1 ? 14 : index + 5 - offset,
        suit,
      })),
    ),
  ),
  ...Array.from({ length: 13 }, (_, index) => index + 2).flatMap((rank) =>
    [rank === 14 ? 13 : 14, rank === 2 ? 3 : 2].map((kicker) => [
      ...suits.map((suit) => ({ rank, suit })),
      { rank: kicker, suit: "spades" },
    ]),
  ),
];

const handCases = [
  ["empty", "", [0]],
  ["two high cards", "As Kh", [0, 14, 13]],
  ["pair without kickers", "Ks Kh", [1, 13]],
  ["short pair with kicker", "Ks Kh Ac", [1, 13, 14]],
  ["four-card flush is high card", "As Ks 9s 3s", [0, 14, 13, 9, 3]],
  ["four-card run is high card", "2s 3h 4c 5d", [0, 5, 4, 3, 2]],
  ["short trips", "2s 2h 2c", [3, 2]],
  ["short two pair", "Ks Kh 2c 2d", [2, 13, 2]],
  ["short quads", "2s 2h 2c 2d", [7, 2]],
  ["royal straight flush", "As Ks Qs Js Ts 2h 3h", [8, 14]],
  ["wheel straight flush", "As 2s 3s 4s 5s Kh Qh", [8, 5]],
  ["wheel straight", "As 2h 3c 4d 5s", [4, 5]],
  ["ace does not wrap", "Ks Ah 2c 3d 4s", [0, 14, 13, 4, 3, 2]],
  ["higher straight beats wheel", "As 2h 3c 4d 5s 6h", [4, 6]],
  ["highest quads and kicker", "Ks Kh Kc Kd As Ah 2s", [7, 13, 14]],
  ["two trips make full house", "Qs Qh Qc Js Jh Jc As", [6, 12, 11]],
  ["highest full house pair", "8s 8h 8c Ks Kh Qs Qh", [6, 8, 13]],
  ["flush takes best five", "As Ks 9s 7s 4s 2s Qh", [5, 14, 13, 9, 7, 4]],
  [
    "straight can use more than seven cards",
    "2s 3h 4c 5d 6s 7h 8c 9d Ts Jh Qc Kd Ah",
    [4, 14],
  ],
  ["trips select kickers", "8s 8h 8c As Kh 4d 2s", [3, 8, 14, 13]],
  [
    "three pairs select two and a kicker",
    "Ks Kh Qs Qh Js Jh Ac",
    [2, 13, 12, 14],
  ],
  ["pair selects three kickers", "Ks Kh As Qd 9h 4d 2s", [1, 13, 14, 12, 9]],
];

test("hand evaluation covers every category, wheels, large boards and missing kickers", () => {
  for (const [name, text, expected] of handCases)
    assert.deepEqual(evaluateHand(cards(text)), expected, name);
  assert.equal(compareHands([1, 13, 14], [1, 13]), 1);
  assert.equal(compareHands([3, 2], [1, 14, 13, 12, 11]), 1);
  assert.equal(compareHands([2, 13, 9, 14], [2, 13, 8, 14]), 1);
  assert.equal(compareHands([6, 8, 14], [6, 9, 2]), -1);
  assert.equal(
    compareHands(
      evaluateHand(cards("As Ks 9s 7s 4s")),
      evaluateHand(cards("Ah Kh 9h 7h 4h")),
    ),
    0,
  );
});

test("large-hand selection agrees with exhaustive five-card selection", () => {
  function brute(hand) {
    let best = [0];
    for (let a = 0; a < hand.length - 4; a++)
      for (let b = a + 1; b < hand.length - 3; b++)
        for (let c = b + 1; c < hand.length - 2; c++)
          for (let d = c + 1; d < hand.length - 1; d++)
            for (let e = d + 1; e < hand.length; e++) {
              const result = evaluateHand([
                hand[a],
                hand[b],
                hand[c],
                hand[d],
                hand[e],
              ]);
              if (compareHands(result, best) > 0) best = result;
            }
    return best;
  }
  for (let seed = 1; seed <= 80; seed++) {
    const state = createGame(players(3), seed);
    const hand = [
      ...state.fixed,
      ...state.hands.p0,
      ...state.ordinaryDeck.slice(0, seed % 4),
    ];
    assert.deepEqual(evaluateHand(hand), brute(hand), `seed ${seed}`);
    assert.ok(
      compareHands(evaluateHand(hand), evaluateHand(hand.slice(0, 4))) >= 0,
    );
  }
});

test("fixed hands require a hole card, matching constrained five-card enumeration in JS and Lua", async () => {
  const examples = [
    ["As Ks Qs Js Ts", "2h 3d", [0, 14, 13, 12, 11, 3]],
    ["As Ks Qs Js Ts", "9s 2d", [8, 13]],
    ["As Ah Ac Ad Ks", "Qh 2c", [7, 14, 12]],
    ["As Ah Ac Ad Ks", "Kh 3c", [7, 14, 13]],
    ["Ah Ad Ac Ks Kh", "Qh 2c", [3, 14, 13, 12]],
    ["Ah Ad Ac Ks Kh", "Kd 2c", [6, 14, 13]],
    ["As Js 9s 7s 4s", "Kh 2d", [0, 14, 13, 11, 9, 7]],
    ["As Js 9s 7s 4s", "2s Kh", [5, 14, 11, 9, 7, 2]],
    ["2s 3h 4c 5d 6s", "Ah Kd", [4, 5]],
    ["2s 3h 4c 5d 6s", "7d Kh", [4, 7]],
    ["As Ah Kd Kc Qs", "Jd 2s", [2, 14, 13, 11]],
    ["As Ah Kd Qc Js", "9d 2s", [1, 14, 13, 12, 9]],
    ["As Kh Qc Jd 9s", "8h 2c", [0, 14, 13, 12, 11, 8]],
    ["2s 3h 4c 9d Ts", "5h 6d", [4, 6]],
  ].map(([board, holes, expected]) => ({
    board: cards(board),
    holes: cards(holes),
    expected,
  }));
  for (let seed = 1; seed <= 64; seed++) {
    const state = createGame(players(3), seed);
    for (const player of state.players) {
      const holes = state.hands[player.id];
      const expected = constrainedFixedHand(holes, state.fixed);
      assert.deepEqual(state.fixedResults[player.id], expected);
      examples.push({ holes, board: state.fixed, expected });
    }
  }
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const { holes, board, expected } of examples) {
      assert.deepEqual(evaluateFixedHand(holes, board), expected);
      assert.deepEqual(constrainedFixedHand(holes, board), expected);
      assert.deepEqual(
        await lua.doString(
          `return evaluate_fixed_hand(${luaLiteral(holes)},${luaLiteral(board)})`,
        ),
        expected,
      );
    }
  } finally {
    lua.global.close();
  }
});

test("quad and straight-flush fixed boards match all legal hole holdings in JS and Lua", async () => {
  const lua = await openLua();
  let checked = 0;
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const board of strongFixedBoards) {
      const pool = suits
        .flatMap((suit) =>
          Array.from({ length: 13 }, (_, index) => ({ rank: index + 2, suit })),
        )
        .filter(
          (card) =>
            !board.some(
              (fixed) => fixed.rank === card.rank && fixed.suit === card.suit,
            ),
        );
      const examples = [];
      const boardHand = evaluateHand(board);
      for (let a = 0; a < pool.length - 1; a++) {
        for (let b = a + 1; b < pool.length; b++) {
          const holes = [pool[a], pool[b]];
          const expected = constrainedFixedHand(holes, board);
          assert.deepEqual(
            evaluateFixedHand(holes, board, boardHand),
            expected,
          );
          examples.push({ holes, expected });
          checked++;
        }
      }
      // Batch across the bridge; exercise both standalone and shared-board evaluation.
      await lua.doString(`
        local board = ${luaLiteral(board)}
        local board_hand = evaluate_hand(board)
        for _, example in ipairs(${luaLiteral(examples)}) do
          assert(compare_hands(evaluate_fixed_hand(example.holes,board),example.expected)==0)
          assert(compare_hands(evaluate_fixed_hand(example.holes,board,board_hand),example.expected)==0)
        end
      `);
    }
    assert.equal(checked, 71346);
  } finally {
    lua.global.close();
  }
});

test("optimized fixed table results match constrained enumeration across seeded 8-player deals", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (let seed = 1; seed <= 1000; seed++) {
      const state = createGame(players(8), seed);
      for (const player of state.players) {
        assert.deepEqual(
          state.fixedResults[player.id],
          constrainedFixedHand(state.hands[player.id], state.fixed),
          `seed ${seed}, ${player.id}`,
        );
      }
      assert.deepEqual(
        await lua.doString(
          `return table_results(${luaLiteral({ players: state.players, hands: state.hands })},${luaLiteral(state.fixed)},true)`,
        ),
        state.fixedResults,
      );
    }
  } finally {
    lua.global.close();
  }
});

test("burst and Lucky dog use constrained fixed hands while dynamic board-only hands remain valid", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    const burst = fixture({
      fixed: "As Ks Qs Js Ts",
      dynamic: "8s 9h Tc Jd Qh",
      hands: ["2h 3h", "4c 5c", "6d 7d"],
    });
    burst.window = { placerId: "p0", stage: "hidden" };
    assert.deepEqual(burst.fixedStrength, [0, 14, 13, 12, 11, 7]);
    assert.deepEqual(burst.dynamicStrength, [4, 12]);
    const lucky = fixture({
      fixed: "As Ks Qs Js Ts",
      hands: ["9s 8h", "2h 3h", "4c 5c"],
    });
    assert.deepEqual(lucky.fixedResults.p0, [8, 13]);
    assert.deepEqual(tableResults(lucky, lucky.fixed).p0, [8, 14]);
    for (const [state, actorId, declaration] of [
      [burst, "p1", "burst"],
      [lucky, "p0", "lucky"],
    ]) {
      await lua.doString(`state=${luaLiteral(state)}`);
      assert.deepEqual(
        await lua.doString("return table_results(state,state.fixed,true)"),
        state.fixedResults,
      );
      const action = {
        type: "bell",
        declaration,
        round: state.round,
        step: state.step,
      };
      const result = applyAction(state, actorId, action);
      assert.equal(state.settlement.correct, true);
      assert.deepEqual(
        await lua.doString(
          `return on_action(state,${luaLiteral(action)},{actor={id=${luaLiteral(actorId)}}})`,
        ),
        luaCompatible(result),
      );
    }
  } finally {
    lua.global.close();
  }
});

test("2–8 players: deal all 52 unique cards, round permanent thirds up and never burst at opening", () => {
  const deckSizes = {
    2: [15, 28],
    3: [14, 27],
    4: [13, 26],
    5: [13, 24],
    6: [12, 23],
    7: [11, 22],
    8: [11, 20],
  };
  const starters = Object.fromEntries(
    PLAYER_COUNTS.map((count) => [count, new Set()]),
  );
  for (const count of PLAYER_COUNTS)
    for (let seed = 1; seed <= 25; seed++) {
      const state = createGame(players(count), seed);
      assert.equal(state.roundStarterId, state.players[state.turn].id);
      starters[count].add(state.roundStarterId);
      assert.deepEqual(
        [state.permanentDeck.length, state.ordinaryDeck.length],
        deckSizes[count],
      );
      assert.equal(state.fixed.length, 5);
      const all = [
        ...Object.values(state.hands).flat(),
        ...state.fixed,
        ...state.permanentDeck,
        ...state.ordinaryDeck,
      ];
      assert.equal(
        new Set(all.map((card) => `${card.rank}-${card.suit}`)).size,
        52,
      );
      assert.ok(compareHands(state.dynamicStrength, state.fixedStrength) <= 0);
      assert.ok(
        state.players.every(
          (player) => !projectGame(state, player.id).canBurst,
        ),
      );
    }
  for (const count of PLAYER_COUNTS)
    assert.ok(
      starters[count].size > 1,
      `${count}-player first starter varies with the seed`,
    );
  for (const count of [0, 1, 9])
    assert.throws(() => createGame(players(count)), /2–8/);
  assert.throws(
    () => createGame([{ id: "p0" }, { id: "p0" }, { id: "p2" }]),
    /不同/,
  );
});

test("2–8-player round starters rotate clockwise in JS and Lua despite different callers, outcomes and final turns", async () => {
  const pairs = [
    "Ks Kh",
    "Qs Qh",
    "Js Jh",
    "Tc Th",
    "9s 9h",
    "8s 8h",
    "7s 7h",
    "6s 6h",
  ];
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const count of PLAYER_COUNTS) {
      const state = createGame(players(count), 42);
      const firstStarter = state.turn;
      for (let round = 0; round < count * 2; round++) {
        const starter = (firstStarter + round) % count;
        const nextStarter = `p${(starter + 1) % count}`;
        const actor = `p${(starter + 2) % count}`;
        const label = `${count} players, round ${round + 1}`;
        assert.equal(state.roundStarterId, `p${starter}`, label);
        assert.equal(state.turn, starter, label);
        let action;
        if (round % 3 === 2) {
          state.turn = (starter + 2) % count;
          state.ordinaryDeck = [];
          state.ordinaryDiscard = [];
          state.permanentDeck = [];
          state.permanentDiscard = [];
          action = { type: "draw" };
        } else {
          state.fixed = cards("2s 4h 6c 8d Ts");
          state.hands = Object.fromEntries(
            pairs
              .slice(0, count)
              .map((hand, index) => [`p${index}`, cards(hand)]),
          );
          state.dynamic = cards(round % 3 === 0 ? "Kc" : "");
          refresh(state);
          state.turn = (starter + 1) % count;
          state.window = { placerId: nextStarter, stage: "ready" };
          action = { type: "bell", declaration: "burst" };
        }
        const initial = structuredClone(state);
        const intent = { ...action, round: state.round, step: state.step };
        const result = applyAction(state, actor, intent);
        assert.equal(result.accepted, true, label);
        assert.equal(state.phase, "round_end", label);
        assert.equal(state.settlement.nextStarterId, nextStarter, label);
        if (action.type === "bell")
          assert.equal(state.settlement.correct, round % 3 === 0, label);
        else assert.equal(state.settlement.reason, "exhausted", label);
        assert.deepEqual(
          await lua.doString(
            `state=${luaLiteral(initial)};return on_action(state,${luaLiteral(intent)},{actor={id=${luaLiteral(actor)}}})`,
          ),
          luaCompatible(result),
          label,
        );
        const scores = structuredClone(state.scores);
        const next = {
          type: "next_round",
          round: state.round,
          step: state.step,
        };
        const nextResult = applyAction(state, "p0", next);
        assert.deepEqual(state.scores, scores, label);
        assert.equal(state.players[state.turn].id, nextStarter, label);
        assert.equal(state.roundStarterId, nextStarter, label);
        assert.deepEqual(
          await lua.doString(
            `return on_action(state,${luaLiteral(next)},{actor={id='p0'}})`,
          ),
          luaCompatible(nextResult),
          label,
        );
      }
    }
  } finally {
    lua.global.close();
  }
});

test("projection conceals own holes, decks, seed, strength and all non-owner candidates", () => {
  const state = createGame(players(8), 42);
  const actor = state.players[state.turn].id;
  assert.equal(act(state, actor, { type: "draw" }).accepted, true);
  for (const player of state.players) {
    const projected = projectGame(state, player.id);
    assert.deepEqual(projected.hands[player.id], [
      { hidden: true },
      { hidden: true },
    ]);
    for (const other of state.players.filter((entry) => entry.id !== player.id))
      assert.deepEqual(projected.hands[other.id], state.hands[other.id]);
    assert.equal(projected.candidates.length, player.id === actor ? 3 : 0);
    for (const secret of [
      "seed",
      "ordinaryDeck",
      "permanentDeck",
      "permanentDiscard",
      "pendingDiscards",
      "fixedResults",
      "dynamicResults",
      "fixedStrength",
      "dynamicStrength",
    ])
      assert.equal(Object.hasOwn(projected, secret), false);
    assert.equal(projected.canForced, player.id === actor); // Eligibility never reveals truth.
    const before = structuredClone(state);
    projected.fixed[0].rank = 99;
    projected.hands[
      state.players.find((entry) => entry.id !== player.id).id
    ][0].rank = 99;
    assert.deepEqual(state, before);
  }
  const spectator = projectGame(state, "spectator");
  assert.ok(
    Object.values(spectator.hands)
      .flat()
      .every((card) => card.hidden),
  );
  assert.equal(spectator.candidates.length, 0);
  assert.equal(spectator.canForced, false);
  assert.equal(spectator.canLucky, false);
  assert.equal(
    act(state, "spectator", { type: "bell", declaration: "forced" }).accepted,
    false,
  );
});

test("placing opens a window for both other players, including the next player; placer is ignored", () => {
  const state = fixture({
    phase: "choosing",
    candidates: cards("Kc 3d 5h").map((card, index) => ({
      ...card,
      source: index === 2 ? "permanent" : "ordinary",
    })),
  });
  assert.equal(act(state, "p0", { type: "place", index: 0 }).accepted, true);
  assert.equal(compareHands(state.dynamicStrength, state.fixedStrength), 1);
  assert.equal(state.players[state.turn].id, "p1");
  assert.equal(projectGame(state, "p0").canBurst, false);
  assert.equal(projectGame(state, "p1").canBurst, true);
  assert.equal(projectGame(state, "p2").canBurst, true);
  const unchanged = structuredClone(state);
  assert.equal(
    act(state, "p0", { type: "bell", declaration: "burst" }).ignored,
    true,
  );
  assert.deepEqual(state, unchanged);
  assert.equal(
    act(state, "p1", { type: "bell", declaration: "burst" }).accepted,
    true,
  );
  assert.deepEqual(state.scores, { p0: -2, p1: 3, p2: 0 });
  assert.equal(state.settlement.nextStarterId, "p1");
  assert.ok(
    Object.values(projectGame(state, "p0").hands)
      .flat()
      .every((card) => !card.hidden),
  );
});

test("next player drawing closes the window for everyone and delays do not incur penalties", () => {
  const state = fixture({ dynamic: "Kc" });
  state.window = { placerId: "p2" };
  const delayed = {
    type: "bell",
    declaration: "burst",
    round: state.round,
    step: state.step,
  };
  assert.equal(act(state, "p0", { type: "draw" }).accepted, true);
  const afterDraw = structuredClone(state);
  for (const player of state.players) {
    assert.equal(
      act(state, player.id, { type: "bell", declaration: "burst" }).ignored,
      true,
    );
    assert.equal(applyAction(state, player.id, delayed).ignored, true);
  }
  assert.deepEqual(state, afterDraw);
  assert.deepEqual(state.scores, { p0: 0, p1: 0, p2: 0 });
});

test("missed burst persists; the latest placer is liable even if their card did not cause it", () => {
  const state = fixture({ dynamic: "Kc" });
  state.window = { placerId: "p2" };
  act(state, "p0", { type: "draw" });
  state.candidates = cards("3d 5h 9c").map((card) => ({
    ...card,
    source: "ordinary",
  }));
  act(state, "p0", { type: "place", index: 0 });
  act(state, "p2", { type: "bell", declaration: "burst" });
  assert.equal(state.settlement.correct, true);
  assert.equal(state.settlement.liableId, "p0");
  assert.deepEqual(state.scores, { p0: -2, p1: 0, p2: 3 });
});

test("ordinary leftovers reveal between bell stages; permanent leftovers stay private through recycling", () => {
  const state = fixture({
    phase: "choosing",
    candidates: cards("3s 5h 9c").map((card, index) => ({
      ...card,
      source: index === 2 ? "permanent" : "ordinary",
    })),
  });
  act(state, "p0", { type: "place", index: 0 });
  assert.equal(state.pendingDiscards.length, 2);
  assert.deepEqual(projectGame(state, "p1").ordinaryDiscard, []);
  assert.equal(projectGame(state, "p1").counts.permanentDiscard, 0);
  finishBellWait(state);
  act(state, "p1", { type: "draw" });
  assert.deepEqual(state.ordinaryDiscard, cards("5h"));
  assert.deepEqual(state.permanentDiscard, cards("9c"));
  assert.deepEqual(projectGame(state, "p2").ordinaryDiscard, cards("5h"));
  assert.equal(projectGame(state, "p2").counts.permanentDiscard, 1);
  assert.equal(projectGame(state, "p2").candidates.length, 0);
  const recycled = fixture({
    phase: "choosing",
    candidates: cards("3s 5h 9c").map((card, index) => ({
      ...card,
      source: index === 2 ? "permanent" : "ordinary",
    })),
  });
  recycled.ordinaryDeck = [];
  recycled.permanentDeck = [];
  recycled.ordinaryDiscard = [];
  recycled.permanentDiscard = [];
  act(recycled, "p0", { type: "place", index: 0 });
  finishBellWait(recycled);
  act(recycled, "p1", { type: "draw" });
  assert.deepEqual(recycled.ordinaryDiscard, []);
  // Public discard information survives an immediate refill, without exposing the permanent face.
  assert.deepEqual(
    projectGame(recycled, "p2").recentOrdinaryDiscard,
    cards("5h"),
  );
  assert.equal(projectGame(recycled, "p2").candidates.length, 0);
});

test("authoritative 2s reveal and 3s draw lock preserve bell eligibility and privacy in Lua and JS", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const choose of [0, 1, 2]) {
      const state = fixture({
        phase: "choosing",
        candidates: cards("Kc 3d 5h").map((card, index) => ({
          ...card,
          source: index === 2 ? "permanent" : "ordinary",
        })),
      });
      await lua.doString(`state=${luaLiteral(state)}`);
      const action = {
        type: "place",
        index: choose,
        round: state.round,
        step: state.step,
      };
      const placed = applyAction(state, "p0", action, { serverTime: 10000 });
      assert.deepEqual(
        await lua.doString(
          `return on_action(state,${luaLiteral(action)},{actor={id='p0'},serverTime=10000})`,
        ),
        luaCompatible(placed),
      );
      const revealTimer = placed.timerOps[0];
      assert.equal(revealTimer.afterMs, 2000);
      assert.equal(state.window.untilAt, 12000);
      const bell = {
        type: "bell",
        declaration: "burst",
        round: state.round,
        step: state.step,
      };
      let nextTimer;
      for (const stage of ["hidden", "revealed", "ready"]) {
        assert.equal(state.window.stage, stage);
        const visible = projectGame(state, "p1");
        assert.equal(visible.canDraw, stage === "ready");
        assert.equal(visible.canBurst, true);
        assert.equal(projectGame(state, "p0").canBurst, false);
        assert.equal(projectGame(state, "p2").canBurst, true);
        assert.ok(visible.hands.p1.every((card) => card.hidden));
        assert.equal(
          visible.ordinaryDiscard.length,
          stage === "hidden" ? 0 : choose === 2 ? 2 : 1,
        );
        assert.equal(
          visible.counts.permanentDiscard,
          stage === "hidden" || choose === 2 ? 0 : 1,
        );
        assert.equal(Object.hasOwn(visible, "permanentDiscard"), false);
        assert.equal(Object.hasOwn(visible, "pendingDiscards"), false);
        for (const viewer of ["p0", "p1", "p2", "spectator"]) {
          const expectedSlots = cards("Kc 3d 5h").map((card, index) => {
            const source = index === 2 ? "permanent" : "ordinary";
            return index === choose
              ? { empty: true, source }
              : viewer === "p0" || (source === "ordinary" && stage !== "hidden")
                ? { ...card, source }
                : { hidden: true, source };
          });
          const projected = projectGame(state, viewer);
          assert.deepEqual(
            projected.discardSlots,
            expectedSlots,
            `${viewer}, ${stage}, choose ${choose}`,
          );
          assert.deepEqual(
            await lua.doString(
              `return view(state,{}, {viewer={id=${luaLiteral(viewer)}}}).state`,
            ),
            luaCompatible(projected),
          );
        }
        assert.deepEqual(
          await lua.doString(`return view(state,{}, {viewer={id='p1'}}).state`),
          luaCompatible(visible),
        );
        const copy = structuredClone(state);
        if (stage !== "ready") {
          assert.equal(
            act(state, "p1", { type: "draw", stage: "ready" }).accepted,
            false,
          );
          assert.equal(
            await lua.doString(
              `return on_action(state,{type='draw',round=state.round,step=state.step,stage='ready'},{actor={id='p1'}}).accepted`,
            ),
            false,
          );
          assert.deepEqual(state, copy);
          assert.deepEqual(
            await lua.doString("return state"),
            luaCompatible(copy),
          );
        }
        // A click sent before reveal/unlock still belongs to this placement.
        assert.equal(applyAction(copy, "p1", bell).ignored, false);
        assert.equal(copy.settlement.liableId, "p0");
        if (stage === "ready") {
          const draw = { type: "draw", round: state.round, step: state.step };
          const result = applyAction(state, "p1", draw);
          assert.deepEqual(
            await lua.doString(
              `return on_action(state,${luaLiteral(draw)},{actor={id='p1'}})`,
            ),
            luaCompatible(result),
          );
          assert.equal(projectGame(state, "p2").canBurst, false);
          assert.deepEqual(projectGame(state, "p2").discardSlots, []);
          assert.equal(applyAction(state, "p2", bell).ignored, true);
          break;
        }
        const timer = stage === "hidden" ? revealTimer : nextTimer;
        // A delayed reveal still gives a full three seconds after actual publication.
        const context = {
          dueAt: state.window.untilAt,
          firedAt: stage === "hidden" ? 20000 : 23000,
        };
        const transition = applyTimer(state, timer, context);
        assert.deepEqual(
          await lua.doString(
            `return on_timer(state,${luaLiteral(timer)},${luaLiteral(context)})`,
          ),
          luaCompatible(transition),
        );
        if (stage === "hidden") {
          assert.equal(state.window.untilAt, 23000);
          assert.equal(transition.timerOps[0].afterMs, 3000);
        }
        nextTimer = transition.timerOps?.[0];
        const unchanged = structuredClone(state);
        assert.deepEqual(applyTimer(state, timer, context), {
          state,
          events: [],
        });
        assert.deepEqual(state, unchanged);
        assert.deepEqual(
          await lua.doString(
            `return on_timer(state,${luaLiteral(timer)},${luaLiteral(context)})`,
          ),
          luaCompatible({ state, events: [] }),
        );
      }
    }
  } finally {
    lua.global.close();
  }
});

test("bell cancels pending reveal/unlock; late timers cannot change settled or later rounds", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const ringAfterReveal of [false, true]) {
      const state = fixture({
        phase: "choosing",
        candidates: cards("Kc 3d 5h").map((card, index) => ({
          ...card,
          source: index === 2 ? "permanent" : "ordinary",
        })),
      });
      let timer = act(state, "p0", { type: "place", index: 0 }).timerOps[0];
      if (ringAfterReveal)
        timer = applyTimer(state, timer, { firedAt: 2000 }).timerOps[0];
      await lua.doString(`state=${luaLiteral(state)}`);
      const bell = {
        type: "bell",
        declaration: "burst",
        round: state.round,
        step: state.step,
      };
      const result = applyAction(state, "p1", bell);
      assert.deepEqual(result.timerOps, [
        { op: "cancel", id: WINDOW_TIMER_ID },
      ]);
      assert.deepEqual(
        await lua.doString(
          `return on_action(state,${luaLiteral(bell)},{actor={id='p1'}})`,
        ),
        luaCompatible(result),
      );
      const ended = structuredClone(state);
      applyTimer(state, timer, { firedAt: 5000 });
      assert.deepEqual(state, ended);
      assert.deepEqual(
        await lua.doString(
          `return on_timer(state,${luaLiteral(timer)},{firedAt=5000})`,
        ),
        luaCompatible({ state, events: [] }),
      );
      act(state, "p1", { type: "next_round" });
      const actor = state.players[state.turn].id;
      act(state, actor, { type: "draw" });
      act(state, actor, { type: "place", index: 0 });
      const nextWindow = structuredClone(state);
      applyTimer(state, timer, { firedAt: 10000 });
      assert.deepEqual(state, nextWindow);
      assert.deepEqual(
        await lua.doString(
          `state=${luaLiteral(nextWindow)};return on_timer(state,${luaLiteral(timer)},{firedAt=10000})`,
        ),
        luaCompatible({ state, events: [] }),
      );
    }
  } finally {
    lua.global.close();
  }
});

test("draws refill their matching discard independently, including mid-draw and partial draws", () => {
  const state = fixture();
  state.ordinaryDeck = cards("3s");
  state.ordinaryDiscard = cards("5h 9c");
  state.permanentDeck = [];
  state.permanentDiscard = cards("Jd");
  act(state, "p0", { type: "draw" });
  assert.equal(state.candidates.length, 3);
  assert.equal(state.candidates[0].rank, 3);
  assert.equal(state.candidates[2].rank, 11);
  assert.deepEqual(
    state.candidates.map((card) => card.source),
    ["ordinary", "ordinary", "permanent"],
  );
  assert.equal(state.ordinaryDeck.length, 1);
  assert.equal(state.permanentDeck.length, 0);
  const partial = fixture();
  partial.ordinaryDeck = [];
  partial.ordinaryDiscard = [];
  partial.permanentDeck = cards("Ac");
  partial.permanentDiscard = [];
  act(partial, "p0", { type: "draw" });
  assert.equal(partial.candidates.length, 1);
  assert.equal(projectGame(partial, "p0").canForced, false);
  assert.equal(
    act(partial, "p0", { type: "bell", declaration: "forced" }).ignored,
    true,
  );
  assert.equal(partial.phase, "choosing");
});

test("exhaustion neither scores nor reveals holes and a fresh deal preserves scores", () => {
  const state = fixture();
  state.ordinaryDeck = [];
  state.ordinaryDiscard = [];
  state.permanentDeck = [];
  state.permanentDiscard = [];
  state.scores = { p0: 4, p1: -2, p2: -2 };
  act(state, "p0", { type: "draw" });
  assert.equal(state.phase, "round_end");
  assert.equal(state.settlement.reason, "exhausted");
  assert.ok(projectGame(state, "p0").hands.p0.every((card) => card.hidden));
  act(state, "p1", { type: "next_round" });
  assert.deepEqual(state.scores, { p0: 4, p1: -2, p2: -2 });
  assert.equal(state.round, 2);
  assert.equal(state.fixed.length, 5);
  assert.equal(state.dynamic.length, 0);
});

test("forced checks every candidate and requires no existing burst; faults charge all opponents", () => {
  const candidateSet = (text) =>
    cards(text).map((card, index) => ({
      ...card,
      source: index === 2 ? "permanent" : "ordinary",
    }));
  for (const [text, dynamic, correct] of [
    ["Kc Qc Jc", "3d 5c", true],
    ["Kc Qc 9c", "3d 5c", false],
    ["Kd Qc Jc", "Kc", false],
  ]) {
    const state = fixture({
      dynamic,
      phase: "choosing",
      candidates: candidateSet(text),
    });
    assert.equal(
      act(state, "p0", { type: "bell", declaration: "forced" }).accepted,
      true,
    );
    assert.equal(state.settlement.correct, correct);
    assert.equal(state.settlement.checks.length, 3);
    assert.equal(projectGame(state, "p2").settlement.checks.length, 3);
    assert.deepEqual(
      state.scores,
      correct ? { p0: 3, p1: -1, p2: -1 } : { p0: -2, p1: 1, p2: 1 },
    );
  }
});

test("Lucky dog needs own pre-draw turn, a strongest result and at least a straight", () => {
  const success = fixture({
    fixed: "2s 3h 4c 8d Ts",
    hands: ["5h 6d", "Ks Kh", "Qs Qh"],
  });
  assert.equal(
    act(success, "p1", { type: "bell", declaration: "lucky" }).ignored,
    true,
  );
  act(success, "p0", { type: "bell", declaration: "lucky" });
  assert.equal(success.settlement.correct, true);
  assert.deepEqual(success.scores, { p0: 3, p1: -1, p2: -1 });
  for (const state of [fixture(), fixture({ fixed: "2s 3h 4c 5d 6s" })]) {
    act(state, "p0", { type: "bell", declaration: "lucky" });
    assert.equal(state.settlement.correct, false);
    assert.deepEqual(state.scores, { p0: -2, p1: 1, p2: 1 });
    act(state, "p1", { type: "next_round" });
    assert.equal(state.players[state.turn].id, "p1");
  }
  const late = fixture();
  act(late, "p0", { type: "draw" });
  assert.equal(
    act(late, "p0", { type: "bell", declaration: "lucky" }).ignored,
    true,
  );
  assert.equal(late.phase, "choosing");
});

test("Lucky dog accepts highest ties but rejects lower ties and ties below a straight in JS and Lua", async () => {
  const cases = [
    { hands: ["6d Kh", "6c Qh"], correct: true },
    { hands: ["6d Kh", "6c Qh", "2c Jh"], correct: true },
    { hands: ["6d Kh", "6c Qh", "2c 6h"], correct: true },
    {
      hands: [
        "2h As",
        "2c Ah",
        "2d Ac",
        "3s Ad",
        "3c Ks",
        "3d Kh",
        "4s Kc",
        "4h Kd",
      ],
      correct: true,
    },
    { hands: ["6d Kh", "7h Qd", "6c Jd"], tiedPlayer: "p2", correct: false },
    {
      fixed: "2s 4h 6c 8d Ts",
      hands: ["Ks Kh", "Kc Kd", "Qs Qh"],
      correct: false,
    },
  ];
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const {
      fixed = "2s 3h 4c 5d 6s",
      hands,
      tiedPlayer = "p1",
      correct,
    } of cases) {
      const state = fixture({ fixed, hands });
      assert.equal(
        compareHands(state.fixedResults.p0, state.fixedResults[tiedPlayer]),
        0,
      );
      await lua.doString(`state=${luaLiteral(state)}`);
      const action = {
        type: "bell",
        declaration: "lucky",
        round: state.round,
        step: state.step,
      };
      const result = applyAction(state, "p0", action);
      assert.equal(result.accepted, true);
      assert.equal(state.settlement.correct, correct);
      const count = hands.length;
      assert.deepEqual(
        state.settlement.deltas,
        Object.fromEntries(
          players(count).map((player) => [
            player.id,
            correct
              ? player.id === "p0"
                ? count
                : -1
              : player.id === "p0"
                ? -(count - 1)
                : 1,
          ]),
        ),
      );
      assert.deepEqual(
        await lua.doString(
          `return on_action(state,${luaLiteral(action)},{actor={id='p0'}})`,
        ),
        luaCompatible(result),
      );
    }
  } finally {
    lua.global.close();
  }
});

test("duels allow only the opponent to ring after placement, until the opponent draws", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const stage of ["hidden", "revealed", "ready"]) {
      const state = fixture({
        hands: ["Ks Kh", "Qs Qh"],
        phase: "choosing",
        candidates: cards("Kc 9c Jc").map((card, index) => ({
          ...card,
          source: index === 2 ? "permanent" : "ordinary",
        })),
      });
      act(state, "p0", { type: "place", index: 0 });
      while (state.window.stage !== stage)
        applyTimer(
          state,
          {
            id: WINDOW_TIMER_ID,
            payload: {
              round: state.round,
              step: state.step,
              stage: state.window.stage,
            },
          },
          { firedAt: state.window.untilAt },
        );
      assert.equal(projectGame(state, "p0").canBurst, false, stage);
      assert.equal(projectGame(state, "p1").canBurst, true, stage);
      const initial = structuredClone(state);
      const intent = { type: "bell", round: state.round, step: state.step };
      const ignored = applyAction(state, "p0", intent);
      assert.equal(ignored.ignored, true, stage);
      assert.deepEqual(state, initial, stage);
      assert.deepEqual(
        await lua.doString(
          `state=${luaLiteral(initial)};return on_action(state,${luaLiteral(intent)},{actor={id='p0'}})`,
        ),
        luaCompatible(ignored),
        stage,
      );
      const result = applyAction(state, "p1", intent);
      assert.equal(state.settlement.correct, true, stage);
      assert.deepEqual(state.scores, { p0: -1, p1: 2 }, stage);
      assert.deepEqual(
        await lua.doString(
          `return on_action(state,${luaLiteral(intent)},{actor={id='p1'}})`,
        ),
        luaCompatible(result),
        stage,
      );
      if (stage === "ready") {
        const continued = structuredClone(initial);
        const drawn = act(continued, "p1", { type: "draw" });
        assert.equal(drawn.accepted, true);
        assert.equal(continued.window, null);
        const late = {
          type: "bell",
          declaration: "burst",
          round: continued.round,
          step: continued.step,
        };
        const snapshot = structuredClone(continued);
        for (const actor of ["p0", "p1"]) {
          assert.equal(applyAction(continued, actor, late).ignored, true);
          assert.deepEqual(continued, snapshot);
        }
      }
    }
  } finally {
    lua.global.close();
  }
});

test("2–8-player JS and Lua payouts match the rulebook: correct calls add one point, faults remain zero-sum", async () => {
  const pairs = [
    "Ks Kh",
    "Qs Qh",
    "Js Jh",
    "Tc Th",
    "9s 9h",
    "8s 8h",
    "7s 7h",
    "6s 6h",
  ];
  const rewards = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 8, 8: 9 };
  const candidates = (text) =>
    cards(text).map((card, index) => ({
      ...card,
      source: index === 2 ? "permanent" : "ordinary",
    }));
  const sum = (values) =>
    Object.values(values).reduce((total, value) => total + value, 0);
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const count of PLAYER_COUNTS)
      for (const declaration of ["burst", "forced", "lucky"])
        for (const correct of [true, false]) {
          const hands = pairs.slice(0, count);
          const state =
            declaration === "burst"
              ? fixture({ hands, dynamic: correct ? "Kc" : "" })
              : declaration === "forced"
                ? fixture({
                    hands,
                    dynamic: "3d 5c",
                    phase: "choosing",
                    candidates: candidates(
                      correct
                        ? count === 2
                          ? "Kc Qc Qd"
                          : "Kc Qc Jc"
                        : "Kc Qc 9c",
                    ),
                  })
                : correct
                  ? fixture({
                      fixed: "2s 3h 4c 8d Ts",
                      hands: ["5h 6d", ...pairs.slice(0, count - 1)],
                    })
                  : fixture({ hands });
          if (declaration === "burst")
            state.window = { placerId: `p${count - 1}` };
          state.scores = Object.fromEntries(
            state.players.map((player, index) => [player.id, index - 2]),
          );
          const initial = structuredClone(state);
          const expected = Object.fromEntries(
            state.players.map((player, index) => [
              player.id,
              !correct
                ? (index === 0 ? -(count - 1) : 1) * (count === 2 ? 2 : 1)
                : declaration === "burst"
                  ? index === 0
                    ? rewards[count]
                    : index === count - 1
                      ? 1 - rewards[count]
                      : 0
                  : index === 0
                    ? count
                    : -1,
            ]),
          );
          const intent = {
            type: "bell",
            ...(declaration === "lucky" ? { declaration } : {}),
            round: state.round,
            step: state.step,
          };
          const result = applyAction(state, "p0", intent);
          const label = `${count} players, ${declaration}, correct=${correct}`;
          assert.equal(result.accepted, true, label);
          assert.equal(state.settlement.correct, correct, label);
          assert.equal(state.settlement.declaration, declaration, label);
          assert.deepEqual(state.settlement.deltas, expected, label);
          assert.deepEqual(
            state.scores,
            Object.fromEntries(
              state.players.map((player) => [
                player.id,
                initial.scores[player.id] + expected[player.id],
              ]),
            ),
            label,
          );
          assert.equal(
            sum(state.scores) - sum(initial.scores),
            correct ? 1 : 0,
            label,
          );
          assert.deepEqual(
            await lua.doString(
              `state=${luaLiteral(initial)};return on_action(state,${luaLiteral(intent)},{actor={id='p0'}})`,
            ),
            luaCompatible(result),
            label,
          );
          assert.deepEqual(
            await lua.doString(
              "return view(state,{}, {viewer={id='p0'}}).state",
            ),
            luaCompatible(projectGame(state, "p0")),
            label,
          );
          const scores = structuredClone(state.scores);
          const next = {
            type: "next_round",
            round: state.round,
            step: state.step,
          };
          const nextResult = applyAction(state, "p0", next);
          assert.deepEqual(state.scores, scores, label);
          assert.equal(state.players[state.turn].id, "p1", label);
          assert.deepEqual(
            await lua.doString(
              `return on_action(state,${luaLiteral(next)},{actor={id='p0'}})`,
            ),
            luaCompatible(nextResult),
            label,
          );
        }
  } finally {
    lua.global.close();
  }
});

test("plain bell needs no declaration, ignores ineligible timings, and never implies Lucky dog", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    const scenarios = [
      { state: fixture(), actor: "p0" },
      { state: fixture({ dynamic: "Kc" }), actor: "p2", window: "p2" },
      {
        state: fixture({
          phase: "choosing",
          candidates: cards("3s").map((card) => ({
            ...card,
            source: "permanent",
          })),
        }),
        actor: "p0",
      },
      {
        state: fixture({
          phase: "choosing",
          candidates: cards("Kc Qc Jc").map((card) => ({
            ...card,
            source: "ordinary",
          })),
        }),
        actor: "p1",
      },
      {
        state: fixture({
          fixed: "2s 3h 4c 8d Ts",
          hands: ["5h 6d", "Ks Kh", "Qs Qh"],
        }),
        actor: "p0",
        lucky: true,
      },
    ];
    for (const scenario of scenarios) {
      const state = scenario.state;
      if (scenario.window) state.window = { placerId: scenario.window };
      const initial = structuredClone(state);
      const intent = { type: "bell", round: state.round, step: state.step };
      const result = applyAction(state, scenario.actor, intent);
      assert.equal(result.ignored, true);
      assert.deepEqual(state, initial);
      assert.deepEqual(
        await lua.doString(
          `state=${luaLiteral(initial)};return on_action(state,${luaLiteral(intent)},{actor={id=${luaLiteral(scenario.actor)}}})`,
        ),
        luaCompatible(result),
      );
      if (scenario.lucky) {
        const declared = { ...intent, declaration: "lucky" };
        const claimed = applyAction(state, scenario.actor, declared);
        assert.equal(state.settlement.declaration, "lucky");
        assert.equal(state.settlement.correct, true);
        assert.deepEqual(
          await lua.doString(
            `return on_action(state,${luaLiteral(declared)},{actor={id=${luaLiteral(scenario.actor)}}})`,
          ),
          luaCompatible(claimed),
        );
      }
    }
  } finally {
    lua.global.close();
  }
});

test("ties are not bursts and table maxima can come from different players", () => {
  const state = fixture({
    fixed: "2s 3h 4c 5d 6s",
    dynamic: "2h 3c 4d 5s 6h",
    hands: ["6d Kh", "6c Qh", "2c Jh"],
  });
  state.window = { placerId: "p2" };
  assert.equal(compareHands(state.dynamicStrength, state.fixedStrength), 0);
  act(state, "p0", { type: "bell", declaration: "burst" });
  assert.equal(state.settlement.correct, false);
  const maxima = fixture({
    fixed: "2s 3h 4c 8d Ts",
    dynamic: "Kc Kd",
    hands: ["5h 6d", "Ks Kh", "Qs Qh"],
  });
  assert.deepEqual(maxima.fixedStrength, [4, 6]);
  assert.deepEqual(maxima.dynamicStrength, [7, 13]);
});

test("finish above target, shared winners, positive-sum rewards, next starter and stale rematch clicks", () => {
  const state = fixture({ dynamic: "Kc" });
  state.window = { placerId: "p2" };
  state.scores = { p0: 11, p1: -5, p2: -6 };
  act(state, "p0", { type: "bell", declaration: "burst" });
  assert.equal(state.phase, "ended");
  assert.deepEqual(state.winners, ["p0"]);
  assert.equal(
    Object.values(state.scores).reduce((a, b) => a + b),
    1,
  );
  const delayed = {
    type: "bell",
    declaration: "lucky",
    round: state.round,
    step: state.step,
  };
  const rematch = act(state, "p1", { type: "rematch" }).state;
  assert.deepEqual(rematch.scores, { p0: 0, p1: 0, p2: 0 });
  assert.equal(rematch.round, 2);
  assert.equal(rematch.roundStarterId, rematch.players[rematch.turn].id);
  assert.equal(applyAction(rematch, "p0", delayed).ignored, true);
  const joint = fixture();
  joint.scores = { p0: -24, p1: 12, p2: 12 };
  act(joint, "p0", { type: "bell", declaration: "lucky" });
  assert.equal(joint.phase, "ended");
  assert.deepEqual(joint.winners, ["p1", "p2"]);
  for (const count of PLAYER_COUNTS) {
    const game = createGame(players(count), 42);
    const actor = game.players[game.turn].id;
    game.fixedResults[actor] = [0, 2];
    act(game, actor, { type: "bell", declaration: "lucky" });
    assert.equal(game.scores[actor], -(count - 1) * (count === 2 ? 2 : 1));
    assert.equal(
      Object.values(game.scores).reduce((a, b) => a + b),
      0,
    );
  }
});

test("2–8-player victory targets match Lua and JS at, below and above the threshold", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const [index, count] of PLAYER_COUNTS.entries()) {
      const target = [11, 13, 15, 17, 19, 21, 23][index];
      const transfer = count === 2 ? 2 : 1;
      for (const offset of [-transfer - 1, -transfer, 1 - transfer]) {
        const state = createGame(players(count), 42);
        const actor = state.players[state.turn].id;
        const recipient = state.players[(state.turn + 1) % count].id;
        // A wrong Lucky dog transfers two points in a duel, otherwise one to each opponent.
        state.fixedResults[actor] = [0, 2];
        state.scores[recipient] = target + offset;
        state.scores[actor] = -state.scores[recipient];
        const initial = structuredClone(state);
        const intent = {
          type: "bell",
          declaration: "lucky",
          round: state.round,
          step: state.step,
        };
        const result = applyAction(state, actor, intent);
        const won = offset + transfer >= 0;
        assert.equal(state.scores[recipient], target + offset + transfer);
        assert.equal(
          state.phase,
          won ? "ended" : "round_end",
          `${count} players, offset ${offset}`,
        );
        assert.deepEqual(state.winners, won ? [recipient] : []);
        assert.equal(projectGame(state, actor).targetScore, target);
        const remote = await lua.doString(
          `state=${luaLiteral(initial)};return on_action(state,${luaLiteral(intent)},{actor={id=${luaLiteral(actor)}}})`,
        );
        assert.deepEqual(remote, luaCompatible(result));
        const visible = await lua.doString(
          `return view(state,{}, {viewer={id=${luaLiteral(actor)}}}).state`,
        );
        assert.deepEqual(visible, luaCompatible(projectGame(state, actor)));
      }
    }
  } finally {
    lua.global.close();
  }
});

test("invalid actions do not mutate state; late concurrent bells cannot settle twice", () => {
  const state = fixture();
  const original = structuredClone(state);
  for (const [actor, action] of [
    ["p1", { type: "draw" }],
    ["p0", { type: "place", index: 0 }],
    ["p0", { type: "next_round" }],
    ["p0", { type: "rematch" }],
    ["p0", { type: "bell", declaration: "bad" }],
  ]) {
    assert.equal(act(state, actor, action).accepted, false);
    assert.deepEqual(state, original);
  }
  state.dynamic = cards("Kc");
  refresh(state);
  state.window = { placerId: "p2" };
  const simultaneous = {
    type: "bell",
    declaration: "burst",
    round: state.round,
    step: state.step,
  };
  assert.equal(applyAction(state, "p0", simultaneous).accepted, true);
  const settled = structuredClone(state);
  assert.equal(applyAction(state, "p1", simultaneous).ignored, true);
  assert.deepEqual(state, settled);
});

function assertConservation(state) {
  const all = [
    ...Object.values(state.hands).flat(),
    ...state.fixed,
    ...state.dynamic,
    ...state.ordinaryDeck,
    ...state.permanentDeck,
    ...state.ordinaryDiscard,
    ...state.permanentDiscard,
    ...state.candidates,
    ...state.pendingDiscards,
  ];
  assert.equal(all.length, 52);
  assert.equal(
    new Set(all.map((card) => `${card.rank}-${card.suit}`)).size,
    52,
  );
}

test("uninterrupted 2–8-player rounds conserve all cards through refills and end in finite turns", () => {
  for (const count of PLAYER_COUNTS) {
    const state = createGame(players(count), 42);
    let turns = 0;
    while (state.phase === "before_draw") {
      finishBellWait(state);
      assertConservation(state);
      const actor = state.players[state.turn].id;
      act(state, actor, { type: "draw" });
      assertConservation(state);
      if (state.phase === "round_end") break;
      act(state, actor, {
        type: "place",
        index: turns++ % state.candidates.length,
      });
      assert.ok(turns <= 47 - 2 * count);
    }
    assert.equal(state.dynamic.length, 47 - 2 * count);
    assert.equal(state.settlement.reason, "exhausted");
    assertConservation(state);
  }
});

function luaLiteral(value) {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return "{" + value.map(luaLiteral).join(",") + "}";
  return (
    "{" +
    Object.entries(value)
      .map(([key, entry]) => `[${JSON.stringify(key)}]=${luaLiteral(entry)}`)
      .join(",") +
    "}"
  );
}

// Plain Lua tables have no empty-array marker or null-valued keys.
function luaCompatible(value) {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.length ? value.map(luaCompatible) : {};
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null && entry !== undefined)
        .map(([key, entry]) => [key, luaCompatible(entry)]),
    );
  return value;
}

async function openLua() {
  const lua = await new LuaFactory().createEngine();
  const execute = lua.doString.bind(lua);
  // Wasmoon's convenience runner leaves return values on the global stack.
  // Long replays must release them between calls, as the platform runtime does.
  lua.doString = async (source) => {
    const top = lua.global.getTop();
    try {
      return await execute(source);
    } finally {
      lua.global.setTop(top);
    }
  };
  return lua;
}

test("Lua evaluator matches JS for every known case and seeded larger boards", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const [name, text, expected] of handCases)
      assert.deepEqual(
        await lua.doString(`return evaluate_hand(${luaLiteral(cards(text))})`),
        expected,
        name,
      );
    for (let seed = 1; seed <= 80; seed++) {
      const state = createGame(players(8), seed);
      const hand = [
        ...state.fixed,
        ...state.hands.p0,
        ...state.ordinaryDeck.slice(0, seed % 10),
      ];
      assert.deepEqual(
        await lua.doString(`return evaluate_hand(${luaLiteral(hand)})`),
        evaluateHand(hand),
      );
    }
  } finally {
    lua.global.close();
  }
});

test("Lua room and JS local state stay identical through full rounds, private views and exhaustion", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    for (const count of PLAYER_COUNTS) {
      const roster = players(count);
      const state = createGame(roster, "a18c4f092bd771e03aa5c6d9ef104b82");
      const remote = await lua.doString(
        `state = setup({players=${luaLiteral(roster)},match={randomSeed='a18c4f092bd771e03aa5c6d9ef104b82'}}).state; return state`,
      );
      assert.deepEqual(remote, luaCompatible(state));
      let turns = 0;
      while (state.phase === "before_draw") {
        const actor = state.players[state.turn].id;
        const draw = { type: "draw", round: state.round, step: state.step };
        act(state, actor, { type: "draw" });
        const afterDraw = await lua.doString(
          `assert(on_action(state,${luaLiteral(draw)},{actor={id=${luaLiteral(actor)}}}).accepted);return state`,
        );
        assert.deepEqual(afterDraw, luaCompatible(state));
        for (const viewer of [
          actor,
          roster[(state.turn + 1) % count].id,
          "spectator",
        ]) {
          const visible = await lua.doString(
            `return view(state,{}, {viewer={id=${luaLiteral(viewer)}}}).state`,
          );
          assert.deepEqual(visible, luaCompatible(projectGame(state, viewer)));
        }
        if (state.phase === "round_end") break;
        const action = {
          type: "place",
          index: turns++ % state.candidates.length,
          round: state.round,
          step: state.step,
        };
        let timer = act(state, actor, action).timerOps[0];
        const afterPlace = await lua.doString(
          `assert(on_action(state,${luaLiteral(action)},{actor={id=${luaLiteral(actor)}}}).accepted);return state`,
        );
        assert.deepEqual(afterPlace, luaCompatible(state));
        while (timer) {
          const context = {
            dueAt: state.window.untilAt,
            firedAt: state.window.untilAt,
          };
          const transitioned = applyTimer(state, timer, context);
          assert.deepEqual(
            await lua.doString(
              `return on_timer(state,${luaLiteral(timer)},${luaLiteral(context)})`,
            ),
            luaCompatible(transitioned),
          );
          for (const viewer of [
            actor,
            roster[(state.turn + 1) % count].id,
            "spectator",
          ]) {
            assert.deepEqual(
              await lua.doString(
                `return view(state,{}, {viewer={id=${luaLiteral(viewer)}}}).state`,
              ),
              luaCompatible(projectGame(state, viewer)),
            );
          }
          timer = transitioned.timerOps?.[0];
        }
      }
      const next = { type: "next_round", round: state.round, step: state.step };
      act(state, "p0", next);
      assert.deepEqual(
        await lua.doString(
          `state=on_action(state,${luaLiteral(next)},{actor={id='p0'}}).state;return state`,
        ),
        luaCompatible(state),
      );
    }
  } finally {
    lua.global.close();
  }
});

test("Lua scoring, eligibility, stale actions, forced checks, Lucky dog, finish and rematch match JS", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    const forcedCards = cards("Kc Qc Jc").map((card) => ({
      ...card,
      source: "ordinary",
    }));
    const scenarios = [
      {
        state: fixture({ dynamic: "Kc" }),
        actor: "p0",
        declaration: "burst",
        window: "p2",
      },
      { state: fixture(), actor: "p0", declaration: "burst", window: "p2" },
      {
        state: fixture(),
        actor: "p2",
        declaration: "burst",
        window: "p2",
        ignored: true,
      },
      { state: fixture(), actor: "p1", declaration: "lucky", ignored: true },
      {
        state: fixture({
          fixed: "2s 3h 4c 8d Ts",
          hands: ["5h 6d", "Ks Kh", "Qs Qh"],
        }),
        actor: "p0",
        declaration: "lucky",
      },
      {
        state: fixture({ fixed: "2s 3h 4c 5d 6s" }),
        actor: "p0",
        declaration: "lucky",
      },
      {
        state: fixture({
          dynamic: "3d 5c",
          phase: "choosing",
          candidates: forcedCards,
        }),
        actor: "p0",
        declaration: "forced",
      },
      {
        state: fixture({
          dynamic: "Kc",
          phase: "choosing",
          candidates: forcedCards,
        }),
        actor: "p0",
        declaration: "forced",
      },
      {
        state: fixture({
          phase: "choosing",
          candidates: cards("3s").map((card) => ({
            ...card,
            source: "permanent",
          })),
        }),
        actor: "p0",
        declaration: "forced",
        ignored: true,
      },
    ];
    for (const scenario of scenarios) {
      if (scenario.window)
        scenario.state.window = { placerId: scenario.window };
      const initial = structuredClone(scenario.state);
      const action = {
        type: "bell",
        declaration: scenario.declaration,
        round: initial.round,
        step: initial.step,
      };
      const result = applyAction(scenario.state, scenario.actor, action);
      const remote = await lua.doString(
        `state=${luaLiteral(initial)};return on_action(state,${luaLiteral(action)},{actor={id=${luaLiteral(scenario.actor)}}})`,
      );
      assert.deepEqual(remote, luaCompatible(result));
      const visible = await lua.doString(
        `return view(state,{}, {viewer={id='p0'}}).state`,
      );
      assert.deepEqual(
        visible,
        luaCompatible(projectGame(scenario.state, "p0")),
      );
      if (!scenario.ignored) {
        const next = {
          type: "next_round",
          round: scenario.state.round,
          step: scenario.state.step,
        };
        applyAction(scenario.state, "p0", next);
        assert.deepEqual(
          await lua.doString(
            `return on_action(state,${luaLiteral(next)},{actor={id='p0'}})`,
          ),
          luaCompatible({
            accepted: true,
            state: scenario.state,
            ignored: false,
            events: [],
          }),
        );
      }
    }
    const state = fixture({ dynamic: "Kc" });
    state.window = { placerId: "p2" };
    state.scores = { p0: 10, p1: -5, p2: -5 };
    await lua.doString(`state=${luaLiteral(state)}`);
    for (const action of [
      { type: "bell", declaration: "burst" },
      { type: "rematch" },
    ]) {
      const intent = { ...action, round: state.round, step: state.step };
      const result = applyAction(state, "p0", intent);
      assert.deepEqual(
        await lua.doString(
          `return on_action(state,${luaLiteral(intent)},{actor={id='p0'}})`,
        ),
        luaCompatible(result),
      );
      Object.assign(state, result.state);
    }
    const unchanged = structuredClone(state);
    assert.equal(
      await lua.doString(
        `return on_action(state,{type='bell',declaration='lucky',round=0,step=0},{actor={id='p0'}}).ignored`,
      ),
      true,
    );
    assert.deepEqual(
      await lua.doString("return state"),
      luaCompatible(unchanged),
    );
  } finally {
    lua.global.close();
  }
});

test("strong fixed boards fit the instruction budget through setup, next round and rematch", async (t) => {
  const lua = await openLua();
  try {
    // Override only the shuffle in this test chunk, keeping the complete real deal
    // and including the extra board-placement work in the instruction count.
    await lua.doString(
      (await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      )) +
        `
      local real_shuffle = shuffle
      local forced_fixed
      shuffle = function(state, deck)
        real_shuffle(state, deck)
        if forced_fixed and #deck == 52 then
          for index, target in ipairs(forced_fixed) do
            local destination = 52 - 16 - index + 1
            for position, card in ipairs(deck) do
              if card.rank == target.rank and card.suit == target.suit then
                deck[destination], deck[position] = deck[position], deck[destination]
                break
              end
            end
          end
        end
        return deck
      end
      function check_strong_deals(boards, players)
        local peaks = {setup = 0, nextRound = 0, rematch = 0}
        local function measure(kind, call)
          local fuel = 0
          debug.sethook(function()
            fuel = fuel + 1000
            assert(fuel <= 50000, 'instruction quota exceeded')
          end, '', 1000)
          local result = call()
          debug.sethook()
          peaks[kind] = math.max(peaks[kind], fuel)
          return result
        end
        for _, board in ipairs(boards) do
          forced_fixed = board
          for seed = 1, 20 do
            local state = measure('setup', function()
              return setup({players = players, match = {randomSeed = string.format('%x',seed)}}).state
            end)
            for index, card in ipairs(state.fixed) do
              assert(card.rank == board[index].rank and card.suit == board[index].suit)
            end
            state.phase = 'round_end'
            measure('nextRound', function()
              return on_action(state,{type='next_round',round=state.round,step=state.step},{actor={id='p0'}})
            end)
            state.phase = 'ended'
            measure('rematch', function()
              return on_action(state,{type='rematch',round=state.round,step=state.step},{actor={id='p0'}})
            end)
          end
        end
        return peaks
      end
    `,
    );
    const peaks = await lua.doString(
      `return check_strong_deals(${luaLiteral(strongFixedBoards)},${luaLiteral(players(8))})`,
    );
    for (const [kind, peak] of Object.entries(peaks)) {
      assert.ok(
        peak <= 15000,
        `${kind} strong-board optimization regressed: ${peak}`,
      );
    }
    t.diagnostic(
      `8-player strong-board instruction peaks: ${JSON.stringify(peaks)}; platform limit: 50000`,
    );
  } finally {
    lua.global.close();
  }
});

test("room setup, projections, scoring and worst-case forced checks fit the platform 50,000-instruction budget", async () => {
  const lua = await openLua();
  try {
    await lua.doString(
      await readFile(
        new URL("../public/halli-holdem/game.lua", import.meta.url),
        "utf8",
      ),
    );
    await lua.doString(`
      function budget(call)
        local fuel = 0
        debug.sethook(function() fuel = fuel + 1000; assert(fuel <= 50000,'instruction quota exceeded') end,'',1000)
        local result = call()
        debug.sethook()
        return result
      end
      function deep_copy(value)
        if type(value) ~= 'table' then return value end
        local result = {}
        for key, entry in pairs(value) do result[key] = deep_copy(entry) end
        return result
      end
    `);
    for (const count of PLAYER_COUNTS) {
      await lua.doString(
        `state = budget(function() return setup({players=${luaLiteral(players(count))},match={randomSeed='abcd'}}).state end)`,
      );
      for (let turn = 0; turn < 47 - 2 * count; turn++) {
        await lua.doString(
          `budget(function() return on_action(state,{type='draw',round=state.round,step=state.step},{actor={id=state.players[state.turn+1].id}}) end)`,
        );
        await lua.doString(
          `budget(function() return view(state,{}, {viewer={id=state.players[1].id}}) end)`,
        );
        if (turn === 1 || turn === 15 || turn === 25) {
          await lua.doString(
            `local copy=deep_copy(state);budget(function() return on_action(copy,{type='bell',declaration='forced',round=copy.round,step=copy.step},{actor={id=copy.players[copy.turn+1].id}}) end)`,
          );
        }
        await lua.doString(
          `budget(function() return on_action(state,{type='place',index=0,round=state.round,step=state.step},{actor={id=state.players[state.turn+1].id}}) end)`,
        );
        await lua.doString(
          `for stage=1,2 do budget(function() return on_timer(state,{id='halli-window',payload={round=state.round,step=state.step,stage=state.window.stage}},{firedAt=state.window.untilAt}) end) end`,
        );
      }
    }
  } finally {
    lua.global.close();
  }
});

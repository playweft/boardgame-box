export const HAND_NAMES = [
  "高牌",
  "一对",
  "两对",
  "三条",
  "顺子",
  "同花",
  "葫芦",
  "四条",
  "同花顺",
];
export const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8];
export const victoryTarget = (playerCount) => 7 + 2 * playerCount;
const BURST_REWARDS = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 8, 8: 9 };
export const WINDOW_TIMER_ID = "halli-window";
const REVEAL_DELAY_MS = 2000;
const DRAW_DELAY_MS = 3000;

const waitingForBell = (state) =>
  ["hidden", "revealed"].includes(state.window?.stage);
const windowTimer = (state, afterMs) => ({
  op: "schedule",
  id: WINDOW_TIMER_ID,
  afterMs,
  payload: { round: state.round, step: state.step, stage: state.window.stage },
});
const MODULUS = 2147483647;

export function compareHands(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function straightHigh(ranks) {
  const unique = new Set(ranks);
  if (unique.has(14)) unique.add(1);
  for (let high = 14; high >= 5; high--) {
    if ([0, 1, 2, 3, 4].every((offset) => unique.has(high - offset)))
      return high;
  }
  return 0;
}

// Select the best five directly from rank groups; do not enumerate five-card subsets.
// Short hands use the same comparison tuple, with missing kickers below every rank.
export function evaluateHand(cards) {
  const counts = new Map();
  const suits = new Map();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
    if (!suits.has(card.suit)) suits.set(card.suit, []);
    suits.get(card.suit).push(card.rank);
  }
  const ranks = [...counts.keys()].sort((a, b) => b - a);
  const groups = (size) => ranks.filter((rank) => counts.get(rank) >= size);
  const kickers = (excluded, count) =>
    ranks.filter((rank) => !excluded.includes(rank)).slice(0, count);
  const flushes =
    cards.length >= 5
      ? [...suits.values()]
          .filter((ranks) => ranks.length >= 5)
          .map((ranks) => ranks.sort((a, b) => b - a))
      : [];
  const straightFlush = Math.max(0, ...flushes.map(straightHigh));
  if (straightFlush) return [8, straightFlush];
  const fours = groups(4);
  if (fours.length) return [7, fours[0], ...kickers([fours[0]], 1)];
  const trips = groups(3);
  const pairs = groups(2);
  const fullPair = trips.length && pairs.find((rank) => rank !== trips[0]);
  if (cards.length >= 5 && fullPair) return [6, trips[0], fullPair];
  if (flushes.length)
    return flushes
      .map((ranks) => [5, ...ranks.slice(0, 5)])
      .sort((a, b) => compareHands(b, a))[0];
  const straight = cards.length >= 5 && straightHigh(ranks);
  if (straight) return [4, straight];
  if (trips.length) return [3, trips[0], ...kickers([trips[0]], 2)];
  if (pairs.length >= 2)
    return [2, ...pairs.slice(0, 2), ...kickers(pairs.slice(0, 2), 1)];
  if (pairs.length) return [1, pairs[0], ...kickers([pairs[0]], 3)];
  return [0, ...ranks.slice(0, 5)];
}

function straightWithHoleHigh(holeCards, fixed, suit) {
  const present = new Set(fixed.map((card) => card.rank));
  const owned = new Set(
    holeCards
      .filter((card) => !suit || card.suit === suit)
      .map((card) => card.rank),
  );
  for (const rank of owned) present.add(rank);
  if (present.has(14)) present.add(1);
  if (owned.has(14)) owned.add(1);
  for (let high = 14; high >= 5; high--) {
    let complete = true;
    let usesHole = false;
    for (let offset = 0; offset < 5; offset++) {
      const rank = high - offset;
      if (!present.has(rank)) {
        complete = false;
        break;
      }
      if (owned.has(rank)) usesHole = true;
    }
    if (complete && usesHole) return high;
  }
  return 0;
}

// Fixed boards have five cards and each player has two distinct hole cards.
export function evaluateFixedHand(
  holeCards,
  fixed,
  boardHand = evaluateHand(fixed),
) {
  if (boardHand[0] === 7) {
    // All four cards of this rank are on the board; a hole card must be the kicker.
    return [7, boardHand[1], Math.max(holeCards[0].rank, holeCards[1].rank)];
  }
  if (boardHand[0] === 8) {
    const suit = fixed[0].suit;
    const matching = holeCards.some((card) => card.suit === suit);
    const high = straightWithHoleHigh(holeCards, fixed, matching ? suit : null);
    if (high) return [matching ? 8 : 4, high];
    // A matching hole guarantees a flush; otherwise no legal straight leaves
    // only a hole pair or high cards. Each uses the four highest board cards.
    const highestFour = [...fixed].sort((a, b) => b.rank - a.rank).slice(0, 4);
    return evaluateHand([...holeCards, ...highestFour]);
  }

  const unrestricted = evaluateHand([...holeCards, ...fixed]);
  // A result stronger than the board alone necessarily uses a hole card.
  if (compareHands(unrestricted, boardHand) > 0) return unrestricted;

  // Removing one board card forces every selected five to use a hole card.
  // Reuse six slots and stop as soon as we reach the unrestricted upper bound.
  const remaining = [...holeCards, ...fixed.slice(1)];
  let best = [0];
  for (let omitted = 0; omitted < fixed.length; omitted++) {
    const hand = evaluateHand(remaining);
    if (compareHands(hand, unrestricted) === 0) return hand;
    if (compareHands(hand, best) > 0) best = hand;
    if (omitted < fixed.length - 1) remaining[omitted + 2] = fixed[omitted];
  }
  return best;
}

export function tableResults(state, board, requireHoleCard = false) {
  const boardHand = requireHoleCard ? evaluateHand(board) : null;
  return Object.fromEntries(
    state.players.map((player) => [
      player.id,
      requireHoleCard
        ? evaluateFixedHand(state.hands[player.id], board, boardHand)
        : evaluateHand([...state.hands[player.id], ...board]),
    ]),
  );
}

export function strongest(results) {
  return Object.values(results).reduce(
    (best, hand) => (compareHands(hand, best) > 0 ? hand : best),
    [0],
  );
}

export function normalizeSeed(value) {
  let seed = 0;
  for (const character of String(value ?? "")) {
    const digit = Number.parseInt(character, 16);
    if (!Number.isNaN(digit)) seed = (seed * 16 + digit) % MODULUS;
  }
  return seed || 1;
}

function nextRandom(state) {
  state.seed = (state.seed * 48271) % MODULUS;
  return state.seed;
}

function shuffle(state, cards) {
  for (let index = cards.length - 1; index > 0; index--) {
    const swap = nextRandom(state) % (index + 1);
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return cards;
}

function nextRoundStarter(state) {
  const index = Math.max(
    0,
    state.players.findIndex((player) => player.id === state.roundStarterId),
  );
  return state.players[(index + 1) % state.players.length].id;
}

function dealRound(state, starterId) {
  const deck = [];
  for (const suit of ["spades", "hearts", "clubs", "diamonds"]) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  shuffle(state, deck);
  state.hands = {};
  for (const player of state.players)
    state.hands[player.id] = [deck.pop(), deck.pop()];
  state.fixed = Array.from({ length: 5 }, () => deck.pop());
  const permanentCount = Math.ceil(deck.length / 3);
  state.permanentDeck = deck.splice(deck.length - permanentCount);
  state.ordinaryDeck = deck;
  state.ordinaryDiscard = [];
  state.recentOrdinaryDiscard = [];
  state.permanentDiscard = [];
  state.dynamic = [];
  state.candidates = [];
  state.pendingDiscards = [];
  state.discardSlots = [];
  state.window = null;
  state.phase = "before_draw";
  state.turn = starterId
    ? state.players.findIndex((player) => player.id === starterId)
    : nextRandom(state) % state.players.length;
  state.roundStarterId = state.players[state.turn].id;
  state.fixedResults = tableResults(state, state.fixed, true);
  state.fixedStrength = strongest(state.fixedResults);
  state.dynamicResults = tableResults(state, state.dynamic);
  state.dynamicStrength = strongest(state.dynamicResults);
  state.settlement = null;
  state.winners = [];
}

export function createGame(
  players,
  seed = Math.floor(Math.random() * (MODULUS - 1)) + 1,
) {
  if (
    !PLAYER_COUNTS.includes(players.length) ||
    new Set(players.map((player) => player.id)).size !== players.length ||
    players.some((player) => !player.id)
  ) {
    throw new Error("需要 2–8 名不同的玩家");
  }
  const state = {
    players: players.map((player, index) => ({
      id: player.id,
      name: player.name || `玩家 ${index + 1}`,
      seat: player.seat ?? index + 1,
    })),
    scores: Object.fromEntries(players.map((player) => [player.id, 0])),
    round: 1,
    step: 0,
    seed:
      typeof seed === "number"
        ? Math.max(1, Math.floor(seed) % MODULUS)
        : normalizeSeed(seed),
  };
  dealRound(state);
  return state;
}

function commitDiscards(state) {
  state.recentOrdinaryDiscard = [];
  for (const card of state.pendingDiscards) {
    state[
      card.source === "ordinary" ? "ordinaryDiscard" : "permanentDiscard"
    ].push({ rank: card.rank, suit: card.suit });
    if (card.source === "ordinary")
      state.recentOrdinaryDiscard.push({ rank: card.rank, suit: card.suit });
  }
  state.pendingDiscards = [];
}

function drawFrom(state, source, count) {
  const deckKey = source + "Deck";
  const discardKey = source + "Discard";
  for (let index = 0; index < count; index++) {
    if (!state[deckKey].length) {
      state[deckKey] = shuffle(state, state[discardKey]);
      state[discardKey] = [];
    }
    if (!state[deckKey].length) break;
    state.candidates.push({ ...state[deckKey].pop(), source });
  }
}

function settle(state, actorId, declaration) {
  const burst = compareHands(state.dynamicStrength, state.fixedStrength) > 0;
  let correct;
  let checks = [];
  if (declaration === "burst") correct = burst;
  if (declaration === "forced") {
    checks = state.candidates.map((card) => {
      const strength = strongest(tableResults(state, [...state.dynamic, card]));
      return {
        card: { rank: card.rank, suit: card.suit, source: card.source },
        strength,
        burst: compareHands(strength, state.fixedStrength) > 0,
      };
    });
    correct =
      !burst && checks.length === 3 && checks.every((check) => check.burst);
  }
  if (declaration === "lucky") {
    const own = state.fixedResults[actorId];
    correct =
      own[0] >= 4 &&
      state.players.every(
        (player) =>
          player.id === actorId ||
          compareHands(own, state.fixedResults[player.id]) >= 0,
      );
  }
  const deltas = Object.fromEntries(
    state.players.map((player) => [player.id, 0]),
  );
  if (!correct) {
    const transfer = state.players.length === 2 ? 2 : 1;
    for (const player of state.players)
      deltas[player.id] =
        player.id === actorId
          ? -transfer * (state.players.length - 1)
          : transfer;
  } else if (declaration === "burst") {
    const reward = BURST_REWARDS[state.players.length];
    deltas[actorId] = reward;
    deltas[state.window.placerId] = 1 - reward;
  } else {
    for (const player of state.players)
      deltas[player.id] = player.id === actorId ? state.players.length : -1;
  }
  for (const player of state.players)
    state.scores[player.id] += deltas[player.id];
  const highest = Math.max(...Object.values(state.scores));
  state.winners =
    highest >= victoryTarget(state.players.length)
      ? state.players
          .filter((player) => state.scores[player.id] === highest)
          .map((player) => player.id)
      : [];
  state.settlement = {
    reason: "bell",
    actorId,
    declaration,
    correct,
    deltas,
    checks,
    wasBurst: burst,
    liableId: declaration === "burst" ? state.window.placerId : null,
    nextStarterId: nextRoundStarter(state),
    fixedResults: state.fixedResults,
    dynamicResults: state.dynamicResults,
    fixedStrength: state.fixedStrength,
    dynamicStrength: state.dynamicStrength,
  };
  state.phase = state.winners.length ? "ended" : "round_end";
  state.window = null;
}

const accepted = (state, ignored = false, timerOps) => ({
  accepted: true,
  state,
  ignored,
  events: [],
  ...(timerOps ? { timerOps } : {}),
});
const rejected = (error) => ({ accepted: false, error });

export function applyAction(state, actorId, action, context = {}) {
  if (!state.players.some((player) => player.id === actorId))
    return rejected("只有入座玩家可以操作");
  if (
    !action ||
    !["draw", "place", "bell", "next_round", "rematch"].includes(action.type)
  )
    return rejected("未知操作");
  // A delayed click may arrive after a draw or a new round. It must never become a new declaration.
  if (action.round !== state.round || action.step !== state.step)
    return accepted(state, true);
  const ownTurn = state.players[state.turn].id === actorId;
  let timerOps;
  if (action.type === "bell") {
    const declaration =
      action.declaration ??
      (ownTurn && state.phase === "choosing" ? "forced" : "burst");
    if (!["burst", "forced", "lucky"].includes(declaration))
      return rejected("无效的拍铃类型");
    const valid =
      declaration === "burst"
        ? state.phase === "before_draw" &&
          state.window &&
          state.window.placerId !== actorId
        : declaration === "forced"
          ? ownTurn &&
            state.phase === "choosing" &&
            state.candidates.length === 3
          : ownTurn && state.phase === "before_draw";
    if (!valid) return accepted(state, true);
    if (waitingForBell(state))
      timerOps = [{ op: "cancel", id: WINDOW_TIMER_ID }];
    settle(state, actorId, declaration);
  } else if (action.type === "draw") {
    if (!ownTurn || state.phase !== "before_draw")
      return rejected("请等待你的抽牌回合");
    if (waitingForBell(state)) return rejected("请等待拍铃时间结束");
    // Older persisted rounds may still have leftovers waiting for this draw.
    if (state.pendingDiscards.length) commitDiscards(state);
    state.window = null;
    state.discardSlots = [];
    state.candidates = [];
    drawFrom(state, "ordinary", 2);
    drawFrom(state, "permanent", 1);
    if (!state.candidates.length) {
      state.phase = "round_end";
      state.settlement = {
        reason: "exhausted",
        nextStarterId: nextRoundStarter(state),
        deltas: Object.fromEntries(
          state.players.map((player) => [player.id, 0]),
        ),
      };
    } else state.phase = "choosing";
  } else if (action.type === "place") {
    if (!ownTurn || state.phase !== "choosing")
      return rejected("只有当前玩家可以选牌");
    if (
      !Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index >= state.candidates.length
    )
      return rejected("请选择一张候选牌");
    const card = state.candidates[action.index];
    state.discardSlots = state.candidates.map((candidate, index) =>
      index === action.index
        ? { empty: true, source: candidate.source }
        : { ...candidate },
    );
    state.dynamic.push({ rank: card.rank, suit: card.suit });
    state.pendingDiscards = state.candidates.filter(
      (_, index) => index !== action.index,
    );
    state.candidates = [];
    state.dynamicResults = tableResults(state, state.dynamic);
    state.dynamicStrength = strongest(state.dynamicResults);
    state.recentOrdinaryDiscard = [];
    state.window = {
      placerId: actorId,
      stage: "hidden",
      untilAt: (context.serverTime ?? 0) + REVEAL_DELAY_MS,
    };
    state.turn = (state.turn + 1) % state.players.length;
    state.phase = "before_draw";
  } else if (action.type === "next_round") {
    if (state.phase !== "round_end") return rejected("本轮尚未结束");
    const starterId = nextRoundStarter(state);
    state.round++;
    dealRound(state, starterId);
  } else if (action.type === "rematch") {
    if (state.phase !== "ended") return rejected("整局尚未结束");
    const next = createGame(state.players, nextRandom(state));
    // Keep the generation monotonic so a previous match's clicks cannot match the new state.
    next.round = state.round + 1;
    next.step = state.step + 1;
    return accepted(next);
  }
  state.step++;
  if (action.type === "place") timerOps = [windowTimer(state, REVEAL_DELAY_MS)];
  return accepted(state, false, timerOps);
}

export function applyTimer(state, timer, context = {}) {
  const payload = timer?.payload;
  const result = { state, events: [] };
  if (
    timer?.id !== WINDOW_TIMER_ID ||
    !payload ||
    state.phase !== "before_draw" ||
    !waitingForBell(state) ||
    payload.round !== state.round ||
    payload.step !== state.step ||
    payload.stage !== state.window.stage
  )
    return result;
  if (state.window.stage === "hidden") {
    commitDiscards(state);
    state.window.stage = "revealed";
    // Give three full seconds after actual publication, even if this alarm was late.
    state.window.untilAt =
      (context.firedAt ?? context.dueAt ?? state.window.untilAt) +
      DRAW_DELAY_MS;
    result.timerOps = [windowTimer(state, DRAW_DELAY_MS)];
  } else {
    state.window.stage = "ready";
    delete state.window.untilAt;
  }
  // Keep the action generation: reveal/unlock belongs to the same bell window.
  return result;
}

export function projectGame(state, viewerId) {
  const seated = state.players.some((player) => player.id === viewerId);
  const reveal = state.settlement?.reason === "bell";
  const ownTurn = seated && state.players[state.turn].id === viewerId;
  return {
    players: state.players.map((player) => ({ ...player })),
    scores: { ...state.scores },
    targetScore: victoryTarget(state.players.length),
    round: state.round,
    step: state.step,
    phase: state.phase,
    viewerId,
    currentPlayerId: state.players[state.turn].id,
    hands: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        state.hands[player.id].map((card) =>
          reveal || (seated && player.id !== viewerId)
            ? { ...card }
            : { hidden: true },
        ),
      ]),
    ),
    fixed: state.fixed.map((card) => ({ ...card })),
    dynamic: state.dynamic.map((card) => ({ ...card })),
    ordinaryDiscard: state.ordinaryDiscard.map((card) => ({ ...card })),
    recentOrdinaryDiscard: state.recentOrdinaryDiscard.map((card) => ({
      ...card,
    })),
    counts: {
      ordinaryDeck: state.ordinaryDeck.length,
      permanentDeck: state.permanentDeck.length,
      permanentDiscard: state.permanentDiscard.length,
    },
    candidates:
      ownTurn && state.phase === "choosing"
        ? state.candidates.map((card) => ({ ...card }))
        : [],
    candidateCount: state.candidates.length,
    discardSlots: state.window
      ? (state.discardSlots || []).map((card) =>
          card.empty ||
          state.window.placerId === viewerId ||
          (card.source === "ordinary" && state.window.stage !== "hidden")
            ? { ...card }
            : { hidden: true, source: card.source },
        )
      : [],
    window: state.window ? { ...state.window } : null,
    canDraw: ownTurn && state.phase === "before_draw" && !waitingForBell(state),
    canPlace: ownTurn && state.phase === "choosing",
    canBurst:
      seated &&
      state.phase === "before_draw" &&
      !!state.window &&
      state.window.placerId !== viewerId,
    // These indicate eligibility, not whether the hidden-card claim would be correct.
    canForced:
      ownTurn && state.phase === "choosing" && state.candidates.length === 3,
    canLucky: ownTurn && state.phase === "before_draw",
    settlement: state.settlement ? structuredClone(state.settlement) : null,
    winners: [...state.winners],
  };
}

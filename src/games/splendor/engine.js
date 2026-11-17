import { CARDS, COLORS, NOBLES, TOKEN_COLORS } from "./data.js";
export { CARDS, COLORS, NOBLES, TOKEN_COLORS, COLOR_NAMES } from "./data.js";

const MODULUS = 2147483647;
export const tokenCount = tokens => TOKEN_COLORS.reduce((sum, color) => sum + tokens[color], 0);
const emptyTokens = () => Object.fromEntries(TOKEN_COLORS.map(color => [color, 0]));

function normalizeSeed(value) {
  let seed = 0;
  for (const character of String(value)) if (/[0-9a-f]/i.test(character))
    seed = (seed * 16 + parseInt(character, 16)) % MODULUS;
  return seed || 1;
}

function shuffle(state, list) {
  for (let index = list.length - 1; index > 0; index--) {
    state.seed = state.seed * 48271 % MODULUS;
    const target = state.seed % (index + 1);
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list;
}

export function createGame(players, seed = Date.now().toString(16)) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4
    || players.some(p => !p || typeof p.id !== "string" || !p.id)
    || new Set(players.map(p => p.id)).size !== players.length) throw new Error("需要 2–4 名不同的玩家");
  const state = {
    players: players.map((p, index) => ({ id: p.id, name: p.name || `玩家 ${index + 1}` })),
    boards: Object.fromEntries(players.map(p => [p.id, {
      tokens: emptyTokens(), bonuses: Object.fromEntries(COLORS.map(c => [c, 0])),
      purchased: [], reserved: [], nobles: [], score: 0,
    }])),
    bank: Object.fromEntries(TOKEN_COLORS.map(c => [c, c === "gold" ? 5 : [0, 0, 4, 5, 7][players.length]])),
    decks: [], market: [], nobles: [], round: 1, turn: 0, step: 0,
    phase: "playing", endingRound: null, winners: [], lastMove: null, history: [], seed: normalizeSeed(seed),
  };
  for (let level = 1; level <= 3; level++) {
    const deck = shuffle(state, structuredClone(CARDS.filter(card => card.level === level)));
    const row = [];
    for (let slot = 0; slot < 4; slot++) row.push(deck.pop());
    state.decks.push(deck); state.market.push(row);
  }
  state.nobles = shuffle(state, structuredClone(NOBLES)).slice(0, players.length + 1);
  return state;
}

export function costAfterBonuses(board, card) {
  return Object.fromEntries(COLORS.map(color => [color, Math.max(0, card.cost[color] - board.bonuses[color])]));
}

export function paymentFor(board, card) {
  const due = costAfterBonuses(board, card), payment = emptyTokens();
  for (const color of COLORS) {
    payment[color] = Math.min(due[color], board.tokens[color]);
    payment.gold += due[color] - payment[color];
  }
  return payment.gold <= board.tokens.gold ? payment : null;
}

export function eligibleNobles(state, playerId) {
  const board = state.boards[playerId];
  return state.nobles.filter(noble => COLORS.every(c => board.bonuses[c] >= noble.cost[c]));
}

function finishTurn(state) {
  const board = state.boards[state.players[state.turn].id];
  if (board.score >= 15 && state.endingRound === null) state.endingRound = state.round;
  state.history = [...state.history.slice(-39), structuredClone(state.lastMove)];
  const next = (state.turn + 1) % state.players.length;
  state.phase = "playing";
  if (next === 0 && state.endingRound !== null) {
    state.phase = "ended";
    const highest = Math.max(...state.players.map(p => state.boards[p.id].score));
    const tied = state.players.filter(p => state.boards[p.id].score === highest);
    const fewest = Math.min(...tied.map(p => state.boards[p.id].purchased.length));
    state.winners = tied.filter(p => state.boards[p.id].purchased.length === fewest).map(p => p.id);
    return;
  }
  state.turn = next;
  if (next === 0) state.round++;
}

function claimNoble(state, noble) {
  const board = state.boards[state.players[state.turn].id];
  state.nobles.splice(state.nobles.findIndex(n => n.id === noble.id), 1);
  board.nobles.push(noble); board.score += noble.points;
  state.lastMove.nobleId = noble.id;
}

function checkNobles(state) {
  const eligible = eligibleNobles(state, state.players[state.turn].id);
  if (eligible.length > 1) { state.phase = "choose_noble"; return; }
  if (eligible.length === 1) claimNoble(state, eligible[0]);
  finishTurn(state);
}

function afterAction(state) {
  if (tokenCount(state.boards[state.players[state.turn].id].tokens) > 10) state.phase = "return_tokens";
  else checkNobles(state);
}

function locateCard(state, board, id, includeReserved = true) {
  if (typeof id !== "string") return null;
  for (let level = 0; level < 3; level++) {
    const slot = state.market[level].findIndex(card => card.id === id);
    if (slot !== -1) return { card: state.market[level][slot], level, slot, reserved: false };
  }
  const slot = includeReserved ? board.reserved.findIndex(card => card.id === id) : -1;
  return slot === -1 ? null : { card: board.reserved[slot], slot, reserved: true };
}

function removeCard(state, board, located) {
  if (located.reserved) board.reserved.splice(located.slot, 1);
  else {
    const replacement = state.decks[located.level].pop();
    if (replacement) state.market[located.level][located.slot] = replacement;
    else state.market[located.level].splice(located.slot, 1);
  }
}

function validTokens(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every(c => TOKEN_COLORS.includes(c))
    && TOKEN_COLORS.every(c => value[c] === undefined || (Number.isInteger(value[c]) && value[c] >= 0));
}

function canPass(state, board) {
  if (COLORS.some(color => state.bank[color] > 0)) return false;
  if (board.reserved.length < 3 && (state.decks.some(deck => deck.length) || state.market.some(row => row.length))) return false;
  return !state.market.some(row => row.some(card => paymentFor(board, card)))
    && !board.reserved.some(card => paymentFor(board, card));
}

const reject = message => ({ accepted: false, error: { code: "INVALID_ACTION", message } });

export function applyAction(state, actorId, action) {
  if (!state.players.some(p => p.id === actorId)) return reject("只有入座玩家可以操作");
  if (!action || typeof action !== "object" || Array.isArray(action)) return reject("未知操作");
  if (action.step !== state.step || action.round !== state.round) return reject("局面已更新，请重新选择");
  if (action.type === "rematch") {
    if (state.phase !== "ended") return reject("整局尚未结束");
    const roster = [...state.players.slice(1), state.players[0]];
    const fresh = createGame(roster, state.seed.toString(16));
    fresh.step = state.step + 1;
    Object.assign(state, fresh);
    return { accepted: true, state, events: [] };
  }
  if (state.phase === "ended" || state.players[state.turn].id !== actorId) return reject("请等待你的回合");
  const board = state.boards[actorId];
  if (state.phase === "return_tokens") {
    if (action.type !== "return_tokens" || !validTokens(action.tokens)) return reject("请先归还超出的宝石");
    const returned = { ...emptyTokens(), ...action.tokens };
    if (TOKEN_COLORS.some(c => returned[c] > board.tokens[c]) || tokenCount(returned) !== tokenCount(board.tokens) - 10)
      return reject("请恰好归还超出 10 枚的宝石");
    for (const c of TOKEN_COLORS) { board.tokens[c] -= returned[c]; state.bank[c] += returned[c]; }
    state.lastMove.returned = returned;
    checkNobles(state);
  } else if (state.phase === "choose_noble") {
    const noble = eligibleNobles(state, actorId).find(n => n.id === action.nobleId);
    if (action.type !== "choose_noble" || !noble) return reject("请选择一位满足条件的贵族");
    claimNoble(state, noble); finishTurn(state);
  } else if (action.type === "pass") {
    if (!canPass(state, board)) return reject("还有可用操作，不能跳过回合");
    state.lastMove = { playerId: actorId, type: "pass", round: state.round };
    checkNobles(state);
  } else if (action.type === "take") {
    if (!Array.isArray(action.colors) || action.colors.length < 1 || action.colors.length > 3
      || action.colors.some(c => !COLORS.includes(c))) return reject("请选择宝石颜色");
    const counts = emptyTokens();
    action.colors.forEach(c => counts[c]++);
    const distinct = new Set(action.colors).size;
    if (distinct === 1 && action.colors.length === 2) {
      if (state.bank[action.colors[0]] < 4) return reject("拿取同色两枚前，该颜色供应须至少 4 枚");
    } else if (distinct !== action.colors.length || distinct !== Math.min(3, COLORS.filter(c => state.bank[c] > 0).length)) {
      return reject("请选择三种不同颜色；不足三种时拿取所有可用颜色");
    }
    if (COLORS.some(c => counts[c] > state.bank[c])) return reject("供应区宝石不足");
    for (const c of TOKEN_COLORS) { board.tokens[c] += counts[c]; state.bank[c] -= counts[c]; }
    state.lastMove = { playerId: actorId, type: "take", tokens: counts, round: state.round };
    afterAction(state);
  } else if (action.type === "reserve") {
    if (board.reserved.length >= 3) return reject("最多预留三张发展卡");
    let card, located;
    if (action.blind === true) {
      if (!Number.isInteger(action.level) || action.level < 1 || action.level > 3 || !state.decks[action.level - 1].length)
        return reject("这叠牌已经用完");
      card = state.decks[action.level - 1].pop();
    } else {
      located = locateCard(state, board, action.cardId, false);
      if (!located) return reject("这张公开牌已不在市场");
      card = located.card; removeCard(state, board, located);
    }
    board.reserved.push(card);
    const gold = state.bank.gold > 0 ? 1 : 0;
    board.tokens.gold += gold; state.bank.gold -= gold;
    state.lastMove = { playerId: actorId, type: "reserve", level: card.level, blind: action.blind === true, gold, round: state.round };
    afterAction(state);
  } else if (action.type === "buy") {
    const located = locateCard(state, board, action.cardId);
    if (!located) return reject("请选择市场或自己预留中的发展卡");
    if (action.payment !== undefined && !validTokens(action.payment)) return reject("支付方案无效");
    const payment = action.payment === undefined ? paymentFor(board, located.card) : { ...emptyTokens(), ...action.payment };
    const due = costAfterBonuses(board, located.card);
    if (!payment || TOKEN_COLORS.some(c => payment[c] > board.tokens[c]) || COLORS.some(c => payment[c] > due[c])
      || payment.gold !== COLORS.reduce((sum, c) => sum + due[c] - payment[c], 0)) return reject("宝石不足或支付方案不正确");
    for (const c of TOKEN_COLORS) { board.tokens[c] -= payment[c]; state.bank[c] += payment[c]; }
    removeCard(state, board, located);
    board.purchased.push(located.card); board.bonuses[located.card.bonus]++; board.score += located.card.points;
    state.lastMove = { playerId: actorId, type: "buy", cardId: located.card.id, payment, round: state.round };
    afterAction(state);
  } else return reject("未知操作");
  state.step++;
  return { accepted: true, state, events: [] };
}

export function projectGame(state, viewerId) {
  const seated = state.players.some(p => p.id === viewerId);
  const canAct = seated && state.phase !== "ended" && state.players[state.turn].id === viewerId;
  return {
    players: state.players,
    boards: Object.fromEntries(state.players.map(p => [p.id, {
      ...state.boards[p.id], reserved: p.id === viewerId ? state.boards[p.id].reserved
        : state.boards[p.id].reserved.map(card => ({ hidden: true, level: card.level })),
    }])),
    bank: state.bank, market: state.market, nobles: state.nobles,
    counts: state.decks.map(deck => deck.length), round: state.round, step: state.step,
    phase: state.phase, endingRound: state.endingRound, currentPlayerId: state.players[state.turn].id,
    viewerId, canAct, canPass: canAct && state.phase === "playing" && canPass(state, state.boards[viewerId]),
    canRematch: seated && state.phase === "ended", winners: state.winners,
    eligibleNobleIds: state.phase === "choose_noble" ? eligibleNobles(state, state.players[state.turn].id).map(n => n.id) : [],
    lastMove: state.lastMove, history: state.history,
  };
}

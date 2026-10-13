export const COLORS = ["蓝", "黄", "红", "黑", "白"];
export const FLOOR_COSTS = [1, 1, 2, 2, 2, 3, 3];
export const WALL_COLORS = Array.from({ length: 5 }, (_, row) =>
  Array.from({ length: 5 }, (_, column) => (column - row + 5) % 5));
const MODULUS = 2147483647;

function normalizeSeed(value) {
  let seed = 0;
  for (const character of String(value)) {
    if (/[0-9a-f]/i.test(character)) seed = (seed * 16 + parseInt(character, 16)) % MODULUS;
  }
  return seed || 1;
}

function shuffle(state, tiles) {
  for (let index = tiles.length - 1; index > 0; index--) {
    state.seed = state.seed * 48271 % MODULUS;
    const target = state.seed % (index + 1);
    [tiles[index], tiles[target]] = [tiles[target], tiles[index]];
  }
  return tiles;
}

function fillFactories(state) {
  state.factories = Array.from({ length: 2 * state.players.length + 1 }, () => []);
  for (const factory of state.factories) {
    for (let count = 0; count < 4; count++) {
      if (!state.bag.length) state.bag = shuffle(state, state.discard.splice(0));
      if (!state.bag.length) break;
      factory.push(state.bag.pop());
    }
  }
  state.center = [];
  state.centerMarker = true;
  state.nextStarterId = null;
  state.phase = "drafting";
  state.settlement = null;
}

export function createGame(players, seed = Date.now().toString(16)) {
  if (players.length < 2 || players.length > 4 || new Set(players.map(p => p.id)).size !== players.length)
    throw new Error("需要 2–4 名不同的玩家");
  const state = {
    players: players.map((player, index) => ({ id: player.id, name: player.name || `玩家 ${index + 1}` })),
    boards: {}, bag: [], discard: [], factories: [], center: [], centerMarker: true,
    seed: normalizeSeed(seed), round: 1, step: 0, turn: 0,
    starterId: players[0].id, nextStarterId: null, phase: "drafting", settlement: null, winners: [], lastMove: null,
  };
  for (const player of state.players) state.boards[player.id] = {
    score: 0, lines: Array.from({ length: 5 }, () => []),
    wall: Array.from({ length: 5 }, () => Array(5).fill(false)), floor: [],
  };
  state.bag = shuffle(state, Array.from({ length: 100 }, (_, index) => Math.floor(index / 20)));
  fillFactories(state);
  return state;
}

export function canPlace(board, row, color) {
  if (!Number.isInteger(row) || row < 0 || row > 4 || !Number.isInteger(color) || color < 0 || color > 4) return false;
  const line = board.lines[row];
  return line.length < row + 1 && (!line.length || line[0] === color)
    && !board.wall[row][WALL_COLORS[row].indexOf(color)];
}

export function wallScore(wall, row, column) {
  let horizontal = 1, vertical = 1;
  for (const direction of [-1, 1]) {
    for (let x = column + direction; x >= 0 && x < 5 && wall[row][x]; x += direction) horizontal++;
    for (let y = row + direction; y >= 0 && y < 5 && wall[y][column]; y += direction) vertical++;
  }
  return horizontal === 1 && vertical === 1 ? 1
    : (horizontal > 1 ? horizontal : 0) + (vertical > 1 ? vertical : 0);
}

export function wallBonuses(wall) {
  const rows = wall.filter(row => row.every(Boolean)).length;
  const columns = Array.from({ length: 5 }, (_, column) => wall.every(row => row[column])).filter(Boolean).length;
  const colors = Array.from({ length: 5 }, (_, color) => wall.every((row, index) => row[WALL_COLORS[index].indexOf(color)])).filter(Boolean).length;
  return { rows, columns, colors, points: rows * 2 + columns * 7 + colors * 10 };
}

function addFloor(state, board, tiles) {
  for (const color of tiles) {
    if (board.floor.length < 7) board.floor.push(color);
    else if (color !== -1) state.discard.push(color);
  }
}

export function settleRound(state) {
  const results = {};
  for (const player of state.players) {
    const board = state.boards[player.id];
    const before = board.score;
    const placements = [];
    for (let row = 0; row < 5; row++) {
      const line = board.lines[row];
      if (line.length !== row + 1) continue;
      const color = line[0], column = WALL_COLORS[row].indexOf(color);
      board.wall[row][column] = true;
      const points = wallScore(board.wall, row, column);
      board.score += points;
      placements.push({ row, column, color, points });
      state.discard.push(...line.slice(1));
      board.lines[row] = [];
    }
    const penalty = FLOOR_COSTS.slice(0, board.floor.length).reduce((a, b) => a + b, 0);
    board.score = Math.max(0, board.score - penalty);
    state.discard.push(...board.floor.filter(color => color !== -1));
    board.floor = [];
    results[player.id] = { before, placements, penalty, delta: board.score - before, bonus: null };
  }
  const ended = state.players.some(player => wallBonuses(state.boards[player.id].wall).rows > 0);
  state.phase = ended ? "ended" : "round_end";
  if (ended) {
    for (const player of state.players) {
      const board = state.boards[player.id], result = results[player.id];
      result.bonus = wallBonuses(board.wall);
      board.score += result.bonus.points;
      result.delta = board.score - result.before;
    }
    const highest = Math.max(...state.players.map(player => state.boards[player.id].score));
    const tied = state.players.filter(player => state.boards[player.id].score === highest);
    const mostRows = Math.max(...tied.map(player => wallBonuses(state.boards[player.id].wall).rows));
    state.winners = tied.filter(player => wallBonuses(state.boards[player.id].wall).rows === mostRows).map(player => player.id);
  }
  state.settlement = { round: state.round, results };
}

const reject = message => ({ accepted: false, error: { code: "INVALID_ACTION", message } });

export function applyAction(state, actorId, action) {
  if (!state.players.some(player => player.id === actorId)) return reject("只有入座玩家可以操作");
  if (!action || typeof action !== "object" || !["draft", "next_round", "rematch"].includes(action.type)) return reject("未知操作");
  if (action.round !== state.round || action.step !== state.step) return reject("局面已更新，请重新选择");
  if (action.type === "draft") {
    if (state.phase !== "drafting" || state.players[state.turn].id !== actorId) return reject("请等待你的选砖回合");
    const { source, color, row } = action;
    if (!Number.isInteger(source) || source < -1 || source >= state.factories.length) return reject("请选择一个工厂或中央区域");
    if (!Number.isInteger(color) || color < 0 || color > 4) return reject("请选择一种花砖颜色");
    if (!Number.isInteger(row) || row < -1 || row > 4) return reject("请选择一条花纹行或地板区");
    const tiles = source === -1 ? state.center : state.factories[source];
    const chosen = tiles.filter(tile => tile === color);
    if (!chosen.length) return reject("这个区域没有该颜色的花砖");
    const board = state.boards[actorId];
    if (row !== -1 && !canPlace(board, row, color)) return reject("这条花纹行不能放置该颜色");
    const rest = tiles.filter(tile => tile !== color);
    const marker = source === -1 && state.centerMarker;
    if (source === -1) {
      state.center = rest;
      if (marker) {
        state.centerMarker = false;
        state.nextStarterId = actorId;
        addFloor(state, board, [-1]);
      }
    } else {
      state.factories[source] = [];
      state.center.push(...rest);
    }
    const placed = row === -1 ? 0 : Math.min(chosen.length, row + 1 - board.lines[row].length);
    if (row !== -1) board.lines[row].push(...chosen.slice(0, placed));
    addFloor(state, board, chosen.slice(placed));
    state.lastMove = { playerId: actorId, source, color, row, count: chosen.length, overflow: chosen.length - placed, marker };
    state.turn = (state.turn + 1) % state.players.length;
    if (!state.center.length && state.factories.every(factory => !factory.length)) settleRound(state);
  } else if (action.type === "next_round") {
    if (state.phase !== "round_end") return reject("本轮尚未结束");
    state.starterId = state.nextStarterId || state.starterId;
    state.turn = state.players.findIndex(player => player.id === state.starterId);
    state.round++;
    state.lastMove = null;
    fillFactories(state);
  } else {
    if (state.phase !== "ended") return reject("整局尚未结束");
    const fresh = createGame(state.players, state.seed.toString(16));
    fresh.step = state.step;
    Object.assign(state, fresh);
  }
  state.step++;
  return { accepted: true, state, events: [] };
}

export function projectGame(state, viewerId) {
  const seated = state.players.some(player => player.id === viewerId);
  return {
    players: state.players, boards: state.boards, factories: state.factories,
    center: state.center, centerMarker: state.centerMarker, nextStarterId: state.nextStarterId,
    starterId: state.starterId, round: state.round, step: state.step, phase: state.phase,
    currentPlayerId: state.players[state.turn].id, viewerId,
    canDraft: seated && state.phase === "drafting" && state.players[state.turn].id === viewerId,
    canContinue: seated && state.phase !== "drafting", settlement: state.settlement,
    winners: state.winners, lastMove: state.lastMove,
    counts: { bag: state.bag.length, discard: state.discard.length },
  };
}

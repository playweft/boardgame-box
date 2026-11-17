import { CARDS, applyAction, projectGame } from "./engine.js";
import { evaluatePlayers, profiles, rankActions } from "./bot-policy.js";

export const SEARCH_TIME_MS = 350;

export function chooseScoredAction(view, profile = profiles.balanced) {
  return rankActions(view, profile)[0]?.action ?? null;
}

export function chooseBotAction(view, mode) {
  return mode === "hard" ? chooseSearchAction(view) : chooseScoredAction(view);
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle(cards, random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
}

function sampler(view) {
  const seen = new Set(view.market.flat().map(card => card.id));
  for (const board of Object.values(view.boards)) {
    for (const card of [...board.purchased, ...board.reserved]) if (card.id) seen.add(card.id);
  }
  const unknown = [[], [], []];
  for (const card of CARDS) if (!seen.has(card.id)) unknown[card.level - 1].push(card);

  return random => {
    const decks = unknown.map(cards => {
      const shuffled = cards.slice();
      shuffle(shuffled, random);
      return shuffled;
    });
    const boards = Object.fromEntries(view.players.map(({ id }) => {
      const board = view.boards[id];
      return [id, { ...board, reserved: board.reserved.map(card => card.hidden ? decks[card.level - 1].pop() : card) }];
    }));
    return { decks, boards };
  };
}

export function sampleHiddenCards(view, random = Math.random) {
  return sampler(view)(random);
}

function simulationState(view, world, seat) {
  const boards = Object.fromEntries(view.players.map(({ id }) => {
    const board = world.boards[id];
    return [id, {
      ...board, tokens: { ...board.tokens }, bonuses: { ...board.bonuses },
      purchased: board.purchased.slice(), reserved: board.reserved.slice(), nobles: board.nobles.slice(),
    }];
  }));
  return {
    players: view.players, boards, bank: { ...view.bank }, turn: seat,
    decks: world.decks.map(deck => deck.slice()), market: view.market.map(row => row.slice()), nobles: view.nobles.slice(),
    phase: view.phase, round: view.round, step: view.step, endingRound: view.endingRound,
    winners: [], lastMove: view.lastMove && { ...view.lastMove }, history: view.history.slice(-16),
  };
}

function play(state, action) {
  const id = state.players[state.turn].id;
  const result = applyAction(state, id, { ...action, round: state.round, step: state.step });
  if (!result.accepted) throw new Error(result.error.message);
}

function rollout(view, world, seat, action, styles, rounds) {
  const state = simulationState(view, world, seat);
  const seats = view.players.length;
  const turnLimit = (view.round + rounds) * seats + seat;
  play(state, action);
  // Follow the scored policy through later turns and resolve pending returns/nobles.
  // Once the last round starts, always simulate through the real tie-break.
  while (state.phase !== "ended" && (state.round * seats + state.turn < turnLimit || state.endingRound !== null || state.phase !== "playing")) {
    const next = projectGame(state, state.players[state.turn].id);
    const intent = chooseScoredAction(next, styles[state.turn]);
    if (!intent) break;
    play(state, intent);
  }

  if (state.phase === "ended") {
    return state.winners.includes(view.viewerId) ? 1 / state.winners.length : -1;
  }
  const values = evaluatePlayers(projectGame(state, view.viewerId));
  const rival = Math.max(...values.filter((_, index) => index !== seat));
  return Math.tanh((values[seat] - rival) / 6) * 0.85;
}

function searchCandidates(ranked, width) {
  const seen = new Set(), candidates = [];
  for (const entry of ranked) {
    const { action } = entry;
    // Keep the best payment for each purchase so alternatives don't crowd out other plans.
    if (action.type === "buy") {
      if (seen.has(action.cardId)) continue;
      seen.add(action.cardId);
    }
    candidates.push({ ...entry, total: 0, samples: 0 });
    if (candidates.length === width) break;
  }
  return candidates;
}

export function chooseSearchAction(view, {
  random = Math.random, timeMs = SEARCH_TIME_MS, width = 8, rounds = 2, sampleBatches = [3, 4, 6],
} = {}) {
  const deadline = performance.now() + timeMs;
  const ranked = rankActions(view);
  if (ranked.length < 2 || view.phase !== "playing") return ranked[0]?.action ?? null;
  // In the final round, a reserve with no immediate points can still be the only winning move.
  // Search every distinct action through settlement while the remaining line is short.
  let candidates = searchCandidates(ranked, view.endingRound === null ? width : Infinity);
  const drawWorld = sampler(view), seat = view.players.findIndex(player => player.id === view.viewerId);
  const opponentStyles = Object.values(profiles);
  const bestValue = ranked[0].value;
  const quality = candidate => candidate.total / candidate.samples + 0.08 * (candidate.value - bestValue);

  // Compare all remaining actions in identical sampled situations. Spend later samples
  // on the better candidates; only count complete batches when running against a deadline.
  for (const batches of sampleBatches) {
    if (candidates.length < 2) break;
    for (let batch = 0; batch < batches; batch++) {
      if (performance.now() >= deadline) return candidates[0].action;
      const world = drawWorld(random);
      const styles = view.players.map((_, i) => i === seat ? profiles.balanced
        : opponentStyles[Math.floor(random() * opponentStyles.length)]);
      const results = [];
      for (const candidate of candidates) {
        if (performance.now() >= deadline) return candidates[0].action;
        results.push(rollout(view, world, seat, candidate.action, styles, rounds));
      }
      for (const [index, candidate] of candidates.entries()) {
        candidate.total += results[index];
        candidate.samples++;
      }
      candidates.sort((a, b) => quality(b) - quality(a) || b.value - a.value);
    }
    candidates = candidates.slice(0, Math.ceil(candidates.length / 2));
  }
  return candidates[0].action;
}

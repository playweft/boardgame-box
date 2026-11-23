import {
  LAND_BIRDS,
  NAVIGATION,
  PROVISIONS,
  cardInfo,
  characterById,
} from "./data.js";
import { actingPlayer, applyAction, projectGame } from "./engine.js";
import {
  botProfiles,
  chooseRuleAction,
  lootValue,
  rankBotActions,
} from "./bot-policy.js";

const SEARCH_PHASES = new Set([
  "deal",
  "action",
  "row",
  "answer",
  "fight",
  "navigate",
]);

function shuffled(items, random) {
  const deck = [...items];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

export function sampleBotWorld(view, random = Math.random) {
  const self = view.characters.find(
    (person) => person.player === view.viewerId,
  );
  const seen = new Set([
    ...(view.offer || []),
    ...self.hand,
    ...view.characters.flatMap((person) => person.shown),
  ]);
  if (
    view.log.some(
      (entry) => entry.type === "flare" || entry.type === "fightFlare",
    )
  )
    seen.add("flare-1");
  const supplies = shuffled(
    PROVISIONS.map((card) => card.id).filter((id) => !seen.has(id)),
    random,
  );
  const loves = shuffled(
    view.cast.filter((id) => id !== self.love),
    random,
  );
  const hates = shuffled(
    view.cast.filter((id) => id !== self.hate),
    random,
  );
  const characters = view.characters.map(
    ({
      id,
      player,
      wounds,
      rowed,
      fought,
      parasol,
      removed,
      shown,
      handCount,
    }) => ({
      id,
      player,
      wounds,
      rowed,
      fought,
      parasol,
      removed,
      shown: [...shown],
      hand:
        player === view.viewerId
          ? [...self.hand]
          : supplies.splice(0, handCount),
      love: player === view.viewerId ? self.love : loves.pop(),
      hate: player === view.viewerId ? self.hate : hates.pop(),
    }),
  );

  // Used navigation cards circulate. Only the current private choices have a known location.
  const rowChoices = [...(view.rowChoices || [])];
  const navigation = shuffled(
    NAVIGATION.map((card) => card.id).filter((id) => !rowChoices.includes(id)),
    random,
  );
  const rowStack = navigation.splice(0, view.rowCount);
  const queue = [...view.queue];
  const fight = view.fight && {
    ...view.fight,
    pending: [...(view.fightPending || queue)],
  };

  return {
    seed: 1 + Math.floor(random() * 2147483646),
    day: view.day,
    phase: view.phase,
    step: view.step,
    birds: view.birds,
    players: view.players,
    cast: view.cast,
    characters,
    supplyDeck: supplies.splice(0, view.supplyCount),
    navDeck: navigation,
    rowStack,
    rowChoices,
    offer: [...(view.offer || [])],
    demand: view.demand,
    fight,
    queue,
    savedQueue: [...(view.remainingActions || [])],
    falling: [],
    sharks: false,
    thirst: [],
    navCard: view.navCard,
    log: [],
    scores: false,
    outcome: false,
  };
}

function projectScores(state) {
  const survival = Object.fromEntries(
    state.characters.map((entry) => {
      const { size } = characterById[entry.id];
      if (entry.removed || entry.wounds > size) return [entry.id, 0];
      const water = [...entry.hand, ...entry.shown].filter(
        (card) => cardInfo(card).type === "water",
      ).length;
      const buffer =
        size -
        entry.wounds +
        Math.min(water, 2) * 0.45 +
        Number(entry.parasol) * 0.55;
      return [
        entry.id,
        Math.min(0.97, 0.38 + buffer * 0.12 + state.birds * 0.075),
      ];
    }),
  );
  return state.characters.map((person) => {
    const ownSurvival =
      characterById[person.id].survival *
      survival[person.id] *
      Number(person.hate !== person.id);
    const love = characterById[person.love].survival * survival[person.love];
    const hate = state.characters.reduce((sum, entry) => {
      const counts =
        person.hate === person.id
          ? entry !== person && entry.id !== person.love
          : entry.id === person.hate;
      return (
        sum +
        (counts ? characterById[entry.id].size * (1 - survival[entry.id]) : 0)
      );
    }, 0);
    const loot = person.removed
      ? 0
      : [...person.hand, ...person.shown].reduce(
          (sum, id) => sum + lootValue(person, id),
          0,
        );
    return {
      player: person.player,
      total:
        ownSurvival + love + hate + loot * (0.65 + 0.35 * survival[person.id]),
    };
  });
}

function evaluate(state, viewer, objective) {
  const scores = state.scores || projectScores(state);
  const myScore = scores.find((score) => score.player === viewer).total;
  if (objective === "score") return myScore;
  const max = Math.max(...scores.map((score) => score.total));
  if (state.scores) {
    const first =
      myScore === max
        ? 1 / scores.filter((score) => score.total === max).length
        : 0;
    return (
      first +
      0.015 *
        Math.tanh(
          (myScore -
            Math.max(
              ...scores
                .filter((score) => score.player !== viewer)
                .map((score) => score.total),
            )) /
            6,
        )
    );
  }
  const weight = (total) => Math.exp((total - max) / 6);
  return (
    weight(myScore) /
    scores.reduce((sum, score) => sum + weight(score.total), 0)
  );
}

function rollout(world, first, viewer, profiles, horizon, deadline) {
  const attempt = applyAction(world, viewer, { ...first, step: world.step });
  if (!attempt.accepted) return null;
  const lastDay = world.day + horizon;
  let state = attempt.state;
  for (
    let index = 0;
    index < 100 && state.phase !== "ended" && state.day < lastDay;
    index++
  ) {
    if (performance.now() >= deadline) return null;
    const actor = actingPlayer(state);
    const action = chooseRuleAction(projectGame(state, actor), profiles[actor]);
    if (!action) return null;
    const next = applyAction(state, actor, { ...action, step: state.step });
    if (!next.accepted) return null;
    state = next.state;
  }
  return state;
}

export function chooseBotAction(
  view,
  {
    random = Math.random,
    timeMs = 110,
    samples = 12,
    width = 6,
    objective = "win",
  } = {},
) {
  const ranked = rankBotActions(view);
  if (ranked.length < 2 || !SEARCH_PHASES.has(view.phase))
    return ranked[0]?.action ?? null;
  const deadline = performance.now() + timeMs;
  const depth = view.birds >= LAND_BIRDS - 1 ? 3 : 2;
  // Navigation and mandatory reactions are small enough to keep every alternative.
  const candidates = ranked
    .slice(0, ["action", "row"].includes(view.phase) ? width : ranked.length)
    .map((entry) => ({ ...entry, total: 0 }));
  let active = candidates;
  let best = candidates[0].action;
  for (let index = 0; index < samples && active.length > 1; index++) {
    if (performance.now() >= deadline) break;
    const world = sampleBotWorld(view, random);
    const profiles = Object.fromEntries(
      view.players.map(({ id }) => [
        id,
        id === view.viewerId
          ? botProfiles[0]
          : botProfiles[Math.floor(random() * botProfiles.length)],
      ]),
    );
    const results = [];
    for (const candidate of active) {
      const end = rollout(
        world,
        candidate.action,
        view.viewerId,
        profiles,
        depth,
        deadline,
      );
      if (!end) return best; // Keep the last fair comparison if a batch was interrupted.
      results.push(evaluate(end, view.viewerId, objective));
    }
    active.forEach((candidate, slot) => {
      candidate.total += results[slot];
    });
    active.sort(
      (left, right) => right.total - left.total || right.score - left.score,
    );
    best = active[0].action;
    if ([2, 5, 8].includes(index))
      active = active.slice(0, Math.ceil(active.length / 2));
  }
  return best;
}

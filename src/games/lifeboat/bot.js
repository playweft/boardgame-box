import {
  LAND_BIRDS,
  NAVIGATION,
  PROVISIONS,
  cardInfo,
  characterById,
} from "./data.js";
import {
  actingPlayer,
  advanceSimulation,
  applyAction,
  projectGame,
  simulateRemainingResponses,
} from "./engine.js";
import {
  botProfiles,
  chooseRuleAction,
  lootValue,
  rankBotActions,
  rankStrategicActions,
} from "./bot-policy.js";
import { observationKey, recordReward, searchNode, selectEdge } from "./bot-tree.js";

const RESPONSE_PHASES = new Set(["rescue", "thirst"]);

function shuffled(items, random) {
  const deck = [...items];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

function sampleNavigation(view, rowChoices, random) {
  const memory = view.cardMemory;
  const slots = memory && [...memory.rowStack, ...memory.deck];
  const remembered = slots?.filter(Boolean) ?? [];
  const known = new Set([...rowChoices, ...remembered]);
  const consistent = slots &&
    memory.deck.length === view.navCount &&
    memory.rowStack.length === view.rowCount &&
    slots.length + rowChoices.length === NAVIGATION.length &&
    known.size === rowChoices.length + remembered.length;
  const excluded = consistent ? known : new Set(rowChoices);
  const unknown = shuffled(
    NAVIGATION.map((card) => card.id).filter((id) => !excluded.has(id)),
    random,
  );
  return consistent ? slots.map((card) => card ?? unknown.shift()) : unknown;
}

export function sampleBotWorld(view, random = Math.random, treeSearch = true) {
  const self = view.characters.find(
    (person) => person.player === view.viewerId,
  );
  const seen = new Set([
    ...(view.offer || []),
    ...self.hand,
    ...view.characters.flatMap((person) => person.shown),
    ...(view.cardMemory?.spent ?? []),
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
  let supplyDeck;
  let available = supplies;
  if (treeSearch) {
    const dealt = new Set(view.cardMemory?.dealt);
    supplyDeck = supplies.filter((id) => !dealt.has(id)).slice(0, view.supplyCount);
    const inDeck = new Set(supplyDeck);
    available = supplies.filter((id) => !inDeck.has(id));
  }
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
          : available.splice(0, handCount),
      love: player === view.viewerId ? self.love : loves.pop(),
      hate: player === view.viewerId ? self.hate : hates.pop(),
    }),
  );

  const rowChoices = [...(view.rowChoices || [])];
  const navigation = sampleNavigation(view, rowChoices, random);
  const rowStack = navigation.splice(0, view.rowCount);
  const queue = [...view.queue];
  const fight = view.fight && {
    ...view.fight,
    pending: [...(view.fightPending || queue)],
  };

  const world = {
    seed: 1 + Math.floor(random() * 2147483646),
    day: view.day,
    phase: view.phase,
    step: view.step,
    birds: view.birds,
    players: view.players,
    cast: view.cast,
    characters,
    supplyDeck: supplyDeck ?? available.splice(0, view.supplyCount),
    navDeck: navigation,
    rowStack,
    rowChoices,
    offer: [...(view.offer || [])],
    demand: view.demand,
    fight,
    queue,
    savedQueue: [...(view.remainingActions || [])],
    falling: [...view.falling],
    sharks: false,
    thirst: view.thirst.map((need) => ({ ...need })),
    navCard: view.navCard,
    log: [],
    scores: false,
    outcome: false,
  };
  if (treeSearch && RESPONSE_PHASES.has(view.phase) && view.canAct)
    simulateRemainingResponses(world);
  return world;
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

function treeRollout(world, root, profiles, horizon, deadline, objective) {
  const state = structuredClone(world);
  const viewer = actingPlayer(state);
  if (!advanceSimulation(state, viewer, root.action)) return null;
  const lastDay = world.day + horizon;
  const path = [];
  let tree = root.observations;
  for (
    let index = 0;
    index < 128 && state.phase !== "ended" && state.day < lastDay;
    index++
  ) {
    if (performance.now() >= deadline) return null;
    const actor = actingPlayer(state);
    const view = projectGame(state, actor, false);
    let action;
    if (tree && actor === viewer) {
      const key = observationKey(view);
      let node = tree.get(key);
      const known = node !== undefined;
      if (!known) {
        node = searchNode(rankStrategicActions(view).slice(0, 5));
        tree.set(key, node);
      }
      const edge = selectEdge(node, objective === "score" ? 18 : 0.9);
      if (!edge) return null;
      path.push({ node, edge });
      action = edge.action;
      // Expand at most one observation per playout.
      tree = known && path.length < 4 ? edge.observations : null;
    } else {
      action = chooseRuleAction(view, profiles[actor]);
    }
    if (!action || !advanceSimulation(state, actor, action)) return null;
  }
  return { value: evaluate(state, viewer, objective), path };
}

function flatRollout(world, root, profiles, horizon, deadline, objective) {
  const viewer = actingPlayer(world);
  const attempt = applyAction(world, viewer, { ...root.action, step: world.step });
  if (!attempt.accepted) return null;
  const lastDay = world.day + horizon;
  let state = attempt.state;
  for (let index = 0; index < 100 && state.phase !== "ended" && state.day < lastDay; index++) {
    if (performance.now() >= deadline) return null;
    const actor = actingPlayer(state);
    const action = chooseRuleAction(projectGame(state, actor), profiles[actor]);
    if (!action) return null;
    const next = applyAction(state, actor, { ...action, step: state.step });
    if (!next.accepted) return null;
    state = next.state;
  }
  return { value: evaluate(state, viewer, objective), path: [] };
}

export function chooseBotAction(
  view,
  {
    random = Math.random,
    treeSearch = false,
    timeMs = treeSearch ? 220 : 110,
    samples = treeSearch ? 64 : 12,
    width = treeSearch ? 9 : 6,
    objective = "win",
  } = {},
) {
  const ranked = treeSearch ? rankStrategicActions(view) : rankBotActions(view);
  if (ranked.length < 2 || (!treeSearch && RESPONSE_PHASES.has(view.phase)))
    return ranked[0]?.action ?? null;
  const deadline = performance.now() + timeMs;
  const depth = view.birds >= LAND_BIRDS - 1 ? 3 : 2;
  const rollout = treeSearch ? treeRollout : flatRollout;
  const limit = treeSearch || ["action", "row"].includes(view.phase) ? width : ranked.length;
  const elimination = treeSearch ? [6, 14, 27] : [2, 5, 8];
  const minimum = treeSearch ? 2 : 1;
  const candidates = ranked.slice(0, limit).map((entry) => ({
    ...entry, total: 0, ...(treeSearch && { observations: new Map() }),
  }));
  let active = candidates;
  let best = candidates[0].action;
  for (let index = 0; index < samples && active.length > 1; index++) {
    if (performance.now() >= deadline) break;
    const world = sampleBotWorld(view, random, treeSearch);
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
      const result = rollout(
        world, candidate, profiles, depth, deadline, objective,
      );
      if (!result) return best; // Compare root actions on the same finished samples.
      results.push(result);
    }
    active.forEach((candidate, slot) => {
      const { value, path } = results[slot];
      candidate.total += value;
      recordReward(path, value);
    });
    active.sort(
      (left, right) => right.total - left.total || right.score - left.score,
    );
    best = active[0].action;
    if (elimination.includes(index) && active.length > minimum)
      active = active.slice(0, Math.max(minimum, Math.ceil(active.length / 2)));
  }
  return best;
}

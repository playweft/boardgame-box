// Simulated states share a node only when the deciding player sees the same
// position. Hidden hands, motives and the next card are omitted from the key.
export function observationKey(view) {
  return JSON.stringify([
    view.phase, view.day, view.birds, view.supplyCount, view.navCount, view.rowCount,
    view.queue, view.offer, view.rowChoices, view.demand, view.fight, view.falling,
    view.thirst, view.navCard,
    view.characters.map((person) => [
      person.id, person.wounds, person.removed, person.rowed, person.fought,
      person.parasol, person.handCount, person.shown, person.hand,
    ]),
  ]);
}

export function searchNode(entries) {
  return {
    visits: 0,
    edges: entries.map(({ action }, index) => ({
      action,
      prior: 1 / (1 + index * 0.45),
      visits: 0,
      total: 0,
      observations: new Map(),
    })),
  };
}

export function selectEdge(node, exploration) {
  let best;
  let bestValue = -Infinity;
  const total = Math.sqrt(node.visits + 1);
  for (const edge of node.edges) {
    const value = edge.total / Math.max(1, edge.visits) +
      exploration * edge.prior * total / (1 + edge.visits);
    if (value > bestValue) {
      best = edge;
      bestValue = value;
    }
  }
  return best;
}

export function recordReward(path, value) {
  for (const { node, edge } of path) {
    node.visits += 1;
    edge.visits += 1;
    edge.total += value;
  }
}

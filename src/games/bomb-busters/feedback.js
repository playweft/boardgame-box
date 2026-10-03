export function recentChanges(previous, next) {
  const cutIds = [];
  const clueIds = [];
  if (previous && next) {
    const oldCuts = new Set((Array.isArray(previous.cutWires) ? previous.cutWires : []).map((wire) => wire.id));
    for (const wire of Array.isArray(next.cutWires) ? next.cutWires : []) {
      if (!oldCuts.has(wire.id)) cutIds.push(wire.id);
    }
    for (const id of Object.keys(next.clues || {})) {
      if (!previous.clues?.[id]) clueIds.push(id);
    }
  }
  return { cutIds, clueIds };
}

export function startsOwnTurn(previous, next) {
  return next.ownTurn && next.phase !== "ended" &&
    (!previous?.ownTurn || previous.phase !== next.phase ||
      previous.currentPlayerId !== next.currentPlayerId);
}

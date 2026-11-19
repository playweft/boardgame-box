const list = value => Array.isArray(value) ? value : [];
const visibleList = value => value === false ? false : list(value);

export function normalizeRoomView(state) {
  // Lua represents empty arrays as tables, which arrive as objects on the wire.
  return {
    ...state,
    players: list(state.players),
    cast: list(state.cast),
    characters: list(state.characters).map(entry => ({
      ...entry,
      shown: list(entry.shown),
      hand: visibleList(entry.hand),
    })),
    offer: visibleList(state.offer),
    rowChoices: visibleList(state.rowChoices),
    falling: list(state.falling),
    thirst: list(state.thirst),
    queue: list(state.queue),
    log: list(state.log),
    scores: visibleList(state.scores),
    fight: state.fight && {
      ...state.fight,
      attackers: list(state.fight.attackers),
      defenders: list(state.fight.defenders),
    },
  };
}

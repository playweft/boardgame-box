export const assassinationRevealDuration = 1200;

export function createAssassinationDisplay({ onChange, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let scope;
  let previous;
  let pending = null;
  let timer = null;
  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    pending = null;
  };
  return {
    update(state, matchId) {
      const nextScope = `${matchId}:${state.round}`;
      if (scope !== nextScope) {
        clear();
        scope = nextScope;
        previous = state;
        return;
      }
      if (state.phase === "game-over" && previous?.phase !== "game-over" && state.assassinationTarget != null) {
        clear();
        pending = {
          deadline: now() + assassinationRevealDuration,
          state: { ...state, phase: "assassination-result", winner: undefined, endReason: undefined, finalRoles: [], canRematch: false },
        };
        timer = schedule(() => { clear(); onChange(); }, assassinationRevealDuration);
      } else if (state.phase !== "game-over") clear();
      previous = state;
    },
    state(current) {
      if (pending && now() >= pending.deadline) clear();
      return pending?.state || current;
    },
  };
}

export function createMissionResultDisplay({ onChange, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let scope = null;
  let previous = null;
  let pending = null;
  let timer = null;

  function clear() {
    if (timer !== null) cancel(timer);
    timer = null;
    pending = null;
  }

  return {
    update(state, matchId) {
      const nextScope = `${matchId}:${state.round}`;
      if (scope !== nextScope) {
        clear();
        scope = nextScope;
        previous = state;
        return;
      }
      const mission = state.lastMission;
      if (mission && mission.number !== previous?.lastMission?.number && ["propose", "assassinate", "game-over"].includes(state.phase)) {
        clear();
        const proposal = state.proposalHistory.findLast(item => item.quest === mission.number && item.approved);
        const result = {
          deadline: now() + 5000,
          nextPhase: state.phase,
          state: {
            ...state,
            phase: "mission-result",
            quest: mission.number,
            leader: previous?.leader || state.leader,
            selectedTeam: mission.team,
            missionTeam: mission.team,
            votes: proposal?.votes || previous?.votes || {},
          },
        };
        pending = result;
        timer = schedule(() => {
          if (pending !== result) return;
          clear();
          onChange();
        }, 5000);
      } else if (pending && state.phase !== pending.nextPhase) {
        clear();
      }
      previous = state;
    },
    state(current) {
      if (pending && now() >= pending.deadline) clear();
      return pending?.state || current;
    },
    dismiss() {
      if (!pending) return;
      clear();
      onChange();
    },
  };
}

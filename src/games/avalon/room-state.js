// Lua encodes empty lists as {}. Keep list fields usable in real room projections.
export function normalizeRoomState(state) {
  if (!state) return state;
  for (const key of ["players", "selectedTeam", "missionTeam", "missions", "proposalHistory", "roleHints", "finalRoles"])
    if (!Array.isArray(state[key])) state[key] = [];
  return state;
}

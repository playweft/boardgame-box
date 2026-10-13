export const factionRoleMarks = {
  good: { name: "正义", team: "good", icon: "scale" },
  evil: { name: "邪恶", team: "evil", icon: "swords" },
};

function storageKey({ matchId, round, playerId }) {
  return matchId && round && playerId
    ? `boardgame-box:avalon:player-marks:${JSON.stringify([matchId, round, playerId])}`
    : null;
}

export function loadPlayerRoleMarks(
  scope,
  playerIds,
  roleIds,
  storage = () => window.sessionStorage,
) {
  const key = storageKey(scope);
  if (!key) return {};
  try {
    const saved = JSON.parse(storage().getItem(key));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(
        ([playerId, roleId]) =>
          playerIds.includes(playerId) &&
          (roleIds.includes(roleId) || Object.hasOwn(factionRoleMarks, roleId)),
      ),
    );
  } catch {
    return {};
  }
}

export function savePlayerRoleMarks(
  scope,
  marks,
  storage = () => window.sessionStorage,
) {
  const key = storageKey(scope);
  if (!key) return;
  try {
    if (Object.keys(marks).length)
      storage().setItem(key, JSON.stringify(marks));
    else storage().removeItem(key);
  } catch {
    // Marks remain available in memory if session storage cannot be used.
  }
}

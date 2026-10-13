export function createRoleIntroduction(storage = () => window.localStorage) {
  const seen = new Set();
  return ({ matchId, round, playerId, hasRole, finished }) => {
    if (!matchId || !round || !playerId || !hasRole || finished) return false;
    const key = `boardgame-box:avalon:role-intro:${JSON.stringify([matchId, round, playerId])}`;
    if (seen.has(key)) return false;
    seen.add(key);
    try {
      const saved = storage();
      if (saved.getItem(key) === "1") return false;
      saved.setItem(key, "1");
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
    return true;
  };
}

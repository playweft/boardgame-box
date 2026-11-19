import { chooseBotAction } from "../src/games/lifeboat/bot.js";
import { botProfiles, chooseRuleAction } from "../src/games/lifeboat/bot-policy.js";
import { actingPlayer, applyAction, createGame, projectBotGame } from "../src/games/lifeboat/engine.js";

const [seedCount = 24, firstSeed = 914234902] = process.argv.slice(2).map(Number);
if (!Number.isSafeInteger(seedCount) || seedCount < 1 || !Number.isSafeInteger(firstSeed) || firstSeed < 1) {
  throw new Error("Usage: node dev/benchmark-lifeboat-ai.js [seeds per table size] [first seed]");
}
const randomFrom = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);

function play(players, seed, contenderIndex, profileOffset, search) {
  const contender = players[contenderIndex].id;
  const random = randomFrom(Math.imul(seed, 2654435761));
  let state = createGame(players, seed.toString(16));
  while (state.phase !== "ended" && state.step < 1000) {
    const actor = actingPlayer(state);
    const view = projectBotGame(state, actor);
    const index = players.findIndex(player => player.id === actor);
    const profile = botProfiles[actor === contender ? 0 : (index + profileOffset) % botProfiles.length];
    const action = actor === contender && search
      ? chooseBotAction(view, { random, timeMs: Infinity })
      : chooseRuleAction(view, profile);
    const next = applyAction(state, actor, { ...action, step: state.step });
    if (!next.accepted) throw new Error(`Seed ${seed}, step ${state.step}: ${next.error.message}`);
    state = next.state;
  }
  if (!state.scores) throw new Error(`Seed ${seed} did not finish`);
  const own = state.scores.find(score => score.player === contender).total;
  const high = Math.max(...state.scores.map(score => score.total));
  return { score: own, win: own === high ? 1 / state.scores.filter(score => score.total === high).length : 0 };
}

for (const count of [4, 5, 6]) {
  const players = Array.from({ length: count }, (_, index) => ({ id: `p${index}` }));
  const rules = { score: 0, win: 0 };
  const search = { score: 0, win: 0 };
  for (let offset = 0; offset < seedCount; offset++) {
    const seed = firstSeed + offset * 72365 + count;
    const contender = offset % count;
    for (const [totals, enabled] of [[rules, false], [search, true]]) {
      const result = play(players, seed, contender, offset, enabled);
      totals.score += result.score;
      totals.win += result.win;
    }
  }
  const summarize = result => ({
    meanScore: Number((result.score / seedCount).toFixed(2)),
    firstPlaceShare: Number((100 * result.win / seedCount).toFixed(1)),
  });
  console.log(JSON.stringify({ players: count, pairedSeeds: seedCount, rules: summarize(rules), search: summarize(search) }));
}

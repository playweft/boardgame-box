import { applyAction, createGame, projectGame } from "../src/games/splendor/engine.js";
import { chooseScoredAction, chooseSearchAction, seededRandom } from "../src/games/splendor/bot.js";
import { profiles } from "../src/games/splendor/bot-policy.js";

const [seedCount = 24, firstSeed = 20261117, group = "all"] = process.argv.slice(2).map((arg, index) => index < 2 ? Number(arg) : arg);
const matchups = [
  { seats: 2, styles: ["balanced"] },
  { seats: 2, styles: ["engine"] },
  { seats: 2, styles: ["rush"] },
  { seats: 3, styles: ["balanced", "balanced"] },
  { seats: 4, styles: ["balanced", "balanced", "balanced"] },
];
if (!Number.isSafeInteger(seedCount) || seedCount < 1 || !Number.isSafeInteger(firstSeed) || firstSeed < 1
  || !["all", "2", "3", "4"].includes(group)) {
  throw new Error("Usage: node dev/benchmark-splendor-ai.js [seed count] [first seed] [all|2|3|4]");
}

const percentile = (sorted, fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
const milliseconds = samples => {
  const sorted = samples.sort((a, b) => a - b);
  return [percentile(sorted, 0.5), percentile(sorted, 0.95)].map(n => Number(n.toFixed(2)));
};

function playGame(roster, seed, seat, styles, searchEnabled, searchTimes, scoredTimes) {
  const state = createGame(roster, seed.toString(16));
  const random = seededRandom(Math.imul(seed, 2654435761));
  while (state.phase !== "ended" && state.step < 600) {
    const actor = roster[state.turn].id, view = projectGame(state, actor);
    const contender = state.turn === seat;
    const style = contender ? "balanced" : styles[(state.turn - seat - 1 + roster.length) % roster.length];
    const begin = performance.now();
    const action = contender && searchEnabled ? chooseSearchAction(view, { random, timeMs: Infinity })
      : chooseScoredAction(view, profiles[style]);
    (contender && searchEnabled ? searchTimes : scoredTimes)?.push(performance.now() - begin);
    if (!action) throw new Error(`No legal action at seed ${seed}, contender seat ${seat}, step ${state.step}`);
    const result = applyAction(state, actor, { ...action, round: state.round, step: state.step });
    if (!result.accepted) throw new Error(JSON.stringify(result.error));
  }
  if (!state.winners.length) throw new Error(`Unfinished game at seed ${seed}, contender seat ${seat}, search ${searchEnabled}`);
  return state.winners.includes(roster[seat].id) ? 1 / state.winners.length : 0;
}

for (const { seats, styles } of matchups.filter(item => group === "all" || item.seats === Number(group))) {
  const roster = Array.from({ length: seats }, (_, seat) => ({ id: `p${seat}` }));
  const searchTimes = [], scoredTimes = [], bySeed = [], differences = [];
  let scoredTotal = 0;
  let wins = 0, ties = 0, losses = 0, seatCredits = Array(seats).fill(0);
  for (let offset = 0; offset < seedCount; offset++) {
    const seed = firstSeed + offset;
    let credit = 0, scoredCredit = 0;
    for (let searchSeat = 0; searchSeat < seats; searchSeat++) {
      const share = playGame(roster, seed, searchSeat, styles, true, searchTimes, scoredTimes);
      scoredCredit += playGame(roster, seed, searchSeat, styles, false);
      credit += share;
      seatCredits[searchSeat] += share;
      if (share === 1) wins++;
      else if (share > 0) ties++;
      else losses++;
    }
    bySeed.push(credit / seats);
    differences.push((credit - scoredCredit) / seats);
    scoredTotal += scoredCredit;
  }

  // Bootstrap by seed to account for correlation between games with the same deal.
  const random = seededRandom(7), bootstrap = [], gains = [];
  for (let run = 0; run < 4000; run++) {
    let sum = 0, gain = 0;
    for (let i = 0; i < bySeed.length; i++) {
      const index = Math.floor(random() * bySeed.length);
      sum += bySeed[index];
      gain += differences[index];
    }
    bootstrap.push(sum / bySeed.length);
    gains.push(gain / bySeed.length);
  }
  bootstrap.sort((a, b) => a - b);
  gains.sort((a, b) => a - b);
  const percent = value => Number((100 * value).toFixed(1));
  const interval = data => [percentile(data, 0.025), percentile(data, 0.975)].map(percent);
  const rate = bySeed.reduce((sum, value) => sum + value, 0) / bySeed.length;
  const baseline = scoredTotal / (seedCount * seats);
  console.log(JSON.stringify({
    seats, opponent: styles[0], games: seedCount * seats, wins, ties, losses,
    winShare: percent(rate), scoredWinShare: percent(baseline), gainPp: percent(rate - baseline),
    winCredit: seatCredits.reduce((sum, value) => sum + value, 0),
    interval95: interval(bootstrap), gainInterval95: interval(gains),
    bySeat: seatCredits.map(value => percent(value / seedCount)),
    searchMsP50P95: milliseconds(searchTimes), scoredMsP50P95: milliseconds(scoredTimes),
  }));
}

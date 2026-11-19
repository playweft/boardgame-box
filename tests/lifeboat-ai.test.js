import assert from "node:assert/strict";
import test from "node:test";
import { NAVIGATION, PROVISIONS } from "../src/games/lifeboat/data.js";
import { actingPlayer, applyAction, createGame, projectBotGame } from "../src/games/lifeboat/engine.js";
import { chooseBotAction, sampleBotWorld } from "../src/games/lifeboat/bot.js";
import { botProfiles, chooseRuleAction } from "../src/games/lifeboat/bot-policy.js";

const roster = count => Array.from({ length: count }, (_, index) => ({ id: `p${index}` }));
const seeded = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);

test("bot search depends on its own projected view and samples consistent hidden cards", () => {
  const state = createGame(roster(6), "beef");
  const actor = actingPlayer(state);
  const view = projectBotGame(state, actor);
  const changed = structuredClone(state);
  const [first, second] = changed.characters.filter(person => person.player !== actor);
  [first.hand, second.hand] = [second.hand, first.hand];
  [first.love, second.love] = [second.love, first.love];
  [first.hate, second.hate] = [second.hate, first.hate];
  changed.navDeck.reverse();
  changed.supplyDeck.reverse();
  changed.seed += 1;
  const sameView = projectBotGame(changed, actor);
  assert.deepEqual(sameView, view);
  for (const key of ["seed", "supplyDeck", "navDeck"]) assert.equal(key in view, false);

  const sample = sampleBotWorld(view, seeded(5));
  assert.equal(sample.navDeck.length, NAVIGATION.length);
  assert.equal(sample.supplyDeck.length, view.supplyCount);
  assert.equal(sample.characters.find(person => person.player === actor).love, view.characters.find(person => person.player === actor).love);
  const all = [...sample.supplyDeck, ...sample.offer, ...sample.characters.flatMap(person => [...person.hand, ...person.shown])];
  assert.equal(new Set(all).size, PROVISIONS.length);
  assert.equal(new Set(sample.characters.map(person => person.love)).size, 6);
  assert.equal(new Set(sample.characters.map(person => person.hate)).size, 6);
  assert.deepEqual(
    chooseBotAction(view, { random: seeded(17), timeMs: Infinity, samples: 4 }),
    chooseBotAction(sameView, { random: seeded(17), timeMs: Infinity, samples: 4 }),
  );
});

test("search and rule players finish 4–6 player games and make legal choices in every phase", () => {
  const phases = new Set();
  for (const count of [4, 5, 6]) {
    for (const seed of [5, 17, 44, 74]) {
      const random = seeded(seed + count);
      const players = roster(count);
      let state = createGame(players, seed.toString(16));
      while (state.phase !== "ended" && state.step < 600) {
        phases.add(state.phase);
        const actor = actingPlayer(state);
        const view = projectBotGame(state, actor);
        const position = players.findIndex(player => player.id === actor);
        const action = position === 0
          ? chooseBotAction(view, { random, timeMs: Infinity, samples: 4 })
          : chooseRuleAction(view, botProfiles[(seed + position) % botProfiles.length]);
        assert.ok(action, `${count} players, seed ${seed}, phase ${state.phase}`);
        const result = applyAction(state, actor, { ...action, step: state.step });
        assert.equal(result.accepted, true, result.error?.message);
        state = result.state;
      }
      assert.equal(state.outcome, "landed");
      assert.equal(state.scores.length, count);
    }
  }
  assert.deepEqual([...phases].sort(), ["action", "answer", "deal", "fight", "navigate", "rescue", "row", "thirst"]);
});

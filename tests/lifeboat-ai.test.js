import assert from "node:assert/strict";
import test from "node:test";
import { NAVIGATION, PROVISIONS } from "../src/games/lifeboat/data.js";
import { actingPlayer, advanceSimulation, applyAction, createGame, projectBotGame } from "../src/games/lifeboat/engine.js";
import { chooseBotAction, sampleBotWorld } from "../src/games/lifeboat/bot.js";
import { createBotMemory } from "../src/games/lifeboat/bot-memory.js";
import { botProfiles, chooseRuleAction, rankStrategicActions } from "../src/games/lifeboat/bot-policy.js";
import { observationKey, recordReward, searchNode, selectEdge } from "../src/games/lifeboat/bot-tree.js";

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
  assert.equal(observationKey(sameView), observationKey(view));
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
    chooseBotAction(view, { treeSearch: true, random: seeded(17), timeMs: Infinity, samples: 4 }),
    chooseBotAction(sameView, { treeSearch: true, random: seeded(17), timeMs: Infinity, samples: 4 }),
  );
});

test("only the rower remembers the cards they kept and returned", () => {
  const players = roster(4);
  const memory = createBotMemory(players);
  let state = createGame(players, "beef");
  state.phase = "action";
  state.queue = [...state.cast];
  const actor = actingPlayer(state);
  const observer = players.find(({ id }) => id !== actor).id;
  state = applyAction(state, actor, { step: state.step, type: "row" }, memory.observe).state;
  const [returned, kept, ...extra] = state.rowChoices;
  const keep = [false, true, ...extra.map(() => false)];
  state = applyAction(state, actor, { step: state.step, type: "sort", keep }, memory.observe).state;

  const own = memory.forPlayer(actor);
  assert.deepEqual(own.rowStack, [kept]);
  assert.deepEqual(own.deck.slice(-1 - extra.length), [returned, ...extra]);
  const world = sampleBotWorld(projectBotGame(state, actor, own), seeded(3));
  assert.deepEqual(world.rowStack, [kept]);
  assert.deepEqual(world.navDeck.slice(-1 - extra.length), [returned, ...extra]);
  assert.equal(new Set([...world.navDeck, ...world.rowStack]).size, NAVIGATION.length);

  const other = memory.forPlayer(observer);
  assert.deepEqual(other.rowStack, [null]);
  assert.ok(other.deck.every((card) => card === null));

  while (state.phase === "action") {
    const intent = { step: state.step, type: "nothing" };
    state = applyAction(state, actingPlayer(state), intent, memory.observe).state;
  }
  if (state.phase === "navigate") {
    const intent = { step: state.step, type: "play", card: kept };
    state = applyAction(state, actingPlayer(state), intent, memory.observe).state;
  }
  assert.equal(state.log.find(({ type }) => type === "nav").card, kept);
  assert.equal(other.deck.at(-1), kept);
});

test("a known discarded provision stays out of samples without revealing a private hand", () => {
  const players = roster(4);
  const memory = createBotMemory(players);
  let state = createGame(players, "beef");
  const actor = actingPlayer(state);
  const other = players.find(({ id }) => id !== actor).id;
  const self = state.characters.find(({ player }) => player === actor);
  state.phase = "action";
  state.queue = [...state.cast];
  self.wounds = 1;
  const kit = "medical-1";
  for (const person of state.characters) person.hand = person.hand.filter((card) => card !== kit);
  state.supplyDeck = state.supplyDeck.filter((card) => card !== kit);
  state.offer = [];
  self.hand.push(kit);
  state = applyAction(state, actor, { step: state.step, type: "medical", card: kit, target: self.id }, memory.observe).state;
  assert.deepEqual(memory.forPlayer(actor).spent, [kit]);
  assert.deepEqual(memory.forPlayer(other).spent, []);
  const world = sampleBotWorld(projectBotGame(state, actor, memory.forPlayer(actor)), seeded(5));
  assert.ok(!world.supplyDeck.includes(kit));
  assert.ok(world.characters.every((person) => !person.hand.includes(kit)));
});

test("a previously offered card can no longer be sampled from the supply pile", () => {
  const players = roster(4);
  const memory = createBotMemory(players);
  const state = createGame(players, "beef");
  const actor = actingPlayer(state);
  const observer = players.find(({ id }) => id !== actor).id;
  const next = applyAction(
    state, actor, { step: state.step, type: "take", card: state.offer[0] }, memory.observe,
  ).state;
  const own = memory.forPlayer(actor);
  assert.deepEqual(own.dealt, state.offer);
  assert.deepEqual(memory.forPlayer(observer).dealt, []);
  const world = sampleBotWorld(projectBotGame(next, actor, own), seeded(4));
  assert.equal(world.supplyDeck.length, next.supplyDeck.length);
  assert.ok(world.supplyDeck.every((card) => !own.dealt.includes(card)));
});

test("water search can spend multiple bottles to cross a survival threshold", () => {
  const state = createGame(roster(4), "beef");
  const [first, later] = state.characters;
  state.phase = "thirst";
  state.birds = 3;
  state.queue = [first.id, later.id];
  state.thirst = [{ id: first.id, left: 3 }];
  first.wounds = projectBotGame(state, first.player).characters[0].size - 1;
  first.hand = ["water-1", "water-2", "water-3"];
  later.shown = ["water-4"];

  const view = projectBotGame(state, first.player);
  assert.deepEqual(view.queue, [first.id]);
  const sample = sampleBotWorld(view, seeded(5));
  assert.ok(sample.queue.includes(later.id));
  assert.deepEqual(sample.thirst, state.thirst);
  assert.equal(rankStrategicActions(view)[0].action.uses.length, 3);
});

test("the search tree explores a lower-ranked action and retains its outcome", () => {
  const safer = { type: "nothing" };
  const stronger = { type: "row" };
  const node = searchNode([{ action: safer }, { action: stronger }]);
  const first = selectEdge(node, 0.9);
  assert.equal(first.action, safer);
  recordReward([{ node, edge: first }], 0);
  const second = selectEdge(node, 0.9);
  assert.equal(second.action, stronger);
  recordReward([{ node, edge: second }], 1);
  assert.equal(selectEdge(node, 0.9).action, stronger);
  assert.equal(node.visits, 2);
});

test("search and rule players finish 4–6 player games and make legal choices in every phase", () => {
  const phases = new Set();
  for (const count of [4, 5, 6]) {
    for (const seed of [5, 17, 44, 74]) {
      const random = seeded(seed + count);
      const players = roster(count);
      const memory = createBotMemory(players);
      let state = createGame(players, seed.toString(16));
      while (state.phase !== "ended" && state.step < 600) {
        phases.add(state.phase);
        const actor = actingPlayer(state);
        const position = players.findIndex(player => player.id === actor);
        const view = projectBotGame(state, actor, position === 0 ? memory.forPlayer(actor) : undefined);
        const action = position === 0
          ? chooseBotAction(view, { treeSearch: true, random, timeMs: Infinity, samples: 4 })
          : chooseRuleAction(view, botProfiles[(seed + position) % botProfiles.length]);
        assert.ok(action, `${count} players, seed ${seed}, phase ${state.phase}`);
        const modeled = structuredClone(state);
        assert.equal(advanceSimulation(modeled, actor, action), true);
        const result = applyAction(state, actor, { ...action, step: state.step }, memory.observe);
        assert.equal(result.accepted, true, result.error?.message);
        assert.deepEqual(modeled, result.state);
        state = result.state;
        if (state.phase === "ended") break;
        for (const player of players) {
          const { deck, rowStack } = memory.forPlayer(player.id);
          assert.equal(deck.length, state.navDeck.length);
          assert.equal(rowStack.length, state.rowStack.length);
          assert.ok(deck.every((card, index) => card === null || card === state.navDeck[index]));
          assert.ok(rowStack.every((card, index) => card === null || card === state.rowStack[index]));
        }
      }
      assert.equal(state.outcome, "landed");
      assert.equal(state.scores.length, count);
    }
  }
  assert.deepEqual([...phases].sort(), ["action", "answer", "deal", "fight", "navigate", "rescue", "row", "thirst"]);
});

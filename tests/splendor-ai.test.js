import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, createGame, projectGame } from "../src/games/splendor/engine.js";
import { legalActions } from "../src/games/splendor/bot-actions.js";
import { chooseScoredAction, chooseSearchAction, sampleHiddenCards, seededRandom } from "../src/games/splendor/bot.js";

const roster = ["a", "b", "c"].map(id => ({ id }));
const act = (state, action) => applyAction(state, state.players[state.turn].id,
  { ...action, round: state.round, step: state.step });

test("AI enumerates legal draws, voluntary gold payments and exact token returns", () => {
  const state = createGame(roster, "abcd");
  const card = [...state.market[0], ...state.decks[0]].find(card => card.id === "white-L1-03");
  state.market[0] = [card];
  Object.assign(state.bank, { blue: 0, red: 2 });
  Object.assign(state.boards.a.tokens, { red: 2, black: 1, gold: 2 });
  const actions = legalActions(projectGame(state, "a"));
  assert.equal(actions.filter(action => action.type === "take").length, 7); // Four triples and three pairs.
  assert.equal(actions.filter(action => action.type === "buy" && action.cardId === card.id).length, 5);
  for (const action of actions) assert(act(structuredClone(state), action).accepted, JSON.stringify(action));
  Object.assign(state.boards.a.tokens, { white: 4, green: 1 });
  assert(act(state, { type: "take", colors: ["white", "white"] }).accepted);
  const returns = legalActions(projectGame(state, "a"));
  assert(returns.length > 1 && returns.every(action => action.type === "return_tokens"));
  for (const action of returns) assert(act(structuredClone(state), action).accepted, JSON.stringify(action));
  assert.deepEqual(legalActions(projectGame(state, "b")), []);
});

test("search samples only from the visible information and does not modify the game", () => {
  const state = createGame(roster, "abcd");
  assert(act(state, { type: "reserve", blind: true, level: 2 }).accepted);
  assert(act(state, { type: "reserve", blind: true, level: 2 }).accepted);
  const view = projectGame(state, "c"), before = structuredClone(state);
  const world = sampleHiddenCards(view, seededRandom(7));
  assert.deepEqual(world.decks.map(deck => deck.length), view.counts);
  assert.equal(world.boards.a.reserved[0].level, 2);
  assert.equal(world.boards.b.reserved[0].level, 2);
  const cards = [...world.decks.flat(), ...view.market.flat(), ...Object.values(world.boards).flatMap(board => board.reserved)];
  assert.equal(new Set(cards.map(card => card.id)).size, 90);
  const options = () => ({ random: seededRandom(7), timeMs: Infinity, sampleBatches: [2, 2] });
  const move = chooseSearchAction(view, options());
  assert.deepEqual(state, before);
  assert(legalActions(view).some(action => JSON.stringify(action) === JSON.stringify(move)));

  // Replace the real hidden card, and reorder the real deck, keeping the same visible information.
  [state.boards.a.reserved[0], state.decks[1][0]] = [state.decks[1][0], state.boards.a.reserved[0]];
  state.decks[1].reverse();
  const equivalent = projectGame(state, "c");
  assert.deepEqual(equivalent, view);
  assert.deepEqual(chooseSearchAction(equivalent, options()), move);
  assert.deepEqual(chooseSearchAction(equivalent, { timeMs: 0 }), chooseScoredAction(equivalent));
});

test("search plays out the final round before evaluating the winner", () => {
  const state = createGame(roster, "c0ffee");
  const winningCard = state.market[2].find(card => card.points >= 3);
  const smallCard = [...state.market[0], ...state.decks[0]].find(card => card.points === 1);
  state.turn = 1;
  state.endingRound = state.round;
  state.boards.a.score = 15;
  state.boards.b.score = 16;
  state.boards.c.score = 14;
  // Both purchases take C to 15+, but only one overtakes B.
  for (const color of Object.keys(winningCard.cost)) {
    state.boards.c.bonuses[color] = Math.max(winningCard.cost[color], smallCard.cost[color]);
  }
  state.boards.a.purchased = [...state.market[2], ...state.decks[2]].filter(card => card !== winningCard);
  state.decks[2] = [];
  state.market = [[smallCard], [], [winningCard]];
  state.nobles = [];
  const view = projectGame(state, "b");
  assert.equal(chooseScoredAction(view).type, "take");
  const action = chooseSearchAction(view, { random: seededRandom(23), timeMs: Infinity });
  assert.deepEqual(action, { type: "reserve", cardId: winningCard.id });
  assert(act(state, action).accepted);
  assert.equal(state.players[state.turn].id, "c");
  assert(act(state, chooseScoredAction(projectGame(state, "c"))).accepted);
  assert.deepEqual(state.winners, ["b"]);
});

test("scored play can break a take-and-return loop when a purchase is possible", () => {
  const state = createGame(roster.slice(0, 2), (851303).toString(16));
  for (let i = 0; state.phase !== "ended" && i < 160; i++) {
    const action = chooseScoredAction(projectGame(state, state.players[state.turn].id));
    assert(action && act(state, action).accepted);
  }
  assert.equal(state.phase, "ended");
});

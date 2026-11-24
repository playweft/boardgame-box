import { NAVIGATION } from "./data.js";

function observeMove(memory, viewer, move) {
  const { deck, rowStack, choices, spent } = memory;
  switch (move.type) {
    case "draw": {
      const drawn = deck.splice(0, move.cards.length);
      memory.choices = move.player === viewer ? [...move.cards] : drawn;
      break;
    }
    case "sort": {
      if (move.player === viewer) {
        choices.forEach((card, index) => {
          const pile = move.keep[index] ? rowStack : deck;
          pile.push(card);
        });
      } else if (move.returned === choices.length) {
        deck.push(...choices);
      } else if (move.returned === 0) {
        rowStack.push(...choices);
      } else {
        // The public counts do not show which cards went to each pile.
        deck.push(...Array(move.returned).fill(null));
        rowStack.push(...Array(choices.length - move.returned).fill(null));
      }
      memory.choices = [];
      break;
    }
    case "gather": {
      const cards = rowStack.splice(0);
      if (move.drewCompassCard) cards.push(deck.shift());
      memory.choices = move.player === viewer ? [...move.cards] : cards;
      break;
    }
    case "play": {
      let remaining;
      if (move.chosen) {
        let index = choices.indexOf(move.card);
        // A public choice identifies the removed slot only if its position was
        // known or if there was exactly one unknown option.
        if (index < 0 && choices.filter((card) => card === null).length === 1)
          index = choices.indexOf(null);
        remaining = index >= 0
          ? choices.filter((_, slot) => slot !== index)
          : Array(choices.length - 1).fill(null);
      } else {
        if (choices.length) choices.shift();
        else deck.shift();
        remaining = choices;
      }
      deck.push(...remaining, move.card);
      memory.choices = [];
      break;
    }
    case "flare":
      deck.splice(0, move.cards.length);
      deck.push(...move.cards);
      break;
    case "discard":
      spent.push(...move.shown);
      if (move.player === viewer) spent.push(...move.hand);
      break;
    case "offer":
      if (move.player === viewer) {
        for (const card of move.cards) memory.dealt.add(card);
      }
      break;
  }
}

export function createBotMemory(players) {
  const memories = new Map(players.map(({ id }) => [
    id,
    {
      deck: NAVIGATION.map(() => null), rowStack: [], choices: [], spent: [],
      dealt: new Set(),
    },
  ]));
  return {
    observe(moves) {
      for (const move of moves) {
        for (const [viewer, memory] of memories) observeMove(memory, viewer, move);
      }
    },
    forPlayer(id) {
      const { deck, rowStack, spent, dealt } = memories.get(id);
      return { deck, rowStack, spent, dealt: [...dealt] };
    },
  };
}

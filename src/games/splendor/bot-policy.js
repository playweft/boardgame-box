import { COLORS, TOKEN_COLORS, paymentFor, tokenCount } from "./engine.js";
import { legalActions } from "./bot-actions.js";

export const profiles = {
  balanced: { discount: 0.72, prestige: 1.08 },
  engine: { discount: 1.42, prestige: 0.9 },
  rush: { discount: 0.48, prestige: 1.18 },
};

const sumColors = (values) =>
  COLORS.reduce((sum, color) => sum + values[color], 0);

function missingBonuses(board, noble) {
  return COLORS.reduce(
    (sum, color) => sum + Math.max(0, noble.cost[color] - board.bonuses[color]),
    0,
  );
}

// A smooth estimate of gathering turns, with penalties for single-color bottlenecks
// and unavailable gems. Allocate gold to whichever missing gem reduces the estimate most.
function gatherTime(board, card, bank) {
  let total = 0,
    bottleneck = 0,
    scarce = 0,
    second = 0;
  const gold = board.tokens.gold;
  for (const color of COLORS) {
    const missing = Math.max(
      0,
      card.cost[color] - board.bonuses[color] - board.tokens[color],
    );
    const pile = bank[color];
    const pairs = Math.min(
      Math.floor(missing / 2),
      Math.max(0, Math.floor((pile - 2) / 2)),
    );
    const time = missing - pairs * 0.8;
    total += missing;
    scarce += Math.max(0, missing - pile);
    if (time > bottleneck) {
      second = bottleneck;
      bottleneck = time;
    } else if (time > second) second = time;
  }
  return (
    Math.max(
      0,
      (total - gold) / 2.75,
      bottleneck - gold * 0.9,
      second - gold * 0.48,
    ) +
    Math.max(0, scarce - gold) * 0.25
  );
}

function makeContext(view, playerId, profile) {
  const board = view.boards[playerId];
  const market = view.market.flat();
  const cards = [...market, ...board.reserved.filter((card) => !card.hidden)];
  const marketIds = new Set(market.map((card) => card.id));
  const lastTurn = view.endingRound !== null;
  const competition = new Map();
  const topScore = Math.max(
    ...view.players.map((player) => view.boards[player.id].score),
  );
  let projectedLead = topScore;
  for (const { id } of view.players) {
    const rival = view.boards[id];
    for (const card of market) {
      const eta = gatherTime(rival, card, view.bank);
      if (id !== playerId && eta <= 1) {
        // A card that someone can already afford is a less reliable future target.
        const risk = eta === 0 ? (card.points ? 0.1 : 0.06) : 0.025;
        competition.set(
          card.id,
          Math.min(0.48, (competition.get(card.id) || 0) + risk),
        );
      }
      if (rival.score >= 7 && card.points >= 2) {
        // A visible scoring route shortens the time left to recoup a discount.
        projectedLead = Math.max(
          projectedLead,
          rival.score + card.points / (4.2 + eta),
        );
      }
    }
  }
  const stage = Math.min(1, Math.max(0, (projectedLead - 5) / 10));
  const engineWeight = lastTurn ? 0 : profile.discount * (1.04 - 0.63 * stage);
  const prestigeWeight = profile.prestige * (1 + stage * 0.25);
  const colorValue = Object.fromEntries(
    COLORS.map((color) => {
      const demand = market.reduce(
        (sum, card) =>
          sum +
          Math.min(3, Math.max(0, card.cost[color] - board.bonuses[color])) *
            (card.points ? 1 : 0.6),
        0,
      );
      return [color, 0.78 + demand / 32];
    }),
  );
  return {
    view,
    board,
    cards,
    marketIds,
    competition,
    colorValue,
    engineWeight,
    prestigeWeight,
    stage,
    lastTurn,
  };
}

function targetValue(board, card, context, secured) {
  const due = gatherTime(board, card, context.view.bank);
  const cost = COLORS.reduce(
    (sum, color) => sum + Math.max(0, card.cost[color] - board.bonuses[color]),
    0,
  );
  const estimatedTurns = due + Math.max(0, cost - 10) * 0.48;
  const benefit =
    card.points * context.prestigeWeight +
    context.engineWeight * context.colorValue[card.bonus];
  const risk = (context.competition.get(card.id) || 0) * (due ? 1 : 0.2);
  const certainty = secured ? 1.1 : 1 - risk;
  return (benefit * certainty) / (1.65 + estimatedTurns * 1.06);
}

function positionValue(board, context, removedId, securedId, claimedNobleId) {
  if (context.lastTurn) return board.score - sumColors(board.bonuses) * 0.001;
  const { view, engineWeight, prestigeWeight, colorValue } = context;
  let value =
    board.score * prestigeWeight +
    board.tokens.gold * 0.3 -
    board.reserved.length * 0.15;
  let first = 0,
    second = 0,
    third = 0;
  for (const card of context.cards) {
    if (card.id === removedId) continue;
    const target = targetValue(
      board,
      card,
      context,
      card.id === securedId || !context.marketIds.has(card.id),
    );
    if (target > first) {
      third = second;
      second = first;
      first = target;
    } else if (target > second) {
      third = second;
      second = target;
    } else if (target > third) third = target;
  }
  value += first * 1.2 + second * 0.48 + third * 0.24;
  for (const color of COLORS) {
    const bonus = board.bonuses[color];
    value +=
      engineWeight *
      colorValue[color] *
      (Math.min(bonus, 4) + Math.max(0, bonus - 4) * 0.36);
    value +=
      0.096 *
      colorValue[color] *
      Math.min(board.tokens[color], Math.max(1, 5 - bonus));
  }
  let nobleProgress = 0;
  for (const noble of view.nobles) {
    if (noble.id === claimedNobleId) continue;
    const missing = missingBonuses(board, noble);
    nobleProgress += 1.1 / (1 + missing * missing * 0.25);
  }
  return value + nobleProgress * (1 - context.stage * 0.42);
}

function trimTokens(board, context) {
  let excess = tokenCount(board.tokens) - 10;
  if (excess <= 0) return;
  const { colorValue } = context;
  // Predict a plausible discard when comparing takes. Actual discards are ranked exhaustively.
  const targets = context.cards
    .map((card) => ({
      card,
      value: targetValue(board, card, context, !context.marketIds.has(card.id)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  while (excess-- > 0) {
    let cheapest,
      least = Infinity;
    for (const color of TOKEN_COLORS) {
      if (!board.tokens[color]) continue;
      let loss = color === "gold" ? 0.7 : colorValue[color] * 0.09;
      for (const [index, { card }] of targets.entries()) {
        if (
          color === "gold" ||
          board.tokens[color] <= card.cost[color] - board.bonuses[color]
        )
          loss += 0.45 / (index + 1);
      }
      if (loss < least) {
        cheapest = color;
        least = loss;
      }
    }
    board.tokens[cheapest]--;
  }
}

function imminentThreats(view) {
  const dangerous = new Map();
  if (view.endingRound === null) {
    if (
      Math.max(...view.players.map((player) => view.boards[player.id].score)) <
      7
    )
      return dangerous;
  }
  const actor = view.players.findIndex((player) => player.id === view.viewerId);
  for (const [seat, player] of view.players.entries()) {
    if (seat === actor || (view.endingRound !== null && seat < actor)) continue;
    const board = view.boards[player.id];
    const winning = view.market.flat().filter((card) => {
      if (!paymentFor(board, card)) return false;
      const noble = view.nobles.some((n) =>
        COLORS.every(
          (c) => board.bonuses[c] + Number(c === card.bonus) >= n.cost[c],
        ),
      );
      return board.score + card.points + (noble ? 3 : 0) >= 15;
    });
    if (winning.length === 1)
      dangerous.set(winning[0].id, (dangerous.get(winning[0].id) || 0) + 1);
  }
  return dangerous;
}

function idleRounds(view) {
  let turns = 0;
  for (let i = view.history.length - 1; i >= 0; i--) {
    const move = view.history[i];
    if (move.type === "buy" || move.type === "reserve" || move.nobleId) break;
    turns++;
  }
  return turns / view.players.length;
}

export function rankActions(view, profile = profiles.balanced) {
  const actions = legalActions(view);
  if (actions.length < 2)
    return actions.map((action) => ({ action, value: 0 }));
  const context = makeContext(view, view.viewerId, profile);
  const { board } = context;
  const byId = new Map(context.cards.map((card) => [card.id, card]));
  const threats = view.phase === "playing" ? imminentThreats(view) : new Map();
  const idle = idleRounds(view);
  return actions
    .map((action) => {
      const candidate = { ...board, tokens: { ...board.tokens } };
      let removedId,
        securedId,
        nobleId,
        adjustment = 0;
      if (action.type === "buy") {
        const card = byId.get(action.cardId);
        for (const color of TOKEN_COLORS)
          candidate.tokens[color] -= action.payment[color];
        candidate.bonuses = {
          ...board.bonuses,
          [card.bonus]: board.bonuses[card.bonus] + 1,
        };
        candidate.score += card.points;
        removedId = card.id;
        if (!context.marketIds.has(card.id))
          candidate.reserved = board.reserved.slice(1);
        adjustment += 0.17 + 0.025 * card.points + Math.max(0, idle - 2) * 1.5;
      } else if (action.type === "take") {
        for (const color of action.colors) candidate.tokens[color]++;
        trimTokens(candidate, context);
        if (
          TOKEN_COLORS.every(
            (color) => candidate.tokens[color] === board.tokens[color],
          )
        )
          adjustment -= 3;
      } else if (action.type === "reserve") {
        candidate.reserved = [...board.reserved, null];
        if (view.bank.gold) candidate.tokens.gold++;
        trimTokens(candidate, context);
        securedId = action.cardId;
        adjustment -= action.blind ? 0.22 : 0.1;
      } else if (action.type === "return_tokens") {
        for (const color of TOKEN_COLORS)
          candidate.tokens[color] -= action.tokens[color] || 0;
        if (
          view.lastMove?.type === "take" &&
          TOKEN_COLORS.every(
            (color) =>
              (action.tokens[color] || 0) === view.lastMove.tokens[color],
          )
        ) {
          adjustment -= 0.18 + Math.max(0, idle - 2) * 0.15;
        }
      }
      const noble =
        action.type === "choose_noble"
          ? view.nobles.find((item) => item.id === action.nobleId)
          : view.nobles
              .filter((item) => missingBonuses(candidate, item) === 0)
              .sort((a, b) => nobleDenial(view, b) - nobleDenial(view, a))[0];
      if (noble) {
        candidate.score += noble.points;
        nobleId = noble.id;
        adjustment += 0.12 * nobleDenial(view, noble);
      }
      if (removedId || securedId)
        adjustment +=
          Math.min(1, threats.get(removedId || securedId) || 0) * 1.8;
      return {
        action,
        value:
          positionValue(candidate, context, removedId, securedId, nobleId) +
          adjustment,
      };
    })
    .sort((a, b) => b.value - a.value);
}

function nobleDenial(view, noble) {
  let closest = Infinity;
  for (const player of view.players) {
    if (player.id !== view.viewerId)
      closest = Math.min(
        closest,
        missingBonuses(view.boards[player.id], noble),
      );
  }
  return 1 / (1 + closest);
}

export function evaluatePlayers(view) {
  const values = view.players.map(({ id }) => {
    const context = makeContext(view, id, profiles.balanced);
    return positionValue(context.board, context);
  });
  return values;
}

import { COLORS, TOKEN_COLORS, paymentFor, tokenCount } from "./engine.js";

// Visit each way to distribute an exact quantity without exceeding the per-color limits.
function* distributions(colors, limits, amount, index = 0, counts = {}) {
  if (amount === 0) {
    yield { ...counts };
    return;
  }
  if (index === colors.length) return;
  const color = colors[index], limit = Math.min(limits[color], amount);
  for (let count = 0; count <= limit; count++) {
    counts[color] = count;
    yield* distributions(colors, limits, amount - count, index + 1, counts);
  }
  delete counts[color];
}

export function legalActions(view) {
  if (!view.canAct) return [];
  if (view.canPass) return [{ type: "pass" }];
  const board = view.boards[view.viewerId];
  if (view.phase === "choose_noble") return view.eligibleNobleIds.map(nobleId => ({ type: "choose_noble", nobleId }));
  if (view.phase === "return_tokens") return Array.from(
    distributions(TOKEN_COLORS, board.tokens, tokenCount(board.tokens) - 10),
    tokens => ({ type: "return_tokens", tokens }),
  );

  const market = view.market.flat(), actions = [];
  for (const card of [...market, ...board.reserved]) {
    const payment = paymentFor(board, card);
    if (!payment) continue;
    actions.push({ type: "buy", cardId: card.id, payment });
    // Gold can also replace a color the player has, preserving it for a later purchase.
    for (let extra = 1; extra <= board.tokens.gold - payment.gold; extra++) {
      for (const replaced of distributions(COLORS, payment, extra)) {
        const alternative = { gold: payment.gold + extra };
        for (const color of COLORS) alternative[color] = payment[color] - (replaced[color] || 0);
        actions.push({ type: "buy", cardId: card.id, payment: alternative });
      }
    }
  }
  const available = COLORS.filter(color => view.bank[color] > 0);
  if (available.length && available.length <= 3) actions.push({ type: "take", colors: available });
  for (let first = 0; first < available.length; first++) {
    const color = available[first];
    if (view.bank[color] >= 4) actions.push({ type: "take", colors: [color, color] });
    if (available.length <= 3) continue;
    for (let second = first + 1; second < available.length; second++) {
      for (let third = second + 1; third < available.length; third++) {
        actions.push({ type: "take", colors: [color, available[second], available[third]] });
      }
    }
  }
  if (board.reserved.length < 3) {
    for (const card of market) actions.push({ type: "reserve", cardId: card.id });
    view.counts.forEach((count, index) => {
      if (count > 0) actions.push({ type: "reserve", blind: true, level: index + 1 });
    });
  }
  return actions;
}

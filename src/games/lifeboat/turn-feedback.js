import { characterById } from "./data.js";

const name = id => characterById[id]?.short ?? "船员";

export function computerDelay(action) {
  switch (action?.type) {
    case "take":
    case "nothing":
    case "sort":
      return 450;
    case "move":
    case "mug":
    case "join":
    case "answer":
    case "play":
      return 600;
    default:
      return 500;
  }
}

// Both snapshots are from the human seat's view. Feedback carries only public
// roles, counts, and movement endpoints, including for a face-down transfer.
export function describeTurn(before, after, action) {
  const events = after.log.slice(before.log.length);
  const notes = [];
  let transfer = null;
  let significant = false;
  let navigation = false;

  for (const event of events) {
    switch (event.type) {
      case "take":
        notes.push(`${name(event.id)}拿走一张物资牌`);
        transfer = { from: null, to: event.id };
        break;
      case "mug":
        notes.push(`${name(event.from)}从${name(event.to)}那里抢走一张牌`);
        transfer = { from: event.to, to: event.from };
        break;
      case "move":
        notes.push(`${name(event.a)}和${name(event.b)}交换座位`);
        break;
      case "act":
        if (event.act === "nothing") notes.push(`${name(event.id)}选择不动`);
        if (event.act === "row") notes.push(`${name(event.id)}开始划船`);
        if (event.act === "parasol") notes.push(`${name(event.id)}撑开阳伞`);
        // A successful immediate mug or move already has its own public event.
        if (after.phase === "answer" && event.act === "mug") notes.push(`${name(event.id)}向${name(event.target)}抢夺物资`);
        if (after.phase === "answer" && event.act === "move") notes.push(`${name(event.id)}请${name(event.target)}换座`);
        break;
      case "fight":
        notes.push(event.attackersWin ? "进攻方赢得打架" : "防守方赢得打架");
        significant = true;
        break;
      case "fightFlare":
        notes.push(`${name(event.id)}打出信号枪，战力 +8`);
        break;
      case "heal":
        notes.push(`${name(event.id)}给${name(event.target)}治疗了一处伤`);
        break;
      case "nav":
        notes.push("航海结算");
        navigation = true;
        break;
      case "flare":
        if (!navigation) notes.push(`${name(event.id)}使用信号枪`);
        navigation = true;
        break;
      case "lost":
        notes.push(`${name(event.id)}沉海`);
        significant = true;
        break;
    }
  }

  // Gifts made by the human are confirmed by the engine before arriving here.
  if (action?.type === "give") {
    const giver = before.characters.find(entry => entry.player === before.viewerId);
    if (giver) {
      notes.push(`${name(giver.id)}送给${name(action.target)}一张物资牌`);
      transfer = { from: giver.id, to: action.target };
    }
  }
  const actor = before.queue[0];
  if (actor && action?.type === "sort" && !navigation) {
    const kept = after.rowCount - before.rowCount;
    notes.push(kept > 0 ? `${name(actor)}留下 ${kept} 张航海牌` : `${name(actor)}完成划船`);
  }
  if (actor && action?.type === "join" && action.side !== "out") {
    notes.push(`${name(actor)}加入${action.side === "attack" ? "进攻方" : "防守方"}`);
  }
  if (after.falling.length && navigation) {
    notes.push(`${after.falling.map(name).join("、")}落水`);
  }
  if (navigation && after.birds !== before.birds) {
    const added = after.birds - before.birds;
    notes.push(`海鸥 ${added > 0 ? "+" : "−"}${Math.abs(added)}`);
  }

  const injuries = [];
  for (const person of after.characters) {
    const previous = before.characters.find(entry => entry.id === person.id);
    if (previous && person.wounds > previous.wounds) {
      injuries.push(person.id);
      notes.push(`${name(person.id)}受伤 ${person.wounds - previous.wounds} 点`);
    }
    if (action?.type === "arm" && previous && person.shown.length > previous.shown.length) {
      notes.push(`${name(person.id)}亮出武器`);
    }
  }
  if (after.phase === "ended" && before.phase !== "ended") notes.push("救生艇靠岸");
  if (!notes.length) return null;

  return {
    step: after.step,
    day: before.day,
    text: notes.join(" · "),
    injuries,
    transfer,
    hold: significant || navigation || injuries.length ? 850 : 0,
  };
}

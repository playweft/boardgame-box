import { characterName, t } from "./i18n.js";

const name = id => characterName(id, { short: true }) ?? t("characters.crew");

export const FIGHT_RESULT_MS = 1080;
export const FIGHT_SKIP_MS = 450;

export function fightResultBetween(before, after) {
  if (!before || after.step <= before.step || after.log.length <= before.log.length) return null;
  return after.log.slice(before.log.length).findLast(event =>
    event.type === "fight" && Array.isArray(event.attackers) && Array.isArray(event.defenders)
  ) ?? null;
}

export function navigationCardBetween(before, after) {
  if (!before || after.step <= before.step) return null;
  return after.log.slice(before.log.length).findLast(event => event.type === "nav")?.card ?? null;
}

export function computerDelay(action) {
  if (action?.type === "join" && action.side === "out") return 275;
  return ["move", "mug", "join", "answer", "play"].includes(action?.type) ? 450 : 300;
}

// Both snapshots are from the human seat's view. Feedback carries only public
// roles, counts, and movement endpoints, including for a face-down transfer.
export function describeTurn(before, after, action) {
  const events = after.log.slice(before.log.length);
  const notes = [];
  let transfer = null;
  let hold = 0;
  let mug = null;
  let joined = null;
  let winners = [];
  const actor = before.queue[0];
  let navigation = false;

  for (const event of events) {
    switch (event.type) {
      case "take":
        notes.push(`${name(event.id)}拿走一张物资牌`);
        transfer = { from: null, to: event.id };
        hold = Math.max(hold, 350);
        break;
      case "mug":
        notes.push(`${name(event.from)}从${name(event.to)}那里抢走一张牌`);
        transfer = { from: event.to, to: event.from };
        mug = { from: event.from, to: event.to };
        hold = Math.max(hold, 650);
        break;
      case "move":
        notes.push(`${name(event.a)}和${name(event.b)}交换座位`);
        break;
      case "act":
        if (event.act === "nothing") {
          notes.push(`${name(event.id)}不动`);
          hold = Math.max(hold, 250);
        }
        if (event.act === "row") notes.push(`${name(event.id)}开始划船`);
        if (event.act === "parasol") notes.push(`${name(event.id)}撑开阳伞`);
        // A successful immediate mug or move already has its own public event.
        if (after.phase === "answer" && event.act === "mug") {
          mug = { from: event.id, to: event.target };
          notes.push(`${name(mug.from)} → ${name(mug.to)} · 抢夺`);
          hold = Math.max(hold, 800);
        }
        if (after.phase === "answer" && event.act === "move") notes.push(`${name(event.id)}请${name(event.target)}换座`);
        break;
      case "fight":
        notes.push(event.attackersWin ? "进攻方赢得打架" : "防守方赢得打架");
        winners = [...(event.attackersWin ? before.fight?.attackers ?? [event.attacker] : before.fight?.defenders ?? [event.defender])];
        if (actor && action?.type === "join" && action.side === (event.attackersWin ? "attack" : "defend")) winners.push(actor);
        hold = Math.max(hold, 1000);
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
        hold = Math.max(hold, 1000);
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
  if (actor && action?.type === "sort" && !navigation) {
    const kept = after.rowCount - before.rowCount;
    notes.push(kept > 0 ? `${name(actor)}留下 ${kept} 张航海牌` : `${name(actor)}完成划船`);
  }
  if (actor && action?.type === "join" && action.side !== "out") {
    joined = actor;
    notes.push(`${name(actor)}加入${action.side === "attack" ? "进攻方" : "防守方"}`);
    hold = Math.max(hold, 600);
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
    mug,
    joined,
    winners,
    navigation,
    hold: Math.max(hold, navigation || injuries.length ? 900 : 0),
  };
}

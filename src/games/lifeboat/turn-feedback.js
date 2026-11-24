import { cardInfo } from "./data.js";
import { characterName, listNameParts, provisionName, t, tParts } from "./i18n.js";

function name(id) {
  const label = characterName(id, { short: true });
  return label ? { id, label } : t("characters.crew");
}

function weapon(type) {
  return { icon: type, label: provisionName(type) };
}

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

export function treatmentBetween(before, after, usedCard) {
  if (!before || after.step <= before.step || after.log.length <= before.log.length) return null;
  const heal = after.log.slice(before.log.length).findLast(event => event.type === "heal");
  if (!heal) return null;
  const source = before.characters.find(entry => entry.id === heal.id);
  const target = before.characters.find(entry => entry.id === heal.target);
  const remaining = after.characters.find(entry => entry.id === heal.id);
  if (!source || !target || !remaining) return null;
  const visible = [...source.shown, ...(source.hand || [])];
  const stillHeld = new Set([...remaining.shown, ...(remaining.hand || [])]);
  const card = visible.includes(usedCard) ? usedCard : visible.find(id =>
    cardInfo(id)?.type === "medical" && !stillHeld.has(id),
  );
  return { from: source.id, target: target.id, card, wounds: Math.max(0, target.wounds - 1) };
}

export function computerDelay(action) {
  if (action?.type === "join" && action.side === "out") return 275;
  return ["move", "mug", "join", "answer", "play"].includes(action?.type) ? 450 : 300;
}

// Both snapshots are from the human seat's view. Feedback carries only public
// roles, counts, revealed weapons, and movement endpoints for face-down transfers.
export function describeTurn(before, after, action) {
  const events = after.log.slice(before.log.length);
  let line;
  const lines = [];
  const note = (key, values = {}) => {
    if (line) line.push(" · ");
    else {
      line = [];
      lines.push(line);
    }
    line.push(...tParts(key, values).flat());
  };
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
        note("feedback.take", { name: name(event.id), card: { icon: "crate", label: t("feedback.provisionCard") } });
        transfer = { from: null, to: event.id };
        hold = Math.max(hold, 350);
        break;
      case "mug":
        note("feedback.mug", { from: name(event.from), to: name(event.to) });
        transfer = { from: event.to, to: event.from };
        mug = { from: event.from, to: event.to };
        hold = Math.max(hold, 650);
        break;
      case "move":
        note("feedback.move", { first: name(event.a), second: name(event.b) });
        break;
      case "act":
        if (event.act === "nothing") {
          note("feedback.pass", { name: name(event.id) });
          hold = Math.max(hold, 250);
        }
        if (event.act === "row") note("feedback.row", { name: name(event.id) });
        if (event.act === "parasol") note("feedback.parasol", { name: name(event.id) });
        // A successful immediate mug or move already has its own public event.
        if (after.phase === "answer" && event.act === "mug") {
          mug = { from: event.id, to: event.target };
          note("feedback.mugRequest", { from: name(mug.from), to: name(mug.to) });
          hold = Math.max(hold, 800);
        }
        if (after.phase === "answer" && event.act === "move") note("feedback.moveRequest", { from: name(event.id), to: name(event.target) });
        break;
      case "fight":
        note(event.attackersWin ? "feedback.attackWin" : "feedback.defendWin");
        winners = [...(event.attackersWin ? before.fight?.attackers ?? [event.attacker] : before.fight?.defenders ?? [event.defender])];
        if (actor && action?.type === "join" && action.side === (event.attackersWin ? "attack" : "defend")) winners.push(actor);
        hold = Math.max(hold, 1000);
        break;
      case "fightFlare":
        note("feedback.fightFlare", { name: name(event.id), weapon: weapon("flare") });
        break;
      case "heal":
        note("feedback.heal", { name: name(event.id), target: name(event.target) });
        break;
      case "nav": {
        line = null;
        const card = { navigationCard: event.card, label: t("nav.card") };
        if (event.source === "choice") {
          note("feedback.navigationChoice", { name: name(event.navigator), card });
        } else {
          note(event.source === "deck" ? "feedback.navigationDeck" : "feedback.navigationReveal", { card });
        }
        line = null;
        navigation = true;
        break;
      }
      case "flare":
        if (!navigation) note("feedback.flare", { name: name(event.id) });
        navigation = true;
        break;
      case "lost":
        note("feedback.lost", { name: name(event.id) });
        hold = Math.max(hold, 1000);
        break;
    }
  }

  // Gifts made by the human are confirmed by the engine before arriving here.
  if (action?.type === "give") {
    const giver = before.characters.find(entry => entry.player === before.viewerId);
    if (giver) {
      note("feedback.gift", { from: name(giver.id), to: name(action.target) });
      transfer = { from: giver.id, to: action.target };
    }
  }
  if (actor && action?.type === "sort" && !navigation) {
    const kept = after.rowCount - before.rowCount;
    note(kept > 0 ? "feedback.kept" : "feedback.rowed", { name: name(actor), count: kept });
  }
  if (actor && action?.type === "join" && action.side !== "out") {
    joined = actor;
    note(action.side === "attack" ? "feedback.joinAttack" : "feedback.joinDefend", { name: name(actor) });
    hold = Math.max(hold, 600);
  }
  if (after.falling.length && navigation) {
    note("feedback.overboard", { names: listNameParts(after.falling.map(name)) });
  }
  if (navigation && after.birds !== before.birds) {
    const added = after.birds - before.birds;
    note("feedback.birds", { change: `${added > 0 ? "+" : "−"}${Math.abs(added)}` });
  }

  const injuries = [];
  const armedCard = action?.type === "arm" ? cardInfo(action.card) : null;
  for (const person of after.characters) {
    const previous = before.characters.find(entry => entry.id === person.id);
    if (previous) {
      const thirst = events.find(event => event.type === "thirst" && event.id === person.id)?.wounds ?? 0;
      const healed = events.some(event => event.type === "heal" && event.target === person.id) ? 1 : 0;
      const otherWounds = person.wounds - previous.wounds + healed - thirst;
      if (otherWounds > 0 || thirst > 0) injuries.push(person.id);
      if (otherWounds > 0) note("feedback.injured", { name: name(person.id), count: otherWounds });
      if (thirst > 0) note("feedback.thirstInjury", { name: name(person.id), count: thirst });
    }
    if (armedCard?.size && previous && !previous.shown.includes(armedCard.id) && person.shown.includes(armedCard.id)) {
      note("feedback.armed", { name: name(person.id), weapon: weapon(armedCard.type) });
    }
  }
  if (after.phase === "ended" && before.phase !== "ended") note("feedback.landfall");
  if (!lines.length) return null;
  const parts = lines.flatMap((parts, index) => index ? [" · ", ...parts] : parts);

  return {
    step: after.step,
    day: before.day,
    parts,
    lines,
    text: parts.map(part => part.label ?? part).join(""),
    injuries,
    transfer,
    mug,
    joined,
    winners,
    navigation,
    hold: Math.max(hold, navigation || injuries.length ? 900 : 0),
  };
}

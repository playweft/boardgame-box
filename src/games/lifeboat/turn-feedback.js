import { characterName, listNameParts, t, tParts } from "./i18n.js";

function name(id) {
  const label = characterName(id, { short: true });
  return label ? { id, label } : t("characters.crew");
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

export function computerDelay(action) {
  if (action?.type === "join" && action.side === "out") return 275;
  return ["move", "mug", "join", "answer", "play"].includes(action?.type) ? 450 : 300;
}

// Both snapshots are from the human seat's view. Feedback carries only public
// roles, counts, and movement endpoints, including for a face-down transfer.
export function describeTurn(before, after, action) {
  const events = after.log.slice(before.log.length);
  const parts = [];
  const note = (key, values = {}) => {
    if (parts.length) parts.push(" · ");
    parts.push(...tParts(key, values).flat());
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
        note("feedback.take", { name: name(event.id) });
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
        note("feedback.fightFlare", { name: name(event.id) });
        break;
      case "heal":
        note("feedback.heal", { name: name(event.id), target: name(event.target) });
        break;
      case "nav":
        note("feedback.navigation");
        navigation = true;
        break;
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
  for (const person of after.characters) {
    const previous = before.characters.find(entry => entry.id === person.id);
    if (previous && person.wounds > previous.wounds) {
      injuries.push(person.id);
      note("feedback.injured", { name: name(person.id), count: person.wounds - previous.wounds });
    }
    if (action?.type === "arm" && previous && person.shown.length > previous.shown.length) {
      note("feedback.armed", { name: name(person.id) });
    }
  }
  if (after.phase === "ended" && before.phase !== "ended") note("feedback.landfall");
  if (!parts.length) return null;

  return {
    step: after.step,
    day: before.day,
    parts,
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

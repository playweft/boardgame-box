import { LAND_BIRDS, cardInfo, characterById, navigationById } from "./data.js";

export const botProfiles = [
  { caution: 1, aggression: 1, loyalty: 1 },
  { caution: 1.35, aggression: 0.65, loyalty: 0.8 },
  { caution: 0.75, aggression: 1.45, loyalty: 0.8 },
  { caution: 0.9, aggression: 0.9, loyalty: 1.5 },
];

const held = person => [...(person.hand || []), ...person.shown];
const countType = (cards, type) => cards.filter(id => cardInfo(id)?.type === type).length;
const health = person => person.size - person.wounds;
const present = (spec, id) => spec === "all" || (Array.isArray(spec) ? spec.includes(id) : spec?.except?.includes(id) === false);

export function lootValue(person, id) {
  const card = cardInfo(id);
  if (!card?.value) return 0;
  return card.value * (characterById[person.id].doubles === card.type ? 2 : 1);
}

function materialValue(person, id, cards, view, profile) {
  const card = cardInfo(id);
  if (card.value) return lootValue(person, id) * (view.birds >= 3 ? 1.2 : 0.9);
  const room = health(person);
  switch (card.type) {
    case "water": return (room <= 2 ? 4.2 : 2.3) * profile.caution / (1 + countType(cards, "water") * 0.55);
    case "medical": return person.wounds ? (room <= 2 ? 5 : 3) * profile.caution : 1.5;
    case "preserver": return (room <= 2 ? 5 : 2.7) * profile.caution;
    case "parasol": return (view.birds >= 3 ? 1.9 : 3.5) * profile.caution;
    case "flare": return 3.5;
    case "compass": return view.cast.findLast(id => view.characters.find(person => person.id === id).conscious) === person.id ? 4 : 1.6;
    default: return card.size * 0.55 + 0.4;
  }
}

function relation(self, target, profile) {
  let value = target.id === self.id ? (self.hate === self.id && self.love !== self.id ? 0.7 : 1.7) * profile.caution : 0.1;
  if (self.love === target.id) value += profile.loyalty * (0.65 + target.survival / 10);
  if (target.id !== self.id && (self.hate === target.id || self.hate === self.id)) {
    value -= profile.aggression * (0.45 + target.size / 10);
  }
  return value;
}

function injury(person, wounds) {
  const room = health(person);
  if (!person.alive || wounds <= 0) return 0;
  if (wounds > room) return 4.4 + room * 0.2;
  if (wounds === room) return 2.7;
  return wounds * (room <= 3 ? 1.3 : 0.65);
}

function power(person) {
  return person.size + person.shown.reduce((total, id) => total + cardInfo(id).size, 0);
}

function hiddenWeapon(person) {
  return Math.max(0, ...(person.hand || []).map(id => cardInfo(id).size));
}

function sortOptions(choices) {
  return Array.from({ length: 2 ** choices.length }, (_, mask) =>
    choices.map((_, index) => Boolean(mask & (1 << index))));
}

export function rankBotActions(view, profile = botProfiles[0]) {
  if (!view.canAct) return [];
  const self = view.characters.find(person => person.player === view.viewerId);
  const others = view.characters.filter(person => person !== self && !person.removed);
  const cards = held(self);
  const value = (id, owner = self, without = cards) => materialValue(owner, id, without, view, profile);
  const weight = person => relation(self, person, profile);
  const seat = id => view.characters.find(person => person.id === id);
  const entries = [];
  const add = (score, action) => entries.push({ score, action });
  const navigator = view.characters.findLast(person => person.conscious);
  const water = cards.filter(id => cardInfo(id).type === "water");
  const weapon = hiddenWeapon(self);
  const advantage = target => power(self) + weapon * 0.75 - power(target) - Math.min(2, target.handCount * 0.5);

  function navScore(id) {
    const card = navigationById[id];
    if (view.birds + card.bird >= LAND_BIRDS) return 5 + (health(self) <= 2 ? 2 : 0);
    let score = card.bird * (health(self) <= 2 ? 3 : 1.5);
    for (const person of view.characters) {
      if (!person.alive) continue;
      const known = held(person);
      const protectedFromWater = characterById[person.id].swimmer || countType(known, "preserver");
      const wet = present(card.overboard, person.id);
      const thirst = Math.max(0, Number(present(card.thirst, person.id))
        + Number(card.row && person.rowed) + Number(card.fight && person.fought) - Number(person.parasol));
      const damage = Number(wet && !protectedFromWater) + Math.max(0, thirst - countType(known, "water"));
      score -= weight(person) * injury(person, damage);
      if (wet) score -= weight(person) * person.shown.length * 0.15;
    }
    return score;
  }

  if (view.phase === "deal") {
    for (const id of view.offer) add(value(id), { type: "take", card: id });
  } else if (view.phase === "action") {
    add(0.12, { type: "nothing" });
    if (view.navCount) {
      const initiative = navigator === self ? 0.8 : 0;
      const strain = water.length || self.parasol ? 0 : injury(self, 1) * 0.65 * weight(self);
      add(1.35 + initiative + (view.birds >= 3 && health(self) <= 2 ? 0.9 : 0) - strain, { type: "row" });
    }
    if (countType(self.hand, "parasol") && !self.parasol) add(2.4 * profile.caution, { type: "parasol" });
    if (countType(cards, "flare")) {
      add(view.birds >= 3 ? (health(self) <= 2 ? 5 : 2.9) : 0.4, { type: "flare" });
    }
    const kit = cards.find(id => cardInfo(id).type === "medical");
    for (const target of [self, ...others]) {
      if (kit && target.alive && target.wounds) {
        add(weight(target) * (injury(target, 1) + Number(!target.conscious) * 1.4) - 0.7,
          { type: "medical", card: kit, target: target.id });
      }
      if (target === self) continue;
      const edge = advantage(target);
      const attack = target.conscious ? Math.max(0.1, Math.min(0.87, 0.52 + edge * 0.085)) : 1;
      const danger = target.conscious ? (1 - attack) * (1 + injury(self, 1) * profile.caution) : 0;
      const hostility = target.id === self.hate || self.hate === self.id ? 0.6 : 0;
      if (target.handCount) {
        const free = !target.conscious || characterById[self.id].pickpocket;
        add((free ? 1 : attack) * (1.7 + hostility) * profile.aggression - (free ? 0 : danger)
          - (target.id === self.love ? profile.loyalty : 0), { type: "mug", target: target.id });
      }
      for (const id of target.shown) {
        add(attack * (value(id) + lootValue(target, id) * 0.18 + hostility) * profile.aggression - danger - 0.6
          - (target.id === self.love ? profile.loyalty : 0), { type: "mug", target: target.id, card: id });
      }
      const earlier = view.cast.indexOf(self.id) - view.cast.indexOf(target.id);
      const takesHelm = target === navigator && (view.rowCount > 0 || countType(cards, "compass"));
      add(attack * (takesHelm ? 2.3 : Math.max(0, earlier) * (view.supplyCount ? 0.38 : 0)) - danger - 0.2,
        { type: "move", target: target.id });
    }
  } else if (view.phase === "row") {
    const scores = view.rowChoices.map(navScore);
    for (const keep of sortOptions(view.rowChoices)) {
      const selected = scores.filter((_, index) => keep[index]);
      const expected = selected.length ? (navigator === self ? Math.max(...selected) : Math.min(...selected)) : -0.9;
      add(expected - selected.length * 0.03, { type: "sort", keep });
    }
  } else if (view.phase === "navigate") {
    for (const id of view.rowChoices) add(navScore(id), { type: "play", card: id });
  } else if (view.phase === "answer") {
    const attacker = seat(view.demand.from);
    const loss = view.demand.kind === "move" ? 1
      : view.demand.card ? value(view.demand.card) : self.hand.reduce((sum, id) => sum + value(id), 0) / Math.max(1, self.handCount);
    const edge = advantage(attacker);
    add(-loss, { type: "answer", accept: true });
    add(-loss * Math.min(0.95, Math.max(0.1, 0.45 - edge * 0.095))
      - (edge >= 0 ? 0.38 : 0.95) * (weight(self) + injury(self, 1))
      - (attacker.id === self.love ? profile.loyalty : 0)
      + (attacker.id === self.hate ? 0.55 : 0), { type: "answer", accept: false });
  } else if (view.phase === "fight") {
    const attack = view.fight.attackers.map(seat);
    const defend = view.fight.defenders.map(seat);
    const attackPower = attack.reduce((sum, person) => sum + power(person), 0);
    const defendPower = defend.reduce((sum, person) => sum + power(person), 0);
    if (view.fight.stage === "join") {
      add(0, { type: "join", side: "out" });
      for (const [side, team, enemies, ownPower, foePower] of [
        ["attack", attack, defend, attackPower, defendPower],
        ["defend", defend, attack, defendPower, attackPower],
      ]) {
        const edge = ownPower + power(self) + weapon * 0.55 - foePower + (side === "defend" ? 1 : 0);
        const impact = (team.reduce((sum, target) => sum + weight(target) * injury(target, 1), 0)
          - enemies.reduce((sum, target) => sum + weight(target) * injury(target, 1), 0)) * 0.65;
        add(impact * Math.max(0.18, 1 - Math.abs(ownPower - foePower) * 0.07)
          - (edge > 2 ? 0.35 : 0.7 + injury(self, 1)) * profile.caution,
        { type: "join", side });
      }
    } else {
      const attacking = view.fight.attackers.includes(self.id);
      const needed = attacking ? defendPower - attackPower + 1 : attackPower - defendPower;
      add(0, { type: "arm", card: false });
      for (const id of self.hand.filter(id => cardInfo(id).size)) {
        const bonus = cardInfo(id).size;
        add((needed > bonus ? -0.4 : needed > 0 ? 2.5 + injury(self, 1) : needed >= -2 ? 0.95 : 0.1) - bonus * 0.12,
          { type: "arm", card: id });
      }
    }
  } else if (view.phase === "rescue") {
    add(0, { type: "rescue" });
    if (countType(cards, "preserver")) {
      for (const id of view.falling) {
        const target = seat(id);
        if (target !== self && target.conscious) add(weight(target) * injury(target, 1) - 1.15
          - (view.falling.includes(self.id) ? 4 : 0), { type: "rescue", to: id });
      }
    }
    if (countType(self.hand, "chum") && view.falling.length) {
      const impact = view.falling.reduce((sum, id) => {
        const target = seat(id);
        const damped = characterById[id].swimmer || countType(held(target), "preserver");
        return sum - weight(target) * (injury(target, damped ? 1 : 2) - injury(target, damped ? 0 : 1));
      }, 0);
      add(impact - 0.35, { type: "rescue", chum: true });
    }
  } else if (view.phase === "thirst") {
    const uses = [];
    const needs = view.thirst.map(({ id, left }) => ({ person: seat(id), left }));
    let score = 0;
    add(0, { type: "drink", uses: [] });
    for (const card of water) {
      const choices = needs.filter(item => item.left > 0).map(item => ({
        item, gain: weight(item.person) * (injury(item.person, item.left) - injury(item.person, item.left - 1)),
      })).sort((left, right) => right.gain - left.gain);
      const best = choices[0];
      if (!best || best.gain <= 0) break;
      best.item.left -= 1;
      uses.push({ card, for: best.item.person.id });
      score += best.gain - (uses.length < water.length ? 0.65 : view.birds >= 3 ? 0.85 : 1.2);
      add(score, { type: "drink", uses: [...uses] });
    }
  }

  return entries.sort((left, right) => right.score - left.score);
}

export function chooseRuleAction(view, profile) {
  return rankBotActions(view, profile)[0]?.action ?? null;
}

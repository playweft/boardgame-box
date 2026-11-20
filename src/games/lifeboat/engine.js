import {
  CHARACTERS, LAND_BIRDS, MAX_PLAYERS, MIN_PLAYERS, NAVIGATION, PROVISIONS, cardInfo, characterById, navigationById,
} from "./data.js";

const MODULUS = 2147483647;

function hashSeed(seedText) {
  let seed = 0;
  for (const digit of String(seedText).match(/[0-9a-f]/gi) || []) {
    seed = (seed * 16 + Number.parseInt(digit, 16)) % MODULUS;
  }
  return seed || 1;
}

function nextSeed(seed) {
  return (seed * 48271) % MODULUS;
}

function shuffle(list, seed) {
  const deck = [...list];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    seed = nextSeed(seed);
    const other = seed % (index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return { deck, seed };
}

const reject = message => ({ accepted: false, error: { code: "INVALID_ACTION", message } });
const fail = message => ({ ok: false, message });
const ok = () => ({ ok: true });

function character(state, id) {
  return state.characters.find(entry => entry.id === id);
}

function alive(entry) {
  return !!entry && !entry.removed && entry.wounds <= characterById[entry.id].size;
}

function conscious(entry) {
  return !!entry && !entry.removed && entry.wounds < characterById[entry.id].size;
}

function inBoat(entry) {
  return !!entry && !entry.removed;
}

function tradingOpen(state) {
  return ["action", "row", "answer"].includes(state.phase);
}

function holding(entry, where = "both") {
  if (!entry) return [];
  if (where === "hand") return entry.hand;
  if (where === "shown") return entry.shown;
  return [...entry.hand, ...entry.shown];
}

function hasType(entry, type, where = "both") {
  return holding(entry, where).some(id => cardInfo(id)?.type === type);
}

function hasOpenParasol(entry) {
  return entry.parasol && hasType(entry, "parasol", "shown");
}

function takeCard(entry, id) {
  const hand = entry.hand.indexOf(id);
  if (hand >= 0) return entry.hand.splice(hand, 1)[0];
  const shown = entry.shown.indexOf(id);
  if (shown < 0) return "";
  if (cardInfo(id)?.type === "parasol") entry.parasol = false;
  return entry.shown.splice(shown, 1)[0];
}

export function fightWeapons(entry) {
  return holding(entry, "hand").filter(id => cardInfo(id)?.size)
    .concat(holding(entry, "shown").filter(id => cardInfo(id)?.type === "flare"));
}

function fightSize(entry, fight) {
  return entry.shown.reduce((size, id) => {
    const card = cardInfo(id);
    return size + (card?.type === "flare" ? 0 : card?.size ?? 0);
  }, characterById[entry.id].size + (fight.flareBy === entry.id ? cardInfo("flare-1").size : 0));
}

function canonical(ids) {
  const present = new Set(ids);
  return CHARACTERS.map(item => item.id).filter(id => present.has(id));
}

function draw(deck, count) {
  return deck.splice(0, Math.min(count, deck.length));
}

function consciousSeats(state) {
  return state.cast.filter(id => conscious(character(state, id)));
}

function blankTurn(state) {
  state.offer = [];
  state.rowChoices = [];
  state.demand = false;
  state.fight = false;
  state.savedQueue = [];
  state.falling = [];
  state.sharks = false;
  state.thirst = [];
  state.navCard = false;
}

export function createGame(players, seedText = crypto.getRandomValues(new Uint32Array(1))[0].toString(16), options = {}) {
  const count = players.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) throw new Error("需要 4–6 名玩家");
  if (new Set(players.map(player => player.id)).size !== count) throw new Error("玩家不能重复");
  let seed = hashSeed(seedText);
  let cast;
  if (options.cast) {
    cast = canonical(options.cast);
    if (cast.length !== count || new Set(options.cast).size !== count) throw new Error("登船角色数量需要和玩家人数一致");
  } else {
    const dealt = shuffle(CHARACTERS.map(item => item.id), seed);
    seed = dealt.seed;
    cast = canonical(dealt.deck.slice(0, count));
  }
  const assigned = shuffle(cast, seed);
  seed = assigned.seed;
  const loves = shuffle(cast, seed);
  seed = loves.seed;
  const hates = shuffle(cast, seed);
  seed = hates.seed;
  const provisions = shuffle(PROVISIONS.map(item => item.id), seed);
  seed = provisions.seed;
  const navigation = shuffle(NAVIGATION.map(item => item.id), seed);
  seed = navigation.seed;

  const characters = cast.map(id => ({
    id, player: "", wounds: 0, rowed: false, fought: false, parasol: false, removed: false,
    hand: [], shown: [], love: "", hate: "",
  }));
  const bySeat = Object.fromEntries(characters.map(entry => [entry.id, entry]));
  players.forEach((player, index) => {
    const entry = bySeat[assigned.deck[index]];
    entry.player = player.id;
    entry.love = loves.deck[index];
    entry.hate = hates.deck[index];
    entry.hand.push(provisions.deck.shift());
  });

  const state = {
    seed, day: 1, phase: "deal", step: 0, birds: 0,
    supplyDeck: provisions.deck, navDeck: navigation.deck, rowStack: [],
    cast, players: players.map(({ id, name }, index) => ({ id, name: name?.trim() || `玩家 ${index + 1}` })),
    characters, queue: [], offer: [], rowChoices: [], demand: false, fight: false, savedQueue: [],
    falling: [], sharks: false, thirst: [], navCard: false, log: [], scores: false, outcome: false,
  };
  beginDeal(state);
  return state;
}

function beginDeal(state) {
  blankTurn(state);
  const seats = consciousSeats(state);
  if (!state.supplyDeck.length || !seats.length) {
    beginActions(state);
    return;
  }
  state.phase = "deal";
  state.queue = seats;
  state.offer = draw(state.supplyDeck, seats.length);
  if (!state.offer.length) beginActions(state);
}

function beginActions(state) {
  blankTurn(state);
  state.phase = "action";
  state.queue = consciousSeats(state);
  if (!state.queue.length) beginNavigate(state);
}

function acting(state) {
  const id = state.queue[0];
  return id ? character(state, id) : null;
}

function requireActor(state, actorId) {
  const entry = acting(state);
  if (!entry || entry.player !== actorId) return fail("还没轮到你");
  if (!conscious(entry)) return fail("这个角色现在不能行动");
  return ok();
}

function skipUnconscious(state) {
  while (state.queue.length && !conscious(character(state, state.queue[0]))) state.queue.shift();
}

function finishAction(state) {
  state.queue.shift();
  state.rowChoices = [];
  state.demand = false;
  state.fight = false;
  skipUnconscious(state);
  if (state.queue.length) state.phase = "action";
  else beginNavigate(state);
}

function note(state, entry) {
  state.log.push(entry);
}

function beginNavigate(state) {
  const navigator = [...state.cast].reverse().map(id => character(state, id)).find(conscious);
  let cards = state.rowStack.splice(0);
  if (navigator && hasType(navigator, "compass")) {
    const compass = holding(navigator).find(id => cardInfo(id)?.type === "compass");
    takeCard(navigator, compass);
    if (!navigator.shown.includes(compass)) navigator.shown.push(compass);
    if (state.navDeck.length) cards.push(state.navDeck.shift());
  }
  if (!navigator) {
    const card = cards.shift() || state.navDeck.shift();
    state.navDeck.push(...cards);
    if (card) resolveNavigation(state, card);
    else endTurn(state);
    return;
  }
  if (cards.length <= 1) {
    const card = cards[0] || state.navDeck.shift();
    if (card) resolveNavigation(state, card);
    else endTurn(state);
    return;
  }
  state.phase = "navigate";
  state.queue = [navigator.id];
  state.rowChoices = cards;
}

function resolveNavigation(state, cardId) {
  const card = navigationById[cardId];
  state.navCard = cardId;
  state.birds = Math.max(0, state.birds + card.bird);
  note(state, { type: "nav", card: cardId, birds: state.birds });
  state.navDeck.push(cardId);
  if (state.birds >= LAND_BIRDS) {
    finish(state);
    return;
  }
  beginOverboard(state, card);
}

function namedTargets(spec, seats) {
  if (spec === "all") return [...seats];
  if (spec === "none") return [];
  if (Array.isArray(spec)) return seats.filter(id => spec.includes(id));
  return [];
}

function thirstTargets(spec, seats) {
  if (spec === "all") return [...seats];
  if (spec === "none") return [];
  if (Array.isArray(spec)) return seats.filter(id => spec.includes(id));
  if (spec?.except) return seats.filter(id => !spec.except.includes(id));
  return [];
}

function beginOverboard(state, card) {
  const aboard = state.cast.filter(id => inBoat(character(state, id)));
  state.falling = namedTargets(card.overboard, aboard);
  state.sharks = false;
  for (const id of state.falling) {
    const entry = character(state, id);
    const chum = entry.shown.find(cardId => cardInfo(cardId)?.type === "chum");
    if (chum) {
      takeCard(entry, chum);
      state.sharks = true;
    }
  }
  state.phase = "rescue";
  state.queue = state.cast.filter(id => {
    const entry = character(state, id);
    if (!conscious(entry)) return false;
    const canThrow = hasType(entry, "preserver") && state.falling.some(target => target !== id && conscious(character(state, target)) && !hasType(character(state, target), "preserver"));
    const canChum = hasType(entry, "chum", "hand") && state.falling.length;
    return canThrow || canChum;
  });
  if (!state.queue.length) resolveOverboard(state, card);
}

function resolveOverboard(state, card = navigationById[state.navCard]) {
  for (const id of state.falling) {
    const entry = character(state, id);
    if (!inBoat(entry)) continue;
    const preserver = hasType(entry, "preserver", conscious(entry) ? "both" : "shown");
    const base = characterById[id].swimmer || preserver ? 0 : 1;
    entry.wounds += base + (state.sharks ? 1 : 0);
    const drown = entry.wounds >= characterById[id].size && !preserver;
    const killed = entry.wounds > characterById[id].size;
    if (drown || killed) {
      entry.removed = true;
      entry.hand = [];
      entry.shown = [];
      entry.parasol = false;
      note(state, { type: "lost", id });
    } else {
      entry.shown = entry.shown.filter(cardId => cardInfo(cardId)?.type === "preserver");
      if (!entry.shown.some(cardId => cardInfo(cardId)?.type === "parasol")) entry.parasol = false;
    }
  }
  state.falling = [];
  state.sharks = false;
  beginThirst(state, card);
}

function beginThirst(state, card) {
  const present = state.cast.filter(id => inBoat(character(state, id)) && character(state, id).wounds <= characterById[id].size);
  state.thirst = [];
  for (const id of present) {
    const entry = character(state, id);
    let need = 0;
    if (entry.rowed && card.row) need += 1;
    if (entry.fought && card.fight) need += 1;
    if (thirstTargets(card.thirst, present).includes(id)) need += 1;
    if (hasOpenParasol(entry)) need = Math.max(0, need - 1);
    if (need) state.thirst.push({ id, left: need });
  }
  state.phase = "thirst";
  state.queue = state.cast.filter(id => {
    const entry = character(state, id);
    return conscious(entry) && hasType(entry, "water") && state.thirst.some(item => item.left > 0);
  });
  if (!state.queue.length) applyThirst(state);
}

function applyThirst(state) {
  for (const item of state.thirst) {
    const entry = character(state, item.id);
    if (!inBoat(entry) || item.left <= 0) continue;
    entry.wounds += item.left;
    note(state, { type: "thirst", id: item.id, wounds: item.left });
  }
  state.thirst = [];
  endTurn(state);
}

function endTurn(state) {
  if (state.phase === "ended") return;
  for (const entry of state.characters) {
    entry.rowed = false;
    entry.fought = false;
  }
  state.day += 1;
  beginDeal(state);
}

function finish(state) {
  state.phase = "ended";
  state.outcome = "landed";
  state.queue = [];
  state.offer = [];
  state.rowChoices = [];
  state.demand = false;
  state.fight = false;
  state.falling = [];
  state.thirst = [];
  state.scores = state.players.map(player => scorePlayer(state, player.id));
}

function treasureValue(owner, cardId) {
  const card = cardInfo(cardId);
  if (!card?.value) return 0;
  const doubled = characterById[owner.id].doubles === card.type;
  return card.value * (doubled ? 2 : 1);
}

function scorePlayer(state, playerId) {
  const self = state.characters.find(entry => entry.player === playerId);
  const loved = character(state, self.love);
  const hated = character(state, self.hate);
  let survival = 0;
  let love = 0;
  let hate = 0;
  if (self.hate === self.id) {
    for (const other of state.characters) {
      if (other.id !== self.id && other.id !== self.love && !alive(other)) hate += characterById[other.id].size;
    }
    if (self.love === self.id && alive(self)) survival = characterById[self.id].survival;
    else if (loved && alive(loved)) love = characterById[loved.id].survival;
  } else {
    if (alive(self)) survival += characterById[self.id].survival;
    if (self.love === self.id) {
      if (alive(self)) love = characterById[self.id].survival;
    } else if (alive(loved)) love = characterById[loved.id].survival;
    if (hated && !alive(hated)) hate = characterById[hated.id].size;
  }
  const loot = inBoat(self) ? holding(self).reduce((total, id) => total + treasureValue(self, id), 0) : 0;
  return { player: playerId, survival, love, hate, loot, total: survival + love + hate + loot };
}

function mutate(state, actorId, action) {
  if (!action || typeof action.type !== "string") return fail("未知操作");
  if (action.type === "rematch") {
    if (state.phase !== "ended") return fail("船还没有靠岸");
    if (!state.players.some(player => player.id === actorId)) return fail("只有入座玩家可以操作");
    const fresh = createGame(state.players, state.seed.toString(16));
    fresh.step = state.step;
    Object.assign(state, fresh);
    return ok();
  }
  if (state.phase === "ended") return fail("这局已经结束");
  if (action.type === "reveal") {
    const entry = state.characters.find(person => person.player === actorId);
    if (!conscious(entry)) return fail("这个角色现在不能亮牌");
    if (!entry.hand.includes(action.card)) return fail("只能亮出自己手里的牌");
    revealCard(state, entry, action.card);
    const card = cardInfo(action.card);
    if (state.phase === "fight" && card.size && card.type !== "flare" && isFighting(state.fight, entry.id)) {
      restartFightRound(state, entry.id);
    }
    return ok();
  }
  if (action.type === "give") return give(state, state.characters.find(entry => entry.player === actorId), action);
  if (state.phase === "deal") return takeProvision(state, actorId, action);
  if (state.phase === "action") return chooseAction(state, actorId, action);
  if (state.phase === "row") return sortRow(state, actorId, action);
  if (state.phase === "answer") return answerDemand(state, actorId, action);
  if (state.phase === "fight") return fightAction(state, actorId, action);
  if (state.phase === "navigate") return chooseNavigation(state, actorId, action);
  if (state.phase === "rescue") return rescueAction(state, actorId, action);
  if (state.phase === "thirst") return drink(state, actorId, action);
  return fail("未知操作");
}

function takeProvision(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  if (action.type !== "take") return fail("请先从分到的物资里选一张");
  const entry = acting(state);
  const index = state.offer.indexOf(action.card);
  if (index < 0) return fail("这张牌不在待分配的物资里");
  state.offer.splice(index, 1);
  entry.hand.push(action.card);
  note(state, { type: "take", id: entry.id });
  state.queue.shift();
  skipUnconscious(state);
  if (!state.queue.length || !state.offer.length) {
    state.offer = [];
    beginActions(state);
  }
  return ok();
}

function chooseAction(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  const entry = acting(state);
  if (action.type === "nothing") {
    note(state, { type: "act", id: entry.id, act: "nothing" });
    finishAction(state);
    return ok();
  }
  if (action.type === "row") return startRow(state, entry);
  if (action.type === "move") return startMove(state, entry, action.target);
  if (action.type === "mug") return startMug(state, entry, action);
  if (action.type === "medical") return useMedical(state, entry, action);
  if (action.type === "flare") return useFlare(state, entry);
  if (action.type === "parasol") return openParasol(state, entry);
  return fail("现在不能这样做");
}

function revealCard(state, entry, card) {
  takeCard(entry, card);
  entry.shown.push(card);
  const demand = state.demand;
  // A pending request for a dark card can still claim the last one when it is shown.
  if (demand?.kind === "mug" && demand.to === entry.id && !demand.card && !entry.hand.length) {
    demand.card = card;
  }
}

function give(state, entry, action) {
  if (!tradingOpen(state)) return fail("只有行动阶段且未开战时可以交易");
  if (!conscious(entry)) return fail("这个角色现在不能交易");
  const target = character(state, action.target);
  if (!target || target.id === entry.id || !inBoat(target)) return fail("不能把牌交给这个角色");
  if (!holding(entry).includes(action.card)) return fail("你没有这张牌");
  const demand = state.demand;
  if (demand?.kind === "mug" && demand.to === entry.id) {
    const required = demand.card === action.card
      || (!demand.card && entry.hand.length === 1 && entry.hand.includes(action.card));
    if (required) return fail("这张牌涉及尚未回应的抢夺");
  }
  const shown = entry.shown.includes(action.card);
  const openParasol = shown && cardInfo(action.card)?.type === "parasol" && entry.parasol;
  takeCard(entry, action.card);
  if (shown) target.shown.push(action.card);
  else target.hand.push(action.card);
  if (openParasol) target.parasol = true;
  return ok();
}

function startRow(state, entry) {
  const oars = holding(entry, "shown").filter(id => cardInfo(id)?.type === "oar")
    .concat(holding(entry, "hand").filter(id => cardInfo(id)?.type === "oar"));
  const drawn = draw(state.navDeck, 2 + oars.length);
  if (!drawn.length) return fail("航海牌已经看完了");
  for (const id of oars.slice(0, Math.max(0, drawn.length - 2))) {
    if (entry.hand.includes(id)) revealCard(state, entry, id);
  }
  state.phase = "row";
  state.rowChoices = drawn;
  entry.rowed = true;
  note(state, { type: "act", id: entry.id, act: "row", cards: drawn.length });
  return ok();
}

function sortRow(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  if (action.type !== "sort" || !Array.isArray(action.keep) || action.keep.length !== state.rowChoices.length) {
    return fail("请决定每张航海牌是留下划船，还是放回牌底");
  }
  if (action.keep.some(value => value !== true && value !== false)) return fail("请决定每张航海牌是留下划船，还是放回牌底");
  const back = [];
  action.keep.forEach((keep, index) => {
    const card = state.rowChoices[index];
    if (keep) state.rowStack.push(card);
    else back.push(card);
  });
  state.navDeck.push(...back);
  state.rowChoices = [];
  finishAction(state);
  return ok();
}

function startMove(state, entry, targetId) {
  const target = character(state, targetId);
  if (!target || target.id === entry.id || !inBoat(target)) return fail("请选择船上的另一个角色");
  note(state, { type: "act", id: entry.id, act: "move", target: target.id });
  if (!conscious(target)) {
    swap(state, entry.id, target.id);
    finishAction(state);
    return ok();
  }
  state.savedQueue = state.queue.slice(1);
  state.phase = "answer";
  state.demand = { kind: "move", from: entry.id, to: target.id, card: false };
  state.queue = [target.id];
  return ok();
}

function startMug(state, entry, action) {
  const target = character(state, action.target);
  if (!target || target.id === entry.id || !inBoat(target)) return fail("请选择船上的另一个角色");
  const hidden = !action.card;
  if (!hidden && !target.shown.includes(action.card)) return fail("只能指定对方亮出的牌，或随机摸一张暗牌");
  if (hidden && !target.hand.length) return fail("对方没有可以摸走的暗牌");
  note(state, { type: "act", id: entry.id, act: "mug", target: target.id });
  const free = !conscious(target) || (hidden && characterById[entry.id].pickpocket);
  if (free) {
    steal(state, entry, target, hidden ? false : action.card);
    finishAction(state);
    return ok();
  }
  state.savedQueue = state.queue.slice(1);
  state.phase = "answer";
  state.demand = { kind: "mug", from: entry.id, to: target.id, card: hidden ? false : action.card };
  state.queue = [target.id];
  return ok();
}

function steal(state, attacker, target, card) {
  let taken = card;
  if (!taken) {
    if (!target.hand.length) return;
    state.seed = nextSeed(state.seed);
    const index = state.seed % target.hand.length;
    taken = target.hand.splice(index, 1)[0];
  } else if (!takeCard(target, taken)) return;
  attacker.hand.push(taken);
  note(state, { type: "mug", from: attacker.id, to: target.id });
  return taken;
}

function swap(state, left, right) {
  const a = state.cast.indexOf(left);
  const b = state.cast.indexOf(right);
  [state.cast[a], state.cast[b]] = [state.cast[b], state.cast[a]];
  const order = Object.fromEntries(state.cast.map((id, index) => [id, index]));
  state.characters.sort((one, other) => order[one.id] - order[other.id]);
  note(state, { type: "move", a: left, b: right });
}

function answerDemand(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  if (action.type !== "answer" || typeof action.accept !== "boolean") return fail("请答应，或者开口应战");
  const demand = state.demand;
  const attacker = character(state, demand.from);
  const defender = character(state, demand.to);
  if (action.accept) {
    if (demand.kind === "move") swap(state, demand.from, demand.to);
    else steal(state, attacker, defender, demand.card);
    state.demand = false;
    state.queue = [attacker.id, ...state.savedQueue];
    state.savedQueue = [];
    finishAction(state);
    return ok();
  }
  beginFight(state, attacker, defender);
  return ok();
}

function beginFight(state, attacker, defender) {
  state.phase = "fight";
  state.fight = {
    attacker: attacker.id, defender: defender.id,
    attackers: [attacker.id], defenders: [defender.id],
    pending: consciousSeats(state), stage: "join", flareBy: false,
  };
  nextFightDecision(state);
}

function isFighting(fight, id) {
  return fight.attackers.includes(id) || fight.defenders.includes(id);
}

function nextFightDecision(state) {
  const fight = state.fight;
  while (fight.pending.length) {
    const id = fight.pending[0];
    const fighting = isFighting(fight, id);
    if (!fighting || fightWeapons(character(state, id)).length) {
      fight.stage = fighting ? "arm" : "join";
      state.queue = [id];
      return;
    }
    fight.pending.shift();
  }
  resolveFight(state);
}

// Each new contribution gives everyone another opportunity to react.
function restartFightRound(state, id, includeCurrent = true) {
  const fight = state.fight;
  const seats = consciousSeats(state);
  const index = seats.indexOf(id);
  fight.pending = [...seats.slice(index + 1), ...seats.slice(0, index + Number(includeCurrent))];
  delete fight.arm;
  nextFightDecision(state);
}

function fightAction(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  const fight = state.fight;
  const entry = acting(state);
  if (fight.stage === "join") {
    if (action.type !== "join" || !["attack", "defend", "out"].includes(action.side)) return fail("请选择加入哪一边，或者不参与");
    if (action.side !== "out") {
      const side = action.side === "attack" ? fight.attackers : fight.defenders;
      side.push(entry.id);
      restartFightRound(state, entry.id);
    } else passFightDecision(state, entry.id);
    return ok();
  }
  if (action.type !== "arm") return fail("请亮出武器，或放弃加战力");
  if (!action.card) {
    passFightDecision(state, entry.id);
    return ok();
  }
  if (!fightWeapons(entry).includes(action.card)) return fail("这张牌不能当武器");
  if (cardInfo(action.card).type === "flare") {
    takeCard(entry, action.card);
    fight.flareBy = entry.id;
    note(state, { type: "fightFlare", id: entry.id });
  } else revealCard(state, entry, action.card);
  restartFightRound(state, entry.id);
  return ok();
}

function passFightDecision(state, id) {
  if (state.fight.arm) {
    // A durable room can still be in the middle of the old, two-stage fight.
    restartFightRound(state, id, false);
    return;
  }
  state.fight.pending.shift();
  nextFightDecision(state);
}

function resolveFight(state) {
  const fight = state.fight;
  const attack = fight.attackers.reduce((total, id) => total + fightSize(character(state, id), fight), 0);
  const defense = fight.defenders.reduce((total, id) => total + fightSize(character(state, id), fight), 0);
  const attackersWin = attack > defense;
  const losers = attackersWin ? fight.defenders : fight.attackers;
  for (const id of losers) character(state, id).wounds += 1;
  for (const id of [...fight.attackers, ...fight.defenders]) character(state, id).fought = true;
  note(state, { type: "fight", attacker: fight.attacker, defender: fight.defender, attackersWin, losers });
  if (attackersWin) {
    const demand = state.demand;
    if (demand.kind === "move") swap(state, demand.from, demand.to);
    else steal(state, character(state, demand.from), character(state, demand.to), demand.card);
  }
  state.fight = false;
  state.demand = false;
  state.queue = [fight.attacker, ...state.savedQueue];
  state.savedQueue = [];
  finishAction(state);
}

function useMedical(state, entry, action) {
  const kit = action.card;
  if (!holding(entry).includes(kit) || cardInfo(kit)?.type !== "medical") return fail("你没有医药包");
  const target = character(state, action.target);
  if (!target || !inBoat(target)) return fail("请选择船上的伤员");
  if (target.wounds <= 0 || target.wounds > characterById[target.id].size) return fail("医药包只能减少一名伤员的一处伤");
  takeCard(entry, kit);
  target.wounds -= 1;
  note(state, { type: "heal", id: entry.id, target: target.id });
  finishAction(state);
  return ok();
}

function useFlare(state, entry) {
  const flare = holding(entry).find(id => cardInfo(id)?.type === "flare");
  if (!flare) return fail("你没有信号枪");
  takeCard(entry, flare);
  const drawn = draw(state.navDeck, 3);
  for (const id of drawn) {
    const card = navigationById[id];
    state.birds = Math.max(0, state.birds + card.bird);
    note(state, { type: "flare", id: entry.id, card: id, birds: state.birds });
    state.navDeck.push(id);
    if (state.birds >= LAND_BIRDS) {
      finish(state);
      return ok();
    }
  }
  note(state, { type: "act", id: entry.id, act: "flare" });
  finishAction(state);
  return ok();
}

function openParasol(state, entry) {
  const card = holding(entry).find(id => cardInfo(id)?.type === "parasol");
  if (!card || hasOpenParasol(entry)) return fail("阳伞已经撑开，或者你没有阳伞");
  if (entry.hand.includes(card)) revealCard(state, entry, card);
  entry.parasol = true;
  note(state, { type: "act", id: entry.id, act: "parasol" });
  finishAction(state);
  return ok();
}

function chooseNavigation(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  if (action.type !== "play" || !state.rowChoices.includes(action.card)) return fail("请从划船堆里选一张航海牌");
  const rest = state.rowChoices.filter(id => id !== action.card);
  state.rowChoices = [];
  state.rowStack = [];
  state.navDeck.push(...rest);
  resolveNavigation(state, action.card);
  return ok();
}

function rescueAction(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  if (action.type !== "rescue") return fail("请决定是否抛出救生圈或鱼饵");
  const entry = acting(state);
  if (action.to) {
    const target = character(state, action.to);
    const preserver = holding(entry).find(id => cardInfo(id)?.type === "preserver");
    if (!preserver || !target || !state.falling.includes(target.id) || target.id === entry.id || !conscious(target) || hasType(target, "preserver")) {
      return fail("救生圈只能抛给落水、还清醒、而且自己没有救生圈的人");
    }
    takeCard(entry, preserver);
    target.shown.push(preserver);
  }
  if (action.chum) {
    const chum = entry.hand.find(id => cardInfo(id)?.type === "chum");
    if (!chum || !state.falling.length) return fail("现在不能投放鱼饵");
    takeCard(entry, chum);
    state.sharks = true;
  }
  state.queue.shift();
  if (state.queue.length) return ok();
  resolveOverboard(state);
  return ok();
}

function drink(state, actorId, action) {
  const check = requireActor(state, actorId);
  if (!check.ok) return check;
  if (action.type !== "drink") return fail("请分配淡水，或放弃");
  const entry = acting(state);
  const uses = Array.isArray(action.uses) ? action.uses : null;
  if (!uses) return fail("请分配淡水，或放弃");
  const spent = new Set();
  for (const use of uses) {
    if (!use || typeof use !== "object") return fail("请选择淡水和喝水的人");
    if (spent.has(use.card) || !holding(entry).includes(use.card) || cardInfo(use.card)?.type !== "water") return fail("只能用自己的淡水");
    const need = state.thirst.find(item => item.id === use.for && item.left > 0);
    if (!need) return fail("这个人现在不口渴");
    spent.add(use.card);
    need.left -= 1;
  }
  for (const card of spent) takeCard(entry, card);
  state.queue.shift();
  state.queue = state.queue.filter(id => hasType(character(state, id), "water") && state.thirst.some(item => item.left > 0));
  if (!state.queue.length) applyThirst(state);
  return ok();
}

export function applyAction(state, actorId, action) {
  if (!state.players.some(player => player.id === actorId) && action?.type !== "rematch") {
    if (!state.players.some(player => player.id === actorId)) return reject("只有入座玩家可以操作");
  }
  if (!action || action.step !== state.step) return reject("局面已更新，请重新选择");
  const next = structuredClone(state);
  const result = mutate(next, actorId, action);
  if (!result.ok) return reject(result.message);
  next.step += 1;
  return { accepted: true, state: next, events: [] };
}

export function actingPlayer(state) {
  if (state.phase === "ended") return state.players[0]?.id ?? "";
  return acting(state)?.player || state.players[0]?.id || "";
}

function publicCharacter(state, entry, viewer, ended) {
  const mine = entry.player === viewer;
  const info = characterById[entry.id];
  return {
    id: entry.id, player: entry.player, wounds: entry.wounds, size: info.size, survival: info.survival,
    rowed: entry.rowed, fought: entry.fought, parasol: hasOpenParasol(entry), removed: entry.removed,
    conscious: conscious(entry), alive: alive(entry),
    shown: entry.shown, handCount: entry.hand.length,
    love: ended || mine ? entry.love : false,
    hate: ended || mine ? entry.hate : false,
    hand: ended || mine ? entry.hand : false,
  };
}

export function projectGame(state, viewerId) {
  const ended = state.phase === "ended";
  const actor = acting(state);
  const mine = actor?.player === viewerId;
  const tradeOpen = tradingOpen(state);
  const privatePrompt = state.phase === "rescue" || state.phase === "thirst"
    || (state.phase === "fight" && state.fight.stage === "arm");
  const fight = state.fight;
  return {
    players: state.players,
    cast: state.cast,
    characters: state.characters.map(entry => publicCharacter(state, entry, viewerId, ended)),
    viewerId, day: state.day, phase: state.phase, step: state.step, birds: state.birds,
    supplyCount: state.supplyDeck.length, navCount: state.navDeck.length, rowCount: state.rowStack.length,
    offer: state.phase === "deal" && mine ? state.offer : false,
    offerCount: state.offer.length,
    rowChoices: (state.phase === "row" || state.phase === "navigate") && mine ? state.rowChoices : false,
    demand: state.demand,
    fight: fight && {
      attacker: fight.attacker, defender: fight.defender, stage: fight.stage,
      attackers: fight.attackers, defenders: fight.defenders, flareBy: fight.flareBy || false,
    },
    falling: state.falling,
    thirst: state.thirst,
    navCard: state.navCard,
    queue: privatePrompt ? (mine ? state.queue.slice(0, 1) : []) : state.queue,
    // Durable rooms may still contain records created before card IDs were removed.
    log: state.log.map(entry => {
      if (entry.type === "take") return { type: entry.type, id: entry.id };
      if (entry.type === "mug") return { type: entry.type, from: entry.from, to: entry.to };
      return entry;
    }),
    scores: state.scores,
    outcome: state.outcome,
    canAct: mine && state.phase !== "ended",
    tradeOpen,
    canTrade: tradeOpen && conscious(state.characters.find(entry => entry.player === viewerId)),
    canRematch: ended && state.players.some(player => player.id === viewerId),
  };
}

export function projectBotGame(state, viewerId) {
  // This is the public action queue as it stood before the demand interrupted it.
  return {
    ...projectGame(state, viewerId),
    remainingActions: [...state.savedQueue],
    fightPending: state.fight && [...state.fight.pending],
  };
}

export { alive, conscious, characterById };

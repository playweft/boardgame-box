local MODULUS = 2147483647
local LAND_BIRDS = 4
local ORDER = {"lauren", "stephen", "captain", "mate", "frenchy", "kid"}
local META = {
  lauren = {size = 4, survival = 8, doubles = "jewels", swimmer = false, pickpocket = false},
  stephen = {size = 5, survival = 7, doubles = "painting", swimmer = false, pickpocket = false},
  captain = {size = 7, survival = 5, doubles = "cash", swimmer = false, pickpocket = false},
  mate = {size = 8, survival = 4, doubles = false, swimmer = false, pickpocket = false},
  frenchy = {size = 6, survival = 6, doubles = false, swimmer = true, pickpocket = false},
  kid = {size = 3, survival = 9, doubles = false, swimmer = false, pickpocket = true},
}
local WEAPON = {oar = 1, blackjack = 2, knife = 3, hook = 4, flare = 8}
local VALUE = {["painting-1"] = 2, ["painting-2"] = 3, ["painting-3"] = 3}
for index = 1, 6 do VALUE["cash-" .. index] = 1 end
for index = 1, 3 do VALUE["jewels-" .. index] = 3 end
local NAV = {
  ["nav-1"] = {overboard = {"frenchy"}, thirst = {"captain", "mate", "frenchy"}, bird = 1, row = false, fight = false},
  ["nav-2"] = {overboard = "all", thirst = "all", bird = 1, row = true, fight = true},
  ["nav-3"] = {overboard = {"madame"}, thirst = {except = {"stephen", "madame", "lauren", "kid"}}, bird = 1, row = true, fight = false},
  ["nav-4"] = {overboard = {"mate"}, thirst = {"captain", "frenchy"}, bird = 0, row = true, fight = true},
  ["nav-5"] = {overboard = {"frenchy"}, thirst = {"captain", "mate", "kid"}, bird = 0, row = true, fight = false},
  ["nav-6"] = {overboard = {"stephen"}, thirst = {"captain", "mate", "frenchy"}, bird = 0, row = true, fight = true},
  ["nav-7"] = {overboard = {"kid"}, thirst = {"captain", "mate", "frenchy", "lauren"}, bird = 0, row = false, fight = true},
  ["nav-8"] = {overboard = {"frenchy"}, thirst = {"captain", "mate", "frenchy", "stephen"}, bird = 0, row = true, fight = true},
  ["nav-9"] = {overboard = {"frenchy"}, thirst = {"captain", "mate", "lauren"}, bird = 0, row = false, fight = true},
  ["nav-10"] = {overboard = {"captain"}, thirst = {"mate"}, bird = 1, row = false, fight = true},
  ["nav-11"] = {overboard = {"stephen"}, thirst = {"captain", "stephen"}, bird = 0, row = false, fight = false},
  ["nav-12"] = {overboard = "none", thirst = "none", bird = 1, row = false, fight = false},
  ["nav-13"] = {overboard = {"kid"}, thirst = {except = {"kid"}}, bird = 0, row = true, fight = false},
  ["nav-14"] = {overboard = {"kid"}, thirst = {except = {"lauren"}}, bird = 1, row = true, fight = true},
  ["nav-15"] = {overboard = "all", thirst = "all", bird = 0, row = false, fight = true},
  ["nav-16"] = {overboard = {"mate"}, thirst = {"kid"}, bird = 1, row = false, fight = true},
  ["nav-17"] = {overboard = {"stephen"}, thirst = {"captain", "lauren"}, bird = 0, row = false, fight = true},
  ["nav-18"] = {overboard = {"captain"}, thirst = {"stephen"}, bird = 0, row = true, fight = true},
  ["nav-19"] = {overboard = {"mate"}, thirst = {"captain", "mate"}, bird = 0, row = true, fight = false},
  ["nav-20"] = {overboard = {"mate"}, thirst = {"lauren"}, bird = 0, row = false, fight = false},
  ["nav-21"] = {overboard = {"kid"}, thirst = {"captain", "mate", "frenchy", "kid"}, bird = 0, row = false, fight = true},
  ["nav-22"] = {overboard = {"lauren"}, thirst = {except = {"kid"}}, bird = -1, row = true, fight = false},
  ["nav-23"] = {overboard = {"captain"}, thirst = {"frenchy"}, bird = 0, row = false, fight = false},
  ["nav-24"] = {overboard = {"stephen"}, thirst = {"captain", "kid"}, bird = 1, row = true, fight = false},
}

local function copy(list)
  local out = {}
  for index, value in ipairs(list) do out[index] = value end
  return out
end

local function index_of(list, value)
  for index, item in ipairs(list) do
    if item == value then return index end
  end
end

local function push(list, value)
  list[#list + 1] = value
end

local function hash_seed(text)
  local seed = 0
  for digit in tostring(text):gmatch("%x") do
    seed = (seed * 16 + tonumber(digit, 16)) % MODULUS
  end
  if seed == 0 then seed = 1 end
  return seed
end

local function next_seed(seed)
  return (seed * 48271) % MODULUS
end

local function shuffle(list, seed)
  local deck = copy(list)
  for index = #deck, 2, -1 do
    seed = next_seed(seed)
    local other = seed % index + 1
    deck[index], deck[other] = deck[other], deck[index]
  end
  return deck, seed
end

local function card_type(id)
  return tostring(id):match("^(.*)%-%d+$")
end

local function provision_ids()
  local list = {}
  local function copies(kind, count)
    for index = 1, count do push(list, kind .. "-" .. index) end
  end
  copies("water", 16)
  copies("oar", 2)
  copies("chum", 2)
  copies("medical", 3)
  copies("cash", 6)
  push(list, "painting-1")
  push(list, "painting-2")
  push(list, "painting-3")
  push(list, "parasol-1")
  push(list, "preserver-1")
  push(list, "blackjack-1")
  push(list, "compass-1")
  push(list, "flare-1")
  push(list, "hook-1")
  copies("jewels", 3)
  push(list, "knife-1")
  return list
end

local function nav_ids()
  local list = {}
  for index = 1, 24 do push(list, "nav-" .. index) end
  return list
end

local function character(state, id)
  for _, entry in ipairs(state.characters) do
    if entry.id == id then return entry end
  end
end

local function alive(entry)
  return entry and not entry.removed and entry.wounds <= META[entry.id].size
end

local function conscious(entry)
  return entry and not entry.removed and entry.wounds < META[entry.id].size
end

local function in_boat(entry)
  return entry and not entry.removed
end

local function trading_open(state)
  return state.phase == "action" or state.phase == "row" or state.phase == "answer"
end

local function holding(entry, where)
  local out = {}
  if where ~= "shown" then
    for _, id in ipairs(entry.hand) do push(out, id) end
  end
  if where ~= "hand" then
    for _, id in ipairs(entry.shown) do push(out, id) end
  end
  return out
end

local function has_type(entry, kind, where)
  for _, id in ipairs(holding(entry, where or "both")) do
    if card_type(id) == kind then return true end
  end
  return false
end

local function has_open_parasol(entry)
  return entry.parasol and has_type(entry, "parasol", "shown")
end

local function find_type(entry, kind, where)
  for _, id in ipairs(holding(entry, where or "both")) do
    if card_type(id) == kind then return id end
  end
end

local function take_card(entry, id)
  local index = index_of(entry.hand, id)
  if index then return table.remove(entry.hand, index) end
  index = index_of(entry.shown, id)
  if not index then return nil end
  if card_type(id) == "parasol" then entry.parasol = false end
  return table.remove(entry.shown, index)
end

local function fight_weapons(entry)
  local weapons = {}
  for _, id in ipairs(entry.hand) do
    if WEAPON[card_type(id)] then push(weapons, id) end
  end
  for _, id in ipairs(entry.shown) do
    if card_type(id) == "flare" then push(weapons, id) end
  end
  return weapons
end

local function fight_size(entry, fight)
  local size = META[entry.id].size + (fight.flareBy == entry.id and WEAPON.flare or 0)
  for _, id in ipairs(entry.shown) do
    local kind = card_type(id)
    if kind ~= "flare" then size = size + (WEAPON[kind] or 0) end
  end
  return size
end

local function canonical(ids)
  local present = {}
  for _, id in ipairs(ids) do present[id] = true end
  local out = {}
  for _, id in ipairs(ORDER) do
    if present[id] then push(out, id) end
  end
  return out
end

local function draw(deck, count)
  local out = {}
  local amount = math.min(count, #deck)
  for _ = 1, amount do push(out, table.remove(deck, 1)) end
  return out
end

local function conscious_seats(state)
  local out = {}
  for _, id in ipairs(state.cast) do
    if conscious(character(state, id)) then push(out, id) end
  end
  return out
end

local function note(state, entry)
  push(state.log, entry)
end

local function blank_turn(state)
  state.offer = {}
  state.rowChoices = {}
  state.demand = false
  state.fight = false
  state.savedQueue = {}
  state.falling = {}
  state.sharks = false
  state.thirst = {}
  state.navCard = false
end

local begin_deal, begin_actions, begin_navigate, resolve_navigation, begin_overboard
local resolve_overboard, begin_thirst, apply_thirst, end_turn, finish, finish_action

local function acting(state)
  local id = state.queue[1]
  if id then return character(state, id) end
end

local function skip_unconscious(state)
  while state.queue[1] and not conscious(character(state, state.queue[1])) do
    table.remove(state.queue, 1)
  end
end

begin_deal = function(state)
  blank_turn(state)
  local seats = conscious_seats(state)
  if #state.supplyDeck == 0 or #seats == 0 then
    begin_actions(state)
    return
  end
  state.phase = "deal"
  state.queue = seats
  state.offer = draw(state.supplyDeck, #seats)
  if #state.offer == 0 then begin_actions(state) end
end

begin_actions = function(state)
  blank_turn(state)
  state.phase = "action"
  state.queue = conscious_seats(state)
  if #state.queue == 0 then begin_navigate(state) end
end

finish_action = function(state)
  table.remove(state.queue, 1)
  state.rowChoices = {}
  state.demand = false
  state.fight = false
  skip_unconscious(state)
  if #state.queue > 0 then state.phase = "action" else begin_navigate(state) end
end

local function named_targets(spec, seats)
  if spec == "all" then return copy(seats) end
  if spec == "none" then return {} end
  if type(spec) == "table" and not spec.except then
    local wanted = {}
    for _, id in ipairs(spec) do wanted[id] = true end
    local out = {}
    for _, id in ipairs(seats) do
      if wanted[id] then push(out, id) end
    end
    return out
  end
  return {}
end

local function thirst_targets(spec, seats)
  if spec == "all" then return copy(seats) end
  if spec == "none" then return {} end
  if type(spec) == "table" and spec.except then
    local skip = {}
    for _, id in ipairs(spec.except) do skip[id] = true end
    local out = {}
    for _, id in ipairs(seats) do
      if not skip[id] then push(out, id) end
    end
    return out
  end
  if type(spec) == "table" then return named_targets(spec, seats) end
  return {}
end

local function contains(list, value)
  return index_of(list, value) ~= nil
end

finish = function(state)
  state.phase = "ended"
  state.outcome = "landed"
  state.queue = {}
  state.offer = {}
  state.rowChoices = {}
  state.demand = false
  state.fight = false
  state.falling = {}
  state.thirst = {}
  local scores = {}
  for _, player in ipairs(state.players) do
    local self = nil
    for _, entry in ipairs(state.characters) do
      if entry.player == player.id then self = entry break end
    end
    local loved = character(state, self.love)
    local hated = character(state, self.hate)
    local survival, love, hate = 0, 0, 0
    if self.hate == self.id then
      for _, other in ipairs(state.characters) do
        if other.id ~= self.id and other.id ~= self.love and not alive(other) then hate = hate + META[other.id].size end
      end
      if self.love == self.id and alive(self) then survival = META[self.id].survival
      elseif loved and alive(loved) then love = META[loved.id].survival end
    else
      if alive(self) then survival = survival + META[self.id].survival end
      if self.love == self.id then
        if alive(self) then love = META[self.id].survival end
      elseif loved and alive(loved) then love = META[loved.id].survival end
      if hated and not alive(hated) then hate = META[hated.id].size end
    end
    local loot = 0
    if in_boat(self) then
      for _, id in ipairs(holding(self, "both")) do
        local value = VALUE[id] or 0
        if value > 0 and META[self.id].doubles == card_type(id) then value = value * 2 end
        loot = loot + value
      end
    end
    push(scores, {player = player.id, survival = survival, love = love, hate = hate, loot = loot, total = survival + love + hate + loot})
  end
  state.scores = scores
end

end_turn = function(state)
  if state.phase == "ended" then return end
  for _, entry in ipairs(state.characters) do
    entry.rowed = false
    entry.fought = false
  end
  state.day = state.day + 1
  begin_deal(state)
end

apply_thirst = function(state)
  for _, item in ipairs(state.thirst) do
    local entry = character(state, item.id)
    if in_boat(entry) and item.left > 0 then
      entry.wounds = entry.wounds + item.left
      note(state, {type = "thirst", id = item.id, wounds = item.left})
    end
  end
  state.thirst = {}
  end_turn(state)
end

begin_thirst = function(state, card)
  local present = {}
  for _, id in ipairs(state.cast) do
    local entry = character(state, id)
    if in_boat(entry) and entry.wounds <= META[id].size then push(present, id) end
  end
  state.thirst = {}
  local thirsty = thirst_targets(card.thirst, present)
  local thirsty_set = {}
  for _, id in ipairs(thirsty) do thirsty_set[id] = true end
  for _, id in ipairs(present) do
    local entry = character(state, id)
    local need = 0
    if entry.rowed and card.row then need = need + 1 end
    if entry.fought and card.fight then need = need + 1 end
    if thirsty_set[id] then need = need + 1 end
    if has_open_parasol(entry) then need = math.max(0, need - 1) end
    if need > 0 then push(state.thirst, {id = id, left = need}) end
  end
  state.phase = "thirst"
  state.queue = {}
  local still = false
  for _, item in ipairs(state.thirst) do
    if item.left > 0 then still = true end
  end
  if still then
    for _, id in ipairs(state.cast) do
      local entry = character(state, id)
      if conscious(entry) and has_type(entry, "water") then push(state.queue, id) end
    end
  end
  if #state.queue == 0 then apply_thirst(state) end
end

resolve_overboard = function(state, card)
  card = card or NAV[state.navCard]
  for _, id in ipairs(state.falling) do
    local entry = character(state, id)
    if in_boat(entry) then
      local preserver = has_type(entry, "preserver", conscious(entry) and "both" or "shown")
      local base = (META[id].swimmer or preserver) and 0 or 1
      entry.wounds = entry.wounds + base + (state.sharks and 1 or 0)
      local drown = entry.wounds >= META[id].size and not preserver
      local killed = entry.wounds > META[id].size
      if drown or killed then
        entry.removed = true
        entry.hand = {}
        entry.shown = {}
        entry.parasol = false
        note(state, {type = "lost", id = id})
      else
        local shown = {}
        for _, card_id in ipairs(entry.shown) do
          if card_type(card_id) == "preserver" then push(shown, card_id) end
        end
        entry.shown = shown
        entry.parasol = false
      end
    end
  end
  state.falling = {}
  state.sharks = false
  begin_thirst(state, card)
end

begin_overboard = function(state, card)
  local aboard = {}
  for _, id in ipairs(state.cast) do
    if in_boat(character(state, id)) then push(aboard, id) end
  end
  state.falling = named_targets(card.overboard, aboard)
  state.sharks = false
  for _, id in ipairs(state.falling) do
    local entry = character(state, id)
    for _, card_id in ipairs(copy(entry.shown)) do
      if card_type(card_id) == "chum" then
        take_card(entry, card_id)
        state.sharks = true
      end
    end
  end
  state.phase = "rescue"
  state.queue = {}
  for _, id in ipairs(state.cast) do
    local entry = character(state, id)
    if conscious(entry) then
      local can_throw = false
      if has_type(entry, "preserver") then
        for _, target in ipairs(state.falling) do
          local person = character(state, target)
          if target ~= id and conscious(person) and not has_type(person, "preserver") then can_throw = true end
        end
      end
      local can_chum = has_type(entry, "chum", "hand") and #state.falling > 0
      if can_throw or can_chum then push(state.queue, id) end
    end
  end
  if #state.queue == 0 then resolve_overboard(state, card) end
end

resolve_navigation = function(state, card_id, source, navigator)
  local card = NAV[card_id]
  state.navCard = card_id
  state.birds = math.max(0, state.birds + card.bird)
  note(state, {type = "nav", card = card_id, birds = state.birds, source = source, navigator = navigator})
  push(state.navDeck, card_id)
  if state.birds >= LAND_BIRDS then
    finish(state)
    return
  end
  begin_overboard(state, card)
end

begin_navigate = function(state)
  local navigator = nil
  for index = #state.cast, 1, -1 do
    local entry = character(state, state.cast[index])
    if conscious(entry) then navigator = entry break end
  end
  local cards = state.rowStack
  local source = #cards > 0 and "row" or "deck"
  state.rowStack = {}
  if navigator and has_type(navigator, "compass") then
    local compass = find_type(navigator, "compass")
    take_card(navigator, compass)
    if not index_of(navigator.shown, compass) then push(navigator.shown, compass) end
    if #state.navDeck > 0 then push(cards, table.remove(state.navDeck, 1)) end
  end
  if not navigator or #cards <= 1 then
    local card = table.remove(cards, 1) or table.remove(state.navDeck, 1)
    for _, id in ipairs(cards) do push(state.navDeck, id) end
    if card then resolve_navigation(state, card, source) else end_turn(state) end
    return
  end
  state.phase = "navigate"
  state.queue = {navigator.id}
  state.rowChoices = cards
end

local function make_state(players, seed_text)
  local count = #players
  assert(count >= 4 and count <= 6, "Lifeboat requires 4–6 players.")
  local seen = {}
  for _, player in ipairs(players) do
    assert(not seen[player.id], "Player IDs must be unique.")
    seen[player.id] = true
  end
  local seed = hash_seed(seed_text)
  local dealt, next = shuffle(copy(ORDER), seed)
  seed = next
  local cast = canonical({table.unpack(dealt, 1, count)})
  local assigned
  assigned, seed = shuffle(cast, seed)
  local loves
  loves, seed = shuffle(cast, seed)
  local hates
  hates, seed = shuffle(cast, seed)
  local provisions
  provisions, seed = shuffle(provision_ids(), seed)
  local navigation
  navigation, seed = shuffle(nav_ids(), seed)
  local characters = {}
  local by_seat = {}
  for _, id in ipairs(cast) do
    local entry = {
      id = id, player = "", wounds = 0, rowed = false, fought = false, parasol = false, removed = false,
      hand = {}, shown = {}, love = "", hate = "",
    }
    push(characters, entry)
    by_seat[id] = entry
  end
  local roster = {}
  for index, player in ipairs(players) do
    local name = player.name
    if not name or name == "" or name:match("^%s*$") then name = "玩家 " .. index end
    name = name:match("^%s*(.-)%s*$")
    roster[index] = {id = player.id, name = name}
    local entry = by_seat[assigned[index]]
    entry.player = player.id
    entry.love = loves[index]
    entry.hate = hates[index]
    push(entry.hand, table.remove(provisions, 1))
  end
  local state = {
    seed = seed, day = 1, phase = "deal", step = 0, birds = 0,
    supplyDeck = provisions, navDeck = navigation, rowStack = {},
    cast = cast, players = roster, characters = characters, queue = {}, offer = {}, rowChoices = {},
    demand = false, fight = false, savedQueue = {}, falling = {}, sharks = false, thirst = {}, navCard = false,
    log = {}, scores = false, outcome = false,
  }
  begin_deal(state)
  return state
end

local function reject(code)
  return {accepted = false, error = {code = code, message = "Invalid Lifeboat action."}}
end

local function require_actor(state, actor_id)
  local entry = acting(state)
  if not entry or entry.player ~= actor_id then return "NOT_YOUR_TURN" end
  if not conscious(entry) then return "CANNOT_ACT" end
end

local function player_seated(state, actor_id)
  for _, player in ipairs(state.players) do
    if player.id == actor_id then return true end
  end
end

local function steal(state, attacker, target, card)
  local taken = card
  if not taken then
    if #target.hand == 0 then return end
    state.seed = next_seed(state.seed)
    local index = state.seed % #target.hand + 1
    taken = table.remove(target.hand, index)
  elseif not take_card(target, taken) then
    return
  end
  push(attacker.hand, taken)
  note(state, {type = "mug", from = attacker.id, to = target.id})
end

local function sort_characters(state)
  local order = {}
  for index, id in ipairs(state.cast) do order[id] = index end
  table.sort(state.characters, function(a, b) return order[a.id] < order[b.id] end)
end

local function swap(state, left, right)
  local a = index_of(state.cast, left)
  local b = index_of(state.cast, right)
  state.cast[a], state.cast[b] = state.cast[b], state.cast[a]
  sort_characters(state)
  note(state, {type = "move", a = left, b = right})
end

local function resolve_fight(state)
  local fight = state.fight
  local attack, defense = 0, 0
  for _, id in ipairs(fight.attackers) do attack = attack + fight_size(character(state, id), fight) end
  for _, id in ipairs(fight.defenders) do defense = defense + fight_size(character(state, id), fight) end
  local attackers_win = attack > defense
  local losers = attackers_win and fight.defenders or fight.attackers
  for _, id in ipairs(losers) do character(state, id).wounds = character(state, id).wounds + 1 end
  for _, id in ipairs(fight.attackers) do character(state, id).fought = true end
  for _, id in ipairs(fight.defenders) do character(state, id).fought = true end
  note(state, {
    type = "fight", attacker = fight.attacker, defender = fight.defender, attackersWin = attackers_win,
    attackers = fight.attackers, defenders = fight.defenders, attack = attack, defense = defense,
    flareBy = fight.flareBy or false, losers = losers,
  })
  if attackers_win then
    local demand = state.demand
    if demand.kind == "move" then swap(state, demand.from, demand.to)
    else steal(state, character(state, demand.from), character(state, demand.to), demand.card) end
  end
  local attacker = fight.attacker
  state.fight = false
  state.demand = false
  local queue = {attacker}
  for _, id in ipairs(state.savedQueue) do push(queue, id) end
  state.queue = queue
  state.savedQueue = {}
  finish_action(state)
end

local function is_fighting(fight, id)
  return contains(fight.attackers, id) or contains(fight.defenders, id)
end

local function next_fight_decision(state)
  local fight = state.fight
  while #fight.pending > 0 do
    local id = fight.pending[1]
    local fighting = is_fighting(fight, id)
    if not fighting or #fight_weapons(character(state, id)) > 0 then
      fight.stage = fighting and "arm" or "join"
      state.queue = {id}
      return
    end
    table.remove(fight.pending, 1)
  end
  resolve_fight(state)
end

-- Each new contribution gives everyone another opportunity to react.
local function restart_fight_round(state, id, include_current)
  local fight = state.fight
  local seats = conscious_seats(state)
  local index = index_of(seats, id)
  local pending = {}
  for i = index + 1, #seats do push(pending, seats[i]) end
  for i = 1, (include_current and index or index - 1) do push(pending, seats[i]) end
  fight.pending = pending
  fight.arm = nil
  next_fight_decision(state)
end

local function pass_fight_decision(state, id)
  if state.fight.arm then
    -- A durable room can still be in the middle of the old, two-stage fight.
    restart_fight_round(state, id, false)
    return
  end
  table.remove(state.fight.pending, 1)
  next_fight_decision(state)
end

local function begin_fight(state, attacker, defender)
  state.phase = "fight"
  state.fight = {
    attacker = attacker.id, defender = defender.id,
    attackers = {attacker.id}, defenders = {defender.id},
    pending = conscious_seats(state), stage = "join", flareBy = false,
  }
  next_fight_decision(state)
end

local function on_take(state, actor_id, action)
  local problem = require_actor(state, actor_id)
  if problem then return problem end
  if action.type ~= "take" then return "CHOOSE_PROVISION" end
  local entry = acting(state)
  local index = index_of(state.offer, action.card)
  if not index then return "PROVISION_NOT_OFFERED" end
  table.remove(state.offer, index)
  push(entry.hand, action.card)
  note(state, {type = "take", id = entry.id})
  table.remove(state.queue, 1)
  skip_unconscious(state)
  if #state.queue == 0 or #state.offer == 0 then
    state.offer = {}
    begin_actions(state)
  end
end

local function reveal_card(state, entry, card)
  take_card(entry, card)
  push(entry.shown, card)
  local demand = state.demand
  -- A pending request for a dark card can still claim the last one when it is shown.
  if demand and demand.kind == "mug" and demand.to == entry.id and not demand.card and #entry.hand == 0 then
    demand.card = card
  end
end

local function on_reveal(state, actor_id, card)
  local entry
  for _, person in ipairs(state.characters) do
    if person.player == actor_id then entry = person break end
  end
  if not conscious(entry) then return "CANNOT_REVEAL" end
  if not index_of(entry.hand, card) then return "CARD_NOT_IN_HAND" end
  reveal_card(state, entry, card)
  local kind = card_type(card)
  if state.phase == "fight" and WEAPON[kind] and kind ~= "flare" and is_fighting(state.fight, entry.id) then
    note(state, {type = "fightArm", id = entry.id, weapon = kind})
    restart_fight_round(state, entry.id, true)
  end
end

local function on_give(state, actor_id, action)
  if not trading_open(state) then return "TRADING_CLOSED" end
  local entry
  for _, person in ipairs(state.characters) do
    if person.player == actor_id then entry = person break end
  end
  if not conscious(entry) then return "CANNOT_TRADE" end
  local target = character(state, action.target)
  if not target or target.id == entry.id or not in_boat(target) then return "INVALID_GIFT_TARGET" end
  if not index_of(holding(entry, "both"), action.card) then return "CARD_NOT_OWNED" end
  local demand = state.demand
  if demand and demand.kind == "mug" and demand.to == entry.id then
    local required = demand.card == action.card or
      (not demand.card and #entry.hand == 1 and index_of(entry.hand, action.card))
    if required then return "CARD_IN_PENDING_MUGGING" end
  end
  local shown = index_of(entry.shown, action.card) ~= nil
  local open_parasol = shown and card_type(action.card) == "parasol" and entry.parasol
  take_card(entry, action.card)
  if shown then push(target.shown, action.card) else push(target.hand, action.card) end
  if open_parasol then target.parasol = true end
end

local function on_row(state, entry)
  local oars = {}
  for _, id in ipairs(entry.shown) do
    if card_type(id) == "oar" then push(oars, id) end
  end
  for _, id in ipairs(entry.hand) do
    if card_type(id) == "oar" then push(oars, id) end
  end
  local drawn = draw(state.navDeck, 2 + #oars)
  if #drawn == 0 then return "NAVIGATION_DECK_EMPTY" end
  for i = 1, #drawn - 2 do
    if index_of(entry.hand, oars[i]) then reveal_card(state, entry, oars[i]) end
  end
  state.phase = "row"
  state.rowChoices = drawn
  entry.rowed = true
  note(state, {type = "act", id = entry.id, act = "row", cards = #drawn})
end

local function on_sort(state, action)
  if action.type ~= "sort" or type(action.keep) ~= "table" or #action.keep ~= #state.rowChoices then
    return "SORT_ROW_CARDS"
  end
  for _, value in ipairs(action.keep) do
    if value ~= true and value ~= false then return "SORT_ROW_CARDS" end
  end
  local back = {}
  for index, keep in ipairs(action.keep) do
    local card = state.rowChoices[index]
    if keep then push(state.rowStack, card) else push(back, card) end
  end
  for _, card in ipairs(back) do push(state.navDeck, card) end
  state.rowChoices = {}
  finish_action(state)
end

local function on_move(state, entry, target_id)
  local target = character(state, target_id)
  if not target or target.id == entry.id or not in_boat(target) then return "CHOOSE_ANOTHER_CHARACTER" end
  note(state, {type = "act", id = entry.id, act = "move", target = target.id})
  if not conscious(target) then
    swap(state, entry.id, target.id)
    finish_action(state)
    return
  end
  state.savedQueue = {}
  for index = 2, #state.queue do push(state.savedQueue, state.queue[index]) end
  state.phase = "answer"
  state.demand = {kind = "move", from = entry.id, to = target.id, card = false}
  state.queue = {target.id}
end

local function on_mug(state, entry, action)
  local target = character(state, action.target)
  if not target or target.id == entry.id or not in_boat(target) then return "CHOOSE_ANOTHER_CHARACTER" end
  local hidden = not action.card
  if not hidden and not index_of(target.shown, action.card) then return "MUG_CARD_NOT_SHOWN" end
  if hidden and #target.hand == 0 then return "NO_HIDDEN_CARDS" end
  note(state, {type = "act", id = entry.id, act = "mug", target = target.id})
  local free = not conscious(target) or (hidden and META[entry.id].pickpocket)
  local stolen = false
  if not hidden then stolen = action.card end
  if free then
    steal(state, entry, target, stolen)
    finish_action(state)
    return
  end
  state.savedQueue = {}
  for index = 2, #state.queue do push(state.savedQueue, state.queue[index]) end
  state.phase = "answer"
  state.demand = {kind = "mug", from = entry.id, to = target.id, card = stolen}
  state.queue = {target.id}
end

local function on_answer(state, action)
  if action.type ~= "answer" or type(action.accept) ~= "boolean" then return "ANSWER_DEMAND" end
  local demand = state.demand
  local attacker = character(state, demand.from)
  local defender = character(state, demand.to)
  if action.accept then
    if demand.kind == "move" then swap(state, demand.from, demand.to)
    else steal(state, attacker, defender, demand.card) end
    state.demand = false
    local queue = {attacker.id}
    for _, id in ipairs(state.savedQueue) do push(queue, id) end
    state.queue = queue
    state.savedQueue = {}
    finish_action(state)
    return
  end
  begin_fight(state, attacker, defender)
end

local function on_fight(state, action)
  local fight = state.fight
  local entry = acting(state)
  if fight.stage == "join" then
    if action.type ~= "join" or (action.side ~= "attack" and action.side ~= "defend" and action.side ~= "out") then
      return "CHOOSE_FIGHT_SIDE"
    end
    if action.side == "out" then pass_fight_decision(state, entry.id)
    else
      push(action.side == "attack" and fight.attackers or fight.defenders, entry.id)
      note(state, {type = "fightJoin", id = entry.id, side = action.side})
      restart_fight_round(state, entry.id, true)
    end
    return
  end
  if action.type ~= "arm" then return "CHOOSE_WEAPON" end
  if not action.card then
    pass_fight_decision(state, entry.id)
    return
  end
  if not index_of(fight_weapons(entry), action.card) then return "INVALID_WEAPON" end
  local weapon = card_type(action.card)
  if weapon == "flare" then
    take_card(entry, action.card)
    fight.flareBy = entry.id
    note(state, {type = "fightFlare", id = entry.id})
  else
    reveal_card(state, entry, action.card)
    note(state, {type = "fightArm", id = entry.id, weapon = weapon})
  end
  restart_fight_round(state, entry.id, true)
end

local function on_medical(state, entry, action)
  local kit = action.card
  if not index_of(holding(entry, "both"), kit) or card_type(kit) ~= "medical" then return "NO_MEDICAL_KIT" end
  local target = character(state, action.target)
  if not target or not in_boat(target) then return "CHOOSE_INJURED_CHARACTER" end
  if target.wounds <= 0 or target.wounds > META[target.id].size then return "INVALID_MEDICAL_TARGET" end
  take_card(entry, kit)
  target.wounds = target.wounds - 1
  note(state, {type = "heal", id = entry.id, target = target.id})
  finish_action(state)
end

local function on_flare(state, entry)
  local flare = find_type(entry, "flare")
  if not flare then return "NO_FLARE" end
  take_card(entry, flare)
  local drawn = draw(state.navDeck, 3)
  for _, id in ipairs(drawn) do
    local card = NAV[id]
    state.birds = math.max(0, state.birds + card.bird)
    note(state, {type = "flare", id = entry.id, card = id, birds = state.birds})
    push(state.navDeck, id)
    if state.birds >= LAND_BIRDS then
      finish(state)
      return
    end
  end
  note(state, {type = "act", id = entry.id, act = "flare"})
  finish_action(state)
end

local function on_parasol(state, entry)
  local card = find_type(entry, "parasol")
  if not card or has_open_parasol(entry) then return "PARASOL_UNAVAILABLE" end
  if index_of(entry.hand, card) then reveal_card(state, entry, card) end
  entry.parasol = true
  note(state, {type = "act", id = entry.id, act = "parasol"})
  finish_action(state)
end

local function on_choose(state, action)
  local entry = acting(state)
  if action.type == "nothing" then
    note(state, {type = "act", id = entry.id, act = "nothing"})
    finish_action(state)
    return
  end
  if action.type == "row" then return on_row(state, entry) end
  if action.type == "move" then return on_move(state, entry, action.target) end
  if action.type == "mug" then return on_mug(state, entry, action) end
  if action.type == "medical" then return on_medical(state, entry, action) end
  if action.type == "flare" then return on_flare(state, entry) end
  if action.type == "parasol" then return on_parasol(state, entry) end
  return "ACTION_UNAVAILABLE"
end

local function on_play(state, action)
  if action.type ~= "play" or not index_of(state.rowChoices, action.card) then return "CHOOSE_NAVIGATION_CARD" end
  local rest = {}
  for _, id in ipairs(state.rowChoices) do
    if id ~= action.card then push(rest, id) end
  end
  state.rowChoices = {}
  state.rowStack = {}
  for _, id in ipairs(rest) do push(state.navDeck, id) end
  resolve_navigation(state, action.card, "choice", state.queue[1])
end

local function on_rescue(state, action)
  if action.type ~= "rescue" then return "CHOOSE_RESCUE_ACTION" end
  local entry = acting(state)
  local preserver, target, chum = nil, nil, nil
  if action.to then
    target = character(state, action.to)
    preserver = find_type(entry, "preserver")
    if not preserver or not target or not contains(state.falling, target.id) or target.id == entry.id or not conscious(target) or has_type(target, "preserver") then
      return "INVALID_PRESERVER_TARGET"
    end
  end
  if action.chum then
    for _, id in ipairs(entry.hand) do
      if card_type(id) == "chum" then chum = id break end
    end
    if not chum or #state.falling == 0 then return "CHUM_UNAVAILABLE" end
  end
  if preserver then
    take_card(entry, preserver)
    push(target.shown, preserver)
  end
  if chum then
    take_card(entry, chum)
    state.sharks = true
  end
  table.remove(state.queue, 1)
  if #state.queue == 0 then resolve_overboard(state) end
end

local function on_drink(state, action)
  if action.type ~= "drink" or type(action.uses) ~= "table" then return "ALLOCATE_WATER" end
  local entry = acting(state)
  local spent = {}
  local planned = {}
  for _, use in ipairs(action.uses) do
    if type(use) ~= "table" then return "CHOOSE_WATER_AND_RECIPIENT" end
    if spent[use.card] or not index_of(holding(entry, "both"), use.card) or card_type(use.card) ~= "water" then
      return "INVALID_WATER_CARD"
    end
    local need = nil
    local used = planned[use["for"]] or 0
    for _, item in ipairs(state.thirst) do
      if item.id == use["for"] and item.left - used > 0 then need = item end
    end
    if not need then return "RECIPIENT_NOT_THIRSTY" end
    spent[use.card] = true
    planned[use["for"]] = used + 1
    push(planned, use.card)
  end
  for index, item in ipairs(state.thirst) do
    item.left = item.left - (planned[item.id] or 0)
  end
  for _, card in ipairs(action.uses) do take_card(entry, card.card) end
  table.remove(state.queue, 1)
  local queue = {}
  for _, id in ipairs(state.queue) do
    local still = false
    for _, item in ipairs(state.thirst) do
      if item.left > 0 then still = true end
    end
    if has_type(character(state, id), "water") and still then push(queue, id) end
  end
  state.queue = queue
  if #state.queue == 0 then apply_thirst(state) end
end

local function mutate(state, actor_id, action)
  if type(action) ~= "table" or type(action.type) ~= "string" then return "UNKNOWN_ACTION" end
  if action.type == "rematch" then
    if state.phase ~= "ended" then return "VOYAGE_IN_PROGRESS" end
    if not player_seated(state, actor_id) then return "PLAYER_NOT_SEATED" end
    local fresh = make_state(state.players, string.format("%x", state.seed))
    fresh.step = state.step
    for key, value in pairs(fresh) do state[key] = value end
    return nil, true
  end
  if state.phase == "ended" then return "VOYAGE_ENDED" end
  if action.type == "reveal" then return on_reveal(state, actor_id, action.card) end
  if action.type == "give" then return on_give(state, actor_id, action) end
  local problem = nil
  if state.phase == "deal" then problem = on_take(state, actor_id, action)
  elseif state.phase == "action" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_choose(state, action) end
  elseif state.phase == "row" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_sort(state, action) end
  elseif state.phase == "answer" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_answer(state, action) end
  elseif state.phase == "fight" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_fight(state, action) end
  elseif state.phase == "navigate" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_play(state, action) end
  elseif state.phase == "rescue" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_rescue(state, action) end
  elseif state.phase == "thirst" then
    problem = require_actor(state, actor_id)
    if not problem then problem = on_drink(state, action) end
  else return "UNKNOWN_ACTION" end
  return problem
end

function setup(context)
  return {state = make_state(context.players, context.match.randomSeed), events = {}}
end

function on_action(state, action, context)
  if not player_seated(state, context.actor.id) then return reject("PLAYER_NOT_SEATED") end
  if type(action) ~= "table" or action.step ~= state.step then return reject("STALE_ACTION") end
  local problem = mutate(state, context.actor.id, action)
  if problem then return reject(problem) end
  state.step = state.step + 1
  return {accepted = true, state = state, events = {}}
end

function view(state, events, context)
  local viewer = context.viewer.id
  local ended = state.phase == "ended"
  local actor = acting(state)
  local mine = actor and actor.player == viewer
  local characters = {}
  local owner_conscious = false
  for _, entry in ipairs(state.characters) do
    local meta = META[entry.id]
    local owner = entry.player == viewer
    if owner then owner_conscious = conscious(entry) end
    push(characters, {
      id = entry.id, player = entry.player, wounds = entry.wounds, size = meta.size, survival = meta.survival,
      rowed = entry.rowed, fought = entry.fought, parasol = has_open_parasol(entry), removed = entry.removed,
      conscious = conscious(entry), alive = alive(entry),
      shown = entry.shown, handCount = #entry.hand,
      love = (ended or owner) and entry.love or false,
      hate = (ended or owner) and entry.hate or false,
      hand = (ended or owner) and entry.hand or false,
    })
  end
  local seated = false
  for _, player in ipairs(state.players) do
    if player.id == viewer then seated = true end
  end
  local private_prompt = state.phase == "rescue" or state.phase == "thirst" or
    (state.phase == "fight" and state.fight.stage == "arm")
  local queue = state.queue
  if private_prompt then queue = mine and {actor.id} or {} end
  local fight = state.fight
  if fight then
    fight = {
      attacker = fight.attacker, defender = fight.defender, stage = fight.stage,
      attackers = fight.attackers, defenders = fight.defenders, flareBy = fight.flareBy or false,
    }
  end
  -- Filter records persisted by older versions as well as new ones.
  local log = {}
  for _, entry in ipairs(state.log) do
    if entry.type == "take" then push(log, {type = entry.type, id = entry.id})
    elseif entry.type == "mug" then push(log, {type = entry.type, from = entry.from, to = entry.to})
    else push(log, entry) end
  end
  return {state = {
    players = state.players, cast = state.cast, characters = characters, viewerId = viewer,
    day = state.day, phase = state.phase, step = state.step, birds = state.birds,
    supplyCount = #state.supplyDeck, navCount = #state.navDeck, rowCount = #state.rowStack,
    offer = (state.phase == "deal" and mine) and state.offer or false,
    offerCount = #state.offer,
    rowChoices = ((state.phase == "row" or state.phase == "navigate") and mine) and state.rowChoices or false,
    demand = state.demand, fight = fight, falling = state.falling, thirst = state.thirst,
    navCard = state.navCard, queue = queue, log = log, scores = state.scores,
    outcome = state.outcome, canAct = mine and state.phase ~= "ended" or false,
    tradeOpen = trading_open(state), canTrade = trading_open(state) and owner_conscious,
    canRematch = ended and seated or false,
  }, events = {}}
end

function on_return_to_room(state, context)
  return true
end

local MODULUS = 2147483647
local SUITS = {"spades", "hearts", "clubs", "diamonds"}
local WINDOW_TIMER_ID = "halli-window"
local REVEAL_DELAY_MS, DRAW_DELAY_MS = 2000, 3000
local BURST_REWARDS = {[2] = 2, [3] = 3, [4] = 4, [5] = 5, [6] = 7, [7] = 8, [8] = 9}

local function waiting_for_bell(state)
  return state.window ~= nil and (state.window.stage == "hidden" or state.window.stage == "revealed")
end

local function window_timer(state, after_ms)
  return {op = "schedule", id = WINDOW_TIMER_ID, afterMs = after_ms,
    payload = {round = state.round, step = state.step, stage = state.window.stage}}
end

local function victory_target(player_count)
  return 7 + 2 * player_count
end

function compare_hands(left, right)
  for index = 1, math.max(#left, #right) do
    local difference = (left[index] or 0) - (right[index] or 0)
    if difference ~= 0 then return difference > 0 and 1 or -1 end
  end
  return 0
end

local function straight_high(ranks)
  local present = {}
  for _, rank in ipairs(ranks) do present[rank] = true end
  if present[14] then present[1] = true end
  for high = 14, 5, -1 do
    local found = true
    for offset = 0, 4 do if not present[high - offset] then found = false break end end
    if found then return high end
  end
  return 0
end

function evaluate_hand(cards)
  local counts, suits, ranks = {}, {}, {}
  for _, card in ipairs(cards) do
    counts[card.rank] = (counts[card.rank] or 0) + 1
    if not suits[card.suit] then suits[card.suit] = {} end
    table.insert(suits[card.suit], card.rank)
  end
  for rank = 14, 2, -1 do if counts[rank] then table.insert(ranks, rank) end end
  local fours, trips, pairs, flushes = {}, {}, {}, {}
  for _, rank in ipairs(ranks) do
    if counts[rank] >= 4 then table.insert(fours, rank) end
    if counts[rank] >= 3 then table.insert(trips, rank) end
    if counts[rank] >= 2 then table.insert(pairs, rank) end
  end
  if #cards >= 5 then
    for _, suit in ipairs(SUITS) do
      if suits[suit] and #suits[suit] >= 5 then
        table.sort(suits[suit], function(a, b) return a > b end)
        table.insert(flushes, suits[suit])
      end
    end
  end
  local straight_flush = 0
  for _, flush in ipairs(flushes) do straight_flush = math.max(straight_flush, straight_high(flush)) end
  if straight_flush > 0 then return {8, straight_flush} end
  local function kickers(result, excluded, count)
    local added = 0
    for _, rank in ipairs(ranks) do
      if not excluded[rank] then
        table.insert(result, rank)
        added = added + 1
        if added == count then break end
      end
    end
    return result
  end
  if #fours > 0 then return kickers({7, fours[1]}, {[fours[1]] = true}, 1) end
  if #cards >= 5 and #trips > 0 then
    for _, pair in ipairs(pairs) do if pair ~= trips[1] then return {6, trips[1], pair} end end
  end
  if #flushes > 0 then
    local best = {0}
    for _, flush in ipairs(flushes) do
      local result = {5}
      for index = 1, 5 do table.insert(result, flush[index]) end
      if compare_hands(result, best) > 0 then best = result end
    end
    return best
  end
  local straight = #cards >= 5 and straight_high(ranks) or 0
  if straight > 0 then return {4, straight} end
  if #trips > 0 then return kickers({3, trips[1]}, {[trips[1]] = true}, 2) end
  if #pairs >= 2 then return kickers({2, pairs[1], pairs[2]}, {[pairs[1]] = true, [pairs[2]] = true}, 1) end
  if #pairs > 0 then return kickers({1, pairs[1]}, {[pairs[1]] = true}, 3) end
  local result = {0}
  for index = 1, math.min(5, #ranks) do table.insert(result, ranks[index]) end
  return result
end

local function with_cards(left, right)
  local cards = {}
  for _, card in ipairs(left) do table.insert(cards, card) end
  for _, card in ipairs(right) do table.insert(cards, card) end
  return cards
end

local function straight_with_hole_high(hole_cards, fixed, suit)
  local present, owned = {}, {}
  for _, card in ipairs(fixed) do present[card.rank] = true end
  for _, card in ipairs(hole_cards) do
    if not suit or card.suit == suit then
      present[card.rank], owned[card.rank] = true, true
    end
  end
  if present[14] then present[1] = true end
  if owned[14] then owned[1] = true end
  for high = 14, 5, -1 do
    local complete, uses_hole = true, false
    for offset = 0, 4 do
      local rank = high - offset
      if not present[rank] then complete = false break end
      if owned[rank] then uses_hole = true end
    end
    if complete and uses_hole then return high end
  end
  return 0
end

-- Fixed boards have five cards and each player has two distinct hole cards.
function evaluate_fixed_hand(hole_cards, fixed, board_hand)
  board_hand = board_hand or evaluate_hand(fixed)
  if board_hand[1] == 7 then
    -- All four cards of this rank are on the board; a hole card must be the kicker.
    return {7, board_hand[2], math.max(hole_cards[1].rank, hole_cards[2].rank)}
  end
  if board_hand[1] == 8 then
    local suit = fixed[1].suit
    local matching = hole_cards[1].suit == suit or hole_cards[2].suit == suit
    local high = straight_with_hole_high(hole_cards, fixed, matching and suit or nil)
    if high > 0 then return {matching and 8 or 4, high} end
    -- A matching hole guarantees a flush; otherwise no legal straight leaves
    -- only a hole pair or high cards. Each uses the four highest board cards.
    local sorted = with_cards({}, fixed)
    table.sort(sorted, function(a, b) return a.rank > b.rank end)
    return evaluate_hand({hole_cards[1], hole_cards[2], sorted[1], sorted[2], sorted[3], sorted[4]})
  end

  local unrestricted = evaluate_hand(with_cards(hole_cards, fixed))
  -- A result stronger than the board alone necessarily uses a hole card.
  if compare_hands(unrestricted, board_hand) > 0 then return unrestricted end

  -- Removing one board card forces a hole card; reuse slots until the upper bound is reached.
  local remaining = {hole_cards[1], hole_cards[2], fixed[2], fixed[3], fixed[4], fixed[5]}
  local best = {0}
  for omitted = 1, #fixed do
    local hand = evaluate_hand(remaining)
    if compare_hands(hand, unrestricted) == 0 then return hand end
    if compare_hands(hand, best) > 0 then best = hand end
    if omitted < #fixed then remaining[omitted + 2] = fixed[omitted] end
  end
  return best
end

function table_results(state, board, require_hole_card)
  local results = {}
  local board_hand = require_hole_card and evaluate_hand(board) or nil
  for _, player in ipairs(state.players) do
    local holes = state.hands[player.id]
    results[player.id] = require_hole_card and evaluate_fixed_hand(holes, board, board_hand) or evaluate_hand(with_cards(holes, board))
  end
  return results
end

function strongest(results)
  local best = {0}
  for _, hand in pairs(results) do if compare_hands(hand, best) > 0 then best = hand end end
  return best
end

local function normalize_seed(value)
  local seed = 0
  local text = tostring(value or "")
  for index = 1, #text do
    local digit = tonumber(string.sub(text, index, index), 16)
    if digit then seed = (seed * 16 + digit) % MODULUS end
  end
  return seed == 0 and 1 or seed
end

local function next_random(state)
  state.seed = (state.seed * 48271) % MODULUS
  return state.seed
end

local function shuffle(state, cards)
  for index = #cards, 2, -1 do
    local swap = (next_random(state) % index) + 1
    cards[index], cards[swap] = cards[swap], cards[index]
  end
  return cards
end

local function player_index(state, id)
  for index, player in ipairs(state.players) do if player.id == id then return index - 1 end end
  return nil
end

local function face(card)
  return {rank = card.rank, suit = card.suit}
end

local function next_round_starter(state)
  local index = player_index(state, state.roundStarterId) or 0
  return state.players[((index + 1) % #state.players) + 1].id
end

local function deal_round(state, starter_id)
  local deck = {}
  for _, suit in ipairs(SUITS) do
    for rank = 2, 14 do table.insert(deck, {rank = rank, suit = suit}) end
  end
  shuffle(state, deck)
  state.hands = {}
  for _, player in ipairs(state.players) do state.hands[player.id] = {table.remove(deck), table.remove(deck)} end
  state.fixed = {}
  for index = 1, 5 do table.insert(state.fixed, table.remove(deck)) end
  local permanent_count = math.ceil(#deck / 3)
  state.permanentDeck = {}
  -- Match the local engine's order, including the top of each deck.
  for index = #deck - permanent_count + 1, #deck do table.insert(state.permanentDeck, deck[index]) end
  for index = 1, permanent_count do table.remove(deck) end
  state.ordinaryDeck = deck
  state.ordinaryDiscard, state.permanentDiscard = {}, {}
  state.recentOrdinaryDiscard = {}
  state.dynamic, state.candidates, state.pendingDiscards = {}, {}, {}
  state.discardSlots = {}
  state.window = nil
  state.phase = "before_draw"
  state.turn = starter_id and player_index(state, starter_id) or next_random(state) % #state.players
  state.roundStarterId = state.players[state.turn + 1].id
  state.fixedResults = table_results(state, state.fixed, true)
  state.fixedStrength = strongest(state.fixedResults)
  state.dynamicResults = table_results(state, state.dynamic)
  state.dynamicStrength = strongest(state.dynamicResults)
  state.settlement = nil
  state.winners = {}
end

function setup(context)
  assert(#context.players >= 2 and #context.players <= 8, "需要 2–8 名玩家")
  local state = {players = {}, scores = {}, round = 1, step = 0, seed = normalize_seed(context.match.randomSeed)}
  local seen = {}
  for index, player in ipairs(context.players) do
    assert(type(player.id) == "string" and not seen[player.id], "玩家身份必须不同")
    seen[player.id] = true
    table.insert(state.players, {id = player.id, name = player.name or "玩家 " .. index, seat = player.seat or index})
    state.scores[player.id] = 0
  end
  deal_round(state)
  return {state = state, events = {}}
end

local function commit_discards(state)
  state.recentOrdinaryDiscard = {}
  for _, card in ipairs(state.pendingDiscards) do
    table.insert(state[card.source == "ordinary" and "ordinaryDiscard" or "permanentDiscard"], face(card))
    if card.source == "ordinary" then table.insert(state.recentOrdinaryDiscard, face(card)) end
  end
  state.pendingDiscards = {}
end

local function draw_from(state, source, count)
  local deck_key, discard_key = source .. "Deck", source .. "Discard"
  for index = 1, count do
    if #state[deck_key] == 0 then
      state[deck_key] = shuffle(state, state[discard_key])
      state[discard_key] = {}
    end
    if #state[deck_key] == 0 then break end
    local card = face(table.remove(state[deck_key]))
    card.source = source
    table.insert(state.candidates, card)
  end
end

local function settle(state, actor_id, declaration)
  local burst = compare_hands(state.dynamicStrength, state.fixedStrength) > 0
  local correct, checks = false, {}
  if declaration == "burst" then correct = burst end
  if declaration == "forced" then
    correct = not burst and #state.candidates == 3
    for _, card in ipairs(state.candidates) do
      local strength = strongest(table_results(state, with_cards(state.dynamic, {card})))
      local would_burst = compare_hands(strength, state.fixedStrength) > 0
      local exposed = face(card)
      exposed.source = card.source
      table.insert(checks, {card = exposed, strength = strength, burst = would_burst})
      if not would_burst then correct = false end
    end
  end
  if declaration == "lucky" then
    local own = state.fixedResults[actor_id]
    correct = own[1] >= 4
    for _, player in ipairs(state.players) do
      if player.id ~= actor_id and compare_hands(own, state.fixedResults[player.id]) < 0 then correct = false end
    end
  end
  local deltas = {}
  for _, player in ipairs(state.players) do deltas[player.id] = 0 end
  if not correct then
    local transfer = #state.players == 2 and 2 or 1
    for _, player in ipairs(state.players) do
      deltas[player.id] = player.id == actor_id and -transfer * (#state.players - 1) or transfer
    end
  elseif declaration == "burst" then
    local reward = BURST_REWARDS[#state.players]
    deltas[actor_id] = reward
    deltas[state.window.placerId] = 1 - reward
  else
    for _, player in ipairs(state.players) do
      deltas[player.id] = player.id == actor_id and #state.players or -1
    end
  end
  local highest = -math.huge
  for _, player in ipairs(state.players) do
    state.scores[player.id] = state.scores[player.id] + deltas[player.id]
    highest = math.max(highest, state.scores[player.id])
  end
  state.winners = {}
  if highest >= victory_target(#state.players) then
    for _, player in ipairs(state.players) do if state.scores[player.id] == highest then table.insert(state.winners, player.id) end end
  end
  state.settlement = {
    reason = "bell", actorId = actor_id, declaration = declaration, correct = correct,
    deltas = deltas, checks = checks, wasBurst = burst,
    liableId = declaration == "burst" and state.window.placerId or nil,
    nextStarterId = next_round_starter(state),
    fixedResults = state.fixedResults, dynamicResults = state.dynamicResults,
    fixedStrength = state.fixedStrength, dynamicStrength = state.dynamicStrength,
  }
  state.phase = #state.winners > 0 and "ended" or "round_end"
  state.window = nil
end

local function accepted(state, ignored, timer_ops)
  return {accepted = true, state = state, ignored = ignored == true, events = {}, timerOps = timer_ops}
end

local function reject(message)
  return {accepted = false, error = {code = "INVALID_ACTION", message = message}}
end

function on_action(state, action, context)
  local actor_id = context.actor.id
  if player_index(state, actor_id) == nil then return reject("只有入座玩家可以操作") end
  if type(action) ~= "table" then return reject("未知操作") end
  local kind = action.type
  if kind ~= "draw" and kind ~= "place" and kind ~= "bell" and kind ~= "next_round" and kind ~= "rematch" then return reject("未知操作") end
  if action.round ~= state.round or action.step ~= state.step then return accepted(state, true) end
  local own_turn = state.players[state.turn + 1].id == actor_id
  local timer_ops
  if kind == "bell" then
    local declaration = action.declaration
    if declaration == nil then declaration = own_turn and state.phase == "choosing" and "forced" or "burst" end
    if declaration ~= "burst" and declaration ~= "forced" and declaration ~= "lucky" then return reject("无效的拍铃类型") end
    local valid = false
    if declaration == "burst" then valid = state.phase == "before_draw" and state.window ~= nil and state.window.placerId ~= actor_id end
    if declaration == "forced" then valid = own_turn and state.phase == "choosing" and #state.candidates == 3 end
    if declaration == "lucky" then valid = own_turn and state.phase == "before_draw" end
    if not valid then return accepted(state, true) end
    if waiting_for_bell(state) then timer_ops = {{op = "cancel", id = WINDOW_TIMER_ID}} end
    settle(state, actor_id, declaration)
  elseif kind == "draw" then
    if not own_turn or state.phase ~= "before_draw" then return reject("请等待你的抽牌回合") end
    if waiting_for_bell(state) then return reject("请等待拍铃时间结束") end
    -- Older persisted rounds may still have leftovers waiting for this draw.
    if #state.pendingDiscards > 0 then commit_discards(state) end
    state.window = nil
    state.discardSlots = {}
    state.candidates = {}
    draw_from(state, "ordinary", 2)
    draw_from(state, "permanent", 1)
    if #state.candidates == 0 then
      local deltas = {}
      for _, player in ipairs(state.players) do deltas[player.id] = 0 end
      state.phase = "round_end"
      state.settlement = {reason = "exhausted", deltas = deltas, nextStarterId = next_round_starter(state)}
    else state.phase = "choosing" end
  elseif kind == "place" then
    if not own_turn or state.phase ~= "choosing" then return reject("只有当前玩家可以选牌") end
    if type(action.index) ~= "number" or action.index % 1 ~= 0 or action.index < 0 or action.index >= #state.candidates then return reject("请选择一张候选牌") end
    table.insert(state.dynamic, face(state.candidates[action.index + 1]))
    state.discardSlots = {}
    for index, candidate in ipairs(state.candidates) do
      local slot = index == action.index + 1 and {empty = true} or face(candidate)
      slot.source = candidate.source
      table.insert(state.discardSlots, slot)
    end
    state.pendingDiscards = {}
    for index, card in ipairs(state.candidates) do if index ~= action.index + 1 then table.insert(state.pendingDiscards, card) end end
    state.candidates = {}
    state.dynamicResults = table_results(state, state.dynamic)
    state.dynamicStrength = strongest(state.dynamicResults)
    state.recentOrdinaryDiscard = {}
    state.window = {placerId = actor_id, stage = "hidden", untilAt = (context.serverTime or 0) + REVEAL_DELAY_MS}
    state.turn = (state.turn + 1) % #state.players
    state.phase = "before_draw"
  elseif kind == "next_round" then
    if state.phase ~= "round_end" then return reject("本轮尚未结束") end
    local starter_id = next_round_starter(state)
    state.round = state.round + 1
    deal_round(state, starter_id)
  elseif kind == "rematch" then
    if state.phase ~= "ended" then return reject("整局尚未结束") end
    for _, player in ipairs(state.players) do state.scores[player.id] = 0 end
    state.round = state.round + 1
    next_random(state)
    deal_round(state)
  end
  state.step = state.step + 1
  if kind == "place" then timer_ops = {window_timer(state, REVEAL_DELAY_MS)} end
  return accepted(state, false, timer_ops)
end

function on_timer(state, timer, context)
  local payload = timer and timer.payload
  local result = {state = state, events = {}}
  if not timer or timer.id ~= WINDOW_TIMER_ID or type(payload) ~= "table"
    or state.phase ~= "before_draw" or not waiting_for_bell(state)
    or payload.round ~= state.round or payload.step ~= state.step
    or payload.stage ~= state.window.stage then return result end
  if state.window.stage == "hidden" then
    commit_discards(state)
    state.window.stage = "revealed"
    -- Give three full seconds after actual publication, even if this alarm was late.
    state.window.untilAt = (context.firedAt or context.dueAt or state.window.untilAt) + DRAW_DELAY_MS
    result.timerOps = {window_timer(state, DRAW_DELAY_MS)}
  else
    state.window.stage = "ready"
    state.window.untilAt = nil
  end
  -- Reveal/unlock must not invalidate a bell already sent for this placement.
  return result
end

function view(state, events, context)
  local viewer_id = context.viewer.id
  local seated = player_index(state, viewer_id) ~= nil
  local reveal = state.settlement ~= nil and state.settlement.reason == "bell"
  local own_turn = seated and state.players[state.turn + 1].id == viewer_id
  local projected = {
    players = state.players, scores = state.scores, round = state.round, step = state.step, phase = state.phase,
    targetScore = victory_target(#state.players),
    viewerId = viewer_id, currentPlayerId = state.players[state.turn + 1].id,
    hands = {}, fixed = state.fixed, dynamic = state.dynamic, ordinaryDiscard = state.ordinaryDiscard,
    recentOrdinaryDiscard = state.recentOrdinaryDiscard,
    counts = {ordinaryDeck = #state.ordinaryDeck, permanentDeck = #state.permanentDeck, permanentDiscard = #state.permanentDiscard},
    candidates = {}, candidateCount = #state.candidates, window = state.window, discardSlots = {},
    canDraw = own_turn and state.phase == "before_draw" and not waiting_for_bell(state),
    canPlace = own_turn and state.phase == "choosing",
    canBurst = seated and state.phase == "before_draw" and state.window ~= nil and state.window.placerId ~= viewer_id,
    canForced = own_turn and state.phase == "choosing" and #state.candidates == 3,
    canLucky = own_turn and state.phase == "before_draw",
    settlement = state.settlement, winners = state.winners,
  }
  for _, player in ipairs(state.players) do
    local hand = {}
    for _, card in ipairs(state.hands[player.id]) do
      table.insert(hand, (reveal or (seated and player.id ~= viewer_id)) and face(card) or {hidden = true})
    end
    projected.hands[player.id] = hand
  end
  if own_turn and state.phase == "choosing" then projected.candidates = state.candidates end
  if state.window ~= nil then
    for _, card in ipairs(state.discardSlots or {}) do
      local slot
      if card.empty then slot = {empty = true}
      elseif state.window.placerId == viewer_id or (card.source == "ordinary" and state.window.stage ~= "hidden") then slot = face(card)
      else slot = {hidden = true} end
      slot.source = card.source
      table.insert(projected.discardSlots, slot)
    end
  end
  return {state = projected, events = {}}
end

function on_return_to_room(state, context)
  return true
end

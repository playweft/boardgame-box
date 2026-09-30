local MODULUS = 2147483647
local MULTIPLIER = 48271
local VALUE_COUNT = 12
local WIRES_PER_VALUE = 4
local ERROR_LIMIT = 4

local function reject(code, message)
  return {accepted = false, error = {code = code, message = message}}
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
  state.seed = (state.seed * MULTIPLIER) % MODULUS
  return state.seed
end

local function shuffle(state, items)
  for index = #items, 2, -1 do
    local swap = (next_random(state) % index) + 1
    items[index], items[swap] = items[swap], items[index]
  end
end

local function draw_special_wires(state, kind, suffix, in_play, candidate_count)
  local all_wires = {}
  for number = 1, 11 do
    table.insert(all_wires, {
      kind = kind,
      value = nil,
      sort = number * 10 + suffix,
      tileNumber = tostring(number) .. "." .. tostring(suffix),
    })
  end
  shuffle(state, all_wires)
  local candidates = {}
  for index = 1, candidate_count do table.insert(candidates, all_wires[index]) end
  table.sort(candidates, function(left, right) return left.sort < right.sort end)
  local tile_numbers = {}
  for _, wire in ipairs(candidates) do table.insert(tile_numbers, wire.tileNumber) end
  shuffle(state, candidates)
  local selected = {}
  for index = 1, in_play do table.insert(selected, candidates[index]) end
  return selected, tile_numbers
end

local function make_state(players, seed)
  local state = {
    players = players,
    wires = {},
    specialCandidates = {},
    hands = {},
    rackSlots = {},
    clues = {},
    cutWires = {},
    detonator = 0,
    detonatorLimit = ERROR_LIMIT,
    turn = (seed % #players) + 1,
    phase = "setup_info",
    setupInfoOrder = {},
    setupInfoIndex = 1,
    outcome = nil,
    lastAction = nil,
    seed = seed,
  }
  local deck = {}
  local wire_number = 0
  for value = 1, VALUE_COUNT do
    for copy = 1, WIRES_PER_VALUE do
      wire_number = wire_number + 1
      local id = "wire-" .. wire_number
      state.wires[id] = {id = id, kind = "number", value = value, sort = value * 10, tileNumber = tostring(value)}
      table.insert(deck, id)
    end
  end
  local red_wires, red_candidates = draw_special_wires(state, "red", 5, 1, 2)
  local yellow_wires, yellow_candidates = draw_special_wires(state, "yellow", 1, 2, 3)
  state.specialCandidates = {
    red = {inPlay = 1, candidateCount = 2, tileNumbers = red_candidates},
    yellow = {inPlay = 2, candidateCount = 3, tileNumbers = yellow_candidates},
  }
  for _, special_wires in ipairs({red_wires, yellow_wires}) do
    for _, wire in ipairs(special_wires) do
      wire_number = wire_number + 1
      local id = "wire-" .. wire_number
      wire.id = id
      state.wires[id] = wire
      table.insert(deck, id)
    end
  end
  shuffle(state, deck)
  local opaque_wires, opaque_deck = {}, {}
  for index, source_id in ipairs(deck) do
    local id = "wire-" .. index
    local wire = state.wires[source_id]
    wire.id = id
    opaque_wires[id] = wire
    table.insert(opaque_deck, id)
  end
  state.wires = opaque_wires
  deck = opaque_deck

  local rack_order = {}
  for player_index, player in ipairs(players) do
    state.hands[player.id] = {}
    state.rackSlots[player.id] = {}
    local rack_count = (#players == 2 or (#players == 3 and player_index == state.turn)) and 2 or 1
    for rack_index = 1, rack_count do
      table.insert(state.rackSlots[player.id], {})
      table.insert(rack_order, {playerId = player.id, rackIndex = rack_index})
    end
  end
  for index, wire_id in ipairs(deck) do
    local rack = rack_order[((index - 1) % #rack_order) + 1]
    table.insert(state.rackSlots[rack.playerId][rack.rackIndex], wire_id)
  end
  for _, player in ipairs(players) do
    for _, slots in ipairs(state.rackSlots[player.id]) do
      table.sort(slots, function(left, right)
        return state.wires[left].sort < state.wires[right].sort
      end)
      for _, wire_id in ipairs(slots) do
        table.insert(state.hands[player.id], wire_id)
      end
    end
  end
  for offset = 0, #players - 1 do
    local index = ((state.turn + offset - 1) % #players) + 1
    table.insert(state.setupInfoOrder, players[index].id)
  end
  return state
end

function setup(context)
  local players = {}
  for _, player in ipairs(context.players) do
    table.insert(players, {id = player.id, name = player.name, seat = player.seat})
  end
  return {state = make_state(players, normalize_seed(context.match.randomSeed)), events = {}}
end

local function player_index(state, player_id)
  for index, player in ipairs(state.players) do
    if player.id == player_id then return index end
  end
  return nil
end

local function owner_of(state, wire_id)
  for _, player in ipairs(state.players) do
    for _, held_id in ipairs(state.hands[player.id]) do
      if held_id == wire_id then return player.id end
    end
  end
  return nil
end

local function remove_wires(state, player_id, wire_ids, revealed_red)
  local removing = {}
  for _, wire_id in ipairs(wire_ids) do removing[wire_id] = true end
  local remaining = {}
  for _, wire_id in ipairs(state.hands[player_id]) do
    if not removing[wire_id] then table.insert(remaining, wire_id) end
  end
  state.hands[player_id] = remaining
  for _, wire_id in ipairs(wire_ids) do
    local rack_position, slot_position
    for rack_index, slots in ipairs(state.rackSlots[player_id]) do
      for slot_index, slot_wire_id in ipairs(slots) do
        if slot_wire_id == wire_id then
          rack_position = rack_index
          slot_position = slot_index
          slots[slot_index] = false
          break
        end
      end
      if rack_position then break end
    end
    state.clues[wire_id] = nil
    local wire = state.wires[wire_id]
    table.insert(state.cutWires, {
      id = wire_id,
      playerId = player_id,
      rackIndex = rack_position - 1,
      slotIndex = slot_position - 1,
      kind = wire.kind,
      value = wire.value,
      tileNumber = wire.tileNumber,
      revealedRed = revealed_red == true,
    })
  end
end

local function next_turn(state, current_index)
  for _, player in ipairs(state.players) do
    if #state.hands[player.id] > 0 then
      local all_empty = false
      break
    end
  end
  local any_wires = false
  for _, player in ipairs(state.players) do
    if #state.hands[player.id] > 0 then any_wires = true end
  end
  if not any_wires then
    state.phase = "ended"
    state.outcome = "success"
    return
  end
  for offset = 1, #state.players do
    local index = ((current_index + offset - 1) % #state.players) + 1
    if #state.hands[state.players[index].id] > 0 then
      state.turn = index
      return
    end
  end
end

local function same_wire(left, right)
  return left.kind == right.kind and left.value == right.value
end

local function action_error(state, message)
  return reject(string.upper(string.gsub(message, " ", "_")), message)
end

function on_action(state, action, context)
  if type(action) ~= "table" or type(action.type) ~= "string" then
    return reject("INVALID_ACTION", "Choose a valid action")
  end
  local actor_id = context.actor.id
  local actor_index = player_index(state, actor_id)
  if not actor_index then return reject("NOT_A_PLAYER", "Only seated players may act") end

  if action.type == "rematch" then
    if state.phase ~= "ended" then return reject("GAME_NOT_OVER", "The mission is still active") end
    return {
      accepted = true,
      state = make_state(state.players, next_random(state)),
      events = {{type = "rematched", player = actor_id}},
    }
  end
  if state.phase == "setup_info" then
    if action.type ~= "place_info" then
      return reject("SETUP_INFO_REQUIRED", "Choose one of your blue wires for the information token")
    end
    if state.setupInfoOrder[state.setupInfoIndex] ~= actor_id then
      return reject("NOT_YOUR_SETUP_TURN", "Wait for your turn to place the information token")
    end
    local wire = state.wires[action.wireId]
    local held = false
    for _, wire_id in ipairs(state.hands[actor_id]) do
      if wire_id == action.wireId then held = true end
    end
    if not wire or wire.kind ~= "number" or not held then
      return reject("INVALID_INFO_WIRE", "Choose one of your blue wires")
    end
    state.clues[action.wireId] = true
    state.setupInfoIndex = state.setupInfoIndex + 1
    if state.setupInfoIndex > #state.setupInfoOrder then
      state.phase = "playing"
    end
    return {accepted = true, state = state, events = {}}
  end
  if state.phase ~= "playing" then return reject("GAME_OVER", "The mission has ended") end
  if actor_index ~= state.turn then return reject("NOT_YOUR_TURN", "Wait for your turn") end

  if action.type == "dual_cut" then
    local own_source = false
    for _, wire_id in ipairs(state.hands[actor_id]) do
      if wire_id == action.sourceId then own_source = true end
    end
    local source = state.wires[action.sourceId]
    local target = state.wires[action.targetId]
    local target_owner = owner_of(state, action.targetId)
    if not source or not own_source or source.kind == "red" then
      return reject("INVALID_SOURCE", "Choose one of your wires")
    end
    if not target or not target_owner or target_owner == actor_id then
      return reject("INVALID_TARGET", "Choose a teammate's wire")
    end
    if same_wire(source, target) then
      remove_wires(state, actor_id, {action.sourceId})
      remove_wires(state, target_owner, {action.targetId})
      state.lastAction = {type = "success", actorId = actor_id, targetOwnerId = target_owner, wire = {kind = source.kind, value = source.value}}
    elseif target.kind == "red" then
      state.phase = "ended"
      state.outcome = "failure"
      state.lastAction = {type = "red", actorId = actor_id, targetOwnerId = target_owner}
      return {accepted = true, state = state, events = {{type = "red_wire", player = actor_id}}}
    else
      state.detonator = state.detonator + 1
      state.clues[action.targetId] = true
      state.lastAction = {type = "miss", actorId = actor_id, targetOwnerId = target_owner, wire = {kind = target.kind, value = target.value}}
      if state.detonator >= state.detonatorLimit then
        state.phase = "ended"
        state.outcome = "failure"
        return {accepted = true, state = state, events = {{type = "detonator", player = actor_id}}}
      end
    end
    if state.phase == "playing" then next_turn(state, actor_index) end
    return {accepted = true, state = state, events = {}}
  end

  if action.type == "solo_cut" then
    local selected = state.wires[action.wireId]
    local held = false
    for _, wire_id in ipairs(state.hands[actor_id]) do
      if wire_id == action.wireId then held = true end
    end
    if not selected or not held or selected.kind == "red" then
      return reject("INVALID_WIRE", "Choose a number or yellow wire")
    end
    local remaining, all_held = {}, true
    for _, player in ipairs(state.players) do
      for _, wire_id in ipairs(state.hands[player.id]) do
        local wire = state.wires[wire_id]
        if same_wire(selected, wire) then
          table.insert(remaining, wire_id)
          if player.id ~= actor_id then all_held = false end
        end
      end
    end
    if #remaining < 2 or #remaining > 4 or not all_held then
      return reject("NOT_SOLO_CUTTABLE", "Those wires cannot be cut alone")
    end
    remove_wires(state, actor_id, remaining)
    state.lastAction = {type = "solo", actorId = actor_id, wire = {kind = selected.kind, value = selected.value}}
    next_turn(state, actor_index)
    return {accepted = true, state = state, events = {{type = "solo_cut", player = actor_id}}}
  end

  if action.type == "reveal_red" then
    local hand = state.hands[actor_id]
    if #hand == 0 then return reject("EMPTY_HAND", "Your hand is empty") end
    for _, wire_id in ipairs(hand) do
      if state.wires[wire_id].kind ~= "red" then
        return reject("RED_NOT_REVEALABLE", "Reveal red wires only when they are all you have left")
      end
    end
    local red_wires = {}
    for _, wire_id in ipairs(hand) do table.insert(red_wires, wire_id) end
    remove_wires(state, actor_id, red_wires, true)
    state.lastAction = {type = "reveal_red", actorId = actor_id}
    next_turn(state, actor_index)
    return {accepted = true, state = state, events = {{type = "red_revealed", player = actor_id}}}
  end

  return reject("UNKNOWN_ACTION", "Unknown action")
end

local function solo_options(state, player_id)
  local options = {}
  for _, wire_id in ipairs(state.hands[player_id]) do
    local selected = state.wires[wire_id]
    if selected.kind ~= "red" then
      local ids, all_held = {}, true
      for _, player in ipairs(state.players) do
        for _, held_id in ipairs(state.hands[player.id]) do
          if same_wire(selected, state.wires[held_id]) then
            table.insert(ids, held_id)
            if player.id ~= player_id then all_held = false end
          end
        end
      end
      if #ids >= 2 and #ids <= 4 and all_held then
        local seen = false
        for _, option in ipairs(options) do
          if option.kind == selected.kind and option.value == selected.value then seen = true end
        end
        if not seen then
          table.insert(options, {kind = selected.kind, value = selected.value, ids = ids})
        end
      end
    end
  end
  return options
end

function view(state, events, context)
  local viewer_id = context.viewer.id
  local current_player_id = state.phase == "setup_info"
    and state.setupInfoOrder[state.setupInfoIndex]
    or state.players[state.turn].id
  local projected = {
    phase = state.phase,
    players = state.players,
    specialCandidates = state.specialCandidates,
    viewerId = viewer_id,
    currentPlayerId = current_player_id,
    hands = {},
    racks = {},
    cutWires = state.cutWires,
    clues = state.clues,
    detonator = state.detonator,
    detonatorLimit = state.detonatorLimit,
    outcome = state.outcome,
    lastAction = state.lastAction,
    ownTurn = current_player_id == viewer_id,
    soloCuts = {},
    canRevealRed = false,
  }
  local cut_wires_by_slot = {}
  for _, wire in ipairs(state.cutWires) do
    cut_wires_by_slot[wire.playerId .. ":" .. wire.rackIndex .. ":" .. wire.slotIndex] = wire
  end
  for _, player in ipairs(state.players) do
    projected.hands[player.id] = {}
    projected.racks[player.id] = {}
    for _, wire_id in ipairs(state.hands[player.id]) do
      local wire = state.wires[wire_id]
      local revealed = state.phase == "ended" or player.id == viewer_id or state.clues[wire_id] == true
      table.insert(projected.hands[player.id], {
        id = wire_id,
        kind = revealed and wire.kind or nil,
        value = revealed and wire.value or nil,
        tileNumber = revealed and wire.tileNumber or nil,
        revealed = revealed,
      })
    end
    for rack_index, slots in ipairs(state.rackSlots[player.id]) do
      local rack = {}
      for slot_index, wire_id in ipairs(slots) do
        if wire_id == false then
          table.insert(rack, {
            id = player.id .. "-rack-" .. (rack_index - 1) .. "-slot-" .. (slot_index - 1),
            empty = true,
            cutWire = cut_wires_by_slot[player.id .. ":" .. (rack_index - 1) .. ":" .. (slot_index - 1)],
          })
        else
          local wire = state.wires[wire_id]
          local revealed = state.phase == "ended" or player.id == viewer_id
          local info_token
          if state.clues[wire_id] then
            if wire.kind == "number" then info_token = tostring(wire.value)
            elseif wire.kind == "yellow" then info_token = "黄" end
          end
          table.insert(rack, {
            id = wire_id,
            kind = revealed and wire.kind or nil,
            value = revealed and wire.value or nil,
            tileNumber = revealed and wire.tileNumber or nil,
            revealed = revealed,
            infoToken = info_token,
          })
        end
      end
      table.insert(projected.racks[player.id], rack)
    end
  end
  if projected.ownTurn and state.phase == "playing" then
    projected.soloCuts = solo_options(state, viewer_id)
    local hand = state.hands[viewer_id]
    projected.canRevealRed = #hand > 0
    for _, wire_id in ipairs(hand) do
      if state.wires[wire_id].kind ~= "red" then projected.canRevealRed = false end
    end
  end
  return {state = projected, events = events}
end

function on_return_to_room(state, context)
  return true
end

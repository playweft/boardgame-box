-- Base Splendor. Keep the numerical inventory synchronized with dev/sync-splendor-data.js.
-- BEGIN INVENTORY
local CARDS = {
  {id="white-L1-01",level=1,bonus="white",points=0,cost={white=0,blue=3,green=0,red=0,black=0}},
  {id="white-L1-02",level=1,bonus="white",points=1,cost={white=0,blue=0,green=4,red=0,black=0}},
  {id="white-L1-03",level=1,bonus="white",points=0,cost={white=0,blue=0,green=0,red=2,black=1}},
  {id="white-L1-04",level=1,bonus="white",points=0,cost={white=0,blue=2,green=0,red=0,black=2}},
  {id="white-L1-05",level=1,bonus="white",points=0,cost={white=3,blue=1,green=0,red=0,black=1}},
  {id="white-L1-06",level=1,bonus="white",points=0,cost={white=0,blue=2,green=2,red=0,black=1}},
  {id="white-L1-07",level=1,bonus="white",points=0,cost={white=0,blue=1,green=1,red=1,black=1}},
  {id="white-L1-08",level=1,bonus="white",points=0,cost={white=0,blue=1,green=2,red=1,black=1}},
  {id="white-L2-01",level=2,bonus="white",points=2,cost={white=0,blue=0,green=0,red=5,black=0}},
  {id="white-L2-02",level=2,bonus="white",points=3,cost={white=6,blue=0,green=0,red=0,black=0}},
  {id="white-L2-03",level=2,bonus="white",points=2,cost={white=0,blue=0,green=0,red=5,black=3}},
  {id="white-L2-04",level=2,bonus="white",points=2,cost={white=0,blue=0,green=1,red=4,black=2}},
  {id="white-L2-05",level=2,bonus="white",points=1,cost={white=0,blue=0,green=3,red=2,black=2}},
  {id="white-L2-06",level=2,bonus="white",points=1,cost={white=2,blue=3,green=0,red=3,black=0}},
  {id="white-L3-01",level=3,bonus="white",points=4,cost={white=0,blue=0,green=0,red=0,black=7}},
  {id="white-L3-02",level=3,bonus="white",points=4,cost={white=3,blue=0,green=0,red=3,black=6}},
  {id="white-L3-03",level=3,bonus="white",points=3,cost={white=0,blue=3,green=3,red=5,black=3}},
  {id="white-L3-04",level=3,bonus="white",points=5,cost={white=3,blue=0,green=0,red=0,black=7}},
  {id="blue-L1-01",level=1,bonus="blue",points=0,cost={white=0,blue=0,green=0,red=0,black=3}},
  {id="blue-L1-02",level=1,bonus="blue",points=1,cost={white=0,blue=0,green=0,red=4,black=0}},
  {id="blue-L1-03",level=1,bonus="blue",points=0,cost={white=1,blue=0,green=0,red=0,black=2}},
  {id="blue-L1-04",level=1,bonus="blue",points=0,cost={white=0,blue=0,green=2,red=0,black=2}},
  {id="blue-L1-05",level=1,bonus="blue",points=0,cost={white=0,blue=1,green=3,red=1,black=0}},
  {id="blue-L1-06",level=1,bonus="blue",points=0,cost={white=1,blue=0,green=2,red=2,black=0}},
  {id="blue-L1-07",level=1,bonus="blue",points=0,cost={white=1,blue=0,green=1,red=1,black=1}},
  {id="blue-L1-08",level=1,bonus="blue",points=0,cost={white=1,blue=0,green=1,red=2,black=1}},
  {id="blue-L2-01",level=2,bonus="blue",points=2,cost={white=0,blue=5,green=0,red=0,black=0}},
  {id="blue-L2-02",level=2,bonus="blue",points=3,cost={white=0,blue=6,green=0,red=0,black=0}},
  {id="blue-L2-03",level=2,bonus="blue",points=2,cost={white=5,blue=3,green=0,red=0,black=0}},
  {id="blue-L2-04",level=2,bonus="blue",points=2,cost={white=2,blue=0,green=0,red=1,black=4}},
  {id="blue-L2-05",level=2,bonus="blue",points=1,cost={white=0,blue=2,green=2,red=3,black=0}},
  {id="blue-L2-06",level=2,bonus="blue",points=1,cost={white=0,blue=2,green=3,red=0,black=3}},
  {id="blue-L3-01",level=3,bonus="blue",points=4,cost={white=7,blue=0,green=0,red=0,black=0}},
  {id="blue-L3-02",level=3,bonus="blue",points=4,cost={white=6,blue=3,green=0,red=0,black=3}},
  {id="blue-L3-03",level=3,bonus="blue",points=3,cost={white=3,blue=0,green=3,red=3,black=5}},
  {id="blue-L3-04",level=3,bonus="blue",points=5,cost={white=7,blue=3,green=0,red=0,black=0}},
  {id="green-L1-01",level=1,bonus="green",points=0,cost={white=0,blue=0,green=0,red=3,black=0}},
  {id="green-L1-02",level=1,bonus="green",points=1,cost={white=0,blue=0,green=0,red=0,black=4}},
  {id="green-L1-03",level=1,bonus="green",points=0,cost={white=2,blue=1,green=0,red=0,black=0}},
  {id="green-L1-04",level=1,bonus="green",points=0,cost={white=0,blue=2,green=0,red=2,black=0}},
  {id="green-L1-05",level=1,bonus="green",points=0,cost={white=1,blue=3,green=1,red=0,black=0}},
  {id="green-L1-06",level=1,bonus="green",points=0,cost={white=0,blue=1,green=0,red=2,black=2}},
  {id="green-L1-07",level=1,bonus="green",points=0,cost={white=1,blue=1,green=0,red=1,black=1}},
  {id="green-L1-08",level=1,bonus="green",points=0,cost={white=1,blue=1,green=0,red=1,black=2}},
  {id="green-L2-01",level=2,bonus="green",points=2,cost={white=0,blue=0,green=5,red=0,black=0}},
  {id="green-L2-02",level=2,bonus="green",points=3,cost={white=0,blue=0,green=6,red=0,black=0}},
  {id="green-L2-03",level=2,bonus="green",points=2,cost={white=0,blue=5,green=3,red=0,black=0}},
  {id="green-L2-04",level=2,bonus="green",points=2,cost={white=4,blue=2,green=0,red=0,black=1}},
  {id="green-L2-05",level=2,bonus="green",points=1,cost={white=2,blue=3,green=0,red=0,black=2}},
  {id="green-L2-06",level=2,bonus="green",points=1,cost={white=3,blue=0,green=2,red=3,black=0}},
  {id="green-L3-01",level=3,bonus="green",points=4,cost={white=0,blue=7,green=0,red=0,black=0}},
  {id="green-L3-02",level=3,bonus="green",points=4,cost={white=3,blue=6,green=3,red=0,black=0}},
  {id="green-L3-03",level=3,bonus="green",points=3,cost={white=5,blue=3,green=0,red=3,black=3}},
  {id="green-L3-04",level=3,bonus="green",points=5,cost={white=0,blue=7,green=3,red=0,black=0}},
  {id="red-L1-01",level=1,bonus="red",points=0,cost={white=3,blue=0,green=0,red=0,black=0}},
  {id="red-L1-02",level=1,bonus="red",points=1,cost={white=4,blue=0,green=0,red=0,black=0}},
  {id="red-L1-03",level=1,bonus="red",points=0,cost={white=0,blue=2,green=1,red=0,black=0}},
  {id="red-L1-04",level=1,bonus="red",points=0,cost={white=2,blue=0,green=0,red=2,black=0}},
  {id="red-L1-05",level=1,bonus="red",points=0,cost={white=1,blue=0,green=0,red=1,black=3}},
  {id="red-L1-06",level=1,bonus="red",points=0,cost={white=2,blue=0,green=1,red=0,black=2}},
  {id="red-L1-07",level=1,bonus="red",points=0,cost={white=1,blue=1,green=1,red=0,black=1}},
  {id="red-L1-08",level=1,bonus="red",points=0,cost={white=2,blue=1,green=1,red=0,black=1}},
  {id="red-L2-01",level=2,bonus="red",points=2,cost={white=0,blue=0,green=0,red=0,black=5}},
  {id="red-L2-02",level=2,bonus="red",points=3,cost={white=0,blue=0,green=0,red=6,black=0}},
  {id="red-L2-03",level=2,bonus="red",points=2,cost={white=3,blue=0,green=0,red=0,black=5}},
  {id="red-L2-04",level=2,bonus="red",points=2,cost={white=1,blue=4,green=2,red=0,black=0}},
  {id="red-L2-05",level=2,bonus="red",points=1,cost={white=2,blue=0,green=0,red=2,black=3}},
  {id="red-L2-06",level=2,bonus="red",points=1,cost={white=0,blue=3,green=0,red=2,black=3}},
  {id="red-L3-01",level=3,bonus="red",points=4,cost={white=0,blue=0,green=7,red=0,black=0}},
  {id="red-L3-02",level=3,bonus="red",points=4,cost={white=0,blue=3,green=6,red=3,black=0}},
  {id="red-L3-03",level=3,bonus="red",points=3,cost={white=3,blue=5,green=3,red=0,black=3}},
  {id="red-L3-04",level=3,bonus="red",points=5,cost={white=0,blue=0,green=7,red=3,black=0}},
  {id="black-L1-01",level=1,bonus="black",points=0,cost={white=0,blue=0,green=3,red=0,black=0}},
  {id="black-L1-02",level=1,bonus="black",points=1,cost={white=0,blue=4,green=0,red=0,black=0}},
  {id="black-L1-03",level=1,bonus="black",points=0,cost={white=0,blue=0,green=2,red=1,black=0}},
  {id="black-L1-04",level=1,bonus="black",points=0,cost={white=2,blue=0,green=2,red=0,black=0}},
  {id="black-L1-05",level=1,bonus="black",points=0,cost={white=0,blue=0,green=1,red=3,black=1}},
  {id="black-L1-06",level=1,bonus="black",points=0,cost={white=2,blue=2,green=0,red=1,black=0}},
  {id="black-L1-07",level=1,bonus="black",points=0,cost={white=1,blue=1,green=1,red=1,black=0}},
  {id="black-L1-08",level=1,bonus="black",points=0,cost={white=1,blue=2,green=1,red=1,black=0}},
  {id="black-L2-01",level=2,bonus="black",points=2,cost={white=5,blue=0,green=0,red=0,black=0}},
  {id="black-L2-02",level=2,bonus="black",points=3,cost={white=0,blue=0,green=0,red=0,black=6}},
  {id="black-L2-03",level=2,bonus="black",points=2,cost={white=0,blue=0,green=5,red=3,black=0}},
  {id="black-L2-04",level=2,bonus="black",points=2,cost={white=0,blue=1,green=4,red=2,black=0}},
  {id="black-L2-05",level=2,bonus="black",points=1,cost={white=3,blue=2,green=2,red=0,black=0}},
  {id="black-L2-06",level=2,bonus="black",points=1,cost={white=3,blue=0,green=3,red=0,black=2}},
  {id="black-L3-01",level=3,bonus="black",points=4,cost={white=0,blue=0,green=0,red=7,black=0}},
  {id="black-L3-02",level=3,bonus="black",points=4,cost={white=0,blue=0,green=3,red=6,black=3}},
  {id="black-L3-03",level=3,bonus="black",points=3,cost={white=3,blue=3,green=5,red=3,black=0}},
  {id="black-L3-04",level=3,bonus="black",points=5,cost={white=0,blue=0,green=0,red=7,black=3}},
}
local NOBLES = {
  {id="noble-1",points=3,cost={white=4,blue=4,green=0,red=0,black=0}},
  {id="noble-2",points=3,cost={white=0,blue=4,green=4,red=0,black=0}},
  {id="noble-3",points=3,cost={white=0,blue=0,green=4,red=4,black=0}},
  {id="noble-4",points=3,cost={white=0,blue=0,green=0,red=4,black=4}},
  {id="noble-5",points=3,cost={white=4,blue=0,green=0,red=0,black=4}},
  {id="noble-6",points=3,cost={white=3,blue=3,green=3,red=0,black=0}},
  {id="noble-7",points=3,cost={white=0,blue=3,green=3,red=3,black=0}},
  {id="noble-8",points=3,cost={white=0,blue=0,green=3,red=3,black=3}},
  {id="noble-9",points=3,cost={white=3,blue=0,green=0,red=3,black=3}},
  {id="noble-10",points=3,cost={white=3,blue=3,green=0,red=0,black=3}},
}
-- END INVENTORY
local COLORS = {"white", "blue", "green", "red", "black"}
local TOKEN_COLORS = {"white", "blue", "green", "red", "black", "gold"}
local MODULUS = 2147483647

local function copy(value)
  if type(value) ~= "table" then return value end
  local result = {}
  for key, entry in pairs(value) do result[key] = copy(entry) end
  return result
end
local function empty_tokens()
  return {white=0, blue=0, green=0, red=0, black=0, gold=0}
end
local function total(tokens)
  local count = 0
  for _, color in ipairs(TOKEN_COLORS) do count = count + tokens[color] end
  return count
end
local function normalize_seed(value)
  local seed = 0
  for character in tostring(value):gmatch(".") do
    local digit = tonumber(character, 16)
    if digit then seed = (seed * 16 + digit) % MODULUS end
  end
  return seed == 0 and 1 or seed
end
local function shuffle(state, list)
  for index = #list, 2, -1 do
    state.seed = state.seed * 48271 % MODULUS
    local target = state.seed % index + 1
    list[index], list[target] = list[target], list[index]
  end
  return list
end
local function player_index(state, id)
  for index, player in ipairs(state.players) do if player.id == id then return index end end
end
local function make_state(players, seed)
  assert(#players >= 2 and #players <= 4, "需要 2–4 名不同的玩家")
  local state = {
    players={}, boards={}, bank=empty_tokens(), decks={}, market={}, nobles={},
    round=1, turn=0, step=0, phase="playing", winners={}, history={}, seed=normalize_seed(seed),
  }
  for index, player in ipairs(players) do
    assert(type(player.id) == "string" and player.id ~= "" and not state.boards[player.id], "需要 2–4 名不同的玩家")
    table.insert(state.players, {id=player.id, name=player.name or "玩家 " .. index})
    state.boards[player.id] = {
      tokens=empty_tokens(), bonuses={white=0,blue=0,green=0,red=0,black=0},
      purchased={}, reserved={}, nobles={}, score=0,
    }
  end
  for _, color in ipairs(TOKEN_COLORS) do state.bank[color] = color == "gold" and 5 or ({[2]=4,[3]=5,[4]=7})[#players] end
  for level = 1, 3 do
    local deck, row = {}, {}
    for _, card in ipairs(CARDS) do if card.level == level then table.insert(deck, copy(card)) end end
    shuffle(state, deck)
    for slot = 1, 4 do table.insert(row, table.remove(deck)) end
    table.insert(state.decks, deck); table.insert(state.market, row)
  end
  local nobles = shuffle(state, copy(NOBLES))
  for index = 1, #players + 1 do table.insert(state.nobles, nobles[index]) end
  return state
end

function setup(context)
  return {state=make_state(context.players, context.match.randomSeed), events={}}
end

local function cost_after_bonuses(board, card)
  local due = {}
  for _, color in ipairs(COLORS) do due[color] = math.max(0, card.cost[color] - board.bonuses[color]) end
  return due
end
local function payment_for(board, card)
  local due, payment = cost_after_bonuses(board, card), empty_tokens()
  for _, color in ipairs(COLORS) do
    payment[color] = math.min(due[color], board.tokens[color])
    payment.gold = payment.gold + due[color] - payment[color]
  end
  if payment.gold > board.tokens.gold then return nil end
  return payment
end
local function eligible_nobles(state, id)
  local result, board = {}, state.boards[id]
  for _, noble in ipairs(state.nobles) do
    local eligible = true
    for _, color in ipairs(COLORS) do if board.bonuses[color] < noble.cost[color] then eligible = false end end
    if eligible then table.insert(result, noble) end
  end
  return result
end
local function finish_turn(state)
  local board = state.boards[state.players[state.turn + 1].id]
  if board.score >= 15 and state.endingRound == nil then state.endingRound = state.round end
  if #state.history >= 40 then table.remove(state.history, 1) end
  table.insert(state.history, copy(state.lastMove))
  local next_turn = (state.turn + 1) % #state.players
  state.phase = "playing"
  if next_turn == 0 and state.endingRound ~= nil then
    state.phase = "ended"
    local highest, fewest = -1, 999
    for _, player in ipairs(state.players) do
      local b = state.boards[player.id]
      if b.score > highest then highest, fewest = b.score, #b.purchased
      elseif b.score == highest then fewest = math.min(fewest, #b.purchased) end
    end
    state.winners = {}
    for _, player in ipairs(state.players) do
      local b = state.boards[player.id]
      if b.score == highest and #b.purchased == fewest then table.insert(state.winners, player.id) end
    end
    return
  end
  state.turn = next_turn
  if next_turn == 0 then state.round = state.round + 1 end
end
local function claim_noble(state, noble)
  local board = state.boards[state.players[state.turn + 1].id]
  for index, candidate in ipairs(state.nobles) do if candidate.id == noble.id then table.remove(state.nobles, index); break end end
  table.insert(board.nobles, noble); board.score = board.score + noble.points
  state.lastMove.nobleId = noble.id
end
local function check_nobles(state)
  local eligible = eligible_nobles(state, state.players[state.turn + 1].id)
  if #eligible > 1 then state.phase = "choose_noble"; return end
  if #eligible == 1 then claim_noble(state, eligible[1]) end
  finish_turn(state)
end
local function after_action(state)
  if total(state.boards[state.players[state.turn + 1].id].tokens) > 10 then state.phase = "return_tokens"
  else check_nobles(state) end
end
local function locate_card(state, board, id, include_reserved)
  if type(id) ~= "string" then return nil end
  for level, row in ipairs(state.market) do
    for slot, card in ipairs(row) do if card.id == id then return {card=card,level=level,slot=slot,reserved=false} end end
  end
  if include_reserved then
    for slot, card in ipairs(board.reserved) do if card.id == id then return {card=card,slot=slot,reserved=true} end end
  end
end
local function remove_card(state, board, located)
  if located.reserved then table.remove(board.reserved, located.slot)
  else
    local replacement = table.remove(state.decks[located.level])
    if replacement then state.market[located.level][located.slot] = replacement
    else table.remove(state.market[located.level], located.slot) end
  end
end
local function includes(list, value)
  for _, entry in ipairs(list) do if entry == value then return true end end
  return false
end
local function integer(value, minimum, maximum)
  return type(value) == "number" and value % 1 == 0 and value >= minimum and value <= maximum
end
local function valid_tokens(value)
  if type(value) ~= "table" then return false end
  for key, count in pairs(value) do if not includes(TOKEN_COLORS, key) or not integer(count, 0, math.huge) then return false end end
  return true
end
local function complete_tokens(value)
  local result = empty_tokens()
  for key, count in pairs(value) do result[key] = count end
  return result
end
local function reject(message)
  return {accepted=false, error={code="INVALID_ACTION", message=message}}
end

local function can_pass(state, board)
  for _, color in ipairs(COLORS) do if state.bank[color] > 0 then return false end end
  if #board.reserved < 3 then
    for level, row in ipairs(state.market) do if #row > 0 or #state.decks[level] > 0 then return false end end
  end
  for _, row in ipairs(state.market) do
    for _, card in ipairs(row) do if payment_for(board, card) then return false end end
  end
  for _, card in ipairs(board.reserved) do if payment_for(board, card) then return false end end
  return true
end

function on_action(state, action, context)
  local actor = context.actor.id
  if not player_index(state, actor) then return reject("只有入座玩家可以操作") end
  if type(action) ~= "table" then return reject("未知操作") end
  if action.step ~= state.step or action.round ~= state.round then return reject("局面已更新，请重新选择") end
  if action.type == "rematch" then
    if state.phase ~= "ended" then return reject("整局尚未结束") end
    local roster = {}
    for index = 2, #state.players do table.insert(roster, state.players[index]) end
    table.insert(roster, state.players[1])
    local fresh = make_state(roster, string.format("%x", state.seed))
    fresh.step = state.step + 1
    return {accepted=true, state=fresh, events={}}
  end
  if state.phase == "ended" or state.players[state.turn + 1].id ~= actor then return reject("请等待你的回合") end
  local board = state.boards[actor]
  if state.phase == "return_tokens" then
    if action.type ~= "return_tokens" or not valid_tokens(action.tokens) then return reject("请先归还超出的宝石") end
    local returned = complete_tokens(action.tokens)
    for _, color in ipairs(TOKEN_COLORS) do if returned[color] > board.tokens[color] then return reject("请恰好归还超出 10 枚的宝石") end end
    if total(returned) ~= total(board.tokens) - 10 then return reject("请恰好归还超出 10 枚的宝石") end
    for _, color in ipairs(TOKEN_COLORS) do board.tokens[color] = board.tokens[color] - returned[color]; state.bank[color] = state.bank[color] + returned[color] end
    state.lastMove.returned = returned
    check_nobles(state)
  elseif state.phase == "choose_noble" then
    local noble = nil
    for _, candidate in ipairs(eligible_nobles(state, actor)) do if candidate.id == action.nobleId then noble = candidate end end
    if action.type ~= "choose_noble" or not noble then return reject("请选择一位满足条件的贵族") end
    claim_noble(state, noble); finish_turn(state)
  elseif action.type == "pass" then
    if not can_pass(state, board) then return reject("还有可用操作，不能跳过回合") end
    state.lastMove = {playerId=actor,type="pass",round=state.round}
    check_nobles(state)
  elseif action.type == "take" then
    if type(action.colors) ~= "table" or #action.colors < 1 or #action.colors > 3 then return reject("请选择宝石颜色") end
    local counts, distinct, available = empty_tokens(), 0, 0
    for key, color in pairs(action.colors) do
      if not integer(key, 1, #action.colors) or not includes(COLORS, color) then return reject("请选择宝石颜色") end
    end
    for _, color in ipairs(action.colors) do counts[color] = counts[color] + 1 end
    for _, color in ipairs(COLORS) do
      if counts[color] > 0 then distinct = distinct + 1 end
      if state.bank[color] > 0 then available = available + 1 end
    end
    if distinct == 1 and #action.colors == 2 then
      if state.bank[action.colors[1]] < 4 then return reject("拿取同色两枚前，该颜色供应须至少 4 枚") end
    elseif distinct ~= #action.colors or distinct ~= math.min(3, available) then
      return reject("请选择三种不同颜色；不足三种时拿取所有可用颜色")
    end
    for _, color in ipairs(COLORS) do if counts[color] > state.bank[color] then return reject("供应区宝石不足") end end
    for _, color in ipairs(TOKEN_COLORS) do board.tokens[color] = board.tokens[color] + counts[color]; state.bank[color] = state.bank[color] - counts[color] end
    state.lastMove = {playerId=actor,type="take",tokens=counts,round=state.round}
    after_action(state)
  elseif action.type == "reserve" then
    if #board.reserved >= 3 then return reject("最多预留三张发展卡") end
    local card = nil
    if action.blind == true then
      if not integer(action.level, 1, 3) or #state.decks[action.level] == 0 then return reject("这叠牌已经用完") end
      card = table.remove(state.decks[action.level])
    else
      local located = locate_card(state, board, action.cardId, false)
      if not located then return reject("这张公开牌已不在市场") end
      card = located.card; remove_card(state, board, located)
    end
    table.insert(board.reserved, card)
    local gold = state.bank.gold > 0 and 1 or 0
    board.tokens.gold = board.tokens.gold + gold; state.bank.gold = state.bank.gold - gold
    state.lastMove = {playerId=actor,type="reserve",level=card.level,blind=action.blind == true,gold=gold,round=state.round}
    after_action(state)
  elseif action.type == "buy" then
    local located = locate_card(state, board, action.cardId, true)
    if not located then return reject("请选择市场或自己预留中的发展卡") end
    if action.payment ~= nil and not valid_tokens(action.payment) then return reject("支付方案无效") end
    local payment = action.payment ~= nil and complete_tokens(action.payment) or payment_for(board, located.card)
    local due, gold_due = cost_after_bonuses(board, located.card), 0
    if not payment then return reject("宝石不足或支付方案不正确") end
    for _, color in ipairs(TOKEN_COLORS) do if payment[color] > board.tokens[color] then return reject("宝石不足或支付方案不正确") end end
    for _, color in ipairs(COLORS) do
      if payment[color] > due[color] then return reject("宝石不足或支付方案不正确") end
      gold_due = gold_due + due[color] - payment[color]
    end
    if payment.gold ~= gold_due then return reject("宝石不足或支付方案不正确") end
    for _, color in ipairs(TOKEN_COLORS) do board.tokens[color] = board.tokens[color] - payment[color]; state.bank[color] = state.bank[color] + payment[color] end
    remove_card(state, board, located)
    table.insert(board.purchased, located.card); board.bonuses[located.card.bonus] = board.bonuses[located.card.bonus] + 1
    board.score = board.score + located.card.points
    state.lastMove = {playerId=actor,type="buy",cardId=located.card.id,payment=payment,round=state.round}
    after_action(state)
  else return reject("未知操作") end
  state.step = state.step + 1
  return {accepted=true,state=state,events={}}
end

function view(state, events, context)
  local viewer, boards, counts, eligible = context.viewer.id, {}, {}, {}
  local seated = player_index(state, viewer) ~= nil
  local can_act = seated and state.phase ~= "ended" and state.players[state.turn + 1].id == viewer
  for _, player in ipairs(state.players) do
    local b = state.boards[player.id]
    local reserved = {}
    for _, card in ipairs(b.reserved) do table.insert(reserved, player.id == viewer and card or {hidden=true,level=card.level}) end
    boards[player.id] = {tokens=b.tokens,bonuses=b.bonuses,purchased=b.purchased,reserved=reserved,nobles=b.nobles,score=b.score}
  end
  for _, deck in ipairs(state.decks) do table.insert(counts, #deck) end
  if state.phase == "choose_noble" then
    for _, noble in ipairs(eligible_nobles(state, state.players[state.turn + 1].id)) do table.insert(eligible, noble.id) end
  end
  return {state={
    players=state.players,boards=boards,bank=state.bank,market=state.market,nobles=state.nobles,counts=counts,
    round=state.round,step=state.step,phase=state.phase,endingRound=state.endingRound,
    currentPlayerId=state.players[state.turn + 1].id,viewerId=viewer,
    canAct=can_act,canPass=can_act and state.phase == "playing" and can_pass(state, state.boards[viewer]),
    canRematch=seated and state.phase == "ended",winners=state.winners,eligibleNobleIds=eligible,
    lastMove=state.lastMove,history=state.history,
  },events={}}
end

function on_return_to_room(state, context) return true end

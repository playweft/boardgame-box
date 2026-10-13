local MODULUS = 2147483647
local FLOOR_COSTS = {1, 1, 2, 2, 2, 3, 3}

local function normalize_seed(value)
  local seed = 0
  for character in tostring(value):gmatch(".") do
    local digit = tonumber(character, 16)
    if digit then seed = (seed * 16 + digit) % MODULUS end
  end
  return seed == 0 and 1 or seed
end

local function shuffle(state, tiles)
  for index = #tiles, 2, -1 do
    state.seed = (state.seed * 48271) % MODULUS
    local target = state.seed % index + 1
    tiles[index], tiles[target] = tiles[target], tiles[index]
  end
  return tiles
end

local function wall_column(row, color)
  return (color + row - 1) % 5 + 1
end

local function player_index(state, id)
  for index, player in ipairs(state.players) do if player.id == id then return index end end
end

local function fill_factories(state)
  state.factories = {}
  for index = 1, 2 * #state.players + 1 do
    local factory = {}
    for count = 1, 4 do
      if #state.bag == 0 then
        state.bag = shuffle(state, state.discard)
        state.discard = {}
      end
      if #state.bag == 0 then break end
      table.insert(factory, table.remove(state.bag))
    end
    table.insert(state.factories, factory)
  end
  state.center, state.centerMarker, state.nextStarterId = {}, true, nil
  state.phase, state.settlement = "drafting", nil
end

local function make_state(players, seed)
  assert(#players >= 2 and #players <= 4, "需要 2–4 名玩家")
  local state = {
    players = {}, boards = {}, bag = {}, discard = {}, seed = normalize_seed(seed),
    round = 1, step = 0, turn = 0, starterId = players[1].id, winners = {},
  }
  for index, player in ipairs(players) do
    assert(state.boards[player.id] == nil, "玩家不能重复")
    table.insert(state.players, {id = player.id, name = player.name or "玩家 " .. index})
    local board = {score = 0, lines = {}, wall = {}, floor = {}}
    for row = 1, 5 do
      board.lines[row] = {}
      board.wall[row] = {false, false, false, false, false}
    end
    state.boards[player.id] = board
  end
  for color = 0, 4 do for count = 1, 20 do table.insert(state.bag, color) end end
  shuffle(state, state.bag)
  fill_factories(state)
  return state
end

function setup(context)
  return {state = make_state(context.players, context.match.randomSeed), events = {}}
end

local function integer(value, minimum, maximum)
  return type(value) == "number" and value % 1 == 0 and value >= minimum and value <= maximum
end

local function can_place(board, row, color)
  local line = board.lines[row]
  return #line < row and (#line == 0 or line[1] == color) and not board.wall[row][wall_column(row, color)]
end

local function wall_score(wall, row, column)
  local horizontal, vertical = 1, 1
  for _, direction in ipairs({-1, 1}) do
    local x, y = column + direction, row + direction
    while x >= 1 and x <= 5 and wall[row][x] do horizontal = horizontal + 1; x = x + direction end
    while y >= 1 and y <= 5 and wall[y][column] do vertical = vertical + 1; y = y + direction end
  end
  if horizontal == 1 and vertical == 1 then return 1 end
  return (horizontal > 1 and horizontal or 0) + (vertical > 1 and vertical or 0)
end

local function wall_bonuses(wall)
  local rows, columns, colors = 0, 0, 0
  for index = 1, 5 do
    local row_full, column_full, color_full = true, true, true
    for offset = 1, 5 do
      if not wall[index][offset] then row_full = false end
      if not wall[offset][index] then column_full = false end
      if not wall[offset][wall_column(offset, index - 1)] then color_full = false end
    end
    if row_full then rows = rows + 1 end
    if column_full then columns = columns + 1 end
    if color_full then colors = colors + 1 end
  end
  return {rows = rows, columns = columns, colors = colors, points = rows * 2 + columns * 7 + colors * 10}
end

local function add_floor(state, board, color)
  if #board.floor < 7 then table.insert(board.floor, color)
  elseif color ~= -1 then table.insert(state.discard, color) end
end

local function settle_round(state)
  local results, ended = {}, false
  for _, player in ipairs(state.players) do
    local board = state.boards[player.id]
    local result = {before = board.score, placements = {}, penalty = 0}
    for row = 1, 5 do
      local line = board.lines[row]
      if #line == row then
        local color, column = line[1], wall_column(row, line[1])
        board.wall[row][column] = true
        local points = wall_score(board.wall, row, column)
        board.score = board.score + points
        table.insert(result.placements, {row = row - 1, column = column - 1, color = color, points = points})
        for index = 2, #line do table.insert(state.discard, line[index]) end
        board.lines[row] = {}
      end
    end
    for index, color in ipairs(board.floor) do
      result.penalty = result.penalty + FLOOR_COSTS[index]
      if color ~= -1 then table.insert(state.discard, color) end
    end
    board.score = math.max(0, board.score - result.penalty)
    board.floor = {}
    result.delta = board.score - result.before
    results[player.id] = result
    if wall_bonuses(board.wall).rows > 0 then ended = true end
  end
  state.phase = ended and "ended" or "round_end"
  if ended then
    local highest, most_rows = -1, -1
    for _, player in ipairs(state.players) do
      local board, result = state.boards[player.id], results[player.id]
      result.bonus = wall_bonuses(board.wall)
      board.score = board.score + result.bonus.points
      result.delta = board.score - result.before
      if board.score > highest then highest, most_rows = board.score, result.bonus.rows
      elseif board.score == highest then most_rows = math.max(most_rows, result.bonus.rows) end
    end
    state.winners = {}
    for _, player in ipairs(state.players) do
      if state.boards[player.id].score == highest and results[player.id].bonus.rows == most_rows then table.insert(state.winners, player.id) end
    end
  end
  state.settlement = {round = state.round, results = results}
end

local function reject(message)
  return {accepted = false, error = {code = "INVALID_ACTION", message = message}}
end

function on_action(state, action, context)
  local actor_id = context.actor.id
  if not player_index(state, actor_id) then return reject("只有入座玩家可以操作") end
  if type(action) ~= "table" or (action.type ~= "draft" and action.type ~= "next_round" and action.type ~= "rematch") then return reject("未知操作") end
  if action.round ~= state.round or action.step ~= state.step then return reject("局面已更新，请重新选择") end
  if action.type == "draft" then
    if state.phase ~= "drafting" or state.players[state.turn + 1].id ~= actor_id then return reject("请等待你的选砖回合") end
    local source, color, row = action.source, action.color, action.row
    if not integer(source, -1, #state.factories - 1) then return reject("请选择一个工厂或中央区域") end
    if not integer(color, 0, 4) then return reject("请选择一种花砖颜色") end
    if not integer(row, -1, 4) then return reject("请选择一条花纹行或地板区") end
    local tiles = source == -1 and state.center or state.factories[source + 1]
    local chosen, rest = {}, {}
    for _, tile in ipairs(tiles) do table.insert(tile == color and chosen or rest, tile) end
    if #chosen == 0 then return reject("这个区域没有该颜色的花砖") end
    local board = state.boards[actor_id]
    if row ~= -1 and not can_place(board, row + 1, color) then return reject("这条花纹行不能放置该颜色") end
    local marker = source == -1 and state.centerMarker
    if source == -1 then
      state.center = rest
      if marker then
        state.centerMarker, state.nextStarterId = false, actor_id
        add_floor(state, board, -1)
      end
    else
      state.factories[source + 1] = {}
      for _, tile in ipairs(rest) do table.insert(state.center, tile) end
    end
    local placed = row == -1 and 0 or math.min(#chosen, row + 1 - #board.lines[row + 1])
    for index, tile in ipairs(chosen) do
      if index <= placed then table.insert(board.lines[row + 1], tile)
      else add_floor(state, board, tile) end
    end
    state.lastMove = {playerId = actor_id, source = source, color = color, row = row, count = #chosen, overflow = #chosen - placed, marker = marker}
    state.turn = (state.turn + 1) % #state.players
    local empty = #state.center == 0
    for _, factory in ipairs(state.factories) do if #factory > 0 then empty = false end end
    if empty then settle_round(state) end
  elseif action.type == "next_round" then
    if state.phase ~= "round_end" then return reject("本轮尚未结束") end
    state.starterId = state.nextStarterId or state.starterId
    state.turn = player_index(state, state.starterId) - 1
    state.round, state.lastMove = state.round + 1, nil
    fill_factories(state)
  else
    if state.phase ~= "ended" then return reject("整局尚未结束") end
    local fresh = make_state(state.players, string.format("%x", state.seed))
    fresh.step = state.step
    state = fresh
  end
  state.step = state.step + 1
  return {accepted = true, state = state, events = {}}
end

function view(state, events, context)
  local viewer_id = context.viewer.id
  local seated = player_index(state, viewer_id) ~= nil
  return {state = {
    players = state.players, boards = state.boards, factories = state.factories,
    center = state.center, centerMarker = state.centerMarker, nextStarterId = state.nextStarterId,
    starterId = state.starterId, round = state.round, step = state.step, phase = state.phase,
    currentPlayerId = state.players[state.turn + 1].id, viewerId = viewer_id,
    canDraft = seated and state.phase == "drafting" and state.players[state.turn + 1].id == viewer_id,
    canContinue = seated and state.phase ~= "drafting", settlement = state.settlement,
    winners = state.winners, lastMove = state.lastMove,
    counts = {bag = #state.bag, discard = #state.discard},
  }, events = {}}
end

function on_return_to_room(state, context)
  return true
end

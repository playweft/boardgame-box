local MODULUS = 2147483647
local MULTIPLIER = 48271
local QUEST_SIZES = {
  [5] = {2, 3, 2, 3, 3},
  [6] = {2, 3, 4, 3, 4},
  [7] = {2, 3, 3, 4, 4},
  [8] = {3, 4, 4, 5, 5},
  [9] = {3, 4, 4, 5, 5},
  [10] = {3, 4, 4, 5, 5},
}
local GOOD_COUNTS = {[5] = 3, [6] = 4, [7] = 4, [8] = 5, [9] = 6, [10] = 6}
local EVIL_COUNTS = {[5] = 2, [6] = 2, [7] = 3, [8] = 3, [9] = 3, [10] = 4}
local ROLE_INFO = {
  merlin = {name = "梅林", team = "good"},
  percival = {name = "派西维尔", team = "good"},
  servant = {name = "忠臣", team = "good"},
  assassin = {name = "刺客", team = "evil"},
  morgana = {name = "莫甘娜", team = "evil"},
  mordred = {name = "莫德雷德", team = "evil"},
  oberon = {name = "奥伯伦", team = "evil"},
}

local function reject(code, message)
  return {accepted = false, error = {code = code, message = message}}
end

local function player_index(state, player_id)
  for index, player in ipairs(state.players) do
    if player.id == player_id then return index end
  end
  return nil
end

local function next_random(seed)
  return (seed * MULTIPLIER) % MODULUS
end

local function normalize_seed(value)
  local seed = 0
  local text = tostring(value or "")
  for index = 1, #text do
    local digit = tonumber(string.sub(text, index, index), 16)
    if digit then seed = (seed * 16 + digit) % MODULUS end
  end
  if seed == 0 then return 1 end
  return seed
end

local function role_deck(player_count)
  local deck = {"merlin"}
  if player_count >= 6 then table.insert(deck, "percival") end
  while #deck < GOOD_COUNTS[player_count] do table.insert(deck, "servant") end
  table.insert(deck, "assassin")
  table.insert(deck, "morgana")
  if player_count >= 7 then table.insert(deck, "mordred") end
  if player_count == 10 then table.insert(deck, "oberon") end
  return deck
end

local function assign_roles(player_count, seed)
  local deck = role_deck(player_count)
  for index = #deck, 2, -1 do
    seed = next_random(seed)
    local swap = (seed % index) + 1
    deck[index], deck[swap] = deck[swap], deck[index]
  end
  return deck, seed
end

local function count_entries(values)
  local count = 0
  for _ in pairs(values) do count = count + 1 end
  return count
end

local function count_result(missions, passed)
  local count = 0
  for _, mission in ipairs(missions) do
    if mission.passed == passed then count = count + 1 end
  end
  return count
end

local function next_leader(state)
  return (state.leader % #state.players) + 1
end

local function role_hints(state, viewer_id)
  local role_id = state.roles[viewer_id]
  local hints = {}
  for _, player in ipairs(state.players) do
    local other_role = state.roles[player.id]
    if player.id ~= viewer_id then
      if role_id == "merlin" and ROLE_INFO[other_role].team == "evil" and other_role ~= "mordred" and other_role ~= "oberon" then
        table.insert(hints, player.id)
      elseif role_id == "percival" and (other_role == "merlin" or other_role == "morgana") then
        table.insert(hints, player.id)
      elseif ROLE_INFO[role_id].team == "evil" and role_id ~= "oberon" and ROLE_INFO[other_role].team == "evil" and other_role ~= "oberon" then
        table.insert(hints, player.id)
      end
    end
  end
  return hints
end

local function final_role_list(state)
  local result = {}
  for _, player in ipairs(state.players) do
    local role_id = state.roles[player.id]
    table.insert(result, {
      playerId = player.id,
      roleId = role_id,
      roleName = ROLE_INFO[role_id].name,
      team = ROLE_INFO[role_id].team,
    })
  end
  return result
end

local function deal_roles(state, seed)
  local deck, next_seed_value = assign_roles(#state.players, seed)
  local dealt = {}
  for index, player in ipairs(state.players) do
    dealt[player.id] = deck[index]
  end
  state.roles = dealt
  state.seed = next_seed_value
end

function setup(context)
  local players = {}
  for _, player in ipairs(context.players) do
    table.insert(players, {id = player.id, name = player.name, seat = player.seat})
  end
  local seed = normalize_seed(context.match.randomSeed)
  local state = {
    players = players,
    seed = seed,
    round = 1,
    quest = 1,
    phase = "propose",
    leader = (seed % #players) + 1,
    consecutiveRejections = 0,
    selectedTeam = {},
    votes = {},
    proposalHistory = {},
    missionActions = {},
    missions = {},
  }
  deal_roles(state, seed)
  return {state = state, events = {}}
end

function on_action(state, action, context)
  if type(action) ~= "table" or type(action.type) ~= "string" then
    return reject("INVALID_ACTION", "Choose a valid game action")
  end
  local actor_id = context.actor.id
  local actor_index = player_index(state, actor_id)
  if not actor_index then return reject("NOT_A_PLAYER", "Only seated players may act") end

  if action.type == "propose" then
    if state.phase ~= "propose" then return reject("WRONG_PHASE", "A team cannot be proposed now") end
    if actor_index ~= state.leader then return reject("NOT_LEADER", "Only the current leader may propose a team") end
    if type(action.players) ~= "table" or #action.players ~= QUEST_SIZES[#state.players][state.quest] then
      return reject("INVALID_TEAM_SIZE", "Choose the required number of players")
    end
    local selected, team = {}, {}
    for _, player_id in ipairs(action.players) do
      if type(player_id) ~= "string" or not player_index(state, player_id) or selected[player_id] then
        return reject("INVALID_TEAM", "The team must contain unique seated players")
      end
      selected[player_id] = true
      table.insert(team, player_id)
    end
    state.selectedTeam = team
    state.votes = {}
    state.phase = "vote"
    return {accepted = true, state = state, events = {{type = "team_proposed", leader = actor_id}}}
  end

  if action.type == "vote" then
    if state.phase ~= "vote" then return reject("WRONG_PHASE", "There is no team to vote on") end
    if type(action.approve) ~= "boolean" then return reject("INVALID_VOTE", "Choose approve or reject") end
    if state.votes[actor_id] ~= nil then return reject("ALREADY_VOTED", "Your vote is already locked") end
    state.votes[actor_id] = action.approve
    if count_entries(state.votes) == #state.players then
      local approvals = 0
      for _, approve in pairs(state.votes) do
        if approve then approvals = approvals + 1 end
      end
      state.votePassed = approvals > #state.players / 2
      state.proposalHistory = state.proposalHistory or {}
      local proposal_team, proposal_votes = {}, {}
      for _, player_id in ipairs(state.selectedTeam) do
        table.insert(proposal_team, player_id)
      end
      for player_id, approve in pairs(state.votes) do
        proposal_votes[player_id] = approve
      end
      table.insert(state.proposalHistory, {
        quest = state.quest,
        team = proposal_team,
        votes = proposal_votes,
        approved = state.votePassed,
      })
      if state.votePassed then
        state.consecutiveRejections = 0
      else
        state.consecutiveRejections = state.consecutiveRejections + 1
        state.leader = next_leader(state)
      end
      if not state.votePassed and state.consecutiveRejections >= 5 then
        state.phase = "game-over"
        state.winner = "evil"
        state.endReason = "连续五支队伍未获通过，邪恶势力趁乱得胜。"
      else
        state.phase = "vote-result"
      end
      return {accepted = true, state = state, events = {{type = "vote_resolved", approved = state.votePassed}}}
    end
    return {accepted = true, state = state, events = {}}
  end

  if action.type == "begin_mission" then
    if state.phase ~= "vote-result" or not state.votePassed then return reject("WRONG_PHASE", "The mission team has not been approved") end
    state.phase = "mission"
    state.votes = {}
    state.missionActions = {}
    return {accepted = true, state = state, events = {{type = "mission_started", quest = state.quest}}}
  end

  if action.type == "next_proposal" then
    if state.phase ~= "vote-result" or state.votePassed then return reject("WRONG_PHASE", "The rejected vote has already ended") end
    state.phase = "propose"
    state.selectedTeam = {}
    state.votes = {}
    return {accepted = true, state = state, events = {{type = "new_leader", leader = state.players[state.leader].id}}}
  end

  if action.type == "mission_choice" then
    if state.phase ~= "mission" then return reject("WRONG_PHASE", "There is no active mission") end
    local on_team = false
    for _, player_id in ipairs(state.selectedTeam) do
      if player_id == actor_id then on_team = true end
    end
    if not on_team then return reject("NOT_ON_TEAM", "Only mission team members may choose") end
    if action.choice ~= "success" and action.choice ~= "fail" then return reject("INVALID_CHOICE", "Choose mission success or fail") end
    if action.choice == "fail" and ROLE_INFO[state.roles[actor_id]].team ~= "evil" then
      return reject("LOYAL_CANNOT_FAIL", "Loyal players must choose mission success")
    end
    if state.missionActions[actor_id] ~= nil then return reject("ALREADY_CHOSEN", "Your mission card is already locked") end
    state.missionActions[actor_id] = action.choice
    if count_entries(state.missionActions) == #state.selectedTeam then
      local failures = 0
      for _, choice in pairs(state.missionActions) do
        if choice == "fail" then failures = failures + 1 end
      end
      local threshold = #state.players >= 7 and state.quest == 4 and 2 or 1
      state.lastMission = {
        number = state.quest,
        team = state.selectedTeam,
        failures = failures,
        threshold = threshold,
        passed = failures < threshold,
      }
      table.insert(state.missions, state.lastMission)
      state.phase = "mission-result"
      return {accepted = true, state = state, events = {{type = "mission_resolved", quest = state.quest, passed = state.lastMission.passed}}}
    end
    return {accepted = true, state = state, events = {}}
  end

  if action.type == "continue_mission" then
    if state.phase ~= "mission-result" then return reject("WRONG_PHASE", "The current mission is not complete") end
    if count_result(state.missions, true) >= 3 then
      state.phase = "assassinate"
    elseif count_result(state.missions, false) >= 3 then
      state.phase = "game-over"
      state.winner = "evil"
      state.endReason = "邪恶势力破坏了三个任务。"
    else
      state.quest = state.quest + 1
      state.leader = next_leader(state)
      state.selectedTeam = {}
      state.missionActions = {}
      state.phase = "propose"
    end
    return {accepted = true, state = state, events = {{type = "mission_continued", phase = state.phase}}}
  end

  if action.type == "assassinate" then
    if state.phase ~= "assassinate" or state.roles[actor_id] ~= "assassin" then
      return reject("NOT_ASSASSIN", "Only the assassin may choose a target now")
    end
    if type(action.target) ~= "string" or not player_index(state, action.target) or action.target == actor_id then
      return reject("INVALID_TARGET", "Choose another seated player")
    end
    local hit_merlin = state.roles[action.target] == "merlin"
    state.phase = "game-over"
    state.winner = hit_merlin and "evil" or "good"
    state.endReason = hit_merlin and "刺客识破并刺中了梅林。" or "刺客猜错了身份，梅林保护了亚瑟王。"
    return {accepted = true, state = state, events = {{type = "assassination", target = action.target, hit = hit_merlin}}}
  end

  if action.type == "rematch" then
    if state.phase ~= "game-over" then return reject("WRONG_PHASE", "The current game is still active") end
    state.round = state.round + 1
    state.quest = 1
    state.phase = "propose"
    state.leader = next_leader(state)
    state.consecutiveRejections = 0
    state.selectedTeam = {}
    state.votes = {}
    state.proposalHistory = {}
    state.missionActions = {}
    state.missions = {}
    state.winner = nil
    state.endReason = nil
    deal_roles(state, state.seed)
    return {accepted = true, state = state, events = {{type = "rematch", round = state.round}}}
  end

  return reject("UNKNOWN_ACTION", "This game action is not supported")
end

function view(state, events, context)
  local viewer_id = context.viewer.id
  local role_id = state.roles[viewer_id]
  local votes = nil
  if state.phase == "vote-result" or state.phase == "game-over" then
    votes = state.votes
  end
  local visible = {
    phase = state.phase,
    players = state.players,
    round = state.round,
    quest = state.quest,
    leader = state.players[state.leader] and state.players[state.leader].id or nil,
    consecutiveRejections = state.consecutiveRejections,
    selectedTeam = state.selectedTeam,
    votePassed = state.votePassed,
    votes = votes,
    votesCast = count_entries(state.votes),
    ownVote = state.votes[viewer_id] ~= nil,
    missionActionsCast = count_entries(state.missionActions),
    ownMissionAction = state.missionActions[viewer_id] ~= nil,
    missionTeam = state.selectedTeam,
    missions = state.missions,
    proposalHistory = state.proposalHistory or {},
    lastMission = state.lastMission,
    ownRole = role_id and {id = role_id, name = ROLE_INFO[role_id].name, team = ROLE_INFO[role_id].team} or nil,
    roleHints = role_id and role_hints(state, viewer_id) or {},
    winner = state.winner,
    endReason = state.endReason,
  }
  if state.phase == "game-over" then visible.finalRoles = final_role_list(state) end
  return {state = visible, events = events}
end

function on_return_to_room(state, context)
  return true
end

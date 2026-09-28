import "./style.css";
import { h, render as renderPreact } from "preact";
import { createPlayweftClient } from "./playweft-client.js";
import AvalonApp from "./view.jsx";

const app = document.querySelector("#avalon-app");
const questSizes = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};
const goodCounts = { 5: 3, 6: 4, 7: 4, 8: 5, 9: 6, 10: 6 };
const evilCounts = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
const roles = {
  merlin: {
    name: "梅林",
    team: "good",
    icon: "sparkles",
    description: "你知道大多数邪恶势力的身份，但莫德雷德藏在阴影中。",
  },
  percival: {
    name: "派西维尔",
    team: "good",
    icon: "eye",
    description: "你会看到梅林与莫甘娜两位候选人，需要辨认真正的梅林。",
  },
  servant: {
    name: "忠臣",
    team: "good",
    icon: "shield",
    description: "你属于亚瑟的忠臣阵营。帮助好人完成三次任务。",
  },
  assassin: {
    name: "刺客",
    team: "evil",
    icon: "crosshair",
    description: "若好人完成三次任务，你有机会刺杀梅林。",
  },
  morgana: {
    name: "莫甘娜",
    team: "evil",
    icon: "moon",
    description: "你属于邪恶阵营，在派西维尔眼中会伪装成梅林候选人。",
  },
  mordred: {
    name: "莫德雷德",
    team: "evil",
    icon: "chess-rook",
    description: "你属于邪恶阵营，但梅林看不见你的身份。",
  },
  oberon: {
    name: "奥伯伦",
    team: "evil",
    icon: "wand-sparkles",
    description:
      "你属于邪恶阵营，但不认识其他邪恶玩家，其他邪恶玩家也看不见你。",
  },
};

let state = createState();
let roomContext = null;
let roomState = null;
let roomError = "";
let roomBusy = false;
let roomTeam = [];
let openQuestIndex = null;
const roomProfiles = new Map();
const roomProfileRequests = new Set();
const pendingProfileRefreshes = new Set();

function createState() {
  return {
    phase: "setup",
    playerCount: 5,
    setupNames: makeNames(5),
    players: [],
    revealIndex: 0,
    roleShown: false,
    leader: 0,
    quest: 0,
    selectedTeam: [],
    voteOrder: [],
    votes: [],
    voteIndex: 0,
    approved: false,
    rejections: 0,
    missionTeam: [],
    missionOrder: [],
    missionActions: [],
    missionIndex: 0,
    missions: [],
    proposalHistory: [],
    winner: null,
    endReason: "",
  };
}

function makeNames(count) {
  return Array.from({ length: count }, (_, index) => "玩家 " + (index + 1));
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function rolesFor(count) {
  const good = ["merlin"];
  if (count >= 6) good.push("percival");
  while (good.length < goodCounts[count]) good.push("servant");
  const evil = ["assassin"];
  if (count >= 5) evil.push("morgana");
  if (count >= 7) evil.push("mordred");
  if (count === 10) evil.push("oberon");
  return shuffle(good.concat(evil));
}

function playerName(index) {
  return state.players[index]?.name || "未知玩家";
}

function roleInfo(playerIndex) {
  const role = state.players[playerIndex].role;
  if (role === "merlin") {
    const known = state.players
      .map((player, index) => ({ player, index }))
      .filter(
        ({ player, index }) =>
          roles[player.role].team === "evil" &&
          player.role !== "mordred" &&
          player.role !== "oberon" &&
          index !== playerIndex,
      )
      .map(({ index }) => playerName(index));
    return known.length
      ? "你看见的邪恶势力：" + known.join("、") + "。"
      : "你没有看见其他邪恶玩家。";
  }
  if (role === "percival") {
    const candidates = state.players
      .map((player, index) => ({ player, index }))
      .filter(
        ({ player }) => player.role === "merlin" || player.role === "morgana",
      )
      .map(({ index }) => playerName(index));
    return "梅林候选人：" + candidates.join("、") + "。其中可能有莫甘娜。";
  }
  if (roles[role].team === "evil" && role !== "oberon") {
    const known = state.players
      .map((player, index) => ({ player, index }))
      .filter(
        ({ player, index }) =>
          roles[player.role].team === "evil" &&
          player.role !== "oberon" &&
          index !== playerIndex,
      )
      .map(({ index }) => playerName(index));
    return known.length
      ? "你认识的邪恶队友：" + known.join("、") + "。"
      : "没有其他邪恶玩家与你互认。";
  }
  if (role === "oberon")
    return "你不知道其他邪恶玩家是谁；他们也不知道你属于邪恶阵营。";
  return "你没有额外的身份线索。仔细观察讨论与投票。";
}

function roomPlayerName(id) {
  return (
    roomProfiles.get(id)?.name ||
    roomState?.players.find((player) => player.id === id)?.name ||
    "玩家"
  );
}

function roomAvatarSource(id) {
  return roomProfiles.get(id)?.avatarSource || "";
}

function storeRoomProfile(id, profile) {
  roomProfiles.set(id, {
    name:
      typeof profile?.name === "string" && profile.name.trim()
        ? profile.name.trim()
        : null,
    avatarSource:
      typeof profile?.avatar?.src === "string" && profile.avatar.src
        ? profile.avatar.src
        : null,
  });
  render();
}

function requestRoomProfile(id, force = false) {
  if (roomProfileRequests.has(id)) {
    if (force) pendingProfileRefreshes.add(id);
    return;
  }
  if (!force && roomProfiles.has(id)) return;

  roomProfileRequests.add(id);
  void roomClient
    .getRoomPlayerProfile({ playerId: id, fields: ["name", "avatar"] })
    .then((profile) => storeRoomProfile(id, profile))
    .catch(() => storeRoomProfile(id, {}))
    .finally(() => {
      roomProfileRequests.delete(id);
      if (!pendingProfileRefreshes.delete(id)) return;
      roomProfiles.delete(id);
      requestRoomProfile(id, true);
    });
}

function requestRoomProfiles() {
  if (
    roomContext?.mode !== "room" ||
    !roomContext.capabilities?.includes("room.players.getProfile")
  ) {
    return;
  }
  for (const player of roomState?.players || []) requestRoomProfile(player.id);
}

function handleRoomPlayerProfileChanged({ playerId, fields }) {
  if (
    roomContext?.mode !== "room" ||
    !roomState?.players.some((player) => player.id === playerId) ||
    !fields.some((field) => field === "name" || field === "avatar")
  ) {
    return;
  }
  roomProfiles.delete(playerId);
  requestRoomProfile(playerId, true);
}

function render() {
  renderPreact(
    h(AvalonApp, {
      state,
      roomContext,
      roomState,
      roomError,
      roomBusy,
      roomTeam,
      questSizes,
      goodCounts,
      evilCounts,
      roles,
      playerName,
      roleInfo,
      roomPlayerName,
      roomAvatarSource,
      openQuestIndex,
      onCloseQuestDetails: closeQuestDetails,
    }),
    app,
  );
}

function startGame() {
  const names = Array.from(
    app.querySelectorAll("[data-player-name]"),
    (input, index) => input.value.trim() || "玩家 " + (index + 1),
  );
  const assignedRoles = rolesFor(state.playerCount);
  state.players = names.map((name, index) => ({
    name,
    role: assignedRoles[index],
  }));
  state.phase = "reveal";
  state.revealIndex = 0;
  state.roleShown = false;
  render();
}

function resetToSetup() {
  const previousNames = state.players.map((player) => player.name);
  state = createState();
  state.playerCount =
    previousNames.length >= 5 && previousNames.length <= 10
      ? previousNames.length
      : 5;
  state.setupNames = previousNames.length
    ? previousNames
    : makeNames(state.playerCount);
  render();
}

function finishVote() {
  const approvals = state.votes.filter(Boolean).length;
  state.approved = approvals > state.players.length / 2;
  state.proposalHistory.push({
    quest: state.quest + 1,
    team: state.missionTeam.slice(),
    votes: state.votes.slice(),
    approved: state.approved,
  });
  if (state.approved) state.rejections = 0;
  else {
    state.rejections += 1;
    state.leader = (state.leader + 1) % state.players.length;
  }
  state.phase = "vote-result";
  render();
}

function closeQuestDetails() {
  openQuestIndex = null;
  render();
}

function finishMission() {
  const failures = state.missionActions.filter(
    (action) => action === "fail",
  ).length;
  const threshold = state.players.length >= 7 && state.quest === 3 ? 2 : 1;
  state.missions.push({
    number: state.quest + 1,
    team: state.missionTeam.slice(),
    failures,
    threshold,
    passed: failures < threshold,
  });
  state.phase = "mission-result";
  render();
}

app.addEventListener("change", (event) => {
  if (event.target.id !== "player-count") return;
  const nextCount = Number(event.target.value);
  const previous = state.setupNames;
  state.playerCount = nextCount;
  state.setupNames = Array.from(
    { length: nextCount },
    (_, index) => previous[index] || "玩家 " + (index + 1),
  );
  render();
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (action === "open-quest-details") {
    openQuestIndex = index;
    render();
    return;
  }
  if (action === "close-quest-details") {
    closeQuestDetails();
    return;
  }

  if (action === "start-game") startGame();
  if (action === "show-role") {
    state.roleShown = true;
    render();
  }
  if (action === "hide-and-next") {
    state.revealIndex += 1;
    state.roleShown = false;
    if (state.revealIndex >= state.players.length) {
      state.phase = "propose";
      state.leader = Math.floor(Math.random() * state.players.length);
    }
    render();
  }
  if (action === "toggle-team") {
    const required = questSizes[state.players.length][state.quest];
    if (state.selectedTeam.includes(index))
      state.selectedTeam = state.selectedTeam.filter(
        (player) => player !== index,
      );
    else if (state.selectedTeam.length < required)
      state.selectedTeam.push(index);
    render();
  }
  if (action === "submit-team") {
    if (
      state.selectedTeam.length !==
      questSizes[state.players.length][state.quest]
    )
      return;
    state.missionTeam = state.selectedTeam.slice().sort((a, b) => a - b);
    state.votes = Array(state.players.length).fill(null);
    state.voteOrder = state.players.map((_, playerIndex) => playerIndex);
    state.voteIndex = 0;
    state.phase = "vote";
    render();
  }
  if (action === "cast-vote") {
    state.votes[state.voteOrder[state.voteIndex]] =
      button.dataset.value === "yes";
    state.voteIndex += 1;
    if (state.voteIndex >= state.voteOrder.length) finishVote();
    else render();
  }
  if (action === "continue-vote") {
    if (state.approved) {
      state.missionOrder = state.missionTeam.slice();
      state.missionActions = Array(state.players.length).fill(null);
      state.missionIndex = 0;
      state.phase = "mission";
    } else if (state.rejections >= 5) {
      state.winner = "evil";
      state.endReason = "连续五支队伍未获通过，邪恶势力趁乱得胜。";
      state.phase = "over";
    } else {
      state.selectedTeam = [];
      state.phase = "propose";
    }
    render();
  }
  if (action === "cast-mission") {
    const playerIndex = state.missionOrder[state.missionIndex];
    state.missionActions[playerIndex] = button.dataset.value;
    state.missionIndex += 1;
    if (state.missionIndex >= state.missionOrder.length) finishMission();
    else render();
  }
  if (action === "continue-mission") {
    const successes = state.missions.filter((mission) => mission.passed).length;
    const failures = state.missions.length - successes;
    if (successes >= 3) state.phase = "assassinate";
    else if (failures >= 3) {
      state.winner = "evil";
      state.endReason = "邪恶势力破坏了三个任务。";
      state.phase = "over";
    } else {
      state.quest = state.missions.length;
      state.leader = (state.leader + 1) % state.players.length;
      state.rejections = 0;
      state.selectedTeam = [];
      state.phase = "propose";
    }
    render();
  }
  if (action === "choose-assassin") {
    const hitMerlin = state.players[index].role === "merlin";
    state.winner = hitMerlin ? "evil" : "good";
    state.endReason = hitMerlin
      ? "刺客识破并刺中了梅林。"
      : "刺客猜错了身份，梅林保护了亚瑟王。";
    state.phase = "over";
    render();
  }
  if (action === "restart") resetToSetup();
});

let roomStageKey = "";
let roomClient;

async function sendRoomAction(action) {
  if (!roomClient?.connected || roomBusy) return;
  roomBusy = true;
  roomError = "";
  render();
  try {
    const result = await roomClient.action(action);
    if (!result.accepted)
      throw new Error(result.error?.message || "平台没有接受这个操作。");
  } catch (error) {
    roomError = error instanceof Error ? error.message : "Playweft 操作失败。";
  } finally {
    roomBusy = false;
    render();
  }
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-room-action]");
  if (!button || roomBusy || roomContext?.mode !== "room") return;
  const action = button.dataset.roomAction;
  const playerId = button.dataset.playerId;

  if (action === "toggle-team") {
    const required = questSizes[roomState.players.length][roomState.quest - 1];
    if (roomTeam.includes(playerId))
      roomTeam = roomTeam.filter((id) => id !== playerId);
    else if (roomTeam.length < required) roomTeam = roomTeam.concat(playerId);
    render();
    return;
  }
  if (action === "propose")
    return void sendRoomAction({ type: "propose", players: roomTeam.slice() });
  if (action === "vote")
    return void sendRoomAction({
      type: "vote",
      approve: button.dataset.value === "yes",
    });
  if (action === "begin-mission")
    return void sendRoomAction({ type: "begin_mission" });
  if (action === "next-proposal")
    return void sendRoomAction({ type: "next_proposal" });
  if (action === "mission-choice")
    return void sendRoomAction({
      type: "mission_choice",
      choice: button.dataset.value,
    });
  if (action === "continue-mission")
    return void sendRoomAction({ type: "continue_mission" });
  if (action === "assassinate")
    return void sendRoomAction({ type: "assassinate", target: playerId });
  if (action === "rematch") return void sendRoomAction({ type: "rematch" });
});

roomClient = createPlayweftClient({
  onInitialize(context) {
    roomContext = context;
    if (context.mode !== "room")
      roomError = "阿瓦隆目前仅开放 Playweft 房间模式。";
    requestRoomProfiles();
    render();
  },
  onState(nextState) {
    const nextStageKey =
      nextState.phase + "|" + nextState.quest + "|" + nextState.leader;
    if (nextStageKey !== roomStageKey) roomTeam = [];
    roomStageKey = nextStageKey;
    roomState = nextState;
    requestRoomProfiles();
    render();
  },
  onError(message) {
    roomError = message;
    render();
  },
  onPlayerProfileChanged: handleRoomPlayerProfileChanged,
});

render();

import "../../shared/game-theme.css";
import "../../shared/game-chrome.css";
import "./style.css";
import { h, render } from "preact";
import { createPlayweftClient } from "../../shared/playweft-client.js";
import { applyAction, createGame, projectGame } from "./engine.js";
import SplendorApp from "./view.jsx";

const root = document.querySelector("#splendor-app");
const embedded = window.parent !== window;
const storageKey = "boardgame-box:splendor:v1";
const launchUrl = new URL("https://play.longern.com/");
launchUrl.searchParams.set("game", new URL("./playweft.json", window.location.href).href);
const roomOptions = {
  minPlayers: 2,
  maxPlayers: 4,
  lobby: "platform",
  server: { runtime: "lua", entry: "./game.lua", persistence: "durable" },
};
let hostMode = embedded ? null : "solo", canCreateRoom = false;
let localGame = null, roomState = null, roomPresence = null, busy = false, error = "";
let localViewerId = null, humanId = null, localMode = null, handoff = false;
let paused = false;
let botWorker = null, botJob = null;
let savedGame = embedded ? null : readSave();

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.schema === 1 && saved.state?.players?.length >= 2 && saved.state?.players?.length <= 4) {
      const { state } = saved;
      projectGame(state, state.players[state.turn].id);
      const playerId = state.players.some(player => player.id === saved.humanId) ? saved.humanId : null;
      // Older computer games used search by default.
      const mode = playerId ? (saved.mode === "normal" ? "normal" : "hard") : "local";
      return { schema: 1, state, humanId: playerId, mode };
    }
  } catch { /* A blocked storage area or an obsolete save must not prevent playing. */ }
  return null;
}

function save() {
  savedGame = localGame ? { schema: 1, state: localGame, humanId, mode: localMode } : null;
  try {
    if (savedGame) localStorage.setItem(storageKey, JSON.stringify(savedGame));
    else localStorage.removeItem(storageKey);
  } catch { /* Local play remains available without persistence. */ }
}

function startLocal({ state, mode, humanId: playerId }) {
  localGame = state;
  localMode = mode;
  humanId = playerId;
  localViewerId = humanId ?? state.players[state.turn].id;
  handoff = !humanId && state.phase !== "ended";
  paused = false;
  error = "";
  save();
  redraw();
  queueComputer();
}

function normalizeView(state) {
  if (!state) return null;
  const list = value => Array.isArray(value) ? value : [];
  for (const key of ["players", "nobles", "counts", "winners", "eligibleNobleIds", "history"]) state[key] = list(state[key]);
  state.market = list(state.market).map(list);
  state.endingRound ??= null;
  for (const board of Object.values(state.boards || {}))
    for (const key of ["reserved", "purchased", "nobles"]) board[key] = list(board[key]);
  return state;
}

function returnToOpening({ discard = false } = {}) {
  stopComputer();
  if (!discard) save();
  localGame = null; localViewerId = null; humanId = null; localMode = null;
  handoff = false; paused = false; error = "";
  if (discard) save();
  redraw();
}

function redraw() {
  const room = hostMode === "room";
  const game = room ? roomState : localGame && projectGame(localGame, localViewerId);
  render(h(SplendorApp, {
    room, standalone: !embedded, connecting: hostMode === null, waitingForRoom: roomPresence?.phase === "lobby",
    game, busy, error, paused,
    handoff: !room && handoff, computerGame: !room && !!humanId, launchUrl: embedded ? null : launchUrl.href,
    savedMode: savedGame?.mode, onCreateRoom: canCreateRoom ? createOnlineRoom : null,
    onStart(names, mode) {
      const state = createGame(names.map((name, index) => ({ id: `local-${index}`, name: name.trim() || `玩家 ${index + 1}` })));
      startLocal({ state, mode, humanId: mode === "local" ? null : state.players[0].id });
    },
    onResume() { if (savedGame) startLocal(savedGame); },
    onReady() { handoff = false; redraw(); },
    onPauseChange: setPaused,
    onBack() { returnToOpening(); },
    onExit() { returnToOpening({ discard: true }); },
    onRetryComputer() { error = ""; queueComputer(); redraw(); },
    onAction: submitAction,
  }), root);
}

async function createOnlineRoom() {
  if (busy || !canCreateRoom) return;
  busy = true; error = ""; redraw();
  try {
    const presence = await roomClient.createRoom(roomOptions);
    if (hostMode === "solo") enterRoom(presence);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "无法打开联机房间";
  } finally {
    busy = false; redraw();
  }
}

function enterRoom(presence) {
  if (presence.roomId !== roomPresence?.roomId || presence.phase !== "playing") roomState = null;
  roomPresence = presence;
  hostMode = "room";
  error = "";
  redraw();
}

function stopComputer() {
  clearTimeout(botJob?.timer);
  botJob = null;
  botWorker?.terminate();
  botWorker = null;
}

function setPaused(value) {
  if (!localGame || hostMode === "room" || paused === value) return;
  paused = value;
  if (paused) stopComputer();
  else if (!error) queueComputer();
  redraw();
}

function applyLocalAction(actorId, action) {
  const result = applyAction(localGame, actorId, { ...action, round: localGame.round, step: localGame.step });
  if (!result.accepted) return result.error.message;
  localGame = result.state;
  // Local humans hand off between seats. In a computer game the view stays on the human.
  if (!humanId && localGame.phase !== "ended") {
    const nextId = localGame.players[localGame.turn].id;
    handoff = actorId !== nextId || action.type === "rematch";
    localViewerId = nextId;
  }
  save();
  return "";
}

function queueComputer(delay = 225) {
  if (!localGame || !humanId || paused || botJob || localGame.phase === "ended") return;
  const actorId = localGame.players[localGame.turn].id;
  if (actorId === humanId) return;
  const job = { view: projectGame(localGame, actorId), mode: localMode };
  botJob = job;
  const finish = action => {
    if (botJob !== job) return;
    botJob = null;
    error = action ? applyLocalAction(actorId, action) : "AI 暂时无法出手";
    if (!error) queueComputer(localGame.players[localGame.turn].id === actorId ? 0 : undefined);
    redraw();
  };
  const fallback = async () => {
    if (botJob !== job) return;
    botWorker?.terminate();
    botWorker = null;
    try {
      const { chooseBotAction } = await import("./bot.js");
      if (botJob === job) finish(chooseBotAction(job.view, job.mode));
    } catch {
      finish(null);
    }
  };
  job.timer = setTimeout(() => {
    try {
      botWorker ??= new Worker(new URL("./bot-worker.js", import.meta.url), { type: "module" });
      botWorker.onmessage = ({ data }) => data.error ? fallback() : finish(data.action);
      botWorker.onerror = fallback;
      botWorker.postMessage({ view: job.view, mode: job.mode });
    } catch {
      fallback();
    }
  }, delay);
}

async function submitAction(intent) {
  const room = hostMode === "room";
  const game = room ? roomState : localGame;
  if (!game || busy || (room ? !roomClient?.connected : handoff || paused)) return;
  if (!room) {
    const isHumanTurn = !humanId || localGame.players[localGame.turn].id === humanId;
    if (!isHumanTurn && intent.type !== "rematch") return;
    error = applyLocalAction(localViewerId, intent);
    if (!error) queueComputer();
    redraw(); return;
  }
  const action = { ...intent, round: game.round, step: game.step };
  error = "";
  busy = true; redraw();
  try {
    const result = await roomClient.action(action);
    if (result?.accepted === false) error = result.error?.message || "操作未成功";
  } catch (cause) { error = cause instanceof Error ? cause.message : "操作未成功"; }
  finally { busy = false; redraw(); }
}

const roomClient = embedded ? createPlayweftClient({
  onInitialize(context) {
    if (context.mode === "solo" || context.mode === "room") {
      hostMode = context.mode;
      canCreateRoom = context.capabilities?.includes("rooms.create") ?? false;
      if (hostMode === "solo") savedGame = readSave();
      else roomPresence = context.room ?? null;
    } else error = "无法识别 Playweft 游戏模式";
    redraw();
  },
  onState(state) {
    if (hostMode === "solo") return;
    roomState = normalizeView(state); error = ""; redraw();
  },
  onRoomState: enterRoom,
  onRoomClosed() {
    hostMode = "solo";
    roomPresence = null; roomState = null; error = ""; redraw();
  },
  onError(message) { error = message; redraw(); },
}) : null;
redraw();

import "../../shared/game-theme.css";
import "../../shared/game-chrome.css";
import "./style.css";
import { h, render } from "preact";
import { createPlayweftClient } from "../../shared/playweft-client.js";
import { chooseRuleAction } from "./bot-policy.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "./data.js";
import {
  actingPlayer,
  applyAction,
  createGame,
  projectBotGame,
  projectGame,
} from "./engine.js";
import { errorMessage, t } from "./i18n.js";
import { normalizeRoomView } from "./room-state.js";
import { computerDelay, describeTurn } from "./turn-feedback.js";
import LifeboatApp from "./view.jsx";

const root = document.querySelector("#lifeboat-app");
const embedded = window.parent !== window;
const launchUrl = new URL("https://play.longern.com/");
launchUrl.searchParams.set(
  "game",
  new URL("./playweft.json", window.location.href).href,
);

const roomOptions = {
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  lobby: "platform",
  server: { runtime: "lua", entry: "./game.lua", persistence: "durable" },
};

let mode = embedded ? null : "solo";
let canCreateRoom = false;
let presence = null;
let roomGame = null;
let localGame = null;
let humanId = null;
let paused = false;
let holdingComputer = false;
let botWorker = null;
let botJob = null;
let turnHistory = [];
let tradeViewerId = null;
let handoff = false;
let busy = false;
let error = "";

function redraw() {
  const room = mode === "room";
  const viewer =
    localGame && (humanId ?? tradeViewerId ?? actingPlayer(localGame));
  const game = room ? roomGame : localGame && projectGame(localGame, viewer);
  render(
    h(LifeboatApp, {
      game,
      room,
      computer: !room && !!humanId,
      turnHistory,
      standalone: !embedded,
      handoff,
      trading: !room && tradeViewerId !== null,
      busy,
      error,
      connecting: mode === null,
      waiting: presence?.phase === "lobby",
      launchUrl: embedded ? null : launchUrl.href,
      onCreateRoom: canCreateRoom ? openRoom : null,
      onStart(names, cast, computer) {
        const players = names.map((name, index) => ({
          id: `local-${index}`,
          name,
        }));
        try {
          localGame = createGame(players, undefined, { cast });
        } catch (cause) {
          error = errorMessage(cause);
          redraw();
          return;
        }
        stopComputer();
        humanId = computer ? "local-0" : null;
        turnHistory = [];
        tradeViewerId = null;
        handoff = !computer;
        paused = false;
        holdingComputer = false;
        error = "";
        redraw();
        queueComputer();
      },
      onReady() {
        handoff = false;
        redraw();
      },
      onTrade: switchToTrader,
      onEndTrade: returnToTurn,
      onPauseChange(value) {
        paused = value;
        if (paused) stopComputer();
        else queueComputer();
      },
      onComputerHold(value) {
        holdingComputer = value;
        if (holdingComputer) stopComputer();
        else queueComputer();
      },
      onExit() {
        stopComputer();
        localGame = null;
        turnHistory = [];
        humanId = null;
        tradeViewerId = null;
        handoff = false;
        paused = false;
        holdingComputer = false;
        error = "";
        redraw();
      },
      onAction: submit,
    }),
    root,
  );
}

function stopComputer() {
  clearTimeout(botJob?.timer);
  clearTimeout(botJob?.watchdog);
  botJob = null;
  botWorker?.terminate();
  botWorker = null;
}

function acceptLocalGame(next, action) {
  let feedback;
  if (humanId) {
    if (action.type === "rematch") turnHistory = [];
    else {
      feedback = describeTurn(projectGame(localGame, humanId), projectGame(next, humanId), action);
      if (feedback) turnHistory = [feedback, ...turnHistory].slice(0, 8);
    }
  }
  localGame = next;
  return feedback?.hold ?? 0;
}

function queueComputer(previousHold = 0) {
  if (
    !humanId ||
    !localGame ||
    localGame.phase === "ended" ||
    mode !== "solo" ||
    paused ||
    holdingComputer ||
    botJob
  )
    return;
  const actor = actingPlayer(localGame);
  if (actor === humanId) return;

  const step = localGame.step;
  const view = projectBotGame(localGame, actor);
  const startedAt = performance.now();
  const job = {};
  botJob = job;
  const finish = (action) => {
    if (botJob !== job || job.timer !== undefined) return;
    clearTimeout(job.watchdog);
    const planned = action ?? chooseRuleAction(view);
    // Search runs while the preceding result is visible. Use a single delay.
    const readyAt = startedAt + Math.max(previousHold, computerDelay(planned));
    job.timer = setTimeout(
      () => {
        if (botJob !== job) return;
        botJob = null;
        let intent = planned;
        let result = intent && applyAction(localGame, actor, { ...intent, step });
        if (!result?.accepted && action) {
          intent = chooseRuleAction(view);
          result = intent && applyAction(localGame, actor, { ...intent, step });
        }
        const hold = result?.accepted ? acceptLocalGame(result.state, intent) : 0;
        if (!result?.accepted) error = "电脑未能完成行动。";
        redraw();
        if (result?.accepted) queueComputer(hold);
      },
      Math.max(0, readyAt - performance.now()),
    );
  };
  const fallback = () => {
    if (botJob !== job || job.timer !== undefined) return;
    botWorker?.terminate();
    botWorker = null;
    finish(null);
  };
  try {
    botWorker ??= new Worker(new URL("./bot-worker.js", import.meta.url), {
      type: "module",
    });
    botWorker.onmessage = ({ data }) => {
      if (data.step === step) {
        if (data.error) fallback();
        else finish(data.action);
      }
    };
    botWorker.onerror = fallback;
    job.watchdog = setTimeout(fallback, 1500);
    botWorker.postMessage({ step, view });
  } catch {
    fallback();
  }
}

function switchToTrader(playerId) {
  if (
    !localGame ||
    mode !== "solo" ||
    humanId ||
    handoff ||
    tradeViewerId !== null
  )
    return;
  const view = projectGame(localGame, playerId);
  const player = view.characters.find(entry => entry.player === playerId);
  if (!view.canTrade && !(player?.conscious && player.hand.length)) return;
  tradeViewerId = playerId;
  handoff = playerId !== actingPlayer(localGame);
  error = "";
  redraw();
}

function returnToTurn() {
  if (!localGame || tradeViewerId === null) return;
  handoff = tradeViewerId !== actingPlayer(localGame);
  tradeViewerId = null;
  error = "";
  redraw();
}

function enterRoom(next) {
  stopComputer();
  if ((presence && presence.roomId !== next.roomId) || next.phase !== "playing")
    roomGame = null;
  presence = next;
  mode = "room";
  error = "";
  redraw();
}

async function roomRequest(request, fallback) {
  busy = true;
  error = "";
  redraw();
  try {
    await request();
  } catch (cause) {
    error = errorMessage(cause, fallback);
  } finally {
    busy = false;
    redraw();
  }
}

function openRoom() {
  if (busy || mode !== "solo" || !canCreateRoom) return;
  return roomRequest(async () => {
    const next = await client.createRoom(roomOptions);
    if (mode === "solo") enterRoom(next);
  }, t("errors.createRoomFailed"));
}

function submit(intent) {
  const room = mode === "room";
  const game = room ? roomGame : localGame;
  if (!game || busy || (room ? !client.connected : handoff || paused)) return;
  const action = { ...intent, step: game.step };
  if (room)
    return roomRequest(async () => {
      const result = await client.action(action);
      if (result?.accepted === false)
        throw new Error(errorMessage(result.error));
    }, t("errors.actionFailed"));

  const previous = actingPlayer(localGame);
  const offTurn = intent.type === "give" || intent.type === "reveal";
  if ((tradeViewerId !== null || (humanId && previous !== humanId)) && !offTurn) return;
  const result = applyAction(
    localGame,
    humanId ?? tradeViewerId ?? previous,
    action,
  );
  if (humanId) {
    stopComputer();
    holdingComputer = false;
  }
  error = result.accepted ? "" : errorMessage(result.error);
  let hold = 0;
  if (result.accepted) {
    hold = acceptLocalGame(result.state, intent);
    if (!humanId && tradeViewerId === null) {
      handoff =
        localGame.phase !== "ended" &&
        (actingPlayer(localGame) !== previous || intent.type === "rematch");
    }
  }
  redraw();
  queueComputer(hold);
}

const client = embedded
  ? createPlayweftClient({
      onInitialize(context) {
        canCreateRoom = context.capabilities?.includes("rooms.create") ?? false;
        if (context.mode === "room") {
          if (context.room && !presence) enterRoom(context.room);
          mode = "room";
        } else if (context.mode === "solo" && !presence) mode = "solo";
        else if (context.mode !== "solo") error = t("errors.unknownPlayweftMode");
        redraw();
      },
      onRoomState: enterRoom,
      onRoomClosed() {
        mode = "solo";
        presence = null;
        roomGame = null;
        error = "";
        redraw();
        queueComputer();
      },
      onState(state) {
        if (mode === "solo" || !state) return;
        roomGame = normalizeRoomView(state);
        error = "";
        redraw();
      },
      onError(message) {
        error = message;
        redraw();
      },
    })
  : null;

redraw();

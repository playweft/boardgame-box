import "../../shared/game-theme.css";
import "./style.css";
import { h, render } from "preact";
import { createPlayweftClient } from "../../shared/playweft-client.js";
import { applyAction, createGame, projectGame } from "./engine.js";
import BombBustersApp from "./view.jsx";

const app = document.querySelector("#bomb-busters-app");
const embedded = window.parent !== window;
let playerCount = 3;
let playerNames = Array.from({ length: 5 }, (_, index) => "玩家 " + (index + 1));
let localGame = null;
let localReady = false;
let selectedSourceId = null;
let localError = "";
let roomReady = false;
let roomState = null;
let roomError = "";
let roomBusy = false;

function currentLocalId() {
  return localGame?.players[localGame.turn]?.id;
}

function getVisibleGame() {
  if (embedded) return roomState;
  if (!localGame) return null;
  return projectGame(localGame, currentLocalId());
}

function redraw() {
  const visibleGame = getVisibleGame();
  render(
    h(BombBustersApp, {
      count: playerCount,
      names: playerNames,
      game: visibleGame,
      room: embedded,
      roomError: embedded
        ? roomError || (!roomReady ? "正在连接房间…" : "")
        : "",
      busy: roomBusy,
      localReady,
      selectedSourceId,
      error: localError,
      onCount(value) {
        playerCount = value;
        redraw();
      },
      onName(index, value) {
        playerNames[index] = value;
      },
      onStart() {
        const players = playerNames.slice(0, playerCount).map((name, index) => ({
          id: "local-" + index,
          name: name.trim() || "玩家 " + (index + 1),
        }));
        localGame = createGame(players);
        localReady = false;
        selectedSourceId = null;
        localError = "";
        redraw();
      },
      onReveal() {
        localReady = true;
        redraw();
      },
      onSource(wireId, solo) {
        if (solo) {
          submitAction({ type: "solo_cut", wireId });
          return;
        }
        selectedSourceId = wireId;
        redraw();
      },
      onTarget(targetId) {
        if (!selectedSourceId) return;
        submitAction({
          type: "dual_cut",
          sourceId: selectedSourceId,
          targetId,
        });
      },
      onSolo(wireId) {
        submitAction({ type: "solo_cut", wireId });
      },
      onRevealRed() {
        submitAction({ type: "reveal_red" });
      },
      onRestart() {
        if (embedded) {
          submitRoomAction({ type: "rematch" });
          return;
        }
        localGame = null;
        localReady = false;
        selectedSourceId = null;
        redraw();
      },
    }),
    app,
  );
}

function submitAction(action) {
  if (embedded) {
    submitRoomAction(action);
    return;
  }
  const result = applyAction(localGame, currentLocalId(), action);
  if (!result.accepted) {
    localError = result.error;
    redraw();
    return;
  }
  selectedSourceId = null;
  localError = "";
  localReady = localGame.phase === "ended";
  redraw();
}

async function submitRoomAction(action) {
  if (!roomClient?.connected || roomBusy) return;
  roomBusy = true;
  roomError = "";
  redraw();
  try {
    await roomClient.action(action);
  } catch (error) {
    roomError = error instanceof Error ? error.message : "操作未成功";
  } finally {
    roomBusy = false;
    redraw();
  }
}

const roomClient = embedded
  ? createPlayweftClient({
      onInitialize(context) {
        roomReady = true;
        redraw();
      },
      onState(state) {
        roomState = state;
        selectedSourceId = null;
        roomError = "";
        redraw();
      },
      onError(message) {
        roomError = message;
        redraw();
      },
    })
  : null;

redraw();

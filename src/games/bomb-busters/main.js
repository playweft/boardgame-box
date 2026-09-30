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
let selectedInfoWireId = null;
let localError = "";
let roomReady = false;
let roomState = null;
let roomError = "";
let roomBusy = false;

function currentLocalId() {
  if (localGame?.phase === "setup_info") {
    return localGame.players.find(
      (player) => player.id === localGame.setupInfoOrder[localGame.setupInfoIndex],
    )?.id;
  }
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
      selectedInfoWireId,
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
        selectedInfoWireId = null;
        localError = "";
        redraw();
      },
      onReveal() {
        localReady = true;
        redraw();
      },
      onSource(wireId, solo) {
        if (selectedSourceId && selectedSourceId !== wireId) {
          const soloGroup = visibleGame?.soloCuts.find(
            (entry) => entry.ids.includes(selectedSourceId) && entry.ids.includes(wireId),
          );
          if (solo && soloGroup) {
            submitAction({ type: "solo_cut", wireId: selectedSourceId });
            return;
          }
        }
        selectedSourceId = selectedSourceId === wireId ? null : wireId;
        redraw();
      },
      onInfoSelect(wireId) {
        selectedInfoWireId = wireId;
        redraw();
      },
      onPlaceInfo() {
        if (!selectedInfoWireId) return;
        submitAction({ type: "place_info", wireId: selectedInfoWireId });
      },
      onTarget(targetId) {
        if (!selectedSourceId) return;
        submitAction({
          type: "dual_cut",
          sourceId: selectedSourceId,
          targetId,
        });
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
        selectedInfoWireId = null;
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
  selectedInfoWireId = null;
  localError = "";
  localReady = localGame.phase !== "setup_info";
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
        selectedInfoWireId = null;
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

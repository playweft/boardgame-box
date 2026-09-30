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
let detectorEnabled = false;
let selectedTargetIds = [];
let selectedInfoWireId = null;
let localError = "";
let notice = "";
let noticeTimer;
let roomReady = false;
let roomState = null;
let roomError = "";
let roomBusy = false;

function currentLocalId() {
  if (localGame?.pendingDetector) return localGame.pendingDetector.targetOwnerId;
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
  return projectGame(localGame, localReady ? currentLocalId() : null);
}

function showNotice(message) {
  clearTimeout(noticeTimer);
  notice = message;
  redraw();
  noticeTimer = setTimeout(() => { notice = ""; redraw(); }, 2200);
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
      notice,
      localReady,
      selectedSourceId,
      detectorEnabled,
      selectedTargetIds,
      onDetectorToggle() {
        detectorEnabled = !detectorEnabled;
        selectedTargetIds = [];
        redraw();
      },
      onDetectorConfirm() {
        if (!selectedSourceId) return showNotice("请先选择自己的导线");
        if (selectedTargetIds.length !== 2) return showNotice("请选择队友的两根导线");
        submitAction({ type: "double_detector", sourceId: selectedSourceId, targetIds: selectedTargetIds });
      },
      onDetectorChoice(wireId) {
        submitAction({ type: "resolve_detector", wireId });
      },
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
        const wire = visibleGame.racks[visibleGame.viewerId].flat().find((wire) => wire.id === wireId);
        if (wire.kind === "red") {
          if (visibleGame.canRevealRed) return submitAction({ type: "reveal_red" });
          return showNotice("仅剩红线时可公开");
        }
        if (!detectorEnabled && selectedSourceId && selectedSourceId !== wireId) {
          const soloGroup = visibleGame?.soloCuts.find(
            (entry) => entry.ids.includes(selectedSourceId) && entry.ids.includes(wireId),
          );
          if (solo && soloGroup) {
            submitAction({ type: "solo_cut", wireId: selectedSourceId });
            return;
          }
        }
        selectedSourceId = selectedSourceId === wireId ? null : wireId;
        selectedTargetIds = [];
        redraw();
      },
      onInfoSelect(wireId) {
        selectedInfoWireId = wireId;
        redraw();
      },
      onPlaceInfo() {
        if (!selectedInfoWireId) return showNotice("请先选择自己的蓝线");
        submitAction({ type: "place_info", wireId: selectedInfoWireId });
      },
      onTarget(targetId) {
        if (visibleGame.phase === "setup_info") return showNotice("请先选择自己的蓝线");
        if (!selectedSourceId) return showNotice("请先选择自己的导线");
        if (detectorEnabled) {
          const rack = Object.values(visibleGame.racks).flat().find((slots) => slots.some((wire) => wire.id === targetId));
          if (selectedTargetIds.includes(targetId)) selectedTargetIds = selectedTargetIds.filter((id) => id !== targetId);
          else if (!selectedTargetIds.every((id) => rack.some((wire) => wire.id === id))) return showNotice("请选择同一牌架上的导线");
          else if (selectedTargetIds.length === 2) return showNotice("最多选择两根导线");
          else selectedTargetIds = [...selectedTargetIds, targetId];
          redraw();
          return;
        }
        submitAction({
          type: "dual_cut",
          sourceId: selectedSourceId,
          targetId,
        });
      },
      onRestart() {
        submitAction({ type: "rematch" });
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
  const actorId = currentLocalId();
  const result = applyAction(localGame, actorId, action);
  if (!result.accepted) {
    localError = result.error;
    redraw();
    return;
  }
  clearTimeout(noticeTimer);
  notice = "";
  localGame = result.state;
  detectorEnabled = false;
  selectedTargetIds = [];
  selectedSourceId = null;
  selectedInfoWireId = null;
  localError = "";
  localReady = localGame.phase === "ended" ||
    (action.type !== "rematch" && currentLocalId() === actorId);
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
        clearTimeout(noticeTimer);
        notice = "";
        roomState = state;
        detectorEnabled = false;
        selectedTargetIds = [];
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

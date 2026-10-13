import "../../shared/game-theme.css";
import "./style.css";
import { h, render } from "preact";
import { createPlayweftClient } from "../../shared/playweft-client.js";
import { applyAction, createGame, projectGame } from "./engine.js";
import AzulApp from "./view.jsx";

const root = document.querySelector("#azul-app");
const embedded = window.parent !== window;
const launchUrl = new URL("https://play.longern.com/");
launchUrl.searchParams.set("game", new URL("./playweft.json", window.location.href).href);
let localGame = null;
let roomState = null;
let ready = false;
let busy = false;
let error = "";

// Empty Lua lists arrive as objects. Only normalize fields that are lists.
function normalizeView(state) {
  if (!state) return null;
  const list = value => Array.isArray(value) ? value : [];
  state.players = list(state.players);
  state.factories = list(state.factories).map(list);
  state.center = list(state.center);
  state.winners = list(state.winners);
  for (const board of Object.values(state.boards || {})) {
    board.lines = list(board.lines).map(list);
    board.wall = list(board.wall).map(list);
    board.floor = list(board.floor);
  }
  for (const result of Object.values(state.settlement?.results || {})) result.placements = list(result.placements);
  return state;
}

function redraw() {
  const game = embedded ? (ready ? roomState : null)
    : localGame && projectGame(localGame, localGame.players[localGame.turn].id);
  render(h(AzulApp, {
    room: embedded, game, busy, error, launchUrl: launchUrl.href,
    onStart(names) {
      localGame = createGame(names.map((name, index) => ({ id: `local-${index}`, name: name.trim() || `玩家 ${index + 1}` })));
      error = "";
      redraw();
    },
    onExit() { localGame = null; error = ""; redraw(); },
    onAction: submitAction,
  }), root);
}

async function submitAction(intent) {
  const game = embedded ? roomState : localGame;
  if (!game || busy || (embedded && (!ready || !roomClient?.connected))) return;
  const action = { ...intent, round: game.round, step: game.step };
  error = "";
  if (!embedded) {
    const result = applyAction(localGame, localGame.players[localGame.turn].id, action);
    if (!result.accepted) error = result.error.message;
    else localGame = result.state;
    redraw();
    return;
  }
  busy = true;
  redraw();
  try {
    const result = await roomClient.action(action);
    if (result?.accepted === false) error = result.error?.message || "操作未成功";
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "操作未成功";
  } finally {
    busy = false;
    redraw();
  }
}

const roomClient = embedded ? createPlayweftClient({
  onInitialize(context) {
    ready = context.mode === "room";
    if (!ready) error = "请在 Playweft 房间中游玩";
    redraw();
  },
  onState(state) { roomState = normalizeView(state); error = ""; redraw(); },
  onError(message) { error = message; redraw(); },
}) : null;

redraw();

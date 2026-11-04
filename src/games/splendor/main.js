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
let localGame = null, roomState = null, ready = false, busy = false, error = "";
let localViewerId = null;
let handoff = false;

if (!embedded) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.schema === 1 && saved.state?.players?.length >= 2 && saved.state?.players?.length <= 4) {
      // The saved game contains private cards, so reveal it only after the handoff screen.
      projectGame(saved.state, saved.state.players[saved.state.turn].id);
      localGame = saved.state;
      localViewerId = localGame.players[localGame.turn].id;
      handoff = localGame.phase !== "ended";
    }
  } catch { /* A blocked storage area or an obsolete save must not prevent playing. */ }
}

function save() {
  try {
    if (localGame) localStorage.setItem(storageKey, JSON.stringify({ schema: 1, state: localGame }));
    else localStorage.removeItem(storageKey);
  } catch { /* Local play remains available without persistence. */ }
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

function redraw() {
  const game = embedded ? (ready ? roomState : null) : localGame && projectGame(localGame, localViewerId);
  render(h(SplendorApp, {
    room: embedded, game, busy, error, handoff, launchUrl: launchUrl.href,
    onStart(names) {
      localGame = createGame(names.map((name, index) => ({ id: `local-${index}`, name: name.trim() || `玩家 ${index + 1}` })));
      localViewerId = localGame.players[0].id; handoff = true; error = ""; save(); redraw();
    },
    onReady() { handoff = false; redraw(); },
    onExit() { localGame = null; handoff = false; error = ""; save(); redraw(); },
    onAction: submitAction,
  }), root);
}

async function submitAction(intent) {
  const game = embedded ? roomState : localGame;
  if (!game || busy || handoff || (embedded && (!ready || !roomClient?.connected))) return;
  const action = { ...intent, round: game.round, step: game.step };
  error = "";
  if (!embedded) {
    const previousId = localViewerId;
    const result = applyAction(localGame, localViewerId, action);
    if (!result.accepted) error = result.error.message;
    else {
      localGame = result.state;
      // Keep the acting player's view for the end screen, then rotate on a rematch.
      if (localGame.phase !== "ended") localViewerId = localGame.players[localGame.turn].id;
      handoff = localGame.phase !== "ended" && (previousId !== localViewerId || action.type === "rematch");
      save();
    }
    redraw(); return;
  }
  busy = true; redraw();
  try {
    const result = await roomClient.action(action);
    if (result?.accepted === false) error = result.error?.message || "操作未成功";
  } catch (cause) { error = cause instanceof Error ? cause.message : "操作未成功"; }
  finally { busy = false; redraw(); }
}

const roomClient = embedded ? createPlayweftClient({
  onInitialize(context) { ready = context.mode === "room"; if (!ready) error = "请在 Playweft 房间中游玩"; redraw(); },
  onState(state) { roomState = normalizeView(state); error = ""; redraw(); },
  onError(message) { error = message; redraw(); },
}) : null;
redraw();

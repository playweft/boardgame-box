import "../../shared/game-theme.css";
import "./style.css";
import { h, render } from "preact";
import { createPlayweftClient } from "../../shared/playweft-client.js";
import HalliHoldemApp from "./view.jsx";

const app = document.querySelector("#halli-holdem-app");
const embedded = window.parent !== window;
let roomState = null;
let roomReady = false;
const launchUrl = new URL("https://play.longern.com/");
launchUrl.searchParams.set("game", new URL("./playweft.json", window.location.href).href);
let error = "";
let busy = false;

// Lua represents empty tables without an array tag. Normalize only known list fields.
function normalizeView(state) {
  if (!state) return null;
  for (const key of ["players", "fixed", "dynamic", "ordinaryDiscard", "recentOrdinaryDiscard", "candidates", "discardSlots", "winners"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  if (state.settlement && !Array.isArray(state.settlement.checks)) state.settlement.checks = [];
  return state;
}

function redraw() {
  render(h(HalliHoldemApp, {
    room: embedded,
    game: roomReady ? roomState : null,
    launchUrl: launchUrl.href,
    busy,
    error,
    onAction: submitAction,
  }), app);
}

async function submitAction(intent) {
  if (!roomReady || !roomState || busy || !roomClient?.connected) return;
  const action = { ...intent, round: roomState.round, step: roomState.step };
  error = "";
  busy = true;
  redraw();
  try { await roomClient.action(action); }
  catch (cause) { error = cause instanceof Error ? cause.message : "操作未成功"; }
  finally { busy = false; redraw(); }
}

const roomClient = embedded ? createPlayweftClient({
  onInitialize(context) {
    roomReady = context.mode === "room";
    if (!roomReady) error = "请在 Playweft 房间中游玩";
    redraw();
  },
  onState(state) { roomState = normalizeView(state); if (roomReady) error = ""; redraw(); },
  onError(message) { error = message; redraw(); },
}) : null;

redraw();

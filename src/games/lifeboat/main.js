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
import { errorMessage, locale, t } from "./i18n.js";
import { normalizeRoomView } from "./room-state.js";
import { computerDelay, describeTurn, fightResultBetween, FIGHT_RESULT_MS, FIGHT_SKIP_MS, navigationCardBetween, treatmentBetween } from "./turn-feedback.js";
import LifeboatApp from "./view.jsx";

document.documentElement.lang = locale;
document.title = t("game.pageTitle");
document.querySelector('meta[name="description"]').content = t("game.description");

const root = document.querySelector("#lifeboat-app");
const NAVIGATION_REVEAL_MS = 3500;
const NAVIGATION_EXIT_MS = 200;
const MEDICAL_DISCARD_MS = 280;
const MEDICAL_RECOVERY_MS = 550;
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
const turnHistory = [];
let turnFeedback = null;
let feedbackUntil = 0;
let fightPlayback = null;
let treatmentPlayback = null;
let navigationPlayback = null;
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
      game: treatmentPlayback?.game ?? fightPlayback?.game ?? game,
      fightResult: fightPlayback?.skipped ? null : fightPlayback?.result,
      fightSkip: fightPlayback?.skipped,
      treatment: treatmentPlayback?.treatment,
      navigationReveal: fightPlayback || treatmentPlayback ? null : navigationPlayback,
      room,
      computer: !room && !!humanId,
      turnHistory,
      turnFeedback,
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
        clearFightPlayback();
        clearTreatmentPlayback();
        clearNavigationPlayback();
        humanId = computer ? "local-0" : null;
        turnHistory.length = 0;
        turnFeedback = null;
        feedbackUntil = 0;
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
        clearFightPlayback();
        clearTreatmentPlayback();
        clearNavigationPlayback();
        localGame = null;
        turnHistory.length = 0;
        turnFeedback = null;
        feedbackUntil = 0;
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

function clearFightPlayback() {
  clearTimeout(fightPlayback?.timer);
  fightPlayback = null;
}

function clearTreatmentPlayback() {
  clearTimeout(treatmentPlayback?.timer);
  treatmentPlayback = null;
}

function playTreatment(before, after, usedCard) {
  const treatment = treatmentBetween(before, after, usedCard);
  if (!treatment) return;
  clearTreatmentPlayback();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  treatment.recovering = reducedMotion;
  treatmentPlayback = { game: before, treatment };
  const finish = () => {
    clearTreatmentPlayback();
    playNavigationReveal();
    redraw();
    queueComputer();
  };
  if (reducedMotion) treatmentPlayback.timer = setTimeout(finish, MEDICAL_RECOVERY_MS);
  else treatmentPlayback.timer = setTimeout(() => {
    treatment.recovering = true;
    treatmentPlayback.timer = setTimeout(finish, MEDICAL_RECOVERY_MS);
    redraw();
  }, MEDICAL_DISCARD_MS);
}

function clearNavigationPlayback() {
  clearTimeout(navigationPlayback?.timer);
  navigationPlayback = null;
}

function prepareNavigationReveal(before, after) {
  const card = navigationCardBetween(before, after);
  if (!card) return;
  clearNavigationPlayback();
  navigationPlayback = { card, characters: after.characters, open: true };
  if (!fightPlayback) playNavigationReveal();
}

function playNavigationReveal() {
  if (fightPlayback || treatmentPlayback || !navigationPlayback || navigationPlayback.timer !== undefined) return;
  navigationPlayback.timer = setTimeout(() => {
    navigationPlayback.open = false;
    navigationPlayback.timer = setTimeout(() => {
      clearNavigationPlayback();
      redraw();
      queueComputer();
    }, NAVIGATION_EXIT_MS);
    redraw();
  }, NAVIGATION_REVEAL_MS);
}

function playFightFeedback(game, result, skipped = null) {
  clearFightPlayback();
  fightPlayback = {
    game,
    result,
    skipped,
    timer: setTimeout(() => {
      fightPlayback = null;
      if (skipped && result) playFightFeedback(game, result);
      else playNavigationReveal();
      redraw();
      if (!fightPlayback) queueComputer();
    }, skipped ? FIGHT_SKIP_MS : FIGHT_RESULT_MS),
  };
}

function acceptLocalGame(next, action) {
  const fightResult = fightResultBetween(localGame, next);
  const actor = actingPlayer(localGame);
  const skipped = humanId && actor !== humanId && action.type === "join" && action.side === "out"
    ? localGame.queue[0] : null;
  if (fightResult || skipped) {
    const viewer = humanId ?? tradeViewerId ?? actor;
    playFightFeedback(projectGame(localGame, viewer), fightResult, skipped);
  }
  if (action.type === "medical") {
    const viewer = humanId ?? tradeViewerId ?? actor;
    playTreatment(projectGame(localGame, viewer), projectGame(next, viewer), action.card);
  }
  prepareNavigationReveal(localGame, next);
  let feedback;
  if (humanId) {
    if (action.type === "rematch") turnHistory.length = 0;
    else {
      feedback = describeTurn(
        projectGame(localGame, humanId),
        projectGame(next, humanId),
        action,
      );
      if (feedback) turnHistory.push(feedback);
    }
  }
  localGame = next;
  turnFeedback = feedback ?? null;
  feedbackUntil = performance.now() + (skipped ? FIGHT_SKIP_MS : 0)
    + Math.max(feedback?.hold ?? 0, fightResult ? FIGHT_RESULT_MS : 0);
}

function queueComputer() {
  if (
    !humanId ||
    !localGame ||
    localGame.phase === "ended" ||
    mode !== "solo" ||
    treatmentPlayback ||
    navigationPlayback ||
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
    const readyAt = Math.max(feedbackUntil, startedAt + computerDelay(planned));
    job.timer = setTimeout(
      () => {
        if (botJob !== job) return;
        botJob = null;
        if (fightPlayback || treatmentPlayback || navigationPlayback) return;
        let intent = planned;
        let result =
          intent && applyAction(localGame, actor, { ...intent, step });
        if (!result?.accepted && action) {
          intent = chooseRuleAction(view);
          result = intent && applyAction(localGame, actor, { ...intent, step });
        }
        if (result?.accepted) acceptLocalGame(result.state, intent);
        else error = t("errors.botActionFailed");
        redraw();
        if (result?.accepted) queueComputer();
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
  const player = view.characters.find((entry) => entry.player === playerId);
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
  if ((presence && presence.roomId !== next.roomId) || next.phase !== "playing") {
    clearFightPlayback();
    clearTreatmentPlayback();
    clearNavigationPlayback();
    roomGame = null;
  }
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
  if (!game || fightPlayback || treatmentPlayback || navigationPlayback || busy || (room ? !client.connected : handoff || paused)) return;
  const action = { ...intent, step: game.step };
  if (room)
    return roomRequest(async () => {
      const result = await client.action(action);
      if (result?.accepted === false)
        throw new Error(errorMessage(result.error));
    }, t("errors.actionFailed"));

  const previous = actingPlayer(localGame);
  const offTurn = intent.type === "give" || intent.type === "reveal";
  if ((tradeViewerId !== null || (humanId && previous !== humanId)) && !offTurn)
    return;
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
  if (result.accepted) {
    acceptLocalGame(result.state, intent);
    if (!humanId && tradeViewerId === null) {
      handoff =
        localGame.phase !== "ended" &&
        (actingPlayer(localGame) !== previous || intent.type === "rematch");
    }
  }
  redraw();
  queueComputer();
}

const client = embedded
  ? createPlayweftClient({
      onInitialize(context) {
        canCreateRoom = context.capabilities?.includes("rooms.create") ?? false;
        if (context.mode === "room") {
          if (context.room && !presence) enterRoom(context.room);
          mode = "room";
        } else if (context.mode === "solo" && !presence) mode = "solo";
        else if (context.mode !== "solo")
          error = t("errors.unknownPlayweftMode");
        redraw();
      },
      onRoomState: enterRoom,
      onRoomClosed() {
        clearFightPlayback();
        clearTreatmentPlayback();
        clearNavigationPlayback();
        mode = "solo";
        presence = null;
        roomGame = null;
        error = "";
        redraw();
        queueComputer();
      },
      onState(state) {
        if (mode === "solo" || !state) return;
        const next = normalizeRoomView(state);
        if (roomGame && (next.viewerId !== roomGame.viewerId || next.log.length < roomGame.log.length)) {
          clearFightPlayback();
          clearTreatmentPlayback();
          clearNavigationPlayback();
        } else {
          const fightResult = fightResultBetween(roomGame, next);
          if (fightResult) playFightFeedback(roomGame, fightResult);
          playTreatment(roomGame, next);
          prepareNavigationReveal(roomGame, next);
        }
        roomGame = next;
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

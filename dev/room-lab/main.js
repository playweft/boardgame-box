const $ = selector => document.querySelector(selector);
let snapshot = null;
let selectedId = null;
let generation = 0;
let queue = Promise.resolve();
const sessions = new Map();
const enqueue = operation => {
  const result = queue.then(operation);
  queue = result.catch(showError);
  return result;
};
function showError(error) {
  $("#error").hidden = false;
  $("#error").textContent = error instanceof Error ? error.message : String(error);
}
async function api(method, params = {}) {
  const response = await fetch(`/__dev/avalon/api/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "本地测试服务请求失败");
  return result;
}
function notify(session) {
  if (!session.initialized || !snapshot || session.matchId !== snapshot.matchId) return;
  session.port.postMessage({ jsonrpc: "2.0", method: "game.state", params: {
    phase: "playing", matchId: snapshot.matchId, version: snapshot.version,
    serverTime: Date.now(), state: snapshot.views[session.id], events: [],
  } });
}
function selectSeat(id) {
  selectedId = id;
  for (const session of sessions.values()) {
    session.card.classList.toggle("selected", session.id === id);
    session.button.classList.toggle("selected", session.id === id);
    session.button.setAttribute("aria-pressed", String(session.id === id));
  }
}
function update(next) {
  snapshot = next;
  const view = next.views[next.players[0].id];
  const leader = next.players.find(player => player.id === view.leader);
  $("#status").textContent = `版本 ${next.version} · ${view.phase} · 任务 ${view.quest} · 队长 ${leader?.name || "—"}`;
  $("#approve").disabled = $("#reject").disabled = view.phase !== "vote";
  $("#success").disabled = view.phase !== "mission";
  $("#layout").disabled = false;
  for (const session of sessions.values()) {
    const own = next.views[session.id];
    session.caption.textContent = $("#roles").checked ? own.ownRole?.name || "观战" : own.ownRole ? "独立玩家视角" : "观战视角";
    notify(session);
  }
  $("#log").textContent = next.log.slice().reverse().map(entry =>
    `v${entry.version} ${entry.actorId || "测试台"} ${entry.type} ${entry.accepted ? "✓" : `✗ ${entry.error || "拒绝"}`}`).join("\n");
}
async function dispatch(actorId, action, matchId = snapshot.matchId) {
  const response = await api("action", { actorId, action, matchId });
  update(response.snapshot);
  return response.result;
}
function createFrames(data) {
  generation++;
  for (const session of sessions.values()) session.port?.close();
  sessions.clear();
  $("#frames").replaceChildren();
  $("#seats").replaceChildren();
  for (const player of [...data.players, { id: "observer", name: "观战者" }]) {
    const card = document.createElement("section"); card.className = "frame-card";
    const heading = document.createElement("div"); heading.className = "frame-caption";
    const title = document.createElement("strong"); title.textContent = player.name;
    const caption = document.createElement("span"); heading.append(title, caption);
    const frame = document.createElement("iframe"); frame.title = `${player.name}联机视角`;
    frame.src = `/avalon/?local-lab=${generation}-${player.id}`;
    const reconnect = document.createElement("button"); reconnect.textContent = "重新连接";
    reconnect.setAttribute("aria-label", `重新连接${player.name}视角`);
    reconnect.addEventListener("click", () => { frame.src = frame.getAttribute("src"); });
    heading.append(reconnect);
    card.append(heading, frame); $("#frames").append(card);
    const button = document.createElement("button"); button.textContent = player.name;
    button.addEventListener("click", () => selectSeat(player.id)); $("#seats").append(button);
    sessions.set(player.id, { id: player.id, matchId: data.matchId, frame, card, caption, button, port: null, initialized: false });
  }
  selectSeat(data.views[data.players[0].id].leader);
}
window.addEventListener("message", event => {
  if (event.origin !== location.origin || event.data?.type !== "playweft:bridge-ready" || event.data.version !== 1) return;
  const session = [...sessions.values()].find(session => session.frame.contentWindow === event.source);
  if (!session || (session.port && !session.initialized)) return;
  session.port?.close(); session.initialized = false;
  const channel = new MessageChannel(); session.port = channel.port1;
  session.port.onmessage = async ({ data: request }) => {
    if (request?.jsonrpc !== "2.0" || typeof request.id !== "string") return;
    const reply = result => session.port.postMessage({ jsonrpc: "2.0", id: request.id, result });
    try {
      if (request.method === "game.initialize") {
        session.initialized = true;
        reply({ mode: "room", playerId: session.id, protocolVersion: 1, capabilities: ["room.players.getProfile"] });
        notify(session);
      } else if (request.method === "room.players.getProfile") {
        const player = snapshot.players.find(player => player.id === request.params?.playerId);
        reply(player ? { name: player.name } : {});
      } else if (request.method === "room.action") {
        reply(await enqueue(() => dispatch(session.id, request.params?.action, session.matchId)));
      } else throw new Error(`测试台未实现 ${request.method}`);
    } catch (error) {
      session.port.postMessage({ jsonrpc: "2.0", id: request.id, error: { code: -32603, message: error.message } });
      showError(error);
    }
  };
  session.port.start();
  session.frame.contentWindow.postMessage({ type: "playweft:bridge", version: 1 }, location.origin, [channel.port2]);
});
$("#setup").addEventListener("submit", event => {
  event.preventDefault();
  void enqueue(async () => {
    $("#error").hidden = true; $("#start").disabled = true;
    try {
      const seed = $("#seed").value.trim();
      const data = await api("start", { count: Number($("#count").value), ...(seed ? { seed } : {}) });
      $("#seed").value = data.setupSeed;
      createFrames(data); update(data);
    } finally { $("#start").disabled = false; }
  });
});
$("#layout").addEventListener("click", () => {
  const grid = $("#frames").classList.toggle("grid");
  $("#layout").textContent = grid ? "单人视角" : "并排视角";
});
$("#roles").addEventListener("change", () => { if (snapshot) update(snapshot); });
for (const [id, action] of [["approve", { type: "vote", approve: true }], ["reject", { type: "vote", approve: false }], ["success", { type: "mission_choice", choice: "success" }]]) {
  $("#" + id).addEventListener("click", () => void enqueue(async () => {
    const match = snapshot.matchId;
    const candidates = snapshot.players.filter(player => {
      const view = snapshot.views[player.id];
      return action.type === "vote" ? view.phase === "vote" && !view.ownVote
        : view.phase === "mission" && Array.isArray(view.missionTeam) && view.missionTeam.includes(player.id) && !view.ownMissionAction;
    });
    for (const player of candidates) {
      const result = await dispatch(player.id, action, match);
      if (!result.accepted) throw new Error(result.error.message);
    }
  }));
}

// Page/HMR reloads reconnect all views to the current Node-hosted match.
void enqueue(async () => {
  try {
    const data = await api("snapshot");
    $("#count").value = String(data.players.length);
    $("#seed").value = data.setupSeed;
    createFrames(data); update(data);
  } catch (error) {
    if (error.message !== "请先创建测试对局") throw error;
  }
});

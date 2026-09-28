export function createPlayweftClient({
  onInitialize,
  onState,
  onError,
  onPlayerProfileChanged,
}) {
  let port = null;
  let probe = null;
  let matchId = null;
  let latestVersion = -1;
  let destroyed = false;
  const pending = new Map();

  function announceReady() {
    window.parent.postMessage(
      { type: "playweft:bridge-ready", version: 1 },
      "*",
    );
  }

  function call(method, params) {
    if (!port) return Promise.reject(new Error("Playweft 尚未连接。"));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      port.postMessage({
        jsonrpc: "2.0",
        id,
        method,
        ...(params === undefined ? {} : { params }),
      });
    });
  }

  function handlePortMessage(event) {
    const message = event.data;
    if (message?.jsonrpc !== "2.0") return;
    if (Object.hasOwn(message, "id")) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error)
        request.reject(
          new Error(message.error.message || "Playweft 调用失败。"),
        );
      else request.resolve(message.result);
      return;
    }
    if (message.method === "platform.error") {
      onError(message.params?.error?.message || "Playweft 平台发生错误。");
      return;
    }
    if (message.method === "room.players.profileChanged") {
      const fields = Array.isArray(message.params?.fields)
        ? message.params.fields.filter(
            (field) => field === "name" || field === "avatar",
          )
        : [];
      if (typeof message.params?.playerId === "string" && fields.length) {
        onPlayerProfileChanged?.({ playerId: message.params.playerId, fields });
      }
      return;
    }
    if (message.method !== "game.state") return;
    const update = message.params;
    if (update.matchId !== matchId) {
      matchId = update.matchId;
      latestVersion = -1;
    }
    if (typeof update.version === "number" && update.version <= latestVersion)
      return;
    if (typeof update.version === "number") latestVersion = update.version;
    onState(update.state, update);
  }

  async function connect(receivedPort) {
    port = receivedPort;
    if (probe !== null) window.clearInterval(probe);
    port.onmessage = handlePortMessage;
    port.start();
    try {
      const context = await call("game.initialize");
      onInitialize(context);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Playweft 初始化失败。");
    }
  }

  function handleWindowMessage(event) {
    if (
      event.source !== window.parent ||
      event.data?.type !== "playweft:bridge" ||
      event.data?.version !== 1
    )
      return;
    const receivedPort = event.ports[0];
    if (receivedPort && !port) void connect(receivedPort);
  }

  if (window.parent !== window) {
    probe = window.setInterval(announceReady, 500);
    announceReady();
    window.addEventListener("message", handleWindowMessage);
  }

  return {
    action(action) {
      return call("room.action", { action });
    },
    getRoomPlayerProfile({ playerId, fields }) {
      return call("room.players.getProfile", { playerId, fields });
    },
    destroy() {
      destroyed = true;
      if (probe !== null) window.clearInterval(probe);
      window.removeEventListener("message", handleWindowMessage);
      port?.close();
      for (const request of pending.values())
        request.reject(new Error("Playweft 连接已关闭。"));
      pending.clear();
    },
    get connected() {
      return Boolean(port) && !destroyed;
    },
  };
}

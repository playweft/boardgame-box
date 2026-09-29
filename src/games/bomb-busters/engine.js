const WIRE_COUNT = 4;
const VALUE_COUNT = 12;
const ERROR_LIMIT = 4;

function shuffled(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createGame(players, random = Math.random) {
  const wires = {};
  const deck = [];
  let wireNumber = 0;
  for (let value = 1; value <= VALUE_COUNT; value += 1) {
    for (let copy = 1; copy <= WIRE_COUNT; copy += 1) {
      const id = `wire-${++wireNumber}`;
      wires[id] = { id, kind: "number", value, sort: value * 10 };
      deck.push(id);
    }
  }
  for (let copy = 1; copy <= 2; copy += 1) {
    const sort = 10 + Math.floor(random() * 120);
    const id = `wire-${++wireNumber}`;
    wires[id] = { id, kind: "yellow", value: null, sort };
    deck.push(id);
  }
  const redSort = 10 + Math.floor(random() * 120);
  const redId = `wire-${++wireNumber}`;
  wires[redId] = { id: redId, kind: "red", value: null, sort: redSort };
  deck.push(redId);

  const shuffledDeck = shuffled(deck, random);
  const opaqueWires = {};
  const opaqueDeck = shuffledDeck.map((sourceId, index) => {
    const id = `wire-${index + 1}`;
    opaqueWires[id] = { ...wires[sourceId], id };
    return id;
  });
  for (const wireId of Object.keys(wires)) delete wires[wireId];
  Object.assign(wires, opaqueWires);

  const hands = Object.fromEntries(players.map((player) => [player.id, []]));
  opaqueDeck.forEach((wireId, index) => {
    hands[players[index % players.length].id].push(wireId);
  });
  for (const hand of Object.values(hands)) {
    hand.sort((left, right) => wires[left].sort - wires[right].sort);
  }
  const rackSlots = Object.fromEntries(
    players.map((player) => [player.id, hands[player.id].slice()]),
  );

  const clues = {};
  for (const player of players) {
    const blueWires = hands[player.id].filter(
      (wireId) => wires[wireId].kind === "number",
    );
    if (blueWires.length) {
      const wireId = blueWires[Math.floor(random() * blueWires.length)];
      clues[wireId] = true;
    }
  }

  return {
    phase: "playing",
    players: players.map((player, seat) => ({ ...player, seat })),
    wires,
    hands,
    rackSlots,
    clues,
    cutWires: [],
    detonator: 0,
    detonatorLimit: ERROR_LIMIT,
    turn: 0,
    outcome: null,
    lastAction: null,
  };
}

function removeWires(state, playerId, wireIds, revealedRed = false) {
  const removed = new Set(wireIds);
  state.hands[playerId] = state.hands[playerId].filter(
    (wireId) => !removed.has(wireId),
  );
  state.rackSlots[playerId] = state.rackSlots[playerId].map((wireId) =>
    removed.has(wireId) ? null : wireId,
  );
  for (const wireId of wireIds) {
    delete state.clues[wireId];
    const wire = state.wires[wireId];
    state.cutWires.push({
      id: wireId,
      playerId,
      kind: wire.kind,
      value: wire.value,
      revealedRed,
    });
  }
}

function nextTurn(state, fromIndex) {
  if (state.players.every((player) => state.hands[player.id].length === 0)) {
    state.phase = "ended";
    state.outcome = "success";
    return;
  }
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    if (state.hands[state.players[index].id].length) {
      state.turn = index;
      return;
    }
  }
}

function reject(message) {
  return { accepted: false, error: message };
}

export function applyAction(state, actorId, action) {
  if (state.phase !== "playing") return reject("游戏已结束");
  const actorIndex = state.players.findIndex((player) => player.id === actorId);
  if (actorIndex < 0) return reject("玩家不存在");
  if (actorIndex !== state.turn) return reject("还没轮到你");

  if (action.type === "dual_cut") {
    const ownHand = state.hands[actorId];
    const source = state.wires[action.sourceId];
    const target = state.wires[action.targetId];
    const targetOwner = state.players.find((player) =>
      state.hands[player.id].includes(action.targetId),
    );
    if (!source || !ownHand.includes(source.id) || source.kind === "red") {
      return reject("请选择自己的线缆");
    }
    if (!target || !targetOwner || targetOwner.id === actorId) {
      return reject("请选择队友的线缆");
    }
    const matches = source.kind === target.kind && source.value === target.value;
    if (matches) {
      removeWires(state, actorId, [source.id]);
      removeWires(state, targetOwner.id, [target.id]);
      state.lastAction = {
        type: "success",
        actorId,
        targetOwnerId: targetOwner.id,
        wire: { kind: source.kind, value: source.value },
      };
    } else if (target.kind === "red") {
      state.phase = "ended";
      state.outcome = "failure";
      state.lastAction = { type: "red", actorId, targetOwnerId: targetOwner.id };
      return { accepted: true, state };
    } else {
      state.detonator += 1;
      state.clues[target.id] = true;
      state.lastAction = {
        type: "miss",
        actorId,
        targetOwnerId: targetOwner.id,
        wire: { kind: target.kind, value: target.value },
      };
      if (state.detonator >= state.detonatorLimit) {
        state.phase = "ended";
        state.outcome = "failure";
        return { accepted: true, state };
      }
    }
    if (state.phase === "playing") nextTurn(state, actorIndex);
    return { accepted: true, state };
  }

  if (action.type === "solo_cut") {
    const hand = state.hands[actorId];
    const first = state.wires[action.wireId];
    if (!first || !hand.includes(first.id) || first.kind === "red") {
      return reject("无法单人剪断这根线缆");
    }
    const remaining = state.players.flatMap((player) =>
      state.hands[player.id].filter((wireId) => {
        const wire = state.wires[wireId];
        return wire.kind === first.kind && wire.value === first.value;
      }),
    );
    if (remaining.length < 2 || remaining.length > 4) {
      return reject("这些线缆还不能单人剪断");
    }
    if (remaining.some((wireId) => !hand.includes(wireId))) {
      return reject("这些线缆不全在你手上");
    }
    removeWires(state, actorId, remaining);
    state.lastAction = {
      type: "solo",
      actorId,
      wire: { kind: first.kind, value: first.value },
    };
    nextTurn(state, actorIndex);
    return { accepted: true, state };
  }

  if (action.type === "reveal_red") {
    const hand = state.hands[actorId];
    if (!hand.length || hand.some((wireId) => state.wires[wireId].kind !== "red")) {
      return reject("只有剩下红线时才能公开");
    }
    removeWires(state, actorId, hand.slice(), true);
    state.lastAction = { type: "reveal_red", actorId };
    nextTurn(state, actorIndex);
    return { accepted: true, state };
  }

  return reject("未知操作");
}

function availableSoloCuts(state, playerId) {
  const hand = state.hands[playerId] || [];
  const values = new Map();
  for (const player of state.players) {
    for (const wireId of state.hands[player.id]) {
      const wire = state.wires[wireId];
      if (wire.kind === "red") continue;
      const key = `${wire.kind}:${wire.value ?? ""}`;
      const entry = values.get(key) || { kind: wire.kind, value: wire.value, ids: [] };
      entry.ids.push(wireId);
      values.set(key, entry);
    }
  }
  return [...values.values()].filter(
    (entry) =>
      entry.ids.length >= 2 &&
      entry.ids.length <= 4 &&
      entry.ids.every((wireId) => hand.includes(wireId)),
  );
}

export function projectGame(state, viewerId) {
  const currentId = state.players[state.turn]?.id;
  const viewerTurn = viewerId === currentId;
  const hands = {};
  const racks = {};
  for (const player of state.players) {
    hands[player.id] = state.hands[player.id].map((wireId) => {
      const wire = state.wires[wireId];
      const revealed =
        state.phase === "ended" ||
        player.id === viewerId ||
        state.clues[wireId] === true;
      return {
        id: wire.id,
        kind: revealed ? wire.kind : null,
        value: revealed ? wire.value : null,
        revealed,
      };
    });
    const slots = state.rackSlots[player.id];
    racks[player.id] = slots.map((wireId, slotIndex) => {
      if (wireId === null) {
        return { id: player.id + "-slot-" + slotIndex, empty: true };
      }
      const wire = state.wires[wireId];
      const revealed =
        state.phase === "ended" ||
        player.id === viewerId ||
        state.clues[wireId] === true;
      return {
        id: wire.id,
        kind: revealed ? wire.kind : null,
        value: revealed ? wire.value : null,
        revealed,
      };
    });
  }
  const soloCuts = viewerTurn ? availableSoloCuts(state, viewerId) : [];
  const ownHand = state.hands[viewerId] || [];
  return {
    phase: state.phase,
    players: state.players,
    viewerId,
    currentPlayerId: currentId,
    hands,
    racks,
    cutWires: state.cutWires,
    clues: state.clues,
    detonator: state.detonator,
    detonatorLimit: state.detonatorLimit,
    outcome: state.outcome,
    lastAction: state.lastAction,
    ownTurn: viewerTurn,
    soloCuts,
    canRevealRed:
      viewerTurn &&
      ownHand.length > 0 &&
      ownHand.every((wireId) => state.wires[wireId].kind === "red"),
  };
}

const WIRE_COUNT = 4;
const VALUE_COUNT = 12;

function shuffled(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function drawSpecialWires(kind, suffix, inPlay, candidateCount, random) {
  const allWires = Array.from({ length: 11 }, (_, index) => {
    const number = index + 1;
    return {
      kind,
      value: null,
      sort: number * 10 + suffix,
      tileNumber: number + "." + suffix,
    };
  });
  const candidates = shuffled(allWires, random)
    .slice(0, candidateCount)
    .sort((left, right) => left.sort - right.sort);
  const selected = shuffled(candidates, random).slice(0, inPlay);
  return {
    candidates: candidates.map((wire) => wire.tileNumber),
    wires: selected,
    inPlay,
    candidateCount,
  };
}

export function createGame(players, random = Math.random, captainId = null) {
  const wires = {};
  const deck = [];
  let wireNumber = 0;
  for (let value = 1; value <= VALUE_COUNT; value += 1) {
    for (let copy = 1; copy <= WIRE_COUNT; copy += 1) {
      const id = `wire-${++wireNumber}`;
      wires[id] = { id, kind: "number", value, sort: value * 10, tileNumber: String(value) };
      deck.push(id);
    }
  }
  const specialSets = {
    red: drawSpecialWires("red", 5, 1, 2, random),
    yellow: drawSpecialWires("yellow", 1, 2, 3, random),
  };
  for (const kind of ["red", "yellow"]) {
    for (const specialWire of specialSets[kind].wires) {
      const id = `wire-${++wireNumber}`;
      wires[id] = { id, ...specialWire };
      deck.push(id);
    }
  }
  const specialCandidates = Object.fromEntries(
    Object.entries(specialSets).map(([kind, set]) => [kind, {
      inPlay: set.inPlay,
      candidateCount: set.candidateCount,
      tileNumbers: set.candidates,
    }]),
  );

  const shuffledDeck = shuffled(deck, random);
  const opaqueWires = {};
  const opaqueDeck = shuffledDeck.map((sourceId, index) => {
    const id = `wire-${index + 1}`;
    opaqueWires[id] = { ...wires[sourceId], id };
    return id;
  });
  for (const wireId of Object.keys(wires)) delete wires[wireId];
  Object.assign(wires, opaqueWires);

  const captainIndex = players.findIndex((player) => player.id === captainId);
  const turn = captainIndex >= 0 ? captainIndex : Math.floor(random() * players.length);
  const rackCounts = players.map((_, index) =>
    players.length === 2 || (players.length === 3 && index === turn) ? 2 : 1,
  );
  const rackSlots = Object.fromEntries(
    players.map((player, index) => [
      player.id,
      Array.from({ length: rackCounts[index] }, () => []),
    ]),
  );
  const rackOrder = players.flatMap((player, playerIndex) =>
    rackSlots[player.id].map((_, rackIndex) => ({ playerId: player.id, rackIndex })),
  );
  opaqueDeck.forEach((wireId, index) => {
    const rack = rackOrder[index % rackOrder.length];
    rackSlots[rack.playerId][rack.rackIndex].push(wireId);
  });
  for (const player of players) {
    for (const slots of rackSlots[player.id]) {
      slots.sort((left, right) => wires[left].sort - wires[right].sort);
    }
  }
  const hands = Object.fromEntries(
    players.map((player) => [player.id, rackSlots[player.id].flat()]),
  );

  const setupInfoOrder = players.map(
    (_, offset) => players[(turn + offset) % players.length].id,
  );

  return {
    phase: "setup_info",
    players: players.map((player, seat) => ({ ...player, seat })),
    wires,
    specialCandidates,
    hands,
    rackSlots,
    clues: {},
    detectorUsed: {},
    pendingDetector: null,
    setupInfoOrder,
    setupInfoIndex: 0,
    cutWires: [],
    detonator: 0,
    detonatorLimit: players.length,
    captainId: players[turn].id,
    turn,
    outcome: null,
    lastAction: null,
  };
}

function removeWires(state, playerId, wireIds, revealedRed = false) {
  const removed = new Set(wireIds);
  state.hands[playerId] = state.hands[playerId].filter(
    (wireId) => !removed.has(wireId),
  );
  for (const wireId of wireIds) {
    delete state.clues[wireId];
    const wire = state.wires[wireId];
    let rackIndex = -1;
    let slotIndex = -1;
    for (let rack = 0; rack < state.rackSlots[playerId].length; rack += 1) {
      const slot = state.rackSlots[playerId][rack].indexOf(wireId);
      if (slot >= 0) {
        rackIndex = rack;
        slotIndex = slot;
        state.rackSlots[playerId][rack][slot] = null;
        break;
      }
    }
    state.cutWires.push({
      id: wireId,
      playerId,
      rackIndex,
      slotIndex,
      kind: wire.kind,
      value: wire.value,
      tileNumber: wire.tileNumber,
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
  const actorIndex = state.players.findIndex((player) => player.id === actorId);
  if (actorIndex < 0) return reject("玩家不存在");
  if (action.type === "rematch") {
    if (state.phase !== "ended") return reject("游戏尚未结束");
    const captainIndex = state.players.findIndex(
      (player) => player.id === (state.captainId || state.setupInfoOrder[0]),
    );
    const captain = state.players[(captainIndex + 1) % state.players.length];
    return { accepted: true, state: createGame(state.players, Math.random, captain.id) };
  }
  if (state.phase === "setup_info") {
    if (action.type !== "place_info") return reject("请先放置信息标记");
    if (state.setupInfoOrder[state.setupInfoIndex] !== actorId) {
      return reject("还没轮到你放置信息标记");
    }
    const wire = state.wires[action.wireId];
    if (wire?.kind !== "number" || !state.hands[actorId].includes(action.wireId)) {
      return reject("请选择自己的一根蓝线");
    }
    state.clues[action.wireId] = true;
    state.setupInfoIndex += 1;
    if (state.setupInfoIndex >= state.setupInfoOrder.length) {
      state.phase = "playing";
    }
    return { accepted: true, state };
  }
  if (state.phase !== "playing") return reject("游戏已结束");
  if (state.pendingDetector) {
    const pending = state.pendingDetector;
    if (action.type !== "resolve_detector" || actorId !== pending.targetOwnerId) {
      return reject("等待被探测的队友选择线缆");
    }
    const source = state.wires[pending.sourceId];
    const matches = pending.targetIds.filter((id) => {
      const wire = state.wires[id];
      return wire.kind === source.kind && wire.value === source.value;
    });
    const choices = matches.length ? matches : pending.targetIds.filter((id) => state.wires[id].kind !== "red");
    if (!choices.includes(action.wireId)) return reject("请选择可剪断或可放提示的线缆");
    const target = state.wires[action.wireId];
    if (matches.length) {
      removeWires(state, pending.actorId, [pending.sourceId]);
      removeWires(state, pending.targetOwnerId, [action.wireId]);
    } else {
      state.detonator += 1;
      state.clues[action.wireId] = true;
    }
    state.lastAction = { type: matches.length ? "success" : "miss", actorId: pending.actorId,
      targetOwnerId: pending.targetOwnerId, wire: { kind: target.kind, value: target.value } };
    state.pendingDetector = null;
    if (state.detonator >= state.detonatorLimit) {
      state.phase = "ended";
      state.outcome = "failure";
    } else {
      nextTurn(state, state.players.findIndex((player) => player.id === pending.actorId));
    }
    return { accepted: true, state };
  }
  if (actorIndex !== state.turn) return reject("还没轮到你");

  if (action.type === "double_detector") {
    if (state.detectorUsed?.[actorId]) return reject("双重探测器本局已经使用");
    const source = state.wires[action.sourceId];
    if (!source || !state.hands[actorId].includes(source.id) || source.kind === "red") return reject("请选择自己的蓝线或黄线");
    const ids = action.targetIds;
    if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return reject("请选择两根不同的线缆");
    const owner = state.players.find((player) => player.id !== actorId &&
      state.rackSlots[player.id].some((rack) => ids.every((id) => rack.includes(id))));
    if (!owner) return reject("请选择同一队友牌架上的两根线缆");
    state.detectorUsed ||= {};
    state.detectorUsed[actorId] = true;
    if (ids.every((id) => state.wires[id].kind === "red")) {
      state.phase = "ended";
      state.outcome = "failure";
      state.lastAction = { type: "red", actorId, targetOwnerId: owner.id };
    } else {
      state.pendingDetector = { actorId, sourceId: source.id, targetOwnerId: owner.id, targetIds: ids.slice() };
    }
    return { accepted: true, state };
  }

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
  const currentId =
    state.pendingDetector ? state.pendingDetector.targetOwnerId : state.phase === "setup_info"
      ? state.setupInfoOrder[state.setupInfoIndex]
      : state.players[state.turn]?.id;
  const viewerTurn = viewerId === currentId;
  const playingTurn = state.phase === "playing" && viewerTurn && !state.pendingDetector;
  const hands = {};
  const racks = {};
  const cutWiresBySlot = new Map(
    state.cutWires.map((wire) => [
      `${wire.playerId}:${wire.rackIndex}:${wire.slotIndex}`,
      wire,
    ]),
  );
  for (const player of state.players) {
    hands[player.id] = state.hands[player.id].map((wireId) => {
      const wire = state.wires[wireId];
      const revealed =
        state.phase === "ended" ||
        player.id === viewerId;
      return {
        id: wire.id,
        kind: revealed ? wire.kind : null,
        value: revealed ? wire.value : null,
        tileNumber: revealed ? wire.tileNumber : null,
        revealed,
      };
    });
    racks[player.id] = state.rackSlots[player.id].map((slots, rackIndex) =>
      slots.map((wireId, slotIndex) => {
        if (wireId === null) {
          return {
            id: player.id + "-rack-" + rackIndex + "-slot-" + slotIndex,
            empty: true,
            cutWire: cutWiresBySlot.get(`${player.id}:${rackIndex}:${slotIndex}`) || null,
          };
        }
        const wire = state.wires[wireId];
        const revealed =
          state.phase === "ended" ||
          player.id === viewerId;
        return {
          id: wire.id,
          kind: revealed ? wire.kind : null,
          value: revealed ? wire.value : null,
          tileNumber: revealed ? wire.tileNumber : null,
          revealed,
          infoToken: state.clues[wireId]
            ? wire.kind === "number"
              ? String(wire.value)
              : wire.kind === "yellow"
                ? "黄"
                : null
            : null,
        };
      }),
    );
  }
  const soloCuts = playingTurn ? availableSoloCuts(state, viewerId) : [];
  const ownHand = state.hands[viewerId] || [];
  let detectorChoice = null;
  if (state.pendingDetector) {
    const pending = state.pendingDetector;
    const source = state.wires[pending.sourceId];
    detectorChoice = { actorId: pending.actorId, targetOwnerId: pending.targetOwnerId,
      targetIds: pending.targetIds, kind: source.kind, value: source.value };
    if (viewerId === pending.targetOwnerId) {
      const matches = pending.targetIds.filter((id) => state.wires[id].kind === source.kind && state.wires[id].value === source.value);
      detectorChoice.choiceIds = matches.length ? matches : pending.targetIds.filter((id) => state.wires[id].kind !== "red");
      detectorChoice.success = matches.length > 0;
    }
  }
  return {
    phase: state.phase,
    players: state.players,
    viewerId,
    currentPlayerId: currentId,
    hands,
    racks,
    cutWires: state.cutWires,
    specialCandidates: state.specialCandidates,
    clues: state.clues,
    detonator: state.detonator,
    detonatorLimit: state.detonatorLimit,
    outcome: state.outcome,
    lastAction: state.lastAction,
    ownTurn: viewerTurn,
    detectorChoice,
    detectorUsed: state.detectorUsed || {},
    canUseDetector: playingTurn && !state.detectorUsed?.[viewerId],
    soloCuts,
    canRevealRed:
      playingTurn &&
      ownHand.length > 0 &&
      ownHand.every((wireId) => state.wires[wireId].kind === "red"),
  };
}

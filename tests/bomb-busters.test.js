import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { LuaFactory } from 'wasmoon';
import { applyAction, createGame, projectGame } from '../src/games/bomb-busters/engine.js';

const players = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `玩家 ${index}` }));

function finishSetup(state) {
  while (state.phase === 'setup_info') {
    const actor = state.setupInfoOrder[state.setupInfoIndex];
    const wireId = state.hands[actor].find(id => state.wires[id].kind === 'number');
    assert.equal(applyAction(state, actor, { type: 'place_info', wireId }).accepted, true);
  }
}

test('clues disclose tokens, never opponents’ wire faces or yellow decimals', () => {
  const state = createGame(players(3));
  for (const owner of state.players) {
    for (const wireId of state.hands[owner.id]) {
      if (state.wires[wireId].kind !== 'red') state.clues[wireId] = true;
    }
    const viewer = state.players.find(player => player.id !== owner.id).id;
    const visible = projectGame(state, viewer);
    for (const wire of visible.hands[owner.id]) {
      assert.equal(wire.revealed, false);
      assert.equal(wire.tileNumber, null);
      assert.equal(wire.kind, null);
      assert.equal(wire.value, null);
    }
    for (const wire of visible.racks[owner.id].flat()) {
      assert.equal(wire.tileNumber, null);
      const original = state.wires[wire.id];
      if (original.kind === 'yellow') assert.equal(wire.infoToken, '黄');
      if (original.kind === 'number') assert.equal(wire.infoToken, String(original.value));
    }
    assert.ok(projectGame(state, owner.id).hands[owner.id].every(wire => wire.revealed));
  }
  assert.ok(Object.values(projectGame(state, null).hands).flat().every(wire => !wire.revealed));
  state.phase = 'ended';
  assert.ok(Object.values(projectGame(state, null).hands).flat().every(wire => wire.revealed));
});

for (const count of [2, 3, 4, 5]) {
  test(`${count} players: explode on mistake ${count}, not earlier`, () => {
    const state = createGame(players(count));
    finishSetup(state);
    assert.equal(state.detonatorLimit, count);
    for (let mistake = 1; mistake <= count; mistake++) {
      const actor = state.players[state.turn].id;
      const sourceId = state.hands[actor].find(id => state.wires[id].kind === 'number');
      const targetId = state.players.filter(player => player.id !== actor)
        .flatMap(player => state.hands[player.id])
        .find(id => state.wires[id].kind === 'number' && state.wires[id].value !== state.wires[sourceId].value);
      assert.equal(applyAction(state, actor, { type: 'dual_cut', sourceId, targetId }).accepted, true);
      assert.equal(state.detonator, mistake);
      assert.equal(state.phase, mistake === count ? 'ended' : 'playing');
    }
    assert.equal(state.outcome, 'failure');
  });
}

test('rematch rotates the original captain, including the three-player double stand', () => {
  for (const outcome of ['failure', 'success']) {
    let state = createGame(players(3), Math.random, 'p0');
    assert.equal(applyAction(state, 'p0', { type: 'rematch' }).accepted, false);
    for (const expected of ['p1', 'p2', 'p0']) {
      state.phase = 'ended';
      state.outcome = outcome;
      state.turn = (state.players.findIndex(player => player.id === state.captainId) + 2) % 3;
      const result = applyAction(state, 'p0', { type: 'rematch' });
      assert.equal(result.accepted, true);
      state = result.state;
      assert.equal(state.captainId, expected);
      assert.equal(state.setupInfoOrder[0], expected);
      assert.equal(state.rackSlots[expected].length, 2);
      assert.equal(state.detonator, 0);
      for (const player of state.players.filter(player => player.id !== expected)) {
        assert.equal(state.rackSlots[player.id].length, 1);
      }
    }
  }
});

test('Lua room rules enforce the same privacy, mistake limits and captain rotation', async () => {
  const lua = await new LuaFactory().createEngine();
  try {
    await lua.doString(await readFile(new URL('../public/bomb-busters/game.lua', import.meta.url), 'utf8'));
    await lua.doString(`
      for count = 2, 5 do
        local players = {}
        for i = 1, count do players[i] = {id = 'p' .. i, name = 'Player ' .. i, seat = i} end
        local state = setup({players = players, match = {randomSeed = '1234'}}).state
        assert(state.detonatorLimit == count)
        while state.phase == 'setup_info' do
          local actor = state.setupInfoOrder[state.setupInfoIndex]
          local wire_id
          for _, id in ipairs(state.hands[actor]) do
            if state.wires[id].kind == 'number' then wire_id = id break end
          end
          assert(on_action(state, {type = 'place_info', wireId = wire_id}, {actor = {id = actor}}).accepted)
        end
        for mistake = 1, count do
          local actor = state.players[state.turn].id
          local source, target
          for _, id in ipairs(state.hands[actor]) do
            if state.wires[id].kind == 'number' then source = id break end
          end
          for _, player in ipairs(players) do
            if player.id ~= actor then
              for _, id in ipairs(state.hands[player.id]) do
                if state.wires[id].kind == 'number' and state.wires[id].value ~= state.wires[source].value then target = id break end
              end
            end
          end
          assert(on_action(state, {type = 'dual_cut', sourceId = source, targetId = target}, {actor = {id = actor}}).accepted)
          assert(state.detonator == mistake)
          assert(state.phase == (mistake == count and 'ended' or 'playing'))
        end
        local captain = state.captainId
        local index
        for i, player in ipairs(players) do if player.id == captain then index = i end end
        state.turn = (index % count) + 1
        local next_index = (index % count) + 1
        state = on_action(state, {type = 'rematch'}, {actor = {id = players[1].id}}).state
        assert(state.captainId == players[next_index].id)
        assert(state.setupInfoOrder[1] == state.captainId)
        if count == 3 then assert(#state.rackSlots[state.captainId] == 2) end
        for _, owner in ipairs(players) do
          for _, id in ipairs(state.hands[owner.id]) do state.clues[id] = true end
          local viewer = owner.id == players[1].id and players[2].id or players[1].id
          local projected = view(state, {}, {viewer = {id = viewer}}).state
          for _, wire in ipairs(projected.hands[owner.id]) do
            assert(not wire.revealed and wire.tileNumber == nil and wire.value == nil and wire.kind == nil)
          end
          for _, rack in ipairs(projected.racks[owner.id]) do
            for _, wire in ipairs(rack) do
              assert(wire.tileNumber == nil)
              if state.wires[wire.id].kind == 'yellow' then assert(wire.infoToken == '黄') end
            end
          end
        end
      end
    `);
  } finally {
    lua.global.close();
  }
});

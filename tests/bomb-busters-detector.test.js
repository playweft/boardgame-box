import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { LuaFactory } from 'wasmoon';
import { createGame, applyAction, projectGame } from '../src/games/bomb-busters/engine.js';

function wire(id, kind, value) {
  return { id, kind, value, tileNumber: kind === 'number' ? String(value) : kind === 'red' ? '2.5' : '2.1' };
}
function fixture(first, second, sourceKind = 'number') {
  const state = createGame([{id:'p0'}, {id:'p1'}, {id:'p2'}], Math.random, 'p0');
  state.phase = 'playing';
  state.wires = { s: wire('s', sourceKind, sourceKind === 'number' ? 2 : null),
    t1: wire('t1', ...first), t2: wire('t2', ...second), k: wire('k', 'number', 9) };
  state.hands = {p0:['s'], p1:['t1','t2'], p2:['k']};
  state.rackSlots = {p0:[['s']], p1:[['t1','t2']], p2:[['k']]};
  return state;
}
function luaValue(value) {
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return '{' + value.map(luaValue).join(',') + '}';
  return '{' + Object.entries(value).map(([key, entry]) => `[${JSON.stringify(key)}]=${luaValue(entry)}`).join(',') + '}';
}

const cases = [
  {name:'one match and red', first:['number',2], second:['red',null], choices:['t1'], success:true},
  {name:'both match: teammate chooses the second', first:['number',2], second:['number',2], choices:['t1','t2'], success:true},
  {name:'neither matches: teammate chooses a clue', first:['number',3], second:['number',4], choices:['t1','t2'], success:false},
  {name:'one red on failure is safe', first:['red',null], second:['yellow',null], choices:['t2'], success:false},
  {name:'both red explode', first:['red',null], second:['red',null], explode:true},
  {name:'yellow matches without comparing decimals', first:['yellow',null], second:['number',3], sourceKind:'yellow', choices:['t1'], success:true},
  {name:'failure reaches detonator limit', first:['number',3], second:['number',4], choices:['t1','t2'], success:false, detonator:2},
];

for (const scenario of cases) {
  test(`JS detector: ${scenario.name}`, () => {
    const state = fixture(scenario.first, scenario.second, scenario.sourceKind);
    state.detonator = scenario.detonator || 0;
    const action = {type:'double_detector', sourceId:'s', targetIds:['t1','t2']};
    assert.equal(applyAction(state,'p0',action).accepted,true);
    assert.equal(state.detectorUsed.p0,true);
    if (scenario.explode) {
      assert.equal(state.phase,'ended');
      assert.equal(state.outcome,'failure');
      return;
    }
    const ownerView = projectGame(state,'p1');
    assert.equal(ownerView.currentPlayerId,'p1');
    assert.deepEqual(ownerView.detectorChoice.choiceIds,scenario.choices);
    assert.equal(ownerView.detectorChoice.success,scenario.success);
    assert.equal(ownerView.canUseDetector,false);
    const observerView = projectGame(state,'p2');
    assert.equal(observerView.detectorChoice.choiceIds,undefined);
    assert.equal(observerView.detectorChoice.success,undefined);
    assert.equal(observerView.detectorChoice.sourceId,undefined);
    assert.ok(observerView.hands.p1.every(wire=>!wire.revealed));
    const choice = scenario.choices.at(-1);
    assert.equal(applyAction(state,'p0',{type:'resolve_detector',wireId:choice}).accepted,false);
    assert.equal(applyAction(state,'p1',{type:'dual_cut',sourceId:'t1',targetId:'s'}).accepted,false);
    const invalid = ['s','k','t1','t2'].find(id=>!scenario.choices.includes(id));
    assert.equal(applyAction(state,'p1',{type:'resolve_detector',wireId:invalid}).accepted,false);
    assert.equal(applyAction(state,'p1',{type:'resolve_detector',wireId:choice}).accepted,true);
    assert.equal(state.pendingDetector,null);
    assert.equal(state.detonator,(scenario.detonator || 0)+(scenario.success ? 0 : 1));
    if (scenario.success) {
      assert.deepEqual(state.cutWires.map(wire=>wire.id),['s',choice]);
      assert.ok(state.hands.p1.includes(choice === 't1' ? 't2' : 't1'));
    } else {
      assert.equal(state.clues[choice],true);
      assert.equal(state.cutWires.length,0);
    }
    if (scenario.detonator === 2) assert.equal(state.outcome,'failure');
    else assert.equal(state.players[state.turn].id,'p1');
    state.phase = 'playing'; state.turn = 0;
    assert.equal(applyAction(state,'p0',action).accepted,false);
    state.phase = 'ended';
    assert.deepEqual(applyAction(state,'p0',{type:'rematch'}).state.detectorUsed,{});
  });
}

test('JS detector rejects repeated, own, missing, cross-player and cross-stand targets without consuming use', () => {
  const state = fixture(['number',3],['number',4]);
  for (const targets of [['t1','t1'], ['s','t1'], ['t1','k'], ['t1','missing'], ['t1']]) {
    assert.equal(applyAction(state,'p0',{type:'double_detector',sourceId:'s',targetIds:targets}).accepted,false);
    assert.equal(state.detectorUsed.p0,undefined);
  }
  state.rackSlots.p1 = [['t1'],['t2']];
  assert.equal(applyAction(state,'p0',{type:'double_detector',sourceId:'s',targetIds:['t1','t2']}).accepted,false);
  assert.equal(state.detectorUsed.p0,undefined);
});

test('Lua detector: matching, clues, red safety, privacy, limits and input validation', async () => {
  const lua = await new LuaFactory().createEngine();
  try {
    await lua.doString(await readFile(new URL('../public/bomb-busters/game.lua',import.meta.url),'utf8'));
    for (const scenario of cases) {
      const state = fixture(scenario.first,scenario.second,scenario.sourceKind);
      state.turn = 1;
    state.seed = 1234;
      state.detonator = scenario.detonator || 0;
      const choice = scenario.choices?.at(-1);
      await lua.doString(`
        local state = ${luaValue(state)}
        local action = {type='double_detector',sourceId='s',targetIds={'t1','t2'}}
        local function act(id, action) return on_action(state,action,{actor={id=id}}) end
        assert(act('p0', action).accepted)
        assert(state.detectorUsed.p0)
        ${scenario.explode ? `assert(state.phase == 'ended' and state.outcome == 'failure')` : `
        local own = view(state,{}, {viewer={id='p1'}}).state
        assert(own.currentPlayerId == 'p1' and not own.canUseDetector)
        assert(own.detectorChoice.success == ${scenario.success})
        assert(#own.detectorChoice.choiceIds == ${scenario.choices.length})
        local other = view(state,{}, {viewer={id='p2'}}).state
        assert(other.detectorChoice.choiceIds == nil and other.detectorChoice.success == nil and other.detectorChoice.sourceId == nil)
        for _, wire in ipairs(other.hands.p1) do assert(not wire.revealed and wire.tileNumber == nil) end
        assert(not act('p0',{type='resolve_detector',wireId=${luaValue(choice)}}).accepted)
        assert(not act('p1',{type='dual_cut',sourceId='t1',targetId='s'}).accepted)
        assert(not act('p1',{type='resolve_detector',wireId='k'}).accepted)
        assert(act('p1',{type='resolve_detector',wireId=${luaValue(choice)}}).accepted)
        assert(state.pendingDetector == nil)
        assert(state.detonator == ${(scenario.detonator || 0)+(scenario.success ? 0 : 1)})
        ${scenario.success ? `assert(#state.cutWires == 2 and state.cutWires[2].id == ${luaValue(choice)})` : `assert(#state.cutWires == 0 and state.clues[${luaValue(choice)}])`}
        ${scenario.detonator === 2 ? `assert(state.outcome == 'failure')` : `assert(state.turn == 2)`}
        state.phase = 'playing'; state.turn = 1
        assert(not act('p0',action).accepted)
        state.phase = 'ended'
        assert(next(act('p0',{type='rematch'}).state.detectorUsed) == nil)
        `}
      `);
    }
    const state = fixture(['number',3],['number',4]); state.turn=1;
    await lua.doString(`
      local state = ${luaValue(state)}
      for _, ids in ipairs({{'t1','t1'},{'s','t1'},{'t1','k'},{'t1','missing'},{'t1'}}) do
        assert(not on_action(state,{type='double_detector',sourceId='s',targetIds=ids},{actor={id='p0'}}).accepted)
        assert(not state.detectorUsed.p0)
      end
      state.rackSlots.p1 = {{'t1'},{'t2'}}
      assert(not on_action(state,{type='double_detector',sourceId='s',targetIds={'t1','t2'}},{actor={id='p0'}}).accepted)
      assert(not state.detectorUsed.p0)
    `);
  } finally { lua.global.close(); }
});

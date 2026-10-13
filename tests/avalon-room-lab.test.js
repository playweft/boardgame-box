import assert from "node:assert/strict";
import test from "node:test";
import { createRoomLab } from "../dev/room-lab/runtime.js";
import { normalizeRoomState } from "../src/games/avalon/room-state.js";

const send = (lab, snapshot, actorId, action) =>
  lab.action({ matchId: snapshot.matchId, actorId, action });
const view = (snapshot) => snapshot.views[snapshot.players[0].id];

test("independent local identities get real Lua projections without private state or empty-list crashes", async () => {
  const lab = createRoomLab();
  try {
    for (const count of [5, 10]) {
      const snapshot = await lab.start({ count, seed: "abcd" });
      assert.equal(snapshot.players.length, count);
      assert.equal(
        new Set(snapshot.players.map((player) => player.id)).size,
        count,
      );
      for (const player of snapshot.players) {
        const state = normalizeRoomState(snapshot.views[player.id]);
        assert(state.ownRole);
        for (const key of [
          "selectedTeam",
          "missionTeam",
          "roleHints",
          "missions",
          "proposalHistory",
        ])
          assert(Array.isArray(state[key]));
        assert(!Object.hasOwn(state, "roles"));
        assert(!Object.hasOwn(state, "seed"));
        assert(!Object.hasOwn(state, "votes"));
        assert(
          !Object.hasOwn(state, "finalRoles") || state.finalRoles.length === 0,
        );
      }
      assert.equal(snapshot.views.observer.ownRole, undefined);
      const before = snapshot.version;
      const response = await send(lab, snapshot, "observer", {
        type: "propose",
        players: snapshot.players.slice(0, 2).map((p) => p.id),
      });
      assert.equal(response.result.error.code, "NOT_A_PLAYER");
      assert.equal(response.snapshot.version, before);
    }
  } finally {
    await lab.close();
  }
});

test("Lua handles concurrent ballots once and hides votes until everyone has voted", async () => {
  const lab = createRoomLab();
  try {
    let snapshot = await lab.start({ seed: "abcd" });
    const leader = view(snapshot).leader;
    const wrong = snapshot.players.find((p) => p.id !== leader).id;
    const proposal = {
      type: "propose",
      players: snapshot.players.slice(0, 2).map((p) => p.id),
    };
    const rejected = await send(lab, snapshot, wrong, proposal);
    assert.equal(rejected.result.error.code, "NOT_LEADER");
    assert.equal(rejected.snapshot.version, 0);
    snapshot = (await send(lab, snapshot, leader, proposal)).snapshot;
    const [first, duplicate] = await Promise.all([
      send(lab, snapshot, snapshot.players[0].id, {
        type: "vote",
        approve: true,
      }),
      send(lab, snapshot, snapshot.players[0].id, {
        type: "vote",
        approve: false,
      }),
    ]);
    assert.equal(first.result.accepted, true);
    assert.equal(duplicate.result.error.code, "ALREADY_VOTED");
    assert.equal(first.snapshot.version, duplicate.snapshot.version);
    assert.equal(first.snapshot.views[snapshot.players[0].id].ownVote, true);
    assert.equal(first.snapshot.views[snapshot.players[1].id].ownVote, false);
    assert.equal(view(first.snapshot).votes, undefined);
    const rest = await Promise.all(
      snapshot.players
        .slice(1)
        .map((player) =>
          send(lab, snapshot, player.id, { type: "vote", approve: true }),
        ),
    );
    snapshot = rest.at(-1).snapshot;
    assert.equal(view(snapshot).phase, "mission");
    assert.equal(view(snapshot).votePassed, true);
    assert.equal(view(snapshot).proposalHistory[0].leader, leader);
    assert.equal(Object.keys(view(snapshot).votes).length, 5);
    assert.equal(snapshot.version, 6);
  } finally {
    await lab.close();
  }
});

test("proposal captains stay attached to history after rejections and mission advancement", async () => {
  const lab = createRoomLab();
  try {
    let snapshot = await lab.start({ seed: "abcd" });
    const captains = [];
    const team = snapshot.players.slice(0, 2).map(player => player.id);
    for (const approve of [false, true]) {
      const leader = view(snapshot).leader;
      captains.push(leader);
      snapshot = (await send(lab, snapshot, leader, { type: "propose", players: team })).snapshot;
      for (const player of snapshot.players)
        snapshot = (await send(lab, snapshot, player.id, { type: "vote", approve })).snapshot;
      assert.equal(view(snapshot).proposalHistory.at(-1).leader, leader);
      if (!approve) {
        assert.notEqual(view(snapshot).leader, leader);
        snapshot = (await send(lab, snapshot, leader, { type: "next_proposal" })).snapshot;
      }
    }
    for (const actor of team)
      snapshot = (await send(lab, snapshot, actor, { type: "mission_choice", choice: "success" })).snapshot;
    assert.equal(view(snapshot).quest, 2);
    assert.deepEqual(view(snapshot).proposalHistory.map(item => item.leader), captains);
    assert.notEqual(view(snapshot).leader, captains.at(-1));
  } finally {
    await lab.close();
  }
});

test("only the assassin can interrupt any active phase, then confirm one valid target", async () => {
  const lab = createRoomLab();
  try {
    for (const phase of ["propose", "vote", "vote-result", "mission"]) {
      let snapshot = await lab.start({ seed: "abcd" });
      const assassin = snapshot.players.find(p => snapshot.views[p.id].ownRole.id === "assassin").id;
      const merlin = snapshot.players.find(p => snapshot.views[p.id].ownRole.id === "merlin").id;
      const other = snapshot.players.find(p => ![assassin, merlin].includes(p.id)).id;
      const team = snapshot.players.slice(0, 2).map(p => p.id);
      const act = async (actor, action) => {
        const response = await send(lab, snapshot, actor, action);
        assert.equal(response.result.accepted, true);
        snapshot = response.snapshot;
      };
      const reject = async (actor, action, code) => {
        const response = await send(lab, snapshot, actor, action);
        assert.equal(response.result.error.code, code);
        assert.equal(response.snapshot.version, snapshot.version);
        assert.deepEqual(response.snapshot.views, snapshot.views);
      };
      if (phase !== "propose") {
        await act(view(snapshot).leader, { type: "propose", players: team });
        if (phase === "vote") await act(snapshot.players[0].id, { type: "vote", approve: true });
        else for (const player of snapshot.players) await act(player.id, { type: "vote", approve: phase === "mission" });
        if (phase === "mission") await act(team[0], { type: "mission_choice", choice: "success" });
      }
      assert.equal(view(snapshot).phase, phase);
      await reject("observer", { type: "start_assassination" }, "NOT_A_PLAYER");
      await reject(other, { type: "start_assassination" }, "NOT_ASSASSIN");
      await reject(assassin, { type: "assassinate", target: merlin }, "NOT_ASSASSIN");
      const history = normalizeRoomState({ ...view(snapshot) }).proposalHistory;
      await act(assassin, { type: "start_assassination" });
      for (const state of Object.values(snapshot.views)) {
        assert.equal(state.phase, "assassinate");
        const normalized = normalizeRoomState({ ...state });
        assert.equal(normalized.missions.length, 0);
        assert.deepEqual(normalized.proposalHistory, history);
        assert.equal(state.votes, undefined);
        assert.equal(state.missionActions, undefined);
        assert.equal(state.finalRoles, undefined);
      }
      await reject(assassin, { type: "start_assassination" }, "WRONG_PHASE");
      await reject(other, { type: "assassinate", target: merlin }, "NOT_ASSASSIN");
      for (const target of [assassin, "unknown", null, 1])
        await reject(assassin, { type: "assassinate", target }, "INVALID_TARGET");
      await reject(team[1], { type: "mission_choice", choice: "success" }, "WRONG_PHASE");
      await reject(other, { type: "vote", approve: true }, "WRONG_PHASE");
      const hit = ["propose", "mission"].includes(phase);
      await act(assassin, { type: "assassinate", target: hit ? merlin : other });
      assert.equal(view(snapshot).winner, hit ? "evil" : "good");
      assert.equal(view(snapshot).finalRoles.length, snapshot.players.length);
      await reject(assassin, { type: "start_assassination" }, "WRONG_PHASE");
      await reject(assassin, { type: "assassinate", target: merlin }, "NOT_ASSASSIN");
    }
  } finally {
    await lab.close();
  }
});

test("complete local room replay exercises missions, assassination, rematch, stale rooms and validation", async () => {
  const lab = createRoomLab();
  try {
    let snapshot = await lab.start({ seed: "abcd" });
    for (const size of [2, 3, 2]) {
      const team = snapshot.players.slice(0, size).map((player) => player.id);
      snapshot = (
        await send(lab, snapshot, view(snapshot).leader, {
          type: "propose",
          players: team,
        })
      ).snapshot;
      for (const player of snapshot.players)
        snapshot = (
          await send(lab, snapshot, player.id, { type: "vote", approve: true })
        ).snapshot;
      assert.equal(view(snapshot).phase, "mission");
      assert.equal(Object.keys(view(snapshot).votes).length, snapshot.players.length);
      const outsider = snapshot.players.find(
        (player) => !team.includes(player.id),
      ).id;
      const rejected = await send(lab, snapshot, outsider, {
        type: "mission_choice",
        choice: "success",
      });
      assert.equal(rejected.result.error.code, "NOT_ON_TEAM");
      assert.equal(rejected.snapshot.version, snapshot.version);
      const loyal = team.find(id => snapshot.views[id].ownRole.team === "good");
      if (loyal) {
        const failed = await send(lab, snapshot, loyal, { type: "mission_choice", choice: "fail" });
        assert.equal(failed.result.error.code, "LOYAL_CANNOT_FAIL");
        assert.equal(failed.snapshot.version, snapshot.version);
      }
      snapshot = (await send(lab, snapshot, team[0], { type: "mission_choice", choice: "success" })).snapshot;
      const duplicate = await send(lab, snapshot, team[0], { type: "mission_choice", choice: "success" });
      assert.equal(duplicate.result.error.code, "ALREADY_CHOSEN");
      assert.equal(duplicate.snapshot.version, snapshot.version);
      assert.equal(snapshot.views[team[0]].ownMissionAction, true);
      assert.equal(snapshot.views[team[1]].ownMissionAction, false);
      assert.equal(view(snapshot).missionActions, undefined);
      assert.equal(snapshot.views.observer.missionActions, undefined);
      assert.equal(Object.keys(view(snapshot).votes).length, snapshot.players.length);
      for (const actorId of team.slice(1))
        snapshot = (
          await send(lab, snapshot, actorId, {
            type: "mission_choice",
            choice: "success",
          })
        ).snapshot;
      assert.equal(view(snapshot).lastMission.passed, true);
      assert.equal(view(snapshot).phase, size === 2 && view(snapshot).missions.length === 3 ? "assassinate" : "propose");
    }
    assert.equal(view(snapshot).phase, "assassinate");
    const assassin = snapshot.players.find(
      (player) => snapshot.views[player.id].ownRole.id === "assassin",
    ).id;
    const merlin = snapshot.players.find(
      (player) => snapshot.views[player.id].ownRole.id === "merlin",
    ).id;
    snapshot = (
      await send(lab, snapshot, assassin, {
        type: "assassinate",
        target: merlin,
      })
    ).snapshot;
    assert.equal(view(snapshot).winner, "evil");
    assert.equal(view(snapshot).finalRoles.length, 5);
    snapshot = (await send(lab, snapshot, assassin, { type: "rematch" }))
      .snapshot;
    assert.equal(view(snapshot).phase, "propose");
    assert.equal(view(snapshot).round, 2);
    assert.equal(view(snapshot).finalRoles, undefined);
    await assert.rejects(lab.start({ count: 4 }), /5–10/);
    await assert.rejects(lab.start({ seed: "bad seed" }), /十六进制/);
    assert.equal((await lab.snapshot()).matchId, snapshot.matchId);
    const fresh = await lab.start({ count: 6, seed: "aabb" });
    const stale = await send(lab, snapshot, fresh.players[0].id, {
      type: "rematch",
    });
    assert.equal(stale.result.error.code, "LOCAL_MATCH_CHANGED");
    assert.equal(stale.snapshot.version, 0);
    assert.equal(stale.snapshot.matchId, fresh.matchId);
  } finally {
    await lab.close();
  }
});

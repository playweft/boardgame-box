import { h } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import Dialog from "../../shared/dialog.jsx";
import { createRoleIntroduction } from "./role-introduction.js";
import { factionRoleMarks, loadPlayerRoleMarks, savePlayerRoleMarks } from "./player-role-marks.js";
import { withProposalLeaders } from "./proposal-history.js";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChessRook,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Crown,
  Eye,
  LockKeyhole,
  Moon,
  Plus,
  Scale,
  Shield,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
  X,
} from "lucide";

const iconData = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  check: Check,
  "chess-rook": ChessRook,
  "chevron-right": ChevronRight,
  "circle-help": CircleHelp,
  crosshair: Crosshair,
  crown: Crown,
  eye: Eye,
  "lock-keyhole": LockKeyhole,
  moon: Moon,
  plus: Plus,
  scale: Scale,
  shield: Shield,
  sparkles: Sparkles,
  swords: Swords,
  "thumbs-down": ThumbsDown,
  "thumbs-up": ThumbsUp,
  "wand-sparkles": WandSparkles,
  x: X,
};

function Icon({ name, className = "icon" }) {
  const nodes = iconData[name] || [];
  return (
    <svg
      className={"lucide lucide-" + name + " " + className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {nodes.map(([tag, attributes], index) => {
        const props = Object.fromEntries(
          Object.entries(attributes).map(([key, value]) => [
            key === "class"
              ? "className"
              : key.replace(/-([a-z])/g, (_match, letter) =>
                letter.toUpperCase(),
              ),
            value,
          ]),
        );
        return h(tag, { ...props, key: index });
      })}
    </svg>
  );
}

function Shell({ children }) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="back-link" href="../../" aria-label="返回桌游盒">
          <Icon name="arrow-left" />
        </a>
        <div className="topbar-title">阿瓦隆</div>
      </header>
      {children}
    </div>
  );
}

function RoleTags({ count, roles, goodCounts, evilCounts }) {
  const good = ["merlin"];
  if (count >= 6) good.push("percival");
  while (good.length < goodCounts[count]) good.push("servant");
  const evil = ["assassin"];
  if (count >= 5) evil.push("morgana");
  if (count >= 7) evil.push("mordred");
  if (count === 10) evil.push("oberon");
  return good.concat(evil).map((role) => (
    <span className={"role-tag " + roles[role].team} key={role}>
      <Icon name={roles[role].icon} />
      {roles[role].name}
    </span>
  ));
}

function SetupPage({ state, questSizes, goodCounts, evilCounts, roles }) {
  const count = state.playerCount;
  return (
    <main className="setup-view">
      <section className="setup-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / 玩家</p>
            <h2>谁来加入这场冒险？</h2>
          </div>
          <label className="count-picker">
            <span>人数</span>
            <select id="player-count" aria-label="选择玩家人数" value={count}>
              {[5, 6, 7, 8, 9, 10].map((value) => (
                <option value={value} key={value}>
                  {value} 人
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="name-grid">
          {state.setupNames.map((name, index) => (
            <label className="name-field" key={index}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <input
                data-player-name={index}
                maxLength={16}
                value={name}
                aria-label={"玩家 " + (index + 1) + " 名称"}
              />
            </label>
          ))}
        </div>
        <div className="setup-divider" />
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">02 / 配置</p>
            <h2>本局身份</h2>
          </div>
          <span className="team-count">
            <b>{goodCounts[count]}</b> 忠诚 <i>·</i> <b>{evilCounts[count]}</b>{" "}
            邪恶
          </span>
        </div>
        <div className="role-preview">
          <RoleTags
            count={count}
            roles={roles}
            goodCounts={goodCounts}
            evilCounts={evilCounts}
          />
        </div>
        <div className="section-heading compact mission-heading">
          <div>
            <p className="eyebrow">03 / 任务</p>
            <h2>任务队伍人数</h2>
          </div>
          <span className="five-rejects">连续 5 次组队失败，邪恶获胜</span>
        </div>
        <div className="quest-list">
          {questSizes[count].map((size, index) => (
            <div className="quest-chip" key={index}>
              <span>任务 {index + 1}</span>
              <strong>{size} 人</strong>
              {count >= 7 && index === 3 && <small>需 2 张失败</small>}
            </div>
          ))}
        </div>
        <button className="primary-button full-button" data-action="start-game">
          洗牌并开始 <Icon name="arrow-up-right" />
        </button>
        <p className="privacy-note">
          身份只在你确认查看时显示。开始前请把屏幕交给对应玩家。
        </p>
      </section>
      <details className="rules-summary">
        <summary>快速规则</summary>
        <p>
          好人完成 3 个任务即可进入刺杀阶段；刺客若刺中梅林，邪恶获胜。邪恶完成
          3 个任务也会获胜。任务队伍全员秘密出牌，至少 1 张失败牌会让任务失败；7
          人及以上的第 4 个任务需要至少 2 张失败牌。
        </p>
      </details>
    </main>
  );
}

function RevealPage({ state, roles, roleInfo }) {
  const player = state.players[state.revealIndex];
  const count = state.players.length;
  const progress = ((state.revealIndex + 1) / count) * 100;
  return (
    <main className="play-view reveal-view">
      <div className="progress-label">
        身份确认{" "}
        <span>
          {state.revealIndex + 1} / {count}
        </span>
      </div>
      <div className="progress-track">
        <i style={{ width: progress + "%" }} />
      </div>
      <div className="reveal-wrap">
        {state.roleShown ? (
          <div className={"secret-card " + roles[player.role].team}>
            <span className="secret-icon">
              <Icon name={roles[player.role].icon} />
            </span>
            <p className="eyebrow">你的身份</p>
            <h2>{roles[player.role].name}</h2>
            <p className="role-description">{roles[player.role].description}</p>
            <div className="secret-info">
              <span>你的线索</span>
              <p>{roleInfo(state.revealIndex)}</p>
            </div>
            <button
              className="primary-button full-button"
              data-action="hide-and-next"
            >
              记住了，隐藏并传给下一位 <Icon name="arrow-right" />
            </button>
          </div>
        ) : (
          <div className="privacy-card">
            <span className="privacy-lock">
              <Icon name="lock-keyhole" />
            </span>
            <h2>请交给 {player.name}</h2>
            <p>确认只有你能看到屏幕，再查看身份。不要向其他玩家展示。</p>
            <button className="primary-button" data-action="show-role">
              查看我的身份 <Icon name="arrow-up-right" />
            </button>
          </div>
        )}
      </div>
      <p className="privacy-note">
        身份阶段结束后，请将手机放在所有人都能看到的位置。
      </p>
    </main>
  );
}

function QuestTrack({ count, missions, quest, questSizes, proposal, stage, navigation = false, activeQuestIndex, onSelect }) {
  return (
    <>
      <div className={"quest-track-group" + (navigation ? " quest-overlay-track" : "")}>
        <div className="quest-track" role={navigation ? "tablist" : undefined} aria-label={navigation ? "切换任务" : undefined}>
          {questSizes[count].map((questSize, index) => {
            const result = missions[index];
            const protectedRound = count >= 7 && index === 3;
            const status = result
              ? result.passed
                ? "passed"
                : "failed"
              : index === quest
                ? "current"
                : "waiting";
            return (
              <button
                className={"track-item " + status}
                data-action="open-quest-details"
                data-index={index}
                key={index}
                type="button"
                role={navigation ? "tab" : undefined}
                id={navigation ? `quest-tab-${index}` : undefined}
                aria-label={navigation ? `任务 ${index + 1}` : "查看任务 " + (index + 1) + " 详情"}
                aria-selected={navigation ? activeQuestIndex === index : undefined}
                aria-controls={navigation ? "quest-details-panel" : undefined}
                tabIndex={navigation ? (activeQuestIndex === index ? 0 : -1) : undefined}
                autoFocus={navigation && activeQuestIndex === index}
                aria-describedby={[
                  protectedRound && `quest-protection-${navigation ? "tab-" : ""}${index}`,
                  result && `quest-result-${navigation ? "tab-" : ""}${index}`,
                ].filter(Boolean).join(" ") || undefined}
                title={`任务 ${index + 1} · ${result ? result.passed ? "成功" : "失败" : `需要 ${questSize} 人`}${protectedRound ? " · 保护轮，需 2 张失败票" : ""}`}
                onKeyDown={navigation ? event => {
                  const steps = { ArrowLeft: -1, ArrowRight: 1 };
                  let next;
                  if (event.key in steps) next = (index + steps[event.key] + 5) % 5;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = 4;
                  else return;
                  event.preventDefault();
                  onSelect(next);
                  event.currentTarget.closest(".quest-track").querySelector(`[data-index="${next}"]`).focus();
                } : undefined}
              >
                <span className={"track-mark" + (protectedRound ? " is-protected" : "")}>
                  {protectedRound && (
                    <svg className="track-shield" viewBox="0 0 36 36" id={`quest-protection-${navigation ? "tab-" : ""}${index}`} role="img" aria-label="保护轮，需 2 张失败票">
                      <path d="M18 -2.75C22.75 0.25 28.25 2 33.5 2.5Q35 2.65 35 4.2V15.8C35 24.7 28.5 31.3 18.75 35.1Q18 35.45 17.25 35.1C7.5 31.3 1 24.7 1 15.8V4.2Q1 2.65 2.5 2.5C7.75 2 13.25 0.25 18 -2.75Z" />
                    </svg>
                  )}
                  <span
                    className="track-count"
                    id={result ? `quest-result-${navigation ? "tab-" : ""}${index}` : undefined}
                    role={result ? "img" : undefined}
                    aria-label={result ? result.passed ? "任务成功" : "任务失败" : undefined}
                  >
                    {result ? <Icon name={result.passed ? "check" : "x"} /> : questSize}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {!navigation && <p className="quest-track-caption">
        <span>第 {quest + 1} 轮</span>
        {proposal && <span>提案 {proposal}</span>}
        <span>{stage}</span>
      </p>}
    </>
  );
}

function QuestDetailsDialog({
  open,
  count,
  questIndex,
  questSizes,
  players,
  proposals,
  missions,
  onClose,
  onSelect,
  currentQuest,
  phase,
  currentTeam,
  currentLeader,
}) {
  const [trackTop, setTrackTop] = useState(76);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const track = document.querySelector(".quest-track-group:not(.quest-overlay-track)");
      if (!track) return;
      setTrackTop(track.getBoundingClientRect().top);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, count]);
  const questNumber = questIndex + 1;
  const requiredPlayers = questSizes[count]?.[questIndex] || 0;
  const protectedRound = count >= 7 && questIndex === 3;
  const mission = missions.find((item) => item.number === questNumber);
  const questProposals = withProposalLeaders(proposals, players, currentLeader, phase).filter(
    (proposal) => proposal.quest === questNumber,
  );
  if (phase === "vote" && questIndex === currentQuest) {
    questProposals.push({ team: currentTeam, leader: currentLeader, votes: {}, pending: true });
  }
  const acceptedProposal = questProposals
    .slice()
    .reverse()
    .find((proposal) => proposal.approved);
  const missionTeam = mission?.team || acceptedProposal?.team || [];
  const awaitingMission = !mission && !acceptedProposal;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="quest-overlay"
      aria-labelledby="quest-dialog-title"
      style={{ "--quest-track-top": `${trackTop}px` }}
    >
      <div className="quest-overlay-content">
        <div className="quest-overlay-navigation">
          <QuestTrack count={count} missions={missions} quest={currentQuest} questSizes={questSizes} navigation activeQuestIndex={questIndex} onSelect={onSelect} />
        </div>
        <section className="quest-dialog quest-info-card" id="quest-details-panel" role="tabpanel" aria-labelledby={`quest-tab-${questIndex}`}>
          <header className="quest-dialog-header">
            <h2 id="quest-dialog-title">
              任务 {questNumber}
              {protectedRound && <span className="quest-protection-mark" role="img" aria-label="保护轮，需 2 张失败票" title="保护轮 · 需 2 张失败票"><Icon name="shield" /></span>}
            </h2>
            <button
              className="quest-dialog-close"
              data-action="close-quest-details"
              type="button"
              aria-label="关闭"
            >
              <Icon name="x" />
            </button>
          </header>
          <div className="quest-dialog-content">
            {awaitingMission ? (
              <div className="quest-upcoming-info">
                <p>任务 {questNumber} 需要 {requiredPlayers} 人</p>
                {protectedRound && <p className="quest-upcoming-protection">保护轮，需 2 张失败票才会失败。</p>}
              </div>
            ) : (
              <div className="quest-mission-summary">
                <div className="quest-mission-team" role="group" aria-label="执行队伍">
                  {players.map((player, index) => missionTeam.includes(player.id) && (
                    <span className="player-avatar" role="img" aria-label={`${index + 1} ${player.name}`} key={player.id}>
                      {player.name.slice(0, 1)}
                      {player.avatar && <img src={player.avatar} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
                      <span className="player-number">{index + 1}</span>
                    </span>
                  ))}
                </div>
                {mission && (
                  <div className="quest-mission-result">
                    <div className="quest-mission-ballots" role="img" aria-label={`成功${missionTeam.length - mission.failures}票，失败${mission.failures}票`}>
                      {Array.from({ length: missionTeam.length }, (_, index) => {
                        const success = index < missionTeam.length - mission.failures;
                        return <span className={"quest-mission-ballot " + (success ? "success" : "fail")} aria-hidden="true" key={index}><Icon name={success ? "check" : "x"} /></span>;
                      })}
                    </div>
                    <span className={"quest-mission-outcome " + (mission.passed ? "success" : "fail")}>{mission.passed ? "任务成功" : "任务失败"}</span>
                  </div>
                )}
              </div>
            )}
            {(!awaitingMission || questProposals.length > 0) && (
              <section className="quest-vote-history">
                <h3>任务队伍投票记录</h3>
                {questProposals.length ? (
                  <div className="quest-ballot-table-wrap">
                    <table className="quest-ballot-table" aria-label={`任务 ${questNumber} 队伍投票记录`}>
                      <tbody>
                        {questProposals.map((proposal, proposalIndex) => (
                          <tr key={proposalIndex} aria-label={`提案 ${proposalIndex + 1}`}>
                            {players.map((player, playerIndex) => {
                              const isOnTeam = (proposal.team || []).includes(player.id);
                              const isLeader = proposal.leader === player.id;
                              const vote = Array.isArray(proposal.votes)
                                ? proposal.votes[playerIndex]
                                : proposal.votes?.[player.id];
                              return (
                                <td key={player.id}>
                                  <span
                                    className={
                                      "quest-vote-mark " +
                                      (vote === true
                                        ? "is-yes"
                                        : vote === false
                                          ? "is-no"
                                          : "is-pending") +
                                      (isOnTeam ? " is-team" : "")
                                    }
                                    role="img"
                                    aria-label={
                                      `${playerIndex + 1}` + (vote === true
                                        ? "赞成"
                                        : vote === false
                                          ? "反对"
                                          : proposal.pending ? "待揭晓" : "未投") +
                                      (isOnTeam ? "，队伍成员" : "") +
                                      (isLeader ? "，队长" : "")
                                    }
                                  >
                                    {playerIndex + 1}
                                    {isLeader && <span className="quest-vote-leader" aria-hidden="true"><Icon name="crown" /></span>}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="quest-details-empty">暂无完整的队伍投票记录。</p>
                )}
              </section>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

function PlayerChoices({ state, readOnly = false }) {
  const showVotes = ["vote-result", "mission", "mission-result"].includes(state.phase);
  return (
    <div className={"player-grid" + (readOnly ? " read-only" : "") + (showVotes ? " vote-results" : "")}>
      {state.players.map((player, index) => {
        const selected = (
          readOnly ? state.missionTeam : state.selectedTeam
        ).includes(index);
        const leader = state.leader === index;
        return (
          <button
            className={
              "player-tile" +
              (selected ? " selected" : "") +
              (readOnly && !selected ? " not-selected" : "") +
              (leader ? " is-leader" : "")
            }
            data-action={readOnly ? undefined : "toggle-team"}
            data-index={readOnly ? undefined : index}
            aria-pressed={selected}
            disabled={readOnly}
            key={player.name + index}
          >
            <span className="player-avatar">
              {player.name.slice(0, 1)}
              <span className="player-number">
                {index + 1}
              </span>
              {leader && <LeaderMarker />}
            </span>
            <strong>{player.name}</strong>
            <PlayerTileMarker selected={selected} vote={showVotes ? state.votes[index] : undefined} />
          </button>
        );
      })}
    </div>
  );
}

function PlayerTileMarker({ selected, vote }) {
  if (typeof vote === "boolean") return (
    <span className={"tile-check tile-vote " + (vote ? "approve" : "reject")} role="img" aria-label={vote ? "赞成" : "反对"}>
      <Icon name={vote ? "thumbs-up" : "thumbs-down"} />
    </span>
  );
  return selected ? <span className="tile-check"><Icon name="check" /></span> : null;
}

function LeaderMarker() {
  return (
    <span className="leader-marker" role="img" aria-label="队长">
      <Icon name="crown" className="icon leader-crown" />
    </span>
  );
}

function ProposePage({ state, questSizes }) {
  const required = questSizes[state.players.length][state.quest];
  return (
    <main className="play-view">
      <QuestTrack
        count={state.players.length}
        missions={state.missions}
        quest={state.quest}
        questSizes={questSizes}
        proposal={state.rejections + 1}
        stage="队伍提名"
      />
      <section className="phase-panel">
        <PlayerChoices state={state} />
        <button
          className="primary-button full-button"
          data-action="submit-team"
          disabled={state.selectedTeam.length !== required}
        >
          提名 {required} 人 <Icon name="arrow-right" />
        </button>
      </section>
      <details className="rules-summary in-game-rules">
        <summary>游戏规则</summary>
        <p>
          全体表决队伍；赞成票必须过半才会出发。队伍成员秘密选成功或失败，忠诚玩家只能选成功。好人完成三个任务后，刺客可猜测梅林。
        </p>
      </details>
    </main>
  );
}

function VoteButtons() {
  return (
    <div className="vote-buttons">
      <button
        className="vote-button reject"
        data-action="cast-vote"
        data-value="no"
      >
        <span>
          <Icon name="thumbs-down" />
        </span>
        <strong>反对</strong>
      </button>
      <button
        className="vote-button approve"
        data-action="cast-vote"
        data-value="yes"
      >
        <span>
          <Icon name="thumbs-up" />
        </span>
        <strong>赞成</strong>
      </button>
    </div>
  );
}

function VotePage({ state, playerName, questSizes }) {
  const showVotes = ["vote-result", "mission", "mission-result"].includes(state.phase);
  const currentIndex = state.voteOrder[state.voteIndex];
  const rejectedOut = !state.approved && state.rejections >= 5;
  return (
    <main className="play-view">
      <QuestTrack
        count={state.players.length}
        missions={state.missions}
        quest={state.quest}
        questSizes={questSizes}
        proposal={showVotes ? state.proposalHistory.filter(item => item.quest === state.quest + 1).length : state.rejections + 1}
        stage="队伍表决"
      />
      <section className="phase-panel">
        <PlayerChoices state={state} readOnly />
        {showVotes ? (
          <>
            <VoteSummary approved={state.approved} votes={state.votes} />
            <button className="primary-button full-button" data-action="continue-vote">
              {rejectedOut ? "查看游戏结果" : "下一位队长提名"} <Icon name="arrow-right" />
            </button>
          </>
        ) : (
          <>
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">秘密表决 · 请交接手机</p>
                <h2>轮到 {playerName(currentIndex)}</h2>
              </div>
              <span className="selection-count"><b>{state.missionTeam.length}</b> 人</span>
            </div>
            <VoteButtons />
          </>
        )}
      </section>
    </main>
  );
}

function VoteSummary({ approved, votes }) {
  const ballots = Object.values(votes || {}).filter(vote => typeof vote === "boolean");
  const yesCount = ballots.filter(Boolean).length;
  return (
    <div className="vote-summary" role="status">
      <h2 className="room-vote-prompt">{approved ? "表决通过" : "表决未通过"}</h2>
      <p>赞成 {yesCount} 票 · 反对 {ballots.length - yesCount} 票</p>
    </div>
  );
}

function MissionButtons({ isEvil, roomMode = false }) {
  // Keep each player's random order stable while this mission is on screen.
  const [choices] = useState(() => Math.random() < 0.5 ? ["success", "fail"] : ["fail", "success"]);
  return (
    <div className="mission-buttons">
      {choices.map(choice => (
        <button
          className={"mission-button " + choice}
          data-action={roomMode ? undefined : "cast-mission"}
          data-room-action={roomMode ? "mission-choice" : undefined}
          data-value={choice}
          disabled={choice === "fail" && !isEvil}
          key={choice}
        >
          <span>
            <Icon name={choice === "success" ? "check" : "x"} />
          </span>
          <strong>{choice === "success" ? "任务成功" : "任务失败"}</strong>
        </button>
      ))}
    </div>
  );
}

function MissionPage({ state, roles, playerName, questSizes }) {
  const completed = state.phase === "mission-result";
  const playerIndex = state.missionOrder[state.missionIndex];
  const isEvil = !completed && roles[state.players[playerIndex].role].team === "evil";
  return (
    <main className="play-view">
      <QuestTrack
        count={state.players.length}
        missions={state.missions}
        quest={state.quest}
        questSizes={questSizes}
        proposal={state.proposalHistory.filter(item => item.quest === state.quest + 1).length}
        stage={completed ? "任务结果" : "执行任务"}
      />
      <section className="phase-panel">
        <PlayerChoices state={state} readOnly />
        {completed ? (
          <>
            <MissionSummary mission={state.missions[state.missions.length - 1]} />
            <button className="primary-button full-button" data-action="continue-mission">
              继续游戏 <Icon name="arrow-right" />
            </button>
          </>
        ) : (
          <>
            <div className="vote-summary">
              <h2 className="room-vote-prompt">执行任务</h2>
              <p>请交接手机 · 轮到 {playerName(playerIndex)}</p>
            </div>
            <MissionButtons key={`${state.quest}:${playerIndex}`} isEvil={isEvil} />
          </>
        )}
      </section>
    </main>
  );
}

function MissionSummary({ mission }) {
  return (
    <div className="vote-summary" role="status">
      <h2 className="room-vote-prompt">{mission.passed ? "任务成功" : "任务失败"}</h2>
      <p>{mission.failures} 张失败牌 · {mission.threshold} 张失败牌即失败</p>
    </div>
  );
}

function AssassinationPage({ state, playerName, questSizes }) {
  const [selection, setSelection] = useState({ open: false, target: null });
  const assassin = state.players.findIndex(
    (player) => player.role === "assassin",
  );
  const players = state.players.map((player, index) => ({ id: index, name: player.name }));
  return (
    <main className="play-view">
      <QuestTrack count={players.length} missions={state.missions} quest={state.quest} questSizes={questSizes} stage="刺杀阶段" />
      <RoomPlayerTiles roomState={{ players, leader: state.leader, phase: "assassinate" }} selected={[]} mask="none" roomPlayerName={playerName} roomAvatarSource={() => undefined} onSelectPlayer={target => setSelection({ open: true, target })} disabledPlayerId={assassin} />
      <h2 className="room-vote-prompt">选择刺杀目标</h2>
      <AssassinationConfirmDialog open={selection.open} target={selection.target} players={players} roomPlayerName={playerName} roomMode={false} onClose={() => setSelection(previous => ({ ...previous, open: false }))} />
    </main>
  );
}

function GameOverPage({ state, roles }) {
  const goodWon = state.winner === "good";
  return (
    <main className="play-view result-view">
      <section className="result-panel game-over">
        <span
          className={"result-mark " + (goodWon ? "good-mark" : "evil-mark")}
        >
          <Icon name={goodWon ? "crown" : "swords"} />
        </span>
        <p className="eyebrow">
          本局结束 · {goodWon ? "忠诚阵营胜利" : "邪恶阵营胜利"}
        </p>
        <h1>{goodWon ? "亚瑟王的胜利" : "莫德雷德的胜利"}</h1>
        <p className="subtitle">{state.endReason}</p>
        <div className="role-reveal-list">
          {state.players.map((player, index) => (
            <div className="role-result-row" key={player.name + index}>
              <span>{player.name}</span>
              <b className={"role-tag " + roles[player.role].team}>
                {roles[player.role].name}
              </b>
            </div>
          ))}
        </div>
        <button className="primary-button full-button" data-action="restart">
          再开一局 <Icon name="arrow-right" />
        </button>
        <a className="text-link" href="../../">
          返回桌游盒
        </a>
      </section>
    </main>
  );
}

const claimRoleIntroduction = createRoleIntroduction();

function HoldToAssassinate({ disabled, onComplete }) {
  const duration = 1200;
  const timer = useRef(null);
  const progress = useRef(null);
  const releaseAnimation = useRef(null);
  const [holding, setHolding] = useState(false);
  const cancel = () => {
    if (timer.current !== null && progress.current) {
      const scale = new DOMMatrixReadOnly(getComputedStyle(progress.current).transform).a;
      releaseAnimation.current?.cancel();
      releaseAnimation.current = progress.current.animate(
        [{ transform: `scaleX(${scale})` }, { transform: "scaleX(0)" }],
        { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240, easing: "ease-out" },
      );
    }
    window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (disabled || timer.current !== null) return;
    releaseAnimation.current?.cancel();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onComplete();
    }, duration);
  };
  useEffect(() => {
    const onVisibilityChange = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer.current);
      releaseAnimation.current?.cancel();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  return (
    <button
      className={"assassination-hold" + (holding ? " is-holding" : "")}
      type="button"
      disabled={disabled}
      aria-label="长按发起刺杀"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        start();
      }}
      onPointerMove={event => {
        if (timer.current === null) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onBlur={cancel}
      onContextMenu={event => event.preventDefault()}
      onClick={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        if (!event.repeat) start();
      }}
      onKeyUp={event => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        cancel();
      }}
    >
      <span ref={progress} className="assassination-hold-progress" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
      <span className="assassination-hold-label"><Icon name="swords" />长按发起刺杀</span>
    </button>
  );
}

function AssassinationConfirmDialog({ open, target, players, roomPlayerName, busy, onClose, roomMode = true }) {
  const player = players.find(player => player.id === target);
  if (!player) return null;
  return (
    <Dialog open={open} onClose={() => { if (!busy) onClose(); }} className="quest-dialog assassination-confirm-dialog" role="alertdialog" aria-labelledby="assassination-confirm-prompt">
      <p className="assassination-confirm-prompt" id="assassination-confirm-prompt">确认刺杀 <span className="player-number assassination-confirm-number">{players.indexOf(player) + 1}</span> {roomPlayerName(target)}？</p>
      <div className="assassination-confirm-actions">
        <button type="button" disabled={busy} onClick={onClose}>取消</button>
        <button type="button" disabled={busy} data-room-action={roomMode ? "assassinate" : undefined} data-player-id={roomMode ? target : undefined} data-action={roomMode ? undefined : "choose-assassin"} data-index={roomMode ? undefined : target}>刺杀</button>
      </div>
    </Dialog>
  );
}

function RoomRoleCard({ roomState, roomMatchId, playerId, roles, roomPlayerName, roomBusy, onStartAssassination }) {
  const [open, setOpen] = useState(false);
  const role = roomState.ownRole;
  const hasRole = Boolean(role);
  const finished = roomState.phase === "game-over";
  useEffect(() => {
    setOpen(claimRoleIntroduction({ matchId: roomMatchId, round: roomState.round, playerId, hasRole, finished }));
  }, [roomMatchId, roomState.round, playerId, hasRole, finished]);
  useEffect(() => {
    if (["assassinate", "game-over"].includes(roomState.phase)) setOpen(false);
  }, [roomState.phase]);
  const hintNames = (roomState.roleHints || []).map(roomPlayerName);
  let hint = "你没有额外的身份线索。";
  if (role?.id === "merlin")
    hint = hintNames.length
      ? "你看见的邪恶势力：" + hintNames.join("、") + "。"
      : "你没有看见其他邪恶玩家。";
  if (role?.id === "percival")
    hint = "梅林候选人：" + hintNames.join("、") + "。其中可能有莫甘娜。";
  if (role?.team === "evil" && role.id !== "oberon")
    hint = hintNames.length
      ? "你认识的邪恶队友：" + hintNames.join("、") + "。"
      : "没有其他邪恶玩家与你互认。";
  if (role?.id === "oberon")
    hint = "你不知道其他邪恶玩家是谁；他们也不知道你属于邪恶阵营。";
  const roleDescription = roles[role?.id]?.description || "";
  return (
    <div className="room-role-card">
      <button className="room-role-trigger" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="room-role-label">
          <Icon name="eye" />
          {role ? "查看身份" : "观战信息"}
        </span>
        <Icon name="chevron-right" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="quest-dialog room-role-dialog" aria-labelledby="room-role-title">
        <header className="quest-dialog-header">
          <h2 id="room-role-title">{role ? "查看身份" : "观战信息"}</h2>
          <button className="quest-dialog-close" type="button" aria-label="关闭身份" onClick={() => setOpen(false)}><Icon name="x" /></button>
        </header>
        <div className="quest-dialog-content room-role-content">
          {role ? <><h3 className="room-role-name">{role.name}</h3><p className="room-role-description">{roleDescription}</p><p className="room-role-hint">{hint}</p></>
            : <p className="room-role-description">你是旁观者，没有玩家身份，可查看任务进展，无法提交游戏操作。</p>}
          {role?.id === "assassin" && !finished && roomState.phase !== "assassinate" && (
            <HoldToAssassinate disabled={roomBusy || !open} onComplete={async () => { if (await onStartAssassination()) setOpen(false); }} />
          )}
        </div>
      </Dialog>
    </div>
  );
}

function RoomTrack({ roomState, questSizes }) {
  return (
    <QuestTrack
      count={roomState.players.length}
      missions={roomState.missions}
      quest={roomState.quest - 1}
      questSizes={questSizes}
      proposal={["vote-result", "mission", "mission-result"].includes(roomState.phase) ? roomState.proposalHistory.filter(item => item.quest === roomState.quest).length : roomState.consecutiveRejections + 1}
      stage={roomState.phase === "propose" ? "队伍提名" : roomState.phase === "mission" ? "执行任务" : roomState.phase === "mission-result" ? "任务结果" : roomState.phase === "assassinate" ? "刺杀阶段" : "队伍表决"}
    />
  );
}

function RoomPlayerTiles({
  roomState,
  selected,
  action,
  mask = action ? "none" : "unselected",
  roomPlayerName,
  roomAvatarSource,
  marks = {},
  roles,
  onMarkPlayer,
  onSelectPlayer,
  disabledPlayerId,
}) {
  const showVotes = ["vote-result", "mission", "mission-result"].includes(roomState.phase);
  const canMark = !action && !onSelectPlayer && Boolean(onMarkPlayer);
  return (
    <div className={"player-grid" + (!action && !canMark ? " read-only" : "") + (showVotes ? " vote-results" : "")}>
      {roomState.players.map((player, index) => {
        const isSelected = selected.includes(player.id);
        const isLeader = player.id === roomState.leader;
        const isMasked = (onSelectPlayer && player.id === disabledPlayerId) || (mask === "non-leader"
          ? !isLeader
          : mask === "unselected" && !isSelected);
        const canSelect = onSelectPlayer && player.id !== disabledPlayerId;
        const playerName = roomPlayerName(player.id) || "玩家 " + (index + 1);
        const avatarSource = roomAvatarSource(player.id);
        const markedRole = roles?.[marks[player.id]] || factionRoleMarks[marks[player.id]];
        return (
          <button
            className={
              "player-tile" +
              (isSelected ? " selected" : "") +
              (isMasked ? " not-selected" : "") +
              (isLeader ? " is-leader" : "")
            }
            data-room-action={action}
            data-player-id={player.id}
            aria-pressed={canMark || onSelectPlayer ? undefined : isSelected}
            aria-haspopup={canMark || canSelect ? "dialog" : undefined}
            onClick={canSelect ? () => onSelectPlayer(player.id) : canMark ? () => onMarkPlayer(player.id) : undefined}
            disabled={onSelectPlayer ? !canSelect : !canMark && (!action || isMasked)}
            key={player.id}
          >
            <span className="player-avatar">
              <span>{playerName.slice(0, 1)}</span>
              {avatarSource && (
                <img
                  alt=""
                  key={avatarSource}
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                  src={avatarSource}
                />
              )}
              <span className="player-number">
                {index + 1}
              </span>
              {isLeader && <LeaderMarker />}
            </span>
            <strong>{playerName}</strong>
            {markedRole && <span className={"player-role-mark " + markedRole.team} aria-label={`标记身份：${markedRole.name}`}><Icon name={markedRole.icon} />{markedRole.name}</span>}
            <PlayerTileMarker selected={isSelected} vote={showVotes ? roomState.votes?.[player.id] : undefined} />
          </button>
        );
      })}
    </div>
  );
}

function PlayerRoleMarkDialog({ open, target, players, marks, roles, roomPlayerName, roomAvatarSource, onClose, onMark }) {
  const player = players.find(player => player.id === target);
  if (!player) return null;
  const name = roomPlayerName(target);
  const avatar = roomAvatarSource(target);
  const markDefinitions = { ...roles, ...factionRoleMarks };
  const markGroups = [
    ["good", "merlin", ...(players.length >= 6 ? ["percival"] : []), "servant"],
    ["evil", "assassin", "morgana", ...(players.length >= 7 ? ["mordred"] : []), ...(players.length === 10 ? ["oberon"] : [])],
  ];
  return (
    <Dialog open={open} onClose={onClose} className="quest-dialog player-mark-dialog" aria-labelledby="player-mark-title">
      <header className="quest-dialog-header">
        <h2 id="player-mark-title">标记身份</h2>
        <button className="quest-dialog-close" type="button" aria-label="关闭身份标记" onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="quest-dialog-content player-mark-content">
        <div className="player-mark-target">
          <span className="player-mark-avatar">
            {name.slice(0, 1)}
            {avatar && <img src={avatar} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
            <span className="player-number">{players.indexOf(player) + 1}</span>
          </span>
          <div><h3>{name}</h3><p>标记仅自己可见</p></div>
        </div>
        <div className="player-mark-options">
          {markGroups.map((group, index) => (
            <div className="player-mark-group" role="group" aria-label={index === 0 ? "正义阵营标记" : "邪恶阵营标记"} key={index}>
              {group.map(id => <button className={"player-mark-option " + markDefinitions[id].team} type="button" aria-pressed={marks[target] === id} onClick={() => onMark(id)} key={id}><Icon name={markDefinitions[id].icon} /><span>{markDefinitions[id].name}</span></button>)}
            </div>
          ))}
        </div>
        <button className="player-mark-clear" type="button" disabled={!marks[target]} onClick={() => onMark(null)}>清除标记</button>
      </div>
    </Dialog>
  );
}

function RoomVoteButtons() {
  return (
    <div className="vote-buttons">
      <button
        className="vote-button reject"
        data-room-action="vote"
        data-value="no"
      >
        <span>
          <Icon name="thumbs-down" />
        </span>
        <strong>反对</strong>
      </button>
      <button
        className="vote-button approve"
        data-room-action="vote"
        data-value="yes"
      >
        <span>
          <Icon name="thumbs-up" />
        </span>
        <strong>赞成</strong>
      </button>
    </div>
  );
}

function RoomMissionButtons({ roomState, playerId }) {
  const isOnTeam = roomState.missionTeam.includes(playerId);
  const myRole = roomState.ownRole;
  if (!isOnTeam || roomState.ownMissionAction) return null;
  return (
    <MissionButtons
      key={`${roomState.round}:${roomState.quest}:${playerId}`}
      isEvil={myRole?.team === "evil"}
      roomMode
    />
  );
}

function RoomPage({
  roomContext,
  roomMatchId,
  roomState,
  roomError,
  roomBusy,
  roomTeam,
  questSizes,
  roles,
  roomPlayerName,
  roomAvatarSource,
  onStartAssassination,
}) {
  const markScope = { matchId: roomMatchId, round: roomState?.round, playerId: roomContext.playerId };
  const [marks, setMarks] = useState(() => loadPlayerRoleMarks(markScope, (roomState?.players || []).map(player => player.id), Object.keys(roles)));
  const [markDialog, setMarkDialog] = useState({ open: false, target: null });
  const [assassination, setAssassination] = useState({ open: false, target: null });
  const closeMarkDialog = () => setMarkDialog(previous => ({ ...previous, open: false }));
  const markRole = roleId => {
    setMarks(previous => {
      const next = { ...previous };
      if (roleId) next[markDialog.target] = roleId;
      else delete next[markDialog.target];
      savePlayerRoleMarks(markScope, next);
      return next;
    });
    closeMarkDialog();
  };
  if (!roomState) {
    return (
      <main className="play-view waiting-room">
        <span className="privacy-lock">
          <Icon name="circle-help" />
        </span>
        <h1>等待房间开始</h1>
        <p className="subtitle">房间连接成功，等待 Playweft 发来对局状态。</p>
        {roomError && (
          <div className="room-error" role="alert">
            {roomError}
          </div>
        )}
      </main>
    );
  }

  const playerId = roomContext.playerId;
  const myRole = roomState.ownRole;
  const onMarkPlayer = myRole ? target => setMarkDialog({ open: true, target }) : undefined;
  const track = <RoomTrack roomState={roomState} questSizes={questSizes} />;
  let content = null;

  if (roomState.phase === "propose") {
    const required = questSizes[roomState.players.length][roomState.quest - 1];
    const isLeader = roomState.leader === playerId;
    const teamComplete = roomTeam.length >= required;
    const mask = isLeader ? (teamComplete ? "unselected" : "none") : "non-leader";
    content = (
      <>
        {track}
        <section className="phase-panel">
          <RoomPlayerTiles
            roomState={roomState}
            selected={isLeader ? roomTeam : roomState.selectedTeam}
            action={isLeader ? "toggle-team" : undefined}
            mask={mask}
            roomPlayerName={roomPlayerName}
            roomAvatarSource={roomAvatarSource}
            marks={marks}
            roles={roles}
            onMarkPlayer={isLeader ? undefined : onMarkPlayer}
          />
          {isLeader ? (
            <button
              className="primary-button full-button"
              data-room-action="propose"
              disabled={roomTeam.length !== required || roomBusy}
            >
              提名 {required} 人 <Icon name="arrow-right" />
            </button>
          ) : (
            <div className="private-prompt">
              <p className="eyebrow">等待队长提名</p>
            </div>
          )}
        </section>
      </>
    );
  } else if (["vote", "vote-result", "mission", "mission-result"].includes(roomState.phase)) {
    const completed = roomState.phase === "mission-result";
    const executing = roomState.phase === "mission" || (roomState.phase === "vote-result" && roomState.votePassed);
    const showVotes = roomState.phase !== "vote";
    const isOnTeam = roomState.missionTeam.includes(playerId);
    content = (
      <>
        {track}
        <section className="phase-panel">
          <RoomPlayerTiles
            roomState={roomState}
            selected={roomState.selectedTeam}
            roomPlayerName={roomPlayerName}
            roomAvatarSource={roomAvatarSource}
            marks={marks}
            roles={roles}
            onMarkPlayer={onMarkPlayer}
          />
          {completed ? (
            <>
              <MissionSummary mission={roomState.lastMission} />
              <button className="primary-button full-button" data-room-action="dismiss-mission-result">
                继续游戏 <Icon name="arrow-right" />
              </button>
            </>
          ) : executing ? (
            <>
              <h2 className="room-vote-prompt">
                {isOnTeam ? roomState.ownMissionAction ? "你的选择已锁定" : "执行任务" : "等待任务结果"}
              </h2>
              <RoomMissionButtons roomState={roomState} playerId={playerId} />
            </>
          ) : showVotes ? (
            <>
              <VoteSummary approved={roomState.votePassed} votes={roomState.votes} />
              <button
                className="primary-button full-button"
                data-room-action="next-proposal"
                disabled={roomBusy}
              >
                下一位队长提名 <Icon name="arrow-right" />
              </button>
            </>
          ) : (
            <>
              <h2 className="room-vote-prompt">
                {roomState.ownVote ? "你的选择已锁定" : "同意这支队伍？"}
              </h2>
              {!roomState.ownVote && <RoomVoteButtons />}
            </>
          )}
        </section>
      </>
    );
  } else if (roomState.phase === "assassinate") {
    const isAssassin = myRole?.id === "assassin";
    content = (
      <>
        {track}
        <section className="phase-panel">
          <RoomPlayerTiles
            roomState={roomState}
            selected={[]}
            mask="none"
            roomPlayerName={roomPlayerName}
            roomAvatarSource={roomAvatarSource}
            marks={marks}
            roles={roles}
            onMarkPlayer={isAssassin ? undefined : onMarkPlayer}
            onSelectPlayer={isAssassin ? target => setAssassination({ open: true, target }) : undefined}
            disabledPlayerId={isAssassin ? playerId : undefined}
          />
          <h2 className="room-vote-prompt">{isAssassin ? "选择刺杀目标" : "等待刺客选择目标"}</h2>
        </section>
      </>
    );
  } else if (roomState.phase === "game-over") {
    const goodWon = roomState.winner === "good";
    content = (
      <section className="result-panel game-over">
        <span
          className={"result-mark " + (goodWon ? "good-mark" : "evil-mark")}
        >
          <Icon name={goodWon ? "crown" : "swords"} />
        </span>
        <p className="eyebrow">
          本局结束 · {goodWon ? "忠诚阵营胜利" : "邪恶阵营胜利"}
        </p>
        <h1>{goodWon ? "亚瑟王的胜利" : "莫德雷德的胜利"}</h1>
        <p className="subtitle">{roomState.endReason || ""}</p>
        <div className="role-reveal-list">
          {(roomState.finalRoles || []).map((player) => (
            <div className="role-result-row" key={player.playerId}>
              <span>{roomPlayerName(player.playerId)}</span>
              <b className={"role-tag " + player.team}>{player.roleName}</b>
            </div>
          ))}
        </div>
        <button
          className="primary-button full-button"
          data-room-action="rematch"
        >
          再开一局 <Icon name="arrow-right" />
        </button>
      </section>
    );
  }

  return (
    <main className="play-view room-view">
      {roomError && (
        <div className="room-error" role="alert">
          {roomError}
        </div>
      )}
      {content}
      <RoomRoleCard
        key={`${playerId}:${roomState.round}:${myRole?.id || "observer"}`}
        roomState={roomState}
        roomMatchId={roomMatchId}
        playerId={playerId}
        roles={roles}
        roomPlayerName={roomPlayerName}
        roomBusy={roomBusy}
        onStartAssassination={onStartAssassination}
      />
      <AssassinationConfirmDialog open={assassination.open && roomState.phase === "assassinate"} target={assassination.target} players={roomState.players} roomPlayerName={roomPlayerName} busy={roomBusy} onClose={() => setAssassination(previous => ({ ...previous, open: false }))} />
      <PlayerRoleMarkDialog open={markDialog.open} target={markDialog.target} players={roomState.players} marks={marks} roles={roles} roomPlayerName={roomPlayerName} roomAvatarSource={roomAvatarSource} onClose={closeMarkDialog} onMark={markRole} />
    </main>
  );
}

export default function AvalonApp(props) {
  const {
    state,
    roomContext,
    roomState,
    roomError,
    roomBusy,
    roomTeam,
    roles,
    goodCounts,
    evilCounts,
    questSizes,
    playerName,
    roleInfo,
    roomPlayerName,
    questDetails,
    onCloseQuestDetails,
    onSelectQuestDetails,
  } = props;
  let page;

  if (roomContext?.mode === "room") {
    page = <RoomPage {...props} key={JSON.stringify([props.roomMatchId, props.roomState?.round, roomContext.playerId])} />;
  } else if (window.parent !== window) {
    page = (
      <main className="play-view waiting-room">
        <span className="privacy-lock">
          <Icon name="circle-help" />
        </span>
        <h1>连接 Playweft</h1>
        <p className="subtitle">
          {roomError || "正在建立安全房间连接，请稍候。"}
        </p>
      </main>
    );
  } else {
    const pages = {
      setup: (
        <SetupPage
          state={state}
          questSizes={questSizes}
          goodCounts={goodCounts}
          evilCounts={evilCounts}
          roles={roles}
        />
      ),
      reveal: <RevealPage state={state} roles={roles} roleInfo={roleInfo} />,
      propose: <ProposePage state={state} questSizes={questSizes} />,
      vote: (
        <VotePage
          state={state}
          playerName={playerName}
          questSizes={questSizes}
        />
      ),
      "vote-result": <VotePage state={state} playerName={playerName} questSizes={questSizes} />,
      mission: (
        <MissionPage state={state} roles={roles} playerName={playerName} questSizes={questSizes} />
      ),
      "mission-result": (
        <MissionPage state={state} roles={roles} playerName={playerName} questSizes={questSizes} />
      ),
      assassinate: <AssassinationPage state={state} playerName={playerName} questSizes={questSizes} />,
      over: <GameOverPage state={state} roles={roles} />,
    };
    page = pages[state.phase];
  }

  const isRoomMode = roomContext?.mode === "room";
  const detailPlayers = isRoomMode
    ? (roomState?.players || []).map((player) => ({
      id: player.id,
      name: roomPlayerName(player.id),
      avatar: props.roomAvatarSource(player.id),
    }))
    : state.players.map((player, index) => ({ id: index, name: player.name }));
  const detailMissions = isRoomMode ? roomState?.missions || [] : state.missions;
  const detailProposals = isRoomMode
    ? roomState?.proposalHistory || []
    : state.proposalHistory;
  const detailCount = isRoomMode
    ? roomState?.players.length || 0
    : state.players.length;

  return (
    <Shell>
      {page}
      {detailCount > 0 && (
        <QuestDetailsDialog
          open={questDetails.open}
          count={detailCount}
          questIndex={questDetails.index}
          questSizes={questSizes}
          players={detailPlayers}
          proposals={detailProposals}
          missions={detailMissions}
          onClose={onCloseQuestDetails}
          onSelect={onSelectQuestDetails}
          currentQuest={isRoomMode ? (roomState?.quest || 1) - 1 : state.quest}
          phase={isRoomMode ? roomState?.phase : state.phase}
          currentTeam={isRoomMode ? roomState?.missionTeam || [] : state.missionTeam}
          currentLeader={isRoomMode ? roomState?.leader : state.leader}
        />
      )}
    </Shell>
  );
}

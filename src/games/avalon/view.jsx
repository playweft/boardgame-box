import { h } from "preact";
import Dialog from "./dialog.jsx";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChessRook,
  CircleHelp,
  Crosshair,
  Crown,
  Eye,
  LockKeyhole,
  Moon,
  Plus,
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
  X,
} from "lucide";

const iconData = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  check: Check,
  "chess-rook": ChessRook,
  "circle-help": CircleHelp,
  crosshair: Crosshair,
  crown: Crown,
  eye: Eye,
  "lock-keyhole": LockKeyhole,
  moon: Moon,
  plus: Plus,
  shield: Shield,
  sparkles: Sparkles,
  swords: Swords,
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

function QuestTrack({ count, missions, quest, questSizes, proposal, stage }) {
  return (
    <>
      <div className="quest-track-group">
        <div className="quest-track">
          {questSizes[count].map((_questSize, index) => {
            const result = missions[index];
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
                aria-label={"查看任务 " + (index + 1) + " 详情"}
              >
                <span className="track-mark">
                  {result && <Icon name={result.passed ? "check" : "x"} />}
                </span>
                <span className="track-meta">
                  <b>{index + 1}</b>
                  {count >= 7 && index === 3 && <small>需 2 失败</small>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="quest-track-caption">
        <span>第 {quest + 1} 轮</span>
        {proposal && <span>提案 {proposal}</span>}
        <span>{stage}</span>
      </p>
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
}) {
  const questNumber = questIndex + 1;
  const requiredPlayers = questSizes[count]?.[questIndex] || 0;
  const protectedRound = count >= 7 && questIndex === 3;
  const mission = missions.find((item) => item.number === questNumber);
  const questProposals = proposals.filter(
    (proposal) => proposal.quest === questNumber,
  );
  const acceptedProposal = questProposals
    .slice()
    .reverse()
    .find((proposal) => proposal.approved);
  const missionTeam = mission?.team || acceptedProposal?.team || [];
  const teamNames = missionTeam
    .map((playerId) => players.find((player) => player.id === playerId)?.name)
    .filter(Boolean);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="quest-dialog"
      aria-labelledby="quest-dialog-title"
    >
      <div className="quest-dialog-content">
        <header className="quest-dialog-header">
          <div>
            <p className="eyebrow">任务记录</p>
            <h2 id="quest-dialog-title">任务 {questNumber}</h2>
          </div>
          <button
            className="quest-dialog-close"
            data-action="close-quest-details"
            type="button"
            aria-label="关闭"
          >
            <Icon name="x" />
          </button>
        </header>

        <div className="quest-detail-facts">
          <div>
            <span>任务人数</span>
            <strong>{requiredPlayers} 人</strong>
          </div>
          <div>
            <span>保护轮</span>
            <strong>
              {protectedRound ? "是 · 需 2 张失败票" : "否 · 1 张失败票即失败"}
            </strong>
          </div>
          <div>
            <span>执行队伍</span>
            <strong>
              {teamNames.length ? teamNames.join("、") : "尚未确定"}
            </strong>
          </div>
          <div>
            <span>任务结果</span>
            <strong
              className={
                mission
                  ? mission.passed
                    ? "quest-result-good"
                    : "quest-result-evil"
                  : ""
              }
            >
              {mission ? (mission.passed ? "成功" : "失败") : "尚未完成"}
            </strong>
          </div>
          <div>
            <span>失败票数</span>
            <strong>{mission ? mission.failures + " 票" : "—"}</strong>
          </div>
        </div>

        <section className="quest-vote-history">
          <h3>任务队伍投票记录</h3>
          {questProposals.length ? (
            <div className="quest-ballot-table-wrap">
              <table className="quest-ballot-table">
                <thead>
                  <tr>
                    <th scope="col">提案</th>
                    {players.map((player, playerIndex) => (
                      <th scope="col" key={player.id}>
                        玩家 {playerIndex + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questProposals.map((proposal, proposalIndex) => (
                    <tr key={proposalIndex}>
                      <th scope="row">提案 {proposalIndex + 1}</th>
                      {players.map((player, playerIndex) => {
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
                                    : "is-pending")
                              }
                              role="img"
                              aria-label={
                                vote === true
                                  ? "赞成"
                                  : vote === false
                                    ? "反对"
                                    : "未投"
                              }
                            >
                              {vote === true ? (
                                <Icon name="check" />
                              ) : vote === false ? (
                                <Icon name="x" />
                              ) : (
                                "—"
                              )}
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
      </div>
    </Dialog>
  );
}

function PlayerChoices({ state, readOnly = false }) {
  return (
    <div className={"player-grid" + (readOnly ? " read-only" : "")}>
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
            {selected && (
              <span className="tile-check">
                <Icon name="check" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
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
          <Icon name="x" />
        </span>
        <strong>反对</strong>
      </button>
      <button
        className="vote-button approve"
        data-action="cast-vote"
        data-value="yes"
      >
        <span>
          <Icon name="check" />
        </span>
        <strong>赞成</strong>
      </button>
    </div>
  );
}

function VotePage({ state, playerName, questSizes }) {
  const currentIndex = state.voteOrder[state.voteIndex];
  return (
    <main className="play-view">
      <QuestTrack
        count={state.players.length}
        missions={state.missions}
        quest={state.quest}
        questSizes={questSizes}
        proposal={state.rejections + 1}
        stage="队伍表决"
      />
      <section className="phase-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">秘密表决 · 请交接手机</p>
            <h2>轮到 {playerName(currentIndex)}</h2>
          </div>
          <span className="selection-count">
            <b>{state.missionTeam.length}</b> 人
          </span>
        </div>
        <PlayerChoices state={state} readOnly />
        <VoteButtons />
      </section>
    </main>
  );
}

function VoteResultPage({ state, playerName }) {
  const yesCount = state.votes.filter(Boolean).length;
  const noCount = state.votes.length - yesCount;
  const rejectedOut = !state.approved && state.rejections >= 5;
  const label = state.approved
    ? "进入任务"
    : rejectedOut
      ? "查看游戏结果"
      : "下一位队长提名";
  return (
    <main className="play-view result-view">
      <section className="result-panel">
        <span
          className={
            "result-mark " + (state.approved ? "good-mark" : "evil-mark")
          }
        >
          <Icon name={state.approved ? "check" : "x"} />
        </span>
        <p className="eyebrow">{state.approved ? "表决通过" : "表决未通过"}</p>
        <h1>
          {state.approved
            ? "队伍出发"
            : rejectedOut
              ? "连续否决，邪恶获胜"
              : "队伍被否决"}
        </h1>
        <p className="subtitle">
          赞成 {yesCount} 票 · 反对 {noCount} 票
          {!state.approved && <> · 连续否决 {state.rejections} / 5</>}
        </p>
        <div className="vote-list">
          {state.players.map((player, index) => (
            <div className="vote-result-row" key={player.name + index}>
              <span>{player.name}</span>
              <b className={"vote-pill " + (state.votes[index] ? "yes" : "no")}>
                {state.votes[index] ? "赞成" : "反对"}
              </b>
            </div>
          ))}
        </div>
        <button
          className="primary-button full-button"
          data-action="continue-vote"
        >
          {label} <Icon name="arrow-right" />
        </button>
      </section>
    </main>
  );
}

function MissionButtons({ isEvil }) {
  return (
    <div className="mission-buttons">
      <button
        className="mission-button success"
        data-action="cast-mission"
        data-value="success"
      >
        <span>
          <Icon name="check" />
        </span>
        <strong>任务成功</strong>
        <small>忠诚阵营必须成功</small>
      </button>
      {isEvil && (
        <button
          className="mission-button fail"
          data-action="cast-mission"
          data-value="fail"
        >
          <span>
            <Icon name="x" />
          </span>
          <strong>任务失败</strong>
          <small>邪恶阵营可以破坏</small>
        </button>
      )}
    </div>
  );
}

function MissionPage({ state, roles, playerName }) {
  const playerIndex = state.missionOrder[state.missionIndex];
  const role = state.players[playerIndex].role;
  const isEvil = roles[role].team === "evil";
  const progress = ((state.missionIndex + 1) / state.missionTeam.length) * 100;
  return (
    <main className="play-view">
      <div className="progress-label">
        任务密令{" "}
        <span>
          {state.missionIndex + 1} / {state.missionTeam.length}
        </span>
      </div>
      <div className="progress-track">
        <i style={{ width: progress + "%" }} />
      </div>
      <div className="private-prompt">
        <span className="privacy-lock">
          <Icon name="lock-keyhole" />
        </span>
        <p className="eyebrow">请交接手机 · 任务成员</p>
        <h1>{playerName(playerIndex)}</h1>
        <p>秘密选择任务结果。其他玩家不会看到个人选择。</p>
      </div>
      <div className="mission-secret">
        <span>你的身份</span>
        <strong>
          {roles[role].name} · {isEvil ? "邪恶阵营" : "忠诚阵营"}
        </strong>
      </div>
      <MissionButtons isEvil={isEvil} />
      <div className="proposal-strip">
        <span>出任务的队伍</span>
        <strong>{state.missionTeam.map(playerName).join("、")}</strong>
      </div>
    </main>
  );
}

function MissionResultPage({ state, playerName, questSizes }) {
  const mission = state.missions[state.missions.length - 1];
  const failRule =
    mission.threshold === 2
      ? "本任务需要 2 张失败牌才会失败。"
      : "任务中出现失败牌，任务即告失败。";
  return (
    <main className="play-view result-view">
      <section className="result-panel mission-result">
        <span
          className={
            "result-mark " + (mission.passed ? "good-mark" : "evil-mark")
          }
        >
          <Icon name={mission.passed ? "check" : "x"} />
        </span>
        <p className="eyebrow">任务 {mission.number} 结果</p>
        <h1>{mission.passed ? "任务成功" : "任务失败"}</h1>
        <p className="subtitle">
          {mission.failures} 张失败牌 · {failRule}
        </p>
        <QuestTrack
          count={state.players.length}
          missions={state.missions}
          quest={state.quest}
          questSizes={questSizes}
          stage="任务结果"
        />
        <div className="proposal-strip">
          <span>执行任务</span>
          <strong>{mission.team.map(playerName).join("、")}</strong>
        </div>
        <button
          className="primary-button full-button"
          data-action="continue-mission"
        >
          继续游戏 <Icon name="arrow-right" />
        </button>
        <p className="privacy-note">个人任务选择不会公开。</p>
      </section>
    </main>
  );
}

function AssassinationPage({ state, playerName }) {
  const assassin = state.players.findIndex(
    (player) => player.role === "assassin",
  );
  return (
    <main className="play-view">
      <div className="game-heading">
        <div>
          <p className="eyebrow">刺杀阶段</p>
          <h1>最后的猜测</h1>
          <p className="subtitle">刺客，请选择你认为是梅林的玩家。</p>
        </div>
        <div className="leader-badge">
          <span>刺客</span>
          <strong>{playerName(assassin)}</strong>
        </div>
      </div>
      <div className="assassin-warning">
        <Icon name="swords" />
        <p>刺中梅林，邪恶阵营逆转获胜。选错则好人获胜。</p>
      </div>
      <div className="assassin-grid">
        {state.players.map((player, index) =>
          index === assassin ? null : (
            <button
              className="assassin-target"
              data-action="choose-assassin"
              data-index={index}
              key={player.name + index}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{player.name}</strong>
              <Icon name="arrow-up-right" />
            </button>
          ),
        )}
      </div>
      <p className="privacy-note">将手机交给刺客，由刺客完成最终选择。</p>
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

function RoomRoleCard({ roomState, roles, roomPlayerName }) {
  const role = roomState.ownRole;
  if (!role) {
    return (
      <details className="room-role-card">
        <summary>旁观者 · 查看本局身份配置</summary>
        <p>旁观者无法提交游戏操作。</p>
      </details>
    );
  }
  const hintNames = (roomState.roleHints || []).map(roomPlayerName);
  let hint = "你没有额外的身份线索。";
  if (role.id === "merlin")
    hint = hintNames.length
      ? "你看见的邪恶势力：" + hintNames.join("、") + "。"
      : "你没有看见其他邪恶玩家。";
  if (role.id === "percival")
    hint = "梅林候选人：" + hintNames.join("、") + "。其中可能有莫甘娜。";
  if (role.team === "evil" && role.id !== "oberon")
    hint = hintNames.length
      ? "你认识的邪恶队友：" + hintNames.join("、") + "。"
      : "没有其他邪恶玩家与你互认。";
  if (role.id === "oberon")
    hint = "你不知道其他邪恶玩家是谁；他们也不知道你属于邪恶阵营。";
  const roleDescription = roles[role.id]?.description || "";
  return (
    <details className="room-role-card">
      <summary>你的身份：{role.name} · 点击查看线索</summary>
      <p>{roleDescription}</p>
      <p>{hint}</p>
    </details>
  );
}

function RoomTrack({ roomState, questSizes }) {
  return (
    <QuestTrack
      count={roomState.players.length}
      missions={roomState.missions}
      quest={roomState.quest - 1}
      questSizes={questSizes}
      proposal={roomState.consecutiveRejections + 1}
      stage={roomState.phase === "propose" ? "队伍提名" : "队伍表决"}
    />
  );
}

function RoomPlayerTiles({
  roomState,
  selected,
  action,
  roomPlayerName,
  roomAvatarSource,
}) {
  return (
    <div className={"player-grid" + (!action ? " read-only" : "")}>
      {roomState.players.map((player, index) => {
        const isSelected = selected.includes(player.id);
        const isLeader = player.id === roomState.leader;
        const playerName = roomPlayerName(player.id) || "玩家 " + (index + 1);
        const avatarSource = roomAvatarSource(player.id);
        return (
          <button
            className={
              "player-tile" +
              (isSelected ? " selected" : "") +
              (!action && !isSelected ? " not-selected" : "") +
              (isLeader ? " is-leader" : "")
            }
            data-room-action={action}
            data-player-id={player.id}
            aria-pressed={isSelected}
            disabled={!action}
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
            {isSelected && (
              <span className="tile-check">
                <Icon name="check" />
              </span>
            )}
          </button>
        );
      })}
    </div>
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
          <Icon name="x" />
        </span>
        <strong>反对</strong>
      </button>
      <button
        className="vote-button approve"
        data-room-action="vote"
        data-value="yes"
      >
        <span>
          <Icon name="check" />
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
    <div className="mission-buttons">
      <button
        className="mission-button success"
        data-room-action="mission-choice"
        data-value="success"
      >
        <span>
          <Icon name="check" />
        </span>
        <strong>任务成功</strong>
        <small>忠诚阵营必须成功</small>
      </button>
      {myRole?.team === "evil" && (
        <button
          className="mission-button fail"
          data-room-action="mission-choice"
          data-value="fail"
        >
          <span>
            <Icon name="x" />
          </span>
          <strong>任务失败</strong>
          <small>邪恶阵营可以破坏</small>
        </button>
      )}
    </div>
  );
}

function RoomPage({
  roomContext,
  roomState,
  roomError,
  roomBusy,
  roomTeam,
  questSizes,
  roles,
  roomPlayerName,
  roomAvatarSource,
}) {
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
  const track = <RoomTrack roomState={roomState} questSizes={questSizes} />;
  let content = null;

  if (roomState.phase === "propose") {
    const required = questSizes[roomState.players.length][roomState.quest - 1];
    const isLeader = roomState.leader === playerId;
    content = (
      <>
        {track}
        {isLeader ? (
          <section className="phase-panel">
            <RoomPlayerTiles
              roomState={roomState}
              selected={roomTeam}
              action="toggle-team"
              roomPlayerName={roomPlayerName}
              roomAvatarSource={roomAvatarSource}
            />
            <button
              className="primary-button full-button"
              data-room-action="propose"
              disabled={roomTeam.length !== required || roomBusy}
            >
              提名 {required} 人 <Icon name="arrow-right" />
            </button>
          </section>
        ) : (
          <section className="phase-panel private-prompt">
            <p className="eyebrow">等待队长提名</p>
            <p>队伍提名后，全体玩家将秘密表决。</p>
          </section>
        )}
      </>
    );
  } else if (roomState.phase === "vote") {
    content = (
      <>
        {track}
        <section className="phase-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">队伍表决 · 秘密投票</p>
              <h2>{roomState.ownVote ? "你的选择已锁定" : "批准这支队伍？"}</h2>
            </div>
            <span className="selection-count">
              <b>{roomState.selectedTeam.length}</b> 人
            </span>
          </div>
          <RoomPlayerTiles
            roomState={roomState}
            selected={roomState.selectedTeam}
            roomPlayerName={roomPlayerName}
            roomAvatarSource={roomAvatarSource}
          />
          {!roomState.ownVote && <RoomVoteButtons />}
        </section>
      </>
    );
  } else if (roomState.phase === "vote-result") {
    const approved = roomState.votePassed;
    content = (
      <section className="result-panel">
        <span
          className={"result-mark " + (approved ? "good-mark" : "evil-mark")}
        >
          <Icon name={approved ? "check" : "x"} />
        </span>
        <p className="eyebrow">{approved ? "表决通过" : "表决未通过"}</p>
        <h1>{approved ? "队伍出发" : "队伍被否决"}</h1>
        <div className="vote-list">
          {roomState.players.map((player) => (
            <div className="vote-result-row" key={player.id}>
              <span>{player.name || "玩家"}</span>
              <b
                className={
                  "vote-pill " + (roomState.votes[player.id] ? "yes" : "no")
                }
              >
                {roomState.votes[player.id] ? "赞成" : "反对"}
              </b>
            </div>
          ))}
        </div>
        <button
          className="primary-button full-button"
          data-room-action={approved ? "begin-mission" : "next-proposal"}
        >
          {approved ? "进入任务" : "下一位队长提名"} <Icon name="arrow-right" />
        </button>
      </section>
    );
  } else if (roomState.phase === "mission") {
    const isOnTeam = roomState.missionTeam.includes(playerId);
    const action = roomState.ownMissionAction;
    const progressText = isOnTeam
      ? action
        ? "已收到 " +
        roomState.missionActionsCast +
        " / " +
        roomState.missionTeam.length +
        " 张任务牌。"
        : "队伍成员选择成功或失败；个人选择不会公开。"
      : "已收到 " +
      roomState.missionActionsCast +
      " / " +
      roomState.missionTeam.length +
      " 张任务牌。";
    content = (
      <>
        {track}
        <section className="private-prompt">
          <span className="privacy-lock">
            <Icon name="lock-keyhole" />
          </span>
          <p className="eyebrow">任务 {roomState.quest} · 秘密出牌</p>
          <h1>
            {isOnTeam
              ? action
                ? "你的选择已锁定"
                : "执行任务"
              : "等待任务结果"}
          </h1>
          <p>{progressText}</p>
        </section>
        <div className="proposal-strip">
          <span>任务队伍</span>
          <strong>
            {roomState.missionTeam.map(roomPlayerName).join("、")}
          </strong>
        </div>
        {isOnTeam && !action && (
          <>
            <div className="mission-secret">
              <span>你的身份</span>
              <strong>
                {myRole?.name || ""} ·{" "}
                {myRole?.team === "evil" ? "邪恶阵营" : "忠诚阵营"}
              </strong>
            </div>
            <RoomMissionButtons roomState={roomState} playerId={playerId} />
          </>
        )}
      </>
    );
  } else if (roomState.phase === "mission-result") {
    const mission = roomState.lastMission;
    content = (
      <section className="result-panel mission-result">
        <span
          className={
            "result-mark " + (mission.passed ? "good-mark" : "evil-mark")
          }
        >
          <Icon name={mission.passed ? "check" : "x"} />
        </span>
        <p className="eyebrow">任务 {mission.number} 结果</p>
        <h1>{mission.passed ? "任务成功" : "任务失败"}</h1>
        <p className="subtitle">
          {mission.failures} 张失败牌 ·{" "}
          {mission.threshold === 2
            ? "本任务需要 2 张失败牌才会失败。"
            : "一张失败牌即可破坏任务。"}
        </p>
        {track}
        <button
          className="primary-button full-button"
          data-room-action="continue-mission"
        >
          继续游戏 <Icon name="arrow-right" />
        </button>
      </section>
    );
  } else if (roomState.phase === "assassinate") {
    const isAssassin = myRole?.id === "assassin";
    content = (
      <>
        <div className="game-heading">
          <div>
            <p className="eyebrow">刺杀阶段</p>
            <h1>最后的猜测</h1>
            <p className="subtitle">
              {isAssassin ? "选择你认为是梅林的玩家。" : "刺客正在选择目标。"}
            </p>
          </div>
        </div>
        <div className="assassin-warning">
          <Icon name="swords" />
          <p>刺中梅林，邪恶阵营逆转获胜。选错则好人获胜。</p>
        </div>
        {isAssassin ? (
          <div className="assassin-grid">
            {roomState.players
              .filter((player) => player.id !== playerId)
              .map((player, index) => (
                <button
                  className="assassin-target"
                  data-room-action="assassinate"
                  data-player-id={player.id}
                  key={player.id}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{player.name || "玩家"}</strong>
                  <Icon name="arrow-up-right" />
                </button>
              ))}
          </div>
        ) : (
          <section className="phase-panel private-prompt">
            <p>等待刺客完成选择。</p>
          </section>
        )}
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
      <RoomRoleCard
        roomState={roomState}
        roles={roles}
        roomPlayerName={roomPlayerName}
      />
      {content}
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
    openQuestIndex,
    onCloseQuestDetails,
  } = props;
  let page;

  if (roomContext?.mode === "room") {
    page = <RoomPage {...props} />;
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
      "vote-result": <VoteResultPage state={state} playerName={playerName} />,
      mission: (
        <MissionPage state={state} roles={roles} playerName={playerName} />
      ),
      "mission-result": (
        <MissionResultPage
          state={state}
          playerName={playerName}
          questSizes={questSizes}
        />
      ),
      assassinate: <AssassinationPage state={state} playerName={playerName} />,
      over: <GameOverPage state={state} roles={roles} />,
    };
    page = pages[state.phase];
  }

  const isRoomMode = roomContext?.mode === "room";
  const detailPlayers = isRoomMode
    ? (roomState?.players || []).map((player) => ({
      id: player.id,
      name: roomPlayerName(player.id),
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
          open={openQuestIndex !== null}
          count={detailCount}
          questIndex={openQuestIndex ?? 0}
          questSizes={questSizes}
          players={detailPlayers}
          proposals={detailProposals}
          missions={detailMissions}
          onClose={onCloseQuestDetails}
        />
      )}
    </Shell>
  );
}

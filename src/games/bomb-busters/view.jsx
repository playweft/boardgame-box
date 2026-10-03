import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { AlarmClock, ArrowLeft, ArrowRight, Bomb, Check, CircleHelp, Heart, HeartCrack, Scissors, X } from "lucide";
import Dialog from "../../shared/dialog.jsx";

const iconData = {
  "alarm-clock": AlarmClock,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  bomb: Bomb,
  check: Check,
  "circle-help": CircleHelp,
  heart: Heart,
  "heart-crack": HeartCrack,
  scissors: Scissors,
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

function Shell({ children, room }) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="page-shell bomb-shell">
      <header className="topbar">
        {!room && (
          <a className="back-link" href="../../" aria-label="返回桌游盒">
            <Icon name="arrow-left" />
          </a>
        )}
        <div className="topbar-title">炸弹克星</div>
        {!room && (
          <button
            className="help-link"
            type="button"
            aria-label="游戏规则"
            onClick={() => setHelpOpen(true)}
          >
            <Icon name="circle-help" />
          </button>
        )}
      </header>
      {children}
      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        className="help-dialog"
        aria-label="炸弹克星规则"
      >
        <div className="help-dialog-content">
          <button
            className="help-dialog-close"
            type="button"
            aria-label="关闭"
            onClick={() => setHelpOpen(false)}
          >
            <Icon name="x" />
          </button>
          <iframe className="help-frame" src="./help.html" title="炸弹克星规则" />
        </div>
      </Dialog>
    </div>
  );
}

function Setup({ count, names, onCount, onName, onStart }) {
  return (
    <main className="setup-view">
      <p className="eyebrow">简化练习局</p>
      <p className="setup-intro">合作剪开同值线缆，避开红线。</p>
      <div className="player-count" aria-label="选择玩家人数">
        {[2, 3, 4, 5].map((value) => (
          <button
            className={value === count ? "count-option selected" : "count-option"}
            type="button"
            aria-pressed={value === count}
            onClick={() => onCount(value)}
            key={value}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="name-grid">
        {names.slice(0, count).map((name, index) => (
          <label className="name-field" key={index}>
            <span>{index + 1}</span>
            <input
              value={name}
              maxLength={16}
              aria-label={"玩家 " + (index + 1) + " 名称"}
              onInput={(event) => onName(index, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>
      <button className="primary-button full-button" type="button" onClick={onStart}>
        开始拆弹 <Icon name="scissors" />
      </button>
    </main>
  );
}

function PassDevice({ player, onReveal }) {
  return (
    <main className="pass-view">
      <p className="eyebrow">轮到</p>
      <h2>{player?.name}</h2>
      <button className="primary-button full-button" type="button" onClick={onReveal}>
        查看线缆 <Icon name="arrow-right" />
      </button>
    </main>
  );
}

function WireFace({ wire }) {
  return wire.kind === "number"
    ? wire.value
    : wire.kind === "yellow"
      ? wire.tileNumber || "黄"
      : wire.tileNumber || <Icon name="bomb" />;
}

function wireKindClass(wire) {
  return wire.kind === "number" ? "number" : wire.kind;
}

function wireLabel(wire) {
  return wire.kind === "number"
    ? String(wire.value)
    : wire.kind === "yellow"
      ? "黄线 " + (wire.tileNumber || "")
      : "红线 " + (wire.tileNumber || "");
}

function InfoToken({ value, recent }) {
  if (!value) return null;
  const isBlue = /^\d+$/.test(value);
  return (
    <span
      className={"wire-info-token " + (isBlue ? "wire-info-blue" : "wire-info-yellow") + (recent ? " recent-action" : "")}
      aria-hidden="true"
    >
      {isBlue ? value : null}
    </span>
  );
}

function Wire({
  wire, ownerId, viewerId, ownTurn, busy, sourceId, soloIds,
  setupInfo, selectedInfoWireId, onInfoSelect, onSource, onTarget,
  selectedTargetIds, detectorChoice, onDetectorChoice,
  recentClue,
}) {
  const isOwn = ownerId === viewerId;
  const isSelected = wire.id === sourceId || selectedTargetIds.includes(wire.id);
  const isInfoSelected = wire.id === selectedInfoWireId;
  const isSolo = soloIds.has(wire.id);
  const detectorBlocked = detectorChoice && ownTurn &&
    (!isOwn || !detectorChoice.choiceIds?.includes(wire.id));
  if (!wire.revealed) {
    return (
      <button
        className={"wire wire-hidden" + (isSelected ? " wire-selected" : "") + (detectorBlocked ? " wire-detector-blocked" : "")}
        type="button"
        aria-label={wire.infoToken ? "队友隐藏线缆，提示 " + wire.infoToken : "队友的隐藏线缆"}
        disabled={!!detectorChoice || !ownTurn || busy}
        onClick={() => onTarget(wire.id)}
      >
        <span className="wire-face"><Icon name="scissors" /></span>
        <InfoToken value={wire.infoToken} recent={recentClue} />
      </button>
    );
  }
  return (
    <button
      className={[
        "wire",
        "wire-" + wireKindClass(wire),
        (setupInfo ? isInfoSelected : isSelected) && "wire-selected",
        isSolo && "wire-solo",
        detectorBlocked && "wire-detector-blocked",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      aria-label={wireLabel(wire) + (wire.infoToken ? "，已公开提示 " + wire.infoToken : "")}
      disabled={
        (detectorChoice ? !isOwn || !detectorChoice.choiceIds?.includes(wire.id) : !ownTurn) ||
        busy ||
        (setupInfo && (!isOwn || wire.kind !== "number"))
      }
      onClick={() => {
        if (detectorChoice) {
          onDetectorChoice(wire.id);
          return;
        }
        if (setupInfo) {
          onInfoSelect(wire.id);
          return;
        }
        if (!isOwn) {
          onTarget(wire.id);
          return;
        }
        onSource(wire.id, isSolo);
      }}
    >
      <span className="wire-face"><WireFace wire={wire} /></span>
      <InfoToken value={wire.infoToken} recent={recentClue} />
    </button>
  );
}

function Rack({
  player, game, viewerId, busy, sourceId, selectedInfoWireId,
  soloIds, onInfoSelect, onSource, onTarget, selectedTargetIds, onDetectorChoice,
  recentAction,
}) {
  const isCurrent = player.id === game.currentPlayerId && game.phase !== "ended";
  const stands = game.racks[player.id] || [];
  return (
    <section className={"player-rack" + (isCurrent ? " active-rack" : "") + (game.phase === "ended" ? " revealed-rack" : "")}>
      {player.id === viewerId && game.detectorChoice && game.ownTurn && (
        <p className="detector-instruction">
          探测 {game.detectorChoice.kind === "yellow" ? "黄线" : game.detectorChoice.value} · {game.detectorChoice.success ? "选一根剪断" : "选一根放提示"}
        </p>
      )}
      {stands.map((slots, rackIndex) => (
        <div
          className="wire-row player-stand"
          role="group"
          aria-label={"牌架 " + (rackIndex + 1)}
          key={rackIndex}
        >
          {slots.map((slot) =>
            slot.empty ? (
              <span className={slot.cutWire ? "wire-slot has-cut" : "wire-slot"} key={slot.id}>
                <span className="wire wire-empty" aria-hidden="true" />
                {slot.cutWire && (
                  <span
                    className={"wire wire-" + wireKindClass(slot.cutWire) + " wire-cut" + (recentAction.cutIds.includes(slot.cutWire.id) ? " recent-action" : "") + (game.detectorChoice && game.ownTurn ? " wire-detector-blocked" : "")}
                    role="img"
                    aria-label={"已剪断：" + wireLabel(slot.cutWire)}
                  >
                    <span className="wire-face"><WireFace wire={slot.cutWire} /></span>
                  </span>
                )}
              </span>
            ) : (
              <Wire
                wire={slot}
                recentClue={recentAction.clueIds.includes(slot.id)}
                ownerId={player.id}
                viewerId={viewerId}
                ownTurn={game.ownTurn}
                selectedTargetIds={selectedTargetIds}
                detectorChoice={game.detectorChoice}
                onDetectorChoice={onDetectorChoice}
                busy={busy}
                sourceId={sourceId}
                setupInfo={game.phase === "setup_info"}
                selectedInfoWireId={selectedInfoWireId}
                onInfoSelect={onInfoSelect}
                soloIds={soloIds}
                onSource={onSource}
                onTarget={onTarget}
                key={slot.id}
              />
            ),
          )}
        </div>
      ))}
      <div className="rack-heading">
        {isCurrent && !(busy && player.id === viewerId) && <Icon name="alarm-clock" className="turn-icon" />}
        <strong>{player.name}</strong>
      </div>
    </section>
  );
}

function MissionStatus({ game, cutWires }) {
  const remainingLives = game.detonatorLimit - game.detonator;
  return (
    <div className="mission-status">
      <div className="detonator" aria-label={"剩余生命 " + remainingLives + " / " + game.detonatorLimit}>
        <div className="detonator-track">
          {Array.from({ length: game.detonatorLimit }, (_, index) => (
            <Icon name={index < remainingLives ? "heart" : "heart-crack"}
              className={"detonator-step" + (index < remainingLives ? " filled" : "")} key={index} />
          ))}
        </div>
      </div>
      <span className="cut-count">
        <Icon name="check" /> {cutWires.length}
      </span>
    </div>
  );
}

function SpecialCandidates({ candidates }) {
  if (!candidates) return null;
  return (
    <div className="special-candidates" aria-label="本局红黄线候选编号">
      {[
        ["red", "红线", candidates.red],
        ["yellow", "黄线", candidates.yellow],
      ].map(([kind, label, entry]) => (
        <div className={"special-candidate special-candidate-" + kind} key={kind}
          aria-label={label + "，使用 " + entry.inPlay + " 根，共 " + entry.candidateCount + " 个候选"}>
          <strong>{entry.inPlay}/{entry.candidateCount}</strong>
          {entry.tileNumbers.map((value) => (
            <span className="candidate-chip" key={value}>{value}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function GameBoard({
  game, viewerId, busy, selectedSourceId, selectedInfoWireId,
  recentAction,
  onInfoSelect, onPlaceInfo, onSource, onTarget, error,
  detectorEnabled, selectedTargetIds, onDetectorToggle, onDetectorConfirm, onDetectorChoice, onShowResult,
}) {
  const cutWires = Array.isArray(game.cutWires) ? game.cutWires : [];
  const soloCuts = Array.isArray(game.soloCuts) ? game.soloCuts : [];
  const soloIds = new Set(soloCuts.flatMap((entry) => entry.ids));
  const ownPlayer = game.players.find((player) => player.id === viewerId);
  const renderRack = (player) => (
    <Rack player={player} game={game} viewerId={viewerId} busy={busy || game.phase === "ended"}
      recentAction={recentAction}
      sourceId={selectedSourceId} selectedTargetIds={selectedTargetIds}
      onDetectorChoice={onDetectorChoice} selectedInfoWireId={selectedInfoWireId}
      soloIds={soloIds} onInfoSelect={onInfoSelect} onSource={onSource}
      onTarget={onTarget} key={player.id} />
  );
  return (
    <>
    <main className="play-view">
      <MissionStatus game={game} cutWires={cutWires} />
      <SpecialCandidates candidates={game.specialCandidates} />
      <div className="validation-tokens" aria-label="数字完成标记">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => {
          const complete = cutWires.filter((wire) => wire.kind === "number" && wire.value === value).length === 4;
          return (
            <span className={"validation-token" + (complete ? " complete" : "")} key={value}
              aria-label={value + (complete ? "：四根已全部剪断" : "：尚未全部剪断")}>
              {value}
            </span>
          );
        })}
      </div>
      <div className="player-racks">
        {game.players.filter((player) => player.id !== viewerId).map(renderRack)}
      </div>
      {game.phase === "ended" && !ownPlayer && <button className="solo-option" type="button" onClick={onShowResult}>查看结果</button>}
    </main>
      {ownPlayer && (
        <div className="own-player-dock">
          {renderRack(ownPlayer)}
          <div className="action-bar">
            {game.phase === "ended" ? (
              <button className="solo-option" type="button" onClick={onShowResult}>查看结果</button>
            ) : !game.detectorChoice && (game.phase === "setup_info" ? (
              <>
                <button
                  className="primary-button full-button"
                  type="button"
                  disabled={busy || !game.ownTurn}
                  onClick={onPlaceInfo}
                >
                  放置信息标记 <Icon name="check" />
                </button>
              </>
            ) : (
              <>
                <div className="action-options">
                  <button className="solo-option" type="button" disabled={busy || !game.canUseDetector}
                    aria-pressed={detectorEnabled} onClick={onDetectorToggle}>
                    {game.detectorUsed?.[viewerId] ? "双重探测器已使用" : detectorEnabled ? "取消双重探测" : "双重探测器 · 一次"}
                  </button>
                  {detectorEnabled && <button className="solo-option" type="button"
                    disabled={busy} onClick={onDetectorConfirm}>
                    确认探测（{selectedTargetIds.length}/2）
                  </button>}
                </div>
              </>
            ))}
            {error && <p className="error-message">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

function Result({ open, outcome, onRestart, onClose, busy }) {
  return (
    <Dialog open={open} onClose={onClose} className="result-dialog" aria-label={outcome === "success" ? "拆弹成功" : "任务失败"}>
      <Icon name={outcome === "success" ? "check" : "bomb"} className="result-icon" />
      <h2>{outcome === "success" ? "拆弹成功" : "任务失败"}</h2>
      <button className="primary-button full-button" type="button" onClick={onRestart} disabled={busy}>
        再来一局 <Icon name="arrow-left" />
      </button>
      <button className="solo-option" type="button" onClick={onClose}>查看牌桌</button>
    </Dialog>
  );
}

function ActionNotice({ message }) {
  const [retainedMessage, setRetainedMessage] = useState(message);
  useEffect(() => {
    if (message) {
      setRetainedMessage(message);
      return;
    }
    const timer = setTimeout(() => setRetainedMessage(""), 220);
    return () => clearTimeout(timer);
  }, [message]);
  const text = message || retainedMessage;
  return text ? (
    <div className={"action-notice" + (message ? "" : " fading-out")} role="status" aria-live="polite">
      {text}
    </div>
  ) : null;
}

export default function BombBustersApp({
  count,
  names,
  game,
  room,
  roomError,
  notice,
  recentAction = { cutIds: [], clueIds: [] },
  busy,
  localReady,
  detectorEnabled = false, selectedTargetIds = [], onDetectorToggle, onDetectorConfirm, onDetectorChoice,
  selectedSourceId,
  selectedInfoWireId,
  onCount,
  onName,
  onStart,
  onReveal,
  onInfoSelect,
  onPlaceInfo,
  onSource,
  onTarget,
  onRestart,
  error,
}) {
  const [resultOpen, setResultOpen] = useState(false);
  const ended = game?.phase === "ended";
  useEffect(() => {
    setResultOpen(false);
    if (!ended) return;
    const timer = setTimeout(() => setResultOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [ended]);
  let content;
  if (room && !game) {
    content = <main className="message-view">{roomError || "正在连接房间…"}</main>;
  } else if (!room && !game) {
    content = (
      <Setup
        count={count}
        names={names}
        onCount={onCount}
        onName={onName}
        onStart={onStart}
      />
    );
  } else if (!room && !localReady && !ended) {
    content = (
      <PassDevice
        player={game.players.find((player) => player.id === game.currentPlayerId)}
        onReveal={onReveal}
      />
    );
  } else {
    content = (
      <GameBoard
        game={game}
        recentAction={recentAction}
        viewerId={game.viewerId}
        busy={busy}
        selectedSourceId={selectedSourceId}
        detectorEnabled={detectorEnabled}
        selectedTargetIds={selectedTargetIds}
        onDetectorToggle={onDetectorToggle}
        onDetectorConfirm={onDetectorConfirm}
        onDetectorChoice={onDetectorChoice}
        selectedInfoWireId={selectedInfoWireId}
        onInfoSelect={onInfoSelect}
        onPlaceInfo={onPlaceInfo}
        onSource={onSource}
        onTarget={onTarget}
        onShowResult={() => setResultOpen(true)}
        error={error || roomError}
      />
    );
  }
  return (
    <Shell room={room}>
      {content}
      <Result open={ended && resultOpen} outcome={game?.outcome} onRestart={onRestart}
        onClose={() => setResultOpen(false)} busy={busy} />
      <ActionNotice message={notice} />
    </Shell>
  );
}

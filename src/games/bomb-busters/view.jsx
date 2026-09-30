import { h } from "preact";
import { useState } from "preact/hooks";
import { ArrowLeft, ArrowRight, Bomb, Check, CircleHelp, Scissors, X } from "lucide";
import Dialog from "../../shared/dialog.jsx";

const iconData = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  bomb: Bomb,
  check: Check,
  "circle-help": CircleHelp,
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

function InfoToken({ value }) {
  if (!value) return null;
  const isBlue = /^\d+$/.test(value);
  return (
    <span
      className={"wire-info-token " + (isBlue ? "wire-info-blue" : "wire-info-yellow")}
      aria-hidden="true"
    >
      {isBlue ? value : null}
    </span>
  );
}

function Wire({
  wire, ownerId, viewerId, ownTurn, busy, sourceId, soloIds,
  setupInfo, selectedInfoWireId, onInfoSelect, onSource, onTarget,
}) {
  const isOwn = ownerId === viewerId;
  const isSelected = wire.id === sourceId;
  const isInfoSelected = wire.id === selectedInfoWireId;
  const isSolo = soloIds.has(wire.id);
  if (!wire.revealed) {
    return (
      <button
        className="wire wire-hidden"
        type="button"
        aria-label={wire.infoToken ? "队友隐藏线缆，提示 " + wire.infoToken : "队友的隐藏线缆"}
        disabled={setupInfo || !ownTurn || busy || !sourceId}
        onClick={() => onTarget(wire.id)}
      >
        <Icon name="scissors" />
        <InfoToken value={wire.infoToken} />
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
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      aria-label={wireLabel(wire) + (wire.infoToken ? "，已公开提示 " + wire.infoToken : "")}
      disabled={
        !ownTurn ||
        busy ||
        (setupInfo
          ? !isOwn || wire.kind !== "number"
          : !isOwn && !sourceId)
      }
      onClick={() => {
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
      <WireFace wire={wire} />
      <InfoToken value={wire.infoToken} />
    </button>
  );
}

function Rack({
  player, game, viewerId, busy, sourceId, selectedInfoWireId,
  soloIds, onInfoSelect, onSource, onTarget,
}) {
  const isCurrent = player.id === game.currentPlayerId;
  const stands = game.racks[player.id] || [];
  return (
    <section className={isCurrent ? "player-rack active-rack" : "player-rack"}>
      <div className="rack-heading">
        <strong>{player.name}</strong>
        {isCurrent && <Icon name="scissors" className="turn-icon" />}
      </div>
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
                    className={"wire wire-" + wireKindClass(slot.cutWire) + " wire-cut"}
                    role="img"
                    aria-label={"已剪断：" + wireLabel(slot.cutWire)}
                  >
                    <WireFace wire={slot.cutWire} />
                  </span>
                )}
              </span>
            ) : (
              <Wire
                wire={slot}
                ownerId={player.id}
                viewerId={viewerId}
                ownTurn={game.ownTurn}
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
    </section>
  );
}

function MissionStatus({ game, cutWires }) {
  return (
    <div className="mission-status">
      <div className="detonator" aria-label={"引爆器 " + game.detonator + " / " + game.detonatorLimit}>
        <Icon name="bomb" />
        <div className="detonator-track">
          {Array.from({ length: game.detonatorLimit }, (_, index) => (
            <span className={index < game.detonator ? "detonator-step filled" : "detonator-step"} key={index} />
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
        <div className={"special-candidate special-candidate-" + kind} key={kind}>
          <strong>{label} {entry.inPlay}/{entry.candidateCount}：</strong>
          <span>{entry.tileNumbers.join("、")}</span>
        </div>
      ))}
    </div>
  );
}

function GameBoard({
  game, viewerId, busy, selectedSourceId, selectedInfoWireId,
  onInfoSelect, onPlaceInfo, onSource, onTarget, onRevealRed, error,
}) {
  const cutWires = Array.isArray(game.cutWires) ? game.cutWires : [];
  const soloCuts = Array.isArray(game.soloCuts) ? game.soloCuts : [];
  const soloIds = new Set(soloCuts.flatMap((entry) => entry.ids));
  return (
    <main className="play-view">
      <MissionStatus game={game} cutWires={cutWires} />
      <SpecialCandidates candidates={game.specialCandidates} />
      <div className="validation-tokens" aria-label="数字完成标记">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => {
          const complete = cutWires.filter((wire) => wire.kind === "number" && wire.value === value).length === 4;
          return (
            <span className={"validation-token" + (complete ? " complete" : "")} key={value}
              aria-label={value + (complete ? "：四根已全部剪断" : "：尚未全部剪断")}>
              {value}{complete && <Icon name="check" />}
            </span>
          );
        })}
      </div>
      <div className="player-racks">
        {game.players.map((player) => (
          <Rack
            player={player}
            game={game}
            viewerId={viewerId}
            busy={busy}
            sourceId={selectedSourceId}
            selectedInfoWireId={selectedInfoWireId}
            soloIds={soloIds}
            onInfoSelect={onInfoSelect}
            onSource={onSource}
            onTarget={onTarget}
            key={player.id}
          />
        ))}
      </div>
      {game.ownTurn && (
        <div className="action-bar">
          {game.phase === "setup_info" ? (
            <>
              <p className="turn-hint">选一根自己的蓝线</p>
              <button
                className="primary-button full-button"
                type="button"
                disabled={busy || !selectedInfoWireId}
                onClick={onPlaceInfo}
              >
                放置信息标记 <Icon name="check" />
              </button>
            </>
          ) : (
            <>
              <div className="action-options">
                {game.canRevealRed && (
                  <button className="solo-option" type="button" disabled={busy} onClick={onRevealRed}>
                    公开红线
                  </button>
                )}
              </div>
              <p className="turn-hint">选自己的线，再选队友的；单剪选同值线</p>
            </>
          )}
          {error && <p className="error-message">{error}</p>}
        </div>
      )}
    </main>
  );
}

function Result({ outcome, onRestart, busy }) {
  return (
    <main className="result-view">
      <Icon name={outcome === "success" ? "check" : "bomb"} className="result-icon" />
      <h2>{outcome === "success" ? "拆弹成功" : "任务失败"}</h2>
      <button className="primary-button full-button" type="button" onClick={onRestart} disabled={busy}>
        再来一局 <Icon name="arrow-left" />
      </button>
    </main>
  );
}

export default function BombBustersApp({
  count,
  names,
  game,
  room,
  roomError,
  busy,
  localReady,
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
  onRevealRed,
  onRestart,
  error,
}) {
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
  } else if (game.phase === "ended") {
    content = (
      <Result
        outcome={game.outcome}
        onRestart={onRestart}
        busy={busy}
      />
    );
  } else if (!room && !localReady) {
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
        viewerId={game.viewerId}
        busy={busy}
        selectedSourceId={selectedSourceId}
        selectedInfoWireId={selectedInfoWireId}
        onInfoSelect={onInfoSelect}
        onPlaceInfo={onPlaceInfo}
        onSource={onSource}
        onTarget={onTarget}
        onRevealRed={onRevealRed}
        error={error || roomError}
      />
    );
  }
  return <Shell room={room}>{content}</Shell>;
}

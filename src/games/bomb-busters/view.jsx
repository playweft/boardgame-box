import { h } from "preact";
import { ArrowLeft, ArrowRight, Bomb, Check, CircleHelp, Scissors } from "lucide";

const iconData = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  bomb: Bomb,
  check: Check,
  "circle-help": CircleHelp,
  scissors: Scissors,
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
    <div className="page-shell bomb-shell">
      <header className="topbar">
        <a className="back-link" href="../../" aria-label="返回桌游盒">
          <Icon name="arrow-left" />
        </a>
        <div className="topbar-title">炸弹克星</div>
        <a className="help-link" href="./help.html" aria-label="游戏规则">
          <Icon name="circle-help" />
        </a>
      </header>
      {children}
    </div>
  );
}

function Setup({ count, names, onCount, onName, onStart }) {
  return (
    <main className="setup-view">
      <p className="eyebrow">基础任务</p>
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

function Wire({ wire, ownerId, viewerId, ownTurn, busy, sourceId, soloIds, onSource, onTarget }) {
  const isOwn = ownerId === viewerId;
  const isSelected = wire.id === sourceId;
  const isSolo = soloIds.has(wire.id);
  if (!wire.revealed) {
    return (
      <button
        className="wire wire-hidden"
        type="button"
        aria-label="队友的隐藏线缆"
        disabled={!ownTurn || busy || !sourceId}
        onClick={() => onTarget(wire.id)}
      >
        <Icon name="scissors" />
      </button>
    );
  }
  const kindClass = wire.kind === "number" ? "number" : wire.kind;
  return (
    <button
      className={[
        "wire",
        "wire-" + kindClass,
        isSelected && "wire-selected",
        isSolo && "wire-solo",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      aria-label={wire.kind === "number" ? String(wire.value) : wire.kind === "yellow" ? "黄线" : "红线"}
      disabled={!ownTurn || busy || (!isOwn && !sourceId)}
      onClick={() => {
        if (!isOwn) {
          onTarget(wire.id);
          return;
        }
        onSource(wire.id, isSolo);
      }}
    >
      {wire.kind === "number" ? wire.value : wire.kind === "yellow" ? "黄" : <Icon name="bomb" />}
    </button>
  );
}

function Rack({ player, game, viewerId, busy, sourceId, soloIds, onSource, onTarget }) {
  const isCurrent = player.id === game.currentPlayerId;
  const slots = game.racks[player.id];
  return (
    <section className={isCurrent ? "player-rack active-rack" : "player-rack"}>
      <div className="rack-heading">
        <strong>{player.name}</strong>
        {isCurrent && <Icon name="scissors" className="turn-icon" />}
      </div>
      <div className="wire-row">
        {slots.map((slot) =>
          slot.empty ? (
            <span className="wire wire-empty" aria-hidden="true" key={slot.id} />
          ) : (
            <Wire
              wire={slot}
              ownerId={player.id}
              viewerId={viewerId}
              ownTurn={game.ownTurn}
              busy={busy}
              sourceId={sourceId}
              soloIds={soloIds}
              onSource={onSource}
              onTarget={onTarget}
              key={slot.id}
            />
          ),
        )}
      </div>
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

function GameBoard({ game, viewerId, busy, selectedSourceId, onSource, onTarget, onSolo, onRevealRed, error }) {
  const cutWires = Array.isArray(game.cutWires) ? game.cutWires : [];
  const soloCuts = Array.isArray(game.soloCuts) ? game.soloCuts : [];
  const soloIds = new Set(soloCuts.flatMap((entry) => entry.ids));
  return (
    <main className="play-view">
      <MissionStatus game={game} cutWires={cutWires} />
      <div className="player-racks">
        {game.players.map((player) => (
          <Rack
            player={player}
            game={game}
            viewerId={viewerId}
            busy={busy}
            sourceId={selectedSourceId}
            soloIds={soloIds}
            onSource={onSource}
            onTarget={onTarget}
            key={player.id}
          />
        ))}
      </div>
      {game.ownTurn && (
        <div className="action-bar">
          <div className="action-options">
            {soloCuts.map((entry) => (
              <button
                className="solo-option"
                type="button"
                disabled={busy}
                onClick={() => onSolo(entry.ids[0])}
                key={entry.kind + entry.value}
              >
                单剪 {entry.kind === "number" ? entry.value : "黄"}
              </button>
            ))}
            {game.canRevealRed && (
              <button className="solo-option" type="button" disabled={busy} onClick={onRevealRed}>
                公开红线
              </button>
            )}
          </div>
          <p className="turn-hint">选一根自己的，再选队友的</p>
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
  onCount,
  onName,
  onStart,
  onReveal,
  onSource,
  onTarget,
  onSolo,
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
        onSource={onSource}
        onTarget={onTarget}
        onSolo={onSolo}
        onRevealRed={onRevealRed}
        error={error || roomError}
      />
    );
  }
  return <Shell>{content}</Shell>;
}

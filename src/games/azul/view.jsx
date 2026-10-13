import { h } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import Dialog from "../../shared/dialog.jsx";
import { canPlace, COLORS, FLOOR_COSTS, WALL_COLORS } from "./engine.js";

const signed = value => value > 0 ? `+${value}` : String(value);
const nameOf = (game, id) => game.players.find(player => player.id === id)?.name || "玩家";

export function Tile({ color, ghost = false, preview = false }) {
  return <span className={`tile tile-${color}${ghost ? " ghost" : ""}${preview ? " preview" : ""}`}
    role="img" aria-label={color === -1 ? "起始玩家标记" : `${COLORS[color]}色花砖${ghost ? "空位" : ""}`}>
    {color === -1 ? <b>1</b> : <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {color === 0 && <><path d="M16 4L28 16L16 28L4 16Z" /><path d="M16 9L23 16L16 23L9 16Z" /></>}
      {color === 1 && <><path d="M16 3L19 11L27 7L23 15L29 20L20 21L16 29L12 21L3 20L9 15L5 7L13 11Z" /><circle cx="16" cy="16" r="3" /></>}
      {color === 2 && <><path d="M4 4H13V13H4ZM19 4H28V13H19ZM4 19H13V28H4ZM19 19H28V28H19Z" /><circle cx="16" cy="16" r="3" /></>}
      {color === 3 && <><path d="M4 16C4 4 16 4 16 16C16 4 28 4 28 16C28 28 16 28 16 16C16 28 4 28 4 16Z" /><path d="M8 8L24 24M24 8L8 24" /></>}
      {color === 4 && <><path d="M3 16H29M16 3V29M7 7L25 25M25 7L7 25" /><path d="M16 4L28 16L16 28L4 16Z" /></>}
    </svg>}
  </span>;
}

function Entry({ onStart, launchUrl }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["玩家 1", "玩家 2", "玩家 3", "玩家 4"]);
  const [setup, setSetup] = useState(false);
  return <main className="entry">
    <div className="entry-art" aria-hidden="true">{Array.from({ length: 25 }, (_, index) =>
      <Tile key={index} color={WALL_COLORS[Math.floor(index / 5)][index % 5]} />)}</div>
    <p className="eyebrow">THE ART OF CHOOSING</p>
    <h1>花砖物语</h1><p className="entry-subtitle">AZUL · 把每一次选择，铺成一面风景。</p>
    <p className="entry-meta">2–4 人 · 约 30–45 分钟 · 原版彩色墙面</p>
    <button className="primary-button entry-start" onClick={() => setSetup(true)}>本地开局 →</button>
    <a className="room-link" href={launchUrl}>创建在线房间 ↗</a>
    <Dialog open={setup} onClose={() => setSetup(false)} className="setup-dialog app-dialog" aria-label="设置本地玩家">
      <div className="help-heading"><strong>围坐开局</strong><button aria-label="关闭玩家设置" onClick={() => setSetup(false)}>×</button></div>
      <form className="setup-panel" onSubmit={event => { event.preventDefault(); setSetup(false); onStart(names.slice(0, count)); }}>
      <p className="setup-note">大家轮流在同一屏幕操作。</p>
      <div className="count-picker" role="group" aria-label="玩家人数">{[2, 3, 4].map(value =>
        <button type="button" className={count === value ? "selected" : ""} aria-pressed={count === value}
          onClick={() => setCount(value)}>{value} 人</button>)}</div>
      <div className="name-fields">{names.slice(0, count).map((name, index) =>
        <label key={index}><span>玩家 {index + 1}</span><input value={name} maxLength={24}
          onInput={event => setNames(names.map((value, offset) => index === offset ? event.currentTarget.value : value))} /></label>)}</div>
      <button className="primary-button start-button" type="submit">开始铺砖 <span aria-hidden="true">→</span></button>
    </form>
    </Dialog>
  </main>;
}

function Sources({ game, selection, onSource, busy }) {
  const available = game.canDraft && !busy;
  return <section className="supply-panel panel" aria-label="花砖供应区">
    <div className="panel-heading"><h2>工厂供货</h2><span>点圆盘选颜色</span></div>
    <div className="factories">{game.factories.map((tiles, index) =>
      <button className={`factory${tiles.length ? "" : " empty"}${selection?.source === index ? " selected" : ""}`} key={index}
        disabled={!available || !tiles.length} aria-label={`工厂 ${index + 1}，${tiles.length ? [...new Set(tiles)].map(color => `${COLORS[color]}色 ${tiles.filter(tile => tile === color).length} 块`).join("，") : "已空"}`}
        aria-pressed={selection?.source === index} onClick={() => onSource(index)}>
        <span className="factory-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="factory-tiles">{tiles.length ? tiles.map((color, tileIndex) => <Tile color={color} key={tileIndex} />) : <span className="empty-factory">·</span>}</span>
      </button>)}</div>
    <button className={`center-zone${selection?.source === -1 ? " selected" : ""}`} onClick={() => onSource(-1)} disabled={!available || !game.center.length}
      aria-label={`桌面中央，${game.center.length} 块花砖${game.centerMarker ? "，首取者拿起始标记" : ""}`} aria-pressed={selection?.source === -1}>
      <span className="center-title">中央 {game.centerMarker && <Tile color={-1} />}</span>
      <span className="center-tiles">{game.center.length ? [...new Set(game.center)].sort().map(color => <span className="center-group" key={color}>
        <Tile color={color} /><b>×{game.center.filter(tile => tile === color).length}</b></span>) : <span className="empty-center">剩余花砖移到这里</span>}</span>
    </button>
  </section>;
}

function PlayerBoard({ game, playerId, selection, destination, onDestination, busy }) {
  const board = game.boards[playerId];
  const interactive = game.canDraft && playerId === game.viewerId && !!selection && !busy;
  const marker = selection?.source === -1 && game.centerMarker;
  const overflow = selection && destination !== null
    ? selection.count - (destination === -1 ? 0 : Math.min(selection.count, destination + 1 - board.lines[destination].length)) : 0;
  const floorPreview = selection && destination !== null ? [...(marker ? [-1] : []), ...Array(overflow).fill(selection.color)] : [];
  return <section className="board-panel panel" aria-label={`${nameOf(game, playerId)}的玩家板`}>
    <div className="panel-heading"><h2>{nameOf(game, playerId)}的工坊</h2><strong className="board-score">{board.score}<small> 分</small></strong></div>
    <div className="board-labels"><span>花纹行 · 集齐后铺墙</span><span>墙面 · 横纵连线计分</span></div>
    <div className="workshop">{board.lines.map((line, row) => {
      const allowed = interactive && canPlace(board, row, selection.color);
      const chosen = playerId === game.viewerId && destination === row && selection;
      const added = chosen ? Math.min(selection.count, row + 1 - line.length) : 0;
      const wallColumn = chosen ? WALL_COLORS[row].indexOf(selection.color) : -1;
      return <div className="workshop-row" key={row}>
        <button className={`pattern-line${chosen ? " chosen" : ""}${allowed ? " allowed" : ""}`}
          disabled={!allowed} aria-pressed={!!chosen} aria-label={`第 ${row + 1} 行，已有 ${line.length}/${row + 1} 块${line.length ? `，${COLORS[line[0]]}色` : ""}${allowed ? "，可放置" : ""}`}
          onClick={() => onDestination(row)}>
          <span className="row-number">{row + 1}</span>
          {Array.from({ length: row + 1 }, (_, slot) => {
            const filled = slot >= row + 1 - line.length;
            const preview = !filled && slot >= row + 1 - line.length - added;
            return filled ? <Tile key={slot} color={line[0]} /> : preview ? <Tile key={slot} color={selection.color} preview /> : <span className="tile empty-slot" key={slot} />;
          })}
        </button><span className="row-arrow" aria-hidden="true">›</span>
        <div className="wall-row">{WALL_COLORS[row].map((color, column) => <Tile key={column} color={color}
          ghost={!board.wall[row][column] && !(wallColumn === column && line.length + added === row + 1)}
          preview={!board.wall[row][column] && wallColumn === column && line.length + added === row + 1} />)}</div>
      </div>;
    })}</div>
    <div className="floor-heading"><h3>地板区</h3><span>溢出与起始标记在此扣分</span></div>
    <button className={`floor-line${destination === -1 && selection && playerId === game.viewerId ? " chosen" : ""}`}
      disabled={!interactive} aria-pressed={destination === -1 && !!selection} aria-label="选择地板区，全部弃置" onClick={() => onDestination(-1)}>
      {FLOOR_COSTS.map((cost, index) => <span className="floor-slot" key={index}>
        <small>−{cost}</small>{index < board.floor.length ? <Tile color={board.floor[index]} />
          : playerId === game.viewerId && floorPreview[index - board.floor.length] !== undefined ? <Tile color={floorPreview[index - board.floor.length]} preview />
            : <span className="tile empty-slot" />}</span>)}
    </button>
  </section>;
}

// Fit the complete tabletop to the available app area, including short landscape screens.
function GameArena({ game, playerId, selection, destination, onDestination, onSource, busy }) {
  const arenaRef = useRef(null);
  const [layout, setLayout] = useState(null);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const wide = width / height > 1.5 && width >= 600;
      const designWidth = wide ? 960 : 380;
      const designHeight = wide ? 370 : game.players.length === 2 ? 492 : 556;
      setLayout({ wide, width: designWidth, height: designHeight, scale: Math.min(width / designWidth, height / designHeight, 1.35) });
    });
    observer.observe(arenaRef.current);
    return () => observer.disconnect();
  }, [game.players.length]);
  return <div className="game-arena" ref={arenaRef}>
    <div className={`table-layout ${layout?.wide ? "table-wide" : "table-portrait"}`} style={layout ? {
      width: layout.width, height: layout.height, transform: `translate(-50%, -50%) scale(${layout.scale})`,
    } : { visibility: "hidden" }}>
      <Sources game={game} selection={selection} onSource={onSource} busy={busy} />
      <PlayerBoard game={game} playerId={playerId} selection={selection} destination={destination} onDestination={onDestination} busy={busy} />
    </div>
  </div>;
}

function Settlement({ game, onAction, onExit, busy, room }) {
  const ended = game.phase === "ended";
  return <section className={`settlement panel${ended ? " final" : ""}`} aria-live="polite">
    <p className="eyebrow">{ended ? "A WALL WELL MADE" : `ROUND ${game.round} COMPLETE`}</p>
    <h2>{ended ? `${game.winners.map(id => nameOf(game, id)).join("、")}${game.winners.length > 1 ? "共同获胜" : "获胜"}` : "本轮铺砖完成"}</h2>
    <div className="results">{game.players.map(player => {
      const result = game.settlement.results[player.id];
      return <div className="result" key={player.id}>
        <strong>{player.name}</strong><span>铺墙 +{result.placements.reduce((sum, placement) => sum + placement.points, 0)} · 地板 −{result.penalty}
          {result.bonus && <small>横行 {result.bonus.rows}×2 · 竖列 {result.bonus.columns}×7 · 同色 {result.bonus.colors}×10</small>}</span>
        <b>{game.boards[player.id].score}<small>本轮 {signed(result.delta)}</small></b>
      </div>;
    })}</div>
    {!ended && <p>下轮由 {nameOf(game, game.nextStarterId || game.starterId)} 先手。</p>}
    {ended && <p>同分时完整横行更多者获胜，仍相同则共享胜利。</p>}
    <div className="settlement-actions"><button className="primary-button" disabled={busy || !game.canContinue}
      onClick={() => onAction({ type: ended ? "rematch" : "next_round" })}>{ended ? "再来一局" : "开始下一轮"} →</button>
      {ended && !room && <button className="secondary-button" onClick={onExit}>更换玩家</button>}</div>
  </section>;
}

export default function AzulApp({ room, game, busy, error, onStart, onExit, onAction, launchUrl }) {
  const [help, setHelp] = useState(false);
  const [selected, setSelected] = useState(null);
  const [destination, setDestination] = useState(null);
  const [overviewId, setOverviewId] = useState(null);
  const [overview, setOverview] = useState(false);
  const [report, setReport] = useState(false);
  const [sourceChoice, setSourceChoice] = useState(null);
  useEffect(() => {
    setSelected(null); setDestination(null); setSourceChoice(null);
    setReport(!!game?.settlement);
  }, [game?.step, game?.viewerId]);
  const selection = selected?.step === game?.step && game?.canDraft ? selected : null;
  const visibleId = game?.boards[game.viewerId] ? game.viewerId : game?.currentPlayerId;
  const inspectedId = game?.boards[overviewId] ? overviewId : visibleId;
  const active = game && nameOf(game, game.currentPlayerId);
  const overflow = game && selection && destination !== null
    ? Math.max(0, selection.count - (destination === -1 ? 0 : destination + 1 - game.boards[game.viewerId].lines[destination].length)) : 0;
  const previewFloorCount = game && selection && destination !== null
    ? Math.min(7, game.boards[game.viewerId].floor.length + overflow + (selection.source === -1 && game.centerMarker ? 1 : 0)) : 0;
  const previewPenalty = FLOOR_COSTS.slice(0, previewFloorCount).reduce((a, b) => a + b, 0);
  const choiceTiles = sourceChoice && game && sourceChoice.step === game.step ? sourceChoice.source === -1 ? game.center : game.factories[sourceChoice.source] : [];
  const choose = (source, color) => {
    const tiles = source === -1 ? game.center : game.factories[source];
    setSelected({ source, color, count: tiles.filter(tile => tile === color).length, step: game.step });
    setDestination(null); setSourceChoice(null);
  };
  const openSource = source => {
    const tiles = source === -1 ? game.center : game.factories[source];
    const colors = [...new Set(tiles)];
    if (colors.length === 1) choose(source, colors[0]);
    else setSourceChoice({ source, step: game.step });
  };
  return <>
    <header className="azul-header"><a href="../" className="home-link" aria-label="返回桌游盒子">← <span>桌游盒子</span></a>
      <span className="brand">花砖物语 <small>AZUL</small></span>
      <button className="rules-button" onClick={() => setHelp(true)}>规则 <span aria-hidden="true">?</span></button></header>
    {!game ? room ? <main className="connection-panel"><img src="./icon.svg" alt="" /><h1>花砖物语</h1><p role="status">{error || "正在连接房间…"}</p></main>
      : <Entry onStart={onStart} launchUrl={launchUrl} /> : <main className="game-layout">
      <section className="turn-banner" aria-live="polite"><span className="round-pill">第 {game.round} 轮</span>
        <h1>{game.phase !== "drafting" ? game.phase === "ended" ? "游戏结束" : "本轮已结算" : game.canDraft ? `${active}的回合` : `等待 ${active}`}</h1>
        <button className="overview-button" onClick={() => { setOverviewId(visibleId); setOverview(true); }}>概览 <span aria-hidden="true">☷</span></button></section>
      <nav className="player-strip" aria-label="玩家积分，点击查看工坊">{game.players.map((player, index) =>
        <button className={`player-chip${game.phase === "drafting" && game.currentPlayerId === player.id ? " active" : ""}`} onClick={() => { setOverviewId(player.id); setOverview(true); }} key={player.id}
          aria-label={`查看${player.name}的工坊，${game.boards[player.id].score}分`}>
          <span className="player-avatar">{index + 1}</span><span className="player-name">{player.name}</span>
          <b>{game.boards[player.id].score}</b>
        </button>)}</nav>
      {error && <p className="error-message" role="alert">{error}</p>}
      <GameArena game={game} playerId={visibleId} selection={selection} destination={destination} onDestination={setDestination}
        onSource={openSource} busy={busy} />
      <section className="action-bar" aria-label="本回合操作"><div>
        <strong>{game.phase !== "drafting" ? game.phase === "ended" ? `${game.winners.map(id => nameOf(game, id)).join("、")}获胜` : "本轮铺砖完成" : selection ? `${COLORS[selection.color]}色 × ${selection.count}${destination !== null ? ` → ${destination === -1 ? "地板" : `第 ${destination + 1} 行`}` : ""}` : game.canDraft ? "选择一处花砖" : `等待 ${active} 选砖`}</strong>
        <span>{game.phase !== "drafting" ? <button className="report-link" onClick={() => setReport(true)}>查看结算详情 ↗</button> : selection ? destination === null ? "点击花纹行或地板" : `${overflow ? `溢出 ${overflow} 块 · ` : ""}地板扣 ${previewPenalty} 分${selection.source === -1 && game.centerMarker ? " · 下轮先手" : ""}` : "点圆盘或中央，拿走同色全部花砖"}</span></div>
        {game.phase === "drafting" ? <button className="primary-button" disabled={busy || !selection || destination === null || !game.canDraft}
          onClick={() => onAction({ type: "draft", source: selection.source, color: selection.color, row: destination })}>{busy ? "提交中…" : "确认拿砖"} →</button>
          : <button className="primary-button" disabled={busy || !game.canContinue} onClick={() => onAction({ type: game.phase === "ended" ? "rematch" : "next_round" })}>{game.phase === "ended" ? "再来一局" : "下一轮"} →</button>}
      </section>
    </main>}
    <Dialog open={!!sourceChoice && !!choiceTiles.length} onClose={() => setSourceChoice(null)} className="source-dialog app-dialog" aria-label="选择花砖颜色">
      <div className="help-heading"><strong>{sourceChoice?.source === -1 ? "桌面中央" : `工厂 ${(sourceChoice?.source ?? 0) + 1}`} · 选择颜色</strong><button aria-label="关闭选砖" onClick={() => setSourceChoice(null)}>×</button></div>
      <div className="source-options">{[...new Set(choiceTiles)].sort().map(color => <button key={color} className="source-option"
        aria-label={`拿取${COLORS[color]}色 ${choiceTiles.filter(tile => tile === color).length} 块`} onClick={() => choose(sourceChoice.source, color)}>
        <Tile color={color} /><span>{COLORS[color]}色</span><b>× {choiceTiles.filter(tile => tile === color).length}</b><span aria-hidden="true">→</span>
      </button>)}<p>{sourceChoice?.source === -1 ? game?.centerMarker ? "同时获得先手标记，放入地板扣分。" : "其余颜色留在中央。" : "其余颜色将移到桌面中央。"}</p></div>
    </Dialog>
    <Dialog open={overview && !!game} onClose={() => setOverview(false)} className="overview-dialog app-dialog" aria-label="对局概览">
      <div className="help-heading"><strong>对局概览</strong><button aria-label="关闭概览" onClick={() => setOverview(false)}>×</button></div>
      {game && <div className="dialog-scroll"><nav className="overview-tabs" aria-label="选择查看的玩家">{game.players.map(player => <button aria-pressed={inspectedId === player.id}
        className={inspectedId === player.id ? "selected" : ""} onClick={() => setOverviewId(player.id)}>{player.name} · {game.boards[player.id].score} 分</button>)}</nav>
        <PlayerBoard game={game} playerId={inspectedId} selection={null} destination={null} busy onDestination={() => {}} />
        <div className="overview-notes"><p>第 {game.round} 轮 · {room ? "在线房间" : "本地轮流"} · {game.players.length} 人</p>
          <p>袋中 {game.counts.bag} 块 · 弃砖 {game.counts.discard} 块</p><p>下轮先手：{game.centerMarker ? "尚未确定" : nameOf(game, game.nextStarterId || game.starterId)}</p>
          <p>终局奖励：横行 +2 · 竖列 +7 · 同色五块 +10</p>
          {game.lastMove && <p>上一步：{nameOf(game, game.lastMove.playerId)}拿了 {game.lastMove.count} 块{COLORS[game.lastMove.color]}砖，{game.lastMove.row === -1 ? "全部放入地板" : `放入第 ${game.lastMove.row + 1} 行${game.lastMove.overflow ? `，溢出 ${game.lastMove.overflow} 块` : ""}`}。</p>}</div>
      </div>}
    </Dialog>
    <Dialog open={report && !!game?.settlement} onClose={() => setReport(false)} className="report-dialog app-dialog" aria-label="轮次结算">
      <div className="help-heading"><strong>轮次结算</strong><button aria-label="关闭结算" onClick={() => setReport(false)}>×</button></div>
      {game?.settlement && <div className="dialog-scroll"><Settlement game={game} onAction={onAction} onExit={onExit} busy={busy} room={room} /></div>}
    </Dialog>
    <Dialog open={help} onClose={() => setHelp(false)} className="azul-help" aria-label="花砖物语规则">
      <div className="help-heading"><strong>游戏规则</strong><button aria-label="关闭规则" onClick={() => setHelp(false)}>×</button></div>
      <iframe title="花砖物语完整规则" src="./help.html" /></Dialog>
  </>;
}

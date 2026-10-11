import { h } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Layers, Trophy, X } from "lucide";
import Dialog from "../../shared/dialog.jsx";
import { HAND_NAMES } from "./engine.js";

const SUITS = { spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" };
const SUIT_NAMES = {
  spades: "黑桃",
  hearts: "红桃",
  clubs: "梅花",
  diamonds: "方块",
};
const rankName = (rank) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank] || String(rank);
const handName = (hand) =>
  hand
    ? HAND_NAMES[hand[0]] +
    (hand.length > 1 ? " · " + hand.slice(1).map(rankName).join(" / ") : "")
    : "未知";
const signed = (score) => (score > 0 ? "+" + score : String(score));
const TABLE_TOOLS = [
  { id: "decks", label: "牌堆与弃牌", icon: Layers },
  { id: "scores", label: "积分榜", icon: Trophy },
];

function Icon({ nodes }) {
  return (
    <svg
      className="icon"
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
      {nodes.map(([tag, attributes], index) =>
        h(tag, {
          ...Object.fromEntries(
            Object.entries(attributes).map(([key, value]) => [
              key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
              value,
            ]),
          ),
          key: index,
        }),
      )}
    </svg>
  );
}

function BellIcon({ className = "", pressId = 0, ...props }) {
  return (
    <svg
      className={`bell-art ${className}`}
      viewBox="0 0 160 120"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <g
        stroke="#143d38"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g key={pressId} className={`bell-plunger${pressId ? " is-pressed" : ""}`}>
          <path d="M76 30V20H84V30" fill="#ffdf28" />
          <rect x="68" y="14" width="24" height="9" rx="4.5" fill="#ffdf28" />
        </g>
        <path
          d="M33 88C33 55 49 30 80 30C111 30 127 55 127 88Z"
          fill="#ffdf28"
        />
        <rect x="24" y="87" width="112" height="14" rx="7" fill="#f4f4e9" />
        <path d="M49 67C51 57 56 50 63 46" stroke="#fff9be" stroke-width="5" />
        <path
          className="bell-ring"
          d="M21 45L13 39M19 63H9M139 45L147 39M141 63H151"
        />
      </g>
    </svg>
  );
}

function Card({ card, small = false, fresh = false, flip = false }) {
  const hidden = !card || card.hidden;
  const red = card?.suit === "hearts" || card?.suit === "diamonds";
  if (flip && !hidden)
    return (
      <span
        className={`playing-card ${small ? "card-small" : ""} reveal-card`}
        role="img"
        aria-label={SUIT_NAMES[card.suit] + rankName(card.rank)}
      >
        <span className="card-flip-inner">
          <span className="card-flip-face card-flip-back" aria-hidden="true">
            <Card card={{ hidden: true }} small={small} />
          </span>
          <span className="card-flip-face card-flip-front" aria-hidden="true">
            <Card card={card} small={small} />
          </span>
        </span>
      </span>
    );
  return (
    <span
      className={`playing-card ${hidden ? "card-back" : red ? "red-suit" : "black-suit"} ${small ? "card-small" : ""} ${fresh ? "card-fresh" : ""}`}
      role="img"
      aria-label={
        hidden ? "隐藏的底牌" : SUIT_NAMES[card.suit] + rankName(card.rank)
      }
    >
      {hidden ? (
        <span className="back-emblem">
          H<span>♠</span>H
        </span>
      ) : (
        <span className="card-face" aria-hidden="true">
          <span className="card-corner">
            <span className={`card-rank${card.rank === 10 ? " is-ten" : ""}`}>
              {rankName(card.rank)}
            </span>
            <span className="card-suit">{SUITS[card.suit]}</span>
          </span>
          <span className="card-pip">{SUITS[card.suit]}</span>
        </span>
      )}
    </span>
  );
}

function Entry({ launchUrl, onRules }) {
  return (
    <main className="entry-panel">
      <img className="entry-icon" src="./icon.svg" alt="" />
      <h1>德州心脏病</h1>
      <p className="english-title">Halli Hold’em</p>
      <p className="entry-meta">2–8 人 · 在线抢铃</p>
      <div className="entry-actions">
        <a className="primary-button" href={launchUrl}>
          创建房间
        </a>
        <button className="secondary-button" onClick={onRules}>
          游戏规则
        </button>
      </div>
    </main>
  );
}

function Board({ title, cards, dynamic = false, wide = false, compact = false }) {
  const boardRef = useRef(null);

  useEffect(() => {
    if (!dynamic || !boardRef.current) return;
    boardRef.current.scrollTop = boardRef.current.scrollHeight;
  }, [dynamic, cards.length, wide, compact]);

  // Keep each exposed left edge wide enough for a two-digit rank and its suit.
  const rowSize = wide ? 9 : 7;
  const rows = dynamic ? Array.from({ length: Math.ceil(cards.length / rowSize) },
    (_, index) => cards.slice(index * rowSize, (index + 1) * rowSize)) : [];

  return (
    <section
      className={`board-zone ${dynamic ? "dynamic-zone" : "fixed-zone"}`}
      aria-label={`${title}，${cards.length} 张`}
    >
      <div
        className="board-cards"
        ref={boardRef}
        tabIndex={dynamic && cards.length ? 0 : undefined}
      >
        {cards.length ? dynamic ? (
          rows.map((row, rowIndex) => (
            <div className="dynamic-card-row" key={rowIndex}>
              {row.map((card, index) => (
                <Card card={card} small
                  fresh={rowIndex * rowSize + index === cards.length - 1}
                  key={`${index}-${card.rank}-${card.suit}`} />
              ))}
            </div>
          ))
        ) : (
          cards.map((card, index) => <Card card={card} key={`${index}-${card.rank}-${card.suit}`} />)
        ) : (
          <div className="empty-board" aria-label="暂无动态公牌">
            <span aria-hidden="true">＋</span>
          </div>
        )}
      </div>
    </section>
  );
}

// Clockwise perimeter seats keep the centre clear, including eight-player tables.
const SEATS = {
  2: [[50, 90], [50, 10]],
  3: [[50, 90], [20, 10], [80, 10]],
  4: [[50, 90], [10, 50], [50, 10], [90, 50]],
  5: [[50, 90], [10, 65], [25, 10], [75, 10], [90, 65]],
  6: [[50, 90], [10, 72], [10, 28], [50, 10], [90, 28], [90, 72]],
  7: [[50, 90], [20, 90], [10, 50], [30, 10], [70, 10], [90, 50], [80, 90]],
  8: [[50, 90], [20, 90], [10, 50], [20, 10], [50, 10], [80, 10], [90, 50], [80, 90]],
};

function TableSeats({ game }) {
  const viewerIndex = Math.max(
    0,
    game.players.findIndex((player) => player.id === game.viewerId),
  );
  return (
    <section className="table-seats" aria-label="玩家座位与底牌">
      {game.players.map((player, index) => {
        const own = player.id === game.viewerId;
        const relative =
          (index - viewerIndex + game.players.length) % game.players.length;
        const [x, y] = SEATS[game.players.length][relative];
        const active = player.id === game.currentPlayerId && !game.settlement;
        return (
          <div
            key={player.id}
            className={`table-seat ${own ? "own-seat" : ""} ${active ? "active-seat" : ""}`}
            aria-current={active ? "true" : undefined}
            style={{
              "--seat-x": `${x}%`,
              "--seat-y": `${y}%`,
            }}
          >
            <div className="seat-hand">
              {game.hands[player.id]?.map((card, cardIndex) => (
                <Card
                  key={cardIndex}
                  card={card}
                  small
                  flip={own && game.settlement?.reason === "bell"}
                />
              ))}
            </div>
            <div className="seat-label">
              <span className="seat-player" title={player.name}>
                {player.name}
                {own && <small>你</small>}
              </span>
              <strong className={game.scores[player.id] < 0 ? "negative" : ""}>
                {game.scores[player.id]}
              </strong>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function PokerTable({ game, busy, onAction }) {
  const arenaRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [bellPressId, setBellPressId] = useState(0);
  useLayoutEffect(() => {
    // Fit a logical DOM stage uniformly; game-state changes never resize its host.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const wide = width / height >= 1.2;
      const designWidth = wide ? 760 : 380;
      const designHeight = Math.max(wide ? 420 : width >= 560 ? 520 : 380,
        Math.min(560, height / width * designWidth));
      setLayout({
        wide, width: designWidth, height: designHeight,
        scale: Math.min(width / designWidth, height / designHeight)
      });
    });
    observer.observe(arenaRef.current);
    return () => observer.disconnect();
  }, []);
  const compact = !!layout && layout.height < 480;
  const short = !!layout && layout.height < (layout.wide ? 554 : 480);
  const canRing = (game.canBurst || game.canForced) && !game.settlement;
  return (
    <section
      className={`table-arena seats-${game.players.length}`}
      aria-label="牌桌"
      ref={arenaRef}
    >
      <div className={`table-stage ${layout?.wide ? "table-wide" : "table-portrait"}${short ? " table-short" : ""}${compact ? " table-compact" : ""}`}
        style={layout ? {
          width: layout.width, height: layout.height,
          transform: `translate(-50%, -50%) scale(${layout.scale})`
        } : { visibility: "hidden" }}>
        <div className="table-felt" aria-hidden="true">
          <div className="felt-line" />
        </div>
        <div className="table-center">
          <Board title="固定公牌" cards={game.fixed} />
          <div className={`table-bell ${canRing ? "bell-ready" : ""}`}>
            <button
              className="physical-bell"
              aria-label="拍铃"
              disabled={busy || !canRing}
              onClick={() => {
                setBellPressId((id) => id + 1);
                onAction({ type: "bell" });
              }}
            >
              <BellIcon pressId={bellPressId} />
            </button>
          </div>
          <Board
            title="动态公牌"
            cards={game.dynamic}
            wide={layout?.wide}
            compact={compact}
            dynamic
          />
        </div>
        <TableSeats game={game} />
      </div>
    </section>
  );
}

function CandidateSlot({ card, flip = false }) {
  return (
    <div
      className="candidate-option candidate-display"
      aria-label={card.empty ? "已放入动态公牌" : undefined}
    >
      {card.empty ? (
        <span className="playing-card card-empty" aria-hidden="true" />
      ) : (
        <Card card={card} flip={flip && !card.hidden} />
      )}
      <span className={card.source === "permanent" ? "permanent-source" : ""}>
        {card.source === "permanent" ? "单抽堆" : card.source === "ordinary" ? "双抽堆" : "\u00a0"}
      </span>
    </div>
  );
}

function Actions({ game, busy, onAction }) {
  const ownTurn = game.currentPlayerId === game.viewerId;
  const showDrawActions = ownTurn && game.canDraw;
  const showDiscards = game.phase === "before_draw" && Boolean(game.discardSlots?.length) && !showDrawActions;
  return (
    <section className="action-panel">
      <div className="turn-actions">
        {game.phase === "choosing" && (
          <div className="candidate-row" aria-label="候选牌">
            {game.canPlace ? (
              game.candidates.map((card, index) => (
                <button
                  className="candidate-option"
                  key={index}
                  disabled={busy}
                  onClick={() => onAction({ type: "place", index })}
                  aria-label={`放入${SUIT_NAMES[card.suit]}${rankName(card.rank)}`}
                >
                  <Card card={card} />
                  <span
                    className={
                      card.source === "permanent" ? "permanent-source" : ""
                    }
                  >
                    {card.source === "permanent" ? "单抽堆" : "双抽堆"}
                  </span>
                </button>
              ))
            ) : (
              Array.from({ length: game.candidateCount }, (_, index) => (
                <CandidateSlot key={index} card={{ hidden: true }} />
              ))
            )}
          </div>
        )}
        {showDiscards && (
          <div className="candidate-row" aria-label="本回合弃牌">
            {game.discardSlots.map((card, index) => <CandidateSlot key={index} card={card} flip={game.viewerId !== game.window?.placerId} />)}
          </div>
        )}
        {showDrawActions && (
          <div className="draw-actions">
            {game.canLucky && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => onAction({ type: "bell", declaration: "lucky" })}
              >
                Lucky dog
              </button>
            )}
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => onAction({ type: "draw" })}
            >
              抽牌
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Settlement({ game, busy, onAction, onClose }) {
  const result = game.settlement;
  const actor = game.players.find((player) => player.id === result.actorId);
  const next = game.players.find(
    (player) => player.id === result.nextStarterId,
  );
  const declaration = { burst: "放牌后拍铃", forced: "放牌前拍铃", lucky: "Lucky dog" }[
    result.declaration
  ];
  const winnerNames = game.winners
    .map((id) => game.players.find((player) => player.id === id)?.name)
    .join("、");
  return (
    <section
      className={`settlement-panel ${result.correct ? "correct" : "incorrect"}`}
      aria-live="polite"
    >
      <h2>
        {game.phase === "ended"
          ? `${winnerNames}${game.winners.length > 1 ? "共同获胜" : "获胜"}`
          : result.reason === "exhausted"
            ? "无牌可抽 · 不计分"
            : result.correct
              ? "拍对了！"
              : "判断错误"}
      </h2>
      {result.reason === "bell" && (
        <>
          <p>
            {actor?.name} · {declaration}
          </p>
          <div className="strength-comparison">
            <div>
              <span>固定强度</span>
              <strong>{handName(result.fixedStrength)}</strong>
            </div>
            <span className="comparison-sign">
              {result.wasBurst ? "＜" : "≥"}
            </span>
            <div>
              <span>动态强度</span>
              <strong>{handName(result.dynamicStrength)}</strong>
            </div>
          </div>
          {result.declaration === "forced" && (
            <div className="forced-checks">
              {result.wasBurst && <p>放牌前已爆牌</p>}
              {result.checks.map((check, index) => (
                <div className="forced-check" key={index}>
                  <Card card={check.card} small />
                  <span>
                    {handName(check.strength)}
                    <strong>{check.burst ? "爆牌" : "未爆牌"}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div
            className="result-table"
            role="table"
            aria-label="本轮牌型与得分"
          >
            <div className="result-row table-heading" role="row">
              <span>玩家</span>
              <span>固定 / 动态</span>
              <span>得分</span>
            </div>
            {game.players.map((player) => (
              <div className="result-row" role="row" key={player.id}>
                <strong>{player.name}</strong>
                <span>
                  {handName(result.fixedResults[player.id])}
                  <small>{handName(result.dynamicResults[player.id])}</small>
                </span>
                <strong
                  className={
                    result.deltas[player.id] < 0
                      ? "negative"
                      : result.deltas[player.id] > 0
                        ? "positive"
                        : ""
                  }
                >
                  {signed(result.deltas[player.id])}
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
      {game.phase !== "ended" && (
        <p className="subtle">{next ? `${next.name}先手` : "随机先手"}</p>
      )}
      <div className="settlement-actions">
        <button
          className="primary-button"
          disabled={
            busy || !game.players.some((player) => player.id === game.viewerId)
          }
          onClick={() =>
            onAction({
              type: game.phase === "ended" ? "rematch" : "next_round",
            })
          }
        >
          {game.phase === "ended" ? "再来一局" : "下一轮"}
        </button>
        <button className="table-link" type="button" onClick={onClose}>
          查看牌桌
        </button>
      </div>
    </section>
  );
}

function Discards({ game }) {
  return (
    <>
      <dl className="deck-counts">
        <div><dt>双抽牌堆</dt><dd>{game.counts.ordinaryDeck}</dd></div>
        <div><dt>单抽牌堆</dt><dd>{game.counts.permanentDeck}</dd></div>
        <div><dt>明弃区</dt><dd>{game.ordinaryDiscard.length}</dd></div>
        <div><dt>暗弃区</dt><dd>{game.counts.permanentDiscard}</dd></div>
      </dl>
      <h3>明弃牌</h3>
      {game.ordinaryDiscard.length ? (
        <div className="discard-cards">
          {game.ordinaryDiscard.map((card, index) => (
            <Card key={index} card={card} small />
          ))}
        </div>
      ) : <p className="subtle">暂无明弃牌</p>}
      {game.recentOrdinaryDiscard.length > 0 && (
        <>
          <h3>本回合公开弃牌</h3>
          <div className="discard-cards">
            {game.recentOrdinaryDiscard.map((card, index) => (
              <Card key={index} card={card} small />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Scoreboard({ game }) {
  const players = [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id]);
  return (
    <>
      <p className="scoreboard-target">胜利目标 <strong>{game.targetScore}</strong> 分</p>
      <table className="scoreboard">
        <thead><tr><th>排名</th><th>玩家</th><th>积分</th></tr></thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className={player.id === game.viewerId ? "viewer-score" : ""}>
              <td>{players.findIndex((p) => game.scores[p.id] === game.scores[player.id]) + 1}</td>
              <th scope="row">{player.name}{player.id === game.viewerId && <small>你</small>}</th>
              <td className={game.scores[player.id] < 0 ? "negative" : ""}>{game.scores[player.id]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function HalliHoldemApp(props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState({ kind: "decks", open: false });
  const infoTitle = TABLE_TOOLS.find((tool) => tool.id === infoDialog.kind).label;
  const [result, setResult] = useState({ key: null, open: false });
  const resultTimer = useRef(null);
  const { game, room, launchUrl, error, busy, onAction } = props;
  const settled = !!game?.settlement;
  const settlementKey = settled
    ? `${game.round}:${game.step}:${game.viewerId}:${game.settlement.reason}`
    : null;
  const resultOpen = settled && result.key === settlementKey && result.open;
  useEffect(() => {
    setResult({ key: settlementKey, open: false });
    if (!settlementKey) return;
    resultTimer.current = setTimeout(
      () => {
        setInfoDialog((dialog) => ({ ...dialog, open: false }));
        setResult({ key: settlementKey, open: true });
      },
      game.settlement.reason === "bell" ? 2000 : 0,
    );
    return () => clearTimeout(resultTimer.current);
  }, [settlementKey]);
  function showResult(open) {
    clearTimeout(resultTimer.current);
    if (open) setInfoDialog((dialog) => ({ ...dialog, open: false }));
    setResult({ key: settlementKey, open });
  }
  function closeInfo() {
    setInfoDialog((dialog) => ({ ...dialog, open: false }));
  }
  return (
    <div className={`halli-shell${game ? " is-playing" : ""}`}>
      <header className="topbar">
        <div className="topbar-title">德州心脏病</div>
      </header>
      {error && (
        <p className="error-message" role="status">
          {error}
        </p>
      )}
      {!game ? (
        room ? (
          <main className="loading-panel">
            <img src="./icon.svg" alt="" />
            <p>等待房间牌桌…</p>
          </main>
        ) : (
          <Entry launchUrl={launchUrl} onRules={() => setHelpOpen(true)} />
        )
      ) : (
        <main className="game-table">
          <div className="table-workspace">
            <PokerTable game={game} busy={busy} onAction={onAction} />
            <aside className="player-controls" aria-label="回合操作与弃牌">
              {settled ? (
                <div className="settled-controls">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => showResult(true)}
                  >
                    查看结算
                  </button>
                </div>
              ) : (
                <Actions game={game} busy={busy} onAction={onAction} />
              )}
              <nav className="table-tools" aria-label="牌桌信息">
                {TABLE_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className="table-tool"
                    aria-label={tool.label}
                    aria-haspopup="dialog"
                    onClick={() => setInfoDialog({ kind: tool.id, open: true })}
                  >
                    <Icon nodes={tool.icon} />
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        </main>
      )}
      {game && (
        <Dialog
          open={infoDialog.open}
          onClose={closeInfo}
          className="settlement-dialog info-dialog"
          aria-label={infoTitle}
        >
          <header className="info-dialog-header">
            <h2>{infoTitle}</h2>
            <button
              className="help-dialog-close"
              type="button"
              onClick={closeInfo}
              aria-label="关闭牌桌信息"
            >
              <Icon nodes={X} />
            </button>
          </header>
          <div className="info-dialog-body">
            {infoDialog.kind === "decks" && <Discards game={game} />}
            {infoDialog.kind === "scores" && <Scoreboard game={game} />}
          </div>
        </Dialog>
      )}
      {settled && (
        <Dialog
          open={resultOpen}
          onClose={() => showResult(false)}
          className="settlement-dialog"
          aria-label={game.phase === "ended" ? "本局结算" : "本轮结算"}
        >
          <button
            className="help-dialog-close"
            type="button"
            onClick={() => showResult(false)}
            aria-label="关闭结算"
          >
            <Icon nodes={X} />
          </button>
          <Settlement
            game={game}
            busy={busy}
            onAction={onAction}
            onClose={() => showResult(false)}
          />
        </Dialog>
      )}
      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        className="help-dialog"
        aria-label="德州心脏病规则"
      >
        <div className="help-dialog-content">
          <button
            className="help-dialog-close"
            type="button"
            onClick={() => setHelpOpen(false)}
            aria-label="关闭规则"
          >
            <Icon nodes={X} />
          </button>
          <iframe
            className="help-frame"
            src="./help.html"
            title="德州心脏病规则"
          />
        </div>
      </Dialog>
    </div>
  );
}

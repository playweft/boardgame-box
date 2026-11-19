import { Fragment, h } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  Crown,
  Gem as GemIcon,
  History,
  LockKeyhole,
  UsersRound,
  X,
} from "lucide";
import Dialog from "../../shared/dialog.jsx";
import GameTopbar from "../../shared/game-topbar.jsx";
import LucideIcon from "../../shared/lucide-icon.jsx";
import diamond from "./assets/diamond.svg";
import emerald from "./assets/emerald.svg";
import gold from "./assets/gold.svg";
import onyx from "./assets/onyx.svg";
import ruby from "./assets/ruby.svg";
import sapphire from "./assets/sapphire.svg";
import {
  CARDS,
  COLORS,
  COLOR_NAMES,
  TOKEN_COLORS,
  costAfterBonuses,
  paymentFor,
  tokenCount,
} from "./engine.js";

const icons = {
  crown: Crown,
  gem: GemIcon,
  lock: LockKeyhole,
  close: X,
  history: History,
  players: UsersRound,
};
function Icon({ name, className = "icon" }) {
  return <LucideIcon icon={icons[name]} className={className} />;
}

const gemAssets = {
  white: diamond,
  blue: sapphire,
  green: emerald,
  red: ruby,
  black: onyx,
  gold,
};
const gemLetters = {
  white: "白",
  blue: "蓝",
  green: "绿",
  red: "红",
  black: "黑",
  gold: "金",
};
function Gem({ color, label = false }) {
  return (
    <span className="gem" title={COLOR_NAMES[color]}>
      <img src={gemAssets[color]} alt={label ? COLOR_NAMES[color] : ""} />
    </span>
  );
}
const nameOf = (game, id) =>
  game.players.find((p) => p.id === id)?.name || "玩家";
const listTokens = (tokens) =>
  TOKEN_COLORS.filter((c) => tokens[c])
    .map((c) => `${gemLetters[c]}×${tokens[c]}`)
    .join(" · ");
const emptyTokens = () => Object.fromEntries(TOKEN_COLORS.map((c) => [c, 0]));
const isGemPair = (colors) => colors.length === 2 && colors[0] === colors[1];
const tierMarks = ["I", "II", "III"];

function TierMark({ level }) {
  return <span className="tier-mark">{tierMarks[level - 1]}</span>;
}

function Costs({ cost, className }) {
  return (
    <span className={className}>
      {COLORS.filter((color) => cost[color]).map((color) => (
        <span className={`cost cost-${color}`} key={color}>
          {cost[color]}
        </span>
      ))}
    </span>
  );
}

function CardBackContent({ level }) {
  return (
    <span className="card-content card-back-content">
      <Icon name="lock" />
      <TierMark level={level} />
    </span>
  );
}

function Card({ card, onClick, affordable = false }) {
  if (card.hidden)
    return (
      <div
        className={`development-card card-back level-${card.level}`}
        aria-label={`${card.level} 级预留牌，牌面保密`}
      >
        <CardBackContent level={card.level} />
      </div>
    );
  const Element = onClick ? "button" : "div";
  return (
    <Element
      className={`development-card${affordable ? " affordable" : ""}`}
      onClick={onClick}
      role={onClick ? undefined : "img"}
      aria-label={`${card.level}级${COLOR_NAMES[card.bonus]}发展卡，${card.points}分，费用${listTokens(card.cost)}${affordable ? "，可购买" : ""}`}
    >
      <span className="card-content">
        <span className="card-top">
          {card.points > 0 && <b>{card.points}</b>}
          <Gem color={card.bonus} />
        </span>
        <span className="card-bottom">
          <Costs className="card-costs" cost={card.cost} />
        </span>
      </span>
    </Element>
  );
}

function Noble({ noble, eligible = false, onClick }) {
  const content = (
    <span className="card-content noble-content">
      <span className="noble-top">
        <Icon name="crown" />
        <b>3</b>
      </span>
      <Costs className="noble-costs" cost={noble.cost} />
    </span>
  );
  return onClick ? (
    <button
      className={`noble${eligible ? " eligible" : ""}`}
      onClick={onClick}
      aria-label={`选择贵族，要求${listTokens(noble.cost)}折扣，获得3分`}
    >
      {content}
    </button>
  ) : (
    <div
      className={`noble${eligible ? " eligible" : ""}`}
      title={`贵族：${listTokens(noble.cost)}折扣`}
    >
      {content}
    </div>
  );
}

function DialogHeading({ title, onClose }) {
  return (
    <div className="dialog-heading">
      <strong>{title}</strong>
      {onClose && (
        <button
          type="button"
          className="icon-button dialog-close-button"
          aria-label={`关闭${title}`}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

const localModeLabels = {
  normal: "普通人机",
  hard: "困难人机",
  local: "本地多人",
};

function Entry({
  onStart,
  onResume,
  savedMode,
  onCreateRoom,
  launchUrl,
  busy,
  error,
}) {
  const [mode, setMode] = useState(null);
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["玩家 1", "玩家 2", "玩家 3", "玩家 4"]);
  if (!mode)
    return (
      <main key="modes" className="mode-view">
        <section className="mode-menu" aria-label="游戏模式">
          <img
            className="mode-logo"
            src="./icon.svg"
            width={192}
            height={192}
            alt="璀璨宝石"
          />
          <div className="mode-list">
            {Object.entries(localModeLabels).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="contained-button secondary-button mode-entry"
                disabled={busy}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
            {launchUrl ? (
              <a
                className="contained-button secondary-button mode-entry"
                href={launchUrl}
              >
                联机多人
              </a>
            ) : (
              <button
                type="button"
                className="contained-button secondary-button mode-entry"
                disabled={busy || !onCreateRoom}
                onClick={onCreateRoom}
              >
                {busy ? "正在创建房间…" : "联机多人"}
              </button>
            )}
            <button
              type="button"
              className="contained-button secondary-button mode-entry resume-game"
              aria-hidden={!savedMode}
              disabled={busy || !savedMode}
              onClick={onResume}
            >
              继续对局 <span>{localModeLabels[savedMode]}</span>
            </button>
          </div>
        </section>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </main>
    );

  const computerGame = mode !== "local";
  const seats = names
    .slice(0, count)
    .map((name, index) =>
      computerGame && index > 0 ? (count === 2 ? "AI" : `AI ${index}`) : name,
    );
  return (
    <main key="setup" className="setup-view">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onStart(seats, mode);
        }}
      >
        <div className="section-heading">
          <h1>{localModeLabels[mode]}</h1>
          <label className="count-picker">
            <span>人数</span>
            <select
              aria-label="选择玩家人数"
              value={count}
              onChange={(event) => setCount(Number(event.currentTarget.value))}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} 人
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="name-grid">
          {seats.map((name, index) => (
            <label key={index}>
              <span>
                {String(index + 1).padStart(2, "0")}
                {index === 0 && " · 先手"}
              </span>
              {computerGame && index > 0 ? (
                <strong>{name}</strong>
              ) : (
                <input
                  aria-label={`玩家 ${index + 1} 姓名`}
                  value={name}
                  maxLength={24}
                  onInput={(event) =>
                    setNames(
                      names.map((value, i) =>
                        i === index ? event.currentTarget.value : value,
                      ),
                    )
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div className="setup-divider" />
        <div className="section-heading">
          <h2>基础版</h2>
          <span>15 分 · 打完当轮</span>
        </div>
        <div className="setup-inventory">
          <span>
            {TOKEN_COLORS.map((color) => (
              <Gem key={color} color={color} />
            ))}
          </span>
          <span>90 张发展卡 · {count + 1} 位贵族</span>
        </div>
        {savedMode && (
          <p className="muted small save-notice">
            开始新局会替换已有的本地存档。
          </p>
        )}
        <button
          type="submit"
          className="contained-button primary-button full-width"
        >
          洗牌并开始
        </button>
        <button
          type="button"
          className="text-button setup-back"
          onClick={() => setMode(null)}
        >
          返回模式选择
        </button>
      </form>
    </main>
  );
}

const emptyResources = { tokens: emptyTokens(), bonuses: emptyTokens() };

function PlayerAvatar({ name, index }) {
  return (
    <span className="player-avatar" data-seat={index + 1} aria-hidden="true">
      {Array.from(name)[0]}
      <span className="number-badge" title={index === 0 ? "先手" : undefined}>
        {index + 1}
      </span>
    </span>
  );
}

function ResourceGrid({ board = emptyResources }) {
  return (
    <span className="resource-grid">
      <span className="resource-label">宝石</span>
      {TOKEN_COLORS.map((color) => (
        <span
          key={color}
          className={board.tokens[color] === 0 ? "empty-resource" : undefined}
        >
          <Gem color={color} />
          <b>{board.tokens[color]}</b>
        </span>
      ))}
      <span className="resource-label">折扣</span>
      {COLORS.map((color) => (
        <span
          key={color}
          className={`bonus-number${board.bonuses[color] === 0 ? " empty-resource" : ""}`}
        >
          <Gem color={color} />
          {board.bonuses[color]}
        </span>
      ))}
    </span>
  );
}

function ResourceCard({ board, label }) {
  return (
    <section
      className="resource-card"
      aria-label={label}
      aria-hidden={!board || undefined}
    >
      <ResourceGrid board={board || undefined} />
    </section>
  );
}

function PlayerSummary({ game, player, index }) {
  const board = game.boards[player.id];
  return (
    <div className="player-summary">
      <span className="player-heading">
        <PlayerAvatar name={player.name} index={index} />
        <strong>
          {player.name}
          {game.viewerId === player.id && <small>你</small>}
        </strong>
        <b className="player-score">
          {board.score}
          <small>/ 15</small>
        </b>
      </span>
      <ResourceCard board={board} label="玩家资源" />
    </div>
  );
}

function CardChoice({ game, choice, busy, onAction, onClose }) {
  const board = game.boards[game.viewerId];
  const { card, level } = choice;
  const [payment, setPayment] = useState(() =>
    board && card ? paymentFor(board, card) : null,
  );
  const active = game.canAct && game.phase === "playing" && !busy;
  const due = board && card ? costAfterBonuses(board, card) : null;
  const insufficientGems = !!due && !payment;
  const isReserved = card && board?.reserved.some((c) => c.id === card.id);
  const inMarket =
    card && game.market.some((row) => row.some((c) => c.id === card.id));
  const canReserve =
    active && board.reserved.length < 3 && (card ? inMarket : true);
  const gold = game.bank.gold > 0;
  const submit = (action) => {
    onAction(action);
  };
  return (
    <>
      <DialogHeading
        title={
          card
            ? `${isReserved ? "我的预留" : "公开市场"} · ${card.level} 级发展卡`
            : `${level} 级牌堆`
        }
        onClose={onClose}
      />
      <div className="dialog-body">
        {card ? (
          <>
            <div className="card-detail">
              <Card card={card} />
              <div>
                <h2>{COLOR_NAMES[card.bonus]} +1</h2>
                <p>{card.points} 分</p>
              </div>
            </div>
            {due && (
              <div className="payment-details">
                <h3>本次支付</h3>
                <div className="payment-rows">
                  {COLORS.filter((c) => card.cost[c] > 0).map((c) => (
                    <div className="payment-row" key={c}>
                      <Gem color={c} />
                      <span>
                        {COLOR_NAMES[c]} 需{" "}
                        {card.cost[c] > due[c] && (
                          <>
                            <del>{card.cost[c]}</del>{" "}
                          </>
                        )}
                        {due[c]}
                      </span>
                      {due[c] > 0 &&
                        (payment ? (
                          <div className="stepper">
                            <button
                              aria-label={`少付一枚${COLOR_NAMES[c]}，改用黄金`}
                              disabled={
                                !active ||
                                payment[c] === 0 ||
                                payment.gold >= board.tokens.gold
                              }
                              onClick={() =>
                                setPayment({
                                  ...payment,
                                  [c]: payment[c] - 1,
                                  gold: payment.gold + 1,
                                })
                              }
                            >
                              −
                            </button>
                            <b>{payment[c]}</b>
                            <button
                              aria-label={`多付一枚${COLOR_NAMES[c]}，少用黄金`}
                              disabled={
                                !active ||
                                payment[c] >= Math.min(due[c], board.tokens[c])
                              }
                              onClick={() =>
                                setPayment({
                                  ...payment,
                                  [c]: payment[c] + 1,
                                  gold: payment.gold - 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="shortfall">持有 {board.tokens[c]}</span>
                        ))}
                    </div>
                  ))}
                </div>
                {payment && (
                  <p className="payment-note">
                    {tokenCount(payment) === 0 ? (
                      "折扣已覆盖全部费用，可免费购买。"
                    ) : (
                      <>
                        <Gem color="gold" />
                        使用 {payment.gold} 枚黄金 · 共支付{" "}
                        {tokenCount(payment)} 枚宝石
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
            <div className="choice-actions">
              <button
                className="contained-button primary-button"
                disabled={!active || !payment || (!inMarket && !isReserved)}
                aria-describedby={
                  insufficientGems ? "purchase-shortfall" : undefined
                }
                onClick={() =>
                  submit({ type: "buy", cardId: card.id, payment })
                }
              >
                确认购买
              </button>
              {inMarket && (
                <button
                  className="contained-button secondary-button"
                  disabled={!canReserve}
                  onClick={() => submit({ type: "reserve", cardId: card.id })}
                >
                  预留{gold ? " · 黄金 +1" : " · 黄金已空"}
                </button>
              )}
              <p className="purchase-shortfall shortfall" id="purchase-shortfall">
                {insufficientGems && "宝石不足"}
              </p>
            </div>
            {!isReserved && board?.reserved.length >= 3 && (
              <p className="muted small">预留已满，请先购买手中的预留牌。</p>
            )}
          </>
        ) : (
          <>
            <figure className="card-detail">
              <div className={`blind-illustration level-${level}`}>
                <CardBackContent level={level} />
              </div>
              <figcaption>剩余 {game.counts[level - 1]} 张</figcaption>
            </figure>
            <p className="muted centered">
              市场里的同级牌被购买或预留后，从这里补牌。
            </p>
            <p className="muted centered">
              盲抽牌堆顶的一张牌，只有你能看到牌面。
              <br />
              {gold
                ? "同时获得 1 枚黄金，可替代任意颜色支付。"
                : "黄金已取完，仍可正常预留。"}
            </p>
            <div className="choice-actions">
              <button
                className="contained-button primary-button"
                disabled={!canReserve}
                onClick={() => submit({ type: "reserve", blind: true, level })}
              >
                盲抽预留
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ReturnTokens({ game, busy, onAction }) {
  const board = game.boards[game.viewerId],
    excess = tokenCount(board.tokens) - 10;
  const [returned, setReturned] = useState(emptyTokens);
  const selected = tokenCount(returned);
  return (
    <Dialog
      open
      className="app-dialog return-dialog"
      aria-label="归还超出的宝石"
    >
      <DialogHeading title={`归还 ${excess} 枚宝石`} />
      <div className="dialog-body">
        <p className="muted">
          回合结束最多保留 10 枚，包含黄金。可以归还刚刚拿取的宝石。
        </p>
        <div className="return-options">
          {TOKEN_COLORS.map((c) => (
            <div className="return-option" key={c}>
              <Gem color={c} />
              <span>
                {COLOR_NAMES[c]} <small>持有 {board.tokens[c]}</small>
              </span>
              <div className="stepper">
                <button
                  disabled={busy || !returned[c]}
                  aria-label={`少归还一枚${COLOR_NAMES[c]}`}
                  onClick={() =>
                    setReturned({ ...returned, [c]: returned[c] - 1 })
                  }
                >
                  −
                </button>
                <b>{returned[c]}</b>
                <button
                  disabled={
                    busy || returned[c] >= board.tokens[c] || selected >= excess
                  }
                  aria-label={`多归还一枚${COLOR_NAMES[c]}`}
                  onClick={() =>
                    setReturned({ ...returned, [c]: returned[c] + 1 })
                  }
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          className="contained-button primary-button full-width"
          disabled={busy || selected !== excess}
          onClick={() => onAction({ type: "return_tokens", tokens: returned })}
        >
          确认归还 · {selected}/{excess}
        </button>
      </div>
    </Dialog>
  );
}

function HistoryGems({ tokens }) {
  return TOKEN_COLORS.filter((color) => tokens[color]).map((color, index) => (
    <Fragment key={color}>
      {index > 0 && " · "}
      <span className="history-gem-count">
        <Gem color={color} label />
        ×{tokens[color]}
      </span>
    </Fragment>
  ));
}

function HistoryMove({ game, move }) {
  let action;
  switch (move.type) {
    case "take":
      action = (
        <>
          拿取 <HistoryGems tokens={move.tokens} />
        </>
      );
      break;
    case "reserve":
      action = (
        <>
          {move.blind ? "盲抽" : "预留"} {move.level} 级牌
          {move.gold ? (
            <>
              ，
              <span className="history-gem-count">
                <Gem color="gold" label />
                +1
              </span>
            </>
          ) : null}
        </>
      );
      break;
    case "pass":
      action = "无可用操作，跳过回合";
      break;
    default: {
      const card = CARDS.find((card) => card.id === move.cardId);
      action = (
        <>
          购买{card && <Gem color={card.bonus} label />}发展卡
          {card?.points ? `，声望 +${card.points}` : ""}
        </>
      );
    }
  }

  return (
    <p>
      {nameOf(game, move.playerId)} {action}
      {move.returned && (
        <>
          ，归还 <HistoryGems tokens={move.returned} />
        </>
      )}
      {move.nobleId && "，获得贵族 +3 分"}
    </p>
  );
}

const desktopLayout = window.matchMedia(
  "(orientation: landscape) and (min-width: 900px)",
);
const landscapeLayout = window.matchMedia(
  "(orientation: landscape) and (min-width: 600px)",
);

function getPlayLayout() {
  if (desktopLayout.matches) return "desktop";
  return landscapeLayout.matches ? "landscape" : "stacked";
}

function TurnActions({
  game,
  busy,
  taken,
  canTake,
  onClear,
  onAction,
  onReport,
  onRetry,
}) {
  const playing = game.canAct && game.phase === "playing";
  const mustPass = playing && game.canPass;
  const selecting = playing && !mustPass && taken.length > 0;
  const ring = <span className="turn-ring" aria-hidden="true" />;

  let state;
  let content;
  if (game.phase === "ended") {
    state = "result";
    content = (
      <button className="contained-button primary-button" onClick={onReport}>
        查看结算
      </button>
    );
  } else if (onRetry) {
    state = "retry";
    content = (
      <button className="contained-button primary-button" onClick={onRetry}>
        重试
      </button>
    );
  } else if (mustPass) {
    state = "pass";
    content = (
      <button
        className="contained-button secondary-button"
        disabled={busy}
        onClick={() => onAction({ type: "pass" })}
      >
        跳过回合 {ring}
      </button>
    );
  } else if (!selecting) {
    state = !game.canAct
      ? "等待对手"
      : busy
        ? "提交中…"
        : game.phase === "choose_noble"
          ? "选择贵族"
          : game.phase === "return_tokens"
            ? "归还宝石"
            : "你的回合";
    content = (
      <span className="turn-status" role="status">
        {state}
        {playing && !busy && ring}
      </span>
    );
  }

  return (
    <div className="turn-actions">
      <div className="take-actions" aria-hidden={!selecting}>
        <button
          className="contained-button secondary-button"
          disabled={!selecting || busy}
          onClick={onClear}
        >
          取消
        </button>
        <button
          className="contained-button primary-button"
          disabled={!selecting || !canTake}
          onClick={() => onAction({ type: "take", colors: taken })}
        >
          {selecting && busy ? "提交中…" : "确认拿取"}
        </button>
      </div>
      {content && (
        <div className="turn-state" key={state}>
          {content}
        </div>
      )}
    </div>
  );
}

function PlayLayout({
  layout,
  nobleSlots,
  error,
  players,
  nobles,
  market,
  bank,
  resources,
  auxiliaryActions,
  primaryAction,
}) {
  return (
    <>
      <main className="play-view">
        {layout === "desktop" ? (
          <>
            {players}
            <div className="board-frame">
              <div className="board-table" style={{ "--noble-slots": nobleSlots }}>
                {nobles}
                {market}
              </div>
            </div>
            {bank}
          </>
        ) : (
          <div className="play-sections">
            {players}
            <div className="board-frame">
              <div className="board-table">
                {nobles}
                {market}
                {bank}
              </div>
            </div>
            {layout === "stacked" && resources}
          </div>
        )}
        {error && (
          <p className="game-error-toast" role="alert">
            {error}
          </p>
        )}
      </main>
      <footer className="play-footer">
        <div className="action-tools">{auxiliaryActions}</div>
        {layout === "landscape" && resources}
        {primaryAction}
      </footer>
    </>
  );
}

export default function SplendorApp({
  room,
  standalone,
  connecting,
  waitingForRoom,
  game,
  paused,
  busy,
  error,
  handoff,
  computerGame,
  savedMode,
  onStart,
  onResume,
  onCreateRoom,
  onReady,
  onPauseChange,
  onBack,
  onExit,
  onRetryComputer,
  onAction,
  launchUrl,
}) {
  const [help, setHelp] = useState(false);
  const [taken, setTaken] = useState([]),
    [choice, setChoice] = useState(null);
  const [inspection, setInspection] = useState(null),
    [history, setHistory] = useState(false),
    [report, setReport] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [layout, setLayout] = useState(getPlayLayout);
  useEffect(() => {
    const syncLayout = () => setLayout(getPlayLayout());
    desktopLayout.addEventListener("change", syncLayout);
    landscapeLayout.addEventListener("change", syncLayout);
    syncLayout();
    return () => {
      desktopLayout.removeEventListener("change", syncLayout);
      landscapeLayout.removeEventListener("change", syncLayout);
    };
  }, []);
  useEffect(() => {
    setTaken([]);
    setChoice(null);
    setInspection(null);
    setHistory(false);
    setReport(game?.phase === "ended");
  }, [game?.step, game?.viewerId, room]);
  // A handoff screen replaces the board, keeping the next player's private hand out of the DOM.
  const visible = game && !handoff;
  useEffect(() => setShowPlayers(false), [room, game?.viewerId, visible]);
  const marketRef = useRef(null);
  const [marketCardWidth, setMarketCardWidth] = useState(0);
  const firstMarketCardId = visible ? game.market[2][0]?.id : undefined;
  useLayoutEffect(() => {
    const slot = marketRef.current?.querySelector(
      ".development-card, .empty-card",
    );
    if (!slot) return;

    setMarketCardWidth(slot.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      setMarketCardWidth(entry.borderBoxSize[0].inlineSize);
    });
    observer.observe(slot, { box: "border-box" });
    return () => observer.disconnect();
  }, [layout, visible, firstMarketCardId]);

  const computerTurn =
    visible && computerGame && !game.canAct && game.phase !== "ended";
  const active = visible && game.canAct && game.phase === "playing" && !busy;
  const board = visible && game.boards[game.viewerId];
  const canReserve =
    active &&
    board?.reserved.length < 3 &&
    (game.counts.some(Boolean) || game.market.some((row) => row.length > 0));
  const required = game
    ? Math.min(3, COLORS.filter((c) => game.bank[c] > 0).length)
    : 0;
  const pair = isGemPair(taken);
  const selectionLocked = pair || (required > 0 && taken.length === required);
  const canTake =
    active &&
    (pair
      ? game.bank[taken[0]] >= 4
      : required > 0 &&
      taken.length === required &&
      taken.every((c) => game.bank[c] > 0));
  const canSelectGem = (color, selected = taken) =>
    active &&
    color !== "gold" &&
    game.bank[color] > 0 &&
    (selected.includes(color) ||
      (!isGemPair(selected) && selected.length < required));
  const chooseGem = (color) =>
    setTaken((selected) => {
      if (!canSelectGem(color, selected)) return selected;
      if (!selected.includes(color)) return [...selected, color];
      if (selected.length === 1 && game.bank[color] >= 4) return [color, color];
      return selected.filter((c) => c !== color);
    });
  const inspectedPlayer =
    visible &&
    inspection &&
    game.players.find((p) => p.id === inspection.playerId);
  const inspectBoard = inspectedPlayer && game.boards[inspectedPlayer.id];
  const reservedOnly = inspectBoard && inspection.reservedOnly;
  const showCard = (card) => {
    setInspection(null);
    setChoice({ card });
  };
  const canPause = !connecting && !room && !!game;
  const pauseTitle = confirmDiscard ? "放弃对局" : "游戏暂停";
  const closePause = () => {
    if (confirmDiscard) setConfirmDiscard(false);
    else onPauseChange(false);
  };
  return (
    <div
      className={`splendor-shell ${layout}-layout${visible ? " in-game" : ""}`}
      style={
        marketCardWidth > 0
          ? { "--dialog-card-width": `${marketCardWidth}px` }
          : undefined
      }
    >
      <GameTopbar
        title="璀璨宝石"
        standalone={standalone}
        room={room}
        onPause={canPause ? () => {
          setConfirmDiscard(false);
          onPauseChange(true);
        } : undefined}
        onHelp={() => setHelp(true)}
      />
      {!game ? (
        room || connecting ? (
          <main className="connection-view">
            <Icon name="gem" />
            <p role="status">
              {error ||
                (waitingForRoom ? "等待房间开始…" : "正在连接 Playweft…")}
            </p>
          </main>
        ) : (
          <Entry
            onStart={onStart}
            onResume={onResume}
            savedMode={savedMode}
            onCreateRoom={onCreateRoom}
            launchUrl={launchUrl}
            busy={busy}
            error={error}
          />
        )
      ) : handoff ? (
        <main className="handoff-view">
          <div className="handoff-symbol">
            <Icon name="lock" />
          </div>
          <p className="eyebrow">第 {game.round} 轮 · 本地多人</p>
          <h1>请交给 {nameOf(game, game.currentPlayerId)}</h1>
          <button
            className="contained-button primary-button"
            onClick={onReady}
          >
            我已准备好
          </button>
        </main>
      ) : (
        <PlayLayout
          layout={layout}
          nobleSlots={game.players.length + 1}
          error={error}
          players={
            <nav className="player-strip" aria-label="玩家商会">
              {game.players.map((player, index) => {
                const playerBoard = game.boards[player.id];
                const current =
                  game.phase !== "ended" && game.currentPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    className={`player-chip${current ? " active" : ""}`}
                    onClick={() => setInspection({ playerId: player.id })}
                    aria-label={`查看 ${index + 1} 号玩家 ${player.name} 的商会，${playerBoard.score}分${index === 0 ? "，先手" : ""}，宝石 ${listTokens(playerBoard.tokens) || "无"}，折扣 ${listTokens(playerBoard.bonuses) || "无"}`}
                    aria-current={current ? "true" : undefined}
                  >
                    <span className="player-chip-header">
                      <span className="player-identity">
                        <PlayerAvatar name={player.name} index={index} />
                        <span className="player-name">{player.name}</span>
                      </span>
                      <b className="player-prestige">{playerBoard.score}</b>
                    </span>
                    <ResourceGrid board={playerBoard} />
                  </button>
                );
              })}
            </nav>
          }
          nobles={
            <section className="nobles-section" aria-labelledby="noble-label">
              <h2 id="noble-label" className="table-label">
                贵族
              </h2>
              <div className="nobles-row">
                {game.nobles.map((noble) => (
                  <Noble
                    noble={noble}
                    key={noble.id}
                    eligible={game.eligibleNobleIds.includes(noble.id)}
                    onClick={
                      game.phase === "choose_noble" &&
                        game.canAct &&
                        !busy &&
                        game.eligibleNobleIds.includes(noble.id)
                        ? () =>
                          onAction({
                            type: "choose_noble",
                            nobleId: noble.id,
                          })
                        : null
                    }
                  />
                ))}
              </div>
            </section>
          }
          market={
            <section
              ref={marketRef}
              className="market-area"
              aria-label="发展卡市场"
            >
              <div className="market-section">
                {[3, 2, 1].map((level) => (
                  <div className="market-row" key={level}>
                    <button
                      className={`deck level-${level}`}
                      disabled={!canReserve || !game.counts[level - 1]}
                      onClick={() => setChoice({ level })}
                      aria-label={`查看 ${level} 级牌堆，剩余 ${game.counts[level - 1]} 张`}
                    >
                      <span className="card-content deck-content">
                        <TierMark level={level} />
                        <b>{game.counts[level - 1]}</b>
                      </span>
                    </button>
                    {game.market[level - 1].map((card) => (
                      <Card
                        card={card}
                        key={card.id}
                        onClick={() => setChoice({ card })}
                        affordable={!!(board && paymentFor(board, card))}
                      />
                    ))}
                    {Array.from(
                      { length: 4 - game.market[level - 1].length },
                      (_, index) => (
                        <div className="empty-card" key={`empty-${index}`} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </section>
          }
          bank={
            <section className="bank-section" aria-labelledby="bank-label">
              <h2 id="bank-label" className="table-label">
                宝石供应
              </h2>
              <div
                className={`bank-row${selectionLocked ? " selection-locked" : ""}`}
              >
                {TOKEN_COLORS.map((color) => {
                  const count = taken.filter((c) => c === color).length;
                  return (
                    <button
                      key={color}
                      className={`token token-${color}${count ? " selected" : ""}`}
                      disabled={!canSelectGem(color)}
                      aria-label={`${COLOR_NAMES[color]}，供应${game.bank[color]}枚${count ? `，已选${count}枚` : ""}`}
                      aria-pressed={!!count}
                      onClick={() => chooseGem(color)}
                    >
                      <Gem color={color} />
                      <b>{game.bank[color]}</b>
                      {count > 0 && (
                        <span className="take-count">+{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          }
          resources={<ResourceCard board={board} label="我的资源" />}
          auxiliaryActions={
            <>
              <button
                type="button"
                className="icon-button"
                aria-label="玩家总览"
                aria-haspopup="dialog"
                title="玩家总览"
                onClick={() => setShowPlayers(true)}
              >
                <Icon name="players" />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="对局记录"
                title="对局记录"
                onClick={() => setHistory(true)}
              >
                <Icon name="history" />
              </button>
              {board && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`查看我的预留牌，${board.reserved.length}张`}
                  title="查看我的预留牌"
                  onClick={() =>
                    setInspection({ playerId: game.viewerId, reservedOnly: true })
                  }
                >
                  <Icon name="lock" />
                  {board.reserved.length > 0 && (
                    <span className="number-badge" aria-hidden="true">
                      {board.reserved.length}
                    </span>
                  )}
                </button>
              )}
            </>
          }
          primaryAction={
            <TurnActions
              game={game}
              busy={busy}
              taken={taken}
              canTake={canTake}
              onClear={() => setTaken([])}
              onAction={onAction}
              onReport={() => setReport(true)}
              onRetry={computerTurn && error ? onRetryComputer : undefined}
            />
          }
        />
      )}
      <Dialog
        key={`card-${visible ? game.viewerId : "hidden"}`}
        open={!!(visible && choice)}
        onClose={() => setChoice(null)}
        className="app-dialog card-dialog"
        aria-label={choice?.level ? `${choice.level} 级牌堆` : "发展卡详情"}
      >
        {visible && choice && (
          <CardChoice
            key={`${game.step}-${choice.card?.id || choice.level}`}
            game={game}
            choice={choice}
            busy={busy}
            onAction={onAction}
            onClose={() => setChoice(null)}
          />
        )}
      </Dialog>
      {visible && game.phase === "return_tokens" && game.canAct && (
        <ReturnTokens
          key={game.step}
          game={game}
          busy={busy}
          onAction={onAction}
        />
      )}
      <Dialog
        key={`overview-${visible ? game.viewerId : "hidden"}`}
        open={!!inspectedPlayer}
        onClose={() => setInspection(null)}
        className="app-dialog overview-dialog"
        aria-label={reservedOnly ? "我的预留牌" : "商会详情"}
      >
        <DialogHeading
          title={
            reservedOnly
              ? `我的预留牌 · ${inspectBoard.reserved.length}/3`
              : `${inspectedPlayer?.name || ""} 的商会`
          }
          onClose={() => setInspection(null)}
        />
        {inspectBoard && (
          <div className="dialog-body">
            {!reservedOnly && (
              <>
                <PlayerSummary
                  game={game}
                  player={inspectedPlayer}
                  index={game.players.indexOf(inspectedPlayer)}
                />
                <h3 className="owned-cards-heading">发展卡</h3>
                <div className="owned-cards purchased-cards">
                  {inspectBoard.purchased.map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      onClick={() => showCard(card)}
                    />
                  ))}
                </div>
                {!inspectBoard.purchased.length && (
                  <p className="muted">尚未购买发展卡。</p>
                )}
                <h3 className="owned-cards-heading">
                  <span>预留牌</span>
                  <span>
                    {inspectBoard.reserved.length}
                    <small>/3</small>
                  </span>
                </h3>
              </>
            )}
            <div className="owned-cards reserved-cards">
              {reservedOnly && inspectBoard.reserved.length === 0 && (
                <div className="reserved-placeholder centered">
                  <p>暂无预留牌</p>
                  <p className="muted">
                    轮到你时，点开市场里的发展卡或牌堆，再选择预留。预留后，这张牌只有你能购买。
                  </p>
                </div>
              )}
              {inspectBoard.reserved.map((card, index) => (
                <Card
                  key={card.id || index}
                  card={card}
                  affordable={
                    !!(
                      active &&
                      inspectedPlayer.id === game.viewerId &&
                      !card.hidden &&
                      paymentFor(board, card)
                    )
                  }
                  onClick={() => showCard(card)}
                />
              ))}
            </div>
            {!reservedOnly && inspectBoard.nobles.length > 0 && (
              <>
                <h3>已到访的贵族</h3>
                <div className="nobles-row">
                  {inspectBoard.nobles.map((noble) => (
                    <Noble noble={noble} key={noble.id} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        open={showPlayers && !!visible}
        onClose={() => setShowPlayers(false)}
        className="app-dialog"
        aria-label="玩家总览"
      >
        <DialogHeading title="玩家总览" onClose={() => setShowPlayers(false)} />
        {visible && (
          <ol className="player-overview-list">
            {game.players.map((player, index) => (
              <li
                key={player.id}
                aria-current={
                  (game.phase !== "ended" &&
                    game.currentPlayerId === player.id) ||
                  undefined
                }
              >
                <PlayerSummary game={game} player={player} index={index} />
                {index < game.players.length - 1 && <hr />}
              </li>
            ))}
          </ol>
        )}
      </Dialog>
      <Dialog
        open={history && !!visible}
        onClose={() => setHistory(false)}
        className="app-dialog"
        aria-label="对局记录"
      >
        <DialogHeading title="对局记录" onClose={() => setHistory(false)} />
        <div className="dialog-body">
          {visible && game.history.length ? (
            <ol className="history-list">
              {[...game.history].reverse().map((move, index) => (
                <li key={index}>
                  <small>第 {move.round} 轮</small>
                  <HistoryMove game={game} move={move} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">对局刚刚开始。</p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={report && !!visible && game.phase === "ended"}
        onClose={() => setReport(false)}
        className="app-dialog result-dialog"
        aria-label="本局结算"
      >
        <DialogHeading title="本局结算" onClose={() => setReport(false)} />
        {visible && (
          <div className="dialog-body">
            <div className="winner-crown">
              <Icon name="crown" />
            </div>
            <h2 className="winner-name">
              {game.winners.map((id) => nameOf(game, id)).join("、")}
              {game.winners.length > 1 ? "共同获胜" : "获胜"}
            </h2>
            <div className="result-list">
              {[...game.players]
                .sort(
                  (a, b) =>
                    game.boards[b.id].score - game.boards[a.id].score ||
                    game.boards[a.id].purchased.length -
                    game.boards[b.id].purchased.length,
                )
                .map((player) => (
                  <div
                    className={game.winners.includes(player.id) ? "winner" : ""}
                    key={player.id}
                  >
                    <strong>{player.name}</strong>
                    <span>
                      {game.boards[player.id].purchased.length} 张发展卡 ·{" "}
                      {game.boards[player.id].nobles.length} 位贵族
                    </span>
                    <b>
                      {game.boards[player.id].score}
                      <small> 分</small>
                    </b>
                  </div>
                ))}
            </div>
            <p className="muted small">
              同分时，已购买发展卡更少者获胜；仍相同则共享胜利。再来一局将轮换先手。
            </p>
            <div className="choice-actions">
              <button
                className="contained-button primary-button"
                disabled={busy || !game.canRematch}
                onClick={() => onAction({ type: "rematch" })}
              >
                再来一局
              </button>
              {!room && (
                <button
                  className="contained-button secondary-button"
                  onClick={onExit}
                >
                  更换模式
                </button>
              )}
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={paused && canPause}
        onClose={closePause}
        className="app-dialog pause-dialog"
        aria-label={pauseTitle}
      >
        <DialogHeading title={pauseTitle} onClose={closePause} />
        {confirmDiscard ? (
          <div className="dialog-body">
            <p className="muted">放弃会清除本局的存档。</p>
            <div className="choice-actions">
              <button
                className="contained-button secondary-button"
                onClick={closePause}
              >
                取消
              </button>
              <button
                className="contained-button secondary-button"
                onClick={onExit}
              >
                放弃并返回
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog-body">
            <div className="pause-actions">
              <button
                className="contained-button primary-button"
                onClick={closePause}
              >
                {game?.phase === "ended" ? "返回牌桌" : "继续游戏"}
              </button>
              <button
                className="contained-button secondary-button"
                onClick={onBack}
              >
                暂时离开
              </button>
              {game?.phase !== "ended" && (
                <button
                  className="text-button"
                  onClick={() => setConfirmDiscard(true)}
                >
                  放弃对局
                </button>
              )}
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={help}
        onClose={() => setHelp(false)}
        className="app-dialog rules-dialog"
        aria-label="璀璨宝石规则"
      >
        <DialogHeading title="游戏规则" onClose={() => setHelp(false)} />
        <iframe
          className="help-frame"
          title="璀璨宝石完整规则"
          src="./help.html"
        />
      </Dialog>
    </div>
  );
}

import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleHelp,
  Crown,
  Flag,
  Gem as GemIcon,
  History,
  Layers,
  LockKeyhole,
  Pause,
  SkipForward,
  X,
} from "lucide";
import Dialog from "../../shared/dialog.jsx";
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
  back: ChevronLeft,
  arrow: ArrowRight,
  help: CircleHelp,
  crown: Crown,
  gem: GemIcon,
  lock: LockKeyhole,
  pause: Pause,
  close: X,
  check: Check,
  flag: Flag,
  history: History,
  reserve: Layers,
  skip: SkipForward,
};
function Icon({ name, className = "icon" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(icons[name] || []).map(([tag, attributes], index) =>
        h(tag, { ...attributes, key: index }),
      )}
    </svg>
  );
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
export function Gem({ color, className = "", label = false }) {
  return (
    <span
      className={`gem gem-${color} ${className}`}
      title={COLOR_NAMES[color]}
    >
      <img src={gemAssets[color]} alt="" />
      {label && <small>{gemLetters[color]}</small>}
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

function PurchaseMark() {
  return (
    <span className="purchase-mark" aria-hidden="true">
      <Icon name="check" />
    </span>
  );
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
  return (
    <button
      className={`development-card${affordable ? " affordable" : ""}`}
      onClick={onClick}
      aria-label={`${card.level}级${COLOR_NAMES[card.bonus]}发展卡，${card.points}分，费用${listTokens(card.cost)}${affordable ? "，可购买" : ""}`}
    >
      <span className="card-content">
        <span className="card-top">
          {card.points > 0 && <b>{card.points}</b>}
          <Gem color={card.bonus} />
        </span>
        <span className="card-bottom">
          <Costs className="card-costs" cost={card.cost} />
          {affordable && <PurchaseMark />}
        </span>
      </span>
    </button>
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
          className="icon-button"
          onClick={onClose}
          aria-label={`关闭${title}`}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

const localModes = {
  normal: { label: "普通人机", hint: "评分" },
  hard: { label: "困难人机", hint: "搜索" },
  local: { label: "本地多人" },
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
      <main className="setup-view">
        <section className="mode-list" aria-labelledby="mode-heading">
          <h1 id="mode-heading">选择模式</h1>
          {Object.entries(localModes).map(([id, { label, hint }]) => (
            <button
              key={id}
              className="mode-entry"
              disabled={busy}
              onClick={() => setMode(id)}
            >
              <span>{label}</span>
              {hint && <small>{hint}</small>}
              <Icon name="arrow" />
            </button>
          ))}
          {launchUrl ? (
            <a className="mode-entry" href={launchUrl}>
              <span>联机多人</span>
              <small>Playweft</small>
              <Icon name="arrow" />
            </a>
          ) : (
            <button
              className="mode-entry"
              disabled={busy || !onCreateRoom}
              onClick={onCreateRoom}
            >
              <span>联机多人</span>
              {busy && <small>正在创建房间…</small>}
              <Icon name="arrow" />
            </button>
          )}
        </section>
        {savedMode && (
          <button
            className="secondary-button full-width resume-game"
            disabled={busy}
            onClick={onResume}
          >
            继续对局 <small>{localModes[savedMode].label}</small>
          </button>
        )}
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
    <main className="setup-view">
      <form
        className="setup-form"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(seats, mode);
        }}
      >
        <div className="section-heading">
          <h1>{localModes[mode].label}</h1>
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
        <button type="submit" className="primary-button full-width">
          洗牌并开始 <Icon name="arrow" />
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

function ResourceGrid({ board }) {
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

function PlayerSummary({ game, player, index, onClick }) {
  const board = game.boards[player.id],
    active = game.currentPlayerId === player.id && game.phase !== "ended";
  return (
    <button
      className={`player-summary${active ? " active" : ""}${game.viewerId === player.id ? " mine" : ""}`}
      onClick={onClick}
      aria-label={`查看${player.name}的商会，${board.score}分，${tokenCount(board.tokens)}枚宝石，${board.purchased.length}张发展卡`}
    >
      <span className="player-heading">
        <span className="player-avatar">{index + 1}</span>
        <strong>
          {player.name}
          {game.viewerId === player.id && <small>你</small>}
        </strong>
        {index === 0 && (
          <span className="first-player" title="本局先手">
            Ⅰ
          </span>
        )}
        <b className="player-score">
          {board.score}
          <small>/ 15</small>
        </b>
      </span>
      <ResourceGrid board={board} />
      <span className="player-foot">
        <span>{board.purchased.length} 张发展卡</span>
        <span>预留 {board.reserved.length}/3</span>
        <span>
          <Icon name="crown" /> {board.nobles.length}
        </span>
      </span>
    </button>
  );
}

function CardChoice({ game, choice, busy, onAction, onClose }) {
  const board = game.boards[game.viewerId],
    card = choice.card;
  const [payment, setPayment] = useState(() =>
    board && card ? paymentFor(board, card) : null,
  );
  const active = game.canAct && game.phase === "playing" && !busy;
  const due = board && card ? costAfterBonuses(board, card) : null;
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
    <Dialog
      open
      onClose={onClose}
      className="app-dialog card-dialog"
      aria-label={card ? "发展卡详情" : "预留牌堆顶牌"}
    >
      <DialogHeading
        title={
          card
            ? `${isReserved ? "我的预留" : "公开市场"} · ${card.level} 级发展卡`
            : `预留 ${choice.level} 级牌堆顶牌`
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
              <>
                <div className="section-heading">
                  <h3>本次支付</h3>
                  <span>已扣除永久折扣</span>
                </div>
                <div className="payment-rows">
                  {COLORS.filter((c) => due[c] > 0).map((c) => (
                    <div className="payment-row" key={c}>
                      <Gem color={c} />
                      <span>
                        {COLOR_NAMES[c]} <small>需 {due[c]}</small>
                      </span>
                      {payment ? (
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
                        <span className="shortfall">
                          持有 {board.tokens[c]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {payment ? (
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
                ) : (
                  <p className="payment-note shortfall">宝石不足</p>
                )}
              </>
            )}
            <div className="choice-actions">
              <button
                className="primary-button"
                disabled={!active || !payment || (!inMarket && !isReserved)}
                onClick={() =>
                  submit({ type: "buy", cardId: card.id, payment })
                }
              >
                确认购买 <Icon name="arrow" />
              </button>
              {inMarket && (
                <button
                  className="secondary-button"
                  disabled={!canReserve}
                  onClick={() => submit({ type: "reserve", cardId: card.id })}
                >
                  预留{gold ? " · 黄金 +1" : " · 黄金已空"}
                </button>
              )}
            </div>
            {!isReserved && board?.reserved.length >= 3 && (
              <p className="muted small">预留已满，请先购买手中的预留牌。</p>
            )}
          </>
        ) : (
          <>
            <div className={`blind-illustration level-${choice.level}`}>
              <CardBackContent level={choice.level} />
            </div>
            <h2 className="centered">盲抽预留</h2>
            <p className="muted centered">
              抽取牌堆顶的一张牌，只有你能看到牌面。
              <br />
              {gold
                ? "同时获得 1 枚黄金，可替代任意颜色支付。"
                : "黄金已取完，仍可正常预留。"}
            </p>
            <button
              className="primary-button full-width"
              disabled={!canReserve}
              onClick={() =>
                submit({ type: "reserve", blind: true, level: choice.level })
              }
            >
              确认预留 <Icon name="arrow" />
            </button>
          </>
        )}
      </div>
    </Dialog>
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
          className="primary-button full-width"
          disabled={busy || selected !== excess}
          onClick={() => onAction({ type: "return_tokens", tokens: returned })}
        >
          确认归还 · {selected}/{excess} <Icon name="arrow" />
        </button>
      </div>
    </Dialog>
  );
}

function lastMoveText(game, move) {
  const actor = nameOf(game, move.playerId);
  const card = move.cardId && CARDS.find((card) => card.id === move.cardId);
  let text =
    move.type === "take"
      ? `${actor} 拿取 ${listTokens(move.tokens)}`
      : move.type === "reserve"
        ? `${actor} ${move.blind ? "盲抽" : "预留"} ${move.level} 级牌${move.gold ? "，黄金 +1" : ""}`
        : move.type === "pass"
          ? `${actor} 无可用操作，跳过回合`
          : `${actor} 购买${card ? COLOR_NAMES[card.bonus] : ""}发展卡${card?.points ? `，声望 +${card.points}` : ""}`;
  if (move.returned) text += `，归还 ${listTokens(move.returned)}`;
  if (move.nobleId) text += "，获得贵族 +3 分";
  return text;
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
  const [inspected, setInspected] = useState(null),
    [history, setHistory] = useState(false),
    [report, setReport] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => {
    setTaken([]);
    setChoice(null);
    setInspected(null);
    setHistory(false);
    setReport(game?.phase === "ended");
  }, [game?.step, game?.viewerId, room]);
  // A handoff screen replaces the board, keeping the next player's private hand out of the DOM.
  const visible = game && !handoff;
  const computerTurn =
    visible && computerGame && !game.canAct && game.phase !== "ended";
  const active = visible && game.canAct && game.phase === "playing" && !busy;
  const board = visible && game.boards[game.viewerId];
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
    visible && game.players.find((p) => p.id === inspected);
  const inspectBoard = inspectedPlayer && game.boards[inspectedPlayer.id];
  const showCard = (card) => setChoice({ card });
  const canPause = !connecting && !room && !!game;
  const pauseTitle = confirmDiscard ? "放弃对局" : "游戏暂停";
  const closePause = () => {
    if (confirmDiscard) setConfirmDiscard(false);
    else onPauseChange(false);
  };
  const turnLabel =
    visible &&
    (game.phase === "ended"
      ? `${game.winners.map((id) => nameOf(game, id)).join("、")}获胜`
      : computerTurn
        ? error
          ? "AI 回合暂停"
          : "AI 思考中…"
        : !game.canAct
          ? `等待 ${nameOf(game, game.currentPlayerId)}`
          : game.phase === "choose_noble"
            ? "选择贵族"
            : game.phase === "return_tokens"
              ? "归还宝石"
              : game.canPass
                ? "无可用操作"
                : "你的回合");
  return (
    <div className={`splendor-shell${visible ? " in-game" : ""}`}>
      <header className="topbar">
        {canPause ? (
          <button
            type="button"
            className="back-link"
            onClick={() => {
              setConfirmDiscard(false);
              onPauseChange(true);
            }}
            aria-label="暂停游戏"
            aria-haspopup="dialog"
          >
            <Icon name="pause" />
          </button>
        ) : (
          !room &&
          standalone && (
            <a className="back-link" href="../" aria-label="返回桌游盒子">
              <Icon name="back" />
            </a>
          )
        )}
        <div className="topbar-title">璀璨宝石</div>
        {standalone && (
          <button
            className="help-link"
            onClick={() => setHelp(true)}
            aria-label="游戏规则"
          >
            <Icon name="help" />
          </button>
        )}
      </header>
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
          <button className="primary-button" onClick={onReady}>
            我已准备好 <Icon name="arrow" />
          </button>
        </main>
      ) : (
        <main className="play-view">
          <nav className="player-strip" aria-label="玩家商会">
            {game.players.map((player, index) => {
              const score = game.boards[player.id].score;
              const current =
                game.phase !== "ended" && game.currentPlayerId === player.id;
              return (
                <button
                  key={player.id}
                  className={`player-chip${current ? " active" : ""}`}
                  onClick={() => setInspected(player.id)}
                  aria-label={`查看${player.name}的商会，${score}分${index === 0 ? "，先手" : ""}`}
                  aria-current={current ? "true" : undefined}
                >
                  <span className="player-avatar" aria-hidden="true">
                    {Array.from(player.name)[0]}
                    <b className="player-prestige">{score}</b>
                    {index === 0 && (
                      <span className="player-first" title="先手">
                        <Icon name="flag" />
                      </span>
                    )}
                  </span>
                  <span className="player-name">{player.name}</span>
                </button>
              );
            })}
          </nav>
          <div className="board-frame">
            <div className="board-table">
              {game.nobles.length > 0 && (
                <section
                  className="nobles-section"
                  aria-labelledby="noble-label"
                >
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
              )}
              <div className="turn-strip">
                <span className="round-label">
                  {game.endingRound !== null ? "最终轮" : `第 ${game.round} 轮`}
                </span>
                <h1 aria-live="polite">{turnLabel}</h1>
                <span className="purchase-legend">
                  <PurchaseMark />
                  可购买
                </span>
              </div>
              <section className="market-area" aria-label="发展卡市场">
                <div className="market-section">
                  {[3, 2, 1].map((level) => (
                    <div className="market-row" key={level}>
                      <button
                        className={`deck level-${level}`}
                        disabled={
                          !active ||
                          !game.counts[level - 1] ||
                          board.reserved.length >= 3
                        }
                        onClick={() => setChoice({ level })}
                        aria-label={`盲抽预留${level}级牌，牌堆剩余${game.counts[level - 1]}张`}
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
                          onClick={() => showCard(card)}
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
            </div>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <footer className="play-footer">
            {board && (
              <section className="my-resources" aria-label="我的资源">
                <ResourceGrid board={board} />
              </section>
            )}
            <div className="action-bar">
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
                  onClick={() => setInspected(game.viewerId)}
                >
                  <Icon name="reserve" />
                </button>
              )}
              {game.phase !== "ended" && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="跳过回合"
                  title="跳过回合"
                  disabled={!active || !game.canPass}
                  onClick={() => onAction({ type: "pass" })}
                >
                  <Icon name="skip" />
                </button>
              )}
              {game.phase === "ended" ? (
                <button
                  className="primary-button"
                  onClick={() => setReport(true)}
                >
                  查看结算 <Icon name="arrow" />
                </button>
              ) : computerTurn && error ? (
                <button className="primary-button" onClick={onRetryComputer}>
                  重试
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={!canTake}
                  onClick={() => onAction({ type: "take", colors: taken })}
                >
                  {busy ? "提交中…" : "确认拿取"}
                </button>
              )}
            </div>
          </footer>
        </main>
      )}
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
      {visible && game.phase === "return_tokens" && game.canAct && (
        <ReturnTokens
          key={game.step}
          game={game}
          busy={busy}
          onAction={onAction}
        />
      )}
      <Dialog
        open={!!inspectedPlayer}
        onClose={() => setInspected(null)}
        className="app-dialog overview-dialog"
        aria-label="商会详情"
      >
        <DialogHeading
          title={`${inspectedPlayer?.name || ""}的商会`}
          onClose={() => setInspected(null)}
        />
        {inspectBoard && (
          <div className="dialog-body">
            <div className="overview-stats">
              <span>
                <b>{inspectBoard.score}</b> 声望
              </span>
              <span>
                <b>{inspectBoard.purchased.length}</b> 发展卡
              </span>
              <span>
                <b>{inspectBoard.nobles.length}</b> 贵族
              </span>
            </div>
            <PlayerSummary
              game={game}
              player={inspectedPlayer}
              index={game.players.findIndex((p) => p.id === inspected)}
              onClick={() => {}}
            />
            <h3>已购买的发展卡</h3>
            <div className="owned-cards">
              {inspectBoard.purchased.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  onClick={() => {
                    setInspected(null);
                    showCard(card);
                  }}
                />
              ))}
            </div>
            {!inspectBoard.purchased.length && (
              <p className="muted">尚未购买发展卡。</p>
            )}
            <h3>预留牌 · {inspectBoard.reserved.length}/3</h3>
            <div className="owned-cards">
              {inspectBoard.reserved.map((card, index) => (
                <Card
                  key={card.id || index}
                  card={card}
                  affordable={
                    !!(
                      active &&
                      inspected === game.viewerId &&
                      !card.hidden &&
                      paymentFor(board, card)
                    )
                  }
                  onClick={() => {
                    setInspected(null);
                    showCard(card);
                  }}
                />
              ))}
            </div>
            {inspected !== game.viewerId && (
              <p className="muted small">预留牌面仅持有者可见。</p>
            )}
            {inspectBoard.nobles.length > 0 && (
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
                  <p>{lastMoveText(game, move)}</p>
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
                className="primary-button"
                disabled={busy || !game.canRematch}
                onClick={() => onAction({ type: "rematch" })}
              >
                再来一局 <Icon name="arrow" />
              </button>
              {!room && (
                <button className="secondary-button" onClick={onExit}>
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
              <button className="secondary-button" onClick={closePause}>
                取消
              </button>
              <button className="secondary-button" onClick={onExit}>
                放弃并返回
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog-body">
            <div className="pause-actions">
              <button className="primary-button" onClick={closePause}>
                {game?.phase === "ended" ? "返回牌桌" : "继续游戏"}
              </button>
              <button className="secondary-button" onClick={onBack}>
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
        className="help-dialog"
        aria-label="璀璨宝石规则"
      >
        <div className="help-dialog-content">
          <button
            className="help-dialog-close"
            aria-label="关闭规则"
            onClick={() => setHelp(false)}
          >
            <Icon name="close" />
          </button>
          <iframe
            className="help-frame"
            title="璀璨宝石完整规则"
            src="./help.html"
          />
        </div>
      </Dialog>
    </div>
  );
}

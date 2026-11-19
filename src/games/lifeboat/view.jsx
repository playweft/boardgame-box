import { h } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Heart, HeartCrack, X } from "lucide";
import Dialog from "../../shared/dialog.jsx";
import GameTopbar from "../../shared/game-topbar.jsx";
import LucideIcon from "../../shared/lucide-icon.jsx";
import BoatHull from "./boat-hull.jsx";
import { CHARACTERS, MAX_PLAYERS, MIN_PLAYERS, cardInfo, characterById, iconFor, navigationById } from "./data.js";
import Icon from "./icon.jsx";
import Rules from "./rules.jsx";
import cover from "./assets/cover-flat.webp";

function Raised({ secondary, href, icon, children, className = "", ...props }) {
  const classes = `${secondary ? "secondary" : "primary"}-button raised ${className}`;
  const content = <>{children}{icon && <span className="raised-icon"><Icon name={icon} /></span>}</>;
  return href
    ? <a className={classes} href={href} {...props}>{content}</a>
    : <button type="button" className={classes} {...props}>{content}</button>;
}

function Menu({ onSetup, onCreateRoom, launchUrl, busy }) {
  return <main className="menu sea-page">
    <img className="cover" src={cover} alt="夜海里的救生艇，远处有灯塔" width="960" height="640" />
    <div className="menu-heading">
      <h1>怒海求生</h1>
      <p>4–6 人 · 基础版</p>
    </div>
    <div className="menu-actions">
      <Raised onClick={() => onSetup("computer")} icon="forward" disabled={busy}>人机对战</Raised>
      <Raised secondary onClick={() => onSetup("local")} icon="forward" disabled={busy}>本地多人</Raised>
      {launchUrl
        ? <Raised secondary href={launchUrl} icon="forward">联机多人</Raised>
        : <Raised secondary onClick={onCreateRoom} icon="forward" disabled={!onCreateRoom || busy}>
          {busy ? "正在创建房间…" : "联机多人"}
        </Raised>}
    </div>
  </main>;
}

function Setup({ computer, onStart, onBack }) {
  const [count, setCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState(() => Array(MAX_PLAYERS).fill(""));
  const [cast, setCast] = useState(() => CHARACTERS.slice(0, MIN_PLAYERS).map(person => person.id));
  const chooseCount = value => {
    setCount(value);
    setCast(current => current.length === value ? current : CHARACTERS.slice(0, value).map(person => person.id));
  };
  const toggle = id => setCast(current => {
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    return next.length > count ? current : next;
  });
  function start(event) {
    event.preventDefault();
    if (cast.length !== count) return;
    const players = computer ? Array.from({ length: count }, (_, index) => index === 0 ? "你" : `电脑 ${index}`)
      : names.slice(0, count);
    onStart(players, cast);
  }
  const countPicker = <div className="count-picker">
    {[4, 5, 6].map(value => <button key={value} type="button" className="secondary-button" aria-pressed={count === value}
      onClick={() => chooseCount(value)}>{value} 人</button>)}
  </div>;
  return <main className="sea-page setup" data-computer={computer}>
    {!computer && <h1>本地多人</h1>}
    <form onSubmit={start}>
      <div className="setup-options">
        {computer && <h1>人机对战</h1>}
        {computer ? <div className="computer-count" role="group" aria-labelledby="computer-count-label">
          <span id="computer-count-label">玩家人数</span>
          {countPicker}
        </div> : <fieldset>
          <legend>玩家人数</legend>
          {countPicker}
        </fieldset>}
        <fieldset>
          <legend>登船角色 · 已选 {cast.length}/{count}</legend>
          <div className="cast-picker">
            {CHARACTERS.map(person => <button key={person.id} type="button" className={computer ? "role-chip" : "secondary-button"}
              aria-pressed={cast.includes(person.id)} onClick={() => toggle(person.id)}>{person.short}</button>)}
          </div>
        </fieldset>
        {!computer && <>
          <div className="name-fields">
            {names.slice(0, count).map((name, index) => <label key={index} className="name-field">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <input aria-label={`玩家 ${index + 1} 的名字`} value={name} placeholder={`玩家 ${index + 1}`} maxLength={24}
                onInput={event => setNames(names.with(index, event.currentTarget.value))} />
            </label>)}
          </div>
          <p className="hint">轮到下一位时，把手机递过去。爱和恨只有自己看得到。</p>
        </>}
      </div>
      <div className="setup-actions">
        <Raised type="submit" icon="forward" disabled={cast.length !== count}>上船</Raised>
        <button type="button" className="return-to-modes" onClick={onBack}>返回模式选择</button>
      </div>
    </form>
  </main>;
}

function personName(id) {
  return id ? characterById[id]?.short ?? id : "—";
}

function CardFace({ id, selected, disabled, onClick }) {
  const card = cardInfo(id);
  if (!card) return null;
  const face = <>
    <Icon name={iconFor(card.type)} />
    <strong>{card.name}</strong>
    <small>{card.value ? `${card.value} 分` : card.size ? `武器 +${card.size}` : ""}</small>
  </>;
  return onClick
    ? <button type="button" className="card" aria-pressed={selected} disabled={disabled} onClick={onClick}>{face}</button>
    : <div className="card">{face}</div>;
}

function PublicSupplies({ entry, own, canSelect, canTake, selected, disabled, pickCard, takeCard }) {
  if (!entry.shown.length) return null;
  const interactive = (own && canSelect) || canTake;
  const cards = new Map();
  for (const id of entry.shown) {
    const card = cardInfo(id);
    if (!card) continue;
    const key = interactive ? id : `${card.type}-${card.value}`;
    const existing = cards.get(key);
    if (existing) existing.count += 1;
    else cards.set(key, { id, card, count: 1 });
  }
  return <div className="seat-supplies" role="group" aria-label={`${personName(entry.id)}亮出的物资`}
    tabIndex={cards.size > 1 ? 0 : undefined}>
    {[...cards.values()].map(({ id, card, count }) => {
      const label = `${card.name}${card.value ? ` ${card.value}分` : ""}${count > 1 ? ` ×${count}` : ""}`;
      const face = <><Icon name={iconFor(card.type)} /><span>{label}</span></>;
      return interactive
        ? <button key={id} type="button" className="seat-supply" disabled={disabled(id)}
          aria-label={canTake ? `抢夺${personName(entry.id)}的${label}` : undefined}
          aria-pressed={own ? selected === id : undefined}
          onClick={() => own ? pickCard(id) : takeCard(entry.id, id)}>{face}</button>
        : <span key={id} className="seat-supply">{face}</span>;
    })}
  </div>;
}

function CrewBoard({ game, players, feedback, isTarget, pickSeat, canSelectCard, selected, cardDisabled, pickCard, taking, takeCard }) {
  const rows = Math.ceil(game.characters.length / 2);
  return <div className="crew-board" data-rows={rows} style={{ "--seat-rows": rows }}>
    <BoatHull rows={rows} />
    <ol className="seats" aria-label="救生艇座位，从船头起，每排从左到右">
      {game.characters.map(entry => {
        const own = entry.player === game.viewerId;
        const current = entry.id === game.queue[0];
        const target = isTarget(entry);
        const hurt = feedback?.injuries.includes(entry.id);
        const portrait = CHARACTERS.findIndex(person => person.id === entry.id);
        const name = personName(entry.id);
        const status = entry.removed ? "落海" : !entry.alive ? "死亡" : !entry.conscious ? "昏迷" : players[entry.player];
        return <li key={entry.id}>
          <div data-seat-id={entry.id} className={`seat${current ? " is-current" : ""}${entry.removed ? " is-out" : ""}`}
            aria-current={current ? "step" : undefined} data-target={target}>
            <span className="seat-avatar">
              <span className="seat-portrait" aria-hidden="true"
                style={{ backgroundPosition: `${(portrait % 3) * 50}% ${Math.floor(portrait / 3) * 100}%` }} />
              <small className="seat-count" role="img" aria-label={`${entry.handCount} 张暗牌`}>
                <svg viewBox="0 0 18 16" aria-hidden="true">
                  <rect x="2.3" y="2.4" width="7.2" height="10.4" rx="1.1" transform="rotate(-15 5.9 7.6)" />
                  <rect x="8" y="3.6" width="7.2" height="10.4" rx="1.1" />
                </svg>
                {entry.handCount}
              </small>
            </span>
            {target && <button type="button" className="seat-target" aria-label={`选择${name} ${status}`}
              onClick={() => pickSeat(entry)} />}
            <div className="seat-details">
              <span className="seat-role"><strong>{name}</strong>{own && <small>你</small>}</span>
              <small className="seat-name" title={status}>{status}</small>
              <small className={`seat-wounds${hurt ? " wound-flash" : ""}`} key={hurt ? feedback.step : null}>
                伤势 {entry.wounds}/{entry.size}
              </small>
              <PublicSupplies entry={entry} own={own} canSelect={canSelectCard}
                canTake={taking && !own && !entry.removed} selected={selected} disabled={cardDisabled}
                pickCard={pickCard} takeCard={takeCard} />
            </div>
          </div>
        </li>;
      })}
    </ol>
  </div>;
}

function CardFlight({ transfer, boardRef }) {
  const flight = useRef(null);
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const board = boardRef.current;
    const card = flight.current;
    if (!card?.animate || !board) return;
    const seat = id => board.querySelector(`[data-seat-id="${id}"] .seat-portrait`);
    const source = transfer.from ? seat(transfer.from) : board.querySelector("[data-supply-source]");
    const target = seat(transfer.to);
    if (!source || !target) return;

    const boardRect = board.getBoundingClientRect();
    const center = element => {
      const rect = element.getBoundingClientRect();
      return [rect.left - boardRect.left + rect.width / 2, rect.top - boardRect.top + rect.height / 2];
    };
    const [sx, sy] = center(source);
    const [tx, ty] = center(target);
    const position = (x, y, rotation) => `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rotation}deg)`;
    card.hidden = false;
    const animation = card.animate([
      { transform: position(sx, sy, -8), opacity: 1 },
      { transform: position((sx + tx) / 2, (sy + ty) / 2 - 10, 7), opacity: 1 },
      { transform: position(tx, ty, 0), opacity: 0 },
    ], { duration: 270, easing: "ease-out" });
    animation.onfinish = () => { card.hidden = true; };
    return () => { animation.cancel(); card.hidden = true; };
  }, [boardRef, transfer]);

  return <div className="card-flight" aria-hidden="true" ref={flight} hidden><Icon name="supplies" /></div>;
}

function Relationships({ person }) {
  return <section className="relationships" aria-label="你的关系">
    <dl>
      <div><dt aria-label="爱着"><LucideIcon icon={Heart} className="relation-love" /></dt><dd>{personName(person.love)}</dd></div>
      <div><dt aria-label="憎恨"><LucideIcon icon={HeartCrack} className="relation-hate" /></dt><dd>{personName(person.hate)}</dd></div>
    </dl>
  </section>;
}

function Choice({ icon, children, ...props }) {
  return <Raised secondary className="choice" {...props}>
    {icon && <Icon name={icon} />}{children}
  </Raised>;
}

function navigationTargets(spec, characters) {
  if (spec === "all") return "所有人";
  if (spec === "none") return "无人";
  const names = (Array.isArray(spec) ? spec : spec.except)
    .filter(id => characters.some(entry => entry.id === id))
    .map(personName);
  if (Array.isArray(spec)) return names.join("、") || "无人";
  return names.length ? `除${names.join("、")}外` : "所有人";
}

function NavigationFace({ card, characters }) {
  const details = [
    ["落水", navigationTargets(card.overboard, characters)],
    ["口渴", navigationTargets(card.thirst, characters)],
    ["划船口渴", card.row ? "会" : "不会"],
    ["打架口渴", card.fight ? "会" : "不会"],
    ["海鸥", card.bird > 0 ? "+1" : card.bird < 0 ? "−1" : "0"],
  ];
  return <span className="navigation-face">
    {details.map(([label, value]) =>
      <span className="navigation-detail" key={label}><span>{label}</span><strong>{value}</strong></span>)}
  </span>;
}

const EMPTY_ROW_DRAFT = { dismissed: false, kept: [] };

function RowDecision({ cards, characters, draft, updateDraft, busy, error, overlayOpen, onConfirm }) {
  const close = () => updateDraft(() => ({ dismissed: true }));
  const resume = () => updateDraft(() => ({ dismissed: false }));
  return <>
    <Raised secondary aria-haspopup="dialog" onClick={resume}>继续划船</Raised>
    <GameDialog title="划船" closeLabel="返回棋桌" className="row-dialog" open={!draft.dismissed && !overlayOpen} onClose={close}
      footer={<div className="row-dialog-footer">
        {error && <p className="error table-error" role="alert">{error}</p>}
        <p className="table-hint" role="status">留下 {draft.kept.length} 张 · 放回 {cards.length - draft.kept.length} 张</p>
        <Raised disabled={busy} onClick={() => onConfirm(cards.map(id => draft.kept.includes(id)))}>确认划船</Raised>
      </div>}>
      <div className="row-choices" aria-label="划船抽到的航海牌" role="group">
        {cards.map((id, index) => {
          const kept = draft.kept.includes(id);
          return <button type="button" key={id} className="navigation-card" disabled={busy} aria-pressed={kept}
            onClick={() => updateDraft(({ kept: previous }) => ({
              kept: previous.includes(id) ? previous.filter(card => card !== id) : [...previous, id],
            }))}>
            <span className="navigation-label"><Icon name="compass" />航海牌 {index + 1}</span>
            <NavigationFace card={navigationById[id]} characters={characters} />
            <strong className="row-card-destination">{kept ? "留在划船堆" : "放回牌底"}</strong>
          </button>;
        })}
      </div>
    </GameDialog>
  </>;
}

function WaterPanel({ game, selected, drinks, setDrinks, setSelected, busy, send }) {
  const ready = cardInfo(selected)?.type === "water" && !drinks.some(use => use.card === selected);
  return <section className="panel" aria-label="分配淡水">
    <h2>分配淡水</h2>
    <p className="hint">先选一张淡水，再选一名口渴的角色。</p>
    <div className="actions">
      {game.thirst.filter(item => item.left > 0).map(({ id, left }) => {
        const remaining = left - drinks.filter(use => use.for === id).length;
        const own = game.characters.some(entry => entry.id === id && entry.player === game.viewerId);
        return <Choice key={id} disabled={busy || !ready || remaining <= 0} onClick={() => {
          setDrinks([...drinks, { card: selected, for: id }]);
          setSelected(null);
        }}>
          <span>{personName(id)}{own ? "（自己）" : ""}<small>还需 {remaining} 份</small></span>
        </Choice>;
      })}
    </div>
    {!!drinks.length && <ul className="water-draft" aria-label="待使用的淡水">
      {drinks.map(use => <li key={use.card}>
        <span><Icon name="water" />淡水 → {personName(use.for)}</span>
        <Choice disabled={busy} onClick={() => setDrinks(drinks.filter(item => item.card !== use.card))}>
          撤销
        </Choice>
      </li>)}
    </ul>}
    <div className="paired-actions">
      <Raised secondary disabled={busy} onClick={() => send({ type: "drink", uses: [] })}>跳过</Raised>
      <Raised disabled={busy || !drinks.length} onClick={() => send({ type: "drink", uses: drinks })}>确认淡水</Raised>
    </div>
  </section>;
}

const EMPTY_DRAFT = { selected: null, mode: "", drinks: [] };

function Table({ game, computer, feedback, busy, trading, error, overlayOpen, rowDraft, onRowDraft,
  onAction, onChooseTrader, onEndTrade, onComputerHold, onHistory }) {
  const boardRef = useRef(null);
  const turnRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const { selected, mode, drinks } = draft?.step === game.step ? draft : EMPTY_DRAFT;
  const updateDraft = changes => setDraft(previous => ({
    ...(previous?.step === game.step ? previous : EMPTY_DRAFT), ...changes, step: game.step,
  }));
  const self = game.characters.find(entry => entry.player === game.viewerId);
  const players = Object.fromEntries(game.players.map(player => [player.id, player.name]));
  const nav = game.navCard ? navigationById[game.navCard] : null;
  const active = game.canAct && !trading;
  const dealing = active && game.phase === "deal";
  const canTrade = game.canTrade && !!self;
  const usingWater = active && game.phase === "thirst";
  const canSelectCard = canTrade || usingWater;
  const ownCards = self ? [...(self.hand || []), ...self.shown] : [];
  const weapons = self?.hand?.filter(id => cardInfo(id)?.size) ?? [];
  const ownsSelected = ownCards.includes(selected);
  const selectedType = ownsSelected ? cardInfo(selected)?.type : null;
  const ownsType = type => ownCards.some(id => cardInfo(id)?.type === type);
  const send = intent => {
    if (turnRef.current) turnRef.current.scrollTop = 0;
    updateDraft({ mode: "", selected: null });
    onAction(intent);
  };
  const pickCard = id => {
    const next = id === selected ? null : id;
    if (computer && !active && canTrade) onComputerHold(Boolean(next));
    updateDraft({ selected: next, mode: "" });
  };
  const cardDisabled = id => busy || (usingWater && (cardInfo(id)?.type !== "water" || drinks.some(use => use.card === id)));
  const publicActor = game.characters.find(entry => entry.id === game.queue[0]);
  const giveSelectedCard = canTrade && ownsSelected;

  function isTarget(entry) {
    if (busy || entry.removed) return false;
    if (mode === "give") return canTrade && ownsSelected && entry.id !== self.id;
    if (!active) return false;
    if (mode === "medical") return selectedType === "medical" && entry.alive && entry.wounds > 0;
    if (entry.id === self?.id) return false;
    if (mode === "move") return true;
    if (mode === "mug") return entry.handCount > 0;
    return mode === "throw" && entry.conscious && game.falling.includes(entry.id);
  }

  function pickSeat(entry) {
    if (!isTarget(entry)) return;
    if (mode === "move" || mode === "mug") send({ type: mode, target: entry.id });
    if (mode === "give" || mode === "medical") send({ type: mode, target: entry.id, card: selected });
    if (mode === "throw") send({ type: "rescue", to: entry.id });
  }

  return <main className="table sea-page" ref={boardRef}>
    <div className="table-overview">
      <div className="meters" role="group" aria-label="船况">
        <div className="meter"><Icon name="bird" /><span>海鸥</span><b>{game.birds}/4</b></div>
        <div className="meter" data-supply-source><Icon name="supplies" /><span>物资牌</span><b>{game.supplyCount}</b></div>
        <div className="meter"><Icon name="compass" /><span>航海牌</span><b>{game.navCount}</b></div>
      </div>
      <CrewBoard game={game} players={players} feedback={feedback} isTarget={isTarget} pickSeat={pickSeat}
        canSelectCard={canSelectCard} selected={selected} cardDisabled={cardDisabled} pickCard={pickCard}
        taking={mode === "mug"} takeCard={(target, card) => send({ type: "mug", target, card })} />
    </div>
    <section className="turn-panel panel" aria-label="当前行动">
      <header className="turn-panel-header">
        <h2 className="turn-heading" data-active={active}>
          第 {game.day} 天{dealing ? " · 分配物资" : active ? " · 轮到你" : ""}
        </h2>
        {computer && <button type="button" className="turn-feedback" disabled={!feedback} aria-haspopup="dialog" onClick={onHistory}>
          <span className="feedback-text" role="status">{feedback?.text ?? "行动记录"}</span>
          <span className="feedback-arrow"><Icon name="forward" /></span>
        </button>}
      </header>
      <div className="turn-scroll" ref={turnRef} key={`${game.day}-${game.phase}-${active}-${game.fight?.stage}`} tabIndex={0}>
        {error && <p className="error table-error" role="alert">{error}</p>}
        {trading && <p className="table-hint">选一张物资，再选收牌的船员。</p>}
        {!active && !trading && game.phase !== "ended" &&
          <p className="table-hint" role="status">{computer
            ? ownsSelected && canTrade ? "再点一次物资可继续电脑的回合" : `${players[publicActor?.player] ?? "电脑玩家"} 正在行动…`
            : "等待当前行动结算"}</p>}
        {dealing && <section className="card-tray provision-deal">
          <p className="table-hint">选择一张物资</p>
          <div className="hand provision-offer" aria-label="选择物资" style={{ "--card-columns": Math.min(4, game.offer.length) }}>
            {game.offer.map(id => <CardFace key={id} id={id} disabled={busy} onClick={() => send({ type: "take", card: id })} />)}
          </div>
        </section>}
        {active && rowDraft && <RowDecision cards={game.rowChoices} characters={game.characters} draft={rowDraft}
          updateDraft={onRowDraft} busy={busy} error={error} overlayOpen={overlayOpen}
          onConfirm={keep => send({ type: "sort", keep })} />}
        {active && game.phase === "navigate" && <section className="panel">
          <h2>选择航海牌</h2>
          <div className="choices">
            {game.rowChoices.map((id, index) =>
              <button type="button" key={id} className="navigation-card" disabled={busy} onClick={() => send({ type: "play", card: id })}>
                <span className="navigation-label"><Icon name="compass" />航海牌 {index + 1}</span>
                <NavigationFace card={navigationById[id]} characters={game.characters} />
              </button>)}
          </div>
        </section>}
        {active && game.phase === "action" && <section className="card-tray" aria-label="行动选项">
          <div className="actions" aria-label="行动">
            <Choice icon="oar" aria-haspopup="dialog" disabled={busy} onClick={() => send({ type: "row" })}>划船</Choice>
            <Choice icon="swap" disabled={busy} aria-pressed={mode === "move"} onClick={() => updateDraft({ mode: "move" })}>换座</Choice>
            <Choice icon="weapon" disabled={busy} aria-pressed={mode === "mug"} onClick={() => updateDraft({ mode: "mug" })}>抢夺</Choice>
            <Choice icon="wait" disabled={busy} onClick={() => send({ type: "nothing" })}>不动</Choice>
            {self?.hand?.some(id => cardInfo(id)?.type === "parasol") && !self.parasol &&
              <Choice icon="parasol" disabled={busy} onClick={() => send({ type: "parasol" })}>撑阳伞</Choice>}
            {ownsType("flare") &&
              <Choice icon="weapon" disabled={busy} onClick={() => send({ type: "flare" })}>信号枪</Choice>}
            {selectedType === "medical" &&
              <Choice icon="medical" disabled={busy} aria-pressed={mode === "medical"} onClick={() => updateDraft({ mode: "medical" })}>治疗</Choice>}
            {self?.hand?.includes(selected) && selectedType !== "parasol" &&
              <Choice disabled={busy} onClick={() => send({ type: "reveal", card: selected })}>亮出</Choice>}
          </div>
        </section>}
        {game.phase === "answer" && !trading && <section className="panel">
          <h2>{game.demand.kind === "move" ? "换座请求" : "抢夺请求"}</h2>
          <p className="hint">{personName(game.demand.from)} → {personName(game.demand.to)}
            {game.demand.kind === "mug" && ` · ${game.demand.card ? cardInfo(game.demand.card).name : "一张暗牌"}`}</p>
          {active && <div className="paired-actions">
            <Raised secondary disabled={busy} onClick={() => send({ type: "answer", accept: true })}>答应</Raised>
            <Raised disabled={busy} onClick={() => send({ type: "answer", accept: false })}>开战</Raised>
          </div>}
        </section>}
        {game.phase === "fight" && <section className="panel">
          <h2>{game.fight.stage === "join" ? "选择阵营" : "亮出武器"}</h2>
          <p className="hint">进攻方 · {game.fight.attackers.map(personName).join("、")}</p>
          <p className="hint">防守方 · {game.fight.defenders.map(personName).join("、")}</p>
          {active && (game.fight.stage === "join" ? <div className="actions">
            <Choice disabled={busy} onClick={() => send({ type: "join", side: "attack" })}>帮进攻</Choice>
            <Choice disabled={busy} onClick={() => send({ type: "join", side: "defend" })}>帮防守</Choice>
            <Choice disabled={busy} onClick={() => send({ type: "join", side: "out" })}>不参与</Choice>
          </div> : <>
            {!!weapons.length && <div className="hand" aria-label="可亮出的武器">
              {weapons.map(id => <CardFace key={id} id={id} disabled={busy} onClick={() => send({ type: "arm", card: id })} />)}
            </div>}
            <Choice disabled={busy} onClick={() => send({ type: "arm", card: false })}>不用武器</Choice>
          </>)}
        </section>}
        {active && game.phase === "rescue" && <section className="panel">
          <h2>落水</h2>
          <p className="hint">{game.falling.map(personName).join("、")}</p>
          <div className="actions">
            <Choice icon="preserver" disabled={busy || !ownsType("preserver")}
              aria-pressed={mode === "throw"} onClick={() => updateDraft({ mode: "throw" })}>抛救生圈</Choice>
            <Choice icon="chum" disabled={busy || !self?.hand?.some(id => cardInfo(id)?.type === "chum")}
              onClick={() => send({ type: "rescue", chum: true })}>投放鱼饵</Choice>
            <Choice disabled={busy} onClick={() => send({ type: "rescue" })}>跳过</Choice>
          </div>
        </section>}
        {usingWater && <WaterPanel game={game} selected={selected} drinks={drinks}
          setDrinks={next => updateDraft({ drinks: next })} setSelected={next => updateDraft({ selected: next })}
          busy={busy} send={send} />}
        {mode && <p className="hint" role="status">{mode === "give" ? "选择收牌的船员。" : mode === "mug"
          ? "点船员摸暗牌，或点船员旁的亮牌指定抢夺。" : "请选择一个座位。"}</p>}
        {game.phase === "ended" && !!game.scores?.length && <Settlement key={game.step} game={game} players={players}
          busy={busy} error={error} overlayOpen={overlayOpen} onAction={onAction} />}
        {nav && <section className="navigation-card">
          <h2>刚才的航海</h2>
          <NavigationFace card={nav} characters={game.characters} />
        </section>}
        {(giveSelectedCard || onChooseTrader || trading) && <div className={giveSelectedCard && onChooseTrader ? "paired-actions" : "table-footer"}>
          {giveSelectedCard && <Raised secondary className="lifeboat-selectable" disabled={busy}
            aria-pressed={mode === "give"} onClick={() => updateDraft({ mode: "give" })}>交给别人</Raised>}
          {onChooseTrader && <Raised secondary disabled={busy} onClick={onChooseTrader}>传屏交易</Raised>}
          {trading && <Raised secondary onClick={onEndTrade}>返回当前回合</Raised>}
        </div>}
      </div>
    </section>
    {self && <section className="player-tray" aria-labelledby="hand-heading">
      <header className="player-tray-header">
        <h2 id="hand-heading">{trading ? "交易" : "你的手牌"}</h2>
        <Relationships person={self} />
      </header>
      <div className="card-rail" role="group" aria-label="你的物资" tabIndex={0}>
        {!!self.hand.length ? <div className="hand" aria-label="手牌">
          {self.hand.map(id => <CardFace key={id} id={id} selected={selected === id}
            disabled={cardDisabled(id)} onClick={canSelectCard ? () => pickCard(id) : undefined} />)}
        </div> : <p className="table-hint">手里没有牌。</p>}
      </div>
    </section>}
    {feedback?.transfer && <CardFlight key={feedback.step} transfer={feedback.transfer} boardRef={boardRef} />}
  </main>;
}

function Notice({ icon, title, children }) {
  return <main className="notice-page sea-page"><section className="notice">
    <Icon name={icon} /><h1>{title}</h1>{children}
  </section></main>;
}

function GameDialog({ title, open, onClose, children, footer, className = "", closeLabel }) {
  return <Dialog className={`sea-dialog ${className}`} open={open} onClose={onClose} aria-label={title}>
    <div className="dialog-inner">
      <header>
        <h2>{title}</h2>
        <button type="button" className={closeLabel ? "dialog-back-button" : "dialog-close-button"}
          aria-label={closeLabel ? undefined : `关闭${title}`} onClick={onClose}>
          {closeLabel || <LucideIcon icon={X} />}
        </button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </Dialog>;
}

function Settlement({ game, players, busy, error, overlayOpen, onAction }) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  const scores = [...game.scores].sort((a, b) => b.total - a.total);
  return <>
    <Raised secondary className="open-settlement" onClick={() => setOpen(true)}>查看结算</Raised>
    <GameDialog title="靠岸结算" className="settlement-dialog" open={open && !overlayOpen} onClose={close}
      footer={<>
        {error && <p className="error settlement-error" role="alert">{error}</p>}
        <div className={game.canRematch ? "paired-actions" : "table-footer"}>
          <Raised secondary onClick={close}>返回棋桌</Raised>
          {game.canRematch && <Raised disabled={busy} onClick={() => onAction({ type: "rematch" })}>再来一局</Raised>}
        </div>
      </>}>
      <ol className="settlement-scores" aria-label="结算分数" tabIndex={0}>
        {scores.map(score => <li key={score.player} className={`score${score.total === scores[0].total ? " is-leader" : ""}`}>
          <div className="score-summary">
            <strong>{players[score.player]} · {personName(game.characters.find(entry => entry.player === score.player)?.id)}</strong>
            <b>{score.total} 分</b>
          </div>
          <small>生存 {score.survival} · 爱 {score.love} · 恨 {score.hate} · 财物 {score.loot}</small>
        </li>)}
      </ol>
    </GameDialog>
  </>;
}

export default function LifeboatApp({ room, computer, turnHistory, standalone, game, connecting, waiting, handoff, trading, busy, error, launchUrl,
  onCreateRoom, onStart, onReady, onTrade, onEndTrade, onExit, onAction, onPauseChange, onComputerHold }) {
  const [setup, setSetup] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [savedRow, setSavedRow] = useState(null);
  const rowKey = game?.phase === "row" && game.canAct && !trading && game.rowChoices?.length
    ? JSON.stringify([game.day, game.viewerId, game.rowChoices]) : null;
  const rowDraft = rowKey && (savedRow?.key === rowKey ? savedRow : EMPTY_ROW_DRAFT);

  useLayoutEffect(() => {
    if (game?.phase !== "row") setSavedRow(null);
  }, [game?.phase]);

  function updateRowDraft(update) {
    setSavedRow(previous => {
      const current = previous?.key === rowKey ? previous : EMPTY_ROW_DRAFT;
      return { ...current, ...update(current), key: rowKey };
    });
  }

  const showDialog = next => {
    setDialog(next);
    if (computer) onPauseChange(next !== null);
  };
  const close = () => showDialog(null);
  const localMatch = !room && !!game;
  const confirmExit = dialog === "exit";
  const traders = localMatch && !computer && game.tradeOpen && !trading
    ? game.players.filter(player => game.characters.some(entry => entry.player === player.id
      && entry.conscious && (entry.handCount || entry.shown.length)))
    : [];
  let scene;
  if (connecting || (room && !game)) {
    scene = <Notice icon="bird" title={connecting ? "正在连接 Playweft" : waiting ? "等待房间开局" : "正在装载救生艇"} />;
  } else if (localMatch && handoff) {
    const player = game.players.find(item => item.id === game.viewerId);
    scene = <Notice icon="lock" title={`交给 ${player?.name ?? "下一位"}`}>
      <p className="hint">{trading ? "请由交易玩家接过设备后继续。" : `第 ${game.day} 天。屏幕上会看到你的爱、恨和手牌。`}</p>
      <Raised onClick={onReady} icon="forward">我准备好了</Raised>
      {trading && <Raised secondary onClick={onEndTrade}>返回当前回合</Raised>}
    </Notice>;
  } else if (game) scene = <Table key={`${game.viewerId}-${trading}`}
    game={game} computer={computer} feedback={computer ? turnHistory[0] : null}
    busy={busy} trading={trading} error={error} overlayOpen={dialog !== null} rowDraft={rowDraft} onRowDraft={updateRowDraft}
    onAction={onAction} onEndTrade={onEndTrade}
    onHistory={() => showDialog("history")}
    onComputerHold={onComputerHold}
    onChooseTrader={traders.length ? () => setDialog("trade") : null} />;
  else scene = setup
    ? <Setup computer={setup === "computer"} onBack={() => setSetup(null)}
      onStart={(names, cast) => { setSetup(null); onStart(names, cast, setup === "computer"); }} />
    : <Menu onSetup={setSetup} onCreateRoom={onCreateRoom} launchUrl={launchUrl} busy={busy} />;

  return <div className="sea-shell">
    <GameTopbar title="怒海求生" standalone={standalone} room={room}
      onPause={!connecting && localMatch ? () => showDialog("pause") : undefined}
      onHelp={() => showDialog("help")} />
    {error && (!game || handoff || connecting) && <p className="error" role="alert">{error}</p>}
    {scene}
    {computer && <GameDialog title="行动记录" open={dialog === "history"} onClose={close}
      footer={<Raised secondary onClick={close}>返回棋桌</Raised>}>
      <ol className="activity-list" aria-label="最近行动" tabIndex={0}>
        {turnHistory.map(event => <li key={event.step}>
          <small>第 {event.day} 天</small>
          <p>{event.text}</p>
        </li>)}
      </ol>
    </GameDialog>}
    <GameDialog title="游戏规则" open={dialog === "help"} onClose={close}
      footer={<Raised onClick={close}>知道了</Raised>}>
      <Rules />
    </GameDialog>
    <GameDialog title={confirmExit ? "退出当前对局？" : "游戏暂停"}
      open={dialog === "pause" || confirmExit}
      onClose={confirmExit ? () => showDialog("pause") : close}>
      {confirmExit ? <>
        <p className="hint">本地进度不会保留。</p>
        <div className="paired-actions">
          <Raised secondary onClick={() => showDialog("pause")}>取消</Raised>
          <Raised onClick={() => { close(); onExit(); }}>退出</Raised>
        </div>
      </> : <div className="table-footer">
        <Raised onClick={close}>继续游戏</Raised>
        <Raised secondary onClick={() => showDialog("exit")}>放弃对局</Raised>
      </div>}
    </GameDialog>
    <GameDialog title="选择交易玩家" open={dialog === "trade"} onClose={close}>
      <p className="hint">选择要转交物资的船员，再把设备交给对方。</p>
      <div className="trade-players">
        {traders.map(player => <Raised secondary key={player.id}
          onClick={() => { close(); onTrade(player.id); }}>{player.name}</Raised>)}
      </div>
    </GameDialog>
  </div>;
}

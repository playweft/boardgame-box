import { h } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Heart, HeartCrack, X } from "lucide";
import Dialog from "../../shared/dialog.jsx";
import GameTopbar from "../../shared/game-topbar.jsx";
import LucideIcon from "../../shared/lucide-icon.jsx";
import BoatHull from "./boat-hull.jsx";
import { CHARACTERS, MAX_PLAYERS, MIN_PLAYERS, cardInfo, characterAbility, characterById, iconFor, navigationById, provisionEffect } from "./data.js";
import { fightWeapons } from "./engine.js";
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

function crewStatus(entry) {
  if (entry.removed) return "落海";
  if (!entry.alive) return "死亡";
  return entry.conscious ? "" : "昏迷";
}

function CrewPortrait({ id }) {
  const index = CHARACTERS.findIndex(person => person.id === id);
  return <span className="seat-portrait" aria-hidden="true"
    style={{ backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%` }} />;
}

function CardFace({ id, disabled, onClick, detailsOpen }) {
  const card = cardInfo(id);
  if (!card) return null;
  const face = <>
    <Icon name={iconFor(card.type)} />
    <strong>{card.name}</strong>
    <small>{card.value ? `${card.value} 分` : card.size ? `武器 +${card.size}` : ""}</small>
  </>;
  return onClick
    ? <button type="button" className="card" aria-expanded={detailsOpen}
      aria-controls={detailsOpen !== undefined ? "hand-card-details" : undefined}
      disabled={disabled} onClick={onClick}>{face}</button>
    : <div className="card">{face}</div>;
}

function PublicSupplies({ entry, onInspect, canTake, inspectedId, disabled, takeCard }) {
  if (!entry.shown.length) return null;
  const interactive = !!onInspect || canTake;
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
          aria-expanded={onInspect ? inspectedId === id : undefined}
          aria-controls={onInspect ? "hand-card-details" : undefined}
          onClick={event => onInspect ? onInspect(id, event.currentTarget) : takeCard(entry.id, id)}>{face}</button>
        : <span key={id} className="seat-supply">{face}</span>;
    })}
  </div>;
}

function CrewBoard({ game, players, feedback, isTarget, pickSeat, inspectCard, inspectedId, cardDisabled, taking, takeCard }) {
  const rows = Math.ceil(game.characters.length / 2);
  return <div className="crew-board" data-rows={rows} style={{ "--seat-rows": rows }}>
    <BoatHull rows={rows} />
    <ol className="seats" aria-label="救生艇座位，从船头到船尾">
      {game.characters.map(entry => {
        const own = entry.player === game.viewerId;
        const current = entry.id === game.queue[0];
        const target = isTarget(entry);
        const hurt = feedback?.injuries.includes(entry.id);
        const name = personName(entry.id);
        const status = crewStatus(entry) || players[entry.player];
        return <li key={entry.id}>
          <div data-seat-id={entry.id} className={`seat${current ? " is-current" : ""}${entry.removed ? " is-out" : ""}`}
            aria-current={current ? "step" : undefined} data-target={target}>
            <span className="seat-avatar">
              <CrewPortrait id={entry.id} />
              <small className="seat-count" role="img" aria-label={`${entry.handCount} 张暗牌`}>
                <svg viewBox="0 0 18 16" aria-hidden="true">
                  <rect x="2.3" y="2.4" width="7.2" height="10.4" rx="1.1" transform="rotate(-15 5.9 7.6)" />
                  <rect x="8" y="3.6" width="7.2" height="10.4" rx="1.1" />
                </svg>
                {entry.handCount}
              </small>
            </span>
            <button type="button" className="seat-button" aria-label={target ? `选择${name} ${status}` : `查看${name}的详情`}
              aria-haspopup={target ? undefined : "dialog"} onClick={() => pickSeat(entry)} />
            <div className="seat-details">
              <strong className="seat-role">{name}</strong>
              <div className="seat-player">
                {(!own || status !== "你") && <small className="seat-name" title={status}>{status}</small>}
                {own && <small className="seat-self">你</small>}
              </div>
              <small className={`seat-wounds${hurt ? " wound-flash" : ""}`} key={hurt ? feedback.step : null}>
                伤势 {entry.wounds}/{entry.size}
              </small>
            </div>
          </div>
          <div className="seat-supply-slot">
            <PublicSupplies entry={entry} onInspect={own && inspectCard} inspectedId={inspectedId}
              canTake={taking && !own && !entry.removed} disabled={cardDisabled} takeCard={takeCard} />
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
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);
  const loved = characterById[person.love];
  const hated = characterById[person.hate];
  const lovesSelf = loved?.id === person.id;
  const hatesSelf = hated?.id === person.id;
  const survival = characterById[person.id].survival;
  const loveName = lovesSelf ? "自己" : personName(person.love);
  const hateName = hatesSelf ? "自己" : personName(person.hate);

  function placeTooltip() {
    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    if (!trigger || !tooltip.matches(":popover-open")) return;
    const { left, right, top, bottom } = trigger.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.documentElement;
    const gap = 8;
    const above = top >= tooltip.offsetHeight + 2 * gap || top >= clientHeight - bottom;
    const centered = (left + right - tooltip.offsetWidth) / 2;
    tooltip.style.left = Math.max(gap, Math.min(centered, clientWidth - tooltip.offsetWidth - gap)) + "px";
    const preferredTop = above ? top - tooltip.offsetHeight - gap : bottom + gap;
    tooltip.style.top = Math.max(gap, Math.min(preferredTop, clientHeight - tooltip.offsetHeight - gap)) + "px";
    tooltip.style.transformOrigin = above ? "center bottom" : "center top";
  }

  useLayoutEffect(() => {
    window.addEventListener("resize", placeTooltip);
    window.addEventListener("scroll", placeTooltip, true);
    return () => {
      window.removeEventListener("resize", placeTooltip);
      window.removeEventListener("scroll", placeTooltip, true);
    };
  }, []);

  function toggleTooltip(event) {
    event.preventDefault();
    const tooltip = tooltipRef.current;
    const trigger = event.currentTarget;
    if (tooltip.matches(":popover-open")) {
      tooltip.hidePopover();
      return;
    }
    triggerRef.current = trigger;
    tooltip.showPopover({ source: trigger });
    placeTooltip();
  }

  return <div className="relationships">
    <button type="button" className="relation-trigger" popovertarget="relationship-details"
      aria-label={`查看爱与恨，爱 ${loveName}，恨 ${hateName}`} onClick={toggleTooltip}>
      <span><LucideIcon icon={Heart} className="relation-love" />{loveName}</span>
      <span><LucideIcon icon={HeartCrack} className="relation-hate" />{hateName}</span>
    </button>
    <div id="relationship-details" className="relationship-tooltip" popover="auto" role="tooltip" ref={tooltipRef}>
      <h2>爱与恨</h2>
      {loved && <div>
        <strong>爱 · {loveName}</strong>
        {lovesSelf ? <p>生存分是角色活到靠岸时获得的基础分。你的生存分是 <b>{survival} 分</b>。
          {hatesSelf ? <>你活到靠岸时，这 {survival} 分只算一次。</>
            : <>你活到靠岸时，爱自己再加 <b>{survival} 分</b>，两项共 <b>{survival * 2} 分</b>。</>}
        </p> : <p>靠岸时，{loveName}还活着，你加 <b>{loved.survival} 分</b>。</p>}
      </div>}
      {hated && <div>
        <strong>恨 · {hateName}</strong>
        {hatesSelf ? <p>{!lovesSelf && <>你自己的 <b>{survival} 分</b>生存分不计。</>}
          靠岸时，{lovesSelf ? "除你以外" : "除你和你爱的人以外"}，每有一人死亡或沉海，你就加上那个人的体型值。
        </p> : <p>靠岸时，{hateName}已死亡或沉海，你加 <b>{hated.size} 分</b>。</p>}
      </div>}
    </div>
  </div>;
}

function Choice({ icon, children, ...props }) {
  return <Raised secondary className="choice" {...props}>
    {icon && <Icon name={icon} />}{children}
  </Raised>;
}

function FightSide({ label, members, flareBy }) {
  return <div className="fight-side">
    <h3>{label}</h3>
    <ul aria-label={label}>
      {members.map(id => <li key={id} className="fight-member">
        <CrewPortrait id={id} />
        <strong>{personName(id)}</strong>
        {id === flareBy && <small>信号枪 +8</small>}
      </li>)}
    </ul>
  </div>;
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
  return <span className="navigation-card">
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
      <div className="navigation-choices" aria-label="划船抽到的航海牌" role="group">
        {cards.map((id, index) => {
          const kept = draft.kept.includes(id);
          return <button type="button" key={id} className="navigation-choice" disabled={busy} aria-pressed={kept}
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

function WaterPanel({ game, waterCard, drinks, setDrinks, addDrink, busy, send }) {
  return <section className="panel" aria-label="分配淡水">
    <h2>分配淡水</h2>
    <p className="hint">{waterCard ? "选择喝水的船员。" : "点一张淡水，在详情里选择分配淡水。"}</p>
    <div className="actions">
      {game.thirst.filter(item => item.left > 0).map(({ id, left }) => {
        const remaining = left - drinks.filter(use => use.for === id).length;
        const own = game.characters.some(entry => entry.id === id && entry.player === game.viewerId);
        return <Choice key={id} data-water-target={!!waterCard && remaining > 0} disabled={busy || !waterCard || remaining <= 0}
          onClick={() => addDrink(id)}>
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

const EMPTY_DRAFT = { targetCard: null, mode: "", drinks: [] };

function Table({ game, computer, feedback, busy, trading, error, overlayOpen, rowDraft, onRowDraft,
  onAction, onChooseTrader, onEndTrade, onComputerHold, onHistory, onInspect }) {
  const boardRef = useRef(null);
  const turnRef = useRef(null);
  const handPopoverRef = useRef(null);
  const handBackdropRef = useRef(null);
  const handPanelRef = useRef(null);
  const handContent = useRef(null);
  const handTrigger = useRef(null);
  const focusTarget = useRef(null);
  const [inspectedCard, setInspectedCard] = useState(null);
  const [draft, setDraft] = useState(null);
  const { targetCard, mode, drinks } = draft?.step === game.step ? draft : EMPTY_DRAFT;
  const updateDraft = changes => setDraft(previous => ({
    ...(previous?.step === game.step ? previous : EMPTY_DRAFT), ...changes, step: game.step,
  }));
  const self = game.characters.find(entry => entry.player === game.viewerId);
  const players = Object.fromEntries(game.players.map(player => [player.id, player.name]));
  const nav = game.navCard ? navigationById[game.navCard] : null;
  const active = game.canAct && !trading;
  const dealing = active && game.phase === "deal";
  const demand = game.phase === "answer" ? game.demand : null;
  const mug = demand?.kind === "mug";
  const requester = personName(demand?.from);
  const recipient = personName(demand?.to);
  const requestedCard = mug ? cardInfo(demand.card) : null;
  const respondToMug = mug && demand.to === self?.id;
  const canTrade = game.canTrade && !!self;
  const canReveal = self?.conscious && game.phase !== "ended";
  const usingWater = active && game.phase === "thirst";
  const ownCards = self ? [...(self.hand || []), ...self.shown] : [];
  const weapons = fightWeapons(self);
  const publicActor = game.characters.find(entry => entry.id === game.queue[0]);
  const cardDisabled = id => busy || drinks.some(use => use.card === id);
  const inspectCard = (id, element) => setInspectedCard({ id, element });
  const closeCard = () => setInspectedCard(null);
  const send = intent => {
    if (turnRef.current) turnRef.current.scrollTop = 0;
    closeCard();
    updateDraft({ mode: "", targetCard: null });
    onAction(intent);
  };
  const canHeal = entry => !entry.removed && entry.alive && entry.wounds > 0;
  const canReceive = entry => !entry.removed && entry.id !== self?.id;
  const canRescue = entry => canReceive(entry) && entry.conscious && game.falling.includes(entry.id);
  const needsWater = game.thirst?.some(({ id, left }) => left > drinks.filter(use => use.for === id).length);
  const actionPhase = active && game.phase === "action";
  const rescuePhase = active && game.phase === "rescue";
  const arming = active && game.phase === "fight" && game.fight.stage === "arm";
  const handDetail = ownCards.includes(inspectedCard?.id) ? cardInfo(inspectedCard.id) : null;
  const anchor = inspectedCard?.element;
  const handCard = !overlayOpen && handDetail && (arming || !anchor.closest(".turn-scroll")) ? anchor : null;
  const openSupplyId = handCard?.closest(".seat-supplies") ? inspectedCard.id : undefined;
  if (handCard) {
    const { id, type } = handDetail;
    const inHand = (self.hand || []).includes(id);
    const actions = [
      canReveal && inHand && { label: "亮出", intent: { type: "reveal", card: id } },
      canTrade && game.characters.some(canReceive) && { label: "交给别人", target: "give" },
      actionPhase && type === "medical" && game.characters.some(canHeal) && { label: "治疗", target: "medical" },
      usingWater && type === "water" && needsWater && { label: "分配淡水", target: "water" },
      actionPhase && type === "parasol" && !self.parasol && { label: "撑阳伞", intent: { type: "parasol" } },
      actionPhase && type === "flare" && { label: "发射信号枪", intent: { type: "flare" } },
      rescuePhase && type === "preserver" && game.characters.some(canRescue) && { label: "抛救生圈", target: "throw" },
      rescuePhase && type === "chum" && inHand && game.falling.length > 0 && { label: "投放鱼饵", intent: { type: "rescue", chum: true } },
      arming && weapons.includes(id) && { label: "使用武器", intent: { type: "arm", card: id } },
    ].filter(Boolean);
    handContent.current = { card: handDetail, actions, busy: cardDisabled(id) };
  }
  const detail = handContent.current;

  useLayoutEffect(() => {
    const popover = handPopoverRef.current;
    const panel = handPanelRef.current;
    if (!handCard) {
      setInspectedCard(null);
      if (!popover.matches(":popover-open")) return;
      let cancelled = false;
      const exit = panel?.getAnimations().find(animation => animation.animationName === "hand-card-exit");
      const finish = () => {
        if (cancelled) return;
        const restoreFocus = popover.contains(document.activeElement);
        popover.hidePopover();
        const target = focusTarget.current && boardRef.current?.querySelector(focusTarget.current);
        focusTarget.current = null;
        if (target) target.focus();
        else if (restoreFocus && handTrigger.current?.isConnected) handTrigger.current.focus({ preventScroll: true });
      };
      if (exit) exit.finished.then(finish, finish);
      else finish();
      return () => { cancelled = true; };
    }

    handTrigger.current = handCard;
    popover.showPopover();
    const rail = handCard.closest(".card-rail, .seat-supplies") ?? handCard.parentElement;
    const backdrop = handBackdropRef.current;
    const place = () => {
      const card = handCard.getBoundingClientRect();
      const railBounds = rail.getBoundingClientRect();
      const { clientWidth: width, clientHeight: height } = document.documentElement;
      const left = Math.max(0, railBounds.left, Math.floor(card.left) - 3);
      const right = Math.min(width, railBounds.right, Math.ceil(card.right) + 3);
      const top = Math.max(0, railBounds.top, Math.floor(card.top) - 3);
      const bottom = Math.min(height, railBounds.bottom, Math.ceil(card.bottom) + 3);
      const gap = 8;
      const above = top - 2 * gap;
      const below = height - bottom - 2 * gap;
      const openAbove = panel.scrollHeight <= above || above >= below;
      panel.style.maxHeight = Math.max(0, openAbove ? above : below) + "px";
      const panelLeft = Math.max(gap, Math.min(width - panel.offsetWidth - gap, (left + right - panel.offsetWidth) / 2));
      panel.style.left = panelLeft + "px";
      panel.style.top = (openAbove ? top - panel.offsetHeight - gap : bottom + gap) + "px";
      panel.style.transformOrigin = Math.max(gap, Math.min(panel.offsetWidth - gap, (left + right) / 2 - panelLeft))
        + (openAbove ? "px bottom" : "px top");
      backdrop.style.maskPosition = `0 0, ${left}px ${top}px`;
      backdrop.style.maskSize = `100% 100%, ${Math.max(0, right - left)}px ${Math.max(0, bottom - top)}px`;
    };
    place();
    (panel.querySelector("button:not(:disabled)") ?? panel).focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    observer.observe(rail);
    observer.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [handCard]);

  function chooseCardAction(action, card) {
    if (action.intent) return send(action.intent);
    if (computer && !active && action.target === "give") onComputerHold(true);
    focusTarget.current = action.target === "water" ? '[data-water-target="true"]:enabled' : '[data-target="true"] .seat-button';
    updateDraft({ mode: action.target, targetCard: card });
    closeCard();
  }

  function cancelTarget() {
    if (computer && !active && mode === "give") onComputerHold(false);
    updateDraft({ mode: "", targetCard: null });
  }

  function isTarget(entry) {
    if (busy || entry.removed) return false;
    if (mode === "give") return canTrade && ownCards.includes(targetCard) && canReceive(entry);
    if (!active) return false;
    if (mode === "medical") return actionPhase && ownCards.includes(targetCard) && canHeal(entry);
    if (entry.id === self?.id) return false;
    if (mode === "move") return true;
    if (mode === "mug") return entry.handCount > 0;
    return mode === "throw" && rescuePhase && ownCards.includes(targetCard) && canRescue(entry);
  }

  function pickSeat(entry) {
    if (!isTarget(entry)) return onInspect(entry.id);
    if (mode === "move" || mode === "mug") send({ type: mode, target: entry.id });
    if (mode === "give" || mode === "medical") send({ type: mode, target: entry.id, card: targetCard });
    if (mode === "throw") send({ type: "rescue", to: entry.id });
  }

  return <main className="table" ref={boardRef} onKeyDown={event => {
    if (!event.defaultPrevented && event.key === "Escape" && targetCard) cancelTarget();
  }}>
    <header className="table-overview">
      {computer && <div className="turn-feedback">
        <span className="feedback-text" role="status">{feedback?.text ?? "暂无行动记录"}</span>
        <button type="button" className="feedback-link" disabled={!feedback} aria-haspopup="dialog" onClick={onHistory}>
          查看记录 <span aria-hidden="true">›</span>
        </button>
      </div>}
      <div className="meters" role="group" aria-label="船况">
        <div className="meter"><Icon name="bird" /><span>海鸥</span><b>{game.birds}/4</b></div>
        <div className="meter" data-supply-source><Icon name="supplies" /><span>物资牌</span><b>{game.supplyCount}</b></div>
        <div className="meter"><Icon name="compass" /><span>航海牌</span><b>{game.navCount}</b></div>
      </div>
    </header>
    <CrewBoard game={game} players={players} feedback={feedback} isTarget={isTarget} pickSeat={pickSeat}
      inspectCard={inspectCard} inspectedId={openSupplyId} cardDisabled={cardDisabled}
      taking={mode === "mug"} takeCard={(target, card) => send({ type: "mug", target, card })} />
    <section className="turn-panel panel" aria-label="当前行动">
      <header className="turn-panel-header">
        <h2 className="turn-heading" data-active={active}>
          第 {game.day} 天{dealing ? " · 分配物资" : active ? " · 轮到你" : ""}
        </h2>
      </header>
      <div className="turn-scroll" ref={turnRef} key={`${game.day}-${game.phase}-${active}-${game.fight?.stage}`} tabIndex={0}>
        {error && <p className="error table-error" role="alert">{error}</p>}
        {trading && <p className="table-hint">{game.tradeOpen ? "选择要亮出或转交的物资。" : "选择要亮出的物资。"}</p>}
        {!active && !trading && game.phase !== "ended" &&
          <p className="table-hint" role="status">{computer
            ? `${players[publicActor?.player] ?? "电脑玩家"} 正在行动…`
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
          <div className="navigation-choices">
            {game.rowChoices.map((id, index) =>
              <button type="button" key={id} className="navigation-choice" disabled={busy} onClick={() => send({ type: "play", card: id })}>
                <span className="navigation-label"><Icon name="compass" />航海牌 {index + 1}</span>
                <NavigationFace card={navigationById[id]} characters={game.characters} />
              </button>)}
          </div>
        </section>}
        {active && game.phase === "action" && <section className="card-tray" aria-label="行动选项">
          <div className="actions" aria-label="行动">
            <Choice icon="oar" aria-haspopup="dialog" disabled={busy} onClick={() => send({ type: "row" })}>划船</Choice>
            <Choice icon="swap" disabled={busy} aria-pressed={mode === "move"}
              onClick={() => updateDraft({ mode: "move", targetCard: null })}>换座</Choice>
            <Choice icon="weapon" disabled={busy} aria-pressed={mode === "mug"}
              onClick={() => updateDraft({ mode: "mug", targetCard: null })}>抢夺</Choice>
            <Choice icon="wait" disabled={busy} onClick={() => send({ type: "nothing" })}>不动</Choice>
          </div>
        </section>}
        {demand && !trading && <section className="panel">
          <h2>{respondToMug ? `${requester}要抢你的物资` : mug ? "抢夺请求" : "换座请求"}</h2>
          <p className="hint">{respondToMug
            ? requestedCard ? `答应后，他会拿走你亮出的${requestedCard.name}。` : "答应后，他会随机拿走你的一张暗牌。"
            : mug ? `${requester}要抢${recipient}${requestedCard ? `亮出的${requestedCard.name}` : "的一张暗牌"}，等待${recipient}回应。` : `${requester} → ${recipient}`}</p>
          {active && <div className="paired-actions">
            <Raised secondary disabled={busy} onClick={() => send({ type: "answer", accept: true })}>
              {mug ? "让他拿走" : "答应"}
            </Raised>
            <Raised disabled={busy} onClick={() => send({ type: "answer", accept: false })}>
              {mug ? "拒绝并开战" : "开战"}
            </Raised>
          </div>}
        </section>}
        {game.phase === "fight" && <section className="panel">
          <h2>{game.fight.stage === "join" ? "选择阵营" : "亮出武器"}</h2>
          <div className="fight-sides">
            <FightSide label="进攻方" members={game.fight.attackers} flareBy={game.fight.flareBy} />
            <FightSide label="防守方" members={game.fight.defenders} flareBy={game.fight.flareBy} />
          </div>
          {active && (game.fight.stage === "join" ? <div className="actions fight-actions">
            <Choice data-fight-side="attack" disabled={busy} onClick={() => send({ type: "join", side: "attack" })}>帮进攻</Choice>
            <Choice disabled={busy} onClick={() => send({ type: "join", side: "out" })}>暂不参战</Choice>
            <Choice data-fight-side="defend" disabled={busy} onClick={() => send({ type: "join", side: "defend" })}>帮防守</Choice>
          </div> : <>
            {!!weapons.length && <div className="hand" aria-label="可亮出的武器">
              {weapons.map(id => <CardFace key={id} id={id} disabled={busy}
                detailsOpen={!!handCard?.closest(".turn-scroll") && inspectedCard.id === id}
                onClick={event => inspectCard(id, event.currentTarget)} />)}
            </div>}
            <Choice disabled={busy} onClick={() => send({ type: "arm", card: false })}>暂不出牌</Choice>
          </>)}
        </section>}
        {active && game.phase === "rescue" && <section className="panel">
          <h2>落水</h2>
          <p className="hint">{game.falling.map(personName).join("、")}</p>
          <p className="hint">点救生圈或鱼饵，在详情里使用。</p>
          <Choice disabled={busy} onClick={() => send({ type: "rescue" })}>跳过</Choice>
        </section>}
        {usingWater && <WaterPanel game={game} waterCard={mode === "water" && targetCard} drinks={drinks}
          setDrinks={next => updateDraft({ drinks: next })}
          addDrink={id => updateDraft({ drinks: [...drinks, { card: targetCard, for: id }], mode: "", targetCard: null })}
          busy={busy} send={send} />}
        {mode && mode !== "water" && <p className="hint" role="status">{{
          give: "选择收牌的船员。",
          medical: "选择要治疗的船员。",
          throw: "选择要抛救生圈的船员。",
          mug: "点船员摸暗牌，或点船员旁的亮牌指定抢夺。",
          move: "请选择一个座位。",
        }[mode]}</p>}
        {targetCard && <Raised secondary disabled={busy} onClick={cancelTarget}>取消操作</Raised>}
        {game.phase === "ended" && !!game.scores?.length && <Settlement key={game.step} game={game} players={players}
          busy={busy} error={error} overlayOpen={overlayOpen} onAction={onAction} />}
        {nav && <section className="card-tray navigation-result">
          <h2>刚才的航海</h2>
          <NavigationFace card={nav} characters={game.characters} />
        </section>}
        {(onChooseTrader || trading) && <div className="table-footer">
          {onChooseTrader && <Raised secondary disabled={busy} onClick={onChooseTrader}>{game.tradeOpen ? "传屏交易" : "传屏亮牌"}</Raised>}
          {trading && <Raised secondary onClick={onEndTrade}>返回当前回合</Raised>}
        </div>}
      </div>
    </section>
    {self && <section className="player-tray" aria-labelledby="hand-heading">
      <header className="player-tray-header">
        <h2 id="hand-heading">{trading ? (game.tradeOpen ? "交易" : "亮牌") : "你的手牌"}</h2>
        <Relationships person={self} />
      </header>
      <div className="card-rail" role="group" aria-label="你的物资" tabIndex={0}>
        {!!self.hand.length ? <div className="hand" aria-label="手牌">
          {self.hand.map(id => <CardFace key={id} id={id}
            detailsOpen={!!handCard && inspectedCard.id === id && !!handCard.closest(".card-rail")} disabled={cardDisabled(id)} onClick={event => inspectCard(id, event.currentTarget)} />)}
        </div> : <p className="table-hint">手里没有牌。</p>}
      </div>
    </section>}
    <div id="hand-card-details" ref={handPopoverRef} popover="manual" className="hand-card-popover"
      data-closing={!handCard} onClick={event => {
        if (handCard && event.target === event.currentTarget) closeCard();
      }} onKeyDown={event => {
        if (!handCard || event.key !== "Escape") return;
        event.preventDefault();
        closeCard();
      }} onBlur={event => {
        if (handCard && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          closeCard();
        }
    }}>
      <div ref={handBackdropRef} className="hand-card-backdrop" aria-hidden="true" />
      {detail && <section ref={handPanelRef} className="hand-card-panel" aria-labelledby="hand-card-title" tabIndex={-1}>
        <header className="hand-card-heading">
          <Icon name={iconFor(detail.card.type)} />
          <strong id="hand-card-title">{detail.card.name}</strong>
        </header>
        <p className="hand-card-effect">{provisionEffect(detail.card)}</p>
        {!!detail.actions.length && <div className={detail.actions.length > 1 ? "paired-actions" : undefined}>
          {detail.actions.map(action => <Raised key={action.label} secondary={detail.actions.length > 1}
            disabled={detail.busy} onClick={() => chooseCardAction(action, detail.card.id)}>{action.label}</Raised>)}
        </div>}
      </section>}
    </div>
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

function CharacterDialog({ entry, player, open, onClose }) {
  const character = characterById[entry.id];
  const status = crewStatus(entry);
  const ability = characterAbility(character);
  return <GameDialog title={character.name} className="character-dialog" open={open} onClose={onClose}>
    <div className="character-overview">
      <CrewPortrait id={entry.id} />
      <div>
        <p className="character-player">{player}{status && ` · ${status}`}</p>
        <dl className="character-stats">
          <div><dt>体型</dt><dd>{entry.size}</dd></div>
          <div><dt>生存分</dt><dd>{entry.survival}</dd></div>
          <div><dt>伤势</dt><dd>{entry.wounds}/{entry.size}</dd></div>
          <div><dt>暗牌</dt><dd>{entry.handCount}</dd></div>
        </dl>
      </div>
    </div>
    {ability && <p>{ability}</p>}
    {!!entry.shown.length && <section className="character-supplies">
      <h3>亮出的物资</h3>
      <PublicSupplies entry={entry} />
    </section>}
  </GameDialog>;
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
  const [inspectedId, setInspectedId] = useState(null);
  const [savedRow, setSavedRow] = useState(null);
  const inspected = game?.characters.find(entry => entry.id === inspectedId);
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
  const inspect = id => {
    setInspectedId(id);
    showDialog("character");
  };
  const localMatch = !room && !!game;
  const confirmExit = dialog === "exit";
  const traders = localMatch && !computer && game.phase !== "ended" && !trading
    ? game.players.filter(player => game.characters.some(entry => entry.player === player.id
      && entry.conscious && (entry.handCount || (game.tradeOpen && entry.shown.length))))
    : [];
  let scene;
  if (connecting || (room && !game)) {
    scene = <Notice icon="bird" title={connecting ? "正在连接 Playweft" : waiting ? "等待房间开局" : "正在装载救生艇"} />;
  } else if (localMatch && handoff) {
    const player = game.players.find(item => item.id === game.viewerId);
    scene = <Notice icon="lock" title={`交给 ${player?.name ?? "下一位"}`}>
      <p className="hint">{trading ? "请由这位玩家接过设备后继续。" : `第 ${game.day} 天。屏幕上会看到你的爱、恨和手牌。`}</p>
      <Raised onClick={onReady} icon="forward">我准备好了</Raised>
      {trading && <Raised secondary onClick={onEndTrade}>返回当前回合</Raised>}
    </Notice>;
  } else if (game) scene = <Table key={`${game.viewerId}-${trading}`}
    game={game} computer={computer} feedback={computer ? turnHistory[0] : null}
    busy={busy} trading={trading} error={error} overlayOpen={dialog !== null} rowDraft={rowDraft} onRowDraft={updateRowDraft}
    onAction={onAction} onEndTrade={onEndTrade}
    onHistory={() => showDialog("history")} onInspect={inspect}
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
    {inspected && <CharacterDialog entry={inspected} player={game.players.find(player => player.id === inspected.player)?.name}
      open={dialog === "character"} onClose={close} />}
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
    <GameDialog title={game?.tradeOpen ? "选择交易玩家" : "选择亮牌玩家"} open={dialog === "trade"} onClose={close}>
      <p className="hint">选择要操作的船员，再把设备交给对方。</p>
      <div className="trade-players">
        {traders.map(player => <Raised secondary key={player.id}
          onClick={() => { close(); onTrade(player.id); }}>{player.name}</Raised>)}
      </div>
    </GameDialog>
  </div>;
}

import { h } from "preact";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Heart, HeartCrack } from "lucide";
import LucideIcon from "../../shared/lucide-icon.jsx";
import { CrewBoard, CrewPortrait } from "./crew.jsx";
import { cardInfo, characterById } from "./data.js";
import { fightSize, fightWeapons } from "./engine.js";
import { listNames, personName, provisionName, t, tParts } from "./i18n.js";
import Icon from "./icon.jsx";
import { CardDetail, CardFace } from "./provision-card.jsx";
import { FIGHT_RESULT_MS } from "./turn-feedback.js";
import { GameDialog, Raised } from "./ui.jsx";

function CardFlight({ transfer, boardRef, duration, step, onFinish }) {
  const flight = useRef(null);
  useLayoutEffect(() => {
    const board = boardRef.current;
    const card = flight.current;
    if (!card?.animate || !board || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onFinish?.(step);
      return;
    }
    const seat = id => board.querySelector(`[data-seat-id="${id}"] .seat-portrait`);
    const source = transfer.from ? seat(transfer.from) : board.querySelector("[data-supply-source]");
    const target = seat(transfer.to);
    if (!source || !target) {
      onFinish?.(step);
      return;
    }

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
    ], { duration, easing: "ease-out" });
    animation.onfinish = () => {
      card.hidden = true;
      onFinish?.(step);
    };
    return () => { animation.cancel(); card.hidden = true; };
  }, [boardRef, duration, transfer, step, onFinish]);

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
  const loveName = lovesSelf ? t("relationship.self") : personName(person.love);
  const hateName = hatesSelf ? t("relationship.self") : personName(person.hate);

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
      aria-label={t("relationship.label", { love: loveName, hate: hateName })} onClick={toggleTooltip}>
      <span><LucideIcon icon={Heart} className="relation-love" />{loveName}</span>
      <span><LucideIcon icon={HeartCrack} className="relation-hate" />{hateName}</span>
    </button>
    <div id="relationship-details" className="relationship-tooltip" popover="auto" role="tooltip" ref={tooltipRef}>
      <h2>{t("relationship.title")}</h2>
      {loved && <div>
        <strong>{t("relationship.love", { name: loveName })}</strong>
        {lovesSelf ? <p>
          {tParts("relationship.selfSurvival", { points: <b>{t("score.points", { value: survival })}</b> })}
          {hatesSelf ? t("relationship.countOnce", { value: survival }) : tParts("relationship.countTwice", {
            points: <b>{t("score.points", { value: survival })}</b>,
            total: <b>{t("score.points", { value: survival * 2 })}</b>,
          })}
        </p> : <p>{tParts("relationship.lovedLives", {
          name: loveName, points: <b>{t("score.points", { value: loved.survival })}</b>,
        })}</p>}
      </div>}
      {hated && <div>
        <strong>{t("relationship.hate", { name: hateName })}</strong>
        {hatesSelf ? <p>
          {!lovesSelf && tParts("relationship.noSelfSurvival", { points: <b>{t("score.points", { value: survival })}</b> })}
          {t(lovesSelf ? "relationship.selfHateExceptSelf" : "relationship.selfHateExceptLoved")}
        </p> : <p>{tParts("relationship.hatedDies", {
          name: hateName, points: <b>{t("score.points", { value: hated.size })}</b>,
        })}</p>}
      </div>}
    </div>
  </div>;
}

function Choice({ icon, children, ...props }) {
  return <Raised secondary className="choice" {...props}>
    {icon && <Icon name={icon} />}{children}
  </Raised>;
}

function FightSide({ label, members, fight, characters, joined, finalPower, won, losers }) {
  const crew = members.map(id => characters.find(entry => entry.id === id));
  const power = finalPower ?? crew.reduce((total, entry) => total + fightSize(entry, fight), 0);
  return <div className="fight-side" data-won={won || undefined}>
    <h3>{label} <strong aria-label={t("fight.power", { power })}>{power}</strong></h3>
    <ul aria-label={label}>
      {crew.map(({ id, alive }) => <li key={id} className="fight-member" data-joined={id === joined}>
        <CrewPortrait id={id} dead={!alive} />
        <strong>{personName(id)}</strong>
        {id === fight.flareBy && <small>{t("fight.flare")}</small>}
        {losers?.includes(id) && <small className="fight-injury">{t("fight.injury")}</small>}
      </li>)}
    </ul>
  </div>;
}

function WaterPanel({ game, waterCard, drinks, setDrinks, addDrink, busy, send }) {
  return <section className="panel" aria-label={t("action.water")}>
    <h2>{t("action.water")}</h2>
    <p className="hint">{waterCard ? t("water.pickCrew") : t("water.pickCard")}</p>
    <div className="actions">
      {game.thirst.filter(item => item.left > 0).map(({ id, left }) => {
        const remaining = left - drinks.filter(use => use.for === id).length;
        const own = game.characters.some(entry => entry.id === id && entry.player === game.viewerId);
        return <Choice key={id} data-water-target={!!waterCard && remaining > 0} disabled={busy || !waterCard || remaining <= 0}
          onClick={() => addDrink(id)}>
          <span>{personName(id)}{own ? t("water.self") : ""}<small>{t("water.remaining", { remaining })}</small></span>
        </Choice>;
      })}
    </div>
    {!!drinks.length && <ul className="water-draft" aria-label={t("water.draft")}>
      {drinks.map(use => <li key={use.card}>
        <span><Icon name="water" />{t("water.use", { name: personName(use.for) })}</span>
        <Choice disabled={busy} onClick={() => setDrinks(drinks.filter(item => item.card !== use.card))}>
          {t("water.undo")}
        </Choice>
      </li>)}
    </ul>}
    <div className="paired-actions">
      <Raised secondary disabled={busy} onClick={() => send({ type: "drink", uses: [] })}>{t("common.skip")}</Raised>
      <Raised disabled={busy || !drinks.length} onClick={() => send({ type: "drink", uses: drinks })}>{t("water.confirm")}</Raised>
    </div>
  </section>;
}

function Settlement({ game, players, busy, error, overlayOpen, onAction }) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  const scores = [...game.scores].sort((a, b) => b.total - a.total);
  return <>
    <Raised secondary className="open-settlement" onClick={() => setOpen(true)}>{t("score.view")}</Raised>
    <GameDialog title={t("score.title")} className="settlement-dialog" open={open && !overlayOpen} onClose={close}
      footer={<>
        {error && <p className="error settlement-error" role="alert">{error}</p>}
        <div className={game.canRematch ? "paired-actions" : "table-footer"}>
          <Raised secondary onClick={close}>{t("common.backToTable")}</Raised>
          {game.canRematch && <Raised disabled={busy} onClick={() => onAction({ type: "rematch" })}>{t("score.rematch")}</Raised>}
        </div>
      </>}>
      <ol className="settlement-scores" aria-label={t("score.list")} tabIndex={0}>
        {scores.map(score => <li key={score.player} className={`score${score.total === scores[0].total ? " is-leader" : ""}`}>
          <div className="score-summary">
            <strong>{players[score.player]} · {personName(game.characters.find(entry => entry.player === score.player)?.id)}</strong>
            <b>{t("score.points", { value: score.total })}</b>
          </div>
          <small>{t("score.breakdown", score)}</small>
        </li>)}
      </ol>
    </GameDialog>
  </>;
}

const EMPTY_DRAFT = { targetCard: null, mode: "", drinks: [] };

export default function Table({ game, computer, feedback, fightResult, fightSkip, latestActivity, busy, trading, error, overlayOpen, navigationDraft, onNavigationDraft,
  onAction, onChooseTrader, onEndTrade, onComputerHold, onHistory, onInspect }) {
  const boardRef = useRef(null);
  const turnRef = useRef(null);
  const focusTarget = useRef(null);
  const [inspectedCard, setInspectedCard] = useState(null);
  const [draft, setDraft] = useState(null);
  const [finishedMugStep, setFinishedMugStep] = useState(null);
  const { targetCard, mode, drinks } = draft?.step === game.step ? draft : EMPTY_DRAFT;
  const updateDraft = changes => setDraft(previous => ({
    ...(previous?.step === game.step ? previous : EMPTY_DRAFT), ...changes, step: game.step,
  }));
  const self = game.characters.find(entry => entry.player === game.viewerId);
  const players = Object.fromEntries(game.players.map(player => [player.id, player.name]));
  const canAct = game.canAct && !trading;
  const active = canAct && !fightResult && !fightSkip;
  const fight = fightResult ?? game.fight;
  let fightTitle = fight?.stage === "join" ? t("fight.chooseSide") : t("fight.chooseWeapons");
  if (fightResult) {
    fightTitle = fightResult.attackersWin ? t("fight.attackWin") : t("fight.defendWin");
    if (fightResult.attack === fightResult.defense) fightTitle = t("fight.tie");
  }
  const dealing = active && game.phase === "deal";
  const demand = !fightResult && game.phase === "answer" ? game.demand : null;
  const mug = demand?.kind === "mug";
  const cardTransfer = !fightResult && !fightSkip ? feedback?.transfer : null;
  const mugInFlight = cardTransfer && feedback.mug && finishedMugStep !== feedback.step;
  const highlightedMug = computer ? (mug ? demand : mugInFlight ? feedback.mug : null) : null;
  const thinking = computer && !active && !fightResult && !fightSkip && !overlayOpen && mode !== "give" && game.phase !== "ended" && !!game.queue.length;
  const requester = personName(demand?.from);
  const recipient = personName(demand?.to);
  const requestedCard = mug ? cardInfo(demand.card) : null;
  const respondToMug = mug && demand.to === self?.id;
  const canTrade = game.canTrade && !!self;
  const canReveal = self?.conscious && game.phase !== "ended";
  const usingWater = active && game.phase === "thirst";
  const ownCards = self ? [...(self.hand || []), ...self.shown] : [];
  const weapons = fightWeapons(self);
  const cardDisabled = id => busy || drinks.some(use => use.card === id);
  const inspectCard = (id, element) => setInspectedCard({ id, element });
  const closeCard = useCallback(() => setInspectedCard(null), []);
  const takeFocusTarget = useCallback(() => {
    const selector = focusTarget.current;
    focusTarget.current = null;
    return selector ? boardRef.current?.querySelector(selector) : null;
  }, []);
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
  const anchor = inspectedCard?.element;
  const previewingOffer = dealing && !busy && anchor?.closest(".provision-offer") && game.offer.includes(inspectedCard.id);
  const handDetail = previewingOffer || ownCards.includes(inspectedCard?.id) ? cardInfo(inspectedCard.id) : null;
  const handCard = !overlayOpen && !fightResult && !fightSkip && handDetail && (previewingOffer || arming || !anchor.closest(".turn-scroll")) ? anchor : null;
  const openSupplyId = handCard?.closest(".seat-supplies") ? inspectedCard.id : undefined;
  let cardDetail = null;
  if (handCard) {
    const { id, type } = handDetail;
    const inHand = (self.hand || []).includes(id);
    const canUseWeapon = arming && weapons.includes(id);
    const actions = previewingOffer ? [] : [
      canReveal && inHand && (!canUseWeapon || type === "flare") && { label: t("action.reveal"), intent: { type: "reveal", card: id } },
      canTrade && game.characters.some(canReceive) && { label: t("action.give"), target: "give" },
      actionPhase && type === "medical" && game.characters.some(canHeal) && { label: t("action.heal"), target: "medical" },
      usingWater && type === "water" && needsWater && { label: t("action.water"), target: "water" },
      actionPhase && type === "parasol" && !self.parasol && { label: t("action.parasol"), intent: { type: "parasol" } },
      actionPhase && type === "flare" && { label: t("action.flare"), intent: { type: "flare" } },
      rescuePhase && type === "preserver" && game.characters.some(canRescue) && { label: t("action.preserver"), target: "throw" },
      rescuePhase && type === "chum" && inHand && game.falling.length > 0 && { label: t("action.chum"), intent: { type: "rescue", chum: true } },
      canUseWeapon && { label: t("action.arm"), intent: { type: "arm", card: id } },
    ].filter(Boolean);
    cardDetail = { card: handDetail, actions, busy: cardDisabled(id) };
  }

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
        <span className="feedback-text" role="status">{mug ? t("feedback.mugRequest", { from: requester, to: recipient }) : latestActivity?.text}</span>
        <button type="button" className="feedback-link" disabled={!latestActivity} aria-haspopup="dialog" onClick={onHistory}>
          {t("history.view")} <span aria-hidden="true">›</span>
        </button>
      </div>}
      <div className="meters" role="group" aria-label={t("table.status")}>
        <div className="meter"><Icon name="bird" /><span>{t("table.birds")}</span><b>{game.birds}/4</b></div>
        <div className="meter" data-supply-source><Icon name="crate" /><span>{t("table.provisions")}</span><b>{game.supplyCount}</b></div>
        <div className="meter"><Icon name="navigation" /><span>{t("table.navigation")}</span><b>{game.navCount}</b></div>
      </div>
    </header>
    <CrewBoard game={game} players={players} feedback={fightResult || fightSkip ? null : feedback}
      thinking={thinking} fightSkip={fightSkip} mug={highlightedMug} isTarget={isTarget} pickSeat={pickSeat}
      inspectCard={inspectCard} inspectedId={openSupplyId} cardDisabled={cardDisabled}
      taking={mode === "mug"} takeCard={(target, card) => send({ type: "mug", target, card })} />
    <section className="turn-panel" aria-label={t("table.currentAction")}>
      <header className="turn-panel-header">
        <h2 className="turn-heading" data-active={active}>
          {t(dealing ? "table.dealDay" : active ? "table.activeDay" : "table.day", { day: game.day })}
        </h2>
      </header>
      <div className="turn-scroll" ref={turnRef} key={`${game.day}-${game.phase}-${canAct}-${game.fight?.stage}`} tabIndex={0}>
        {error && <p className="error table-error" role="alert">{error}</p>}
        {trading && <p className="table-hint">{game.tradeOpen ? t("trade.chooseToGive") : t("trade.chooseToReveal")}</p>}
        {!active && !trading && !fight && game.phase !== "ended" && (!computer || !game.queue.length) &&
          <p className="table-hint" role="status">{t("table.waiting")}</p>}
        {dealing && <section className="card-tray provision-deal">
          <p className="table-hint">{t("table.offerHint")}</p>
          <div className="hand provision-offer" aria-label={t("table.chooseProvision")} style={{ "--card-columns": Math.min(4, game.offer.length) }}>
            {game.offer.map(id => <CardFace key={id} id={id} disabled={busy}
              detailsOpen={!!handCard && !!previewingOffer && inspectedCard.id === id}
              onPreview={element => inspectCard(id, element)} onClick={() => send({ type: "take", card: id })} />)}
          </div>
        </section>}
        {active && navigationDraft && <Raised secondary aria-haspopup="dialog"
          onClick={() => onNavigationDraft(() => ({ dismissed: false }))}>{game.phase === "row" ? t("nav.resumeRow") : t("nav.resumeNavigation")}</Raised>}
        {active && game.phase === "action" && <section className="card-tray" aria-label={t("action.options")}>
          <div className="actions" aria-label={t("action.group")}>
            <Choice icon="row" aria-haspopup="dialog" disabled={busy} onClick={() => send({ type: "row" })}>{t("action.row")}</Choice>
            <Choice icon="swap" disabled={busy} aria-pressed={mode === "move"}
              onClick={() => updateDraft({ mode: "move", targetCard: null })}>{t("action.move")}</Choice>
            <Choice icon="knife" disabled={busy} aria-pressed={mode === "mug"}
              onClick={() => updateDraft({ mode: "mug", targetCard: null })}>{t("action.mug")}</Choice>
            <Choice icon="wait" disabled={busy} onClick={() => send({ type: "nothing" })}>{t("action.pass")}</Choice>
          </div>
        </section>}
        {demand && !trading && (active || !computer || !mug) && <section className="panel">
          <h2>{respondToMug ? t("demand.mugYou", { requester }) : mug ? t("demand.mug") : t("demand.move")}</h2>
          <p className="hint">{respondToMug
            ? requestedCard ? t("demand.allowShown", { card: provisionName(requestedCard.type) }) : t("demand.allowHidden")
            : mug ? t(requestedCard ? "demand.watchingShown" : "demand.watchingHidden", { requester, recipient, card: requestedCard && provisionName(requestedCard.type) }) : `${requester} → ${recipient}`}</p>
          {active && <div className="paired-actions">
            <Raised secondary disabled={busy} onClick={() => send({ type: "answer", accept: true })}>
              {mug ? t("demand.letTake") : t("demand.agree")}
            </Raised>
            <Raised disabled={busy} onClick={() => send({ type: "answer", accept: false })}>
              {mug ? t("demand.refuse") : t("demand.fight")}
            </Raised>
          </div>}
        </section>}
        {fight && <section className="panel fight-panel" data-resolved={!!fightResult}
          style={fightResult ? { animationDuration: `${FIGHT_RESULT_MS}ms` } : undefined}>
          <h2 aria-live="polite">{fightTitle}</h2>
          <div className="fight-sides">
            <FightSide label={t("fight.attackers")} members={fight.attackers} fight={fight}
              characters={game.characters} joined={feedback?.joined} finalPower={fightResult?.attack}
              won={fightResult?.attackersWin} losers={fightResult?.losers} />
            <FightSide label={t("fight.defenders")} members={fight.defenders} fight={fight}
              characters={game.characters} joined={feedback?.joined} finalPower={fightResult?.defense}
              won={fightResult && !fightResult.attackersWin} losers={fightResult?.losers} />
          </div>
          {active && (game.fight.stage === "join" ? <div className="actions fight-actions">
            <Choice data-fight-side="attack" disabled={busy} onClick={() => send({ type: "join", side: "attack" })}>{t("fight.joinAttack")}</Choice>
            <Choice disabled={busy} onClick={() => send({ type: "join", side: "out" })}>{t("fight.stayOut")}</Choice>
            <Choice data-fight-side="defend" disabled={busy} onClick={() => send({ type: "join", side: "defend" })}>{t("fight.joinDefend")}</Choice>
          </div> : <>
            {!!weapons.length && <div className="hand" aria-label={t("fight.weapons")}>
              {weapons.map(id => <CardFace key={id} id={id} disabled={busy}
                detailsOpen={!!handCard?.closest(".turn-scroll") && inspectedCard.id === id}
                onClick={event => inspectCard(id, event.currentTarget)} />)}
            </div>}
            <Choice disabled={busy} onClick={() => send({ type: "arm", card: false })}>{t("fight.pass")}</Choice>
          </>)}
        </section>}
        {active && game.phase === "rescue" && <section className="panel">
          <h2>{t("nav.overboard")}</h2>
          <p className="hint">{listNames(game.falling.map(personName))}</p>
          <p className="hint">{t("rescue.hint")}</p>
          <Choice disabled={busy} onClick={() => send({ type: "rescue" })}>{t("common.skip")}</Choice>
        </section>}
        {usingWater && <WaterPanel game={game} waterCard={mode === "water" && targetCard} drinks={drinks}
          setDrinks={next => updateDraft({ drinks: next })}
          addDrink={id => updateDraft({ drinks: [...drinks, { card: targetCard, for: id }], mode: "", targetCard: null })}
          busy={busy} send={send} />}
        {mode && mode !== "water" && <p className="hint" role="status">{{
          give: t("target.give"),
          medical: t("target.medical"),
          throw: t("target.throw"),
          mug: t("target.mug"),
          move: t("target.move"),
        }[mode]}</p>}
        {targetCard && <Raised secondary disabled={busy} onClick={cancelTarget}>{t("target.cancel")}</Raised>}
        {game.phase === "ended" && !!game.scores?.length && <Settlement key={game.step} game={game} players={players}
          busy={busy} error={error} overlayOpen={overlayOpen} onAction={onAction} />}
        {(onChooseTrader || trading) && <div className="table-footer">
          {onChooseTrader && <Raised secondary disabled={busy} onClick={onChooseTrader}>{game.tradeOpen ? t("trade.passToTrade") : t("trade.passToReveal")}</Raised>}
          {trading && <Raised secondary onClick={onEndTrade}>{t("handoff.back")}</Raised>}
        </div>}
      </div>
    </section>
    {self && <section className="player-tray" aria-labelledby="hand-heading">
      <header className="player-tray-header">
        <h2 id="hand-heading">{trading ? (game.tradeOpen ? t("trade.trade") : t("trade.reveal")) : t("hand.title")}</h2>
        <Relationships person={self} />
      </header>
      <div className="card-rail" role="group" aria-label={t("hand.provisions")} tabIndex={0}>
        {!!self.hand.length ? <div className="hand" aria-label={t("hand.cards")}>
          {self.hand.map(id => {
            const preview = element => inspectCard(id, element);
            return <CardFace key={id} id={id} disabled={cardDisabled(id)}
              detailsOpen={!!handCard && inspectedCard.id === id && !!handCard.closest(".card-rail")}
              onPreview={preview} onClick={event => preview(event.currentTarget)} />;
          })}
        </div> : <p className="table-hint">{t("hand.empty")}</p>}
      </div>
    </section>}
    <CardDetail anchor={handCard} content={cardDetail} onClose={closeCard}
      onChooseAction={chooseCardAction} takeFocusTarget={takeFocusTarget} />
    {cardTransfer && <CardFlight key={feedback.step} transfer={cardTransfer} boardRef={boardRef}
      duration={feedback.mug ? 480 : 270} step={feedback.step} onFinish={feedback.mug ? setFinishedMugStep : undefined} />}
  </main>;
}

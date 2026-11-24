import { h } from "preact";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";
import { CrewPortrait } from "./crew.jsx";
import { navigationById } from "./data.js";
import { characterName, listNames, t } from "./i18n.js";
import Icon from "./icon.jsx";
import { GameDialog, Raised } from "./ui.jsx";

function NavigationTargets({ spec, characters }) {
  if (spec === "all") return t("nav.everyone");
  if (spec === "none") return t("nav.nobody");
  const excluded = !Array.isArray(spec);
  const targets = (excluded ? spec.except : spec).filter(id => characters.some(entry => entry.id === id));
  if (!targets.length) return t(excluded ? "nav.everyone" : "nav.nobody");

  const names = listNames(targets.map(id => characterName(id)));
  const description = excluded ? t("nav.except", { names }) : names;
  return <span className="navigation-targets" role="img" aria-label={description} title={description}>
    {excluded && <span aria-hidden="true">{t("nav.exceptShort")}</span>}
    <span className="navigation-portraits">{targets.map(id => <CrewPortrait key={id} id={id} />)}</span>
  </span>;
}

function NavigationFace({ card, characters }) {
  return <span className="navigation-card">
    <span className="navigation-gulls">
      {card.bird !== 0 && <span className="navigation-gull" data-crossed-out={card.bird < 0 || undefined}
        role="img" aria-label={t("feedback.birds", { change: card.bird < 0 ? "−1" : "+1" })}>
        <Icon name="bird" />
      </span>}
    </span>
    <span className="navigation-detail">
      <span>{t("nav.overboard")}</span>
      <strong><NavigationTargets spec={card.overboard} characters={characters} /></strong>
    </span>
    <span className="navigation-detail">
      <span>{t("nav.thirst")}</span>
      <strong><NavigationTargets spec={card.thirst} characters={characters} /></strong>
    </span>
    {[["nav.rowThirst", card.row], ["nav.fightThirst", card.fight]].map(([label, enabled]) =>
      <span className="navigation-detail" key={label}>
        <span>{t(label)}</span>
        <strong className="navigation-mark" role="img" aria-label={t(enabled ? "common.yes" : "common.no")}>{enabled ? "✓" : "—"}</strong>
      </span>)}
  </span>;
}

export function NavigationCardPreview({ cardId, label, characters }) {
  const id = useId();
  const trigger = useRef(null);
  const popover = useRef(null);
  const timer = useRef(null);
  const hovered = useRef(false);
  const pointerType = useRef("");
  const tapped = useRef(false);
  const [open, setOpen] = useState(false);

  function place() {
    const panel = popover.current;
    const { left, right, top, bottom } = trigger.current.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.documentElement;
    const gutter = 8;
    const above = top >= panel.offsetHeight + gutter || top >= clientHeight - bottom;
    const x = (left + right - panel.offsetWidth) / 2;
    const y = above ? top - panel.offsetHeight : bottom;
    panel.style.left = Math.max(gutter, Math.min(x, clientWidth - panel.offsetWidth - gutter)) + "px";
    panel.style.top = Math.max(gutter, Math.min(y, clientHeight - panel.offsetHeight - gutter)) + "px";
  }

  useLayoutEffect(() => {
    if (!open) return;
    const closeOnScroll = event => {
      const panel = popover.current;
      if (event.target !== panel && panel.matches(":popover-open")) panel.hidePopover();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  useLayoutEffect(() => () => clearTimeout(timer.current), []);

  function show() {
    if (!popover.current.matches(":popover-open")) popover.current.showPopover({ source: trigger.current });
    place();
  }

  function hide() {
    if (popover.current.matches(":popover-open")) popover.current.hidePopover();
  }

  function schedule(change) {
    clearTimeout(timer.current);
    timer.current = setTimeout(change, 100);
  }

  const card = navigationById[cardId];
  if (!card) return label;
  return <span className="activity-navigation" onPointerEnter={event => {
    if (event.pointerType !== "mouse") return;
    hovered.current = true;
    schedule(show);
  }} onPointerLeave={event => {
    if (event.pointerType !== "mouse") return;
    hovered.current = false;
    if (!tapped.current && !trigger.current.matches(":focus-visible")) schedule(hide);
  }}>
    <button type="button" ref={trigger} popovertarget={id} aria-describedby={open ? id : undefined}
      onPointerDown={event => { pointerType.current = event.pointerType; }}
      onFocus={event => {
        if (event.currentTarget.matches(":focus-visible")) schedule(show);
      }} onBlur={() => {
        if (!hovered.current && !tapped.current) schedule(hide);
      }} onClick={event => {
        event.preventDefault();
        clearTimeout(timer.current);
        const touch = event.detail > 0 && (pointerType.current === "touch" || pointerType.current === "pen");
        if (touch && tapped.current) hide();
        else {
          tapped.current = touch;
          show();
        }
      }}><Icon name="navigation" />{label}</button>
    <span id={id} ref={popover} className="navigation-card-preview" popover="auto"
      role="tooltip" onBeforeToggle={event => {
        if (event.newState === "closed") {
          tapped.current = false;
          clearTimeout(timer.current);
        }
      }} onToggle={event => setOpen(event.currentTarget.matches(":popover-open"))}>
      <NavigationFace card={card} characters={characters} />
    </span>
  </span>;
}

export function NavigationDecision({ phase, cards, characters, draft, open, updateDraft, busy, error, onAction }) {
  const displayedPhase = useRef(phase);
  if (open) displayedPhase.current = phase;
  const rowing = displayedPhase.current === "row";
  const title = rowing ? t("action.row") : t("nav.choose");
  const close = () => updateDraft(() => ({ dismissed: true }));
  return <GameDialog title={title} closeLabel={t("common.backToTable")}
    className={rowing ? "navigation-drawer row-dialog" : "navigation-drawer"} open={open} onClose={close} error={error}
    footer={rowing && <Raised disabled={busy} onClick={() => onAction({ type: "sort", keep: cards.map(id => draft.kept.includes(id)) })}>{t("nav.confirmRow")}</Raised>}>
    {rowing && <p className="table-hint">{t("nav.keepCount", { count: cards.length })}</p>}
    <div className="navigation-choices" aria-label={rowing ? t("nav.drawn") : t("nav.pickOne")} role="group">
      {cards.map((id, index) => {
        const kept = draft.kept.includes(id);
        const select = () => {
          if (!rowing) return onAction({ type: "play", card: id });
          updateDraft(({ kept: previous }) => ({
            kept: previous.includes(id) ? previous.filter(card => card !== id) : [...previous, id],
          }));
        };
        return <button type="button" key={id} className="navigation-choice" disabled={busy} aria-pressed={rowing ? kept : undefined} onClick={select}>
          <span className="navigation-label"><Icon name="navigation" />{t("nav.numbered", { number: index + 1 })}</span>
          <NavigationFace card={navigationById[id]} characters={characters} />
          {rowing && <strong className="row-card-destination">{kept ? t("nav.keep") : t("nav.return")}</strong>}
        </button>;
      })}
    </div>
  </GameDialog>;
}

export function NavigationReveal({ reveal }) {
  const card = navigationById[reveal?.card];
  return <GameDialog title={t("nav.resolved")} className="navigation-reveal" open={!!card && reveal.open}>
    {card && <NavigationFace card={card} characters={reveal.characters} />}
  </GameDialog>;
}

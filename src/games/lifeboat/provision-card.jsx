import { h } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { cardInfo } from "./data.js";
import { characterName, provisionName, t } from "./i18n.js";
import Icon from "./icon.jsx";
import { Raised } from "./ui.jsx";

const provisionEffects = new Set(["water", "oar", "chum", "medical", "parasol", "preserver", "compass"]);

const doubleScoreOwners = { cash: "captain", painting: "stephen", jewels: "lauren" };

export function provisionEffect(card) {
  if (card.value) {
    return t("provisions.treasureEffect", { value: card.value, owner: characterName(doubleScoreOwners[card.type]) });
  }
  if (card.type === "flare") return t("provisions.flare.effect", { size: card.size });
  const weapon = card.size ? t("provisions.weaponEffect", { size: card.size }) : "";
  return weapon + (provisionEffects.has(card.type) ? t(`provisions.${card.type}.effect`) : "");
}

const CARD_PREVIEW_DELAY = 500;
const CARD_PREVIEW_SLOP = 10;

export function CardFace({ id, disabled, onClick, onPreview, detailsOpen, spent }) {
  const press = useRef(null);
  const stopPress = () => {
    clearTimeout(press.current?.timer);
    press.current = null;
  };
  useLayoutEffect(() => stopPress, [id, disabled, !!onPreview]);

  function startPress(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    stopPress();
    const { pointerId, clientX, clientY, currentTarget } = event;
    const hold = { pointerId, clientX, clientY, previewed: false };
    press.current = hold;
    hold.timer = setTimeout(() => {
      hold.previewed = true;
      // Keep the release on the card when the popover opens over it.
      currentTarget.setPointerCapture(pointerId);
      onPreview(currentTarget);
    }, CARD_PREVIEW_DELAY);
  }

  function movePress(event) {
    const hold = press.current;
    if (!hold || hold.previewed || hold.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - hold.clientX, event.clientY - hold.clientY) > CARD_PREVIEW_SLOP) stopPress();
  }

  function endPress(event) {
    if (press.current?.pointerId === event.pointerId && !press.current.previewed) stopPress();
  }

  function clickCard(event) {
    const previewed = press.current?.previewed;
    stopPress();
    if (!previewed || event.detail === 0) onClick(event);
  }

  function previewByKeyboard(event) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    stopPress();
    onPreview(event.currentTarget);
  }

  const card = cardInfo(id);
  if (!card) return null;
  const face = <>
    <Icon name={card.type} />
    <strong>{provisionName(card.type)}</strong>
    <small>{card.value ? t("score.points", { value: card.value }) : card.size ? t("provisions.weapon", { size: card.size }) : ""}</small>
  </>;
  return onClick
    ? <button type="button" className="card" data-spent={spent || undefined} aria-expanded={detailsOpen}
      aria-controls={detailsOpen !== undefined ? "hand-card-details" : undefined}
      aria-keyshortcuts={onPreview ? "Shift+F10" : undefined}
      onPointerDown={onPreview && startPress} onPointerMove={onPreview && movePress}
      onPointerLeave={onPreview && endPress} onPointerUp={onPreview && endPress}
      onPointerCancel={onPreview && endPress} onKeyDown={onPreview && previewByKeyboard}
      onContextMenu={onPreview && (event => event.preventDefault())}
      disabled={disabled} onClick={onPreview ? clickCard : onClick}>{face}</button>
    : <div className="card">{face}</div>;
}

export function CardDetail({ anchor, content, onClose, onChooseAction, takeFocusTarget }) {
  const handPopoverRef = useRef(null);
  const handMaskHoleRef = useRef(null);
  const handMaskClipRef = useRef(null);
  const pressedHandBackdrop = useRef(false);
  const handPanelRef = useRef(null);
  const handContent = useRef(null);
  const handTrigger = useRef(null);

  // Keep the previous contents visible during the exit animation.
  if (content) handContent.current = content;
  const detail = handContent.current;

  useLayoutEffect(() => {
    const popover = handPopoverRef.current;
    const panel = handPanelRef.current;
    if (!anchor) {
      onClose();
      if (!popover.matches(":popover-open")) return;
      let cancelled = false;
      const exit = panel?.getAnimations().find(animation => animation.animationName === "hand-card-exit");
      const finish = () => {
        if (cancelled) return;
        const restoreFocus = popover.contains(document.activeElement);
        popover.hidePopover();
        const target = takeFocusTarget();
        if (target) target.focus();
        else if (restoreFocus && handTrigger.current?.isConnected) handTrigger.current.focus({ preventScroll: true });
      };
      if (exit) exit.finished.then(finish, finish);
      else finish();
      return () => { cancelled = true; };
    }

    handTrigger.current = anchor;
    pressedHandBackdrop.current = false;
    popover.showPopover();
    const rail = anchor.closest(".card-rail, .seat-supplies, .provision-offer") ?? anchor.parentElement;
    const hole = handMaskHoleRef.current;
    const clip = handMaskClipRef.current;
    const radius = parseFloat(getComputedStyle(anchor).borderTopLeftRadius);
    const place = () => {
      const card = anchor.getBoundingClientRect();
      const railBounds = rail.getBoundingClientRect();
      const { clientWidth: width, clientHeight: height } = document.documentElement;
      const left = Math.max(0, railBounds.left, card.left);
      const right = Math.min(width, railBounds.right, card.right);
      const top = Math.max(0, railBounds.top, card.top);
      const bottom = Math.min(height, railBounds.bottom, card.bottom);
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
      hole.setAttribute("x", card.left);
      hole.setAttribute("y", card.top);
      hole.setAttribute("width", card.width);
      hole.setAttribute("height", card.height);
      hole.setAttribute("rx", radius);
      clip.setAttribute("x", left);
      clip.setAttribute("y", top);
      clip.setAttribute("width", Math.max(0, right - left));
      clip.setAttribute("height", Math.max(0, bottom - top));
    };
    place();
    (panel.querySelector("button:not(:disabled)") ?? panel).focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    observer.observe(rail);
    observer.observe(anchor);
    observer.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, onClose, takeFocusTarget]);

  return <div id="hand-card-details" ref={handPopoverRef} popover="manual" className="hand-card-popover"
    data-closing={!anchor} onPointerDown={event => {
      pressedHandBackdrop.current = event.target === event.currentTarget;
    }} onMouseDown={event => {
      if (event.target === event.currentTarget) event.preventDefault();
    }} onClick={event => {
      // A long press can release over the backdrop without starting there.
      if (anchor && pressedHandBackdrop.current && event.target === event.currentTarget) onClose();
      pressedHandBackdrop.current = false;
    }} onKeyDown={event => {
      if (!anchor || event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }} onBlur={event => {
      if (anchor && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
        onClose();
      }
    }}>
    <svg className="hand-card-backdrop" aria-hidden="true">
      <defs>
        <clipPath id="hand-card-mask-clip"><rect ref={handMaskClipRef} /></clipPath>
        <mask id="hand-card-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill="white" />
          <rect ref={handMaskHoleRef} fill="black" clip-path="url(#hand-card-mask-clip)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" mask="url(#hand-card-mask)" />
    </svg>
    {detail && <section ref={handPanelRef} className="hand-card-panel" aria-labelledby="hand-card-title" tabIndex={-1}>
      <header className="hand-card-heading">
        <Icon name={detail.card.type} />
        <strong id="hand-card-title">{provisionName(detail.card.type)}</strong>
      </header>
      <p className="provision-effect">{provisionEffect(detail.card)}</p>
      {!!detail.actions.length && <div className={detail.actions.length > 1 ? "paired-actions" : undefined}>
        {detail.actions.map(action => <Raised key={action.label} secondary={detail.actions.length > 1}
          disabled={detail.busy} onClick={() => onChooseAction(action, detail.card.id)}>{action.label}</Raised>)}
      </div>}
    </section>}
  </div>;
}

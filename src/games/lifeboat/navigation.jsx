import { h } from "preact";
import { useRef } from "preact/hooks";
import { navigationById } from "./data.js";
import { listNames, personName, t } from "./i18n.js";
import Icon from "./icon.jsx";
import { GameDialog, Raised } from "./ui.jsx";

function navigationTargets(spec, characters) {
  if (spec === "all") return t("nav.everyone");
  if (spec === "none") return t("nav.nobody");
  const names = (Array.isArray(spec) ? spec : spec.except)
    .filter(id => characters.some(entry => entry.id === id))
    .map(personName);
  if (Array.isArray(spec)) return listNames(names) || t("nav.nobody");
  return names.length ? t("nav.except", { names: listNames(names) }) : t("nav.everyone");
}

function NavigationFace({ card, characters }) {
  const details = [
    [t("nav.overboard"), navigationTargets(card.overboard, characters)],
    [t("nav.thirst"), navigationTargets(card.thirst, characters)],
    [t("nav.rowThirst"), card.row ? t("common.yes") : t("common.no")],
    [t("nav.fightThirst"), card.fight ? t("common.yes") : t("common.no")],
    [t("table.birds"), card.bird > 0 ? "+1" : card.bird < 0 ? "−1" : "0"],
  ];
  return <span className="navigation-card">
    {details.map(([label, value]) =>
      <span className="navigation-detail" key={label}><span>{label}</span><strong>{value}</strong></span>)}
  </span>;
}

export function NavigationDecision({ phase, cards, characters, draft, open, updateDraft, busy, error, onAction }) {
  const displayedPhase = useRef(phase);
  if (open) displayedPhase.current = phase;
  const rowing = displayedPhase.current === "row";
  const title = rowing ? t("action.row") : t("nav.choose");
  const close = () => updateDraft(() => ({ dismissed: true }));
  return <GameDialog title={title} closeLabel={t("common.backToTable")}
    className={rowing ? "navigation-drawer row-dialog" : "navigation-drawer navigation-dialog"} open={open} onClose={close}
    footer={rowing && <>
      {error && <p className="error table-error" role="alert">{error}</p>}
      <Raised disabled={busy} onClick={() => onAction({ type: "sort", keep: cards.map(id => draft.kept.includes(id)) })}>{t("nav.confirmRow")}</Raised>
    </>}>
    {rowing && <p className="table-hint">{t("nav.keepCount", { count: cards.length })}</p>}
    {!rowing && error && <p className="error table-error" role="alert">{error}</p>}
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

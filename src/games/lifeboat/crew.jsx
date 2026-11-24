import { h } from "preact";
import { X } from "lucide";
import Dialog from "../../shared/dialog.jsx";
import LucideIcon from "../../shared/lucide-icon.jsx";
import BoatHull from "./boat-hull.jsx";
import { CHARACTERS, cardInfo, characterById } from "./data.js";
import { characterAbility, characterName, personName, t, tParts } from "./i18n.js";
import Icon from "./icon.jsx";
import { CardFace, ProvisionIcon, provisionEffect, provisionLabel } from "./provision-card.jsx";

function crewStatus(entry) {
  if (entry.removed) return t("crew.lost");
  if (!entry.alive) return t("crew.dead");
  return entry.conscious ? "" : t("crew.unconscious");
}

export function CrewPortrait({ id, dead = false }) {
  const index = CHARACTERS.findIndex(person => person.id === id);
  return <span className="seat-portrait" data-dead={dead || undefined} aria-hidden="true"
    style={{ backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%` }} />;
}

function PublicSupplies({ entry, onInspect, canTake, inspectedId, disabled, takeCard, spentCard }) {
  if (!entry.shown.length) return null;
  const interactive = !!onInspect || canTake;
  return <div className="seat-supplies" role="group" aria-label={t("crew.shownBy", { name: personName(entry.id) })}
    tabIndex={entry.shown.length > 1 ? 0 : undefined}>
    {entry.shown.map(id => {
      const card = cardInfo(id);
      if (!card) return null;
      const label = `${provisionLabel(card.type, entry.parasol)}${card.value ? t("crew.lootValue", { value: card.value }) : ""}`;
      const face = <ProvisionIcon type={card.type} parasolOpen={entry.parasol} />;
      return interactive
        ? <button key={id} type="button" className="seat-supply" disabled={disabled(id)} data-spent={spentCard === id || undefined}
          aria-label={canTake ? t("crew.mugCard", { name: personName(entry.id), card: label }) : label} title={label}
          aria-expanded={onInspect ? inspectedId === id : undefined}
          aria-controls={onInspect ? "hand-card-details" : undefined}
          onClick={event => onInspect ? onInspect(id, event.currentTarget) : takeCard(entry.id, id)}>{face}</button>
        : <span key={id} className="seat-supply" data-spent={spentCard === id || undefined} role="img" aria-label={label} title={label}>{face}</span>;
    })}
  </div>;
}

export function CrewBoard({ game, players, feedback, treatment, thinking, fightSkip, mug, isTarget, pickSeat, inspectCard, inspectedId, cardDisabled, taking, takeCard }) {
  const rows = Math.ceil(game.characters.length / 2);
  return <div className="crew-board" data-rows={rows} style={{ "--seat-rows": rows }}>
    <BoatHull rows={rows} />
    <ol className="seats" aria-label={t("crew.seats")}>
      {game.characters.map(entry => {
        const own = entry.player === game.viewerId;
        const current = entry.id === game.queue[0];
        const target = isTarget(entry);
        const hurt = feedback?.injuries.includes(entry.id);
        const recovering = treatment?.recovering && entry.id === treatment.target;
        const winner = feedback?.winners.includes(entry.id);
        const mugRole = entry.id === mug?.from ? "from" : entry.id === mug?.to ? "to" : undefined;
        const name = personName(entry.id);
        const status = crewStatus(entry) || players[entry.player];
        return <li key={entry.id}>
          <div data-seat-id={entry.id} className={`seat${current ? " is-current" : ""}`}
            aria-current={current ? "step" : undefined} data-target={target} data-mug={mugRole}>
            {winner && <span className="fight-winner-highlight" key={feedback.step} aria-hidden="true" />}
            <span className="seat-avatar">
              <CrewPortrait id={entry.id} dead={!entry.alive} />
              {treatment?.from === entry.id && !treatment.card && <span className="medical-use-marker" aria-hidden="true">
                <Icon name="medical" />
              </span>}
              {entry.id === fightSkip && <span className="seat-thinking" data-skipped="true" role="status"
                aria-label={t("crew.skipsFight", { name })}>{t("common.skip")}</span>}
              {current && thinking && <span className="seat-thinking" role="status" aria-label={t("crew.thinking", { name })}>···</span>}
              <small className="seat-count" role="img" aria-label={t("crew.hiddenCount", { count: entry.handCount })}>
                <svg viewBox="0 0 18 16" aria-hidden="true">
                  <rect x="2.3" y="2.4" width="7.2" height="10.4" rx="1.1" transform="rotate(-15 5.9 7.6)" />
                  <rect x="8" y="3.6" width="7.2" height="10.4" rx="1.1" />
                </svg>
                {entry.handCount}
              </small>
            </span>
            <button type="button" className="seat-button" disabled={!!treatment} aria-label={target ? t("crew.select", { name, status }) : t("crew.inspect", { name })}
              aria-haspopup={target ? undefined : "dialog"} onClick={() => pickSeat(entry)} />
            <div className="seat-details">
              <strong className="seat-role" title={name}>{name}</strong>
              <div className="seat-player">
                {(!own || status !== t("common.you")) && <small className="seat-name" title={status}>{status}</small>}
                {own && <small className="seat-self">{t("common.you")}</small>}
              </div>
              <small className={`seat-wounds${hurt ? " wound-flash" : ""}`} data-recovering={recovering || undefined} key={hurt ? feedback.step : null}>
                {tParts("crew.woundCount", {
                  label: <span className="seat-wound-label">{t("crew.wounds")} </span>,
                  wounds: recovering ? treatment.wounds : entry.wounds,
                  size: entry.size,
                })}
              </small>
            </div>
          </div>
          <div className="seat-supply-slot">
            <PublicSupplies entry={entry} onInspect={own && inspectCard} inspectedId={inspectedId}
              canTake={taking && !own && !entry.removed} disabled={cardDisabled} takeCard={takeCard} spentCard={treatment?.card} />
          </div>
        </li>;
      })}
    </ol>
  </div>;
}

export function CharacterDialog({ entry, player, seatNumber, open, onClose }) {
  const character = characterById[entry.id];
  const name = characterName(character.id);
  const status = crewStatus(entry);
  const ability = characterAbility(character.id);
  const seat = !entry.removed && seatNumber > 0 ? t("crew.seatNumber", { number: seatNumber }) : "";
  const subtitle = [player, seat].filter(Boolean).join(" · ");
  return <Dialog className="sea-dialog character-dialog" open={open} onClose={onClose} aria-labelledby="character-dialog-title">
    <button type="button" className="dialog-close-button" aria-label={t("common.close", { title: name })} onClick={onClose}>
      <LucideIcon icon={X} />
    </button>
    <div className="dialog-inner">
      <div className="dialog-body">
        <div className="character-overview">
          <CrewPortrait id={entry.id} dead={!entry.alive} />
          <div>
            <h2 id="character-dialog-title">{name}</h2>
            {subtitle && <p className="character-player">{subtitle}</p>}
          </div>
        </div>
        <dl className="character-stats">
          <div><dt>{t("crew.size")}</dt><dd>{entry.size}</dd></div>
          <div><dt>{t("crew.survival")}</dt><dd>{entry.survival}</dd></div>
          <div><dt>{t("crew.wounds")}</dt><dd>{entry.wounds}/{entry.size}</dd></div>
          <div><dt>{t("crew.hiddenCards")}</dt><dd>{entry.handCount}</dd></div>
        </dl>
        {status && <p>{status}</p>}
        {ability && <p>{ability}</p>}
        {!!entry.shown.length && <section className="character-supplies">
          <h3>{t("crew.shown")}</h3>
          <ul className="character-supply-list" role="list">
            {entry.shown.map(id => {
              const card = cardInfo(id);
              return card && <li key={id}>
                <CardFace id={id} parasolOpen={entry.parasol} />
                <p className="provision-effect">{provisionEffect(card)}</p>
              </li>;
            })}
          </ul>
        </section>}
      </div>
    </div>
  </Dialog>;
}

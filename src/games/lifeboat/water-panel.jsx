import { h } from "preact";
import { useState } from "preact/hooks";
import { CrewPortrait } from "./crew.jsx";
import { personName, t } from "./i18n.js";
import Icon from "./icon.jsx";
import { GameDialog, Raised } from "./ui.jsx";

export default function WaterPanel({ game, self, waterCards, drinks, setDrinks, busy, send }) {
  const [selection, setSelection] = useState(null);
  const priority = id => id === self.id ? 0 : id === self.love ? 1 : 2;
  const thirsty = game.thirst.filter(({ left }) => left > 0).sort((a, b) => priority(a.id) - priority(b.id));
  const available = waterCards.filter(card => !drinks.some(use => use.card === card));
  const availableInHand = available.filter(card => self.hand.includes(card)).length;
  const countFor = id => drinks.filter(use => use.for === id).length;
  const target = selection && thirsty.find(({ id }) => id === selection.id);
  const limit = target ? Math.min(target.left, available.length + countFor(target.id)) : 0;
  const amount = Math.min(selection?.amount ?? 0, limit);
  const isDead = id => !game.characters.find(entry => entry.id === id)?.alive;
  const close = () => setSelection(null);

  function confirmAllocation() {
    const others = drinks.filter(use => use.for !== target.id);
    const reserved = drinks.filter(use => use.for === target.id).map(use => use.card);
    const selected = [...reserved, ...available].slice(0, amount);
    setDrinks([...others, ...selected.map(card => ({ card, for: target.id }))]);
    close();
  }

  return <section className="panel" aria-label={t("action.water")}>
    <h2>{t("water.pickCrew")}</h2>
    <div className="water-recipients">
      {thirsty.map(({ id, left }) => {
        const allocated = countFor(id);
        const name = personName(id);
        return <button type="button" key={id} className="water-recipient" aria-haspopup="dialog"
          aria-label={[name, id === self.id && t("common.you"), t("water.remaining", { remaining: left - allocated })].filter(Boolean).join(" · ")}
          disabled={busy || (!available.length && !allocated)}
          onClick={() => setSelection({ id, amount: allocated || Math.min(left, availableInHand) })}>
          <CrewPortrait id={id} dead={isDead(id)} />
          <strong>{name}{id === self.id && <small> {t("common.you")}</small>}</strong>
          <span className="water-drops" aria-hidden="true">
            {Array.from({ length: left }, (_, index) => <span key={index} data-filled={index < allocated}><Icon name="water" /></span>)}
          </span>
        </button>;
      })}
    </div>
    <div className="paired-actions">
      <Raised secondary disabled={busy} onClick={() => send({ type: "drink", uses: [] })}>{t("common.skip")}</Raised>
      <Raised disabled={busy || !drinks.length} onClick={() => send({ type: "drink", uses: drinks })}>{t("water.confirm")}</Raised>
    </div>
    <GameDialog title={t("action.water")} className="water-dialog" open={!!target} onClose={close}
      footer={<Raised disabled={busy || !target || (!amount && !countFor(target.id))} onClick={confirmAllocation}>{t("water.confirmAllocation")}</Raised>}>
      {target && <>
        <div className="water-dialog-person">
          <CrewPortrait id={target.id} dead={isDead(target.id)} />
          <strong>{personName(target.id)}{target.id === self.id && <small> {t("common.you")}</small>}</strong>
        </div>
        <div className="water-drops" role="group" aria-label={t("water.amount")}>
          {Array.from({ length: target.left }, (_, index) => {
            const count = index + 1;
            return <button key={count} type="button" aria-pressed={count <= amount}
              aria-label={t("water.allocateCount", { count })} disabled={busy || count > limit}
              data-filled={count <= amount} onClick={() => setSelection({ id: target.id, amount: amount === count ? count - 1 : count })}>
              <Icon name="water" />
            </button>;
          })}
        </div>
      </>}
    </GameDialog>
  </section>;
}

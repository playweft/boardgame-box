import { h } from "preact";
import { CHARACTERS, LAND_BIRDS } from "./data.js";
import { characterAbility, characterName, listNames, personName, provisionName, t } from "./i18n.js";

export default function Rules() {
  return <div className="rules">
    <section>
      <h2>{t("rules.goal")}</h2>
      <p>{t("rules.goalText", { birds: LAND_BIRDS })}</p>
      <p>{t("rules.days")}</p>
    </section>

    <section>
      <h2>{t("rules.setup")}</h2>
      <ol>
        <li>{t("rules.setupCrew", { crew: listNames(CHARACTERS.map(({ id }) => characterName(id))) })}</li>
        <li>{t("rules.setupRelationships")}</li>
        <li>{t("rules.setupDecks")}</li>
      </ol>
    </section>

    <section>
      <h2>{t("rules.crew")}</h2>
      <ul>
        {CHARACTERS.map(person => <li key={person.id}>
          <strong>{characterName(person.id)}</strong>
          <span>{t("rules.crewStats", { size: person.size, survival: person.survival, ability: characterAbility(person.id) })}</span>
        </li>)}
      </ul>
      <p>{t("rules.wounds")}</p>
    </section>

    <section>
      <h2>{t("rules.deal")}</h2>
      <p>{t("rules.dealOrder")}</p>
      <p>{t("rules.dealEmpty")}</p>
    </section>

    <section>
      <h2>{t("rules.actions")}</h2>
      <p>{t("rules.actionOrder")}</p>
      <h3>{t("rules.pass")}</h3>
      <p>{t("rules.passText")}</p>
      <h3>{t("rules.row")}</h3>
      <p>{t("rules.rowText")}</p>
      <h3>{t("rules.swap")}</h3>
      <p>{t("rules.swapText")}</p>
      <h3>{t("rules.mug")}</h3>
      <p>{t("rules.mugText", { kid: characterName("kid") })}</p>
      <h3>{t("rules.special")}</h3>
      <ul>
        <li>{t("rules.parasol")}</li>
        <li>{t("rules.medical")}</li>
        <li>{t("rules.flare", { birds: LAND_BIRDS })}</li>
      </ul>
      <h3>{t("rules.reveal")}</h3>
      <p>{t("rules.revealText", { kid: characterName("kid") })}</p>
    </section>

    <section>
      <h2>{t("rules.fight")}</h2>
      <p>{t("rules.fightStart")}</p>
      <ol>
        <li>{t("rules.fightSides")}</li>
        <li>{t("rules.fightWeapons")}</li>
        <li>{t("rules.fightTalk")}</li>
        <li>{t("rules.fightResolve")}</li>
        <li>{t("rules.fightEnd")}</li>
      </ol>
    </section>

    <section>
      <h2>{t("rules.navigation")}</h2>
      <p>{t("rules.navigator")}</p>
      <p>{t("rules.gulls", { birds: LAND_BIRDS })}</p>
      <h3>{t("rules.overboard")}</h3>
      <p>{t("rules.fall")}</p>
      <ul>
        <li>{t("rules.fallWounds", { frenchy: characterName("frenchy") })}</li>
        <li>{t("rules.sharks", { frenchy: characterName("frenchy") })}</li>
        <li>{t("rules.sink")}</li>
        <li>{t("rules.climbBack")}</li>
      </ul>
      <h3>{t("rules.thirst")}</h3>
      <p>{t("rules.thirstSources")}</p>
      <p>{t("rules.thirstWater")}</p>
      <p>{t("rules.nextDay")}</p>
    </section>

    <section>
      <h2>{t("rules.scoring")}</h2>
      <p>{t("rules.scoringStart")}</p>
      <ul>
        <li>{t("rules.scoringSurvival")}</li>
        <li>{t("rules.scoringLove")}</li>
        <li>{t("rules.scoringHate")}</li>
        <li>{t("rules.scoringSame")}</li>
        <li>{t("rules.scoringLoot", { captain: characterName("captain"), lauren: personName("lauren"), stephen: personName("stephen") })}</li>
      </ul>
    </section>

    <section>
      <h2>{t("rules.provisions")}</h2>
      <ul>
        <li><strong>{provisionName("water")} ×16</strong><span>{t("rules.itemWater")}</span></li>
        <li><strong>{provisionName("oar")} ×2</strong><span>{t("rules.itemOar")}</span></li>
        <li><strong>{provisionName("chum")} ×2</strong><span>{t("rules.itemChum")}</span></li>
        <li><strong>{provisionName("medical")} ×3</strong><span>{t("rules.itemMedical")}</span></li>
        <li><strong>{provisionName("cash")} ×6</strong><span>{t("rules.itemCash", { captain: characterName("captain") })}</span></li>
        <li><strong>{provisionName("painting")} ×3</strong><span>{t("rules.itemPainting", { stephen: characterName("stephen") })}</span></li>
        <li><strong>{provisionName("jewels")} ×3</strong><span>{t("rules.itemJewels", { lauren: characterName("lauren") })}</span></li>
        <li><strong>{provisionName("parasol")} ×1</strong><span>{t("rules.itemParasol")}</span></li>
        <li><strong>{provisionName("preserver")} ×1</strong><span>{t("rules.itemPreserver")}</span></li>
        <li><strong>{provisionName("compass")} ×1</strong><span>{t("rules.itemCompass")}</span></li>
        <li><strong>{listNames(["blackjack", "knife", "hook", "flare"].map(provisionName))}</strong><span>{t("rules.itemWeapons")}</span></li>
      </ul>
    </section>

    <section>
      <h2>{t("rules.reminders")}</h2>
      <ul>
        <li>{t("rules.reminderFights")}</li>
        <li>{t("rules.reminderKid", { kid: characterName("kid") })}</li>
        <li>{t("rules.reminderSeats")}</li>
        <li>{t("rules.reminderGulls")}</li>
        <li>{t("rules.reminderThirst")}</li>
      </ul>
    </section>
  </div>;
}

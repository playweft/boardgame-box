import { h } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Check } from "lucide";
import GameTopbar from "../../shared/game-topbar.jsx";
import LucideIcon from "../../shared/lucide-icon.jsx";
import ActivityText from "./activity-text.jsx";
import { CharacterDialog, CrewPortrait } from "./crew.jsx";
import { CHARACTERS, MAX_PLAYERS, MIN_PLAYERS } from "./data.js";
import { personName, t } from "./i18n.js";
import Icon from "./icon.jsx";
import { NavigationDecision, NavigationReveal } from "./navigation.jsx";
import Rules from "./rules.jsx";
import Table from "./table.jsx";
import { GameDialog, Raised } from "./ui.jsx";
import cover from "./assets/cover-flat.webp";

function Menu({ onSetup, onCreateRoom, launchUrl, busy }) {
  return <main className="menu sea-page">
    <img className="cover" src={cover} alt={t("menu.cover")} width="960" height="640" />
    <div className="menu-heading">
      <h1>{t("game.title")}</h1>
      <p>{t("menu.edition")}</p>
    </div>
    <div className="menu-actions">
      <Raised onClick={() => onSetup("computer")} icon="forward" disabled={busy}>{t("menu.computer")}</Raised>
      <Raised secondary onClick={() => onSetup("local")} icon="forward" disabled={busy}>{t("menu.local")}</Raised>
      {launchUrl
        ? <Raised secondary href={launchUrl} icon="forward">{t("menu.online")}</Raised>
        : <Raised secondary onClick={onCreateRoom} icon="forward" disabled={!onCreateRoom || busy}>
          {busy ? t("menu.creating") : t("menu.online")}
        </Raised>}
    </div>
  </main>;
}

function SetupSegments({ name, labelledBy, options, value, onChange }) {
  return <div className="setup-segments" role="radiogroup" aria-labelledby={labelledBy}>
    {options.map(([option, label]) => <label key={option}>
      <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
      <span>{label}</span>
    </label>)}
  </div>;
}

function Setup({ computer, onStart, onBack }) {
  const [count, setCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState(() => Array(MAX_PLAYERS).fill(""));
  const [cast, setCast] = useState(null);
  const canStart = !cast || cast.length === count;
  const chooseCount = value => {
    setCount(value);
    if (value === MAX_PLAYERS) setCast(null);
    else if (cast?.length > value) setCast(cast.slice(0, value));
  };
  const toggle = id => setCast(current => {
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    return next.length > count ? current : next;
  });
  function start(event) {
    event.preventDefault();
    if (!canStart) return;
    const players = computer ? Array.from({ length: count }, (_, index) => index === 0 ? t("common.you") : t("setup.computerName", { number: index }))
      : names.slice(0, count).map((name, index) => name.trim() || t("setup.playerName", { number: index + 1 }));
    onStart(players, cast);
  }
  return <main className="sea-page setup" data-computer={computer}>
    {!computer && <h1>{t("menu.local")}</h1>}
    <form onSubmit={start}>
      <div className="setup-options">
        {computer && <h1>{t("menu.computer")}</h1>}
        <div className="setup-row">
          <span id="setup-count-label">{t("setup.count")}</span>
          <SetupSegments name="crew-count" labelledBy="setup-count-label" value={count} onChange={chooseCount}
            options={[4, 5, 6].map(number => [number, t("setup.playerCount", { number })])} />
        </div>
        <div>
          <div className="setup-row">
            <span id="setup-cast-label">{t("setup.cast")}</span>
            {count === MAX_PLAYERS ? <span className="setup-value">{t("setup.all")}</span>
              : <SetupSegments name="crew-selection" labelledBy="setup-cast-label" value={cast ? "manual" : "random"}
                options={[["random", t("setup.random")], ["manual", t("setup.manual")]]}
                onChange={mode => setCast(mode === "manual" ? [] : null)} />}
          </div>
          <div className="cast-disclosure" data-expanded={!!cast} inert={!cast}>
            <div className="cast-disclosure-content">
              <p className="cast-count" id="setup-cast-count" aria-live="polite">{t("setup.selected", { selected: cast?.length ?? 0, count })}</p>
              <div className="cast-picker" role="group" aria-labelledby="setup-cast-label" aria-describedby="setup-cast-count">
                {CHARACTERS.map(person => {
                  const selected = cast?.includes(person.id) ?? false;
                  return <button key={person.id} type="button" className="setup-option" aria-pressed={selected}
                    onClick={() => toggle(person.id)}>
                    <CrewPortrait id={person.id} />
                    <span>{personName(person.id)}</span>
                    {selected && <LucideIcon icon={Check} />}
                  </button>;
                })}
              </div>
            </div>
          </div>
        </div>
        {!computer && <>
          <div className="name-fields">
            {names.slice(0, count).map((name, index) => <label key={index} className="name-field">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <input aria-label={t("setup.playerNameLabel", { number: index + 1 })} value={name} placeholder={t("setup.playerName", { number: index + 1 })} maxLength={24}
                onInput={event => setNames(names.with(index, event.currentTarget.value))} />
            </label>)}
          </div>
          <p className="hint">{t("setup.passHint")}</p>
        </>}
      </div>
      <div className="setup-actions">
        <Raised type="submit" icon="forward" disabled={!canStart}>{t("setup.start")}</Raised>
        <button type="button" className="return-to-modes" onClick={onBack}>{t("setup.back")}</button>
      </div>
    </form>
  </main>;
}

function Notice({ icon, title, children }) {
  return <main className="notice-page sea-page"><section className="notice">
    <Icon name={icon} /><h1>{title}</h1>{children}
  </section></main>;
}

const EMPTY_NAVIGATION_DRAFT = { dismissed: false, kept: [] };

function ActivityHistory({ events, characters }) {
  const days = new Map();
  for (const event of events) {
    if (!days.has(event.day)) days.set(event.day, []);
    days.get(event.day).push(event);
  }
  return <ol className="activity-days" aria-label={t("history.title")} tabIndex={0}>
    {[...days].map(([day, entries], index) => <li key={day}>
      {index > 0 && <hr />}
      <h3>{t("table.day", { day })}</h3>
      <ol className="activity-list">
        {entries.flatMap(event => event.lines.map((line, index) => <li key={`${event.step}-${index}`}>
          <ActivityText parts={line} characters={characters} showPortraits />
        </li>))}
      </ol>
    </li>)}
  </ol>;
}

export default function LifeboatApp({ room, computer, turnHistory, turnFeedback, fightResult, fightSkip, treatment, navigationReveal, standalone, game, connecting, waiting, handoff, trading, busy, error, launchUrl,
  onCreateRoom, onStart, onReady, onTrade, onEndTrade, onExit, onAction, onPauseChange, onComputerHold }) {
  const [setup, setSetup] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [inspectedId, setInspectedId] = useState(null);
  const [savedNavigation, setSavedNavigation] = useState(null);
  const historyBody = useRef(null);
  const inspected = game?.characters.find(entry => entry.id === inspectedId);
  const hasNavigationChoice = game?.phase === "row" && game.rowChoices?.length
    || game?.phase === "navigate" && game.rowChoices?.length > 1;
  const navigationKey = hasNavigationChoice && game.canAct && !trading
    ? JSON.stringify([game.day, game.phase, game.viewerId, game.rowChoices]) : null;
  const navigationDraft = navigationKey && (savedNavigation?.key === navigationKey ? savedNavigation : EMPTY_NAVIGATION_DRAFT);

  useLayoutEffect(() => {
    if (!navigationKey) setSavedNavigation(null);
  }, [navigationKey]);

  useLayoutEffect(() => {
    if (dialog !== "history") return;
    const frame = requestAnimationFrame(() => {
      const body = historyBody.current;
      if (body) body.scrollTop = body.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [dialog]);

  function updateNavigationDraft(update) {
    setSavedNavigation(previous => {
      const current = previous?.key === navigationKey ? previous : EMPTY_NAVIGATION_DRAFT;
      return { ...current, ...update(current), key: navigationKey };
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
  const traders = localMatch && !computer && !fightResult && game.phase !== "ended" && !trading
    ? game.players.filter(player => game.characters.some(entry => entry.player === player.id
      && entry.conscious && (entry.handCount || (game.tradeOpen && entry.shown.length))))
    : [];
  let scene;
  if (connecting || (room && !game)) {
    scene = <Notice icon="bird" title={connecting ? t("room.connecting") : waiting ? t("room.waiting") : t("room.loading")} />;
  } else if (localMatch && handoff && !fightResult && !treatment) {
    const player = game.players.find(item => item.id === game.viewerId);
    scene = <Notice icon="lock" title={t("handoff.title", { player: player?.name ?? t("handoff.next") })}>
      <p className="hint">{trading ? t("handoff.tradeHint") : t("handoff.privateHint", { day: game.day })}</p>
      <Raised onClick={onReady} icon="forward">{t("handoff.ready")}</Raised>
      {trading && <Raised secondary onClick={onEndTrade}>{t("handoff.back")}</Raised>}
    </Notice>;
  } else if (game) scene = <Table key={`${game.viewerId}-${trading}`}
    game={game} computer={computer} feedback={computer && !fightSkip ? turnFeedback : null}
    fightResult={fightResult} fightSkip={fightSkip} treatment={treatment} latestActivity={turnHistory.at(-1)}
    busy={busy || !!fightResult || !!fightSkip || !!treatment || !!navigationReveal} trading={trading} error={error}
    overlayOpen={dialog !== null || !!treatment || !!navigationReveal} navigationDraft={navigationDraft} onNavigationDraft={updateNavigationDraft}
    onAction={onAction} onEndTrade={onEndTrade}
    onHistory={() => showDialog("history")} onInspect={inspect}
    onComputerHold={onComputerHold}
    onChooseTrader={traders.length ? () => setDialog("trade") : null} />;
  else scene = setup
    ? <Setup computer={setup === "computer"} onBack={() => setSetup(null)}
      onStart={(names, cast) => { setSetup(null); onStart(names, cast, setup === "computer"); }} />
    : <Menu onSetup={setSetup} onCreateRoom={onCreateRoom} launchUrl={launchUrl} busy={busy} />;

  return <div className="sea-shell">
    <GameTopbar title={t("game.title")} standalone={standalone} room={room}
      pauseLabel={t("chrome.pause")} backLabel={t("chrome.back")} helpLabel={t("rules.title")}
      onPause={!connecting && localMatch ? () => showDialog("pause") : undefined}
      onHelp={() => showDialog("help")} />
    {error && (!game || handoff || connecting) && <p className="error" role="alert">{error}</p>}
    {scene}
    <NavigationDecision phase={game?.phase} cards={navigationDraft ? game.rowChoices : []}
      characters={game?.characters ?? []} draft={navigationDraft || EMPTY_NAVIGATION_DRAFT}
      open={!!navigationDraft && !navigationDraft.dismissed && !dialog && !navigationReveal && !handoff && !connecting}
      updateDraft={updateNavigationDraft} busy={busy} error={error} onAction={onAction} />
    {inspected && <CharacterDialog entry={inspected} player={game.players.find(player => player.id === inspected.player)?.name}
      seatNumber={game.cast.indexOf(inspected.id) + 1} open={dialog === "character"} onClose={close} />}
    {computer && <GameDialog title={t("history.title")} open={dialog === "history"} onClose={close} bodyRef={historyBody}>
      <ActivityHistory events={turnHistory} characters={game?.characters ?? []} />
    </GameDialog>}
    <GameDialog title={t("rules.title")} open={dialog === "help"} onClose={close}
      footer={<Raised onClick={close}>{t("common.gotIt")}</Raised>}>
      <Rules />
    </GameDialog>
    <GameDialog title={confirmExit ? t("pause.confirmExit") : t("pause.title")}
      open={dialog === "pause" || confirmExit}
      onClose={confirmExit ? () => showDialog("pause") : close}>
      {confirmExit ? <>
        <p className="hint">{t("pause.progressLost")}</p>
        <div className="paired-actions">
          <Raised secondary onClick={() => showDialog("pause")}>{t("common.cancel")}</Raised>
          <Raised onClick={() => { close(); onExit(); }}>{t("pause.exit")}</Raised>
        </div>
      </> : <div className="table-footer">
        <Raised onClick={close}>{t("pause.resume")}</Raised>
        <Raised secondary onClick={() => showDialog("exit")}>{t("pause.abandon")}</Raised>
      </div>}
    </GameDialog>
    <GameDialog title={game?.tradeOpen ? t("trade.choosePlayer") : t("trade.chooseRevealPlayer")} open={dialog === "trade"} onClose={close}>
      <p className="hint">{t("trade.handoff")}</p>
      <div className="trade-players">
        {traders.map(player => <Raised secondary key={player.id}
          onClick={() => { close(); onTrade(player.id); }}>{player.name}</Raised>)}
      </div>
    </GameDialog>
    <NavigationReveal reveal={navigationReveal} />
  </div>;
}

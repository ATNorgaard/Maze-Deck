import { ActionBar, DeckPile, DiscardPile, MazeDeckProvider, PlayerSeat, River, ScoreTrack, getCategory } from '@maze-deck/ui';
import { activeSeatOf, availableFor, mayAct } from '@maze-deck/rules';
import type { CardCategory, ChoicePayload, GameAction, GameView } from '@maze-deck/rules';
import * as React from 'react';
import type { Biome } from '../biomes';
import { ChoicePanel } from '../components/ChoicePanel';
import { DieRoll } from '../components/DieRoll';
import { EventLog } from '../components/EventLog';
import { Modal } from '../components/Modal';
import { Route } from '../components/Route';
import { ScaleToFit } from '../components/ScaleToFit';
import { SeatBaton } from '../components/SeatBaton';
import { SoundToggle } from '../components/SoundToggle';
import { Throw } from '../components/Throw';
import { Vista } from '../components/Vista';
import { useBed } from '../stage/bed';
import { buzz, feel, FEEL, canBuzz, useHapticsOn } from '../stage/haptics';
import { StageOverlay } from '../stage/StageOverlay';
import { useEnding } from '../stage/useEnding';
import { useStage } from '../stage/useStage';
import { useTicking } from '../stage/useTicking';
import type { DrawnPrompt } from '../tables';
import type { SharedScene } from '../transport/types';
import { useFittingSize } from '../useFittingSize';
import { World } from '../world/World';
import '../table.css';
import '../phone.css';

interface Props {
  view: GameView;
  /** The setting, as the server told this device. */
  biome: Biome;
  dispatch: (action: GameAction) => void;
  connected: boolean;
  error: string | null;
  /** The scene the GM has shown the table, if any (DECISIONS O1). */
  scene: SharedScene | null;
  onLeave: () => void;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

/**
 * How long a new reveal waits for the GM's scene before the picture
 * changes. A scene shown at once arrives a round trip after the card
 * turns; waiting this long lets the phone go straight to the picture the
 * GM's board drew, instead of one picture and then another.
 */
const SCENE_GRACE = 900;

function HapticsToggle() {
  const [on, setOn] = useHapticsOn();
  if (!canBuzz()) return null;
  return (
    <button type="button" className="t-btn" aria-pressed={on} onClick={() => setOn(!on)}
      title="Feel the beats: your turn, a strike, ground gained, being found.">
      {on ? 'Haptics on' : 'Haptics off'}
    </button>
  );
}

/**
 * A player's own device: a window onto the table (docs/overhaul.md,
 * phase 8), not the GM's board with the buttons taken off.
 *
 * One column, phone first. From the top: who you are and where the
 * crossing has got to (the route, the threat); the place itself — the
 * vista of the card just turned, the setting's light and air behind
 * everything at the device's tier; the scene, once the GM has shown it
 * to the table; the river and the piles; the party. On your turn the
 * hand of six rises from the bottom and fills the screen's foot. When the
 * table rolls its own dice and the check is yours, a die to throw. The
 * beats that matter are felt as well as seen.
 *
 * What it is allowed to show is decided by the redaction and by what
 * the GM shares; this decides what is worth showing.
 */
export function PlayerScreen({ view, biome, dispatch, connected, error, scene, onLeave }: Props) {
  const me = view.viewer.role === 'player' ? view.viewer.seatId : null;
  const a = availableFor(view);
  const active = activeSeatOf(view);
  const myTurn = active?.id === me;
  const seat = view.seats.find((s) => s.id === me);

  const pending = view.pending;
  const check = pending?.kind === 'check' ? pending : null;

  // The largest size step the column holds; ScaleToFit takes a phone the
  // rest of the way down.
  const boardRef = React.useRef<HTMLDivElement>(null);
  const riverSize = useFittingSize(boardRef);

  // Same split as the GM's board: `view` decides, `shown` is drawn.
  const riverRef = React.useRef<HTMLDivElement>(null);
  const discardRef = React.useRef<HTMLDivElement>(null);
  const deckRef = React.useRef<HTMLDivElement>(null);
  const handRef = React.useRef<HTMLDivElement>(null);
  const stage = useStage(view, { riverRef, discardRef, deckRef });
  const shown = stage.presented;
  const deckCount = useTicking(shown.deckCount);
  const discardCount = useTicking(shown.discardCount);
  const settling = stage.active?.kind === 'settle' ? stage.active.slot : null;

  useEnding(view);
  const seatsRef = React.useRef<HTMLDivElement>(null);
  const shownActive = shown.order[shown.turn % Math.max(shown.order.length, 1)] ?? null;
  const batonSeat = stage.active?.kind === 'turn' ? stage.active.to : shownActive;
  const batonIndex = shown.phase === 'over' || batonSeat === null ? -1 : shown.order.indexOf(batonSeat);
  const act = (action: GameAction) => { stage.flush(); dispatch(action); };

  /* ---------------- felt ---------------- */
  const yours = myTurn && view.phase === 'act';
  const myCheck = check !== null && check.seatId === me;
  // Once a turn, whatever re-renders or remounts in between.
  const buzzedTurn = React.useRef<string | null>(null);
  React.useEffect(() => {
    const key = `${view.round}:${view.turn}`;
    if (yours && buzzedTurn.current !== key) { buzzedTurn.current = key; buzz([...FEEL.turn]); }
  }, [yours, view.round, view.turn]);
  React.useEffect(() => { if (stage.active) feel(stage.active); }, [stage.active]);

  // The sheet at the foot: risen for your action and your roll, sunk and
  // inert otherwise.
  const raised = yours || myCheck;
  React.useEffect(() => { if (handRef.current) handRef.current.inert = !raised; }, [raised]);

  /* ---------------- the scene ----------------
     The latest card turned, by the key the GM's chronicle uses (the
     pick's log line and the slot), so a scene the GM shows can be matched
     to the card it belongs to. Read from the log, not from the reveal: a
     phone that polls either side of a quick one never sees it. */
  const turnedCard = React.useMemo(() => {
    for (let i = view.log.length - 1; i >= 0; i -= 1) {
      const e = view.log[i];
      if (e?.turned) return { key: `${e.n}:${e.turned.slot}`, category: e.turned.category };
    }
    // A crossing begun before the log marked its picks.
    return view.phase === 'reveal' && view.revealed
      ? { key: `${view.log[view.log.length - 1]?.n ?? 0}:${view.revealed.slot}`, category: view.revealed.category }
      : null;
  }, [view.log, view.phase, view.revealed]);
  const [graced, setGraced] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!turnedCard) return undefined;
    const key = turnedCard.key;
    const t = window.setTimeout(() => setGraced(key), SCENE_GRACE);
    return () => window.clearTimeout(t);
    // Once per card turned.
  }, [turnedCard?.key]);
  const sceneHere = scene && (!turnedCard || scene.key === turnedCard.key) ? scene : null;
  const [vistaPrompt, setVistaPrompt] = React.useState<DrawnPrompt | null>(null);
  React.useEffect(() => {
    if (sceneHere) setVistaPrompt({ category: sceneHere.category, entryId: sceneHere.entryId, text: sceneHere.text });
    else if (turnedCard && graced === turnedCard.key) setVistaPrompt({ category: turnedCard.category, entryId: `card:${turnedCard.key}`, text: '' });
  }, [sceneHere?.key, sceneHere?.entryId, turnedCard?.key, graced]);
  const sceneCategory = sceneHere?.category ?? turnedCard?.category ?? null;
  const cardName = (c: CardCategory) => biome.cards?.[c]?.title ?? getCategory(c).title;

  /* ---------------- the world ---------------- */
  const found = stage.active?.kind === 'found' || shown.phase === 'encounter';
  const near = shown.strikes > 0 && shown.strikes >= shown.rules.encounterAt - 1;
  const focus = yours ? { name: 'hand', ref: handRef } : shown.phase === 'pick' ? { name: 'river', ref: riverRef } : null;
  const mood = {
    threat: found ? 1.4 : shown.strikes / Math.max(1, shown.rules.encounterAt),
    progress: shown.progress / Math.max(1, shown.rules.escapeTarget),
    hush: found || near ? 1 : 0,
    dim: shown.outcome === 'lost' ? 1 : 0,
    bloom: shown.outcome === 'through' ? 1 : 0,
  };
  // The setting's bed, on the same mood, if this phone's owner has sound on.
  useBed(biome.id, mood);
  const [flash, setFlash] = React.useState<{ key: string; category: CardCategory } | null>(null);
  const turned = shown.phase === 'reveal' && shown.revealed ? `${shown.round}:${shown.turn}:${shown.revealed.slot}` : null;
  React.useEffect(() => {
    if (turned && shown.revealed) setFlash({ key: turned, category: shown.revealed.category });
  }, [turned]);

  // The same check the server will run. Here it only decides whether a
  // control is worth offering; the server's answer is the one that counts.
  const mayPick = (index: number) => mayAct(view, view.viewer, { type: 'PICK_SLOT', index }).ok;
  const myChoice = pending?.kind === 'choice'
    && mayAct(view, view.viewer, {
      type: 'RESOLVE_CHOICE',
      payload: pending.choice.kind === 'wanderer-stays'
        ? { kind: 'wanderer-stays', stays: true }
        : { kind: 'boost-target', seatId: me ?? '' },
    }).ok;

  const checkName = check ? view.seats.find((s) => s.id === check.seatId)?.name ?? 'Someone' : '';
  const status = view.phase === 'over'
    ? (view.outcome === 'through' ? 'The party is through.' : 'The crossing is over.')
    : yours ? 'Your turn — choose an action.'
      : myCheck ? (check.d20 === null ? 'Your roll — throw, and tell the GM.' : 'Your roll — the GM is ruling on it.')
        : myTurn && view.phase === 'pick' ? 'Your turn — commit to a path.'
          : myChoice ? 'Your turn — decide.'
            : check ? `${checkName} is rolling.`
              : myTurn ? 'Your turn — the GM is ruling.'
                : `Waiting on ${active?.name ?? 'the table'}.`;

  const checkBody = check ? (
    check.d20 === null ? (
      myCheck
        ? <Throw key={`${view.round}:${view.turn}`} advantage={check.d20b !== null} mod={check.mod} dc={check.dc} score={check.score} />
        : <p className="t-note">Rolling at the table.</p>
    ) : (
      <>
        {/* No verdict: it is the GM's to give, and showing it as decided
            here would be a lie they can still overturn. */}
        <DieRoll d20={check.d20} d20b={check.d20b} mod={check.mod} dc={check.dc} verdict={null} />
        <p className="t-note">Waiting on the GM.</p>
      </>
    )
  ) : null;

  return (
    <div
      className="t-phone"
      data-shake={stage.active?.kind === 'strike' || stage.active?.kind === 'jam' || undefined}
      data-outcome={shown.outcome ?? undefined}
      data-found={found || undefined}
      data-yours={yours || undefined}
    >
      <World
        biome={biome}
        mood={mood}
        focus={focus}
        flash={flash}
      />

      <div className="t-phone__main" ref={boardRef}>
        <header className="t-phone__top">
          <div className="t-phone__who">
            <p className="t-kicker">{biome.name} · Round {shown.round}</p>
            <h1 className="t-phone__name">{seat?.name ?? 'Watching'}</h1>
            <p className="t-phone__status" role="status">
              {status}{connected ? '' : ' · reconnecting…'}
            </p>
            {error ? <p className="t-phone__error" role="alert">{error}</p> : null}
          </div>
          <div className="t-phone__tracks">
            <Route biome={biome} value={shown.progress} total={shown.rules.escapeTarget} landmarks={[]} />
            <div className="t-track" key={`t${shown.strikes}`}>
              <ScoreTrack value={shown.strikes} total={shown.rules.encounterAt} variant="threat" />
            </div>
          </div>
        </header>

        {/* The place: the card just turned, as a picture. The GM's own
            picture once they have shown the table the scene; until then
            the card's, in the setting's light. */}
        <div className="t-phone__vista">
          <Vista biome={biome} prompt={vistaPrompt} step={shown.progress} />
        </div>

        <div className="t-phone__scene" data-empty={sceneCategory ? undefined : true} data-category={sceneCategory ?? undefined} aria-live="polite">
          {sceneCategory ? <p className="t-kicker">{cardName(sceneCategory)}</p> : null}
          {sceneHere
            ? <p className="t-phone__text">{sceneHere.text}</p>
            : sceneCategory ? <p className="t-phone__text t-phone__text--waiting">The GM has the scene.</p> : null}
        </div>

        {/* River and piles scale as one block, so a pile is never drawn
            larger than the paths being chosen between. */}
        <ScaleToFit className="t-phone__fit">
          <div
            className="t-river"
            ref={riverRef}
            data-covered={stage.covered.length ? stage.covered.join(' ') : undefined}
            data-settled={settling === null ? undefined : String(settling)}
            data-pickable={a.pickSlots.length && myTurn ? true : undefined}
          >
            <River
              className="t-river__ground"
              size={riverSize}
              slots={shown.river.map((s) => (
                s.filled
                  ? { category: s.category ?? 'clear-path', faceDown: !s.faceUp }
                  : { category: null, faceDown: false }
              ))}
              {...(myTurn && a.pickSlots.length
                ? { onPick: (i: number) => { if (mayPick(i)) act({ type: 'PICK_SLOT', index: i }); } }
                : {})}
            />
          </div>
          <div className="t-piles">
            <div ref={deckRef}><DeckPile count={deckCount} size="sm" /></div>
            <div ref={discardRef} className="t-drop" key={shown.discardCount}>
              <DiscardPile count={discardCount} size="sm" {...(shown.discardTop ? { top: shown.discardTop } : {})} />
            </div>
          </div>
        </ScaleToFit>

        {view.phase === 'pick' && myTurn ? (
          <p className="t-phone__prompt" data-tone="live">Commit to a path — tap one. It is turned over for everyone.</p>
        ) : null}

        {/* Somebody else's roll, in the column. Your own is in the sheet
            at the foot, under your thumb. */}
        {check && !myCheck ? (
          <section className="t-phone__check" aria-label="A roll">
            <p className="t-kicker">{checkName} · {check.score} against {check.dc}</p>
            {checkBody}
          </section>
        ) : null}

        <section className="t-phone__rail" aria-label="The party">
          <div className="t-seats" ref={seatsRef}>
            <SeatBaton containerRef={seatsRef} index={batonIndex} />
            {shown.order.map((id, i) => {
              const s = shown.seats.find((x) => x.id === id);
              if (!s) return null;
              return (
                <PlayerSeat
                  key={id}
                  name={s.name}
                  order={i + 1}
                  active={s.id === shownActive && shown.phase !== 'over'}
                  detail={[s.id === me ? 'you' : s.cls, shown.advantage.includes(id) ? 'advantage' : null].filter(Boolean).join(' · ')}
                />
              );
            })}
          </div>
        </section>

        <details className="t-phone__log">
          <summary>The log</summary>
          <EventLog log={view.log} />
        </details>

        <div className="t-phone__tools">
          <SoundToggle />
          <HapticsToggle />
          <button type="button" className="t-btn" onClick={onLeave}>Leave</button>
        </div>
      </div>

      {/* The sheet: on your turn the hand rises from the foot of the
          screen and takes it; once you have chosen, your roll takes its
          place. Otherwise it is out of sight and inert. */}
      <div className="t-phone__hand" ref={handRef} data-raised={raised || undefined} data-check={myCheck || undefined} aria-hidden={!raised}>
        {myCheck && check ? (
          <section className="t-phone__mine" aria-label="Your roll">
            <p className="t-kicker">Your roll · {check.score} against {check.dc}</p>
            {checkBody}
          </section>
        ) : (
          <>
            <p className="t-kicker">Your action</p>
            <MazeDeckProvider size="md" background="transparent">
              <ActionBar
                abilities={view.rules.abilities}
                showDc={false}
                {...(yours ? { onUse: (ability) => act({ type: 'USE_ABILITY', ability }) } : {})}
              />
            </MazeDeckProvider>
            {a.obstacleSlots.length ? (
              <p className="t-note">
                Or ask your GM to let you work on the blocked {a.obstacleSlots.map(position).join(' and ')} path.
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* Found: the GM runs the fight at the table; the phone says so. */}
      {shown.phase === 'encounter' ? (
        <div className="t-phone__found" role="status">
          <p className="t-kicker">The party is found</p>
          <p className="t-phone__foundTitle">Roll initiative</p>
          <p className="t-note">The GM is running it at the table.</p>
        </div>
      ) : null}

      {/* Outside ScaleToFit on purpose: the overlay is position: fixed,
          and a transformed ancestor would make it fixed to the wrong
          thing. */}
      <StageOverlay overlay={stage.overlay} deals={stage.deals} flights={stage.flights} size={riverSize} />

      {myChoice && pending?.kind === 'choice' ? (
        <Modal label="Your decision">
          <ChoicePanel
            view={view}
            choice={pending.choice}
            onResolve={(payload: ChoicePayload) => act({ type: 'RESOLVE_CHOICE', payload })}
          />
        </Modal>
      ) : null}
    </div>
  );
}

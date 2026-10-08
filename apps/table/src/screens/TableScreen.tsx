import * as React from 'react';
import {
  AbilityCard, ActionBar, DeckCard, DeckPile, DiscardPile, MazeDeckProvider, PlayerSeat, River, ScoreTrack,
  getAbility, getCategory,
} from '@maze-deck/ui';
import { availableFor } from '@maze-deck/rules';
import type { CardCategory, Choice, ChoicePayload, GameAction, GameView, Phase } from '@maze-deck/rules';
import { CardFan } from '../components/CardFan';
import { Drawer } from '../components/Drawer';
import { Encounter } from '../components/Encounter';
import { EventLog } from '../components/EventLog';
import { Ghosts } from '../components/Ghosts';
import type { Ghost } from '../components/Ghosts';
import { Modal } from '../components/Modal';
import { ObstacleWork } from '../components/ObstacleWork';
import type { Suggestion } from '../components/ObstacleWork';
import { RollStage } from '../components/RollStage';
import { SeatBaton } from '../components/SeatBaton';
import { SlotLayer } from '../components/SlotLayer';
import { SoundToggle } from '../components/SoundToggle';
import { Vista } from '../components/Vista';
import { BIOMES, isBiomeId } from '../biomes';
import type { Biome, BiomeId } from '../biomes';
import { reducedMotion } from '../stage/motion';
import { StageOverlay } from '../stage/StageOverlay';
import { useEnding } from '../stage/useEnding';
import { useStage } from '../stage/useStage';
import { useTicking } from '../stage/useTicking';
import type { DrawnPrompt } from '../tables';
import { useTableFit } from '../useTableFit';
import { World } from '../world/World';
import { WORLD_CHOICES, useWorldChoice } from '../world/settings';
import type { WorldChoice } from '../world/settings';
import '../table.css';

interface Props {
  /** The redacted view. This screen never sees GameState. */
  view: GameView;
  /** The setting the run was created in, resolved from the view. */
  biome: Biome;
  dispatch: (action: GameAction) => void;
  onExit: () => void;
  runName: string;
  /** The line drawn for the card in front of the table, if any. */
  prompt: DrawnPrompt | null;
  /** Previewing what a player's own screen would carry. */
  asPlayer: boolean;
  onTogglePlayerView: () => void;
  /** Set when the run is hosted in a room players can join. */
  hostCode?: string;
  error: string | null;
  /** The testing override: wear another setting on this screen only. */
  previewBiome?: BiomeId | null;
  onPreviewBiome?: (id: BiomeId | null) => void;
  /** Back to the old board (docs/overhaul.md, D7). */
  onSwitchBoard: () => void;
}

/** Where the light sits, as on the old board: the part the phase is about. */
const FOCUS: Record<Phase, 'actions' | 'river' | null> = {
  act: 'actions',
  check: null,
  choice: null,
  pick: 'river',
  reveal: 'river',
  encounter: null,
  over: null,
};

const CHRONICLE_KEY = 'mazedeck.chronicle';

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

function readOpen(key: string): boolean {
  try { return window.localStorage.getItem(key) === 'open'; } catch { return false; }
}
function writeOpen(key: string, open: boolean): void {
  try { window.localStorage.setItem(key, open ? 'open' : 'closed'); } catch { /* blocked: not remembered */ }
}

/** What the table is asked, for the prompt where the hand would rise. */
function askFor(choice: Choice | null, swapPick: number | null): { title: string; note: string } | null {
  if (!choice) return null;
  switch (choice.kind) {
    case 'wanderer-stays':
      return { title: 'Does the wanderer keep pace?', note: 'Some travel on and hold their place in the river; others go their own way.' };
    case 'discard-revealed':
      return { title: 'Strike one from the river', note: 'The other is shuffled back face down with the rest.' };
    case 'scout-top':
      return { title: 'Scouted off the deck', note: 'One goes back on top, to be drawn next. The rest are shuffled in. The table is told which.' };
    case 'swap-river':
      return swapPick === null
        ? { title: 'Swap one into the river', note: 'Choose a drawn card. The other goes back on top of the deck.' }
        : { title: 'Now the path it replaces', note: 'What it displaces is discarded.' };
    case 'boost-target':
      return { title: 'Who gets the advantage?', note: 'Choose a seat. They roll two dice and keep the better on their next check.' };
  }
}

/**
 * The table — the GM's board, rebuilt as a place rather than a page
 * (docs/overhaul.md, phase 1).
 *
 * One screen, no scrolling at a laptop's size. From the top: a thin
 * rail with the run and the two tracks; the scene band; the surface,
 * where the river lies with the deck on its left and the discard on
 * its right as they would on a real table; and the bottom edge, where
 * the party sits as a row of tokens, the six actions are a hand that
 * rises when an action is owed, and the newest lines of the log run.
 * The GM's controls are in a drawer and the full log is a chronicle
 * column that opens beside the table — the setting gets the screen.
 *
 * The rules of the old board hold unchanged: the truth decides what
 * may be done, the stage decides what is drawn, any input flushes the
 * stage, and nothing above the river is transformed (the stage
 * measures the slots). The decisions are still the old board's
 * centred dialogs; phase 4 brings them onto the table.
 */
export function TableScreen({
  view, biome, dispatch, onExit, runName, prompt, asPlayer, onTogglePlayerView,
  hostCode, error, previewBiome = null, onPreviewBiome, onSwitchBoard,
}: Props) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const riverRef = React.useRef<HTMLDivElement>(null);
  const deckRef = React.useRef<HTMLDivElement>(null);
  const discardRef = React.useRef<HTMLDivElement>(null);
  const seatsRef = React.useRef<HTMLDivElement>(null);
  const handRef = React.useRef<HTMLDivElement>(null);

  const fit = useTableFit(stageRef, sceneRef);
  const stage = useStage(view, { riverRef, discardRef, deckRef });
  const shown = stage.presented;
  const deckCount = useTicking(shown.deckCount);
  const discardCount = useTicking(shown.discardCount);
  const act = (action: GameAction) => { stage.flush(); dispatch(action); };

  const a = availableFor(view);
  const pending = view.pending;
  const endingShown = useEnding(view);

  const [gmOpen, setGmOpen] = React.useState(false);
  const [chronicle, setChronicle] = React.useState(() => readOpen(CHRONICLE_KEY));
  const toggleChronicle = () => setChronicle((was) => { writeOpen(CHRONICLE_KEY, !was); return !was; });

  /* ---------------- the obstacle's own suggestion ----------------
     The old board adopted whatever the latest scene suggested, which
     was the wrong card's once another had been turned since. Each
     blocker now keeps the check its own scene asked for, by slot, for
     as long as it sits there; the latest scene is the fallback. */
  const suggestions = React.useRef(new Map<number, Suggestion>());
  React.useEffect(() => {
    const revealed = view.revealed;
    if (!prompt?.score || !revealed || !getCategory(revealed.category).blocker) return;
    suggestions.current.set(revealed.slot, { score: prompt.score, dcOffset: prompt.dcOffset ?? 0 });
    // Only a new scene is news; the view is read as it stands then.
  }, [prompt]);
  React.useEffect(() => {
    for (const slot of [...suggestions.current.keys()]) {
      const s = view.river[slot];
      if (!s?.filled || !s.faceUp || !s.category || !getCategory(s.category).blocker) {
        suggestions.current.delete(slot);
      }
    }
  }, [view.river]);
  const suggest = (slot: number): Suggestion | null => (
    suggestions.current.get(slot)
    ?? (prompt?.score ? { score: prompt.score, dcOffset: prompt.dcOffset ?? 0 } : null)
  );

  /* ---------------- decisions, on the table ----------------
     The old board asked every decision in a dialog that blurred out the
     thing it was about. Here each is made where its cards are: the river
     for a Wanderer, a strike or a swap; the deck for a scout; the party
     rail for a boost. The prompt sits where the hand would rise, and is
     announced. The payloads are the engine's, unchanged. */
  const choice = view.phase === 'choice' && pending?.kind === 'choice' ? pending.choice : null;
  const decider = pending?.kind === 'choice'
    ? view.seats.find((x) => x.id === pending.seatId)?.name ?? 'The table'
    : null;
  const resolve = (payload: ChoicePayload) => act({ type: 'RESOLVE_CHOICE', payload });
  // It's Elementary is two steps: a drawn card, then the slot it replaces.
  const [swapPick, setSwapPick] = React.useState<number | null>(null);
  const choiceKey = choice ? `${view.round}:${view.turn}:${choice.kind}` : '';
  React.useEffect(() => { setSwapPick(null); }, [choiceKey]);

  /* Cards seen to go where a decision sent them (components/Ghosts). */
  const [ghosts, setGhosts] = React.useState<Ghost[]>([]);
  const ghostId = React.useRef(0);
  const fly = (category: CardCategory, from: DOMRect, to: DOMRect | undefined) => {
    if (!to || reducedMotion()) return;
    ghostId.current += 1;
    setGhosts((g) => [...g, { id: ghostId.current, category, size: fit.river, from, to }]);
  };
  const ghostLanded = (id: number) => setGhosts((g) => g.filter((x) => x.id !== id));
  const deckTop = () => deckRef.current?.querySelector('article')?.getBoundingClientRect();
  const slotRect = (i: number) => riverRef.current
    ?.querySelectorAll('.md-river__slot')[i]?.querySelector('article')?.getBoundingClientRect();

  // The cards a decision is about stand up in their slots.
  const raisedSlots = choice?.kind === 'wanderer-stays' ? [choice.slot]
    : choice?.kind === 'discard-revealed' ? choice.slots
    : [];
  const fanCards = choice?.kind === 'scout-top' ? choice.cards
    : choice?.kind === 'swap-river' && swapPick === null ? choice.cards
    : null;
  const swapCard = choice?.kind === 'swap-river' && swapPick !== null ? choice.cards[swapPick] ?? null : null;
  const ask = askFor(choice, swapPick);

  // A boost is chosen on the rail: its first seat takes the focus.
  const boosting = choice?.kind === 'boost-target';
  React.useEffect(() => {
    if (boosting) seatsRef.current?.querySelector<HTMLElement>('.md-seat[role="button"]')?.focus();
  }, [boosting]);

  /* ---------------- the roll ---------------- */
  const check = view.phase === 'check' && pending?.kind === 'check' ? pending : null;
  const rollCard = check
    ? check.reason.type === 'ability'
      ? <AbilityCard ability={check.reason.ability} size="sm" />
      : <DeckCard category={view.river[check.reason.slot]?.category ?? 'obstacle'} size="sm" showCount={false} />
    : null;
  const attempt = check
    ? check.reason.type === 'ability'
      ? getAbility(check.reason.ability).title
      : `Clearing the ${position(check.reason.slot)}`
    : '';

  /* ---------------- the turn ---------------- */
  const activeIdx = shown.turn % Math.max(shown.order.length, 1);
  const batonSeat = stage.active?.kind === 'turn' ? stage.active.to : shown.order[activeIdx] ?? null;
  const batonIndex = shown.phase === 'over' || batonSeat === null ? -1 : shown.order.indexOf(batonSeat);
  const settling = stage.active?.kind === 'settle' ? stage.active.slot : null;

  // The hand is always on the table; it rises when an action is owed and
  // sinks to the edge otherwise. Sunk, it is inert, not merely dimmed.
  const raised = view.phase === 'act';
  React.useEffect(() => {
    if (handRef.current) handRef.current.inert = !raised;
  }, [raised]);

  // A decision made in place takes its control with it, and focus falls
  // to the page. Send it on to what is owed next — a path to pick, an
  // action to take — so the table can be played from the keyboard.
  React.useEffect(() => {
    const el = document.activeElement;
    if (el && el !== document.body) return;
    const next = view.phase === 'pick'
      ? riverRef.current?.querySelector<HTMLElement>('.md-river__slot [role="button"]')
      : view.phase === 'act'
        ? handRef.current?.querySelector<HTMLElement>('.md-action')
        : null;
    next?.focus({ preventScroll: true });
  }, [view.phase]);

  const ticker = view.log.filter((e) => e.visibility === 'all').slice(-2).reverse();

  /* ---------------- the world ----------------
     Read off the PRESENTED view, like everything else that is drawn, so
     the light moves when the beat lands and not when the truth does. */
  // A decision made in the river lights the river; a boost is on the rail.
  const focus = shown.phase === 'choice' && choice && choice.kind !== 'boost-target' ? 'river' : FOCUS[shown.phase];
  const worldMood = {
    // Found: the threat light floods past the edge it reaches at two strikes.
    threat: shown.phase === 'encounter' ? 1.4 : shown.strikes / Math.max(1, shown.rules.encounterAt),
    progress: shown.progress / Math.max(1, shown.rules.escapeTarget),
    dim: shown.outcome === 'lost' ? 1 : 0,
    bloom: shown.outcome === 'through' ? 1 : 0,
  };
  // The world's wash: a turned card's colour, or a roll's verdict as it lands.
  const [worldFlash, setWorldFlash] = React.useState<{ key: string; category: CardCategory } | null>(null);
  const revealed = shown.revealed;
  const revealKey = revealed ? `${shown.round}:${shown.turn}:${revealed.slot}` : null;
  React.useEffect(() => {
    if (revealKey && revealed) setWorldFlash({ key: `r:${revealKey}`, category: revealed.category });
    // Once per card turned.
  }, [revealKey]);
  const onLanded = (verdict: boolean | null) => {
    if (verdict === null || !check) return;
    // The roll's colours: success in the Obstacle's green, failure in the Monster's red.
    setWorldFlash({ key: `v:${view.round}:${view.turn}:${check.d20}`, category: verdict ? 'obstacle' : 'monster' });
  };
  const [worldChoice, setWorldChoice] = useWorldChoice();
  const handStyle = { '--n': view.rules.abilities.length } as React.CSSProperties;

  return (
    <div
      className="t-table"
      data-shake={stage.active?.kind === 'strike' || undefined}
      data-outcome={shown.outcome ?? undefined}
      data-focus={focus ?? undefined}
      data-chronicle={chronicle || undefined}
      data-narrow={fit.narrow || undefined}
    >
      <World
        biome={biome}
        mood={worldMood}
        focus={focus === 'river' ? { name: focus, ref: riverRef } : focus === 'actions' ? { name: focus, ref: handRef } : null}
        flash={worldFlash}
      />

      <header className="t-top">
        <div className="t-top__run">
          <h1 className="t-top__title">{runName}</h1>
          <p className="t-top__meta">
            {biome.name} · Round {shown.round} · {deckCount} cards left · DC {view.rules.mazeDc}
          </p>
        </div>

        <div className="t-tracks t-top__tracks">
          {/* Keyed on the value, as on the old board: a pip filling
              remounts the track and its glow and pop play on mount. */}
          <div className="t-track" key={`e${shown.progress}`}>
            <ScoreTrack value={shown.progress} total={shown.rules.escapeTarget} />
          </div>
          <div className="t-track" key={`t${shown.strikes}`}>
            <ScoreTrack value={shown.strikes} total={shown.rules.encounterAt} variant="threat" />
          </div>
        </div>

        <div className="t-top__tools">
          {hostCode ? (
            <p className="t-top__join">Players join with <span className="t-code-inline">{hostCode}</span></p>
          ) : null}
          <button
            type="button" className="t-btn" aria-expanded={chronicle} aria-controls="t-chronicle"
            onClick={toggleChronicle}
          >
            Chronicle
          </button>
          <button type="button" className="t-btn" onClick={() => setGmOpen(true)}>GM</button>
        </div>
      </header>

      {/* The stage: the vista, the caption under it, and the surface the
          river lies on. The river is sized first (useTableFit) and the
          vista takes whatever height it leaves — on a big screen a
          landscape, on a small laptop nothing at all. */}
      <div className="t-stage" ref={stageRef}>
      <Vista biome={biome} prompt={prompt} />

      {/* Reserved from the first turn, as on the old board since world/0,
          so a scene arriving mid-flip moves nothing. Empty on a player
          preview, but kept, so the preview has the same geometry. The
          kicker names the card as this setting does — a Switchback, not
          a Clear Path; the card's own eyebrow keeps the canonical name. */}
      <div
        className="t-scene"
        ref={sceneRef}
        data-empty={prompt ? undefined : true}
        data-category={prompt?.category}
        aria-live="polite"
      >
        <span className="t-kicker">
          {prompt ? biome.cards?.[prompt.category]?.title ?? getCategory(prompt.category).title : 'The scene'}
        </span>
        <p className="t-scene__text">{prompt?.text ?? ''}</p>
      </div>

      <div className="t-surface" data-narrow={fit.narrow || undefined} data-fan={fanCards ? true : undefined}>
        <div className="t-surface__pile t-surface__pile--deck" ref={deckRef}>
          <DeckPile count={deckCount} size={fit.piles} />
          {/* It's Elementary's chosen card, held up off the deck while its
              slot is chosen. After the pile, so the stage's deal still
              measures the pile's own top card. */}
          {swapCard ? (
            <div className="t-held" aria-hidden="true">
              <MazeDeckProvider size={fit.piles} background="transparent">
                <DeckCard category={swapCard} showCount={false} />
              </MazeDeckProvider>
            </div>
          ) : null}
        </div>

        <div
          className="t-river"
          ref={riverRef}
          data-covered={stage.covered.length ? stage.covered.join(' ') : undefined}
          data-settled={settling === null ? undefined : String(settling)}
          data-pickable={a.pickSlots.length ? true : undefined}
          data-raised={raisedSlots.length ? raisedSlots.join(' ') : undefined}
          data-dim={fanCards ? true : undefined}
        >
          <River
            className="t-river__ground"
            size={fit.river}
            slots={shown.river.map((s) => (
              s.filled
                ? { category: s.category ?? 'clear-path', faceDown: !s.faceUp }
                : { category: null, faceDown: false }
            ))}
            {...(a.pickSlots.length
              ? { onPick: (i: number) => act({ type: 'PICK_SLOT', index: i }) }
              : {})}
          />
          {view.phase === 'act' && a.obstacleSlots.length ? (
            <ObstacleWork
              riverRef={riverRef}
              slots={a.obstacleSlots}
              layoutKey={`${fit.river}|${fit.narrow}|${chronicle}|${shown.river.map((s) => `${s.category}${s.faceUp}`).join()}`}
              mazeDc={view.rules.mazeDc}
              suggest={suggest}
              onAttempt={(slot, score, dc) => act({ type: 'ATTEMPT_OBSTACLE', slot, score, dc })}
            />
          ) : null}

          {choice?.kind === 'wanderer-stays' ? (
            <SlotLayer riverRef={riverRef} slots={[choice.slot]} layoutKey={`${fit.river}|${fit.narrow}|${chronicle}|${shown.river.map((s) => `${s.category}${s.faceUp}`).join()}`} className="t-decide">
              {() => (
                <div className="t-decide__pair">
                  <button type="button" className="t-btn" data-choice="" autoFocus
                    onClick={() => resolve({ kind: 'wanderer-stays', stays: true })}>
                    They stay
                  </button>
                  <button type="button" className="t-btn t-btn--primary" data-choice=""
                    onClick={() => resolve({ kind: 'wanderer-stays', stays: false })}>
                    They move on
                  </button>
                </div>
              )}
            </SlotLayer>
          ) : null}

          {choice?.kind === 'discard-revealed' ? (
            <SlotLayer riverRef={riverRef} slots={choice.slots} layoutKey={`${fit.river}|${fit.narrow}|${chronicle}|${shown.river.map((s) => `${s.category}${s.faceUp}`).join()}`} className="t-decide">
              {(slot) => (
                <button type="button" className="t-btn t-btn--danger t-decide__strike" data-choice=""
                  autoFocus={slot === choice.slots[0]}
                  onClick={() => resolve({ kind: 'discard-revealed', slot })}>
                  Strike the {position(slot)}
                </button>
              )}
            </SlotLayer>
          ) : null}

          {choice?.kind === 'swap-river' && swapPick !== null && swapCard ? (
            <SlotLayer
              riverRef={riverRef}
              slots={view.river.flatMap((x, i) => (x.filled ? [i] : []))}
              layoutKey={`${fit.river}|${fit.narrow}|${chronicle}|${shown.river.map((s) => `${s.category}${s.faceUp}`).join()}`}
              className="t-decide t-decide--target"
            >
              {(slot) => (
                <button type="button" className="t-btn t-btn--primary" data-choice=""
                  autoFocus={slot === view.river.findIndex((x) => x.filled)}
                  onClick={() => {
                    const held = deckRef.current?.querySelector('.t-held article')?.getBoundingClientRect();
                    if (held) fly(swapCard, held, slotRect(slot));
                    resolve({ kind: 'swap-river', cardIndex: swapPick, slot });
                  }}>
                  Put it in the {position(slot)}
                </button>
              )}
            </SlotLayer>
          ) : null}
        </div>

        {/* Keyed on the count so a new top card remounts and drops. */}
        <div
          className="t-surface__pile t-surface__pile--discard t-drop"
          ref={discardRef}
          key={shown.discardCount}
        >
          <DiscardPile
            count={discardCount}
            size={fit.piles}
            {...(shown.discardTop ? { top: shown.discardTop } : {})}
          />
        </div>

        {fanCards && choice ? (
          <CardFan
            key={choiceKey}
            cards={fanCards}
            size={fit.river}
            deckRef={deckRef}
            selected={swapPick}
            verb={choice.kind === 'scout-top' ? 'Put on top of the deck' : 'Swap into the river'}
            onPick={(i, el) => {
              if (choice.kind === 'scout-top') {
                const card = choice.cards[i];
                if (card) fly(card, el.getBoundingClientRect(), deckTop());
                resolve({ kind: 'scout-top', cardIndex: i });
              } else {
                setSwapPick(i);
              }
            }}
          />
        ) : null}
      </div>
      </div>

      <div className="t-bottom">
        <div className="t-rail" data-choosing={boosting || undefined}>
          <div className="t-seats" ref={seatsRef}>
            <SeatBaton containerRef={seatsRef} index={batonIndex} />
            {shown.order.map((id, i) => {
              const s = shown.seats.find((x) => x.id === id);
              if (!s) return null;
              const boosted = shown.advantage.includes(id);
              return (
                <PlayerSeat
                  key={id}
                  name={s.name}
                  order={i + 1}
                  active={i === activeIdx && shown.phase !== 'over'}
                  {...(boosted ? { className: 't-seat--boosted' } : {})}
                  detail={[s.cls, boosted ? 'advantage' : null].filter(Boolean).join(' · ')}
                  {...(boosting ? { onSelect: () => resolve({ kind: 'boost-target', seatId: id }) } : {})}
                />
              );
            })}
          </div>
        </div>

        <div className="t-handwrap">
        {/* What is being decided, where the hand would rise. Announced. */}
        <div className="t-ask" role="status" aria-live="polite" data-shown={ask ? true : undefined}>
          {ask ? (
            <>
              <p className="t-kicker">{decider} decides</p>
              <p className="t-ask__title">{ask.title}</p>
              <p className="t-ask__note">{ask.note}</p>
              {swapCard ? (
                <button type="button" className="t-btn t-ask__back" onClick={() => setSwapPick(null)}>
                  Choose the other card
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="t-hand" ref={handRef} data-raised={raised || undefined} data-asking={ask ? true : undefined} style={handStyle}>
          <MazeDeckProvider size="md" className="t-hand__cards" background="transparent">
            <ActionBar
              className="t-hand__strip"
              abilities={view.rules.abilities}
              showDc={false}
              {...(raised ? { onUse: (ability) => act({ type: 'USE_ABILITY', ability }) } : {})}
            />
          </MazeDeckProvider>
        </div>
        </div>

        <div className="t-ticker">
          {ticker.map((e) => (
            <p className="t-ticker__line" key={e.n}>{e.text}</p>
          ))}
        </div>
      </div>

      {chronicle ? (
        <aside className="t-chronicle" id="t-chronicle" aria-label="The chronicle">
          <button
            type="button" className="t-btn t-chronicle__close" aria-label="Close the chronicle"
            onClick={toggleChronicle}
          >
            ×
          </button>
          <EventLog log={view.log} />
        </aside>
      ) : null}

      <StageOverlay overlay={stage.overlay} deals={stage.deals} size={fit.river} />

      {/* Fixed, so a notice arriving never moves the river (world/0). */}
      {error ? <p className="t-toast" role="alert">{error}</p> : null}

      {/* The decisions, still the old board's centred dialogs. */}
      {/* The roll: the centred, blocking dialog of feel/3b, at the size of
          the moment (D3). */}
      {check ? (
        <Modal label="A roll is on the table">
          <RollStage
            seats={view.seats}
            check={check}
            card={rollCard}
            attempt={attempt}
            onLanded={onLanded}
            onEnterRoll={(d20, d20b) => act(
              d20b === undefined ? { type: 'ENTER_ROLL', d20 } : { type: 'ENTER_ROLL', d20, d20b },
            )}
            onConfirm={(success) => act(
              success === undefined ? { type: 'CONFIRM_CHECK' } : { type: 'CONFIRM_CHECK', success },
            )}
          />
        </Modal>
      ) : null}

      {view.phase === 'encounter' ? (
        <Encounter
          monster={biome.cards?.monster.title ?? getCategory('monster').title}
          onResolve={(outcome) => dispatch(
            outcome === 'won' ? { type: 'RESOLVE_ENCOUNTER', won: true }
              : outcome === 'away' ? { type: 'RESOLVE_ENCOUNTER', won: false }
                : { type: 'RESOLVE_ENCOUNTER', won: false, endRun: true },
          )}
        />
      ) : null}

      <Ghosts ghosts={ghosts} onDone={ghostLanded} />

      {view.phase === 'over' && endingShown ? (
        <Modal label="The run is closed">
          <div className={`t-panel ${view.outcome === 'through' ? 't-panel--live' : 't-panel--bad'}`}>
            <h2 className="t-panel__title">
              {view.outcome === 'through' ? 'The party is through' : 'The run is closed'}
            </h2>
            <p className="t-note">
              {view.outcome === 'through'
                ? `${view.progress} Clear Paths in ${view.round} rounds. Start the scene on the far side.`
                : 'Note where they got to, and pick it up from there.'}
            </p>
            <div className="t-row t-row--centre" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
              <button type="button" className="t-btn t-btn--primary" onClick={onExit}>
                Back to the campaign
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <Drawer label="The GM" open={gmOpen} onOpenChange={setGmOpen}>
        <div className="t-drawer__body">
          {hostCode ? (
            <p className="t-note">Players join with <span className="t-code-inline">{hostCode}</span></p>
          ) : null}
          <button type="button" className="t-btn" onClick={onExit}>Back to the campaign</button>
          <button
            type="button"
            className="t-btn"
            aria-pressed={asPlayer}
            onClick={onTogglePlayerView}
            title="Rebuild this screen from the data a player's device would actually receive"
          >
            {asPlayer ? 'Seeing a player’s screen' : 'Preview a player’s screen'}
          </button>
          <SoundToggle />
          <label className="t-biome-switch" title="How much of the setting this device draws behind the table. Auto steps down if the device cannot keep up; Off is the old animated ground.">
            <span>Atmosphere</span>
            <select
              value={worldChoice}
              onChange={(e) => setWorldChoice(e.target.value as WorldChoice)}
            >
              {WORLD_CHOICES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {onPreviewBiome ? (
            <label className="t-biome-switch" title="Look at the board in another setting. Only this screen changes; the run and every other device keep the run's own.">
              <span>Setting</span>
              <select
                value={previewBiome ?? ''}
                onChange={(e) => onPreviewBiome(isBiomeId(e.target.value) ? e.target.value : null)}
              >
                <option value="">The run’s own</option>
                {BIOMES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="t-btn"
            onClick={onSwitchBoard}
            title="The board as it was before the overhaul. Remembered on this device."
          >
            Use the old board
          </button>
          {view.phase !== 'over' ? (
            <button
              type="button" className="t-btn t-btn--danger"
              onClick={() => { setGmOpen(false); act({ type: 'END_RUN' }); }}
            >
              End the run
            </button>
          ) : null}
          <p className="t-note">Saved as you go — closing the tab loses nothing.</p>
        </div>
      </Drawer>
    </div>
  );
}

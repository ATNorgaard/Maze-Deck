import * as React from 'react';
import {
  ActionBar, DeckPile, DiscardPile, MazeDeckProvider, PlayerSeat, River, ScoreTrack, getCategory,
} from '@maze-deck/ui';
import { availableFor } from '@maze-deck/rules';
import type { ChoicePayload, GameAction, GameView, Phase } from '@maze-deck/rules';
import { CheckPanel } from '../components/CheckPanel';
import { ChoicePanel } from '../components/ChoicePanel';
import { Drawer } from '../components/Drawer';
import { EventLog } from '../components/EventLog';
import { Modal } from '../components/Modal';
import { ObstacleWork } from '../components/ObstacleWork';
import type { Suggestion } from '../components/ObstacleWork';
import { SeatBaton } from '../components/SeatBaton';
import { SoundToggle } from '../components/SoundToggle';
import { Vista } from '../components/Vista';
import { BIOMES, isBiomeId } from '../biomes';
import type { Biome, BiomeId } from '../biomes';
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

function readOpen(key: string): boolean {
  try { return window.localStorage.getItem(key) === 'open'; } catch { return false; }
}
function writeOpen(key: string, open: boolean): void {
  try { window.localStorage.setItem(key, open ? 'open' : 'closed'); } catch { /* blocked: not remembered */ }
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

  const ticker = view.log.filter((e) => e.visibility === 'all').slice(-2).reverse();

  /* ---------------- the world ----------------
     Read off the PRESENTED view, like everything else that is drawn, so
     the light moves when the beat lands and not when the truth does. */
  const focus = FOCUS[shown.phase];
  const worldMood = {
    threat: shown.strikes / Math.max(1, shown.rules.encounterAt),
    progress: shown.progress / Math.max(1, shown.rules.escapeTarget),
    dim: shown.outcome === 'lost' ? 1 : 0,
    bloom: shown.outcome === 'through' ? 1 : 0,
  };
  const worldFlash = shown.revealed
    ? { key: `${shown.round}:${shown.turn}:${shown.revealed.slot}`, category: shown.revealed.category }
    : null;
  const [worldChoice, setWorldChoice] = useWorldChoice();
  const handStyle = { '--n': view.rules.abilities.length } as React.CSSProperties;

  return (
    <div
      className="t-table"
      data-shake={stage.active?.kind === 'strike' || undefined}
      data-outcome={shown.outcome ?? undefined}
      data-focus={FOCUS[shown.phase] ?? undefined}
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

      <div className="t-surface" data-narrow={fit.narrow || undefined}>
        <div className="t-surface__pile t-surface__pile--deck" ref={deckRef}>
          <DeckPile count={deckCount} size={fit.piles} />
        </div>

        <div
          className="t-river"
          ref={riverRef}
          data-covered={stage.covered.length ? stage.covered.join(' ') : undefined}
          data-settled={settling === null ? undefined : String(settling)}
          data-pickable={a.pickSlots.length ? true : undefined}
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
      </div>
      </div>

      <div className="t-bottom">
        <div className="t-rail">
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
                />
              );
            })}
          </div>
        </div>

        <div className="t-hand" ref={handRef} data-raised={raised || undefined} style={handStyle}>
          <MazeDeckProvider size="md" className="t-hand__cards" background="transparent">
            <ActionBar
              className="t-hand__strip"
              abilities={view.rules.abilities}
              showDc={false}
              {...(raised ? { onUse: (ability) => act({ type: 'USE_ABILITY', ability }) } : {})}
            />
          </MazeDeckProvider>
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
      {view.phase === 'check' && pending?.kind === 'check' ? (
        <Modal label="A roll is on the table">
          <CheckPanel
            seats={view.seats}
            check={pending}
            onEnterRoll={(d20, d20b) => act(
              d20b === undefined ? { type: 'ENTER_ROLL', d20 } : { type: 'ENTER_ROLL', d20, d20b },
            )}
            onConfirm={(success) => act(
              success === undefined ? { type: 'CONFIRM_CHECK' } : { type: 'CONFIRM_CHECK', success },
            )}
          />
        </Modal>
      ) : null}

      {view.phase === 'choice' && pending?.kind === 'choice' ? (
        <Modal label="A decision is owed">
          <ChoicePanel
            view={view}
            choice={pending.choice}
            onResolve={(payload: ChoicePayload) => act({ type: 'RESOLVE_CHOICE', payload })}
          />
        </Modal>
      ) : null}

      {view.phase === 'encounter' ? (
        <Modal label="The party is found">
          <div className="t-panel t-panel--bad">
            <h2 className="t-panel__title">Roll initiative</h2>
            <p className="t-note">
              Two strikes: something has found them. Run the fight at the table.
              Winning takes a Monster out of the deck for good and the crossing
              carries on.
            </p>
            <div className="t-row t-row--centre" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
              <button
                type="button" className="t-btn t-btn--primary"
                onClick={() => dispatch({ type: 'RESOLVE_ENCOUNTER', won: true })}
              >
                They won
              </button>
              <button
                type="button" className="t-btn"
                onClick={() => dispatch({ type: 'RESOLVE_ENCOUNTER', won: false })}
              >
                They got away
              </button>
              <button
                type="button" className="t-btn t-btn--danger"
                onClick={() => dispatch({ type: 'RESOLVE_ENCOUNTER', won: false, endRun: true })}
              >
                It ends here
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

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

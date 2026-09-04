import * as React from 'react';
import {
  ActionBar, DeckPile, DiscardPile, MazeDeckProvider, PlayerSeat, River, ScoreTrack,
} from '@maze-deck/ui';
import { activeSeatOf, availableFor } from '@maze-deck/rules';
import type {
  AbilityScore, ChoicePayload, GameAction, GameView, Phase,
} from '@maze-deck/rules';
import { CheckPanel } from '../components/CheckPanel';
import { ChoicePanel } from '../components/ChoicePanel';
import { EventLog } from '../components/EventLog';
import { Modal } from '../components/Modal';
import type { Biome } from '../biomes';
import { SCORES } from '../campaign';
import { StageOverlay } from '../stage/StageOverlay';
import { useStage } from '../stage/useStage';
import { useTicking } from '../stage/useTicking';
import type { DrawnPrompt } from '../tables';
import { useFittingSize } from '../useFittingSize';

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
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

const PHASE_TITLE: Record<Phase, string> = {
  act: 'Take an action',
  check: 'A roll is on the table',
  choice: 'A decision is owed',
  pick: 'Commit to a path',
  reveal: 'The path is turned over',
  encounter: 'The party is found',
  over: 'The run is closed',
};

const PHASE_NOTE: Record<Phase, string> = {
  act: 'One action, then a path — never the other way round.',
  check: 'Read it out, then let it land.',
  choice: 'The action is not finished until this is answered.',
  pick: 'Pick a path from the river. Everyone sees what it is.',
  reveal: 'Describe the scene while it lands.',
  encounter: 'Run the fight at your table, then say how it went.',
  over: 'Copy the log into your notes and pick the scene back up.',
};

export function SessionScreen({
  view, biome, dispatch, onExit, runName, prompt, asPlayer, onTogglePlayerView,
  hostCode, error,
}: Props) {
  const [score, setScore] = React.useState<AbilityScore>('STR');
  const [dcNudge, setDcNudge] = React.useState(0);
  const riverRef = React.useRef<HTMLDivElement>(null);
  const discardRef = React.useRef<HTMLDivElement>(null);
  const riverSize = useFittingSize(riverRef);

  // The truth decides what may be done; the stage decides what is drawn.
  // `view` feeds the controls and the modals, `shown` feeds the river,
  // the piles, the tracks and the signpost, and lags by whatever beat is
  // still playing. Any input drops the queue first.
  const deckRef = React.useRef<HTMLDivElement>(null);
  const stage = useStage(view, { riverRef, discardRef, deckRef });
  const shown = stage.presented;
  const deckCount = useTicking(shown.deckCount);
  const discardCount = useTicking(shown.discardCount);
  const act = (action: GameAction) => { stage.flush(); dispatch(action); };

  const a = availableFor(view);
  const seat = activeSeatOf(view);
  const activeIdx = shown.turn % Math.max(shown.order.length, 1);
  const pending = view.pending;

  // A Wanderer that moves on is a depart beat like any other: the
  // choice modal closes on the truth and the card flies on the stage.
  const onResolveChoice = (payload: ChoicePayload) => act({ type: 'RESOLVE_CHOICE', payload });

  // R6: the table entry suggests the check, the GM overrides before the
  // roll. Adopting it here rather than forcing a choice from cold.
  const suggestedScore = prompt?.score;
  const suggestedOffset = prompt?.dcOffset;
  React.useEffect(() => {
    if (suggestedScore === undefined) return;
    setScore(suggestedScore);
    setDcNudge(suggestedOffset ?? 0);
  }, [suggestedScore, suggestedOffset]);

  const obstacleDc = view.rules.mazeDc + dcNudge;

  const pulse = stage.active?.kind === 'progress' ? 'escape'
    : stage.active?.kind === 'strike' ? 'threat' : null;

  return (
    <div className="t-board">
      <div className="t-col t-col--side">
        <div className="t-panel">
          <h2 className="t-panel__title">
            {runName} <span className="t-panel__aside">DC {view.rules.mazeDc}</span>
          </h2>
          <p className="t-note">
            {biome.name} · Round {shown.round} · {deckCount} cards left
          </p>
          {hostCode ? (
            <p className="t-note" style={{ marginTop: 'calc(2 * var(--md-u))' }}>
              Players join with <span className="t-code-inline">{hostCode}</span>
            </p>
          ) : null}
        </div>

        <div className="t-panel">
          <h2 className="t-panel__title">Initiative</h2>
          <div className="t-seats">
            {shown.order.map((id, i) => {
              const s = shown.seats.find((x) => x.id === id);
              if (!s) return null;
              return (
                <PlayerSeat
                  key={id}
                  name={s.name}
                  order={i + 1}
                  active={i === activeIdx && shown.phase !== 'over'}
                  // Condensed, the seat's detail line is hidden and this is
                  // the only trace left of a Boost Morale. The circle wears it.
                  {...(shown.advantage.includes(id) ? { className: 't-seat--boosted' } : {})}
                  detail={[s.cls, shown.advantage.includes(id) ? 'advantage' : null]
                    .filter(Boolean).join(' · ')}
                />
              );
            })}
          </div>
        </div>

        <div className="t-panel t-board__controls">
          <div className="t-row">
            <button type="button" className="t-btn" onClick={onExit}>Campaign</button>
            <button
              type="button"
              className="t-btn"
              aria-pressed={asPlayer}
              onClick={onTogglePlayerView}
              title="Rebuild this screen from the data a player's device would actually receive"
            >
              {asPlayer ? 'Seeing a player’s screen' : 'Preview a player’s screen'}
            </button>
            {view.phase !== 'over' ? (
              <button
                type="button" className="t-btn t-btn--danger"
                onClick={() => act({ type: 'END_RUN' })}
              >
                End the run
              </button>
            ) : null}
          </div>
          <p className="t-note" style={{ marginTop: 'calc(2 * var(--md-u))' }}>
            Saved as you go — closing the tab loses nothing.
          </p>
        </div>
      </div>

      <div className="t-col t-col--board">
        <div className="t-tracks">
          <div className="t-track" data-pulse={pulse === 'escape' || undefined}>
            <ScoreTrack value={shown.progress} total={shown.rules.escapeTarget} />
          </div>
          <div className="t-track" data-pulse={pulse === 'threat' || undefined}>
            <ScoreTrack value={shown.strikes} total={shown.rules.encounterAt} variant="threat" />
          </div>
        </div>

        {error ? (
          <div className="t-panel t-panel--bad">
            <p className="t-note" style={{ color: 'var(--md-cat-mons-300)' }}>{error}</p>
          </div>
        ) : null}

        <div className="t-phase">
          <h2 className="t-phase__title">{PHASE_TITLE[shown.phase]}</h2>
          <p className="t-phase__note">
            {PHASE_NOTE[shown.phase]}
            {seat && shown.phase !== 'over' ? ` — ${seat.name}` : ''}
          </p>
          {prompt ? (
            <p className="t-phase__scene">
              <span className="t-kicker">The scene</span>
              {prompt.text}
            </p>
          ) : null}
        </div>

        <div
          className="t-river"
          ref={riverRef}
          data-covered={stage.covered.length ? stage.covered.join(' ') : undefined}
          data-pickable={a.pickSlots.length ? true : undefined}
        >
          <River
            size={riverSize}
            slots={shown.river.map((s) => (
              s.filled
                ? { category: s.category ?? 'clear-path', faceDown: !s.faceUp }
                : { category: null, faceDown: false }
            ))}
            {...(a.pickSlots.length
              ? { onPick: (i: number) => act({ type: 'PICK_SLOT', index: i }) }
              : {})}
          />
        </div>

        <div className="t-piles">
          <div ref={deckRef}>
            <DeckPile count={deckCount} size="sm" />
          </div>
          {/* Keyed on the count so a new top card remounts the wrapper
              and its drop plays again. */}
          <div ref={discardRef} className="t-drop" key={shown.discardCount}>
            <DiscardPile
              count={discardCount}
              size="sm"
              {...(shown.discardTop ? { top: shown.discardTop } : {})}
            />
          </div>
        </div>

        <div className="t-actions">
          {view.phase === 'act' ? (
            <>
              {/* Transparent: the page behind it carries the setting's
                  light, and a solid ink-900 block would sit on it as a
                  visible rectangle. */}
              <MazeDeckProvider size="lg" className="t-actions__bar" background="transparent">
                <ActionBar
                  abilities={view.rules.abilities}
                  showDc={false}
                  onUse={(ability) => act({ type: 'USE_ABILITY', ability })}
                />
              </MazeDeckProvider>
              {a.obstacleSlots.length ? (
                <div className="t-row t-row--centre" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
                  <span className="t-kicker">Or work on what is blocking them:</span>
                  <select
                    className="t-input"
                    style={{ width: 'calc(24 * var(--md-u))' }}
                    aria-label="Ability the obstacle calls for"
                    value={score}
                    onChange={(e) => setScore(e.target.value as AbilityScore)}
                  >
                    {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    className="t-input"
                    style={{ width: 'calc(34 * var(--md-u))' }}
                    aria-label="Difficulty of the attempt"
                    value={String(dcNudge)}
                    onChange={(e) => setDcNudge(Number(e.target.value))}
                  >
                    {[-2, -1, 0, 1, 2].map((n) => (
                      <option key={n} value={n}>DC {view.rules.mazeDc + n}</option>
                    ))}
                  </select>
                  {a.obstacleSlots.map((i) => (
                    <button
                      key={i} type="button" className="t-btn"
                      onClick={() => act({
                        type: 'ATTEMPT_OBSTACLE', slot: i, score, dc: obstacleDc,
                      })}
                    >
                      Clear the {position(i)}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="t-col t-col--side">
        <EventLog log={view.log} />
      </div>

      <StageOverlay overlay={stage.overlay} deals={stage.deals} size={riverSize} />

      {view.phase === 'check' && pending?.kind === 'check' ? (
        <Modal label="A roll is on the table">
          <CheckPanel
            seats={view.seats}
            check={pending}
            onEnterRoll={(d20, d20b) => dispatch(
              d20b === undefined
                ? { type: 'ENTER_ROLL', d20 }
                : { type: 'ENTER_ROLL', d20, d20b },
            )}
            onConfirm={(success) => dispatch(
              success === undefined
                ? { type: 'CONFIRM_CHECK' }
                : { type: 'CONFIRM_CHECK', success },
            )}
          />
        </Modal>
      ) : null}

      {view.phase === 'choice' && pending?.kind === 'choice' ? (
        <Modal label="A decision is owed">
          <ChoicePanel
            view={view}
            choice={pending.choice}
            onResolve={onResolveChoice}
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

      {view.phase === 'over' ? (
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
    </div>
  );
}

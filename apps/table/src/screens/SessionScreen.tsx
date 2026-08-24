import * as React from 'react';
import {
  ActionBar, DeckPile, DiscardPile, MazeDeckProvider, PlayerSeat, River, ScoreTrack,
} from '@maze-deck/ui';
import { activeSeat, available } from '@maze-deck/rules';
import type {
  AbilityScore, ChoicePayload, GameAction, GameState,
} from '@maze-deck/rules';
import { CardFlight } from '../components/CardFlight';
import type { FlightRequest } from '../components/CardFlight';
import { CheckPanel } from '../components/CheckPanel';
import { ChoicePanel } from '../components/ChoicePanel';
import { EventLog } from '../components/EventLog';
import { Modal } from '../components/Modal';
import { SCORES } from '../campaign';
import type { DrawnPrompt } from '../tables';
import { useFittingSize } from '../useFittingSize';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  onExit: () => void;
  runName: string;
  /** The line drawn for the card in front of the table, if any. */
  prompt: DrawnPrompt | null;
  error: string | null;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

const PHASE_TITLE: Record<GameState['phase'], string> = {
  act: 'Take an action',
  check: 'A roll is on the table',
  choice: 'A decision is owed',
  pick: 'Commit to a path',
  reveal: 'The path is turned over',
  encounter: 'The party is found',
  over: 'The run is closed',
};

const PHASE_NOTE: Record<GameState['phase'], string> = {
  act: 'One action, then a path — never the other way round.',
  check: 'Read it out, then let it land.',
  choice: 'The action is not finished until this is answered.',
  pick: 'Pick a path from the river. Everyone sees what it is.',
  reveal: 'Describe the scene while it lands.',
  encounter: 'Run the fight at your table, then say how it went.',
  over: 'Copy the log into your notes and pick the scene back up.',
};

export function SessionScreen({
  state, dispatch, onExit, runName, prompt, error,
}: Props) {
  const [score, setScore] = React.useState<AbilityScore>('STR');
  const [dcNudge, setDcNudge] = React.useState(0);
  const [covered, setCovered] = React.useState<number | null>(null);
  const [handFlight, setHandFlight] = React.useState<FlightRequest | null>(null);
  const riverRef = React.useRef<HTMLDivElement>(null);
  const discardRef = React.useRef<HTMLDivElement>(null);
  const riverSize = useFittingSize(riverRef);

  const a = available(state);
  const seat = state.order.length ? activeSeat(state) : null;
  const activeIdx = state.turn % Math.max(state.order.length, 1);
  const pending = state.pending;
  const revealed = a.revealed;

  const revealSlot = revealed?.slot;
  const revealCategory = revealed?.category;
  const revealLeaves = revealed?.leavesRiver;

  // The engine's own reveal: turn the card over, then send it on — but
  // only if it is actually leaving.
  const revealFlight = React.useMemo<FlightRequest | null>(() => {
    if (revealSlot === undefined || revealCategory === undefined) return null;
    return {
      slot: revealSlot,
      category: revealCategory,
      flip: true,
      fly: revealLeaves === true,
      onDone: () => dispatch({ type: 'ADVANCE_REVEAL' }),
    };
  }, [revealSlot, revealCategory, revealLeaves, dispatch]);

  const flight = handFlight ?? revealFlight;

  /**
   * A Wanderer is turned over on the reveal but does not leave until
   * the GM says they do not linger, so its trip to the discard is
   * staged here rather than as part of the reveal.
   */
  const onResolveChoice = (payload: ChoicePayload) => {
    const choice = pending?.kind === 'choice' ? pending.choice : null;
    if (
      payload.kind === 'wanderer-stays' && !payload.stays
      && choice?.kind === 'wanderer-stays'
    ) {
      const leaving = state.river[choice.slot]?.category;
      if (leaving) {
        setHandFlight({
          slot: choice.slot,
          category: leaving,
          flip: false,
          fly: true,
          onDone: () => {
            setHandFlight(null);
            dispatch({ type: 'RESOLVE_CHOICE', payload });
          },
        });
        return;
      }
    }
    dispatch({ type: 'RESOLVE_CHOICE', payload });
  };

  // R6: the table entry suggests the check, the GM overrides before the
  // roll. Adopting it here rather than forcing a choice from cold.
  const suggestedScore = prompt?.score;
  const suggestedOffset = prompt?.dcOffset;
  React.useEffect(() => {
    if (suggestedScore === undefined) return;
    setScore(suggestedScore);
    setDcNudge(suggestedOffset ?? 0);
  }, [suggestedScore, suggestedOffset]);

  const obstacleDc = state.config.mazeDc + dcNudge;

  const pulse = revealCategory === 'clear-path' ? 'escape'
    : revealCategory === 'monster' ? 'threat' : null;

  return (
    <div className="t-board">
      <div className="t-col t-col--side">
        <div className="t-panel">
          <h2 className="t-panel__title">
            {runName} <span className="t-panel__aside">DC {state.config.mazeDc}</span>
          </h2>
          <p className="t-note">Round {state.round} · {state.deck.length} cards left</p>
        </div>

        <div className="t-panel">
          <h2 className="t-panel__title">Initiative</h2>
          <div className="t-seats">
            {state.order.map((id, i) => {
              const s = state.config.seats.find((x) => x.id === id);
              if (!s) return null;
              return (
                <PlayerSeat
                  key={id}
                  name={s.name}
                  order={i + 1}
                  active={i === activeIdx && state.phase !== 'over'}
                  detail={[s.cls, state.advantage.includes(id) ? 'advantage' : null]
                    .filter(Boolean).join(' · ')}
                />
              );
            })}
          </div>
        </div>

        <div className="t-panel">
          <div className="t-row">
            <button type="button" className="t-btn" onClick={onExit}>Campaign</button>
            {state.phase !== 'over' ? (
              <button
                type="button" className="t-btn t-btn--danger"
                onClick={() => dispatch({ type: 'END_RUN' })}
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
            <ScoreTrack value={state.progress} total={state.config.escapeTarget} />
          </div>
          <div className="t-track" data-pulse={pulse === 'threat' || undefined}>
            <ScoreTrack value={state.strikes} total={state.config.encounterAt} variant="threat" />
          </div>
        </div>

        {error ? (
          <div className="t-panel t-panel--bad">
            <p className="t-note" style={{ color: 'var(--md-cat-mons-300)' }}>{error}</p>
          </div>
        ) : null}

        <div className="t-phase">
          <h2 className="t-phase__title">{PHASE_TITLE[state.phase]}</h2>
          <p className="t-phase__note">
            {PHASE_NOTE[state.phase]}
            {seat && state.phase !== 'over' ? ` — ${seat.name}` : ''}
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
          data-covered={covered === null ? undefined : String(covered)}
          data-pickable={a.pickSlots.length ? true : undefined}
        >
          <River
            size={riverSize}
            slots={state.river.map((s) => ({ category: s.category, faceDown: !s.faceUp }))}
            {...(a.pickSlots.length
              ? { onPick: (i: number) => dispatch({ type: 'PICK_SLOT', index: i }) }
              : {})}
          />
        </div>

        <div className="t-piles">
          <DeckPile count={state.deck.length} size="sm" />
          <div ref={discardRef}>
            <DiscardPile
              count={state.discard.length}
              size="sm"
              {...(state.discard.length
                ? { top: state.discard[state.discard.length - 1] }
                : {})}
            />
          </div>
        </div>

        <div className="t-actions">
          {state.phase === 'act' ? (
            <>
              <MazeDeckProvider size="lg" className="t-actions__bar">
                <ActionBar
                  abilities={state.config.abilities}
                  showDc={false}
                  onUse={(ability) => dispatch({ type: 'USE_ABILITY', ability })}
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
                      <option key={n} value={n}>DC {state.config.mazeDc + n}</option>
                    ))}
                  </select>
                  {a.obstacleSlots.map((i) => (
                    <button
                      key={i} type="button" className="t-btn"
                      onClick={() => dispatch({
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
        <EventLog log={state.log} />
      </div>

      <CardFlight
        request={flight}
        size={riverSize}
        riverRef={riverRef}
        discardRef={discardRef}
        onOccupy={setCovered}
      />

      {state.phase === 'check' && pending?.kind === 'check' ? (
        <Modal label="A roll is on the table">
          <CheckPanel
            state={state}
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

      {/* Stand the modal down while the Wanderer is on its way out, so
          the card being discarded is actually visible leaving. */}
      {state.phase === 'choice' && pending?.kind === 'choice' && !handFlight ? (
        <Modal label="A decision is owed">
          <ChoicePanel
            state={state}
            choice={pending.choice}
            onResolve={onResolveChoice}
          />
        </Modal>
      ) : null}

      {state.phase === 'encounter' ? (
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

      {state.phase === 'over' ? (
        <Modal label="The run is closed">
          <div className={`t-panel ${state.outcome === 'through' ? 't-panel--live' : 't-panel--bad'}`}>
            <h2 className="t-panel__title">
              {state.outcome === 'through' ? 'The party is through' : 'The run is closed'}
            </h2>
            <p className="t-note">
              {state.outcome === 'through'
                ? `${state.progress} Clear Paths in ${state.round} rounds. Start the scene on the far side.`
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

import * as React from 'react';
import {
  ActionBar, ArchGlyph, DeckPile, DiscardPile, PlayerSeat, River, ScoreTrack,
} from '@maze-deck/ui';
import { activeSeat, available } from '@maze-deck/rules';
import type { AbilityScore, GameAction, GameState } from '@maze-deck/rules';
import { CheckPanel } from '../components/CheckPanel';
import { ChoicePanel } from '../components/ChoicePanel';
import { EventLog } from '../components/EventLog';
import { SCORES } from '../campaign';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  onExit: () => void;
  error: string | null;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

const PHASE_TITLE: Record<GameState['phase'], string> = {
  act: 'Take an action',
  check: 'A roll is on the table',
  choice: 'A decision is owed',
  pick: 'Commit to a path',
  encounter: 'The party is found',
  over: 'The run is closed',
};

const PHASE_NOTE: Record<GameState['phase'], string> = {
  act: 'One action, then a path — never the other way round.',
  check: 'Read it out, then let it land. You can overrule it first.',
  choice: 'The action is not finished until this is answered.',
  pick: 'Pick a path from the river. The card is not named aloud — describe the scene instead.',
  encounter: 'Run the fight at your table, then tell the app how it went.',
  over: 'Copy the log into your notes and pick the scene back up.',
};

export function SessionScreen({ state, dispatch, onExit, error }: Props) {
  const [asGm, setAsGm] = React.useState(true);
  const [score, setScore] = React.useState<AbilityScore>('STR');

  const a = available(state);
  const seat = state.order.length ? activeSeat(state) : null;
  const activeIdx = state.turn % Math.max(state.order.length, 1);
  const pending = state.pending;

  return (
    <>
      <div className="t-bar">
        <span className="t-brand">
          <span className="t-brand__glyph"><ArchGlyph state="seal" /></span>
          Maze Deck
        </span>
        <span className="t-kicker">Round {state.round}</span>
        <span className="t-kicker" style={{ color: 'var(--md-cat-path-300)' }}>
          {PHASE_TITLE[state.phase]}
        </span>
        {seat && state.phase !== 'over' ? (
          <span className="t-kicker">{seat.name}&rsquo;s turn</span>
        ) : null}
        <span className="t-spacer" />
        <button
          type="button"
          className="t-btn"
          aria-pressed={!asGm}
          onClick={() => setAsGm((v) => !v)}
          title="Show only what a player's own screen would receive"
        >
          {asGm ? 'Viewing as GM' : 'Viewing as player'}
        </button>
        <button type="button" className="t-btn" onClick={onExit}>Campaign</button>
      </div>

      <div className="t-main">
        <div className="t-stack">
          {error ? (
            <div className="t-panel t-panel--bad">
              <p className="t-note" style={{ color: 'var(--md-cat-mons-300)' }}>{error}</p>
            </div>
          ) : null}

          <div className="t-row">
            <ScoreTrack value={state.progress} total={state.config.escapeTarget} />
            <ScoreTrack value={state.strikes} total={state.config.encounterAt} variant="threat" />
          </div>

          <div className="t-centre">
            <River
              size="sm"
              slots={state.river.map((s) => ({
                category: s.category,
                faceDown: !s.faceUp,
              }))}
              {...(a.pickSlots.length
                ? { onPick: (i: number) => dispatch({ type: 'PICK_SLOT', index: i }) }
                : {})}
            />
          </div>

          <div className="t-row" style={{ justifyContent: 'center' }}>
            <DeckPile count={state.deck.length} size="sm" />
            <DiscardPile
              count={state.discard.length}
              size="sm"
              {...(asGm && state.discard.length
                ? { top: state.discard[state.discard.length - 1] }
                : {})}
            />
          </div>

          <div className="t-panel">
            <h2 className="t-panel__title">{PHASE_TITLE[state.phase]}</h2>
            <p className="t-note">{PHASE_NOTE[state.phase]}</p>
          </div>

          {state.phase === 'act' ? (
            <>
              <ActionBar
                abilities={state.config.abilities}
                dc={state.config.mazeDc}
                onUse={(ability) => dispatch({ type: 'USE_ABILITY', ability })}
              />
              {a.obstacleSlots.length ? (
                <div className="t-panel">
                  <h2 className="t-panel__title">Or work on what is blocking them</h2>
                  <p className="t-note">
                    Spending the action on a blocked path instead. You choose the
                    score the obstacle calls for.
                  </p>
                  <div className="t-row" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
                    <label className="t-field" style={{ maxWidth: 'calc(30 * var(--md-u))' }}>
                      <span>Ability</span>
                      <select
                        className="t-input"
                        value={score}
                        onChange={(e) => setScore(e.target.value as AbilityScore)}
                      >
                        {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    {a.obstacleSlots.map((i) => (
                      <button
                        key={i}
                        type="button"
                        className="t-btn"
                        onClick={() => dispatch({ type: 'ATTEMPT_OBSTACLE', slot: i, score })}
                      >
                        Clear the {position(i)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {state.phase === 'check' && pending?.kind === 'check' ? (
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
          ) : null}

          {state.phase === 'choice' && pending?.kind === 'choice' ? (
            <ChoicePanel
              state={state}
              choice={pending.choice}
              onResolve={(payload) => dispatch({ type: 'RESOLVE_CHOICE', payload })}
            />
          ) : null}

          {state.phase === 'encounter' ? (
            <div className="t-panel t-panel--bad">
              <h2 className="t-panel__title">Roll initiative</h2>
              <p className="t-note">
                Two strikes: something has found them. Run the fight at the table.
                Winning takes a Monster out of the deck for good and the crossing
                carries on.
              </p>
              <div className="t-row" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
                <button
                  type="button"
                  className="t-btn t-btn--primary"
                  onClick={() => dispatch({ type: 'RESOLVE_ENCOUNTER', won: true })}
                >
                  They won
                </button>
                <button
                  type="button"
                  className="t-btn"
                  onClick={() => dispatch({ type: 'RESOLVE_ENCOUNTER', won: false })}
                >
                  They got away
                </button>
                <button
                  type="button"
                  className="t-btn t-btn--danger"
                  onClick={() => dispatch({ type: 'RESOLVE_ENCOUNTER', won: false, endRun: true })}
                >
                  It ends here
                </button>
              </div>
            </div>
          ) : null}

          {state.phase === 'over' ? (
            <div className={`t-panel ${state.outcome === 'through' ? 't-panel--live' : 't-panel--bad'}`}>
              <h2 className="t-panel__title">
                {state.outcome === 'through' ? 'The party is through' : 'The run is closed'}
              </h2>
              <p className="t-note">
                {state.outcome === 'through'
                  ? `${state.progress} Clear Paths in ${state.round} rounds. Start the scene on the far side.`
                  : 'Note where they got to, and pick it up from there.'}
              </p>
              <div className="t-row" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
                <button type="button" className="t-btn t-btn--primary" onClick={onExit}>
                  Back to the campaign
                </button>
              </div>
            </div>
          ) : null}

          {state.phase !== 'over' ? (
            <div className="t-row">
              <button
                type="button"
                className="t-btn t-btn--danger"
                onClick={() => dispatch({ type: 'END_RUN' })}
              >
                End the run
              </button>
              <span className="t-note">
                Everything is saved as you go — closing the tab loses nothing.
              </span>
            </div>
          ) : null}
        </div>

        <div className="t-stack">
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

          <EventLog log={state.log} asGm={asGm} />
        </div>
      </div>
    </>
  );
}

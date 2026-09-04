import { ActionBar, DeckPile, DiscardPile, PlayerSeat, River, ScoreTrack } from '@maze-deck/ui';
import { activeSeatOf, availableFor, mayAct } from '@maze-deck/rules';
import type { ChoicePayload, GameAction, GameView } from '@maze-deck/rules';
import * as React from 'react';
import type { Biome } from '../biomes';
import { ChoicePanel } from '../components/ChoicePanel';
import { EventLog } from '../components/EventLog';
import { Modal } from '../components/Modal';
import { ScaleToFit } from '../components/ScaleToFit';
import { useFittingSize } from '../useFittingSize';

interface Props {
  view: GameView;
  /** The setting, as the server told this device. */
  biome: Biome;
  dispatch: (action: GameAction) => void;
  connected: boolean;
  error: string | null;
  onLeave: () => void;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

/**
 * A player's own device.
 *
 * Not the GM's board with buttons removed — a different screen. One
 * column, phone first, and only the controls that are theirs. What it
 * is *allowed* to show is already decided by the redaction; this
 * decides what is worth showing.
 */
export function PlayerScreen({ view, biome, dispatch, connected, error, onLeave }: Props) {
  const me = view.viewer.role === 'player' ? view.viewer.seatId : null;
  const a = availableFor(view);
  const active = activeSeatOf(view);
  const myTurn = active?.id === me;
  const seat = view.seats.find((s) => s.id === me);

  const pending = view.pending;
  const check = pending?.kind === 'check' ? pending : null;

  // Same mechanism the GM board uses: take the largest size step the
  // column can hold. On a laptop that is md or lg; on a phone it bottoms
  // out at sm and ScaleToFit takes it the rest of the way down.
  const boardRef = React.useRef<HTMLDivElement>(null);
  const riverSize = useFittingSize(boardRef);

  // The same check the server will run. Here it only decides whether a
  // control is worth offering; the server's answer is the one that counts.
  const mayPick = (index: number) =>
    mayAct(view, view.viewer, { type: 'PICK_SLOT', index }).ok;

  const myChoice = pending?.kind === 'choice'
    && mayAct(view, view.viewer, {
      type: 'RESOLVE_CHOICE',
      payload: pending.choice.kind === 'wanderer-stays'
        ? { kind: 'wanderer-stays', stays: true }
        : { kind: 'boost-target', seatId: me ?? '' },
    }).ok;

  return (
    <div className="t-play">
      <div className="t-play__board" ref={boardRef}>
      <div className="t-panel">
        <h2 className="t-panel__title">
          {seat?.name ?? 'Watching'}
          <span className="t-panel__aside">{biome.name} · Round {view.round}</span>
        </h2>
        <p className="t-note">
          {view.phase === 'over'
            ? 'The crossing is over.'
            : myTurn
              ? 'Your turn.'
              : `Waiting on ${active?.name ?? 'the table'}.`}
          {connected ? '' : ' · reconnecting…'}
        </p>
        {error ? (
          <p className="t-note" style={{ color: 'var(--md-cat-mons-300)' }}>{error}</p>
        ) : null}
      </div>

      <div className="t-tracks">
        <ScoreTrack value={view.progress} total={view.rules.escapeTarget} />
        <ScoreTrack value={view.strikes} total={view.rules.encounterAt} variant="threat" />
      </div>

      {/* River and piles scale as one block, so a deck pile never ends up
          drawn larger than the paths the player is choosing between. */}
      <ScaleToFit className="t-play__fit">
      <div className="t-river" data-pickable={a.pickSlots.length && myTurn ? true : undefined}>
        <River
          size={riverSize}
          slots={view.river.map((s) => (
            s.filled
              ? { category: s.category ?? 'clear-path', faceDown: !s.faceUp }
              : { category: null, faceDown: false }
          ))}
          {...(myTurn && a.pickSlots.length
            ? { onPick: (i: number) => { if (mayPick(i)) dispatch({ type: 'PICK_SLOT', index: i }); } }
            : {})}
        />
      </div>

      <div className="t-piles">
        <DeckPile count={view.deckCount} size="sm" />
        <DiscardPile
          count={view.discardCount}
          size="sm"
          {...(view.discardTop ? { top: view.discardTop } : {})}
        />
      </div>
      </ScaleToFit>

      {check ? (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">
            {view.seats.find((s) => s.id === check.seatId)?.name ?? 'Someone'}
            {' · '}{check.score}
          </h2>
          {check.d20 === null ? (
            <p className="t-note">Roll your d20 and tell the GM.</p>
          ) : (
            <>
              <div className={`t-roll ${check.success ? 't-roll--good' : 't-roll--bad'}`}>
                <span className="t-roll__total">
                  {(check.d20b === null ? check.d20 : Math.max(check.d20, check.d20b)) + check.mod}
                </span>
                <span className="t-roll__vs">vs DC {check.dc}</span>
              </div>
              {/* The verdict is the GM's to give. Showing it as decided
                  here would be a lie they can still overturn. */}
              <p className="t-note">Waiting on the GM.</p>
            </>
          )}
        </div>
      ) : null}

      {view.phase === 'act' && myTurn ? (
        <div className="t-panel">
          <h2 className="t-panel__title">Your action</h2>
          <ActionBar
            abilities={view.rules.abilities}
            showDc={false}
            onUse={(ability) => dispatch({ type: 'USE_ABILITY', ability })}
          />
          {a.obstacleSlots.length ? (
            <p className="t-note" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
              Or ask your GM to let you work on the blocked
              {' '}{a.obstacleSlots.map(position).join(' and ')} path.
            </p>
          ) : null}
        </div>
      ) : null}

      {view.phase === 'pick' && myTurn ? (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">Commit to a path</h2>
          <p className="t-note">Tap one. It is turned over for everyone.</p>
        </div>
      ) : null}

      </div>

      <div className="t-play__aside">
      <div className="t-panel">
        <h2 className="t-panel__title">Order</h2>
        <div className="t-seats">
          {view.order.map((id, i) => {
            const s = view.seats.find((x) => x.id === id);
            if (!s) return null;
            return (
              <PlayerSeat
                key={id}
                name={s.name}
                order={i + 1}
                active={s.id === active?.id && view.phase !== 'over'}
                detail={[
                  s.id === me ? 'you' : s.cls,
                  view.advantage.includes(id) ? 'advantage' : null,
                ].filter(Boolean).join(' · ')}
              />
            );
          })}
        </div>
      </div>

      <EventLog log={view.log} />

      <div className="t-row t-row--centre">
        <button type="button" className="t-btn" onClick={onLeave}>Leave</button>
      </div>
      </div>

      {myChoice && pending?.kind === 'choice' ? (
        <Modal label="Your decision">
          <ChoicePanel
            view={view}
            choice={pending.choice}
            onResolve={(payload: ChoicePayload) =>
              dispatch({ type: 'RESOLVE_CHOICE', payload })}
          />
        </Modal>
      ) : null}
    </div>
  );
}

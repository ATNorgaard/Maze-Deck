import { ActionBar, MazeDeckProvider, River } from '@maze-deck/ui';
import { activeSeatOf, availableFor, mayAct } from '@maze-deck/rules';
import type { ChoicePayload, GameAction, GameView } from '@maze-deck/rules';
import * as React from 'react';
import type { Biome } from '../biomes';
import { ChoicePanel } from '../components/ChoicePanel';
import { DieRoll } from '../components/DieRoll';
import { Drawer } from '../components/Drawer';
import { ScaleToFit } from '../components/ScaleToFit';
import { SoundSettings } from '../components/SoundSettings';
import { Throw } from '../components/Throw';
import { useBed } from '../stage/bed';
import { buzz, FEEL, canBuzz, useHapticsOn } from '../stage/haptics';
import { useEnding } from '../stage/useEnding';
import { useFittingSize } from '../useFittingSize';
import '../table.css';
import '../phone.css';

interface Props {
  view: GameView;
  /** The setting, as the server told this device. Its side's backs come with the deck's skin. */
  biome: Biome;
  dispatch: (action: GameAction) => void;
  connected: boolean;
  error: string | null;
  onLeave: () => void;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

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
 * The beats a player should feel, from what changed: your turn, ground
 * gained, a strike, the river jamming, being found. The table plays
 * them on the GM's screen; the phone in a pocket buzzes.
 */
function useFelt(view: GameView, yours: boolean): void {
  const buzzedTurn = React.useRef<string | null>(null);
  React.useEffect(() => {
    const key = `${view.round}:${view.turn}`;
    if (yours && buzzedTurn.current !== key) { buzzedTurn.current = key; buzz([...FEEL.turn]); }
  }, [yours, view.round, view.turn]);

  const was = React.useRef(view);
  React.useEffect(() => {
    const before = was.current;
    was.current = view;
    if (before === view) return;
    const fresh = view.log.filter((e) => e.n > (before.log[before.log.length - 1]?.n ?? -1));
    if (view.phase === 'encounter' && before.phase !== 'encounter') buzz([...FEEL.found]);
    else if (fresh.some((e) => e.cue === 'jam')) buzz([...FEEL.jam]);
    else if (view.strikes > before.strikes) buzz(FEEL.strike);
    else if (view.progress > before.progress) buzz(FEEL.progress);
  }, [view]);
}

/** The river's three paths, as large as the phone allows, to commit to one. */
function PathPicker({ view, onPick }: { view: GameView; onPick: (index: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const size = useFittingSize(ref);
  return (
    <div className="t-ctl__river" ref={ref}>
      <ScaleToFit className="t-ctl__fit">
        <div className="t-river" data-pickable>
          <River
            className="t-river__ground"
            size={size}
            slots={view.river.map((s) => (
              s.filled
                ? { category: s.category ?? 'clear-path', faceDown: !s.faceUp }
                : { category: null, faceDown: false }
            ))}
            onPick={(i: number) => { if (mayAct(view, view.viewer, { type: 'PICK_SLOT', index: i }).ok) onPick(i); }}
          />
        </div>
      </ScaleToFit>
    </div>
  );
}

/**
 * A player's own device (docs/overhaul.md, phase 8; the controller,
 * 2026-10-11).
 *
 * The GM hosts and shows their screen to the table, so everything the
 * table watches is there: the place, the scene, the route, the dark, the
 * river, the party. The phone is for the moments that are the player's
 * to act on, and shows only those, one at a time:
 * - waiting: whose turn it is, and whether yours is next;
 * - your turn: the six actions, as big buttons;
 * - your roll: its result, or the die to throw when the table rolls its own;
 * - your path: the river's three cards, to commit to one;
 * - your decision, when the rules give you one;
 * - found, and the end, in a line each.
 *
 * Behind it, the side's still frame, veiled (app.css): the motion is on
 * the shared screen, and a phone's battery lasts. Sound, haptics and
 * leaving are in the menu. What it is allowed to show is decided by the
 * redaction; this decides what is worth showing.
 */
export function PlayerScreen({ view, biome, dispatch, connected, error, onLeave }: Props) {
  const me = view.viewer.role === 'player' ? view.viewer.seatId : null;
  const a = availableFor(view);
  const active = activeSeatOf(view);
  const myTurn = active !== null && active.id === me;
  const seat = view.seats.find((s) => s.id === me);
  const [menu, setMenu] = React.useState(false);

  const pending = view.pending;
  const check = pending?.kind === 'check' ? pending : null;
  const yours = myTurn && view.phase === 'act';
  const myCheck = check !== null && check.seatId === me;
  const myPick = myTurn && view.phase === 'pick' && a.pickSlots.length > 0;
  const myChoice = pending?.kind === 'choice'
    && mayAct(view, view.viewer, {
      type: 'RESOLVE_CHOICE',
      payload: pending.choice.kind === 'wanderer-stays'
        ? { kind: 'wanderer-stays', stays: true }
        : { kind: 'boost-target', seatId: me ?? '' },
    }).ok;
  const order = view.order;
  const nextId = order.length > 1 ? order[(view.turn + 1) % order.length] : null;
  const youreNext = me !== null && !myTurn && nextId === me && view.phase !== 'over';

  useFelt(view, yours);
  useEnding(view);

  // The setting's bed, if this phone's owner has turned sound on: off
  // unless they do, since the GM's screen carries the table's sound.
  const found = view.phase === 'encounter';
  useBed(biome.id, {
    threat: found ? 1.4 : view.strikes / Math.max(1, view.rules.encounterAt),
    progress: view.progress / Math.max(1, view.rules.escapeTarget),
    hush: found || (view.strikes > 0 && view.strikes >= view.rules.encounterAt - 1) ? 1 : 0,
    dim: view.outcome === 'lost' ? 1 : 0,
    bloom: view.outcome === 'through' ? 1 : 0,
  });

  const act = (action: GameAction) => dispatch(action);

  const state = view.phase === 'over' ? 'over'
    : found ? 'found'
      : myChoice ? 'decide'
        : myCheck ? 'roll'
          : yours ? 'act'
            : myPick ? 'pick'
              : 'wait';

  let body: React.ReactNode;
  if (state === 'over') {
    body = (
      <div className="t-ctl__calm">
        <p className="t-ctl__big">{view.outcome === 'through' ? 'The party is through' : 'The crossing is over'}</p>
        <p className="t-note">{view.outcome === 'through' ? 'Look to the GM for the far side.' : 'The GM will say where you got to.'}</p>
        <button type="button" className="t-btn" onClick={onLeave}>Leave</button>
      </div>
    );
  } else if (state === 'found') {
    body = (
      <div className="t-ctl__calm">
        <p className="t-kicker t-ctl__danger">The party is found</p>
        <p className="t-ctl__big">Roll initiative</p>
        <p className="t-note">The GM is running it at the table.</p>
      </div>
    );
  } else if (state === 'decide' && pending?.kind === 'choice') {
    body = (
      <div className="t-ctl__task">
        <p className="t-kicker">Your decision</p>
        <ChoicePanel view={view} choice={pending.choice} onResolve={(payload: ChoicePayload) => act({ type: 'RESOLVE_CHOICE', payload })} />
      </div>
    );
  } else if (state === 'roll' && check) {
    body = (
      <div className="t-ctl__task t-ctl__roll">
        <p className="t-kicker">Your roll · {check.score} against {check.dc}</p>
        {check.d20 === null ? (
          <Throw key={`${view.round}:${view.turn}`} advantage={check.d20b !== null} mod={check.mod} dc={check.dc} score={check.score} />
        ) : (
          <>
            {/* No verdict: it is the GM's to give. */}
            <DieRoll d20={check.d20} d20b={check.d20b} mod={check.mod} dc={check.dc} verdict={null} />
            <p className="t-note">The GM is ruling.</p>
          </>
        )}
      </div>
    );
  } else if (state === 'act') {
    body = (
      <div className="t-ctl__task">
        <p className="t-kicker">Your turn</p>
        <h2 className="t-ctl__ask">Choose an action</h2>
        <MazeDeckProvider size="md" background="transparent">
          <ActionBar abilities={view.rules.abilities} showDc={false} onUse={(ability) => act({ type: 'USE_ABILITY', ability })} />
        </MazeDeckProvider>
        {a.obstacleSlots.length ? (
          <p className="t-note">
            Or ask your GM to let you work on the blocked {a.obstacleSlots.map(position).join(' and ')} path.
          </p>
        ) : null}
      </div>
    );
  } else if (state === 'pick') {
    body = (
      <div className="t-ctl__task t-ctl__pick">
        <p className="t-kicker">Your turn</p>
        <h2 className="t-ctl__ask">Commit to a path</h2>
        <PathPicker view={view} onPick={(index) => act({ type: 'PICK_SLOT', index })} />
        <p className="t-note">Tap one. It turns over for everyone.</p>
      </div>
    );
  } else {
    const rolling = check ? view.seats.find((s) => s.id === check.seatId)?.name ?? 'Someone' : null;
    body = (
      <div className="t-ctl__calm">
        <p className="t-ctl__wait">
          {rolling ? `${rolling} is rolling`
            : myTurn ? 'The GM is ruling'
              : active ? `${active.name}’s turn` : 'Waiting on the table'}
        </p>
        {youreNext ? <p className="t-ctl__next">You’re next</p> : null}
      </div>
    );
  }

  return (
    <div className="t-phone t-ctl" data-state={state} data-yours={yours || myPick || myCheck || myChoice || undefined}>
      <header className="t-ctl__top">
        <div>
          <p className="t-kicker">{biome.name} · Round {view.round}</p>
          <h1 className="t-phone__name">{seat?.name ?? 'Watching'}</h1>
        </div>
        <button type="button" className="t-btn t-ctl__menu" aria-label="Settings" onClick={() => setMenu(true)}>
          <span aria-hidden="true">···</span>
        </button>
      </header>

      <main className="t-ctl__body" role="status" aria-live="polite">{body}</main>

      <footer className="t-ctl__foot">
        {error ? <p className="t-phone__error" role="alert">{error}</p>
          : !connected ? <p className="t-note">Reconnecting…</p>
            : state === 'wait' ? <p className="t-note">The table is on the GM’s screen</p> : null}
      </footer>

      <Drawer label="Settings" open={menu} onOpenChange={setMenu}>
        <div className="t-drawer__body">
          <SoundSettings />
          <HapticsToggle />
          <button type="button" className="t-btn" onClick={onLeave}>Leave the table</button>
        </div>
      </Drawer>
    </div>
  );
}

import * as React from 'react';
import type { PendingCheck, Seat } from '@maze-deck/rules';
import { DieRoll } from './DieRoll';

interface Props {
  seats: Seat[];
  check: PendingCheck;
  /** What is being attempted: the action card played, or the Obstacle. */
  card: React.ReactNode;
  /** What the attempt is called — "Forge a Path", "Clearing the left". */
  attempt: string;
  onEnterRoll: (d20: number, d20b?: number) => void;
  onConfirm: (success?: boolean) => void;
  /** The die has stopped, showing this verdict. */
  onLanded: (verdict: boolean | null) => void;
}

function seatName(seats: Seat[], id: string): string {
  return seats.find((s) => s.id === id)?.name ?? 'Someone';
}

/**
 * The roll, at the size of the moment (docs/overhaul.md, phase 4, D3).
 *
 * Still the centred, blocking dialog the author asked for in feel/3b —
 * the caller wraps it in Modal — but no longer a box with a button-sized
 * die in it. The card being attempted is lifted beside a die three times
 * the size, and the DC is a mark on a line that the total has to reach:
 * you watch it fall short or clear it. The verdict then washes the
 * world's light as well as the panel (`onLanded`). The GM can still let
 * it land or overrule it, from the first frame.
 */
export function RollStage({ seats, check, card, attempt, onEnterRoll, onConfirm, onLanded }: Props) {
  const [manual, setManual] = React.useState('');
  const [manualB, setManualB] = React.useState('');
  const advantage = check.d20b !== null;
  const name = seatName(seats, check.seatId);
  const sign = check.mod >= 0 ? `+${check.mod}` : `${check.mod}`;

  if (check.d20 === null) {
    const parsed = Number(manual);
    const parsedB = Number(manualB);
    const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 20
      && (!advantage || (Number.isInteger(parsedB) && parsedB >= 1 && parsedB <= 20));
    return (
      <div className="t-panel t-panel--live t-rollstage">
        <div className="t-rollstage__card">{card}</div>
        <div className="t-rollstage__body">
          <p className="t-kicker">{attempt}</p>
          <h2 className="t-rollstage__who">{name} rolls {check.score}</h2>
          <p className="t-note">
            Against DC {check.dc}, with {sign} from their sheet
            {advantage ? ', and advantage — enter both dice' : ''}.
          </p>
          <div className="t-row t-rollstage__entry">
            <input
              className="t-input" inputMode="numeric" autoFocus placeholder="d20"
              aria-label="d20 result" value={manual} onChange={(e) => setManual(e.target.value)}
            />
            {advantage ? (
              <input
                className="t-input" inputMode="numeric" placeholder="second d20"
                aria-label="second d20 result" value={manualB} onChange={(e) => setManualB(e.target.value)}
              />
            ) : null}
            <button
              type="button" className="t-btn t-btn--primary" disabled={!valid}
              onClick={() => onEnterRoll(parsed, advantage ? parsedB : undefined)}
            >
              Take the roll
            </button>
          </div>
        </div>
      </div>
    );
  }

  const die = advantage ? Math.max(check.d20, check.d20b ?? 0) : check.d20;
  const total = die + check.mod;
  const success = check.success === true;
  // The line runs from 1 to a little past whichever is higher.
  const top = Math.max(check.dc, total, 20) + 4;
  const at = (n: number) => `${(Math.max(0, Math.min(top, n)) / top) * 100}%`;

  return (
    <div className="t-panel t-panel--live t-rollstage">
      <div className="t-rollstage__card">{card}</div>
      <div className="t-rollstage__body">
        <p className="t-kicker">{attempt}</p>
        <h2 className="t-rollstage__who">{name}</h2>
        <DieRoll
          d20={check.d20}
          d20b={check.d20b}
          mod={check.mod}
          dc={check.dc}
          verdict={success}
          onLanded={onLanded}
        />
        <div
          className="t-gauge"
          role="img"
          aria-label={`Total ${total}; the mark is DC ${check.dc}`}
          data-verdict={success ? 'good' : 'bad'}
        >
          <span className="t-gauge__fill" style={{ width: at(total) }} />
          <span className="t-gauge__mark" style={{ left: at(check.dc) }}>
            <span className="t-gauge__label">DC {check.dc}</span>
          </span>
        </div>
        <p className="t-note">
          {advantage
            ? `Rolled ${check.d20} and ${check.d20b}, keeping ${die}, ${sign} ${check.score}.`
            : `Rolled ${check.d20}, ${sign} ${check.score}.`}
        </p>
        <div className="t-row t-rollstage__go">
          <button type="button" className="t-btn t-btn--primary" onClick={() => onConfirm()}>
            Let it land
          </button>
          <button type="button" className="t-btn" onClick={() => onConfirm(!success)}>
            Rule it {success ? 'a failure' : 'a success'}
          </button>
        </div>
      </div>
    </div>
  );
}

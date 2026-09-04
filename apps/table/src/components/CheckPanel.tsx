import * as React from 'react';
import type { PendingCheck, Seat } from '@maze-deck/rules';
import { DieRoll } from './DieRoll';

interface Props {
  seats: Seat[];
  check: PendingCheck;
  onEnterRoll: (d20: number, d20b?: number) => void;
  onConfirm: (success?: boolean) => void;
}

function seatName(seats: Seat[], id: string): string {
  return seats.find((s) => s.id === id)?.name ?? 'Someone';
}

/**
 * A roll on the table, waiting for the GM to let it land. The GM can
 * overturn it before it does — that is the one piece of the original
 * prototype worth keeping exactly as designed.
 */
export function CheckPanel({ seats, check, onEnterRoll, onConfirm }: Props) {
  const [manual, setManual] = React.useState('');
  const [manualB, setManualB] = React.useState('');
  const advantage = check.d20b !== null;
  const needsRoll = check.d20 === null;

  const die = advantage ? Math.max(check.d20 ?? 0, check.d20b ?? 0) : check.d20 ?? 0;
  const success = check.success === true;
  const sign = check.mod >= 0 ? `+${check.mod}` : `${check.mod}`;

  if (needsRoll) {
    const parsed = Number(manual);
    const parsedB = Number(manualB);
    const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 20
      && (!advantage || (Number.isInteger(parsedB) && parsedB >= 1 && parsedB <= 20));

    return (
      <div className="t-panel t-panel--live">
        <h2 className="t-panel__title">
          {seatName(seats, check.seatId)} rolls {check.score}
        </h2>
        <p className="t-note">
          Against DC {check.dc}, with {sign} from their sheet
          {advantage ? ', and advantage — enter both dice' : ''}.
        </p>
        <div className="t-row" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
          <input
            className="t-input"
            style={{ width: 'calc(20 * var(--md-u))' }}
            inputMode="numeric"
            autoFocus
            placeholder="d20"
            aria-label="d20 result"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          {advantage ? (
            <input
              className="t-input"
              style={{ width: 'calc(20 * var(--md-u))' }}
              inputMode="numeric"
              placeholder="second d20"
              aria-label="second d20 result"
              value={manualB}
              onChange={(e) => setManualB(e.target.value)}
            />
          ) : null}
          <button
            type="button"
            className="t-btn t-btn--primary"
            disabled={!valid}
            onClick={() => onEnterRoll(parsed, advantage ? parsedB : undefined)}
          >
            Take the roll
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="t-panel t-panel--live">
      <h2 className="t-panel__title">{seatName(seats, check.seatId)}</h2>
      <DieRoll
        d20={check.d20 ?? 0}
        d20b={check.d20b}
        mod={check.mod}
        dc={check.dc}
        verdict={success}
      />
      <p className="t-note" style={{ marginTop: 'calc(2 * var(--md-u))' }}>
        {advantage
          ? `Rolled ${check.d20} and ${check.d20b}, keeping ${die}, ${sign} ${check.score}.`
          : `Rolled ${check.d20}, ${sign} ${check.score}.`}
      </p>
      <div className="t-row" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
        <button type="button" className="t-btn t-btn--primary" onClick={() => onConfirm()}>
          Let it land
        </button>
        <button type="button" className="t-btn" onClick={() => onConfirm(!success)}>
          Rule it {success ? 'a failure' : 'a success'}
        </button>
      </div>
    </div>
  );
}

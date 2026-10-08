import * as React from 'react';
import { buzz, FEEL } from '../stage/haptics';
import { DieRoll } from './DieRoll';

interface Props {
  /** The check was made with advantage: two dice, the better kept. */
  advantage: boolean;
  mod: number;
  dc: number;
  /** The ability being tested, for the line under the die. */
  score: string;
}

/** A throw this hard (px per ms of flick) is a flick, not a tap. */
const FLICK = 0.6;

/**
 * A die to throw, on a phone, when the table rolls its own dice
 * (docs/overhaul.md, phase 8).
 *
 * Tap it, or flick it, and it tumbles and lands. It is ceremony, not
 * authority: the number is this phone's own (Math.random, never the
 * engine's), the line under it says to tell the GM, and the GM still
 * types the result in — that is what the room acts on. One throw a
 * check: a die picked up again until it says the right thing is not a
 * throw.
 */
export function Throw({ advantage, mod, dc, score }: Props) {
  const [thrown, setThrown] = React.useState<{ a: number; b: number | null; hard: boolean } | null>(null);
  const start = React.useRef<{ x: number; y: number; t: number } | null>(null);

  const throwIt = (hard: boolean) => {
    if (thrown) return;
    const d = () => 1 + Math.floor(Math.random() * 20);
    setThrown({ a: d(), b: advantage ? d() : null, hard });
  };

  if (thrown) {
    const kept = thrown.b !== null ? Math.max(thrown.a, thrown.b) : thrown.a;
    return (
      <div className="t-throw" data-thrown="" data-hard={thrown.hard || undefined}>
        <DieRoll d20={thrown.a} d20b={thrown.b} mod={mod} dc={dc} verdict={null} onLanded={() => buzz(FEEL.landed)} />
        <p className="t-throw__tell">
          Tell the GM: <strong>{kept}</strong>
          {thrown.b !== null ? ` (you kept the better of ${thrown.a} and ${thrown.b})` : ''}
        </p>
        <p className="t-note">They enter it, and rule on it.</p>
      </div>
    );
  }

  return (
    <div className="t-throw">
      <button
        type="button"
        className="t-throw__die"
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, t: performance.now() }; }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          const speed = s ? Math.hypot(e.clientX - s.x, e.clientY - s.y) / Math.max(1, performance.now() - s.t) : 0;
          throwIt(speed > FLICK);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); throwIt(false); } }}
        aria-label={`Throw ${advantage ? 'two dice' : 'the die'} for your ${score} check`}
      >
        <span className="t-throw__face" aria-hidden="true">20</span>
      </button>
      <p className="t-throw__tell">{advantage ? 'Tap or flick to throw both dice.' : 'Tap or flick to throw.'}</p>
      <p className="t-note">Or roll your own d20 and tell the GM.</p>
    </div>
  );
}

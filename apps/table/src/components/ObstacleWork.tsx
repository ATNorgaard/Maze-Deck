import * as React from 'react';
import type { AbilityScore } from '@maze-deck/rules';
import { SCORES } from '../campaign';
import { SlotLayer } from './SlotLayer';

export interface Suggestion {
  score: AbilityScore;
  dcOffset: number;
}

interface Props {
  /** The `.t-river` wrapper. Positioned, so it is the slots' offsetParent. */
  riverRef: React.RefObject<HTMLElement>;
  /** Slots holding a face-up blocker the active player may work on. */
  slots: number[];
  /** Anything that moves the slots: the size step, the river's contents. */
  layoutKey: string;
  mazeDc: number;
  /** What the scene drawn for that card asked for, if anything. */
  suggest: (slot: number) => Suggestion | null;
  onAttempt: (slot: number, score: AbilityScore, dc: number) => void;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;
/** How far the GM may move the DC from the Maze DC, as the old board allowed. */
const NUDGE_MIN = -2;
const NUDGE_MAX = 2;

/**
 * Working on an Obstacle, where the Obstacle is.
 *
 * The old board asked for it as a form under the action strip: two
 * selects and a button per blocked slot. Here the blocker in the river
 * carries a "Work on it" of its own, which opens into the check on the
 * card's face — the ability the scene suggested already chosen and the
 * DC already nudged (DECISIONS R6: the table suggests, the GM may
 * overrule before the roll).
 *
 * Laid over the card by SlotLayer.
 */
export function ObstacleWork({ riverRef, slots, layoutKey, mazeDc, suggest, onAttempt }: Props) {
  const [open, setOpen] = React.useState<number | null>(null);
  const [score, setScore] = React.useState<AbilityScore>('STR');
  const [nudge, setNudge] = React.useState(0);

  const key = slots.join(',');

  // A slot that stopped being workable closes its panel.
  React.useEffect(() => {
    if (open !== null && !slots.includes(open)) setOpen(null);
  }, [key, open]);

  const openFor = (slot: number) => {
    const s = suggest(slot);
    setScore(s?.score ?? 'STR');
    setNudge(Math.max(NUDGE_MIN, Math.min(NUDGE_MAX, s?.dcOffset ?? 0)));
    setOpen(slot);
  };

  return (
    <SlotLayer riverRef={riverRef} slots={slots} layoutKey={layoutKey} className="t-work">
      {(slot) => {
        const suggested = suggest(slot);
        const dc = mazeDc + nudge;
        return (
          <>
            {open === slot ? (
              <div
                className="t-work__panel t-rise"
                role="group"
                aria-label={`Clear the ${position(slot)} path`}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(null); }}
              >
                <p className="t-kicker">Clear the {position(slot)}</p>
                <div className="t-work__scores" role="radiogroup" aria-label="Ability">
                  {SCORES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={s === score}
                      className="t-work__score"
                      data-suggested={suggested?.score === s || undefined}
                      title={suggested?.score === s ? 'What the scene asks for' : undefined}
                      onClick={() => setScore(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="t-work__dc">
                  <button
                    type="button" className="t-step__btn" aria-label="Lower the DC"
                    disabled={nudge <= NUDGE_MIN} onClick={() => setNudge(nudge - 1)}
                  >−</button>
                  <span className="t-work__dcValue">DC {dc}</span>
                  <button
                    type="button" className="t-step__btn" aria-label="Raise the DC"
                    disabled={nudge >= NUDGE_MAX} onClick={() => setNudge(nudge + 1)}
                  >+</button>
                </div>
                <div className="t-work__go">
                  <button type="button" className="t-btn" onClick={() => setOpen(null)}>Not now</button>
                  <button
                    type="button" className="t-btn t-btn--primary" autoFocus
                    onClick={() => { setOpen(null); onAttempt(slot, score, dc); }}
                  >
                    Roll {score}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="t-btn t-work__open" onClick={() => openFor(slot)}>
                Work on it
              </button>
            )}
          </>
        );
      }}
    </SlotLayer>
  );
}

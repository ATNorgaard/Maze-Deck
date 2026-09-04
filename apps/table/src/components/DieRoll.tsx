import * as React from 'react';
import { MOTION, reducedMotion } from '../stage/motion';

interface Props {
  d20: number;
  /** The second die under advantage, or null. */
  d20b: number | null;
  mod: number;
  dc: number;
  /**
   * The outcome, once it may be shown. Null on a player's screen: the
   * verdict is the GM's to give, and showing it as decided there would
   * be a lie they can still overturn.
   */
  verdict: boolean | null;
}

/**
 * A die that tumbles before it lands.
 *
 * The faces it shows on the way are random and mean nothing; the one it
 * stops on is the real roll, which was decided before this ever
 * rendered. The cadence slows as it settles, which is what makes it read
 * as a thrown object rather than a slot machine.
 */
function useTumble(value: number): { face: number; landed: boolean } {
  const [face, setFace] = React.useState(value);
  const [landed, setLanded] = React.useState(false);

  React.useEffect(() => {
    if (reducedMotion()) { setFace(value); setLanded(true); return; }
    setLanded(false);
    const t0 = performance.now();
    let id = 0;
    const spin = () => {
      const t = performance.now() - t0;
      if (t >= MOTION.tumble) { setFace(value); setLanded(true); return; }
      setFace(1 + Math.floor(Math.random() * 20));
      id = window.setTimeout(spin, 60 + t / 5);
    };
    spin();
    return () => window.clearTimeout(id);
  }, [value]);

  return { face, landed };
}

/**
 * The roll, as an object.
 *
 * Three beats: the die (or dice) tumble and stop; the modifier slides in
 * beside them; the total lands with a bump against the DC. Only then,
 * and only where a verdict is allowed, does the colour arrive.
 */
export function DieRoll({ d20, d20b, mod, dc, verdict }: Props) {
  const advantage = d20b !== null;
  const a = useTumble(d20);
  const b = useTumble(d20b ?? d20);
  const landed = a.landed && (!advantage || b.landed);

  const keptIndex = advantage && d20b > d20 ? 1 : 0;
  const kept = keptIndex === 1 && d20b !== null ? d20b : d20;
  const total = kept + mod;
  const sign = mod >= 0 ? `+${mod}` : `${mod}`;
  const verdictName = landed && verdict !== null ? (verdict ? 'good' : 'bad') : undefined;

  const die = (face: number, tumbling: boolean, index: number) => (
    <span
      className="t-die"
      data-tumbling={tumbling || undefined}
      data-dim={(advantage && landed && index !== keptIndex) || undefined}
      aria-hidden="true"
    >
      <span className="t-die__face">{face}</span>
    </span>
  );

  return (
    <>
      <div
        className="t-roll t-roll--staged"
        data-landed={landed || undefined}
        data-verdict={verdictName}
        aria-label={`Rolled ${d20}${advantage ? ` and ${d20b}` : ''}, ${sign}, total ${total} against DC ${dc}`}
      >
        <span className="t-dice">
          {die(a.face, !a.landed, 0)}
          {advantage ? die(b.face, !b.landed, 1) : null}
        </span>
        <span className="t-roll__mod">{sign}</span>
        <span className="t-roll__total">{total}</span>
        <span className="t-roll__vs">vs DC {dc}</span>
      </div>
      {verdict !== null ? (
        <p className="t-verdict" data-verdict={verdictName}>
          {landed ? (verdict ? 'Success' : 'Failure') : ' '}
        </p>
      ) : null}
    </>
  );
}

import * as React from 'react';
import type { Design, Side } from '@maze-deck/art';
import { getCategory } from '@maze-deck/ui';
import type { Biome } from '../biomes';
import type { ChronicleEntry } from '../campaign';
import { MOTION, reducedMotion } from '../stage/motion';
import { stillOf, useDesign } from './pixel';

interface Props {
  biome: Biome;
  /** The side being played: its landmarks are that side's Clear Path. */
  side: Side;
  /** Clear Paths gained, as presented. */
  value: number;
  /** Clear Paths to the far side. */
  total: number;
  /**
   * The scene each waypoint was gained through, by waypoint (index 0 is
   * the first Clear Path), or null where it is not known — a player's
   * screen, which is never told the scenes, or a run older than this.
   */
  landmarks: (ChronicleEntry | null)[];
}

/**
 * A waypoint's landmark: the Clear Path the party went through, the
 * doorway at the heart of its vista, as small as the design will still
 * read. Every Clear Path in a setting's side is the same picture, so the
 * route is a row of the same way, taken again and again.
 */
const Landmark = React.memo(({ design }: { design: Design }) => (
  <img src={stillOf(design, 64, 40, 'clear-path', 1.3, { x: 19, y: 5, w: 26, h: 30 })} alt="" />
));
Landmark.displayName = 'Landmark';

/**
 * The route — escape progress as a way across the top of the table,
 * from the threshold to the far side (docs/overhaul.md, phase 5).
 *
 * A waypoint for each Clear Path the crossing needs. Each one gained
 * pins a landmark, the doorway of the scene that gained it, and the
 * party's light moves on to it. At rest it is quiet: a thin line and
 * small marks. Gaining ground is the moment, and it is brief — the new
 * landmark rises, a ring of light goes out from it, the lit line runs on
 * and the party follows.
 *
 * A meter to assistive tech, like the pips it replaces.
 */
export function Route({ biome, side, value, total, landmarks }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const design = useDesign(biome.id, side);

  // The waypoint just reached, for as long as its arrival plays. Not on
  // the first render: a board opened mid-crossing has nothing arriving.
  const [fresh, setFresh] = React.useState<number | null>(null);
  const last = React.useRef(value);
  React.useEffect(() => {
    const was = last.current;
    last.current = value;
    if (value <= was || reducedMotion()) return undefined;
    setFresh(value);
    const t = window.setTimeout(() => setFresh(null), MOTION.route + 700);
    return () => window.clearTimeout(t);
  }, [value]);

  const steps = Math.max(1, total);
  const reached = Math.min(value, steps);
  const name = biome.cards?.['clear-path'].title ?? getCategory('clear-path').title;
  const style = { '--p': reached / steps } as React.CSSProperties;

  return (
    <div
      className="t-route"
      ref={ref}
      role="meter"
      aria-valuenow={reached}
      aria-valuemin={0}
      aria-valuemax={steps}
      aria-label={`The route: ${reached} of ${steps} Clear Paths to the far side`}
      data-through={reached >= steps || undefined}
      style={style}
    >
      <span className="t-route__end" aria-hidden="true">The threshold</span>
      <div className="t-route__path" aria-hidden="true">
        <span className="t-route__line" />
        <span className="t-route__lit" />
        {Array.from({ length: steps }, (_, i) => {
          const k = i + 1;
          const mark = k <= reached && design ? landmarks[i] ?? null : null;
          return (
            <span
              key={k}
              className="t-route__way"
              data-reached={k <= reached || undefined}
              data-far={k === steps || undefined}
              data-fresh={k === fresh || undefined}
              data-mark={mark ? true : undefined}
              style={{ '--x': k / steps } as React.CSSProperties}
              title={mark ? `${name}: ${mark.text}` : undefined}
            >
              {mark && design ? <Landmark design={design} /> : null}
            </span>
          );
        })}
        <span className="t-route__party"><span className="t-route__light" /></span>
      </div>
      <span className="t-route__end" aria-hidden="true">The far side</span>
    </div>
  );
}

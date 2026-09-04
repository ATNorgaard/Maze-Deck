import * as React from 'react';

interface Props {
  /** The `.t-seats` container. Must be `position: relative`. */
  containerRef: React.RefObject<HTMLElement>;
  /** Which seat, by position in the list. Negative hides the baton. */
  index: number;
}

/**
 * The turn, as a thing that moves.
 *
 * A glow ring positioned over one seat that slides to the next when
 * the turn passes, instead of the highlight simply jumping. It is
 * measured off the seats' own layout boxes and only ever transitions
 * `transform`, so the list itself is never reflowed. The seat's own
 * active treatment still applies — the stage holds it back until the
 * ring has arrived (see the `turn` beat), so the two land together.
 */
export function SeatBaton({ containerRef, index }: Props) {
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const measure = React.useCallback(() => {
    const root = containerRef.current;
    const el = root?.querySelectorAll<HTMLElement>('.md-seat')[index];
    if (!root || !el) { setBox(null); return; }
    setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  }, [containerRef, index]);

  React.useLayoutEffect(measure, [measure]);

  // The condensed layout changes the seats' geometry entirely.
  React.useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  if (!box) return null;
  return (
    <div
      className="t-baton"
      aria-hidden="true"
      style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
    />
  );
}

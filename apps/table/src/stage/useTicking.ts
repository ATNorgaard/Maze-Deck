import * as React from 'react';
import { reducedMotion } from './motion';

/**
 * A number that ticks to its new value instead of being replaced.
 *
 * Steps one unit at a time so a count of twenty going to seventeen
 * reads 19, 18, 17 — the eye sees three cards leave, not one number
 * swap. Large jumps (a reshuffle bringing the deck back from 0 to 19)
 * are capped to a fixed total duration so nothing ticks for seconds.
 */
export function useTicking(value: number, stepMs = 55, maxMs = 420): number {
  const [shown, setShown] = React.useState(value);
  const shownRef = React.useRef(value);

  React.useEffect(() => {
    if (value === shownRef.current) return;
    if (reducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const distance = Math.abs(value - shownRef.current);
    const step = Math.min(stepMs, maxMs / distance);
    const dir = value > shownRef.current ? 1 : -1;
    let id = 0;
    const tick = () => {
      shownRef.current += dir;
      setShown(shownRef.current);
      if (shownRef.current !== value) id = window.setTimeout(tick, step);
    };
    id = window.setTimeout(tick, step);
    return () => window.clearTimeout(id);
  }, [value, stepMs, maxMs]);

  return shown;
}

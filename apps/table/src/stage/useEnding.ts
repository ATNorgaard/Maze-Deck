import * as React from 'react';
import type { GameView } from '@maze-deck/rules';
import { MOTION, reducedMotion } from './motion';
import { play } from './sound';

/**
 * The end of a run is the board's moment before it is the dialog's.
 *
 * Returns true once the closing dialog may be shown: immediately under
 * reduced motion, otherwise after `ending` — long enough for the river
 * to fan open or the light to go out. Also sounds the outcome, once.
 */
export function useEnding(view: GameView): boolean {
  const over = view.phase === 'over';
  const outcome = over ? view.outcome : null;
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!over) { setReady(false); return; }
    if (reducedMotion()) { setReady(true); return; }
    const t = window.setTimeout(() => setReady(true), MOTION.ending);
    return () => window.clearTimeout(t);
  }, [over]);

  React.useEffect(() => {
    if (outcome === 'through') { play('chime'); play('chime', 320); }
    if (outcome === 'lost') play('growl');
  }, [outcome]);

  return ready;
}

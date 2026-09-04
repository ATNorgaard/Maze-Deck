import * as React from 'react';
import type { CardSize } from '@maze-deck/ui';

/**
 * The largest size step whose river still fits the column.
 *
 * The design system scales in three discrete steps, so the right move
 * when space runs out is to drop a step — not to transform-scale a
 * card and put it half a millimetre off the print geometry.
 *
 * These are **measured**, not estimated. The previous numbers here
 * (1104 / 831 / 534) were worked out from card widths plus an assumed
 * gap, and every one of them was low — `md` was listed at 831 when a
 * three-slot river actually needs 873. The hook would therefore pick a
 * step too large for the column and the outer cards were clipped, since
 * the row is centred and overflows both edges.
 *
 * A card is 69 base units wide including bleed and the unit steps
 * 1.35 / 1 / 0.62 mm, so the whole row scales linearly with the unit —
 * 541 x 1.6129 = 873 and 541 x 2.1774 = 1179, which is exactly what the
 * three steps measure. Two pixels of slack absorb subpixel rounding.
 *
 * To re-measure after a geometry change, with a run open:
 *   document.querySelector('.md-river').offsetWidth
 */
const NEEDS: ReadonlyArray<readonly [CardSize, number]> = [
  ['lg', 1181],
  ['md', 875],
  ['sm', 543],
];

/**
 * Below this the column cannot hold three `sm` cards at all, and there
 * is no smaller step to fall back to. Callers that can be this narrow
 * need a scaling backstop — see ScaleToFit on the player's screen.
 */
export const RIVER_FLOOR = 543;

export function useFittingSize(ref: React.RefObject<HTMLElement>): CardSize {
  const [size, setSize] = React.useState<CardSize>('md');

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const found = NEEDS.find(([, need]) => w >= need);
      setSize(found ? found[0] : 'sm');
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

import * as React from 'react';
import type { CardSize } from '@maze-deck/ui';

/**
 * The largest size step whose river still fits the column.
 *
 * The design system scales in three discrete steps, so the right move
 * when space runs out is to drop a step — not to transform-scale a
 * card and put it half a millimetre off the print geometry.
 *
 * A card is 69 base units wide including bleed, and the unit is
 * 1.35mm / 1mm / 0.62mm. At 96dpi that is roughly 352 / 261 / 162px,
 * so three of them plus gaps need the widths below.
 */
const NEEDS: ReadonlyArray<readonly [CardSize, number]> = [
  ['lg', 1104],
  ['md', 831],
  ['sm', 534],
];

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

import * as React from 'react';
import type { CardSize } from '@maze-deck/ui';

/**
 * How big the table can lay its cards, from the room the surface has.
 *
 * The old board fitted the river to a column's WIDTH and let the page
 * scroll. The new one is a screen, not a page: the river, the piles
 * flanking it, the scene above and the hand below all have to be in
 * view at once, so the step is chosen from the surface's width AND its
 * height. The piles go one step under the river — they flank it, they
 * do not compete with it.
 *
 * Steps, never a transform, for the reason useFittingSize gives: the
 * print geometry is not something to scale half a millimetre off. And
 * no transform on any ancestor of the river, because the stage measures
 * the slots with getBoundingClientRect.
 *
 * `narrow` is the case where even `sm` cannot have a pile on each side;
 * the piles then go under the river and the page is allowed to scroll.
 *
 * The numbers are measured with a run open on the new board (see
 * docs/overhaul.md, world/1):
 *   river: document.querySelector('.t-surface .md-river').offsetWidth / offsetHeight
 *   pile:  document.querySelector('.t-surface .md-pile').offsetWidth
 */
/** The surface's gap, `calc(6 * var(--md-u))` at a millimetre: 22.7px, rounded up. */
const GAP = 23;

/* Widths carry useFittingSize's two pixels of slack for subpixel rounding.
   Heights carry none: a river half a pixel taller than the surface
   overflows it invisibly, and 2px is what kept 1280 x 720 off `md`. */
const RIVER = { lg: { w: 1181, h: 569 }, md: { w: 875, h: 422 }, sm: { w: 543, h: 261 } } as const;
const PILE_W = { lg: 352, md: 261, sm: 162 } as const;

const STEPS: ReadonlyArray<{ river: CardSize; piles: CardSize }> = [
  { river: 'lg', piles: 'md' },
  { river: 'md', piles: 'sm' },
  { river: 'sm', piles: 'sm' },
];

const needW = (river: CardSize, piles: CardSize) => RIVER[river].w + 2 * (PILE_W[piles] + GAP);

export interface TableFit {
  river: CardSize;
  piles: CardSize;
  narrow: boolean;
}

export function useTableFit(ref: React.RefObject<HTMLElement>): TableFit {
  const [fit, setFit] = React.useState<TableFit>({ river: 'md', piles: 'sm', narrow: false });

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const step = STEPS.find((s) => w >= needW(s.river, s.piles) && h >= RIVER[s.river].h);
      const next: TableFit = step
        ? { river: step.river, piles: step.piles, narrow: false }
        : { river: 'sm', piles: 'sm', narrow: w < needW('sm', 'sm') };
      setFit((prev) => (
        prev.river === next.river && prev.piles === next.piles && prev.narrow === next.narrow ? prev : next
      ));
    };

    measure();
    // The browser pane here never delivers ResizeObserver, so the window's
    // own resize is a second ear (STATUS.md).
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);

  return fit;
}

import * as React from 'react';
import { reducedMotion } from './stage/motion';

/**
 * Cards with weight (docs/overhaul.md, phase 6): the card under the
 * pointer tilts towards it, a sheen crosses its face, and a back's
 * layers move in depth.
 *
 * Everything is CSS. This only says where the pointer is over the card:
 * `--tx` and `--ty`, -1 to 1 from its centre, written straight onto the
 * card element with `data-tilt` while it is under the pointer, once a
 * frame at most — no render of the board per move. The stylesheet turns
 * them into a transform and a gradient's position, so nothing but
 * transforms and opacity moves.
 *
 * Measured from the card's layout size and its box's centre, never its
 * transformed edges: a tilted card's own outline would chase the
 * pointer. The stage measures through the slot, so a tilted card
 * cannot throw off the reveal (world/1).
 *
 * A fine pointer only, and never under reduced motion.
 */
export function useTilt(rootRef: React.RefObject<HTMLElement>): void {
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion() || !window.matchMedia?.('(pointer: fine)').matches) return undefined;

    let card: HTMLElement | null = null;
    let last: PointerEvent | null = null;
    let raf = 0;

    const release = () => {
      if (!card) return;
      card.style.removeProperty('--tx');
      card.style.removeProperty('--ty');
      delete card.dataset.tilt;
      card = null;
    };

    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const hit = (e.target as Element | null)?.closest?.<HTMLElement>('article.md-card') ?? null;
      const next = hit && root.contains(hit) ? hit : null;
      if (next !== card) { release(); card = next; }
      if (!card) return;
      const box = card.getBoundingClientRect();
      const w = card.offsetWidth || box.width;
      const h = card.offsetHeight || box.height;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const tx = Math.max(-1, Math.min(1, (e.clientX - cx) / (w / 2)));
      const ty = Math.max(-1, Math.min(1, (e.clientY - cy) / (h / 2)));
      card.style.setProperty('--tx', tx.toFixed(3));
      card.style.setProperty('--ty', ty.toFixed(3));
      card.dataset.tilt = '';
    };

    const move = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => {
      last = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      release();
    };

    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave);
    return () => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      if (raf) cancelAnimationFrame(raf);
      release();
    };
  }, [rootRef]);
}

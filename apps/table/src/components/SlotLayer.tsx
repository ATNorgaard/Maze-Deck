import * as React from 'react';

export interface SlotBox { left: number; top: number; width: number; height: number }

interface Props {
  /** The `.t-river` wrapper. Positioned, so it is the slots' offsetParent. */
  riverRef: React.RefObject<HTMLElement>;
  /** Which slots get a layer. */
  slots: number[];
  /** Anything that moves the slots: the size step, the river's contents. */
  layoutKey: string;
  /** Extra class on each layer, for what it holds. */
  className?: string;
  children: (slot: number) => React.ReactNode;
}

/**
 * A layer laid exactly over a river card, for whatever the table asks of
 * that card: working an Obstacle, a Wanderer's stay-or-go, Careful
 * Consideration's strike.
 *
 * Positioned from the slots' LAYOUT boxes (offset*), which no transform
 * moves — a card may be lifted or turning under it — and never inside
 * the library's markup. The layer itself lets the pointer through; only
 * what is on it takes clicks.
 */
export function SlotLayer({ riverRef, slots, layoutKey, className, children }: Props) {
  const [boxes, setBoxes] = React.useState<Record<number, SlotBox>>({});
  const key = slots.join(',');

  React.useLayoutEffect(() => {
    const measure = () => {
      const all = riverRef.current?.querySelectorAll<HTMLElement>('.md-river__slot');
      const next: Record<number, SlotBox> = {};
      for (const i of slots) {
        const slot = all?.[i];
        const card = slot?.querySelector<HTMLElement>('article');
        if (!slot || !card) continue;
        next[i] = {
          left: slot.offsetLeft + card.offsetLeft,
          top: slot.offsetTop + card.offsetTop,
          width: card.offsetWidth,
          height: card.offsetHeight,
        };
      }
      setBoxes(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // `key` and `layoutKey` stand for `slots` and the geometry.
  }, [riverRef, key, layoutKey]);

  return (
    <>
      {slots.map((slot) => {
        const box = boxes[slot];
        if (!box) return null;
        return (
          <div
            key={slot}
            className={['t-slotlayer', className].filter(Boolean).join(' ')}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            {children(slot)}
          </div>
        );
      })}
    </>
  );
}

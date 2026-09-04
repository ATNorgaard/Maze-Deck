import { CardBack, DeckCard } from '@maze-deck/ui';
import type { CardSize } from '@maze-deck/ui';
import { MOTION } from './motion';
import type { Overlay } from './useStage';

interface Props {
  overlay: Overlay | null;
  size: CardSize;
}

/**
 * The card standing in front of a river slot.
 *
 * Fixed to the slot's measured rectangle, so it must be rendered
 * OUTSIDE any transformed ancestor — a transform would make `fixed`
 * relative to it. The outer element carries the trip to the discard,
 * the inner one carries the turn, so the two never fight over
 * `transform`. The card inside is drawn at its layout size and scaled
 * down to match what an ancestor (ScaleToFit on a phone) did to the
 * real one.
 */
export function StageOverlay({ overlay, size }: Props) {
  if (!overlay) return null;
  const { rect, box, scale, turned, flight } = overlay;
  const flying = flight !== null;

  return (
    <div
      className="t-fly"
      aria-hidden="true"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transition: `transform ${MOTION.fly}ms ${MOTION.flyEase}, opacity ${MOTION.fly}ms ease-in`,
        transform: flying ? `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.s})` : 'none',
        opacity: flying ? 0.08 : 1,
      }}
    >
      <div
        style={{
          width: box.w,
          height: box.h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="t-flip" data-turned={turned || undefined}>
          <div className="t-flip__face">
            <CardBack size={size} />
          </div>
          <div className="t-flip__face t-flip__face--front">
            <DeckCard category={overlay.category} size={size} showCount={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

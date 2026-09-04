import type * as React from 'react';
import { CardBack, CATEGORY_CLASS, DeckCard } from '@maze-deck/ui';
import type { CardSize } from '@maze-deck/ui';
import { MOTION } from './motion';
import type { Deal, Overlay } from './useStage';

interface Props {
  overlay: Overlay | null;
  deals: Deal[];
  size: CardSize;
}

/**
 * A card being dealt. The outer element travels (with the overshoot
 * easing, so it lands a hair past the slot and settles back); the
 * inner one lifts and comes down again on the way, which is what turns
 * a slide into an arc. Both are keyframes driven by custom properties,
 * so one stylesheet rule serves every flight.
 */
function DealtCard({ deal }: { deal: Deal }) {
  const style = {
    left: deal.rect.left,
    top: deal.rect.top,
    width: deal.rect.width,
    height: deal.rect.height,
    '--dx': `${deal.dx}px`,
    '--dy': `${deal.dy}px`,
    '--s': deal.s,
    '--ms': `${MOTION.deal}ms`,
    '--lift': `${MOTION.dealLift}px`,
    animationDelay: `${deal.delay}ms`,
  } as React.CSSProperties;
  return (
    <div className="t-deal" aria-hidden="true" style={style}>
      <div className="t-deal__lift" style={{ animationDelay: `${deal.delay}ms` }}>
        <div style={{ width: deal.box.w, height: deal.box.h, transform: `scale(${deal.scale})`, transformOrigin: 'top left' }}>
          <CardBack size={deal.size} />
        </div>
      </div>
    </div>
  );
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
export function StageOverlay({ overlay, deals, size }: Props) {
  return (
    <>
      {deals.map((d) => <DealtCard key={d.slot} deal={d} />)}
      {overlay ? <HeldCard overlay={overlay} size={size} /> : null}
    </>
  );
}

function HeldCard({ overlay, size }: { overlay: Overlay; size: CardSize }) {
  const { rect, box, scale, turned, flight } = overlay;
  const flying = flight !== null;

  return (
    <div
      className={`t-fly ${CATEGORY_CLASS[overlay.category]}`}
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
      {/* The card's own light, thrown outward as the face comes round.
          Mounted on the turn so the animation starts with it; delayed
          half a flip, which is when the face is first visible. */}
      {turned && !flying ? (
        <div
          className="t-flare"
          style={{ animationDuration: `${MOTION.flare}ms`, animationDelay: `${MOTION.flip / 2}ms` }}
        />
      ) : null}
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

import type * as React from 'react';
import { CardBack, CATEGORY_CLASS, DeckCard } from '@maze-deck/ui';
import type { CardSize } from '@maze-deck/ui';
import { MOTION } from './motion';
import type { Deal, Flight, Overlay } from './useStage';

interface Props {
  overlay: Overlay | null;
  deals: Deal[];
  /** Cards in a beat that moves several at once. */
  flights?: Flight[];
  size: CardSize;
  /** The new board's reveal signatures, one per category (phase 6). */
  signatures?: boolean;
}

const DUST = 12;

/**
 * A card in a beat that moves several at once: a jam's sweep, the
 * Monster it brings in, the discard gathered back to the deck. One
 * keyframe rule serves them all, driven by custom properties.
 */
function FlyingCard({ flight, size }: { flight: Flight; size: CardSize }) {
  const style = {
    left: flight.rect.left,
    top: flight.rect.top,
    width: flight.rect.width,
    height: flight.rect.height,
    '--dx': `${flight.dx}px`,
    '--dy': `${flight.dy}px`,
    '--s': flight.s,
    '--ms': `${flight.ms}ms`,
    animationDelay: `${flight.delay}ms`,
  } as React.CSSProperties;
  const drawn = flight.size ?? size;
  return (
    <div
      className="t-flight"
      data-fade={flight.fade || undefined}
      data-feed={flight.key === 'feed' || undefined}
      aria-hidden="true"
      style={style}
    >
      <div style={{ width: flight.box.w, height: flight.box.h, transform: `scale(${flight.scale})`, transformOrigin: 'top left' }}>
        {flight.face
          ? <DeckCard category={flight.face} size={drawn} showCount={false} />
          : <CardBack size={drawn} />}
      </div>
    </div>
  );
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
 * the middle one the card's pose (how it stood when it was taken,
 * settling as it turns) and the inner one the turn, so none of them
 * fight over `transform`. The card inside is drawn at its layout size and scaled
 * down to match what an ancestor (ScaleToFit on a phone) did to the
 * real one.
 */
export function StageOverlay({ overlay, deals, flights = [], size, signatures = false }: Props) {
  return (
    <>
      {deals.map((d) => <DealtCard key={d.slot} deal={d} />)}
      {flights.map((f) => <FlyingCard key={f.key} flight={f} size={size} />)}
      {overlay ? <HeldCard overlay={overlay} size={size} signatures={signatures} /> : null}
    </>
  );
}

function HeldCard({ overlay, size, signatures }: { overlay: Overlay; size: CardSize; signatures: boolean }) {
  const { rect, box, scale, turned, flight, from, flipMs, category } = overlay;
  const flying = flight !== null;
  const sig = signatures && turned && !flying ? category : null;

  // The card starts as the real one stood when it was taken — lifted,
  // tilted — and settles as it turns. A Wanderer then stands up, to the
  // pose the river's raised card takes once the decision is on.
  const stand = sig === 'wanderer' ? `translateY(${(-rect.width * 3) / 69}px) scale(1.03)` : 'none';
  const pose = !turned && from
    ? `translate(${from.dx}px, ${from.dy}px) scale(${from.s}) rotateX(${from.rx}deg) rotateY(${from.ry}deg)`
    : stand;
  const poseMs = sig === 'wanderer' ? flipMs + MOTION.stand : flipMs;
  // An Obstacle's face comes down hard as it comes round, and the dust
  // goes up as it lands.
  const slamAt = Math.round(flipMs * 0.45);

  return (
    <div
      className={`t-fly ${CATEGORY_CLASS[category]}`}
      data-sig={sig ?? undefined}
      aria-hidden="true"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transition: `transform ${MOTION.fly}ms ${MOTION.flyEase}, opacity ${MOTION.fly}ms ease-in`,
        transform: flying ? `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.s})` : 'none',
        opacity: flying ? 0.08 : 1,
        ...(sig === 'obstacle' ? { '--slam': `${slamAt}ms` } : {}),
      } as React.CSSProperties}
    >
      {/* The card's own light, thrown outward as the face comes round.
          Mounted on the turn so the animation starts with it; delayed
          half a flip, which is when the face is first visible. */}
      {turned && !flying ? (
        <div
          className="t-flare"
          style={{ animationDuration: `${MOTION.flare}ms`, animationDelay: `${flipMs / 2}ms` }}
        />
      ) : null}
      <div
        className="t-fly__pose"
        style={{ transform: pose, transition: `transform ${poseMs}ms ${MOTION.settle}` }}
      >
        <div
          style={{
            width: box.w,
            height: box.h,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <div className="t-flip" data-turned={turned || undefined} style={{ transitionDuration: `${flipMs}ms` }}>
            <div className="t-flip__face">
              <CardBack size={size} />
            </div>
            <div className="t-flip__face t-flip__face--front">
              <DeckCard category={category} size={size} showCount={false} />
              {/* An Item turns slowly, and a glint crosses it once it has. */}
              {sig === 'item' ? (
                <span className="t-glint" style={{ '--ms': `${MOTION.glint}ms`, '--at': `${flipMs}ms` } as React.CSSProperties} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {/* An Obstacle slams down and kicks up dust from under its foot,
          in front of the card: it billows out past its edges. */}
      {sig === 'obstacle' ? (
        <div className="t-dust" style={{ '--ms': `${MOTION.dust}ms`, '--at': `${slamAt + 250}ms` } as React.CSSProperties}>
          {Array.from({ length: DUST }, (_, i) => (
            <span key={i} style={{ '--k': (i - (DUST - 1) / 2) / ((DUST - 1) / 2), '--r': ((i * 37) % 11) / 10 } as React.CSSProperties} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

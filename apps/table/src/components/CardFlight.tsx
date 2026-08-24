import * as React from 'react';
import { CardBack, DeckCard } from '@maze-deck/ui';
import type { CardCategory, CardSize } from '@maze-deck/ui';

/** One card's moment on screen: turn it over, hold it, maybe send it away. */
export interface FlightRequest {
  slot: number;
  category: CardCategory;
  /** Start face down and turn over. */
  flip: boolean;
  /** Send it to the discard once the beat is done. */
  fly: boolean;
  /** Called when the whole sequence finishes. */
  onDone: () => void;
}

interface Props {
  request: FlightRequest | null;
  size: CardSize;
  riverRef: React.RefObject<HTMLDivElement>;
  discardRef: React.RefObject<HTMLDivElement>;
  /** The slot the overlay is standing in for, so the board can mask it. */
  onOccupy: (slot: number | null) => void;
}

const FLIP_MS = 520;
const HOLD_MS = 620;
const FLY_MS = 640;

type Stage = 'flip' | 'hold' | 'fly';

function reduced(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The overlay that plays a card's reveal.
 *
 * It stands in front of the slot it came from — the board masks that
 * slot for as long as this is up — so the turn, the pause and the trip
 * to the discard all happen to one continuous object.
 *
 * Driven by an explicit request rather than by the engine's reveal
 * phase, because a Wanderer needs the same treatment at a different
 * moment: it is turned over on the reveal but only leaves once the GM
 * has said it does not linger.
 */
export function CardFlight({ request, size, riverRef, discardRef, onOccupy }: Props) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [target, setTarget] = React.useState<DOMRect | null>(null);
  const [stage, setStage] = React.useState<Stage>('flip');
  const [turned, setTurned] = React.useState(false);

  const done = React.useRef(request?.onDone);
  done.current = request?.onDone;
  const occupy = React.useRef(onOccupy);
  occupy.current = onOccupy;

  // Measure, mask the slot, and run the stages.
  React.useEffect(() => {
    setRect(null);
    setTarget(null);
    setTurned(false);
    setStage(request?.flip ? 'flip' : 'hold');
    if (!request) return;

    const slots = riverRef.current?.querySelectorAll('.md-river__slot');
    const card = slots?.[request.slot]?.querySelector('article');
    if (!card) { request.onDone(); return; }

    setRect(card.getBoundingClientRect());
    occupy.current(request.slot);

    if (reduced()) {
      const t = window.setTimeout(() => done.current?.(), 200);
      return () => { window.clearTimeout(t); occupy.current(null); };
    }

    const timers: number[] = [];
    let at = 0;

    if (request.flip) {
      // One frame face-down, then turn — otherwise there is nothing to
      // animate away from and it simply appears face up.
      timers.push(window.setTimeout(() => setTurned(true), 40));
      at += FLIP_MS;
      timers.push(window.setTimeout(() => setStage('hold'), at));
    }

    at += HOLD_MS;

    if (request.fly) {
      timers.push(window.setTimeout(() => {
        const to = discardRef.current?.getBoundingClientRect();
        if (!to) { done.current?.(); return; }
        setTarget(to);
        setStage('fly');
      }, at));
      at += FLY_MS;
    }

    timers.push(window.setTimeout(() => done.current?.(), at));

    return () => {
      for (const t of timers) window.clearTimeout(t);
      occupy.current(null);
    };
  }, [request, riverRef, discardRef]);

  if (!request || !rect) return null;

  const flying = stage === 'fly' && target !== null;
  const dx = flying ? (target.left + target.width / 2) - (rect.left + rect.width / 2) : 0;
  const dy = flying ? (target.top + target.height / 2) - (rect.top + rect.height / 2) : 0;
  const scale = flying && rect.width > 0 ? target.width / rect.width : 1;

  return (
    <div
      className="t-fly"
      aria-hidden="true"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transition: `transform ${FLY_MS}ms cubic-bezier(.4,.05,.35,1), opacity ${FLY_MS}ms ease-in`,
        transform: flying ? `translate(${dx}px, ${dy}px) scale(${scale})` : 'none',
        opacity: flying ? 0.08 : 1,
      }}
    >
      <div className="t-flip" data-turned={turned || undefined}>
        <div className="t-flip__face">
          <CardBack size={size} />
        </div>
        <div className="t-flip__face t-flip__face--front">
          <DeckCard category={request.category} size={size} showCount={false} />
        </div>
      </div>
    </div>
  );
}

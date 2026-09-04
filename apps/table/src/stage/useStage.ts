/* ============================================================
   The choreographer.

   Sits between the transport's view and the board. Every new view
   is diffed against the last one (see beats.ts) and the resulting
   steps are queued; the board renders the PRESENTED view, which
   advances one step at a time as each beat plays out. Two views
   that arrive close together simply extend the queue.

   The hook also owns the one physical object on the table: the
   card overlay that stands in for a river slot while it is turned
   over, held, and sent to the discard. It persists across beats —
   a reveal starts it, a later depart flies it — so the flip, the
   hold and the trip are one continuous thing, as they were in the
   CardFlight component this replaces.

   Rules of the house:
   - Any input flushes the queue. A fast GM is never made to wait.
   - Reduced motion presents the truth immediately, always.
   - The truth is never edited. Dispatch decisions come from `view`;
     only what is DRAWN comes from `presented`.
   ============================================================ */

import * as React from 'react';
import type { CardCategory, GameView } from '@maze-deck/rules';
import type { CardSize } from '@maze-deck/ui';
import { plan } from './beats';
import type { Beat, Step } from './beats';
import { MOTION, reducedMotion } from './motion';

export interface Overlay {
  slot: number;
  category: CardCategory;
  /** Where the slot's card is on screen, as measured. */
  rect: DOMRect;
  /** The card's layout size, before any ancestor transform. */
  box: { w: number; h: number };
  /** rect.width / box.w — how much an ancestor (ScaleToFit) has shrunk it. */
  scale: number;
  turned: boolean;
  /** Set once the card is on its way to the discard. */
  flight: { dx: number; dy: number; s: number } | null;
}

/** One card on its way from the deck pile to a slot. */
export interface Deal {
  slot: number;
  /** The deck pile's top card, where the flight starts. */
  rect: DOMRect;
  box: { w: number; h: number };
  scale: number;
  size: CardSize;
  /** Travel, top-left to top-left, and the size change on the way. */
  dx: number;
  dy: number;
  s: number;
  delay: number;
}

export interface Stage {
  /** What the board draws. Lags the truth by whatever is still playing. */
  presented: GameView;
  /** The beat playing right now. */
  active: Beat | null;
  /** The card standing in front of a slot, if any. */
  overlay: Overlay | null;
  /** Cards in flight from the deck pile. */
  deals: Deal[];
  /** Slots the river must mask: an overlay is in front, or a deal is owed. */
  covered: number[];
  /** Drop everything queued and show the truth. Call before any dispatch. */
  flush: () => void;
}

interface Refs {
  riverRef: React.RefObject<HTMLElement>;
  discardRef: React.RefObject<HTMLElement>;
  deckRef: React.RefObject<HTMLElement>;
}

function slotCard(river: HTMLElement | null, slot: number): HTMLElement | null {
  const slots = river?.querySelectorAll('.md-river__slot');
  return slots?.[slot]?.querySelector('article') ?? null;
}

/** The slot itself. Its box is the card's box, card or no card. */
function slotBox(river: HTMLElement | null, slot: number): HTMLElement | null {
  const slots = river?.querySelectorAll<HTMLElement>('.md-river__slot');
  return slots?.[slot] ?? null;
}

function measure(el: HTMLElement): Pick<Overlay, 'rect' | 'box' | 'scale'> {
  const rect = el.getBoundingClientRect();
  const box = { w: el.offsetWidth, h: el.offsetHeight };
  return { rect, box, scale: box.w > 0 ? rect.width / box.w : 1 };
}

export function useStage(view: GameView, refs: Refs): Stage {
  const [presented, setPresented] = React.useState(view);
  const [active, setActive] = React.useState<Beat | null>(null);
  const [overlay, setOverlayState] = React.useState<Overlay | null>(null);
  const [deals, setDeals] = React.useState<Deal[]>([]);

  const truth = React.useRef(view);
  const queue = React.useRef<Step[]>([]);
  const timers = React.useRef<number[]>([]);
  const busy = React.useRef(false);
  const ov = React.useRef<Overlay | null>(null);
  // A render counter so `covered` recomputes when the queue changes.
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  // `start` reads the presented view synchronously; a ref keeps it honest
  // when several zero-length steps apply inside one pump.
  const presentedRef = React.useRef(view);
  const present = (v: GameView) => { presentedRef.current = v; setPresented(v); };

  const setOverlay = (next: Overlay | null) => { ov.current = next; setOverlayState(next); };
  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };
  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  /**
   * Set a beat up. Returns how long it plays; zero means "apply now".
   * Anything measured here is measured against the PRESENTED board,
   * which is exactly why the presented view lags: the slot still
   * holds the card the beat is about.
   */
  const start = (step: Step): number => {
    const { beat } = step;
    switch (beat.kind) {
      case 'reveal': {
        const el = slotCard(refs.riverRef.current, beat.slot);
        if (!el) return 0;
        const wasFaceUp = presentedRef.current.river[beat.slot]?.faceUp === true;
        if (wasFaceUp) return 0;
        setOverlay({
          slot: beat.slot, category: beat.category, ...measure(el), turned: false, flight: null,
        });
        // One frame face down, then turn — otherwise there is nothing
        // to animate away from and it simply appears face up.
        later(40, () => {
          if (ov.current?.slot === beat.slot) setOverlay({ ...ov.current, turned: true });
        });
        return MOTION.flip;
      }

      case 'depart': {
        let current = ov.current;
        if (!current || current.slot !== beat.slot || current.flight) {
          const el = slotCard(refs.riverRef.current, beat.slot);
          if (!el) { setOverlay(null); return 0; }
          current = { slot: beat.slot, category: beat.category, ...measure(el), turned: true, flight: null };
        }
        const to = refs.discardRef.current?.getBoundingClientRect();
        if (!to) { setOverlay(null); return 0; }
        const { rect } = current;
        setOverlay({
          ...current,
          flight: {
            dx: (to.left + to.width / 2) - (rect.left + rect.width / 2),
            dy: (to.top + to.height / 2) - (rect.top + rect.height / 2),
            s: rect.width > 0 ? to.width / rect.width : 1,
          },
        });
        return MOTION.fly;
      }

      case 'progress':
      case 'strike':
        return MOTION.pulse;

      case 'discard':
        return MOTION.drop;

      case 'deal': {
        // Dealt from the deck pile's own top card, so the flight starts
        // at its size and grows to the slot's on the way.
        const top = refs.deckRef.current?.querySelector<HTMLElement>('article');
        if (!top) return 0;
        const from = measure(top);
        const size = (top.dataset.size as CardSize | undefined) ?? 'sm';
        const flights: Deal[] = [];
        beat.slots.forEach((slot, i) => {
          const target = slotBox(refs.riverRef.current, slot);
          if (!target) return;
          const to = target.getBoundingClientRect();
          flights.push({
            slot,
            ...from,
            size,
            dx: to.left - from.rect.left,
            dy: to.top - from.rect.top,
            s: from.rect.width > 0 ? to.width / from.rect.width : 1,
            delay: i * MOTION.dealStagger,
          });
        });
        if (flights.length === 0) return 0;
        setDeals(flights);
        return MOTION.deal + MOTION.dealStagger * (flights.length - 1);
      }

      case 'settle':
        setOverlay(null);
        return 0;

      case 'sync':
      case 'turn':
        // The held card is released once the reveal is really over.
        if (ov.current && !ov.current.flight && step.after.phase !== 'reveal') setOverlay(null);
        return 0;

    }
  };

  const end = (step: Step) => {
    if (step.beat.kind === 'depart') setOverlay(null);
    // The dealt cards vanish as the slots underneath show their own —
    // same place, same size, so nothing is seen to change.
    if (step.beat.kind === 'deal') setDeals([]);
  };

  const pump = React.useRef<() => void>(() => {});
  pump.current = () => {
    while (!busy.current) {
      const step = queue.current.shift();
      if (!step) { tick(); return; }
      const ms = start(step);
      if (ms <= 0) { end(step); present(step.after); continue; }
      busy.current = true;
      setActive(step.beat);
      // A track beat IS its state change: the pip fills on the impact
      // and the pulse follows; a drop onto the discard likewise. Cards in
      // flight land as their beat ends.
      const k = step.beat.kind;
      if (k === 'progress' || k === 'strike' || k === 'discard') present(step.after);
      tick();
      later(ms, () => {
        end(step);
        present(step.after);
        busy.current = false;
        setActive(null);
        pump.current();
      });
    }
  };

  const flush = React.useCallback(() => {
    clearTimers();
    queue.current = [];
    busy.current = false;
    setActive(null);
    setOverlay(null);
    setDeals([]);
    present(truth.current);
  }, []);

  React.useEffect(() => {
    if (view === truth.current) return;
    const prev = truth.current;
    truth.current = view;
    if (reducedMotion()) { flush(); return; }
    queue.current.push(...plan(prev, view));
    pump.current();
  }, [view, flush]);

  React.useEffect(() => () => clearTimers(), []);

  const covered = React.useMemo(() => {
    const set = new Set<number>();
    if (ov.current) set.add(ov.current.slot);
    if (active?.kind === 'deal') for (const s of active.slots) set.add(s);
    for (const step of queue.current) {
      if (step.beat.kind === 'deal') for (const s of step.beat.slots) set.add(s);
    }
    return [...set].sort();
    // The queue is a ref; `tick` re-renders when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, active, presented]);

  return { presented, active, overlay, deals, covered, flush };
}

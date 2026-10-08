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
import { cue } from './sound';

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

/**
 * A card crossing the table in a beat that moves several at once: a
 * jam's sweep, the Monster it brings in, the discard gathered back onto
 * the deck. Straight there, top-left to top-left.
 */
export interface Flight {
  key: string;
  rect: DOMRect;
  box: { w: number; h: number };
  scale: number;
  /** The card size it is drawn at; the river's when unset. */
  size?: CardSize;
  /** What it shows. Null is a back. */
  face: CardCategory | null;
  dx: number;
  dy: number;
  s: number;
  delay: number;
  ms: number;
  /** Fades as it lands, as a card going onto a pile does; or lands whole. */
  fade: boolean;
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
  /** Cards in flight in a beat that moves several at once. */
  flights: Flight[];
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

/** Centre to centre, and the size change, from one box to another. */
function toward(from: DOMRect, to: DOMRect): Pick<Flight, 'dx' | 'dy' | 's'> {
  return {
    dx: (to.left + to.width / 2) - (from.left + from.width / 2),
    dy: (to.top + to.height / 2) - (from.top + from.height / 2),
    s: from.width > 0 ? to.width / from.width : 1,
  };
}

const EMPTY_SLOT = { category: null, faceUp: false, filled: false } as const;

/**
 * Where a slot's card RESTS, on screen. Read through the slot, never the
 * card: a pickable card lifts under the pointer (a transform on the card
 * itself) and drops back as the pick lands, so measuring the card put the
 * overlay ~10px above where the card came to rest, for as long as nothing
 * re-rendered. The slot is never transformed in play, and the card's
 * offset inside it is layout, which no transform touches.
 */
function measureSlotCard(river: HTMLElement | null, slot: number): Pick<Overlay, 'rect' | 'box' | 'scale'> | null {
  const holder = slotBox(river, slot);
  const card = holder?.querySelector<HTMLElement>('article');
  if (!holder || !card) return null;
  const outer = holder.getBoundingClientRect();
  const scale = holder.offsetWidth > 0 ? outer.width / holder.offsetWidth : 1;
  const box = { w: card.offsetWidth, h: card.offsetHeight };
  const rect = new DOMRect(
    outer.left + card.offsetLeft * scale,
    outer.top + card.offsetTop * scale,
    box.w * scale,
    box.h * scale,
  );
  return { rect, box, scale };
}

export function useStage(view: GameView, refs: Refs): Stage {
  const [presented, setPresented] = React.useState(view);
  const [active, setActive] = React.useState<Beat | null>(null);
  const [overlay, setOverlayState] = React.useState<Overlay | null>(null);
  const [deals, setDeals] = React.useState<Deal[]>([]);
  const [flights, setFlights] = React.useState<Flight[]>([]);

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
        const m = measureSlotCard(refs.riverRef.current, beat.slot);
        if (!m) return 0;
        const wasFaceUp = presentedRef.current.river[beat.slot]?.faceUp === true;
        if (wasFaceUp) return 0;
        setOverlay({
          slot: beat.slot, category: beat.category, ...m, turned: false, flight: null,
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
          const m = measureSlotCard(refs.riverRef.current, beat.slot);
          if (!m) { setOverlay(null); return 0; }
          current = { slot: beat.slot, category: beat.category, ...m, turned: true, flight: null };
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

      // The pip pops and the board shakes on the beat; the track's glow
      // runs to completion on its own (it is keyed on the value in the
      // screens), so the queue only waits for the impact.
      case 'progress':
        return MOTION.pop;
      case 'strike':
        return MOTION.shake;

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
        // The slots being dealt into show as empty outlines under the
        // cards in flight — a card turned back down, or one replaced
        // under the redaction, must not sit there face up meanwhile.
        const emptied = {
          ...presentedRef.current,
          river: presentedRef.current.river.map((s, i) => (
            beat.slots.includes(i) ? { category: null, faceUp: false, filled: false } : s
          )),
        };
        present(emptied);
        setDeals(flights);
        return MOTION.deal + MOTION.dealStagger * (flights.length - 1);
      }

      case 'settle':
        // The overlay goes and the slot's own card takes the thud.
        setOverlay(null);
        return MOTION.thud;

      // The river swept at once: every card flies for the discard together,
      // a beat apart, and the slots stand empty behind them for the deal.
      case 'jam': {
        const to = refs.discardRef.current?.getBoundingClientRect();
        if (!to) return 0;
        setOverlay(null);
        const out: Flight[] = [];
        beat.slots.forEach((slot, i) => {
          const m = measureSlotCard(refs.riverRef.current, slot);
          if (!m) return;
          out.push({
            key: `jam${slot}`, ...m, face: beat.faces[i] ?? null, ...toward(m.rect, to),
            delay: out.length * MOTION.sweepStagger, ms: MOTION.fly, fade: true,
          });
        });
        if (out.length === 0) return 0;
        present({ ...presentedRef.current, river: presentedRef.current.river.map(() => EMPTY_SLOT) });
        setFlights(out);
        return MOTION.fly + MOTION.sweepStagger * (out.length - 1);
      }

      // A card from outside the deck, brought in from beyond the edge of
      // the table and put down on the discard — which the jam's noise did.
      case 'feed': {
        // The pile's top card, or the empty place for one: a jam onto an
        // empty discard starts this beat in the same tick the swept cards
        // land, before the pile has been drawn with them.
        const pile = refs.discardRef.current;
        const top = pile?.querySelector<HTMLElement>('article') ?? pile?.querySelector<HTMLElement>('.md-pile__empty');
        if (!top) return 0;
        const m = measure(top);
        const size = (pile?.querySelector<HTMLElement>('[data-size]')?.dataset.size as CardSize | undefined) ?? 'sm';
        const rect = new DOMRect(window.innerWidth + m.rect.width * 0.2, m.rect.top - m.rect.height * 0.35, m.rect.width, m.rect.height);
        setFlights([{
          key: 'feed', rect, box: m.box, scale: m.scale, size,
          face: beat.category, dx: m.rect.left - rect.left, dy: m.rect.top - rect.top, s: 1,
          delay: 0, ms: MOTION.feed, fade: false,
        }]);
        return MOTION.feed;
      }

      // The deck ran dry: the discard is gathered up, turned over, and put
      // back as the deck, a few cards seen to go for the whole pile.
      case 'reshuffle': {
        const from = refs.discardRef.current?.querySelector<HTMLElement>('article');
        const to = (refs.deckRef.current?.querySelector<HTMLElement>('article') ?? refs.deckRef.current)?.getBoundingClientRect();
        if (!from || !to || beat.count <= 0) return 0;
        const m = measure(from);
        const size = (from.dataset.size as CardSize | undefined) ?? 'sm';
        const n = Math.min(5, beat.count);
        setFlights(Array.from({ length: n }, (_, i) => ({
          key: `gather${i}`, ...m, size, face: null, ...toward(m.rect, to),
          delay: i * MOTION.gatherStagger, ms: MOTION.gather, fade: false,
        })));
        return MOTION.gather + MOTION.gatherStagger * (n - 1);
      }

      // The board holds while the dark comes in; the screen draws it.
      case 'found':
        return MOTION.found;

      case 'sync':
      case 'turn':
        // The held card is released once the reveal is really over.
        if (ov.current && !ov.current.flight && step.after.phase !== 'reveal') setOverlay(null);
        // The turn passing is the baton's slide; the new seat, the new
        // signpost and the rest of the truth land as it arrives.
        return beat.kind === 'turn' && beat.from !== beat.to ? MOTION.baton : 0;

      default:
        return 0;
    }
  };

  const end = (step: Step) => {
    const k = step.beat.kind;
    if (k === 'depart') setOverlay(null);
    // The dealt cards vanish as the slots underneath show their own —
    // same place, same size, so nothing is seen to change.
    if (k === 'deal') setDeals([]);
    // Likewise a card fed onto the discard, which shows it on top as it goes.
    if (k === 'jam' || k === 'feed' || k === 'reshuffle') setFlights([]);
  };

  const pump = React.useRef<() => void>(() => {});
  pump.current = () => {
    while (!busy.current) {
      const step = queue.current.shift();
      if (!step) { tick(); return; }
      cue(step.beat);
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
    setFlights([]);
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

  // The overlay is fixed to the viewport where the slot was when the
  // beat began. Anything that moves the river while the card is held —
  // a scene longer than its band, an error notice, the page scrolled —
  // would leave it standing off its own slot, so until it flies it
  // follows the slot. Runs after every render of the screen, which is
  // when a mounting scene line would have moved it.
  React.useLayoutEffect(() => {
    if (!overlay || overlay.flight) return undefined;
    const follow = () => {
      const cur = ov.current;
      if (!cur || cur.flight) return;
      const m = measureSlotCard(refs.riverRef.current, cur.slot);
      if (!m) return;
      if (Math.abs(m.rect.top - cur.rect.top) < 0.5 && Math.abs(m.rect.left - cur.rect.left) < 0.5) return;
      setOverlay({ ...cur, ...m });
    };
    follow();
    window.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow);
      window.removeEventListener('resize', follow);
    };
  });

  // Only the slot an overlay stands in front of is masked. A slot owed a
  // deal is presented EMPTY instead — the dashed outline under the card
  // arriving — so there is never a dark hole in the river.
  const covered = React.useMemo(() => (overlay ? [overlay.slot] : []), [overlay]);

  return { presented, active, overlay, deals, flights, covered, flush };
}

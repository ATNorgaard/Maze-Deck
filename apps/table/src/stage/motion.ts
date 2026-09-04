/* ============================================================
   Motion tokens.

   Every beat on the table takes its timing from here, so the whole
   board moves with one hand. Durations are milliseconds; easings are
   the CSS strings the overlays use, so a stylesheet and a timer can
   never disagree about how long a thing takes.

   The vocabulary, loosely:
     settle    — the default. Fast out, soft in. Things arriving.
     overshoot — a little past the mark and back. Things landing.
     fly       — a card crossing the table. Slow start, decisive end.
   ============================================================ */

export const MOTION = {
  /* durations */
  quick: 120,
  flip: 520,
  /** A revealed card is held face up at least this long before it may leave. */
  hold: 620,
  fly: 640,
  deal: 420,
  dealStagger: 110,
  /** How high a dealt card lifts off the table mid-flight, in px. */
  dealLift: 18,
  drop: 260,
  /** A revealed card's light flaring out from it as it turns. */
  flare: 700,
  /** A track beat: the pip pops on the first frame, the glow follows. */
  pulse: 700,
  pop: 360,
  shake: 380,
  /** A revealed blocker landing where it is. */
  thud: 320,
  /** A die in the air before it stops. */
  tumble: 650,
  /** The board's moment at the end of a run, before the dialog is allowed in. */
  ending: 1600,
  baton: 320,

  /* easings */
  settle: 'cubic-bezier(.2, .7, .3, 1)',
  overshoot: 'cubic-bezier(.34, 1.45, .64, 1)',
  flyEase: 'cubic-bezier(.4, .05, .35, 1)',
} as const;

/** True when the viewer has asked for less motion. Every beat becomes a cut. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

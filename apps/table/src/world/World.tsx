import * as React from 'react';
import { hexToRgb, mix, readPalette } from '@maze-deck/art';
import type { Palette, Side } from '@maze-deck/art';
import type { CardCategory } from '@maze-deck/rules';
import type { Biome } from '../biomes';
import { useDesign } from '../components/pixel';
import { reducedMotion } from '../stage/motion';
import { WorldPainter } from './painter';
import { MAX_WORDS, NO_EDGE, WorldRenderer } from './renderer';
import type { Edge, Mood, Rgb, WordRegion, WorldColors } from './renderer';
import { startingTier, useWorldChoice } from './settings';
import type { Tier } from './settings';

interface Props {
  biome: Biome;
  /** The side being played: the world is that side's. */
  side: Side;
  /** What the world should look like now. Read every frame; never re-creates anything. */
  mood: Omit<Mood, 'parallax' | 'focus' | 'words'>;
  /** Where the screen has words over the world, and their budgets: BOARD_WORDS or PHONE_WORDS. */
  words: readonly Words[];
  /** The part of the table the phase is about — the river, the hand — or null. */
  focus: { name: string; ref: React.RefObject<HTMLElement> } | null;
  /** A card just turned: its category, and anything that changes per turn. */
  flash: { key: string; category: CardCategory } | null;
}

/** A kind of element that carries words, and how bright the world may be behind it. */
export interface Words {
  sel: string;
  budget: number;
}

/**
 * The board's words and their budgets, as check-art.cjs reads them:
 * notes in the faintest parchment need 4.5:1, so 0.023 behind the
 * caption, the hand and the rail, and 0.074 behind the top bar's and
 * the ticker's larger words.
 */
export const BOARD_WORDS: readonly Words[] = [
  { sel: '.t-top', budget: 0.074 },
  { sel: '.t-scene', budget: 0.023 },
  { sel: '.t-hand', budget: 0.023 },
  { sel: '.t-rail', budget: 0.023 },
  { sel: '.t-ticker', budget: 0.074 },
];

/** The phone's words, on the same budgets. */
export const PHONE_WORDS: readonly Words[] = [
  { sel: '.t-phone__top', budget: 0.074 },
  { sel: '.t-phone__scene', budget: 0.023 },
  { sel: '.t-phone__prompt', budget: 0.023 },
  { sel: '.t-phone__rail', budget: 0.023 },
];

const CAT: Record<CardCategory, keyof Palette['cat']> = {
  'clear-path': 'path', obstacle: 'obst', wanderer: 'wand', item: 'item', monster: 'mons', 'dead-end': 'dead', trap: 'trap',
};

const rgb = (hex: string): Rgb => {
  const [r, g, b] = hexToRgb(hex || '#000000');
  return [r / 255, g / 255, b / 255];
};

function colorsOf(pal: Palette, light: keyof Palette['cat']): WorldColors {
  return {
    dark: rgb(pal.ink[900]),
    light: rgb(pal.cat[light][500]),
    threat: rgb(pal.cat.mons[500]),
  };
}

/**
 * How the dark comes in each setting (docs/overhaul.md, phase 5). Every
 * one draws in and reddens; each adds its own shapes at the edge, and
 * none of them shows before the first strike.
 */
function edgeOf(id: string, pal: Palette): Edge {
  const eyes = (count: number, size: number, low: number, color: string) => ({ count, size, low, color: rgb(color) });
  switch (id) {
    // Something watching from between the pillars; the torches gutter.
    case 'dungeon':
      return { ...NO_EDGE, eyes: eyes(5, 1, 0.35, pal.cat.mons[300]), gutter: 0.6 };
    // A long climb with candles on it, and they gutter. One or two things above.
    case 'tower':
      return { ...NO_EDGE, eyes: eyes(2, 0.9, 0, pal.cat.item[300]), reach: 0.8, gutter: 1 };
    // The dark reaches in like roots, full of eyes.
    case 'deep-forest':
      return { ...NO_EDGE, eyes: eyes(8, 0.9, 0.25, pal.cat.path[300]), reach: 1.6 };
    // A wall of sand closing in.
    case 'desert':
      return { ...NO_EDGE, reach: 0.7, storm: 1, color: rgb(mix(pal.parchment[400], pal.cat.path[700], 0.5)) };
    // Small eyes, low down, many of them.
    case 'undercity':
      return { ...NO_EDGE, eyes: eyes(11, 0.55, 0.9, pal.cat.mons[500]), reach: 1.1 };
    // Frost creeping over the edge, and something pale keeping pace.
    case 'frozen-pass':
      return {
        ...NO_EDGE, eyes: eyes(3, 1.15, 0.5, pal.parchment[100]), rime: 1,
        color: rgb(mix(pal.parchment[100], pal.cat.wand[300], 0.35)),
      };
    // Wolves in the wheat, either side of the road.
    case 'kings-road':
      return { ...NO_EDGE, eyes: eyes(4, 1, 0.55, pal.cat.mons[300]), reach: 1.2 };
    // The wisps drifting in, low over the water, to lure.
    case 'mire':
      return { ...NO_EDGE, eyes: eyes(6, 0.9, 0.85, pal.cat.obst[300]), reach: 1.3 };
    // The storm closing in, rain driving across, and something big on the ridge.
    case 'high-road':
      return {
        ...NO_EDGE, eyes: eyes(2, 1.15, 0, pal.cat.mons[300]), storm: 0.7,
        color: rgb(mix(pal.parchment[300], pal.cat.wand[700], 0.5)),
      };
    // Drowned sailors' lights, out on the water, coming in with the tide.
    case 'drowned-coast':
      return { ...NO_EDGE, eyes: eyes(6, 0.55, 0.9, pal.cat.wand[300]), reach: 1.2 };
    // Ghost-lights drifting in from the mounds, and the mist with them.
    case 'barrow-moor':
      return {
        ...NO_EDGE, eyes: eyes(5, 0.9, 0.3, pal.cat.wand[300]), rime: 0.6,
        color: rgb(mix(pal.parchment[300], pal.cat.wand[300], 0.4)),
      };
    // Heat haze and embers closing in; something swimming in the fire.
    case 'ember-hold':
      return {
        ...NO_EDGE, eyes: eyes(3, 1, 0.6, pal.cat.path[300]), storm: 0.6,
        color: rgb(mix(pal.cat.path[700], pal.ink[900], 0.3)),
      };
    // Small eyes in clusters, and the fungus light going out.
    case 'underdark':
      return { ...NO_EDGE, eyes: eyes(12, 0.55, 0.2, pal.cat.mons[300]), gutter: 0.7 };
    // The vines creeping in, and eyes in the leaves.
    case 'sunken-jungle':
      return { ...NO_EDGE, eyes: eyes(8, 0.9, 0.4, pal.cat.path[300]), reach: 1.6 };
    default:
      return { ...NO_EDGE, eyes: eyes(4, 1, 0.3, pal.cat.mons[300]) };
  }
}

/** Canvas pixels per CSS pixel, by tier (times the device's, at most 2). The picture is pixel art: `low` lets the browser scale it up. */
const SCALE: Record<Tier, number> = { high: 1, low: 0.5, still: 1 };

/** The design's frames a second, by tier: the review page drew them at about 12. */
const FPS: Record<Tier, number> = { high: 12, low: 8, still: 0 };

/** The moment a still world shows. */
const STILL_T = 1.3;

/** The design's short side, in its own pixels: the worlds were drawn at 320 by 200. */
const SHORT = 200;

/**
 * The design's size for a viewport: its shape, with the short side 200
 * of its pixels, so a phone held upright gets a tall world rather than a
 * sliver of a wide one. The shape rounds to a tenth, so a small resize
 * does not build it again.
 */
function designSize(w: number, h: number): [number, number] {
  const a = Math.round(Math.max(0.42, Math.min(2.4, w / Math.max(1, h))) * 10) / 10;
  return a >= 1 ? [Math.round((SHORT * a) / 4) * 4, SHORT] : [SHORT, Math.round(SHORT / a / 4) * 4];
}

/**
 * A frame slower than this, as the median over a stretch, is a device
 * that cannot keep up with the tier it is on. ~45fps.
 */
const SLOW_MS = 22;
const WINDOW = 120;

const NEXT_DOWN: Record<Tier, Tier> = { high: 'low', low: 'still', still: 'still' };

/**
 * The world layer (docs/overhaul.md, phase 3; docs/settings-build.md,
 * set/3): one canvas behind the table, showing the played side's world
 * as its design draws it, and moving with the crossing: a turned card's
 * colour washing out from the river, the dark drawing in with threat
 * (and the setting's own lights guttering), the air going still one
 * strike short of being found, the light going out when the run is
 * lost, gold when the party is through.
 *
 * The design draws its picture a dozen times a second, in a worker
 * (paint.worker.ts; only the pixels its lights touch are worked out
 * again), and the GPU lays the mood over it and scales it to the screen
 * (renderer.ts).
 *
 * Tiers: `high` draws the design 12 times a second at the device's
 * pixels; `low` 8 times, at half of them; `still` draws one frame
 * whenever something changes and never runs a loop, the tier for
 * reduced motion and the floor an `auto` world steps down to. `off`, or
 * no WebGL2, leaves the world's still frame on the page (biomes.css).
 */
export function World({ biome, side, mood, words, focus, flash }: Props) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [choice] = useWorldChoice();
  const motionless = reducedMotion();
  const [autoTier, setAutoTier] = React.useState<Tier>(startingTier);
  const tier: Tier | null = choice === 'off' ? null
    : motionless ? 'still'
    : choice === 'auto' ? autoTier
    : choice;
  const [failed, setFailed] = React.useState(false);
  // A new choice is a new attempt: picking a tier by hand after an
  // world stepped aside should be able to bring it back.
  React.useEffect(() => { setFailed(false); }, [choice]);
  const live = tier !== null && !failed;
  const design = useDesign(biome.id, side);
  // Shown once it has drawn: until then the still frame under it shows.
  const [drawn, setDrawn] = React.useState<string | null>(null);

  // The design's size follows the viewport's shape, once a resize settles.
  const [size, setSize] = React.useState<[number, number]>(() => designSize(window.innerWidth, window.innerHeight));
  React.useEffect(() => {
    let timer = 0;
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = designSize(window.innerWidth, window.innerHeight);
        setSize((prev) => (prev[0] === next[0] && prev[1] === next[1] ? prev : next));
      }, 250);
    };
    window.addEventListener('resize', settle);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', settle); };
  }, []);
  const [W, H] = size;

  // Read by the loop every frame; written by every render.
  const target = React.useRef<Mood>({ ...mood, focus: null, parallax: { x: 0, y: 0 }, words: [] });
  target.current = { ...mood, focus: target.current.focus, parallax: target.current.parallax, words: target.current.words };
  const focusRef = React.useRef(focus);
  focusRef.current = focus;
  const wordsRef = React.useRef(words);
  wordsRef.current = words;

  /**
   * The layout, measured: where the focus is, so a card's colour comes
   * from where the eye is, and where the words are, so the world keeps
   * its budget behind them.
   */
  const measureFocus = React.useRef(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const regions: WordRegion[] = [];
    for (const w of wordsRef.current) {
      for (const el of document.querySelectorAll(w.sel)) {
        const b = el.getBoundingClientRect();
        if (b.width && b.height && regions.length < MAX_WORDS) {
          regions.push({ x0: b.left / vw, y0: b.top / vh, x1: b.right / vw, y1: b.bottom / vh, budget: w.budget });
        }
      }
    }
    target.current.words = regions;
    const el = focusRef.current?.ref.current;
    if (!el) { target.current.focus = null; return; }
    const b = el.getBoundingClientRect();
    target.current.focus = {
      x: (b.left + b.width / 2) / vw,
      y: (b.top + b.height / 2) / vh,
    };
  });
  const renderer = React.useRef<WorldRenderer | null>(null);
  const drawStill = React.useRef<() => void>(() => {});

  // The canvas, the design and the loop. Made again when the tier, the
  // design or its size changes.
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !live || tier === null || !design) return undefined;
    let r: WorldRenderer;
    try {
      r = new WorldRenderer(canvas);
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.current = r;

    // CPU-drawn WebGL is no GPU at all: one still frame when the mood
    // changes, never a loop.
    if (choice === 'auto' && tier !== 'still' && r.isSoftware()) {
      r.dispose();
      renderer.current = null;
      setAutoTier('still');
      return undefined;
    }

    const lost = (e: Event) => { e.preventDefault(); setFailed(true); };
    canvas.addEventListener('webglcontextlost', lost);

    const pal = readPalette(canvas);
    const edge = edgeOf(biome.id, pal);
    r.setting(colorsOf(pal, biome.light), edge);
    const fit = () => r.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight,
      Math.min(window.devicePixelRatio || 1, 2) * SCALE[tier]);
    fit();

    // The design, drawn in a worker at this size. Where the setting
    // burns flames, its flickering lights gutter as the dark comes
    // (Edge.gutter). Each picture is uploaded as it comes; the still
    // tier, and the first picture, are drawn at once.
    r.picture(W, H);
    let shown = false;
    const painter = new WorldPainter((pixels) => {
      r.upload(pixels);
      if (tier === 'still') r.frame(30, Infinity, target.current);
      else if (!shown) r.frame(performance.now() / 1000, 0, target.current);
      if (!shown) { shown = true; setDrawn(design.id); }
    }, () => setFailed(true));
    const paint = (t: number) => painter.request(t, edge.gutter * r.threat);

    // The still tier draws on demand, at a fixed moment: the mood at
    // once, and the picture when the worker has it.
    drawStill.current = () => {
      measureFocus.current();
      r.frame(30, Infinity, target.current);
      paint(STILL_T);
    };

    let raf = 0;
    let last = performance.now();
    let lastPaint = -Infinity;
    // The design's own clock: it runs slower in the hush.
    let clock = STILL_T;
    const intervals: number[] = [];
    let frames = 0;
    let windowStart = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      if (choice === 'auto') {
        intervals.push(now - last);
        // Judged every WINDOW frames or every two seconds, whichever comes
        // first: at 9fps a frame count alone took thirteen seconds.
        if (intervals.length >= WINDOW || (now - windowStart >= 2000 && intervals.length >= 10)) {
          const median = [...intervals].sort((a, b) => a - b)[intervals.length >> 1] ?? 0;
          intervals.length = 0;
          windowStart = now;
          if (median > SLOW_MS && tier !== 'still') {
            setAutoTier(NEXT_DOWN[tier]);
            return;
          }
        }
      }
      last = now;
      clock += dt * r.clock;
      // Layout is read a few times a second, not every frame.
      if ((frames += 1) % 15 === 1) measureFocus.current();
      if (now - lastPaint >= 1000 / FPS[tier] - 4) {
        lastPaint = now;
        paint(clock);
      }
      r.frame(now / 1000, dt, target.current);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (tier === 'still') { drawStill.current(); return; }
      if (raf || document.visibilityState === 'hidden') return;
      last = performance.now();
      windowStart = last;
      intervals.length = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const visible = () => (document.visibilityState === 'hidden' ? stop() : start());

    const onResize = () => { fit(); if (tier === 'still') drawStill.current(); };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', visible);
    let disposed = false;
    void painter.load(biome.id, side, W, H, edge.gutter > 0).then(() => { if (!disposed) start(); });

    return () => {
      disposed = true;
      stop();
      painter.dispose();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', visible);
      canvas.removeEventListener('webglcontextlost', lost);
      r.dispose();
      renderer.current = null;
      drawStill.current = () => {};
    };
  }, [tier, live, biome.id, side, choice, design, W, H]);

  // Desktop pointer parallax: a few pixels.
  React.useEffect(() => {
    if (!live || tier === 'still' || !window.matchMedia?.('(pointer: fine)').matches) return undefined;
    const move = (e: PointerEvent) => {
      target.current.parallax = {
        x: (e.clientX / window.innerWidth - 0.5) * -12,
        y: (e.clientY / window.innerHeight - 0.5) * -8,
      };
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [live, tier]);

  // A turned card's colour, once per turn.
  const flashKey = flash?.key ?? null;
  React.useEffect(() => {
    const r = renderer.current;
    const canvas = ref.current;
    if (!r || !flash || !canvas) return;
    r.flash(rgb(readPalette(canvas).cat[CAT[flash.category]][500]));
  }, [flashKey]);

  // Still: draw again when the mood changes, not on every render of the
  // table — a turn renders it dozens of times.
  const stillKey = [mood.threat, mood.progress, mood.hush, mood.dim, mood.bloom, focus?.name ?? '-'].join('|');
  React.useEffect(() => {
    if (tier === 'still') drawStill.current();
  }, [tier, stillKey]);

  if (!live) return null;
  return (
    <canvas
      ref={ref}
      className="t-world"
      data-live={(design !== null && drawn === design.id) || undefined}
      data-tier={tier ?? undefined}
      data-design={design?.id}
      aria-hidden="true"
    />
  );
}

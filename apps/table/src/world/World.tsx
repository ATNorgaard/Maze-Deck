import * as React from 'react';
import { hexToRgb, mix, readPalette, vocabOf } from '@maze-deck/art';
import type { Palette } from '@maze-deck/art';
import type { CardCategory } from '@maze-deck/rules';
import type { Biome } from '../biomes';
import { reducedMotion } from '../stage/motion';
import { NO_EDGE, WorldRenderer } from './renderer';
import type { Edge, Mood, Rgb, WorldColors } from './renderer';
import { startingTier, useWorldChoice } from './settings';
import type { Tier } from './settings';

interface Props {
  biome: Biome;
  /** What the world should look like now. Read every frame; never re-creates anything. */
  mood: Omit<Mood, 'parallax' | 'focus'>;
  /** The part of the table the phase is about — the river, the hand — or null. */
  focus: { name: string; ref: React.RefObject<HTMLElement> } | null;
  /** A card just turned: its category, and anything that changes per turn. */
  flash: { key: string; category: CardCategory } | null;
}

const CAT: Record<CardCategory, keyof Palette['cat']> = {
  'clear-path': 'path', obstacle: 'obst', wanderer: 'wand', item: 'item', monster: 'mons', 'dead-end': 'dead', trap: 'trap',
};

const rgb = (hex: string): Rgb => {
  const [r, g, b] = hexToRgb(hex || '#000000');
  return [r / 255, g / 255, b / 255];
};

function colorsOf(pal: Palette, light: keyof Palette['cat']): WorldColors {
  return {
    ink900: rgb(pal.ink[900]),
    ink800: rgb(pal.ink[800]),
    ink700: rgb(pal.ink[700]),
    parchment100: rgb(pal.parchment[100]),
    parchment300: rgb(pal.parchment[300]),
    parchment400: rgb(pal.parchment[400]),
    light: rgb(pal.cat[light][500]),
    lightSoft: rgb(pal.cat[light][300]),
    threat: rgb(pal.cat.mons[500]),
  };
}

/** Where each setting hangs its light, as its ground did (bake-art.cjs). */
const POOL_Y: Partial<Record<string, number>> = { desert: 0.2 };

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
    default:
      return { ...NO_EDGE, eyes: eyes(4, 1, 0.3, pal.cat.mons[300]) };
  }
}

/** Device pixels per CSS pixel, by tier. Fog is soft; it does not need the full screen. */
const SCALE: Record<Tier, number> = { high: 1.25, low: 0.5, still: 0.75 };

/** Particles at 1920 x 1080, by tier; scaled by area. */
const AIR: Record<Tier, number> = { high: 140, low: 60, still: 140 };

/**
 * A frame slower than this, as the median over a stretch, is a device
 * that cannot keep up with the tier it is on. ~45fps.
 */
const SLOW_MS = 22;
const WINDOW = 120;

const NEXT_DOWN: Record<Tier, Tier> = { high: 'low', low: 'still', still: 'still' };

/**
 * The world layer (docs/overhaul.md, phase 3): one canvas behind the
 * table, drawing the setting's ground and its air, and moving with the
 * crossing — the light leaning to where the phase is, a turned card's
 * colour washing out from the river, the dark drawing in with threat,
 * the light going out when the run is lost.
 *
 * Tiers: `high` draws everything at 1.25 device pixels; `low` at half
 * resolution with fewer particles; `still` draws one frame whenever
 * something changes and never runs a loop — the tier for reduced
 * motion, and the floor an `auto` world steps down to. `off`, or no
 * WebGL2, leaves the old animated ground on the page.
 */
export function World({ biome, mood, focus, flash }: Props) {
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

  // Read by the loop every frame; written by every render.
  const target = React.useRef<Mood>({ ...mood, focus: null, parallax: { x: 0, y: 0 } });
  target.current = { ...mood, focus: target.current.focus, parallax: target.current.parallax };
  const focusRef = React.useRef(focus);
  focusRef.current = focus;

  /** Where the focus is on screen, measured, so the light follows layout. */
  const measureFocus = React.useRef(() => {
    const el = focusRef.current?.ref.current;
    if (!el) { target.current.focus = null; return; }
    const b = el.getBoundingClientRect();
    target.current.focus = {
      x: (b.left + b.width / 2) / window.innerWidth,
      y: (b.top + b.height / 2) / window.innerHeight,
    };
  });
  const renderer = React.useRef<WorldRenderer | null>(null);
  const drawStill = React.useRef<() => void>(() => {});

  // The canvas and the loop. Re-made only when the tier changes.
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !live || tier === null) return undefined;
    let r: WorldRenderer;
    try {
      r = new WorldRenderer(canvas);
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.current = r;

    // CPU-drawn WebGL is no GPU at all: one still frame when the mood
    // changes, never a loop. Measured at a desktop's real density, that
    // still beats the old animated ground there on every count — idle
    // 0.17 s against 1.2 s per 4 s at 4x CPU (docs/overhaul.md, world/3).
    if (choice === 'auto' && tier !== 'still' && r.isSoftware()) {
      r.dispose();
      renderer.current = null;
      setAutoTier('still');
      return undefined;
    }

    const lost = (e: Event) => { e.preventDefault(); setFailed(true); };
    canvas.addEventListener('webglcontextlost', lost);

    const pal = readPalette(canvas);
    const vocab = vocabOf(biome.id);
    const area = Math.sqrt((window.innerWidth * window.innerHeight) / (1920 * 1080));
    r.setting(biome.id, colorsOf(pal, vocab.light), vocab.particle, POOL_Y[biome.id] ?? 0.08,
      Math.round(AIR[tier] * Math.max(0.5, Math.min(1.6, area))), edgeOf(biome.id, pal));

    const size = () => r.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight,
      Math.min(window.devicePixelRatio || 1, 1.5) * SCALE[tier]);
    size();

    // The still tier draws on demand, at a fixed moment.
    drawStill.current = () => { measureFocus.current(); r.frame(30, Infinity, target.current, true); };

    let raf = 0;
    let last = performance.now();
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
      // Layout is read a few times a second, not every frame.
      if ((frames += 1) % 15 === 1) measureFocus.current();
      r.frame(now / 1000, dt, target.current, true);
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

    const onResize = () => { size(); if (tier === 'still') drawStill.current(); };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', visible);
    start();

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', visible);
      canvas.removeEventListener('webglcontextlost', lost);
      r.dispose();
      renderer.current = null;
      drawStill.current = () => {};
    };
  }, [tier, live, biome.id, choice]);

  // Desktop pointer parallax: a few pixels, the far fog least.
  React.useEffect(() => {
    if (!live || tier === 'still' || !window.matchMedia?.('(pointer: fine)').matches) return undefined;
    const move = (e: PointerEvent) => {
      target.current.parallax = {
        x: (e.clientX / window.innerWidth - 0.5) * -16,
        y: (e.clientY / window.innerHeight - 0.5) * -10,
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
  return <canvas ref={ref} className="t-world" data-live="" data-tier={tier ?? undefined} aria-hidden="true" />;
}

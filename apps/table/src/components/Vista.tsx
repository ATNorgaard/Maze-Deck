import * as React from 'react';
import type { Category, Made, Side } from '@maze-deck/art';
import type { Biome } from '../biomes';
import type { DrawnPrompt } from '../tables';
import { MOTION, reducedMotion } from '../stage/motion';
import { useWorldChoice } from '../world/settings';
import { VISTA_CARDS, drawAt, isBuilt, useDesign, vistaMade, whenIdle } from './pixel';

interface Props {
  biome: Biome;
  /** The side of the setting being played: its vista is that side's. */
  side: Side;
  /** The scene the GM is reading out, or null before the first card turns. */
  prompt: DrawnPrompt | null;
  /** Clear Paths gained, as presented. Each one steps the picture forward. */
  step?: number;
}

/**
 * Below this the band is too low to show anything but a strip of hills,
 * and is better left to the ground behind it.
 */
const MIN_HEIGHT = 56;

/** The height the designs were drawn at, in their own pixels. */
const DESIGN_H = 72;

/** Frames a second while the light moves: the designs' flicker was drawn at this. */
const FPS = 8;

/** The moment a still vista shows: reduced motion, or the world held still or off. */
const STILL_T = 1.3;

interface Size {
  /** The picture, in the design's pixels. */
  W: number;
  H: number;
  /** CSS pixels per design pixel, a whole number of device pixels. */
  k: number;
  /** Where the picture sits in the box, in CSS pixels, on the device's pixel grid. */
  left: number;
  top: number;
}

/**
 * The picture for a box. Each design pixel is a whole number of device
 * pixels, so the dither stays even; the picture is about 72 of its own
 * pixels high, as the designs were drawn, and a little larger than the
 * box, centred. Its size rounds to 8 by 4 so small changes in the box
 * do not rebuild it.
 */
function sizeFor(w: number, h: number): Size {
  const dpr = window.devicePixelRatio || 1;
  const dev = Math.max(1, Math.round((h * dpr) / DESIGN_H));
  const H = Math.ceil((h * dpr) / dev / 4) * 4;
  const W = Math.min(H * 12, Math.ceil((w * dpr) / dev / 8) * 8);
  return {
    W, H, k: dev / dpr,
    left: Math.round((w * dpr - W * dev) / 2) / dpr,
    top: Math.round((h * dpr - H * dev) / 2) / dpr,
  };
}

interface Layer extends Size {
  /** The picture: the design and the card. A new one fades in; a new size alone does not. */
  scene: string;
  made: Made;
}

const now = () => performance.now() / 1000;

/**
 * One picture on a canvas, redrawn a few times a second while it may
 * move. Only the pixels its lights touch are worked out again.
 */
const VistaLayer = React.memo(({ layer, animate, entering }: { layer: Layer; animate: boolean; entering: boolean }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const { made, W, H, k, left, top } = layer;
  React.useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return undefined;
    const img = ctx.createImageData(W, H);
    const paint = (t: number) => {
      drawAt(made, t, img);
      ctx.putImageData(img, 0, 0);
    };
    paint(animate ? now() : STILL_T);
    if (!animate) return undefined;
    const id = window.setInterval(() => paint(now()), 1000 / FPS);
    return () => window.clearInterval(id);
  }, [made, W, H, animate]);
  return (
    <div className="t-vista__layer" data-entering={entering || undefined}>
      <canvas ref={ref} width={W} height={H} style={{ width: W * k, height: H * k, left, top }} />
    </div>
  );
});
VistaLayer.displayName = 'VistaLayer';

/** Whether the element is on screen and the page is showing. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = React.useState(true);
  const [shown, setShown] = React.useState(() => document.visibilityState !== 'hidden');
  React.useEffect(() => {
    const el = ref.current;
    const io = el && 'IntersectionObserver' in window
      ? new IntersectionObserver(([e]) => setSeen(e?.isIntersecting ?? true))
      : null;
    if (el && io) io.observe(el);
    const vis = () => setShown(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', vis);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ref]);
  return seen && shown;
}

/**
 * The vista — the scene the GM is reading out, as a picture
 * (docs/overhaul.md, phase 2; docs/settings-build.md, set/2).
 *
 * It fills whatever height the table has above the caption: the
 * setting's side as its design draws it (packages/art/src/paint), with
 * the turned card in it. Before the first card turns it is the place
 * with nothing in it. A Dead End and a Trap are the way blocked, in
 * their own colours. The same card always shows the same picture: the
 * design's composition for it, as approved.
 *
 * Its light moves a few times a second while it is on screen, and holds
 * still under reduced motion or when the world is held still or off.
 *
 * When the scene changes the new picture fades in over the old, which
 * goes once it is covered. Opacity only; reduced motion cuts.
 *
 * When ground is gained the picture steps forward, into the doorway it
 * shows, and stays there until the next scene replaces it (phase 5): the
 * party went through. A transform on the picture, never on the table.
 */
export function Vista({ biome, side, prompt, step = 0 }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);
  const design = useDesign(biome.id, side);
  const [world] = useWorldChoice();
  const onScreen = useOnScreen(ref);
  const animate = onScreen && world !== 'still' && world !== 'off' && !reducedMotion();

  // Measured at once, then again once a resize settles: a new size
  // rebuilds the picture, which is worth doing once and not per frame
  // of a window being dragged.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let timer = 0;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(read, 150); };
    const observer = new ResizeObserver(later);
    observer.observe(el);
    window.addEventListener('resize', later);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', later);
    };
  }, []);

  const shown = box !== null && box.h >= MIN_HEIGHT && box.w > 0;
  const size = React.useMemo(() => (shown && box ? sizeFor(box.w, box.h) : null), [shown, box]);
  const card: Category | null = prompt ? prompt.category : null;
  const scene = design ? `${design.id}|${card ?? 'none'}` : '';

  // No picture until the box is measured and the design is in: the first
  // one is composed for the box it will fill, and simply appears.
  const [layers, setLayers] = React.useState<Layer[]>([]);
  React.useEffect(() => {
    if (!design || !size) return;
    const make = (): Layer => ({ ...size, scene, made: vistaMade(design, size.W, size.H, card) });
    setLayers((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return [make()];
      if (last.scene === scene) {
        return last.W === size.W && last.H === size.H && last.left === size.left && last.top === size.top
          ? prev : [...prev.slice(0, -1), make()];
      }
      return [...prev.slice(-1), make()];
    });
    // `scene` stands for the design and the card.
  }, [scene, size]);

  // The cards not yet turned are built while the page is idle, so a card
  // turning finds its picture ready.
  React.useEffect(() => {
    if (!design || !size) return undefined;
    const todo = VISTA_CARDS.filter((c) => !isBuilt(design, size.W, size.H, c));
    return whenIdle(todo.map((c) => () => { vistaMade(design, size.W, size.H, c); }));
  }, [design, size]);

  // The old picture goes once the new one has covered it.
  React.useEffect(() => {
    if (layers.length < 2) return undefined;
    const t = window.setTimeout(() => setLayers((l) => l.slice(-1)), reducedMotion() ? 0 : MOTION.vista + 60);
    return () => window.clearTimeout(t);
  }, [layers]);

  // Ground gained: the picture showing steps forward and holds. The next
  // scene is a new layer, so it comes in at rest.
  const stepped = React.useRef(step);
  React.useEffect(() => {
    const was = stepped.current;
    stepped.current = step;
    if (step <= was || reducedMotion()) return;
    const layer = ref.current?.querySelector<HTMLElement>('.t-vista__layer:last-child');
    layer?.animate(
      [{ transform: 'none' }, { transform: 'scale(1.08)' }],
      { duration: MOTION.step, easing: MOTION.settle, fill: 'forwards' },
    );
  }, [step]);

  return (
    <div
      className="t-vista"
      ref={ref}
      data-shown={shown || undefined}
      data-category={prompt ? prompt.category : undefined}
      data-design={design?.id}
      data-moving={(shown && animate) || undefined}
      aria-hidden="true"
    >
      {shown ? layers.map((l, i) => (
        <VistaLayer
          key={l.scene}
          layer={l}
          animate={animate}
          entering={layers.length > 1 && i === layers.length - 1}
        />
      )) : null}
    </div>
  );
}


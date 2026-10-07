import * as React from 'react';
import type { CardCategory } from '@maze-deck/rules';
import { FALLBACK_PALETTE, SceneArt, readPalette, vocabOf } from '@maze-deck/art';
import type { BiomeVocab, LightKey, Palette, SceneParams } from '@maze-deck/art';
import type { Biome } from '../biomes';
import type { DrawnPrompt } from '../tables';
import { MOTION, reducedMotion } from '../stage/motion';

interface Props {
  biome: Biome;
  /** The scene the GM is reading out, or null before the first card turns. */
  prompt: DrawnPrompt | null;
}

/** A setting at rest is lit by its own light, like its ground and its backs. */
const LIGHT_CATEGORY: Record<LightKey, CardCategory> = {
  path: 'clear-path', obst: 'obstacle', wand: 'wanderer', item: 'item', trap: 'trap',
};

/**
 * Below this the band is too low to show anything but a strip of hills,
 * and is better left to the ground behind it.
 */
const MIN_HEIGHT = 56;

/**
 * Aspect, rounded to a half. The land is composed for the box it fills,
 * so a resize redraws it; rounding keeps that from happening per pixel.
 */
const bucket = (a: number) => Math.round(Math.max(1.2, Math.min(12, a)) * 2) / 2;

interface Layer {
  key: string;
  p: SceneParams;
}

function paramsFor(biome: Biome, vocab: BiomeVocab, prompt: DrawnPrompt | null, aspect: number): SceneParams {
  const base = {
    frame: 'vista' as const, style: 'flat' as const, aspect,
    px: 2, relief: 1, haze: 0.6, band: false, fade: 0,
  };
  // Seeded by the ENTRY, not the draw: the same line always comes with the
  // same picture, in every crossing, so a table that meets it twice knows it.
  return prompt
    ? { ...base, category: prompt.category, seed: `${biome.id}:${prompt.entryId}`, subject: true }
    : { ...base, category: LIGHT_CATEGORY[vocab.light], seed: `${biome.id}:horizon`, subject: false };
}

/**
 * One picture. Memoised on its key and the palette: building a scene
 * walks every height function across the width, which is worth doing
 * once per picture and not once per render of the board.
 */
const SceneLayer = React.memo(
  ({ p, pal, vocab }: { k: string; p: SceneParams; pal: Palette; vocab: BiomeVocab }) => {
    const id = `vista${React.useId().replace(/:/g, '')}`;
    return <SceneArt p={p} pal={pal} vocab={vocab} id={id} />;
  },
  (a, b) => a.k === b.k && a.pal === b.pal && a.vocab === b.vocab,
);
SceneLayer.displayName = 'SceneLayer';

/**
 * The vista — the scene the GM is reading out, as a picture
 * (docs/overhaul.md, phase 2).
 *
 * It fills whatever height the table has above the caption, at whatever
 * aspect that is, drawn by the atelier's scene generator from
 * `@maze-deck/art`: a sky lit in the turned card's colour, the setting's
 * horizon, and the card's subject standing on the floor in the middle,
 * just above the caption that names it. Before the first card turns it is
 * the setting at rest, with no subject.
 *
 * When the scene changes the new picture fades in over the old, which
 * goes once it is covered. Opacity only; reduced motion cuts.
 */
export function Vista({ biome, prompt }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ aspect: number; shown: boolean }>({ aspect: 4, shown: false });
  const [pal, setPal] = React.useState<Palette>(FALLBACK_PALETTE);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const next = { aspect: h > 0 ? bucket(w / h) : 4, shown: h >= MIN_HEIGHT && w > 0 };
      setBox((prev) => (prev.aspect === next.aspect && prev.shown === next.shown ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // The real palette, read off the CSS this element inherits: the
  // setting's tokens (biomes.css), so the picture is in the table's inks.
  React.useLayoutEffect(() => {
    if (ref.current) setPal(readPalette(ref.current));
  }, [biome.id]);

  const vocab = vocabOf(biome.id);
  const p = paramsFor(biome, vocab, prompt, box.aspect);
  const key = `${p.seed}|${p.category}|${box.aspect}`;

  const [layers, setLayers] = React.useState<Layer[]>([{ key, p }]);
  React.useEffect(() => {
    setLayers((prev) => (prev[prev.length - 1]?.key === key ? prev : [...prev.slice(-1), { key, p }]));
    // `key` stands for `p`.
  }, [key]);

  // The old picture goes once the new one has covered it.
  React.useEffect(() => {
    if (layers.length < 2) return undefined;
    const t = window.setTimeout(() => setLayers((l) => l.slice(-1)), reducedMotion() ? 0 : MOTION.vista + 60);
    return () => window.clearTimeout(t);
  }, [layers]);

  return (
    <div
      className="t-vista"
      ref={ref}
      data-shown={box.shown || undefined}
      data-category={prompt ? prompt.category : undefined}
      aria-hidden="true"
    >
      {box.shown ? layers.map((l, i) => (
        <div
          key={l.key}
          className="t-vista__layer"
          data-entering={(layers.length > 1 && i === layers.length - 1) || undefined}
        >
          <SceneLayer k={l.key} p={l.p} pal={pal} vocab={vocab} />
        </div>
      )) : null}
    </div>
  );
}

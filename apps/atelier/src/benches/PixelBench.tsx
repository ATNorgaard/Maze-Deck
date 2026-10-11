import { useEffect, useMemo, useState } from 'react';
import { LOOKS, SPRITES, buildScene, pngDataUri, rasterize } from '@maze-deck/art';
import type { BiomeId, BiomeVocab, Palette, PixelScene, SpriteKind, SceneParams } from '@maze-deck/art';
import { Section, Slider } from '../ui/controls';
import { useStored } from '../ui/store';

/* The pixel style's toolkit, laid out (docs/art-jobs.md, Job 0): the
   setting's ramps, the sprites with their frames, and its card back at
   the size it really is, larger, and as the three layers that tilt. */

interface PixelState { px: number; fade: number }

const PARTS = ['sky', 'far', 'near'] as const;

/** A sprite's frame as a grid of cells, `scale` screen pixels each. */
function SpriteFrame({ rows, colors, air, scale }: {
  rows: readonly string[]; colors: Readonly<Record<string, string>>; air: string; scale: number;
}) {
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <div className="atl-sprite" style={{ gridTemplateColumns: `repeat(${w}, ${scale}px)`, gridAutoRows: `${scale}px` }}>
      {rows.flatMap((line, y) => [...line.padEnd(w, '.')].map((k, x) => (
        <i key={`${x}-${y}`} style={{ background: k === '.' ? 'transparent' : (k === 'a' && !colors.a ? air : colors[k] ?? air) }} />
      )))}
    </div>
  );
}

export function PixelBench({ biome, seed, palette, vocab }: {
  biome: BiomeId; seed: string; palette: Palette; vocab: BiomeVocab;
}) {
  const [s, set] = useStored<PixelState>('pixel', { px: 2.5, fade: 0.3 });
  const look = LOOKS[biome];
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 125);
    return () => window.clearInterval(id);
  }, []);

  const pictures = useMemo(() => {
    const p: SceneParams = {
      category: 'clear-path', frame: 'back', seed, style: 'pixel', px: s.px,
      relief: 1, haze: 0.6, band: false, subject: false, fade: s.fade,
    };
    const sc = buildScene(p, palette, vocab) as unknown as PixelScene;
    const opts = { px: s.px, seed, ink: palette.ink[900], fade: s.fade };
    const whole = rasterize(sc, look, opts);
    const parts = PARTS.map((part) => rasterize(sc, look, { ...opts, part }));
    const uri = pngDataUri(whole);
    return { whole, uri, parts: parts.map((img) => pngDataUri(img)) };
  }, [seed, s.px, s.fade, palette, vocab, look]);

  const { whole, uri, parts } = pictures;
  const ramps: [string, readonly string[]][] = [
    ['Sky', look.ramp.sky], ['Land', look.ramp.land], ['Light', look.ramp.light], ['Rim', [look.ramp.rim]],
    ['Air', [look.air.color]], ...(look.disc ? [['Disc', [look.disc]] as [string, string[]]] : []),
  ];

  return (
    <>
      <aside className="atl-controls">
        <Section title="Pixel">
          <Slider label="Pixel" value={s.px} min={1.5} max={5} step={0.25} onChange={(px) => set({ px })}
            hint="Field units per pixel; the back is 240 across." />
          <Slider label="Fade" value={s.fade} min={0} max={0.8} onChange={(fade) => set({ fade })}
            hint="Sinks the palette towards the ink, so the seal stays the brightest thing." />
        </Section>
        <Section title="This back">
          <p className="atl-note">
            {whole.w} × {whole.h} pixels, {whole.palette.length} colours,
            {' '}{(uri.length / 1024).toFixed(1)} KB as a data URI. The budget is 40 KB.
          </p>
        </Section>
      </aside>

      <section className="atl-stage atl-stage--top">
        <div className="atl-row">
          <figure className="atl-fig">
            <img src={uri} alt="" width={whole.w} height={whole.h} className="atl-px" />
            <figcaption>As it is</figcaption>
          </figure>
          <figure className="atl-fig">
            <img src={uri} alt={`${vocab.name} card back, pixel style`} width={whole.w * 3} height={whole.h * 3} className="atl-px" />
            <figcaption>Three times</figcaption>
          </figure>
          {parts.map((src, i) => (
            <figure className="atl-fig" key={PARTS[i]}>
              <img src={src} alt="" width={whole.w * 1.5} height={whole.h * 1.5} className="atl-px atl-px--checker" />
              <figcaption>{PARTS[i]}</figcaption>
            </figure>
          ))}
        </div>

        <div className="atl-palette">
          {ramps.map(([name, colors]) => (
            <div className="atl-swatches" key={name}>
              <span>{name}</span>
              {colors.map((c) => <i key={c} style={{ background: c }} title={c} />)}
            </div>
          ))}
        </div>

        <div className="atl-row">
          {(Object.keys(SPRITES) as SpriteKind[]).map((kind) => {
            const def = SPRITES[kind];
            const frame = def.fps ? def.frames[Math.floor((tick * 0.125) * def.fps) % def.frames.length]! : def.frames[0]!;
            return (
              <figure className="atl-fig" key={kind}>
                <div className="atl-sprites">
                  <SpriteFrame rows={frame} colors={def.colors} air={look.air.color} scale={10} />
                  {def.frames.length > 1 ? def.frames.map((f, i) => (
                    <SpriteFrame key={i} rows={f} colors={def.colors} air={look.air.color} scale={4} />
                  )) : null}
                </div>
                <figcaption>{kind}{kind === look.air.kind ? ' · this setting' : ''}{def.fps ? ` · ${def.fps} fps` : ''}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>
    </>
  );
}

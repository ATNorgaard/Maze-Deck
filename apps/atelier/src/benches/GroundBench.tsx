import { useId } from 'react';
import { CardBack, DeckCard, MazeDeckProvider } from '@maze-deck/ui';
import type { BiomeId, BiomeVocab, Palette, Style } from '@maze-deck/art';
import { slug } from '../core/export';
import { DEFAULT_GROUND, GroundArt, groundCss, groundFileCss } from '../gen/ground';
import type { GroundParams } from '../gen/ground';
import { CodePanel } from '../ui/CodePanel';
import { Button, NumberInput, Section, Slider, Toggle } from '../ui/controls';
import { useStored } from '../ui/store';

type GroundState = Omit<GroundParams, 'seed' | 'style'>;

const SIZES: { name: string; w: number; h: number }[] = [
  { name: '2560 × 1440', w: 2560, h: 1440 },
  { name: '1920 × 1080', w: 1920, h: 1080 },
  { name: '1080 × 1920', w: 1080, h: 1920 },
];

export function GroundBench({ biome, style, seed, palette, vocab }: {
  biome: BiomeId; style: Style; seed: string; palette: Palette; vocab: BiomeVocab;
}) {
  const [s, set, reset] = useStored<GroundState>('ground', DEFAULT_GROUND);
  const id = useId().replace(/:/g, '');
  const p: GroundParams = { ...s, seed, style };
  const art = <GroundArt p={p} pal={palette} vocab={vocab} id={id} />;
  const recipe = `?bench=ground&biome=${biome}&style=${style}&seed=${seed}&ground.animate=${s.animate ? 1 : 0}&ground.width=${s.width}&ground.height=${s.height}`;
  const code = s.animate
    ? [
        `/* Save the SVG as apps/table/src/biomes/art/ground-${biome}.svg — the motion is inside it — then in`,
        `   biomes.css → [data-biome="${biome}"] .md-root { … } replace --t-biome-ground with: */`,
        groundFileCss(biome),
        '',
        `/* recipe: ${recipe} */`,
      ].join('\n')
    : [
        `/* biomes.css → [data-biome="${biome}"] .md-root { … } — replaces the existing --t-biome-ground. */`,
        groundCss(p, palette, vocab),
        '',
        `/* recipe: ${recipe} */`,
      ].join('\n');

  return (
    <>
      <aside className="atl-controls">
        <Section title="The light">
          <Slider label="Pool across" value={s.poolX} min={0} max={100} step={1} onChange={(poolX) => set({ poolX })} format={(v) => `${v}%`} />
          <Slider label="Pool down" value={s.poolY} min={0} max={100} step={1} onChange={(poolY) => set({ poolY })} format={(v) => `${v}%`} />
          <Slider label="Pool size" value={s.poolSize} min={0.2} max={1} onChange={(poolSize) => set({ poolSize })} />
          <Slider label="Pool strength" value={s.poolStrength} min={0} max={1} onChange={(poolStrength) => set({ poolStrength })} />
        </Section>
        <Section title="The air">
          <Slider label="Texture" value={s.texture} min={0} max={1} onChange={(texture) => set({ texture })}
            hint={style === 'engraving' ? 'Hatching in the shadow.' : style === 'pixel' ? 'Dither in the light.' : style === 'line' ? 'Ruled lines and contours.' : 'Paper grain.'} />
          <Slider label={vocab.particle[0].toUpperCase() + vocab.particle.slice(1)} value={s.particles} min={0} max={1} onChange={(particles) => set({ particles })} />
          <Slider label="Vignette" value={s.vignette} min={0} max={1} onChange={(vignette) => set({ vignette })} />
          <Toggle label="Animate — the pool breathes, the air moves" value={s.animate} onChange={(animate) => set({ animate })} />
        </Section>
        <Section title="Export size">
          <div className="atl-chips">
            {SIZES.map((z) => (
              <Button key={z.name} onClick={() => set({ width: z.w, height: z.h })} primary={s.width === z.w && s.height === z.h}>{z.name}</Button>
            ))}
          </div>
          <div className="atl-pair">
            <NumberInput label="Width" value={s.width} min={64} max={8192} onChange={(width) => set({ width })} />
            <NumberInput label="Height" value={s.height} min={64} max={8192} onChange={(height) => set({ height })} />
          </div>
          <Button onClick={reset}>Reset ground</Button>
        </Section>
      </aside>

      <section className="atl-stage atl-stage--fill">
        <div data-biome={biome} className="atl-ground" style={{ aspectRatio: `${s.width} / ${s.height}` }}>
          <div className="atl-ground__art">{art}</div>
          <MazeDeckProvider size="sm" background="transparent" className="atl-ground__cards">
            <div className="atl-row">
              <CardBack />
              <DeckCard category="clear-path" />
              <DeckCard category="obstacle" />
              <DeckCard category="wanderer" />
            </div>
          </MazeDeckProvider>
        </div>
      </section>

      <CodePanel
        title="Page ground"
        note={s.animate
          ? 'The SVG carries its own motion and works as an <img> or a CSS background. The PNG is one still of it.'
          : 'The CSS value carries the texture tile inline; the picture carries everything, including what is in the air.'}
        code={code}
        stem={`ground-${biome}-${style}-${slug(seed)}`}
        svg={{ node: art, width: s.width, height: s.height, pixelated: style === 'pixel' }}
      />
    </>
  );
}

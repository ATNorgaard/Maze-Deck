import { CardBack, DeckCard, MazeDeckProvider } from '@maze-deck/ui';
import { CAT_KEYS, hexToRgb } from '../core/biomes';
import type { BiomeVocab, LightKey, Palette } from '../core/biomes';
import { slug } from '../core/export';
import { SCENE_CATEGORIES } from '../gen/scene';
import { buildPalette, DEFAULT_PALETTE_PARAMS, groundValue, paletteCss, paletteVars } from '../gen/palette';
import type { PaletteParams } from '../gen/palette';
import { CodePanel } from '../ui/CodePanel';
import { Button, Section, Select, Slider, TextInput } from '../ui/controls';
import { useStored } from '../ui/store';

const LIGHTS: readonly { id: LightKey; name: string }[] = [
  { id: 'path', name: 'Clear Path gold' },
  { id: 'obst', name: 'Obstacle verdigris' },
  { id: 'wand', name: 'Wanderer blue' },
  { id: 'item', name: 'Item orchid' },
  { id: 'trap', name: 'Trap acid' },
];

const FROM: readonly { id: PaletteParams['lightFrom']; name: string }[] = [
  { id: 'above', name: 'From above' },
  { id: 'below', name: 'From below' },
  { id: 'horizon', name: 'Off the horizon' },
];

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function Swatches({ pal }: { pal: Palette }) {
  const row = (label: string, cs: string[]) => (
    <div className="atl-swatches" key={label}>
      <span>{label}</span>
      {cs.map((c, i) => <i key={i} style={{ background: c }} title={c} />)}
    </div>
  );
  return (
    <div className="atl-swatchblock">
      {row('ink', Object.values(pal.ink))}
      {row('parchment', Object.values(pal.parchment))}
      {CAT_KEYS.map((k) => row(k, [pal.cat[k][700], pal.cat[k][500], pal.cat[k][300]]))}
    </div>
  );
}

export function PaletteBench({ current, vocab }: { current: Palette; vocab: BiomeVocab }) {
  const [s, set, reset] = useStored<PaletteParams>('palette', DEFAULT_PALETTE_PARAMS);
  const pal = buildPalette(s);
  const vars = paletteVars(pal);
  const code = paletteCss(s, pal);

  const startFrom = () => {
    const [h, sat] = hexToHsl(current.ink[900]);
    const [ph, ps] = hexToHsl(current.parchment[100]);
    set({ hue: Math.round(h), sat: Math.round(sat * 100) / 100, parchHue: Math.round(ph), parchSat: Math.round(ps * 100) / 100, light: vocab.light });
  };

  return (
    <>
      <aside className="atl-controls">
        <Section title="Name">
          <TextInput label="Name" value={s.name} onChange={(name) => set({ name, id: slug(name) })} />
          <TextInput label="One line" value={s.blurb} onChange={(blurb) => set({ blurb })} placeholder="what the light is like" />
          <TextInput label="Key" value={s.id} onChange={(id) => set({ id: slug(id) })} hint="data-biome value; also the file name under src/biomes." />
        </Section>
        <Section title="The cast">
          <Slider label="Ink hue" value={s.hue} min={0} max={360} step={1} onChange={(hue) => set({ hue })} format={(v) => `${v}°`} />
          <Slider label="Ink saturation" value={s.sat} min={0} max={0.5} onChange={(sat) => set({ sat })} />
          <Slider label="Parchment hue" value={s.parchHue} min={20} max={70} step={1} onChange={(parchHue) => set({ parchHue })} format={(v) => `${v}°`} />
          <Slider label="Parchment saturation" value={s.parchSat} min={0.1} max={0.6} onChange={(parchSat) => set({ parchSat })} />
        </Section>
        <Section title="The categories">
          <Slider label="Lean into the cast" value={s.lean} min={0} max={1} onChange={(lean) => set({ lean })}
            hint="Tuned within each family, never swapped. Fourteen degrees at most." />
          <Slider label="Chroma" value={s.chroma} min={0.6} max={1.3} onChange={(chroma) => set({ chroma })} />
          <Select label="The room's light" value={s.light} options={LIGHTS} onChange={(light) => set({ light })} />
          <Select label="Where from" value={s.lightFrom} options={FROM} onChange={(lightFrom) => set({ lightFrom })} />
        </Section>
        <Section title="Start over">
          <div className="atl-chips">
            <Button onClick={startFrom} title={`Take the ink and parchment of ${vocab.name}`}>From {vocab.name}</Button>
            <Button onClick={reset}>Defaults</Button>
          </div>
        </Section>
      </aside>

      <section className="atl-stage atl-stage--top">
        <MazeDeckProvider size="sm" background="transparent">
          <div className="atl-palette" style={{ ...vars, background: groundValue(pal, s.light, s.lightFrom) } as React.CSSProperties}>
            <div className="atl-grid">
              {SCENE_CATEGORIES.map((c) => <DeckCard key={c} category={c} />)}
              <CardBack />
            </div>
          </div>
        </MazeDeckProvider>
        <Swatches pal={pal} />
      </section>

      <CodePanel
        title="Biome palette"
        note="A block for apps/table/src/biomes.css. The biome still needs its file under src/biomes — copy, motif and tables — and a line in BIOMES."
        code={code}
        stem={`palette-${s.id || 'biome'}`}
      />
    </>
  );
}

import { useId } from 'react';
import { ArchGlyph, CardBack, MazeDeckProvider } from '@maze-deck/ui';
import type { BiomeId, BiomeVocab, Palette } from '../core/biomes';
import { slug } from '../core/export';
import type { Style } from '../core/style';
import { SceneArt } from '../gen/scene';
import type { SceneParams } from '../gen/scene';
import { generateTile, tileFieldLine, TILE_MODES } from '../gen/tile';
import type { Tile, TileMode } from '../gen/tile';
import { CodePanel } from '../ui/CodePanel';
import { Section, Select, Slider, TextInput, Toggle } from '../ui/controls';
import { useStored } from '../ui/store';

/* A back is either a tile — the maze the library already knows —
   or the setting's own horizon across the whole field. */
type BackMode = TileMode | 'scene';

const BACK_MODES: readonly { id: BackMode; name: string; blurb: string }[] = [
  ...TILE_MODES,
  { id: 'scene', name: 'Scene', blurb: 'The setting itself, behind the seal.' },
];

interface BackState {
  mode: BackMode;
  cells: number;
  weight: number;
  name: string;
  relief: number;
  haze: number;
  fade: number;
  subject: boolean;
  px: number;
}

/** The tile as a field. `fit` mirrors MazeField in the library. */
function TileField({ tile, color, fit, id, background }: {
  tile: Tile; color: string; fit: 'card' | 'sheet'; id: string; background?: string;
}) {
  const pid = `${id}-tile`;
  const pattern = (
    <defs>
      <pattern id={pid} width={tile.size} height={tile.size} patternUnits="userSpaceOnUse">
        {tile.layers.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={color} strokeWidth={l.strokeWidth} opacity={l.opacity}
            strokeLinecap={tile.linecap} strokeLinejoin={tile.linecap === 'round' ? 'round' : 'miter'}
            transform={l.shift ? `translate(${l.shift},${l.shift})` : undefined} />
        ))}
      </pattern>
    </defs>
  );
  const crisp = tile.crisp ? { shapeRendering: 'crispEdges' as const } : {};
  if (fit === 'sheet') {
    return (
      <svg viewBox="0 0 96 96" {...crisp}>
        {pattern}
        {background ? <rect width="96" height="96" fill={background} /> : null}
        <rect width="96" height="96" fill={`url(#${pid})`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 335" preserveAspectRatio="none" className={background ? undefined : 'md-card__maze'} {...crisp}>
      {pattern}
      {background ? <rect width="240" height="335" fill={background} /> : null}
      <rect width="240" height="335" fill={`url(#${pid})`} />
    </svg>
  );
}

/** The real back's shell — trim, vignette, frame, seal — around any field. */
function BackShell({ children }: { children: React.ReactNode }) {
  return (
    <article className="md-card md-card--back md-cat-path">
      <div className="md-card__trim">
        {children}
        <div className="md-card__vignette" />
        <div className="md-card__frame" />
        <ArchGlyph state="seal" className="md-card__seal" />
      </div>
    </article>
  );
}

export function BackBench({ biome, style, seed, palette, vocab }: {
  biome: BiomeId; style: Style; seed: string; palette: Palette; vocab: BiomeVocab;
}) {
  const [s, set] = useStored<BackState>('back', {
    mode: 'walls', cells: 4, weight: 1, name: '', relief: 1, haze: 0.6, fade: 0.3, subject: false, px: 2.5,
  });
  const id = useId().replace(/:/g, '');

  if (s.mode === 'scene') {
    const p: SceneParams = {
      category: 'clear-path', frame: 'back', seed, style,
      px: s.px, relief: s.relief, haze: s.haze, band: false, subject: s.subject, fade: s.fade,
    };
    const art = <SceneArt p={p} pal={palette} vocab={vocab} id={`${id}-x`} />;
    const code = [
      `// Save the SVG as apps/table/src/biomes/art/back-${biome}.svg, then in`,
      `// apps/table/src/biomes/${biome}.ts:`,
      `import backArt from './art/back-${biome}.svg';`,
      '',
      `  motif: '${vocab.motif}',   // stays: the print deck's back, and the fallback`,
      `  backArt,`,
      '',
      `// recipe: ?bench=back&biome=${biome}&style=${style}&seed=${seed}&back.mode=scene` +
        `&back.relief=${s.relief}&back.haze=${s.haze}&back.fade=${s.fade}&back.subject=${s.subject ? 1 : 0}&back.px=${s.px}`,
    ].join('\n');

    return (
      <>
        <aside className="atl-controls">
          <Section title="Back">
            <Select label="Drawing" value={s.mode} options={BACK_MODES} onChange={(mode) => set({ mode })} />
            <Slider label="Relief" value={s.relief} min={0.4} max={1.4} onChange={(relief) => set({ relief })} hint={`The ${vocab.terrain}, taller or lower.`} />
            <Slider label="Haze" value={s.haze} min={0} max={1} onChange={(haze) => set({ haze })} hint="How much the distance lightens." />
            <Slider label="Fade" value={s.fade} min={0} max={0.8} onChange={(fade) => set({ fade })} hint="Sink the picture towards the ink, so the seal stays the brightest thing." />
            {style === 'pixel' ? <Slider label="Pixel" value={s.px} min={1.5} max={6} step={0.25} onChange={(px) => set({ px })} hint="In field units; the back is 240 across." /> : null}
            <Toggle label="A doorway of light in front" value={s.subject} onChange={(subject) => set({ subject })} />
          </Section>
        </aside>

        <section className="atl-stage">
          <div data-biome={biome} className="atl-stage__ground">
            <MazeDeckProvider size="lg" background="transparent">
              <div className="atl-row">
                <figure className="atl-fig">
                  <BackShell><div className="md-card__art atl-back__art">{art}</div></BackShell>
                  <figcaption>The scene, on the real back</figcaption>
                </figure>
                <figure className="atl-fig">
                  <CardBack />
                  <figcaption>The current {vocab.motif}</figcaption>
                </figure>
              </div>
            </MazeDeckProvider>
          </div>
        </section>

        <CodePanel
          title="Card back scene"
          note="The setting's horizon across the whole field, lit in the deck's gold and carrying no subject, so every back still says nothing. The vignette, frame and seal draw over it as they do over the maze."
          code={code}
          stem={`back-${biome}`}
          svg={{ node: art, width: 960, height: 1340, pixelated: style === 'pixel' }}
        />
      </>
    );
  }

  const tile = generateTile({ mode: s.mode, cells: s.cells, weight: s.weight, seed, style });
  const name = s.name || `${vocab.motif}2`;

  const code = [
    '// packages/ui/src/CardBack.tsx → FIELD. Add the key to CardBackMotif in DeckSkin.tsx.',
    tileFieldLine(name, tile),
    ...(tile.layers.length > 1 || tile.layers[0].strokeWidth !== 1.5
      ? [`// This tile wants strokeWidth ${tile.layers[0].strokeWidth}${tile.linecap !== 'square' ? ` and strokeLinecap="${tile.linecap}"` : ''}; FIELD draws every motif at 1.5.`]
      : []),
  ].join('\n');

  const exportNode = (
    <svg viewBox="0 0 240 335">
      <rect width="240" height="335" fill={palette.ink[900]} />
      <g opacity="0.85"><TileField tile={tile} color={palette.ink[500]} fit="card" id={`${id}-x`} background="none" /></g>
    </svg>
  );

  return (
    <>
      <aside className="atl-controls">
        <Section title="Tile">
          <Select label="Drawing" value={s.mode} options={BACK_MODES} onChange={(mode) => set({ mode })} />
          <Slider label="Cells across" value={s.cells} min={3} max={8} step={1} onChange={(cells) => set({ cells })}
            hint="The tile is 24 units; the card shows ten tiles across." />
          <Slider label="Weight" value={s.weight} min={0.5} max={2} step={0.05} onChange={(weight) => set({ weight })} />
          <TextInput label="Motif key" value={s.name} placeholder={name} onChange={(n) => set({ name: slug(n).replace(/-/g, '') })}
            hint="The name FIELD and CardBackMotif will use." />
        </Section>
      </aside>

      <section className="atl-stage">
        <div data-biome={biome} className="atl-stage__ground">
          <MazeDeckProvider size="lg" background="transparent">
            <div className="atl-row">
              <figure className="atl-fig">
                <BackShell><TileField tile={tile} color="currentColor" fit="card" id={id} /></BackShell>
                <figcaption>New tile, on the real back</figcaption>
              </figure>
              <figure className="atl-fig">
                <CardBack />
                <figcaption>The current {vocab.motif}</figcaption>
              </figure>
              <figure className="atl-fig atl-fig--sheet">
                <div className="atl-sheet" style={{ color: palette.ink[500], background: palette.ink[900] }}>
                  <TileField tile={tile} color="currentColor" fit="sheet" id={`${id}-s`} />
                </div>
                <figcaption>Four by four, to check the seams</figcaption>
              </figure>
            </div>
          </MazeDeckProvider>
        </div>
      </section>

      <CodePanel
        title="Card back motif"
        note="One path, seamless on every edge. Paste the line into FIELD and the key into the CardBackMotif union, then point the biome at it."
        code={code}
        stem={`back-${biome}-${s.mode}-${slug(seed)}`}
        svg={{ node: exportNode, width: 960, height: 1340, pixelated: tile.crisp }}
      />
    </>
  );
}

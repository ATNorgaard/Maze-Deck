import { useId } from 'react';
import { DeckCard, MazeDeckProvider, getCategory } from '@maze-deck/ui';
import type { CardCategory } from '@maze-deck/ui';
import type { BiomeId, BiomeVocab, Palette } from '../core/biomes';
import { slug, svgText } from '../core/export';
import type { Style } from '../core/style';
import { DEFAULT_SCENE, SCENE_CATEGORIES, SceneArt } from '../gen/scene';
import type { Frame, SceneParams } from '../gen/scene';
import { CodePanel } from '../ui/CodePanel';
import { Section, Segmented, Select, Slider, Toggle } from '../ui/controls';
import { useStored } from '../ui/store';

type SceneState = Omit<SceneParams, 'seed' | 'style'> & { all: boolean };

/* The `back` frame lives on the Back bench, where it previews on the real back. */
const FRAMES: readonly { id: Frame; name: string; blurb: string }[] = [
  { id: 'arch', name: 'Arch', blurb: 'Through the doorway, on the card.' },
  { id: 'wide', name: 'Wide', blurb: 'A 240 × 140 panel, for a tile or a banner.' },
];

/** A real card, with the scene standing where the glyph stands. */
function CardWithScene({ category, p, palette, vocab, id }: {
  category: CardCategory; p: SceneParams; palette: Palette; vocab: BiomeVocab; id: string;
}) {
  return (
    <div className="atl-cardart">
      <DeckCard category={category} />
      <div className="atl-cardart__scene">
        <SceneArt p={{ ...p, category }} pal={palette} vocab={vocab} id={id} />
      </div>
    </div>
  );
}

export function SceneBench({ biome, style, seed, palette, vocab }: {
  biome: BiomeId; style: Style; seed: string; palette: Palette; vocab: BiomeVocab;
}) {
  const [s, set] = useStored<SceneState>('scene', { ...DEFAULT_SCENE, all: false });
  const id = useId().replace(/:/g, '');
  const p: SceneParams = {
    category: s.category, frame: s.frame, px: s.px, relief: s.relief, haze: s.haze, band: s.band,
    subject: s.subject, fade: s.fade, seed, style,
  };
  const art = <SceneArt p={p} pal={palette} vocab={vocab} id={`${id}-x`} />;
  const size = s.frame === 'arch' ? { width: 960, height: 1120 } : { width: 1440, height: 840 };
  const code = svgText(art, size.width, size.height);

  return (
    <>
      <aside className="atl-controls">
        <Section title="Subject">
          <Select label="Card" value={s.category}
            options={SCENE_CATEGORIES.map((c) => ({ id: c, name: getCategory(c).title }))}
            onChange={(category) => set({ category })} />
          <Segmented label="Frame" value={s.frame} options={FRAMES} onChange={(frame) => set({ frame })} />
          <Toggle label="Draw the subject" value={s.subject} onChange={(subject) => set({ subject })} />
          {s.frame === 'arch' ? <Toggle label="Draw the arch band" value={s.band} onChange={(band) => set({ band })} /> : null}
          {s.frame === 'arch' ? <Toggle label="All seven cards" value={s.all} onChange={(all) => set({ all })} /> : null}
        </Section>
        <Section title="Setting">
          <Slider label="Relief" value={s.relief} min={0.4} max={1.4} onChange={(relief) => set({ relief })} hint={`The ${vocab.terrain}, taller or lower.`} />
          <Slider label="Haze" value={s.haze} min={0} max={1} onChange={(haze) => set({ haze })} hint="How much the distance lightens." />
          <Slider label="Fade" value={s.fade} min={0} max={0.8} onChange={(fade) => set({ fade })} hint="Sink the picture towards the ink." />
          {style === 'pixel' ? <Slider label="Pixel" value={s.px} min={1.5} max={4} step={0.25} onChange={(px) => set({ px })} hint="In scene units; the arch is 64 across." /> : null}
        </Section>
      </aside>

      <section className="atl-stage">
        <div data-biome={biome} className="atl-stage__ground">
          {s.frame === 'wide' ? (
            <MazeDeckProvider size="md" background="transparent">
              <figure className="atl-fig">
                <div className="atl-wide">{art}</div>
                <figcaption>{vocab.name} — {getCategory(s.category).title}</figcaption>
              </figure>
            </MazeDeckProvider>
          ) : s.all ? (
            <MazeDeckProvider size="sm" background="transparent">
              <div className="atl-grid">
                {SCENE_CATEGORIES.map((c) => (
                  <CardWithScene key={c} category={c} p={p} palette={palette} vocab={vocab} id={`${id}-${c}`} />
                ))}
              </div>
            </MazeDeckProvider>
          ) : (
            <MazeDeckProvider size="lg" background="transparent">
              <div className="atl-row">
                <figure className="atl-fig">
                  <CardWithScene category={s.category} p={p} palette={palette} vocab={vocab} id={id} />
                  <figcaption>The scene in the doorway</figcaption>
                </figure>
                <figure className="atl-fig">
                  <DeckCard category={s.category} />
                  <figcaption>The glyph as printed</figcaption>
                </figure>
              </div>
            </MazeDeckProvider>
          )}
        </div>
      </section>

      <CodePanel
        title="Card scene"
        note={s.frame === 'arch'
          ? 'Drawn on the glyph\'s own 120 × 140 grid, so it drops into an ArchGlyph interior or sits over the card as a picture.'
          : 'A landscape panel in the setting\'s ink, for a biome tile or a banner.'}
        code={code}
        stem={`scene-${biome}-${s.category}-${style}-${slug(seed)}`}
        svg={{ node: art, ...size, pixelated: style === 'pixel' }}
      />
    </>
  );
}

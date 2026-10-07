/* ============================================================
   The atelier.

   Four benches, one seed. The biome and the style are global —
   they are the two axes the whole tool is built on — and every
   bench draws with the real palette read off biomes.css.
   ============================================================ */

import { BackBench } from './benches/BackBench';
import { GroundBench } from './benches/GroundBench';
import { PaletteBench } from './benches/PaletteBench';
import { SceneBench } from './benches/SceneBench';
import { BIOMES, DEFAULT_BIOME, vocabOf, STYLES } from '@maze-deck/art';
import type { BiomeId, Style } from '@maze-deck/art';
import { Seed, Segmented, Select } from './ui/controls';
import { useStored } from './ui/store';
import { usePalette } from './ui/usePalette';

type Bench = 'back' | 'ground' | 'scene' | 'palette';

const BENCHES: readonly { id: Bench; name: string; blurb: string }[] = [
  { id: 'back', name: 'Back', blurb: 'The card back\'s field tile.' },
  { id: 'scene', name: 'Scene', blurb: 'What stands in the doorway.' },
  { id: 'ground', name: 'Ground', blurb: 'The page behind the table.' },
  { id: 'palette', name: 'Palette', blurb: 'A new biome\'s colours.' },
];

interface Globals { bench: Bench; biome: BiomeId; style: Style; seed: string }

export function App() {
  const [g, set] = useStored<Globals>('globals', { bench: 'back', biome: DEFAULT_BIOME, style: 'flat', seed: 'lantern-door-17' });
  const { palette, probe } = usePalette(g.biome);
  const vocab = vocabOf(g.biome);
  const common = { biome: g.biome, style: g.style, seed: g.seed, palette, vocab };

  return (
    <div className="atl">
      {probe}
      <header className="atl-bar">
        <h1 className="atl-title">Atelier <span>Maze Deck</span></h1>
        <Segmented label="Bench" value={g.bench} options={BENCHES} onChange={(bench) => set({ bench })} />
        <div className="atl-bar__globals">
          <Select label="Biome" value={g.biome} options={BIOMES} onChange={(biome) => set({ biome })} hint={vocab.blurb} />
          <Select label="Style" value={g.style} options={STYLES} onChange={(style) => set({ style })} />
          <Seed value={g.seed} onChange={(seed) => set({ seed })} />
        </div>
      </header>
      <main className="atl-main" data-bench={g.bench}>
        {g.bench === 'back' ? <BackBench {...common} /> : null}
        {g.bench === 'scene' ? <SceneBench {...common} /> : null}
        {g.bench === 'ground' ? <GroundBench {...common} /> : null}
        {g.bench === 'palette' ? <PaletteBench current={palette} vocab={vocab} /> : null}
      </main>
    </div>
  );
}

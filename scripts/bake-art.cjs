/* ============================================================
   Bake the biomes' artwork out of the atelier.

   Each biome's card back and page ground are pictures the atelier
   generates from a recipe — biome, style, seed and a few numbers.
   This script asks the running atelier for each one (the recipe is
   a URL, see apps/atelier/src/ui/store.ts) and saves the SVGs into
   apps/table/src/biomes/art/, where the biome files import them.

     node scripts/bake-art.cjs [style]     default: flat

   Each back is baked whole and, in the flat style, as three layers
   (back-<biome>-sky / -far / -near) that the table moves in depth.

   Needs the atelier dev server (`cd apps/atelier && npm run dev`)
   and the Chromium in .ds-sync — see print-deck.mjs for the install
   line. Change a seed here to re-roll a setting; run again; look.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const style = process.argv[2] || 'flat';
const url = process.argv[3] || 'http://localhost:5181';
const out = path.join(__dirname, '..', 'apps', 'table', 'src', 'biomes', 'art');
fs.mkdirSync(out, { recursive: true });

/* The recipes. The seed is the whole difference between one horizon and another. */
const RECIPES = {
  dungeon: { seed: 'lantern-door-17', back: { fade: 0.3 }, ground: {} },
  tower: { seed: 'brass-stair-41', back: { fade: 0.3 }, ground: {} },
  'deep-forest': { seed: 'moss-trail-23', back: { fade: 0.25 }, ground: {} },
  desert: { seed: 'salt-dune-58', back: { fade: 0.3 }, ground: { poolY: 20 } },
  undercity: { seed: 'rust-brick-12', back: { fade: 0.3 }, ground: {} },
  'frozen-pass': { seed: 'north-shard-77', back: { fade: 0.25 }, ground: {} },
};

const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));

  const bake = async (query, file) => {
    await page.goto(`${url}/?${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const wait = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: 'SVG', exact: true }).click();
    const dl = await wait;
    await dl.saveAs(path.join(out, file));
    console.log(`${file}  ${(fs.statSync(path.join(out, file)).size / 1024).toFixed(0)} kB`);
  };

  for (const [biome, r] of Object.entries(RECIPES)) {
    // The back whole, then the same picture as three layers — sky, far,
    // near — for a back that moves in depth as the card tilts
    // (docs/overhaul.md, phase 6). The layer is always passed, empty for
    // the whole: the atelier remembers a bench's fields between pages.
    const back = { bench: 'back', biome, style, seed: r.seed, 'back.mode': 'scene', 'back.subject': 0, 'back.relief': 1, 'back.haze': 0.6, 'back.px': 2.5, ...prefix('back', r.back) };
    await bake(q({ ...back, 'back.part': '' }), `back-${biome}.svg`);
    for (const part of style === 'flat' ? ['sky', 'far', 'near'] : []) {
      await bake(q({ ...back, 'back.part': part }), `back-${biome}-${part}.svg`);
    }
    await bake(
      q({ bench: 'ground', biome, style, seed: r.seed, 'ground.animate': 1, 'ground.width': 2560, 'ground.height': 1440, ...prefix('ground', r.ground) }),
      `ground-${biome}.svg`,
    );
  }
  await browser.close();
})();

function prefix(p, o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [`${p}.${k}`, v]));
}

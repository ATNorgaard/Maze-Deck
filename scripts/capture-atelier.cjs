/* ============================================================
   A contact sheet of the atelier's output.

   The Claude Code browser pane cannot reliably screenshot, so the
   artwork is judged the way the motion was (capture-frames.cjs):
   a headless Chromium drives the atelier through a matrix of
   benches, biomes and styles and writes one PNG of the stage per
   cell. Open the folder and you are looking at the range of the
   generators in one sitting.

     node scripts/capture-atelier.cjs [outDir] [url]

   Needs the dev server (`cd apps/atelier && npm run dev`) and the
   Chromium in .ds-sync — see print-deck.mjs for the install line.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const out = process.argv[2] || path.join(__dirname, '..', 'proof', 'atelier');
const url = process.argv[3] || 'http://localhost:5181';
fs.mkdirSync(out, { recursive: true });

const BIOMES = ['dungeon', 'tower', 'deep-forest', 'desert', 'undercity', 'frozen-pass'];
const STYLES = ['flat', 'line', 'pixel', 'engraving'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(url);
  await page.waitForTimeout(1200);

  // The bar's selects, in order: biome, style. Benches add their own after.
  const select = async (value) => {
    const handle = await page.evaluateHandle((v) => [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === v)), value);
    await handle.asElement().selectOption(value);
    await page.waitForTimeout(150);
  };
  const tab = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(200); };
  const toggle = async (label, on) => {
    const box = page.getByLabel(label);
    if (await box.count()) { if ((await box.isChecked()) !== on) await box.click(); }
  };
  let n = 0;
  const shot = async (name) => {
    await page.waitForTimeout(250);
    const file = path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.locator('.atl-stage').screenshot({ path: file });
    console.log(file);
  };

  await tab('Back');
  for (const mode of ['walls', 'passages', 'spiral']) { await select(mode); await shot(`back-dungeon-${mode}-flat`); }
  await select('walls');
  for (const style of ['pixel', 'engraving', 'line']) { await select(style); await shot(`back-dungeon-walls-${style}`); }
  await select('flat');
  await select('deep-forest'); await select('passages'); await shot('back-deep-forest-passages-flat');
  await select('scene');
  for (const biome of BIOMES) { await select(biome); await shot(`back-${biome}-scene-flat`); }
  await select('pixel'); await select('frozen-pass'); await shot('back-frozen-pass-scene-pixel');
  await select('engraving'); await select('tower'); await shot('back-tower-scene-engraving');
  await select('flat'); await select('walls');
  await select('dungeon');

  await tab('Scene');
  await toggle('All seven cards', false);
  await select('obstacle');
  for (const biome of BIOMES) { await select(biome); await shot(`scene-${biome}-obstacle-flat`); }
  await select('dungeon');
  for (const style of STYLES.slice(1)) { await select(style); await shot(`scene-dungeon-obstacle-${style}`); }
  await select('flat');
  await toggle('All seven cards', true);
  await shot('scene-dungeon-all-flat');
  await select('deep-forest'); await select('pixel'); await shot('scene-deep-forest-all-pixel');
  await select('frozen-pass'); await select('engraving'); await shot('scene-frozen-pass-all-engraving');
  await select('desert'); await select('line'); await shot('scene-desert-all-line');
  await toggle('All seven cards', false);
  await select('flat');
  await page.getByRole('tab', { name: 'Wide', exact: true }).click();
  await select('wanderer'); await select('undercity'); await shot('scene-undercity-wanderer-wide-flat');
  await select('tower'); await select('engraving'); await shot('scene-tower-wanderer-wide-engraving');
  await page.getByRole('tab', { name: 'Arch', exact: true }).click();
  await select('flat');

  await tab('Ground');
  for (const [biome, style] of [['dungeon', 'flat'], ['desert', 'engraving'], ['frozen-pass', 'pixel'], ['undercity', 'line'], ['deep-forest', 'flat']]) {
    await select(biome); await select(style); await shot(`ground-${biome}-${style}`);
  }
  await select('dungeon'); await select('flat');

  await tab('Palette');
  await shot('palette-default');

  await browser.close();
})();

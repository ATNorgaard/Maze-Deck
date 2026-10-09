/* ============================================================
   The size table: what card size the board gives each screen, and
   whether anything scrolls (docs/overhaul.md, world/1 and phase 10).

   For each viewport it starts a crossing on the board, skips the
   opening, and reads what useTableFit chose: the river's step, the
   piles', whether the board went narrow (piles under the river), the
   river's size on screen, and how far the page scrolls. The common
   laptop sizes are measured again with the chronicle open, since it
   narrows the table.

     node scripts/capture-sizes.cjs [outDir] [--url=http://localhost:5180]

   Prints a markdown table, and writes it to sizes.md with a
   screenshot per viewport.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'sizes');
const url = flag('url', 'http://localhost:5180');
fs.mkdirSync(out, { recursive: true });

/** [label, width, height, chronicle open]. */
const VIEWPORTS = [
  ['2560 × 1440', 2560, 1440, false],
  ['1920 × 1080', 1920, 1080, false],
  ['1600 × 1000', 1600, 1000, false],
  ['1600 × 1000, chronicle open', 1600, 1000, true],
  ['1536 × 864', 1536, 864, false],
  ['1440 × 900', 1440, 900, false],
  ['1366 × 768', 1366, 768, false],
  ['1366 × 657 (a 1366 laptop, inside a browser)', 1366, 657, false],
  ['1366 × 657, chronicle open', 1366, 657, true],
  ['1280 × 720', 1280, 720, false],
  ['1024 × 768', 1024, 768, false],
  ['820 × 1180 (a tablet, upright)', 820, 1180, false],
  ['390 × 844 (a phone)', 390, 844, false],
];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  let errors = 0;
  for (const [label, w, h, chronicle] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => { errors += 1; console.log(`pageerror at ${label}: ${e.message}`); });
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('mazedeck.sound', 'off');
      localStorage.setItem('mazedeck.world', 'still');
    });
    await page.goto(url);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Set up a crossing' }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Start the crossing$/ }).first().click();
    await page.waitForSelector('.t-table', { timeout: 10000 });
    await page.keyboard.press('Shift'); // past the opening
    if (chronicle) {
      await page.getByRole('button', { name: 'Chronicle' }).first().click();
    }
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const river = document.querySelector('.t-table .md-river');
      const pile = document.querySelector('.t-table .md-pile');
      const r = river?.getBoundingClientRect();
      const hand = document.querySelector('.t-hand')?.getBoundingClientRect();
      const doc = document.scrollingElement;
      return {
        river: river?.getAttribute('data-size') ?? '-',
        pile: pile?.getAttribute('data-size') ?? '-',
        narrow: document.querySelector('.t-table')?.hasAttribute('data-narrow') ?? false,
        box: r ? `${Math.round(r.width)} × ${Math.round(r.height)}` : '-',
        scroll: Math.max(0, (doc?.scrollHeight ?? 0) - window.innerHeight),
        sideways: Math.max(0, (doc?.scrollWidth ?? 0) - window.innerWidth),
        handTop: hand ? Math.round(hand.top) : null,
      };
    });
    const file = `${w}x${h}${chronicle ? '-chronicle' : ''}.png`;
    await page.screenshot({ path: path.join(out, file) });
    rows.push({ label, ...m });
    console.log(`${label.padEnd(46)} river ${m.river}, piles ${m.pile}${m.narrow ? ', narrow' : ''}, river ${m.box}, scrolls ${m.scroll}px${m.sideways ? `, sideways ${m.sideways}px` : ''}`);
    await page.close();
  }
  const table = [
    '| Viewport | River | Piles | Layout | River on screen | Scrolls |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.label} | \`${r.river}\` | \`${r.pile}\` | ${r.narrow ? 'narrow: piles under the river' : 'piles flanking'} | ${r.box} | ${r.scroll ? `${r.scroll}px` : 'no'}${r.sideways ? `, ${r.sideways}px sideways` : ''} |`),
  ].join('\n');
  fs.writeFileSync(path.join(out, 'sizes.md'), `${table}\n`);
  console.log(`\n${table}`);
  await browser.close();
  if (errors) process.exit(1);
})().catch((e) => { console.log(`fatal: ${e.message}`); process.exit(1); });

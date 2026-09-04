/* ============================================================
   Watch the motion in a real browser, one frame at a time.

   The Claude Code browser pane renders no frames while hidden, so every
   beat in docs/plandoc.md was verified there by DOM state alone. This
   drives the same flow in a headless Chromium — start a crossing, take
   an action, let it land, pick — repeating until a card is dealt from
   the deck, and writes a PNG every ~100ms through that deal plus a DOM
   log of what was on screen. Open the PNGs in order and you are
   watching the animation.

     node scripts/capture-frames.cjs <outDir> [url]

   Needs the dev server (`cd apps/table && npm run dev`) and the
   Chromium the print script uses — see print-deck.mjs for the install
   line if it is missing.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

// Playwright lives in .ds-sync, like the print script's Chromium.
const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const out = process.argv[2] || path.join(__dirname, '..', 'proof', 'frames');
const url = process.argv[3] || 'http://localhost:5180';
fs.mkdirSync(out, { recursive: true });

const sample = (page) => page.evaluate(() => ({
  fly: !!document.querySelector('.t-fly'),
  deals: [...document.querySelectorAll('.t-deal')].map((d) => {
    const r = d.getBoundingClientRect();
    return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
  }),
  covered: document.querySelector('.t-river')?.dataset.covered ?? '-',
  phase: document.querySelector('.t-phase__title')?.textContent,
  modal: document.querySelector('.t-modal .t-panel__title')?.textContent ?? '',
  slots: [...document.querySelectorAll('.md-river__slot article')]
    .map((a) => (a.classList.contains('md-card--back') ? 'back' : a.dataset.category) + ':' + getComputedStyle(a).opacity).join('/'),
  counts: [...document.querySelectorAll('.md-pile__count')].map((c) => c.textContent).join('/'),
}));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.goto(url);
  await page.waitForTimeout(800);

  const start = page.getByRole('button', { name: /Set up a crossing/ });
  if (await start.count()) { await start.first().click(); await page.waitForTimeout(400); }
  const go = page.getByRole('button', { name: /Start the crossing|New crossing/ });
  if (await go.count()) { await go.first().click(); await page.waitForTimeout(800); }

  let frame = 0;
  for (let cycle = 0; cycle < 6; cycle += 1) {
    // Clear any decision left over (a Wanderer), then act.
    const moveOn = page.getByRole('button', { name: 'They move on' });
    if (await moveOn.count()) { await moveOn.click(); await page.waitForTimeout(2500); }
    const won = page.getByRole('button', { name: 'They won' });
    if (await won.count()) { await won.click(); await page.waitForTimeout(1500); }

    if (await page.locator('.md-action').count()) {
      await page.locator('.md-action').first().click();
      await page.waitForTimeout(1200);
      const land = page.getByRole('button', { name: 'Let it land' });
      if (await land.count()) await land.click();
      await page.waitForTimeout(1500);
    }
    const phase = await page.locator('.t-phase__title').textContent();
    console.log(`cycle ${cycle}: phase ${phase}`);
    if (!/Commit/.test(phase)) continue;

    await page.locator('.md-river__slot article.md-card--back').first().click();
    const t0 = Date.now();
    const log = [];
    let sawDeal = false;
    let after = 0;
    while (Date.now() - t0 < 6000) {
      const t = Date.now() - t0;
      const s = await sample(page);
      log.push(`${t} fly=${s.fly} deals=[${s.deals.join(' ; ')}] covered=${s.covered} slots=${s.slots} piles=${s.counts} ${s.phase} ${s.modal}`);
      if (s.deals.length) sawDeal = true;
      if (s.deals.length || (sawDeal && after < 6)) {
        if (!s.deals.length) after += 1;
        await page.screenshot({ path: path.join(out, `deal_${String(frame).padStart(3, '0')}_${t}.png`) });
        frame += 1;
      }
      await page.waitForTimeout(40);
    }
    console.log(log.join('\n'));
    if (sawDeal) { console.log('DEAL CAPTURED'); break; }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

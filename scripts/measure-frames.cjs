/* ============================================================
   What the board costs a phone.

   The budget every visual phase of docs/overhaul.md is held to. A
   headless Chromium opens a crossing at a phone's size with the CPU
   throttled, and measures the main thread over a fixed window:

   - idle    the board at rest, as shipped and with the ground painted
             still — the difference is what the setting's light costs
             before anything happens;
   - turn    one turn's beats: an action, the roll, a pick, the flip,
             the flight, the deal.

   Headless rasterises off the main thread, so its frame rate flatters
   a real phone; main-thread task time is the honest number, and the
   one to compare phase against phase.

     node scripts/measure-frames.cjs [options]

       --url=http://localhost:5180
       --biomes=all          or a list: dungeon,frozen-pass
       --cpu=4               CPU throttle; 4 is a mid phone
       --size=390x844        the viewport
       --window=4000         ms measured per row
       --board=table         which GM board: table (the new one) or
                             session. Phase 0's baseline was the old one.

   Prints a Markdown table, ready to paste into docs/overhaul.md.

   Needs the dev server (`cd apps/table && npm run dev`) and the
   Chromium in .ds-sync — see print-deck.mjs for the install line.
   ============================================================ */
const path = require('path');
const { createRequire } = require('module');

const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ALL = ['dungeon', 'tower', 'deep-forest', 'desert', 'undercity', 'frozen-pass'];
const url = flag('url', 'http://localhost:5180');
const biomes = flag('biomes', 'all') === 'all' ? ALL : flag('biomes', '').split(',');
const cpu = Number(flag('cpu', '4'));
const [W, H] = flag('size', '390x844').split('x').map(Number);
const windowMs = Number(flag('window', '4000'));
const board = flag('board', 'table');

const STILL = '.t-app::before { background: var(--md-ink-900) !important; animation: none !important; }';

async function open(browser, biome) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3 });
  await page.goto(url);
  await page.evaluate((b) => { localStorage.clear(); localStorage.setItem('mazedeck.board', b); }, board);
  await page.goto(url);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Set up a crossing/ }).first().click();
  await page.waitForTimeout(600);
  const door = page.locator(`.t-door[data-biome="${biome}"]`);
  if (await door.count()) await door.first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Start the crossing/ }).first().click();
  await page.waitForTimeout(1500);
  return page;
}

/** Main-thread time and frame pacing over `ms`, while `during` runs. */
async function measure(page, ms, during) {
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await cdp.send('Performance.enable');
  const before = await cdp.send('Performance.getMetrics');
  const frames = page.evaluate((total) => new Promise((resolve) => {
    const deltas = [];
    let last = performance.now();
    const t0 = last;
    const tick = (t) => {
      deltas.push(t - last);
      last = t;
      if (t - t0 < total) requestAnimationFrame(tick);
      else resolve({ count: deltas.length, worst: Math.max(...deltas), long: deltas.filter((d) => d > 33.4).length });
    };
    requestAnimationFrame(tick);
  }), ms);
  if (during) await during();
  const f = await frames;
  const after = await cdp.send('Performance.getMetrics');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const get = (m, k) => m.metrics.find((x) => x.name === k)?.value ?? 0;
  const d = (k) => get(after, k) - get(before, k);
  return {
    task: d('TaskDuration'), style: d('RecalcStyleDuration'), layout: d('LayoutDuration'),
    fps: f.count / (ms / 1000), worst: f.worst, long: f.long,
  };
}

/** One turn, driven through as a quick GM would. */
async function playTurn(page) {
  const click = async (loc) => { if (await loc.count()) await loc.first().click(); };
  await click(page.locator('.md-action'));
  await page.waitForTimeout(900);
  await click(page.getByRole('button', { name: 'Let it land' }));
  await page.waitForTimeout(500);
  await click(page.locator('.md-river__slot article.md-card--back'));
}

const row = (label, r) => `| ${label} | ${r.task.toFixed(2)} s | ${r.style.toFixed(2)} s | ${r.layout.toFixed(2)} s | ${r.fps.toFixed(0)} | ${r.worst.toFixed(0)} ms | ${r.long} |`;

(async () => {
  const browser = await chromium.launch();
  console.log(`${board} board, ${W}×${H}, ${cpu}× CPU, ${windowMs} ms a row\n`);
  console.log('| | Main-thread task | Style | Layout | fps | Worst frame | Frames > 33 ms |');
  console.log('|---|---|---|---|---|---|---|');
  for (const biome of biomes) {
    let page = await open(browser, biome);
    console.log(row(`${biome}, idle`, await measure(page, windowMs)));
    await page.addStyleTag({ content: STILL });
    await page.waitForTimeout(300);
    console.log(row(`${biome}, idle, ground still`, await measure(page, windowMs)));
    await page.close();

    page = await open(browser, biome);
    console.log(row(`${biome}, one turn`, await measure(page, windowMs + 2000, () => playTurn(page))));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

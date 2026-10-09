/* ============================================================
   Walk a whole crossing and photograph every moment of it.

   The Claude Code browser pane renders no frames while hidden, so
   this is how the board is judged by eye (docs/overhaul.md, phase 0):
   a headless Chromium starts a crossing, plays it — rotating through
   the six actions so every kind of decision comes up, ruling some
   checks a success so the choices open — and writes one PNG the
   first time each moment appears: the threshold, the board at rest,
   the roll tumbling and landed, every kind of choice, the pick, the
   Wanderer, the encounter. The first reveals are photographed as
   frames, and the run is ended at the close so the ending is too.

   It also measures one thing the eye cannot: during every reveal,
   how far the turned card stands from the slot it came out of.
   That should be 0px. It was ~60px before phase 0, because the scene
   line mounted mid-flip and pushed the river down under it.

     node scripts/capture-walk.cjs [outDir] [options]

       --url=http://localhost:5180
       --size=1600x1000      the viewport
       --biome=dungeon       which door to open on the threshold
       --frames=2            how many reveals to photograph as frames
       --turns=40            give up after this many steps
       --still               paint the ground still, for comparing
       --board=table         which GM board: table (the new one) or session
       --world=auto          the new board's world layer: auto, high, low, still, off
       --gpu                 draw WebGL on this machine's GPU, not SwiftShader

   Writes walk.log beside the pictures: the board's state at every
   step, and the reveal offsets. Exits non-zero if the renderer
   crashes or a reveal stands off its slot.

   Needs the dev server (`cd apps/table && npm run dev`) and the
   Chromium in .ds-sync — see print-deck.mjs for the install line.
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
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'walk');
const url = flag('url', 'http://localhost:5180');
const [W, H] = flag('size', '1600x1000').split('x').map(Number);
const biome = flag('biome', 'dungeon');
const frameReveals = Number(flag('frames', '2'));
const maxTurns = Number(flag('turns', '40'));
const still = args.includes('--still');
const board = flag('board', 'table');
const world = flag('world', 'auto');
const gpu = args.includes('--gpu');
fs.mkdirSync(out, { recursive: true });

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const save = () => fs.writeFileSync(path.join(out, 'walk.log'), `${lines.join('\n')}\n`);

/** Where the turned card stands against its own slot, in px. */
const revealOffset = (page) => page.evaluate(() => {
  const fly = document.querySelector('.t-fly');
  const covered = document.querySelector('.t-river')?.dataset.covered;
  if (!fly || covered === undefined) return null;
  const slot = Number(covered.split(' ')[0]);
  // Against where the card RESTS, read through its slot as the stage
  // reads it. The card itself may still be dropping back from the
  // pointer's lift under the mask, invisible and not yet at rest.
  const holder = document.querySelectorAll('.md-river__slot')[slot];
  const card = holder?.querySelector('article');
  if (!holder || !card) return null;
  const h = holder.getBoundingClientRect();
  const scale = holder.offsetWidth > 0 ? h.width / holder.offsetWidth : 1;
  const a = fly.getBoundingClientRect();
  return {
    slot,
    dx: Math.round(a.left - (h.left + card.offsetLeft * scale)),
    dy: Math.round(a.top - (h.top + card.offsetTop * scale)),
  };
});

const state = (page) => page.evaluate(() => ({
  // The old board is .t-board, the new one .t-table (docs/overhaul.md, phase 1).
  focus: document.querySelector('.t-board, .t-table')?.dataset.focus ?? '-',
  // The new board's encounter is a takeover, not a panel (phase 4).
  modal: (document.querySelector('.t-modal .t-panel__title') ?? document.querySelector('.t-found__title'))?.textContent ?? '',
  // ...and its decisions are made in place, under a prompt.
  ask: document.querySelector('.t-ask[data-shown] .t-ask__title')?.textContent ?? '',
  outcome: document.querySelector('.t-board, .t-table')?.dataset.outcome ?? '',
  river: [...document.querySelectorAll('.md-river__slot')]
    .map((s) => s.querySelector('article')?.dataset.category ?? (s.querySelector('.md-card--back') ? 'back' : '·'))
    .join('/'),
  log: document.querySelectorAll('.t-log__line').length,
}));

(async () => {
  const browser = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let crashed = false;
  page.on('crash', () => { crashed = true; log('!! the renderer crashed'); });
  // React warns with a format string and its arguments apart; put them
  // together, and keep the top of the component stack, which says where
  // the warning came from.
  page.on('console', async (m) => {
    if (m.type() !== 'error') return;
    const parts = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')));
    let text = String(parts.shift() ?? m.text());
    while (text.includes('%s') && parts.length) text = text.replace('%s', String(parts.shift()));
    const stack = parts.map(String).join(' ').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join(' < ');
    log(`console: ${text.slice(0, 160)}${stack ? ` [${stack.slice(0, 240)}]` : ''}`);
  });
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

  let n = 0;
  const shot = async (name) => {
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    n += 1;
    await page.screenshot({ path: path.join(out, file) });
    log(`shot ${file}`);
  };
  const seen = new Set();
  const once = async (key, name = key) => {
    if (seen.has(key)) return;
    seen.add(key);
    await shot(name);
  };
  const click = async (locator) => { if (await locator.count()) { await locator.first().click(); return true; } return false; };

  // A fresh visitor: no campaign, no run.
  await page.goto(url);
  await page.evaluate(([b, w]) => {
    localStorage.clear();
    localStorage.setItem('mazedeck.sound', 'off'); // the threshold's question, answered
    localStorage.setItem('mazedeck.board', b);
    localStorage.setItem('mazedeck.world', w);
  }, [board, world]);
  await page.goto(url);
  await page.waitForTimeout(1000);
  await shot('landing');

  await click(page.getByRole('button', { name: /Set up a crossing/ }));
  await page.waitForTimeout(800);
  await click(page.locator(`.t-door[data-biome="${biome}"]`));
  await page.waitForTimeout(500);
  await shot('threshold');

  await click(page.getByRole('button', { name: /Start the crossing/ }));
  await page.waitForTimeout(1500);
  if (still) {
    await page.addStyleTag({ content: '.t-app::before { background: var(--md-ink-900) !important; animation: none !important; }' });
  }
  await shot('board');

  const offsets = [];
  let reveals = 0;
  for (let step = 0; step < maxTurns && !crashed; step += 1) {
    const s = await state(page);
    log(`#${step} focus=${s.focus} modal="${s.modal}" ask="${s.ask}" river=${s.river} log=${s.log}`);
    if (s.outcome) break;

    if (/initiative/i.test(s.modal)) {
      await once('encounter');
      await click(page.getByRole('button', { name: 'They won' }));
    } else if (/wanderer/i.test(s.modal)) {
      await once('wanderer');
      await click(page.getByRole('button', { name: 'They move on' }));
    } else if (await page.getByRole('button', { name: 'Let it land' }).count()) {
      await once('roll-landed');
      // Every other check is ruled a success, so the choices come up.
      const rule = page.getByRole('button', { name: 'Rule it a success' });
      if (step % 2 === 0 && await rule.count()) await rule.click();
      else await click(page.getByRole('button', { name: 'Let it land' }));
    } else if (s.ask) {
      // A decision on the table: the Wanderer moves on; otherwise the
      // first thing offered — a fanned card, a slot, a seat on the rail.
      await once(`ask:${s.ask}`, `ask-${s.ask.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}`);
      if (!(await click(page.getByRole('button', { name: 'They move on' })))
        && !(await click(page.locator('[data-choice]')))) {
        await click(page.locator('.t-rail[data-choosing] .md-seat[role="button"]'));
      }
    } else if (s.modal) {
      await once(`choice:${s.modal}`, `choice-${s.modal.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}`);
      if (await click(page.locator('.t-modal .t-pick'))) await page.waitForTimeout(200);
      await click(page.locator('.t-modal button.t-btn:not([disabled])'));
    } else if (s.focus === 'actions') {
      const actions = page.locator('.md-action');
      await actions.nth(step % Math.max(await actions.count(), 1)).click();
      await page.waitForTimeout(200);
      await once('roll-tumbling');
    } else if (s.focus === 'river') {
      await once('pick');
      const target = page.locator('.md-river__slot article.md-card--back, .md-river__slot article[data-interactive]');
      if (!(await target.count())) { await page.waitForTimeout(800); continue; }
      await target.first().click();
      const t0 = Date.now();
      reveals += 1;
      const photograph = reveals <= frameReveals;
      // The hold is sampled every ~50ms, not at a few moments: a card
      // settling under the overlay is a 200ms transient, and four samples
      // a reveal let one through (world/1). Photographs at fixed moments.
      const photos = photograph ? [150, 450, 900, 1600, 2300, 2900] : [];
      for (let t = Date.now() - t0; t < 2900 || photos.length; t = Date.now() - t0) {
        if (t <= 1600) {
          const off = await revealOffset(page);
          if (off) offsets.push(off);
        }
        if (photos.length && t >= photos[0]) await shot(`reveal${reveals}-${photos.shift()}ms`);
        await page.waitForTimeout(50);
      }
      continue;
    }
    await page.waitForTimeout(1400);
  }
  save();

  // A dialog left open marks the rest of the page inert, "End the run"
  // included, so answer whatever is still owed before closing.
  for (let k = 0; k < 8 && !crashed; k += 1) {
    if (!(await page.locator('.t-modal').count())) break;
    if (!(await click(page.getByRole('button', { name: /Let it land|They won|They move on/ })))) {
      if (await click(page.locator('.t-modal .t-pick'))) await page.waitForTimeout(200);
      await click(page.locator('.t-modal button.t-btn:not([disabled])'));
    }
    await page.waitForTimeout(1400);
  }

  if (!crashed) {
    // On the new board the GM's controls are in a drawer.
    if (!(await page.getByRole('button', { name: 'End the run' }).count())) {
      await click(page.getByRole('button', { name: 'GM', exact: true }));
      await page.waitForTimeout(400);
    }
    if (await click(page.getByRole('button', { name: 'End the run' }))) {
      await page.waitForTimeout(400);
      await shot('ending');
      await page.waitForTimeout(2200);
      await shot('ending-dialog');
    }
  }

  const worst = offsets.reduce((m, o) => Math.max(m, Math.abs(o.dx), Math.abs(o.dy)), 0);
  const off = offsets.filter((o) => o.dx !== 0 || o.dy !== 0);
  log(`reveal samples: ${offsets.length} over ${reveals} reveals, worst offset from the slot: ${worst}px`);
  if (off.length) log(`off its slot: ${off.map((o) => `${o.slot}:${o.dx},${o.dy}`).join(' ')}`);
  save();
  await browser.close();
  if (crashed || worst > 1) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); save(); process.exit(1); });

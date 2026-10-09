/* ============================================================
   Photograph cards with weight (docs/overhaul.md, phase 6).

   Stages each thing on the new board the way capture-score.cjs does —
   a crossing started, the saved run rewritten, a reload — and
   photographs it:

     tilt       the pointer over a back's corner, a face-up card's
                corner, and the deck: the tilt, the sheen, the back's
                layers parting. Logs each card's transform.
     press      a path pressed and held (lifted towards the viewer),
                then released: the turn starting from the lift.
     sig        each category revealed in turn, as frames: the Clear
                Path's light, the Monster's red, the Obstacle's slam
                and dust, the Item's slow turn and glint, the
                Wanderer standing up.
     piles      the deck full and nearly spent; the discard after
                three cards have landed on it, scattered.

     node scripts/capture-weight.cjs [outDir] [options]

       --url=http://localhost:5180
       --size=1600x1000
       --biome=dungeon
       --only=tilt,sig       default: all
       --gpu                 draw WebGL on this machine's GPU
       --reduced             ask for reduced motion: nothing may tilt

   Writes weight.log beside the pictures. Exits non-zero on a page
   error.

   Needs the dev server (`cd apps/table && npm run dev`) and the
   Chromium in .ds-sync.
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
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'weight');
const url = flag('url', 'http://localhost:5180');
const [W, H] = flag('size', '1600x1000').split('x').map(Number);
const biome = flag('biome', 'dungeon');
const gpu = args.includes('--gpu');
const reduced = args.includes('--reduced');
const only = flag('only', 'tilt,press,sig,piles').split(',');
fs.mkdirSync(out, { recursive: true });

const KEY = 'mazedeck.campaign.v1';
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const save = () => fs.writeFileSync(path.join(out, 'weight.log'), `${lines.join('\n')}\n`);
const up = (category) => ({ category, faceUp: true });
const down = (category) => ({ category, faceUp: false });

(async () => {
  const browser = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  let failed = false;
  page.on('pageerror', (e) => { log(`pageerror: ${e.message}`); failed = true; });
  page.on('console', async (m) => {
    if (m.type() !== 'error') return;
    const parts = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')));
    let text = String(parts.shift() ?? m.text());
    while (text.includes('%s') && parts.length) text = text.replace('%s', String(parts.shift()));
    log(`console: ${text.slice(0, 200)}`);
  });
  const click = async (loc) => { if (await loc.count()) { await loc.first().click(); return true; } return false; };
  const shot = async (name, clip) => {
    await page.screenshot({ path: path.join(out, `${name}.png`), ...(clip ? { clip } : {}) });
    log(`shot ${name}.png`);
  };

  /** A fresh crossing on the new board, its saved run rewritten by `stage`. */
  const open = async (stage) => {
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('mazedeck.sound', 'off'); // the threshold's question, answered
      localStorage.setItem('mazedeck.board', 'table');
      localStorage.setItem('mazedeck.world', 'high');
    });
    await page.goto(url);
    await page.waitForTimeout(600);
    await click(page.getByRole('button', { name: /Set up a crossing/ }));
    await page.waitForTimeout(400);
    await click(page.locator(`.t-door[data-biome="${biome}"]`));
    await page.waitForTimeout(300);
    await click(page.getByRole('button', { name: /Start the crossing/ }));
    await page.waitForTimeout(800);
    const c = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY));
    stage(c.run, c);
    await page.evaluate(([k, j]) => localStorage.setItem(k, j), [KEY, JSON.stringify(c)]);
    await page.goto(url);
    await page.waitForTimeout(1500);
  };
  const slotCard = (i) => page.locator('.md-river__slot').nth(i).locator('article');
  /** The region round the surface, for close pictures. */
  const surfaceClip = async () => {
    const b = await page.locator('.t-surface').boundingBox();
    return b ? { x: Math.max(0, b.x - 20), y: Math.max(0, b.y - 40), width: Math.min(W, b.width + 40), height: b.height + 80 } : undefined;
  };
  const pose = (loc) => loc.evaluate((el) => ({
    transform: getComputedStyle(el).transform.slice(0, 80),
    tx: el.style.getPropertyValue('--tx'),
    ty: el.style.getPropertyValue('--ty'),
    layers: [...el.querySelectorAll('.md-card__art[data-depth]')].map((a) => getComputedStyle(a).transform),
  }));

  if (only.includes('tilt')) {
    await open((run) => {
      run.phase = 'act';
      run.river = [up('obstacle'), down('item'), down('item')];
    });
    const clip = await surfaceClip();
    await shot('tilt-0-rest', clip);
    for (const [name, target, fx, fy] of [
      ['back', slotCard(1), 0.85, 0.15],
      ['face', slotCard(0), 0.15, 0.2],
      ['deck', page.locator('.t-surface__pile--deck article').first(), 0.8, 0.8],
    ]) {
      const b = await target.boundingBox();
      if (!b) { log(`tilt ${name}: no card`); failed = true; continue; }
      await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
      await page.waitForTimeout(80);
      await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 6 });
      await page.waitForTimeout(400);
      const p = await pose(target);
      log(`tilt ${name}: ${JSON.stringify(p)}`);
      if (reduced && p.tx) { log(`!! tilt ${name} under reduced motion`); failed = true; }
      await shot(`tilt-1-${name}`, clip);
    }
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    log(`tilt released: ${JSON.stringify(await pose(slotCard(0)))}`);
  }

  if (only.includes('press')) {
    await open((run) => {
      run.phase = 'pick'; run.pending = null; run.revealed = null;
      run.river = [down('item'), down('clear-path'), down('item')];
    });
    const clip = await surfaceClip();
    const card = slotCard(1);
    const b = await card.boundingBox();
    await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.3, { steps: 4 });
    await page.waitForTimeout(300);
    await shot('press-0-hover', clip);
    await page.mouse.down();
    await page.waitForTimeout(160);
    log(`press held: ${JSON.stringify(await pose(card))}`);
    await shot('press-1-held', clip);
    await page.mouse.up();
    for (const t of [40, 200, 450]) {
      await page.waitForTimeout(t === 40 ? 40 : t - 40);
      const fly = await page.evaluate(() => {
        const p = document.querySelector('.t-fly__pose');
        return p ? getComputedStyle(p).transform.slice(0, 80) : null;
      });
      log(`press released +${t}ms: overlay pose ${fly}`);
      await shot(`press-2-released-${t}ms`, clip);
    }
  }

  if (only.includes('sig')) {
    for (const category of ['clear-path', 'monster', 'obstacle', 'item', 'wanderer']) {
      await open((run) => {
        run.phase = 'pick'; run.pending = null; run.revealed = null;
        run.river = [down('item'), down(category), down('item')];
      });
      await page.mouse.move(5, 5);
      await slotCard(1).click();
      // Timed from the card starting to turn, not from the click returning.
      await page.waitForSelector('.t-fly', { timeout: 3000 });
      const t0 = Date.now();
      // The signature at its height, held still for one picture: a frame
      // taken on the clock lands wherever the screenshot's own latency
      // puts it, and these moments are a few hundred milliseconds long.
      // The beats run on timers, so holding an animation moves nothing.
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const peaks = { tGlint: 0.4, tDust: 0.3, tBeam: 0.45, tSlam: 1, tFlare: 0.3 };
        for (const a of document.getAnimations()) {
          const at = peaks[a.animationName];
          if (at === undefined) continue;
          const t = a.effect.getTiming();
          a.pause();
          a.currentTime = t.delay + t.duration * at;
        }
      });
      await page.waitForTimeout(60);
      await shot(`sig-${category}-peak`);
      await page.evaluate(() => { for (const a of document.getAnimations()) if (a.playState === 'paused') a.play(); });
      for (const at of [180, 420, 650, 900, 1150, 1350, 1700]) {
        const wait = at - (Date.now() - t0);
        if (wait > 0) await page.waitForTimeout(wait);
        const state = await page.evaluate(() => ({
          sig: document.querySelector('.t-fly')?.dataset.sig ?? '-',
          beam: Boolean(document.querySelector('.t-beam')),
          dust: document.querySelectorAll('.t-dust > span').length,
          glint: Boolean(document.querySelector('.t-glint')),
        }));
        log(`sig ${category} +${at}ms: ${JSON.stringify(state)}`);
        await shot(`sig-${category}-${String(at).padStart(4, '0')}ms`);
      }
    }
  }

  if (only.includes('piles')) {
    await open((run) => { run.phase = 'act'; });
    const piles = async () => {
      const a = await page.locator('.t-surface__pile--deck').boundingBox();
      const b = await page.locator('.t-surface__pile--discard').boundingBox();
      return { deck: a, discard: b };
    };
    let p = await piles();
    await shot('piles-0-deck-full', { x: p.deck.x - 30, y: p.deck.y - 30, width: p.deck.width + 60, height: p.deck.height + 60 });
    await open((run) => {
      run.phase = 'act';
      run.discard = [...run.discard, ...run.deck.splice(0, run.deck.length - 4)];
    });
    p = await piles();
    await shot('piles-1-deck-spent', { x: p.deck.x - 30, y: p.deck.y - 30, width: p.deck.width + 60, height: p.deck.height + 60 });

    // Three cards land on the discard, one a turn, as the table plays.
    await open((run) => {
      run.phase = 'pick'; run.pending = null; run.revealed = null;
      run.river = [down('item'), down('monster'), down('wanderer')];
      run.deck = [...run.deck.filter((c) => c !== 'monster' && c !== 'wanderer').slice(0, 10), 'item', 'clear-path', 'clear-path'];
    });
    for (let turn = 0; turn < 3; turn += 1) {
      if (turn > 0) {
        await click(page.locator('.md-action'));
        await page.waitForTimeout(900);
        await click(page.getByRole('button', { name: 'Let it land' }));
        await page.waitForTimeout(700);
      }
      await click(page.locator('.md-river__slot article.md-card--back'));
      await page.waitForTimeout(3600);
      if (await page.getByRole('button', { name: 'They won' }).count()) await click(page.getByRole('button', { name: 'They won' }));
    }
    p = await piles();
    log(`discard trail: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.t-surface__pile--discard article')].map((a) => a.dataset.category)))}`);
    await shot('piles-2-discard', { x: p.discard.x - 40, y: p.discard.y - 30, width: p.discard.width + 80, height: p.discard.height + 60 });
  }

  save();
  await browser.close();
  if (failed) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); save(); process.exit(1); });

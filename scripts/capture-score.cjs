/* ============================================================
   Photograph the moments the world keeps score with.

   A walk (capture-walk.cjs) meets a jam or a reshuffle only when the
   deck happens to deal one, so this stages each moment instead
   (docs/overhaul.md, phase 5). It starts a crossing (on the new board
   unless told otherwise), rewrites the saved run in localStorage so
   the moment is one pick away, reloads, makes the pick, and
   photographs the moment as it plays — polling the board every 50ms
   and taking one picture the first time each part of it is on screen.

     node scripts/capture-score.cjs [outDir] [options]

       --url=http://localhost:5180
       --size=1600x1000
       --biome=dungeon
       --only=route,jam      the scenes to stage; default all of them:
                             route, round, jam, reshuffle, found, dark
       --world=high          the world layer; `still` for software GL
       --board=table         or session: the old board shares the stage, so
                             its jam and reshuffle fly too
       --gpu                 draw WebGL on this machine's GPU
       --reduced             ask for reduced motion: every beat is a cut, so
                             only what is not motion is expected — the
                             encounter, and the round's mark (shown still)

   The scenes:
     route      two Clear Paths gained with their scenes kept; a third
                is taken, and the route takes its landmark
     round      the last seat of the round takes a path: Round 2 passes
     jam        two Obstacles face up and a third face down; it is
                taken, and the river jams
     reshuffle  the deck is empty, so the slot the card taken leaves
                is dealt from the discard, shuffled back in
     found      one strike; a Monster is taken, and the dark closes in
                before the encounter
     dark       the board at rest at one strike: the dark drawn in

   Writes score.log beside the pictures: what was on screen at each
   moment. Exits non-zero if a staged moment never appeared.

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
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'score');
const url = flag('url', 'http://localhost:5180');
const [W, H] = flag('size', '1600x1000').split('x').map(Number);
const biome = flag('biome', 'dungeon');
const world = flag('world', 'high');
const boardName = flag('board', 'table');
const gpu = args.includes('--gpu');
const reduced = args.includes('--reduced');
const ALL = ['route', 'round', 'jam', 'reshuffle', 'found', 'dark'];
const only = flag('only', ALL.join(',')).split(',');
fs.mkdirSync(out, { recursive: true });

const KEY = 'mazedeck.campaign.v1';
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const save = () => fs.writeFileSync(path.join(out, 'score.log'), `${lines.join('\n')}\n`);

const up = (category) => ({ category, faceUp: true });
const down = (category) => ({ category, faceUp: false });
const pile = (n, card = 'item') => Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 'clear-path' : card));
const landmark = (progress) => ({
  category: 'clear-path', entryId: `score-${progress}`, text: `A way through, the ${['first', 'second', 'third', 'fourth'][progress]}.`,
  key: `score:${progress}`, round: 1, seatId: null, progress,
});

/** Each scene: how to set the run up, which slot to take, what must be seen. */
const SCENES = {
  route: {
    stage: (run, c) => {
      run.progress = 2;
      run.river = [down('clear-path'), down('item'), down('item')];
      c.chronicle = [landmark(0), landmark(1)];
    },
    take: 0,
    expect: ['route-fresh', 'stepped'],
  },
  round: {
    stage: (run) => {
      run.turn = run.order.length - 1;
      run.river = [down('item'), down('item'), down('item')];
      // Two in the discard as Round 2 begins: the pile and the mark are
      // siblings, and once shared a key (world/5's log).
      run.discard = ['monster'];
      run.deck = run.deck.filter((c, i) => i !== run.deck.indexOf('monster'));
    },
    take: 1,
    expect: ['round'],
  },
  jam: {
    stage: (run) => { run.river = [up('obstacle'), up('obstacle'), down('obstacle')]; },
    take: 2,
    expect: ['jam', 'feed'],
  },
  reshuffle: {
    stage: (run) => {
      run.river = [down('item'), down('item'), down('monster')];
      run.discard = [...run.deck, ...run.discard];
      run.deck = [];
    },
    take: 0,
    expect: ['gather'],
  },
  found: {
    stage: (run) => {
      run.strikes = run.config.encounterAt - 1;
      run.river = [down('monster'), down('item'), down('item')];
    },
    take: 0,
    expect: ['found', 'encounter'],
  },
  dark: {
    stage: (run) => {
      run.strikes = run.config.encounterAt - 1;
      run.phase = 'act';
    },
    take: null,
    expect: [],
  },
};

/** What part of a moment is on screen, if any. */
const moments = (page) => page.evaluate(() => {
  const on = [];
  if (document.querySelector('.t-flight[data-fade]')) on.push('jam');
  if (document.querySelector('.t-flight[data-feed]')) on.push('feed');
  if (document.querySelector('.t-flight:not([data-fade]):not([data-feed])')) on.push('gather');
  if (document.querySelector('.t-table[data-found]') && !document.querySelector('.t-found')) on.push('found');
  if (document.querySelector('.t-found')) on.push('encounter');
  if (document.querySelector('.t-roundmark')) on.push('round');
  if (document.querySelector('.t-route__way[data-fresh]')) on.push('route-fresh');
  const layer = document.querySelector('.t-vista__layer:last-child');
  if (layer && layer.getAnimations().some((a) => a.effect?.getKeyframes?.().some((k) => String(k.transform).includes('scale')))) on.push('stepped');
  return on;
});

const board = (page) => page.evaluate(() => ({
  route: document.querySelector('.t-route')?.getAttribute('aria-label') ?? '-',
  marks: document.querySelectorAll('.t-route__way[data-mark]').length,
  threat: document.querySelector('.md-score--threat')?.getAttribute('aria-label') ?? '-',
  round: document.querySelector('.t-top__meta')?.textContent ?? '',
  discard: document.querySelector('.t-surface__pile--discard article')?.dataset.category ?? '-',
  river: [...document.querySelectorAll('.md-river__slot')]
    .map((s) => s.querySelector('article')?.dataset.category ?? (s.querySelector('.md-card--back') ? 'back' : '·'))
    .join('/'),
  tier: document.querySelector('.t-world')?.dataset.tier ?? 'none',
  // The vista's box and its picture's, left/top/width/height: a step
  // forward must stay inside the box.
  vista: [...document.querySelectorAll('.t-vista, .t-vista__layer:last-child svg')].map((e) => {
    const b = e.getBoundingClientRect();
    return [b.left, b.top, b.width, b.height].map(Math.round).join(',');
  }).join(' | '),
}));

(async () => {
  const browser = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  let failed = false;
  // Formatted as capture-walk.cjs does, with the top of React's component stack.
  page.on('console', async (m) => {
    if (m.type() !== 'error') return;
    const parts = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')));
    let text = String(parts.shift() ?? m.text());
    while (text.includes('%s') && parts.length) text = text.replace('%s', String(parts.shift()));
    const stack = parts.map(String).join(' ').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join(' < ');
    log(`console: ${text.slice(0, 160)}${stack ? ` [${stack.slice(0, 240)}]` : ''}`);
  });
  page.on('pageerror', (e) => { log(`pageerror: ${e.message}`); failed = true; });

  const click = async (locator) => { if (await locator.count()) { await locator.first().click(); return true; } return false; };

  for (const name of only) {
    const scene = SCENES[name];
    if (!scene) { log(`?? no scene "${name}"`); failed = true; continue; }

    // A fresh crossing, on the new board.
    await page.goto(url);
    await page.evaluate(([w, b]) => {
      localStorage.clear();
      localStorage.setItem('mazedeck.sound', 'off'); // the threshold's question, answered
      localStorage.setItem('mazedeck.board', b);
      localStorage.setItem('mazedeck.world', w);
    }, [world, boardName]);
    await page.goto(url);
    await page.waitForTimeout(600);
    await click(page.getByRole('button', { name: /Set up a crossing/ }));
    await page.waitForTimeout(500);
    await click(page.locator(`.t-door[data-biome="${biome}"]`));
    await page.waitForTimeout(300);
    await click(page.getByRole('button', { name: /Start the crossing/ }));
    await page.waitForTimeout(800);

    // The moment, one pick away. The saved run is rewritten here, not in
    // the page, so a scene can use the helpers above.
    const c = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), KEY));
    scene.stage(c.run, c);
    if (scene.take !== null) Object.assign(c.run, { phase: 'pick', pending: null, revealed: null });
    await page.evaluate(([key, json]) => localStorage.setItem(key, json), [KEY, JSON.stringify(c)]);
    await page.goto(url);
    await page.waitForTimeout(1500);
    log(`${name}: before ${JSON.stringify(await board(page))}`);
    await page.screenshot({ path: path.join(out, `${name}-0-before.png`) });

    if (scene.take === null) {
      // The dark at rest is the scene: one strike, then the encounter.
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, `${name}-1-one-strike.png`) });
      continue;
    }

    await page.locator('.md-river__slot').nth(scene.take).locator('article').click();
    const t0 = Date.now();
    const seen = new Set();
    while (Date.now() - t0 < 7000) {
      const on = await moments(page);
      for (const m of on) {
        if (seen.has(m)) continue;
        seen.add(m);
        const at = Date.now() - t0;
        log(`${name}: ${m} at ${at}ms`);
        // Some moments fade in: photographed once they are there.
        const settle = { round: 450, found: 900, 'route-fresh': 350 }[m] ?? 0;
        if (settle) await page.waitForTimeout(settle);
        await page.screenshot({ path: path.join(out, `${name}-${seen.size}-${m}.png`) });
      }
      await page.waitForTimeout(50);
    }
    log(`${name}: after ${JSON.stringify(await board(page))}`);
    await page.screenshot({ path: path.join(out, `${name}-9-after.png`) });
    // A board too short for a vista (1366 x 768) has no picture to step into.
    const vista = await page.locator('.t-vista[data-shown]').count();
    const expected = reduced ? scene.expect.filter((m) => m === 'encounter' || m === 'round') : scene.expect;
    const missing = expected.filter((m) => !seen.has(m) && (m !== 'stepped' || vista > 0));
    // Under reduced motion nothing may fly, and the encounter does not wait for the dark.
    if (reduced && ['jam', 'feed', 'gather', 'stepped', 'route-fresh'].some((m) => seen.has(m))) {
      log(`!! ${name}: motion under reduced motion: ${[...seen].join(', ')}`); failed = true;
    }
    if (missing.length) { log(`!! ${name}: never saw ${missing.join(', ')}`); failed = true; }
  }

  save();
  await browser.close();
  if (failed) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); save(); process.exit(1); });

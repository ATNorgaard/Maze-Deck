/* ============================================================
   Photograph the ceremony (docs/overhaul.md, phase 7).

     opening    a crossing started from the threshold: its name over the
                horizon, the riffle, the deal, the party dropping onto
                the rail, the hand rising — as frames, with what is on
                screen at each.
     skip       the same, ended by a key a moment in: everything is on
                the table at once.
     story      a crossing staged near its end, with scenes kept across
                three rounds and an encounter won; the last Clear Path is
                taken, and the storyboard comes up after the ending. The
                recap is copied and read back off the clipboard.
     lost       the same crossing closed from the GM's drawer instead.
     reduced    a crossing started under reduced motion: no opening.

     node scripts/capture-ceremony.cjs [outDir] [options]

       --url=http://localhost:5180
       --size=1600x1000
       --biome=dungeon
       --only=opening,story  default: all
       --gpu                 draw WebGL on this machine's GPU

   Writes ceremony.log beside the pictures. Exits non-zero on a page
   error or a check that fails.

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
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'ceremony');
const url = flag('url', 'http://localhost:5180');
const [W, H] = flag('size', '1600x1000').split('x').map(Number);
const biome = flag('biome', 'dungeon');
const gpu = args.includes('--gpu');
const only = flag('only', 'opening,skip,story,lost,reduced').split(',');
fs.mkdirSync(out, { recursive: true });

const KEY = 'mazedeck.campaign.v1';
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const save = () => fs.writeFileSync(path.join(out, 'ceremony.log'), `${lines.join('\n')}\n`);
let failed = false;
const check = (ok, what) => { log(`${ok ? 'ok ' : '!! '} ${what}`); if (!ok) failed = true; };

const down = (category) => ({ category, faceUp: false });
const ev = (n, kind, text, cue) => (cue ? { n, kind, visibility: 'all', text, cue } : { n, kind, visibility: 'all', text });

(async () => {
  const browser = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : {});

  const session = async (reduced = false) => {
    const context = await browser.newContext({
      viewport: { width: W, height: H },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => { log(`pageerror: ${e.message}`); failed = true; });
    page.on('console', async (m) => {
      if (m.type() !== 'error') return;
      const parts = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')));
      let text = String(parts.shift() ?? m.text());
      while (text.includes('%s') && parts.length) text = text.replace('%s', String(parts.shift()));
      log(`console: ${text.slice(0, 200)}`);
    });
    return { context, page };
  };
  const click = async (page, loc) => { if (await loc.count()) { await loc.first().click(); return true; } return false; };
  const shot = async (page, name) => { await page.screenshot({ path: path.join(out, `${name}.png`) }); log(`shot ${name}.png`); };

  /** To the threshold of a fresh campaign, the start button under the pointer. */
  const threshold = async (page) => {
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('mazedeck.board', 'table');
      localStorage.setItem('mazedeck.world', 'high');
    });
    await page.goto(url);
    await page.waitForTimeout(600);
    await click(page, page.getByRole('button', { name: /Set up a crossing/ }));
    await page.waitForTimeout(400);
    await click(page, page.locator(`.t-door[data-biome="${biome}"]`));
    await page.waitForTimeout(300);
  };
  const board = (page) => page.evaluate(() => ({
    opening: document.querySelector('.t-table')?.hasAttribute('data-opening') ?? false,
    title: document.querySelector('.t-opening__title')?.textContent ?? '',
    riffle: document.querySelectorAll('.t-riffle__card').length,
    deals: document.querySelectorAll('.t-deal').length,
    riverShown: [...document.querySelectorAll('.md-river__slot article')].map((a) => getComputedStyle(a).opacity).join(','),
    seatsShown: [...document.querySelectorAll('.t-rail .md-seat')].map((s) => Number(getComputedStyle(s).opacity).toFixed(1)).join(','),
    handRaised: document.querySelector('.t-hand')?.hasAttribute('data-raised') ?? false,
    focus: document.activeElement?.className?.toString().slice(0, 30) ?? '',
  }));

  if (only.includes('opening')) {
    const { context, page } = await session();
    await threshold(page);
    await page.getByRole('button', { name: /Start the crossing/ }).first().click();
    const t0 = Date.now();
    for (const at of [250, 950, 1950, 2750, 3150, 3900]) {
      const wait = at - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      log(`opening +${at}ms: ${JSON.stringify(await board(page))}`);
      await shot(page, `opening-${String(at).padStart(4, '0')}ms`);
    }
    const end = await board(page);
    check(!end.opening && end.handRaised, 'the opening ends on its own and the hand rises');
    check(/md-action/.test(end.focus), 'focus is handed to the first action');
    await context.close();
  }

  if (only.includes('skip')) {
    const { context, page } = await session();
    await threshold(page);
    await page.getByRole('button', { name: /Start the crossing/ }).first().click();
    await page.waitForTimeout(700);
    const before = await board(page);
    await page.keyboard.press('Shift');
    await page.waitForTimeout(120);
    const after = await board(page);
    log(`skip: before ${JSON.stringify(before)}`);
    log(`skip: after ${JSON.stringify(after)}`);
    check(before.opening && !after.opening, 'a key ends the opening');
    check(after.riverShown.split(',').every((o) => o === '1') && after.seatsShown.split(',').every((o) => o === '1.0'), 'everything is on the table at once');
    await shot(page, 'skip-after');
    await context.close();
  }

  const stageStory = async (page) => {
    await threshold(page);
    await page.getByRole('button', { name: /Start the crossing/ }).first().click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Shift');
    await page.waitForTimeout(400);
    const c = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY));
    const run = c.run;
    const [a, b] = run.order;
    const base = run.log.length;
    // Three rounds of scenes; the Monster in round two found them, and they won.
    const add = (kind, text, cue) => { run.log.push(ev(run.log.length + 1, kind, text, cue)); return run.log.length; };
    const scenes = [];
    const scene = (round, seatId, slot, category, entryId, text) => {
      const pick = add('card', `${seatId} takes a path.`);
      scenes.push({ category, entryId, text, key: `${pick}:${slot}`, round, seatId, progress: scenes.filter((s) => s.category === 'clear-path').length });
    };
    scene(1, a, 0, 'clear-path', 'cp-1', 'The passage opens out. Somebody notices the draught is coming from ahead now, not behind.');
    scene(1, b, 2, 'obstacle', 'ob-2', 'A slab has come down across the way. It can be shifted, but not quietly.');
    scene(2, a, 1, 'clear-path', 'cp-3', 'Old bootprints in the dust, going the same way you are. They have not filled in.');
    scene(2, b, 0, 'monster', 'mo-1', 'Something heavy shifts its weight, far off, and stops when you stop.');
    add('bad', 'Something out there knows where they are. Strike 2 of 2.');
    add('bad', 'The party is found. Roll initiative — this one is yours to run.', 'found');
    add('good', 'The threat is put down, and one Monster leaves the deck for good.');
    scene(3, a, 2, 'item', 'it-4', 'Coins from a mint that closed two hundred years ago, and not one of them worn.');
    scene(3, b, 1, 'clear-path', 'cp-5', 'A shaft of daylight, thin as a blade, from somewhere far overhead.');
    scene(3, a, 0, 'clear-path', 'cp-6', 'The walls change from packed earth to dressed stone. Somebody maintained this stretch.');
    log(`story: staged ${scenes.length} scenes after log line ${base}`);
    Object.assign(run, { progress: 4, round: 4, turn: 0, phase: 'pick', pending: null, revealed: null });
    run.river = [down('clear-path'), down('item'), down('item')];
    c.chronicle = scenes;
    await page.evaluate(([k, j]) => localStorage.setItem(k, j), [KEY, JSON.stringify(c)]);
    await page.goto(url);
    await page.waitForTimeout(1500);
  };

  if (only.includes('story')) {
    const { context, page } = await session();
    await stageStory(page);
    await page.locator('.md-river__slot').nth(0).locator('article').click();
    await page.waitForSelector('.t-story', { timeout: 9000 });
    await page.waitForTimeout(500);
    const story = await page.evaluate(() => ({
      title: document.querySelector('.t-story__title')?.textContent,
      sum: document.querySelector('.t-story__sum')?.textContent,
      rounds: [...document.querySelectorAll('.t-story__roundTitle')].map((h) => h.textContent),
      scenes: document.querySelectorAll('.t-story__scene').length,
      pictures: document.querySelectorAll('.t-story__pic svg').length,
      fights: [...document.querySelectorAll('.t-story__fight')].map((f) => f.textContent),
    }));
    log(`story: ${JSON.stringify(story)}`);
    check(story.title === 'The party is through', 'the storyboard says how it ended');
    check(story.scenes === 8 && story.rounds.length === 4, 'every scene is told, in its round (the last Clear Path drawn live)');
    check(story.fights.length === 1 && /won/.test(story.fights[0]), 'the encounter is on its Monster, and won');
    await shot(page, 'story-0-top');
    await page.locator('.t-modal').evaluate((m) => { m.scrollTop = m.scrollHeight; });
    await page.waitForTimeout(400);
    await shot(page, 'story-1-scrolled');
    await click(page, page.getByRole('button', { name: 'Copy the recap' }));
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    log(`story: recap\n${text}`);
    check(text.startsWith('The Ashen Tower') && /Round 2/.test(text) && /Found — and they won/.test(text), 'the recap is copied as text');
    await context.close();
  }

  if (only.includes('lost')) {
    const { context, page } = await session();
    await stageStory(page);
    await click(page, page.getByRole('button', { name: 'GM', exact: true }));
    await page.waitForTimeout(400);
    await click(page, page.getByRole('button', { name: 'End the run' }));
    await page.waitForSelector('.t-story', { timeout: 9000 });
    await page.waitForTimeout(500);
    const title = await page.locator('.t-story__title').textContent();
    const sum = await page.locator('.t-story__sum').textContent();
    log(`lost: ${title} — ${sum}`);
    check(title === 'The run is closed', 'a closed run says so');
    await shot(page, 'lost');
    await context.close();
  }

  if (only.includes('reduced')) {
    const { context, page } = await session(true);
    await threshold(page);
    await page.getByRole('button', { name: /Start the crossing/ }).first().click();
    await page.waitForTimeout(300);
    const b = await board(page);
    log(`reduced: ${JSON.stringify(b)}`);
    check(!b.opening && b.handRaised, 'reduced motion: no opening, the hand is up');
    await context.close();
  }

  save();
  await browser.close();
  if (failed) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); save(); process.exit(1); });

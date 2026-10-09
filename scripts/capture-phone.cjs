/* ============================================================
   A hosted game from both sides: the GM's board and a player's phone
   (docs/overhaul.md, phase 8).

   Run it against scripts/local-session.mjs --app, which serves the app
   pointed at a session authority with its table in memory — never the
   live database:

     node scripts/local-session.mjs --app          (in another terminal)
     node scripts/capture-phone.cjs [outDir] [--manual] [--gpu] [--measure]

       --url=http://localhost:5182   the app local-session.mjs serves
       --manual                      the table rolls its own dice: the
                                     phone gets a die to throw
       --measure                     the phone's frame budget at 4x CPU, as
                                     measure-frames.cjs takes the board's:
                                     at rest, and its own pick (the reveal,
                                     the flight, the refill)

   A GM opens a room on the new board; a phone (390 x 844, touch, its
   vibrations recorded) joins by the code and takes a seat. The GM plays
   the other seats' turns. Along the way it checks and photographs:
   the phone at rest; a card turned (the vista, and "the GM has the
   scene"); the GM showing the table the scene, and the phone
   reading it; the phone's own turn (the hand risen, felt); its roll —
   or, with --manual, its throw, whose number the GM types in; its pick;
   and every scene shown at once once the GM sets it in the drawer.

   The phone keeps up by polling (the local authority rings no Realtime
   bell), so each check waits up to ten seconds for it.

   Writes phone.log beside the pictures. Exits non-zero if a check fails.
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
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'phone');
const url = flag('url', 'http://localhost:5182');
const manual = args.includes('--manual');
const gpu = args.includes('--gpu');
const measuring = args.includes('--measure');
const CPU = 4;
fs.mkdirSync(out, { recursive: true });

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const save = () => fs.writeFileSync(path.join(out, 'phone.log'), `${lines.join('\n')}\n`);
let failed = false;
const check = (ok, what) => { log(`${ok ? 'ok ' : '!! '} ${what}`); if (!ok) failed = true; };

(async () => {
  const browser = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : {});
  const watch = (page, who) => {
    page.on('pageerror', (e) => { log(`${who} pageerror: ${e.message}`); failed = true; });
    page.on('console', (m) => { if (m.type() === 'error') log(`${who} console: ${m.text().slice(0, 200)}`); });
  };

  const gmCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const gm = await gmCtx.newPage();
  watch(gm, 'gm');
  const phoneCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  // Every vibration the phone asks for, kept for the checks.
  await phoneCtx.addInitScript(() => {
    window.__buzz = [];
    navigator.vibrate = (p) => { window.__buzz.push(p); return true; };
  });
  const phone = await phoneCtx.newPage();
  watch(phone, 'phone');
  // How the phone keeps up: every view it asks for, and any that fail.
  const views = [];
  const t0 = Date.now();
  phone.on('request', (r) => { if (r.url().includes('/api/session/view')) views.push(Date.now() - t0); });
  phone.on('requestfailed', (r) => log(`phone request failed: ${r.url().slice(0, 80)} ${r.failure()?.errorText}`));
  const polled = () => `the phone has asked for the view ${views.length} times, last at ${((views[views.length - 1] ?? 0) / 1000).toFixed(1)}s (now ${((Date.now() - t0) / 1000).toFixed(1)}s)`;

  const click = async (page, loc) => { if (await loc.count()) { await loc.first().click(); return true; } return false; };
  const shot = async (page, name) => { await page.screenshot({ path: path.join(out, `${name}.png`) }); log(`shot ${name}.png`); };
  /** Wait for something on a page, up to `ms`; the phone polls every six seconds. */
  const until = async (page, fn, ms = 10000, arg = null) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(fn, arg)) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };

  /* ---------------- the GM opens a room ---------------- */
  await gm.goto(url);
  await gm.evaluate(() => { localStorage.clear(); localStorage.setItem('mazedeck.sound', 'off'); localStorage.setItem('mazedeck.world', 'high'); });
  await gm.goto(url);
  await gm.waitForTimeout(500);
  await click(gm, gm.getByRole('button', { name: /Set up a crossing/ }));
  await gm.waitForTimeout(400);
  if (manual) {
    await gm.getByRole('button', { name: 'Players roll their own' }).click();
    await gm.waitForTimeout(200);
  }
  await click(gm, gm.locator('.t-door[data-biome="frozen-pass"]'));
  await gm.waitForTimeout(300);
  await click(gm, gm.getByRole('button', { name: 'Host online' }));
  await gm.waitForSelector('.t-table', { timeout: 10000 });
  await gm.waitForTimeout(300);
  await gm.keyboard.press('Shift'); // past the opening
  const code = (await gm.locator('.t-top__join .t-code-inline').textContent())?.trim();
  log(`room ${code}${manual ? ', the table rolls its own dice' : ''}`);

  /* ---------------- a phone joins ---------------- */
  await phone.goto(`${url}/#/join/${code}`);
  await phone.getByRole('button', { name: 'Join', exact: true }).click();
  await phone.waitForSelector('.t-seatpick__btn', { timeout: 10000 });
  const seatName = (await phone.locator('.t-seatpick__btn .t-seatpick__name').first().textContent())?.trim();
  await phone.locator('.t-seatpick__btn').first().click();
  await phone.waitForSelector('.t-phone', { timeout: 10000 });
  await phone.waitForTimeout(1500);
  log(`the phone sits as ${seatName}`);
  await shot(phone, 'phone-0-joined');
  check(await phone.locator('.t-world, .t-vista').count() > 0, 'the phone has the place behind it: the vista, and the world where the device draws it');
  const tier = await phone.evaluate(() => document.querySelector('.t-world')?.dataset.tier ?? 'none');
  check(tier === 'low' || tier === 'still', `a phone's world starts light: ${tier}`);
  const ground = await phone.evaluate(() => getComputedStyle(document.querySelector('.t-phone .md-river')).backgroundColor);
  check(ground === 'rgba(0, 0, 0, 0)' || ground === 'transparent', `the river lies on the world, not on a slab: ${ground}`);

  /* ---------------- the phone's budget (--measure) ---------------- */
  // As measure-frames.cjs measures the board: main-thread time from the
  // DevTools protocol, frames from requestAnimationFrame.
  const budget = [];
  const measure = async (label, ms, during) => {
    const cdp = await phone.context().newCDPSession(phone);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Performance.enable');
    const before = await cdp.send('Performance.getMetrics');
    const frames = phone.evaluate((total) => new Promise((resolve) => {
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
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const get = (m, k) => m.metrics.find((x) => x.name === k)?.value ?? 0;
    const d = (k) => get(after, k) - get(before, k);
    const tierNow = await phone.evaluate(() => document.querySelector('.t-world')?.dataset.tier ?? 'none');
    budget.push(`| ${label} (world ${tierNow}) | ${d('TaskDuration').toFixed(2)} s | ${d('RecalcStyleDuration').toFixed(2)} s | ${d('LayoutDuration').toFixed(2)} s | ${(f.count / (ms / 1000)).toFixed(0)} | ${f.worst.toFixed(0)} ms | ${f.long} |`);
  };
  if (measuring) await measure('The phone, at rest', 4000);

  /* ---------------- the GM plays the other seats ---------------- */
  const gmState = () => gm.evaluate(() => ({
    focus: document.querySelector('.t-table')?.dataset.focus ?? '-',
    entry: Boolean(document.querySelector('.t-rollstage input.t-input')),
    land: [...document.querySelectorAll('button')].some((b) => /Let it land/.test(b.textContent)),
    ask: document.querySelector('.t-ask[data-shown] .t-ask__title')?.textContent ?? '',
    found: Boolean(document.querySelector('.t-found')),
    active: document.querySelector('.t-rail .md-seat[data-active="true"] .md-seat__name')?.textContent ?? '',
    over: document.querySelector('.t-table')?.dataset.outcome ?? '',
    share: document.querySelector('.t-share')?.getAttribute('aria-pressed') ?? null,
    caption: document.querySelector('.t-stage > .t-scene .t-scene__text')?.textContent ?? '',
  }));
  /** One step of somebody else's turn, as a quick GM plays it. */
  const gmStep = async (s) => {
    if (s.found) await click(gm, gm.getByRole('button', { name: 'They won' }));
    else if (s.entry) {
      await gm.locator('.t-rollstage input.t-input').first().fill('11');
      const second = gm.locator('.t-rollstage input.t-input').nth(1);
      if (await second.count()) await second.fill('9');
      await click(gm, gm.getByRole('button', { name: 'Take the roll' }));
    } else if (s.land) await click(gm, gm.getByRole('button', { name: 'Let it land' }));
    else if (s.ask) {
      if (!(await click(gm, gm.getByRole('button', { name: 'They move on' })))
        && !(await click(gm, gm.locator('[data-choice]')))) {
        await click(gm, gm.locator('.t-rail[data-choosing] .md-seat[role="button"]'));
      }
    } else if (s.focus === 'actions') await click(gm, gm.locator('.t-hand .md-action'));
    else if (s.focus === 'river') await click(gm, gm.locator('.md-river__slot article.md-card--back, .md-river__slot article[data-interactive]'));
    await gm.waitForTimeout(1200);
  };
  const phoneScene = () => phone.evaluate(() => ({
    text: document.querySelector('.t-phone__text:not(.t-phone__text--waiting)')?.textContent ?? '',
    waiting: Boolean(document.querySelector('.t-phone__text--waiting')),
    kicker: document.querySelector('.t-phone__scene .t-kicker')?.textContent ?? '',
  }));

  /** Press a GM control once the board has drawn it (it presents a beat late). */
  const gmPress = async (name, ms = 12000) => {
    const ok = await until(gm, (n) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === n && !b.disabled), ms, name);
    if (ok) await gm.getByRole('button', { name, exact: true }).first().click();
    return ok;
  };

  // In this order: the GM shows a scene by hand; the phone takes its own
  // turn; then, with every scene shown as it is drawn, a new one arrives
  // with no press. The phone's seat may come up before any card has
  // turned, so each waits for its moment.
  let shared = false;
  let ownTurn = false;
  let auto = false;
  let autoChecked = false;
  let sharedCaption = '';
  for (let step = 0; step < 120 && !autoChecked; step += 1) {
    const s = await gmState();
    if (s.over) { log('the crossing ended before every check'); break; }

    // A card has turned and its scene is on the GM's caption: show the table.
    if (!shared && s.share === 'false' && s.caption) {
      check(await until(phone, () => Boolean(document.querySelector('.t-phone__text--waiting'))),
        'before it is shown, the phone knows a card turned, and that the GM has its scene');
      log(polled());
      await shot(phone, 'phone-1-card-turned');
      await gmPress('Show the table');
      const ok = await until(phone, (c) => document.querySelector('.t-phone__text:not(.t-phone__text--waiting)')?.textContent === c, 10000, s.caption);
      const p = await phoneScene();
      check(ok, `the GM shows it, and the phone reads the same line: "${p.text.slice(0, 60)}"`);
      // The phone's poll can land between the write and the GM's own render.
      check(await until(gm, () => document.querySelector('.t-share')?.getAttribute('aria-pressed') === 'true', 3000),
        'the GM\'s caption says it is shown');
      await shot(phone, 'phone-2-scene-shown');
      await shot(gm, 'gm-scene-shown');
      shared = true;
      sharedCaption = s.caption;
      continue;
    }

    // From here on, every scene is shown as it is drawn.
    if (shared && ownTurn && !auto) {
      await click(gm, gm.getByRole('button', { name: 'GM', exact: true }));
      await gm.waitForTimeout(400);
      await click(gm, gm.getByRole('button', { name: 'Scenes shown one at a time' }));
      check(await gm.getByRole('button', { name: 'Every scene shown to the table' }).count() > 0, 'the GM sets every scene to be shown as it is drawn');
      await gm.keyboard.press('Escape');
      await gm.waitForTimeout(400);
      auto = true;
      sharedCaption = (await gmState()).caption || sharedCaption;
      continue;
    }

    // A new scene, with nobody pressing anything.
    if (auto && s.caption && s.caption !== sharedCaption) {
      const shownOnBoard = await until(gm, () => document.querySelector('.t-share')?.getAttribute('aria-pressed') === 'true', 6000);
      check(shownOnBoard, 'the GM\'s board shows the new scene as already shown');
      const ok = await until(phone, (c) => document.querySelector('.t-phone__text:not(.t-phone__text--waiting)')?.textContent === c, 12000, s.caption);
      const p = await phoneScene();
      check(ok, `shown automatically: the phone reads "${p.text.slice(0, 60)}"`);
      await shot(phone, 'phone-6-auto-shown');
      autoChecked = true;
      break;
    }

    // The phone's own turn: everything on it is the phone's to do.
    if (!ownTurn && s.active === seatName && s.focus === 'actions') {
      const risen = await until(phone, () => Boolean(document.querySelector('.t-phone__hand[data-raised]')), 12000);
      check(risen, 'on its own turn the phone\'s hand rises');
      await phone.waitForTimeout(500);
      const buzzes = await phone.evaluate(() => window.__buzz);
      const turns = buzzes.filter((p) => Array.isArray(p) && p.join() === '40,60,40').length;
      check(turns === 1, `and the turn is felt, once (vibrations so far: ${JSON.stringify(buzzes)})`);
      await shot(phone, 'phone-3-hand');
      await phone.locator('.t-phone__hand .md-action').first().tap();

      if (manual) {
        const die = await until(phone, () => Boolean(document.querySelector('.t-phone__hand[data-raised] .t-throw__die')), 12000);
        check(die, 'the table rolls its own dice: the die to throw rises where the hand was');
        await phone.waitForTimeout(500);
        await shot(phone, 'phone-4a-die');
        await phone.locator('.t-throw__die').tap({ force: true }); // it sways while it waits
        await phone.waitForTimeout(1600);
        const kept = Number(await phone.locator('.t-throw__tell strong').textContent());
        check(kept >= 1 && kept <= 20, `thrown: "tell the GM ${kept}"`);
        const landed = await phone.evaluate(() => window.__buzz.some((p) => p === 30));
        check(landed, 'the die is felt as it lands');
        await shot(phone, 'phone-4b-thrown');
        await until(gm, () => Boolean(document.querySelector('.t-rollstage input.t-input')), 12000);
        await gm.locator('.t-rollstage input.t-input').first().fill(String(kept));
        const second = gm.locator('.t-rollstage input.t-input').nth(1);
        if (await second.count()) await second.fill(String(kept));
        await gmPress('Take the roll');
        // The throw gives way to the room's roll: the number the GM typed.
        const typed = await until(phone, () => !document.querySelector('.t-phone__mine .t-throw')
          && Boolean(document.querySelector('.t-phone__mine .t-die')), 12000);
        await phone.waitForTimeout(1600);
        const faces = await phone.locator('.t-phone__mine .t-die__face').allTextContents();
        check(typed && faces.includes(String(kept)), `the GM types it in, and the phone shows the roll the room acts on (${faces.join(', ')})`);
      } else {
        const rolled = await until(phone, () => Boolean(document.querySelector('.t-phone__hand[data-raised] .t-phone__mine .t-die')), 12000);
        check(rolled, 'its roll rises where the hand was');
        await phone.waitForTimeout(1600);
      }
      const mineStatus = await phone.locator('.t-phone__status').textContent();
      check(/^Your roll/.test(mineStatus ?? ''), `the phone says whose roll it is: "${mineStatus}"`);
      await shot(phone, 'phone-4-roll');
      check(await gmPress('Let it land'), 'the GM lets it land');

      // Answer any decision the action opened, from the phone; then the
      // pick is the phone's.
      let pickable = false;
      for (let k = 0; k < 8 && !pickable; k += 1) {
        pickable = await phone.evaluate(() => Boolean(document.querySelector('.t-phone__prompt')));
        if (!pickable && await phone.locator('.t-modal').count()) {
          log('the phone answers a decision');
          await click(phone, phone.locator('.t-modal button:not([disabled])'));
        }
        if (!pickable) await phone.waitForTimeout(1500);
      }
      check(pickable, 'then the phone is asked to commit to a path');
      const pickStatus = await phone.locator('.t-phone__status').textContent();
      log(`the phone's status: "${pickStatus}"`);
      await shot(phone, 'phone-5-pick');
      // What the GM's table shows: the river's faces, the deck, the discard's
      // top. A pick changes at least one, whatever the card turns out to be
      // (a Wanderer keeps the GM's call in the river, so the light is no test).
      const table = () => gm.evaluate(() => [
        [...document.querySelectorAll('.t-table .md-river__slot article')]
          .map((a) => (a.classList.contains('md-card--back') ? 'back' : a.dataset.category)).join('/'),
        document.querySelector('.t-top__meta')?.textContent ?? '',
        document.querySelector('.t-surface__pile--discard article')?.dataset.category ?? '-',
      ].join(' | '));
      const before = await table();
      const phoneScenes = await gm.evaluate((name) => {
        const c = JSON.parse(localStorage.getItem('mazedeck.campaign.v1') || '{}');
        const id = (c.roster || []).find((ch) => (ch.name.trim() || 'Unnamed') === name)?.id;
        return (c.chronicle || []).filter((e) => e.seatId === id).length;
      }, seatName);
      // A face-down card: a blocker left face up from an earlier turn is not a path to take.
      const pick = () => phone.locator('.t-river[data-pickable] .md-river__slot article.md-card--back').first().tap();
      if (measuring) await measure('The phone, its own pick', 5000, pick);
      else await pick();
      let turned = false;
      for (let t = 0; t < 48 && !turned; t += 1) {
        turned = (await table()) !== before;
        if (!turned) await gm.waitForTimeout(250);
      }
      log(`the GM's table before the pick: ${before}`);
      log(`and after: ${await table()}`);
      check(turned, 'the phone\'s pick turns the card on the GM\'s board');
      // And the GM has its scene, credited to the phone's seat, though the
      // GM's client polls and the reveal is held for under two seconds.
      const credited = await until(gm, ([name, had]) => {
        const c = JSON.parse(localStorage.getItem('mazedeck.campaign.v1') || '{}');
        const id = (c.roster || []).find((ch) => (ch.name.trim() || 'Unnamed') === name)?.id;
        return (c.chronicle || []).filter((e) => e.seatId === id).length > had;
      }, 12000, [seatName, phoneScenes]);
      const lastScene = await gm.evaluate(() => {
        const c = JSON.parse(localStorage.getItem('mazedeck.campaign.v1') || '{}');
        const e = (c.chronicle || []).slice(-1)[0];
        return e ? `${e.key}, round ${e.round}, ${e.category}` : 'none';
      });
      check(credited, `the GM's chronicle has a scene for the phone's pick, credited to it (latest: ${lastScene})`);
      await phone.waitForTimeout(1500);
      await shot(phone, 'phone-5-picked');
      ownTurn = true;
      continue;
    }

    await gmStep(s);
  }
  check(shared && ownTurn && autoChecked, 'every check was reached');

  if (budget.length) {
    log(`
The phone's budget: 390 × 844 at 2x, ${CPU}× CPU, ${gpu ? 'real GPU' : 'software GL'}
`);
    log('| | Main-thread task | Style | Layout | fps | Worst frame | Frames > 33 ms |');
    log('|---|---|---|---|---|---|---|');
    budget.forEach((row) => log(row));
  }

  save();
  await browser.close();
  if (failed) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); save(); process.exit(1); });


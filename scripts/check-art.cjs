/* ============================================================
   Judge a setting's art by numbers (docs/art-jobs.md, "How a job is
   judged").

   - The luminance budget. Parchment notes need 4.5:1 against the world
     behind them, so behind the caption band, the hand and the rail the
     world stays at or under 0.023 relative luminance (0.074 behind the
     captions of the top bar and the ticker). Everything but the world
     is hidden, the screen is photographed, and the picture is read in
     blocks of 12 px: a block's median must be within the budget. A
     block, not a pixel, so a mote of dust drifting past is not a
     failure and a dither of two colours either side of the line is.
   - The colour reservation. The share of a back's and a world frame's
     pixels near each category hue that is not the setting's own light;
     over 5% fails, or the background starts saying what a card means.
   - The thumbnail sheet. Every back at the river's size on a laptop and
     at the threshold's door size, side by side, for the eye.

     node scripts/check-art.cjs [outDir] [options]

       --url=http://localhost:5180
       --biome=dungeon
       --side=inside         which side of it, where it has two (its default otherwise)
       --sizes=1600x1000,1366x768,1920x1080,768x1024,390x844
       --threat=0            strikes on the board (1: the dark drawn in)
       --gpu                 draw WebGL on this machine's GPU

   Writes check.log and the pictures beside it. Exits non-zero if a
   budget or a reservation fails.

   Needs the dev server (`cd apps/table && npm run dev`) and the
   Chromium in .ds-sync.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { createRequire } = require('module');

const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'check-art');
const url = flag('url', 'http://localhost:5180');
const biome = flag('biome', 'dungeon');
const sideFlag = flag('side', '');
const sizes = flag('sizes', '1600x1000,1366x768,1920x1080,768x1024,390x844').split(',').map((s) => s.split('x').map(Number));
const threat = Number(flag('threat', '0'));
const gpu = args.includes('--gpu');
fs.mkdirSync(out, { recursive: true });

const KEY = 'mazedeck.campaign.v1';
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const save = () => fs.writeFileSync(path.join(out, 'check.log'), `${lines.join('\n')}\n`);

/** Where the board puts words, and how bright the world may be behind them. */
const REGIONS = [
  { name: 'caption', sel: '.t-scene', budget: 0.023 },
  { name: 'hand', sel: '.t-hand', budget: 0.023 },
  { name: 'rail', sel: '.t-rail', budget: 0.023 },
  { name: 'top', sel: '.t-top', budget: 0.074 },
  { name: 'ticker', sel: '.t-ticker', budget: 0.074 },
];

/** Each setting's own light, which it may use freely (docs/art-jobs.md). */
const OWN = {
  dungeon: 'path', tower: 'path', desert: 'path', 'deep-forest': 'obst', undercity: 'obst', 'frozen-pass': 'wand',
  'kings-road': 'path', mire: 'obst', 'high-road': 'wand', 'drowned-coast': 'path', 'barrow-moor': 'wand',
  'ember-hold': 'path', 'sunken-jungle': 'path', underdark: 'wand',
};
const ownOf = (b) => OWN[b] ?? 'path';
const FAMILIES = { path: '#E3A445', obst: '#43917B', wand: '#6B8CA6', item: '#8B4F9C', mons: '#A93343' };

/* ---------- reading a PNG: what Chromium writes, 8-bit RGB(A), not interlaced ---------- */
function decodePng(buf) {
  let p = 8;
  let w = 0; let h = 0; let type = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const kind = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG: 8-bit, not interlaced, only');
      type = data[9];
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`PNG: colour type ${type}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c; const pa = Math.abs(q - a); const pb = Math.abs(q - b); const pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i += 1) for (let k = 0; k < 3; k += 1) rgb[i * 3 + k] = px[i * bpp + k];
  return { w, h, rgb };
}

const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));
const lum = (r, g, b) => 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];

/** The brightest 12 px block median inside a rectangle, and the brightest pixel. */
function budget(img, rect, block = 12) {
  let worst = 0; let blocks = 0; let over = 0; let peak = 0;
  const x0 = Math.max(0, Math.round(rect.x)); const y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(img.w, Math.round(rect.x + rect.width)); const y1 = Math.min(img.h, Math.round(rect.y + rect.height));
  for (let by = y0; by + block <= y1; by += block) {
    for (let bx = x0; bx + block <= x1; bx += block) {
      const ls = [];
      for (let y = by; y < by + block; y += 1) {
        for (let x = bx; x < bx + block; x += 1) {
          const i = (y * img.w + x) * 3;
          const l = lum(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]);
          ls.push(l);
          if (l > peak) peak = l;
        }
      }
      ls.sort((a, b) => a - b);
      const m = ls[ls.length >> 1];
      blocks += 1;
      if (m > worst) worst = m;
      if (m > rect.budget) over += 1;
    }
  }
  return { worst, blocks, over, peak };
}

function hsv(r, g, b) {
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
}
const HUES = Object.fromEntries(Object.entries(FAMILIES).map(([k, hex]) => {
  const n = parseInt(hex.slice(1), 16);
  return [k, hsv(n >> 16, (n >> 8) & 255, n & 255).h];
}));

/** The share of a picture's pixels near each family's hue: saturated enough to read as that colour. */
function reservation(img, rect) {
  const share = Object.fromEntries(Object.keys(FAMILIES).map((k) => [k, 0]));
  let n = 0;
  const x0 = Math.round(rect?.x ?? 0); const y0 = Math.round(rect?.y ?? 0);
  const x1 = Math.round(rect ? rect.x + rect.width : img.w); const y1 = Math.round(rect ? rect.y + rect.height : img.h);
  for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(img.w, x1); x += 1) {
      const i = (y * img.w + x) * 3;
      const c = hsv(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]);
      n += 1;
      if (c.s < 0.3 || c.v < 0.18) continue;
      for (const [k, h] of Object.entries(HUES)) {
        const d = Math.min(Math.abs(c.h - h), 360 - Math.abs(c.h - h));
        if (d <= 15) { share[k] += 1; break; }
      }
    }
  }
  for (const k of Object.keys(share)) share[k] /= Math.max(1, n);
  return share;
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;
let failed = false;
const judge = (what, share) => {
  const others = Object.entries(share).filter(([k]) => k !== ownOf(biome));
  const bad = others.filter(([, v]) => v > 0.05);
  log(`  ${what}: ${Object.entries(share).map(([k, v]) => `${k} ${pct(v)}${k === ownOf(biome) ? ' (own)' : ''}`).join(', ')}${bad.length ? '  !! over 5%' : ''}`);
  if (bad.length) failed = true;
};

(async () => {
  const browser = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : {});

  /* ---------- the backs: reservation, and the thumbnail sheet ----------
     Every side's back, baked by bake-backs.mjs (settings-build.md, S5),
     at the river's size on a laptop and at the threshold's door size. */
  const art = path.join(__dirname, '..', 'apps', 'table', 'src', 'biomes', 'art');
  const uri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(art, f)).toString('base64')}`;
  const backs = fs.readdirSync(art).filter((f) => /^back-.+-(inside|outside)\.png$/.test(f)).sort();
  const sideOf = (f) => f.replace(/\.png$/, '').split('-').pop();
  const settingOf = (f) => f.replace(/^back-/, '').replace(/-(inside|outside)\.png$/, '');
  const mine = backs.filter((f) => settingOf(f) === biome);
  const side = sideFlag && mine.some((f) => sideOf(f) === sideFlag) ? sideFlag
    : mine.some((f) => sideOf(f) === 'outside') ? 'outside' : 'inside';
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 640 } });
  await sheet.setContent(`<body style="margin:0;background:#0C1012;display:flex;flex-wrap:wrap;gap:18px;padding:16px;align-items:flex-end">${backs.map((f) => `
    <figure style="margin:0;display:flex;gap:8px;align-items:flex-end;${settingOf(f) === biome && sideOf(f) === side ? 'outline:1px solid #E3A445;outline-offset:4px' : ''}">
      <img src="${uri(f)}" style="width:96px;height:134px;image-rendering:pixelated">
      <img src="${uri(f)}" style="width:48px;height:67px;image-rendering:pixelated">
    </figure>`).join('')}</body>`);
  await sheet.waitForTimeout(400);
  await sheet.screenshot({ path: path.join(out, 'backs-thumbnails.png') });
  await sheet.setViewportSize({ width: 240, height: 335 });
  await sheet.setContent(`<body style="margin:0"><img src="${uri(`back-${biome}-${side}.png`)}" style="width:240px;height:335px;display:block;image-rendering:pixelated"></body>`);
  await sheet.waitForTimeout(300);
  const back = decodePng(await sheet.screenshot());
  log(`${biome} (${side}): colour reservation`);
  judge('back', reservation(back));
  await sheet.close();

  /* ---------- the world, at each size ---------- */
  for (const [W, H] of sizes) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => { log(`pageerror: ${e.message}`); failed = true; });
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('mazedeck.sound', 'off');
      localStorage.setItem('mazedeck.world', 'high');
    });
    await page.goto(url);
    await page.waitForTimeout(600);
    const click = async (l) => { if (await l.count()) await l.first().click(); };
    await click(page.getByRole('button', { name: /Set up a crossing/ }));
    await page.waitForTimeout(500);
    await click(page.locator(`.t-door[data-biome="${biome}"]`));
    await page.waitForTimeout(300);
    await click(page.getByRole('radio', { name: side === 'inside' ? 'Inside' : 'Outside' }));
    await click(page.getByRole('button', { name: /Start the crossing/ }));
    await page.waitForTimeout(800);
    if (threat) {
      const c = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), KEY));
      c.run.strikes = Math.min(threat, c.run.config.encounterAt - 1);
      await page.evaluate(([key, json]) => localStorage.setItem(key, json), [KEY, JSON.stringify(c)]);
      await page.goto(url);
    }
    await page.waitForTimeout(2500);
    const tier = await page.evaluate(() => {
      const w = document.querySelector('.t-world');
      return w ? `${w.dataset.tier}${w.hasAttribute('data-live') ? '' : ', not drawn'} ${w.dataset.design ?? ''}`.trim() : 'none';
    });
    const rects = await page.evaluate((regions) => regions.map((r) => {
      const e = document.querySelector(r.sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return b.width && b.height ? { ...r, x: b.left, y: b.top, width: b.width, height: b.height } : null;
    }).filter(Boolean), REGIONS);
    await page.screenshot({ path: path.join(out, `${biome}-${side}-${W}x${H}-board.png`) });
    // Nothing but the world.
    await page.addStyleTag({ content: 'body * { visibility: hidden !important; } .t-world { visibility: visible !important; }' });
    await page.waitForTimeout(400);
    const file = path.join(out, `${biome}-${side}-${W}x${H}-world.png`);
    const img = decodePng(await page.screenshot({ path: file }));
    log(`${biome} ${W}x${H} (world ${tier}${threat ? `, ${threat} strike` : ''}): luminance behind the words`);
    for (const r of rects) {
      const b = budget(img, r);
      const bad = b.over > 0;
      if (bad) failed = true;
      log(`  ${r.name.padEnd(8)} at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}  worst block ${b.worst.toFixed(4)} / ${r.budget}  (${b.over} of ${b.blocks} over; brightest pixel ${b.peak.toFixed(3)})${bad ? '  !! over' : ''}`);
    }
    judge('world', reservation(img));
    await page.close();
  }

  save();
  await browser.close();
  if (failed) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); save(); process.exit(1); });

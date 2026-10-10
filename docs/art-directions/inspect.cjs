/* Draw one setting's designs large, for judging pixels.
     node inspect.cjs <setting> [t]
   Writes shots/<setting>/<key>-big-back.png (×4), -big-vista-<cat>.png (×4),
   -big-world.png (×3) and -big-vista-wide.png (the board's vista, ×3).
   `t` is the moment for the animated parts (default 1.3 s). */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const requireSync = createRequire('C:/Coding/Maze-Deck/.ds-sync/package.json');
const { chromium } = requireSync('playwright');

const setting = process.argv[2] || 'dungeon';
const t = Number(process.argv[3] || 1.3);
const dir = __dirname;
const out = path.join(dir, 'shots', setting);
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setContent('<body style="margin:0;background:#000"></body>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(dir, 'px.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(dir, 'scenes', `${setting}.js`), 'utf8') });
  const shots = await page.evaluate(([setting, t]) => {
    const res = [];
    const render = (made, k) => {
      const { p } = made;
      const c = document.createElement('canvas'); c.width = p.w; c.height = p.h;
      const ctx = c.getContext('2d'); const img = ctx.createImageData(p.w, p.h);
      p.resolve(t, img); if (made.over) made.over(img, t); ctx.putImageData(img, 0, 0);
      const big = document.createElement('canvas'); big.width = p.w * k; big.height = p.h * k;
      const b = big.getContext('2d'); b.imageSmoothingEnabled = false; b.drawImage(c, 0, 0, big.width, big.height);
      return big.toDataURL('image/png');
    };
    const time = (fn) => { const t0 = performance.now(); const r = fn(); return [r, performance.now() - t0]; };
    for (const d of window.DESIGNS.filter((x) => x.setting === setting)) {
      const [back, tb] = time(() => d.back(96, 134));
      res.push([`${d.key}-big-back`, render(back, 4), tb]);
      for (const [cat] of PX.CATEGORIES) {
        const [v, tv] = time(() => d.vista(192, 72, cat));
        res.push([`${d.key}-big-vista-${cat}`, render(v, 4), tv]);
      }
      const [wide, tw] = time(() => d.vista(312, 62, 'monster'));
      res.push([`${d.key}-big-vista-wide`, render(wide, 3), tw]);
      const [world, tw2] = time(() => d.world(320, 200));
      res.push([`${d.key}-big-world`, render(world, 3), tw2]);
      // The luminance budget: behind the caption, the river and the hand, the
      // brightest 3 x 3 block's median must stay at or under 0.023.
      const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const img = c.getContext('2d').createImageData(320, 200);
      for (const tt of [0.3, 1.3, 2.7, 4.1]) {
        world.p.resolve(tt, img); if (world.over) world.over(img, tt);
        const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = (x, y) => { const o = (y * 320 + x) * 4; return 0.2126 * lin(img.data[o]) + 0.7152 * lin(img.data[o + 1]) + 0.0722 * lin(img.data[o + 2]); };
        const regions = { caption: [0.1, 0.31, 0.9, 0.39], river: [0.08, 0.42, 0.92, 0.8], hand: [0.3, 0.85, 0.7, 1] };
        const out = {};
        for (const [name, [x0, y0, x1, y1]] of Object.entries(regions)) {
          let worst = 0;
          for (let by = Math.round(y0 * 200); by + 3 <= Math.round(y1 * 200); by += 3) {
            for (let bx = Math.round(x0 * 320); bx + 3 <= Math.round(x1 * 320); bx += 3) {
              const ls = []; for (let j = 0; j < 3; j += 1) for (let k = 0; k < 3; k += 1) ls.push(L(bx + k, by + j));
              ls.sort((a, b) => a - b); worst = Math.max(worst, ls[4]);
            }
          }
          out[name] = worst;
        }
        res.push([`${d.key}-budget@${tt}`, null, 0, out]);
      }
    }
    return res;
  }, [setting, t]);
  for (const [name, url, ms, budget] of shots) {
    if (budget) {
      const bad = Object.values(budget).some((v) => v > 0.023);
      console.log(`${name}: ${Object.entries(budget).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(', ')}  (budget 0.023)${bad ? '  !! OVER' : ''}`);
      continue;
    }
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`${name}.png  built in ${ms.toFixed(1)} ms`);
  }
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();

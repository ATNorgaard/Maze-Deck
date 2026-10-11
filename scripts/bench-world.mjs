/* What a world frame costs on the CPU: the fast redraw plus the design's
   sprites and particles, at 320 x 200 (and a portrait size), every side. */
import { loadPaint } from './lib/paint.mjs';

const P = await loadPaint();
const sizes = (process.argv[2] ?? '320x200').split(',').map((s) => s.split('x').map(Number));
const FRAMES = 30;
for (const [W, H] of sizes) {
  const rows = [];
  for (const id of P.SETTING_IDS) {
    for (const side of P.SIDES[id]) {
      const d = await P.designFor(id, side);
      const t0 = performance.now();
      const made = d.world(W, H);
      made.p.prepare();
      const build = performance.now() - t0;
      const img = P.imageOf(W, H);
      const time = (f) => { f(0.1); const s = performance.now(); for (let i = 1; i <= FRAMES; i += 1) f(i / 10); return (performance.now() - s) / FRAMES; };
      const res = time((t) => made.p.resolve(t, img));
      const over = time((t) => made.over?.(img, t));
      rows.push([d.id, made.p.fields.length, made.p.tints.length, build, res, over, made.p._dyn.length / (W * H)]);
    }
  }
  console.log(`\n${W} x ${H}\ndesign            lights tints   build  resolve    over   lit`);
  for (const [id, n, nt, b, r, o, s] of rows) {
    console.log(`${id.padEnd(18)}${String(n).padStart(5)}${String(nt).padStart(6)}${b.toFixed(0).padStart(7)}ms${r.toFixed(2).padStart(7)}ms${o.toFixed(2).padStart(7)}ms${(s * 100).toFixed(0).padStart(5)}%`);
  }
  const worst = rows.reduce((a, r) => (r[4] + r[5] > a[4] + a[5] ? r : a));
  console.log(`worst frame: ${worst[0]} ${(worst[4] + worst[5]).toFixed(2)}ms; worst build ${Math.max(...rows.map((r) => r[3])).toFixed(0)}ms`);
}

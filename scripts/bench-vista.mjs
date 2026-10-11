/* What a vista frame costs: the fast redraw against working out every pixel,
   for every played side, at the board's size (72 design pixels high). */
import { loadPaint } from './lib/paint.mjs';

const P = await loadPaint();
const W = Number(process.argv[2] ?? 192), H = 72, FRAMES = 40;
const rows = [];
for (const id of P.SETTING_IDS) {
  for (const side of P.SIDES[id]) {
    const d = await P.designFor(id, side);
    const t0 = performance.now();
    const made = P.vistaOf(d, W, H, 'monster');
    const build = performance.now() - t0;
    const img = P.imageOf(W, H);
    const time = (f) => { f(0); const s = performance.now(); for (let i = 1; i <= FRAMES; i += 1) f(i / 8); return (performance.now() - s) / FRAMES; };
    const ref = time((t) => made.p.resolveReference(t, img));
    const fast = time((t) => { made.p.resolve(t, img); made.over?.(img, t); });
    rows.push([d.id, made.p.fields.length, build, ref, fast, made.p._dyn.length / (W * H)]);
  }
}
console.log('design            lights  build   every px  fast+over  lit share');
for (const [id, n, b, r, f, s] of rows) {
  console.log(`${id.padEnd(18)}${String(n).padStart(6)}${b.toFixed(1).padStart(7)}ms${r.toFixed(2).padStart(9)}ms${f.toFixed(2).padStart(10)}ms${(s * 100).toFixed(0).padStart(9)}%`);
}
const worst = rows.reduce((a, r) => (r[4] > a[4] ? r : a));
console.log(`worst frame: ${worst[0]} ${worst[4].toFixed(2)}ms`);

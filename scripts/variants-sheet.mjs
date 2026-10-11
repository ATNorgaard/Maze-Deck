/* Seeded variations, side by side: each row a design's card as approved,
   then as five narration lines draw it (vistaOf with a seed). Writes a
   PNG, scaled up 3x with no smoothing, to look at.

     node scripts/variants-sheet.mjs [out.png] [setting:side:card ...]
*/
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { loadPaint, root } from './lib/paint.mjs';

const P = await loadPaint();
const args = process.argv.slice(2);
const out = args.find((a) => a.endsWith('.png')) ?? path.join(root, 'proof', 'variants.png');
const rows = args.filter((a) => !a.endsWith('.png')).map((a) => a.split(':'));
if (!rows.length) {
  rows.push(['dungeon', 'inside', 'monster'], ['desert', 'inside', 'obstacle'], ['deep-forest', 'outside', 'clear-path'],
    ['underdark', 'inside', 'item'], ['kings-road', 'outside', 'wanderer'], ['ember-hold', 'inside', 'monster']);
}
const W = 192; const H = 72; const GAP = 4; const COLS = 6; const K = 3;
const SW = (COLS * (W + GAP) + GAP); const SH = rows.length * (H + GAP) + GAP;
const sheet = new Uint8Array(SW * SH * 3).fill(12);

for (let r = 0; r < rows.length; r += 1) {
  const [setting, side, card] = rows[r];
  const d = await P.designFor(setting, side);
  for (let c = 0; c < COLS; c += 1) {
    const made = P.vistaOf(d, W, H, card, c === 0 ? null : `${setting}:line-${c}`);
    const img = P.imageOf(W, H);
    made.p.resolve(1.3, img);
    made.over?.(img, 1.3);
    const ox = GAP + c * (W + GAP); const oy = GAP + r * (H + GAP);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 4; const o = ((oy + y) * SW + ox + x) * 3;
        sheet[o] = img.data[i]; sheet[o + 1] = img.data[i + 1]; sheet[o + 2] = img.data[i + 2];
      }
    }
  }
}

// Scaled up K times, nearest neighbour, as an RGB PNG.
const w = SW * K; const h = SH * K;
const raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y += 1) {
  raw[y * (w * 3 + 1)] = 0;
  for (let x = 0; x < w; x += 1) {
    const s = (Math.floor(y / K) * SW + Math.floor(x / K)) * 3; const o = y * (w * 3 + 1) + 1 + x * 3;
    raw[o] = sheet[s]; raw[o + 1] = sheet[s + 1]; raw[o + 2] = sheet[s + 2];
  }
}
const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${out}: ${rows.length} rows, as approved then 5 lines`);

/* ============================================================
   Bake every setting's card back and its world's still frame.

   The designs (packages/art/src/paint) are the source; a card back
   never moves on its own (AJ5), so it is baked once rather than
   painted in every browser. For each setting and each side it has:

     back-<setting>-<side>.png    96 x 134, the deck's back for that side
     world-<setting>-<side>.png   320 x 200, the world as one still frame:
                                  what the table shows with the world off

   into apps/table/src/biomes/art/. Plain RGBA PNGs; Node's zlib packs
   them. Same designs, same bytes.

     node scripts/bake-backs.mjs [setting,…]
   ============================================================ */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { loadPaint, root } from './lib/paint.mjs';

const out = path.join(root, 'apps', 'table', 'src', 'biomes', 'art');
fs.mkdirSync(out, { recursive: true });

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
/** An opaque picture as an RGB PNG. */
function png(img) {
  const { width: w, height: h, data } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const s = (y * w + x) * 4; const t = y * (w * 3 + 1) + 1 + x * 3;
      raw[t] = data[s]; raw[t + 1] = data[s + 1]; raw[t + 2] = data[s + 2];
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const P = await loadPaint();
const only = process.argv[2] ? process.argv[2].split(',') : null;
const draw = (made, t) => {
  const img = P.imageOf(made.p.w, made.p.h);
  made.p.resolve(t, img);
  made.over?.(img, t);
  return img;
};

for (const setting of P.SETTING_IDS) {
  if (only && !only.includes(setting)) continue;
  for (const side of P.SIDES[setting]) {
    const d = await P.designFor(setting, side);
    const files = [
      [`back-${setting}-${side}.png`, draw(d.back(96, 134), 0)],
      [`world-${setting}-${side}.png`, draw(d.world(320, 200), 1.3)],
    ];
    for (const [name, img] of files) {
      const bytes = png(img);
      fs.writeFileSync(path.join(out, name), bytes);
      console.log(`${name.padEnd(36)} ${(bytes.length / 1024).toFixed(1)} KB`);
    }
  }
}

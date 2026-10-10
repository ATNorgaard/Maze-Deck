/* ============================================================
   A tiny PNG encoder, for the pixel style (docs/art-jobs.md, Job 0).

   A pixel picture is a grid of palette indices, and a PNG with a
   palette is the smallest honest file for one: a card back at
   96 × 134 is ~13 KB of indices, where an SVG with a rect per run of
   pixels runs to hundreds. Indexed colour, 8 bits, one transparent
   entry at most, and the image data in stored (uncompressed) deflate
   blocks, so no compressor is needed. Pure: no DOM, no Node, the same
   bytes everywhere for the same picture.
   ============================================================ */

/** A picture as palette indices, row by row, top to bottom. */
export interface IndexedImage {
  w: number;
  h: number;
  /** One palette index per pixel, w × h. */
  data: Uint8Array;
  /** `#rrggbb`, at most 256. */
  palette: readonly string[];
  /** The index that is see-through, if any. */
  transparent?: number;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream of stored blocks: no compression, valid everywhere. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78; out[o++] = 0x01;
  for (let b = 0; b < blocks; b += 1) {
    const start = b * 65535;
    const len = Math.min(65535, raw.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 0xff; out[o++] = len >>> 8;
    out[o++] = ~len & 0xff; out[o++] = (~len >>> 8) & 0xff;
    out.set(raw.subarray(start, start + len), o);
    o += len;
  }
  const ad = adler32(raw);
  out[o++] = ad >>> 24; out[o++] = (ad >>> 16) & 0xff; out[o++] = (ad >>> 8) & 0xff; out[o++] = ad & 0xff;
  return out;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const len = body.length;
  out[0] = len >>> 24; out[1] = (len >>> 16) & 0xff; out[2] = (len >>> 8) & 0xff; out[3] = len & 0xff;
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  const c = crc32(out, 4, 8 + len);
  out[8 + len] = c >>> 24; out[9 + len] = (c >>> 16) & 0xff; out[10 + len] = (c >>> 8) & 0xff; out[11 + len] = c & 0xff;
  return out;
}

const hexByte = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

/** The PNG file's bytes. */
export function encodePng(img: IndexedImage): Uint8Array {
  if (img.palette.length === 0 || img.palette.length > 256) throw new Error('encodePng: 1 to 256 colours');
  const ihdr = new Uint8Array(13);
  ihdr[0] = img.w >>> 24; ihdr[1] = (img.w >>> 16) & 0xff; ihdr[2] = (img.w >>> 8) & 0xff; ihdr[3] = img.w & 0xff;
  ihdr[4] = img.h >>> 24; ihdr[5] = (img.h >>> 16) & 0xff; ihdr[6] = (img.h >>> 8) & 0xff; ihdr[7] = img.h & 0xff;
  ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const plte = new Uint8Array(img.palette.length * 3);
  img.palette.forEach((hex, i) => {
    plte[i * 3] = hexByte(hex, 0); plte[i * 3 + 1] = hexByte(hex, 1); plte[i * 3 + 2] = hexByte(hex, 2);
  });

  // Each row starts with its filter type: 0, none.
  const raw = new Uint8Array(img.h * (img.w + 1));
  for (let y = 0; y < img.h; y += 1) raw.set(img.data.subarray(y * img.w, (y + 1) * img.w), y * (img.w + 1) + 1);

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
  ];
  if (img.transparent !== undefined) {
    const trns = new Uint8Array(img.transparent + 1).fill(255);
    trns[img.transparent] = 0;
    parts.push(chunk('tRNS', trns));
  }
  parts.push(chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0)));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!; const b = bytes[i + 1]; const c = bytes[i + 2];
    s += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!
      + (b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!)
      + (c === undefined ? '=' : B64[c & 63]!);
  }
  return s;
}

/** A `data:` URI for an `<image>` or an `<img>`. */
export function pngDataUri(img: IndexedImage): string {
  return `data:image/png;base64,${base64(encodePng(img))}`;
}

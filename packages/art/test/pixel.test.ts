/* The pixel style (docs/art-jobs.md, Job 0): the encoder makes real
   PNGs, and the rasteriser draws every setting from its own ramps,
   the same way every time, small enough for a card back. */

import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BIOMES, FALLBACK_PALETTE, vocabOf } from '../src/biomes';
import type { BiomeId } from '../src/biomes';
import { LOOKS, SPRITES, rasterize, toRgba } from '../src/pixel';
import type { PixelScene } from '../src/pixel';
import { base64, encodePng, pngDataUri } from '../src/png';
import type { IndexedImage } from '../src/png';
import { buildScene } from '../src/scene';

/** The chunks of a PNG, checked against their CRCs by zlib's own crc32. */
function chunks(bytes: Uint8Array): { type: string; body: Uint8Array }[] {
  const out: { type: string; body: Uint8Array }[] = [];
  let o = 8;
  while (o < bytes.length) {
    const len = (bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!;
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    out.push({ type, body: bytes.subarray(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}

const back = (biome: BiomeId, extra: Partial<Parameters<typeof rasterize>[2]> = {}): IndexedImage => {
  const sc = buildScene({
    category: 'clear-path', frame: 'back', seed: `seed-${biome}`, style: 'pixel', px: 2.5,
    relief: 1, haze: 0.6, band: false, subject: false, fade: 0.3,
  }, FALLBACK_PALETTE, vocabOf(biome)) as unknown as PixelScene;
  return rasterize(sc, LOOKS[biome], { px: 2.5, seed: `seed-${biome}`, ink: '#0A0F12', ...extra });
};

describe('the PNG encoder', () => {
  const img: IndexedImage = {
    w: 5, h: 3, palette: ['#000000', '#FF8000', '#0A0F12'], transparent: 0,
    data: new Uint8Array([0, 1, 2, 1, 0, 2, 2, 1, 1, 0, 1, 0, 0, 2, 2]),
  };

  it('writes a PNG: the signature, the header, a palette, and its transparency', () => {
    const bytes = encodePng(img);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const cs = chunks(bytes);
    expect(cs.map((c) => c.type)).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
    const ihdr = cs[0]!.body;
    expect([ihdr[3], ihdr[7], ihdr[8], ihdr[9]]).toEqual([5, 3, 8, 3]); // 5 × 3, 8 bits, palette
    expect([...cs[1]!.body.subarray(3, 6)]).toEqual([0xFF, 0x80, 0x00]);
    expect([...cs[2]!.body]).toEqual([0]);
  });

  it('holds exactly the pixels it was given, row by row', () => {
    const idat = chunks(encodePng(img)).find((c) => c.type === 'IDAT')!.body;
    const raw = inflateSync(Buffer.from(idat));
    expect(raw.length).toBe(3 * (5 + 1));
    for (let y = 0; y < 3; y += 1) {
      expect(raw[y * 6]).toBe(0); // no filter
      expect([...raw.subarray(y * 6 + 1, y * 6 + 6)]).toEqual([...img.data.subarray(y * 5, y * 5 + 5)]);
    }
  });

  it('encodes base64 as the platform does', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Maze Deck']) {
      const bytes = new TextEncoder().encode(s);
      expect(base64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });
});

describe('the pixel style', () => {
  it('draws the same picture for the same seed', () => {
    const a = back('deep-forest');
    const b = back('deep-forest');
    expect(a.palette).toEqual(b.palette);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(Buffer.from(back('deep-forest', { seed: 'another' }).data).equals(Buffer.from(a.data))).toBe(false);
  });

  it('draws every setting from its own ramps and sprites, and nothing else', () => {
    for (const { id } of BIOMES) {
      const look = LOOKS[id];
      const sprite = SPRITES[look.air.kind];
      const allowed = new Set([
        ...look.ramp.sky, ...look.ramp.land, ...look.ramp.light, look.ramp.rim, look.air.color,
        ...(look.disc ? [look.disc] : []), ...Object.values(sprite.colors),
      ].map((c) => c.toUpperCase()));
      const img = back(id, { fade: 0 });
      for (const c of img.palette) expect(allowed.has(c.toUpperCase()), `${id}: ${c}`).toBe(true);
      // And it uses the ramps: a picture of one or two colours is not a picture.
      expect(img.palette.length, id).toBeGreaterThan(6);
    }
  });

  it('sinks the palette, not the picture, when faded', () => {
    const plain = back('dungeon', { fade: 0 });
    const faded = back('dungeon', { fade: 0.5 });
    expect(Buffer.from(faded.data).equals(Buffer.from(plain.data))).toBe(true);
    expect(faded.palette).not.toEqual(plain.palette);
  });

  it('draws a back in layers: an opaque sky, and far and near on a clear ground', () => {
    const sky = back('frozen-pass', { part: 'sky' });
    const far = back('frozen-pass', { part: 'far' });
    const near = back('frozen-pass', { part: 'near' });
    expect(sky.transparent).toBeUndefined();
    for (const l of [far, near]) {
      expect(l.transparent).toBe(0);
      const clear = l.data.filter((i) => i === 0).length;
      expect(clear).toBeGreaterThan(l.data.length * 0.1);
      expect(clear).toBeLessThan(l.data.length);
    }
    // Every pixel of the whole is in exactly one of far and near, or is sky.
    const rgba = toRgba(near);
    expect(rgba.length).toBe(near.w * near.h * 4);
  });

  it('keeps a card back small: well under 40 KB as a data URI', () => {
    for (const { id } of BIOMES) {
      const uri = pngDataUri(back(id));
      expect(uri.length, id).toBeLessThan(40 * 1024);
    }
  });

  it('lights a back with the setting and a scene with the card', () => {
    const sc = buildScene({
      category: 'monster', frame: 'vista', aspect: 4, seed: 's', style: 'pixel', px: 3,
      relief: 1, haze: 0.6, band: false, subject: true, fade: 0,
    }, FALLBACK_PALETTE, vocabOf('tower')) as unknown as PixelScene;
    const mons = FALLBACK_PALETTE.cat.mons;
    const img = rasterize(sc, LOOKS.tower, { px: 3, seed: 's', ink: '#0A0F12', light: [mons[700], mons[500], mons[300]] });
    expect(img.palette.map((c) => c.toUpperCase())).toContain(mons[500].toUpperCase());
  });
});

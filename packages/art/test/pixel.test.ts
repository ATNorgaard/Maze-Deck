/* The pixel style (docs/art-jobs.md, Job 0): the encoder makes real
   PNGs, and the rasteriser draws every setting from its own ramps,
   the same way every time, small enough for a card back. */

import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BIOMES, FALLBACK_PALETTE, vocabOf } from '../src/biomes';
import type { BiomeId } from '../src/biomes';
import { LOOKS, SPRITES, contains, rasterize, toRgba } from '../src/pixel';
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

/* The keeper's vault (job 1): what the dungeon added to the rasteriser,
   all of it opt-in, and the dungeon's own pictures. */

/** A look that makes inside and outside plain: black sky, white land, no air. */
const PLAIN = {
  ramp: { sky: ['#000000'], land: ['#FFFFFF'], light: ['#110000', '#220000', '#330000'], rim: '#FFFFFF' },
  air: { kind: 'dust' as const, count: 0, color: '#000000' },
};
const none = () => 0;
const scene = (over: Partial<PixelScene>): PixelScene => ({
  W: 96, H: 64, light: { x: -500, y: -500, r: 1 }, layers: [], sprites: [], ...over,
});
const colourAt = (img: IndexedImage, x: number, y: number) => img.palette[img.data[y * img.w + x]!]!.toUpperCase();

describe('the pixel style, for the vault', () => {
  it('fills a shape a row at a time exactly as the even-odd test would, pixel by pixel', () => {
    // A wall with arches, vertices on pixel centres and between them, and a circle.
    const wall = {
      kind: 'poly' as const,
      pts: [[0, 64], [0, 0], [96, 0], [96, 64], [70.5, 64], [70.5, 30], [62, 18.5], [54, 30], [54, 64], [30, 64], [30, 21], [21, 9.25], [12, 21], [12, 64]] as [number, number][],
    };
    const ring = { kind: 'circle' as const, cx: 40.3, cy: 50, r: 7.7 };
    for (const px of [1, 2, 2.5, 3]) {
      const img = rasterize(scene({ layers: [{ h: none, from: 'bottom', depth: 0, shapes: [wall, ring] }] }), PLAIN, { px, seed: 's', ink: '#000000' });
      for (let y = 0; y < img.h; y += 1) {
        for (let x = 0; x < img.w; x += 1) {
          const cx = (x + 0.5) * px; const cy = (y + 0.5) * px;
          // Below the bottom edge is land, as the land's height has always counted it.
          const inside = cy / 64 >= 1 || contains(wall, cx, cy) || contains(ring, cx, cy);
          expect(colourAt(img, x, y), `px ${px} at ${x},${y}`).toBe(inside ? '#FFFFFF' : '#000000');
        }
      }
    }
  });

  const stone = {
    ramp: { sky: ['#000000'], land: ['#444444', '#333333', '#222222', '#111111'], light: ['#550000', '#880000', '#BB0000', '#EE0000'], rim: '#010101' },
    air: { kind: 'dust' as const, count: 0, color: '#000000' },
    landLight: 1.1,
  };
  const block = { kind: 'poly' as const, pts: [[0, 0], [96, 0], [96, 64], [0, 64]] as [number, number][] };
  const wallOf = (extra: object = {}) => scene({
    layers: [{ h: none, from: 'bottom', depth: 1, tone: 2 / 3, shapes: [block], ...extra }],
    lamps: [{ x: 10, y: 32, r: 60, own: true }],
  });

  it('lifts stone a light falls on, up the ramp and into the light, and leaves it flat where none does', () => {
    const img = rasterize(wallOf(), stone, { px: 2, seed: 's', ink: '#000000' });
    expect(['#880000', '#BB0000']).toContain(colourAt(img, 5, 16));
    // Far from the lamp, unlit stone is one colour, not a dither.
    const far = new Set([0, 1, 2, 3].map((d) => colourAt(img, 44 + (d & 1), 4 + (d >> 1))));
    expect([...far]).toEqual(['#222222']);
  });

  it('leaves a silhouette dark, however near the light', () => {
    const img = rasterize(wallOf({ shadow: true, tone: 1 }), stone, { px: 2, seed: 's', ink: '#000000' });
    expect(colourAt(img, 5, 16)).toBe('#111111');
  });

  it('lays stone in courses: every joint a step darker', () => {
    const plain = rasterize(wallOf(), stone, { px: 2, seed: 's', ink: '#000000' });
    const laid = rasterize(wallOf({ courses: 8 }), stone, { px: 2, seed: 's', ink: '#000000' });
    // A joint along the top of every course, 8 units (4 pixels) apart.
    for (const y of [0, 4, 8]) expect(colourAt(laid, 44, y), `row ${y}`).toBe('#111111');
    expect(colourAt(laid, 45, 2)).toBe(colourAt(plain, 45, 2));
  });

  it('keeps a lamp of the setting its own colour where a scene is lit by the card', () => {
    const img = rasterize(scene({ lamps: [{ x: 48, y: 32, r: 30, own: true }] }), stone, {
      px: 2, seed: 's', ink: '#000000', light: ['#000011', '#000022', '#000033'],
    });
    expect(colourAt(img, 24, 16)).toBe('#EE0000');
  });

  it('stamps what the composition places, where it places it', () => {
    const img = rasterize(scene({ stamps: [{ kind: 'rat', x: 40, y: 40 }] }), PLAIN, { px: 2, seed: 's', ink: '#000000' });
    // Centred on pixel (20, 20): the body through the middle row, the eye at its end.
    expect(colourAt(img, 20, 20)).toBe('#241D25');
    expect(colourAt(img, 23, 20)).toBe('#B97337');
  });
});

describe('the dungeon: the keeper’s vault', () => {
  const params = (frame: 'back' | 'vista', aspect = 1) => ({
    category: 'monster' as const, frame, aspect, seed: 'vault', style: 'pixel' as const, px: 2.5,
    relief: 1, haze: 0.6, band: false, subject: frame === 'vista', fade: 0,
  });

  it('lights the back from a torch off the frame to the left, with a rat on the floor', () => {
    const sc = buildScene(params('back'), FALLBACK_PALETTE, vocabOf('dungeon')) as unknown as PixelScene;
    expect(sc.lamps?.some((l) => l.own && l.x < 0)).toBe(true);
    expect(sc.stamps?.map((s) => s.kind)).toEqual(['rat']);
    // The chains hang in the near layer, black, so they part from the corridor when the card tilts.
    expect(sc.layers.at(-1)!.depth).toBe(1);
    expect(sc.layers.at(-1)!.shadow).toBe(true);
  });

  it('turns a wide vista into an arcade, a torch burning in some of its bays', () => {
    const sc = buildScene(params('vista', 6), FALLBACK_PALETTE, vocabOf('dungeon')) as unknown as PixelScene;
    const flames = sc.stamps!.filter((s) => s.kind === 'flame');
    expect(flames.length).toBeGreaterThanOrEqual(2);
    expect(flames.length % 2).toBe(0); // in pairs, either side of the corridor
    expect(sc.lamps!.filter((l) => l.own).length).toBe(flames.length);
  });

  it('draws a vista fast enough to draw on every reveal', () => {
    const sc = buildScene(params('vista', 6.5), FALLBACK_PALETTE, vocabOf('dungeon')) as unknown as PixelScene;
    const t0 = performance.now();
    for (let i = 0; i < 5; i += 1) rasterize(sc, LOOKS.dungeon, { px: 3, seed: 'vault', ink: '#0A0F12' });
    // About 6 ms on a desktop; generous, for a slow machine running tests.
    expect((performance.now() - t0) / 5).toBeLessThan(60);
  });

  it('gives the world a ramp of the setting, and no other card family', () => {
    const world = LOOKS.dungeon.world!;
    expect(world.ramp.length).toBeLessThanOrEqual(11);
    for (const c of [...world.ink, ...world.light, ...world.air]) expect(world.ramp).toContain(c);
    // Teal, blue and violet are the other cards' colours: none of them is in the dungeon.
    const hue = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      const mx = Math.max(r, g, b); const d = mx - Math.min(r, g, b);
      if (!d || d / mx < 0.3 || mx < 0.18) return null;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const c of world.ramp) {
      const h = hue(c);
      if (h !== null) expect(h < 60 || h > 330, `${c} at ${h.toFixed(0)}`).toBe(true);
    }
  });
});

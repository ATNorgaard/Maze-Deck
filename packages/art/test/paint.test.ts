/* The settings as approved (docs/settings-build.md): every setting has a
   design for each of its sides, draws the same picture for the same
   moment, keeps the table's luminance budget, and can show every card. */

import { describe, expect, it } from 'vitest';
import { SETTING_IDS, SIDES, designFor, designsOf, imageOf, sideOf, variantOf, vistaOf } from '../src/paint';
import type { Category, Design, Made } from '../src/paint';

const draw = (made: Made, t: number) => {
  const img = imageOf(made.p.w, made.p.h);
  made.p.resolve(t, img);
  made.over?.(img, t);
  return img;
};

const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

/** The brightest 3 x 3 block's median in a region, as check-art.cjs reads the screen. */
function worstBlock(img: ReturnType<typeof imageOf>, [x0, y0, x1, y1]: number[]): number {
  const L = (x: number, y: number) => {
    const o = (y * img.width + x) * 4;
    return 0.2126 * lin(img.data[o]!) + 0.7152 * lin(img.data[o + 1]!) + 0.0722 * lin(img.data[o + 2]!);
  };
  let worst = 0;
  for (let by = Math.round(y0! * img.height); by + 3 <= Math.round(y1! * img.height); by += 3) {
    for (let bx = Math.round(x0! * img.width); bx + 3 <= Math.round(x1! * img.width); bx += 3) {
      const ls: number[] = [];
      for (let j = 0; j < 3; j += 1) for (let k = 0; k < 3; k += 1) ls.push(L(bx + k, by + j));
      ls.sort((a, b) => a - b);
      worst = Math.max(worst, ls[4]!);
    }
  }
  return worst;
}

/** Behind the caption, the river and the hand: notes in the faintest parchment need 4.5:1. */
const REGIONS = { caption: [0.1, 0.31, 0.9, 0.39], river: [0.08, 0.42, 0.92, 0.8], hand: [0.3, 0.85, 0.7, 1] };

const played = async (): Promise<Design[]> => {
  const out: Design[] = [];
  for (const id of SETTING_IDS) for (const side of SIDES[id]) out.push(await designFor(id, side));
  return out;
};

describe('the settings', () => {
  it('has a design for every side of every setting, and nothing set aside on show', async () => {
    expect(SETTING_IDS).toHaveLength(14);
    for (const id of SETTING_IDS) {
      const all = await designsOf(id);
      for (const side of SIDES[id]) {
        const d = await designFor(id, side);
        expect(d.setting, d.id).toBe(id);
        expect(d.side, d.id).toBe(side);
        expect(d.dropped, d.id).toBeFalsy();
      }
      // A side the setting does not have is not played.
      for (const d of all) if (d.side && !d.dropped) expect(SIDES[id], d.id).toContain(d.side);
    }
  });

  it('falls back to a setting’s default side when asked for one it lacks', () => {
    expect(sideOf('dungeon', 'outside')).toBe('inside');
    expect(sideOf('desert', 'inside')).toBe('inside');
    expect(sideOf('desert', null)).toBe('outside');
  });

  it('draws the same picture for the same moment', async () => {
    for (const d of await played()) {
      const a = draw(d.back(96, 134), 0);
      const b = draw(d.back(96, 134), 0);
      expect(Buffer.from(a.data).equals(Buffer.from(b.data)), d.id).toBe(true);
    }
  });

  it('keeps every world within the luminance budget behind the words, at four moments', async () => {
    for (const d of await played()) {
      const world = d.world(320, 200);
      for (const t of [0.3, 1.3, 2.7, 4.1]) {
        const img = draw(world, t);
        for (const [name, r] of Object.entries(REGIONS)) {
          expect(worstBlock(img, r), `${d.id} ${name} at ${t}s`).toBeLessThanOrEqual(0.023);
        }
      }
    }
  }, 60_000);

  it('shows every card in the vista, and nothing before one is turned', async () => {
    const cats: (Category | null)[] = ['clear-path', 'obstacle', 'wanderer', 'item', 'monster', 'dead-end', 'trap', null];
    for (const d of await played()) {
      for (const c of cats) {
        const img = draw(vistaOf(d, 192, 72, c), 1);
        expect(img.data.some((v) => v > 0), `${d.id} ${c}`).toBe(true);
      }
    }
  }, 60_000);

  it('redraws only the lit pixels, to the same bytes as working out every one', async () => {
    type Ref = { resolveReference(t: number, img: ReturnType<typeof imageOf>): unknown };
    for (const d of await played()) {
      const pictures: [string, Made, number[]][] = [
        ['back', d.back(96, 134), [0]],
        ['world', d.world(320, 200), [0.3, 2.7]],
        ...(['monster', 'clear-path', null] as const).map((c): [string, Made, number[]] => [`vista ${c}`, vistaOf(d, 192, 72, c), [1.3, 3.1]]),
      ];
      for (const [name, made, times] of pictures) {
        for (const t of times) {
          const fast = imageOf(made.p.w, made.p.h);
          const ref = imageOf(made.p.w, made.p.h);
          made.p.resolve(t, fast);
          (made.p as unknown as Ref).resolveReference(t, ref);
          expect(Buffer.from(fast.data).equals(Buffer.from(ref.data)), `${d.id} ${name} at ${t}s`).toBe(true);
        }
      }
    }
  }, 120_000);

  it('draws each narration line its own variation, and nothing else changes', async () => {
    const same = (a: ReturnType<typeof imageOf>, b: ReturnType<typeof imageOf>) => Buffer.from(a.data).equals(Buffer.from(b.data));
    for (const d of await played()) {
      const backBefore = draw(d.back(96, 134), 0);
      // No seed is the design as approved, to the byte.
      expect(same(draw(vistaOf(d, 192, 72, 'monster', null), 1.3), draw(d.vista(192, 72, 'monster'), 1.3)), d.id).toBe(true);
      // A line always draws the same picture.
      const a = draw(vistaOf(d, 192, 72, 'monster', `${d.setting}:line-1`), 1.3);
      expect(same(a, draw(vistaOf(d, 192, 72, 'monster', `${d.setting}:line-1`), 1.3)), d.id).toBe(true);
      // Lines differ from each other.
      const pictures = ['line-1', 'line-2', 'line-3', 'line-4', 'line-5', 'line-6']
        .map((l) => Buffer.from(draw(vistaOf(d, 192, 72, 'monster', `${d.setting}:${l}`), 1.3).data).toString('base64'));
      expect(new Set(pictures).size, d.id).toBeGreaterThan(3);
      // The salt is gone once the line's picture is built: the back is as approved.
      expect(same(draw(d.back(96, 134), 0), backBefore), d.id).toBe(true);
    }
  }, 120_000);

  it('mirrors about half the lines, even among a card’s few lines', () => {
    // Narration ids as the tables write them: a prefix, the card, a number.
    const prefixes = ['dg', 'tw', 'df', 'ds', 'uc', 'fp', 'kr', 'mi', 'hr', 'dc', 'bm', 'eh', 'ud', 'sj'];
    const cards: [string, number][] = [['cp', 6], ['ob', 6], ['wa', 6], ['it', 6], ['mo', 3], ['de', 2], ['tr', 2]];
    let all = 0;
    let mirrored = 0;
    for (const [i, pre] of prefixes.entries()) {
      for (const [card, n] of cards) {
        const lines = Array.from({ length: n }, (_, k) => variantOf(`${SETTING_IDS[i]}:${pre}-${card}${k + 1}`));
        all += n;
        mirrored += lines.filter((v) => v.mirror).length;
        // A card's lines show both ways round, as evenly as their number allows.
        const m = lines.filter((v) => v.mirror).length;
        expect(Math.abs(2 * m - n), `${pre}-${card}`).toBeLessThanOrEqual(1);
        expect(new Set(lines.map((v) => v.salt)).size, `${pre}-${card}`).toBe(n);
      }
    }
    expect(mirrored / all).toBeGreaterThan(0.4);
    expect(mirrored / all).toBeLessThan(0.6);
    expect(variantOf('desert:ds-cp1')).toEqual(variantOf('desert:ds-cp1'));
    // Seeds that are not numbered lines toss for it, about half each way.
    const tossed = Array.from({ length: 400 }, (_, i) => variantOf(`dungeon:card:${i.toString(36)}x`).mirror).filter(Boolean).length;
    expect(tossed).toBeGreaterThan(160);
    expect(tossed).toBeLessThan(240);
  });

  it('draws a Dead End and a Trap in their own colours, not the Obstacle’s teal', async () => {
    const d = await designFor('dungeon', 'inside');
    const teal = [0x43, 0x91, 0x7b];
    const has = (img: ReturnType<typeof imageOf>, c: number[]) => {
      for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === c[0] && img.data[i + 1] === c[1] && img.data[i + 2] === c[2]) return true;
      return false;
    };
    expect(has(draw(vistaOf(d, 192, 72, 'obstacle'), 1), teal)).toBe(true);
    expect(has(draw(vistaOf(d, 192, 72, 'dead-end'), 1), teal)).toBe(false);
    expect(has(draw(vistaOf(d, 192, 72, 'trap'), 1), teal)).toBe(false);
  });
});

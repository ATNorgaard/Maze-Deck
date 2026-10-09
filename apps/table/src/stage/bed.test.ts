/* The bed hears the mood the world draws (docs/overhaul.md, phase 9).
   What each setting sounds like is measured by rendering it
   (scripts/capture-sound.cjs); this is what the mood asks of it. */

import { describe, expect, it } from 'vitest';
import { bedParams, CALM } from './bed';
import type { BedMood } from './bed';

const at = (m: Partial<BedMood>) => bedParams({ ...CALM, ...m });

describe('the bed', () => {
  it('is the setting alone at rest', () => {
    const p = at({});
    expect(p.level).toBe(1);
    expect(p.texture).toBe(1);
    expect(p.wander).toBe(1);
    expect(p.pulse).toEqual({ rate: 0, gain: 0 });
    expect(p.warmth).toBe(0);
    expect(p.air).toBe(0);
  });

  it('closes in as the threat rises: the filter narrows, a pulse comes and quickens', () => {
    const calm = at({});
    const one = at({ threat: 0.5 });
    const found = at({ threat: 1.4, hush: 1 });
    expect(one.cutoff).toBeLessThan(calm.cutoff);
    expect(found.cutoff).toBeLessThan(one.cutoff);
    expect(found.cutoff).toBeLessThan(1000);
    expect(one.air).toBeLessThan(0);
    // No pulse before the first strike; one from it, faster and louder when found.
    expect(at({ threat: 0.2 }).pulse.rate).toBe(0);
    expect(one.pulse.rate).toBeGreaterThan(40);
    expect(found.pulse.rate).toBeGreaterThan(one.pulse.rate);
    expect(found.pulse.gain).toBeGreaterThan(one.pulse.gain);
  });

  it('goes still one strike short, as the world does', () => {
    const near = at({ threat: 0.5, hush: 1 });
    const one = at({ threat: 0.5 });
    expect(near.texture).toBeLessThan(one.texture);
    expect(near.wander).toBeLessThan(0.5);
    expect(near.pulse.gain).toBeGreaterThan(one.pulse.gain);
  });

  it('opens up towards the far side', () => {
    const start = at({});
    const near = at({ progress: 0.8 });
    const there = at({ progress: 1 });
    expect(near.cutoff).toBeGreaterThan(start.cutoff);
    expect(there.cutoff).toBeGreaterThan(near.cutoff);
    expect(there.air).toBeGreaterThan(near.air);
    expect(there.air).toBeGreaterThan(0);
  });

  it('warms when the party is through, and goes out with the light when lost', () => {
    const through = at({ progress: 1, bloom: 1 });
    expect(through.warmth).toBe(1);
    expect(through.cutoff).toBeGreaterThan(at({ progress: 1 }).cutoff);
    expect(at({ dim: 1 }).level).toBe(0);
    // The opening starts in the dark, and the bed with it.
    expect(at({ dim: 0.9 }).level).toBeCloseTo(0.1);
  });

  it('stays in range whatever it is handed', () => {
    for (const m of [
      { threat: 9, progress: 9, hush: 9, dim: -3, bloom: 9 },
      { threat: -2, progress: -2, hush: -2, dim: 9, bloom: -2 },
    ]) {
      const p = bedParams(m);
      expect(p.level).toBeGreaterThanOrEqual(0);
      expect(p.level).toBeLessThanOrEqual(1);
      expect(p.texture).toBeGreaterThanOrEqual(0);
      expect(p.cutoff).toBeGreaterThanOrEqual(280);
      expect(p.cutoff).toBeLessThanOrEqual(16000);
      expect(p.air).toBeGreaterThanOrEqual(-6);
      expect(p.air).toBeLessThanOrEqual(8);
      expect(p.pulse.gain).toBeLessThanOrEqual(1);
      expect(p.pulse.rate).toBeLessThanOrEqual(70);
    }
  });
});

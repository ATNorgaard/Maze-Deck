/* Every setting is the same shape (biomes/types.ts): its art for each
   side it has, its cards' copy still saying what the card does, and a
   full set of narration with every check represented. */

import { describe, expect, it } from 'vitest';
import { SETTING_IDS, SIDES } from '@maze-deck/art';
import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { BIOMES } from './index';

const COUNTS = { 'clear-path': 6, obstacle: 6, wanderer: 6, item: 6, monster: 3, 'dead-end': 2, trap: 2 } as const;

describe('the settings', () => {
  it('are the fourteen the art draws, each with art for exactly its sides', () => {
    expect(BIOMES.map((b) => b.id).sort()).toEqual([...SETTING_IDS].sort());
    for (const b of BIOMES) {
      expect(Object.keys(b.art).sort(), b.id).toEqual([...SIDES[b.id]].sort());
      for (const side of SIDES[b.id]) {
        expect(b.art[side]?.back, `${b.id} ${side}`).toBeTruthy();
        expect(b.art[side]?.still, `${b.id} ${side}`).toBeTruthy();
      }
    }
  });

  it('are lit by gold, teal or blue only (AJ4)', () => {
    for (const b of BIOMES) expect(['path', 'obst', 'wand'], b.id).toContain(b.light);
  });

  it('reword the cards without changing what they do', () => {
    for (const b of BIOMES) {
      if (!b.cards) continue;
      for (const [cat, c] of Object.entries(b.cards)) {
        expect(c.rule, `${b.id} ${cat}`).toContain(c.emphasis);
        expect(c.title.length, `${b.id} ${cat}`).toBeLessThanOrEqual(16);
      }
      expect(b.cards['clear-path'].rule, b.id).toContain(`Score 1 point; ${ESCAPE_TARGET}`);
      expect(b.cards.obstacle.rule, b.id).toMatch(/until somebody spends an action\b/);
      expect(b.cards.wanderer.rule, b.id).toMatch(/^Friend or foe is the party’s read\./);
      expect(b.cards.item.rule, b.id).toBe('Take it or leave it. The card is discarded either way.');
      expect(b.cards.monster.rule, b.id).toMatch(new RegExp(`^One strike\\. At ${ENCOUNTER_AT} `));
      expect(b.cards['dead-end'].rule, b.id).toMatch(/^No check \w+ it\. Only a rallied party turns back\b[^.]*\. Blocks the /);
      expect(b.cards.trap.rule, b.id).toContain(`Check DC ${MAZE_DC} ± 1`);
      expect(b.cards.trap.rule, b.id).toMatch(/Leaves the game either way\.$/);
    }
  });

  it('have a full set of narration, with every check among the obstacles', () => {
    const ids = new Set<string>();
    for (const b of BIOMES) {
      for (const [cat, n] of Object.entries(COUNTS)) {
        const rows = b.tables[cat as keyof typeof COUNTS];
        expect(rows, `${b.id} ${cat}`).toHaveLength(n);
        for (const r of rows) {
          expect(ids.has(r.id), `${r.id} is used twice`).toBe(false);
          ids.add(r.id);
          expect(r.text.trim().length, r.id).toBeGreaterThan(10);
        }
      }
      expect(b.tables.obstacle.map((r) => r.score).sort(), b.id).toEqual(['CHA', 'CON', 'DEX', 'INT', 'STR', 'WIS']);
    }
  });
});

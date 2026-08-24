/* ============================================================
   The deck composition is written down three times.

     packages/ui/src/types.ts          copies: N        (the engine)
     packages/ui/src/styles/tokens.css --md-count-*     (the app)
     design-system/tokens.css          --count-*        (the print sheet)

   They cannot be collapsed into one: the stylesheet has to carry
   the numbers because the print page reads them at runtime with
   no JavaScript build, and types.ts has to carry them because the
   engine builds the deck from them. So the numbers are duplicated
   on purpose — and nothing stopped them drifting until this.

   .design-sync/NOTES.md called this out as the thing that would
   silently desynchronise the printed deck from the digital one.

     node scripts/check-deck-parity.mjs

   Exits non-zero on a mismatch.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Category key -> the name it goes by in each file. */
const CATEGORIES = [
  { key: 'clear-path', md: 'path', ds: 'path' },
  { key: 'obstacle', md: 'obstacle', ds: 'obstacle' },
  { key: 'wanderer', md: 'wanderer', ds: 'wanderer' },
  { key: 'item', md: 'item', ds: 'item' },
  { key: 'monster', md: 'monster', ds: 'monster' },
  { key: 'dead-end', md: 'dead', ds: 'dead', expansion: true },
  { key: 'trap', md: 'trap', ds: 'trap', expansion: true },
];

function fromTypes() {
  const src = read('packages/ui/src/types.ts');
  const counts = {};
  for (const { key } of CATEGORIES) {
    // category: 'x', ... copies: N — across the whole entry object.
    const entry = new RegExp(
      `category:\\s*'${key}'[\\s\\S]{0,400}?copies:\\s*(\\d+)`,
    ).exec(src);
    if (!entry) throw new Error(`types.ts: no copies for ${key}`);
    counts[key] = Number(entry[1]);
  }
  const dc = /export const MAZE_DC = (\d+)/.exec(src);
  if (!dc) throw new Error('types.ts: no MAZE_DC');
  return { counts, mazeDc: Number(dc[1]) };
}

function fromCss(path, prefix, names, dcName) {
  const src = read(path);
  const counts = {};
  for (const { key, [names]: local } of CATEGORIES) {
    const m = new RegExp(`--${prefix}count-${local}:\\s*(\\d+)`).exec(src);
    if (!m) throw new Error(`${path}: no --${prefix}count-${local}`);
    counts[key] = Number(m[1]);
  }
  const dc = new RegExp(`--${dcName}:\\s*(\\d+)`).exec(src);
  if (!dc) throw new Error(`${path}: no --${dcName}`);
  return { counts, mazeDc: Number(dc[1]) };
}

const sources = {
  'packages/ui/src/types.ts': fromTypes(),
  'packages/ui/src/styles/tokens.css':
    fromCss('packages/ui/src/styles/tokens.css', 'md-', 'md', 'md-maze-dc'),
  'design-system/tokens.css':
    fromCss('design-system/tokens.css', '', 'ds', 'maze-dc'),
};

const names = Object.keys(sources);
const base = names[0];
const problems = [];

for (const { key } of CATEGORIES) {
  const values = names.map((n) => sources[n].counts[key]);
  if (new Set(values).size !== 1) {
    problems.push(
      `${key}: ${names.map((n, i) => `${n} says ${values[i]}`).join(', ')}`,
    );
  }
}

const dcs = names.map((n) => sources[n].mazeDc);
if (new Set(dcs).size !== 1) {
  problems.push(`Maze DC: ${names.map((n, i) => `${n} says ${dcs[i]}`).join(', ')}`);
}

const standard = CATEGORIES
  .filter((c) => !c.expansion)
  .reduce((n, c) => n + sources[base].counts[c.key], 0);

// The one number a reader is most likely to trust without checking.
const declared = /--md-deck-total:\s*(\d+)/.exec(read('packages/ui/src/styles/tokens.css'));
if (declared && Number(declared[1]) !== standard) {
  problems.push(`--md-deck-total says ${declared[1]}, the categories add up to ${standard}`);
}
const dsTotal = /--deck-total:\s*(\d+)/.exec(read('design-system/tokens.css'));
if (dsTotal && Number(dsTotal[1]) !== standard) {
  problems.push(`--deck-total says ${dsTotal[1]}, the categories add up to ${standard}`);
}

if (problems.length) {
  console.error('Deck composition has drifted:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nAll three files must agree. See scripts/check-deck-parity.mjs.');
  process.exit(1);
}

console.log(
  `Deck parity OK — ${standard} cards in the standard deck, Maze DC ${dcs[0]}, `
  + `${names.length} sources agree.`,
);

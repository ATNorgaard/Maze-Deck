/**
 * Flattens src/styles/index.css into a single dist/styles.css.
 *
 * Why this exists: consumers (and the design-sync converter) receive ONE
 * stylesheet. Relative `@import`s inside it are only resolvable if every
 * imported file travels alongside — which is exactly the failure mode we
 * hit: the entry was copied verbatim and its three siblings were left
 * behind, so the closure imported three files that did not exist and
 * every component rendered unstyled.
 *
 * Local imports are inlined; absolute ones (the Google Fonts URL) are
 * hoisted to the top, because @import must precede all other rules.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../src/styles/index.css');
const outFile = resolve(here, '../dist/styles.css');

const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g;

const remote = [];
const seen = new Set();

function inline(file) {
  const abs = resolve(file);
  if (seen.has(abs)) return '';   // cycle guard
  seen.add(abs);

  const css = readFileSync(abs, 'utf8');
  let out = '';
  let last = 0;

  for (const m of css.matchAll(IMPORT_RE)) {
    out += css.slice(last, m.index);
    last = m.index + m[0].length;
    const spec = m[1];
    if (/^(https?:)?\/\//.test(spec)) {
      if (!remote.includes(m[0])) remote.push(m[0]);
    } else {
      out += `\n/* ---- ${spec} ---- */\n` + inline(resolve(dirname(abs), spec));
    }
  }
  return out + css.slice(last);
}

const body = inline(entry);
const css = [...remote, '', body].join('\n');

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, css, 'utf8');

const localCount = seen.size - 1;
console.log(
  `css: dist/styles.css ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB ` +
  `(${localCount} local import${localCount === 1 ? '' : 's'} inlined, ${remote.length} remote hoisted)`,
);

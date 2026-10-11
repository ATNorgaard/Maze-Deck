/* ============================================================
   The settings' painter, for scripts.

   packages/art/src/paint is TypeScript and ES modules, with each
   setting split into its own chunk for the game. Scripts (the bake,
   the review page, contact sheets) want it whole: this bundles it with
   the table's esbuild, every setting inlined, and either imports it
   into Node or hands back an IIFE for a browser page.
   ============================================================ */
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(root, 'apps', 'table', 'package.json'));
const esbuild = require('esbuild');
const entry = path.join(root, 'packages', 'art', 'src', 'paint', 'index.ts');

async function bundle(format, globalName) {
  const out = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format,
    globalName,
    platform: format === 'iife' ? 'browser' : 'node',
    write: false,
    logLevel: 'error',
    target: 'es2020',
  });
  return out.outputFiles[0].text;
}

/** The paint module, in Node. */
export async function loadPaint() {
  const file = path.join(os.tmpdir(), `maze-deck-paint-${process.pid}.mjs`);
  fs.writeFileSync(file, await bundle('esm'));
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/** The paint module as a script for a page: `window.<globalName>`. */
export function paintScript(globalName = 'Paint') {
  return bundle('iife', globalName);
}

/**
 * The painter and some settings' designs, loaded at once, as the review
 * page wants them: `window.PX` and `window.DESIGNS`.
 */
export async function designsScript(settings) {
  const dir = path.join(root, 'packages', 'art', 'src', 'paint');
  const spec = (f) => JSON.stringify(path.join(dir, f).split(path.sep).join('/'));
  const contents = [
    `import PX from ${spec('px.js')};`,
    ...settings.map((s, i) => `import s${i} from ${spec(`settings/${s}.js`)};`),
    'window.PX = PX;',
    `window.DESIGNS = [${settings.map((_, i) => `...s${i}`).join(', ')}];`,
  ].join('\n');
  const out = await esbuild.build({
    stdin: { contents, resolveDir: dir, loader: 'js' },
    bundle: true, format: 'iife', platform: 'browser', write: false, logLevel: 'error', target: 'es2020',
  });
  return out.outputFiles[0].text;
}

export { root };

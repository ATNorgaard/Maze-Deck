/* ============================================================
   Print the deck to PDF.

   design-system/deck.html is the print page: it reads the counts
   out of tokens.css at runtime and lays the cards out 2x3 on A4,
   gutterless. This drives it with the Chromium that already lives
   in .ds-sync/node_modules and writes a real PDF, so regenerating
   the deck does not depend on somebody remembering to open a
   browser and pick the right print settings.

     node scripts/print-deck.mjs [--expansion] [--guides] [--out FILE]

   printBackground is on and scale is 1: any "fit to page" would
   break the 63 x 88mm trim and the cards would not fit sleeves.
   ============================================================ */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, '.ds-sync/package.json'));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const OUT = value('out', 'print/MazeDeck_PRINT_v4.pdf');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const path = normalize((req.url ?? '/').split('?')[0]).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, 'design-system', path === '/' ? 'deck.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const query = [flag('expansion') ? 'expansion=1' : '', flag('guides') ? 'guides=1' : '']
  .filter(Boolean).join('&');
const url = `http://127.0.0.1:${port}/deck.html${query ? `?${query}` : ''}`;

/**
 * The browser is a hidden prerequisite: playwright lives in
 * .ds-sync/node_modules, but its Chromium is downloaded separately
 * into a shared cache. A fresh clone — or an interrupted download —
 * fails here, and Playwright's own error is a stack trace that does
 * not mention which directory to run the fix in.
 */
const { chromium } = require('playwright');
let browser;
try {
  browser = await chromium.launch();
} catch (err) {
  server.close();
  const missing = /Executable doesn't exist/.test(String(err?.message));
  if (missing) {
    console.error([
      '',
      'Playwright has no browser to drive.',
      '',
      '  cd .ds-sync && npx playwright install chromium',
      '',
      'Run it from .ds-sync — that is where playwright is installed.',
      'If a download was interrupted the folder can exist while the',
      'executable does not, which produces exactly this error.',
      '',
    ].join('\n'));
  } else {
    console.error(`\nCould not start a browser:\n\n  ${err?.message ?? err}\n`);
  }
  process.exit(1);
}

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  // The page writes itself with document.write, and the fonts are
  // remote — a PDF taken before either lands is a page of Georgia.
  await page.waitForSelector('.sheet .card');
  await page.evaluate(() => document.fonts.ready);

  const sheets = await page.locator('.sheet').count();
  const cards = await page.locator('.card').count();

  await page.pdf({
    path: join(root, OUT),
    format: 'A4',
    printBackground: true,
    scale: 1,
    preferCSSPageSize: true,
  });

  console.log(`Wrote ${OUT} — ${sheets} sheets, ${cards} cards${query ? ` (${query})` : ''}.`);
} finally {
  await browser.close();
  server.close();
}

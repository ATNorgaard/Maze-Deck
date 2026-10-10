/* Photograph one setting's designs from a built page.
     node shoot.cjs <setting> [outDir]
   Builds art-directions-<setting>.html, opens it at 1400 wide, waits,
   and writes per direction: the board, the back, the vista for each card,
   and the whole section. Prints page errors. */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const requireSync = createRequire('C:/Coding/Maze-Deck/.ds-sync/package.json');
const { chromium } = requireSync('playwright');

const setting = process.argv[2] || 'dungeon';
const out = process.argv[3] || path.join(__dirname, 'shots', setting);
fs.mkdirSync(out, { recursive: true });
execFileSync(process.execPath, [path.join(__dirname, 'build.cjs'), setting], { stdio: 'inherit' });
const file = path.join(__dirname, `art-directions-${setting}.html`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5, colorScheme: 'dark' });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.goto('file:///' + file.split(path.sep).join('/'));
  await page.waitForTimeout(1500);
  const dirs = await page.locator(`#${setting} .dir`).count();
  for (let i = 0; i < dirs; i += 1) {
    const d = page.locator(`#${setting} .dir`).nth(i);
    const key = String.fromCharCode(65 + i);
    await d.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await d.locator('.board').screenshot({ path: path.join(out, `${key}-board.png`) });
    await d.locator('.card').screenshot({ path: path.join(out, `${key}-back.png`) });
    const cats = d.locator('.cats .btn');
    for (let c = 0; c < (await cats.count()); c += 1) {
      await cats.nth(c).click();
      await page.waitForTimeout(250);
      const name = (await cats.nth(c).textContent()).trim().toLowerCase().replace(/\s+/g, '-');
      await d.locator('.vbox').screenshot({ path: path.join(out, `${key}-vista-${name}.png`) });
    }
    await cats.nth(0).click();
  }
  await page.locator(`#${setting}`).screenshot({ path: path.join(out, 'section.png') });
  console.log('shots in', out);
  await browser.close();
})();

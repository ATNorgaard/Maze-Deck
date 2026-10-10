// Photograph the whole page at phone width (dark) and desktop (light); report horizontal overflow.
const path = require('path');
const { createRequire } = require('module');
const r = createRequire('C:/Coding/Maze-Deck/.ds-sync/package.json');
const { chromium } = r('playwright');
const file = 'file:///' + path.join(__dirname, 'art-directions.html').split(path.sep).join('/');
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, scheme] of [['phone', { width: 390, height: 844 }, 'dark'], ['light', { width: 1280, height: 900 }, 'light']]) {
    const p = await b.newPage({ viewport: vp, colorScheme: scheme });
    p.on('pageerror', (e) => console.log('pageerror', e.message));
    await p.goto(file);
    await p.waitForTimeout(1500);
    console.log(name, 'scrollWidth / innerWidth', await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
    await p.screenshot({ path: path.join(__dirname, 'shots', `page-${name}.png`) });
    await p.locator('#dungeon').scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(__dirname, 'shots', `page-${name}-dungeon.png`) });
  }
  await b.close();
})();

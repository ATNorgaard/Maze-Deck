/* Build the review page from the designs in packages/art/src/paint:
     node build.cjs [settings,comma,separated] [out.html]
   With no settings, every one; the out file defaults to art-directions.html here. */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const ORDER = ['dungeon', 'tower', 'deep-forest', 'desert', 'undercity', 'frozen-pass',
  'kings-road', 'mire', 'high-road', 'drowned-coast', 'barrow-moor', 'ember-hold', 'underdark', 'sunken-jungle'];

(async () => {
  const only = process.argv[2];
  const set = only ? only.split(',') : null;
  const settings = ORDER.filter((s) => !set || set.includes(s));
  const { designsScript } = await import('../../scripts/lib/paint.mjs');
  const script = await designsScript(settings);
  const page = fs.readFileSync(path.join(dir, 'page.html'), 'utf8')
    .replace('/*PX*/', () => script)
    .replace('/*SCENES*/', '');
  const out = process.argv[3] || path.join(dir, only ? `art-directions-${only}.html` : 'art-directions.html');
  fs.writeFileSync(out, page);
  console.log(out, `${(page.length / 1024).toFixed(0)} KB`);
})();

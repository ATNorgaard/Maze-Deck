// Inline the painter and the scenes into the page: node build.cjs [only-setting]
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const order = ['dungeon', 'tower', 'deep-forest', 'desert', 'undercity', 'frozen-pass',
  'kings-road', 'mire', 'high-road', 'drowned-coast', 'barrow-moor', 'ember-hold', 'underdark', 'sunken-jungle'];
const only = process.argv[2];
const set = only ? only.split(',') : null;
const scenes = order
  .filter((s) => !set || set.includes(s))
  .map((s) => path.join(dir, 'scenes', `${s}.js`))
  .filter((f) => fs.existsSync(f))
  .map((f) => fs.readFileSync(f, 'utf8'))
  // Each scene in its own script, so one broken file cannot blank the page.
  .join('\n</script>\n<script>\n');
const page = fs.readFileSync(path.join(dir, 'page.html'), 'utf8')
  .replace('/*PX*/', () => fs.readFileSync(path.join(dir, 'px.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = PX;", ''))
  .replace('/*SCENES*/', () => scenes);
const out = process.argv[3] || path.join(dir, only ? `art-directions-${only}.html` : 'art-directions.html');
fs.writeFileSync(out, page);
console.log(out, `${(page.length / 1024).toFixed(0)} KB`);

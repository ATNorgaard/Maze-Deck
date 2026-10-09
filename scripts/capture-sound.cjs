/* ============================================================
   The bed, measured and written down to listen to
   (docs/overhaul.md, phase 9).

   A headless browser cannot be listened to, but the bed can be
   rendered offline (stage/bed.ts, renderBed) and the result measured.
   Every setting at rest, and the pass through every mood, become WAV
   files to hear and numbers to check:
   - loudness: audible, and under the voices (they peak near -16 dBFS);
   - spectrum: each setting its own (centroid and octave profile);
   - threat narrows the sound and brings in a low pulse;
   - one strike short, the air goes still (the wind wanders less);
   - the far side opens it; through, it warms; lost, it goes out;
   - a voice ducks it, and it comes back;
   - the same seed renders the same samples.

   Then the live bed, in the app: the threshold asks once, "Sound on"
   starts the chosen door's air, another door changes it, a reload does
   not ask again, the board takes it over with the opening's dark, the
   voices duck it, and the switch in the GM drawer stops it. "Not now"
   is remembered too.

     node scripts/capture-sound.cjs [outDir] [--url=http://localhost:5180]

   Needs the table's dev server. Writes sound.log and the WAVs to outDir.
   Exits non-zero if a check fails.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const requireSync = createRequire(path.join(__dirname, '..', '.ds-sync', 'package.json'));
const { chromium } = requireSync('playwright');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'proof', 'sound');
const url = flag('url', 'http://localhost:5180');
fs.mkdirSync(out, { recursive: true });

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
let failed = false;
const check = (ok, what) => { log(`${ok ? 'ok ' : '!! '} ${what}`); if (!ok) failed = true; };
const db = (v) => `${v.toFixed(1)} dB`;

const CALM = { threat: 0, progress: 0, hush: 0, dim: 0, bloom: 0 };
const mood = (m) => ({ ...CALM, ...m });
const BIOMES = ['frozen-pass', 'tower', 'dungeon', 'undercity', 'deep-forest', 'desert'];

/** What to render: [name, biome, seconds, moods, ducks]. */
const CLIPS = [
  ...BIOMES.map((b) => [`${b}-calm`, b, b === 'tower' ? 30 : 12, [{ at: 0, mood: CALM }], []]),
  ['frozen-pass-calm-again', 'frozen-pass', 12, [{ at: 0, mood: CALM }], []],
  ['frozen-pass-one-strike', 'frozen-pass', 12, [{ at: 0, mood: mood({ threat: 0.5 }) }], []],
  ['frozen-pass-near', 'frozen-pass', 12, [{ at: 0, mood: mood({ threat: 0.5, hush: 1 }) }], []],
  ['frozen-pass-found', 'frozen-pass', 12, [{ at: 0, mood: mood({ threat: 1.4, hush: 1 }) }], []],
  ['frozen-pass-far-side', 'frozen-pass', 12, [{ at: 0, mood: mood({ progress: 1 }) }], []],
  ['frozen-pass-through', 'frozen-pass', 12, [{ at: 0, mood: mood({ progress: 1, bloom: 1 }) }], []],
  ['frozen-pass-lost', 'frozen-pass', 12, [{ at: 0, mood: CALM }, { at: 4, mood: mood({ dim: 1 }) }], []],
  ['frozen-pass-duck', 'frozen-pass', 9, [{ at: 0, mood: CALM }], [{ at: 4, voice: 'dread' }]],
  // To listen to: a crossing on the pass, compressed. Calm; ground gained;
  // a strike; one short; found; lost.
  ['frozen-pass-crossing', 'frozen-pass', 42, [
    { at: 0, mood: CALM },
    { at: 7, mood: mood({ progress: 0.6 }) },
    { at: 14, mood: mood({ progress: 0.6, threat: 0.5 }) },
    { at: 21, mood: mood({ progress: 0.6, threat: 0.5, hush: 1 }) },
    { at: 28, mood: mood({ progress: 0.6, threat: 1.4, hush: 1 }) },
    { at: 35, mood: mood({ progress: 0.6, dim: 1 }) },
  ], [{ at: 14, voice: 'thud' }, { at: 28, voice: 'dread' }]],
];

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => { log(`pageerror: ${e.message}`); failed = true; });
  await page.goto(url);
  await page.waitForTimeout(500);

  /* ---------------- offline ---------------- */
  const rendered = {};
  for (const [name, biome, seconds, moods, ducks] of CLIPS) {
    const r = await page.evaluate(async ({ biome, seconds, moods, ducks }) => {
      const bed = await import('/src/stage/bed.ts');
      const buf = await bed.renderBed(biome, seconds, moods, ducks);
      const sr = buf.sampleRate;
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      const mono = new Float32Array(L.length);
      for (let i = 0; i < L.length; i += 1) mono[i] = (L[i] + R[i]) / 2;

      const toDb = (v) => 20 * Math.log10(Math.max(v, 1e-7));
      const rms = (a, b) => {
        const i0 = Math.floor(a * sr); const i1 = Math.min(mono.length, Math.floor(b * sr));
        let s = 0;
        for (let i = i0; i < i1; i += 1) s += mono[i] * mono[i];
        return toDb(Math.sqrt(s / Math.max(1, i1 - i0)));
      };
      let peak = 0;
      for (let i = 0; i < L.length; i += 1) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));

      // A power spectrum, averaged over Hann-windowed frames.
      const N = 4096;
      const spec = new Float64Array(N / 2);
      const re = new Float64Array(N); const im = new Float64Array(N);
      const fft = () => {
        for (let i = 1, j = 0; i < N; i += 1) {
          let bit = N >> 1;
          for (; j & bit; bit >>= 1) j ^= bit;
          j ^= bit;
          if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
        }
        for (let len = 2; len <= N; len <<= 1) {
          const ang = (-2 * Math.PI) / len;
          for (let i = 0; i < N; i += len) {
            for (let k = 0; k < len / 2; k += 1) {
              const wr = Math.cos(ang * k); const wi = Math.sin(ang * k);
              const ar = re[i + k + len / 2]; const ai = im[i + k + len / 2];
              const xr = ar * wr - ai * wi; const xi = ar * wi + ai * wr;
              re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi;
              re[i + k] += xr; im[i + k] += xi;
            }
          }
        }
      };
      const spectrum = (a, b) => {
        spec.fill(0);
        let frames = 0;
        for (let s = Math.floor(a * sr); s + N <= Math.min(mono.length, b * sr); s += N) {
          for (let i = 0; i < N; i += 1) { re[i] = mono[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))); im[i] = 0; }
          fft();
          for (let k = 0; k < N / 2; k += 1) spec[k] += re[k] * re[k] + im[k] * im[k];
          frames += 1;
        }
        const hz = (k) => (k * sr) / N;
        let total = 0; let weighted = 0;
        for (let k = 1; k < N / 2; k += 1) { total += spec[k]; weighted += spec[k] * hz(k); }
        const band = (lo, hi) => {
          let p = 0;
          for (let k = 1; k < N / 2; k += 1) if (hz(k) >= lo && hz(k) < hi) p += spec[k];
          return p / Math.max(total, 1e-20);
        };
        const octaves = [];
        for (let f = 31.25; f < 16000; f *= 2) octaves.push(band(f, f * 2));
        return { centroid: weighted / Math.max(total, 1e-20), low: band(20, 120), warm: band(180, 410), octaves, frames };
      };

      // Loudness every quarter second, above 250 Hz: how much the setting's
      // own layers move, without the pulse beating under them.
      const high = new Float32Array(mono.length);
      const a1 = Math.exp((-2 * Math.PI * 250) / sr);
      for (let i = 1; i < mono.length; i += 1) high[i] = a1 * (high[i - 1] + mono[i] - mono[i - 1]);
      const windows = [];
      for (let t = 0; t + 0.25 <= seconds; t += 0.25) {
        let s = 0;
        for (let i = Math.floor(t * sr); i < Math.floor((t + 0.25) * sr); i += 1) s += high[i] * high[i];
        windows.push(toDb(Math.sqrt(s / (0.25 * sr))));
      }

      // A WAV, 16-bit, to listen to.
      const bytes = new Uint8Array(44 + L.length * 4);
      const v = new DataView(bytes.buffer);
      const str = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + L.length * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data');
      v.setUint32(40, L.length * 4, true);
      for (let i = 0; i < L.length; i += 1) {
        v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
        v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));

      // A fingerprint of the samples, for the seed check.
      let hash = 0;
      for (let i = 0; i < L.length; i += 97) hash = (hash * 31 + Math.round(L[i] * 1e6)) | 0;

      return {
        rms: rms(1, seconds), peak: toDb(peak), windows, hash,
        spectrum: spectrum(1, seconds),
        rmsAt: Object.fromEntries([[0, 4], [3.4, 3.9], [4.1, 4.6], [7, 8.5], [10, 12]].map(([a, b]) => [`${a}-${b}`, rms(a, b)])),
        wav: btoa(bin),
      };
    }, { biome, seconds, moods, ducks });
    fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.from(r.wav, 'base64'));
    delete r.wav;
    rendered[name] = r;
    log(`${name.padEnd(24)} ${db(r.rms).padStart(9)} rms, peak ${db(r.peak).padStart(9)}, centroid ${String(Math.round(r.spectrum.centroid)).padStart(5)} Hz, low ${(r.spectrum.low * 100).toFixed(1)}%`);
  }

  /* ---------------- the checks, offline ---------------- */
  for (const b of BIOMES) {
    const r = rendered[`${b}-calm`];
    check(r.rms > -52 && r.rms < -26, `${b}: audible and under the voices (${db(r.rms)} rms)`);
    check(r.peak < -3, `${b}: no clipping (peak ${db(r.peak)})`);
  }
  const c = (n) => rendered[n].spectrum.centroid;
  check(c('desert-calm') > c('dungeon-calm') && c('deep-forest-calm') > c('dungeon-calm'),
    `the desert's hiss and the forest's insects sit above the dungeon's room (${Math.round(c('desert-calm'))}, ${Math.round(c('deep-forest-calm'))} vs ${Math.round(c('dungeon-calm'))} Hz)`);
  // No two settings alike: the octave profiles, compared pairwise.
  let closest = { d: Infinity, pair: '' };
  for (let i = 0; i < BIOMES.length; i += 1) {
    for (let j = i + 1; j < BIOMES.length; j += 1) {
      const a = rendered[`${BIOMES[i]}-calm`].spectrum.octaves;
      const b = rendered[`${BIOMES[j]}-calm`].spectrum.octaves;
      const d = a.reduce((s, x, k) => s + Math.abs(x - b[k]), 0);
      if (d < closest.d) closest = { d, pair: `${BIOMES[i]} and ${BIOMES[j]}` };
    }
  }
  check(closest.d > 0.2, `no two settings alike: the closest pair, ${closest.pair}, differ by ${closest.d.toFixed(2)} of their octave profile`);
  check(rendered['frozen-pass-calm'].hash === rendered['frozen-pass-calm-again'].hash, 'the same seed renders the same samples');

  check(c('frozen-pass-one-strike') < c('frozen-pass-calm') && c('frozen-pass-found') < c('frozen-pass-one-strike'),
    `threat closes the sound in: centroid ${Math.round(c('frozen-pass-calm'))} → ${Math.round(c('frozen-pass-one-strike'))} → ${Math.round(c('frozen-pass-found'))} Hz`);
  const low = (n) => rendered[n].spectrum.low;
  check(low('frozen-pass-one-strike') > low('frozen-pass-calm') * 1.5 && low('frozen-pass-found') > low('frozen-pass-one-strike'),
    `and a low pulse comes in: energy under 120 Hz ${(low('frozen-pass-calm') * 100).toFixed(1)}% → ${(low('frozen-pass-one-strike') * 100).toFixed(1)}% → ${(low('frozen-pass-found') * 100).toFixed(1)}%`);
  const spread = (n) => {
    const w = rendered[n].windows.slice(8);
    const m = w.reduce((s, x) => s + x, 0) / w.length;
    return Math.sqrt(w.reduce((s, x) => s + (x - m) ** 2, 0) / w.length);
  };
  // The hush against the same mood without it, both a strike in, measured
  // above the pulse.
  check(spread('frozen-pass-near') < spread('frozen-pass-one-strike'),
    `one strike short, the air goes still: the wind moves ${spread('frozen-pass-near').toFixed(2)} dB against ${spread('frozen-pass-one-strike').toFixed(2)} dB`);
  check(c('frozen-pass-far-side') > c('frozen-pass-calm'),
    `the far side opens it: centroid ${Math.round(c('frozen-pass-calm'))} → ${Math.round(c('frozen-pass-far-side'))} Hz`);
  const warm = (n) => rendered[n].spectrum.warm;
  check(warm('frozen-pass-through') > warm('frozen-pass-far-side') * 1.2,
    `through, it warms: the chord's band ${(warm('frozen-pass-far-side') * 100).toFixed(1)}% → ${(warm('frozen-pass-through') * 100).toFixed(1)}%`);
  const lost = rendered['frozen-pass-lost'].rmsAt;
  check(lost['10-12'] < lost['0-4'] - 30,
    `lost, it goes out with the light: ${db(lost['0-4'])} → ${db(lost['10-12'])}`);
  const duck = rendered['frozen-pass-duck'].rmsAt;
  check(duck['4.1-4.6'] < duck['3.4-3.9'] - 6,
    `a voice ducks it: ${db(duck['3.4-3.9'])} → ${db(duck['4.1-4.6'])}`);
  check(Math.abs(duck['7-8.5'] - duck['3.4-3.9']) < 4,
    `and it comes back: ${db(duck['7-8.5'])}`);

  /* ---------------- live ---------------- */
  // The module the app itself loaded: after a hot reload Vite serves it
  // under a ?t= address, and a plain import would get a fresh, silent copy.
  const bedNowIn = (pg) => pg.evaluate(async () => {
    const hit = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/stage/bed.ts')).pop();
    if (!hit) return 'not loaded';
    return (await import(hit)).bedNow();
  });
  const now = () => bedNowIn(page);
  const until = async (fn, ms = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await fn()) return true; await page.waitForTimeout(150); }
    return false;
  };

  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Set up a crossing' }).first().click();
  await page.waitForTimeout(500);
  check(await page.locator('.t-soundask').isVisible(), 'the threshold asks, once: "Play with sound?"');
  await page.screenshot({ path: path.join(out, 'threshold-asks.png') });
  check((await now()) === null, 'and nothing plays before it is answered');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  const chosenDoor = await page.locator('.t-doors__track [aria-checked="true"]').getAttribute('data-biome');
  check(await until(async () => (await now())?.biome === chosenDoor), `"Sound on": the chosen door's air plays (${chosenDoor})`);
  const n0 = await now();
  check(n0?.state === 'running', `the audio is running (${n0?.state})`);
  check(!(await page.locator('.t-soundask').count()), 'and the question is gone');
  const other = await page.locator(`.t-doors__track [data-biome]:not([data-biome="${chosenDoor}"])`).first().getAttribute('data-biome');
  await page.locator(`.t-doors__track [data-biome="${other}"]`).click();
  check(await until(async () => (await now())?.biome === other), `another door, another air (${other})`);
  await page.reload();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Set up a crossing' }).first().click();
  await page.waitForTimeout(500);
  check(await page.locator('.t-hero').count() > 0 && !(await page.locator('.t-soundask').count()), 'a reload does not ask again');
  await page.mouse.click(5, 5); // the first touch wakes a reloaded page's audio
  check(await until(async () => (await now())?.state === 'running'), 'and the first touch wakes its audio');

  await page.getByRole('button', { name: /^Start the crossing$/ }).first().click();
  await page.waitForSelector('.t-table', { timeout: 10000 });
  await page.waitForTimeout(250);
  const opening = await now();
  check(opening?.biome === other && opening.heard < 0.5,
    `the board takes the same bed over, cut into the opening's dark (heard at ${opening?.heard.toFixed(2)})`);
  await page.waitForTimeout(4500);
  const lit = await now();
  check((lit?.heard ?? 0) > 0.9, `and it comes up with the light (heard at ${lit?.heard.toFixed(2)})`);
  check((lit?.ducks ?? 0) > (n0?.ducks ?? 0), `the voices ducked it on the way: ${lit?.ducks} times`);

  await page.getByRole('button', { name: 'GM', exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('.t-drawer__body').getByRole('button', { name: 'Sound on' }).click();
  check(await until(async () => (await now()) === null), 'the switch in the GM drawer stops it');
  await page.keyboard.press('Escape');

  // "Not now" is an answer too.
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(url);
  await p2.evaluate(() => localStorage.clear());
  await p2.goto(url);
  await p2.waitForTimeout(400);
  await p2.getByRole('button', { name: 'Set up a crossing' }).first().click();
  await p2.waitForTimeout(400);
  await p2.getByRole('button', { name: 'Not now' }).click();
  await p2.waitForTimeout(300);
  const kept = await p2.evaluate(() => localStorage.getItem('mazedeck.sound'));
  const silent = await bedNowIn(p2);
  await p2.reload();
  await p2.waitForTimeout(500);
  await p2.getByRole('button', { name: 'Set up a crossing' }).first().click();
  await p2.waitForTimeout(400);
  check(kept === 'off' && silent === null && !(await p2.locator('.t-soundask').count()),
    '"Not now" is kept: silent, and not asked again');

  fs.writeFileSync(path.join(out, 'sound.log'), `${lines.join('\n')}\n`);
  await browser.close();
  if (failed) process.exit(1);
})().catch((e) => { log(`fatal: ${e.message}`); fs.writeFileSync(path.join(out, 'sound.log'), `${lines.join('\n')}\n`); process.exit(1); });

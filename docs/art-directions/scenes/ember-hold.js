/* The Ember Hold: a dwarven forge under a volcano. A: the lava fields outside; B: the forge hall inside. */
(() => {
  const { C, Painter, put, particles, flicker, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => v - Math.floor(v);
  /** Smooth noise, 0..1, in one and two dimensions, and a few octaves of it. */
  const n1 = (x, s = 0) => { const i = Math.floor(x); return lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(x - i)); };
  const n2 = (x, y, s = 0) => {
    const i = Math.floor(x); const j = Math.floor(y); const fx = smooth(x - i); const fy = smooth(y - j);
    return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), fx), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), fx), fy);
  };
  const fbm = (x, y, s = 0) => 0.55 * n2(x, y, s) + 0.3 * n2(x * 2.03, y * 2.03, s + 7) + 0.15 * n2(x * 4.1, y * 4.1, s + 13);

  /** The nearest two of a jittered grid of points: their distances and the nearest's id (unit space, scaled by ax, ay). */
  function vor(fx, fy, seed, ax = 1, ay = 1) {
    const gx = Math.floor(fx); const gy = Math.floor(fy);
    let d1 = 1e9; let d2 = 1e9; let id = 0;
    for (let j = -1; j <= 1; j += 1) {
      for (let k = -1; k <= 1; k += 1) {
        const cx = gx + k; const cy = gy + j;
        const px = cx + 0.12 + hash(cx, cy, seed) * 0.76; const py = cy + 0.12 + hash(cx, cy, seed + 1) * 0.76;
        const d = Math.hypot((fx - px) * ax, (fy - py) * ay);
        if (d < d1) { d2 = d1; d1 = d; id = cx * 7349 + cy * 13; } else if (d < d2) d2 = d;
      }
    }
    return { d1, d2, id };
  }

  function vignette(p, W, H, k = 2, cy = 0.45, skipZ = -1) {
    p.shade(null, (x, y, i) => (p.z[i] === skipZ ? 0 : -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55)));
  }

  /** How bright a pixel will look (0..1), from its ramp and value, before lights that flicker. */
  function luma(p, i) {
    const ramp = p.cols[p.r[i]]; const c = ramp[clamp(Math.round(p.v[i]), 0, ramp.length - 1)];
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  }

  /** A figure on layers zs backlit: its pixels touching anything brighter than thr become a rim of (ramp, v). */
  function glowRim(p, zs, thr, ramp, v) {
    const R = p.ri(ramp); const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x;
        if (!zs.includes(p.z[i])) continue;
        for (const j of [i - 1, i + 1, i - p.w, i + p.w]) {
          if (!zs.includes(p.z[j]) && luma(p, j) > thr) { hit.push(i); break; }
        }
      }
    }
    for (const i of hit) { p.r[i] = R; p.v[i] = v; }
    return hit.length;
  }

  /** A figure's whole outline faintly warmed by the glow all round it: its edge pixels take (ramp, v). */
  function rimAll(p, zs, ramp, v, only = zs) {
    const R = p.ri(ramp); const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x;
        if (!only.includes(p.z[i])) continue;
        if (!zs.includes(p.z[i - 1]) || !zs.includes(p.z[i + 1]) || !zs.includes(p.z[i - p.w])) hit.push(i);
      }
    }
    for (const i of hit) { p.r[i] = R; p.v[i] = v; }
  }

  /** A limb or body along a spine: pts [[x, y, halfWidth], ...] → a closed outline. */
  function tube(pts) {
    const L = []; const R = [];
    for (let k = 0; k < pts.length; k += 1) {
      const a = pts[Math.max(0, k - 1)]; const b = pts[Math.min(pts.length - 1, k + 1)];
      let dx = b[0] - a[0]; let dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const [x, y, w] = pts[k];
      L.push([x - dy * w, y + dx * w]); R.push([x + dy * w, y - dx * w]);
    }
    return C.poly([...L, ...R.reverse()]);
  }

  /**
   * Lava that moves: two fields over one ramp's pixels whose weights turn
   * through a cosine and a sine, so their sum is a wave crawling along `phase`.
   */
  function crawl(p, ramp, phase, amp, speed, within) {
    const R = p.ri(ramp); const N = p.w * p.h;
    const fs = new Float32Array(N); const fc = new Float32Array(N);
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.r[i] !== R || (within && !within(x, y, i))) continue;
        const ph = phase(x, y);
        fs[i] = Math.sin(ph) * amp; fc[i] = Math.cos(ph) * amp;
      }
    }
    p.fields.push({ f: fs, k: (t) => Math.cos(t * speed) }, { f: fc, k: (t) => -Math.sin(t * speed) });
  }

  /** Embers raining: sparks falling slowly and drifting with the wind, each pulsing. */
  function emberRain(img, n, area, t, seed, cols, o = {}) {
    const r = rng(seed); const [ax, ay, aw, ah] = area;
    const fall = o.fall ?? 4; const wind = o.wind ?? 2.2;
    for (let i = 0; i < n; i += 1) {
      const bx = r() * aw; const by = r() * ah; const ph = r() * 6.283; const sp = 0.5 + r();
      const y = (by + t * fall * sp) % ah;
      const x = (((bx + t * wind * sp + Math.sin(t * 1.4 * sp + ph) * 2) % aw) + aw) % aw;
      const a = clamp(0.45 + 0.55 * Math.sin(t * 3.1 * sp + ph), 0, 1) * (o.a ?? 1);
      put(img, ax + x, ay + y, sp > 1.25 ? cols[0] : cols[1], a);
    }
  }

  /** Heat haze: rows slide a pixel back and forth, only where the layer is <= zMax. */
  function haze(img, p, y0, y1, t, zMax, k = 1) {
    const W = img.width; const d = img.data; const row = new Uint8ClampedArray(W * 4);
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(img.height, Math.round(y1)); y += 1) {
      const sh = Math.round((Math.sin(t * 2.7 + y * 1.7) * 0.8 + Math.sin(t * 4.3 + y * 0.6) * 0.45) * k);
      if (!sh) continue;
      row.set(d.subarray(y * W * 4, (y + 1) * W * 4));
      for (let x = 0; x < W; x += 1) {
        const sx = x - sh; if (sx < 0 || sx >= W) continue;
        if (p.z[y * W + x] > zMax || p.z[y * W + sx] > zMax) continue;
        const o = (y * W + x) * 4; const so = sx * 4;
        d[o] = row[so]; d[o + 1] = row[so + 1]; d[o + 2] = row[so + 2];
      }
    }
  }

  /* ---------- the shared materials: the same lava, basalt and black glass inside and out ---------- */

  // Lava runs orange to gold to white-hot, and never toward red: red is the Monster's.
  const LAVA = ['#1A0C05', '#2E1406', '#4A2108', '#6B340B', '#934C0E', '#BC6414', '#DC821E', '#EFA230', '#F8C25A', '#FCDD8E', '#FFF3CA'];
  // Basalt: near black and colourless in the dark, warming to amber where the lava lights it.
  const BASALT = ['#050405', '#0A0809', '#110D0D', '#191312', '#231A16', '#30221A', '#412D1F', '#573B25', '#734C2B', '#956232', '#BC7E3C'];
  // Black glass: cold and black, until an edge catches the lava and flashes gold.
  const GLASS = ['#030304', '#07070A', '#0C0C11', '#14141A', '#1E1D23', '#2B2A2E', '#4E3A2A', '#8C6032', '#D49A46', '#FCD98C'];
  const SHADOW = ['#020202', '#060505', '#0B0908', '#110E0C'];
  const STEAM = ['#1E1A17', '#3A332D', '#5A5049', '#7F756C', '#A59B90', '#CBC2B6'];

  /* ---------- the creatures and things a card becomes ---------- */

  /**
   * The salamander: a great fire lizard low on four splayed legs, its head
   * raised on a thick neck, jaw open on a red throat, horns swept back, a
   * crest of spines from neck to tail and the tail curled up behind. Black
   * (`ramp` at `v`), red eyes. Facing left (face 1) or right (-1). `s` is its
   * height to the top of the head; it is about 1.7 s long.
   */
  function salamander(p, cx, fy, s, o = {}) {
    const z = o.z ?? 6; const f = o.face ?? 1; const B = o.ramp || 'shadow'; const v = o.v ?? 0.6;
    const T = (pts) => pts.map(([x, y, w = 0]) => [cx + x * s * f, fy + y * s, w * s]);
    const part = (pts, dv = 0) => p.fill(tube(T(pts)), B, v + dv, z);
    const tail = [[0.36, -0.3, 0.1], [0.54, -0.26, 0.085], [0.7, -0.27, 0.068], [0.84, -0.35, 0.055], [0.92, -0.48, 0.044], [0.89, -0.61, 0.034], [0.8, -0.67, 0.024], [0.72, -0.63, 0.012]];
    const body = [[0.42, -0.3, 0.1], [0.24, -0.34, 0.13], [0.04, -0.38, 0.135], [-0.14, -0.41, 0.12], [-0.27, -0.45, 0.1]];
    const neck = [[-0.25, -0.44, 0.1], [-0.34, -0.55, 0.09], [-0.4, -0.66, 0.085]];
    const head = [[-0.37, -0.73, 0.08], [-0.48, -0.78, 0.074], [-0.6, -0.77, 0.055], [-0.72, -0.74, 0.03]];
    const jaw = [[-0.4, -0.65, 0.05], [-0.52, -0.61, 0.034], [-0.65, -0.56, 0.016]];
    part([[-0.12, -0.38, 0.05], [-0.05, -0.22, 0.04], [-0.09, -0.04, 0.034]], -0.25); // the far foreleg
    part([[0.38, -0.3, 0.06], [0.48, -0.17, 0.046], [0.45, -0.04, 0.036]], -0.25);  // the far hind leg
    part(tail); part(body); part(neck); part(head); part(jaw);
    part([[-0.22, -0.38, 0.066], [-0.36, -0.21, 0.052], [-0.32, -0.04, 0.042]]);    // the near foreleg, elbow out
    part([[0.28, -0.32, 0.08], [0.15, -0.16, 0.058], [0.21, -0.04, 0.044]]);        // the near hind leg
    // Feet: flat, splayed forward, three claws each.
    for (const [x, dv] of [[-0.32, 0], [0.21, 0], [-0.09, -0.25], [0.45, -0.25]]) {
      p.fill(C.poly(T([[x + 0.05, 0.005], [x + 0.04, -0.05], [x - 0.03, -0.055], [x - 0.11, 0.005]])), B, v + dv, z);
      for (const k of [0, 1]) p.fill(C.poly(T([[x - 0.06 - k * 0.035, 0.005], [x - 0.08 - k * 0.035, 0.03], [x - 0.1 - k * 0.035, 0.005]])), B, v + dv, z);
    }
    // Spines from the neck down the tail, longest over the shoulders.
    const path = [...tail.slice(1, 6).reverse(), ...body.slice(1), ...neck.slice(1)];
    for (let k = 1; k < path.length - 1; k += 1) {
      const [x, y, w] = path[k]; const [ax, ay] = path[k - 1]; const [bx, by] = path[k + 1];
      const tl = Math.hypot(bx - ax, by - ay) || 1; const tx = (bx - ax) / tl; const ty = (by - ay) / tl;
      let nx = ty; let ny = -tx; if (ny > 0) { nx = -nx; ny = -ny; }
      const len = 0.05 + 0.07 * clamp(1 - Math.abs(k - 7) / 6, 0, 1);
      const b0 = [x + nx * w * 0.7 - tx * 0.035, y + ny * w * 0.7 - ty * 0.035];
      const b1 = [x + nx * w * 0.7 + tx * 0.035, y + ny * w * 0.7 + ty * 0.035];
      const tip = [x + nx * (w + len) - tx * 0.045, y + ny * (w + len) - ty * 0.045];
      p.fill(C.poly(T([b0, tip, b1])), B, v, z);
    }
    // Two horns swept back from the crown.
    p.fill(C.poly(T([[-0.42, -0.79], [-0.27, -0.95], [-0.36, -0.83]])), B, v, z);
    p.fill(C.poly(T([[-0.5, -0.82], [-0.4, -0.99], [-0.46, -0.84]])), B, v, z);
    // The throat, red between the jaws; the eye under a ridge of brow.
    p.fill(C.poly(T([[-0.42, -0.7], [-0.66, -0.705], [-0.6, -0.63], [-0.43, -0.665]])), o.eyes, 2, z + 1);
    const [ex, ey] = T([[-0.55, -0.8]])[0];
    p.fill(C.rect(Math.round(ex) - (f > 0 ? 1 : 0), Math.round(ey), 2, 1), o.eyes, 4, z + 2);
    return { hx: cx - 0.56 * s * f, hy: fy - 0.72 * s };
  }

  /**
   * A dwarf smith: broad and short, a hood over a great forked beard, a
   * hammer over the right shoulder and a lantern held up and out in the left
   * hand. The beard catches the lantern's light, in `lit` (the card's ramp).
   * Returns where the lantern hangs.
   */
  function smith(p, cx, fy, s, o = {}) {
    const z = o.z ?? 6; const f = o.face ?? 1; const B = o.ramp || 'shadow'; const v = o.v ?? 0.7; const Lr = o.lit || B;
    const T = (pts) => pts.map(([x, y, w = 0]) => [cx + x * s * f, fy + y * s, w * s]);
    const P = (pts) => C.poly(T(pts));
    p.fill(P([[-0.25, 0], [-0.23, -0.1], [-0.05, -0.1], [-0.04, 0]]), B, v, z);
    p.fill(P([[0.05, 0], [0.06, -0.1], [0.23, -0.1], [0.26, 0]]), B, v, z);
    // The coat, wide at the hem, belted; the hammer arm down to the haft, the lantern arm raised.
    p.fill(P([[-0.3, -0.08], [-0.34, -0.36], [-0.31, -0.6], [-0.21, -0.69], [0.21, -0.69], [0.31, -0.6], [0.34, -0.36], [0.3, -0.08]]), B, v, z);
    p.fill(tube(T([[0.25, -0.62, 0.085], [0.32, -0.5, 0.07], [0.27, -0.42, 0.06]])), B, v, z);
    p.fill(tube(T([[-0.24, -0.63, 0.085], [-0.37, -0.69, 0.068], [-0.47, -0.79, 0.056]])), B, v, z);
    // The hood and the head in it.
    p.fill(P([[-0.16, -0.68], [-0.18, -0.82], [-0.11, -0.94], [0.02, -0.98], [0.13, -0.93], [0.18, -0.81], [0.16, -0.68]]), B, v, z);
    // The hammer on the shoulder: a haft up and back, a heavy head with a lit face.
    p.fill(tube(T([[0.26, -0.43, 0.026], [0.42, -1.02, 0.026]])), B, v, z);
    const [hx, hy] = T([[0.42, -1.02]])[0];
    const ang = Math.atan2(-0.59, 0.16 * f) + Math.PI / 2; const ca = Math.cos(ang); const sa = Math.sin(ang);
    const hw = 0.16 * s; const hh = 0.075 * s;
    p.fill(C.poly([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [hx + x * ca - y * sa, hy + x * sa + y * ca])), B, v, z);
    // The beard, forked and banded, lit by the lantern.
    const beard = P([[-0.14, -0.77], [-0.15, -0.66], [-0.11, -0.52], [-0.045, -0.39], [0, -0.48], [0.045, -0.39], [0.11, -0.52], [0.15, -0.66], [0.14, -0.77]]);
    p.fill(beard, B, v + 1.2, z + 1);
    // Its strands: dark bands across, and the side toward the lantern catching the light.
    p.each(beard, (x, y, i) => {
      const k = (fy - y) / s; const side = ((x + 0.5 - cx) * f) / s;
      if ((k > 0.585 && k < 0.615) || (k > 0.485 && k < 0.515)) { p.v[i] = 0.2; return; }
      p.r[i] = p.ri(Lr); p.v[i] = side < -0.08 ? 2.2 : side < 0.02 ? 1.5 : 0.9;
    });
    p.fill(P([[-0.09, -0.85], [0.09, -0.85], [0.08, -0.77], [-0.08, -0.77]]), B, 0, z + 1); // the face, lost in the hood
    // The lantern, hanging from the raised hand.
    const [lx, ly] = T([[-0.48, -0.77]])[0];
    const X = Math.round(lx); const Y = Math.round(ly);
    p.fill(C.rect(X, Y, 1, 2), B, v + 1, z + 1);
    p.fill(C.rect(X - 2, Y + 2, 5, 1), B, v + 1.2, z + 1);
    p.fill(C.rect(X - 2, Y + 3, 1, 4), B, v + 1, z + 1); p.fill(C.rect(X + 2, Y + 3, 1, 4), B, v + 1, z + 1);
    p.fill(C.rect(X - 2, Y + 7, 5, 1), B, v + 1.2, z + 1);
    return { lx: X, ly: Y + 3 };
  }

  /** A figure's edges facing a lamp, within r of it, take the lamp's colour (ramp at up to v). */
  function lampLit(p, zs, lx, ly, r, ramp, v) {
    const R = p.ri(ramp); const hit = [];
    for (let y = Math.max(1, Math.floor(ly - r)); y < Math.min(p.h - 1, ly + r); y += 1) {
      for (let x = Math.max(1, Math.floor(lx - r)); x < Math.min(p.w - 1, lx + r); x += 1) {
        const i = y * p.w + x; if (!zs.includes(p.z[i])) continue;
        const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly); if (d > r) continue;
        const sx = Math.sign(lx - x - 0.5); const sy = Math.sign(ly - y - 0.5);
        const j1 = i + sx; const j2 = i + sy * p.w;
        if ((sx && !zs.includes(p.z[j1])) || (sy && !zs.includes(p.z[j2]))) hit.push([i, d]);
      }
    }
    for (const [i, d] of hit) { p.r[i] = R; p.v[i] = v - (d / r) * 1.4; }
  }

  /**
   * A bearded axe: the head's broad crescent and its beard hooked down, on
   * a haft wrapped in bands. (ox, oy) is where the haft passes through the
   * head; `ang` turns it (0: haft hanging down), `face` mirrors the blade.
   * The blade is in the card's colour, in clean bands, its runes bright.
   */
  function runeAxe(p, ox, oy, s, ang, o) {
    const z = o.z ?? 6; const R = o.ramp; const f = o.face ?? 1;
    const ca = Math.cos(ang); const sa = Math.sin(ang);
    const X = ([x, y]) => [ox + (x * f * ca - y * sa) * s, oy + (x * f * sa + y * ca) * s];
    const W = o.wood || 'shadow'; const wv = o.woodV ?? 1.6;
    p.fill(tube([[0, -0.14], [0, o.haft ?? 0.95]].map(X).map(([x, y]) => [x, y, 0.045 * s])), W, wv, z);
    for (let k = 0.32; k < (o.haft ?? 0.95) - 0.05; k += 0.14) p.fill(tube([[0, k], [0, k + 0.04]].map(X).map(([x, y]) => [x, y, 0.046 * s])), W, wv + 1.4, z);
    const blade = [[-0.05, -0.12], [0.12, -0.15], [0.3, -0.27], [0.41, -0.14], [0.44, 0.04], [0.4, 0.2], [0.32, 0.34], [0.25, 0.25], [0.16, 0.1], [0.05, 0.07], [-0.05, 0.07]];
    p.fill(C.poly(blade.map(X)), R, (x, y) => {
      const lx = (((x + 0.5 - ox) * ca + (y + 0.5 - oy) * sa) / s) * f;
      return lx > 0.39 ? 4.2 : lx > 0.29 ? 3.3 : lx > 0.15 ? 2.4 : 1.5;
    }, z + 1);
    // The poll behind the haft.
    p.fill(C.poly([[-0.05, -0.12], [-0.13, -0.09], [-0.13, 0.04], [-0.05, 0.07]].map(X)), R, 1.2, z + 1);
    const marks = [[[0.17, -0.07], [0.17, 0.07]], [[0.17, -0.01], [0.22, -0.06]], [[0.26, -0.11], [0.26, 0.12]], [[0.26, 0.0], [0.31, 0.06]], [[0.33, -0.09], [0.33, 0.08]], [[0.3, -0.05], [0.36, -0.05]]];
    for (const [a, b] of marks) {
      const [x0, y0] = X(a); const [x1, y1] = X(b);
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= n; k += 1) p.fill(C.rect(Math.round(lerp(x0, x1, k / n)), Math.round(lerp(y0, y1, k / n)), 1, 1), R, 4.2, z + 2);
    }
    const [bx, by] = X([0.26, 0]);
    return { bx, by };
  }

  /**
   * A shard of black glass: a leaning blade split down its ridge into two
   * faces, the one toward the light a step paler, the ridge catching a line
   * of light. Returns its outline.
   */
  function blade(p, x, base, w, h, o) {
    const r = rng(o.seed || 1); const z = o.z ?? 5; const G = p.ri('glass');
    const tip = [x + (o.lean || 0) * h, base - h];
    const kL = 0.3 + r() * 0.3; const kR = 0.25 + r() * 0.35;
    const L = [lerp(x - w / 2, tip[0], kL) - w * (0.04 + r() * 0.12), lerp(base, tip[1], kL)];
    const R = [lerp(x + w / 2, tip[0], kR) + w * (0.04 + r() * 0.12), lerp(base, tip[1], kR)];
    const sh = C.poly([[x - w / 2, base + 6], L, tip, R, [x + w / 2, base + 6]]);
    const rx = x + (r() - 0.5) * w * 0.4; const lightLeft = o.lightLeft ?? true;
    p.each(sh, (px, py, i) => {
      const t = clamp((base - py - 0.5) / h, 0, 1); const sx = lerp(rx, tip[0], t);
      const lit = (px + 0.5 < sx) === lightLeft;
      let v = lit ? o.v + (o.lit ?? 1.4) : o.v;
      if (Math.abs(px + 0.5 - sx) < 0.7 && t > 0.2) v = o.v + (o.lit ?? 1.4) + 1 + 1.6 * t;
      p.r[i] = G; p.z[i] = z; p.v[i] = v + t * (o.up ?? 0.5);
    });
    return sh;
  }

  /** Glass edges toward the light: pixels on layer z with a lower layer beside them (dx) flash gold, brighter higher up. */
  function glassEdge(p, z, dx, vTop, vBot, yTop, yBot) {
    const G = p.ri('glass'); const hit = [];
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        const nx = x + dx; if (nx < 0 || nx >= p.w) continue;
        if (p.z[i + dx] < z) hit.push([i, y]);
      }
    }
    for (const [i, y] of hit) { p.r[i] = G; p.v[i] = lerp(vTop, vBot, clamp((y - yTop) / (yBot - yTop), 0, 1)); }
  }

  /**
   * A jagged shard of black glass: an irregular leaning blade, its sides
   * chipped and notched, its tip broken off on a slant with a splinter left
   * standing, split into three facets down ridges from the break. The facet
   * toward the light is palest, the ridges catch a line of it, and a fracture
   * or two runs across the lit face.
   */
  function glassShard(p, x, base, w, h, o) {
    const r = rng(o.seed || 1); const z = o.z ?? 5; const G = p.ri('glass'); const u = o.u || 1;
    const lr = o.lightRight ? 1 : -1; const topX = x + (o.lean || 0) * h; const topY = base - h;
    const bw = w * (0.3 + r() * 0.14); const slope = (r() < 0.5 ? -1 : 1) * h * (0.05 + r() * 0.05);
    const tA = [topX - bw / 2, topY + slope / 2]; const tB = [topX + bw / 2, topY - slope / 2];
    const spR = r() < 0.5; const spH = h * (0.07 + r() * 0.05);
    const top = spR ? [tA, [tB[0] - bw * 0.42, tB[1] + 1 * u], [tB[0] - bw * 0.22, tB[1] - spH], tB] : [tA, [tA[0] + bw * 0.22, tA[1] - spH], [tA[0] + bw * 0.42, tA[1] + 1 * u], tB];
    const n = 6; const L = []; const R = [];
    for (let k = 1; k < n; k += 1) {
      const t = k / n;
      L.push([lerp(x - w / 2, tA[0], t) + (r() - 0.5) * w * 0.16 + (r() < 0.25 ? w * 0.1 : 0), lerp(base, tA[1], t)]);
      R.push([lerp(x + w / 2, tB[0], t) + (r() - 0.5) * w * 0.16 - (r() < 0.25 ? w * 0.1 : 0), lerp(base, tB[1], t)]);
    }
    const sh = C.poly([[x - w / 2, base + 4], ...L, ...top, ...R.reverse(), [x + w / 2, base + 4]]);
    const r1t = lerp(tA[0], tB[0], 0.28 + r() * 0.14); const r1b = x - w * (0.1 + r() * 0.14);
    const r2t = lerp(tA[0], tB[0], 0.62 + r() * 0.16); const r2b = x + w * (0.06 + r() * 0.16);
    p.each(sh, (px, py, i) => {
      const t = clamp((base - py - 0.5) / h, 0, 1); const X = px + 0.5;
      const a = lerp(r1b, r1t, t); const b = lerp(r2b, r2t, t);
      const f = X < a ? 0 : X < b ? 1 : 2; const lit = lr > 0 ? f : 2 - f;
      let v = o.v + o.lit * (lit / 2) * (0.6 + 0.4 * t) - (1 - t) * 0.4;
      if ((Math.abs(X - a) < 0.7 || Math.abs(X - b) < 0.7) && t > 0.25) v = o.v + o.lit * 0.6 + 1.6 * t;
      p.r[i] = G; p.z[i] = z; p.v[i] = v;
    });
    // Fractures across the lit face: short bright arcs, the way glass breaks.
    for (let k = 0; k < 2; k += 1) {
      const t = 0.35 + r() * 0.4; const yy = lerp(base, topY, t);
      const xa = lr > 0 ? lerp(r2b, r2t, t) : lerp(r1b, r1t, t);
      for (let j = 0; j < Math.round(w * 0.24); j += 1) {
        const X = Math.round(xa + lr * (j + 1)); const Y = Math.round(yy + j * 0.5 - j * j * 0.07);
        if (X < 0 || Y < 0 || X >= p.w || Y >= p.h || p.z[Y * p.w + X] !== z) continue;
        p.v[Y * p.w + X] = 5.6;
      }
    }
  }

  /** Flat tops on layer z (the broken ends of shards) catch the glow: pixels with nothing of theirs above or beside-above. */
  function glassTop(p, z, v) {
    const hit = [];
    for (let y = 1; y < p.h; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x; if (p.z[i] !== z) continue;
        const j = i - p.w; if (p.z[j] < z && p.z[j - 1] < z && p.z[j + 1] < z) hit.push(i);
      }
    }
    for (const i of hit) { p.r[i] = p.ri('glass'); p.v[i] = v; }
  }

  /* ================= A: the lava fields ================= */

  const RAMPS_A = {
    // Ash overhead, lit from beneath by the lava: black at the top, warm brown to amber toward the glow.
    ash: ['#060505', '#0B0807', '#110C0A', '#18110D', '#211711', '#2C1E15', '#3A2719', '#4C321D', '#634021', '#7E5126', '#9C652C', '#BC7C33', '#D9973F'],
    lava: LAVA, basalt: BASALT, glass: GLASS, shadow: SHADOW, steam: STEAM,
    ...CARD,
  };
  // Layers: 0 the sky, 1 the plume, 2 the volcano and far cones, 3 the plain and river, 4 the near crust,
  // 5 and 7 black glass (left and right), 8+ the card.

  /**
   * The ash sky: smoke lit from beneath by the lava fields, darkest overhead.
   * Banks of ash lie across it, dark against the glow, their undersides
   * catching it. glow: [[x, y, r, k], ...] extra light low in the sky.
   */
  function ashSky(p, W, y1, o) {
    const { u, seed = 1, v0 = 0.5, v1 = 8, pow = 2.2, thr = 0.56 } = o;
    const A = p.ri('ash');
    const sky = (x, y) => {
      let v = v0 + (v1 - v0) * clamp(y / y1, 0, 1) ** pow;
      for (const [gx, gy, r, k] of o.glow || []) { const d = Math.hypot((x - gx) / 1.8, y - gy) / r; if (d < 1) v += k * (1 - d) ** 2; }
      return v;
    };
    const sx = o.cx || 30 * u; const sy = o.cy || 5 * u;
    const cloud = (x, y) => fbm(x / sx, y / sy, seed);
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const X = x + 0.5; const Y = y + 0.5;
      const s = sky(X, Y);
      let v = s;
      const c = cloud(X, Y);
      if (c > thr) {
        v = s * 0.58 + (c > thr + 0.08 ? -0.4 : 0);
        if (cloud(X, Y + 0.9 * u) <= thr) v = s + 1.1;
        else if (cloud(X, Y + 1.9 * u) <= thr) v = s * 0.8 + 0.5;
      }
      p.r[i] = A; p.v[i] = v; p.z[i] = 0;
    });
  }

  /**
   * The plume out of the crater: billows of ash climbing and leaning with the
   * wind, each lit along its underside, brightest near the fire.
   */
  function plume(p, cx, cy, u, o) {
    const r = rng(o.seed || 'plume'); const n = o.n || 26; const lean = o.lean ?? 0.5;
    const blobs = [];
    for (let k = 0; k < n; k += 1) {
      const t = k / (n - 1); const h = t * o.h;
      blobs.push([cx + lean * h * (0.3 + t) + (r() - 0.5) * (2 + t * 7) * u, cy - h, (o.r0 + t * o.grow) * u * (0.75 + r() * 0.5), t]);
    }
    blobs.sort((a, b) => b[1] - a[1]); // the lowest first, so each billow above lays its lit underside over the one below
    for (const [x, y, rad, t] of blobs) {
      p.fill(C.circle(x, y, rad, 20), 'ash', (px, py) => {
        const k = (py + 0.5 - y) / rad;
        const b = lerp(o.vBot, o.vTop, t);
        return b + (k > 0.55 ? o.under * (1 - t * 0.8) : k > 0.2 ? o.under * 0.45 * (1 - t) : k < -0.35 ? -0.5 : 0);
      }, o.z ?? 1);
    }
  }

  /**
   * A volcano: concave flanks rising to a notched crater, ribbed by gullies
   * down the fall line, its foot warmed by the plain's glow. A tongue of lava
   * pours from the crater down its face, widening, crusted at its edges, and
   * thin rivulets run down the flanks either side. o.cool: the tongue has
   * cooled to crust.
   */
  function volcano(p, o) {
    const { cx, peak, base, hw, cw, u, z = 2, seed = 3 } = o;
    const W = p.w; const B = p.ri('basalt'); const L = p.ri('lava');
    const top = new Float32Array(W);
    for (let x = 0; x < W; x += 1) {
      const d = Math.abs(x + 0.5 - cx);
      let y;
      if (d < cw) y = peak + (d < cw * 0.6 ? 1.2 * u : 0) + (hash(x, 1, seed) - 0.5) * 0.8 * u;
      else { const t = clamp((d - cw) / (hw - cw), 0, 1); y = base - (base - peak) * (1 - t) ** (o.pow ?? 2.2); }
      top[x] = y + (n1(x / (2.4 * u), seed) - 0.5) * 1.6 * u * clamp(d / (8 * u), 0, 1);
    }
    const tongue = (y) => {
      const t = clamp((y - peak) / (base - peak), 0, 1);
      return [cx + (o.tx || 0) * t + Math.sin(t * 6 + seed) * 1.4 * u * t, (0.7 + (o.tw ?? 10) * t ** (o.tp ?? 1.5)) * u, t];
    };
    const y0 = Math.max(0, Math.floor(peak - 2 * u)); const y1 = Math.min(p.h, Math.ceil(base));
    for (let y = y0; y < y1; y += 1) {
      const [tx, tw, h] = tongue(y + 0.5);
      for (let x = 0; x < W; x += 1) {
        if (y + 0.5 < top[x]) continue;
        const i = y * W + x;
        const dt = Math.abs(x + 0.5 - tx);
        if (o.tongue !== false && dt < tw) {
          const e = dt / tw;
          const fl = n2((x + 0.5 - tx) / (1.5 * u), (y + 0.5) / (1.2 * u) - h * 4, seed + 9);
          if (o.cool) { p.r[i] = B; p.v[i] = 1.5 + (fl > 0.55 ? 0.5 : 0) + (e > 0.85 ? 0.6 : 0); p.z[i] = z; continue; }
          let lv = (o.hot ?? 9.4) - e * e * 3.4 - h * 0.8;
          if (fl > 0.64 && e > 0.2) lv = 2.6 + (fl - 0.64) * 6;
          p.r[i] = L; p.v[i] = lv; p.z[i] = z; continue;
        }
        const ang = Math.atan2(x + 0.5 - cx, y + 0.5 - peak + 6 * u);
        const rib = n1(ang * (o.ribs || 14) + seed * 3, seed + 5);
        let v = (o.v ?? 1.1) + h * h * (o.foot ?? 1.4) + (rib > 0.62 ? 0.7 : rib < 0.3 ? -0.5 : 0);
        if (y + 0.5 - top[x] < 1) v += o.sky ?? 0.8;
        p.r[i] = B; p.v[i] = v; p.z[i] = z;
      }
    }
    // The crater's lip, glowing.
    if (!o.cool) {
      for (let x = Math.floor(cx - cw); x < cx + cw; x += 1) {
        if (x < 0 || x >= W) continue;
        const y = Math.ceil(top[x] - 0.5); if (y < 0 || y >= p.h) continue;
        const i = y * W + x; p.r[i] = L; p.v[i] = (o.hot ?? 9.4) - Math.abs(x + 0.5 - cx) / cw * 2.4; p.z[i] = z;
      }
    }
    // Rivulets: thin streams wandering down the flanks.
    const r = rng(seed);
    for (let k = 0; k < (o.cool ? 0 : o.rivulets ?? 6); k += 1) {
      const side = k % 2 ? 1 : -1; const x0 = cx + side * (cw * 0.6 + r() * 3 * u);
      const len = (base - peak) * (0.3 + r() * 0.6); const drift = side * (0.3 + r() * 0.5);
      for (let y = peak + 1.5 * u; y < peak + len; y += 0.5) {
        const t = (y - peak) / len;
        const x = Math.round(x0 + drift * (y - peak) + Math.sin(y / (2.2 * u) + k) * 0.8 * u); const yi = Math.round(y);
        if (x < 0 || x >= W || yi >= p.h || yi + 0.5 < top[x]) continue;
        const i = yi * W + x; if (p.r[i] === L) continue;
        p.r[i] = L; p.v[i] = (o.cool ? 4.4 : (o.rv ?? 8)) - t * 3.4; p.z[i] = z;
      }
    }
    // The tongue's light on the flanks beside it.
    if (o.tongue !== false && !o.cool) {
      for (let k = 0; k <= 6; k += 1) {
        const y = lerp(peak + 2 * u, base, k / 6); const [tx, tw] = tongue(y);
        p.light(tx, y, tw + (5 + k * 1.5) * u, o.glowK ?? 2.4, null, { zMin: z, zMax: z, hard: true });
      }
    }
    return { top, tongue };
  }

  /** A low skyline of far ridges, dark against the glow, lit along the top. */
  function ridges(p, W, at, base, o) {
    let minY = base; for (let x = 0; x < W; x += 1) minY = Math.min(minY, at(x + 0.5));
    p.fill(C.rect(0, Math.floor(minY), W, base - Math.floor(minY)), 'basalt', (x, y) => {
      const d = y + 0.5 - at(x + 0.5);
      if (d < 0) return null;
      return o.v + (d < 1 ? o.rim : 0) + clamp(d / (base - minY), 0, 1) * (o.foot || 0);
    }, o.z ?? 2);
  }

  /** The plain to the horizon: dark basalt, lava glinting far off in long thin pools. */
  function plain(p, W, y0, y1, o) {
    const { u, seed = 5 } = o; const L = p.ri('lava'); const B = p.ri('basalt');
    p.each(C.rect(0, y0, W, y1 - y0), (x, y, i) => {
      const d = clamp((y + 0.5 - y0) / (y1 - y0), 0, 1);
      const g = n2(x / ((4 + d * 9) * u), (y + 0.5) / ((0.55 + d * 0.8) * u), seed) * 0.75 + n2(x / (40 * u), 0.5, seed + 3) * 0.25;
      p.z[i] = o.z ?? 3;
      if (g > (o.thr ?? 0.66) + d * 0.04) { p.r[i] = L; p.v[i] = 5.6 + (g - 0.66) * 14 - d * 1.2; return; }
      p.r[i] = B; p.v[i] = o.v + d * (o.dv || 0) + (g > 0.6 ? 1.2 : 0);
    });
  }

  /**
   * A river of lava between two banks: hot and bright down its middle, a
   * skin of crust breaking into floes that drift on it, each floe's edge
   * glowing; the near bank's lip lit. heat(x) 0..1 thickens the crust where
   * the river is cooler.
   */
  function river(p, W, topAt, botAt, o) {
    const { u, z = 3, seed = 4 } = o; const L = p.ri('lava');
    for (let x = 0; x < W; x += 1) {
      const t0 = topAt(x + 0.5); const t1 = botAt(x + 0.5);
      const heat = o.heat ? o.heat(x + 0.5) : 1;
      for (let y = Math.max(0, Math.floor(t0)); y < Math.min(p.h, Math.ceil(t1)); y += 1) {
        const Y = y + 0.5; if (Y < t0 || Y > t1) continue;
        const e = (Y - t0) / (t1 - t0); const mid = 1 - Math.abs(e - 0.5) * 2;
        const i = y * W + x;
        let v = lerp(o.cold ?? 4.6, (o.v ?? 7) + mid * (o.mid ?? 2.4), heat);
        if (!(o.skip && o.skip(x, y))) {
          const c = vor((x + 0.5) / (o.fs * u), Y / (o.fs * (0.3 + e * 0.25) * u), seed);
          const gap = c.d2 - c.d1;
          if (hash(c.id, 0, seed) < (o.floes ?? 0.45) + (1 - heat) * 0.5 && gap > 0.1) v = 1.8 + hash(c.id, 1, seed) * 1.0 + (gap < 0.2 ? 1.6 * heat + 0.8 : 0);
        }
        p.r[i] = L; p.v[i] = v; p.z[i] = z;
      }
      // The near bank: a lip of crust catching the light.
      const yb = Math.ceil(t1 - 0.5);
      if (yb >= 0 && yb < p.h) { const i = yb * W + x; p.r[i] = p.ri('basalt'); p.v[i] = (o.lip ?? 6) - (1 - heat) * 1.5; p.z[i] = z; }
    }
  }

  /**
   * Cooled crust on the ground, seen in perspective: plates split by cracks
   * that glow from beneath, each plate catching the glow along its edges,
   * dark in its middle. Rows crowd toward the vanishing point (vx, vy);
   * some cracks have gone cold (`dead`).
   */
  function plates(p, shape, o) {
    const L = p.ri('lava'); const B = p.ri('basalt'); const seed = o.seed || 6; const J = o.joint ?? 0.9;
    p.each(shape, (x, y, i) => {
      const d = y + 0.5 - o.vy; if (d <= 0) return;
      const fy = Math.log(d / o.d0) * o.k; const fx = ((x + 0.5 - o.vx) / d) * o.cw;
      const c = vor(fx, fy, seed, d / o.cw, d / o.k);
      const gap = c.d2 - c.d1;
      const dep = clamp((y - o.y0) / (o.y1 - o.y0), 0, 1);
      p.z[i] = o.z ?? 4;
      if (gap < J) {
        // A crack: cold where the two plates' ids say so, else glowing.
        const cold = hash(Math.min(c.id, 99991), Math.round(fx * 3 + fy * 2), seed + 4) < (o.dead ?? 0);
        if (cold) { p.r[i] = B; p.v[i] = o.v - 0.6; return; }
        p.r[i] = L; p.v[i] = o.crack(x, y, dep); return;
      }
      p.r[i] = B;
      p.v[i] = o.v + (hash(c.id, 1, seed) - 0.5) * (o.vary ?? 0.6) + (o.rim ?? 1.4) * Math.max(0, 1 - (gap - J) / (o.rimW ?? 1.8)) * (1 - dep * (o.rimFade ?? 0.5));
    });
  }

  /** A field of black glass shards along the near ground, rising toward the edges and clear of the middle. */
  function shards(p, W, base, u, o) {
    const rr = rng(o.seed); const list = [];
    for (let x = -8 * u; x < W + 12 * u; x += (o.gap[0] + rr() * o.gap[1]) * u) {
      const d = Math.abs(x - o.cx);
      if (d < o.clear) continue;
      const lift = clamp((d - o.clear) / o.rise, 0, 1);
      const h = (o.h[0] + lift * o.h[1] + rr() * o.h[2]) * u; const w = h * (0.45 + rr() * 0.35);
      const left = x < o.cx;
      list.push({ x, h, w, lean: (left ? 1 : -1) * (0.06 + rr() * 0.22) * (rr() < 0.3 ? -1 : 1), by: base + rr() * (o.drop || 3) * u, seed: Math.floor(rr() * 1e6), left });
      // A smaller blade leaning against it.
      if (rr() < 0.6) list.push({ x: x + (rr() - 0.5) * w * 1.2, h: h * (0.35 + rr() * 0.3), w: w * 0.6, lean: (rr() - 0.5) * 0.7, by: base + (1 + rr() * 3) * u, seed: Math.floor(rr() * 1e6), left });
    }
    list.sort((a, b) => b.h - a.h);
    for (const s of list) blade(p, s.x, s.by, s.w, s.h, { lean: s.lean, z: s.left ? 5 : 7, v: o.v, lit: o.lit, seed: s.seed, lightLeft: !s.left, up: o.up });
    return list;
  }

  /**
   * An arched bridge of rock over the river, seen three-quarters on: from
   * its foot on the near bank (x0, y0) to its foot on the far bank (x1, y1).
   * Its deck catches the light on top; under the deck's edge its side wall
   * drops to the arch, the arch's underside lit by the lava beneath. Between
   * tb0 and tb1 it has fallen: jagged ends, and the broken span tilted in the
   * river below. Drawn in the Obstacle's colour.
   */
  function brokenBridge(p, o) {
    const { x0, y0, x1, y1, Dn, Df, u, ramp, z, tb0, tb1, n = 3 } = o;
    const R = p.ri(ramp);
    const jag = (y, s) => (hash(Math.round(y / Math.max(1, 1.2 * u)), 2, s) - 0.5) * 0.07;
    const pitch = Math.max(2, 2.6 * u); const pw = 0.17;
    for (let x = Math.floor(Math.min(x0, x1) - 3 * u); x < Math.max(x0, x1) + 3 * u; x += 1) {
      if (x < 0 || x >= p.w) continue;
      const t = (x + 0.5 - x0) / (x1 - x0);
      if (t < -0.02 || t > 1.02) continue;
      const tc = clamp(t, 0, 1); const g = lerp(y0, y1, tc); const D = lerp(Dn, Df, tc);
      const yt = g - D;
      // The arch over this column, if any: a round opening between two piers.
      const s = tc * n; const f = s - Math.min(n - 1, Math.floor(s));
      let yv = Infinity;
      if (f > pw && f < 1 - pw) { const q = (f - pw) / (1 - 2 * pw); yv = g + 1 * u - D * 0.66 * Math.sqrt(Math.max(0, 1 - (2 * q - 1) ** 2)); }
      const joint = ((x + 0.5 - x0) % pitch + pitch) % pitch < 1;
      for (let y = Math.max(0, Math.floor(yt - 1.8 * u)); y < Math.min(p.h, Math.ceil(g + 2 * u)); y += 1) {
        const Y = y + 0.5; if (Y < yt - 1.8 * u || Y >= yv) continue;
        if (t > tb0 + jag(y, 3) && t < tb1 + jag(y, 4)) continue;
        const i = y * p.w + x; p.r[i] = R; p.z[i] = z;
        const d = (Y - yt) / u; const toV = (yv - Y) / u;
        let v;
        if (d < -0.8) v = 3.7;                                   // the parapet's coping
        else if (d < 2.4) v = 2.8 - (joint && d > 0 ? 0.6 : 0);  // the parapet's face, in blocks
        else if (Y > g - 0.6 * u) v = 3.2;                       // where the piers stand in the lava, lit
        else if (toV < 1.1) v = 3;                               // the arch's underside, lit by the lava
        else if (toV < 3) v = 2.3 - (joint ? 0.9 : 0);           // the ring of arch stones
        else v = ((Y - yt) / (2.6 * u)) % 1 < 0.3 ? 1.1 : 1.7;  // the walls, in courses
        p.v[i] = v;
      }
    }
    // The fallen crown: blocks tilted in the lava under the gap, hot along their waterline.
    for (const [tm, w, h, a, s] of [[tb0 + 0.03, 7, 6, -0.6, 1], [tb1 - 0.04, 6, 8, 0.45, 2]]) {
      const bx = lerp(x0, x1, tm); const by = lerp(y0, y1, tm) + 1.5 * u; const ca = Math.cos(a); const sa = Math.sin(a);
      const pts = [[-w / 2, 0], [-w / 2, -h], [w / 2, -h * 0.85], [w / 2, 0]].map(([px, py]) => [bx + (px * ca - py * sa) * u, by + (px * sa + py * ca) * u]);
      p.fill(C.poly(pts), ramp, (px, py) => (py < by - h * 0.6 * u ? 3.4 : (px < bx) === (s === 1) ? 2.5 : 1.6), z + 1);
      p.fill(C.rect(bx - w * 0.7 * u, by - 0.5, w * 1.4 * u, 1.2), 'lava', 9.6, z + 2);
    }
  }

  /** Dawn after the ash: a pale gold sky, banks of ash dark across it with lit undersides, the sun low. */
  function dawnSky(p, W, y1, o) {
    const { u, seed = 1, thr = 0.6 } = o; const P = p.ri('path'); const A = p.ri('ash');
    const sx = o.cx || 30 * u; const sy = o.cy || 5 * u;
    const cloud = (x, y) => fbm(x / sx, y / sy, seed);
    const sr = o.sunR || 4.2 * u;
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const X = x + 0.5; const Y = y + 0.5; const t = clamp(Y / y1, 0, 1);
      const ds = Math.hypot(X - o.sunX, Y - o.sunY);
      let v = 0.3 + 3.2 * t ** 1.4 + 1.8 * Math.max(0, 1 - ds / (46 * u)) ** 2;
      // Rays: lighter wedges fanning out of the sun.
      if (ds > sr * 1.3 && frac(Math.atan2(Y - o.sunY, X - o.sunX) / (Math.PI * 2) * 22 + 0.25) < 0.42) v += 0.9 * Math.max(0, 1 - ds / (70 * u));
      p.z[i] = 0;
      if (ds < sr) { p.r[i] = P; p.v[i] = ds < sr - 1.2 * u ? 4.6 : 4.2; return; }
      const c = cloud(X, Y);
      if (c > thr + 0.06 * (1 - t)) {
        if (cloud(X, Y + 0.9 * u) <= thr + 0.06 * (1 - t)) { p.r[i] = P; p.v[i] = v + 0.8; return; }
        p.r[i] = A; p.v[i] = 3 + t * 3 + (c > thr + 0.12 ? -0.6 : 0) + Math.max(0, 1 - ds / (30 * u)) * 3; return;
      }
      p.r[i] = P; p.v[i] = v + Math.max(0, 1 - (ds - sr) / (3 * u)) * 0.8;
    });
  }

  /** Dark pixels round a figure: everything not on layers zs that touches it becomes (ramp, v) on layer zOut. */
  function outline(p, zs, ramp, v, zOut) {
    const R = p.ri(ramp); const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x;
        if (zs.includes(p.z[i])) continue;
        if (zs.includes(p.z[i - 1]) || zs.includes(p.z[i + 1]) || zs.includes(p.z[i - p.w]) || zs.includes(p.z[i + p.w])) hit.push(i);
      }
    }
    for (const i of hit) { p.r[i] = R; p.v[i] = v; p.z[i] = zOut; }
  }

  const A = {
    job: 0, setting: 'ember-hold', key: 'A', id: 'ember-hold-a', side: 'outside',
    name: 'The Ember Hold', title: 'The lava fields',
    pitch: 'The burning country under the mountain. A volcano smokes under a low ash sky, a tongue of lava pours down its face into a river that crosses the plain, and embers fall like rain on the black glass.',
    notes: [
      ['Light', 'All of it from the lava: the crater and the tongue down the volcano’s face, the river across the plain. The ash overhead is lit from beneath and black at the top. Everything else is basalt and black glass, dark until an edge catches the glow and flashes gold.'],
      ['Detail', 'Gullies down the cone, rivulets on its flanks, a plume of ash lit along each billow’s underside, crust floes drifting on the river, the near ground cooled into plates with glowing cracks, shards of black glass, ember rain.'],
      ['Vista', 'The plain the width of the board, the volcano behind the card. The card stands on the near bank against the lava: a salamander, a smith with a blue lantern, a rune-axe cooling in a glass rock, the arched bridge fallen into the river, and for a Clear Path the volcano gone quiet against a gold dawn, its light laid across the crusted river to your feet.'],
      ['World', 'Sky high, table low: the volcano and the river sit only at the top, then cooled crust runs dark under the table, its cracks barely warm, black glass at the edges beside two runnels of lava, embers falling.'],
    ],
    palette: ['#060505', '#2C1E15', '#634021', '#050405', '#30221A', '#14141A', '#BC6414', '#EFA230', '#FFF3CA'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['lava'], dither: 0.26 });
      const u = H / 134; const gx = W / 2;
      const hor = 84 * u; const peak = 46 * u;
      ashSky(p, W, hor, { u, seed: 3, v0: 0.3, v1: 7.2, pow: 2.3, glow: [[gx, hor, 46 * u, 2.4]], cx: 22 * u, cy: 4.5 * u });
      plume(p, gx + 1 * u, peak + 1 * u, u, { seed: 'a-back-plume', n: 22, h: 50 * u, lean: 0.42, r0: 3, grow: 8, vBot: 4.2, vTop: 1.2, under: 3.8, z: 1 });
      p.light(gx + 1 * u, peak, 16 * u, 2.2, null, { zMax: 1 });
      ridges(p, W, (x) => hor - (4 + 7 * n1(x / (9 * u), 21)) * u, hor + 1, { v: 1.4, rim: 2.4, z: 2 });
      volcano(p, { cx: gx + 1 * u, peak, base: hor + 1 * u, hw: 50 * u, cw: 4.5 * u, u, z: 2, seed: 4, tx: -3 * u, tw: 8, tp: 1.6, ribs: 16, v: 1, foot: 1.6 });
      plain(p, W, hor, 93 * u, { u, seed: 8, v: 1.6, dv: 0.4, z: 3 });
      const top = (x) => 92 * u + (n1(x / (8 * u), 31) - 0.5) * 2 * u;
      const bot = (x) => 99 * u + (n1(x / (10 * u), 32) - 0.5) * 2.4 * u;
      river(p, W, top, bot, { u, seed: 9, fs: 5, floes: 0.48, v: 6.2, mid: 2.4, lip: 6.4, heat: (x) => clamp(1 - Math.abs(x - gx) / (40 * u), 0.2, 1) });
      plates(p, C.rect(0, 99 * u, W, H - 99 * u), {
        vx: gx, vy: hor - 2 * u, d0: 16 * u, k: 4.2, cw: 3.2, joint: 0.75, v: 1.2, rim: 1.4, rimW: 1.8, y0: 99 * u, y1: H, seed: 12, z: 4, dead: 0.3,
        crack: (x, y, dep) => 6.6 - dep * 3.8,
      });
      p.light(gx, 99 * u, 44 * u, 2.8, null, { zMin: 4, zMax: 4, sy: 0.5 });
      // Black glass either side, beside the arch: jagged leaning shards, faceted, their tips broken off,
      // every edge toward the lava catching gold.
      const left = [[-3, 56, 20, -0.12, 41, 5], [9, 84, 27, 0.15, 42, 6], [22, 34, 13, 0.32, 45, 6]];
      const right = [[99, 60, 20, 0.12, 43, 7], [88, 90, 27, -0.13, 44, 8], [75, 36, 13, -0.3, 46, 8]];
      for (const [x, h, w, lean, sd, z] of left) glassShard(p, x * u, 138 * u, w * u, h * u, { lean, z, v: 1.3, lit: 2, seed: sd, lightRight: true, u });
      for (const [x, h, w, lean, sd, z] of right) glassShard(p, x * u, 138 * u, w * u, h * u, { lean, z, v: 1.3, lit: 2, seed: sd, lightRight: false, u });
      for (const z of [5, 6]) glassEdge(p, z, 1, 8.6, 5.2, 46 * u, 132 * u);
      for (const z of [7, 8]) glassEdge(p, z, -1, 8.6, 5.2, 46 * u, 132 * u);
      for (const z of [5, 6, 7, 8]) glassTop(p, z, 7);
      p.light(gx, 96 * u, 40 * u, 1.8, null, { zMin: 5 });
      vignette(p, W, H, 1.8, 0.5, 0);
      return {
        p,
        over(img) {
          emberRain(img, 30, [0, 0, W, H], 2.1, 51, ['#FCDD8E', '#DC821E'], { a: 0.95 });
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['lava', 'path'], dither: 0.26 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const hor = 50 * u; const peak = 8 * u; const fy = 86 * u;
      const top = (x) => 56 * u + (n1(x / (9 * u), 31) - 0.5) * 2 * u;
      const bot = (x) => 72 * u + (n1(x / (11 * u), 32) - 0.5) * 2.4 * u;
      // The river is hottest behind the card and crusts over toward the sides; after a Clear Path it has cooled.
      const heat = open ? () => 0.05 : (x) => clamp(1 - (Math.abs(x - gx) - 16 * u) / (50 * u), 0.06, 1);
      const sunX = gx + 1 * u; const sunY = peak + 4 * u;
      if (open) dawnSky(p, W, hor, { u, seed: 7, cx: 34 * u, cy: 4.5 * u, sunX, sunY, sunR: 8 * u });
      else ashSky(p, W, hor, { u, seed: 7, v0: 0.3, v1: 7.4, pow: 2.1, glow: [[gx, hor, 80 * u, 2.2]], cx: 34 * u, cy: 4.5 * u });
      // Far cones along the horizon, each with a dim crater glow, and a low ridge between.
      const cones = [];
      for (let d = 104; gx + d * u < W + 60 * u; d += 104) cones.push(gx - d * u, gx + (d + 22) * u);
      for (const [k, x] of cones.entries()) {
        volcano(p, { cx: x, peak: (28 + (k % 3) * 4) * u, base: hor + 1 * u, hw: 38 * u, cw: 3 * u, u, z: 2, seed: 60 + k, tongue: k % 3 === 1, tw: 3, rivulets: 2, v: 1.6, foot: 0.8, sky: open ? 2.4 : 1.2, glowK: 1.4, hot: 7.4, rv: 6.6, cool: open });
      }
      if (!open) {
        plume(p, gx + 1 * u, peak + 1 * u, u, { seed: 'a-vista-plume', n: 22, h: 22 * u, lean: 2.4, r0: 4, grow: 7, vBot: 5, vTop: 1.6, under: 3, z: 1 });
        p.light(gx, peak, 24 * u, 3.4, null, { zMax: 1 });
      }
      ridges(p, W, (x) => hor - (2 + 5 * n1(x / (14 * u), 23)) * u, hor + 1, { v: 1.4, rim: open ? 3.4 : 2.2, z: 2 });
      volcano(p, { cx: gx, peak, base: hor + 1 * u, hw: 92 * u, cw: 6 * u, u, z: 2, seed: 5, tx: -2 * u, tw: 15, tp: 1.25, ribs: 18, v: 1.1, foot: open ? 0.6 : 1.4, rivulets: 8, cool: open, glowK: 2.6, sky: open ? 2.6 : 0.8 });
      plain(p, W, hor, 57 * u, { u, seed: 13, v: 1.6, dv: 0.6, z: 3, thr: open ? 0.8 : 0.66 });
      // Where the tongue reaches the plain it pours on across it into the river.
      if (!open) {
        p.fill(C.poly([[gx - 15 * u, hor], [gx + 12 * u, hor], [gx + 15 * u, 58 * u], [gx - 18 * u, 58 * u]]), 'lava', (x, y) => {
          const e = Math.abs(x + 0.5 - gx + 1.5 * u) / (16 * u);
          return 8.8 - e * e * 3.2 + (frac((x + 0.5) / (2.2 * u) + n1(y / (2 * u), 4)) < 0.28 ? -1.6 : 0);
        }, 3);
      }
      river(p, W, top, bot, { u, seed: 11, fs: 6, floes: 0.36, v: 6.8, mid: 2.6, lip: 6.2, heat, cold: open ? 3 : 4.4 });
      // The river's light: on the near bank, the volcano's foot and the glass.
      if (!open) for (let x = (gx % (40 * u)) - 20 * u; x < W + 20 * u; x += 40 * u) p.light(x, 64 * u, 30 * u, 1.8 * heat(x), null, { zMin: 2, zMax: 7, sy: 0.55 });
      plates(p, C.rect(0, 72 * u, W, H - 72 * u), {
        vx: gx, vy: hor - 6 * u, d0: 22 * u, k: 4, cw: 3.4, joint: 0.75, v: 1.1, rim: 1.1, rimW: 2, y0: 72 * u, y1: H, seed: 14, z: 4, dead: 0.4,
        crack: (x, y, dep) => (open ? 2.6 : 4.2) - dep * 2.2 - (1 - heat(x)) * 1.2,
      });
      if (!open) p.light(gx, 73 * u, 54 * u, 2, flicker(0.4, 0.08, 0.5), { zMin: 4, zMax: 4, sy: 0.4 });
      if (open) {
        // The sun behind the quiet cone lays a road of light across the cooled crust to our feet:
        // each plate facing it a flash of gold, the seams between them dark.
        const Pr = p.ri('path'); const B = p.ri('basalt');
        for (let y = Math.floor(hor); y < H; y += 1) {
          const t = (y + 0.5 - hor) / (H - hor); const hw = (2 + t * 26) * u;
          for (let x = Math.max(0, Math.floor(gx - hw - 4 * u)); x < Math.min(W, gx + hw + 4 * u); x += 1) {
            const i = y * W + x; if (p.z[i] < 3 || p.z[i] > 4) continue;
            const e = Math.abs(x + 0.5 - gx) / hw + (n1(y / (1.2 * u), 9) - 0.5) * 0.3;
            if (e > 1) continue;
            const c = vor((x + 0.5) / ((2 + t * 6) * u), (y + 0.5) / ((0.8 + t * 2) * u), 91);
            if (c.d2 - c.d1 < 0.14) { p.r[i] = B; p.v[i] = 1.2; continue; }
            if (hash(c.id, 2, 91) < 0.75 - e * 0.5) { p.r[i] = Pr; p.v[i] = e < 0.35 ? 3.6 : e < 0.7 ? 2.8 : 2; } else { p.r[i] = B; p.v[i] = 4.4 - e * 2; }
          }
        }
        p.light(sunX, sunY + 6 * u, 70 * u, 2.4, null, { zMin: 2, zMax: 2, sx: 1.6 });
        p.light(gx, 70 * u, 50 * u, 2.2, null, { zMin: 3, zMax: 4, sy: 0.6 });
      }
      // Black glass along the near ground, rising toward the edges.
      shards(p, W, 98 * u, u, { seed: 'a-vista-glass', cx: gx, clear: 46 * u, rise: 150 * u, gap: [16, 20], h: [8, 32, 9], v: 1.3, lit: 1.6, drop: 4, up: 0.4 });
      glassEdge(p, 5, 1, open ? 8.6 : 8.2, 5.6, 30 * u, 96 * u); glassEdge(p, 7, -1, open ? 8.6 : 8.2, 5.6, 30 * u, 96 * u);
      // The card, on the near bank against the lava.
      if (cat === 'monster') {
        const s = 50 * u;
        const h = salamander(p, gx + 10 * u, 84 * u, s, { z: 9, eyes: ramp, face: 1 });
        rimAll(p, [9, 10, 11], 'lava', 4.6, [9]);
        glowRim(p, [9, 10, 11], 0.2, 'lava', 7.8);
        p.tint(h.hx + 1 * u, h.hy - 4 * u, 3 * u, hex, 0.3, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 48 * u;
        const l = smith(p, gx + 2 * u, 94 * u, s, { z: 9, face: 1, lit: ramp });
        rimAll(p, [9, 10], 'lava', 4.6, [9]);
        glowRim(p, [9, 10], 0.2, 'lava', 7.4);
        lampLit(p, [9, 10], l.lx + 0.5, l.ly + 2, 14 * u, ramp, 2.6);
        p.fill(C.rect(l.lx - 1, l.ly, 3, 4), ramp, 3.2, 11);
        p.fill(C.rect(l.lx, l.ly + 1, 1, 2), ramp, 4.4, 12);
        p.tint(l.lx + 0.5, l.ly + 2, 4 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(l.lx + 0.5, l.ly + 2, 12 * u, hex, 0.35, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        // A rune-axe left to cool, its haft wedged in a cleft of black glass, steam curling off the blade.
        const ax = runeAxe(p, gx - 4 * u, 52 * u, 40 * u, -0.2, { ramp, z: 10, face: 1, wood: 'shadow', woodV: 1.2, haft: 0.92 });
        outline(p, [10, 11, 12], 'shadow', 0, 10);
        glowRim(p, [10], 0.2, 'lava', 7.6);
        blade(p, gx - 9 * u, 94 * u, 20 * u, 15 * u, { lean: 0.25, z: 8, v: 1.4, lit: 1.6, seed: 7, lightLeft: false });
        blade(p, gx + 7 * u, 94 * u, 17 * u, 10 * u, { lean: -0.3, z: 13, v: 1.4, lit: 1.6, seed: 8, lightLeft: true });
        glowRim(p, [8, 13], 0.2, 'glass', 8);
        p.tint(ax.bx, ax.by, 4 * u, hex, 0.35, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        brokenBridge(p, { x0: gx - 40 * u, y0: 80 * u, x1: gx + 38 * u, y1: 60 * u, Dn: 26 * u, Df: 16 * u, u, ramp, z: 9, tb0: 0.42, tb1: 0.6 });
        p.tint(gx, 60 * u, 14 * u, CARD[ramp][2], 0.3, flicker(0.5, 0.12, 0.6));
      }
      vignette(p, W, H, 1.6, 0.42, 0);
      if (!open) crawl(p, 'lava', (x, y) => x / (3 * u) - y / (1.5 * u) * 0.3, 0.45, 1.6, (x, y, i) => p.z[i] === 3 && y > hor);
      return {
        p,
        over(img, t) {
          if (!open) haze(img, p, hor - 6 * u, 58 * u, t, 3, 0.8);
          emberRain(img, Math.round(W / (open ? 14 : 6)), [0, 0, W, H], t, 61, ['#FCDD8E', '#DC821E'], { a: 0.9 });
          if (cat === 'item') {
            for (const q of particles('mote', 10, [gx + 2 * u, 26 * u, 18 * u, 30 * u], t, 73)) put(img, q.x, q.y, STEAM[q.big ? 5 : 4], q.a * 0.6);
            for (const q of particles('mote', 6, [gx - 6 * u, 30 * u, 26 * u, 30 * u], t, 74)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          }
          if (open) for (const q of particles('mote', 18, [gx - 20 * u, 40 * u, 60 * u, 40 * u], t, 75)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a * 0.8);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['lava'], dither: 0.26 });
      const u = H / 250; const gx = W / 2;
      const hor = 52 * u;
      ashSky(p, W, hor, { u, seed: 17, v0: 0.6, v1: 7, pow: 2, glow: [[gx, hor, 120 * u, 2]], cx: 40 * u, cy: 6 * u });
      plume(p, gx + 2 * u, 22 * u, u, { seed: 'a-world-plume', n: 16, h: 24 * u, lean: 1.6, r0: 3, grow: 7, vBot: 4, vTop: 1.6, under: 2.2, z: 1 });
      for (const [k, x] of [-150, -78, 96, 170].entries()) {
        volcano(p, { cx: gx + x * u, peak: (36 + (k % 2) * 5) * u, base: hor + 1 * u, hw: 34 * u, cw: 2.5 * u, u, z: 2, seed: 80 + k, tongue: false, rivulets: 2, v: 1.6, foot: 0.6, sky: 1.2, hot: 7, rv: 6 });
      }
      volcano(p, { cx: gx + 2 * u, peak: 22 * u, base: hor + 1 * u, hw: 70 * u, cw: 4 * u, u, z: 2, seed: 81, tx: -2 * u, tw: 9, ribs: 16, v: 1.1, foot: 1.3, rivulets: 6 });
      plain(p, W, hor, 60 * u, { u, seed: 19, v: 1.5, dv: 0.5, z: 3 });
      const top = (x) => 60 * u + (n1(x / (14 * u), 41) - 0.5) * 3 * u;
      const bot = (x) => 71 * u + (n1(x / (16 * u), 42) - 0.5) * 3 * u;
      river(p, W, top, bot, { u, seed: 21, fs: 8, floes: 0.45, v: 6.4, mid: 2.4, lip: 5, heat: (x) => clamp(1 - Math.abs(x - gx) / (200 * u), 0.3, 1) });
      // The crust under the table: small plates in perspective, their cracks dimming to embers toward us.
      plates(p, C.rect(0, 72 * u, W, H - 72 * u), {
        vx: gx, vy: hor - 6 * u, d0: 22 * u, k: 5, cw: 4.4, joint: 0.7, v: 1.1, rim: 0.9, rimW: 2, y0: 72 * u, y1: H, seed: 23, z: 4, rimFade: 0.6, dead: 0.45,
        crack: (x, y, dep) => {
          const edge = clamp(1 - (Math.min(x, W - x) - 8) / 14, 0, 1);
          return Math.min(1.45, 1.1 + dep * 4) + edge * 4;
        },
      });
      // The river's glow down onto the crust, fading fast.
      p.light(gx, 66 * u, 140 * u, 1.6, flicker(0.7, 0.07, 0.5), { zMin: 4, zMax: 4, sx: 1.8, sy: 0.5 });
      // Lava breaking out at the edges, beside the table: a runnel down each margin.
      const runnel = (x0, dir, seed) => {
        for (let y = 72 * u; y < H; y += 0.5) {
          const t = (y - 72 * u) / (H - 72 * u);
          const x = x0 + dir * t * 8 * u + Math.sin(y / (9 * u) + seed) * 3 * u;
          const w = (1.6 + 1.4 * n1(y / (12 * u), seed)) * u;
          p.fill(C.rect(Math.round(x - w / 2), Math.floor(y), Math.max(1, Math.round(w)), 1), 'lava', 8.4 - t * 2.2, 4);
        }
        p.light(x0, 130 * u, 60 * u, 2.2, flicker(seed, 0.12, 0.6), { zMin: 4, sx: 0.45 });
      };
      runnel(9 * u, 1, 3); runnel(W - 10 * u, -1, 5);
      // Black glass at the margins, dark against the runnels.
      for (const [x, h, w, left, lean, sd] of [[4, 150, 34, true, 0.06, 1], [22, 70, 20, true, -0.14, 2], [-6, 90, 24, true, 0.3, 5],
        [W / u - 4, 160, 34, false, -0.06, 3], [W / u - 23, 64, 20, false, 0.16, 4], [W / u + 6, 96, 24, false, -0.3, 6]]) {
        blade(p, x * u, H + 6, w * u, h * u, { lean, z: left ? 5 : 7, v: 1.2, lit: 1.2, seed: sd, lightLeft: !left, up: 0.3 });
      }
      glassEdge(p, 5, 1, 7.6, 5, H * 0.45, H); glassEdge(p, 7, -1, 7.6, 5, H * 0.45, H);
      p.shade(null, (x, y, i) => (p.z[i] >= 4 ? -2 * Math.max(0, y / H - 0.42) : 0));
      crawl(p, 'lava', (x, y) => x / (4 * u) - y / (2 * u) * 0.3, 0.45, 1.4, (x, y, i) => p.z[i] === 3 && y > hor);
      return {
        p,
        over(img, t) {
          haze(img, p, hor - 4 * u, 72 * u, t, 3, 0.8);
          emberRain(img, 60, [0, 0, W, H], t, 71, ['#EFA230', '#934C0E'], { a: 0.8, fall: 5 });
        },
      };
    },
  };

  /* ================= B: the forge hall ================= */

  // The same lava (here molten metal) and the same black glass, now cut and set by the dwarves:
  // dressed basalt walls, iron, and doors of polished black glass.
  const RAMPS_B = {
    stone: ['#050404', '#0B0908', '#131010', '#1C1715', '#271F1A', '#352920', '#463628', '#5C4632', '#775B3E', '#98744C', '#BE935E'],
    iron: ['#040404', '#09090A', '#111112', '#1A1919', '#252321', '#33302B', '#454037', '#5C5446', '#7A6D58', '#A08B6C'],
    lava: LAVA, glass: GLASS, shadow: SHADOW, steam: STEAM,
    ...CARD,
  };
  // Layers: 1 the walls and floor, 2 the door frame and pillars, 3 the doors and statues, 4-5 statue details,
  // 6 the channel, 7 anvils and chains, 8 the streams and the bridge, 9+ the card.
  // No opening to the outside anywhere: every light is the molten metal's.

  /** One pixel. */
  function dot(p, x, y, ri, v, z) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    const i = y * p.w + x; p.r[i] = ri; p.v[i] = v; p.z[i] = z;
  }
  function line(p, x0, y0, x1, y1, ri, v, z) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k += 1) dot(p, lerp(x0, x1, k / n), lerp(y0, y1, k / n), ri, v, z);
  }

  /** A rune: a stave and two or three angular branches, `h` pixels tall, cut in (ramp, v). */
  function rune(p, x, y, h, ramp, v, z, seed) {
    const r = rng(seed); const ri = p.ri(ramp);
    const X = Math.round(x); const Y = Math.round(y); const Hh = Math.max(3, Math.round(h));
    line(p, X, Y, X, Y + Hh - 1, ri, v, z);
    const nb = 1 + Math.floor(r() * 2.4);
    for (let k = 0; k < nb; k += 1) {
      const at = Y + Math.floor(r() * (Hh - 1)); const dir = r() < 0.5 ? -1 : 1;
      const len = Math.max(1, Math.round(Hh * (0.3 + r() * 0.3))); const dy = r() < 0.4 ? -1 : r() < 0.7 ? 1 : 0;
      line(p, X, at, X + dir * len, at + dy * len, ri, v, z);
    }
  }

  /** A frieze: a carved band between two lit fillets, runes along it, some still holding gold in their cuts. */
  function frieze(p, x0, x1, y, h, u, o) {
    p.fill(C.rect(x0, y - 1, x1 - x0, 1), 'stone', o.v + 1.4, o.z);
    p.fill(C.rect(x0, y + h, x1 - x0, 1), 'stone', o.v + 1, o.z);
    p.fill(C.rect(x0, y, x1 - x0, h), 'stone', o.v - 0.4, o.z);
    const step = Math.max(3, Math.round(h * 0.75));
    for (let x = x0 + 2, k = 0; x < x1 - 2; x += step, k += 1) {
      const hot = o.hot && o.hot(x, k);
      rune(p, x, y + 1, h - 2, hot ? 'lava' : 'stone', hot ? 5 + hash(k, 2, o.seed || 1) * 2 : o.v + 1.2, o.z, (o.seed || 1) * 31 + k);
    }
  }

  /**
   * A dwarf-king in stone, facing you: crown, a broad beard to the belt,
   * pauldrons, a long robe to the plinth. With `pour` he holds a crucible
   * before him, tipped, its molten metal glowing at the lip; otherwise his
   * hands rest on the haft of a great hammer. Returns where the pour leaves the lip.
   */
  function king(p, cx, by, s, o = {}) {
    const z = o.z ?? 3; const v = o.v ?? 1.6; const S = 'stone';
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, by + y * s]));
    const M = (pts) => [P(pts), P(pts.map(([x, y]) => [-x, y]))];
    p.fill(P([[-0.37, 0.1], [-0.37, -0.02], [0.37, -0.02], [0.37, 0.1]]), S, v + 0.5, z);
    p.fill(P([[-0.39, -0.02], [-0.39, -0.045], [0.39, -0.045], [0.39, -0.02]]), S, v + 1.2, z);
    // The robe, in heavy folds, flaring to the plinth.
    const robe = P([[-0.3, -0.04], [-0.22, -0.5], [0.22, -0.5], [0.3, -0.04]]);
    p.fill(robe, S, (x) => v + (frac((x - cx) / (s * 0.075) + 0.5) < 0.3 ? -0.6 : 0.1), z);
    // The torso under sloping shoulders, a pauldron on each.
    p.fill(P([[-0.22, -0.5], [-0.28, -0.66], [-0.2, -0.76], [0.2, -0.76], [0.28, -0.66], [0.22, -0.5]]), S, v + 0.2, z);
    for (const sh of M([[-0.17, -0.77], [-0.27, -0.75], [-0.33, -0.67], [-0.28, -0.62], [-0.2, -0.68]])) p.fill(sh, S, v + 0.6, z + 1);
    p.fill(P([[-0.23, -0.53], [0.23, -0.53], [0.23, -0.49], [-0.23, -0.49]]), S, v + 0.9, z + 1); // the belt
    let lip = null;
    if (o.pour !== undefined) {
      // A cauldron held low in both hands by its ring handles and tipped toward the pour side (±1), the metal running out over its spout.
      const d = o.pour || 1; const ang = d * 0.55; const ca = Math.cos(ang); const sa = Math.sin(ang);
      const px0 = (o.potX || 0) * d; const cy0 = -0.36;
      const ks = o.potK ?? 0.78; const zp = z + 5; // the cauldron sits out of the king's own under-light: dark iron, lit only at its rim
      const TX = ([x, y]) => [cx + (px0 + (x * d * ca - y * sa) * ks) * s, by + (cy0 + (x * d * sa + y * ca) * ks) * s];
      const R = (pts) => C.poly(pts.map(TX));
      const hL = TX([-0.215, 0]); const hR = TX([0.215, 0]);
      for (const [hx, hy, m] of [[...hL, -d], [...hR, d]]) {
        // The arm, from the shoulder down to the handle.
        p.fill(tube([[cx + m * 0.27 * s, by - 0.65 * s, 0.065 * s], [cx + m * 0.31 * s, by - 0.5 * s, 0.058 * s], [hx, hy - 0.02 * s, 0.05 * s]]), S, v + 0.3, z + 1);
      }
      p.fill(R([[-0.18, -0.05], [0.18, -0.05], [0.19, 0.01], [0.16, 0.07], [0.09, 0.11], [-0.09, 0.11], [-0.16, 0.07], [-0.19, 0.01]]), 'iron', (x, y) => {
        const ly = ((x - cx) * -sa * d + (y - by - cy0 * s) * ca) / s; // down the pot's own axis
        return ly > 0.05 ? 0.8 : ly > 0.0 ? 1.4 : 2;
      }, zp);
      p.fill(R([[-0.2, -0.075], [0.2, -0.075], [0.2, -0.045], [-0.2, -0.045]]), 'iron', 6.4, zp); // the rim
      p.fill(R([[0.17, -0.075], [0.28, -0.1], [0.28, -0.08], [0.19, -0.045]]), 'iron', 5.6, zp);   // the spout
      p.fill(R([[-0.02, -0.088], [0.2, -0.088], [0.27, -0.1], [0.2, -0.072], [0.0, -0.072]]), 'lava', 9, zp + 1); // the metal at the lip
      for (const [hx, hy] of [hL, hR]) {
        p.fill(C.join(C.circle(hx, hy, 0.034 * s, 12), C.circle(hx, hy, 0.017 * s, 10)), 'iron', 5, zp);
        p.fill(C.rect(hx - 0.035 * s, hy - 0.045 * s, 0.07 * s, 0.05 * s), S, v + 1.2, z + 4); // the hand on it
      }
      lip = TX([0.28, -0.09]);
    } else {
      for (const a of M([[-0.27, -0.66], [-0.33, -0.53], [-0.16, -0.42], [-0.11, -0.46], [-0.23, -0.58]])) p.fill(a, S, v + 0.3, z + 1);
      p.fill(P([[-0.16, -0.04], [-0.16, -0.17], [0.16, -0.17], [0.16, -0.04]]), S, v + 0.6, z + 2); // the hammer's head on the plinth
      p.fill(P([[-0.025, -0.17], [-0.025, -0.42], [0.025, -0.42], [0.025, -0.17]]), S, v + 0.3, z + 2);
      p.fill(P([[-0.11, -0.41], [-0.11, -0.47], [0.11, -0.47], [0.11, -0.41]]), S, v + 0.9, z + 3);
    }
    // The head under a crown of three points, the middle one tallest.
    p.fill(P([[-0.085, -0.77], [-0.095, -0.9], [0.095, -0.9], [0.085, -0.77]]), S, v + 0.4, z + 2);
    p.fill(P([[-0.11, -0.895], [-0.11, -0.93], [0.11, -0.93], [0.11, -0.895]]), S, v + 1.1, z + 2);
    for (const [k, h] of [[-0.075, 0.05], [0, 0.085], [0.075, 0.05]]) p.fill(P([[k - 0.035, -0.925], [k, -0.93 - h], [k + 0.035, -0.925]]), S, v + 1.1, z + 2);
    // The beard: broad from the jaw to the belt, then two long braids, banded.
    p.fill(P([[-0.1, -0.84], [-0.15, -0.72], [-0.14, -0.58], [-0.1, -0.52], [0.1, -0.52], [0.14, -0.58], [0.15, -0.72], [0.1, -0.84]]), S, (x) => v + 1 + (frac((x - cx) / (s * 0.05)) < 0.3 ? -0.5 : 0), z + 3);
    for (const m of [-1, 1]) {
      p.fill(P([[m * 0.04, -0.53], [m * 0.1, -0.53], [m * 0.085, -0.44], [m * 0.055, -0.44]]), S, (x, y) => v + 1 + (frac((by - y) / (s * 0.03)) < 0.35 ? -0.7 : 0), z + 3);
    }
    // The face: a heavy brow, eyes in shadow under it, the nose, the moustache over the beard.
    const X = (k) => Math.round(cx + k * s); const Y = (k) => Math.round(by + k * s);
    p.fill(C.rect(X(-0.08), Y(-0.875), X(0.08) - X(-0.08), 1), S, v + 2, z + 4);
    p.fill(C.rect(X(-0.065), Y(-0.865), Math.max(1, X(-0.02) - X(-0.065)), 1), 'shadow', 0, z + 4);
    p.fill(C.rect(X(0.025), Y(-0.865), Math.max(1, X(0.065) - X(0.025)), 1), 'shadow', 0, z + 4);
    p.fill(C.rect(X(-0.005), Y(-0.855), 1, Math.max(1, Y(-0.82) - Y(-0.855))), S, v + 1.6, z + 4);
    p.fill(P([[-0.09, -0.82], [0.09, -0.82], [0.06, -0.8], [-0.06, -0.8]]), S, v + 1.5, z + 4);
    if (lip) {
      // The metal's light from below: hands and beard brightest, the face warm, the crown just caught.
      p.light(cx + (o.potX || 0) * s * (o.pour || 1), by - 0.4 * s, 0.78 * s, o.under ?? 5, null, { zMin: z, zMax: z + 4, hard: true });
      // Every edge that faces down catches it: under the brow, the nose, the moustache, the crown's band, the pauldrons.
      const hit = [];
      for (let y = Math.max(0, Math.floor(by - 1.02 * s)); y < Math.min(p.h - 1, by - 0.3 * s); y += 1) {
        for (let x = Math.max(0, Math.floor(cx - 0.4 * s)); x < Math.min(p.w, cx + 0.4 * s); x += 1) {
          const i = y * p.w + x; if (p.z[i] < z || p.z[i] > z + 4 || p.r[i] !== p.ri(S)) continue;
          const j = i + p.w; if (p.z[j] < p.z[i] || (p.r[j] !== p.ri(S) && p.r[j] !== p.ri('iron'))) hit.push(i);
        }
      }
      for (const i of hit) p.v[i] += 1.6;
    }
    return lip;
  }

  /** Molten metal falling: a stream from (x, y0) into the channel at y1, streaked down its length, a splash at its foot. */
  function stream(p, x, y0, y1, w, u, z, bend = 0) {
    const L = p.ri('lava');
    // It leaves the lip moving outward, and curves over into its fall.
    const at = (y) => x + bend * (1 - (1 - Math.min(1, Math.max(0, y - y0) / (7 * u))) ** 2);
    for (let y = Math.floor(y0); y < Math.ceil(y1); y += 1) {
      const t = (y + 0.5 - y0) / (y1 - y0); const ww = w * (0.55 + Math.min(1, t * 4) * 0.45) * (1 - t * 0.2) + Math.sin(y * 0.9) * 0.25 * u;
      const xc = at(y + 0.5);
      for (let xx = Math.floor(xc - ww / 2); xx < xc + ww / 2; xx += 1) {
        const e = Math.abs(xx + 0.5 - xc) / (ww / 2);
        dot(p, xx, y, L, 9.6 - e * e * 2.4 - (frac((xx + 0.5 - xc) / (1.4 * u) + y * 0.05) < 0.25 ? 1.2 : 0), z);
      }
    }
    // The splash: a bright crown where it hits, droplets thrown out.
    const xe = at(y1);
    p.fill(C.ellipse(xe, y1, w * 1.4, w * 0.5), 'lava', 10, z);
    for (const [dx, dy] of [[-1.8, -1.6], [1.6, -1.9], [-2.6, -0.6], [2.4, -0.8]]) dot(p, xe + dx * w * 0.6, y1 + dy * u, L, 9, z);
    return xe;
  }

  /** A channel of molten metal across the floor: stone kerbs either side, the metal brightest down its middle, a skin forming at its edges. */
  function channel(p, W, y0, y1, u, o = {}) {
    const L = p.ri('lava'); const S = p.ri('stone'); const z = o.z ?? 6;
    for (let y = Math.max(0, Math.floor(y0 - 1.5 * u)); y < Math.min(p.h, Math.ceil(y1 + 2 * u)); y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x; const Y = y + 0.5;
        if (Y < y0) { p.r[i] = S; p.v[i] = (o.kerb ?? 4.4) + (Y > y0 - 0.8 * u ? 1.6 : 0) + ((x + 0.5) % (8 * u) < 1 ? -1.4 : 0); p.z[i] = z; continue; }
        if (Y >= y1) { p.r[i] = S; p.v[i] = (o.kerb ?? 4.4) + 0.8 - (Y - y1) / u * 0.6 + (Y < y1 + 0.8 * u ? 1.4 : 0) + ((x + 0.5) % (9 * u) < 1 ? -1.4 : 0); p.z[i] = z; continue; }
        const e = (Y - y0) / (y1 - y0); const mid = 1 - Math.abs(e - 0.5) * 2;
        let v = 7.4 + 2 * mid;
        const sk = n2((x + 0.5) / (5 * u), Y / (1.2 * u), o.seed || 3);
        if (sk > 0.66 && mid < 0.7) v = 3.6 + (sk - 0.66) * 4;
        p.r[i] = L; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /** A great anvil: the flat face, the horn tapering out to the left, the waist, the splayed foot; its face's edge lit. */
  function anvil(p, cx, fy, s, o = {}) {
    const z = o.z ?? 7; const R = o.ramp || 'iron'; const v = o.v ?? 1.2; const f = o.face ?? 1;
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s * f, fy + y * s]));
    p.fill(P([[-0.42, 0], [-0.33, -0.1], [-0.18, -0.15], [-0.14, -0.35], [-0.3, -0.42], [-0.6, -0.45], [-0.88, -0.5], [-0.62, -0.53], [-0.36, -0.56],
      [0.36, -0.56], [0.37, -0.43], [0.16, -0.35], [0.18, -0.15], [0.33, -0.1], [0.42, 0]]), R, v, z);
    p.fill(P([[-0.36, -0.56], [0.36, -0.56], [0.36, -0.52], [-0.36, -0.52]]), R, v + (o.lit ?? 3), z);
    p.fill(P([[-0.36, -0.56], [-0.62, -0.53], [-0.88, -0.5], [-0.62, -0.51], [-0.36, -0.53]]), R, v + (o.lit ?? 3) - 0.6, z);
    p.fill(P([[-0.42, 0], [-0.33, -0.1], [-0.3, -0.07], [-0.38, 0]]), R, v + 1.2, z);
  }

  /** A hanging chain: links alternately face-on and edge-on, a hook at its foot. */
  function chain(p, x, y0, y1, u, z, v, hook = true) {
    const ri = p.ri('iron'); const si = p.ri('shadow');
    for (let y = Math.round(y0), k = 0; y < y1; y += 3, k += 1) {
      if (k % 2) { dot(p, x, y, ri, v - 0.6, z); dot(p, x, y + 1, ri, v - 0.6, z); dot(p, x, y + 2, ri, v - 0.6, z); }
      else { for (let j = 0; j < 3; j += 1) { dot(p, x - 1, y + j, ri, v, z); dot(p, x + 1, y + j, ri, v, z); } dot(p, x, y, ri, v + 0.6, z); dot(p, x, y + 2, ri, v, z); dot(p, x, y + 1, si, 0, z); }
    }
    if (hook) {
      const Y = Math.round(y1);
      for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [1, 3], [2, 3], [3, 2], [3, 1]]) dot(p, x + dx, Y + dy, ri, v + 0.8, z);
    }
  }

  /**
   * The doors: a stepped frame of dressed stone and two leaves of polished
   * black glass, a great rune on each inlaid with molten gold, a frieze on
   * the lintel. With `open` the leaves stand back and the doorway is light.
   */
  function doors(p, cx, top, bottom, hw, u, o = {}) {
    const fw = 4.5 * u;
    const frame = C.poly([[cx - hw - fw, bottom], [cx - hw - fw, top - 3 * u], [cx - hw - fw + 3 * u, top - 3 * u], [cx - hw - fw + 3 * u, top - 7.5 * u],
      [cx + hw + fw - 3 * u, top - 7.5 * u], [cx + hw + fw - 3 * u, top - 3 * u], [cx + hw + fw, top - 3 * u], [cx + hw + fw, bottom]]);
    p.fill(frame, 'stone', 2.2, 2);
    p.masonry(frame, { bw: 5 * u, bh: 3.2 * u, joint: -1.1, top: 0.5, left: 0.3, vary: 0.6, seed: 71, z: 2 });
    frieze(p, Math.round(cx - hw - fw + 4 * u), Math.round(cx + hw + fw - 4 * u), Math.round(top - 6.5 * u), Math.max(4, Math.round(3.6 * u)), u, { v: 2, z: 2, seed: 7, hot: (x, k) => k % 3 === 1 });
    const open = C.poly([[cx - hw, bottom], [cx - hw, top + 2.5 * u], [cx - hw + 2.5 * u, top], [cx + hw - 2.5 * u, top], [cx + hw, top + 2.5 * u], [cx + hw, bottom]]);
    if (o.open) {
      // Light beyond, warm and pale, brightest low where the way goes on; the leaves swung back against the reveal.
      p.fill(open, 'path', (x, y) => 2 + 2.6 * clamp((y - top) / (bottom - top), 0, 1) ** 0.7 - Math.abs(x + 0.5 - cx) / hw * 0.6, 3);
      for (const m of [-1, 1]) p.fill(C.poly([[cx + m * hw, bottom], [cx + m * hw, top + 2.5 * u], [cx + m * (hw - 3.5 * u), top + 5 * u], [cx + m * (hw - 3.5 * u), bottom - 2 * u]]), 'glass', 2, 4);
      return open;
    }
    p.fill(open, 'glass', (x, y) => 1.6 + 0.6 * clamp((y - top) / (bottom - top), 0, 1) + (Math.abs(x + 0.5 - cx) < 0.8 ? -1.4 : 0), 3);
    // An inlaid border round each leaf, and a great rune on each, in molten gold.
    const L = p.ri('lava'); const iz = 4;
    for (const m of [-1, 1]) {
      const xa = cx + m * 2 * u; const xb = cx + m * (hw - 2 * u); const ya = top + 4 * u; const yb = bottom - 3 * u;
      line(p, xa, ya, xb, ya, L, 5.6, iz); line(p, xa, yb, xb, yb, L, 5.6, iz); line(p, xa, ya, xa, yb, L, 5.2, iz); line(p, xb, ya, xb, yb, L, 5.2, iz);
      const rx = (xa + xb) / 2; const ry0 = ya + (yb - ya) * 0.22; const ry1 = ya + (yb - ya) * 0.78;
      line(p, rx, ry0, rx, ry1, L, 8, iz);
      line(p, rx, ry0 + (ry1 - ry0) * 0.15, rx + m * (hw - 5 * u) * 0.5, ry0 + (ry1 - ry0) * 0.35, L, 7.4, iz);
      line(p, rx, ry0 + (ry1 - ry0) * 0.55, rx - m * (hw - 5 * u) * 0.45, ry0 + (ry1 - ry0) * 0.78, L, 7.4, iz);
      line(p, rx, ry0 + (ry1 - ry0) * 0.15, rx - m * (hw - 5 * u) * 0.45, ry0 + (ry1 - ry0) * 0.35, L, 7, iz);
    }
    // The glass catching the gold: a bright edge down the seam and along each leaf's top.
    return open;
  }

  /**
   * The drawbridge over the channel to the doors: iron plates hung on two
   * chains from the door frame. Lowered, it lies flat across the channel;
   * `fallen`, it has torn free and dropped into the channel, and stands up
   * on its end out of the metal against the doors. `ramp` is its colour.
   */
  function drawbridge(p, cx, sill, near, hw0, hw1, u, o) {
    const R = o.ramp; const z = o.z ?? 8; const top = o.chainTop;
    if (!o.fallen) {
      // Lowered: iron plates across the channel, their seams running toward the doors, both sides and the front lip lit from the metal below.
      const deck = C.poly([[cx - hw0, sill], [cx + hw0, sill], [cx + hw1, near], [cx - hw1, near]]);
      p.fill(deck, R, (x, y) => {
        const t = (y + 0.5 - sill) / (near - sill); const hw = lerp(hw0, hw1, t); const e = Math.abs(x + 0.5 - cx) / hw;
        const seam = frac(((x + 0.5 - cx) / hw) * 2.5 + 0.5) < 0.12 || frac(t * 3.2) < 0.12;
        return (e > 0.9 ? 5.6 : 3.2 + t * 0.8) - (seam ? 1.2 : 0);
      }, z);
      p.fill(C.rect(cx - hw1, near - 1, hw1 * 2, 1.4), R, 6.4, z);
      p.fill(C.rect(cx - hw1 + 1, near + 0.4, hw1 * 2 - 2, 1.4 * u), R, 1.6, z);
      for (const m of [-1, 1]) chainTo(p, cx + m * (hw0 + 2.5 * u), top, cx + m * (hw1 - 1.5 * u), near - 1.5 * u, z, 8.2);
      return;
    }
    // Fallen: both chains torn from the deck; it has dropped into the channel and stands up out of the metal on its end, leaning on the door frame.
    const ch = o.chanTop; const cb = o.chanBot;
    const slab = [[cx - 16 * u, cb], [cx + 2 * u, cb + 0.5 * u], [cx + 12 * u, top + 24 * u], [cx - 4 * u, top + 21 * u]];
    p.fill(C.poly(slab), R, (x, y) => {
      const t = (cb - y) / (cb - top - 21 * u);
      return 2.3 + (frac(t * 3) < 0.12 ? -1 : 0) + (frac((x + 0.5 - cx - t * 10 * u) / (6 * u)) < 0.14 ? -0.8 : 0);
    }, z);
    // Its thickness down the left edge, its top edge catching the light, the plate's end lit.
    p.fill(C.poly([[cx - 16 * u, cb], [cx - 4 * u, top + 21 * u], [cx - 5.6 * u, top + 22 * u], [cx - 17.6 * u, cb]]), R, 1.2, z);
    p.fill(C.poly([[cx - 4 * u, top + 21 * u], [cx + 12 * u, top + 24 * u], [cx + 12 * u, top + 25.4 * u], [cx - 4 * u, top + 22.4 * u]]), R, 3.8, z);
    // Where it stands in the metal, the metal heaps up round it, bright.
    p.fill(C.ellipse(cx - 7 * u, (ch + cb) / 2 + 1 * u, 12 * u, 2.2 * u), 'lava', 9.8, z + 1);
    // The chains: one hanging snapped from the frame, the other still holding the slab's top.
    chainTo(p, cx + hw0 + 2.5 * u, top, cx + 11 * u, top + 23.5 * u, z + 1, 8.2);
    chainTo(p, cx - hw0 - 2.5 * u, top, cx - hw0 - 1.5 * u, top + 16 * u, z + 1, 8.2);
  }

  /** A chain from (x0, y0) to (x1, y1): iron links. */
  function chainTo(p, x0, y0, x1, y1, z, v) {
    const ri = p.ri('iron'); const si = p.ri('shadow');
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2.5));
    for (let k = 0; k <= n; k += 1) {
      const x = lerp(x0, x1, k / n); const y = lerp(y0, y1, k / n);
      if (k % 2) dot(p, x, y, ri, v - 0.8, z);
      else { dot(p, x - 1, y, ri, v, z); dot(p, x + 1, y, ri, v, z); dot(p, x, y - 1, ri, v + 0.4, z); dot(p, x, y + 1, ri, v - 0.4, z); dot(p, x, y, si, 0, z); }
    }
  }

  /** A square pillar of dressed stone, its rune bands glowing faintly, the face toward the light warmer. */
  function pillar(p, x, w, top, bottom, u, o) {
    const sh = C.rect(x - w / 2, top, w, bottom - top);
    p.fill(sh, 'stone', o.v, o.z);
    p.masonry(sh, { bw: w * 1.2, bh: 6 * u, joint: -1, top: 0.4, vary: 0.4, seed: o.seed || 5, z: o.z });
    p.shade(sh, (px) => ((px + 0.5 - x) * (o.lightRight ? 1 : -1) > w * 0.2 ? 1.2 : (px + 0.5 - x) * (o.lightRight ? 1 : -1) < -w * 0.3 ? -0.6 : 0), o.z);
    for (const by of o.bands || []) frieze(p, Math.round(x - w / 2 + 1), Math.round(x + w / 2 - 1), Math.round(by), Math.max(4, Math.round(3 * u)), u, { v: o.v + 0.6, z: o.z, seed: Math.round(by), hot: (xx, k) => (k + Math.round(by)) % 2 === 0 });
  }

  const B = {
    job: 0, setting: 'ember-hold', key: 'B', id: 'ember-hold-b', side: 'inside',
    name: 'The Ember Hold', title: 'The forge hall',
    pitch: 'Deep in the mountain the dwarves took the volcano’s fire for their forge. Stone kings pour molten metal from crucibles into the channels at their feet, the doors are black glass inlaid with burning runes, and the whole hall is lit by the metal.',
    notes: [
      ['Light', 'Only the molten metal: the streams poured by the kings, the channel across the floor, the runes inlaid in the doors. It lights everything from below, so faces, beards and anvils catch it on their undersides and the vault above falls away into black.'],
      ['Detail', 'Dwarf-kings in stone with crowns and square-cut beards, crucibles, a frieze of runes with gold still in some cuts, giant anvils, hooks hanging on chains, the drawbridge on its chains, doors of the outside’s black glass, embers rising.'],
      ['Vista', 'The hall the width of the board, king after king. The card stands before the doors between two pouring kings: the salamander out of the channel, the smith with his blue lantern, the rune-axe on an anvil, the drawbridge fallen into the metal, the doors thrown open on light.'],
      ['World', 'Flagstones under the table, warm at the top where the channel runs under the vista, grates of molten metal down both edges, a great ring of runes inlaid in the floor with the gold in its cuts barely warm, embers rising, black by the hand.'],
    ],
    palette: ['#050404', '#1C1715', '#352920', '#775B3E', '#111112', '#14141A', '#BC6414', '#EFA230', '#FFF3CA'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['lava'], dither: 0.26 });
      const u = H / 134; const gx = W / 2;
      const c0 = 101 * u; const c1 = 107 * u;
      p.fill(C.rect(0, 0, W, c0), 'stone', 1, 1);
      p.masonry(C.rect(0, 0, W, c0), { bw: 11 * u, bh: 6 * u, joint: -1, top: 0.4, left: 0.3, vary: 0.7, chip: 0.04, seed: 81, z: 1 });
      frieze(p, 0, W, Math.round(15 * u), Math.round(5 * u), u, { v: 1.2, z: 1, seed: 3, hot: (x, k) => k % 5 === 2 });
      p.fill(C.rect(0, c1, W, H - c1), 'stone', 1.6, 1);
      p.floor(C.rect(0, c1, W, H - c1), { vx: gx, vy: c1 - 34 * u, rows: 4, size: 0.9, d0: 34 * u, joint: -1.2, top: 0.45, vary: 0.7, seed: 82, z: 1 });
      // The king, pouring toward you.
      const lip = king(p, gx, 97 * u, 70 * u, { pour: 1, potX: -0.1, z: 3, v: 1.8 });
      // Pillars at the sides, beyond the arch, rune bands on them; hooks hanging on chains.
      pillar(p, 6 * u, 18 * u, 0, c0, u, { v: 1.4, z: 2, seed: 83, lightRight: true, bands: [40 * u, 74 * u] });
      pillar(p, W - 6 * u, 18 * u, 0, c0, u, { v: 1.4, z: 2, seed: 84, lightRight: false, bands: [40 * u, 74 * u] });
      chain(p, Math.round(21 * u), 0, 52 * u, u, 7, 3.2);
      chain(p, Math.round(W - 21 * u), 0, 42 * u, u, 7, 3.2);
      channel(p, W, c0, c1, u, { z: 6, kerb: 4, seed: 5 });
      const fx = stream(p, lip[0], lip[1] + 0.5 * u, c0 + 3 * u, 4.4 * u, u, 8, 3 * u);
      // The light: the crucible up the king's beard and face; the stream down his robe; the channel along the floor and the pillars.
      p.light(lip[0], lip[1] - 1 * u, 30 * u, 2.4, null, { zMin: 3, zMax: 7, hard: true });
      p.light(lip[0], lip[1] - 2 * u, 22 * u, 2.4, null, { zMin: 1, zMax: 1 });
      p.light(fx, (lip[1] + c0) / 2, 30 * u, 3.4, null, { zMin: 1, zMax: 7, sx: 0.8 });
      p.light(fx, c0, 44 * u, 4.4, null, { zMin: 1, zMax: 7 });
      for (const x of [14 * u, W - 14 * u]) p.light(x, c0 + 2 * u, 34 * u, 3.6, null, { zMin: 1, zMax: 7, sy: 0.7 });
      p.light(gx, c1 + 4 * u, 50 * u, 3, null, { zMin: 1, zMax: 1, sy: 0.4 });
      p.rim(0, 1, 1.6, 3);
      vignette(p, W, H, 1.6, 0.6);
      return {
        p,
        over(img) {
          for (const q of particles('ember', 18, [8 * u, 40 * u, W - 16 * u, 66 * u], 1.7, 91)) put(img, q.x, q.y, q.big ? '#FCDD8E' : '#DC821E', q.a * 0.9);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['lava', 'path'], dither: 0.26 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const wallB = 77 * u; const c0 = 80 * u; const c1 = 89 * u;
      // The back wall and the vault's beam across the top.
      p.fill(C.rect(0, 0, W, c0), 'stone', 1, 1);
      p.masonry(C.rect(0, 0, W, wallB), { bw: 12 * u, bh: 7 * u, joint: -1, top: 0.4, left: 0.3, vary: 0.7, chip: 0.04, seed: 61, z: 1 });
      frieze(p, 0, W, Math.round(12 * u), Math.max(4, Math.round(5 * u)), u, { v: 1.1, z: 1, seed: 9, hot: (x, k) => k % 7 === 3 });
      p.fill(C.rect(0, 0, W, 7 * u), 'stone', 0.7, 2);
      p.fill(C.rect(0, 7 * u - 1, W, 1), 'stone', 1.8, 2);
      // The floor in front of the channel.
      p.fill(C.rect(0, c1, W, H - c1), 'stone', 1.5, 1);
      p.floor(C.rect(0, c1, W, H - c1), { vx: gx, vy: c1 - 26 * u, rows: 4, size: 1, d0: 26 * u, joint: -1.1, top: 0.45, vary: 0.7, seed: 64, z: 1 });
      // The doors.
      doors(p, gx, 36 * u, wallB, 12 * u, u, { open });
      // The kings: two pouring toward the doors, more down the hall with their hands on their hammers;
      // anvils on the floor between, hooks hanging on chains.
      const lips = []; const anvils = []; const chains = [];
      for (let k = 0; ; k += 1) {
        const d = 46 + k * 96; if (gx + (d - 30) * u > W + 10 * u) break;
        for (const m of [-1, 1]) {
          const x = gx + m * d * u;
          const lip = king(p, x, wallB - 3 * u, 64 * u, { pour: k === 0 ? -m : undefined, z: 3, v: k === 0 ? 1.9 : 1.5 });
          if (lip) lips.push([...lip, -m]);
          if (gx + (d + 48) * u < W + 40 * u) { anvils.push([gx + m * (d + 48) * u, m]); chains.push(gx + m * (d + 38) * u, gx + m * (d + 58) * u); }
        }
      }
      channel(p, W, c0, c1, u, { z: 6, kerb: 4, seed: 5 });
      chains.forEach((x, k) => chain(p, Math.round(x), 0, (28 + (k % 3) * 9) * u, u, 7, 3.4));
      for (const L of lips) L.push(stream(p, L[0], L[1] + 0.5 * u, c0 + 4 * u, 3.4 * u, u, 8, L[2] * 2.6 * u));
      // The light: each crucible up its king's beard and face; each stream down the robe; the channel along the floor.
      for (const L of lips) {
        const [x, y] = L;
        p.light(x, y - 1 * u, 30 * u, 2.6, null, { zMin: 2, zMax: 7, hard: true });
        p.light(L[3], c0, 40 * u, 4, flicker(x, 0.08, 0.6), { zMin: 1, zMax: 8 });
      }
      for (let x = (gx % (36 * u)) - 18 * u; x < W + 18 * u; x += 36 * u) p.light(x, (c0 + c1) / 2, 30 * u, 2.8, null, { zMin: 1, zMax: 8, sy: 0.7 });
      // Anvils on the floor before the channel, black against it, their faces lit.
      for (const [x, m] of anvils) anvil(p, x, c1 + 8 * u, 22 * u, { z: 7, v: 1.2, lit: 4, face: -m });
      p.rim(0, 1, 1.4, 3);
      // The bridge to the doors.
      const sill = wallB; const near = c1 + 2 * u;
      if (cat !== 'obstacle') drawbridge(p, gx, sill, near, 11 * u, 14 * u, u, { ramp: 'iron', z: 8, chainTop: 33 * u });
      if (open) {
        // The light out of the doorway, laid down the bridge and the floor in a clean fan.
        const Pr = p.ri('path'); const Ir = p.ri('iron');
        p.each(C.poly([[gx - 11 * u, wallB], [gx + 11 * u, wallB], [gx + 30 * u, H], [gx - 30 * u, H]]), (x, y, i) => {
          const t = (y + 0.5 - wallB) / (H - wallB); const e = Math.abs(x + 0.5 - gx) / lerp(11 * u, 30 * u, t);
          // On the bridge's plates the light lies gold, seams dark; on the floor beyond, a warm fan.
          if (p.r[i] === Ir && p.z[i] === 8) { if (p.v[i] > 2.6 && e < 0.85) { p.r[i] = Pr; p.v[i] = e < 0.45 ? 3.2 - t : 2.4 - t; } return; }
          if (p.r[i] !== p.ri('lava')) p.v[i] += e < 0.7 ? 3.2 - t * 1.6 : 1.6 - t * 0.8;
        });
        p.light(gx, wallB - 10 * u, 30 * u, 2.4, null, { zMin: 2, zMax: 3 });
      }
      // The card, before the doors.
      if (cat === 'monster') {
        const s = 46 * u;
        const h = salamander(p, gx + 9 * u, 96 * u, s, { z: 9, eyes: ramp, face: 1 });
        rimAll(p, [9, 10, 11], 'lava', 4.6, [9]);
        glowRim(p, [9, 10, 11], 0.2, 'lava', 7.8);
        p.tint(h.hx + 1 * u, h.hy - 4 * u, 3 * u, hex, 0.3, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 46 * u;
        const l = smith(p, gx + 3 * u, 98 * u, s, { z: 9, face: 1, lit: ramp });
        rimAll(p, [9, 10], 'lava', 4.6, [9]);
        glowRim(p, [9, 10], 0.2, 'lava', 7.4);
        lampLit(p, [9, 10], l.lx + 0.5, l.ly + 2, 14 * u, ramp, 2.6);
        p.fill(C.rect(l.lx - 1, l.ly, 3, 4), ramp, 3.2, 11);
        p.fill(C.rect(l.lx, l.ly + 1, 1, 2), ramp, 4.4, 12);
        p.tint(l.lx + 0.5, l.ly + 2, 4 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(l.lx + 0.5, l.ly + 2, 12 * u, hex, 0.35, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        // The rune-axe cooling on an anvil before the doors, steam coming off it.
        anvil(p, gx + 4 * u, 99 * u, 42 * u, { z: 9, v: 1.1, lit: 4.6, face: 1 });
        rimAll(p, [9], 'lava', 4.4);
        glowRim(p, [9], 0.2, 'lava', 7.2);
        // Leant against it, head up on the face, the haft down to the floor; the haft's wood catching the channel's light.
        const ax = runeAxe(p, gx - 6 * u, 60 * u, 38 * u, -0.1, { ramp, z: 11, face: 1, wood: 'stone', woodV: 8.6, haft: 0.95 });
        outline(p, [12, 13], 'shadow', 0, 11);
        p.tint(ax.bx, ax.by, 4 * u, hex, 0.35, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        drawbridge(p, gx, sill, near, 11 * u, 14 * u, u, { ramp, z: 9, chainTop: 33 * u, fallen: true, chanTop: c0, chanBot: c1 });
        p.tint(gx + 2 * u, 66 * u, 12 * u, CARD[ramp][2], 0.25, flicker(0.5, 0.12, 0.6));
      }
      vignette(p, W, H, 1.7, 0.5);
      crawl(p, 'lava', (x, y) => y / (1.4 * u) - x / (6 * u) * 0.2, 0.5, 2.4, (x, y, i) => p.z[i] === 8);
      crawl(p, 'lava', (x, y) => x / (3 * u), 0.4, 1.4, (x, y, i) => p.z[i] === 6);
      return {
        p,
        over(img, t) {
          haze(img, p, c0 - 8 * u, c0, t, 2, 0.7);
          for (const q of particles('ember', Math.round(W / 10), [0, 10 * u, W, c0 - 10 * u], t, 63)) put(img, q.x, q.y, q.big ? '#FCDD8E' : '#DC821E', q.a * 0.9);
          if (cat === 'item') {
            for (const q of particles('mote', 12, [gx - 14 * u, 46 * u, 30 * u, 26 * u], t, 73)) put(img, q.x, q.y, STEAM[q.big ? 5 : 4], q.a * 0.6);
            for (const q of particles('mote', 6, [gx - 12 * u, 50 * u, 24 * u, 20 * u], t, 74)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          }
          if (open) for (const q of particles('mote', 16, [gx - 10 * u, 38 * u, 20 * u, 40 * u], t, 75)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a * 0.85);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['lava'], dither: 0.26 });
      const u = H / 250; const gx = W / 2;
      p.fill(C.rect(0, 0, W, H), 'stone', 1.3, 1);
      p.floor(C.rect(0, 0, W, H), { vx: gx, vy: -90 * u, rows: 3.2, size: 1.1, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.25, vary: 0.7, chip: 0.04, seed: 91, z: 1 });
      // The channel under the vista, across the top.
      channel(p, W, 60 * u, 71 * u, u, { z: 6, kerb: 3.4, seed: 7 });
      // Down each edge, beside the table, pits of molten metal under iron grates, a kerb round each.
      const L = p.ri('lava'); const S = p.ri('stone'); const I = p.ri('iron');
      const pits = [];
      // Each grate is seen from above in perspective: wide and shallow, its bars running away from you toward the hall.
      const vy = -90 * u;
      for (const side of [0, 1]) {
        for (let k = 0, y = 82 * u; y < H - 6 * u; k += 1, y += (30 + k * 8) * u) {
          const t = y / H; const h = (5 + t * 7) * u; const w = (15 + t * 6) * u;
          const x = side ? W - (3 + t * 2) * u - w : (3 + t * 2) * u; const xm = x + w / 2;
          pits.push([xm, y + h / 2, side]);
          p.fill(C.rect(x - 1.5 * u, y - 1.2 * u, w + 3 * u, h + 2.4 * u), 'stone', 3.4 - t * 1.2, 6);
          p.fill(C.rect(x - 1.5 * u, y - 1.2 * u, w + 3 * u, 1.2), 'stone', 4.8 - t * 1.4, 6);
          p.each(C.rect(x, y, w, h), (px, py, i) => {
            // A bar wherever the line from the vanishing point through this pixel lands on a bar's slot at the grate's near edge.
            const xs = gx + (px + 0.5 - gx) * (y + h - vy) / (py + 0.5 - vy);
            const bar = ((xs - x) % (2.6 * u) + 2.6 * u) % (2.6 * u) < 1.1 * u;
            const cross = Math.abs(py + 0.5 - (y + h * 0.5)) < 0.6;
            p.z[i] = 6;
            if (bar || cross) { p.r[i] = I; p.v[i] = 1.4 + (py + 0.5 - y < 1 ? 1.6 : 0); return; }
            const e = Math.abs(px + 0.5 - xm) / (w / 2);
            p.r[i] = L; p.v[i] = 8.2 - e * e * 2.2 - t * 1.6 - (n2(px / (3 * u), py / (2 * u), 13 + side) > 0.68 ? 3 : 0);
          });
        }
      }
      // A great ring of runes inlaid in the floor under the table, the gold in its cuts barely warm.
      const rcx = gx; const rcy = 128 * u; const rrx = 120 * u; const rry = 40 * u;
      const Lr = p.ri('lava'); const Sr = p.ri('stone');
      for (let a = 0; a < Math.PI * 2; a += 0.004) {
        for (const [k, ri, v] of [[1, Lr, 1.5], [0.86, Lr, 1.4]]) dot(p, rcx + Math.cos(a) * rrx * k, rcy + Math.sin(a) * rry * k, ri, v - Math.max(0, Math.sin(a)) * 0.3, 1);
      }
      for (let a = 0, k = 0; a < Math.PI * 2; a += 0.21, k += 1) {
        const x = rcx + Math.cos(a) * rrx * 0.93; const y = rcy + Math.sin(a) * rry * 0.93 - 1.5 * u;
        rune(p, x, y, Math.max(3, Math.round((2.4 + (Math.sin(a) + 1) * 0.8) * u)), k % 3 ? 'stone' : 'lava', k % 3 ? 3.2 : 1.5, 1, 700 + k);
      }
      void Sr;
      // A rune border along each edge, between the pits and the table.
      for (const side of [0, 1]) {
        for (let y = Math.round(78 * u), k = 0; y < H - 4; y += Math.round(7 * u), k += 1) {
          const x = side ? W - (22 + (y / H) * 6) * u : (22 + (y / H) * 6) * u;
          rune(p, x, y, Math.max(3, Math.round(4 * u)), k % 4 ? 'stone' : 'lava', k % 4 ? 3 - (y / H) : 3.2 - (y / H) * 1.6, 1, 900 + k + side * 50);
        }
      }
      // The light: the top channel down onto the flags, fading fast; each pit up round itself.
      p.light(gx, 66 * u, 140 * u, 2.4, flicker(0.7, 0.06, 0.5), { zMin: 1, zMax: 1, sx: 1.9, sy: 0.6 });
      for (const [x, y, side] of pits) p.light(x, y, 24 * u, 2.4, flicker(y + side, 0.1, 0.6), { zMin: 1, zMax: 7 });
      // Chains hanging into the light at the top corners, an anvil by each edge below the channel.
      chain(p, Math.round(34 * u), 0, 50 * u, u, 7, 3.2); chain(p, Math.round(W - 34 * u), 0, 42 * u, u, 7, 3.2);
      anvil(p, 31 * u, 92 * u, 24 * u, { z: 7, v: 1.2, lit: 3.6, face: 1 });
      anvil(p, W - 31 * u, 92 * u, 24 * u, { z: 7, v: 1.2, lit: 3.6, face: -1 });
      p.rim(0, -1, 0.8, 7);
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.36));
      crawl(p, 'lava', (x, y) => x / (4 * u) + y / (6 * u), 0.45, 1.4, (x, y, i) => p.z[i] === 6);
      return {
        p,
        over(img, t) {
          haze(img, p, 50 * u, 60 * u, t, 1, 0.7);
          for (const q of particles('ember', 26, [0, 0, W, 64 * u], t, 93)) put(img, q.x, q.y, q.big ? '#EFA230' : '#934C0E', q.a * 0.8);
          for (const [x, y, s] of pits) for (const q of particles('ember', 3, [x - 6 * u, y - 30 * u, 12 * u, 30 * u], t, Math.round(y) + s)) put(img, q.x, q.y, q.big ? '#EFA230' : '#934C0E', q.a * 0.8);
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B]);
})();

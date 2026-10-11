/* Job 6, the frozen pass: two directions. */
(() => {
  const { C, Painter, put, particles, flicker, SUBJECT, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => v - Math.floor(v);
  /** Smooth noise, 0..1, in one and two dimensions. */
  const n1 = (x, s = 0) => { const i = Math.floor(x); return lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(x - i)); };
  const n2 = (x, y, s = 0) => {
    const i = Math.floor(x); const j = Math.floor(y); const fx = smooth(x - i); const fy = smooth(y - j);
    return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), fx), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), fx), fy);
  };

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }

  /** The edge of a figure toward a light: its pixels on layer z whose neighbour (dx, dy) lies behind it. */
  function edge(p, z, dx, dy, ramp, v, yMax = Infinity) {
    const r = p.ri(ramp); const hit = [];
    for (let y = 0; y < Math.min(p.h, yMax); y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
        if (p.z[ny * p.w + nx] < z) hit.push(i);
      }
    }
    for (const i of hit) { p.r[i] = r; p.v[i] = v; }
  }

  /**
   * The pale thing: a great shaggy back, a head sunk between the shoulders,
   * arms hanging to the snow. Its fur is on `ramp` at about `v`, paler toward
   * the upper left; its eyes are two slits of the card's colour. `s` is its
   * height. Returns where its eyes are.
   */
  function yeti(p, cx, fy, s, o) {
    const z = o.z ?? 6; const ramp = o.ramp || 'snow'; const R = p.ri(ramp);
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    // Fur in three flat bands, palest toward the upper left: no gradient, so no dither across the body.
    const fur = (x, y) => { const g = ((cx - x) / s * 1.1 + (fy - y) / s * 1.3 - 0.75) * (o.lit ?? 1); return o.v + (g > 0.3 ? 1 : g > -0.3 ? 0 : -1); };
    p.fill(P([[-0.25, 0], [-0.22, -0.22], [-0.33, -0.4], [-0.41, -0.6], [-0.42, -0.72], [-0.33, -0.8], [-0.2, -0.82], [-0.17, -0.92], [-0.08, -1],
      [0.08, -1], [0.17, -0.92], [0.2, -0.82], [0.33, -0.8], [0.42, -0.72], [0.41, -0.6], [0.33, -0.4], [0.22, -0.22], [0.25, 0],
      [0.08, 0], [0.04, -0.17], [-0.04, -0.17], [-0.08, 0]]), ramp, fur, z);
    for (const m of [-1, 1]) {
      p.fill(P([[0.3 * m, -0.79], [0.47 * m, -0.73], [0.57 * m, -0.5], [0.61 * m, -0.22], [0.68 * m, -0.03], [0.63 * m, 0], [0.5 * m, 0],
        [0.5 * m, -0.12], [0.44 * m, -0.4], [0.36 * m, -0.56]]), ramp, fur, z);
    }
    // Shag: tufts hanging from every lower edge, a few standing up off the back.
    const W = p.w; const hits = [];
    for (let y = Math.max(1, Math.floor(fy - s * 1.05)); y < Math.min(p.h - 1, fy + 2); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - s * 0.72)); x < Math.min(W, cx + s * 0.72); x += 1) {
        const i = y * W + x;
        if (p.z[i] >= z) continue;
        if (p.z[i - W] === z && hash(x, y, 9) < 0.5) hits.push([i, fur(x, y) - 1]);
        else if (p.z[i + W] === z && hash(x, y, 10) < 0.25) hits.push([i, fur(x, y)]);
      }
    }
    for (const [i, v] of hits) { p.r[i] = R; p.v[i] = v; p.z[i] = z; }
    // The eyes, each under a short shadow of brow, and the dark of the mouth.
    const ey = Math.round(fy - s * 0.88); const ex = Math.max(2, Math.round(s * 0.06));
    for (const m of [-1, 1]) {
      const x0 = m < 0 ? Math.round(cx) - 1 - ex : Math.round(cx) + ex - 1;
      p.shade(C.rect(x0, ey - 1, 2, 1), -1);
      p.fill(C.rect(x0, ey, 2, 1), o.eyes, 3.4, z + 2);
    }
    p.shade(C.rect(Math.round(cx) - 1, ey + Math.max(2, Math.round(s * 0.05)), 3, 1), -1);
    return { ex: cx, ey };
  }

  /** A traveller in a hooded cloak blown to the right, a staff in the right hand, a lantern held out on the left. */
  function traveller(p, cx, fy, s, ramp, v, z) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    p.fill(P([[-0.2, 0], [-0.17, -0.36], [-0.17, -0.6], [-0.13, -0.78], [-0.08, -0.9], [0.0, -0.99], [0.09, -0.92], [0.13, -0.78], [0.16, -0.6],
      [0.22, -0.4], [0.36, -0.16], [0.42, -0.04], [0.3, -0.02], [0.24, 0]]), ramp, v, z);
    p.fill(P([[-0.07, -0.86], [0.06, -0.86], [0.05, -0.74], [-0.06, -0.74]]), 'shadow', 0, z + 1); // the face, lost in the hood
    p.fill(C.rect(Math.round(cx + 0.24 * s), fy - s * 1.04, 1, s * 1.04), 'shadow', 1, z); // the staff
    p.fill(C.rect(Math.round(cx + 0.24 * s) - 1, fy - s * 1.04, 2, 1), 'shadow', 1, z);
    return { lx: Math.round(cx - 0.08 * s), ly: Math.round(fy - 0.46 * s) };
  }

  /** The traveller's lantern, held in front of the cloak: a dark frame round a core of the card's colour. */
  function lantern(p, lx, ly, ramp, z) {
    p.fill(C.rect(lx, ly - 1, 2, 1), 'shadow', 1, z);
    p.fill(C.rect(lx - 1, ly, 4, 4), 'shadow', 1.4, z);
    p.fill(C.rect(lx, ly + 1, 2, 2), ramp, 4, z + 1);
  }

  /* ================= A: the white teeth ================= */

  const RAMPS_A = {
    sky: ['#1A3352', '#22416A', '#2C5077', '#3A6593', '#4A7BAB', '#588FBC', '#6DA6CD', '#84BDD8', '#A6D6EE', '#C8EAF6', '#E3F6FB', '#FCFEFE'],
    snow: ['#0B1520', '#132233', '#1C3249', '#2C5077', '#3E6996', '#588FBC', '#78ADD2', '#9CCDE8', '#C8EAF6', '#E3F6FB', '#FCFEFE'],
    rock: ['#030609', '#060B11', '#0B1520', '#111D2A', '#182736', '#223445', '#2E4254', '#3F5566', '#566B7B', '#71879A'],
    drift: ['#05090F', '#0A121C', '#0F1A27', '#142231', '#192A3B'],
    shadow: ['#020407', '#05090E', '#09111A', '#0F1A26', '#16243A'],
    ...CARD,
  };

  /**
   * A range of peaks in sun from the left. Each peak is a summit (x, y) with
   * flanks dropping `sl` and `sr` per pixel across, easing after `w`. Each
   * column belongs to the peak standing highest there. Left of a peak's arête
   * the face is in the sun, scored by blue gullies down the fall line; right
   * of it the face is in blue shadow with snow ledges catching the sky, and
   * the sun grazing its skyline. Bare rock shows in ribs down the fall line
   * and along the shadowed side of the arête.
   */
  function range(p, peaks, o) {
    const W = p.w; const u = o.u; const z = o.z ?? 2; const base = o.base; const seed = o.seed || 1;
    const top = new Float32Array(W); const own = new Int16Array(W);
    let minY = base;
    for (let x = 0; x < W; x += 1) {
      let best = Infinity; let bi = 0;
      for (let i = 0; i < peaks.length; i += 1) {
        const k = peaks[i]; const dx = x + 0.5 - k.x; const d = Math.abs(dx);
        const run = Math.min(d, k.w) + Math.max(0, d - k.w) * 0.4;
        const jag = (n1(x / (2.2 * u), seed + i * 13) - 0.5) * 2.4 * u + (hash(x, i, seed) - 0.5) * 0.8;
        const y = k.y + run * (dx < 0 ? k.sl : k.sr) + jag * Math.min(1, d / (4 * u));
        if (y < best) { best = y; bi = i; }
      }
      top[x] = best; own[x] = bi; if (best < minY) minY = best;
    }
    // Each peak's lines: couloirs down its lit face; snow ledges and rock ribs down its shadowed one.
    const lines = peaks.map((k, i) => {
      const rr = rng(seed * 977 + i * 131); const H0 = Math.max(4 * u, base - k.y); const out = [];
      const n = (o.lines ?? 4) + Math.floor(rr() * 3);
      for (let j = 0; j < n; j += 1) {
        const lit = rr() < 0.55; const h0 = H0 * (0.03 + rr() * 0.42);
        out.push({
          lit, y0: k.y + h0, x0: k.x + h0 * (k.lean ?? 0.12) + (lit ? -1 : 1) * rr() * 2 * u,
          dx: (lit ? -1 : 1) * (0.3 + rr() * 0.45) / (lit ? k.sl : k.sr), len: H0 * (0.25 + rr() * 0.5), rock: !lit && rr() < 0.45, ph: rr() * 50,
        });
      }
      return out;
    });
    const S = p.ri(o.ramp || 'snow'); const RK = p.ri('rock');
    const y0 = Math.max(0, Math.floor(minY)); const y1 = Math.min(p.h, Math.ceil(base));
    for (let y = y0; y < y1; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const ty = top[x];
        if (y + 0.5 < ty) continue;
        const ki = own[x]; const k = peaks[ki]; const s2 = seed + ki * 31;
        const h = y + 0.5 - k.y;
        const ax = k.x + h * (k.lean ?? 0.12) + (n1(h / (3 * u), s2) - 0.5) * 4 * u * Math.min(1, h / (5 * u));
        const lit = x + 0.5 < ax;
        const sky = y + 0.5 - ty;
        const depth = clamp(sky / Math.max(1, base - ty), 0, 1);
        let r = S; let v = lit ? o.lit - depth * (o.litFall ?? 1) : o.shade - depth * 0.5;
        if (sky < 1) v += lit ? 0.5 : (h > 2 * u ? o.cornice : 0);
        else {
          for (const L of lines[ki]) {
            if (L.lit !== lit || y < L.y0 || y > L.y0 + L.len) continue;
            const t = (y - L.y0) / L.len;
            const xl = L.x0 + L.dx * (y - L.y0) + (n1((y - L.y0) / (3 * u), L.ph) - 0.5) * 1.6 * u;
            if (Math.abs(x + 0.5 - xl) > Math.max(0.5, (o.lineW ?? 0.7) * u * (1.2 - t))) continue;
            if (lit) v -= o.gully;
            else if (L.rock && o.rock && depth < 0.75) { r = RK; v = o.rockShade + 0.6; }
            else v += o.ledge;
            break;
          }
          if (o.rock && r === S && !lit && x + 0.5 - ax < 2.2 * u && h > 2.5 * u && depth < 0.7 && n2(x / (4 * u), y / (6 * u), s2 + 9) > 0.3) { r = RK; v = o.rockShade; }
        }
        if (r === S && o.hazeK) v = lerp(v, o.haze, depth ** 1.6 * o.hazeK);
        const i = y * W + x; p.r[i] = r; p.v[i] = o.quant === false ? v : Math.round(v); p.z[i] = z;
      }
    }
    return top;
  }

  /** Peaks along a width: summits between y0 and y1 every `gap` or so, some with a lower shoulder beside them. */
  function peakRow(W, u, o) {
    const r = rng(o.seed); const out = [];
    for (let x = -30 * u + r() * o.gap * u; x < W + 30 * u; x += (o.gap * (0.7 + r() * 0.6)) * u) {
      if (o.skip && o.skip(x)) continue;
      const y = (o.y0 + r() ** 1.3 * (o.y1 - o.y0)) * u; const w = (o.w * (0.6 + r() * 0.8)) * u;
      out.push({ x, y, sl: o.sl + r() * 0.5, sr: o.sr + r() * 0.5, w, lean: 0.04 + r() * 0.22 });
      if (r() < (o.shoulders ?? 0.6)) {
        const m = r() < 0.5 ? -1 : 1;
        out.push({ x: x + m * w * (0.55 + r() * 0.3), y: y + (5 + r() * 9) * u, sl: o.sl + r() * 0.5, sr: o.sr + r() * 0.5, w: w * 0.5, lean: 0.1 + r() * 0.2 });
      }
    }
    return out;
  }

  /** A snowfield, its upper edge at topAt(x): bright, falling off toward us, ribbed by wind-cut sastrugi. */
  function snowfield(p, topAt, y1, o) {
    const W = p.w; const u = o.u; const z = o.z ?? 3; const S = p.ri(o.ramp || 'snow');
    const tops = new Float32Array(W); let y0 = y1;
    for (let x = 0; x < W; x += 1) { tops[x] = topAt(x); y0 = Math.min(y0, tops[x]); }
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      for (let x = 0; x < W; x += 1) {
        const ty = tops[x];
        if (y + 0.5 < ty) continue;
        const d = y + 0.5 - ty; const t = clamp((y - y0) / (y1 - y0), 0, 1);
        let v = lerp(o.v0, o.v1, t ** 0.8);
        const q = Math.log(1 + d / (1.5 * u)) * o.rows + Math.sin(x / (13 * u) + d * 0.15) * 0.18 + n1(x / (21 * u), o.seed) * 0.8;
        const f = frac(q);
        if (f < 0.1 && n1(x / (6 * u), o.seed + Math.floor(q)) > 0.35) v -= o.rip;
        else if (f > 0.9) v += o.rip * 0.4;
        if (d < 1) v += o.lip ?? 0.6;
        const i = y * W + x; p.r[i] = S; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /** Footprints up the snow: a line of small dents along the points, spaced by their perspective `k`. */
  function trail(p, pts, u, dv = -1.6, z) {
    let side = 0;
    for (let s = 0; s + 1 < pts.length; s += 1) {
      const [x0, y0, k0] = pts[s]; const [x1, y1, k1] = pts[s + 1];
      const len = Math.hypot(x1 - x0, y1 - y0); const nx = -(y1 - y0) / len; const ny = (x1 - x0) / len;
      for (let d = 0; d < len;) {
        const t = d / len; const k = lerp(k0, k1, t);
        const off = (side ? 0.7 : -0.7) * u * k;
        p.shade(C.rect(Math.round(lerp(x0, x1, t) + nx * off), Math.round(lerp(y0, y1, t) + ny * off), k > 1.4 ? 2 : 1, 1), dv, z);
        side ^= 1; d += Math.max(1.6, 2.4 * u * k);
      }
    }
  }

  /** Spindrift: snow torn off a ridge by the wind, streaming right, bright where it is thick. */
  function spindrift(p, x0, y0, len, u, o = {}) {
    const rise = o.rise ?? 0.14; const k = o.k ?? 3;
    p.shade(C.rect(x0 - 2 * u, y0 - len * 0.6, len + 4 * u, len * 0.8), (x, y) => {
      const t = (x - x0) / len;
      if (t < 0 || t > 1) return 0;
      const cy = y0 - t * len * rise - Math.sin(t * 3.2) * 2.5 * u;
      const w = (1 + t * 7) * u; const d = Math.abs(y - cy) / w;
      if (d > 1) return 0;
      const streak = n2(x / (7 * u) - t * 3, y / (1 * u), o.seed || 3);
      return k * (1 - t) ** 0.8 * (1 - d * d) * (streak > 0.45 ? 1 : 0.35);
    });
  }

  /**
   * A near rock: an angular block with a lit plane on its left and a shadowed
   * one on its right, broken by a few cracks, snow lying along its flatter top.
   */
  function boulder(p, cx, by, rx, ry, o) {
    const r = rng(o.seed); const n = 5 + Math.floor(r() * 3); const pts = [[cx - rx, by + 3]];
    for (let i = 0; i <= n; i += 1) {
      const a = Math.PI + (i / n) * Math.PI; const j = 0.78 + r() * 0.34;
      pts.push([cx + Math.cos(a) * rx * j, by + Math.sin(a) * ry * j]);
    }
    pts.push([cx + rx, by + 3]);
    const shape = C.poly(pts); const z = o.z ?? 5;
    const RK = p.ri('rock'); const SN = p.ri(o.capRamp || 'snow');
    const kx = cx + (r() - 0.35) * rx * 0.6; const lean = 0.2 + r() * 0.6; const topY = by - ry;
    const first = new Int16Array(p.w).fill(-1);
    p.each(shape, (x, y, i) => {
      if (first[x] < 0) first[x] = y;
      const lit = x + 0.5 < kx + (y - topY) * lean;
      p.r[i] = RK; p.z[i] = z;
      p.v[i] = lit ? o.v + o.lit - ((y - topY) / ry) * 0.6 : o.v - ((y - topY) / ry) * 0.3;
    });
    p.cells(shape, { size: Math.max(3, rx * 0.5), joint: 0.6, jointV: -0.8, vary: 0.5, bevel: 0.25, seed: o.seed, z });
    if (o.cap !== undefined) {
      const u = o.u || 1;
      p.each(shape, (x, y, i) => {
        const d = y - first[x];
        const fl = first[x - 1] >= 0 ? first[x - 1] : first[x]; const fr = first[x + 1] >= 0 ? first[x + 1] : first[x];
        if (Math.abs(fr - fl) > 2.2) return;
        if (d < (1.2 + hash(x >> 1, 0, o.seed) * 1.6) * u * (o.capK ?? 1)) {
          p.r[i] = SN; p.v[i] = o.cap + (x < kx ? 0.6 : -0.5) + (d < 1 ? 0.3 : 0);
        }
      });
    }
    return { shape, cx, by, rx, ry };
  }

  /** A sword driven into a summit cairn, its blade glowing in the card's colour. */
  function cairnSword(p, cx, fy, s, ramp, z) {
    for (const [dx, hy, rx, ry] of [[0, 0.07, 0.3, 0.09], [-0.03, 0.2, 0.23, 0.08], [0.02, 0.32, 0.16, 0.07]]) {
      const sy = fy - hy * s;
      const st = C.ellipse(cx + dx * s, sy, rx * s, ry * s, 16);
      p.fill(st, 'rock', (x, y) => 2.4 + (cx - x) / s * 4 - (y - sy) / (ry * s) * 0.9, z);
      p.fill(C.join(st, C.rect(cx + dx * s - rx * s, sy - ry * s * 0.35, rx * s * 2, ry * s * 2)), 'snow', (x) => 7 + (cx - x) / s * 5, z);
    }
    const bx = Math.round(cx) - 1; const guard = Math.round(fy - s * 0.86);
    p.fill(C.rect(bx, guard + 1, 1, fy - s * 0.34 - guard), ramp, 4, z + 1);
    p.fill(C.rect(bx + 1, guard + 1, 1, fy - s * 0.36 - guard), ramp, 3, z + 1);
    p.fill(C.rect(Math.round(cx - s * 0.15), guard, Math.round(s * 0.3), 1.2), ramp, 2.6, z + 1);
    p.fill(C.rect(bx, guard - Math.round(s * 0.12), 2, Math.round(s * 0.12)), ramp, 1.4, z + 1);
    p.fill(C.rect(bx, guard - Math.round(s * 0.12) - 2, 2, 2), ramp, 3.4, z + 1);
  }

  /**
   * An avalanche: a slide pouring down the right flank into the col, its
   * front a rolling cloud of powder, lit on top, in the card's colour.
   */
  function avalanche(p, cx, fy, u, ramp, z) {
    const r = rng('avalanche');
    const slide = C.poly([[cx + 27 * u, fy - 45 * u], [cx + 31 * u, fy - 44 * u], [cx + 33 * u, fy - 8 * u], [cx - 6 * u, fy - 6 * u]]);
    p.fill(slide, ramp, (x, y) => {
      const q = frac((x + (y - fy) * 0.5) / (2.6 * u) + n1(y / (6 * u), 3) * 0.8);
      return q < 0.35 ? 3.7 : (fy - y > 24 * u ? 3.1 : 2.2);
    }, z);
    const puffs = [];
    for (let k = 0; k < 34; k += 1) {
      const t = r();
      const x = cx + lerp(-28, 38, t) * u + (r() - 0.5) * 6 * u;
      const lift = 1 - Math.abs(t - 0.5) * 1.7;
      puffs.push([x, fy - (1 + r() * 8 * lift + 5 * lift) * u, (2.6 + r() * 3.2 + lift * 2.6) * u]);
    }
    puffs.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, y, rad] of puffs) {
      p.fill(C.circle(x, y, rad, 16), ramp, (px, py) => {
        const k = ((x - px - 0.5) + (y - py - 0.5)) / rad;
        return k > 0.55 ? 4 : k > -0.1 ? 3.1 : 2.3;
      }, z);
    }
  }

  const A = {
    job: 6, setting: 'frozen-pass', key: 'A', id: 'frozen-pass-a', side: 'outside',
    revised: 'You loved both: the peaks are the outside and the ice cave the inside.',
    name: 'Frozen pass', title: 'The white teeth',
    pitch: 'High in the range at noon. Sunlit peaks stand round a col like teeth, the wind tears snow off their ridges, and whatever the card is waits on the pass, dark against the white.',
    notes: [
      ['Light', 'Hard sun from the left: lit faces go white, shadow faces go blue, and the brightest sky sits in the col where the card stands. Cloud shadow and dark rock hold the edges down.'],
      ['Detail', 'Gullies down the lit faces, snow ledges and bare rock ribs on the shadowed ones, spindrift streaming off a summit, sastrugi and a line of footprints up the snowfield, each rock casting a blue shadow.'],
      ['Vista', 'A range of sunlit peaks the width of the board, a snowfield climbing to the col and dark rocks in front. The card stands on the col: a pale beast, a lantern, a sword in a cairn, an avalanche, the sun itself.'],
      ['World', 'Sky high, table low: the peaks sit only at the very top, then a field of near boulders falls dark under the table and the snow keeps falling.'],
    ],
    palette: ['#060B11', '#0B1520', '#182736', '#2C5077', '#588FBC', '#84BDD8', '#C8EAF6', '#E3F6FB', '#FCFEFE'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { dither: 0.22 });
      const u = H / 134; const gx = W / 2;
      p.band(0, 98 * u, 'sky', 1, 9, 0);
      p.light(gx - 6 * u, 88 * u, 52 * u, 1.6, null, { zMax: 0, sx: 1.6 });
      range(p, peakRow(W, u, { seed: 'a-back-far', gap: 16, y0: 64, y1: 78, sl: 0.9, sr: 0.9, w: 10, shoulders: 0 }), {
        u, base: 96 * u, z: 1, seed: 2, lit: 8.4, litFall: 0.4, shade: 6.2, gully: 0.8, ledge: 0.6, cornice: 1.4, haze: 7.8, hazeK: 0.9,
      });
      const peaks = [
        { x: gx + 3 * u, y: 31 * u, sl: 1.6, sr: 1.25, w: 24 * u, lean: 0.22 },
        { x: gx + 14 * u, y: 44 * u, sl: 1.2, sr: 1.1, w: 10 * u, lean: 0.15 },
        { x: gx - 25 * u, y: 60 * u, sl: 1.1, sr: 1.0, w: 12 * u, lean: 0.1 },
        { x: gx + 32 * u, y: 58 * u, sl: 1.1, sr: 1.1, w: 12 * u, lean: 0.12 },
      ];
      range(p, peaks, { u, base: 100 * u, z: 2, seed: 5, lines: 6, lit: 10, litFall: 1.8, shade: 4.6, gully: 2, ledge: 1.8, cornice: 3.6, rock: 0.12, rockLit: 7.4, rockShade: 3.2, haze: 7, hazeK: 0.5 });
      spindrift(p, gx + 4 * u, 32 * u, 38 * u, u, { k: 4, rise: 0.1 });
      snowfield(p, (x) => 93 * u + Math.sin(x / (8 * u)) * u, 112 * u, { u, v0: 8.8, v1: 6.4, rows: 3, rip: 1.6, seed: 3, z: 3 });
      // The two near rocks, leaning together over the gap, a stone wedged where they meet.
      const jag = (pts, sd) => pts.map(([x, y], i) => (y <= 0 || y >= H || x <= 0 || x >= W ? [x, y] : [x + (hash(i, 3, sd) - 0.5) * 3 * u, y]));
      const left = C.poly(jag([[0, 0], [gx - 1 * u, 0], [gx - 4 * u, 8 * u], [gx - 11 * u, 13 * u], [gx - 16 * u, 18 * u], [gx - 21 * u, 25 * u], [gx - 23 * u, 34 * u],
        [gx - 25 * u, 44 * u], [gx - 23 * u, 52 * u], [gx - 24 * u, 62 * u], [gx - 26 * u, 72 * u], [gx - 24 * u, 82 * u], [gx - 23 * u, 92 * u], [gx - 26 * u, 100 * u], [gx - 28 * u, 108 * u], [gx - 31 * u, 134 * u], [0, 134 * u]], 1));
      const right = C.poly(jag([[W, 0], [gx - 1 * u, 0], [gx + 4 * u, 7 * u], [gx + 10 * u, 12 * u], [gx + 16 * u, 17 * u], [gx + 21 * u, 24 * u], [gx + 24 * u, 33 * u],
        [gx + 26 * u, 45 * u], [gx + 24 * u, 54 * u], [gx + 25 * u, 64 * u], [gx + 27 * u, 76 * u], [gx + 25 * u, 88 * u], [gx + 25 * u, 98 * u], [gx + 28 * u, 106 * u], [gx + 30 * u, 112 * u], [gx + 34 * u, 134 * u], [W, 134 * u]], 2));
      for (const [sh, sd, m] of [[left, 11, 1], [right, 12, -1]]) {
        p.fill(sh, 'rock', (x, y) => 1.4 + clamp(1 - Math.abs(x - gx) / (W * 0.5), 0, 1) * 1.6, 5);
        p.cells(sh, { size: 8 * u, sx: 0.8, sy: 1.3, joint: 0.8, jointV: -1, vary: 0.8, bevel: 0.9, lit: [m * 0.7, -0.7], seed: sd, z: 5 });
      }
      p.fill(C.ellipse(gx, 9 * u, 9 * u, 5 * u), 'rock', (x, y) => 2.2 - (y - 9 * u) / (5 * u), 5);
      p.fill(C.poly([[gx - 8 * u, 6 * u], [gx - 2 * u, 3.5 * u], [gx + 6 * u, 4.5 * u], [gx + 8 * u, 7 * u], [gx, 6 * u]]), 'snow', 4.6, 5);
      p.rim(-1, 0, 3.6, 5);   // the right rock's edge in the sun
      p.rim(1, 0, 1.6, 5);    // the left rock's, lit by the sky
      // The ledge we stand on: snow in shadow, the sun through the gap lying across it, footprints going in.
      const ledge = C.poly([[gx - 29 * u, 108 * u], [gx + 30 * u, 110 * u], [gx + 36 * u, 134 * u], [gx - 33 * u, 134 * u]]);
      p.fill(ledge, 'snow', (x, y) => 3.8 - (y - 108 * u) / (26 * u) * 1.6, 4);
      p.shade(C.poly([[gx - 16 * u, 109 * u], [gx + 25 * u, 110 * u], [gx + 29 * u, 134 * u], [gx - 2 * u, 134 * u]]), (x, y) => 3.6 - (y - 109 * u) / (25 * u) * 1.4, 4);
      // Its lip, where it drops away: a wavering edge, a stone or two in the snow.
      const lip = [];
      for (let k = 0; k <= 14; k += 1) lip.push([gx - 31 * u + k * 4.4 * u, 107 * u + k * 0.15 * u + (hash(k, 5, 7) - 0.5) * 1.6 * u]);
      p.fill(C.poly([...lip, ...lip.slice().reverse().map(([x, y]) => [x, y + 1.4 * u])]), 'snow', 2.2, 4);
      boulder(p, gx - 22 * u, 111 * u, 6 * u, 4 * u, { u, v: 1.2, lit: 2.4, cap: 5.4, seed: 31, z: 4 });
      boulder(p, gx + 21 * u, 113 * u, 4 * u, 3 * u, { u, v: 1.2, lit: 2.4, cap: 5.4, seed: 32, z: 4 });
      trail(p, [[gx + 5 * u, 134 * u, 1.8], [gx + 1 * u, 122 * u, 1.4], [gx + 5 * u, 111 * u, 1]], u, -1.8, 4);
      vignette(p, W, H, 1.6, 0.42);
      return {
        p,
        over(img) {
          for (const q of particles('snow', 28, [0, 0, W, H], 3.3, 81)) put(img, q.x, q.y, q.big ? '#FCFEFE' : '#C8EAF6', q.a * 0.8);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['path'], dither: 0.22 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const colY = 58 * u; // where the card stands
      p.band(0, 72 * u, 'sky', 0.6, 9.4, 0);
      p.light(gx, 50 * u, 64 * u, 2.2, null, { zMax: 0, sx: 2.2 });
      range(p, peakRow(W, u, { seed: 'a-vista-far', gap: 22, y0: 30, y1: 44, sl: 0.9, sr: 0.9, w: 14, shoulders: 0.3 }), {
        u, base: 66 * u, z: 1, seed: 7, lit: 9, litFall: 0.4, shade: 6.6, gully: 0.8, ledge: 0.6, cornice: 1.4, haze: 8, hazeK: 0.9,
      });
      p.light(gx, 50 * u, 40 * u, 1.4, null, { zMin: 1, zMax: 1, sx: 1.6 }); // the far range brightest in the col
      const peaks = [
        { x: gx - 40 * u, y: 2 * u, sl: 1.3, sr: 1.2, w: 32 * u, lean: 0.16 },
        { x: gx - 22 * u, y: 24 * u, sl: 1.2, sr: 1.25, w: 12 * u, lean: 0.12 },
        { x: gx + 37 * u, y: 10 * u, sl: 1.25, sr: 1.3, w: 28 * u, lean: 0.1 },
      ];
      peaks.push(...peakRow(W, u, { seed: 'a-vista-main', gap: 46, y0: 8, y1: 36, sl: 0.9, sr: 0.9, w: 26, skip: (x) => Math.abs(x - gx) < 70 * u }));
      range(p, peaks, { u, base: 70 * u, z: 2, seed: 11, lit: 10, litFall: 1.8, shade: 4.4, gully: 2, ledge: 1.8, cornice: 3.4, rock: 0.1, rockLit: 7.2, rockShade: 3, haze: 7, hazeK: 0.5 });
      // Cloud shadow drifting over the outer peaks, never over the col.
      const cloud = (x, from) => -smooth(clamp((n1(x / (48 * u), 5) - 0.42) / 0.16, 0, 1)) * clamp((Math.abs(x - gx) - from) / (30 * u), 0, 1);
      p.shade(null, (x) => 2.2 * cloud(x, 50 * u), 2);
      spindrift(p, gx + 38 * u, 10 * u, 58 * u, u, { k: 3.8, rise: 0.12 });
      // The snowfield climbing to the col, and the footprints up it.
      const fieldTop = (x) => 64 * u - 6 * u * Math.exp(-(((x - gx) / (18 * u)) ** 2)) + Math.sin(x / (9 * u)) * 0.6 * u;
      snowfield(p, fieldTop, 100 * u, { u, v0: 9.2, v1: 5.2, rows: 2.6, rip: 1.6, seed: 5, z: 3 });
      p.shade(null, (x) => 1.8 * cloud(x, 40 * u), 3);
      if (cat !== 'obstacle') trail(p, [[gx + 12 * u, 100 * u, 1.6], [gx - 6 * u, 84 * u, 1.2], [gx + 5 * u, 70 * u, 0.9], [gx, colY + 1, 0.7]], u, -1.8, 3);
      // Dark rocks in front: low in the middle, rising toward the edges, each with its blue shadow on the snow.
      const rr = rng('a-vista-rocks'); const rocks = [];
      for (let x = -10 * u; x < W + 20 * u; x += (13 + rr() * 13) * u) {
        const d = Math.abs(x - gx);
        if (d < 34 * u) continue;
        const lift = clamp((d - 34 * u) / (60 * u), 0, 1);
        rocks.push([x, 100 * u + rr() * 4 * u, (8 + rr() * 9 + lift * 6) * u, (8 + lift * 22 + rr() * 8) * u, Math.floor(rr() * 1e6)]);
      }
      for (let x = gx - 30 * u; x < gx + 30 * u; x += 11 * u) rocks.push([x + rr() * 4 * u, 105 * u, (6 + rr() * 4) * u, (4 + rr() * 4) * u, Math.floor(rr() * 1e6)]);
      for (const [x, by, rx, ry] of rocks) p.shade(C.poly([[x, by - ry * 0.3], [x + rx * 0.6, by - ry * 0.8], [x + rx * 2.6, by - ry * 0.45], [x + rx * 2.4, by + 1]]), -1.8, 3);
      for (const [x, by, rx, ry, sd] of rocks) boulder(p, x, by, rx, ry, { u, v: 1.2, lit: 2.6, cap: 6.2, seed: sd, z: 5 });
      // The card, on the col.
      if (cat === 'monster') {
        const s = 46 * u;
        yeti(p, gx, colY + 1, s, { v: 4.15, lit: 1.6, eyes: ramp, z: 6 });
        edge(p, 6, 0, -1, 'snow', 9.4); edge(p, 6, -1, 0, 'snow', 8.4, colY - s * 0.4);
        p.tint(gx, colY - s * 0.9, 9 * u, hex, 0.5, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 32 * u;
        const { lx, ly } = traveller(p, gx, colY + 1, s, 'shadow', 2, 6);
        edge(p, 6, 0, -1, 'snow', 9); edge(p, 6, -1, 0, 'snow', 7.6);
        lantern(p, lx, ly, ramp, 8);
        p.tint(lx + 1, ly + 2, 12 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(lx + 1, ly + 2, 26 * u, hex, 0.35, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        cairnSword(p, gx, colY + 1, 36 * u, ramp, 6);
        p.tint(gx, colY - 36 * u * 0.6, 22 * u, hex, 0.55, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        avalanche(p, gx, colY + 2 * u, u, ramp, 6);
        p.tint(gx + 4 * u, colY + 4 * u, 34 * u, hex, 0.3, flicker(0.5, 0.12, 0.6));
      } else {
        // The sun stands in the col and lays its light down the snowfield.
        const sx = gx; const sy = colY - 14 * u; const sr = 5 * u;
        p.shade(null, (x, y) => {
          const d = Math.hypot(x - sx, y - sy);
          if (d < sr) return 0;
          const a = Math.atan2(y - sy, x - sx);
          return (frac(a / (Math.PI * 2) * 16 + 0.25) < 0.4 ? 1.4 : 0) * clamp(1 - d / (52 * u), 0, 1);
        }, 0);
        p.light(sx, sy, 30 * u, 3, null, { zMax: 2 });
        p.each(C.circle(sx, sy, sr), (x, y, i) => { if (p.z[i] <= 2) { p.r[i] = p.ri('path'); p.v[i] = 4.6 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / sr * 1.2; p.z[i] = 0; } });
        p.tint(sx, sy, 16 * u, CARD.path[3], 0.6, flicker(0.4, 0.06, 0.3));
        p.tint(sx, sy, 40 * u, CARD.path[4], 0.5);
        p.tint(sx, colY + 18 * u, 34 * u, CARD.path[4], 0.45);
      }
      vignette(p, W, H, 1.8, 0.4);
      const sdx = gx + 38 * u; const sdy = 10 * u;
      return {
        p,
        over(img, t) {
          for (let i = 0; i < Math.round(40 * u); i += 1) {
            const ph = frac(t * 0.3 + hash(i, 1, 4));
            const x = sdx + ph * 60 * u; const y = sdy - ph * 7 * u + (hash(i, 2, 4) - 0.5) * 12 * u * ph + Math.sin(ph * 6 + i) * u;
            put(img, x, y, '#FCFEFE', (1 - ph) * 0.9);
          }
          for (const q of particles('snow', Math.round(W / 8), [0, 0, W, H], t, 61)) put(img, q.x, q.y, q.big ? '#FCFEFE' : '#C8EAF6', q.a * 0.85);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { dither: 0.22 });
      const u = H / 250; const gx = W / 2;
      p.band(0, 70 * u, 'sky', 1.6, 8.6, 0);
      p.light(gx, 56 * u, 110 * u, 1.4, null, { zMax: 0, sx: 2 });
      range(p, peakRow(W, u, { seed: 'a-world-far', gap: 30, y0: 30, y1: 44, sl: 0.8, sr: 0.8, w: 18, shoulders: 0.3 }), {
        u, base: 70 * u, z: 1, seed: 3, lit: 8.4, litFall: 0.4, shade: 5.8, gully: 0.8, ledge: 0.6, cornice: 1.4, haze: 7.4, hazeK: 0.8,
      });
      range(p, peakRow(W, u, { seed: 'a-world-main', gap: 56, y0: 0, y1: 26, sl: 1.0, sr: 1.0, w: 32 }), {
        u, base: 72 * u, z: 2, seed: 13, lit: 10, litFall: 1.8, shade: 4.4, gully: 2, ledge: 1.8, cornice: 3.2, rock: 0.1, rockLit: 7, rockShade: 3, haze: 7, hazeK: 0.5,
      });
      p.shade(null, (x) => (n1(x / (60 * u), 8) > 0.55 ? -2 : 0), 2);
      snowfield(p, (x) => 57 * u + Math.sin(x / (14 * u)) * 1.2 * u, 74 * u, { u, v0: 8.6, v1: 4.4, rows: 2.4, rip: 1.6, seed: 9, z: 3 });
      // The near rocks: shadowed snow between them, boulders scattered thicker and bigger toward us,
      // the first of them standing up dark against the snowfield.
      p.fill(C.rect(0, 70 * u, W, H - 70 * u), 'drift', (x, y) => 3 - (y - 70 * u) / (H - 70 * u) * 2.6 + (n2(x / (30 * u), y / (8 * u), 3) > 0.6 ? 0.5 : 0), 4);
      const rr = rng('a-world-rocks'); const rocks = [];
      for (let x = -10 * u; x < W + 20 * u; x += (16 + rr() * 22) * u) rocks.push([x, (68 + rr() * 6) * u, (12 + rr() * 14) * u, (9 + rr() * 8) * u, Math.floor(rr() * 1e6)]);
      for (let k = 0; k < 120; k += 1) {
        const t = rr() ** 0.9; const y = (84 + t * 190) * u;
        const sc = 0.7 + t * 1.5;
        rocks.push([rr() * (W + 40 * u) - 20 * u, y, (10 + rr() * 16) * sc * u, (6 + rr() * 10) * sc * u, Math.floor(rr() * 1e6)]);
      }
      rocks.sort((a, b) => a[1] - b[1]);
      for (const [x, by, rx, ry, sd] of rocks) {
        const dark = clamp((by - 70 * u) / (90 * u), 0, 1);
        boulder(p, x, by, rx, ry, { u, v: 1.5 - dark * 0.4, lit: 2.6 - dark * 1.4, cap: 4.4 - dark * 1.2, capRamp: 'drift', capK: 1.3, seed: sd, z: 5 });
      }
      p.shade(null, (x, y) => -1.3 * clamp((y / H - 0.27) / 0.05, 0, 1) - 2.2 * Math.max(0, y / H - 0.33), 5);
      p.shade(null, (x, y) => -2 * Math.max(0, y / H - 0.33), 4);
      return {
        p,
        over(img, t) {
          for (const q of particles('snow', 80, [0, 0, W, H], t, 71)) put(img, q.x, q.y, q.big ? '#C8EAF6' : '#84BDD8', q.a * (q.y < 60 * u ? 0.9 : 0.5));
        },
      };
    },
  };

  /* ================= B: the ice cave ================= */

  const RAMPS_B = {
    ice: ['#03070C', '#06101A', '#0B1926', '#112436', '#183149', '#21415F', '#2C5077', '#3F6A94', '#588FBC', '#7FB5D8', '#A8E1F7', '#D2F0FA'],
    glow: ['#0B1926', '#183149', '#2C5077', '#3F6A94', '#588FBC', '#7FB5D8', '#A8E1F7', '#C8EEFA', '#E6F8FD', '#FCFEFE'],
    floor: ['#020509', '#050C14', '#09141F', '#0F1E2D', '#162A3E', '#1F3A54', '#2C5077', '#4A7BA6', '#84BDD8', '#C8EAF6'],
    snow: ['#0B1520', '#132233', '#1C3249', '#2C5077', '#3E6996', '#588FBC', '#78ADD2', '#9CCDE8', '#C8EAF6', '#E3F6FB', '#FCFEFE'],
    shadow: ['#020407', '#05090E', '#09111A', '#0F1A26', '#16243A'],
    wood: ['#0C0A09', '#17120F', '#231B16', '#30251D', '#3F3025', '#4F3D2F'],
    ...CARD,
  };
  // Layers: 1 the walls and floor, 2 columns and the falls, 3 alcoves and the tunnel, 4 icicles and crystals, 6+ the card.
  // No daylight anywhere: every light here is the ice's own glow ('glow' is emissive).

  /** An irregular arch: straight-ish sides, a squashed round top, every point but the base nudged. */
  function archPts(cx, top, hw, bottom, o = {}) {
    const sq = o.squash ?? 0.8; const spring = top + hw * sq; const jit = o.jit ?? 0; const seed = o.seed || 1;
    const pts = []; const sideN = Math.max(1, Math.round((bottom - spring) / Math.max(2, hw * 0.3)));
    for (let k = 0; k < sideN; k += 1) pts.push([cx - hw, bottom - ((bottom - spring) * k) / sideN]);
    const n = 12;
    for (let i = 0; i <= 2 * n; i += 1) { const a = Math.PI - (i / (2 * n)) * Math.PI; pts.push([cx + hw * Math.cos(a), spring - hw * sq * Math.sin(a)]); }
    for (let k = sideN - 1; k >= 0; k -= 1) pts.push([cx + hw, bottom - ((bottom - spring) * k) / sideN]);
    return [pts.map(([x, y], i) => (y >= bottom - 0.01 ? [x, y] : [x + (hash(i, 1, seed) - 0.5) * jit, y + (hash(i, 2, seed) - 0.5) * jit * 0.7]))];
  }

  /**
   * Scallops: the dished surface of cave ice, each dish lit on its far side
   * from the light at lightAt(x, y) → [x, y], the ridges between them bright.
   */
  function scallops(p, shape, o) {
    const s = o.size; const seed = o.seed || 5; const sy = o.sy || 1;
    p.each(shape, (x, y, i) => {
      if (o.z !== undefined && p.z[i] !== o.z) return;
      const fx = x / s; const fy = y / (s * sy);
      const gx = Math.floor(fx); const gy = Math.floor(fy);
      let d1 = 1e9; let d2 = 1e9; let best = 0; let bx = 0; let by = 0;
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          const cx = gx + k; const cy = gy + j;
          const px = cx + 0.15 + hash(cx, cy, seed) * 0.7; const py = cy + 0.15 + hash(cx, cy, seed + 1) * 0.7;
          const d = Math.hypot((fx - px) * s, (fy - py) * s * sy);
          if (d < d1) { d2 = d1; d1 = d; best = cx * 7349 + cy; bx = (fx - px) * s; by = (fy - py) * s * sy; } else if (d < d2) d2 = d;
        }
      }
      let dv;
      if (d2 - d1 < (o.joint ?? 1)) dv = o.jointV ?? 0.5;
      else {
        const [lx0, ly0] = o.lightAt(x, y); let lx = lx0 - x; let ly = ly0 - y; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
        const len = Math.hypot(bx, by) || 1;
        dv = (hash(best, 0, seed + 2) - 0.5) * (o.vary ?? 0.5) + ((-bx * lx - by * ly) / len) * (o.bevel ?? 0.8) * Math.min(1, len / (s * 0.45));
      }
      p.v[i] += dv;
    });
  }

  /** Glowing seams: thin strata in the old ice catching the glow, showing only where the ice is thin enough. */
  function seams(p, shape, o) {
    const u = o.u; const gap = o.gap * u;
    p.shade(shape, (x, y) => {
      const w = y + Math.sin(x / (o.per * u) + o.seed) * o.amp * u + (n1(x / (11 * u), o.seed) - 0.5) * 3 * u;
      const k = Math.round(w / gap);
      if (Math.abs(w - k * gap) >= 0.55) return 0;
      return n1(x / (o.patch * u) + k * 3.7, o.seed + 1) > o.thresh ? o.k * (o.at ? o.at(x, y) : 1) : 0;
    }, o.z);
  }

  /** Thin ice: soft patches where more of the glow comes through, in two clean steps. */
  function thinIce(p, shape, o) {
    const u = o.u;
    p.shade(shape, (x, y) => { const g = n2(x / (o.size * u), y / (o.size * 0.7 * u), o.seed); return g > 0.7 ? 2 * o.k : g > 0.56 ? o.k : 0; }, o.z);
  }

  /** Icicles hanging from hangAt(x) between x0 and x1: tapering, lit down their left edge, longest in the middle. */
  function icicles(p, x0, x1, hangAt, u, o) {
    const r = rng(o.seed); const z = o.z ?? 4; const I = p.ri('ice');
    for (let x = x0 + r() * 2 * u; x < x1;) {
      const xi = Math.round(x); const y0 = hangAt(xi);
      if (y0 !== null && y0 !== undefined) {
        const mid = 1 - Math.min(1, Math.abs(x - (x0 + x1) / 2) / ((x1 - x0) / 2));
        const L = (o.min + r() ** 1.4 * (o.max - o.min) * (0.35 + 0.65 * mid)) * u;
        const w = L > 10 * u ? 3 : L > 4.5 * u ? 2 : 1;
        p.fill(C.poly([[xi - 0.4, y0 - 1], [xi + w + 0.4, y0 - 1], [xi + w * 0.5 + 0.2, y0 + L]]), 'ice', o.v, z);
        if (w > 1) p.each(C.rect(xi, y0, 1, L * 0.75), (px, py, i) => { if (p.z[i] === z && p.r[i] === I) p.v[i] = o.v + (o.hi ?? 3.5); });
      }
      x += (1 + r() * 2.4) * u;
    }
  }
  /** Where an icicle hangs from in column x: the first pixel of layer z, or null. */
  const topOf = (p, z) => (x) => {
    if (x < 0 || x >= p.w) return null;
    for (let y = 0; y < p.h; y += 1) if (p.z[y * p.w + x] === z) return y;
    return null;
  };

  /** The rim of a shape: its pixels on layer z with a neighbour on a lower layer take +dv. */
  function lip(p, z, dv, sides = [[-1, 0], [1, 0], [0, -1]]) {
    const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        for (const [dx, dy] of sides) if (p.z[i + dy * p.w + dx] < z) { hit.push(i); break; }
      }
    }
    for (const i of hit) p.v[i] += dv;
  }

  /** A cluster of ice crystals: tall pointed prisms, each lit down one face, darker down the other, a bright tip. */
  function crystals(p, cx, fy, h, u, o = {}) {
    const r = rng(o.seed || 'crystals'); const z = o.z ?? 4; const n = o.n ?? 4; const R = o.ramp || 'glow'; const v = o.v ?? 5;
    const list = [];
    for (let i = 0; i < n; i += 1) {
      const hh = h * (0.4 + r() * 0.6); const w = Math.max(2, hh * (0.24 + r() * 0.1));
      const x0 = cx + (i - (n - 1) / 2) * w * 0.85 + (r() - 0.5) * w * 0.6;
      list.push({ hh, w, x0, lean: (r() - 0.5) * 0.5 + (x0 - cx) / Math.max(1, h) * 0.6 });
    }
    list.sort((a, b) => b.hh - a.hh);
    const tips = [];
    for (const c of list) {
      const tipX = c.x0 + c.lean * c.hh * 0.5; const tipY = fy - c.hh;
      p.fill(C.poly([[c.x0 - c.w / 2, fy], [c.x0 - c.w / 2 + c.lean * c.hh * 0.38, fy - c.hh * 0.76], [tipX, tipY], [c.x0 + c.w / 2 + c.lean * c.hh * 0.38, fy - c.hh * 0.76], [c.x0 + c.w / 2, fy]]), R,
        (x, y) => (x + 0.5 < lerp(c.x0, tipX, (fy - y) / c.hh) ? v + 1 : v - 1) + (y < tipY + 2 ? 1 : 0), z);
      tips.push([Math.round(tipX), Math.round(tipY)]);
    }
    return tips;
  }

  /**
   * A frozen waterfall: a cascade stopped where it fell, pouring out of a
   * crack in the roof and spreading over the floor in lobes, fluted from top
   * to bottom and glowing from inside, its thin edges brightest.
   */
  function frozenFall(p, cx, top, bottom, wTop, wBot, u, o = {}) {
    const k = o.k ?? 1; const seed = o.seed || 3; const z = o.z ?? 2; const flutes = o.flutes || 9;
    const hwAt = (y) => { const t = clamp((y - top) / (bottom - top), 0, 1); return lerp(wTop / 2, wBot / 2, t ** 1.3) + (n1(y / (6 * u), seed) - 0.5) * 2.4 * u; };
    const pts = [];
    for (let i = 0; i <= 24; i += 1) { const y = lerp(top - 1, bottom - 3 * u, i / 24); pts.push([cx - hwAt(y), y]); }
    for (let i = 0; i <= 30; i += 1) { const t = i / 30; pts.push([lerp(cx - wBot / 2, cx + wBot / 2, t), bottom - 3 * u + Math.abs(Math.sin(t * Math.PI * 6)) ** 0.6 * 2 * u]); }
    for (let i = 24; i >= 0; i -= 1) { const y = lerp(top - 1, bottom - 3 * u, i / 24); pts.push([cx + hwAt(y), y]); }
    const shape = C.poly(pts);
    // The pool it froze into, spread over the floor at its foot.
    p.fill(C.ellipse(cx, bottom, wBot * 0.78, 2.8 * u, 24), 'glow', (x, y) => (y < bottom - 1 ? 5 : 4) - (Math.abs(x - cx) > wBot * 0.55 ? 1 : 0), z);
    p.fill(shape, 'glow', (x, y) => {
      const t = clamp((y - top) / (bottom - top), 0, 1); const hw = hwAt(Math.min(y, bottom - 3 * u)); const q = (x + 0.5 - cx) / hw;
      const fl = frac(q * flutes * 0.5 + n1(y / (13 * u), seed + 1) * 0.4 + 0.5); const ridge = 1 - Math.abs(fl * 2 - 1);
      let v = 7.4 + t * 1.1 - Math.abs(q) ** 2 * 2.6 + (ridge > 0.72 ? 1 : ridge < 0.22 ? -1 : 0) + (Math.abs(q) > 0.9 ? 1.2 : 0);
      if (t > 0.88) v += 0.6;
      return Math.round(v - (1 - k) * 4);
    }, z);
    // The crack in the roof it pours from.
    p.fill(C.poly([[cx - wTop * 0.62, 0], [cx + wTop * 0.6, 0], [cx + wTop * 0.36, top + 2 * u], [cx + 2 * u, top + 3.5 * u], [cx - wTop * 0.4, top + 2 * u]]), 'ice', 0.6, 2);
    p.light(cx, lerp(top, bottom, 0.62), wBot * 1.5, 4.4 * k, null, { zMin: 1, zMax: 3, hard: true });
    p.light(cx, lerp(top, bottom, 0.62), wBot * 3.2, 1.8 * k, null, { zMin: 1, zMax: 3 });
    return { shape, hwAt };
  }

  /** An ice column where an icicle met the floor: waisted, fluted, its thin edges glowing and its heart dark. */
  function column(p, cx, top, bottom, w, u, o = {}) {
    const seed = o.seed || 5; const z = o.z ?? 2; const toward = o.toward ?? 0;
    const hwAt = (y) => {
      const t = clamp((y - top) / (bottom - top), 0, 1);
      return (w / 2) * (0.45 + 0.55 * Math.min(1, Math.abs(t - 0.55) * 2.2) ** 1.3) + (t < 0.08 ? (0.08 - t) * w * 3 : 0) + (t > 0.9 ? (t - 0.9) * w * 4 : 0) + (n1(y / (5 * u), seed) - 0.5) * 1.6 * u;
    };
    const pts = [];
    for (let i = 0; i <= 20; i += 1) { const y = lerp(top, bottom, i / 20); pts.push([cx - hwAt(y), y]); }
    for (let i = 20; i >= 0; i -= 1) { const y = lerp(top, bottom, i / 20); pts.push([cx + hwAt(y), y]); }
    p.fill(C.poly(pts), 'ice', (x, y) => {
      const q = (x + 0.5 - cx) / hwAt(y); const a = Math.abs(q);
      return (o.v ?? 2) + (a > 0.72 ? 2 : a > 0.42 ? 1 : 0) + (frac(q * 1.6 + 0.5) < 0.14 ? -1 : 0) + (toward && Math.sign(q) === toward && a > 0.6 ? 1 : 0);
    }, z);
  }

  /**
   * An alcove in the ice: a shallow niche whose back is thin enough to glow,
   * its sides in shadow, crystals grown at its foot, icicles off its lip.
   * Never a window: nothing but more ice shows inside it.
   */
  function alcove(p, cx, top, hw, bottom, u, o = {}) {
    const seed = o.seed || 1; const k = o.k ?? 1;
    const sq = Math.min(1, (bottom - top) / hw * 0.7);
    const outer = archPts(cx, top, hw, bottom, { jit: 3 * u, seed, squash: sq });
    const inner = archPts(cx + hw * 0.06, top + hw * 0.2, hw * 0.74, bottom, { jit: 2.4 * u, seed: seed + 5, squash: sq });
    p.fill(outer, 'ice', 1.6, 3);
    const back = bottom - (bottom - top) * 0.32;
    p.fill(inner, 'ice', (x, y) => Math.round(3.4 + 3 * k * clamp(1.15 - Math.hypot((x - cx) / (hw * 0.72), (y - back) / ((bottom - top) * 0.62)), 0, 1)), 3);
    scallops(p, inner, { size: 3.4 * u, seed: seed + 3, z: 3, lightAt: () => [cx, back], bevel: 0.8, jointV: 0.5, joint: 0.8 });
    p.shade(inner, (x, y) => (Math.abs(x - (cx + hw * 0.18 + Math.sin(y / (4 * u) + seed) * 1.2 * u)) < 0.6 && y > top + hw * 0.5 ? 1.6 : 0), 3);
    lip(p, 3, 1, [[-1, 0], [1, 0], [0, 1]]);
    p.shade(outer, (x, y) => (y < top + (bottom - top) * 0.3 ? -1 : 0), 3); // the overhang's shadow
    p.shade(inner, (x, y) => (y >= bottom - 1.5 * u ? 2 : 0), 3); // frost on its ledge
    const tips = crystals(p, cx - hw * 0.05, bottom, (8 + hash(seed, 0, 4) * 6) * u, u, { seed: `alc-${seed}`, n: 3 + (seed % 3), v: 4 + k, z: 4 });
    icicles(p, cx - hw - 1 * u, cx + hw + 1 * u, topOf(p, 3), u, { seed: `alc-ice-${seed}`, min: 1.5, max: 8, v: 3, hi: 2.5, z: 4 });
    return tips;
  }

  /** The floor's reflection of something glowing: a column of light broken by ripples, fading toward us. */
  function reflection(p, cx, hw, floorY, len, u, k = 1) {
    p.shade(C.rect(cx - hw * 0.62, floorY, hw * 1.24, len), (x, y) => {
      const t = (y - floorY) / len; const w = 1 - Math.abs(x - cx) / (hw * 0.62);
      return frac((y - floorY) / (2.2 * u) + hash(Math.floor(x / 2), Math.floor((y - floorY) / (2.2 * u)), 4) * 0.5) < 0.45 ? 0 : 4.4 * k * (1 - t) * w;
    }, 1);
  }

  /**
   * Plates of floor ice in perspective: irregular plates laid out in rows that
   * widen toward the viewer, a pale crack where two meet with a dark seam
   * beside it, each plate a little lighter on its far side where the glassy
   * ice catches the glow, a little darker or clearer than its neighbours.
   */
  function plates(p, shape, o) {
    const seed = o.seed || 7;
    p.each(shape, (x, y, i) => {
      if (o.z !== undefined && p.z[i] !== o.z) return;
      const d = y + 0.5 - o.vy;
      if (d <= 0) return;
      const Y = Math.log(d / o.d0) * o.rows; const X = ((x + 0.5 - o.vx) / d) * o.cols;
      const sx = d / o.cols; const sy = d / o.rows;
      const gx = Math.floor(X); const gy = Math.floor(Y);
      let d1 = 1e9; let d2 = 1e9; let best = 0; let byY = 0;
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          const cx = gx + k; const cy = gy + j;
          const px = cx + 0.15 + hash(cx, cy, seed) * 0.7; const py = cy + 0.2 + hash(cx, cy, seed + 1) * 0.6;
          const dd = Math.hypot((X - px) * sx, (Y - py) * sy);
          if (dd < d1) { d2 = d1; d1 = dd; best = cx * 7349 + cy; byY = Y - py; } else if (dd < d2) d2 = dd;
        }
      }
      const gap = d2 - d1;
      let dv;
      if (gap < (o.joint ?? 1.1)) dv = o.edge ?? 1.5;
      else {
        dv = (hash(best, 0, seed + 2) - 0.5) * (o.vary ?? 0.7) + clamp(-byY * 0.6, -0.3, 0.45);
        if (gap < (o.joint ?? 1.1) + 1.2 && byY > 0) dv -= 0.5;
      }
      p.v[i] += dv;
    });
  }

  /** A chest frozen into a block of ice, glowing in the card's colour through it. */
  function iceChest(p, cx, fy, s, ramp, z) {
    const bw = s * 0.6; const bh = s * 0.78;
    const block = C.poly([[cx - bw, fy], [cx - bw * 1.02, fy - bh * 0.7], [cx - bw * 0.7, fy - bh], [cx + bw * 0.5, fy - bh * 0.92], [cx + bw * 0.98, fy - bh * 0.6], [cx + bw, fy]]);
    p.fill(block, 'ice', (x, y) => 6.2 + (cx - x) / s * 2.4 + (fy - y) / s * 1.4, z);
    SUBJECT.item(p, cx, fy - s * 0.12, s * 0.6, ramp, z + 1);
    p.shade(block, 1.2, z + 1);
    // Facets: the top face catching the light, a fracture plane across it, the left edge bright.
    p.fill(C.poly([[cx - bw * 1.02, fy - bh * 0.7], [cx - bw * 0.7, fy - bh], [cx + bw * 0.5, fy - bh * 0.92], [cx + bw * 0.98, fy - bh * 0.6], [cx + bw * 0.6, fy - bh * 0.7], [cx - bw * 0.5, fy - bh * 0.76]]), 'ice', 9.6, z + 3);
    p.fill(C.poly([[cx + bw * 0.55, fy - bh * 0.7], [cx + bw * 0.66, fy - bh * 0.7], [cx + bw * 0.2, fy - bh * 0.1], [cx + bw * 0.1, fy - bh * 0.1]]), 'ice', 9, z + 3);
    p.fill(C.rect(cx - bw * 1.0, fy - bh * 0.7, 1, bh * 0.7), 'ice', 10, z + 3);
  }

  /** Twinkling points: crystal tips catching the glow, per frame. */
  function twinkle(img, tips, t, hex = '#E6F8FD') {
    tips.forEach(([x, y], i) => {
      const a = clamp(Math.sin(t * 1.7 + i * 2.3) * 1.6 - 0.6, 0, 1);
      if (a <= 0) return;
      put(img, x, y, hex, a); put(img, x - 1, y, hex, a * 0.4); put(img, x + 1, y, hex, a * 0.4); put(img, x, y - 1, hex, a * 0.4);
    });
  }

  const B = {
    job: 6, setting: 'frozen-pass', key: 'B', id: 'frozen-pass-b', side: 'inside',
    revised: 'After your note: the ice cave is sealed, with no openings to the outside anywhere. The ice glows by itself, the back runs on down an ice tunnel into the dark, and the cards meet you before a frozen waterfall; only a Clear Path splits it with a fissure of gold.',
    name: 'Frozen pass', title: 'The ice cave',
    pitch: 'Deep in the glacier, a cavern sealed in old blue ice. No daylight reaches it: the ice glows by itself, and every card waits before a frozen waterfall.',
    notes: [
      ['Light', 'The ice’s own cold glow, coming through walls too thick to see out of: brightest in the frozen waterfall, the backs of the alcoves, the edges of the columns and the seams in the old ice, black where it is thickest.'],
      ['Detail', 'Scalloped walls run with glowing strata, columns where icicles met the floor, alcoves with crystals grown in them, icicles everywhere, and a glassy floor that holds the waterfall upside down.'],
      ['Vista', 'A long sealed cavern of alcoves and columns. The cards meet you before the frozen waterfall: a pale beast, a lantern, a chest frozen in a block, a wall of teal ice. Only a Clear Path splits the falls with a fissure glowing gold.'],
      ['World', 'The glassy cracked floor under the table, frost and crystals at its edges where the walls glow, and nothing falling from above.'],
    ],
    palette: ['#03070C', '#0B1926', '#183149', '#2C5077', '#588FBC', '#7FB5D8', '#A8E1F7', '#E6F8FD', '#16243A'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['glow'] });
      const u = H / 134; const gx = W / 2; const floorY = 104 * u;
      // The near wall round the way in: scalloped, thin and glowing close to it, seamed in rings like old growth.
      const all = C.rect(0, 0, W, H);
      p.fill(C.rect(0, 0, W, floorY), 'ice', 1.6, 1);
      p.fill(C.rect(0, floorY, W, H - floorY), 'floor', 1.6, 1);
      scallops(p, C.rect(0, 0, W, floorY), { size: 7 * u, sy: 0.85, seed: 3, z: 1, lightAt: () => [gx, 60 * u], bevel: 1, jointV: 0.5 });
      p.shade(C.rect(0, 0, W, floorY), (x, y) => {
        const d = Math.hypot(x - gx, (y - 62 * u) * 0.75) + (n1(Math.atan2(y - 62 * u, x - gx) * 3, 7) - 0.5) * 4 * u;
        return Math.abs(frac(d / (7 * u)) - 0.5) > 0.42 && n1(Math.atan2(y - 62 * u, x - gx) * 2.2 + Math.floor(d / (7 * u)), 8) > 0.5 ? 1.8 : 0;
      }, 1);
      p.light(gx, 62 * u, 62 * u, 3.6, null, { zMin: 1, zMax: 1, hard: true });
      // The tunnel: sections of ice, each smaller, lower and darker than the last, falling away into dark blue.
      const N = 9; const secs = [];
      for (let i = 0; i < N; i += 1) {
        const f = i / (N - 1);
        const hw = lerp(31 * u, 3.5 * u, f ** 0.72); const cx = gx + Math.sin(f * 2.4) * 5 * u * f; const cy = lerp(63 * u, 88 * u, f ** 0.85);
        secs.push({ f, hw, cx, cy, z: 10 + i, shape: archPts(cx, cy - hw * 1.5, hw, cy + hw * 1.28, { jit: hw * 0.14, seed: 40 + i, squash: 0.82 }) });
      }
      for (const S of secs) {
        const v = lerp(5.4, 0.5, S.f ** 0.55) + (S.f === 0 ? -0.6 : 0);
        p.fill(S.shape, 'ice', (x, y) => {
          const fl = y > S.cy + S.hw * 0.55;
          return v + (fl ? 0.4 + (Math.abs(x - S.cx) < S.hw * 0.2 ? 0.6 : 0) * (1 - S.f) : 0) + clamp((Math.abs(x - S.cx) / S.hw - 0.7) / 0.3, 0, 1) * 0.8;
        }, S.z);
        if (S.f < 0.75) scallops(p, S.shape, { size: Math.max(2, 6 * u * (1 - S.f)), seed: 50 + S.z, z: S.z, lightAt: () => [S.cx, S.cy], bevel: 0.8, jointV: 0.4 });
      }
      for (const S of secs) lip(p, S.z, S.f === 0 ? 1.6 : lerp(3.4, 0.6, S.f ** 0.7), [[-1, 0], [1, 0], [0, -1], [0, 1]]);
      p.light(gx, 66 * u, 34 * u, 2, null, { zMin: 10, zMax: 13 });
      // A glowing seam running down the tunnel's right wall into the dark.
      p.shade(all, (x, y) => {
        const t = clamp((x - gx - 4 * u) / (22 * u), 0, 1);
        const sy = lerp(86 * u, 46 * u, t) - Math.sin(t * 3) * 2 * u;
        return x > gx + 4 * u && x < gx + 26 * u && Math.abs(y - sy) < 0.55 && p.z[Math.round(y) * W + Math.round(x)] >= 10 ? 1.6 * t + 0.4 : 0;
      });
      p.shade(all, (x, y) => {
        const t = clamp((gx - 6 * u - x) / (20 * u), 0, 1);
        const sy = lerp(80 * u, 58 * u, t) + Math.sin(t * 4) * 1.5 * u;
        return x < gx - 6 * u && x > gx - 26 * u && Math.abs(y - sy) < 0.55 && p.z[Math.round(y) * W + Math.round(x)] >= 10 ? 1.2 * t + 0.3 : 0;
      });
      // The floor in front: glassy, holding the tunnel's glow, crystals grown at its edges.
      reflection(p, gx, 26 * u, floorY, H - floorY, u, 0.9);
      p.shade(C.rect(0, floorY, W, H - floorY), (x, y) => (frac((x * 0.4 + y) / (9 * u)) < 0.06 ? 0.8 : 0), 1);
      const tips = [
        ...crystals(p, gx - 33 * u, 128 * u, 16 * u, u, { seed: 'b-back-c1', n: 5, v: 6, z: 4 }),
        ...crystals(p, gx + 34 * u, 125 * u, 12 * u, u, { seed: 'b-back-c2', n: 4, v: 5, z: 4 }),
      ];
      icicles(p, gx - 32 * u, gx + 32 * u, topOf(p, 10), u, { seed: 'b-back-ice', min: 2, max: 15, v: 3.8, z: 4 });
      icicles(p, gx - 26 * u, gx + 26 * u, topOf(p, 11), u, { seed: 'b-back-ice2', min: 1, max: 8, v: 3, hi: 2.4, z: 4 });
      icicles(p, 0, W, () => 0, u, { seed: 'b-back-roof', min: 2, max: 10, v: 1.8, hi: 1.6, z: 4 });
      p.light(gx, 62 * u, 50 * u, 2, null, { zMin: 4, zMax: 4 });
      vignette(p, W, H, 1.8, 0.5);
      return {
        p,
        over(img) { twinkle(img, tips.filter((_, i) => i % 3 === 0), 0.6); },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['glow', 'path'] });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const floorY = Math.round(82 * u); const fy = 91 * u; // the floor line, and where the card stands
      const wall = C.rect(0, 0, W, floorY);
      p.fill(wall, 'ice', 1.2, 1);
      scallops(p, wall, { size: 9 * u, sy: 0.8, seed: 6, z: 1, lightAt: () => [gx, 50 * u], bevel: 1, jointV: 0.5 });
      thinIce(p, wall, { u, size: 26, seed: 6, k: 1, z: 1 });
      seams(p, wall, { u, gap: 11, per: 27, amp: 2.4, patch: 22, thresh: 0.52, k: 2.2, seed: 4, z: 1 });
      p.fill(C.rect(0, floorY, W, H - floorY), 'floor', 1.4, 1);
      // The falls, the focal wall.
      const k = cat === 'obstacle' ? 0.8 : cat === 'clear-path' ? 0.9 : 1;
      frozenFall(p, gx, 3 * u, floorY + 3 * u, 34 * u, 64 * u, u, { k, seed: 7, flutes: 11 });
      // Columns and alcoves along the cavern on both sides.
      const tips = [];
      const r = rng('b-cavern');
      for (const m of [-1, 1]) {
        let k2 = 0;
        for (let d = 45 * u; d < W / 2 + 40 * u; d += (28 + r() * 6) * u, k2 += 1) {
          const x = gx + m * d;
          if (k2 % 2 === 0) column(p, x, 0, floorY + 2 * u, (11 + r() * 4) * u, u, { seed: 10 + k2 * 2 + (m > 0 ? 1 : 0), toward: -m, v: k2 === 0 ? 2.4 : 2 });
          else { const ab = (58 + r() * 12) * u; tips.push(...alcove(p, x, ab - (20 + r() * 8) * u, (14 + r() * 4) * u, ab, u, { seed: 20 + k2 * 2 + (m > 0 ? 1 : 0), k: k2 < 3 ? 1.1 : 0.9 })); }
        }
      }
      // The floor: glassy, the falls held upside down in it, a crack or two.
      reflection(p, gx, 30 * u, floorY + 4 * u, H - floorY, u, 1.1);
      p.shade(C.rect(0, floorY, W, H - floorY), (x, y) => (Math.abs(y - floorY - 9 * u - Math.sin(x / (17 * u)) * 2 * u - (x - gx) * 0.04) < 0.5 ? 1.2 : 0), 1);
      // The card, before the falls.
      if (cat === 'monster') {
        yeti(p, gx, fy, 56 * u, { v: 3.15, lit: 0.35, eyes: ramp, z: 6 });
        p.backlit(6, 'glow', 5, 'snow', 9.6);
        p.shade(C.rect(gx - 6 * u, fy - 12 * u, 12 * u, 12 * u), -2.6, 2); // its legs blocking the pool's glow
        p.shade(C.poly([[gx - 7 * u, fy - 10 * u], [gx + 7 * u, fy - 10 * u], [gx + 12 * u, H], [gx - 12 * u, H]]), -3, 1); // and its shadow on the floor
        p.tint(gx, fy - 56 * u * 0.88, 9 * u, hex, 0.5, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 38 * u;
        const { lx, ly } = traveller(p, gx, fy, s, 'shadow', 2.2, 6);
        p.backlit(6, 'glow', 5, 'snow', 8.4);
        lantern(p, lx, ly, ramp, 8);
        p.light(lx + 1, fy + 2 * u, 34 * u, 3, flicker(0.9, 0.12), { zMin: 1, zMax: 3, sy: 0.5 });
        p.tint(lx + 1, ly + 2, 12 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(lx + 1, fy, 36 * u, hex, 0.5, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        iceChest(p, gx, fy + 1, 32 * u, ramp, 6);
        p.tint(gx, fy - 10 * u, 32 * u, hex, 0.62, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        // A wall of teal ice grown across the falls, fractured into blocks, the glow coming through its middle.
        const slab = [];
        for (let i = 0; i <= 12; i += 1) slab.push([gx - 36 * u + i * 6 * u, (10 + hash(i, 3, 9) * 8) * u]);
        const shape = C.poly([...slab, [gx + 38 * u, fy + 1 * u], [gx - 38 * u, fy + 1 * u]]);
        p.fill(shape, ramp, (x, y) => 1.6 + 2.4 * clamp(1 - Math.hypot((x - gx) / (34 * u), (y - 52 * u) / (40 * u)), 0, 1), 5);
        p.cells(shape, { size: 8 * u, sx: 0.8, sy: 1.4, joint: 0.9, jointV: -1, vary: 0.8, bevel: 0.8, seed: 8, z: 5 });
        lip(p, 5, 1.4, [[0, -1]]);
        p.tint(gx, 50 * u, 38 * u, hex, 0.4, flicker(0.5, 0.12, 0.6));
      } else {
        // The one way opening: a fissure splitting the falls, glowing gold.
        const fis = [];
        for (let i = 0; i <= 14; i += 1) { const t = i / 14; fis.push([gx + (hash(i, 5, 3) - 0.5) * 4 * u - lerp(1, 7, t ** 1.5) * u, lerp(6 * u, floorY + 4 * u, t)]); }
        const back = fis.slice().reverse().map(([x, y], i) => [x + lerp(2, 14, ((fis.length - 1 - i) / 14) ** 1.5) * u + (hash(i, 6, 3) - 0.5) * 2 * u, y]);
        const shape = C.poly([...fis, ...back]);
        p.glow(shape, 'path', gx, floorY - 6 * u, 46 * u, 4.6, 2.6, 5);
        p.tint(gx, 50 * u, 26 * u, CARD.path[3], 0.45, flicker(0.4, 0.06, 0.3));
        p.tint(gx, floorY + 8 * u, 44 * u, CARD.path[3], 0.45, flicker(0.2, 0.08, 0.4));
        p.light(gx, floorY, 50 * u, 2, null, { zMin: 1, zMax: 1, sy: 0.5 });
      }
      // Icicles all along the roof, except where the falls pour.
      icicles(p, 0, W, (x) => (Math.abs(x - gx) < 16 * u ? null : 0), u, { seed: 'b-roof', min: 2, max: 10, v: 1.8, hi: 2, z: 4 });
      p.light(gx, 40 * u, 60 * u, 2.2, null, { zMin: 4, zMax: 4 });
      vignette(p, W, H, 2, 0.42);
      const shown = tips.filter(([x]) => x > 0 && x < W);
      return {
        p,
        over(img, t) {
          twinkle(img, shown, t);
          for (const q of particles('mote', Math.round(W / 12), [0, 0, W, floorY], t, 52)) put(img, q.x, q.y, '#A8E1F7', q.a * 0.45);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['glow'] });
      const u = H / 250; const gx = W / 2;
      const floorY = 54 * u;
      // The far wall, behind the vista: dark ice, seamed, a little glow where it is thin.
      const wall = C.rect(0, 0, W, floorY);
      p.fill(wall, 'ice', 1.2, 1);
      scallops(p, wall, { size: 9 * u, sy: 0.8, seed: 7, z: 1, lightAt: () => [gx, 30 * u], bevel: 1, jointV: 0.5 });
      thinIce(p, wall, { u, size: 30, seed: 9, k: 1, z: 1 });
      seams(p, wall, { u, gap: 12, per: 31, amp: 2.4, patch: 26, thresh: 0.5, k: 2, seed: 5, z: 1 });
      // The floor: dark glassy ice broken into great plates, pale where they meet, larger toward us.
      const fl = C.rect(0, floorY, W, H - floorY);
      p.fill(fl, 'floor', (x, y) => 1.3 + (n2(x / (50 * u), y / (16 * u), 4) - 0.5) * 0.8, 1);
      plates(p, fl, { vx: gx, vy: floorY - 60 * u, d0: 30 * u, rows: 2.6, cols: 3.2, seed: 19, z: 1 });
      const cr = rng('b-world-cracks');
      for (let k = 0; k < 6; k += 1) {
        let x = cr() * W; let y = floorY + 20 * u + cr() * (H - floorY - 20 * u); let a = (cr() - 0.5) * 0.9 + (cr() < 0.5 ? 0 : Math.PI);
        const len = (40 + cr() * 80) * u;
        for (let d = 0; d < len; d += 1) {
          a += (cr() - 0.5) * 0.12 + (cr() < 0.04 ? (cr() - 0.5) * 1.8 : 0); x += Math.cos(a) * 1.4; y += Math.sin(a) * 0.5;
          if (x < 0 || x >= W || y < floorY || y >= H) break;
          p.shade(C.rect(Math.floor(x), Math.floor(y), 1, 1), 0.9, 1);
        }
      }
      // The cold glow at the edges, where the walls are thin: none falls from above.
      for (const side of [0, 1]) {
        const ex = side ? W : 0;
        p.light(ex, floorY + 50 * u, 130 * u, 2.6, flicker(side * 1.7, 0.06, 0.4), { zMin: 1, zMax: 1, sx: 0.75 });
        const sw = C.poly(side ? [[W - 26 * u, 0], [W, 0], [W, H], [W - 12 * u, H]] : [[0, 0], [26 * u, 0], [12 * u, H], [0, H]]);
        p.fill(sw, 'ice', (x, y) => 3.4 - y / H * 1.6, 5);
        scallops(p, sw, { size: 9 * u, seed: 9 + side, z: 5, lightAt: () => [side ? W - 30 * u : 30 * u, H * 0.4], bevel: 1, jointV: 0.5 });
        seams(p, sw, { u, gap: 9, per: 13, amp: 3, patch: 14, thresh: 0.42, k: 2.2, seed: 11 + side, z: 5 });
      }
      icicles(p, 0, W, () => 0, u, { seed: 'b-world-roof', min: 2, max: 12, v: 2.4, hi: 2, z: 4 });
      p.shade(null, (x, y) => -2.4 * Math.max(0, y / H - 0.3));
      // Frost blooming out of the corners and up the feet of the walls: feathered, palest where it is thickest.
      p.shade(fl, (x, y) => {
        const side = Math.max(0, 1 - Math.min(x - 12 * u, W - 12 * u - x) / (30 * u));
        const corner = Math.max(0, 1 - Math.min(Math.hypot(x, H - y), Math.hypot(W - x, H - y)) / (96 * u));
        const k = Math.max(side * clamp((y - floorY) / (60 * u), 0, 1), corner);
        if (k <= 0) return 0;
        const f = n2(x / (2.2 * u), y / (1.6 * u), 31) * 0.55 + n2(x / (8 * u), y / (5 * u), 32) * 0.45;
        const feather = frac((x * 0.8 + y * 1.4) / (3 * u) + n1(x / (7 * u), 33)) < 0.35 ? 0.15 : 0;
        return f + feather + k * 0.6 > 1 ? 1.6 + k * 3.6 : 0;
      }, 1);
      // A few crystals, at the edges and the corners, clear of the table.
      const tips = [
        ...crystals(p, 20 * u, 214 * u, 18 * u, u, { seed: 'b-w-c1', n: 5, v: 3, z: 4 }),
        ...crystals(p, W - 22 * u, 196 * u, 14 * u, u, { seed: 'b-w-c2', n: 4, v: 3, z: 4 }),
        ...crystals(p, 64 * u, 244 * u, 12 * u, u, { seed: 'b-w-c3', n: 4, v: 2, z: 4 }),
        ...crystals(p, W - 70 * u, 246 * u, 10 * u, u, { seed: 'b-w-c4', n: 3, v: 2, z: 4 }),
        ...crystals(p, gx - 92 * u, 72 * u, 8 * u, u, { seed: 'b-w-c5', n: 3, v: 3, z: 4 }),
        ...crystals(p, gx + 118 * u, 74 * u, 7 * u, u, { seed: 'b-w-c6', n: 3, v: 3, z: 4 }),
      ];
      return {
        p,
        over(img, t) {
          twinkle(img, tips, t * 0.8, '#A8E1F7');
          for (const q of particles('mote', 30, [0, 0, W, H * 0.6], t, 91)) put(img, q.x, q.y, '#588FBC', q.a * clamp(1 - q.y / (H * 0.6), 0, 1) * 0.7);
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B]);
})();

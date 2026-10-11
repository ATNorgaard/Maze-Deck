/* New setting, the Underdark: one direction, inside only. */
(() => {
  const { C, Painter, put, particles, flicker, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => v - Math.floor(v);
  /** Smooth noise, 0..1, in one and two dimensions. */
  const n1 = (x, s = 0) => { const i = Math.floor(x); return lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(x - i)); };
  const n2 = (x, y, s = 0) => {
    const i = Math.floor(x); const j = Math.floor(y); const fx = smooth(x - i); const fy = smooth(y - j);
    return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), fx), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), fx), fy);
  };
  /** A slow swell, 1 on average: the fungus breathing. */
  const breathe = (phase, depth = 0.18, speed = 0.55) => (t) => 1 + depth * (0.7 * Math.sin(t * speed + phase) + 0.3 * Math.sin(t * speed * 2.3 + phase * 1.7));

  /* The Underdark lights itself with the Wanderer's blue: cold bioluminescence
     from the fungus, lichen and crystal. The rock is near-black slate that
     cools into blue as the light climbs it; the stalks are pale flesh that
     the gills above them turn blue-white. The faerzress, violet in the
     books, glows blue-white here, because violet belongs to the Item. */
  const RAMPS = {
    rock: ['#030407', '#06080C', '#0A0D13', '#0F131B', '#151A24', '#1C232F', '#252E3D', '#2F3B4D', '#3C4A5F', '#4E5F77', '#677B94', '#8BA0B8'],
    flesh: ['#050608', '#0A0B0F', '#101217', '#171A20', '#1F232A', '#292E37', '#363C48', '#454E5E', '#5A6880', '#7489A8', '#97ADCB', '#C0D2E8', '#E6EFF9'],
    silk: ['#07080B', '#0D0F14', '#15181F', '#1F232B', '#2B303A', '#3A404C', '#4C5361', '#626A79', '#7D8695', '#9DA6B3', '#C3CAD3', '#E8ECF1'],
    mist: ['#030408', '#060910', '#0A0E17', '#0E1420', '#131B2B', '#1A2437', '#222F45', '#2C3B55', '#384A68', '#475C7E', '#5B7396', '#7690B3', '#9BB2D0', '#C6D6EA'],
    water: ['#010205', '#02040A', '#040810', '#070D19', '#0C1626', '#142338', '#1F3552', '#2E4D74', '#44699A', '#6890C2'],
    shadow: ['#010103', '#040509', '#080A10', '#0D1018', '#131722'],
    glow: ['#08101C', '#0D182B', '#132340', '#1A3058', '#223F72', '#2C518E', '#3966AA', '#4D80C4', '#6A9DDB', '#8FBBEC', '#BBD7F7', '#E6F2FE'],
    faer: ['#141E2E', '#22344F', '#385378', '#5677A3', '#7D9DCA', '#AAC4E6', '#D5E5F7', '#F6FAFF'],
    gold: ['#0E0804', '#1E1309', '#3D2A0E', '#5F4116', '#8A5E1E', '#B98135', '#E3A445', '#F2CB8A', '#FFF1C4', '#FFFBEA'], // the Clear Path's, for its light alone
    ...CARD,
  };
  const EMIT = ['glow', 'faer'];

  /* ---------- small tools ---------- */

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }

  function plot(p, x, y, ramp, v, z) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    const i = y * p.w + x; p.r[i] = typeof ramp === 'number' ? ramp : p.ri(ramp); p.v[i] = v; p.z[i] = z;
  }

  /** A one-pixel line; `v` may be fn(t, x, y). `under` keeps it behind anything nearer than that layer. */
  function line(p, x0, y0, x1, y1, ramp, v, z, o = {}) {
    const ri = typeof ramp === 'number' ? ramp : p.ri(ramp);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const x = Math.round(lerp(x0, x1, t)); const y = Math.round(lerp(y0, y1, t));
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const i = y * p.w + x;
      if (o.under !== undefined && p.z[i] > o.under) continue;
      if (o.stop && o.stop(x, y)) continue;
      p.r[i] = ri; p.v[i] = typeof v === 'function' ? v(t, x, y) : v; p.z[i] = z;
    }
  }

  /** A tapering limb from a to b, w0 wide at a and w1 at b; `rim` [ramp, v] lights its upper edge in one clean line. */
  function limb(p, ax, ay, bx, by, w0, w1, ramp, v, z, rim) {
    const dx = bx - ax; const dy = by - ay; const L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L; let ny = dx / L;
    p.fill(C.poly([[ax + (nx * w0) / 2, ay + (ny * w0) / 2], [bx + (nx * w1) / 2, by + (ny * w1) / 2], [bx - (nx * w1) / 2, by - (ny * w1) / 2], [ax - (nx * w0) / 2, ay - (ny * w0) / 2]]), ramp, v, z);
    line(p, ax, ay, bx, by, ramp, v, z);
    if (rim) {
      if (ny > 0) { nx = -nx; ny = -ny; } // the side facing up
      const o0 = Math.max(0, w0 / 2 - 0.5); const o1 = Math.max(0, w1 / 2 - 0.5);
      line(p, ax + nx * o0, ay + ny * o0, bx + nx * o1, by + ny * o1, rim[0], rim[1], z);
    }
  }

  /** A light painted in now, touching only its own box (p.light sweeps the whole picture). */
  function pool(p, x, y, r, s, o = {}) {
    const sx = o.sx || 1; const sy = o.sy || 1;
    const x0 = Math.max(0, Math.floor(x - r * sx)); const x1 = Math.min(p.w - 1, Math.ceil(x + r * sx));
    const y0 = Math.max(0, Math.floor(y - r * sy)); const y1 = Math.min(p.h - 1, Math.ceil(y + r * sy));
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const i = py * p.w + px;
        if (p.emit[p.r[i]]) continue;
        if (o.zMin !== undefined && p.z[i] < o.zMin) continue;
        if (o.zMax !== undefined && p.z[i] > o.zMax) continue;
        const d = Math.hypot((px + 0.5 - x) / sx, (py + 0.5 - y) / sy) / r;
        if (d >= 1) continue;
        const t = 1 - d;
        p.v[i] += s * (o.hard ? t : t * t);
      }
    }
  }

  /** The edge of a figure toward a light: its pixels on layer z whose neighbour (dx, dy) lies on a lower layer. */
  function edge(p, z, dx, dy, ramp, v, o = {}) {
    const r = p.ri(ramp); const hit = [];
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
        if (p.z[ny * p.w + nx] < z && (!o.only || o.only(x, y))) hit.push(i);
      }
    }
    for (const i of hit) { p.r[i] = r; p.v[i] = typeof v === 'function' ? v(i) : v; }
  }

  /* ---------- the place ---------- */

  /**
   * A giant fungus, taller than a tree. A pale stalk, fibrous, swelling to a
   * bulb at its foot and bending under the cap; a torn skirt hanging below
   * the cap; the cap's underside an ellipse of gills radiating from the
   * stalk, glowing, brightest toward the thin margin; the dark dome above it
   * freckled with glowing spots. Its light falls on what is under it.
   */
  function fungus(p, o) {
    const { u, x, base, capY, rx } = o;
    const ry = o.ry ?? rx * 0.3; const z = o.z ?? 3; const seed = o.seed ?? 1; const k = o.k ?? 1;
    const sw = o.sw ?? Math.max(1, rx * 0.15); const lean = o.lean ?? 0; const cx = x + lean;
    const len = Math.max(1, base - capY); const foot = o.foot ?? 0.9; const bend = o.bend ?? 0;
    const sxAt = (y) => { const t = clamp((base - y) / len, 0, 1); return x + lean * t * t + bend * Math.sin(Math.PI * t); };
    const taper = o.taper ?? 0;
    const swAt = (y) => { const t = clamp((base - y) / len, 0, 1); return sw * (1 + foot * (1 - t) ** 5 + 0.2 * t ** 8 + taper * (1 - t)) + (n1(y / (4 * u), seed) - 0.5) * 0.4 * u; };
    // The dome, behind the far margin.
    if (o.domeH) {
      const pts = [];
      for (let i = 0; i <= 24; i += 1) {
        const a = Math.PI + (i / 24) * Math.PI; const j = 0.88 + 0.12 * n1(i * 0.9, seed + 3);
        pts.push([cx + Math.cos(a) * rx * 0.99, capY + Math.sin(a) * o.domeH * j]);
      }
      const domeV = o.domeV ?? 1; const fi = p.ri('flesh'); const mine = new Set();
      p.each(C.poly(pts), (px, py, i) => {
        p.r[i] = fi; p.z[i] = z; mine.add(i);
        p.v[i] = domeV + ((px + 0.5 - cx) / rx < -0.35 ? 0.5 : 0) + (capY - py < 1.2 ? 0.6 : 0);
      });
      // Its crown catching the glow of everything round it: a lit line along the top.
      for (const i of mine) if (!mine.has(i - p.w)) p.v[i] += o.crown ?? 1.4;
      if (o.spots) {
        const r = rng(seed * 31 + 7);
        for (let i = 0; i < o.spots; i += 1) {
          const a = Math.PI * (1.12 + r() * 0.76); const d = 0.25 + r() * 0.62;
          plot(p, cx + Math.cos(a) * rx * d, capY + Math.sin(a) * o.domeH * d * 0.9, 'glow', Math.round((o.spotV ?? 5) * k + r() * 2), z);
        }
      }
    }
    // The gills, from the stalk out to the margin.
    const N = o.gills ?? Math.max(10, Math.round((rx / u) * 0.9));
    const v0 = o.v0 ?? 2; const v1 = o.v1 ?? 8.5;
    const gi = p.ri('glow');
    p.each(C.ellipse(cx, capY, rx, ry, 44), (px, py, i) => {
      const dx = (px + 0.5 - cx) / rx; const dy = (py + 0.5 - capY) / ry;
      const d = Math.min(1, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      const g = frac((a / (Math.PI * 2)) * N + (n1(a * 2.2 + 9, seed) - 0.5) * 0.25);
      let v = v0 + (v1 - v0) * d ** 1.3;
      if (d > 0.1 && g < 0.4) v -= 1.4 + d;
      if (d > 0.9 || (ry < 3 * u && dy > 0.35)) v = v1 + (o.rimK ?? 0.5);
      p.r[i] = gi; p.v[i] = Math.round(v * k); p.z[i] = z;
    });
    // The stalk, from the middle of the gills down to its foot.
    if (o.stalk !== false) {
      const pts = []; const top = capY + ry * 0.1;
      for (let i = 0; i <= 20; i += 1) { const y = lerp(top, base, i / 20); pts.push([sxAt(y) - swAt(y), y]); }
      for (let i = 20; i >= 0; i -= 1) { const y = lerp(top, base, i / 20); pts.push([sxAt(y) + swAt(y), y]); }
      const lit = o.stalkV ?? 7; const fall = o.fall ?? 1.3;
      p.fill(C.poly(pts), 'flesh', (px, py) => {
        const w = swAt(py); const q = (px + 0.5 - sxAt(py)) / w; const t = clamp((py - capY) / len, 0, 1);
        let v = 0.8 + lit * (1 - t) ** fall * (1 - q * q * 0.55) - q * q * 1.2;
        if (q < -0.2 && q > -0.7) v += 0.6;
        v += (hash(Math.floor(((q + 1) * w) / Math.max(1, 1.4 * u)), 0, seed) - 0.5) * 0.8; // fibres
        return Math.round(v * 2) / 2;
      }, z);
      // The skirt: a torn ring of membrane hanging round the stalk under the cap, ragged at its hem.
      if (o.skirt === true || (o.skirt !== false && sw > 1.5 * u)) {
        const ys = capY + ry * 0.9 + len * 0.04; const sh = Math.max(2, len * 0.09);
        const w0 = swAt(ys) * 1.02; const w1 = swAt(ys) * 1.45; const xs = sxAt(ys);
        const sk = [[xs - w0, ys]]; const n = Math.max(6, Math.round((w1 * 2) / Math.max(1, 1.6 * u)));
        for (let i = 0; i <= n; i += 1) {
          const t = i / n; const tear = hash(i, 4, seed);
          sk.push([xs - w1 + 2 * w1 * t, ys + sh * (tear < 0.3 ? 0.35 : 0.7 + 0.3 * tear)]);
        }
        sk.push([xs + w0, ys]);
        p.fill(C.poly(sk), 'flesh', (px, py) => Math.round(1 + lit * 0.8 - ((py - ys) / sh) * 2.2 - ((px + 0.5 - xs) / w1) ** 2 * 2), z);
        p.shade(C.rect(xs - w0, ys + sh * 0.85, w0 * 2, Math.max(2, 1.4 * u)), -1.4, z); // its shadow on the stalk
      }
    }
    if (o.light) {
      const L = o.light;
      if (L.k) p.light(cx, capY + ry, L.r, L.s, L.k, { zMin: L.zMin, zMax: L.zMax, sy: L.sy ?? 0.9 });
      else pool(p, cx, capY + ry, L.r, L.s, { zMin: L.zMin, zMax: L.zMax, sy: L.sy ?? 0.9 });
    }
    return { cx, capY, rx, ry, sxAt, swAt };
  }

  /** Bracket fungus on a stalk: little shelves standing out of its side, their undersides glowing. */
  function brackets(p, st, ys, side, u, z, seed) {
    const r = rng(seed);
    for (const y0 of ys) {
      for (let k = 0; k < 3; k += 1) {
        const y = y0 + k * 2.2 * u + r() * u; const w = (2.4 + r() * 2.2 - k * 0.5) * u;
        const x0 = st.sxAt(y) + side * st.swAt(y) * 0.92;
        const shelf = C.ellipse(x0 + side * w * 0.45, y, w * 0.6, Math.max(1, w * 0.26), 14);
        p.each(shelf, (x, yy, i) => {
          p.r[i] = yy + 0.5 > y ? p.ri('glow') : p.ri('flesh'); p.z[i] = z;
          p.v[i] = yy + 0.5 > y ? 7 + (Math.abs(x + 0.5 - x0) > w * 0.6 ? 1 : 0) : 4;
        });
        pool(p, x0 + side * w * 0.4, y + 2 * u, w * 2.2, 1.6, { zMin: z, zMax: z, sy: 1.4 });
      }
    }
  }

  /** A cap's proportions by kind: a broad flat umbrella, a round dome, or a tall bell. */
  function capKind(kind, rx) {
    if (kind < 0.45) return { rx, domeH: rx * 0.36, ry: rx * 0.24 };
    if (kind < 0.8) return { rx: rx * 0.8, domeH: rx * 0.68, ry: rx * 0.22 };
    return { rx: rx * 0.58, domeH: rx * 1.05, ry: rx * 0.2 };
  }

  /**
   * A grove of giants: one great fungus and a few smaller ones grown out of
   * the same root, leaning away from it, each cap its own kind. `rx` is the
   * great one's cap, `capY` its height; the rest share `o` (base, k, layer).
   */
  function grove(p, x, o) {
    const { u } = o; const r = rng(o.seed); const out = [];
    const n = o.n ?? 2 + Math.floor(r() * 2.2);
    const list = [];
    for (let i = 0; i < n; i += 1) {
      const big = i === 0; const side = r() < 0.5 ? -1 : 1;
      const rx = big ? o.rx : o.rx * (0.4 + r() * 0.32);
      const capY = big ? o.capY : o.capY + (5 + r() * 16) * u;
      const lean = big ? (r() - 0.5) * 6 * u : side * (o.rx * (0.55 + r() * 0.5));
      list.push({ rx, capY, lean, kind: big ? o.kind ?? r() : r(), seed: Math.floor(r() * 1e5), x: x + (big ? 0 : side * 2 * u) });
    }
    list.sort((a, b) => a.capY - b.capY);
    for (const f of list) {
      const c = capKind(f.kind, f.rx);
      out.push(fungus(p, {
        u, x: f.x, base: o.base, capY: f.capY, rx: c.rx, ry: c.ry, domeH: c.domeH, domeV: o.domeV ?? 2, crown: 1.8, rimK: 0, spots: Math.round(c.rx / (2.5 * u)), spotV: o.spotV ?? 4,
        sw: Math.max(0.8 * u, f.rx * (0.2 + hash(f.seed, 1, 3) * 0.1)), lean: f.lean, bend: (hash(f.seed, 2, 3) - 0.5) * 5 * u,
        v0: o.v0 ?? 1.4, v1: (o.v1 ?? 7) * (0.85 + hash(f.seed, 3, 3) * 0.2), gills: Math.max(12, Math.round(c.rx / u * 1.4)), seed: f.seed, z: o.z ?? 2,
        stalkV: o.stalkV ?? 5, fall: o.fall ?? 1.5, skirt: hash(f.seed, 4, 3) < 0.4 && c.rx > 6 * u, foot: 0.3,
        light: o.light ? { r: c.rx * 2.4, s: o.light, zMin: 0, zMax: o.z ?? 2, sy: 1.5 } : null,
      }));
    }
    return out;
  }

  /**
   * The silk bridge, running away from us over the chasm. A deck of woven
   * strands crossed by pale slats, a hand rope each side drooping between
   * us and the far end, a hanger at every slat, tatters of silk hanging
   * under it. In perspective: at distance z (1 near) a point h above the
   * deck at q across it (-1..1) is at (gx + q hw / z, hor + (D - h) / z).
   * `lit(z)` is the light along it; where `gold(z)` it is drawn in gold.
   */
  function silkBridge(p, o) {
    const { gx, hor, D, hw, rh, z1, u } = o;
    const z0 = o.z0 ?? 0.2; const zl = o.z ?? 4;
    const dz = o.dz ?? 0.25; const slatW = o.slatW ?? 0.06;
    const L = o.lit || (() => 0); const G = o.gold || (() => false);
    const S = p.ri('silk'); const GO = p.ri('gold');
    const X = (z, q) => gx + (q * hw) / z; const Y = (z, h = 0) => hor + (D - h) / z;
    const droop = o.droop ?? rh * 0.3;
    const railH = (z) => rh - droop * Math.sin(Math.PI * clamp((z - 0.3) / (z1 - 0.3), 0, 1));
    const base = o.v ?? 1.1;
    const ramp = (z) => (G(z) ? GO : S);
    const clip = { stop: o.stop };
    // The deck.
    for (let y = Math.max(0, Math.floor(Y(z1))); y < p.h; y += 1) {
      if (y + 0.5 - hor <= 0) continue;
      const zc = D / (y + 0.5 - hor);
      if (zc > z1 || zc < z0) continue;
      const zf = D / Math.max(0.01, y - hor); const zn = D / (y + 1 - hor);
      let slat = false;
      for (let k = Math.floor((zn - slatW - z0) / dz); k <= Math.floor((zf - z0) / dz); k += 1) {
        const s0 = z0 + k * dz;
        if (s0 <= zf && s0 + slatW >= zn) { slat = true; break; }
      }
      const half = hw / zc; const lit = L(zc); const R = ramp(zc);
      for (let x = Math.max(0, Math.ceil(gx - half - 0.5)); x <= Math.min(p.w - 1, Math.floor(gx + half - 0.5)); x += 1) {
        const q = (x + 0.5 - gx) / half;
        const qs = Math.round((q + 1) / 0.4) * 0.4 - 1; const dpx = Math.abs(q - qs) * half;
        let v = base + lit * 0.5;
        if (Math.abs(q) > 1 - 1.2 / half) v += 2.4 + lit;               // the edge ropes
        else if (slat) v += 2 + lit;                                     // the slats
        else if (dpx < 0.5) v += 1 + lit * 0.5;                          // the woven strands
        else v -= 0.2;
        const i = y * p.w + x; p.r[i] = R; p.v[i] = Math.round(v * 2) / 2; p.z[i] = zl;
      }
    }
    // The tatters under the edges.
    const r = rng(o.seed || 'bridge');
    for (let k = 0; k < 40; k += 1) {
      const z = lerp(0.6, z1, r() ** 0.7); const m = r() < 0.5 ? -1 : 1;
      const x = X(z, m * (0.92 + r() * 0.08)); const yy = Y(z);
      line(p, x, yy + 1, x + (r() - 0.5) * u, yy + ((2 + r() * 7) * u) / z, ramp(z), base + 1 + L(z) * 0.6, zl, clip);
    }
    // The hangers, then the hand ropes over them.
    for (let s0 = z0; s0 <= z1 + 1e-6; s0 += dz) {
      if (s0 < 0.3) continue;
      for (const m of [-1, 1]) line(p, X(s0, m), Y(s0, railH(s0)), X(s0, m), Y(s0), ramp(s0), base + 1.6 + L(s0) * 0.8, zl, clip);
    }
    for (const m of [-1, 1]) {
      let px = null; let py = null;
      const step = (z) => {
        const xx = X(z, m); const yy = Y(z, railH(z));
        if (px !== null) {
          line(p, px, py, xx, yy, ramp(z), base + 3.2 + L(z) * 1.3, zl, clip);
          if (z < 0.6) line(p, px, py + 1, xx, yy + 1, ramp(z), base + 1.8 + L(z), zl, clip);
        }
        px = xx; py = yy;
      };
      for (let z = 0.25; z < z1; z *= 1.04) step(z);
      step(z1);
    }
    return { X, Y, railH };
  }

  /**
   * The roof, far up: a band of rock across the top, lumpy underneath and
   * catching a little of the glow from below, stalactites hanging from it,
   * lit on the side toward the light, a crystal at each long one's tip.
   */
  function roof(p, W, u, o) {
    const r = rng(o.seed); const z = o.z ?? 1; const y0 = o.y; const toward = o.toward ?? W / 2;
    const near = (x) => clamp(1 - Math.abs(x - toward) / (o.reach ?? W * 0.5), 0, 1);
    const edgeAt = (x) => y0 + (n1(x / (5 * u), 3) - 0.5) * 3 * u + (n1(x / (17 * u), 4) - 0.5) * 4 * u;
    const band = C.rect(0, 0, W, y0 + 6 * u);
    p.fill(band, 'rock', (x, y) => {
      const e = edgeAt(x);
      if (y > e) return null;
      return (o.v ?? 1.2) + near(x) * 1.2 + (y > e - 1.2 * u ? 1.4 : y > e - 2.6 * u ? 0.6 : 0);
    }, z);
    p.cells(band, { size: 6 * u, sx: 1.8, sy: 0.55, joint: 0.8, jointV: -0.9, vary: 0.6, bevel: 0.7, lit: [0, -1], seed: 17, z });
    const tips = [];
    for (let x = r() * 6 * u; x < W; x += (2.5 + r() * 7) * u) {
      if (o.skip && o.skip(x)) continue;
      const L = (3 + r() ** 2.2 * (o.max ?? 24)) * u; const w = Math.max(1.2, L * (0.1 + r() * 0.07)) + u * 0.6;
      const top = edgeAt(x) - u; const tip = top + L; const tx = x + (r() - 0.5) * w * 0.6;
      const side = x < toward ? 1 : -1; const nv = near(x);
      p.fill(C.poly([[x - w, top], [x + w, top], [tx + 0.4, tip], [tx - 0.4, tip]]), 'rock', (px, py) => {
        const f = (px + 0.5 - lerp(x, tx, (py - top) / L)) / Math.max(0.6, w * (1 - (py - top) / L));
        return (o.v ?? 1.2) + 0.6 + nv * 1.2 + (f * side > 0.2 ? 1.6 + nv : 0) + ((py - top) / L) * 0.6;
      }, z);
      if (L > 11 * u && r() < 0.6) { plot(p, tx, tip, 'faer', 4 + r() * 2, z); plot(p, tx, tip - 1, 'faer', 2.5, z); tips.push([Math.round(tx), Math.round(tip)]); }
    }
    return tips;
  }

  /**
   * Faerzress: a vein of the Underdark's own magic in the rock, a thin
   * wandering line glowing blue-white, brighter in beads along it.
   */
  function vein(p, pts, v, seed, o = {}) {
    const fi = p.ri('faer');
    for (let s = 0; s + 1 < pts.length; s += 1) {
      const [x0, y0] = pts[s]; const [x1, y1] = pts[s + 1];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let k = 0; k < n; k += 1) {
        const t = k / n; const x = Math.round(lerp(x0, x1, t)); const y = Math.round(lerp(y0, y1, t));
        if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
        const i = y * p.w + x;
        if (o.onZ !== undefined && p.z[i] !== o.onZ) continue;
        const bead = n1((s * n + k) * 0.3, seed);
        if (bead < (o.gaps ?? 0.2)) continue;
        p.r[i] = fi; p.v[i] = (o.at ? o.at(x, y) : 1) * v + (bead > 0.78 ? 1.5 : 0);
      }
    }
  }
  /** A wandering path: from (x, y) heading `a`, n steps of `step`. */
  function wander(x, y, a, n, step, seed, bend = 0.5) {
    const r = rng(seed); const pts = [[x, y]];
    for (let i = 0; i < n; i += 1) { a += (r() - 0.5) * bend; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); }
    return pts;
  }

  /** A bank of cloud lying in the chasm, its lumpy top lit from above (brighter under `lift`), falling dark below. */
  function cloudBank(p, x0, x1, y, u, o) {
    const z = o.z ?? 2; const amp = o.amp ?? 4 * u; const depth = o.depth ?? 10 * u; const M = p.ri('mist');
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(p.w, Math.ceil(x1)); x += 1) {
      const top = y - amp * (0.4 * n1(x / (5 * u), o.seed) + 0.6 * n1(x / (15 * u), o.seed + 1));
      const lit = o.v + (o.lit ? o.lit(x) : 0);
      for (let py = Math.max(0, Math.floor(top)); py < Math.min(p.h, Math.ceil(y + depth)); py += 1) {
        const d = (py + 0.5 - top) / u;
        if (d < 0) continue;
        const i = py * p.w + x;
        if (o.under !== undefined && p.z[i] > o.under) continue;
        const v = d < 1 ? lit + 1.2 : d < 2.4 ? lit : lit - 1 - Math.min(1.6, (d - 2.4) * 0.14);
        p.r[i] = M; p.v[i] = Math.round(v); p.z[i] = z;
      }
    }
  }

  /**
   * The drow city, far off: a great stalagmite carved into spires rising
   * from the far floor, the stalactite above it carved to meet it, a thread
   * of bridge between two spires, windows pricked out in blue-white.
   * Returns the windows.
   */
  function drowCity(p, cx, bank, top, u, o = {}) {
    const z = o.z ?? 1; const v = o.v ?? 1.2; const r = rng(o.seed || 'city');
    const hgt = bank - top; const wins = [];
    // The haze of its own light, behind it.
    pool(p, cx, bank - hgt * 0.35, hgt * 0.95, 2.6, { zMin: 0, zMax: 0, sx: 0.7 });
    const spire = (x, b, h, w, down) => {
      const t = down ? b + h : b - h; const mid = lerp(b, t, 0.72);
      p.fill(C.poly([[x - w, b], [x + w, b], [x + w * 0.55, mid], [x, t], [x - w * 0.55, mid]]), 'mist', (px) => v + (px + 0.5 < x - w * 0.35 ? 2.6 : 0), z);
      if (!down) p.fill(C.rect(x - w * 0.8, mid, w * 1.6, Math.max(1, u * 0.8)), 'mist', v + 2.6, z); // a gallery round it
      const n = Math.floor(Math.abs(mid - b) / (2.6 * u));
      for (let j = 1; j < n; j += 1) {
        const yy = b + (down ? 1 : -1) * j * 2.6 * u;
        if (r() < 0.6) wins.push([Math.round(x + (r() < 0.5 ? -0.3 : 0.3) * w), Math.round(yy)]);
      }
    };
    spire(cx, bank, hgt * 0.94, 3.4 * u, false);
    for (const [dx, h, w] of [[-5.5, 0.56, 1.7], [6, 0.64, 1.9], [-10, 0.36, 1.5], [10.5, 0.42, 1.3], [-14, 0.2, 1.3], [14.5, 0.17, 1.2], [2.2, 0.78, 1.1]]) spire(cx + dx * u, bank, hgt * h, w * u, false);
    const roofY = o.roof ?? 0;
    spire(cx + u, roofY, top - roofY + hgt * 0.04, 3.2 * u, true);
    for (const [dx, h, w] of [[-5, 0.62, 1.5], [5.5, 0.5, 1.5], [-9, 0.32, 1.2], [9, 0.36, 1.2]]) spire(cx + dx * u, roofY, (top - roofY) * h, w * u, true);
    line(p, cx - 5.5 * u, bank - hgt * 0.42, cx + 6 * u, bank - hgt * 0.46, 'mist', v + 3, z);
    for (const [x, y] of wins) plot(p, x, y, 'faer', 4 + r() * 3, z);
    return wins;
  }

  /** The lightless lake: black still water holding the lights above it as broken dashes, and a boat with one lamp. */
  function lake(p, x0, x1, y0, y1, u, o) {
    const z = o.z ?? 1; const Wt = p.ri('water');
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, y1); y += 1) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(p.w, x1); x += 1) {
        const i = y * p.w + x; p.r[i] = Wt; p.v[i] = y === Math.floor(y0) ? 3 : 0.8 + (hash(x >> 2, y, 5) < 0.12 ? 1.4 : 0); p.z[i] = z;
      }
    }
    for (const [lx, k] of o.lights) {
      for (let y = Math.floor(y0) + 1; y < y1; y += 1) {
        const t = (y - y0) / (y1 - y0); const w = Math.max(1, (1.6 - t) * 3.4 * u);
        if (hash(Math.round(lx), y, 13) < 0.2) continue;
        const sx = lx + (hash(y, 3, Math.round(lx)) - 0.5) * 2.4 * u;
        p.fill(C.rect(Math.round(sx - w / 2), y, Math.max(1, Math.round(w)), 1), 'water', Math.round(5 + k * (1 - t) * 4.5), z);
      }
    }
    // Long faint glints across the still water.
    for (let k = 0; k < 6; k += 1) {
      const y = Math.round(lerp(y0 + 1, y1 - 1, hash(k, 1, 21))); const x = lerp(x0, x1, hash(k, 2, 21)); const w = (4 + hash(k, 3, 21) * 10) * u;
      p.fill(C.rect(Math.round(x - w / 2), y, Math.round(w), 1), 'water', 3, z);
    }
    if (o.boat) {
      const [bx, by] = o.boat;
      p.fill(C.poly([[bx - 5 * u, by - 1.8 * u], [bx + 5.5 * u, by - 2.2 * u], [bx + 3.6 * u, by], [bx - 3.6 * u, by]]), 'shadow', 1, z);
      p.fill(C.rect(bx - 1 * u, by - 5.4 * u, 1.8 * u, 3.8 * u), 'shadow', 1, z);
      p.fill(C.circle(bx, by - 6 * u, 1 * u, 8), 'shadow', 1, z);
      line(p, bx + 2.4 * u, by - 9 * u, bx - 1.5 * u, by + 2 * u, 'shadow', 2, z);
      plot(p, bx + 5.4 * u, by - 3.4 * u, 'faer', 7, z);
      for (let k = 1; k < 6; k += 1) plot(p, bx + 5.4 * u + (k % 2 ? 0 : 1), by + k, 'water', 8 - k, z);
    }
  }

  /** An orb web: spokes from the hub, a spiral laid across them, guy lines to anchors. */
  function web(p, cx, cy, rx, ry, o) {
    const n = o.spokes ?? 12; const z = o.z ?? 5; const ramp = o.ramp || 'silk'; const v = o.v ?? 3; const r = rng(o.seed || 'web');
    const turns = o.turns ?? Math.max(3, Math.round(Math.min(rx, ry) / 2.6));
    const ang = []; const reach = [];
    for (let i = 0; i < n; i += 1) { ang.push(((i + (r() - 0.5) * 0.3) / n) * Math.PI * 2); reach.push(0.92 + r() * 0.14); }
    const pt = (i, f) => [cx + Math.cos(ang[i % n]) * rx * f * reach[i % n], cy + Math.sin(ang[i % n]) * ry * f * reach[i % n]];
    for (const [i, x, y] of o.anchors || []) { const [ax, ay] = pt(i, 1); line(p, ax, ay, x, y, ramp, v - 0.6, z); }
    const fall = o.fall ?? 0; // strands dimmer toward the rim
    for (let i = 0; i < n; i += 1) { const [x, y] = pt(i, 1); line(p, cx, cy, x, y, ramp, (t) => v - fall * t, z); }
    for (let t = 1; t <= turns; t += 1) {
      const f = 0.14 + (t / turns) * 0.82; const vv = v - 0.4 - fall * f;
      for (let i = 0; i < n; i += 1) {
        if (o.torn && o.torn(i, t)) continue;
        const [ax, ay] = pt(i, f); const [bx, by] = pt(i + 1, f);
        const mx = lerp(ax, bx, 0.5) * 0.93 + cx * 0.07; const my = lerp(ay, by, 0.5) * 0.93 + cy * 0.07;
        line(p, ax, ay, mx, my, ramp, vv, z); line(p, mx, my, bx, by, ramp, vv, z);
      }
    }
    p.fill(C.ellipse(cx, cy, Math.max(1, rx * 0.08), Math.max(1, ry * 0.06), 10), ramp, v + 0.6, z); // the hub
  }

  /** A cone of light falling under a canopy: widening as it falls, gathering in the mist toward the floor. Clean bands. */
  function lightFall(p, cx, top, bottom, hw0, hw1, peak, ramp, z, base = 1) {
    const ri = p.ri(ramp);
    p.each(C.rect(cx - hw1 * 1.5, top, hw1 * 3, bottom - top), (x, y, i) => {
      if (p.z[i] > z) return;
      const t = (y + 0.5 - top) / (bottom - top);
      const q = Math.abs(x + 0.5 - cx) / lerp(hw0, hw1, t ** 0.8);
      const f = clamp(1.25 - q, 0, 1.15) ** 1.5 * (0.45 + 0.55 * t ** 1.6);
      if (f < 0.04) return;
      p.r[i] = ri; p.v[i] = Math.round(lerp(base, peak, f)); p.z[i] = z;
    });
  }

  /* ---------- the cards ---------- */

  /**
   * Something with too many legs: a great spider facing you, its front pair
   * reared, the rest arched high over its body, the abdomen swelling behind
   * its head. Black; its eyes a cluster of the card's colour.
   */
  function spider(p, cx, fy, s, ramp, z) {
    const X = (k) => cx + k * s; const Y = (k) => fy - k * s;
    const w = Math.max(1.3, s * 0.055);
    const legs = [
      [[0.06, 0.44], [0.22, 0.9], [0.16, 0.6]],
      [[0.08, 0.42], [0.34, 0.86], [0.46, 0]],
      [[0.09, 0.39], [0.5, 0.76], [0.68, 0]],
      [[0.08, 0.36], [0.56, 0.6], [0.88, 0]],
    ];
    const rim = ['faer', 2.6];
    for (const m of [-1, 1]) {
      for (const [h, k, f] of legs) {
        limb(p, X(m * h[0]), Y(h[1]), X(m * k[0]), Y(k[1]), w * 1.8, w * 1.2, 'shadow', 0.6, z, rim);
        limb(p, X(m * k[0]), Y(k[1]), X(m * f[0]), Y(f[1]), w * 1.2, w * 0.5, 'shadow', 0.6, z, k[1] > f[1] + 0.3 ? null : rim);
      }
    }
    // The body on its own layer, so its outline can be lit apart from the legs.
    p.fill(C.ellipse(cx, Y(0.66), 0.25 * s, 0.21 * s, 24), 'shadow', 0.9, z + 1);
    p.shade(C.ellipse(cx, Y(0.7), 0.08 * s, 0.11 * s, 12), 0.7, z + 1); // a ridge down its back
    p.fill(C.ellipse(cx, Y(0.42), 0.14 * s, 0.115 * s, 18), 'shadow', 0.4, z + 1);
    for (const m of [-1, 1]) p.fill(C.poly([[X(m * 0.012), Y(0.34)], [X(m * 0.075), Y(0.34)], [X(m * 0.03), Y(0.23)]]), 'shadow', 0.4, z + 1);
    const eyes = [[-0.045, 0.45, 2], [0.045, 0.45, 2], [-0.095, 0.48, 1], [0.095, 0.48, 1], [-0.02, 0.51, 1], [0.02, 0.51, 1]];
    for (const [ex, ey, b] of eyes) plot(p, X(ex), Y(ey), ramp, b > 1 ? 3 : 2, z + 2);
    return { ex: cx, ey: Y(0.46) };
  }

  /** An exile walking the bridge: hooded, a long cloak, white hair, a staff, a caged fungus lantern held out. */
  function exile(p, cx, fy, s, ramp, z) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy - y * s]));
    // The cloak, in the card's dark blue, falling in folds.
    p.fill(P([[-0.24, 0], [-0.17, 0.34], [-0.13, 0.64], [-0.11, 0.8], [-0.06, 0.93], [0.02, 1], [0.1, 0.92], [0.13, 0.78], [0.15, 0.56], [0.2, 0.28], [0.32, 0.02], [0.26, 0]]), ramp, (x) => (frac((x - cx) / Math.max(2, s * 0.09)) < 0.3 ? 0.2 : 0.7), z);
    p.fill(P([[-0.05, 0.87], [0.06, 0.87], [0.05, 0.76], [-0.04, 0.76]]), 'shadow', 0, z + 1);
    // White hair falling from the hood: a drow's.
    for (let k = 0; k < Math.max(3, Math.round(s * 0.22)); k += 1) { plot(p, cx - 0.07 * s, fy - 0.85 * s + k, 'silk', 10 - k * 0.5, z + 1); if (k > 1) plot(p, cx - 0.07 * s - 1, fy - 0.85 * s + k, 'silk', 8 - k * 0.5, z + 1); }
    // The staff, in the right hand.
    line(p, cx + 0.2 * s, fy, cx + 0.25 * s, fy - 1.1 * s, 'shadow', 1.4, z);
    // The left arm held out, the lantern hanging from it: a glowing fungus caged in silver.
    limb(p, cx - 0.08 * s, fy - 0.64 * s, cx - 0.34 * s, fy - 0.6 * s, Math.max(1.6, s * 0.08), Math.max(1.2, s * 0.06), ramp, 0.7, z);
    const lx = Math.round(cx - 0.36 * s); const ly = Math.round(fy - 0.54 * s);
    line(p, lx, ly - 2, lx, ly - 1, 'shadow', 1.4, z + 1);
    p.fill(C.rect(lx - 1, ly - 1, 3, 5), 'shadow', 1.6, z + 1);
    p.fill(C.rect(lx - 1, ly, 3, 3), ramp, 3, z + 2);
    p.fill(C.rect(lx, ly + 1, 1, 1), ramp, 4.4, z + 2);
    return { lx, ly: ly + 1 };
  }

  /**
   * A geode split in two, the halves leaning apart on a low stone: each a
   * rough dark rind round a thin ring of agate and a hollow lined with
   * crystal points, glowing. Returns the hollows.
   */
  function geode(p, cx, fy, s, ramp, z) {
    // The boulder: lumpy, flat-bottomed, lit along its top from the caps above.
    const R = s * 0.5; const by = fy - R * 0.72; const out = [];
    const rock = [];
    for (let i = 0; i <= 26; i += 1) {
      const a = Math.PI + (i / 26) * Math.PI; const k = R * (0.9 + 0.16 * hash(i, 7, 5));
      rock.push([cx + Math.cos(a) * k, by + Math.sin(a) * k * 0.78]);
    }
    rock.push([cx + R * 0.98, fy], [cx - R * 0.98, fy]);
    const shape = C.poly(rock);
    p.fill(shape, 'rock', (x, y) => Math.round(1 + clamp((by + R * 0.3 - y) / R, 0, 1) * 1.4 + ((cx - x) / R) * 0.5), z);
    p.cells(shape, { size: R * 0.45, joint: 0.6, jointV: -0.7, vary: 0.5, bevel: 0.6, lit: [0, 1], seed: 19, z });
    edge(p, z, 0, -1, 'rock', 7, { only: (x) => Math.abs(x - cx) < R * 1.2 });
    // Its front broken away: a jagged hollow, a ring of pale agate round it, crystals packed inside, glowing.
    const hx = cx + R * 0.08; const hy = by + R * 0.02; const ax = R * 0.5; const ay = R * 0.4;
    const hol = []; const ring = [];
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2; const k = 0.78 + 0.34 * hash(i, 9, 6);
      hol.push([hx + Math.cos(a) * ax * k, hy + Math.sin(a) * ay * k]);
      ring.push([hx + Math.cos(a) * (ax * k + 1.1), hy + Math.sin(a) * (ay * k + 1.1)]);
    }
    p.fill(C.poly(ring), ramp, 1.2, z + 1);
    const ri = p.ri(ramp);
    p.each(C.poly(hol), (x, y, i) => {
      const d = Math.hypot((x + 0.5 - hx) / ax, (y + 0.5 - hy) / ay);
      p.r[i] = ri; p.z[i] = z + 1; p.v[i] = Math.round(3.6 - d * 3.4);
    });
    // Crystal points standing out of the hollow and over its lip, bright at their tips.
    const r = rng('geode');
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2 + r() * 0.4; const d0 = 0.75 + r() * 0.15; const d1 = 0.15 + r() * 0.35;
      const bx = hx + Math.cos(a) * ax * d0; const bY = hy + Math.sin(a) * ay * d0;
      const tx = hx + Math.cos(a) * ax * d1; const ty = hy + Math.sin(a) * ay * d1;
      line(p, bx, bY, tx, ty, ramp, 3, z + 2);
      plot(p, tx, ty, ramp, 4, z + 2);
    }
    for (const [dx, h] of [[-0.25, 0.5], [0.1, 0.75], [0.32, 0.45]]) { // a few long ones over the top
      const x0 = hx + dx * ax; const y0 = hy - ay * 0.55;
      line(p, x0, y0, x0 + dx * 2, y0 - ay * h, ramp, 3.4, z + 2);
      plot(p, x0 + dx * 2, y0 - ay * h, ramp, 4, z + 2);
    }
    // Loose crystals fallen at its foot.
    for (const [dx, l] of [[-0.85, 2], [0.9, 2.6], [1.1, 1.6]]) { const x0 = cx + dx * R; line(p, x0, fy, x0 + l * 0.4, fy - l, ramp, 3, z + 2); }
    // The crystals' own light on the rind round the hollow, so the boulder shows its shape.
    pool(p, hx, hy, R * 0.85, 3, { zMin: z, zMax: z, sy: 0.9, hard: true });
    out.push([hx, hy]);
    return out;
  }

  /* ================= A: the silk bridge ================= */

  const A = {
    job: 0, setting: 'underdark', key: 'A', id: 'underdark-a', side: 'inside',
    name: 'The Underdark', title: 'The silk bridge',
    pitch: 'Miles below, in a cavern so big it has its own weather. A bridge of spider silk runs out over the chasm to a forest of glowing fungus taller than trees, and whatever the card is waits where the bridge comes to ground.',
    notes: [
      ['Light', 'No fire anywhere: the cold blue glow of the fungus, brightest in the gills under the great caps and in the air behind the far ledge, where the card stands dark against it. Crystals and veins of faerzress glow blue-white. Everything else is black slate, black water and cloud.'],
      ['Detail', 'Pale fibrous stalks with torn skirts, gills radiating under every cap, a woven bridge with slats and drooping hand ropes tied round the stalks, stalactites tipped with crystal, cloud lying in the chasm, far rain, a drow city carved in a stalagmite, a boat with one lamp on the lightless lake.'],
      ['Vista', 'You stand on the bridge, looking along it to the far ledge under two great caps. The card waits there: a spider rearing, an exile with a fungus lantern, a geode broken open, a web spun across the way. For a Clear Path the bridge holds, lit gold all the way over.'],
      ['World', 'The rock shelf the bridge is tied to, under the table: great stalks at its sides with bracket fungus on them, glowing fungus, webs and a still pool in the corners, a vein of faerzress in the floor, spores drifting down like slow snow.'],
    ],
    palette: ['#030407', '#0F131B', '#252E3D', '#4E5F77', '#3966AA', '#8FBBEC', '#E6F2FE', '#93A5BC', '#7D8695'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 134; const gx = W / 2;
      const hor = 68 * u;
      // The void: black, the glow of the caps hanging in the air under them, dark toward the far end.
      p.fill(C.rect(0, 0, W, H), 'mist', (x, y) => 0.5 + 1.2 * Math.exp(-(((y - 74 * u) / (10 * u)) ** 2)), 0);
      // Far fungi either side of the way, small and hazed; none at its end.
      for (const [dx, cy, rx, sd] of [[-31, 62, 7, 1], [-20, 67, 4, 2], [-38, 56, 9, 3], [25, 64, 6, 4], [35, 58, 8, 5], [17, 69, 3, 6]]) {
        fungus(p, { u, x: gx + dx * u, base: 78 * u, capY: cy * u, rx: rx * u, ry: rx * u * 0.2, domeH: rx * u * 0.5, domeV: 1.6, spots: 2, spotV: 3, sw: Math.max(0.6, rx * 0.1) * u, v0: 1, v1: 5, seed: sd, z: 1, skirt: false, stalkV: 1.6, light: { r: rx * 2.6 * u, s: 1.6, zMin: 0, zMax: 0 } });
      }
      // Cloud in the chasm, under the bridge.
      cloudBank(p, 0, W, 86 * u, u, { v: 3, amp: 5 * u, depth: 12 * u, seed: 11, z: 2 });
      cloudBank(p, 0, W, 102 * u, u, { v: 2.2, amp: 6 * u, depth: 34 * u, seed: 12, z: 2 });
      // The light falling from the caps through the air, onto the cloud and the bridge.
      pool(p, gx, 26 * u, 46 * u, 6.4, { zMin: 0, zMax: 2, sy: 1.15 });
      // The great caps overhead: two fungi the bridge is tied to, their gills filling the top.
      const stR = fungus(p, { u, x: 90 * u, base: H + 4 * u, capY: 13 * u, rx: 38 * u, ry: 11 * u, sw: 5.6 * u, taper: 0.45, lean: -4 * u, bend: 2.5 * u, v0: 1, v1: 9, gills: 30, seed: 21, z: 3, stalkV: 9.4, fall: 1.25, foot: 0 });
      const stL = fungus(p, { u, x: 5 * u, base: H + 4 * u, capY: 21 * u, rx: 44 * u, ry: 13 * u, sw: 6.4 * u, taper: 0.45, lean: 5 * u, bend: -2.5 * u, v0: 1, v1: 9.6, gills: 34, seed: 22, z: 3, stalkV: 10, fall: 1.25, foot: 0 });
      brackets(p, stL, [62 * u], 1, u, 3, 'b-br1');
      brackets(p, stR, [72 * u], -1, u, 3, 'b-br2');
      // The bridge, lit under the caps and running on into the dark; its hand ropes end at the stalks they are tied to.
      const inStalk = (x, y) => [stL, stR].some((s) => Math.abs(x + 0.5 - s.sxAt(y)) < s.swAt(y));
      silkBridge(p, { u, gx, hor, D: 48 * u, hw: 22 * u, rh: 30 * u, z1: 6, dz: 0.3, slatW: 0.05, v: 1, lit: (z) => 3.6 * clamp(1 - Math.abs(z - 1.25) / 1.6, 0, 1) - (z > 3 ? (z - 3) * 0.7 : 0), seed: 'b-bridge', stop: inStalk });
      // Turns of silk wound round each stalk where its rope is tied, curving with it.
      for (const s of [stL, stR]) {
        for (let k = 0; k < 5; k += 1) {
          const y0 = (93 + k * 2.2) * u; const c = s.sxAt(y0); const w = s.swAt(y0);
          for (let x = Math.max(0, Math.floor(c - w)); x <= Math.min(W - 1, Math.ceil(c + w)); x += 1) {
            const q = (x + 0.5 - c) / w; if (Math.abs(q) > 1) continue;
            plot(p, x, y0 + Math.sqrt(1 - q * q) * 1.4 * u + q * 0.7 * u, 'silk', 8.6 - q * q * 3 - k * 0.5, 5);
          }
        }
      }
      // A spider coming down on its thread, out of the gills.
      const sx = Math.round(gx + 10 * u); const sy = Math.round(46 * u);
      line(p, sx, 24 * u, sx, sy - 2, 'silk', 6, 5);
      p.fill(C.ellipse(sx, sy, 1.7 * u, 2 * u, 10), 'shadow', 0.3, 5);
      p.fill(C.ellipse(sx, sy - 2.2 * u, 1.1 * u, 1 * u, 8), 'shadow', 0.3, 5);
      for (const m of [-1, 1]) for (const [a, b] of [[-2.6, -4.2], [-1.6, -2.2], [-0.6, 0.6], [0.2, 2.6]]) line(p, sx + m * 1.2 * u, sy + a * 0.5 * u, sx + m * 3.6 * u, sy + b * u, 'shadow', 0.3, 5);
      vignette(p, W, H, 1.6, 0.42);
      return {
        p,
        over(img) {
          for (const q of particles('mote', 18, [10 * u, 34 * u, W - 20 * u, 44 * u], 2.2, 41)) put(img, q.x, q.y, q.big ? '#BBD7F7' : '#6A9DDB', q.a * 0.7);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: [...EMIT, 'gold'] });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const hor = 66 * u; const D = 36 * u; const z1 = 3.3;
      const fy = Math.round(hor + D / z1); // where the bridge comes to ground: the card's spot
      const bank = 68 * u;
      const open = cat === 'clear-path';
      // The void: black overhead, the forest's light hanging in the air above the far floor.
      p.fill(C.rect(0, 0, W, H), 'mist', (x, y) => 0.6 + 2.8 * clamp((y - 10 * u) / (bank - 10 * u), 0, 1) ** 2, 0);
      // Rain falling from the roof far off: the cavern's own weather.
      for (const [rx0, rw] of [[gx - 158 * u, 34 * u], [gx + 118 * u, 26 * u], [gx + 268 * u, 34 * u], [gx - 300 * u, 30 * u]]) {
        p.shade(C.rect(rx0, 8 * u, rw, bank - 8 * u), (x, y) => {
          const e = clamp(Math.min(x - rx0, rx0 + rw - x) / (7 * u), 0, 1) * clamp((y - 8 * u) / (16 * u), 0, 1);
          return frac((x - y * 0.16) / (2.4 * u) + n1(y / (9 * u), 7) * 0.4) < 0.34 ? 1.6 * e : 0;
        }, 0);
      }
      // The far forest on the far floor, in clumps, smaller and paler with distance; the city and the lake among it.
      const cityX = gx + 98 * u; const lakeA = gx - 106 * u; const lakeB = gx - 50 * u;
      const r = rng('v-forest');
      const far = [];
      for (let x = -20 * u + r() * 10 * u; x < W + 20 * u; x += (4 + r() ** 2 * 18) * u) {
        if (Math.abs(x - gx) < 28 * u || Math.abs(x - cityX) < 17 * u || (x > lakeA - 2 * u && x < lakeB + 2 * u)) continue;
        const capY = (36 + r() * 26) * u;
        far.push([x, capY, (bank - capY) * (0.4 + r() * 0.4), Math.floor(r() * 1e5), r()]);
      }
      for (const [x, capY, rx] of [[lakeA + 3 * u, 46 * u, 10 * u], [lakeB - 3 * u, 52 * u, 7 * u]]) far.push([x, capY, rx, Math.floor(x), 0.3]);
      far.sort((a, b) => a[1] - b[1]);
      for (const [x, capY, rx0, sd, kind] of far) {
        const c = capKind(kind, rx0);
        fungus(p, { u, x, base: bank + u, capY, rx: c.rx, ry: c.rx * 0.16, domeH: c.domeH, domeV: 2.4, crown: 1.2, spots: c.rx > 4 * u ? 2 : 0, spotV: 4, sw: Math.max(0.7 * u, rx0 * 0.2), lean: (hash(sd, 1, 2) - 0.5) * 3 * u, v0: 2, v1: 5.4 + hash(sd, 2, 2) * 1.6, rimK: 0, seed: sd, z: 1, skirt: false, stalkV: 2.4, fall: 0.8, foot: 0.6, light: { r: c.rx * 2.8, s: 2, zMin: 0, zMax: 0 } });
      }
      const wins = drowCity(p, cityX, bank, 20 * u, u, { roof: 6 * u });
      lake(p, lakeA, lakeB, bank - 5 * u, bank, u, { lights: [[lakeA + 3 * u, 0.8], [lakeB - 3 * u, 0.9], [gx - 82 * u + 5.4 * u, 0.6]], boat: [gx - 82 * u, bank - 2.6 * u] });
      // The far floor's lip, where it drops into the chasm.
      p.fill(C.rect(0, bank, W, 3 * u), 'rock', (x, y) => (y < bank + 1 ? 3 : 1.4), 1);
      // The roof and its stalactites, open over the middle where the caps are.
      const tips = roof(p, W, u, { y: 6 * u, seed: 'v-roof', max: 22, skip: (x) => Math.abs(x - gx) < 30 * u, toward: gx, reach: 120 * u });
      // Groves of giants nearer than the forest, rising out of the chasm, their feet lost in the cloud.
      for (const m of [-1, 1]) {
        for (let d = 66 + hash(m, 0, 4) * 10, k = 0; d * u < W / 2 + 40 * u; d += 50 + hash(k, m, 4) * 46, k += 1) {
          const x = gx + m * d * u;
          if (Math.abs(x - cityX) < 12 * u || (x > lakeA + 6 * u && x < lakeB - 6 * u)) continue;
          const capY = (12 + hash(k, m, 5) * 22) * u;
          grove(p, x, { u, seed: `g${m}${k}`, base: H + 4 * u, capY, rx: (10 + hash(k, m, 6) * 6 + (40 * u - capY) / u * 0.25) * u, v1: 7.4, stalkV: 5.4, light: 2.4, z: 2 });
        }
      }
      // Cloud lying in the chasm, lit from above, brightest under the caps.
      const under = (x) => 2.4 * Math.exp(-(((x - gx) / (34 * u)) ** 2));
      cloudBank(p, 0, W, 79 * u, u, { v: 4, amp: 5 * u, depth: 9 * u, seed: 21, z: 2, lit: under });
      cloudBank(p, 0, W, 90 * u, u, { v: 3, amp: 6 * u, depth: 14 * u, seed: 22, z: 2, lit: (x) => under(x) * 0.6 });
      // The light falling from the great caps onto the far ledge: the card stands in front of it.
      const peak = { monster: 12, wanderer: 10.5, item: 10, obstacle: 8.5 }[cat] ?? 9;
      if (open) {
        // The way on, lit: gold rising from the far floor beyond the ledge, in clean bands.
        const gi = p.ri('gold');
        p.each(C.rect(gx - 30 * u, 14 * u, 60 * u, fy - 14 * u), (x, y, i) => {
          const d = Math.hypot((x + 0.5 - gx - u) / (17 * u), (y + 0.5 - fy) / (44 * u));
          if (d >= 1) return;
          p.r[i] = gi; p.v[i] = Math.round(1 + 8.4 * (1 - d) ** 1.5); p.z[i] = 1;
        });
      } else {
        // The air behind the ledge, lit by the caps and by the fungus at their feet: brightest just above the ledge.
        pool(p, gx + u, fy - 10 * u, 30 * u, peak * 0.7, { zMin: 0, zMax: 1, sx: 0.75, sy: 1.2 });
        pool(p, gx + u, 30 * u, 22 * u, 2.4, { zMin: 0, zMax: 1, sx: 0.9 });
      }
      // The far ledge the bridge comes to.
      const ledge = C.poly([[gx - 40 * u, fy + 7 * u], [gx - 38 * u, fy - 0.5 * u], [gx - 20 * u, fy - 1.5 * u], [gx, fy - 0.5 * u], [gx + 22 * u, fy - 1.5 * u], [gx + 40 * u, fy], [gx + 42 * u, fy + 7 * u]]);
      p.fill(ledge, 'rock', (x, y) => (y < fy + 0.5 * u ? 4 + 2.4 * Math.exp(-(((x - gx) / (14 * u)) ** 2)) : 1.6 - (y - fy) / (7 * u)), 3);
      p.cells(ledge, { size: 4 * u, sy: 0.6, joint: 0.7, jointV: -1, vary: 0.6, bevel: 0.5, lit: [0, 1], seed: 9, z: 3 });
      // The two great fungi, their caps meeting overhead.
      fungus(p, { u, x: gx - 19 * u, base: fy, capY: 13 * u, rx: 27 * u, ry: 7 * u, domeH: 7 * u, domeV: 1.8, spots: 8, spotV: 6, sw: 3.6 * u, lean: 4 * u, v0: 2.6, v1: 9.6, gills: 28, seed: 31, z: 3, stalkV: 8.6, fall: 1.4 });
      fungus(p, { u, x: gx + 21 * u, base: fy, capY: 23 * u, rx: 19 * u, ry: 5 * u, domeH: 5 * u, domeV: 1.8, spots: 5, spotV: 6, sw: 2.8 * u, lean: -3 * u, v0: 2.6, v1: 9.2, gills: 22, seed: 32, z: 3, stalkV: 8, fall: 1.4 });
      // Small glowing fungus crowding the great stalks' feet.
      for (const [x0, n, sd] of [[gx - 17 * u, 5, 91], [gx + 19 * u, 4, 92], [gx - 31 * u, 3, 93], [gx + 32 * u, 3, 94]]) {
        const rr = rng(sd);
        for (let k = 0; k < n; k += 1) {
          const x = x0 + (rr() - 0.5) * 9 * u; const h = (2 + rr() * 4) * u; const rx = (1.2 + rr() * 1.8) * u;
          fungus(p, { u, x, base: fy + rr() * u, capY: fy - h, rx, ry: rx * 0.4, domeH: rx * 0.7, domeV: 2.6, crown: 1, sw: Math.max(0.5, rx * 0.2), v0: 4, v1: 9, seed: sd * 10 + k, z: 3, skirt: false, stalkV: 5, fall: 0.6, foot: 0.3 });
        }
      }
      // The bridge, catching the light toward its far end.
      const lit = (z) => 2.6 * smooth(clamp((z - 1) / (z1 - 1), 0, 1));
      const br = silkBridge(p, { u, gx, hor, D, hw: 32 * u, rh: 26 * u, z1, dz: 0.26, slatW: 0.05, v: 1.1, lit, seed: 'v-bridge', gold: open ? () => true : undefined });
      // The card, where the bridge comes to ground.
      if (cat === 'monster') {
        const s = 42 * u;
        const sp = spider(p, gx + u, fy + u, s, ramp, 7);
        p.backlit(7, 'mist', 6, 'faer', 4);
        p.backlit(8, 'mist', 6, 'faer', 4);
        edge(p, 8, 0, -1, 'faer', 3);
        p.tint(sp.ex, sp.ey, 4 * u, hex, 0.35, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 34 * u;
        const { lx, ly } = exile(p, gx + 3 * u, fy + u, s, ramp, 7);
        p.backlit(7, 'mist', 5, ramp, 3);
        edge(p, 7, 0, -1, ramp, 2.6);
        p.light(lx, fy, 12 * u, 2.6, flicker(0.9, 0.12), { zMin: 3, zMax: 4, sy: 0.5 });
        p.tint(lx, ly, 3 * u, CARD[ramp][4], 0.6, flicker(0.9, 0.15));
        p.tint(lx, ly, 9 * u, hex, 0.35, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        const g = geode(p, gx + u, fy + u, 30 * u, ramp, 7);
        p.backlit(7, 'mist', 5, 'faer', 3.4);
        for (const [x, y] of g) p.tint(x, y, 5 * u, CARD[ramp][4], 0.3, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        web(p, gx + u, fy - 27 * u, 18 * u, 28 * u, {
          ramp, v: 4, fall: 1.4, spokes: 12, turns: 5, seed: 'v-web', z: 6,
          anchors: [[0, gx + 19 * u, fy - 34 * u], [7, gx - 15 * u, fy - 24 * u], [3, gx + 8 * u, fy], [5, gx - 8 * u, fy], [10, gx - 12 * u, 20 * u], [12, gx + 12 * u, 26 * u]],
        });
        for (const [dx, dy, w, h] of [[-8, -40, 2.2, 4], [8, -16, 2, 3.4], [2, -50, 1.6, 2.6]]) p.fill(C.ellipse(gx + dx * u, fy + dy * u, w * u, h * u, 12), 'silk', (x) => 6 + (x < gx + dx * u ? 1.5 : 0), 6);
      } else {
        p.light(gx, fy + 6 * u, 30 * u, 3, flicker(0.4, 0.06, 0.3), { zMin: 3, zMax: 3, sy: 0.4 });
      }
      vignette(p, W, H, 1.6, 0.42);
      const shown = tips.filter(([x]) => x > 0 && x < W);
      return {
        p,
        over(img, t) {
          shown.forEach(([x, y], i) => { const a = clamp(Math.sin(t * 1.3 + i * 2.1) * 1.5 - 0.5, 0, 1); if (a > 0) put(img, x, y, '#D5E5F7', a * 0.9); });
          wins.forEach(([x, y], i) => { if (Math.sin(t * 0.7 + i * 3.7) > 0.93) put(img, x, y, '#141E2E', 0.85); });
          for (const q of particles('snow', Math.round(W / 14), [0, 40 * u, W, 60 * u], t * 0.2, 61)) put(img, q.x, q.y, q.big ? '#6A9DDB' : '#2C518E', q.a * 0.55);
          if (open) for (const q of particles('mote', 14, [gx - 12 * u, fy - 40 * u, 24 * u, 40 * u], t, 71)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a);
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 8 * u, fy - 34 * u, 16 * u, 22 * u], t, 73)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          void br;
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 200; const gx = W / 2;
      const farEdge = 44 * u;
      // Beyond the shelf's far edge: the chasm, black, with the forest's lights far off.
      p.fill(C.rect(0, 0, W, farEdge + 4 * u), 'mist', (x, y) => 0.6 + 1.6 * clamp(y / farEdge, 0, 1) ** 2, 0);
      // The shelf: big natural slabs in perspective, finer cracks across them.
      const sh = C.poly([[0, H], [0, farEdge + 2 * u], [W * 0.3, farEdge], [W * 0.62, farEdge + 1 * u], [W, farEdge - 1 * u], [W, H]]);
      // Rock that flowed and set: broad swells, a few long cracks with a lit lip, rubble in the hollows.
      p.fill(sh, 'rock', (x, y) => 2.3 - (y / H) * 0.5 + (n2(x / (40 * u), y / (16 * u), 43) - 0.5) * 1.2, 1);
      p.cells(sh, { size: 26 * u, sx: 1.8, sy: 0.6, joint: 0.7, jointV: -1.1, vary: 0.5, bevel: 0.9, lit: [0, 1], seed: 41, z: 1 });
      p.cells(sh, { size: 4 * u, sy: 0.7, joint: 0.5, jointV: -0.4, vary: 0.3, bevel: 0.25, seed: 42, z: 1 });
      for (let k = 0; k < 7; k += 1) {
        const cr = rng(`crack${k}`);
        const pts = wander(cr() * W, farEdge + 10 * u + cr() * (H - farEdge - 20 * u), (cr() - 0.5) * 0.6 + (cr() < 0.5 ? 0 : Math.PI), 18 + Math.floor(cr() * 20), 2.6 * u, `crack${k}`, 0.7);
        for (let j = 0; j + 1 < pts.length; j += 1) {
          line(p, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], 'rock', 0.2, 1);
          line(p, pts[j][0], pts[j][1] - 1, pts[j + 1][0], pts[j + 1][1] - 1, 'rock', 2.4, 1, { under: 1 });
        }
      }
      p.shade(C.rect(0, farEdge - 2 * u, W, 4 * u), (x, y) => (Math.abs(y - farEdge - (x / W) * 0) < 1.2 * u ? 1.2 : 0), 1);
      // The light of the great caps beyond the vista, spilling down over the shelf.
      p.light(gx, -30 * u, 150 * u, 2.6, breathe(0.4, 0.08, 0.4), { zMin: 1, sx: 1.6 });
      // The bridge's anchor: two posts at the far edge, silk wound round them, the bridge leaving between them.
      for (const m of [-1, 1]) {
        const x = gx + m * 30 * u;
        p.fill(C.poly([[x - 6 * u, 50 * u], [x - 4 * u, 22 * u], [x, 14 * u], [x + 4 * u, 23 * u], [x + 6 * u, 50 * u]]), 'rock', (px, py) => 2 + (px < x ? 1 : 0) + (py > 46 * u ? -0.8 : 0), 2);
        for (let k = 0; k < 5; k += 1) line(p, x - 5 * u, (27 + k * 2.4) * u, x + 5 * u, (26 + k * 2.4) * u, 'silk', 6 - k * 0.4, 2);
        line(p, x - m * 4 * u, 27 * u, gx + m * 9 * u, 0, 'silk', 6, 2);
        pool(p, x, 30 * u, 24 * u, 2.2, { zMin: 1, zMax: 2 });
      }
      const deck = C.poly([[gx - 22 * u, 48 * u], [gx + 22 * u, 48 * u], [gx + 9 * u, 0], [gx - 9 * u, 0]]);
      p.fill(deck, 'silk', (x, y) => 2 + (frac(Math.log((60 * u) / Math.max(1, 60 * u - y)) * 5) < 0.2 ? 2 : 0) + (Math.abs(x - gx) > (9 + (13 * y) / (48 * u)) * u - 1.5 ? 2 : 0), 2);
      // The great stalks standing at the sides, their gills above the picture, their roots over the rock.
      for (const [x, sd, ph, m] of [[5 * u, 51, 0, 1], [W - 4 * u, 52, 2.1, -1]]) {
        const base = 124 * u;
        // Roots spreading from its foot, down the shelf's edge and out of the picture.
        for (let k = 0; k < 4; k += 1) {
          const a = Math.PI / 2 + m * (0.15 + k * 0.32) * (k % 2 ? 1 : -0.4);
          const pts = wander(x + m * 4 * u, base - 2 * u, a, 10, 3 * u, sd * 10 + k, 0.4);
          for (let j = 0; j + 1 < pts.length; j += 1) {
            if (m * (pts[j + 1][0] - x) > 20 * u) break;
            limb(p, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], Math.max(1, (3 - j * 0.25) * u), Math.max(1, (2.7 - j * 0.25) * u), 'flesh', 4.4 - j * 0.3, 3, ['flesh', 6 - j * 0.4]);
          }
        }
        const st = fungus(p, { u, x, base, capY: -7 * u, rx: 40 * u, ry: 10 * u, sw: 11 * u, foot: 0.45, bend: m * 3 * u, v0: 3, v1: 9, seed: sd, z: 3, stalkV: 9.4, fall: 1.1, skirt: false });
        brackets(p, st, [70 * u, 96 * u], m, u, 3, `w-br${m}`);
        p.light(x + m * 8 * u, 40 * u, 90 * u, 2.4, breathe(ph), { zMin: 1, zMax: 1, sx: 0.6, sy: 1.2 });
        pool(p, x + m * 10 * u, base, 30 * u, 1.6, { zMin: 1, zMax: 1, sy: 0.5 });
      }
      // Glowing fungus in the near corners, on the rock, lichen round them, and webs strung between the stones.
      const clumps = [];
      // A still pool in the near left corner, holding the fungus light; drips fall into it.
      const pool0 = [60 * u, 168 * u, 28 * u, 5.5 * u];
      p.fill(C.ellipse(pool0[0], pool0[1] + 1.2 * u, pool0[2] + 1.5 * u, pool0[3] + 1.2 * u, 28), 'rock', 3.6, 2); // its lip, wet and catching the light
      p.fill(C.ellipse(pool0[0], pool0[1], pool0[2], pool0[3], 28), 'water', 1, 2);
      // The fungus beside it, upside down in it, broken into level dashes.
      for (let y = Math.round(pool0[1] - pool0[3] + 1); y < pool0[1] + pool0[3]; y += 1) {
        if (hash(y, 1, 31) < 0.3) continue;
        const t = (y - (pool0[1] - pool0[3])) / (2 * pool0[3]); const w = (14 - t * 8) * u;
        const x = pool0[0] - pool0[2] * 0.55 + (hash(y, 2, 31) - 0.5) * 4 * u;
        p.fill(C.rect(Math.round(x - w / 2), y, Math.round(w), 1), 'water', Math.round(7 - t * 4), 2);
      }
      p.fill(C.ellipse(pool0[0], pool0[1], pool0[2], pool0[3], 28), 'water', (x, y) => (y < pool0[1] - pool0[3] + 1 ? 4 : null), 2);
      for (const [x, y, s, sd, ph] of [[34 * u, 190 * u, 18 * u, 61, 0.5], [W - 38 * u, 184 * u, 16 * u, 62, 2.4], [84 * u, 199 * u, 7 * u, 63, 1.2], [W - 70 * u, 198 * u, 7 * u, 64, 3.1], [14 * u, 160 * u, 8 * u, 65, 1.9]]) {
        const rr = rng(sd); const caps = [];
        for (let k = 0; k < 6; k += 1) caps.push([x + (rr() - 0.5) * s * 1.6, s * (0.35 + rr() * 0.75), s * (0.16 + rr() * 0.22), y + rr() * 3 * u]);
        caps.sort((a, b) => a[3] - b[3]);
        for (const [cx, h, rx, by] of caps) {
          fungus(p, { u, x: cx, base: by, capY: by - h, rx, ry: rx * 0.34, domeH: rx * 0.75, domeV: 2.2, spots: 1, spotV: 5, sw: Math.max(0.6 * u, rx * 0.17), v0: 3, v1: 8.6, seed: Math.round(cx), z: 4, skirt: false, stalkV: 5, fall: 1 });
        }
        p.light(x, y - s * 0.6, s * 3.2, 3.8, breathe(ph, 0.2), { zMin: 1, zMax: 4, sy: 0.7 });
        const lr = rng(sd + 100);
        for (let k = 0; k < 40; k += 1) {
          const a = lr() * Math.PI * 2; const d = s * (0.8 + lr() * 2.2);
          plot(p, x + Math.cos(a) * d, y - s * 0.2 + Math.sin(a) * d * 0.45, 'glow', 2 + lr() * 3 * (1 - d / (s * 3)), 1);
        }
        clumps.push([x, y - s * 0.6]);
      }
      web(p, 13 * u, H - 18 * u, 17 * u, 15 * u, { spokes: 10, v: 4.4, seed: 'w-web1', z: 5 });
      web(p, W - 16 * u, H - 12 * u, 15 * u, 13 * u, { spokes: 9, v: 4, seed: 'w-web2', z: 5 });
      // A vein of faerzress across the floor, brightest at the edges.
      const at = (x) => 0.45 + 0.55 * clamp(1 - Math.min(x, W - x) / (70 * u), 0, 1);
      vein(p, wander(-2, 128 * u, -0.2, 64, 2.4 * u, 'w-v1', 0.42), 3.2, 6, { onZ: 1, gaps: 0.22, at });
      vein(p, wander(W + 2, 158 * u, Math.PI + 0.25, 36, 2.4 * u, 'w-v2', 0.5), 3.2, 7, { onZ: 1, gaps: 0.22, at });
      p.shade(null, (x, y) => -2.4 * Math.max(0, y / H - 0.34) * clamp(1 - Math.abs(x - gx) / (W * 0.62), 0, 1), 1);
      return {
        p,
        over(img, t) {
          // Spores drifting down through the dark, as slow as snow.
          for (const q of particles('snow', 60, [0, 0, W, H], t * 0.2, 81)) {
            const mid = clamp(1 - Math.abs(q.x - gx) / (W * 0.4), 0, 1) * clamp((q.y - 50 * u) / (40 * u), 0, 1);
            put(img, q.x, q.y, q.big ? '#6A9DDB' : '#2C518E', q.a * (0.7 - mid * 0.45));
          }
          // Drips falling into the pool, and the rings they leave.
          for (let k = 0; k < 3; k += 1) {
            const ph = frac(t * 0.35 + k * 0.37); const dx = pool0[0] + (hash(k, 4, 9) - 0.5) * pool0[2] * 1.2; const dy = pool0[1] + (hash(k, 5, 9) - 0.5) * pool0[3];
            if (ph < 0.4) put(img, dx, dy - (1 - ph / 0.4) * 60 * u, '#6A9DDB', 0.9);
            else { const rr = (ph - 0.4) * 9 * u; const a = 1 - (ph - 0.4) / 0.6; for (let j = 0; j < 14; j += 1) { const an = (j / 14) * Math.PI * 2; put(img, dx + Math.cos(an) * rr, dy + Math.sin(an) * rr * 0.3, '#4D80C4', a * 0.8); } }
          }
          // A spider letting itself down on its thread at each side.
          for (const [x, ph, len] of [[30 * u, 0, 70 * u], [W - 34 * u, 2.6, 90 * u]]) {
            const y = Math.round(len * (0.55 + 0.45 * Math.sin(t * 0.3 + ph)));
            for (let yy = 0; yy < y; yy += 1) put(img, x, yy, '#4C5361', 0.7);
            for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1], [-2, -1], [2, -1], [-2, 1], [2, 1], [-2, 2], [2, 2]]) put(img, x + dx, y + dy, '#05060A');
          }
          void clumps;
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A]);
})();

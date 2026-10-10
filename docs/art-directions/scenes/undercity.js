/* Job 5, the undercity: two directions. */
(() => {
  const { C, Painter, put, particles, SUBJECT, CARD, hash, clamp, lerp, rng, BAYER } = PX;
  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];

  /* The undercity is lit by what grew in it: the Obstacle family's teal. Old
     brick is brown-grey over a near-black indigo; as light climbs a brick it
     cools from brown-grey into the fungus's teal, so anything lit is lit by
     the fungus. The grate light from the streets above is a pale grey. */
  const CAP = ['#0A1715', '#0F241F', '#15332A', '#1C4337', '#235347', '#2C6957', '#377F69', '#47977F', '#5FAE95', '#80C4AD', '#A8DCC9', '#D0F2E5', '#F0FFF9'];
  const RAMPS = {
    brick: ['#030203', '#09050C', '#110D10', '#191416', '#221C1C', '#2C2624', '#36302B', '#3D3C35', '#434B43', '#4B5F55', '#58776A', '#6E9585', '#97BCAD', '#CBE4D9'],
    wet: ['#030203', '#08050B', '#0F0C0F', '#161214', '#1E1A1A', '#272221', '#302B28', '#363833', '#3C4842', '#465E54', '#57796B', '#7AA393', '#B4D8C9'],
    water: ['#020203', '#05040A', '#080811', '#0B1015', '#0E1A1C', '#122822', '#173A30', '#1E4F41', '#296955', '#3B866F', '#5CA88F', '#94D2BD', '#D2F4E8'],
    moss: ['#030203', '#060908', '#0A100E', '#0F1A16', '#14251F', '#1B3229', '#234135', '#2E5343', '#3D6A57'],
    cap: CAP,
    glow: CAP,
    sky: ['#14181A', '#2E3638', '#56625F', '#8C9A93', '#C3CFC8', '#EEF4EE'],
    shadow: ['#030203', '#080409', '#0D0811', '#140F18'],
    iron: ['#030203', '#08060A', '#0F0C11', '#161419', '#1F1D21', '#29282A', '#363634', '#474A45', '#5F675F', '#86928A'],
    wood: ['#050304', '#0B0708', '#120D0D', '#1A1412', '#231B17', '#2E241D', '#3B2F25', '#4A3D2F', '#5B4C3A', '#6E5E48'],
    gold: ['#0C0705', '#1E1309', '#3D2A0E', '#5F4116', '#8A5E1E', '#B98135', '#E3A445', '#F2CB8A', '#FFF1C4', '#FFFBEA'],
    warm: ['#030203', '#0D0807', '#1A100B', '#2A1A10', '#3D2715', '#55361A', '#73491F', '#98612A', '#C07F35', '#E3A445', '#F2CB8A', '#FFF1C4'],
    ...CARD,
  };
  const EMIT = ['glow', 'sky', 'gold'];
  const PALE = [200, 214, 206]; // the grate light, drawn over the picture
  const VIOLET = PX.hexRgb(CARD.item[3]); // an Item's light, likewise

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }
  /** A slow breath, out of step by `phase`: the fungus glows up and down over several seconds. */
  const breathe = (phase, depth = 0.3, speed = 0.8) => (t) => 1 + depth * (0.7 * Math.sin(t * speed + phase) + 0.3 * Math.sin(t * speed * 2.3 + phase * 1.7));
  function dot(p, x, y, ramp, v, z) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    const i = y * p.w + x; p.r[i] = p.ri(ramp); p.v[i] = v; p.z[i] = z;
  }
  /** Value added inside a shape now, or kept as a field weighed by k(t) every frame. */
  function field(p, shape, fn, k) {
    if (!k) { p.shade(shape, fn); return; }
    const f = new Float32Array(p.w * p.h);
    p.each(shape, (x, y, i) => { f[i] = fn(x, y, i); });
    p.fields.push({ f, k });
  }
  const dome = (cx, by, rx, ry, n = 12) => {
    const pts = [];
    for (let i = 0; i <= n; i += 1) { const a = Math.PI * (i / n); pts.push([cx - rx * Math.cos(a), by - ry * Math.sin(a)]); }
    return [pts];
  };

  /** Brick: small courses laid regular, a dark joint, the top of each brick catching light. */
  function bricks(p, shape, o) {
    p.masonry(shape, { bw: o.bw ?? 8, bh: o.bh ?? 4, oy: o.oy ?? 0, joint: -1.3, top: o.top ?? 0.45, left: 0.15, vary: o.vary ?? 0.9, chip: o.chip ?? 0.07, seed: o.seed, z: o.z ?? 1, irregular: false });
  }
  /** Damp running down the wall from a joint: a dark streak with a lighter edge. */
  function stain(p, x, y0, y1, w) {
    p.shade(C.rect(x, y0, w, y1 - y0), (px, py) => (px - x < w * 0.6 ? -0.9 : 0.35) * (1 - (py - y0) / (y1 - y0)), 1);
  }

  /**
   * A brick arch round an opening: two rings of headers whose joints run to
   * the centre, the jambs coursed into the wall below the spring.
   */
  function brickArch(p, cx, top, hw, bottom, o) {
    const th = o.th; const bh = o.bh ?? 4; const z = o.z ?? 3; const spring = top + hw;
    const ring = C.join(C.arch(cx, top - th, hw + th, bottom), C.arch(cx, top, hw, bottom + 1));
    p.fill(ring, o.ramp || 'brick', o.v ?? 2.2, z);
    p.shade(ring, (x, y) => {
      const X = x + 0.5 - cx; const Y = y + 0.5;
      if (Y > spring) {
        const c = Math.floor((Y - spring) / bh); const ly = (Y - spring) - c * bh;
        const ax = Math.abs(X) - hw;
        if (ly < 1 || Math.abs(ax - (c % 2 ? th * 0.62 : th * 0.36)) < 0.5) return -1.3;
        return (hash(c, X > 0 ? 1 : 0, o.seed) - 0.5) * 0.8 + (ly < 2 ? 0.45 : 0) + (ax < 1 ? 0.5 : 0);
      }
      const rr = Math.hypot(X, spring - Y); const a = Math.atan2(spring - Y, X);
      const k = rr - hw < th / 2 ? 0 : 1;
      const rm = hw + th * (k ? 0.75 : 0.25);
      const n = Math.max(6, Math.round((Math.PI * rm) / (o.hb ?? 3.4)));
      const seg = (a / Math.PI) * n + (k ? 0.5 : 0); const si = Math.floor(seg);
      if ((seg - si) * ((Math.PI * rm) / n) < 1) return -1.3;
      if (Math.abs(rr - (hw + th / 2)) < 0.5) return -1.3;
      return (hash(si, k, o.seed) - 0.5) * 0.9 + (rr > hw + th - 1.2 ? 0.45 : 0) + (rr < hw + 1 ? 0.5 : 0);
    }, z);
  }

  /* ---------- a tunnel, traced ---------- */
  const FLOOR = 1; const WALL = 2; const VAULT = 3; const LEDGE = 4; const KERB = 5;
  /**
   * A barrel vault running away from its arched mouth. Each pixel of the
   * mouth is traced to the surface it shows (floor, a wall, the vault, a
   * raised ledge along the left wall and its kerb), how deep that is (t: 1 at
   * the mouth, growing toward the vanishing point) and where along the
   * surface (s, in mouth pixels), so courses run to the vanishing point and
   * joints close up with distance.
   */
  function tracer(g) {
    const { cx, hw, top, floor, vy } = g;
    const spring = top + hw; const wallH = floor - spring;
    const lw = g.ledge ? g.ledge.w : 0; const lh = g.ledge ? g.ledge.h : 0;
    const out = { surf: 0, t: 0, s: 0, r: 0 };
    return (x, y) => {
      const px = x + 0.5 - cx; const py = y + 0.5 - vy;
      let best = Infinity; let surf = 0; let s = 0;
      if (py > 0) {
        const t = (floor - vy) / py; const hx = px * t;
        if (hx >= -hw + lw && hx <= hw) { best = t; surf = FLOOR; s = hx; }
        if (lw) {
          const t2 = (floor - lh - vy) / py; const hx2 = px * t2;
          if (hx2 >= -hw && hx2 < -hw + lw && t2 < best) { best = t2; surf = LEDGE; s = hx2; }
        }
      }
      if (lw && px < 0) {
        const t = (-hw + lw) / px; const hy = vy + py * t;
        if (hy >= floor - lh && hy <= floor && t < best) { best = t; surf = KERB; s = hy - (floor - lh); }
      }
      if (px !== 0) {
        const t = (px > 0 ? hw : -hw) / px; const hy = vy + py * t;
        if (hy >= spring && hy <= floor && t < best) { best = t; surf = WALL; s = px > 0 ? wallH + Math.PI * hw + (hy - spring) : floor - hy; }
      }
      const oy = vy - spring; const A = px * px + py * py;
      if (A > 0) {
        const B = 2 * oy * py; const D = B * B - 4 * A * (oy * oy - hw * hw);
        if (D >= 0) {
          const t = (-B + Math.sqrt(D)) / (2 * A); const hy = vy + py * t;
          if (hy <= spring && t < best) { best = t; surf = VAULT; s = wallH + Math.atan2(spring - hy, -px * t) * hw; }
        }
      }
      out.surf = surf; out.t = best; out.s = s; out.r = Math.sqrt(A);
      return out;
    };
  }

  /**
   * Paint a tunnel into its mouth, lit from its far end: brick courses on the
   * vault and walls, paving (or black water) on the floor with the far light
   * running wet down its middle, and the far end itself glowing.
   */
  function tunnel(p, g) {
    const tr = tracer(g);
    const tf = 1 + g.zf; const hwf = g.hw / tf;
    const farFloor = g.vy + (g.floor - g.vy) / tf; const farTop = g.vy + (g.top - g.vy) / tf;
    const fcy = lerp(farTop, farFloor, g.farMid ?? 0.62);
    const rB = p.ri(g.ramp || 'brick'); const rF = p.ri(g.farRamp || 'glow');
    const rW = p.ri(g.floorRamp || 'wet'); const rM = p.ri('moss'); const rWa = p.ri('water');
    const bh = g.bh ?? 3.2; const bl = g.bl ?? 0.42; const fl = g.fl ?? 0.3; const fw = g.fw ?? 7;
    const far = g.far ?? 1; const reach = g.reach ?? 1.2; const seed = g.seed ?? 1;
    const L = g.light ?? 7; const base = g.base ?? 1.8; const amb = g.amb ?? 0.22;
    const zl = g.z ?? 2;
    p.each(C.arch(g.cx, g.top, g.hw, g.floor), (x, y, i) => {
      const T = tr(x, y);
      p.z[i] = zl;
      if (!T.surf || T.t >= tf) {
        const d = Math.min(1, Math.hypot((x + 0.5 - g.cx) / hwf, (y + 0.5 - fcy) / (hwf * 1.7)));
        p.r[i] = rF; p.v[i] = (g.farIn ?? 11.4) * Math.min(1, far + 0.1) - (g.farFall ?? 2.6) * d;
        return;
      }
      const z = T.t - 1; const ppx = T.t; const dz = T.t / Math.max(0.5, T.r);
      const lit = far * L * (amb + (1 - amb) / (1 + ((g.zf - z) / reach) ** 2));
      let v; let r = rB;
      if (T.surf === WALL || T.surf === VAULT) {
        const a = clamp(bh / ppx - 1.3, 0, 1);
        const cs = T.s / bh; const ci = Math.floor(cs);
        const zz = z / bl + (ci & 1) * 0.5; const zi = Math.floor(zz);
        v = base + lit;
        if ((cs - ci) * bh < ppx || (zz - zi) * bl < dz) { v -= 1.3 * a; if (g.joints && a > 0.5) g.joints[i] = 1; }
        else v += (hash(ci, zi, seed) - 0.5) * 0.9 * a + ((cs - ci) * bh < 2 * ppx ? 0.35 * a : 0);
      } else if (T.surf === KERB) {
        v = base + lit * 0.45 - 0.4 + (T.s < ppx ? 2.2 + lit * 0.4 : 0);
      } else if (T.surf === FLOOR && g.water) {
        r = rWa; p.z[i] = g.waterZ ?? zl;
        v = (g.waterBase ?? 1) + lit * 0.12 + (hash(Math.floor(x / 3), y, seed + 9) < 0.16 ? 0.6 : 0);
      } else {
        const side = Math.abs(T.s) / g.hw;
        const zz = z / fl; const zi = Math.floor(zz);
        const ss = T.s / fw + (zi & 1) * 0.5; const si = Math.floor(ss);
        const a = clamp(fl / dz / 2 - 0.6, 0, 1);
        r = rW;
        v = (g.fbase ?? 1.6) + lit * 0.8 + (T.surf === LEDGE ? 0.6 : 0);
        if (g.path && side > g.path) { r = rM; v = 1.4 + lit * 0.7 - (side - g.path) * 1.6; } else {
          if ((zz - zi) * fl < dz || (ss - si) * fw < ppx) v -= 1.2 * a;
          else v += (hash(si, zi, seed + 5) - 0.5) * 0.7 * a;
          if (T.surf === FLOOR) v += (g.spec ?? 3) * far * Math.exp(-((T.s / (g.hw * 0.28)) ** 2)) * (z / g.zf) ** 1.2;
        }
      }
      p.r[i] = r; p.v[i] = v;
    });
    const at = (z, a, h = 0) => { const t = 1 + z; return [g.cx + a / t, g.vy + (g.floor - h - g.vy) / t]; };
    return { at, tf, hwf, farFloor, farTop, fcy, tr };
  }

  /* ---------- what grew ---------- */

  /**
   * A cluster of glowing mushrooms standing on (x, y), `s` tall: domed caps on
   * pale stems, tallest in the middle, dark gills under each cap. The caps
   * are on layer zc; their light falls on what is behind and below, kept as
   * a slow breath `k` so clusters pulse out of step.
   */
  function shrooms(p, x, y, s, seed, o = {}) {
    const r = rng(seed);
    const n = o.n ?? clamp(Math.round(s / 2.6), 2, 6);
    const zc = o.z ?? 7;
    const caps = [];
    for (let i = 0; i < n; i += 1) {
      const f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const tall = 1 - Math.abs(f) * 0.6; const big = clamp((s - 7) / 8, 0, 1); // small clusters are stubbier
      const h = Math.max(2, s * tall * (lerp(0.34, 0.5, big) + r() * 0.3));
      const cw = Math.max(1.5, s * (lerp(0.32, 0.24, big) + r() * 0.1) * (0.65 + tall * 0.35));
      caps.push([x + f * s * 0.62 + (r() - 0.5) * s * 0.18, h, cw]);
    }
    // Buttons: small caps at the foot of the cluster.
    for (let i = 0; i < (s > 6 ? 2 : 0); i += 1) caps.push([x + (r() - 0.5) * s * 1.5, Math.max(1.5, s * 0.16), Math.max(1.2, s * 0.12)]);
    caps.sort((a, b) => b[1] - a[1]);
    for (const [cx, h, cw] of caps) {
      const top = Math.round(y - h); const ry = Math.max(1.4, cw * 0.82);
      const sw = cw > 3.2 ? 2 : 1;
      p.fill(C.rect(Math.round(cx) - (sw >> 1), top, sw, y - top + 0.5), 'cap', (px, py) => 3.4 + 2.6 * (1 - (py - top) / h) + (px < cx ? 0.5 : 0), zc);
      p.fill(dome(cx, top + 0.5, cw, ry), 'cap', (px, py) => {
        const e = Math.hypot((px + 0.5 - cx + cw * 0.3) / cw, (top + 0.5 - ry * 0.7 - py - 0.5) / ry); // the light up and to the left of the crown
        return (o.v ?? 9.4) + 1.8 * (1 - Math.min(1, e)) - (py >= top ? 1.4 : 0);
      }, zc);
      p.fill(C.rect(cx - cw + 1, top + 1, cw * 2 - 2, 1), 'cap', 4, zc);
    }
    const L = o.light;
    if (L) {
      for (const [z0, z1] of L.zs || [[L.zMin ?? 1, L.zMax ?? zc - 1]]) {
        p.light(x, y - s * 0.4, L.r, L.s, o.k || null, { zMin: z0, zMax: z1, sy: L.sy ?? 0.85, hard: L.hard });
        if (L.soft) p.light(x, y - s * 0.4, L.r * 2, L.soft, o.k || null, { zMin: z0, zMax: z1, sy: L.sy ?? 0.85 });
      }
      if (o.k) p.light(x, y - s * 0.5, s * 1.6, 1.3, o.k, { zMin: zc, zMax: zc });
    }
    if (o.wet) {
      // On a wet floor: the cluster upside down in it, broken into level dashes.
      const d = s * 0.9;
      field(p, C.rect(x - s * 0.9, y + 1, s * 1.8, d), (px, py, i) => {
        if (p.z[i] > 2 || p.emit[p.r[i]]) return 0;
        if (hash(py, 1, seed) < 0.3) return 0;
        return o.wet * (1 - (py - y) / d) * Math.max(0, 1 - Math.abs(px + 0.5 - x) / (s * 0.9));
      }, o.k);
    }
  }

  /**
   * Bracket fungus on a wall: half-moon shelves stacked like shingles, seen
   * from below: the glowing underside faces you, brightest at the rim, dark
   * where it meets the wall, and its light falls on the wall below.
   */
  function brackets(p, x, y, s, seed, o = {}) {
    const r = rng(seed); const n = o.n ?? clamp(Math.round(s / 3.4), 2, 4); const zc = o.z ?? 7;
    const shelves = [];
    for (let i = 0; i < n; i += 1) {
      const f = i / Math.max(1, n - 1);
      const w = Math.max(2, s * (0.3 + r() * 0.18) * (1 - f * 0.25));
      const side = i % 2 ? 1 : -1;
      shelves.push([x + side * s * (0.1 + r() * 0.25) + (o.lean ?? 0.3) * (f - 0.5) * s * 0.8, Math.round(y - f * s * 0.8), w]);
    }
    shelves.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy, w] of shelves) {
      // A fan hanging from its top edge: dark against the wall, banded as it grew, its curved rim bright.
      const ry = Math.max(2, w * 0.8);
      const fan = [[cx - w, cy]];
      for (let k = 1; k < 12; k += 1) { const a = Math.PI * (k / 12); fan.push([cx - w * Math.cos(a), cy + ry * Math.sin(a)]); }
      fan.push([cx + w, cy]);
      p.fill([fan], 'cap', (px, py) => {
        const e = Math.hypot((px + 0.5 - cx) / w, (py + 0.5 - cy) / ry);
        if (e > 0.76) return (o.v ?? 10) - (Math.abs(px + 0.5 - cx) / w) * 1.4;
        return 4.6 + e * 3 + (Math.floor(e * 3.2) % 2 ? 0.8 : 0);
      }, zc);
    }
    const L = o.light;
    if (L) {
      for (const [z0, z1] of L.zs || [[L.zMin ?? 1, L.zMax ?? zc - 1]]) {
        p.light(x, y + s * 0.2, L.r, L.s, o.k || null, { zMin: z0, zMax: z1, sy: L.sy ?? 0.9, hard: L.hard });
        if (L.soft) p.light(x, y + s * 0.15, L.r * 2, L.soft, o.k || null, { zMin: z0, zMax: z1, sy: L.sy ?? 0.9 });
      }
      if (o.k) p.light(x, y - s * 0.4, s * 1.5, 1.3, o.k, { zMin: zc, zMax: zc });
    }
  }

  /** Which pixels of a just-laid wall are mortar: darker than any brick face. */
  function jointMask(p, thr, ramp = 'brick') {
    const m = new Uint8Array(p.w * p.h); const rb = p.ri(ramp);
    for (let i = 0; i < m.length; i += 1) if (p.r[i] === rb && p.v[i] < thr) m[i] = 1;
    return m;
  }
  /**
   * Fungus in the mortar: a thread that creeps along the joints from a root
   * low on the wall, mostly sideways and up, now and then forking; brightest
   * at the root and fading as it climbs. A small knot of glow at the root.
   */
  function threads(p, mask, x0, y0, len, seed, o = {}) {
    const r = rng(seed); const rc = p.ri('cap'); const zl = o.z ?? 1; const W = p.w; const H = p.h;
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] && p.z[y * W + x] === zl;
    let sx = -1; let sy = -1;
    for (let rad = 0; rad < 6 && sx < 0; rad += 1) {
      for (let dy = -rad; dy <= rad && sx < 0; dy += 1) for (let dx = -rad; dx <= rad; dx += 1) if (ok(Math.round(x0) + dx, Math.round(y0) + dy)) { sx = Math.round(x0) + dx; sy = Math.round(y0) + dy; break; }
    }
    if (sx < 0) return;
    const seen = new Set();
    const v0 = o.v ?? 6;
    const walk = (x, y, n, vs, depth) => {
      for (let i = 0; i < n; i += 1) {
        const idx = y * W + x; seen.add(idx);
        if (r() > 0.2 + 0.5 * (i / n)) { p.r[idx] = rc; p.v[idx] = 1 + vs * (1 - i / n) ** 1.8; } // dotted, thinning as it climbs
        const opts = [[0, -1, 3.2], [0, 1, 0.2], [-1, 0, 1.2], [1, 0, 1.2]].filter(([dx, dy]) => ok(x + dx, y + dy) && !seen.has((y + dy) * W + x + dx));
        if (!opts.length) return;
        let pick = r() * opts.reduce((a, q) => a + q[2], 0); let c = opts[0];
        for (const q of opts) { pick -= q[2]; if (pick <= 0) { c = q; break; } }
        x += c[0]; y += c[1];
        if (depth < 1 && r() < 0.05) walk(x, y, Math.floor((n - i) * 0.5), vs * (1 - i / n) * 0.8, depth + 1);
      }
    };
    walk(sx, sy, len, v0, 0);
    // The knot it grows from: a few brighter joint pixels round the root.
    for (let k = 0; k < (o.knot ?? 4); k += 1) {
      const x = sx + Math.round((r() - 0.5) * 4); const y = sy + Math.round((r() - 0.3) * 3);
      if (ok(x, y)) { const i = y * W + x; p.r[i] = rc; p.v[i] = 1.2 + v0 * 1.15; }
    }
  }
  /**
   * A rim of light on a dark figure, one pixel deep and only on the side the
   * light comes from (dirs: neighbour offsets to look toward), so the figure
   * stays dark. bright: [[ramp, minV], ...] counts as light behind it.
   */
  function rimFrom(p, z, bright, toRamp, v, dirs = [[-1, 0], [0, -1]]) {
    const tests = bright.map(([n, m]) => [p.ri(n), m]); const to = p.ri(toRamp);
    const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        for (const [dx, dy] of dirs) {
          const j = i + dy * p.w + dx;
          if (p.z[j] === z) continue;
          if (tests.some(([ri, m]) => p.r[j] === ri && p.v[j] >= m)) { hit.push(i); break; }
        }
      }
    }
    for (const i of hit) { p.r[i] = to; p.v[i] = v; }
  }
  /** The light of a patch of glowing fungus, kept as a breath `k`, over chosen layers. */
  function glowAt(p, x, y, r, s, k, zs, o = {}) {
    for (const [z0, z1] of zs) {
      p.light(x, y, r, s, k || null, { zMin: z0, zMax: z1, sy: o.sy ?? 0.9, hard: true });
      if (o.soft) p.light(x, y, r * 2, o.soft, k || null, { zMin: z0, zMax: z1, sy: o.sy ?? 0.9 });
    }
  }

  /* ---------- light from the streets above ---------- */

  /** A grate seen from below: an iron frame, the sky's grey through the slots. */
  function grate(p, x, y, w, h, z, slots = 4) {
    p.fill(C.rect(Math.round(x - w / 2) - 1, y - 1, Math.round(w) + 2, h + 2), 'iron', 1.4, z);
    for (let k = 0; k < slots; k += 1) p.fill(C.rect(Math.round(x - w / 2) + k * 2, y, 1, h), 'sky', k === 0 || k === slots - 1 ? 2.4 : 3.2, z);
  }
  /**
   * The shaft from a grate, over the snapped picture: a slanting column of
   * pale light in a few dithered steps, brightest at the top, striped by the
   * bars. (The pool it makes on the ground is a light in the painter.)
   */
  function beam(img, x0, y0, w0, x1, y1, w1, a, bars = 0, col = PALE, rise = false, fall = 0.55) {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(img.height - 1, Math.ceil(y1)); y += 1) {
      const f = clamp((y + 0.5 - y0) / (y1 - y0), 0, 1);
      const c = lerp(x0, x1, f); const hw = lerp(w0, w1, f);
      for (let x = Math.floor(c - hw); x <= Math.ceil(c + hw); x += 1) {
        const l = (x + 0.5 - c) / hw;
        if (Math.abs(l) >= 1) continue;
        let k = clamp((1 - Math.abs(l)) * 2.2, 0, 1) * (rise ? f : 1 - fall * f);
        if (bars && (((l + 1) * bars * 0.5) % 1) < 0.26) k *= 0.3;
        const step = Math.floor(k * 4 + BAYER[(y & 3) * 4 + (x & 3)] - 0.25) / 4;
        if (step > 0) put(img, x, y, col, step * a);
      }
    }
  }

  /**
   * A back's grate shaft over the picture: a narrow beam, brightest under the
   * grate and fading as it falls, dithered and see-through; dust motes hang in
   * it and one drip catches the light. (Its pool is a light in the painter.)
   */
  function shaftOver(img, x0, y0, x1, y1, u, seed, a = 0.5, wide = 1) {
    beam(img, x0, y0, 1.3 * u * wide, x1, y1, 3 * u * wide, a, 2, PALE, false, 0.85);
    const r = rng(seed);
    for (let k = 0; k < 6; k += 1) {
      const f = 0.15 + r() * 0.8; const hw = lerp(1.3, 3, f) * u;
      put(img, lerp(x0, x1, f) + (r() - 0.5) * hw * 1.4, lerp(y0, y1, f), '#EEF4EE', 0.9 - f * 0.45);
    }
    const dx = lerp(x0, x1, 0.62); const dy = lerp(y0, y1, 0.62);
    put(img, dx, dy, '#EEF4EE'); put(img, dx, dy - 1, '#8C9A93', 0.6);
  }

  /**
   * The Item: an iron-bound chest, its lid ajar and the card's light in the
   * gap, lighting the lid's underside. Returns where the light leaves it, for
   * the plume drawn over the picture.
   */
  function chest(p, cx, fy, s, ramp, z) {
    const w = s * 0.55; const bh = s * 0.4; const top = fy - bh;
    p.fill(C.rect(cx - w, top, w * 2, bh), 'wood', (x) => 3 + ((Math.round(x - cx + 40) % 3) === 0 ? -0.9 : 0) + (x < cx ? 0.4 : -0.2), z);
    for (const x of [cx - w, cx + w - 1.5]) p.fill(C.rect(x, top, 1.5, bh), 'iron', 4.6, z + 1);
    p.fill(C.rect(cx - w, top, w * 2, 1), 'iron', 5, z + 1);
    const gap = Math.max(1.5, s * 0.1);
    p.fill(C.rect(cx - w + 1, top - gap, w * 2 - 2, gap), ramp, 4, z + 1);
    const lb = top - gap; const lt = lb - s * 0.26;
    p.fill(C.poly([[cx - w - 0.5, lb], [cx - w * 0.82, lt], [cx + w * 0.82, lt], [cx + w + 0.5, lb]]), 'wood', (x, y) => 3.4 - (lb - y) * 0.15, z);
    p.fill(C.rect(cx - w, lb - 1, w * 2, 1), ramp, 2.6, z + 1);
    p.fill(C.rect(cx - 1, top + bh * 0.25, 2, bh * 0.35), ramp, 3, z + 1);
    return { x: cx, y: lb, w };
  }

  /* ---------- water ---------- */

  /**
   * A light's reflection on still black water, broken by ripples: level
   * dashes in a column under it, swaying a little row by row, thinning and
   * fading away from the light.
   */
  function refl(p, x, y0, y1, w0, w1, s, seed, k, o = {}) {
    const rw = p.ri('water');
    field(p, C.rect(x - w1 * 1.8, y0, w1 * 3.6, y1 - y0), (px, py, i) => {
      if (p.r[i] !== rw) return 0;
      const f = (py + 0.5 - y0) / Math.max(1, y1 - y0);
      const sway = (hash(py, 3, seed) - 0.5) * lerp(w0, w1, f) * 0.8;
      const hw = lerp(w0, w1, f) * (0.65 + hash(py, 4, seed) * 0.6);
      const d = Math.abs(px + 0.5 - x - sway) / hw;
      if (d > 1) return 0;
      if (hash(py, 5, seed) < (o.gaps ?? 0.26) + f * 0.22) return 0;
      const dash = hash(Math.floor((px + hash(py, 6, seed) * 9) / (2 + f * 3)), py, seed + 7) < 0.22 ? 0.35 : 1;
      return s * (1 - f) ** (o.fall ?? 0.8) * (1 - d * d) * dash;
    }, k);
  }
  /**
   * Still water in a tunnel as a mirror. A column of a receding wall is all
   * one depth, so its reflection is the same column flipped about the
   * waterline there: each water pixel takes the wall above it, darker, its
   * rows broken by ripples and nudged sideways.
   */
  function mirror(p, g, o = {}) {
    const rw = p.ri('water'); const lw = g.ledge ? g.ledge.w : 0;
    p.each(C.arch(g.cx, g.top, g.hw, g.floor), (x, y, i) => {
      if (p.r[i] !== rw) return;
      const dx = x + 0.5 - g.cx;
      const yj = g.vy + ((g.floor - g.vy) * Math.abs(dx)) / (dx < 0 ? g.hw - lw : g.hw);
      const ym = Math.round(2 * yj - y - 1);
      if (ym < 0 || ym >= y || hash(y, 9, o.seed ?? 1) < 0.28) return;
      const sx = clamp(x + (hash(y, 10, o.seed ?? 1) < 0.35 ? (dx < 0 ? -1 : 1) : 0), 0, p.w - 1);
      const j = ym * p.w + sx;
      if (p.r[j] === rw) return;
      p.v[i] = Math.max(p.v[i], 1 + (p.v[j] - 1.6) * (o.k ?? 0.6));
    });
  }
  /**
   * Open water in front of a wall: the wall stands at one depth, so its
   * reflection is the picture flipped about the waterline, darker, its rows
   * broken by ripples and nudged sideways.
   */
  function flipMirror(p, x0, x1, yw, y1, seed, k = 0.5) {
    const rw = p.ri('water');
    for (let y = Math.ceil(yw); y < Math.min(p.h, y1); y += 1) {
      if (hash(y, 9, seed) < 0.3) continue;
      const ym = Math.round(2 * yw - y - 1); if (ym < 0) break;
      const nudge = hash(y, 10, seed) < 0.4 ? (hash(y, 11, seed) < 0.5 ? -1 : 1) : 0;
      for (let x = Math.max(0, x0); x < Math.min(p.w, x1); x += 1) {
        const i = y * p.w + x; if (p.r[i] !== rw) continue;
        const j = ym * p.w + clamp(x + nudge, 0, p.w - 1); if (p.r[j] === rw) continue;
        p.v[i] = Math.max(p.v[i], 1 + (p.v[j] - 1.6) * k * (1 - (y - yw) / (y1 - yw) * 0.5));
      }
    }
  }
  /**
   * Ripple lines catching a light on the water: level dashes, lengthening
   * toward you, brightest in a column under the light and spreading wider as
   * they come closer; a few rows dark between them.
   */
  function glints(p, x, y0, y1, w0, w1, s, seed, o = {}) {
    const rw = p.ri('water');
    p.shade(C.rect(0, y0, p.w, y1 - y0), (px, py, i) => {
      if (p.r[i] !== rw || hash(py, 3, seed) < (o.gaps ?? 0.22)) return 0;
      const f = clamp((py + 0.5 - y0) / (y1 - y0), 0, 1);
      const len = 2 + f * 6;
      if (hash(Math.floor((px + hash(py, 1, seed) * 30) / len), py, seed + 2) > (o.density ?? 0.4)) return 0;
      const g = Math.exp(-(((px + 0.5 - x) / lerp(w0, w1, f)) ** 2));
      return s * ((o.floor ?? 0.1) + (1 - (o.floor ?? 0.1)) * g) * (1 - f * (o.fall ?? 0.45));
    });
  }
  /** The water's own surface: short level ripple lines catching a little light. */
  function ripples(p, shape, seed, amp = 0.55) {
    const rw = p.ri('water');
    p.shade(shape, (x, y, i) => {
      if (p.r[i] !== rw) return 0;
      const len = 3 + hash(y, 0, seed) * 6;
      return hash(Math.floor((x + hash(y, 1, seed) * 20) / len), y, seed + 2) < 0.16 ? amp : 0;
    });
  }

  /* ================= A: the glowing vaults ================= */

  /** One vault of the run: its tunnel lit from the far end and its brick ring. */
  function vault(p, g) {
    const T = tunnel(p, g);
    brickArch(p, g.cx, g.top, g.hw, g.floor, { th: g.th, hb: g.hb ?? 3.2, bh: g.bh2 ?? 3, seed: g.seed + 40, v: g.ringV ?? 2.2 });
    return T;
  }

  const A = {
    job: 5, setting: 'undercity', key: 'A', id: 'undercity-a',
    name: 'Undercity', title: 'The glowing vaults',
    pitch: 'Under the streets, a run of brick vaults the city sealed and forgot. Something grew in the dark: mushrooms that glow, lighting a path from vault to vault.',
    notes: [
      ['Light', 'The fungus is the only lamp: teal pools on brown-grey brick, breathing slowly, and one cold shaft from a street grate far above. The vault ahead is lit from its far end.'],
      ['Detail', 'Brick vaults with two rings of headers, a paved path between mushroom clusters, the grate’s bars striping its shaft, wet brick holding the glow upside down, drips catching the light.'],
      ['Vista', 'The vaults run the width of the board, dark mouths between piers lit by mushroom clusters that breathe out of step. The card stands in the central vault, against its light: the vault caves in behind a bent grate for an Obstacle, and fills with gold for a Clear Path.'],
      ['World', 'Wet brick floor under the table, glow pools from the clusters at the edges, drips falling through, small eyes low in the dark. Black by the hand.'],
    ],
    palette: ['#030203', '#191416', '#2C2624', '#3D3C35', '#58776A', '#235347', '#47977F', '#A8DCC9', '#C3CFC8'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 134;
      const gx = W / 2; const floor = Math.round(104 * u);
      const hw = 19 * u; const top = 30 * u;
      p.fill(C.rect(0, 0, W, floor), 'brick', 1.8, 1);
      bricks(p, C.rect(0, 0, W, floor), { bw: 8, bh: 4, seed: 3 });
      stain(p, Math.round(W * 0.12), 0, 50 * u, 2); stain(p, Math.round(W * 0.86), 8 * u, 64 * u, 2);
      p.fill(C.rect(0, floor, W, H - floor), 'wet', 1.8, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: gx, vy: floor - 30 * u, rows: 5, size: 0.55, d0: 30 * u, joint: -1.2, top: 0.4, left: 0.2, vary: 0.7, chip: 0.04, seed: 4, z: 1 });
      const T = vault(p, { cx: gx, hw, top, floor, vy: 70 * u, zf: 3.4, th: 5 * u, seed: 2, path: 0.5, ringV: 2.6, amb: 0.3, spec: 4, farFall: 5.5, farMid: 0.72, reach: 0.9 });
      // The light out of the vault, on the floor in front and the ring's inner edge.
      p.light(gx, floor + 1, hw * 2, 5, null, { zMin: 1, zMax: 1, sy: 0.75, hard: true });
      p.light(gx, floor - 10 * u, hw * 1.5, 2.4, null, { zMin: 3, zMax: 3 });
      // The grate in the vault's left haunch, and the pool its shaft makes on the path, clear of the far light.
      const ga = -14 * u; const [gxp, gyp] = T.at(0.6, ga, floor - (top + hw - Math.sqrt(hw * hw - ga * ga)) - 1);
      const [sx1, sy1] = T.at(0.3, -9 * u, 0);
      p.light(sx1, sy1, 7 * u, 6.5, null, { zMin: 2, zMax: 2, sy: 0.4, hard: true });
      grate(p, gxp, Math.round(gyp), 5, 1, 2, 3);
      // Clusters along the path, both sides.
      for (const [z, side, s, seed] of [[0.15, -1, 14, 1], [0.5, 1, 12, 2], [1.1, -1, 11, 3], [1.6, 1, 10, 4], [2.0, -1, 9, 5]]) {
        const [x, y] = T.at(z, side * (hw - 3 * u), 0);
        const t = 1 + z;
        shrooms(p, x, y, (s / t) * u, seed, { z: 6, light: { r: (32 * u) / t, s: 6, hard: true, zMin: 2, zMax: 2 } });
      }
      // Outside: a cluster at the foot of the wall each side, mycelium climbing from it.
      shrooms(p, 10 * u, floor + 1, 14 * u, 7, { z: 6, light: { r: 32 * u, s: 6.5, hard: true, soft: 1.6, zMin: 1, zMax: 3 }, wet: 3.4 });
      shrooms(p, 87 * u, floor + 2, 10 * u, 8, { z: 6, light: { r: 24 * u, s: 5.5, hard: true, zMin: 1, zMax: 3 }, wet: 2.8 });
      vignette(p, W, H, 2.2);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img) {
          shaftOver(img, gxp, gyp + 1, sx1, sy1, u, 7);
          put(img, gx + 7 * u, top - 4 * u + 1, '#97BCAD');
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 100;
      const gx = W / 2; const floor = Math.round(84 * u);
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      let plume = null; // where an Item's light leaves its chest
      p.fill(C.rect(0, 0, W, floor), 'brick', 1.6, 1);
      bricks(p, C.rect(0, 0, W, floor), { bw: 7, bh: 3, seed: 5, top: 0.4 });
      p.fill(C.rect(0, floor, W, H - floor), 'wet', 1.6, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: gx, vy: floor - 30 * u, rows: 5, size: 0.55, d0: 30 * u, joint: -1.2, top: 0.4, left: 0.2, vary: 0.7, chip: 0.04, seed: 6, z: 1 });
      const pitch = 64 * u;
      // The side vaults: dark mouths, their far ends barely there.
      for (let k = 1; gx + k * pitch - 20 * u < W; k += 1) {
        for (const m of [-1, 1]) {
          const cx = gx + m * k * pitch;
          vault(p, { cx, hw: 15 * u, top: 30 * u, floor, vy: floor - 22 * u, zf: 3.6, th: 4 * u, seed: 10 + k * 2 + (m > 0 ? 1 : 0), far: 0.14, light: 6, path: 0.5, farIn: 7.4, ringV: 2 });
        }
      }
      // The central vault, lit.
      const g = { cx: gx, hw: 20 * u, top: 14 * u, floor, vy: floor - 30 * u, zf: 1.7, th: 5 * u, seed: 3, far: 1, path: 0.55, ringV: 2.6, amb: 0.35 };
      if (cat === 'obstacle') g.far = 0.35;
      if (cat === 'clear-path') { g.far = 1.1; g.ramp = 'warm'; g.floorRamp = 'warm'; g.farRamp = 'gold'; g.farIn = 9.6; g.path = 0; }
      const T = vault(p, g);
      p.light(gx, floor + 1, g.hw * 1.9, 5 * g.far, null, { zMin: 1, zMax: 1, sy: 0.4 });
      p.light(gx, floor - 12 * u, g.hw * 1.6, 2.4 * g.far, null, { zMin: 3, zMax: 3 });
      // The card, in the central vault.
      const [sx, sy] = T.at(0.3, 0, 0);
      if (cat === 'monster') {
        SUBJECT.monster(p, sx, sy, 38 * u, ramp, 4);
        rimFrom(p, 4, [['glow', 4], ['brick', 6]], 'cap', 4.4);
        p.tint(sx, sy - 38 * u * 0.9, 7 * u, hex, 0.45, breathe(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        SUBJECT.wanderer(p, sx - 3 * u, sy, 36 * u, 'shadow', 4, false);
        rimFrom(p, 4, [['glow', 4], ['brick', 6]], 'cap', 4.4);
        const lx = sx - 3 * u + 36 * u * 0.3; const ly = sy - 36 * u * 0.6;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 6);
        p.fill(C.rect(lx - 0.5, ly - 2, 2, 2), 'iron', 3, 6);
        p.tint(lx, ly + 2, 20 * u, hex, 0.5, breathe(0.9, 0.12, 2));
      } else if (cat === 'item') {
        plume = chest(p, sx, sy + 2 * u, 26 * u, ramp, 5);
        p.tint(sx, plume.y, 30 * u, hex, 0.55, breathe(2, 0.15, 1));
      } else if (cat === 'obstacle') {
        // The vault has come down: its far end dark, the old grate bent across the mouth, fallen brick heaped against it.
        const step = Math.max(4, Math.round(6 * u));
        p.each(C.arch(gx, g.top, g.hw, floor), (x, y, i) => {
          const k = Math.floor((x - gx + step * 40) / step);
          const bend = k % 3 === 1 ? Math.round(2.2 * u * Math.sin(((y - g.top) / (floor - g.top)) * Math.PI * 1.4)) : 0;
          const bx = (x - bend - gx + step * 40) % step;
          const cross = Math.abs(y - (g.top + g.hw * 0.9) - (x - gx) * 0.08) < 1 || Math.abs(y - (floor - 30 * u)) < 1;
          if (k % 5 === 2 && y > floor - 46 * u && y < floor - 36 * u) return; // a bar snapped
          if (bx >= 2 && !cross) return;
          p.r[i] = p.ri(ramp); p.z[i] = 4; p.v[i] = (cross ? 2.7 : 2.2) + (bx < 1 ? 0.4 : 0);
        });
        const heap = C.poly([[gx - 27 * u, floor + 1], [gx - 19 * u, floor - 16 * u], [gx - 8 * u, floor - 27 * u], [gx + 3 * u, floor - 24 * u], [gx + 12 * u, floor - 30 * u], [gx + 20 * u, floor - 15 * u], [gx + 28 * u, floor + 1]]);
        p.fill(heap, 'brick', 2.8, 5);
        p.cells(heap, { size: 3.6 * u, sx: 1.8, joint: 0.8, jointV: -1.5, vary: 1.1, bevel: 1, seed: 2, z: 5 });
        p.tint(gx, floor - 30 * u, 34 * u, hex, 0.45, breathe(0.5, 0.12, 0.6));
        shrooms(p, gx + 12 * u, floor - 29 * u, 6 * u, 77, { z: 7 });
        shrooms(p, gx - 17 * u, floor - 14 * u, 5 * u, 78, { z: 7 });
      } else if (cat === 'clear-path') {
        p.tint(gx, floor, 34 * u, CARD.path[2], 0.45, breathe(0.2, 0.08, 0.5));
      }
      // Clusters at the piers, breathing out of step; grate shafts at the outer piers.
      const piers = [];
      for (let k = 0; gx + (k + 0.5) * pitch < W + 20 * u; k += 1) piers.push(gx - (k + 0.5) * pitch, gx + (k + 0.5) * pitch);
      piers.forEach((x, i) => {
        const k = breathe(i * 1.9, 0.35, 0.7 + (i % 3) * 0.15);
        shrooms(p, x + (i % 2 ? 2 : -2) * u, floor + 1, (i < 2 ? 15 : 13) * u, 20 + i, { z: 7, light: { r: 36 * u, s: 7, hard: true, soft: 1.6, zs: [[1, 1], [3, 3], [5, 5]] }, k, wet: 3 });
      });
      const shafts = piers.filter((_, i) => i >= 2 && i % 4 < 2);
      for (const x of shafts) p.light(x + 4 * u, floor + 3 * u, 9 * u, 5, null, { zMin: 1, zMax: 1, sy: 0.35, hard: true });
      vignette(p, W, H, 1.8, 0.4);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img, t) {
          if (plume) beam(img, plume.x, plume.y - 20 * u, plume.w * 1.6, plume.x, plume.y, plume.w * 0.85, 0.72 + 0.12 * Math.sin(t * 1.3), 0, VIOLET, true);
          for (const x of shafts) beam(img, x - 6 * u, 0, 3 * u, x + 4 * u, floor + 3 * u, 6 * u, 0.34, 2);
          for (const q of particles('drip', Math.round(W / 30), [0, 0, W, floor], t, 9)) { put(img, q.x, q.y, '#97BCAD', 0.9); put(img, q.x, q.y - 1, '#2C2624', 0.7); }
          for (const q of particles('mote', Math.round(W / 14), [0, floor - 34 * u, W, 34 * u], t, 4)) put(img, q.x, q.y, q.big ? '#A8DCC9' : '#47977F', q.a * 0.7);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 250;
      p.fill(C.rect(0, 0, W, H), 'wet', 1.9, 1);
      p.floor(C.rect(0, 0, W, H), { vx: W / 2, vy: -90 * u, rows: 9, size: 0.5, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.2, vary: 0.8, chip: 0.04, seed: 9, z: 1 });
      const r = rng('undercity-a-world');
      // Puddles: black water holding a little of the glow, a lit far lip.
      for (let k = 0; k < 9; k += 1) {
        const x = r() * W; const y = 30 * u + r() * H * 0.6; const rx = (10 + r() * 22) * u; const ry = (2 + r() * 3) * u;
        p.fill(C.ellipse(x, y, rx, ry), 'water', (px, py) => 2.2 + (py < y - ry * 0.6 ? 1.2 : 0) + (hash(Math.floor(px / 4), py, k) < 0.2 ? 0.8 : 0), 1);
      }
      // The central vault's light, spilling down from behind the vista.
      p.light(W / 2, -24 * u, 180 * u, 3, breathe(0.4, 0.08, 0.5), { sx: 1.7 });
      // Clusters at the edges: glow pools on the wet brick.
      const spots = [[10 * u, 120 * u, 16, 0], [W - 12 * u, 96 * u, 15, 1], [9 * u, 192 * u, 15, 2], [W - 9 * u, 176 * u, 14, 3], [8 * u, 44 * u, 12, 4], [W - 8 * u, 40 * u, 12, 5]];
      for (const [x, y, s, i] of spots) {
        const k = breathe(i * 2.3, 0.35, 0.6 + i * 0.07);
        shrooms(p, x, y, s * u, 60 + i, { z: 7, light: { r: 40 * u, s: 5, hard: true, soft: 1.2, zMin: 1, zMax: 6, sy: 0.6 }, k, wet: 2.4 });
      }
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.42));
      return {
        p,
        over(img, t) {
          for (const q of particles('drip', 14, [20 * u, 0, W - 40 * u, H * 0.55], t, 31)) { put(img, q.x, q.y, '#58776A', 0.9); put(img, q.x, q.y - 1, '#221C1C', 0.8); }
          for (const [x, y, ph] of [[4 * u, 168 * u, 0.3], [W - 5 * u, 150 * u, 2.1], [52 * u, 246 * u, 4.4]]) {
            const open = Math.sin(t * 0.7 + ph) > -0.6 && Math.sin(t * 5.3 + ph * 3) < 0.94;
            if (open) { put(img, x, y, '#A93343', 0.8); put(img, x + 2, y, '#A93343', 0.8); }
          }
          for (const q of particles('mote', 18, [0, 30 * u, W, H * 0.7], t, 7)) {
            if (q.x > 34 * u && q.x < W - 34 * u) continue;
            put(img, q.x, q.y, q.big ? '#80C4AD' : '#377F69', q.a * 0.7);
          }
        },
      };
    },
  };

  /* ================= B: the drowned canal ================= */

  /**
   * A rotting rowboat, side on, bow to the left: the sheer rising to bow and
   * stern, planks following it, ribs showing where planks are gone, the far
   * gunwale's inside above the near one; the water holds it dark and broken.
   */
  function boatSide(p, cx, wl, L, o = {}) {
    const h = Math.max(4, L * 0.2); const z = o.z ?? 5;
    const sheer = (f) => wl - h * (0.95 + 0.42 * (2 * f - 1) ** 2 + (f < 0.5 ? 0.12 * (1 - 2 * f) : 0)); // f 0 bow .. 1 stern
    const pts = [];
    for (let k = 0; k <= 12; k += 1) { const f = k / 12; pts.push([cx - L / 2 + f * L, sheer(f)]); }
    pts.push([cx + L * 0.47, wl + 0.5], [cx - L * 0.36, wl + 0.5], [cx - L * 0.47, wl - h * 0.6]);
    const hull = C.poly(pts);
    p.fill(hull, 'wood', 3, z);
    // The far gunwale's inside, a dark strip above the near one.
    const inner = [];
    for (let k = 1; k <= 11; k += 1) { const f = k / 12; inner.push([cx - L / 2 + f * L, sheer(f) - 1.5]); }
    for (let k = 11; k >= 1; k -= 1) { const f = k / 12; inner.push([cx - L / 2 + f * L, sheer(f) + 0.5]); }
    p.fill(C.poly(inner), 'wood', 1.2, z);
    p.shade(hull, (x, y) => {
      const f = clamp((x - (cx - L / 2)) / L, 0, 1); const ly = y - sheer(f);
      let dv = Math.floor(ly / 2) % 2 ? -0.55 : 0.3;
      if (ly < 1.2) dv += 1.6;
      if (f > 0.42 && f < 0.6 && ly > 2.5) dv = (Math.round(x) % 3 === 0) ? 0.6 : -1.7; // planks gone, the ribs inside
      return dv + (1 - f) * 0.6;
    }, z);
    const rw = p.ri('water');
    p.shade(C.rect(cx - L * 0.5, wl + 1, L, h * 1.5), (x, y, i) => (p.r[i] === rw && hash(y, 2, 7) > 0.3 ? -0.9 : 0));
    if (o.rope) {
      const [rx, ry] = o.rope; const bx = cx - L * 0.47; const by = wl - h * 1.2;
      const n = Math.ceil(Math.hypot(rx - bx, ry - by));
      for (let k = 0; k <= n; k += 1) { const f = k / n; dot(p, lerp(bx, rx, f), lerp(by, ry, f) + Math.sin(f * Math.PI) * 3, 'wood', 4.4, z + 1); }
    }
    return { deck: wl - h * 0.7, h };
  }

  /** Something rising from the water: hunched shoulders, a long head trailing weed, a hand on the kerb; eyes in the card's colour. */
  function riser(p, cx, wl, s, ramp, z, kerb) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, wl + y * s]));
    p.fill(P([[-0.55, 0.05], [-0.5, -0.28], [-0.34, -0.48], [-0.16, -0.55], [-0.15, -0.76], [-0.08, -0.9], [0.06, -0.92], [0.14, -0.8], [0.15, -0.57], [0.32, -0.5], [0.5, -0.3], [0.56, 0.05]]), 'shadow', 0.3, z);
    p.fill(P([[0.38, -0.36], [0.6, -0.52], [0.72, -0.6], [0.8, -0.56], [0.66, -0.42], [0.5, -0.22]]), 'shadow', 0.3, z);
    if (kerb !== undefined) for (let k = 0; k < 3; k += 1) p.fill(C.rect(cx + s * (0.72 + k * 0.05), kerb - 1, 1, 3), 'shadow', 0.3, z);
    for (const [dx, len] of [[-0.12, 0.3], [-0.04, 0.42], [0.05, 0.36], [0.12, 0.24]]) p.fill(C.rect(cx + dx * s, wl - s * 0.86, 1, s * len), 'shadow', 0.6, z);
    const ey = Math.round(wl - s * 0.78);
    p.fill(C.rect(Math.round(cx - s * 0.07) - 1, ey, 2, 1), ramp, 4, z + 1);
    p.fill(C.rect(Math.round(cx + s * 0.05), ey, 2, 1), ramp, 4, z + 1);
  }

  const B = {
    job: 5, setting: 'undercity', key: 'B', id: 'undercity-b',
    name: 'Undercity', title: 'The drowned canal',
    pitch: 'The old sewer canal, flooded and still. Fungus glows along the tunnel walls, the black water gives it back in broken lines, and a rotten boat waits at the steps for whoever comes down.',
    notes: [
      ['Light', 'The tunnel’s far end glows teal and the black water carries that light toward you in a long, broken column. Fungus glows in the mortar of the walls; one grate lets in a cold shaft.'],
      ['Detail', 'A brick tunnel with a walkway along one wall, mycelium lighting the joints so the bricks stand out, a tide line, a rotting boat roped to a ring by the steps, the walls mirrored in the water and broken by ripples.'],
      ['Vista', 'The canal runs the width of the board: arches along a walkway, the water below holding every light upside down. The card rises out of the water, rides in the boat, or waits in the central arch: a shut flood door for an Obstacle, gold stairs for a Clear Path.'],
      ['World', 'Black water under the table, faint broken reflections and slow ripples, the walkway’s edges and fungus at the sides. Drips ring the surface.'],
    ],
    palette: ['#020203', '#080811', '#122822', '#191416', '#36302B', '#1E4F41', '#377F69', '#94D2BD', '#3B2F25'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 134;
      const gx = W / 2; const wl = Math.round(100 * u);
      const hw = 19 * u; const top = 30 * u; const vy = 86 * u; // a low eye, just over the water
      const lw = 8 * u; const lh = 3 * u; // the walkway along the left wall
      p.fill(C.rect(0, 0, W, wl), 'brick', 1.6, 1);
      bricks(p, C.rect(0, 0, W, wl), { bw: 8, bh: 4, seed: 21 });
      // The tide line: the brick darker and slimed below where the water once stood.
      p.shade(C.rect(0, 84 * u, W, wl - 84 * u), (x, y) => (y < 84 * u + 1 ? 0.9 : -0.6), 1);
      stain(p, Math.round(W * 0.1), 0, 70 * u, 2); stain(p, Math.round(W * 0.9), 0, 80 * u, 2);
      const joints = jointMask(p, 0.6);
      // Black water from your feet into the tunnel.
      p.fill(C.rect(0, wl, W, H - wl), 'water', 1.1, 0);
      ripples(p, C.rect(0, wl, W, H - wl), 3, 0.5);
      const tj = new Uint8Array(W * H);
      const tg = { cx: gx, hw, top, floor: wl, vy, zf: 4, seed: 4, water: true, ledge: { w: lw, h: lh }, light: 8, far: 1, farIn: 11.6, farFall: 6, farMid: 0.88, amb: 0.3, reach: 1.4, joints: tj, waterZ: 0 };
      const T = tunnel(p, tg);
      brickArch(p, gx, top, hw, wl, { th: 5 * u, hb: 3.4, bh: 4, seed: 9, v: 2.4 });
      p.light(gx, wl - 8 * u, hw * 1.5, 2, null, { zMin: 3, zMax: 3 });
      // The walkway carried out of the tunnel toward you, its kerb running to the vanishing point.
      const kTop = (y) => gx - ((hw - lw) * (y - vy)) / (wl - lh - vy);
      const kBot = (y) => gx - ((hw - lw) * (y - vy)) / (wl - vy);
      const yT0 = vy + (gx * (wl - lh - vy)) / (hw - lw); const yB0 = vy + (gx * (wl - vy)) / (hw - lw);
      const quay = C.poly([[0, wl - lh], [kTop(wl - lh), wl - lh], [0, yT0]]);
      p.fill(quay, 'wet', 2.2, 3);
      p.floor(quay, { vx: gx, vy, rows: 4, size: 0.6, d0: wl - lh - vy, joint: -1.2, top: 0.5, vary: 0.7, chip: 0.05, seed: 6, z: 3 });
      p.fill(C.poly([[kTop(wl - lh), wl - lh], [0, yT0], [0, yB0], [kBot(wl), wl]]), 'brick', (x, y) => 1.4 + (x >= kTop(y) - 1.2 ? 2.4 : 0) - ((Math.round(x) % 5) === 0 ? 0.8 : 0), 3);
      // Fungus in a few joints just over the water, fading up the wall; inside the tunnel too.
      const groups = [[[6, 97], [14, 96], [22, 97]], [[74, 98], [83, 97], [91, 98]]];
      groups.forEach((g, gi) => g.forEach(([x, y], k) => threads(p, joints, x * u, y * u, 18 + ((k * 7 + gi * 5) % 12), 200 + gi * 10 + k, { v: 3.6, knot: 3 })));
      glowAt(p, 14 * u, 95 * u, 20 * u, 4.4, null, [[1, 1], [3, 5]]);
      glowAt(p, 83 * u, 96 * u, 22 * u, 4.4, null, [[1, 1], [3, 5]]);
      for (const [z, side, seed] of [[0.12, 1, 1], [0.3, -1, 2]]) {
        const [x, y] = T.at(z, side * hw, (side < 0 ? lh + 2 * u : 3 * u));
        threads(p, tj, x, y, 12, 40 + seed, { z: 2, v: 3.4, knot: 2 });
        glowAt(p, x, y, (18 * u) / (1 + z), 4, null, [[2, 2]]);
      }
      // The grate in the right haunch; its pool on the water, clear of the far light.
      const ga = 13 * u; const [gxp, gyp] = T.at(0.4, ga, wl - (top + hw - Math.sqrt(hw * hw - ga * ga)) - 1);
      const [sx1, sy1] = T.at(0.12, 7 * u, 0);
      p.light(sx1, sy1, 8 * u, 7, null, { zMin: 0, zMax: 0, sy: 0.35, hard: true });
      p.light(sx1, sy1 - 6 * u, 12 * u, 2.4, null, { zMin: 2, zMax: 2, hard: true });
      grate(p, gxp, Math.round(gyp), 5, 1, 2, 3);
      // The water gives it all back: the tunnel walls, the wall over the canal, and the far light in ripple lines.
      mirror(p, tg, { seed: 6 });
      flipMirror(p, 0, W, wl, H, 7, 0.5);
      glints(p, gx, T.farFloor, H, T.hwf * 0.8, 22 * u, 7.5, 8, { density: 0.42, floor: 0.12, fall: 0.35 });
      // The boat, moored at the side: roped from its bow to a bollard on the walkway.
      const bl = { x: 10 * u, y: 118 * u };
      p.fill(C.rect(bl.x - 1.5, bl.y - 4 * u, 3, 4 * u), 'iron', 2.6, 4);
      p.fill(C.rect(bl.x - 2, bl.y - 4.5 * u, 4, 1.2), 'iron', 4.4, 4);
      boatSide(p, 42 * u, 121 * u, 38 * u, { rope: [bl.x + 1, bl.y - 3 * u] });
      p.light(46 * u, 108 * u, 26 * u, 3.4, null, { zMin: 4, zMax: 6, sy: 0.6 });
      p.backlit(5, 'water', 3.5, 'wood', 8); // the boat's edge against the lit water
      vignette(p, W, H, 2);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img) { shaftOver(img, gxp, gyp + 1, sx1, sy1, u, 9, 0.4, 1.7); },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 100;
      const gx = W / 2;
      const walk = Math.round(62 * u); const kerb = Math.round(66 * u); const wl = Math.round(72 * u);
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      let plume = null; // where an Item's light leaves its chest
      p.fill(C.rect(0, 0, W, walk), 'brick', 1.6, 1);
      bricks(p, C.rect(0, 0, W, walk), { bw: 7, bh: 3, seed: 25, top: 0.4 });
      p.shade(C.rect(0, walk - 9 * u, W, 9 * u), (x, y) => (y < walk - 9 * u + 1 ? 0.7 : -0.6), 1); // the tide line
      const joints = jointMask(p, 0.5);
      p.fill(C.rect(0, walk, W, kerb - walk), 'wet', 2.4, 1);
      p.fill(C.rect(0, walk, W, 1), 'wet', 3.4, 1);
      p.fill(C.rect(0, kerb, W, wl - kerb), 'brick', 1.6, 1);
      bricks(p, C.rect(0, kerb, W, wl - kerb), { bw: 6, bh: 3, seed: 26, oy: kerb });
      p.fill(C.rect(0, kerb, W, 1), 'brick', 3.4, 1);
      p.fill(C.rect(0, wl, W, H - wl), 'water', 1.1, 0);
      ripples(p, C.rect(0, wl, W, H - wl), 5, 0.6);
      const pitch = 70 * u;
      // Side arches along the walkway: passages into the dark.
      for (let k = 1; gx + k * pitch - 20 * u < W; k += 1) {
        for (const m of [-1, 1]) {
          const cx = gx + m * k * pitch;
          tunnel(p, { cx, hw: 14 * u, top: 26 * u, floor: walk, vy: walk - 18 * u, zf: 3.6, seed: 30 + k * 2 + (m > 0 ? 1 : 0), far: 0.14, light: 6, farIn: 7.4 });
          brickArch(p, cx, 26 * u, 14 * u, walk, { th: 4 * u, hb: 3.2, bh: 3, seed: 50 + k, v: 2 });
        }
      }
      // The central arch, lit from beyond.
      const g = { cx: gx, hw: 21 * u, top: 10 * u, floor: walk, vy: walk - 18 * u, zf: 1.8, seed: 7, far: 1, light: 7, amb: 0.35, spec: 3.4 };
      if (cat === 'obstacle') g.far = 0.35;
      if (cat === 'clear-path') { g.far = 1.1; g.ramp = 'warm'; g.floorRamp = 'warm'; g.farRamp = 'gold'; g.farIn = 9.6; }
      const T = tunnel(p, g);
      brickArch(p, gx, g.top, g.hw, walk, { th: 5 * u, hb: 3.2, bh: 3, seed: 8, v: 2.6 });
      p.light(gx, walk, g.hw * 1.7, 4.4 * g.far, null, { zMin: 1, zMax: 1, sy: 0.35 });
      p.light(gx, walk - 12 * u, g.hw * 1.5, 2.4 * g.far, null, { zMin: 3, zMax: 3 });
      if (cat === 'clear-path') {
        p.tint(gx, walk, 30 * u, CARD.path[2], 0.45, breathe(0.2, 0.08, 0.5));
        p.tint(gx, wl + 18 * u, 22 * u, CARD.path[2], 0.4, breathe(0.2, 0.08, 0.5));
      }
      refl(p, gx, wl + 8 * u, H, g.hw * 0.55, g.hw * 0.75, 8 * g.far, 3, null, { gaps: 0.22, fall: 0.6 });
      // Fungus in a few joints at the foot of each pier, breathing out of step, fading up the wall; its light in the water below.
      const piers = [];
      for (let k = 0; gx + (k + 0.5) * pitch < W + 20 * u; k += 1) piers.push(gx - (k + 0.5) * pitch, gx + (k + 0.5) * pitch);
      piers.forEach((x, i) => {
        const k = breathe(i * 1.9, 0.35, 0.7 + (i % 3) * 0.15);
        const y = walk - 3 * u;
        const off = i % 2 ? -1 : 1;
        for (const [dx, len, sd] of [[-6 * off, 22, 0], [2 * off, 34, 1], [9 * off, 16, 2]]) threads(p, joints, x + dx * u, y - (sd === 1 ? 2 : 0), len, 300 + i * 7 + sd, { v: 3.4, knot: 3 });
        glowAt(p, x, y + 2 * u, 30 * u, 5.5, k, [[1, 1], [3, 3], [5, 5]], { soft: 0.8, sy: 0.7 });
        if (i === 2 || i === 5) shrooms(p, x + (i % 2 ? -8 : 8) * u, walk + 2, 12 * u, 120 + i, { z: 7, v: 6.6 });
        refl(p, x, wl + 4 * u, H, 3 * u, 4.5 * u, 5, 90 + i, k);
      });
      const shafts = piers.filter((_, i) => i >= 2 && i % 4 < 2);
      for (const x of shafts) p.light(x + 3 * u, walk + 2 * u, 9 * u, 4.4, null, { zMin: 1, zMax: 1, sy: 0.35, hard: true });
      // The boat, and the card: in it the hull covers the feet; the boat is lit by the arch.
      const inBoat = cat === 'wanderer' || cat === 'item';
      const bx = inBoat ? gx : gx - 44 * u; const BL = 40 * u; const bwl = wl + 6 * u; const bh = Math.max(4, BL * 0.2);
      if (cat === 'wanderer') {
        SUBJECT.wanderer(p, gx + 8 * u, bwl - bh * 0.5, 38 * u, 'shadow', 6, false);
        rimFrom(p, 6, [['glow', 4], ['brick', 6]], 'cap', 4.4);
        const lx = gx + 8 * u + 38 * u * 0.3; const ly = bwl - bh * 0.5 - 38 * u * 0.62;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 7);
        p.fill(C.rect(lx - 0.5, ly - 2, 2, 2), 'iron', 3, 7);
        p.tint(lx, ly + 2, 20 * u, hex, 0.5, breathe(0.9, 0.12, 2));
        p.tint(lx, wl + (wl - ly) * 0.7, 10 * u, hex, 0.5, breathe(0.9, 0.12, 2));
      } else if (cat === 'item') {
        plume = chest(p, gx + 2 * u, bwl - bh * 1.1, 20 * u, ramp, 6);
        p.tint(gx + 2 * u, plume.y, 26 * u, hex, 0.55, breathe(2, 0.15, 1));
        p.tint(gx + 2 * u, wl + 16 * u, 12 * u, hex, 0.45, breathe(2, 0.15, 1));
      }
      boatSide(p, bx, bwl, BL, { rope: [bx - 26 * u, kerb + 2], z: 8 });
      p.light(gx, walk + 6 * u, 40 * u, 3.4 * g.far, null, { zMin: 8, zMax: 9, sy: 0.7 });
      if (cat === 'monster') {
        const save = { r: p.r.slice(), v: p.v.slice(), z: p.z.slice() };
        riser(p, gx + 2 * u, wl + 8 * u, 50 * u, ramp, 6, kerb);
        for (let i = (wl + 2) * W; i < W * H; i += 1) if (p.z[i] === 6 || p.z[i] === 7) { p.r[i] = save.r[i]; p.v[i] = save.v[i]; p.z[i] = save.z[i]; }
        rimFrom(p, 6, [['glow', 4], ['brick', 6]], 'cap', 4.4);
        p.tint(gx + 2 * u, wl + 8 * u - 50 * u * 0.78, 7 * u, hex, 0.45, breathe(0.3, 0.3, 1.4));
        for (const [rx, ry] of [[24, 3], [34, 4.5]]) p.shade(C.join(C.ellipse(gx + 2 * u, wl + 8 * u, rx * u, ry * u), C.ellipse(gx + 2 * u, wl + 8 * u, rx * u - 1.2, ry * u - 0.8)), (x, y, i) => (p.r[i] === p.ri('water') ? 1.6 : 0));
      } else if (cat === 'obstacle') {
        // The flood door is shut: riveted plates filling the arch, two bands, a wheel to turn that will not turn.
        const door = C.arch(gx, g.top + 1, g.hw - 1, walk);
        const b1 = walk - 30 * u; const b2 = walk - 12 * u;
        p.fill(door, ramp, (x, y) => {
          const seam = (Math.round(x - gx) + 400) % Math.round(8 * u) === 0;
          let v = 0.75 - (y - g.top) / (walk - g.top) * 0.5 + (x < gx ? 0.15 : -0.1) + (y < g.top + 2 ? 1 : 0);
          if (seam) v -= 0.8;
          if (Math.abs(y - b1) < 1.5 || Math.abs(y - b2) < 1.5) v += 0.9;
          if ((Math.abs(y - b1) < 0.6 || Math.abs(y - b2) < 0.6) && (Math.round(x - gx) + 400) % 4 === 2) v += 1.2;
          return v;
        }, 4);
        p.fill(C.join(C.circle(gx, walk - 21 * u, 6 * u), C.circle(gx, walk - 21 * u, 4.6 * u)), ramp, 2.8, 5);
        for (let k = 0; k < 4; k += 1) { const a = (k / 4) * Math.PI + 0.4; p.fill(C.poly([[gx + Math.cos(a) * 5.5 * u - 0.5, walk - 21 * u + Math.sin(a) * 5.5 * u], [gx + Math.cos(a) * 5.5 * u + 0.5, walk - 21 * u + Math.sin(a) * 5.5 * u], [gx - Math.cos(a) * 5.5 * u + 0.5, walk - 21 * u - Math.sin(a) * 5.5 * u], [gx - Math.cos(a) * 5.5 * u - 0.5, walk - 21 * u - Math.sin(a) * 5.5 * u]]), ramp, 2.4, 5); }
        p.fill(C.circle(gx, walk - 21 * u, 1.5 * u), ramp, 3.4, 6);
        p.tint(gx, walk - 22 * u, 30 * u, hex, 0.2, breathe(0.5, 0.12, 0.6));
        brackets(p, gx - 15 * u, walk - 3 * u, 7 * u, 99, { z: 7 }); // fungus taking the foot of the door
      }
      vignette(p, W, H, 1.8, 0.45);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img, t) {
          if (plume) beam(img, plume.x, plume.y - 20 * u, plume.w * 1.6, plume.x, plume.y, plume.w * 0.85, 0.72 + 0.12 * Math.sin(t * 1.3), 0, VIOLET, true);
          for (const x of shafts) beam(img, x - 6 * u, 0, 3 * u, x + 3 * u, walk + 2 * u, 6 * u, 0.34, 2);
          for (const q of particles('drip', Math.round(W / 30), [0, 0, W, wl], t, 19)) { put(img, q.x, q.y, '#97BCAD', 0.9); put(img, q.x, q.y - 1, '#2C2624', 0.7); }
          for (const q of particles('mote', Math.round(W / 16), [0, 20 * u, W, walk - 20 * u], t, 6)) put(img, q.x, q.y, q.big ? '#A8DCC9' : '#47977F', q.a * 0.6);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: EMIT });
      const u = H / 250;
      const vx = W / 2;
      // Black water down the middle; the walkways' edges at the sides, running away.
      p.fill(C.rect(0, 0, W, H), 'water', 1.4, 1);
      ripples(p, C.rect(0, 0, W, H), 8, 0.7);
      for (const side of [0, 1]) {
        const xb = side ? W - 18 * u : 18 * u; const xt = side ? W - 32 * u : 32 * u;
        const walkway = C.poly(side ? [[xt, 0], [W, 0], [W, H], [xb, H]] : [[0, 0], [xt, 0], [xb, H], [0, H]]);
        p.fill(walkway, 'wet', 1.8, 3);
        p.floor(walkway, { vx, vy: -90 * u, rows: 7, size: 0.55, d0: 50 * u, joint: -1.1, top: 0.4, vary: 0.7, chip: 0.05, seed: 40 + side, z: 3 });
        // The kerb: a lit edge, its face dark.
        const e = side ? -1 : 1;
        p.fill(C.poly([[xt, 0], [xt + e * 2, 0], [xb + e * 3, H], [xb, H]]), 'wet', 3.6, 3);
        p.fill(C.poly([[xt + e * 2, 0], [xt + e * 4, 0], [xb + e * 7, H], [xb + e * 3, H]]), 'brick', 0.8, 3);
      }
      // The arch's light, carried down the water in broken lines.
      refl(p, W / 2, 0, H * 0.9, 18 * u, 40 * u, 4.4, 13, breathe(0.4, 0.1, 0.5), { gaps: 0.4, fall: 1.1 });
      // Fungus on the walkways: glowing in the joints, fruiting in a cluster, its light on the water by the kerb.
      for (const [x, y, s, i] of [[12 * u, 110 * u, 13, 0], [W - 14 * u, 80 * u, 13, 1], [10 * u, 196 * u, 15, 2], [W - 16 * u, 204 * u, 14, 3], [W - 10 * u, 20 * u, 10, 4]]) {
        const k = breathe(i * 2.3, 0.35, 0.6 + i * 0.07);
        shrooms(p, x, y, s * u, 60 + i, { z: 7, k, light: { r: s * 1.6 * u, s: 1.2, zMin: 7, zMax: 7 } });
        glowAt(p, x, y - 4 * u, 40 * u, 5, k, [[3, 6]], { sy: 0.7 });
        glowAt(p, x, y - 4 * u, 30 * u, 2.2, k, [[1, 1]], { sy: 0.7 });
        refl(p, x + (x < W / 2 ? 15 : -15) * u, y + 2 * u, y + 36 * u, 2 * u, 3.5 * u, 2.2, 70 + i, k, { gaps: 0.3 });
      }
      p.shade(null, (x, y) => -2 * Math.max(0, y / H - 0.4));
      return {
        p,
        over(img, t) {
          for (const q of particles('drip', 10, [40 * u, 0, W - 80 * u, H * 0.5], t, 41)) put(img, q.x, q.y, '#3B866F', 0.8);
          // Rings where drops land: the near half of each, spreading and fading.
          for (let k = 0; k < 5; k += 1) {
            const ph = t * 0.3 + k * 0.37; const life = ph % 1; const n = Math.floor(ph);
            const cx = 50 * u + hash(k, n, 3) * (W - 100 * u); const cy = 20 * u + hash(k, n, 4) * H * 0.7;
            const rr = 2 + life * 12;
            for (let a = 0; a < 24; a += 1) {
              const ang = (a / 24) * Math.PI;
              put(img, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.35, '#173A30', (1 - life) * 0.75);
            }
          }
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B]);
})();

/* The King's Road: one direction, outside. */
(() => {
  const { C, Painter, put, sprite, flicker, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => v - Math.floor(v);
  /** Smooth noise, 0..1, in one and two dimensions. */
  const n1 = (x, s = 0) => { const i = Math.floor(x); return lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(x - i)); };
  const n2 = (x, y, s = 0) => {
    const i = Math.floor(x); const j = Math.floor(y); const fx = smooth(x - i); const fy = smooth(y - j);
    return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), fx), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), fx), fy);
  };

  const RAMPS = {
    // Dusk: slate overhead, down through a dusty grey to gold on the horizon. Low in
    // saturation where it turns, so the high sky never reads as the Wanderer's blue
    // nor the band between as the Item's violet.
    sky: ['#0A0C12', '#0F121A', '#161822', '#1F1F2A', '#2A2730', '#372F35', '#463839', '#5A443C', '#73533F', '#916441', '#B07943', '#CE934A', '#E6AF5A', '#F4CB78', '#FCE3A2', '#FFF3D4'],
    hill: ['#08080C', '#0D0C12', '#131118', '#1A161D', '#231C22', '#2E2427', '#3B2D2D', '#4B3832', '#5E4436'],
    field: ['#0A0705', '#120C07', '#1B1209', '#261A0C', '#33220F', '#432C12', '#563815', '#6C4719', '#86591E', '#A26E24', '#BF862D', '#D9A03B', '#ECBC55', '#F9D981'],
    earth: ['#0A0807', '#110D0B', '#19140F', '#221B15', '#2D231B', '#3A2D22', '#4A392B', '#5C4735', '#725842', '#8B6B50', '#A88260', '#C69D76', '#E0BC92'],
    stone: ['#09090A', '#111012', '#19171A', '#222023', '#2D2A2C', '#3A3536', '#4A4342', '#5D5450', '#74675F', '#8E7D70', '#AB9581', '#C9AF95'],
    wood: ['#0B0706', '#140E0A', '#1E150F', '#2A1D14', '#38271A', '#493320', '#5E4228', '#775432', '#93693E', '#B0814E', '#CC9C62'],
    iron: ['#060607', '#0D0D0F', '#151518', '#1F1F23', '#2B2B30', '#3A3A40', '#4E4E55', '#68676D'],
    tree: ['#060507', '#0A090B', '#100D0F', '#161213', '#1E1817', '#28201C', '#342920'],
    shadow: ['#050406', '#0A080B', '#110E11', '#191518', '#221C1F'],
    lamp: ['#6A3C12', '#B87426', '#EBB45A', '#FFE7A8', '#FFF8E2'],
    ...CARD,
  };
  const FLAME = { a: '#7E3A12', b: '#E08A2E', c: '#FFE08A', d: '#3A2010' };
  const CROW_FLY = [['aa...aa', '..aaa..', '...a...'], ['.......', 'aaaaaaa', '...a...'], ['...a...', '..aaa..', 'aa...aa']];
  const CROW_SIT = [['aaa...', '.aaaa.', '..aaaa', '..a...'], ['......', 'aaaaa.', '.aaaaa', '..a...']];

  /** Darken toward the edges, leaving one layer (the sky) alone. */
  function vignette(p, W, H, k = 2, cy = 0.45, skipZ = -1) {
    p.shade(null, (x, y, i) => (p.z[i] === skipZ ? 0 : -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55)));
  }

  /** One pixel, painted. */
  function dot(p, x, y, ramp, v, z) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    const i = y * p.w + x; p.r[i] = p.ri(ramp); p.v[i] = v; p.z[i] = z;
  }
  /** A one-pixel line. */
  function line(p, x0, y0, x1, y1, ramp, v, z) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k += 1) dot(p, lerp(x0, x1, k / n), lerp(y0, y1, k / n), ramp, v, z);
  }
  /** A bar of width w from one point to another, as a shape. */
  function bar(x0, y0, x1, y1, w) {
    const dx = x1 - x0; const dy = y1 - y0; const L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * w / 2; const ny = (dx / L) * w / 2;
    return C.poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
  }

  /**
   * The edges of layer z that stand against something bright behind them
   * (the sky, or the sheen on the far fields) take its light: each becomes
   * that colour `drop` steps down, so a silhouette is rimmed gold where the
   * afterglow is behind it and barely at all where it is not.
   */
  function backRim(p, z, drop = 1.2, minV = 3, ramps = ['sky'], dirs = [[0, -1], [-1, 0], [1, 0]]) {
    const rs = ramps.map((n) => p.ri(n)); const W = p.w; const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const i = y * W + x;
        if (p.z[i] !== z) continue;
        let best = -1; let br = 0;
        for (const [dx, dy] of dirs) {
          const j = i + dy * W + dx;
          // a line one pixel thick keeps its dark: only an edge with body behind it is rimmed
          const back = i - dy * W - dx;
          if (p.z[back] !== z && p.z[back] !== z + 1) continue;
          if (p.z[j] < z && rs.includes(p.r[j]) && p.v[j] > best) { best = p.v[j]; br = p.r[j]; }
        }
        if (best >= minV) hit.push([i, best, br]);
      }
    }
    for (const [i, v, br] of hit) { p.r[i] = br; p.v[i] = v - drop; }
  }

  /**
   * The near side of a figure toward a lamp: its pixels on layer z, within
   * r of the lamp, whose neighbour toward the lamp is not part of it, lit in
   * the lamp's warm colour, brightest close by.
   */
  function lampRim(p, z, lx, ly, r, v) {
    const S = p.ri('sky'); const W = p.w; const hit = [];
    for (let y = Math.max(1, Math.floor(ly - r)); y < Math.min(p.h - 1, ly + r); y += 1) {
      for (let x = Math.max(1, Math.floor(lx - r)); x < Math.min(W - 1, lx + r); x += 1) {
        const i = y * W + x;
        if (p.z[i] !== z) continue;
        const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly);
        if (d > r) continue;
        const sx = Math.sign(Math.round(lx - x - 0.5)); const sy = Math.sign(Math.round(ly - y - 0.5));
        const j = i + (Math.abs(lx - x) > Math.abs(ly - y) ? sx : sy * W);
        if (p.z[j] === z || p.z[j] === z + 1) continue;
        hit.push([i, v - (d / r) * 3.5]);
      }
    }
    for (const [i, val] of hit) { p.r[i] = S; p.v[i] = val; }
  }

  /* ---------- the land ---------- */

  /**
   * The dusk sky: slate overhead, warming down through grey to gold along
   * the horizon, brightest round (gx, hor) where the sun went down. Long thin
   * clouds lie across it, a little darker than the sky, their undersides lit
   * gold where they pass over the glow. clouds: [cx, cy, half-length, thickness].
   */
  function duskSky(p, W, hor, o) {
    const { u, gx } = o;
    const k = o.glow ?? 1; const rx = o.rx ?? 120 * u; const ry = o.ry ?? 60 * u;
    const top = o.top ?? 1; const low = o.low ?? 8; const peak = o.peak ?? 7; const pw = o.pw ?? 1.5; const gp = o.gp ?? 1.15;
    const S = p.ri('sky');
    const cl = (o.clouds || []).map(([cx, cy, hl, th], i) => ({ cx, cy, hl, th, i }));
    const baseAt = (y) => top + (low - top) * clamp((y + 0.5) / hor, 0, 1) ** pw;
    const glowAt = (x, y) => { const g = Math.max(0, 1 - Math.hypot((x + 0.5 - gx) / rx, (y + 0.5 - hor) / ry)); return k * peak * g ** gp; };
    const y1 = Math.min(p.h, Math.ceil(hor) + 1);
    for (let y = 0; y < y1; y += 1) {
      const base = baseAt(y);
      for (let x = 0; x < W; x += 1) {
        let v = base + glowAt(x, y);
        for (const c of cl) {
          const f = (x + 0.5 - c.cx) / c.hl;
          if (Math.abs(f) >= 1) continue;
          // Broken along its length, tapering at the ends, thick and thin by turns.
          const m = clamp((n1((x + 0.5) / (13 * u), c.i * 11 + 5) - 0.2) / 0.16, 0, 1);
          const th = c.th * (1 - f * f) ** 0.35 * m * (0.6 + 0.4 * n1((x + 0.5) / (6 * u), c.i * 13 + 1));
          if (th < 0.8) continue;
          const yt = c.cy - th * (0.3 + 0.7 * n1((x + 0.5) / (3.4 * u), c.i * 7 + 3) ** 0.7);
          const yb = c.cy + th * 0.28;
          if (y + 0.5 < yt || y + 0.5 > yb) continue;
          const g = glowAt(x, c.cy) / Math.max(0.01, k * peak);
          const under = yb - (y + 0.5);
          // Near the glow a cloud stands dark against it with a blazing underside; out in the
          // dusk it is a little paler than the sky, lit faintly from below.
          const sky = baseAt(c.cy) + glowAt(x, c.cy);
          const body = Math.max(0.8, sky - 2.2 - 2.8 * g);
          v = under < 1 ? body + 2 + g * k * 7.4 : under < 2 ? body + 0.9 + g * k * 3.4 : body + (y + 0.5 - yt < 1 ? 0.5 : 0);
          break;
        }
        const i = y * W + x; p.r[i] = S; p.v[i] = v; p.z[i] = 0;
      }
    }
  }

  /** Far hills under the sky: crest(x) their top, paler where the glow is behind them. */
  function farHills(p, W, crest, y1, o) {
    let y0 = y1;
    for (let x = 0; x < W; x += 1) y0 = Math.min(y0, crest(x + 0.5));
    p.fill(C.rect(0, Math.floor(y0), W, y1 - Math.floor(y0)), 'hill', (x, y) => {
      const c = crest(x + 0.5);
      if (y + 0.5 < c) return null;
      const near = Math.exp(-(((x + 0.5 - o.gx) / o.reach) ** 2));
      return o.v + o.lit * near - (y + 0.5 - c) * (o.fall ?? 0.05);
    }, o.z ?? 1);
  }

  /**
   * A town on its hill: a run of roofs, a wall, a church with its spire
   * and a square keep, black against the dusk, with windows lit. Returns
   * the windows, so some can blink.
   */
  function town(p, cx, base, w, u, o = {}) {
    const r = rng(o.seed || 'town'); const z = o.z ?? 1; const v = o.v ?? 1.4;
    const lights = []; const hu = Math.max(1, u);
    const x0 = cx - w / 2; const x1 = cx + w / 2;
    let x = x0;
    while (x < x1) {
      const hw = Math.max(2, (2.2 + r() * 2.6) * hu); const e = 1 - Math.abs(x + hw / 2 - cx) / (w * 0.62);
      const hh = Math.max(2, (1.6 + r() * 2.4) * hu * (0.5 + e));
      p.fill(C.rect(Math.round(x), Math.round(base - hh), Math.round(hw), Math.ceil(hh) + 2), 'hill', v, z);
      p.fill(C.poly([[Math.round(x) - 0.5, Math.round(base - hh) + 0.5], [Math.round(x) + hw / 2, base - hh - hw * 0.55], [Math.round(x) + Math.round(hw) + 0.5, Math.round(base - hh) + 0.5]]), 'hill', v, z);
      if (r() < 0.6) lights.push([Math.round(x + hw * (0.25 + r() * 0.5)), Math.round(base - hh * (0.2 + r() * 0.5))]);
      x += hw + (r() < 0.25 ? hu : 0);
    }
    // The church: a tower with a needle spire, off centre.
    const chx = Math.round(cx + w * (o.church ?? -0.12)); const tw = Math.max(2, Math.round(2.4 * hu));
    const th = Math.max(5, 7 * hu); const sp = Math.max(5, 8 * hu);
    p.fill(C.rect(chx - (tw >> 1), Math.round(base - th), tw, Math.ceil(th) + 1), 'hill', v, z);
    p.fill(C.poly([[chx - (tw >> 1) - 0.5, base - th + 0.5], [chx + (tw - (tw >> 1)) / 2 - 0.5 + 0.5, base - th - sp], [chx - (tw >> 1) + tw + 0.5, base - th + 0.5]]), 'hill', v, z);
    lights.push([chx, Math.round(base - th * 0.6)]);
    // The keep, square, with a notched top.
    if (o.keep !== false) {
      const kx = Math.round(cx + w * 0.26); const kw = Math.max(3, Math.round(4 * hu)); const kh = Math.max(5, 6.5 * hu);
      p.fill(C.rect(kx, Math.round(base - kh), kw, Math.ceil(kh) + 1), 'hill', v, z);
      for (let k = 0; k < kw; k += 2) p.fill(C.rect(kx + k, Math.round(base - kh) - 1, 1, 1), 'hill', v, z);
      lights.push([kx + 1, Math.round(base - kh * 0.55)]);
    }
    for (const [lx, ly] of lights) dot(p, lx, ly, 'lamp', 1.6 + r() * 1.6, z + 1);
    return lights;
  }

  /** A windmill on a far hill: a tapering tower and its cap; the sails turn in over(). */
  function windmill(p, x, base, u, o = {}) {
    const z = o.z ?? 1; const v = o.v ?? 1.2; const h = Math.max(7, 11 * u); const w0 = Math.max(3, 4.6 * u); const w1 = Math.max(2, 2.8 * u);
    p.fill(C.poly([[x - w0 / 2, base + 1], [x - w1 / 2, base - h], [x + w1 / 2, base - h], [x + w0 / 2, base + 1]]), 'hill', v, z);
    p.fill(C.poly([[x - w1 / 2 - 0.8, base - h + 0.5], [x, base - h - Math.max(2, 2.4 * u)], [x + w1 / 2 + 0.8, base - h + 0.5]]), 'hill', v, z);
    return { hx: x, hy: base - h + Math.max(1, u * 0.6), L: Math.max(5, 9 * u) };
  }
  /** The sails, turning slowly: four lattice arms from the hub. */
  function sails(img, m, t, hex) {
    const a0 = t * 0.35;
    for (let k = 0; k < 4; k += 1) {
      const a = a0 + (k * Math.PI) / 2; const ca = Math.cos(a); const sa = Math.sin(a);
      for (let d = 1; d <= m.L; d += 0.5) {
        put(img, m.hx + ca * d, m.hy + sa * d, hex);
        if (d > m.L * 0.3) put(img, m.hx + ca * d - sa * 1.2, m.hy + sa * d + ca * 1.2, hex, 0.8);
      }
    }
  }

  /** A poplar: tall and narrow, ragged at its edges. */
  function poplar(p, x, base, h, z, v, seed) {
    const w = Math.max(1.6, h * 0.17); const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i += 1) { const t = i / n; const r = Math.sin(Math.PI * t ** 0.8) * w * (0.85 + hash(i, 1, seed) * 0.3); pts.push([x - r, base - t * h]); }
    for (let i = n; i >= 0; i -= 1) { const t = i / n; const r = Math.sin(Math.PI * t ** 0.8) * w * (0.85 + hash(i, 2, seed) * 0.3); pts.push([x + r, base - t * h]); }
    p.fill(C.poly(pts), 'tree', v, z);
    p.fill(C.rect(Math.round(x), base - h * 0.12, 1, h * 0.12 + 1), 'tree', v, z);
  }
  /** An oak: a broad lumpy crown of a few round masses on a short trunk. */
  function oak(p, x, base, h, z, v, seed) {
    const r = rng(seed); const cw = h * 0.62;
    p.fill(C.rect(Math.round(x) - 1, base - h * 0.45, Math.max(1, Math.round(h * 0.09)), h * 0.45 + 1), 'tree', v, z);
    for (let k = 0; k < 5; k += 1) {
      const cx = x + (r() - 0.5) * cw; const cy = base - h * (0.55 + r() * 0.3); const rad = h * (0.2 + r() * 0.14);
      p.fill(C.circle(cx, cy, rad, 14), 'tree', v, z);
    }
  }
  /** A hedgerow along a line across the fields: a dark band with a lumpy top, broken at the road. */
  function hedge(p, W, y, th, u, o) {
    p.fill(C.rect(0, Math.floor(y - th * 1.6), W, Math.ceil(th * 2.2)), 'tree', (x, py) => {
      if (o.gap && o.gap(x)) return null;
      const top = y - th * (0.6 + 0.8 * n1(x / (3 * u), o.seed));
      if (py + 0.5 < top || py + 0.5 > y + th * 0.4) return null;
      return o.v + (py + 0.5 - top < 1 ? 0.6 : 0);
    }, o.z ?? 2);
  }
  /** A stook: sheaves stood together in the stubble to dry, a little hut of straw. */
  function stook(p, x, base, h, z, v) {
    const w = Math.max(2, h * 0.75);
    p.fill(C.poly([[x - w / 2, base + 0.5], [x - w * 0.3, base - h * 0.75], [x, base - h], [x + w * 0.3, base - h * 0.75], [x + w / 2, base + 0.5]]), 'field', v, z);
  }

  /**
   * A post-and-rail fence along a road's edge, receding to the horizon:
   * posts at even steps along the ground, so they crowd toward the far end,
   * two rails between each pair, the tops of the posts catching the glow.
   * edgeX(y) is the road's edge; d_k = K / (k + k0) below the horizon.
   */
  function fence(p, hor, y1, side, edgeX, o) {
    const { K, k0 = 2, n = 60, z = 4, v = 1.4, hk = 0.2, wk = 0.02, gap = 0.06 } = o;
    const pts = [];
    for (let k = n; k >= 0; k -= 1) {
      const d = K / (k + k0); const yb = hor + d;
      if (yb > y1 + d * hk) continue;
      if (o.skip && o.skip(k)) { pts.push(null); continue; }
      pts.push({ x: edgeX(yb) + side * gap * d, yb, h: hk * d, w: Math.max(1, Math.round(wk * d)) });
    }
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i]; if (!a) continue;
      const X = Math.round(a.x - (side < 0 ? a.w - 1 : 0));
      p.fill(C.rect(X, Math.round(a.yb - a.h), a.w, Math.round(a.h) + 1), 'wood', v, z);
      dot(p, X + (side < 0 ? a.w - 1 : 0), a.yb - a.h, 'wood', v + 1.6, z);
      const b = pts[i + 1];
      if (!b) continue;
      for (const f of [0.38, 0.78]) {
        line(p, a.x, a.yb - a.h * f, b.x, b.yb - b.h * f, 'wood', v + 0.4, z);
        if (b.h > 24) line(p, a.x, a.yb - a.h * f + 1, b.x, b.yb - b.h * f + 1, 'wood', v - 0.3, z);
      }
    }
  }

  /**
   * Fields from the horizon to the foot: rows running across and crowding
   * toward the horizon, each row's top catching the sky, the furrows
   * between dark. Patches of standing wheat and stubble meet along lines
   * that run to the vanishing point. The glow lies on the fields nearest it.
   */
  function fields(p, W, hor, y1, o) {
    const { u, gx, K } = o; const z = o.z ?? 2; const seed = o.seed ?? 3;
    const F = p.ri('field'); const gxs = o.glowX ?? gx;
    for (let y = Math.max(0, Math.floor(hor)); y < Math.min(p.h, y1); y += 1) {
      const d = y + 0.5 - hor;
      if (d <= 0.2) continue;
      const q = K / d;                        // how far, in rows
      const sp = (d * d) / K;                 // a row's height in pixels here
      const tv = clamp(d / (y1 - hor), 0, 1);
      const sheenY = Math.exp(-d / o.glowD);
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        if (o.keep && p.z[i] > z) continue;
        const g = (x + 0.5 - gx) / d;          // across, on the ground
        const off = hash(Math.floor(q / o.pd), 4, seed) * 0.9;
        const pid = Math.floor(g / o.pw + off);
        const prow = Math.floor(q / o.pd + hash(pid, 5, seed) * 0.6);
        const kind = hash(pid, prow, seed + 1);
        const wheat = kind < 0.55; const plough = kind > 0.84;
        let v = lerp(o.v0, o.v1, tv ** (o.fall ?? 0.6)) + (wheat ? o.wheatV ?? 0.6 : plough ? -0.6 : 0);
        // The afterglow lying on the wheat nearest it: a sheen right under the horizon.
        const sheen = Math.exp(-(((x + 0.5 - gxs) / o.reach) ** 2)) * sheenY;
        v += o.glow * sheen * (wheat ? 1.15 : plough ? 0.6 : 0.9);
        // Rows: lit tops and dark furrows, wherever they are wide enough to see.
        const f = frac(q * (wheat ? 1.5 : 1) + 0.12 * Math.sin(g * 2.1 + pid));
        const seen = clamp((sp - 1.2) / 2, 0, 1);
        if (f < 0.26) v += (0.5 + sheen * 1.2) * seen; else if (f < 0.52) v -= (plough ? 1.1 : 0.8) * seen;
        // Standing wheat: a fine upright grain.
        if (wheat) v += (hash(x, Math.floor((y + hash(x, 0, seed) * 4) / 2), seed + 2) - 0.5) * 0.8 * clamp(d / (6 * u), 0, 1);
        // Where two patches meet, a dark line (a ditch, a balk).
        const e = frac(g / o.pw + off);
        if (e < 0.8 / (Math.max(1, d) * o.pw) && d > 2) v -= 0.9;
        p.r[i] = F; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /**
   * The road from the horizon down to the foot: packed earth with two
   * wheel ruts and a crown of grass between them, its verges dark, the far
   * stretch catching the glow. hw(y) is its half-width; cx(y) its centre.
   */
  function road(p, y0, y1, cx, hw, o) {
    const z = o.z ?? 3; const E = p.ri('earth'); const F = p.ri('field');
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      const c = cx(y + 0.5); const w = hw(y + 0.5);
      if (w <= 0.3) continue;
      const t = clamp((y + 0.5 - y0) / (y1 - y0), 0, 1);
      for (let x = Math.max(0, Math.floor(c - w)); x <= Math.min(p.w - 1, Math.ceil(c + w)); x += 1) {
        const lx = (x + 0.5 - c) / w;
        if (Math.abs(lx) > 1) continue;
        const i = y * p.w + x;
        let v = lerp(o.v0, o.v1, t ** (o.pow ?? 0.8)) + (hash(Math.floor(x / 2), Math.floor(y / 2), 17) - 0.5) * 0.5;
        const rut = Math.abs(Math.abs(lx) - 0.45) < 0.08 + 0.45 / w;
        const crown = Math.abs(lx) < 0.16 && w > 3;
        if (Math.abs(lx) > 0.86) v -= 0.6;
        if (crown) { p.r[i] = F; p.v[i] = v - 0.9 + (hash(x, y, 23) < 0.3 ? 0.6 : 0); p.z[i] = z; continue; }
        if (rut) v -= 0.9;
        p.r[i] = E; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /** A puddle in a rut, holding the sky. */
  function puddle(p, x, y, rx, ry, v) {
    p.fill(C.ellipse(x, y, rx, ry, 16), 'sky', (px, py) => v - (py + 0.5 < y ? 0 : 1.2) - Math.abs(px + 0.5 - x) / rx * 1.2, 3);
  }

  /* ---------- the props ---------- */

  /** The gibbet: a post on a cairn of stones, its arm braced out. Returns where the chain hangs. */
  function gibbet(p, x, base, top, arm, u, z) {
    const X = Math.round(x); const pw = Math.max(2, Math.round(2.4 * u)); const aw = Math.max(2, Math.round(2 * u));
    p.fill(C.rect(X - (pw >> 1), top, pw, base - top), 'wood', 1.2, z);
    p.fill(C.rect(X - (pw >> 1) - Math.round(u), top, arm + pw, aw), 'wood', 1.3, z);
    const bl = Math.min(arm * 0.55, 9 * u);
    p.fill(bar(X, top + aw + bl, X + bl, top + aw - 0.2, Math.max(1.2, 1.5 * u)), 'wood', 1.1, z);
    p.fill(C.poly([[X - 5 * u, base + 1], [X - 3.5 * u, base - 2.5 * u], [X - 0.5 * u, base - 3.5 * u], [X + 3 * u, base - 2.5 * u], [X + 5 * u, base + 1]]), 'stone', 1.2, z);
    p.cells(C.poly([[X - 5 * u, base + 1], [X - 3.5 * u, base - 2.5 * u], [X - 0.5 * u, base - 3.5 * u], [X + 3 * u, base - 2.5 * u], [X + 5 * u, base + 1]]), { size: Math.max(2, 2 * u), joint: 0.5, jointV: -0.8, vary: 0.6, bevel: 0.5, seed: 5, z });
    return { hx: X + arm - Math.round(u) - 1, hy: top + aw };
  }

  /**
   * The cage, as points around its hanging ring: a body's shape of iron
   * straps, a skull slumped inside. `len` is its height in pixels.
   */
  function cageShape(len) {
    const h = Math.max(7, Math.round(len)); const w = Math.max(3, Math.round(h * 0.38)) | 1; const hw = w >> 1;
    const pts = [];
    for (let y = 0; y < h; y += 1) {
      const t = y / (h - 1);
      // a narrow head, broad shoulders, tapering to the feet
      const r = t < 0.22 ? hw * (0.55 + t * 1.6) : t < 0.42 ? hw : hw * (1 - (t - 0.42) * 0.7);
      const R = Math.round(r);
      for (let x = -R; x <= R; x += 1) {
        const edge = Math.abs(x) === R;
        const hoop = y === 0 || y === h - 1 || y === Math.round(h * 0.22) || y === Math.round(h * 0.62);
        const mid = x === 0 && t > 0.22;
        if (edge || hoop || mid) pts.push([x, y, 'i']);
        else if (y === Math.round(h * 0.1) && Math.abs(x) <= 1 && R >= 2) pts.push([x, y, 'b']);
      }
    }
    return { pts, h };
  }
  /** The chain and cage, swinging a little on the gibbet's arm; its edge toward the glow lit. */
  function drawCage(img, hx, hy, chain, shape, ang, cols, litDir) {
    const sa = Math.sin(ang); const ca = Math.cos(ang);
    for (let d = 0; d < chain; d += 1) put(img, hx + sa * d, hy + ca * d, d % 2 ? cols.i : cols.c);
    const ox = hx + sa * chain; const oy = hy + ca * chain;
    const maxX = new Map();
    for (const [x, y] of shape.pts) maxX.set(y, Math.max(maxX.get(y) ?? -99, x * litDir));
    for (const [x, y, k] of shape.pts) {
      const px = ox + x * ca + y * sa; const py = oy - x * sa + y * ca;
      put(img, px, py, k === 'b' ? cols.b : x * litDir === maxX.get(y) && x !== 0 ? cols.r : cols.i);
    }
  }

  /** A signpost: a post with a cap and arms pointing three ways; returns where the lamp hangs. */
  function signpost(p, x, base, top, u, z, o = {}) {
    const X = Math.round(x); const pw = Math.max(2, Math.round(2 * u));
    p.fill(C.rect(X - (pw >> 1), Math.round(top), pw, base - Math.round(top)), 'wood', 1.6, z);
    p.fill(C.poly([[X - (pw >> 1) - 0.8, top + 0.5], [X + (pw - (pw >> 1)) / 2 - (pw >> 1) / 2, top - Math.max(1.5, 1.6 * u)], [X + pw - (pw >> 1) + 0.8, top + 0.5]]), 'wood', 2, z);
    const arms = o.arms || [[-1, 2.5, 11], [1, 6.2, 10], [-1, 10, 6]];
    for (const [d, dy, len] of arms) {
      const y = Math.round(top + dy * u); const h = Math.max(2, Math.round(2.4 * u)); const L = Math.round(len * u); const tip = Math.max(1, h * 0.7);
      const x0 = d < 0 ? X - (pw >> 1) : X + pw - (pw >> 1); const x1 = x0 + d * L;
      p.fill(C.poly([[x0, y], [x1, y], [x1 + d * tip, y + h / 2], [x1, y + h], [x0, y + h]]), 'wood', 2.3, z);
      if (h >= 3) for (let k = 2; k < L - 1; k += 1) if (hash(k, dy * 10, 5) < 0.55) dot(p, x0 + d * k, y + 1, 'wood', 0.8, z);
    }
    // A crook under the arms, for the lamp.
    const cy = Math.round(top + (o.crook ?? 13) * u); const cl = Math.round((o.crookLen ?? 6) * u) * (o.crookDir ?? -1);
    p.fill(C.rect(Math.min(X, X + cl), cy, Math.abs(cl) + 1, 1), 'iron', 2.4, z);
    p.fill(bar(X, cy + 3 * u, X + cl * 0.5, cy, 1), 'iron', 2.2, z);
    return { lx: X + cl, ly: cy };
  }

  /** A lamp hanging from a hook at (x, y): a cap, a glass of light, a frame. */
  function lamp(p, x, y, u, z, o = {}) {
    const w = Math.max(3, Math.round(3.6 * u)); const h = Math.max(4, Math.round(4.6 * u)); const hang = Math.max(1, Math.round(1.6 * u));
    const X = Math.round(x) - (w >> 1); const Y = Math.round(y) + hang;
    p.fill(C.rect(Math.round(x), Math.round(y), 1, hang), 'iron', 2.2, z);
    p.fill(C.rect(X - (w > 3 ? 0 : 0), Y, w, 1), 'iron', 2.6, z);
    if (o.dark) {
      p.fill(C.rect(X, Y + 1, w, h - 1), 'iron', 1.4, z);
    } else {
      p.glow(C.rect(X, Y + 1, w, h - 1), o.ramp || 'lamp', X + w / 2, Y + h / 2 + 0.5, Math.max(w, h) * 0.75, o.vIn ?? 4.6, o.vOut ?? 2.4, z + 1);
      if (w >= 4) p.fill(C.rect(X + (w >> 1) - (w % 2 ? 0 : 1), Y + 1, 1, h - 1), 'iron', 1.6, z + 2);
    }
    p.fill(C.rect(X, Y + h, w, 1), 'iron', 2.2, z);
    return { cx: X + w / 2, cy: Y + h / 2 + 0.5 };
  }

  /** A milestone: a stone with a rounded head, a number cut in it, lit on the side toward the lamp. */
  function milestone(p, x, base, u, z, v, lit = 1) {
    const w = Math.max(3, Math.round(4 * u)); const h = Math.max(4, Math.round(6 * u));
    const shape = C.arch(x, base - h, w / 2, base + 1);
    p.fill(shape, 'stone', (px) => v + ((px + 0.5 - x) * lit > 0 ? 0.9 : -0.2), z);
    if (h >= 6) { dot(p, x - 1, base - h + 3, 'stone', v - 1.6, z); dot(p, x, base - h + 3, 'stone', v - 1.6, z); dot(p, x + (w > 4 ? 1 : 0), base - h + 4, 'stone', v - 1.4, z); }
  }

  /** A wayside shrine: a little roofed box on a post, a saint inside and a candle before it. */
  function shrine(p, x, base, u, z, v = 1.4) {
    const X = Math.round(x); const ph = Math.round(7 * u); const bw = Math.max(4, Math.round(5 * u)) | 1; const bh = Math.max(3, Math.round(4.5 * u));
    p.fill(C.rect(X, base - ph, 1 + (u > 0.9 ? 1 : 0), ph), 'wood', v, z);
    const bx = X - (bw >> 1); const by = base - ph - bh;
    p.fill(C.rect(bx, by, bw, bh), 'wood', v + 0.4, z);
    p.fill(C.rect(bx + 1, by + 1, bw - 2, bh - 1), 'shadow', 0.6, z);
    p.fill(C.poly([[bx - 1.2, by + 0.5], [X + 0.5, by - Math.max(2, 2.8 * u)], [bx + bw + 1.2, by + 0.5]]), 'wood', v + 0.8, z);
    dot(p, X, by + 1, 'stone', 3.6, z + 1); // the saint's head
    if (bh >= 4) dot(p, X, by + 2, 'stone', 2.6, z + 1);
    dot(p, X + (bw > 4 ? 1 : 0), by + bh - 1, 'lamp', 3.6, z + 2); // the candle
    return { cx: X + (bw > 4 ? 1 : 0) + 0.5, cy: by + bh - 0.5 };
  }

  /** A lamp post along the road: a post, an arm, the lamp hanging. */
  function lampPost(p, x, base, h, u, z, dir = 1, o = {}) {
    const X = Math.round(x); const top = Math.round(base - h);
    p.fill(C.rect(X, top, Math.max(1, Math.round(1.4 * u)), base - top), 'wood', 1.4, z);
    const al = Math.max(2, Math.round(4 * u));
    p.fill(C.rect(dir > 0 ? X : X - al, top, al + 1, 1), 'iron', 2.2, z);
    return lamp(p, X + dir * al, top + 1, u * 0.9, z, o);
  }

  /** Wheat in front: stalks up from the foot, ears at their tops, dark against the field, the ears catching the light. */
  function nearWheat(p, W, H, topAt, o) {
    const F = p.ri('field'); const z = o.z ?? 8; const u = o.u; const seed = o.seed ?? 9;
    const step = Math.max(1, o.step ?? 2); const wide = o.wide ?? u > 0.7;
    const lightAt = o.lightAt || (() => 0);
    const ears = [];
    // the mass of the crop below the ears, darkening down
    for (let x = 0; x < W; x += 1) {
      const t0 = topAt(x + 0.5);
      if (t0 >= H - 1) continue;
      const m = t0 + o.mass * u + (n1(x / (3 * u), seed) - 0.5) * 3 * u;
      for (let y = Math.max(0, Math.round(m)); y < H; y += 1) {
        const i = y * W + x; p.r[i] = F; p.z[i] = z;
        p.v[i] = o.v - 0.3 - clamp((y - m) / (12 * u), 0, 1) * 0.7 + (hash(x, Math.floor((y + hash(x, 1, seed) * 3) / 3), seed + 5) - 0.5) * 0.6;
      }
    }
    for (let x0 = 0; x0 < W + step; x0 += step) {
      const x = x0 + Math.floor(hash(x0, 1, seed) * step);
      const t0 = topAt(x + 0.5);
      if (t0 >= H - 1) continue;
      const top = Math.round(t0 + (hash(x0, 2, seed) - 0.5) * 4 * u);
      const lean = (hash(x0, 3, seed) - 0.5) * 2.4 * u + (o.lean || 0) * u;
      const eh = Math.max(2, Math.round((2.6 + hash(x0, 4, seed) * 1.2) * u));
      // the stalk
      for (let y = top; y < H; y += 1) {
        const k = (y - top) / Math.max(1, H - top);
        const sx = Math.round(x + lean * (1 - k) ** 2);
        if (sx < 0 || sx >= W || y < 0) continue;
        const i = y * W + sx; p.r[i] = F; p.z[i] = z; p.v[i] = o.v + 0.2 - k * 0.5;
      }
      // the ear, two pixels wide when there is room, lit on top; an awn or two above it
      const ex = Math.round(x + lean); const lit = o.ear + lightAt(ex, top);
      for (let k = 0; k < eh; k += 1) {
        const y = top - eh + k;
        for (const dx of (wide && k > 0 && k < eh - 1 ? [0, 1] : [0])) {
          const xx = ex + dx; if (xx < 0 || xx >= W || y < 0 || y >= H) continue;
          const i = y * W + xx; p.r[i] = F; p.z[i] = z; p.v[i] = lit - k * 0.35 - (dx ? 0.7 : 0);
        }
      }
      if (hash(x0, 6, seed) < 0.6) dot(p, ex + (lean > 0 ? 1 : -1), top - eh - 1, 'field', lit - 1, z);
      ears.push([ex, top - eh, eh]);
    }
    return ears;
  }

  /* ---------- the cards ---------- */

  /**
   * The headless rider: a horse pawing the road, its rider sat tall with no
   * head on his shoulders, his cloak torn out behind him and his own head
   * held up by the hair, its eyes alight. `s` is his shoulders' height;
   * m = 1 faces left.
   */
  function rider(p, cx, fy, s, ramp, z, m = 1) {
    const X = (x) => cx + m * x * s; const Y = (y) => fy + y * s;
    const P = (pts) => C.poly(pts.map(([x, y]) => [X(x), Y(y)]));
    const B = 'shadow'; const bv = 0.5; const lw = Math.max(1.2, 0.055 * s); const uw = Math.max(1.6, 0.085 * s);
    const leg = (pts, w0, w1, v = bv) => { for (let k = 0; k + 1 < pts.length; k += 1) p.fill(bar(X(pts[k][0]), Y(pts[k][1]), X(pts[k + 1][0]), Y(pts[k + 1][1]), k ? w1 : w0), B, v, z); };
    // the far legs, behind
    leg([[-0.22, -0.4], [-0.235, -0.18], [-0.25, 0]], uw, lw, bv - 0.3);
    leg([[0.22, -0.42], [0.28, -0.2], [0.23, 0]], uw, lw, bv - 0.3);
    // the tail, streaming
    p.fill(P([[0.36, -0.6], [0.46, -0.6], [0.55, -0.52], [0.6, -0.38], [0.63, -0.2], [0.57, -0.26], [0.53, -0.36], [0.47, -0.45], [0.4, -0.5]]), B, bv, z);
    // the barrel
    p.fill(P([[-0.34, -0.5], [-0.3, -0.61], [-0.22, -0.66], [-0.05, -0.6], [0.12, -0.6], [0.28, -0.64], [0.37, -0.59], [0.4, -0.5], [0.37, -0.41], [0.3, -0.36], [0.1, -0.34], [-0.12, -0.35], [-0.26, -0.38], [-0.34, -0.44]]), B, bv, z);
    // the neck and head, the ears pricked
    p.fill(P([[-0.17, -0.64], [-0.3, -0.81], [-0.38, -0.9], [-0.42, -0.94], [-0.43, -1.02], [-0.47, -0.95], [-0.51, -0.92], [-0.61, -0.81], [-0.64, -0.76], [-0.6, -0.72], [-0.52, -0.74], [-0.45, -0.77], [-0.38, -0.66], [-0.34, -0.52]]), B, bv, z);
    // the mane, blown back
    for (const [x, y] of [[-0.37, -0.89], [-0.32, -0.82], [-0.27, -0.75], [-0.22, -0.69]]) p.fill(P([[x, y], [x + 0.11, y - 0.03], [x + 0.04, y + 0.05]]), B, bv, z);
    // the near legs: one forefoot raised, pawing
    leg([[-0.27, -0.42], [-0.37, -0.26], [-0.33, -0.15], [-0.37, -0.11]], uw, lw);
    leg([[0.3, -0.42], [0.36, -0.2], [0.31, -0.04], [0.33, 0]], uw, lw);
    // the rider's leg, in the stirrup
    leg([[0.07, -0.62], [-0.07, -0.53], [-0.04, -0.4]], uw, uw * 0.8);
    // the cloak, torn and streaming
    p.fill(P([[0.1, -0.99], [0.24, -0.96], [0.38, -0.9], [0.5, -0.83], [0.6, -0.77], [0.52, -0.74], [0.58, -0.68], [0.45, -0.67], [0.49, -0.6], [0.36, -0.62], [0.24, -0.6], [0.14, -0.62]]), B, bv, z);
    // his body, sat tall, and the empty collar standing up where his head should be
    p.fill(P([[-0.02, -0.6], [0.13, -0.6], [0.15, -0.78], [0.15, -0.95], [0.1, -1.0], [-0.03, -1.0], [-0.08, -0.95], [-0.05, -0.78]]), B, bv, z);
    p.fill(P([[-0.05, -0.98], [-0.03, -1.07], [0.01, -0.99]]), B, bv, z);
    p.fill(P([[0.08, -0.99], [0.12, -1.07], [0.14, -0.98]]), B, bv, z);
    // the arm raised, and the head held up by its hair
    leg([[-0.04, -0.95], [-0.15, -1.08], [-0.2, -1.22]], uw * 0.9, uw * 0.8);
    const hx = X(-0.21); const hy = Y(-1.12); const hr = Math.max(1.6, 0.068 * s);
    p.fill(C.circle(hx, hy, hr, 16), B, bv, z);
    line(p, X(-0.2), Y(-1.22), hx, hy - hr, B, bv, z);
    // eyes: the head's, and the horse's
    const ey = Math.round(hy);
    p.fill(C.rect(Math.round(hx) - 1, ey, 1, 1), ramp, 4, z + 1);
    p.fill(C.rect(Math.round(hx) + 1, ey, 1, 1), ramp, 4, z + 1);
    dot(p, X(-0.5), Y(-0.88), ramp, 3.6, z + 1);
    return { hx, hy, ex: X(-0.5), ey: Y(-0.88) };
  }

  /**
   * The pedlar: a little bent man under a heap taller than he is: a fat
   * sack, a basket, a rolled rug across the top with a kettle on it, a broom
   * stuck up out of it, and pots and pans hanging all round on cords, each
   * clear against the sky. His lamp hangs from his staff by his hand. `s` is
   * the top of his hat; m = 1 faces left.
   */
  function pedlar(p, cx, fy, s, z, m = 1) {
    const X = (x) => cx + m * x * s; const Y = (y) => fy + y * s;
    const P = (pts) => C.poly(pts.map(([x, y]) => [X(x), Y(y)]));
    const E = (x, y, rx, ry) => C.ellipse(X(x), Y(y), rx * s, ry * s, 20);
    const B = 'shadow'; const bv = 0.5; const pv = 1.0; const iv = 1.0;
    const w = Math.max(1.3, 0.075 * s); const th = Math.max(1, 0.03 * s);
    const foot = (x0, x1) => p.fill(C.rect(Math.min(X(x0), X(x1)), Math.round(Y(-0.03)), Math.max(2, Math.abs(X(x1) - X(x0))), Math.max(1, Math.round(0.03 * s))), B, bv, z);
    const hang = (x, y, r, cy, pan) => {
      line(p, X(x), Y(cy), X(x), Y(y - r), B, bv, z);
      p.fill(C.circle(X(x), Y(y), r * s, 14), 'iron', iv, z);
      if (pan) p.fill(bar(X(x), Y(y + r * 0.8), X(x + 0.04), Y(y + r * 2.2), th * 1.4), 'iron', iv, z);
      else p.fill(C.rect(Math.min(X(x - r * 1.3), X(x + r * 1.3)), Math.round(Y(y - r * 0.7)), Math.abs(r * 2.6 * s), 1), 'iron', iv, z);
    };
    // the legs, mid-stride: the back one trailing, the front one bent at the knee
    p.fill(bar(X(0.05), Y(-0.42), X(0.19), Y(-0.02), w), B, bv - 0.2, z); foot(0.17, 0.27);
    p.fill(bar(X(-0.02), Y(-0.42), X(-0.11), Y(-0.22), w), B, bv, z);
    p.fill(bar(X(-0.11), Y(-0.22), X(-0.14), Y(-0.02), w), B, bv, z); foot(-0.22, -0.12);
    // the heap: a fat sack on his back, a basket on that, a rolled rug across the top
    p.fill(E(0.17, -0.56, 0.21, 0.26), 'wood', pv, z);
    p.fill(P([[0.0, -0.78], [0.34, -0.78], [0.31, -0.98], [0.03, -0.98]]), 'wood', pv + 0.3, z);
    for (let k = 1; k < 4; k += 1) p.fill(C.rect(Math.round(X(0.02 + k * 0.08)), Math.round(Y(-0.97)), 1, Math.max(1, 0.18 * s)), B, bv, z);
    p.fill(E(0.2, -1.03, 0.3, 0.055), 'wood', pv + 0.6, z);
    // a kettle on the rug, a broom stuck up out of the basket
    p.fill(E(0.1, -1.12, 0.07, 0.055), 'iron', iv, z);
    p.fill(bar(X(0.16), Y(-1.12), X(0.23), Y(-1.18), th), 'iron', iv, z);
    p.fill(C.rect(Math.round(X(0.1)) - 1, Math.round(Y(-1.19)), 2, Math.max(1, Math.round(0.02 * s))), 'iron', iv, z);
    line(p, X(0.28), Y(-0.86), X(0.44), Y(-1.32), 'wood', pv, z);
    p.fill(P([[0.4, -1.3], [0.5, -1.4], [0.53, -1.33], [0.45, -1.24]]), 'wood', pv + 0.3, z);
    // pots and pans hung all round on cords, clear of the heap
    hang(0.5, -0.68, 0.085, -0.86, false);
    hang(0.47, -0.36, 0.07, -0.5, false);
    hang(0.56, -0.98, 0.075, -1.0, true);
    hang(-0.06, -0.92, 0.06, -1.03, false);
    // his coat, bent forward under the load
    p.fill(P([[-0.14, -0.18], [-0.18, -0.5], [-0.21, -0.66], [-0.17, -0.74], [-0.02, -0.77], [0.04, -0.6], [0.1, -0.4], [0.13, -0.18]]), B, bv, z);
    // head pushed forward under a broad hat
    p.fill(C.circle(X(-0.27), Y(-0.75), 0.075 * s, 12), B, bv, z);
    p.fill(E(-0.28, -0.82, 0.17, 0.032), B, bv, z);
    p.fill(P([[-0.35, -0.83], [-0.32, -0.95], [-0.23, -0.95], [-0.2, -0.83]]), B, bv, z);
    // the staff planted ahead, his arm out to it
    p.fill(bar(X(-0.47), Y(0), X(-0.39), Y(-1.06), Math.max(1, 0.035 * s)), B, bv, z);
    p.fill(bar(X(-0.16), Y(-0.64), X(-0.41), Y(-0.6), w), B, bv, z);
    return { lx: X(-0.48), ly: Y(-0.66) };
  }

  /**
   * A wagon that lost its front wheel at the crossroads: its back still up
   * on the big rear wheel, its front down in the road, the broken wheel
   * lying flat before it, the pole along the ground. Black. `s` is about the
   * rear wheel's height; m = 1 has its front to the left.
   */
  function wagon(p, cx, fy, s, z, m = 1) {
    const X = (x) => cx + m * x * s; const Y = (y) => fy + y * s;
    const P = (pts) => C.poly(pts.map(([x, y]) => [X(x), Y(y)]));
    const B = 'shadow'; const bv = 0.55; const w = Math.max(1.2, 0.05 * s); const rimW = Math.max(1, 0.07 * s);
    // the pole along the road
    p.fill(bar(X(-0.56), Y(-0.04), X(-1.02), Y(-0.02), w), B, bv - 0.2, z);
    // the bed, tipped: its back up on the rear wheel, its front corner down in the road
    p.fill(P([[0.74, -0.68], [-0.6, -0.08], [-0.6, 0.0], [-0.48, 0.0], [0.76, -0.56]]), B, bv, z);
    // the sideboard and its stakes, and a load of sacks slumped to the front
    p.fill(P([[0.74, -0.68], [0.72, -0.86], [-0.58, -0.28], [-0.6, -0.08]]), B, bv, z);
    for (const t of [0.04, 0.33, 0.62, 0.92]) { const x0 = lerp(0.72, -0.58, t); const y0 = lerp(-0.86, -0.28, t); p.fill(bar(X(x0), Y(y0 - 0.06), X(x0), Y(y0 + 0.2), w), B, bv, z); }
    for (const [x, y, rx, ry] of [[-0.3, -0.36, 0.14, 0.09], [-0.12, -0.46, 0.13, 0.09], [-0.44, -0.27, 0.1, 0.07]]) p.fill(C.ellipse(X(x), Y(y), rx * s, ry * s, 14), 'wood', 0.9, z);
    // the rear wheel, whole, standing up against the glow: rim, eight spokes, hub
    const wx = X(0.44); const wy = Y(-0.39); const wr = 0.39 * s;
    p.fill(C.join(C.circle(wx, wy, wr, 32), C.circle(wx, wy, wr - rimW, 32)), B, bv, z + 1);
    for (let k = 0; k < 8; k += 1) { const a = (k * Math.PI) / 4 + 0.2; line(p, wx, wy, wx + Math.cos(a) * (wr - 0.5), wy + Math.sin(a) * (wr - 0.5), B, bv, z + 1); }
    p.fill(C.circle(wx, wy, Math.max(1.2, 0.08 * s), 10), B, bv, z + 1);
    // the front wheel, broken, lying flat in the road: part of its rim and a few spokes
    const nx = X(-0.2); const ny = Y(0.05); const nrx = 0.32 * s; const nry = 0.075 * s;
    p.each(C.join(C.ellipse(nx, ny, nrx, nry, 28), C.ellipse(nx, ny, nrx - rimW * 1.2, Math.max(0.5, nry - rimW * 0.6), 28)), (x, y, i) => {
      const a = Math.atan2((y + 0.5 - ny) / nry, (x + 0.5 - nx) / nrx);
      if (a > 0.5 && a < 1.6) return;
      p.r[i] = p.ri(B); p.v[i] = bv; p.z[i] = z;
    });
    for (const a of [0.2, 1.9, 2.8, 4.1, 5.3]) line(p, nx, ny, nx + Math.cos(a) * nrx * 0.9, ny + Math.sin(a) * nry * 0.9, B, bv, z);
    return { wx, wy, wr };
  }

  /**
   * The strongbox thrown from the wagon: iron-bound, its lid sprung back,
   * the inside of the lid lit by what is in it, coins spilled in the dust.
   */
  function strongbox(p, cx, fy, s, ramp, z) {
    const w = s * 0.55; const h = s * 0.4;
    // the lid, sprung back past upright: dark wood, an iron band, its lower edge catching the light from inside
    // its inside face, lit by what is in the box, framed in dark wood
    const lt = fy - h - s * 0.4;
    p.fill(C.poly([[cx - w * 0.94, fy - h], [cx - w * 1.04, lt], [cx + w * 0.88, lt], [cx + w * 0.94, fy - h]]), 'wood', 1.2, z);
    p.fill(C.poly([[cx - w * 0.8, fy - h], [cx - w * 0.88, lt + 1.5], [cx + w * 0.74, lt + 1.5], [cx + w * 0.8, fy - h]]), ramp, (x, y) => 1 + ((y - lt) / (fy - h - lt)) ** 1.5 * 1.6, z);
    p.fill(C.rect(cx - w * 1.02, lt, w * 1.9, 1), 'wood', 3, z + 1);
    // what is in it, heaped and shining
    p.glow(C.poly([[cx - w * 0.8, fy - h + 1], [cx - w * 0.45, fy - h - s * 0.12], [cx + w * 0.25, fy - h - s * 0.15], [cx + w * 0.8, fy - h + 1]]), ramp, cx - w * 0.1, fy - h - s * 0.06, w * 0.8, 4.6, 3, z + 2);
    // the box, iron-bound, with its lock
    p.fill(C.rect(cx - w, fy - h, w * 2, h), 'wood', (x, y) => 2.6 - ((y - (fy - h)) / h) * 1.2, z);
    p.fill(C.rect(cx - w, fy - h, w * 2, 1), 'wood', 4.6, z + 1);
    for (const x of [cx - w * 0.7, cx + w * 0.7 - 1]) p.fill(C.rect(x, fy - h, Math.max(1, s * 0.07), h), 'iron', 2.4, z + 1);
    p.fill(C.rect(cx - 1, fy - h + Math.max(1, h * 0.25), 2, Math.max(2, h * 0.35)), 'iron', 3.4, z + 1);
    // coins spilled into the dust
    for (const [ox, oy] of [[-1.15, 0.0], [-1.4, 0.05], [1.12, -0.02], [1.3, 0.04], [0.5, 0.07], [-0.6, 0.08]]) dot(p, cx + ox * w, fy + oy * s, ramp, 3.4, z + 2);
    return { gx: cx, gy: fy - h - s * 0.06 };
  }

  /**
   * The turnpike: two stone gateposts either side of the road, a beam
   * across from one to the other set with iron pikes, a bar under it and a
   * chain swagged below with a lock at the middle; rails run out from the
   * posts across both verges, so there is no way round. In the card's colour.
   */
  function turnpike(p, cx, fy, u, ramp, z) {
    const gw = 13 * u; const xs = [cx - gw, cx + gw];
    const t1 = Math.max(1, Math.round(1.2 * u));
    // the rails across the verges, on their own posts
    for (const sd of [-1, 1]) {
      const xa = cx + sd * (gw + 2 * u); const xb = cx + sd * 42 * u;
      for (const ry of [fy - 5 * u, fy - 10.5 * u]) {
        p.fill(C.rect(Math.round(Math.min(xa, xb)), Math.round(ry), Math.round(Math.abs(xb - xa)), t1), ramp, 1.5, z);
        p.fill(C.rect(Math.round(Math.min(xa, xb)), Math.round(ry), Math.round(Math.abs(xb - xa)), 1), ramp, 2.4, z);
      }
      for (let x = xa + sd * 7 * u; sd * (xb - x) > -1; x += sd * 8 * u) p.fill(C.rect(Math.round(x), Math.round(fy - 13 * u), t1, Math.round(13 * u) + 1), ramp, 1.2, z);
    }
    // the gateposts, stone, capped, a ball on each
    for (const x of xs) {
      const post = C.rect(Math.round(x - 2.6 * u), Math.round(fy - 26 * u), Math.round(5.2 * u), Math.round(26 * u) + 1);
      p.fill(post, 'stone', 1.6, z + 1);
      p.masonry(post, { bw: 5.2 * u, bh: 3.4 * u, joint: -0.8, top: 0.4, vary: 0.5, seed: 3, z: z + 1 });
      p.fill(C.rect(Math.round(x - 3.4 * u), Math.round(fy - 27.8 * u), Math.round(6.8 * u), Math.max(1, Math.round(1.8 * u))), 'stone', 2.6, z + 1);
      p.fill(C.circle(x, fy - 30 * u, 2.3 * u, 12), 'stone', 2.2, z + 1);
    }
    // the beam, set with pikes, and the bar under it
    const by = Math.round(fy - 17 * u); const bh = Math.max(2, Math.round(3 * u));
    const x0 = Math.round(xs[0] + 2.6 * u); const x1 = Math.round(xs[1] - 2.6 * u);
    p.fill(C.rect(x0, by, x1 - x0, bh), ramp, 1.8, z + 2);
    p.fill(C.rect(x0, by, x1 - x0, 1), ramp, 3.2, z + 2);
    p.fill(C.rect(x0, Math.round(fy - 8 * u), x1 - x0, Math.max(1, Math.round(1.6 * u))), ramp, 1.6, z + 2);
    const step = Math.max(2, Math.round(3 * u)); const ph = Math.max(3, 5.4 * u);
    for (let x = x0 + Math.round(step / 2); x < x1; x += step) {
      p.fill(C.poly([[x - 0.9 * u, by + 0.5], [x + 0.9 * u, by + 0.5], [x + 0.05, by - ph]]), ramp, 2.4, z + 2);
      dot(p, x, by - ph + 0.6, ramp, 3.8, z + 2);
    }
    // the chain, swagged under the beam, its links alternately lit, the lock at the middle
    const n = Math.round((x1 - x0) / Math.max(1.5, 1.6 * u));
    for (let k = 0; k <= n; k += 1) {
      const t = k / n; const x = lerp(x0 + u, x1 - u, t); const y = by + bh + 1 + Math.sin(Math.PI * t) * 5 * u;
      dot(p, x, y, ramp, k % 2 ? 1.8 : 3, z + 3);
    }
    const ly = by + bh + 1 + 5 * u;
    p.fill(C.rect(Math.round(cx - 1.6 * u), Math.round(ly), Math.max(2, Math.round(3.2 * u)), Math.max(2, Math.round(3.6 * u))), ramp, 3.9, z + 4);
    dot(p, cx - 0.5 * u, ly - 1, ramp, 2.8, z + 4);
    return { lockX: cx, lockY: ly + 1.8 * u, by };
  }

  /* ================= A: the crossroads at dusk ================= */

  const A = {
    job: 0, setting: 'kings-road', key: 'A', id: 'kings-road-a', side: 'outside',
    name: 'The King’s Road', title: 'The crossroads at dusk',
    pitch: 'The road between towns, as the sun goes down. Wheat to the horizon, the next town lighting its windows, and at the crossroads a lamp on the signpost and a gibbet creaking on its chain. Whatever the card is waits where the four ways meet.',
    notes: [
      ['Light', 'The afterglow of a sun just set, gold along the horizon and slate overhead, with every post, crow and cage black against it and rimmed in gold. The lamps on the road are the only other light. On a face-down card the road runs on into a dark wood: light at its end belongs to the Clear Path.'],
      ['Detail', 'A signpost pointing three ways with a lamp on its crook, a milestone, a gibbet with its cage and its crows, a wayside shrine with a candle, wheel ruts holding puddles, stooks in the stubble, a windmill turning and a town on its hill.'],
      ['Vista', 'Fields the width of the board, the cross road running across them lamp to lamp. The card stands at the crossroads against the glow: a headless rider holding up his own head, a pedlar under a mountain of pots, a wagon down on a broken wheel with its strongbox burst open in the road, a turnpike barring the road, and for a Clear Path the sun’s last edge where the road goes on under the first stars.'],
      ['World', 'The road comes down from the glow at the top between dark fields of stooks and wheat, a post-and-rail fence running beside it all the way to the light. A lamp post and a shrine stand low in the corners, lighting the near wheat as it sways; crows cross the last of the sky above the board.'],
    ],
    palette: ['#0A0C12', '#1F1F2A', '#463839', '#916441', '#E6AF5A', '#FCE3A2', '#261A0C', '#86591E', '#5C4735'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['lamp'], dither: 0.28 });
      const u = H / 134; const gx = W / 2;
      const hor = Math.round(80 * u); const sunX = 10 * u;
      duskSky(p, W, hor + 1, {
        u, gx: sunX, rx: 78 * u, ry: 60 * u, top: 0.5, low: 3.8, peak: 10.8, pw: 1.4, gp: 1.1,
        clouds: [[46 * u, 58 * u, 44 * u, 7 * u], [82 * u, 35 * u, 32 * u, 6 * u], [4 * u, 31 * u, 26 * u, 5 * u]],
      });
      // The far hills: low under the glow, rising on the right to the town's hill.
      const crest = (x) => hor - 1.5 * u - 2 * u * n1(x / (11 * u), 4) - 10 * u * Math.exp(-(((x - 84 * u) / (14 * u)) ** 2));
      farHills(p, W, crest, hor + 2 * u, { gx: sunX, reach: 30 * u, v: 1.4, lit: 2.6, z: 1 });
      const lights = town(p, 84 * u, crest(84 * u) + 1.5 * u, 22 * u, u * 0.8, { seed: 'back-town', v: 1.3, church: -0.18 });
      // The wood the road runs into, black on the horizon.
      for (const [dx, h, sd] of [[-6, 15, 1], [0, 20, 2], [6, 17, 3], [11, 13, 4], [-12, 12, 5], [16, 10, 6], [-17, 8, 9]]) oak(p, gx + 8 * u + dx * u, hor + 2 * u, h * u, 1, 0.4, `back-wood-${sd}`);
      poplar(p, 36 * u, hor + 1, 13 * u, 1, 0.7, 7);
      poplar(p, 31 * u, hor + 1, 9 * u, 1, 0.8, 8);
      // The fields.
      fields(p, W, hor, H, { u, gx, glowX: sunX, K: 26 * u, pw: 1.2, pd: 2.2, v0: 2.4, v1: 0.5, fall: 0.5, wheatV: 0.6, glow: 6.4, reach: 30 * u, glowD: 4.5 * u, seed: 5, z: 2, keep: true });
      for (const [x, y, h] of [[6, 86, 3.4], [15, 84.5, 2.8], [24, 85, 2.6], [10, 91, 4.2]]) stook(p, x * u, y * u, h * u, 3, 2.4);
      // The roads, pale dust between the dark fields: the near road up to the crossroads,
      // the cross road, the far road bending away into the wood.
      const cr0 = 93 * u; const cr1 = 99 * u;
      road(p, cr1 - 1, H, () => gx, (y) => 0.4 * (y - hor) + 1, { v0: 6.2, v1: 3, z: 3 });
      road(p, cr0, cr1, () => gx, () => W, { v0: 5.4, v1: 6, z: 3 });
      const far = (y) => gx + 9 * u * smooth(clamp((cr0 - y) / (cr0 - hor - 3 * u), 0, 1)) ** 0.8;
      road(p, hor + 2 * u, cr0 + 0.5, far, (y) => lerp(1.2 * u, 6.5 * u, clamp((y - hor - 2 * u) / (cr0 - hor - 2 * u), 0, 1) ** 1.3), { v0: 1.4, v1: 5.2, z: 3 });
      puddle(p, gx - 9 * u, 119 * u, 5 * u, 1.3 * u, 4.6);
      puddle(p, gx + 5 * u, 104 * u, 3.4 * u, 0.9 * u, 5.4);
      // The gibbet on the left, against the glow, its cage hanging.
      const gb = gibbet(p, 13 * u, 104 * u, 41 * u, 22 * u, u, 5);
      const cage = cageShape(14 * u); const ch = Math.round(7 * u);
      for (let d = 0; d < ch; d += 1) dot(p, gb.hx, gb.hy + d, 'iron', d % 2 ? 1 : 1.8, 5);
      for (const [x, y, k] of cage.pts) dot(p, gb.hx + x, gb.hy + ch + y, k === 'b' ? 'stone' : 'iron', k === 'b' ? 3.4 : 1, 5);
      // The signpost at the corner of the crossroads, its lamp on the crook, the milestone at its foot.
      // Its lamp hangs on the far side of the post, off the road, so the road itself runs on into the dark.
      const sp = signpost(p, 62 * u, 96 * u, 55 * u, u, 5, { arms: [[-1, 2.5, 12], [1, 6.2, 9], [-1, 10, 6]], crook: 14, crookLen: 7, crookDir: 1 });
      const lp = lamp(p, sp.lx, sp.ly, u, 6);
      milestone(p, 56 * u, 99 * u, u, 5, 2.4, 1);
      // The lamp, broken up in the near puddle.
      for (let k = 0; k < 3; k += 1) dot(p, gx + 7 * u + (k % 2), 103.6 * u + k, 'sky', 12 - k * 1.4, 3);
      // A shrine at the right, its candle lit.
      const sh = shrine(p, 87 * u, 102 * u, u, 5, 1.2);
      // The near wheat at the corners: the left lit by the glow, the right by the lamp.
      const ears = nearWheat(p, W, H, (x) => {
        const d = Math.abs(x - gx) - 0.4 * (H - hor) - 1;
        return d < 0 ? H + 5 : 108 * u + 18 * u * Math.exp(-d / (5 * u)) - (x < gx ? 3 * u : 0);
      }, { u, v: 0.9, ear: 2.6, mass: 7, step: 2, seed: 4, wide: true, lightAt: (x) => (x < gx ? 2.4 * Math.exp(-x / (20 * u)) : 0) });
      // Light: the afterglow on the near fields at the left, the lamp's pool, the candle.
      p.light(sunX, hor, 40 * u, 2.2, null, { zMin: 2, zMax: 3, sx: 1.5, sy: 0.6 });
      p.light(lp.cx, lp.cy, 24 * u, 5.4, null, { zMin: 2, hard: true });
      p.light(lp.cx, lp.cy, 46 * u, 1.2, null, { zMin: 2 });
      p.light(sh.cx, sh.cy, 9 * u, 2.4, null, { zMin: 2, hard: true });
      backRim(p, 5, 0.8, 6.5); backRim(p, 1, 1.2, 6); backRim(p, 3, 1, 5); backRim(p, 8, 1, 5);
      vignette(p, W, H, 1.4, 0.5, 0);
      return {
        p,
        over(img) {
          sprite(img, gb.hx - Math.round(15 * u), gb.hy, CROW_SIT[0], { a: '#0B0907' });
          sprite(img, gb.hx - Math.round(8 * u), gb.hy, CROW_SIT[1], { a: '#0B0907' }, true);
          sprite(img, Math.round(40 * u), Math.round(40 * u), CROW_FLY[0], { a: '#120E0E' });
          sprite(img, Math.round(50 * u), Math.round(35 * u), CROW_FLY[2], { a: '#120E0E' });
          for (const [x, y] of lights.slice(0, 3)) put(img, x, y, '#FFE7A8');
          for (const [x, y] of [[70, 12], [82, 20], [58, 8], [88, 9], [44, 15], [62, 22]]) put(img, x * u, y * u, '#9A948C', 0.7);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: ['lamp'], dither: 0.28 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const hor = 66 * u;
      const r = rng('kr-vista');
      // Clouds across the width: long banks near the glow, thinner ones out to the sides.
      const clouds = [[gx - 38 * u, 48 * u, 58 * u, 8 * u], [gx + 54 * u, 32 * u, 48 * u, 6.5 * u], [gx + 2 * u, 15 * u, 44 * u, 5 * u]];
      for (let d = 96 * u; d < W; d += (70 + r() * 50) * u) {
        clouds.push([gx + d, (14 + r() * 36) * u, (30 + r() * 30) * u, (4.5 + r() * 3) * u], [gx - d - 20 * u, (14 + r() * 36) * u, (30 + r() * 30) * u, (4.5 + r() * 3) * u]);
      }
      duskSky(p, W, hor + 1, { u, gx, rx: 150 * u, ry: 74 * u, top: 1.0, low: 7.6, peak: open ? 8.2 : 7, clouds });
      // The far hills: low where the glow is, rolling away either side.
      const crest = (x) => hor - 1 * u - (1.5 + 6 * smooth(clamp((Math.abs(x - gx) - 18 * u) / (70 * u), 0, 1))) * u * (0.6 + 0.5 * n1(x / (26 * u), 3)) - 3 * u * n1(x / (9 * u), 5) * smooth(clamp(Math.abs(x - gx) / (40 * u), 0, 1));
      farHills(p, W, crest, hor + 2 * u, { gx, reach: 46 * u, v: 1.4, lit: 2.4, z: 1 });
      // A town on its hill to the left, a windmill to the right; more of each further out.
      const towns = []; const mills = [];
      for (let k = 0; k < 6; k += 1) {
        const tx = gx - (84 + k * 230) * u; const tx2 = gx + (215 + k * 230) * u;
        if (tx > -40 * u) towns.push(town(p, tx, crest(tx) + 2 * u, 34 * u, u, { seed: `vt${k}`, v: 1.4 }));
        if (tx2 < W + 40 * u) towns.push(town(p, tx2, crest(tx2) + 2 * u, 26 * u, u, { seed: `vt2${k}`, v: 1.4, keep: false, church: 0.1 }));
        const mx = gx + (80 + k * 230) * u; const mx2 = gx - (190 + k * 230) * u;
        if (mx < W + 20 * u) mills.push(windmill(p, mx, crest(mx) + 1.5 * u, u));
        if (mx2 > -20 * u) mills.push(windmill(p, mx2, crest(mx2) + 1.5 * u, u));
      }
      // Trees along the horizon: poplars in rows, oaks in clumps, none in the glow.
      for (let x = -10 * u; x < W + 10 * u; x += (5 + r() * 14) * u) {
        const d = Math.abs(x - gx);
        const nearTown = towns.length && [0, 1, 2, 3, 4, 5].some((k) => Math.abs(x - (gx - (84 + k * 230) * u)) < 20 * u);
        if (d < 34 * u || nearTown) { r(); r(); continue; }
        const b = crest(x) + 2 * u;
        if (r() < 0.45) poplar(p, x, b, (6 + r() * 6) * u, 1, 0.8, Math.floor(r() * 1e5));
        else if (r() < 0.6) oak(p, x, b, (4 + r() * 5) * u, 1, 0.7, Math.floor(r() * 1e5));
      }
      // The fields, and hedgerows across them.
      fields(p, W, hor, H, { u, gx, K: 30 * u, pw: 1.1, pd: 2.4, v0: 3.0, v1: 0.8, fall: 0.5, wheatV: 0.6, glow: open ? 7.4 : 6.2, reach: 46 * u, glowD: 4 * u, seed: 7, z: 2, keep: true });
      const rhw = (y) => 0.58 * (y - hor) + 0.4;
      hedge(p, W, hor + 2.6 * u, 1.1 * u, u, { v: 0.7, seed: 11, gap: (x) => Math.abs(x - gx) < rhw(hor + 2.6 * u) + 6 * u });
      hedge(p, W, hor + 6.5 * u, 1.6 * u, u, { v: 0.6, seed: 12, gap: (x) => Math.abs(x - gx) < rhw(hor + 6.5 * u) + 4 * u || (x > gx + 58 * u && x < gx + 84 * u) });
      for (let x = -10 * u; x < W; x += (16 + r() * 30) * u) {
        if (Math.abs(x - gx) < 40 * u) { r(); r(); continue; }
        if (r() < 0.5) oak(p, x, hor + 6.5 * u, (6 + r() * 4) * u, 2, 0.6, Math.floor(r() * 1e5));
      }
      // Stooks in the stubble.
      for (let x = 6 * u; x < W; x += (9 + r() * 12) * u) {
        const y = hor + (8.5 + r() * 3) * u;
        if (Math.abs(x - gx) < 40 * u) continue;
        stook(p, x, y, (2.6 + (y - hor) * 0.1) * u, 3, 2.2);
      }
      // The roads: the cross road the width of the board, the King's road coming down to it and going on.
      const cr0 = 71 * u; const cr1 = 76.5 * u;
      road(p, hor + 0.5, H, () => gx, rhw, { v0: open ? 10 : 7.6, v1: 3.4, pow: 0.42, z: 3 });
      road(p, cr0, cr1, () => gx, () => W, { v0: 4.4, v1: 4.8, z: 3 });
      p.shade(C.rect(0, cr0, W, cr1 - cr0), (x) => 2.4 * Math.exp(-(((x - gx) / (50 * u)) ** 2)), 3);
      puddle(p, gx - 11 * u, 91 * u, 5 * u, 1.3 * u, open ? 11.6 : 6.4);
      puddle(p, gx + 8 * u, 84 * u, 3.4 * u, 0.9 * u, open ? 12.4 : 7.6);
      // The gibbet to the left of the crossroads, against the glow.
      const gb = gibbet(p, gx - 54 * u, cr0 + 0.5, 18 * u, 15 * u, u, 4);
      // The signpost at the right corner, its lamp, the milestone; the shrine further on.
      const sp = signpost(p, gx + 30 * u, cr0 + 1, 44 * u, u, 4, { arms: [[-1, 2.5, 11], [1, 6.2, 10], [-1, 10, 6]], crook: 13, crookLen: 6 });
      const lp = lamp(p, sp.lx, sp.ly, u, 5);
      milestone(p, gx + 38 * u, cr0 + 2 * u, u, 4, 2.4, -1);
      const sh = shrine(p, gx + 66 * u, cr0 + 0.5, u, 4, 1.2);
      // Lamp posts along the cross road, each in its pool.
      const posts = [];
      for (let d = 112 * u; d < W; d += 118 * u) {
        for (const sd of [-1, 1]) {
          const x = gx + sd * d; if (x < -6 * u || x > W + 6 * u) continue;
          posts.push(lampPost(p, x, cr0 + 0.5, 15 * u, u, 4, -sd));
        }
      }
      // The card, at the crossroads.
      const fy = Math.round(75 * u);
      let tintAt = null; let litFig = true;
      if (cat === 'monster') {
        const m = rider(p, gx + 3 * u, fy, 43 * u, ramp, 6);
        p.tint(m.hx, m.hy, 6 * u, hex, 0.55, flicker(0.3, 0.3, 1.4));
        p.tint(m.ex, m.ey, 3.5 * u, hex, 0.45, flicker(1.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const l = pedlar(p, gx + 5 * u, fy, 39 * u, 6);
        const lw = lamp(p, l.lx, l.ly, u * 0.95, 8, { ramp, vIn: 4.4, vOut: 3 });
        tintAt = [lw.cx, lw.cy];
        p.tint(lw.cx, lw.cy, 5 * u, CARD[ramp][4], 0.5, flicker(0.9, 0.15));
        p.tint(lw.cx, lw.cy + 2 * u, 12 * u, hex, 0.3, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        wagon(p, gx + 4 * u, fy, 28 * u, 6);
        const b = strongbox(p, gx - 6 * u, fy + 4 * u, 28 * u, ramp, 8);
        tintAt = [b.gx, b.gy];
        p.tint(b.gx, b.gy - 2 * u, 7 * u, CARD[ramp][4], 0.4, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        const t = turnpike(p, gx, fy + 1 * u, u, ramp, 6);
        p.tint(t.lockX, t.lockY, 7 * u, CARD[ramp][4], 0.45, flicker(0.5, 0.12, 0.6));
      } else {
        litFig = false;
        // The sun's last edge where the road meets the horizon, its light laid down the road.
        const sx = gx; const sy = hor + 1.2 * u; const sr = 7.5 * u;
        p.shade(C.rect(0, 0, W, hor + 1), (x, y, i) => {
          if (p.z[i] !== 0) return 0;
          const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
          if (d < sr) return 0;
          const a = Math.atan2(y + 0.5 - sy, x + 0.5 - sx);
          return (frac((a / (Math.PI * 2)) * 22 + 0.25) < 0.42 ? 1.2 : 0) * clamp(1 - d / (60 * u), 0, 1);
        }, 0);
        p.each(C.circle(sx, sy, sr, 32), (x, y, i) => {
          if (p.z[i] <= 1 && y + 0.5 < hor + 0.6) { p.r[i] = p.ri('lamp'); p.v[i] = 4.4 - (Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / sr) * 0.8; p.z[i] = 0; }
        });
        p.light(gx, hor + 2 * u, 36 * u, 3.2, null, { zMin: 2, zMax: 3, sx: 0.7 });
        // the last light laid straight down the road toward you
        p.light(gx, hor, 40 * u, 3.4, null, { zMin: 3, zMax: 3, sx: 0.32, hard: true });
        p.tint(sx, sy - 1 * u, 13 * u, CARD.path[4], 0.45, flicker(0.4, 0.06, 0.3));
      }
      // The near wheat, low in the middle so the road stays clear; its ears catch the glow.
      nearWheat(p, W, H, (x) => {
        const d = Math.abs(x - gx) - rhw(H) - 1 * u;
        return d < 0 ? H + 5 : 95 * u - 12 * u * smooth(clamp(d / (40 * u), 0, 1)) - 3 * u * n1(x / (12 * u), 2);
      }, { u, v: 0.8, ear: 2.6, mass: 6, step: 2, seed: 9, lightAt: (x) => 2.6 * Math.exp(-(((x - gx) / (70 * u)) ** 2)) });
      // Light: the glow on the near fields, the lamps' pools.
      p.light(gx, hor, 64 * u, 1.6, null, { zMin: 2, zMax: 3, sx: 1.8, sy: 0.45 });
      p.light(lp.cx, lp.cy, 26 * u, 4.6, flicker(0.6, 0.12, 0.7), { zMin: 2, zMax: 5, hard: true });
      p.light(lp.cx, lp.cy, 44 * u, 1.2, null, { zMin: 2, zMax: 5 });
      posts.forEach((q, i) => { p.light(q.cx, q.cy, 22 * u, 3.4, flicker(i * 1.7, 0.14, 0.8), { zMin: 2, zMax: 5, hard: true }); });
      p.light(sh.cx, sh.cy, 8 * u, 2.2, flicker(2.2, 0.25, 1.2), { zMin: 2, hard: true });
      if (tintAt) p.light(tintAt[0], tintAt[1] + 3 * u, 14 * u, 2, null, { zMin: 2, zMax: 3, hard: true });
      // Rims: everything against the bright sky or the sheen catches the afterglow; the card's near side catches the signpost's lamp.
      backRim(p, 4, 0.8, 6.5); backRim(p, 1, 1.2, 6); backRim(p, 2, 1.2, 5.5); backRim(p, 3, 1, 4.5);
      if (litFig) { backRim(p, 6, 0.4, 3.5, ['sky', 'field', 'earth']); lampRim(p, 6, lp.cx, lp.cy, 24 * u, 10.6); }
      backRim(p, 8, 1, 4.5);
      vignette(p, W, H, 1.4, 0.5, 0);
      const cage = cageShape(13 * u); const chain = Math.round(7 * u);
      const crowsOn = [[gb.hx - 10 * u, gb.hy, 0], [gb.hx - 4 * u, gb.hy, 1]];
      const flock = [[gb.hx - 4 * u, 20 * u, 0], [gb.hx + 12 * u, 11 * u, 2.4], [gb.hx - 20 * u, 9 * u, 4.1]];
      const stars = [];
      for (let k = 0; k < (open ? Math.round(W / 5) : Math.round(W / 36)); k += 1) {
        const sx = hash(k, 1, 77) * W; const sy = hash(k, 2, 77) ** 1.5 * hor * 0.55;
        if (Math.abs(sx - gx) < 30 * u && sy > hor * 0.3) continue;
        stars.push([sx, sy, hash(k, 3, 77) * 6.28]);
      }
      return {
        p,
        over(img, t) {
          for (const [sx, sy, ph] of stars) put(img, sx, sy, '#FFF3D4', (open ? 0.6 : 0.3) + 0.35 * Math.sin(t * 1.7 + ph));
          for (const m of mills) sails(img, m, t, '#1A161D');
          for (const tw of towns) for (const [x, y] of tw) if (hash(x, y, 3) < 0.2 && Math.sin(t * 0.7 + x) > 0.6) put(img, x, y, '#1A161D');
          drawCage(img, gb.hx, gb.hy, chain, cage, 0.08 * Math.sin(t * 0.8), { i: '#0E0B0D', c: '#2B2B30', r: '#B07943', b: '#74675F' }, 1);
          crowsOn.forEach(([x, y, k], i) => sprite(img, Math.round(x), Math.round(y), CROW_SIT[Math.sin(t * 1.3 + i * 2) > 0.7 ? 1 : 0], { a: '#0A0808' }, k === 1));
          for (const [bx, by, ph] of flock) {
            const x = bx + Math.cos(t * 0.5 + ph) * 12 * u; const y = by + Math.sin(t * 0.5 + ph) * 3 * u;
            sprite(img, Math.round(x), Math.round(y), CROW_FLY[Math.floor(t * 4 + ph) % 3], { a: '#0E0B0C' });
          }
          posts.forEach((q, i) => { if (Math.sin(t * 2.3 + i) > 0.2) put(img, q.cx + Math.sin(t * 3 + i) * 3 * u, q.cy - 2 * u + Math.cos(t * 2.1 + i) * 2 * u, '#C9AF95', 0.7); });
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['lamp'], dither: 0.28 });
      const u = H / 250; const gx = W / 2;
      const hor = Math.round(50 * u);
      const r = rng('kr-world');
      duskSky(p, W, hor + 1, { u, gx, rx: 200 * u, ry: 60 * u, top: 0.6, low: 6.6, peak: 7.6, clouds: [[gx - 80 * u, 34 * u, 70 * u, 7 * u], [gx + 96 * u, 22 * u, 60 * u, 5.5 * u], [gx + 10 * u, 10 * u, 50 * u, 4 * u]] });
      const crest = (x) => hor - 1 * u - (1.5 + 6 * smooth(clamp((Math.abs(x - gx) - 20 * u) / (90 * u), 0, 1))) * u * (0.6 + 0.5 * n1(x / (30 * u), 3));
      farHills(p, W, crest, hor + 3 * u, { gx, reach: 60 * u, v: 1.4, lit: 2.6, z: 1 });
      town(p, gx - 112 * u, crest(gx - 112 * u) + 2 * u, 40 * u, u, { seed: 'wt', v: 1.3 });
      const mill = windmill(p, gx + 122 * u, crest(gx + 122 * u) + 1.5 * u, u);
      for (let x = 0; x < W; x += (6 + r() * 16) * u) {
        if (Math.abs(x - gx) < 40 * u || Math.abs(x - (gx - 112 * u)) < 26 * u || Math.abs(x - (gx + 122 * u)) < 6 * u) { r(); r(); continue; }
        if (r() < 0.5) poplar(p, x, crest(x) + 2 * u, (6 + r() * 6) * u, 1, 0.8, Math.floor(r() * 1e5));
        else oak(p, x, crest(x) + 2 * u, (4 + r() * 4) * u, 1, 0.7, Math.floor(r() * 1e5));
      }
      // The fields, falling into the dark toward the hand.
      fields(p, W, hor, H, { u, gx, K: 56 * u, pw: 0.9, pd: 2.6, v0: 3.0, v1: 0.5, fall: 0.42, wheatV: 0.6, glow: 5, reach: 60 * u, glowD: 4 * u, seed: 21, z: 2, keep: true });
      const rhw = (y) => 0.42 * (y - hor) + 0.4;
      hedge(p, W, hor + 4 * u, 1.6 * u, u, { v: 0.6, seed: 31, gap: (x) => Math.abs(x - gx) < rhw(hor + 4 * u) + 3 * u });
      hedge(p, W, hor + 13 * u, 2.4 * u, u, { v: 0.5, seed: 32, gap: (x) => Math.abs(x - gx) < rhw(hor + 13 * u) + 4 * u });
      for (let x = 10 * u; x < W; x += (12 + r() * 14) * u) {
        const y = hor + (20 + r() * 14) * u;
        if (Math.abs(x - gx) < rhw(y) + 12 * u) continue;
        stook(p, x, y, (3 + (y - hor) * 0.1) * u, 3, 1.8);
      }
      road(p, hor + 0.5, H, () => gx, rhw, { v0: 6.4, v1: 0.6, pow: 0.4, z: 3 });
      road(p, hor + 6 * u, hor + 11 * u, () => gx, () => W, { v0: 2.6, v1: 2.6, z: 3 });
      for (const [x, y, rx, v] of [[gx - 20 * u, 120 * u, 7, 3.6], [gx + 15 * u, 94 * u, 5, 4], [gx - 28 * u, 176 * u, 9, 2.4]]) puddle(p, x, y, rx * u, rx * 0.26 * u, v);
      // The margins: a lamp post on the left, the shrine on the right, a milestone, the near wheat along the foot.
      // (both low in the corners, clear of the caption, the river and the hand)
      const lpost = lampPost(p, 13 * u, 246 * u, 66 * u, u * 1.5, 4, 1);
      const sh = shrine(p, W - 22 * u, 236 * u, u * 2.2, 4, 1.4);
      for (const [dx, dy] of [[-5, 1], [4, 2], [-2, 3]]) { dot(p, sh.cx + dx * u, 236 * u + dy * u, 'lamp', 3.4, 5); dot(p, sh.cx + dx * u, 236 * u + dy * u + 1, 'stone', 3, 5); }
      milestone(p, gx - rhw(150 * u) - 24 * u, 150 * u, u * 1.5, 4, 1.8, -1);
      // Stooks in the stubble, their tops catching the last of the glow.
      for (let x = 14 * u; x < W; x += (10 + r() * 12) * u) {
        const y = hor + (26 + r() * 30) * u;
        if (Math.abs(x - gx) < rhw(y) + 14 * u) continue;
        stook(p, x, y, (3 + (y - hor) * 0.1) * u, 5, 2.8);
      }
      // A post-and-rail fence down both sides of the road, running away to the glow.
      for (const sd of [-1, 1]) fence(p, hor, H, sd, (y) => gx + sd * rhw(y), { K: 300 * u, k0: 1.5, n: 70, v: 2.6, hk: 0.19, wk: 0.018, gap: 0.07, skip: (k) => sd < 0 && k === 3 });
      // The near wheat: a ragged fringe at the bottom corners, outside the fence.
      const ears = nearWheat(p, W, H, (x) => {
        const d = Math.abs(x - gx) - rhw(H) - 0.07 * (H - hor) - 8 * u;
        if (d < 0) return H + 5;
        return H - 16 * u - 22 * u * n1(x / (11 * u), 2) - 8 * u * n1(x / (4 * u), 5) + 40 * u * (1 - smooth(clamp(d / (14 * u), 0, 1)));
      }, { u, v: 0.8, ear: 2.4, mass: 6, step: 2, seed: 19, z: 6, wide: true, lightAt: (x, y) => 5 * Math.max(0, 1 - Math.hypot(x - lpost.cx, y - lpost.cy) / (80 * u)) + 4 * Math.max(0, 1 - Math.hypot(x - sh.cx, y - sh.cy) / (60 * u)) });
      // The glow at the top, down the far road; the lamps at the margins.
      p.light(gx, hor, 70 * u, 2, null, { zMin: 2, zMax: 3, sx: 2, sy: 0.35 });
      p.light(lpost.cx, lpost.cy, 46 * u, 4.6, flicker(0.4, 0.14, 0.8), { zMin: 2, hard: true });
      p.light(lpost.cx, lpost.cy, 80 * u, 1.2, null, { zMin: 2 });
      p.light(sh.cx, sh.cy, 34 * u, 3.6, flicker(2.2, 0.25, 1.2), { zMin: 2, hard: true });
      backRim(p, 1, 1.2, 5); backRim(p, 4, 1.2, 4);
      p.rim(0, -1, 1.4, 5);
      p.shade(null, (x, y, i) => (p.z[i] === 0 ? 0 : -2.2 * Math.max(0, y / H - 0.34)));
      return {
        p,
        over(img, t) {
          sails(img, mill, t, '#1A161D');
          for (let k = 0; k < 5; k += 1) {
            const ph = hash(k, 1, 91) * 6.28; const sp = 6 + hash(k, 2, 91) * 6;
            const x = ((hash(k, 3, 91) * W + t * sp) % (W + 20)) - 10; const y = (2 + hash(k, 4, 91) * 10) * u + Math.sin(t * 0.8 + ph) * 2;
            sprite(img, Math.round(x), Math.round(y), CROW_FLY[Math.floor(t * 4 + ph) % 3], { a: '#0E0B0C' });
          }
          for (let k = 0; k < 4; k += 1) put(img, lpost.cx + Math.sin(t * 2.6 + k * 1.7) * 5 * u, lpost.cy + Math.cos(t * 2 + k) * 4 * u, '#C9AF95', 0.6);
          // the near wheat leaning in the wind: its ears nudged a pixel
          for (const [x, y, eh] of ears) {
            if (hash(x, 5, 3) > 0.5) continue;
            const s = Math.round(Math.sin(t * 1.6 + x * 0.09) * 1.2);
            if (!s) continue;
            for (let k = 0; k < eh; k += 1) put(img, x + s, y + k, '#2F2411', 0.9);
          }
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A]);
})();

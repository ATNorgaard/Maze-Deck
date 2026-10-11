/* The Barrow Moor, the edge of the Shadowfell: the moor outside, the barrow inside. */
(() => {
  const { C, Painter, put, sprite, particles, flicker, CARD, hash, clamp, lerp, rng } = PX;

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

  /* ---------- shared drawing ---------- */

  /** One pixel, straight into the painter. */
  function dot(p, x, y, ri, v, z) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    const i = y * p.w + x; p.r[i] = ri; p.v[i] = v; p.z[i] = z;
  }

  /** A limb, a shaft or a blade from (x0, y0) to (x1, y1), w0 wide tapering to w1; a line of pixels when thin. */
  function limb(p, x0, y0, x1, y1, w0, w1, ramp, v, z) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.01) return;
    if (Math.max(w0, w1) < 1.6) {
      const ri = p.ri(ramp); const n = Math.ceil(len * 1.5);
      for (let k = 0; k <= n; k += 1) dot(p, lerp(x0, x1, k / n), lerp(y0, y1, k / n), ri, v, z);
      return;
    }
    const nx = -(y1 - y0) / len / 2; const ny = (x1 - x0) / len / 2;
    p.fill(C.poly([[x0 + nx * w0, y0 + ny * w0], [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w0, y0 - ny * w0]]), ramp, v, z);
  }

  /** The edge of a figure toward a light: its pixels on layer z whose neighbour (dx, dy) is on a lower layer. */
  function edge(p, z, dx, dy, ramp, v, add = false) {
    const r = p.ri(ramp); const hit = [];
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
        if (p.z[ny * p.w + nx] < z) hit.push(i);
      }
    }
    for (const i of hit) { if (add) p.v[i] += v; else { p.r[i] = r; p.v[i] = v; } }
  }

  /** Keep what lies under a shape, to put it back after something is drawn over it (a window in a wall). */
  function keep(p, shape) {
    const saved = [];
    p.each(shape, (x, y, i) => saved.push(i, p.r[i], p.v[i], p.z[i]));
    return () => { for (let k = 0; k < saved.length; k += 4) { const i = saved[k]; p.r[i] = saved[k + 1]; p.v[i] = saved[k + 2]; p.z[i] = saved[k + 3]; } };
  }

  /** Cup and ring: a carved hollow with a ring or two round it, its grooves catching the light. */
  function cupRing(p, cx, cy, r, z, dv = 1.2, rings = 2) {
    p.shade(C.circle(cx, cy, r + 1), (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d < Math.max(0.8, r * 0.28)) return -dv;
      if (Math.abs(d - r) < 0.55) return dv;
      if (rings > 1 && Math.abs(d - r * 0.6) < 0.5) return dv * 0.8;
      return 0;
    }, z);
  }

  /** A spiral cut in stone, a pixel wide: `turns` turns out to radius r. Returns its points. */
  function spiralPts(cx, cy, r, turns, flip = 1, a0 = 0) {
    const pts = []; const n = Math.ceil(r * turns * 7);
    for (let k = 0; k <= n; k += 1) {
      const t = k / n; const a = a0 + flip * t * turns * Math.PI * 2; const rr = r * t;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  }

  /* Small sprites. */
  const CROW = { a: '#030404', b: '#1F2423' };
  const CROW_SIT = ['...ab', '.aaa.', 'aaaa.', '..a..'];
  const CROW_FLY = [['a.....a', '.aa.aa.', '...a...'], ['.......', 'aaaaaaa', '..aaa..'], ['.......', '.aaaaa.', 'a.aaa.a']];
  const WISP_C = { a: '#3C596D', b: '#8DAEC2', c: '#D3E3EC', d: '#FFFFFF' };
  const WISP = [
    ['..a..', '..a..', '.aba.', '.bcb.', 'abcba', 'bcdcb', '.bcb.', '..b..'],
    ['.a...', '..a..', '.ab..', '.bcb.', 'abcba', 'bcdcb', '.bcb.', '..b..'],
    ['...a.', '..a..', '..ba.', '.bcb.', 'abcba', 'bcdcb', '.bcb.', '..b..'],
  ];
  /** A ghost-light near to: a cold flame with a long licking tip and nothing under it. */
  const WISP_BIG = [
    ['...a...', '...a...', '..ab...', '..bb...', '..bca..', '.abcba.', '.bcdcb.', 'abcdcba', '.bcdcb.', '..bcb..', '...b...'],
    ['...a...', '....a..', '...ba..', '...bb..', '..acb..', '.abcba.', '.bcdcb.', 'abcdcba', '.bcdcb.', '..bcb..', '...b...'],
    ['..a....', '...a...', '...ba..', '..bb...', '..bca..', '.abcba.', '.bcdcb.', 'abcdcba', '.bcdcb.', '..bcb..', '...b...'],
  ];
  /** A ghost-light far off: a point and a little halo, drifting. */
  function wispDot(img, x, y, a) {
    put(img, x, y, '#FFFFFF', a);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(img, x + dx, y + dy, '#8DAEC2', a * 0.55);
    put(img, x, y + 2, '#517489', a * 0.35);
  }
  /** Rags tied to the dead tree, stirring. */
  function rags(img, list, t) {
    for (const [x, y, s] of list) {
      const n = 2 + (s % 2);
      for (let k = 0; k < n; k += 1) put(img, x + Math.round(Math.sin(t * 2.2 + s) * 0.5 * k), y + k, k ? '#5E6461' : '#A7ADA8', 0.95);
    }
  }

  /** Edges toward the moon: pixels on the given layers whose neighbour toward it (sideways, else above) lies further back. */
  function moonEdge(p, zs, mx, side, top) {
    const on = new Uint8Array(32); for (const z of zs) on[z] = 1;
    const add = new Float32Array(p.w * p.h);
    for (let y = 1; y < p.h; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x; const z = p.z[i];
        if (!on[z]) continue;
        const dx = x + 0.5 < mx ? 1 : -1;
        if (p.z[i + dx] < z) add[i] = side;
        else if (p.z[i - p.w] < z) add[i] = top;
      }
    }
    for (let i = 0; i < add.length; i += 1) p.v[i] += add[i];
  }

  /* Shared materials: one stone, one spectral light, inside and out. */
  // Lichened grey-green in the dark, climbing to the ghost-light's pale blue.
  const STONE = ['#050605', '#0B0D0B', '#121512', '#1A1E1B', '#242A27', '#313937', '#424C4E', '#58666D', '#748792', '#98ACB8', '#C4D4DE'];
  const GHOST = ['#142029', '#1E303C', '#2B4353', '#3C596D', '#517489', '#6C91A7', '#8DAEC2', '#B1CADA', '#D3E3EC', '#EEF6FA', '#FFFFFF'];
  const SHADOW = ['#020303', '#050707', '#090C0C', '#0E1212'];

  /**
   * Three stones: two uprights and a lintel laid across them, rough-hewn,
   * the doorway of the moor and of the barrow alike. Returns the shapes.
   */
  function trilithon(p, gx, top, hw, floor, u, o = {}) {
    const z = o.z ?? 5; const t = o.t ?? 7 * u; const v = o.v ?? 1.2; const lt = o.lt ?? 7 * u; const seed = o.seed ?? 3;
    const up = [-1, 1].map((m) => {
      const xi = gx + m * hw; const xo = gx + m * (hw + t);
      return C.poly([[xi, floor + 1], [xi + m * 0.5 * u, lerp(top, floor, 0.55)], [xi - m * 0.3 * u, top + 2 * u], [xi, top + 1],
        [xo - m * 0.6 * u, top + 1], [xo + m * 0.4 * u, top + 3 * u], [xo + m * 0.9 * u, lerp(top, floor, 0.6)], [xo + m * 1.5 * u, floor + 1]]);
    });
    const lintel = C.poly([[gx - hw - t - 3 * u, top + 1], [gx - hw - t - 2.4 * u, top - lt * 0.85], [gx - hw * 0.3, top - lt], [gx + hw * 0.6, top - lt * 0.96],
      [gx + hw + t + 2.2 * u, top - lt * 0.9], [gx + hw + t + 3.4 * u, top + 1.4]]);
    for (const [k, sh] of [...up, lintel].entries()) {
      p.fill(sh, 'stone', (x, y) => v + (n2(x / (3 * u), y / (3 * u), seed + k) > 0.64 ? 0.6 : 0), z);
      p.cells(sh, { size: Math.max(3, 4 * u), joint: 0.5, jointV: -0.7, vary: 0.5, bevel: 0.35, seed: seed + k * 7, z });
    }
    return { up, lintel, open: C.poly([[gx - hw, floor], [gx - hw, top], [gx + hw, top], [gx + hw, floor]]) };
  }

  /* ================= A: the moor ================= */

  const RAMPS_A = {
    // The night: grey-blue, never the ice blue of the pass; paler toward the moon.
    sky: ['#040607', '#070A0C', '#0B1013', '#10171B', '#161F24', '#1D282E', '#26333A', '#314048', '#3F4F58', '#52636C', '#6A7C85', '#8798A0', '#A9B8BE', '#CBD7DB'],
    moon: ['#7F8E95', '#A3B1B6', '#C2CED1', '#DAE3E5', '#EBF1F2', '#F7FAFA'],
    hill: ['#050708', '#090C0D', '#0E1213', '#141A1B', '#1B2223', '#232B2C', '#2D3637', '#394344', '#47524F'],
    // Moor grass: green-black in the dark, olive-grey, pale blue-grey where the moon touches it.
    grass: ['#050705', '#090C08', '#0E120C', '#141911', '#1A2117', '#21291D', '#2A3325', '#353F2F', '#444F3D', '#57614F', '#6F7A69', '#8C978A', '#AEB9B3'],
    stone: STONE,
    mist: ['#121A1E', '#1A2429', '#232F35', '#2E3B42', '#3B4951', '#4B5A62', '#5E6E76', '#74848B', '#8D9CA2', '#AAB7BC', '#C8D2D5'],
    wood: ['#060606', '#0C0B0A', '#131210', '#1B1916', '#24211D', '#2E2A25', '#3A352E', '#484238', '#585145', '#6B6456'],
    shadow: SHADOW,
    ghost: GHOST,
    ...CARD,
  };
  // Layers: 0 sky and moon, 1 far land, 2 the far stones and barrows, 3 mist, 4 the churchyard, tree and barrow,
  // 5 the moor, 6 the three stones, 7+ the card, 9 the near grass.

  /**
   * The night over the moor: near black overhead, paling toward a huge low
   * moon whose halo lights the middle of the sky. The moon is a pale disc
   * with grey seas; long thin clouds cross the sky, dark on the disc and
   * silvered along their tops near it. clouds: [cx, cy, half-length, thickness].
   */
  function moonSky(p, W, y1, o) {
    const { u, mx, my, mr } = o; const seed = o.seed || 3;
    const R = o.halo ?? mr * 2.6; const glow = o.glow ?? 6.5; const base = o.base ?? 2;
    const S = p.ri('sky'); const M = p.ri('moon');
    const clouds = (o.clouds || []).map(([ccx, ccy, hl, th], k) => ({ ccx, ccy, hl, th, k }));
    const seas = [[-0.32, -0.22, 0.3, 0.2], [0.14, -0.32, 0.22, 0.16], [0.2, 0.05, 0.3, 0.22], [-0.12, 0.36, 0.2, 0.15], [0.46, 0.38, 0.12, 0.1], [-0.5, 0.2, 0.1, 0.12]];
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const cx = x + 0.5; const cy = y + 0.5;
      const dm = Math.hypot(cx - mx, cy - my);
      const h = clamp(1 - (dm - mr) / R, 0, 1); const h2 = h * h;
      p.z[i] = 0; p.r[i] = S;
      for (const c of clouds) {
        const f = (cx - c.ccx) / c.hl;
        if (Math.abs(f) >= 1) continue;
        const prof = Math.sqrt(1 - f * f);
        const lump = 0.55 + 0.45 * n1(cx / (3 * u) + c.k * 7, seed + 11) + 0.3 * n1(cx / (9 * u) + c.k * 3, seed + 12);
        const top = c.ccy - c.th * prof * lump; const bot = c.ccy + c.th * prof * 0.4;
        if (cy < top || cy > bot) continue;
        const into = (cy - top) / Math.max(1, u);
        const lit = into < 1 ? 1 : into < 2 ? 0.4 : 0;
        p.v[i] = (dm < mr ? 7.4 : 1.4 + glow * 0.6 * h2) + lit * (1 + 4.4 * h2);
        return;
      }
      if (dm < mr) {
        p.r[i] = M;
        const qx = (cx - mx) / mr; const qy = (cy - my) / mr;
        let v = 4.3;
        for (const [sx, sy, rx, ry] of seas) if (((qx - sx) / rx) ** 2 + ((qy - sy) / ry) ** 2 < 1) { v = 3.1 + (n2(cx / (2 * u), cy / (2 * u), seed) > 0.6 ? 0.6 : 0); break; }
        if (dm > mr - 1.3) v -= 0.9;       // the limb
        else if (qx + qy > 0.9) v -= 0.5;  // a shade toward its lower right
        p.v[i] = v;
        return;
      }
      let v = 0.5 + base * clamp(cy / y1, 0, 1) ** 1.6 + glow * h2;
      // A pale haze along the skyline, so what stands on it reads even far from the moon.
      if (o.hz !== undefined) v += (o.hzk ?? 2.4) * Math.exp(-(((o.hz - cy) / (o.hzw ?? 12 * u)) ** 2));
      if (dm < mr + 1.2) v += 1.2;
      if (hash(x, y, seed + 7) < (o.stars ?? 0.006) && h < 0.25 && cy < y1 * 0.6) v = 5 + hash(x, y, seed + 8) * 3;
      p.v[i] = v;
    });
  }

  /** Land against the sky: filled from topAt(x) down to y1, the value as fn(x, y, depth below the skyline). */
  function land(p, W, topAt, y1, ramp, v, z) {
    const R = p.ri(ramp);
    for (let x = 0; x < W; x += 1) {
      const t = topAt(x + 0.5);
      for (let y = Math.max(0, Math.floor(t)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
        if (y + 0.5 < t) continue;
        const i = y * W + x; p.r[i] = R; p.v[i] = v(x, y, y + 0.5 - t); p.z[i] = z;
      }
    }
  }

  /** The far moor's skyline: long low rises, a few round barrows and tiny stones on it. */
  function farLand(p, W, u, y, y1, o = {}) {
    const seed = o.seed ?? 1; const r = rng(`far-${seed}`);
    const bumps = []; const stones = [];
    for (let x = r() * 30 * u; x < W; x += (24 + r() * 40) * u) {
      if (o.skip && o.skip(x)) continue;
      if (r() < 0.5) bumps.push([x, (5 + r() * 6) * u, (2 + r() * 2.4) * u]);
      else for (let k = 0, n = 2 + Math.floor(r() * 4); k < n; k += 1) stones.push([x + k * (2 + r() * 2) * u, Math.max(1, (0.6 + r() * 0.8) * u), (1.4 + r() * 2.4) * u]);
    }
    const top = (x) => {
      let t = y + (n1(x / (46 * u), seed) - 0.5) * 6 * u + (n1(x / (11 * u), seed + 1) - 0.5) * 1.2 * u;
      let b = 0;
      for (const [bx, bw, bh] of bumps) { const q = (x - bx) / bw; if (Math.abs(q) < 1) b = Math.max(b, bh * (1 - q * q) ** 0.6); }
      for (const [sx, sw, sh] of stones) if (x >= sx && x < sx + sw) b = Math.max(b, sh);
      return t - b;
    };
    land(p, W, top, y1, 'hill', (x, yy, d) => (o.v ?? 1.4) + (d < 1 ? (o.lip ?? 0.8) : 0) - Math.min(1, d / (8 * u)) * 0.5, o.z ?? 1);
    return top;
  }

  /** A standing stone: a rough slab, leaning a little, its top worn round or snapped off; lichen in patches. */
  function stone(p, cx, by, w, h, o = {}) {
    const seed = o.seed ?? 1; const r = rng(seed * 7 + 3); const z = o.z ?? 2; const u = o.u || 1;
    const lean = (o.lean ?? (r() - 0.5) * 0.24) * h;
    const jit = () => (r() - 0.5) * 0.16 * w;
    const L = []; const Rt = [];
    for (const t of [0, 0.24, 0.48, 0.7, 0.84]) {
      const half = (w / 2) * (1 - 0.26 * t + 0.12 * Math.sin(t * Math.PI));
      L.push([cx + lean * t - half + jit(), by - h * t]);
      Rt.push([cx + lean * t + half + jit(), by - h * t]);
    }
    const tx = cx + lean; const hw = (w / 2) * 0.74;
    const top = r() < (o.snap ?? 0.3)
      ? [[tx - hw, by - h * (0.95 + r() * 0.05)], [tx + hw * 0.1, by - h * (0.9 + r() * 0.04)], [tx + hw, by - h * (0.8 + r() * 0.06)]]
      : [[tx - hw * 0.85, by - h * 0.94], [tx - hw * 0.25, by - h], [tx + hw * 0.4, by - h * 0.985], [tx + hw * 0.9, by - h * 0.92]];
    const shape = C.poly([...L, ...top, ...Rt.reverse()]);
    p.fill(shape, 'stone', (x, y) => (o.v ?? 1.4) + (n2(x / (2.5 * u), y / (2.5 * u), seed + 5) > 0.64 ? 0.6 : 0), z);
    if (w > 4 * u) p.cells(shape, { size: Math.max(3, w * 0.45), joint: 0.5, jointV: -0.7, vary: 0.5, bevel: 0.35, seed: 3 + (seed % 50), z });
    return shape;
  }

  /** A round barrow: a grassy dome, tussocky, its skyline lit; returns its top edge. */
  function mound(p, cx, by, w, h, o = {}) {
    const u = o.u || 1; const z = o.z ?? 2; const seed = o.seed ?? 1;
    const topAt = (x) => { const t = (x - cx) / w; return Math.abs(t) >= 1 ? Infinity : by - h * (1 - t * t) ** 0.6 - (n1(x / (4 * u), seed) - 0.5) * 1.4 * u; };
    const tu = { rows: o.rows ?? 2.4, d0: 2, cw: 0.7, density: 0.9, tip: o.tip ?? 0.9, dark: 0.6, seed };
    p.fill(C.rect(cx - w, by - h - 2 * u, 2 * w, h + 2 * u + 1), 'grass', (x, y) => {
      const ty = topAt(x + 0.5); const d = y + 0.5 - ty;
      if (d < 0) return null;
      let v = (o.v ?? 1.6) - Math.min(1, d / h) * (o.fall ?? 0.6) + (h > 6 * u ? tussocks(p, x, y, d + 2 * u, tu, u) * 0.8 : 0);
      if (d < 1) v += o.lip ?? 1.4;
      return v;
    }, z);
    return topAt;
  }

  /** A barrow's entrance: two uprights and a lintel round a black opening. */
  function tombDoor(p, cx, by, hw, h, u, o = {}) {
    const z = o.z ?? 2; const t = Math.max(1.5, (o.t ?? 2.4) * u); const v = o.v ?? 2;
    p.fill(C.rect(cx - hw, by - h, 2 * hw, h), 'shadow', 0, z);
    for (const m of [-1, 1]) p.fill(C.poly([[cx + m * hw, by], [cx + m * hw, by - h], [cx + m * (hw + t), by - h], [cx + m * (hw + t * 1.25), by]]), 'stone', v, z);
    p.fill(C.poly([[cx - hw - t * 1.6, by - h + 0.5], [cx - hw - t * 1.4, by - h - t * 1.1], [cx + hw + t * 1.5, by - h - t], [cx + hw + t * 1.7, by - h + 0.5]]), 'stone', v + 0.8, z);
  }

  /**
   * Mist lying in the hollows: a rolling top edge lit by the moon, thinning
   * downward in clean steps until the grass shows through, brightest under
   * the moon.
   */
  function mist(p, W, o) {
    const { u, y0, y1 } = o; const z = o.z ?? 3; const seed = o.seed ?? 1;
    const r = rng(`mist-${seed}`);
    // Billows along the top, and a second, nearer bank rolling in lower down.
    const billows = (bw, bh, s) => {
      const out = [];
      for (let x = -20 * u; x < W + 20 * u; x += bw * u * (0.45 + r() * 0.7)) out.push([x, bw * u * (0.5 + r() * 0.8), bh * u * (0.35 + r() * 0.9)]);
      return (x) => {
        let b = 0;
        for (const [bx, w, h] of out) { const q = (x - bx) / w; if (Math.abs(q) < 1) b = Math.max(b, h * Math.sqrt(1 - q * q)); }
        return b + (n1(x / (44 * u), s) - 0.5) * (o.amp ?? 3) * u;
      };
    };
    const b1 = billows(o.bw ?? 9, o.bh ?? 3, seed); const b2 = billows((o.bw ?? 9) * 1.3, (o.bh ?? 3) * 0.9, seed + 4);
    const gap = (o.gap ?? 0.45) * (y1 - y0);
    const T1 = new Float32Array(W); const T2 = new Float32Array(W);
    let ymin = y1;
    for (let x = 0; x < W; x += 1) { T1[x] = y0 - b1(x + 0.5); T2[x] = y0 + gap - b2(x + 0.5); ymin = Math.min(ymin, T1[x]); }
    const M = p.ri('mist');
    for (let y = Math.max(0, Math.floor(ymin)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      for (let x = 0; x < W; x += 1) {
        const yy = y + 0.5; const t1 = T1[x]; const t2 = T2[x];
        if (yy < t1) continue;
        const near = yy >= t2;
        const d = near ? yy - t2 : yy - t1;
        const span = near ? y1 - t2 : t2 - t1 + 2 * u;
        let v = o.v - (near ? 0.6 : 0) - clamp(d / Math.max(1, span), 0, 1) * (o.fall ?? 3);
        if (d < 1) v += o.lip ?? 1.2;
        else if (d < 2) v += (o.lip ?? 1.2) * 0.4;
        if (o.mx !== undefined) v += (o.moon ?? 2) * Math.max(0, 1 - Math.abs(x + 0.5 - o.mx) / o.mw) ** 1.5;
        // The bottom of each bank breaks into streaks the grass shows through.
        if (near && yy > y1 - (y1 - t2) * 0.5 && n2(x / (12 * u), yy / (1.3 * u), seed + 3) < 0.25 + (yy - t2) / (y1 - t2) * 0.5) continue;
        v = Math.round(v);
        if (v < (o.cut ?? 1)) continue;
        const i = y * W + x; p.r[i] = M; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /**
   * Fog lying in layers: long thin lenses of mist stacked from far to near,
   * the far ones paler (the moon is behind them), each with a lit top edge
   * and a flat underside, gaps between them where the moor shows through.
   */
  function fog(p, W, o) {
    const { u, y0, y1 } = o; const z = o.z ?? 3; const r = rng(`fog-${o.seed ?? 1}`); const M = p.ri('mist');
    const lenses = [];
    const n = Math.round((W / u) / (o.len ?? 40) * (o.layers ?? 4));
    for (let k = 0; k < n; k += 1) {
      const t = r() ** (o.bias ?? 0.8);
      lenses.push({ cx: -20 * u + r() * (W + 40 * u), cy: lerp(y0, y1, t), t, hl: (o.len ?? 40) * u * (0.4 + r() * 0.8) / 2, th: (o.th ?? 2.4) * u * (0.6 + r() * 0.8), s: k * 7 + 1 });
    }
    lenses.sort((a, b) => a.cy - b.cy);
    const skip = new Uint8Array(p.names.length); for (const n2r of ['moon', 'ghost', 'path']) if (p.names.includes(n2r)) skip[p.ri(n2r)] = 1;
    const keepK = o.keep ?? 0.55;
    for (const L of lenses) {
      const x0 = Math.max(0, Math.floor(L.cx - L.hl)); const x1 = Math.min(W - 1, Math.ceil(L.cx + L.hl));
      const near = o.mx === undefined ? 0 : (o.moon ?? 2) * Math.max(0, 1 - Math.abs(L.cx - o.mx) / o.mw) ** 1.5;
      for (let x = x0; x <= x1; x += 1) {
        const q = (x + 0.5 - L.cx) / L.hl;
        if (Math.abs(q) >= 1) continue;
        const half = L.th * Math.sqrt(1 - q * q) * (0.6 + 0.4 * n1(x / (5 * u), L.s));
        const top = L.cy - half * 1.4; const bot = L.cy + half * 0.6;
        for (let y = Math.max(0, Math.floor(top)); y < Math.min(p.h, Math.ceil(bot)); y += 1) {
          const yy = y + 0.5;
          if (yy < top || yy > bot) continue;
          const i = y * W + x;
          if (skip[p.r[i]]) continue;
          // Translucent: what is behind shows through, flattened, under a lift that is thickest along the lens' middle.
          // Feathered: the lift falls off toward the lens' edges and ends, so only its edges dither.
          const f = 1 - Math.abs(yy - L.cy) / (yy < L.cy ? half * 1.4 : half * 0.6);
          const feather = smooth(clamp(f * 1.6, 0, 1)) * smooth(clamp((1 - Math.abs(q)) * 3, 0, 1));
          const lift = (o.v - L.t * (o.fall ?? 2.4) + near * (1 - Math.abs(q) * 0.5)) * feather;
          let v = (o.base ?? 0) + Math.min(p.v[i], 6) * keepK + lift;
          if (p.r[i] === M) v = Math.max(v, p.v[i]);
          p.r[i] = M; p.v[i] = v;
          if (p.z[i] < z) p.z[i] = z;
        }
      }
    }
  }

  /** Long wisps of mist hanging over the far moor: thin bright streaks with gaps in them. */
  function mistWisps(p, W, y, u, o = {}) {
    const r = rng(`wisp-${o.seed ?? 1}`); const M = p.ri('mist'); const z = o.z ?? 2;
    for (let k = 0; k < (o.n ?? 6); k += 1) {
      const cx = r() * W; const len = (20 + r() * 40) * u; const yy = Math.round(y + (r() - 0.5) * (o.spread ?? 6) * u);
      for (let x = Math.floor(cx - len / 2); x < cx + len / 2; x += 1) {
        if (x < 0 || x >= W || n1(x / (5 * u), k + 30) < 0.35) continue;
        const i = yy * W + x; if (p.z[i] > z) continue;
        p.r[i] = M; p.v[i] = (o.v ?? 4) + (Math.abs(x - cx) < len * 0.25 ? 1 : 0); p.z[i] = z;
      }
    }
  }

  /** The moor toward us: rows of tussocks widening as they come, each lit along its top, a shadow under it. */
  /**
   * Tussocks: clumps of moor grass in rows that widen toward us, each clump
   * a dome lit along its top with a blade or two standing off it, dark in
   * the gaps between. `inside(x, y)` limits it to a shape.
   */
  function tussocks(p, x, y, d, o, u) {
    const d0 = (o.d0 ?? 3) * u;
    // Rows widen toward us in perspective, up to a size where the near grass still has texture.
    const dMax = (o.dMax ?? 26) * u;
    const rowPx = (Math.min(d, dMax) + d0) / o.rows;
    // The rows wander, so they never line up across the moor.
    const q = (d < dMax ? Math.log(1 + d / d0) * o.rows : Math.log(1 + dMax / d0) * o.rows + (d - dMax) / rowPx) + (n1(x / (rowPx * 3 + 6 * u), o.seed + 5) - 0.5) * 0.9;
    const row = Math.floor(q); const fy = frac(q);
    const cw = (o.cw ?? 0.9) * rowPx * 2.2;
    // Clumps of uneven width along each row.
    const c = x / cw + hash(row, 0, o.seed) * 13 + n1(x / (cw * 2.3), row * 7 + o.seed) * 1.4; const ci = Math.floor(c); const fx = frac(c);
    if (hash(ci, row, o.seed + 1) > (o.density ?? 0.72)) return -o.dark * 0.6;
    const peak = 0.05 + hash(ci, row, o.seed + 2) * 0.45; const lean = (hash(ci, row, o.seed + 4) - 0.5) * 0.5;
    const fxl = clamp(fx + lean * fx * (1 - fx) * 2, 0, 1);
    // A ragged top: blades standing up out of it here and there.
    const top = peak + (1 - peak) * (1 - Math.sin(fxl * Math.PI) ** 0.7) - (hash(x, row, o.seed + 6) < 0.3 ? 1.6 / rowPx : 0);
    const into = (fy - top) * rowPx;
    if (into < 0) return (into > -1.2 && hash(x, row, o.seed + 3) < 0.22) ? o.tip * 0.7 : -o.dark;
    if (into < 1.2) return o.tip * (fxl < 0.7 ? 1 : 0.6);
    return (fxl > 0.62 ? -0.4 : 0.15) - (fy > 0.9 ? 0.3 : 0) + (hash(x >> 1, y >> 1, o.seed + 8) < 0.12 ? 0.4 : 0);
  }

  /** The moor toward us: tussocks on a value falling from v0 at its skyline to v1 at the bottom. */
  function moor(p, W, topAt, y1, o) {
    const u = o.u; const z = o.z ?? 5; const G = p.ri('grass');
    const tops = new Float32Array(W); let y0 = y1;
    for (let x = 0; x < W; x += 1) { tops[x] = topAt(x + 0.5); y0 = Math.min(y0, tops[x]); }
    const tu = { rows: o.rows, d0: o.d0, cw: o.cw, density: o.density, tip: o.tip, dark: o.dark, seed: o.seed ?? 1 };
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      for (let x = 0; x < W; x += 1) {
        const ty = tops[x];
        if (y + 0.5 < ty) continue;
        const d = y + 0.5 - ty; const t = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
        let v = lerp(o.v0, o.v1, t ** (o.pow ?? 1)) + tussocks(p, x, y, d, tu, u);
        if (d < 1) v += o.lip ?? 0;
        const i = y * W + x; p.r[i] = G; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /** Near grass: tufts of dark blades standing up along the bottom. */
  function tufts(p, x0, x1, by, u, o = {}) {
    const r = rng(o.seed ?? 'tufts'); const z = o.z ?? 9;
    for (let x = x0; x < x1; x += (2 + r() * 4) * u) {
      if (o.skip && o.skip(x)) continue;
      const n = 3 + Math.floor(r() * 4); const hgt = ((o.h0 ?? 3) + r() * (o.h1 ?? 5)) * u;
      for (let k = 0; k < n; k += 1) {
        const bx = x + (r() - 0.5) * 3 * u; const lean = (r() - 0.5) * 0.9;
        limb(p, bx, by + r() * 2 * u, bx + lean * hgt * 0.6, by - hgt * (0.5 + r() * 0.5), 1, 1, 'shadow', o.v ?? 0.6, z);
      }
    }
  }

  /** A dead tree, its limbs crooked; rags tied along them. Returns where the rags hang and where a crow can sit. */
  function deadTree(p, x, by, s, o = {}) {
    const r = rng(o.seed ?? 'tree'); const z = o.z ?? 4; const v = o.v ?? 0.9;
    const tied = []; const perch = [];
    const grow = (x0, y0, ang, len, w, depth) => {
      let cx = x0; let cy = y0; let a = ang;
      for (let k = 0; k < 3; k += 1) {
        a += (r() - 0.5) * 0.5;
        const l = len / 3; const nx = cx + Math.cos(a) * l; const ny = cy + Math.sin(a) * l;
        limb(p, cx, cy, nx, ny, Math.max(1, w * (1 - k / 6)), Math.max(1, w * (1 - (k + 1) / 6)), 'wood', v, z);
        cx = nx; cy = ny;
      }
      if (depth <= 0 || len < 2.5) { perch.push([cx, cy]); return; }
      if (depth <= 2 && depth >= 1 && r() < 0.5) tied.push([Math.round(lerp(x0, cx, 0.4 + r() * 0.4)), Math.round(lerp(y0, cy, 0.4 + r() * 0.4)) + 1, Math.floor(r() * 1e6)]);
      const spread = 0.42 + r() * 0.32;
      grow(cx, cy, a - spread, len * (0.62 + r() * 0.14), w * 0.6, depth - 1);
      grow(cx, cy, a + spread * (0.8 + r() * 0.4), len * (0.55 + r() * 0.14), w * 0.55, depth - 1);
    };
    p.fill(C.poly([[x - s * 0.11, by + 1], [x - s * 0.035, by - s * 0.09], [x + s * 0.04, by - s * 0.09], [x + s * 0.12, by + 1]]), 'wood', v, z);
    grow(x, by - s * 0.05, -Math.PI / 2 + (o.lean ?? 0.12), s * 0.42, Math.max(1.5, s * 0.075), o.depth ?? 4);
    return { tied, perch };
  }

  /**
   * The ruined chapel: its west gable toward us with a tall pointed window
   * open to the sky, a bell-cote on the apex with the bell still in it, the
   * nave wall running off behind, broken down in steps.
   */
  function chapel(p, cx, by, s, u, o = {}) {
    const z = o.z ?? 4; const v = o.v ?? 1.1; const seed = o.seed ?? 21;
    const hw = s * 0.24; const eave = by - s * 0.5; const apex = by - s * 0.84;
    const nave = C.poly([[cx - hw, by], [cx - hw, by - s * 0.42], [cx - hw - s * 0.12, by - s * 0.42], [cx - hw - s * 0.16, by - s * 0.34], [cx - hw - s * 0.3, by - s * 0.33],
      [cx - hw - s * 0.34, by - s * 0.22], [cx - hw - s * 0.5, by - s * 0.2], [cx - hw - s * 0.56, by - s * 0.1], [cx - hw - s * 0.7, by - s * 0.08], [cx - hw - s * 0.72, by]]);
    const gable = C.poly([[cx - hw, by], [cx - hw, eave], [cx, apex], [cx + hw * 0.55, apex + (eave - apex) * 0.55], [cx + hw * 0.62, eave + s * 0.06],
      [cx + hw * 0.9, eave + s * 0.1], [cx + hw, eave + s * 0.18], [cx + hw, by]]);
    const naveWins = [C.arch(cx - hw - s * 0.24, by - s * 0.3, s * 0.035, by - s * 0.14, 0.5), C.arch(cx - hw - s * 0.46, by - s * 0.16, s * 0.035, by - s * 0.05, 0.5)];
    const win = C.arch(cx, by - s * 0.66, s * 0.075, by - s * 0.2, 0.7);
    const restore = [keep(p, win), ...naveWins.map((w) => keep(p, w))];
    for (const [k, sh] of [nave, gable].entries()) {
      p.fill(sh, 'stone', v - k * 0.1, z);
      p.masonry(sh, { bw: 3.4 * u, bh: 2 * u, joint: -0.8, top: 0.4, vary: 0.6, seed: seed + k, z });
    }
    // The bell-cote: a little arch on the apex, the bell hanging in it.
    const bc = C.poly([[cx - s * 0.05, apex + s * 0.02], [cx - s * 0.05, apex - s * 0.1], [cx, apex - s * 0.14], [cx + s * 0.05, apex - s * 0.1], [cx + s * 0.05, apex + s * 0.02]]);
    p.fill(bc, 'stone', v + 0.2, z);
    const bo = C.arch(cx, apex - s * 0.1, s * 0.028, apex + s * 0.0, 0.3);
    const rb = keep(p, bo);
    for (const f of restore) f();
    rb();
    p.fill(C.poly([[cx - s * 0.018, apex - s * 0.01], [cx - s * 0.012, apex - s * 0.06], [cx + s * 0.012, apex - s * 0.06], [cx + s * 0.018, apex - s * 0.01]]), 'shadow', 0.6, z);
    // The window's tracery: a mullion and a ring, still standing in the opening.
    p.fill(C.rect(Math.round(cx) - 0.5, by - s * 0.5, 1, s * 0.3), 'stone', v + 0.4, z);
    return { apex, gable };
  }

  /**
   * The lychgate: a little roofed gate in the churchyard wall, its gable to
   * us, a cross on the ridge; the wall runs off both ways, headstones
   * leaning behind it.
   */
  function lychgate(p, cx, by, s, u, o = {}) {
    const z = o.z ?? 4; const v = o.v ?? 1.1;
    const wallH = s * 0.26;
    // The headstones behind the wall, leaning.
    const r = rng(o.seed ?? 'lych');
    for (let x = cx - (o.left ?? s * 1.6); x < cx + (o.right ?? s * 1.6); x += (3 + r() * 4) * u) {
      if (Math.abs(x - cx) < s * 0.5) continue;
      const hgt = (2.5 + r() * 3.5) * u; const w = (1.6 + r() * 1.4) * u; const lean = (r() - 0.5) * 1.6 * u;
      if (r() < 0.25) { // a cross
        limb(p, x, by - wallH, x + lean * 0.4, by - wallH - hgt * 1.3, 1, 1, 'stone', v + 0.4, z);
        limb(p, x - 1.2 * u + lean * 0.3, by - wallH - hgt * 0.95, x + 1.2 * u + lean * 0.3, by - wallH - hgt * 0.95, 1, 1, 'stone', v + 0.4, z);
      } else {
        p.fill(C.poly([[x - w / 2, by - wallH + 1], [x - w / 2 + lean, by - wallH - hgt * 0.75], [x + lean, by - wallH - hgt], [x + w / 2 + lean, by - wallH - hgt * 0.75], [x + w / 2, by - wallH + 1]]), 'stone', v + 0.3, z);
      }
    }
    // The wall, with a coping along its top.
    for (const [a, b] of [[cx - (o.left ?? s * 1.6), cx - s * 0.36], [cx + s * 0.36, cx + (o.right ?? s * 1.6)]]) {
      const wall = C.rect(a, by - wallH, b - a, wallH);
      p.fill(wall, 'stone', v, z);
      p.masonry(wall, { bw: 3 * u, bh: 1.6 * u, joint: -0.7, top: 0.3, vary: 0.5, seed: 44, z });
      p.fill(C.rect(a, by - wallH - 1, b - a, 1.2), 'stone', v + 1, z);
    }
    // Posts, the gate between them, the roof.
    for (const m of [-1, 1]) p.fill(C.rect(cx + m * s * 0.3 - (m < 0 ? Math.max(1, s * 0.06) : 0), by - s * 0.56, Math.max(1, s * 0.06), s * 0.56), 'wood', v + 0.2, z);
    for (let k = -2; k <= 2; k += 1) p.fill(C.rect(Math.round(cx + k * s * 0.11), by - s * 0.3, 1, s * 0.3), 'wood', v, z);
    p.fill(C.rect(cx - s * 0.3, by - s * 0.3, s * 0.6, 1), 'wood', v, z);
    const roof = C.poly([[cx - s * 0.5, by - s * 0.5], [cx, by - s * 0.96], [cx + s * 0.5, by - s * 0.5], [cx + s * 0.4, by - s * 0.5], [cx, by - s * 0.84], [cx - s * 0.4, by - s * 0.5]]);
    p.fill(roof, 'wood', v + 0.4, z);
    p.fill(C.poly([[cx - s * 0.4, by - s * 0.5], [cx, by - s * 0.84], [cx + s * 0.4, by - s * 0.5]]), 'shadow', 0.8, z);
    p.fill(C.rect(cx - s * 0.4, by - s * 0.56, s * 0.8, Math.max(1, s * 0.05)), 'wood', v + 0.3, z);
    limb(p, cx, by - s * 0.84, cx, by - s * 0.56, 1, 1, 'wood', v + 0.3, z); // king post
    limb(p, cx, by - s * 0.96, cx, by - s * 1.16, 1, 1, 'stone', v + 0.6, z);  // the cross on the ridge
    limb(p, cx - s * 0.06, by - s * 1.09, cx + s * 0.06, by - s * 1.09, 1, 1, 'stone', v + 0.6, z);
  }

  /**
   * The wight: a crowned dead king in a tattered shroud, gaunt, one long
   * arm reaching with spread fingers, the other holding a sword point-down
   * and out. Black against the moon; its eyes two points of the card's red.
   */
  function wight(p, cx, fy, s, o = {}) {
    const z = o.z ?? 7; const v = o.v ?? 0.3; const R = o.ramp || 'shadow';
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    const hem = [];
    for (let k = 0; k <= 12; k += 1) hem.push([lerp(-0.34, 0.32, k / 12), k % 2 ? -0.04 - hash(k, 1, 7) * 0.06 : 0]);
    p.fill(P([...hem, [0.28, -0.24], [0.21, -0.5], [0.2, -0.64], [0.28, -0.7], [0.24, -0.76], [0.1, -0.79], [0.05, -0.82],
      [0.065, -0.86], [0.06, -0.93], [0.075, -0.97], [0.09, -1.08], [0.045, -1.0], [0.022, -1.11], [0, -1.01], [-0.022, -1.11], [-0.045, -1.0], [-0.09, -1.08], [-0.075, -0.97],
      [-0.06, -0.93], [-0.065, -0.86], [-0.05, -0.82], [-0.1, -0.79], [-0.24, -0.76], [-0.29, -0.7], [-0.22, -0.64], [-0.22, -0.5], [-0.29, -0.24]]), R, v, z);
    // The reaching arm, its rags hanging, long fingers spread.
    p.fill(P([[-0.24, -0.74], [-0.36, -0.7], [-0.5, -0.68], [-0.56, -0.66], [-0.56, -0.61], [-0.5, -0.62], [-0.36, -0.63], [-0.21, -0.64]]), R, v, z);
    p.fill(P([[-0.4, -0.66], [-0.44, -0.5], [-0.4, -0.55], [-0.36, -0.46], [-0.31, -0.63]]), R, v, z);
    for (const [fx, fyy] of [[-0.67, -0.74], [-0.7, -0.67], [-0.69, -0.6], [-0.64, -0.55]]) limb(p, cx - 0.55 * s, fy - 0.64 * s, cx + fx * s, fy + fyy * s, 1, 1, R, v, z);
    // The sword arm and the sword, point-down, held out from the body.
    p.fill(P([[0.22, -0.72], [0.31, -0.6], [0.34, -0.47], [0.3, -0.46], [0.26, -0.58], [0.19, -0.65]]), R, v, z);
    limb(p, cx + 0.33 * s, fy - 0.47 * s, cx + 0.325 * s, fy - 0.54 * s, 1.6, 1.6, R, v, z);
    limb(p, cx + 0.27 * s, fy - 0.43 * s, cx + 0.41 * s, fy - 0.41 * s, 1.2, 1.2, R, v, z);
    limb(p, cx + 0.34 * s, fy - 0.42 * s, cx + 0.46 * s, fy - 0.02 * s, Math.max(1.2, 0.035 * s), 1, R, v, z);
    const ey = Math.round(fy - s * 0.9);
    p.fill(C.rect(Math.round(cx - s * 0.035) - 1, ey, 2, 1), o.eyes, 4, z + 1);
    p.fill(C.rect(Math.round(cx + s * 0.035), ey, 2, 1), o.eyes, 4, z + 1);
    return { ey, sword: [cx + 0.34 * s, fy - 0.42 * s, cx + 0.46 * s, fy - 0.02 * s] };
  }

  /** The gravedigger: stooped in a long coat under a broad-brimmed hat, leaning on his spade, a lantern held low. */
  function gravedigger(p, cx, fy, s, o = {}) {
    const z = o.z ?? 7; const v = o.v ?? 0.4; const R = o.ramp || 'shadow';
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    p.fill(P([[-0.21, 0], [-0.19, -0.3], [-0.22, -0.52], [-0.2, -0.68], [-0.12, -0.77], [0.0, -0.8], [0.1, -0.76], [0.14, -0.62], [0.15, -0.3], [0.18, 0],
      [0.06, 0], [0.04, -0.12], [-0.04, -0.12], [-0.06, 0]]), R, v, z);
    p.fill(P([[0.0, -0.79], [0.02, -0.87], [0.11, -0.87], [0.11, -0.79]]), R, v, z);
    p.fill(P([[-0.11, -0.86], [0.25, -0.86], [0.23, -0.9], [-0.09, -0.9]]), R, v, z); // the brim
    p.fill(P([[-0.01, -0.89], [0.0, -0.99], [0.05, -1.01], [0.12, -1.0], [0.14, -0.89]]), R, v, z); // the crown of the hat
    const sx = cx + 0.31 * s; const sw = Math.max(1, 0.03 * s);
    limb(p, sx, fy - 0.12 * s, sx, fy - 0.92 * s, sw, sw, R, v, z);
    p.fill(C.rect(sx - 0.06 * s, fy - 0.97 * s, 0.12 * s + 1, Math.max(1, 0.03 * s)), R, v, z);
    p.fill(P([[0.25, -0.15], [0.37, -0.15], [0.36, 0.02], [0.31, 0.06], [0.26, 0.02]]), R, v, z);
    p.fill(P([[0.12, -0.63], [0.31, -0.6], [0.31, -0.55], [0.12, -0.56]]), R, v, z);
    limb(p, cx - 0.18 * s, fy - 0.6 * s, cx - 0.27 * s, fy - 0.44 * s, Math.max(1, 0.05 * s), Math.max(1, 0.04 * s), R, v, z);
    return { lx: Math.round(cx - 0.29 * s), ly: Math.round(fy - 0.4 * s) };
  }

  /** A lantern held out: a dark frame round a core of the card's colour. */
  function lantern(p, lx, ly, ramp, z, big = false) {
    if (!big) {
      p.fill(C.rect(lx, ly - 1, 2, 1), 'shadow', 1, z);
      p.fill(C.rect(lx - 1, ly, 4, 4), 'shadow', 1.4, z);
      p.fill(C.rect(lx, ly + 1, 2, 2), ramp, 4, z + 1);
      return;
    }
    // Hung from the hand on a bail: a little roof, a glass of the card's colour, bright at its heart.
    p.fill(C.rect(lx, ly - 2, 2, 1), 'shadow', 1, z);
    p.fill(C.rect(lx - 1, ly - 1, 4, 1), 'shadow', 1.4, z);
    p.fill(C.rect(lx - 1, ly, 4, 5), 'shadow', 1.2, z);
    p.fill(C.rect(lx, ly, 2, 4), ramp, 3, z + 1);
    p.fill(C.rect(lx, ly + 1, 2, 2), ramp, 4, z + 1);
    p.fill(C.rect(lx - 1, ly + 5, 4, 1), 'shadow', 1.4, z);
  }

  /** Grave goods: a stone cist with its capstone pushed off, a helm and a sword in it, black against what glows inside. */
  function cist(p, cx, fy, s, ramp, z) {
    const w = s * 0.55; const h = s * 0.3; const d = s * 0.16; const top = fy - h;
    p.fill(C.rect(cx - w + 1, top - d - s * 0.06, 2 * w - 2, s * 0.06 + 1), 'stone', 3, z); // the back slab
    const hole = C.poly([[cx - w, top], [cx - w + d * 0.7, top - d], [cx + w - d * 0.7, top - d], [cx + w, top]]);
    p.glow(hole, ramp, cx, top - d * 0.4, w * 0.9, 4.4, 2.6, z);
    // The goods, black against it: a crested helm, a sword standing in it, a torc hung on its hilt.
    const hx = cx - w * 0.34; const hy = top - d * 0.2;
    p.fill(C.ellipse(hx, hy, s * 0.11, s * 0.12, 16), 'shadow', 0.4, z + 1);
    p.fill(C.rect(hx - s * 0.12, hy, s * 0.24, s * 0.05), 'shadow', 0.4, z + 1);
    p.fill(C.poly([[hx - s * 0.02, hy - s * 0.11], [hx + s * 0.05, hy - s * 0.2], [hx + s * 0.08, hy - s * 0.17], [hx + s * 0.03, hy - s * 0.09]]), 'shadow', 0.4, z + 1); // the crest
    const sx = Math.round(cx + w * 0.3);
    p.fill(C.rect(sx, top - d - s * 0.24, Math.max(1, s * 0.04), s * 0.26), 'shadow', 0.4, z + 1);
    p.fill(C.rect(sx - s * 0.09, top - d - s * 0.05, s * 0.2, Math.max(1, s * 0.04)), 'shadow', 0.4, z + 1);
    p.fill(C.rect(sx - 0.5, top - d - s * 0.29, Math.max(2, s * 0.07), Math.max(1, s * 0.05)), 'shadow', 0.4, z + 1);
    p.fill(C.join(C.circle(sx + 0.5, top - d - s * 0.13, s * 0.075, 12), C.circle(sx + 0.5, top - d - s * 0.13, s * 0.04, 12)), ramp, 3.6, z + 1); // the torc, catching the light
    const front = C.rect(cx - w, top, 2 * w, h);
    p.fill(front, 'stone', (x, y) => ((y - top) / h < 0.45 ? 3 : 2), z + 2);
    p.cells(front, { size: Math.max(3, s * 0.18), joint: 0.5, jointV: -0.7, vary: 0.4, bevel: 0.3, seed: 12, z: z + 2 });
    p.fill(C.rect(cx - w, top, 2 * w, 1), ramp, 3.4, z + 2);
    cupRing(p, cx - w * 0.15, top + h * 0.55, Math.max(2, s * 0.08), z + 2, 1.2, 2);
    p.fill(C.poly([[cx + w - 1, fy], [cx + w + s * 0.06, top - d * 0.7], [cx + w + s * 0.3, top - d * 0.3], [cx + w + s * 0.34, fy]]), 'stone', 1.8, z + 3);
    p.fill(C.rect(cx + w + s * 0.06, top - d * 0.7, 1, fy - top), 'stone', 3.2, z + 3); // its edge, toward the glow
    return [cx, top - d * 0.5];
  }

  /**
   * The sealed door: a slab set in the three stones from the ground to the
   * lintel, a spiral and lines of ogham cut in it, glowing in the card's colour.
   */
  function seal(p, gx, top, hw, floor, u, ramp, z) {
    const slab = C.poly([[gx - hw - u, floor + 1], [gx - hw - 0.2 * u, lerp(top, floor, 0.5)], [gx - hw - 0.6 * u, top + 2 * u], [gx - hw * 0.4, top + 0.4 * u], [gx + hw * 0.3, top + 1.2 * u],
      [gx + hw + 0.3 * u, top - 0.2 * u], [gx + hw + 0.8 * u, lerp(top, floor, 0.45)], [gx + hw + u, floor + 1]]);
    // The slab's face in clean bands: lit faintly from the carving, darker toward its edges and foot.
    const cy = lerp(top, floor, 0.4); const R = hw * 0.6;
    p.fill(slab, 'stone', (x, y) => { const d = Math.hypot((x + 0.5 - gx) / hw, (y + 0.5 - cy) / (hw * 1.6)); return d < 0.7 ? 3.2 : d < 1.1 ? 2.4 : 1.6; }, z);
    p.cells(slab, { size: Math.max(3, 5 * u), joint: 0.5, jointV: -0.8, vary: 0.4, bevel: 0.4, seed: 9, z });
    // A crack across its lower half.
    for (let x = gx - hw, y = lerp(top, floor, 0.72); x < gx + hw * 0.3; x += 1) { y += (hash(x, 1, 3) - 0.4) * 1.6; p.shade(C.rect(Math.floor(x), Math.floor(y), 1, 1), -1.2, z); }
    const ri = p.ri(ramp); const glow = [];
    for (const [x, y] of spiralPts(gx, cy, R, 2.4, 1, 0.5)) { dot(p, x, y, ri, 3.5, z + 1); glow.push([x, y]); }
    // Ogham down one edge: a stem line, notches cut across it in groups.
    // Groups of one to five strokes, to the left, the right or across, a gap between groups.
    const sx = Math.round(gx - hw * 0.74); const y1 = floor - 6 * u;
    for (let y = Math.round(top + 4 * u); y < y1; y += 1) dot(p, sx, y, ri, 1.6, z + 1);
    for (let y = Math.round(top + 6 * u), g = 0; y < y1 - 2;) {
      const n = 1 + Math.floor(hash(g, 1, 11) * 5); const kind = Math.floor(hash(g, 2, 11) * 3);
      for (let k = 0; k < n && y < y1 - 1; k += 1, y += 2) {
        if (kind !== 1) { dot(p, sx - 1, y, ri, 2.6, z + 1); dot(p, sx - 2, y, ri, 2, z + 1); }
        if (kind !== 0) { dot(p, sx + 1, y, ri, 2.6, z + 1); dot(p, sx + 2, y, ri, 2, z + 1); }
      }
      y += 2 + Math.round(u); g += 1;
    }
    return { cy, R, glow };
  }

  const A = {
    job: 0, setting: 'barrow-moor', key: 'A', id: 'barrow-moor-a', side: 'outside',
    name: 'The Barrow Moor', title: 'Under the barrow moon',
    pitch: 'The edge of the Shadowfell: a moor of standing stones and burial mounds under a moon too big for the sky. Mist lies in the hollows, crows sit the stones and a dead tree, and every card waits in the three stones, black against the moon.',
    notes: [
      ['Light', 'One huge pale moon, low behind the stones, lights everything from behind: black silhouettes rimmed in cold light, mist glowing in the hollows, the moor dark toward you. On a face-down card the way through the stones runs over flat stones into a black barrow door.'],
      ['Detail', 'A trilithon of rough stones with a crow on its lintel and a cup-and-ring mark, a ring of standing stones and round barrows, a ruined chapel with its bell still hanging, a lychgate and leaning headstones, a dead tree tied with rags, ghost-lights over the mounds.'],
      ['Vista', 'The moor the width of the board, the three stones framing the moon. The card stands in them: a crowned wight against the disc, the gravedigger with his lantern, a cist of grave goods glowing violet, the stones sealed with a carved slab, or the way between them lit gold.'],
      ['World', 'Sky high, table low: the moonlit skyline and its mist along the top, then tussocky moor falling dark under the table, barrows at the edges with ghost-lights drifting out of them.'],
    ],
    palette: ['#040607', '#161F24', '#3F4F58', '#A9B8BE', '#F7FAFA', '#1A2117', '#444F3D', '#5E6E76', '#8DAEC2'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['moon', 'ghost'], dither: 0.22 });
      const u = H / 134; const gx = W / 2;
      const mx = gx; const my = 37 * u; const mr = 17 * u;
      moonSky(p, W, 92 * u, {
        u, mx, my, mr, halo: 46 * u, glow: 7.4, base: 1.4, seed: 4, hz: 76 * u, hzk: 3.4, hzw: 12 * u,
        clouds: [[gx - 18 * u, 46 * u, 26 * u, 2 * u], [gx + 26 * u, 22 * u, 22 * u, 1.8 * u], [gx - 30 * u, 14 * u, 16 * u, 1.4 * u]],
      });
      farLand(p, W, u, 76 * u, 100 * u, { seed: 2, v: 1.6, lip: 1.2, skip: (x) => Math.abs(x - gx) < 20 * u });
      mistWisps(p, W, 80 * u, u, { seed: 2, n: 4, v: 3.4, spread: 4, z: 1 });
      // The barrow behind the stones, filling the way through them to the lintel; its own black door.
      mound(p, gx + 1 * u, 94 * u, 38 * u, 38 * u, { u, z: 2, v: 1.6, lip: 2, seed: 5, fall: 0.8 });
      tombDoor(p, gx + 1 * u, 84 * u, 3 * u, 8 * u, u, { z: 2, v: 1.8 });
      // The ring of stones, standing out of the mist.
      for (const [x, h, w, sd] of [[9, 20, 8, 1], [26, 12, 6, 2], [72, 12, 6, 3], [88, 22, 9, 4]]) stone(p, x * u, 94 * u, w * u, h * u, { u, z: 2, v: 1.3, seed: sd });
      fog(p, W, { u, y0: 83 * u, y1: 100 * u, v: 6.6, fall: 3.4, lip: 1.2, mx: gx, mw: 36 * u, moon: 1.2, z: 3, seed: 6, len: 26, th: 2.4, layers: 8 });
      // The near stones of the circle, framing the arch.
      stone(p, 6 * u, 110 * u, 14 * u, 46 * u, { u, z: 4, v: 1.2, seed: 7, lean: 0.06, snap: 1 });
      stone(p, 91 * u, 112 * u, 13 * u, 40 * u, { u, z: 4, v: 1.2, seed: 8, lean: -0.08, snap: 0 });
      // The moor toward us, a worn path to the stones.
      moor(p, W, (x) => 99 * u + Math.sin(x / (9 * u)) * 0.8 * u, H, { u, z: 5, v0: 3.6, v1: 1.6, rows: 3, d0: 3, cw: 0.9, tip: 1.6, dark: 0.8, lip: 0.8, seed: 3 });
      p.shade(C.poly([[gx - 5 * u, 102 * u], [gx + 5 * u, 102 * u], [gx + 13 * u, H], [gx - 11 * u, H]]), (x, y) => (n2(x / (3 * u), y / (2 * u), 4) > 0.45 ? -0.8 : -0.4), 5);
      p.light(gx, 100 * u, 36 * u, 2.2, null, { zMin: 5, zMax: 5, sx: 1.6, sy: 0.45 });
      // Flat stones laid as a path up to the three stones, their tops holding the pale sky.
      for (const [dx, y, w, h, sd] of [[0, 108, 5, 1.4, 1], [-1, 113, 6.5, 1.8, 2], [1.5, 119.5, 8.5, 2.3, 3], [-1, 128, 11, 3, 4]]) {
        const sx = gx + dx * u; const sy = y * u;
        p.fill(C.ellipse(sx, sy + h * 0.5 * u, w * u, h * u, 18), 'stone', 1, 5);
        p.fill(C.ellipse(sx, sy, w * u, h * u, 18), 'stone', (x2, y2) => 5.4 - (y2 - sy + h * u) / (2 * h * u) * 2 + (n2(x2 / (2 * u), y2 / (2 * u), sd) > 0.62 ? -0.8 : 0), 5);
      }
      // The three stones, the moon sitting on the lintel.
      trilithon(p, gx, 57 * u, 9 * u, 106 * u, u, { z: 6, t: 7 * u, lt: 8 * u, v: 1.2, seed: 11 });
      cupRing(p, gx - 12 * u, 53 * u, 2.2 * u, 6, 1.2, 2);
      // The dead tree, tied with rags, at the left.
      const tree = deadTree(p, 87 * u, 126 * u, 62 * u, { z: 7, v: 0.9, seed: 'back-tree-r', lean: -0.3, depth: 3 });
      tufts(p, 0, W, H + 1, u, { seed: 'back-tufts', z: 9, h0: 3, h1: 6, skip: (x) => Math.abs(x - gx) < 14 * u });
      // Rims: everything against the moon and its halo takes a cold edge; the rest a fainter one on its moonward side.
      moonEdge(p, [4, 6, 7], mx, 2.2, 1.4);
      for (const z of [2, 4, 6, 7, 9]) { p.backlit(z, 'moon', 0, 'moon', 0.6); p.backlit(z, 'sky', 7.2, 'sky', 10.6); }
      p.rim(0, -1, 1.1, 2);
      vignette(p, W, H, 1.6, 0.42);
      const crow = [Math.round(gx + 5 * u), Math.round(57 * u - 8 * u * 0.95)];
      const perch = tree.perch.filter(([x, y]) => y < 100 * u && x > 66 * u).sort((a, b) => a[1] - b[1])[0];
      return {
        p,
        over(img) {
          rags(img, tree.tied, 1.3);
          sprite(img, crow[0], crow[1], CROW_SIT, CROW);
          if (perch) sprite(img, Math.round(perch[0]), Math.round(perch[1]), CROW_SIT, CROW, true);
          wispDot(img, 74 * u, 86 * u, 0.75);
          wispDot(img, 18 * u, 88 * u, 0.5);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['moon', 'ghost', 'path'], dither: 0.22 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const mx = gx; const my = 34 * u; const mr = 28 * u;
      const hw = 20 * u; const top = 29 * u; const floor = 90 * u;
      const clouds = [[gx - 10 * u, 47 * u, 46 * u, 2.4 * u], [gx + 40 * u, 13 * u, 40 * u, 2 * u]];
      const cr = rng('a-vista-clouds');
      for (let d = 90; d < W / u / 2 + 40; d += 50 + cr() * 50) for (const m of [-1, 1]) clouds.push([gx + m * d * u, (8 + cr() * 34) * u, (24 + cr() * 24) * u, (1.6 + cr()) * u]);
      moonSky(p, W, 76 * u, { u, mx, my, mr, halo: 86 * u, glow: 7.4, base: 1.6, seed: 7, clouds, hz: 63 * u, hzk: 3, hzw: 12 * u });
      farLand(p, W, u, 63 * u, 82 * u, { seed: 4, v: 1.7, lip: 1.2, skip: (x) => Math.abs(x - gx) < 34 * u });
      mistWisps(p, W, 66 * u, u, { seed: 5, n: Math.round(W / u / 30), v: 3.6, spread: 5, z: 1 });
      // The far ring of stones and small barrows, mid distance.
      const r = rng('a-vista-mid');
      const stones = []; const mounds = [];
      for (let x = -10 * u; x < W + 10 * u; x += (9 + r() * 14) * u) {
        const d = Math.abs(x - gx);
        if (d < 30 * u) continue;
        if (r() < 0.22) mounds.push([x, (10 + r() * 8) * u, (5 + r() * 4) * u]);
        else stones.push([x, (3 + r() * 3) * u, (7 + r() * 9) * u, Math.floor(r() * 1e5)]);
      }
      for (const [x, w, h] of mounds) mound(p, x, 76 * u, w, h, { u, z: 2, v: 1.5, lip: 1.6, seed: Math.round(x) });
      for (const [x, w, h, sd] of stones) stone(p, x, 77 * u, w, h, { u, z: 2, v: 1.3, seed: sd });
      fog(p, W, { u, y0: 70 * u, y1: 89 * u, v: 6.6, fall: 3.6, lip: 1.2, mx: gx, mw: 60 * u, moon: 1.4, z: 3, seed: 3, len: 44, th: 3, layers: 5 });
      // The churchyard on the left: the ruined chapel, the wall, the lychgate.
      const lx = gx - 62 * u;
      chapel(p, gx - 104 * u, 80 * u, 46 * u, u, { z: 4, v: 1.1 });
      lychgate(p, lx, 84 * u, 19 * u, u, { z: 4, v: 1.1, left: 30 * u, right: 22 * u });
      // The dead tree on the right; beyond it a great barrow with its door.
      const tree = deadTree(p, gx + 56 * u, 86 * u, 50 * u, { z: 4, v: 0.8, seed: 'vista-tree', lean: -0.1 });
      mound(p, gx + 104 * u, 84 * u, 26 * u, 14 * u, { u, z: 4, v: 1.6, lip: 1.6, seed: 8 });
      tombDoor(p, gx + 104 * u, 82 * u, 2.6 * u, 6 * u, u, { z: 4, v: 1.8 });
      // Out along the width: more stones and barrows, another dead tree.
      const far = [];
      for (let d = 132; d < W / u / 2 + 20; d += 26 + r() * 30) for (const m of [-1, 1]) far.push([gx + m * d * u, r()]);
      for (const [x, k] of far) {
        if (k < 0.3) mound(p, x, 84 * u, (16 + k * 30) * u, (9 + k * 10) * u, { u, z: 4, v: 1.6, lip: 1.6, seed: Math.round(x) });
        else if (k < 0.42) deadTree(p, x, 86 * u, (34 + k * 20) * u, { z: 4, v: 0.8, seed: `far-tree-${Math.round(x)}`, depth: 3 });
        else stone(p, x, 86 * u, (5 + k * 4) * u, (12 + k * 14) * u, { u, z: 4, v: 1.2, seed: Math.round(x) });
      }
      // The moor toward us.
      moor(p, W, (x) => 84 * u + (n1(x / (30 * u), 9) - 0.5) * 3 * u, H, { u, z: 5, v0: 3.2, v1: 1.4, rows: 2.6, d0: 2.4, cw: 0.9, tip: 1.6, dark: 0.8, lip: 0.8, seed: 5 });
      p.light(gx, 86 * u, 70 * u, 2.4, null, { zMin: 5, zMax: 5, sx: 1.8, sy: 0.4 });
      // The three stones, the moon framed in them.
      const tri = trilithon(p, gx, top, hw, floor, u, { z: 6, t: 6.5 * u, lt: 7 * u, v: 1.1, seed: 13 });
      // The card, in the stones.
      const fy = floor - 2 * u;
      let glow = null;
      if (cat === 'monster') {
        const s = 46 * u;
        const w = wight(p, gx, fy, s, { z: 7, eyes: ramp });
        limb(p, w.sword[0] - 0.5, w.sword[1], w.sword[2] - 0.5, w.sword[3], 1, 1, 'stone', 5.4, 8); // a cold gleam down the blade
        p.tint(gx, w.ey, 6 * u, hex, 0.45, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 44 * u;
        const g = gravedigger(p, gx - 3 * u, fy, s, { z: 7 });
        lantern(p, g.lx, g.ly, ramp, 9, true);
        p.light(g.lx + 1, fy, 14 * u, 2.2, flicker(0.9, 0.15), { zMin: 5, zMax: 5, sy: 0.4 });
        p.tint(g.lx + 1, g.ly + 2, 6 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(g.lx + 1, g.ly + 2, 12 * u, hex, 0.4, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        glow = cist(p, gx, fy + 1 * u, 38 * u, ramp, 7);
        p.tint(glow[0], glow[1] - 2 * u, 10 * u, hex, 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        const s = seal(p, gx, top, hw, floor, u, ramp, 7);
        p.tint(gx, s.cy, s.R * 1.3, hex, 0.35, flicker(0.5, 0.12, 0.6));
      } else {
        // The way between the stones opens: dawn-gold sky beyond them over the far moor, and a lit path
        // running in from it between the stones toward you.
        const hz = 66 * u; const PA = p.ri('path'); const HI = p.ri('hill');
        p.each(C.rect(gx - hw - 2 * u, top, hw * 2 + 4 * u, floor - top + 1), (x, y, i) => {
          if (p.z[i] >= 6) return;
          const ax = Math.abs(x + 0.5 - gx); const yy = y + 0.5;
          const sky = hz - (n1(x / (6 * u), 3) - 0.5) * 2 * u;
          if (yy < sky) { p.r[i] = PA; p.z[i] = 1; p.v[i] = Math.round(1.2 + 3.4 * clamp((yy - top) / (sky - top), 0, 1) ** 1.8 - ax / hw * 0.5); return; }
          const t = clamp((yy - sky) / (floor - sky), 0, 1); const pw = lerp(0.8 * u, hw * 0.55, t);
          if (ax < pw) { p.r[i] = PA; p.z[i] = 1; p.v[i] = Math.round(3.8 - t * 1.4 - (ax > pw - 1 ? 1 : 0)); return; }
          p.r[i] = HI; p.z[i] = 1; p.v[i] = yy - sky < 1 ? 3.4 : 1.2 - t * 0.4;
        });
        // The path comes on across the moor to the bottom.
        p.fill(C.poly([[gx - hw * 0.55, floor], [gx + hw * 0.55, floor], [gx + hw * 1.3, H + 1], [gx - hw * 1.1, H + 1]]), 'path', (x, y) => {
          const t = (y - floor) / (H - floor); const ax = Math.abs(x + 0.5 - gx) / lerp(hw * 0.55, hw * 1.2, t);
          return ax > 1 ? null : Math.round(2.6 - t * 1.4 - (ax > 0.86 ? 1 : 0) - ((y + Math.floor(x / 3)) % 5 === 0 ? 0.6 : 0));
        }, 5);
        p.tint(gx, hz - 2 * u, 10 * u, CARD.path[4], 0.5);
      }
      tufts(p, 0, W, H + 1, u, { seed: 'vista-tufts', z: 9, h0: 3, h1: 5, skip: (x) => Math.abs(x - gx) < 18 * u });
      moonEdge(p, [4, 6], mx, 1.3, 0.9);
      for (const z of [1, 2, 4, 6, 7]) { p.backlit(z, 'moon', 0, 'moon', 0.6); p.backlit(z, 'sky', 7.2, 'sky', 10.6); }
      p.backlit(7, 'mist', 5, 'mist', 8);
      p.rim(0, -1, 1, 2);
      vignette(p, W, H, 1.7, 0.42);
      const crowAt = [Math.round(gx - 9 * u), Math.round(top - 7 * u * 0.92)];
      const perch = tree.perch.sort((a, b) => a[1] - b[1]).slice(0, 2);
      const wisps = [[gx + 104 * u, 74 * u, 1], [gx - 40 * u, 70 * u, 2.4], [gx + 150 * u, 72 * u, 4]];
      return {
        p,
        over(img, t) {
          rags(img, tree.tied, t);
          sprite(img, crowAt[0], crowAt[1], CROW_SIT, CROW);
          perch.forEach(([x, y], i) => sprite(img, Math.round(x), Math.round(y), CROW_SIT, CROW, i % 2 === 0));
          // Crows going over, across the moon.
          for (let k = 0; k < 3; k += 1) {
            const ph = frac(t * 0.05 + k * 0.33);
            const x = lerp(-10, W + 10, ph); const y = (14 + k * 9) * u + Math.sin(t * 0.7 + k) * 2 * u;
            sprite(img, Math.round(x), Math.round(y), CROW_FLY[Math.floor(t * 6 + k) % 3], CROW);
          }
          for (const [x, y, ph] of wisps) wispDot(img, x + Math.sin(t * 0.5 + ph) * 3 * u, y + Math.sin(t * 0.8 + ph * 2) * 1.5 * u, 0.55 + 0.4 * Math.sin(t * 1.7 + ph));
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 10 * u, fy - 34 * u, 20 * u, 24 * u], t, 73)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          if (cat === 'clear-path') for (const q of particles('mote', 14, [gx - hw, top + 4 * u, hw * 2, floor - top], t, 71)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a * 0.8);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['moon', 'ghost'], dither: 0.22 });
      const u = H / 250; const gx = W / 2;
      // The moon is behind the vista; its glow fills the sky along the top.
      moonSky(p, W, 62 * u, { u, mx: gx, my: -30 * u, mr: 30 * u, halo: 170 * u, glow: 6.6, base: 1.2, seed: 5, stars: 0.004, hz: 47 * u, hzk: 2.4, hzw: 10 * u });
      farLand(p, W, u, 47 * u, 66 * u, { seed: 6, v: 1.6, lip: 1.2 });
      const r = rng('a-world');
      for (let x = 4 * u; x < W; x += (14 + r() * 26) * u) {
        if (r() < 0.3) mound(p, x, 60 * u, (10 + r() * 8) * u, (5 + r() * 4) * u, { u, z: 2, v: 1.5, lip: 1.6, seed: Math.round(x) });
        else stone(p, x, 61 * u, (4 + r() * 4) * u, (7 + r() * 11) * u, { u, z: 2, v: 1.3, seed: Math.floor(r() * 1e5) });
      }
      mistWisps(p, W, 50 * u, u, { seed: 9, n: 7, v: 3.4, spread: 4, z: 1 });
      fog(p, W, { u, y0: 54 * u, y1: 73 * u, v: 5.4, fall: 3, lip: 1.2, mx: gx, mw: 140 * u, moon: 1, z: 3, seed: 8, len: 60, th: 3.4, layers: 4 });
      moor(p, W, (x) => 66 * u + (n1(x / (40 * u), 3) - 0.5) * 3 * u, H, { u, z: 5, v0: 2.8, v1: 1.3, pow: 0.7, rows: 2.6, d0: 3, cw: 0.9, tip: 1.2, dark: 0.7, lip: 0.6, seed: 9, dMax: 30 });
      // Stones fallen in the grass, half sunk, their tops catching a little light.
      for (const [x, y, w, sd] of [[70, 118, 22, 1], [236, 150, 26, 2], [120, 196, 30, 3], [300, 96, 18, 4]]) {
        const sh = C.ellipse(x * u, y * u, w * u, w * 0.22 * u, 18);
        p.fill(sh, 'stone', (px, py) => (py < y * u - w * 0.12 * u ? 2 : 1.2), 5);
        p.cells(sh, { size: 5 * u, joint: 0.5, jointV: -0.6, vary: 0.4, bevel: 0.4, seed: sd, z: 5 });
      }
      // Barrows at the edges, ghost-lights at their doors; stones and the dead tree beside them.
      mound(p, -6 * u, 160 * u, 54 * u, 52 * u, { u, z: 6, v: 1.8, lip: 2, seed: 3, rows: 3 });
      tombDoor(p, 14 * u, 154 * u, 4 * u, 11 * u, u, { z: 6, v: 1.8 });
      mound(p, W + 6 * u, 214 * u, 54 * u, 58 * u, { u, z: 6, v: 1.7, lip: 1.8, seed: 4, rows: 3 });
      tombDoor(p, W - 12 * u, 208 * u, 4 * u, 11 * u, u, { z: 6, v: 1.8 });
      stone(p, 10 * u, 96 * u, 10 * u, 34 * u, { u, z: 6, v: 1.3, seed: 61 });
      stone(p, W - 34 * u, 122 * u, 11 * u, 40 * u, { u, z: 6, v: 1.3, seed: 62 });
      const tree = deadTree(p, W - 12 * u, 134 * u, 76 * u, { z: 6, v: 0.9, seed: 'world-tree', lean: -0.16, depth: 4 });
      // The ghost-lights' cold glow on the grass round the barrows' doors.
      p.light(14 * u, 146 * u, 34 * u, 3.2, flicker(1.2, 0.3, 0.6), { zMin: 5, sx: 1.2 });
      p.light(W - 12 * u, 200 * u, 34 * u, 3.2, flicker(2.4, 0.3, 0.6), { zMin: 5, sx: 1.2 });
      moonEdge(p, [6], gx, 1.4, 1.2);
      for (const z of [1, 2]) p.backlit(z, 'sky', 6.4, 'sky', 9.6);
      p.rim(0, -1, 0.9, 2);
      // The table: dark from just under the vista, keeping only the margins' things.
      p.shade(null, (x, y) => -1.5 * clamp((y / H - 0.27) / 0.06, 0, 1) - 1.1 * Math.max(0, y / H - 0.45), 5);
      p.shade(null, (x, y) => -0.8 * Math.max(0, y / H - 0.5), 6);
      const wisps = [[14 * u, 142 * u, 0.3], [W - 12 * u, 196 * u, 2], [24 * u, 214 * u, 3.3], [W - 16 * u, 100 * u, 4.4], [6 * u, 70 * u, 5.1]];
      return {
        p,
        over(img, t) {
          rags(img, tree.tied, t);
          for (const [x, y, ph] of wisps) {
            const dx = Math.sin(t * 0.3 + ph) * 8 * u; const dy = Math.sin(t * 0.5 + ph * 2) * 4 * u;
            wispDot(img, x + dx, y + dy, 0.5 + 0.45 * Math.sin(t * 1.3 + ph));
          }
          for (let k = 0; k < 2; k += 1) {
            const ph = frac(t * 0.04 + k * 0.5);
            sprite(img, Math.round(lerp(-10, W + 10, ph)), Math.round((16 + k * 14) * u), CROW_FLY[Math.floor(t * 6 + k) % 3], CROW);
          }
        },
      };
    },
  };

  /* ================= B: the barrow ================= */

  const RAMPS_B = {
    stone: STONE,
    // Packed earth between the stones and on the floor, warm grey-brown in the dark, greying toward the ghost-light.
    earth: ['#050504', '#0A0908', '#100F0D', '#171614', '#1F1D1A', '#282622', '#33322D', '#41423D', '#535750', '#6B7270', '#8A9593'],
    root: ['#060505', '#0C0A09', '#14110F', '#1D1916', '#28231F', '#342E29', '#443D37', '#58534D', '#716F6B', '#8F9291'],
    bone: ['#141614', '#22251F', '#363A33', '#4E534A', '#6A7066', '#899084', '#AAB1A4', '#CBD1C5'],
    void: ['#010101', '#030404', '#060707', '#0A0C0C', '#0F1212', '#151A1A'],
    ghost: GHOST,
    shadow: SHADOW,
    ...CARD,
  };
  // Layers: 1 the walls and floor, 2 recesses and the dark through the door, 3 orthostats and the far coffins,
  // 4 the corbels and roots, 5 the door's stones, 6+ the card, 8 the near coffin.
  // No opening to the outside anywhere: every light here is a ghost-light ('ghost' is emissive, and so is
  // 'void', the dark through the inner door).

  /**
   * A wall of great rough stones laid in rough courses, earth packed into the
   * gaps between them. Each stone is bevelled toward the nearest light: its
   * edge facing the ghost-light is lit, its far edge falls into shadow.
   * lights: [[x, y], ...] the ghost-lights it answers to.
   */
  function slabWall(p, shape, u, o = {}) {
    const ch = (o.ch ?? 9) * u; const cw = (o.cw ?? 15) * u; const seed = o.seed ?? 1; const z = o.z ?? 1;
    const S = p.ri('stone'); const E = p.ri('earth'); const lights = o.lights || [[p.w / 2, 0]];
    const gap = (o.gap ?? 1.3) * u; const k = ch / cw; const v0 = o.v ?? 1.6; const bevel = o.bevel ?? 1.3;
    p.each(shape, (x, y, i) => {
      if (o.only !== undefined && p.z[i] !== o.only) return;
      const X = x + 0.5; const Y = y + 0.5 - (o.oy ?? 0); const row = Math.floor(Y / ch);
      let d1 = 1e9; let d2 = 1e9; let cx1 = 0; let cy1 = 0; let id = 0; let r1 = 1;
      for (let j = row - 1; j <= row + 1; j += 1) {
        const off = (hash(j, 0, seed) - 0.5) * cw + (j & 1 ? cw * 0.5 : 0);
        const col = Math.floor((X - off) / cw);
        for (let c = col - 1; c <= col + 1; c += 1) {
          const px = off + (c + 0.5 + (hash(c, j, seed + 1) - 0.5) * 0.55) * cw;
          const py = (j + 0.5 + (hash(c, j, seed + 2) - 0.5) * (o.jy ?? 0.4)) * ch;
          const wgt = 0.8 + hash(c, j, seed + 3) * 0.5;
          const d = Math.hypot((X - px) * k, Y - py) / wgt;
          if (d < d1) { d2 = d1; d1 = d; cx1 = px; cy1 = py; id = c * 7349 + j; r1 = wgt; } else if (d < d2) d2 = d;
        }
      }
      if (d2 - d1 < gap) { p.r[i] = E; p.v[i] = (o.ev ?? 1) + (hash(x >> 1, y >> 1, seed + 9) < 0.2 ? 0.5 : 0); p.z[i] = z; return; }
      // Toward the nearest light.
      let lx = 0; let ly = -1; let best = 1e9;
      for (const [qx, qy] of lights) { const dd = Math.hypot(qx - cx1, qy - cy1); if (dd < best) { best = dd; lx = qx - cx1; ly = qy - cy1; } }
      const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
      const bx = X - cx1; const by = Y - cy1; const bl = Math.hypot(bx, by) || 1; const R = ch * 0.5 * r1;
      const facing = (bx * lx + by * ly) / bl;
      let v = v0 + (hash(id, 0, seed + 4) - 0.5) * 0.9 + facing * bevel * Math.min(1, bl / (R * 0.8));
      if (d2 - d1 < gap * 2.2) v += facing > 0.25 ? 0.9 : facing < -0.25 ? -0.7 : 0;   // the stone's own edge
      if (n2(X / (2.6 * u), Y / (2.6 * u), seed + (id & 63)) > 0.68) v += 0.5;             // lichen
      p.r[i] = S; p.v[i] = v; p.z[i] = z;
    });
  }

  /** An orthostat: a great slab set upright against the wall, rough-edged, maybe carved. */
  function orthostat(p, cx, fy, w, h, u, o = {}) {
    const r = rng(o.seed ?? 1); const z = o.z ?? 3;
    const j = () => (r() - 0.5) * 1.6 * u;
    const sh = C.poly([[cx - w / 2 + j(), fy + 1], [cx - w / 2 + j(), fy - h * 0.5], [cx - w * 0.42 + j(), fy - h * 0.9], [cx - w * 0.1, fy - h + j() * 0.5], [cx + w * 0.3, fy - h * 0.97 + j() * 0.5],
      [cx + w / 2 + j(), fy - h * 0.8], [cx + w / 2 + j(), fy - h * 0.35], [cx + w / 2 + j(), fy + 1]]);
    const grow = C.poly(sh[0].map(([x, y]) => [cx + (x - cx) * 1.12 + (x < cx ? -0.6 : 0.6), y < fy ? y - 1.2 * u : y]));
    p.fill(grow, 'earth', 0.8, z);
    p.fill(sh, 'stone', o.v ?? 1.8, z);
    p.cells(sh, { size: Math.max(3, w * 0.55), joint: 0.5, jointV: -0.6, vary: 0.4, bevel: 0.6, seed: (o.seed ?? 1) % 97, z });
    if (o.carve) {
      const cr = rng((o.seed ?? 1) + 5);
      for (let k = 0; k < o.carve; k += 1) cupRing(p, cx + (cr() - 0.5) * w * 0.4, fy - h * (0.4 + cr() * 0.35), Math.max(1.6, (1.8 + cr() * 1.2) * u), z, 1.2, cr() < 0.5 ? 2 : 1);
    }
    return sh;
  }

  /** A root come through the roof: wandering down, tapering, a few hairs off it. */
  function root(p, x, y0, len, u, o = {}) {
    const r = rng(o.seed ?? 'root'); const z = o.z ?? 4; const v = o.v ?? 2.4; const w0 = (o.w ?? 2.4) * u;
    let cx = x; let cy = y0; let a = Math.PI / 2 + (r() - 0.5) * 0.4;
    const steps = Math.max(2, Math.ceil(len / Math.max(1, u)));
    const step = len / steps;
    for (let k = 0; k < steps; k += 1) {
      const w = Math.max(1, w0 * (1 - k / steps) ** 0.7);
      a = clamp(a + (r() - 0.5) * 0.5, Math.PI / 2 - 0.7, Math.PI / 2 + 0.7);
      const nx = cx + Math.cos(a) * step; const ny = cy + Math.sin(a) * step;
      limb(p, cx, cy, nx, ny, w, w, 'root', v, z);
      if (k > 2 && r() < 0.1) {
        const ha = a + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.5); const hl = (2 + r() * 4) * u;
        limb(p, nx, ny, nx + Math.cos(ha) * hl, ny + Math.sin(ha) * hl + hl * 0.4, 1, 1, 'root', v, z);
      }
      cx = nx; cy = ny;
    }
  }

  /**
   * A stone coffin, side-on: a plinth, a box carved with an arcade, a lid
   * with a chamfered edge, and on the lid the dead lying asleep in stone:
   * his head on a cushion, hands together on his chest, a sword along him,
   * feet up against a little hound.
   */
  function coffin(p, x0, x1, fy, h, u, o = {}) {
    const z = o.z ?? 3; const v = o.v ?? 2; const L = x1 - x0;
    const plinth = Math.max(1.5, h * 0.1); const lid = Math.max(2, h * 0.2); const boxTop = fy - h + lid;
    p.fill(C.rect(x0 - 1.5 * u, fy - plinth, L + 3 * u, plinth + 1), 'stone', v - 0.6, z);
    p.fill(C.rect(x0, boxTop, L, fy - plinth - boxTop), 'stone', v - 0.9, z);
    // The arcade: little round-headed panels cut into the side, dark inside, their sills catching the light.
    const n = Math.max(2, Math.round(L / (9 * u))); const pw = L / n; const ph = (fy - plinth - boxTop) * 0.62; const py = boxTop + (fy - plinth - boxTop) * 0.2;
    if (pw > 4) {
      for (let k = 0; k < n; k += 1) {
        const ax = x0 + pw * (k + 0.5); const aw = pw * 0.32;
        p.fill(C.arch(ax, py, aw, py + ph), 'stone', v - 2.4, z);
        p.fill(C.rect(ax - aw, py + ph, aw * 2, 1), 'stone', v + 0.8, z);
      }
    }
    p.fill(C.rect(x0, boxTop, L, 1), 'shadow', 0, z);
    // The lid: chamfered, its top edge lit.
    p.fill(C.poly([[x0 - 1.4 * u, boxTop + 0.5], [x0 - 0.6 * u, boxTop - lid], [x1 + 0.6 * u, boxTop - lid], [x1 + 1.4 * u, boxTop + 0.5]]), 'stone', v + 0.6, z);
    p.fill(C.rect(x0 - 0.6 * u, boxTop - lid, L + 1.2 * u, 1), 'stone', v + 1.2, z);
    p.fill(C.rect(x0 - 0.6 * u, boxTop - lid + 1, L + 1.2 * u, Math.max(1, lid - 1)), 'stone', v + 0.2, z);
    if (o.effigy !== false) {
      const ty = boxTop - lid; const eh = o.eh ?? h * 0.42; const dir = o.headLeft === false ? -1 : 1;
      const at = (f) => (dir > 0 ? x0 + f * L : x1 - f * L);
      const P = (pts) => C.poly(pts.map(([f, hh]) => [at(f), ty - hh * eh]));
      const ev = v + 1.8;
      p.fill(P([[0.02, -0.05], [0.02, 0.32], [0.17, 0.36], [0.17, -0.05]]), 'stone', ev - 0.4, z);                       // the cushion
      p.fill(C.circle(at(0.1), ty - 0.58 * eh, 0.3 * eh, 14), 'stone', ev + 0.4, z);                                 // the head
      p.fill(P([[0.15, -0.05], [0.17, 0.4], [0.22, 0.58], [0.3, 0.66], [0.36, 0.7], [0.37, 1.02], [0.395, 1.02], [0.41, 0.7], [0.48, 0.62],
        [0.56, 0.5], [0.84, 0.4], [0.87, 0.82], [0.9, 0.86], [0.91, 0.4], [0.92, -0.05]]), 'stone', ev, z);           // the body, hands, feet
      p.fill(P([[0.92, -0.05], [0.93, 0.36], [0.96, 0.46], [0.985, 0.34], [0.99, -0.05]]), 'stone', ev - 0.3, z);      // the hound
      limb(p, at(0.42), ty - 0.74 * eh, at(0.78), ty - 0.44 * eh, 1, 1, 'stone', ev + 1.2, z);                         // the sword along him
      limb(p, at(0.42), ty - 0.92 * eh, at(0.42), ty - 0.56 * eh, 1, 1, 'stone', ev + 0.8, z);                         // its crossguard
    }
  }

  /** A grave-goods urn: a round pot with a lip, a band of cord marks. */
  function urn(p, cx, fy, s, z, v = 1.6) {
    p.fill(C.poly([[cx - s * 0.28, fy], [cx - s * 0.48, fy - s * 0.4], [cx - s * 0.36, fy - s * 0.82], [cx - s * 0.4, fy - s], [cx + s * 0.4, fy - s], [cx + s * 0.36, fy - s * 0.82], [cx + s * 0.48, fy - s * 0.4], [cx + s * 0.28, fy]]), 'earth', v, z);
    p.fill(C.rect(cx - s * 0.4, fy - s, s * 0.8, 1), 'earth', v + 1.2, z);
    p.shade(C.rect(cx - s * 0.44, fy - s * 0.66, s * 0.88, 1), 0.8, z);
    p.shade(C.rect(cx + s * 0.1, fy - s * 0.8, s * 0.3, s * 0.7), -0.6, z);
  }

  /** Bones on the floor: a few short pale strokes and a skull. */
  function bones(p, x0, x1, y0, y1, n, u, seed, z = 1, v = 2.4) {
    const r = rng(seed); const B = p.ri('bone'); const V = p.ri('void');
    for (let k = 0; k < n; k += 1) {
      const x = lerp(x0, x1, r()); const y = lerp(y0, y1, r()); const sc = 0.7 + (y - y0) / Math.max(1, y1 - y0) * 0.6;
      if (k % 4 === 0) {
        p.fill(C.ellipse(x, y, 1.6 * u * sc, 1.3 * u * sc, 10), 'bone', v + 0.6, z);
        dot(p, x - 0.7 * u * sc, y, V, 0, z); dot(p, x + 0.5 * u * sc, y, V, 0, z);
      } else {
        const a = (r() - 0.5) * 0.8; const l = (3 + r() * 3) * u * sc;
        limb(p, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5, 1, 1, 'bone', v, z);
        dot(p, x, y, B, v + 0.8, z); dot(p, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5, B, v + 0.8, z);
      }
    }
  }

  /**
   * A wisp: a cold flame with nothing under it, a round heart and a long tip
   * licking off to one side, `s` pixels tall. Drawn on the snapped picture.
   */
  function drawWisp(img, x, y, s, lean, a = 1) {
    const r = Math.max(1.2, s * 0.3); const ax = Math.abs(lean) + r + 1;
    for (let py = Math.floor(y - s); py <= Math.ceil(y + r); py += 1) {
      for (let px = Math.floor(x - ax); px <= Math.ceil(x + ax); px += 1) {
        const X = px + 0.5; const Y = py + 0.5; let d; let t = 0;
        if (Y >= y) d = Math.hypot(X - x, Y - y) / r;
        else {
          t = (y - Y) / s; if (t > 1) continue;
          const cx = x + lean * t * t + Math.sin(t * 6 + lean * 2) * 0.5 * t;
          d = Math.abs(X - cx) / Math.max(0.55, r * (1 - t) ** 0.9);
        }
        if (d > 1) continue;
        put(img, px, py, d < 0.4 && t < 0.35 ? '#FFFFFF' : d < 0.68 && t < 0.7 ? '#D3E3EC' : d < 0.9 ? '#8DAEC2' : '#3C596D', a);
      }
    }
  }
  /** A wisp's cold light on the stone round it, sized by the wisp. */
  function wispLight(p, x, y, s, k = 1, flick = null, o = {}) {
    p.light(x, y, s * 3.4 * k, o.v ?? 7, flick, { zMin: 1, hard: true, zMax: o.zMax });
    p.light(x, y, s * 7 * k, 1.6, null, { zMin: 1, zMax: o.zMax });
  }

  /**
   * The corbelled roof over the end wall: courses of great slabs each
   * stepping in over the one below, till a capstone closes the top. The
   * chamber's opening at height y is gx ± hwAt(y). Their inner ends catch
   * the light; under each, a black lip where it oversails the next.
   */
  function corbelVault(p, W, gx, u, o) {
    const { cap, capHW, stepH, stepW, n, lights, seed, back } = o;
    const hwAt = (y) => (y < cap ? -1 : capHW + Math.floor((y - cap) / stepH) * stepW);
    const S = p.ri('stone'); const SH = p.ri('shadow');
    const yEnd = cap + n * stepH;
    // The courses: one row of great slabs each, their joints on the course lines, lit a little from below.
    slabWall(p, C.rect(0, 0, W, yEnd), u, { ch: stepH / u, cw: 17, seed, z: 4, v: 2.6, bevel: 1.4, lights, gap: 1.1, oy: cap, jy: 0.08 });
    // Inside the steps the chamber opens again onto the end wall, pushed back into the vault's shadow.
    p.each(C.rect(0, 0, W, yEnd), (x, y, i) => {
      const hw = hwAt(y + 0.5);
      if (hw >= 0 && Math.abs(x + 0.5 - gx) < hw) { p.r[i] = back.r[i]; p.v[i] = back.v[i] - (back.z[i] === 1 ? 2.4 - 1.4 * (y - cap) / (yEnd - cap) : 0); p.z[i] = back.z[i]; }
    });
    for (let k = 0; k <= n; k += 1) {
      const y0 = cap + k * stepH; const hwK = hwAt(y0 + 0.5); const hwUp = k === 0 ? 0 : hwAt(y0 - 0.5);
      // Under each course where it oversails the one below: a black lip.
      const lipH = Math.max(2, Math.round(1.8 * u));
      for (let dy = 0; dy < lipH; dy += 1) {
        const yy = Math.floor(y0) + dy; if (yy >= p.h) break;
        for (let x = 0; x < W; x += 1) {
          const ax = Math.abs(x + 0.5 - gx);
          if (ax >= hwUp && ax < hwK) { const i = yy * W + x; p.r[i] = SH; p.v[i] = dy ? 0.6 : 0.1; p.z[i] = 4; }
        }
      }
      if (k === n) break;
      // The inner end of each course, toward the light: a bright stripe two pixels wide.
      for (let y = Math.floor(y0); y < Math.min(p.h, y0 + stepH); y += 1) {
        for (const m of [-1, 1]) {
          for (let w = 0; w < 2; w += 1) {
            const xe = m < 0 ? Math.floor(gx - hwK) - 1 - w : Math.ceil(gx + hwK) + w;
            if (xe >= 0 && xe < W) { const i = y * W + xe; if (p.z[i] === 4 && p.r[i] === S) p.v[i] += w ? 0.6 : 1.6; }
          }
        }
      }
    }
    return hwAt;
  }

  /** The corbels along the top of a long wall, seen from inside: courses stepping out toward you overhead, black under each. */
  function corbelBands(p, W, u, o) {
    let y = 0;
    for (const [hgt, lip] of o.courses) {
      slabWall(p, C.rect(0, y, W, hgt * u), u, { ch: hgt, cw: 18, seed: o.seed + y, z: 4, v: o.v ?? 1.8, bevel: 1.4, lights: o.lights, gap: 1 });
      p.fill(C.rect(0, y + hgt * u, W, lip * u), 'shadow', (x, yy) => (yy - y - hgt * u < 1 ? 0.2 : 0.6), 4);
      y += (hgt + lip) * u;
    }
    return y;
  }

  /** A snapshot of the painter's pixels, to put part of it back later. */
  const snap = (p) => ({ r: p.r.slice(), v: p.v.slice(), z: p.z.slice() });

  /**
   * The inner door: three stones set in the wall round a black opening, earth
   * packed round them; the lintel is cut with a band of lozenges.
   */
  function innerDoor(p, gx, top, hw, floor, u, o = {}) {
    const lt = o.lt ?? 8 * u; const t = o.t ?? 6 * u;
    // The earth packed round the great stones, so they sit in the wall rather than on it.
    const ring = trilithon({ fill() {}, cells() {} }, gx, top, hw, floor, u, { t, lt });
    for (const sh of [...ring.up, ring.lintel]) p.fill(C.poly(sh[0].map(([x, y]) => [gx + (x - gx) * 1.08 + (x < gx ? -u : u), y < floor ? y - 1.2 * u : y])), 'earth', 0.7, 5);
    const tri = trilithon(p, gx, top, hw, floor, u, { z: 5, t, lt, v: o.v ?? 2.2, seed: o.seed ?? 31 });
    edge(p, 5, -1, 0, 'stone', 1.1, true); edge(p, 5, 1, 0, 'stone', 1.1, true); edge(p, 5, 0, -1, 'stone', 1.5, true);
    if (!o.open) {
      // The dark through it: only the wall's thickness shows, a reveal down each side, the sill, the lintel's underside.
      const rv = Math.max(2, 2.4 * u); const V = p.ri('void'); const S = p.ri('stone');
      p.each(tri.open, (x, y, i) => {
        const ax = Math.abs(x + 0.5 - gx); const fromTop = y + 0.5 - top; p.z[i] = 2;
        if (ax > hw - rv) { p.r[i] = S; p.v[i] = 2.2 - (hw - ax) / rv * 1.2 - ((fromTop / (3 * u)) % 1 < 0.25 ? 0.6 : 0); }
        else if (fromTop < rv * 0.8) { p.r[i] = S; p.v[i] = 0.7; }
        else if (y + 0.5 > floor - rv * 0.8) { p.r[i] = S; p.v[i] = 1.3; }
        else { p.r[i] = V; p.v[i] = 0.3; }
      });
    }
    const ly = top - lt * 0.5; const amp = lt * 0.22; const per = Math.max(4, lt * 0.8);
    for (let x = gx - hw - 5 * u; x < gx + hw + 5 * u; x += 0.5) {
      const ph = frac((x - gx) / per); const tri2 = Math.abs(ph * 2 - 1) * 2 - 1;
      for (const m of [-1, 1]) { const px = Math.floor(x); const py = Math.floor(ly + m * tri2 * amp); if (p.z[py * p.w + px] === 5) p.shade(C.rect(px, py, 1, 1), 0.9, 5); }
    }
    return tri;
  }

  const B = {
    job: 0, setting: 'barrow-moor', key: 'B', id: 'barrow-moor-b', side: 'inside',
    name: 'The Barrow Moor', title: 'The barrow-king’s tomb',
    pitch: 'Inside one of the mounds: walls of great rough stones packed with earth, a roof that steps in course by course, roots hanging through it. The dead lie in stone on their coffin lids, and wisps of cold light drift over them. The way on is the same three stones, and it is dark.',
    notes: [
      ['Light', 'No way out to the sky: the only light is a few wisps, cold flames of different sizes drifting at different heights, one low over a coffin, one up in the roof. Each leaves a pool of pale blue on the stones and black between. On a face-down card the inner door is black.'],
      ['Detail', 'Slabs and boulders laid in rough courses with earth between, each stone lit on the side toward the nearest wisp; a corbelled roof stepping in to its capstone; a knight asleep on his coffin with his sword and his hound; lozenges on the lintel, cup-and-ring marks, roots, an urn.'],
      ['Vista', 'The chamber wall the width of the board under its stepped corbels, coffins in deep recesses, wisps drifting irregularly along it. The card stands in the inner door: the wight risen against a cold glow, the gravedigger come to rob the dead, a cist of grave goods glowing violet, the door sealed with a carved slab, or the slab rolled back on gold.'],
      ['World', 'The barrow’s floor under the table, earth and worn flags falling to black; the slab walls at the edges with a coffin against each, wisps drifting along them, roots at the corners, the vista’s cold glow along the top.'],
    ],
    palette: ['#050605', '#121512', '#242A27', '#424C4E', '#748792', '#C4D4DE', '#28231F', '#6C91A7', '#EEF6FA'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['ghost', 'void'], dither: 0.22 });
      const u = H / 134; const gx = W / 2; const floor = Math.round(100 * u);
      // The wisps: one low over the coffin, one up in the corbelling, a small one by the wall. Not a pair.
      const wisps = [[33 * u, 97 * u, 12 * u, 3], [80 * u, 32 * u, 9 * u, -2.4], [14 * u, 64 * u, 7 * u, 1.8]];
      const L = wisps.map(([x, y]) => [x, y]);
      // The end wall: great stones in rough courses, the earth between.
      slabWall(p, C.rect(0, 0, W, floor), u, { ch: 10, cw: 15, seed: 3, v: 1.6, lights: L });
      orthostat(p, 76 * u, floor, 12 * u, 40 * u, u, { seed: 4, carve: 2, v: 1.8 });
      p.fill(C.rect(0, floor, W, H - floor), 'earth', 1.6, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: gx, vy: floor - 40 * u, rows: 4, size: 0.9, d0: 40 * u, joint: -1.1, top: 0.45, vary: 0.8, chip: 0.06, seed: 4, z: 1 });
      innerDoor(p, gx, 58 * u, 10 * u, floor, u, { t: 6 * u, lt: 9 * u });
      // The roof stepping in over it to a capstone.
      const back = snap(p);
      corbelVault(p, W, gx, u, { cap: 8 * u, capHW: 11 * u, stepH: 9 * u, stepW: 9 * u, n: 4, lights: L, seed: 7, back });
      // Roots hanging out of the joints under the courses, kept clear of the wisps.
      for (const [x, y, l, sd] of [[gx - 6, 10, 26, 1], [gx + 4, 10, 14, 2], [gx - 15, 19, 40, 3], [gx - 24, 28, 22, 5], [gx + 25, 28, 12, 6], [gx + 33, 37, 34, 7], [gx - 35, 37, 16, 8], [gx + 12, 19, 8, 9]]) {
        root(p, x * u, y * u, l * u, u, { seed: `b-root-${sd}`, z: 4, w: 2.2 });
      }
      urn(p, 82 * u, 108 * u, 7 * u, 3, 1.8);
      bones(p, 58 * u, 76 * u, 104 * u, 112 * u, 3, u, 'back-bones', 1);
      for (const [x, y, s] of wisps) wispLight(p, x, y, s);
      // The knight on his coffin across the foreground, drawn after the light so it keeps clean bands,
      // then lit by the low wisp alone.
      coffin(p, 6 * u, 88 * u, 138 * u, 17 * u, u, { z: 8, v: 2.4, eh: 11 * u });
      p.light(wisps[0][0], wisps[0][1], 46 * u, 5.4, null, { zMin: 8, zMax: 8, hard: true });
      edge(p, 8, 0, -1, 'stone', 2, true);
      p.rim(0, -1, 0.5, 3);
      vignette(p, W, H, 2, 0.5);
      return {
        p,
        over(img) {
          wisps.forEach(([x, y, s, lean]) => drawWisp(img, x, y, s, lean));
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['ghost', 'void', 'path'], dither: 0.22 });
      const u = H / 100; const gx = W / 2; const floor = Math.round(86 * u);
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const top = 32 * u; const hw = 15 * u;
      // Wisps along the chamber, irregular: [dx, y, size, lean] in u.
      const wisps = [[-58, 60, 9, 1.4], [34, 22, 7, -1], [104, 56, 8, 0.9], [-122, 30, 6, -0.8], [158, 66, 7, 1.2], [-188, 54, 8, -1.3], [214, 26, 6, 0.7], [-236, 70, 6, 1]]
        .map(([dx, y, s, l]) => [gx + dx * u, y * u, s * u, l]).filter(([x]) => x > -20 * u && x < W + 20 * u);
      const L = wisps.map(([x, y]) => [x, y]);
      slabWall(p, C.rect(0, 0, W, floor), u, { ch: 10, cw: 16, seed: 5, v: 1.6, lights: L });
      p.fill(C.rect(0, floor, W, H - floor), 'earth', 1.6, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: gx, vy: floor - 30 * u, rows: 4, size: 0.9, d0: 30 * u, joint: -1.1, top: 0.45, vary: 0.8, chip: 0.06, seed: 8, z: 1 });
      // Deep recesses with coffins in them, fewer and bigger; carved slabs and heaps of grave goods between.
      const bays = [[-58, 1], [104, 2], [-188, 3], [214, 4]].map(([dx, k]) => [gx + dx * u, k]).filter(([x]) => x > -40 * u && x < W + 40 * u);
      for (const [cx, k] of bays) {
        const rec = C.poly([[cx - 26 * u, floor], [cx - 26 * u, 44 * u], [cx - 20 * u, 37 * u], [cx - 12 * u, 31 * u], [cx + 12 * u, 31 * u], [cx + 20 * u, 37 * u], [cx + 26 * u, 44 * u], [cx + 26 * u, floor]]);
        p.fill(rec, 'earth', 0.5, 2);
        slabWall(p, rec, u, { ch: 8, cw: 12, seed: 20 + k, z: 2, v: 0.5, bevel: 0.9, lights: L, ev: 0.3 });
        coffin(p, cx - 21 * u, cx + 21 * u, floor, 17 * u, u, { z: 3, headLeft: k % 2 === 1, v: 2.2, eh: 8 * u });
      }
      for (const [dx, sd] of [[52, 1], [-112, 2], [150, 3], [-250, 4]]) {
        const x = gx + dx * u; if (x < -20 * u || x > W + 20 * u) continue;
        orthostat(p, x, floor, 12 * u, 50 * u, u, { seed: 40 + sd, carve: 2, v: 1.8 });
      }
      for (const [dx, s] of [[-30, 8], [72, 7], [-150, 9]]) urn(p, gx + dx * u, floor + 2 * u, s * u, 3, 1.8);
      const tri = innerDoor(p, gx, top, hw, floor, u, { t: 6 * u, lt: 9 * u, open: cat === 'clear-path' });
      // The corbels overhead, stepping out toward you; roots hanging out of their joints.
      const roofY = corbelBands(p, W, u, { courses: [[7, 2.6], [5.5, 1.8], [4.5, 1.2]], seed: 9, lights: L });
      const rr = rng('v-roots');
      for (let x = rr() * 20 * u; x < W; x += (9 + rr() * 26) * u) {
        if (Math.abs(x - gx) < 12 * u) continue;
        root(p, x, roofY * (0.3 + rr() * 0.7), (8 + rr() ** 1.6 * 40) * u, u, { seed: `v-root-${Math.round(x)}`, w: 2.2 });
      }
      // The card, in the inner door.
      const fy = floor - 1;
      if (cat === 'monster') {
        p.each(tri.open, (x, y, i) => {
          const d = Math.hypot((x + 0.5 - gx) / hw, (y + 0.5 - (floor - 20 * u)) / (34 * u));
          p.r[i] = p.ri('ghost'); p.z[i] = 2; p.v[i] = Math.round(4.2 - Math.min(1, d) * 3.6);
        });
        const s = 48 * u;
        const w = wight(p, gx, fy, s, { z: 6, eyes: ramp, v: 0.4 });
        p.backlit(6, 'ghost', 1.4, 'ghost', 5.6);
        p.tint(gx, w.ey, 6 * u, hex, 0.45, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 42 * u;
        const g = gravedigger(p, gx - 3 * u, fy, s, { z: 6 });
        edge(p, 6, -1, 0, 'stone', 4.4); edge(p, 6, 1, 0, 'stone', 4); edge(p, 6, 0, -1, 'stone', 5);
        lantern(p, g.lx, g.ly, ramp, 8, true);
        p.light(g.lx + 1, g.ly + 2, 20 * u, 3, flicker(0.9, 0.15), { zMin: 1, zMax: 3 });
        p.tint(g.lx + 1, g.ly + 2, 6 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(g.lx + 1, g.ly + 2, 12 * u, hex, 0.4, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        const g = cist(p, gx, fy + 1 * u, 38 * u, ramp, 6);
        p.tint(g[0], g[1] - 2 * u, 10 * u, hex, 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        const s = seal(p, gx, top, hw, floor, u, ramp, 6);
        p.tint(gx, s.cy, s.R * 1.3, hex, 0.35, flicker(0.5, 0.12, 0.6));
      } else {
        // The way on: the passage beyond lit gold, its walls and floor running in to the light.
        const fi = (floor - top) * 0.34; const wf = hw * 0.4; const PA = p.ri('path');
        p.each(tri.open, (x, y, i) => {
          const ax = Math.abs(x + 0.5 - gx); const t = clamp((hw - ax) / (hw - wf), 0, 1);
          const yTop = lerp(top, top + fi * 0.8, t); const yBot = lerp(floor, floor - fi, t);
          p.r[i] = PA; p.z[i] = 2;
          if (ax <= wf && y + 0.5 > yTop && y + 0.5 < yBot) p.v[i] = 4.4 - Math.abs(y + 0.5 - (yTop + yBot) / 2) / ((yBot - yTop) / 2) * 0.8;
          else if (y + 0.5 >= yBot) p.v[i] = Math.round(1.6 + t * 2) - ((((floor - y) / fi) * 3) % 1 < 0.2 ? 0.8 : 0);
          else p.v[i] = Math.round(1.2 + t * 2) - ((((y - yTop) / (yBot - yTop)) * 5) % 1 < 0.2 ? 0.8 : 0);
        });
        // The slab, rolled aside against the wall.
        p.fill(C.poly([[gx + hw + 6 * u, floor + 1], [gx + hw + 6.5 * u, top + 8 * u], [gx + hw + 12 * u, top + 4 * u], [gx + hw + 16 * u, top + 10 * u], [gx + hw + 16 * u, floor + 1]]), 'stone', 2.2, 5);
        p.light(gx, floor, 36 * u, 4, flicker(0.2, 0.06, 0.4), { zMin: 1, zMax: 1, sy: 0.4 });
        p.tint(gx, floor + 3 * u, 16 * u, CARD.path[3], 0.4, flicker(0.2, 0.08, 0.4));
      }
      wisps.forEach(([x, y, s], i) => wispLight(p, x, y, s, 1, flicker(i * 1.7, 0.14, 0.5), { v: 6.4 }));
      edge(p, 3, 0, -1, 'stone', 1.4, true);
      p.rim(0, -1, 0.5, 3);
      vignette(p, W, H, 1.8, 0.42);
      return {
        p,
        over(img, t) {
          wisps.forEach(([x, y, s, lean], i) => drawWisp(img, x + Math.sin(t * 0.4 + i * 2.1) * 2 * u, y + Math.sin(t * 0.7 + i) * 1.5 * u, s, lean + Math.sin(t * 1.3 + i) * 0.8));
          for (const q of particles('mote', Math.round(W / 14), [0, 10 * u, W, floor - 10 * u], t, 41)) {
            const i = Math.round(q.y) * W + Math.round(q.x);
            if (p.v[i] > 5) put(img, q.x, q.y, '#8DAEC2', q.a * 0.6);
          }
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 10 * u, fy - 34 * u, 20 * u, 24 * u], t, 73)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          if (cat === 'clear-path') for (const q of particles('mote', 12, [gx - hw, top, hw * 2, floor - top], t, 71)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a * 0.8);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['ghost', 'void'], dither: 0.22 });
      const u = H / 250;
      p.fill(C.rect(0, 0, W, H), 'earth', 1.3, 1);
      p.floor(C.rect(0, 0, W, H), { vx: W / 2, vy: -90 * u, rows: 3.2, size: 1.1, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.2, vary: 0.8, chip: 0.05, seed: 17, z: 1 });
      // Wisps drifting along the walls, at different heights and sizes.
      const wisps = [[16 * u, 92 * u, 9 * u, 1.2], [W - 15 * u, 176 * u, 10 * u, -1.4], [W - 12 * u, 64 * u, 6 * u, 0.8], [11 * u, 214 * u, 7 * u, -0.9]];
      const L = wisps.map(([x, y]) => [x, y]);
      // The slab walls at the edges, a coffin against each, seen from above, its sleeper carved on the lid.
      for (const side of [0, 1]) slabWall(p, C.rect(side ? W - 9 * u : 0, 0, 9 * u, H), u, { ch: 12, cw: 9, seed: 11 + side, z: 3, v: 1.2, lights: L, ev: 0.6 });
      for (const [side, y0, y1] of [[0, 60, 140], [1, 128, 210]]) {
        const cx = side ? W - 20 * u : 20 * u; const a = y0 * u; const b = y1 * u; const len = b - a;
        const lid = C.poly([[cx - 7 * u, a], [cx + 7 * u, a], [cx + 8.5 * u, a + len * 0.2], [cx + 6 * u, b], [cx - 6 * u, b], [cx - 8.5 * u, a + len * 0.2]]);
        p.fill(lid, 'stone', (x) => (x < cx ? 1.4 : 0.9), 4);
        // The sleeper, head toward the far end: head, shoulders, hands together, the sword, the feet.
        p.fill(C.circle(cx, a + len * 0.12, 3 * u, 12), 'stone', 2.2, 4);
        p.fill(C.poly([[cx - 4.5 * u, a + len * 0.2], [cx + 4.5 * u, a + len * 0.2], [cx + 3 * u, a + len * 0.62], [cx + 2 * u, a + len * 0.9], [cx - 2 * u, a + len * 0.9], [cx - 3 * u, a + len * 0.62]]), 'stone', 1.8, 4);
        p.shade(C.rect(cx - 0.5, a + len * 0.24, 1, len * 0.56), 0.9, 4);
        p.shade(C.rect(cx - 2 * u, a + len * 0.3, 4 * u + 1, 1), 0.9, 4);
        p.shade(C.poly([[cx - 8 * u, b], [cx + 8 * u, b], [cx + 8 * u, b + 4 * u], [cx - 8 * u, b + 4 * u]]), -1, 1);
      }
      wisps.forEach(([x, y, s], i) => {
        p.light(x, y, s * 3.2, 3.6, flicker(i * 2.3, 0.15, 0.6), { zMin: 1, hard: true });
        p.light(x, y, s * 5.6, 0.8, null, { zMin: 1 });
      });
      // The inner door's cold glow along the top.
      p.light(W / 2, -24 * u, 160 * u, 2.2, flicker(0.7, 0.06, 0.5), { sx: 1.7 });
      for (const [x, l, sd] of [[4, 70, 1], [12, 40, 2], [W / u - 4, 80, 3], [W / u - 13, 44, 4]]) root(p, x * u, 0, l * u, u, { seed: `w-root-${sd}`, z: 5, w: 3 });
      p.shade(null, (x, y) => -0.9 * clamp((y / H - 0.27) / 0.08, 0, 1) - 1.2 * Math.max(0, y / H - 0.45), 1);
      return {
        p,
        over(img, t) {
          wisps.forEach(([x, y, s, lean], i) => drawWisp(img, x + Math.sin(t * 0.3 + i * 1.9) * 3 * u, y + Math.sin(t * 0.5 + i) * 4 * u, s, lean + Math.sin(t * 1.1 + i) * 0.8, 0.95));
          for (const q of particles('mote', 10, [0, 0, 22 * u, H], t, 51)) put(img, q.x, q.y, '#517489', q.a * 0.7);
          for (const q of particles('mote', 10, [W - 22 * u, 0, 22 * u, H], t, 52)) put(img, q.x, q.y, '#517489', q.a * 0.7);
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B]);
})();

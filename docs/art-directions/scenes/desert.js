/* Job 4, the desert: two directions. */
(() => {
  const { C, Painter, put, sprite, SPRITES, particles, flicker, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /** Darken toward the edges, leaving one layer (the sky) alone. */
  function vignette(p, W, H, k = 2, cy = 0.45, skipZ = -1) {
    p.shade(null, (x, y, i) => (p.z[i] === skipZ ? 0 : -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55)));
  }

  /**
   * Dunes along a line: a long windward slope up to a sharp crest, a steep
   * lee face down. h(x) in 0..1; each dune its own height; dir -1 mirrors.
   */
  function waves(seed, period, a = 0.66, dir = 1) {
    const r = rng(seed);
    const ph = r() * 40; const b = r() * 6.283;
    return (x) => {
      const X = x * dir;
      const s = X / period + ph + 0.1 * Math.sin((X / period) * 0.9 + b);
      const k = Math.floor(s); const f = s - k;
      const h = f < a ? (f / a) ** 1.5 : (1 - (f - a) / (1 - a)) ** 1.5;
      return h * (0.5 + 0.5 * hash(k, 0, seed));
    };
  }

  /** Soft rolling dunes, for moonlight: h(x) in 0..1, no sharp crests. */
  function rolling(seed, period) {
    const r = rng(seed); const a = r() * 6.283; const b = r() * 6.283; const c = r() * 6.283;
    return (x) => 0.5 + 0.5 * (0.6 * Math.sin(x / period + a) + 0.3 * Math.sin(x / (0.43 * period) + b) + 0.1 * Math.sin(x / (0.19 * period) + c));
  }

  /**
   * A row of dunes below a crest line. The face turned toward the light is
   * lighter near the crest (fading by faceD below it); the split between
   * faces leans by `lean`. The crest is a rim, brightest near the light;
   * ripples run along it.
   */
  function duneRow(p, W, H, crest, o) {
    let top = H;
    for (let x = 0; x <= W; x += 1) top = Math.min(top, crest(x + 0.5));
    const y0 = Math.max(0, Math.floor(top) - 1);
    const rn = o.rimNear ?? 1;
    p.fill(C.rect(0, y0, W, H - y0), o.ramp, (x, y) => {
      const cx = x + 0.5; const d = y + 0.5 - crest(cx);
      if (d < 0) return null;
      const xs = cx - d * (o.lean || 0);
      const sl = crest(xs + 0.8) - crest(xs - 0.8);
      const toward = o.lightX > cx;
      const face = o.soft ? clamp(0.5 + (toward ? sl : -sl) * o.soft, 0, 1)
        : Math.abs(sl) < (o.flat ?? 0.05) ? 0.5 : ((sl > 0) === toward ? 1 : 0);
      const near = o.reach ? Math.exp(-Math.abs(cx - o.lightX) / o.reach) : 0;
      const fd = o.faceD ? Math.exp(-d / o.faceD) : 1;
      let v = o.v + face * fd * ((o.lit || 0) + (o.litNear || 0) * near) - Math.min(d, o.depth || 1e9) * (o.fall || 0);
      if (d < (o.rimW || 1.2)) v += (o.rim || 0) * (1 - rn + rn * near);
      if (o.ripple && d > 2) {
        const q = (d + 1.3 * Math.sin(cx * 0.21 + d * 0.13 + (o.seed || 0))) / o.ripple;
        const f = q - Math.floor(q); const rv = (o.rippleV || 0.55) * (1 - 0.5 * (1 - face) * fd);
        if (f < 0.22) v -= rv; else if (f < 0.36) v += rv * 0.6;
      }
      return v;
    }, o.z);
  }

  /**
   * Dunes on the ground seen in perspective (for a world): crest lines run
   * across, crowding toward the horizon; just below each crest its face is
   * darkest, lightening toward the next; wind ripples between. Adds to
   * layer z only.
   */
  function duneField(p, W, H, hor, o) {
    p.shade(C.rect(0, hor, W, H - hor), (x, y, i) => {
      if (p.z[i] !== o.z) return 0;
      const dy = y + 0.5 - hor;
      if (dy <= 0) return 0;
      const q = dy + o.c;
      const lat = (x + 0.5 - o.vx) / q;
      const ph = o.k / q + 0.3 * Math.sin(lat * o.wf + o.seed) + 0.12 * Math.sin(lat * o.wf * 2.9 + o.seed * 2);
      const f = ph - Math.floor(ph);
      const fade = smooth(o.fade0, o.fade1, dy);
      let dv = f > 1 - o.rimF ? o.rim : -o.dark * smooth(0.15, 0.97, f);
      const rp = ph * o.rip + 0.4 * Math.sin(lat * o.wf * 4.3 + o.seed);
      const g = rp - Math.floor(rp);
      if (g < 0.2) dv -= o.ripV; else if (g < 0.32) dv += o.ripV * 0.5;
      return dv * fade;
    }, o.z);
  }

  /** A spire of layered rock: ragged sides with ledges, a waist, maybe a cap rock wider than its neck. */
  function spire(p, x, base, w, h, o) {
    const r = rng(o.seed);
    const n = Math.max(6, Math.round(h / 2));
    const L = []; const R = [];
    let jl = 0; let jr = 0;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      // A skirt of fallen rock at the foot, then the cliff: straight for a butte, tapering for a needle.
      const core = o.mesa ? 0.56 : 0.42; const sk = o.mesa ? 0.42 : 0.34;
      let hw = t < sk ? core + (1 - core) * (1 - t / sk) ** 2 : core * (o.mesa ? 1 - 0.08 * (t - sk) : 1 - 0.4 * (t - sk) / (1 - sk));
      hw *= w / 2;
      if (o.cap) { if (t > 1 - o.cap) hw = (w / 2) * 0.46; else if (t > 1 - o.cap - 0.16) hw *= 0.7; }
      const jm = o.jit ?? 0.22;
      jl = clamp(jl + (r() - 0.5) * jm * 2, -jm, jm); jr = clamp(jr + (r() - 0.5) * jm * 2, -jm, jm);
      const lx = (o.lean || 0) * t * h;
      L.push([x + lx - hw * (1 + jl), base - t * h]);
      R.push([x + lx + hw * (1 + jr), base - t * h - (i === n ? (r() - 0.5) * 2 : 0)]);
    }
    const sh = C.poly([...L, ...R.reverse()]);
    p.fill(sh, o.ramp, o.v, o.z);
    const band = o.band || 4;
    p.shade(sh, (px, py) => {
      const b = (base - py + Math.sin(px * 0.5 + o.seed) * 0.7) / band;
      const f = b - Math.floor(b);
      return f < 0.22 ? -o.k : (Math.floor(b) % 3 === 1 ? o.k * 0.6 : 0);
    }, o.z);
    return sh;
  }

  /** A ragged opening: straight-ish sides and a round top, every point knocked about. */
  function ragged(cx, top, hw, bottom, amp, seed) {
    const pts = [];
    const spring = top + hw;
    for (let y = bottom; y > spring; y -= 3) pts.push([cx - hw + (hash(Math.round(y), 1, seed) - 0.5) * amp * 2, y]);
    for (let i = 0; i <= 22; i += 1) {
      const a = Math.PI - (i / 22) * Math.PI;
      const j = 1 + (hash(i, 2, seed) - 0.5) * (amp * 2) / hw;
      pts.push([cx + hw * Math.cos(a) * j, spring - hw * 1.08 * Math.sin(a) * j]);
    }
    for (let y = spring + 3; y <= bottom; y += 3) pts.push([cx + hw + (hash(Math.round(y), 3, seed) - 0.5) * amp * 2, y]);
    pts.push([cx + hw, bottom], [cx - hw, bottom]);
    return [pts];
  }

  /* Small sprites of the desert. */
  const BIRD = [['a...a', '.a.a.', '..a..'], ['.....', 'aa.aa', '..a..']];
  const CAMEL = [['......aa', '..aa..a.', '.aaaaaa.', 'a.aaaa..', '..a..a..', '..a..a..'], ['......aa', '..aa..a.', '.aaaaaa.', 'a.aaaa..', '..a..a..', '.a....a.']];
  const WALKER = [['.a.', '.a.', 'aaa', '.a.', '.a.', 'a.a'], ['.a.', '.a.', 'aaa', '.a.', '.a.', '.a.']];
  const SKULL = ['b.........b', 'ab.......ba', '.aab...baa.', '...aaaaa...', '...acaca...', '....aaa....', '....a.a....'];

  /** Heat shimmer: rows near the horizon slide a pixel back and forth, only on the far layers. */
  function shimmer(img, p, y0, y1, t, zMax) {
    const W = img.width; const d = img.data;
    const row = new Uint8ClampedArray(W * 4);
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(img.height, Math.round(y1)); y += 1) {
      const sh = Math.round(Math.sin(t * 2.3 + y * 1.9) * 0.9 + Math.sin(t * 3.7 + y * 0.7) * 0.4);
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

  /* ================= A: salt and sunset ================= */

  const RAMPS_A = {
    sky: ['#F47F64', '#FD9557', '#F9B67F', '#FDCA72', '#FEE7A8', '#FEFEDD'],
    sun: ['#FEE7A8', '#FEF4C8', '#FEFEDD', '#FFFFF2'],
    dusk: ['#120A08', '#1A0F0B', '#26150E', '#371D12', '#4E2817', '#6C371F', '#924A28', '#BC6434', '#E08644', '#F6AE5C', '#FDCA72'],
    haze: ['#7A4430', '#985638', '#B86C42', '#D5844E', '#EBA060', '#F7BA76', '#FDD08E'],
    sand: ['#0C0705', '#140B07', '#1E110A', '#2A1810', '#3A2214', '#4E2E1A', '#6B3E22', '#8E5530', '#B9733A', '#D9954C', '#F2BC66', '#FCDC92'],
    rock: ['#0A0605', '#120B07', '#1C110B', '#28180F', '#372114', '#4A2C19', '#633B21', '#82502B', '#A86A36', '#D08C46', '#F0B460', '#FCD88C'],
    shadow: ['#070403', '#0E0806', '#170E09', '#22150D', '#2E1C11'],
    bone: ['#1E1610', '#3A2E22', '#5E5040', '#8E7E62', '#BCAE8C', '#E4DAB8'],
    ...CARD,
  };

  /** The sunset sky: a thin coral band at the top, warming to gold round the sun. */
  function skyA(p, W, hor, sx, sy, R, k = 1, rays = false) {
    p.fill(C.rect(0, 0, W, hor), 'sky', (x, y) => {
      const t = clamp((y + 0.5) / hor, 0, 1);
      const dx = (x + 0.5 - sx) / 1.7; const dy = y + 0.5 - sy;
      const d = Math.hypot(dx, dy) / R;
      let v = 0.78 + 1.6 * t ** 1.25 + k * 1.5 * Math.max(0, 1 - d / 4.6) ** 2;
      if (rays && d > 1.05) {
        const a = Math.atan2(dy, x + 0.5 - sx);
        v += (Math.sin(a * 15) > 0.3 ? 0.8 : 0) * Math.max(0, 1 - d / 5.5);
      }
      return v;
    }, 0);
    // Two thin streaks of cloud, coral where the sun does not reach.
    for (const [cy, x0, x1, s] of [[0.2, -0.55, -0.08, 11], [0.33, 0.12, 0.62, 12]]) {
      const yc = hor * cy;
      p.shade(C.rect(0, yc - 2, W, 4), (x, y) => {
        const fx = (x - sx) / (hor * 2.4);
        if (fx < x0 || fx > x1) return 0;
        const e = Math.sin(((fx - x0) / (x1 - x0)) * Math.PI);
        const th = 0.6 + e * 1.1 + Math.sin(x * 0.3 + s) * 0.3;
        return Math.abs(y + 0.5 - yc - Math.sin(x * 0.07 + s) * 1.2) < th ? -0.9 * e : 0;
      }, 0);
    }
  }

  function sunDisc(p, sx, sy, R) {
    p.glow(C.circle(sx, sy, R, 56), 'sun', sx, sy - R * 0.2, R * 1.1, 3.4, 2.1, 0);
  }

  /** Spires across the width, none in front of the sun: far ones pale in the haze, nearer ones darker. */
  function spiresA(p, W, H, gx, hor, u) {
    const far = [[-46, 18, 22, 1, 'mesa'], [68, 9, 26, 2, 'cap'], [-100, 12, 30, 3, ''], [112, 30, 16, 4, 'mesa'], [-150, 26, 14, 5, 'mesa'], [176, 10, 24, 6, 'cap'], [-214, 9, 26, 7, 'cap'], [236, 22, 18, 8, 'mesa'], [-282, 30, 14, 9, 'mesa'], [300, 12, 28, 10, '']];
    for (const [d, w, h, s, kind] of far) {
      const x = gx + d * u;
      if (x < -30 * u || x > W + 30 * u) continue;
      spire(p, x, hor + 2 * u, w * u, h * u, { ramp: 'haze', v: 1.8, z: 1, seed: s, k: 0.4, band: 3 * u, cap: kind === 'cap' ? 0.2 : 0, mesa: kind === 'mesa', lean: (s % 2 ? 0.06 : -0.05) });
    }
    const near = [[-74, 22, 40, 21, ''], [88, 34, 36, 22, 'mesa'], [-140, 38, 34, 23, 'mesa'], [158, 16, 46, 24, 'cap'], [-206, 20, 38, 25, ''], [224, 36, 32, 26, 'mesa'], [-270, 22, 42, 27, ''], [284, 24, 34, 28, '']];
    for (const [d, w, h, s, kind] of near) {
      const x = gx + d * u;
      if (x < -30 * u || x > W + 30 * u) continue;
      spire(p, x, hor + 10 * u, w * u, h * u, { ramp: 'rock', v: 3.2, z: 2, seed: s, k: 0.55, band: 3.5 * u, cap: kind === 'cap' ? 0.18 : 0, mesa: kind === 'mesa', lean: (s % 2 ? 0.05 : -0.06) });
    }
    p.backlit(2, 'sky', 1.4, 'rock', 7.4);
    p.backlit(1, 'sky', 2.2, 'haze', 4.6);
  }

  /** Something vast out of the sand: a ringed body arching over, its blind head bowed toward you, a row of eyes. */
  function worm(p, cx, fy, s, ramp, z) {
    const P0 = [cx + 0.22 * s, fy + 0.08 * s]; const P1 = [cx + 0.2 * s, fy - 1.5 * s]; const P2 = [cx - 0.3 * s, fy - 0.64 * s];
    const at = (t) => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
    const rad = (t) => s * (0.21 - 0.075 * t);
    const sp = [];
    for (let i = 0; i <= 44; i += 1) {
      const t = i / 44; const [x, y] = at(t);
      sp.push([x, y, t]);
      p.fill(C.circle(x, y, rad(t), 18), 'shadow', 1.1, z);
    }
    const [hx, hy] = at(1);
    // The head: a blunt end turned toward you, wider than the neck.
    const hr = 0.17 * s;
    p.fill(C.circle(hx, hy, hr, 24), 'shadow', 1.1, z);
    // Rings: by the nearest point of the spine.
    p.shade(C.rect(cx - s, fy - 1.2 * s, 2 * s, 1.4 * s), (x, y, i) => {
      if (p.z[i] !== z) return 0;
      let best = 1e9; let bt = 0;
      for (const [sx, sy, t] of sp) { const d = (x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2; if (d < best) { best = d; bt = t; } }
      if (bt > 0.9) return 0;
      const f = (bt * 14) % 1;
      return f < 0.2 ? 1.5 : 0;
    }, z);
    // The maw, open toward you: a ring of pale teeth round a black throat.
    const mx = hx - 0.02 * s; const my = hy + 0.03 * s;
    p.fill(C.circle(mx, my, hr * 0.72, 20), 'bone', 2.2, z + 1);
    p.shade(C.circle(mx, my, hr * 0.72, 20), (x, y) => (hash(x, y, 7) < 0.45 ? -1.4 : 0), z + 1);
    p.fill(C.circle(mx, my, hr * 0.42, 16), 'shadow', 0, z + 1);
    // Eyes round the rim, above the maw.
    for (const a of [-2.6, -2.0, -1.15, -0.55]) {
      p.fill(C.rect(Math.round(hx + Math.cos(a) * hr * 0.9 - 0.5), Math.round(hy + Math.sin(a) * hr * 0.9 - 0.5), 1, 1), ramp, 4, z + 2);
    }
    return { hx, hy, base: P0 };
  }

  /** A traveller wrapped against the sand, staff in hand, a lantern hung from it; the wrap blows out behind. */
  function traveller(p, cx, fy, s, z, ramp, body = 'shadow', bv = 0.8, staffRamp = 'shadow') {
    const S = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    p.fill(S([[-0.2, 0], [-0.16, -0.46], [-0.13, -0.7], [0.1, -0.72], [0.15, -0.46], [0.24, -0.14], [0.4, 0.0]]), body, bv, z);
    p.fill(C.circle(cx - 0.01 * s, fy - 0.8 * s, 0.11 * s, 14), body, bv, z);
    p.fill(S([[0.04, -0.87], [0.46, -0.85], [0.38, -0.81], [0.48, -0.75], [0.04, -0.75]]), body, bv, z);
    if (body !== 'shadow') p.fill(C.rect(cx - 0.07 * s, fy - 0.84 * s, 0.11 * s, 0.07 * s), 'shadow', 0, z + 1); // the face, in the wrap's shadow
    // The staff, behind, in the far hand.
    p.fill(C.rect(Math.round(cx + 0.2 * s), fy - 1.06 * s, 1, 1.06 * s), staffRamp, 0.8, z);
    p.fill(S([[0.08, -0.64], [0.21, -0.6], [0.21, -0.55], [0.08, -0.58]]), body, bv, z);
    // The lantern, held low in front of the robe so its light reads against the dark.
    const lx = Math.round(cx - 0.08 * s); const ly = Math.round(fy - 0.36 * s);
    p.fill(C.rect(lx, ly - 2, 1, 2), 'shadow', 0.3, z + 1);
    p.fill(C.rect(lx - 1, ly, 3, 3), ramp, 3, z + 2);
    p.fill(C.rect(lx, ly + 1, 1, 1), ramp, 4, z + 2);
    return { lx: lx + 0.5, ly: ly + 1.5 };
  }

  /** An urn half sunk in the sand, tipped over, light the colour of the card pouring from its mouth. */
  function urn(p, cx, fy, s, z, ramp, ang = -0.55, body = 'rock', bv = 3.2, sandV = 3.2) {
    const prof = [[0, 0.32], [0.3, 0.34], [0.5, 0.3], [0.62, 0.22], [0.72, 0.1], [0.82, 0.1], [0.86, 0.15], [0.92, 0.15]];
    const pts = [...prof.map(([h, w]) => [w, h]), ...prof.slice().reverse().map(([h, w]) => [-w, h])];
    const ca = Math.cos(ang); const sa = Math.sin(ang);
    const tr = ([x, y]) => [cx + (x * ca - y * sa) * s, fy - (x * sa + y * ca) * s];
    p.fill(C.poly(pts.map(tr)), body, bv, z);
    for (const h of [0.36, 0.56]) {
      const a = tr([-0.34, h]); const b = tr([0.34, h]);
      p.fill(C.poly([a, b, [b[0], b[1] + 1.1], [a[0], a[1] + 1.1]]), body, bv + 1.8, z);
    }
    const m = tr([0, 0.93]);
    p.fill(C.ellipse(m[0], m[1], 0.12 * s, 0.07 * s, 12), ramp, 4, z + 1);
    if (sandV !== null) p.fill(C.ellipse(cx, fy + 0.04 * s, 0.62 * s, 0.14 * s, 20), 'sand', sandV, z + 1);
    return m;
  }

  /**
   * The caravan road up the near face of the crest: old paving surfacing
   * from the sand, footprints walking up it. `stop` is where they end.
   */
  function caravanRoad(p, cx, fy, H, u, v, stop) {
    const road = C.poly([[cx - 3 * u, fy], [cx + 3 * u, fy], [cx + 26 * u, H], [cx - 26 * u, H]]);
    p.fill(road, 'sand', (x, y) => v - 1.4 * ((y - fy) / (H - fy)), 5);
    p.floor(road, { vx: cx, vy: fy - 6 * u, rows: 3, size: 1.2, d0: 6 * u, joint: -1.5, top: 0.5, vary: 0.9, chip: 0.06, seed: 7, z: 5 });
    if (stop === undefined) return;
    // Footprints walking up the road, smaller with distance.
    for (let k = 0; k < 9; k += 1) {
      const t = k / 8; const y = Math.round(lerp(H - 2 * u, stop, t ** 0.85));
      const sc = 1 - t * 0.6; const x = Math.round(cx + (k % 2 ? 1.6 : -1.6) * u * sc + Math.sin(k * 0.9) * u);
      p.fill(C.rect(x, y, Math.max(1, Math.round(2 * sc)), 1), 'sand', 1.4, 5);
      p.shade(C.rect(x, y - 1, Math.max(1, Math.round(2 * sc)), 1), 1.2, 5);
    }
  }

  /**
   * A great obelisk toppled across the road on the crest: black against
   * the sun, its base on its broken plinth, its point sunk in the sand; the
   * band of carved signs down its length glows with the card's colour.
   * Returns where its glow falls.
   */
  function toppledObelisk(p, cx, fy, L, u, z, ramp) {
    const xb = cx - L * 0.5; const xt = cx + L * 0.5; const xp = xt - L * 0.12;  // base, tip, where the point begins
    const xa = cx - L * 0.06; const gap = 4 * u;                                  // where it broke
    // The base piece lies tilted on its plinth; the top piece slid down past the break and sank further.
    const cy1 = (x) => lerp(fy - 13 * u, fy - 6 * u, (x - xb) / (xt - xb));
    const cy2 = (x) => cy1(x) + 2 * u + 2.5 * u * clamp((x - xa) / (xt - xa), 0, 1);
    const cy = (x) => (x < xa + gap / 2 ? cy1(x) : cy2(x));
    const th = (x) => lerp(20 * u, 10 * u, clamp((x - xb) / (xp - xb), 0, 1)) / 2;  // a strong taper to the point
    const jag = (x0, c, t, k) => Array.from({ length: 5 }, (_, i) => [x0 + (hash(i, k, 23) - 0.5) * 2.4 * u, c - t + (2 * t * i) / 4]);
    const a1 = xa - gap / 2; const a2 = xa + gap / 2;
    p.fill(C.poly([[xb, cy1(xb) - th(xb)], [a1, cy1(a1) - th(a1)], ...jag(a1, cy1(a1), th(a1), 1), [a1, cy1(a1) + th(a1)], [xb, cy1(xb) + th(xb)]]), 'shadow', 0.5, z);
    p.fill(C.poly([...jag(a2, cy2(a2), th(a2), 2).reverse(), [xp, cy2(xp) - th(xp)], [xt, cy2(xt)], [xp, cy2(xp) + th(xp)]]), 'shadow', 0.5, z);
    // The point: its upper face a shade lighter, so it reads as faceted.
    p.fill(C.poly([[xp, cy2(xp) - th(xp)], [xt, cy2(xt)], [xp, cy2(xp)]]), 'shadow', 1.6, z);
    p.fill(C.rect(xp, cy2(xp) - th(xp), 1, th(xp) * 2), 'shadow', 1.2, z);
    // The base end, square, and the broken plinth it came off.
    p.fill(C.rect(xb, cy1(xb) - th(xb), 1, th(xb) * 2), 'shadow', 1.4, z);
    p.fill(C.poly([[xb - 8 * u, fy + 2 * u], [xb - 8 * u, fy - 6 * u], [xb - 4 * u, fy - 7.5 * u], [xb + 2 * u, fy - 5 * u], [xb + 3 * u, fy + 2 * u]]), 'shadow', 0.8, z);
    // Rubble in the break, drawn over the drift: chunks that came off where it snapped.
    const rubble = () => {
      for (const [dx, dy, w, h] of [[-3.5, -4, 3.4, 3], [0, -5.5, 2.8, 3.6], [2.8, -3.6, 3.2, 2.6], [-7, -1.5, 2.4, 1.8], [6.5, -1.2, 2.2, 1.6], [-1, -1, 1.6, 1.2]]) {
        p.fill(C.poly([[xa + dx * u, fy + dy * u + h * u], [xa + dx * u + 0.4 * u, fy + dy * u], [xa + (dx + w) * u, fy + dy * u + 0.5 * u], [xa + (dx + w) * u, fy + dy * u + h * u]]), 'shadow', 0.9, z + 3);
        p.fill(C.rect(xa + dx * u + 0.4 * u, fy + dy * u, (w - 0.4) * u, 1), ramp, 1.6, z + 3);
      }
    };
    // The inscription: small columns of carved signs set close along the face, worn and uneven;
    // only a few of them still hold the light.
    const glow = [];
    let x = xb + 3 * u; let k = 0;
    while (x < xp - 2 * u) {
      if (Math.abs(x - xa) < gap / 2 + 1.5 * u) { x += 1; continue; }
      const c = cy(x); const h = th(x); const X = Math.round(x);
      const lit = Math.sin(x * 0.17 / u + 0.4) + (hash(k, 3, 29) - 0.5) * 0.8 > 0.62;
      const rows = 2 + Math.floor(hash(k, 1, 29) * 3);
      for (let r = 0; r < rows; r += 1) {
        if (hash(k, r, 31) < 0.22) continue;                                     // worn away
        const y = Math.round(c - h * 0.55 + r * Math.max(2, h * 0.42) + (hash(k, r, 37) < 0.5 ? 0 : 1));
        const w = hash(k, r, 41) < 0.4 ? 2 : 1;
        p.fill(C.rect(X, y, w, 1), ramp, lit ? 2.5 + hash(k, r, 43) * 1.1 : 0.7, z + 2);
        if (lit) glow.push([X, y]);
      }
      x += 2 + Math.floor(hash(k, 9, 29) * 3) * (u > 0.66 ? 1 : 0.5);
      k += 1;
    }
    return { glow, xb, xt, cy, th, rubble };
  }

  /** A sword driven point-first into the dune, its jewel lit with the card's colour. */
  function sword(p, cx, fy, s, z, ramp) {
    const bw = Math.max(1, Math.round(0.07 * s));
    p.fill(C.rect(Math.round(cx) - (bw >> 1), fy - 0.72 * s, bw, 0.72 * s), ramp, 2.2, z);
    p.fill(C.rect(Math.round(cx) - (bw >> 1), fy - 0.72 * s, 1, 0.72 * s), ramp, 3, z);
    const gy = Math.round(fy - 0.78 * s);
    p.fill(C.rect(Math.round(cx - 0.24 * s), gy, Math.round(0.48 * s) + 1, 2), ramp, 2.6, z);
    p.fill(C.rect(Math.round(cx) - 1, gy - Math.round(0.22 * s), 2 + (bw > 1 ? 1 : 0), Math.round(0.22 * s)), 'shadow', 3, z);
    p.fill(C.rect(Math.round(cx) - 1, gy - Math.round(0.22 * s) - 2, 3, 2), ramp, 4, z + 1);
    // Sand heaped where it went in.
    p.fill(C.ellipse(cx, fy + 0.02 * s, 0.32 * s, 0.07 * s, 16), 'sand', 3, z + 1);
    return [cx, gy - 0.22 * s];
  }

  const A = {
    job: 4, setting: 'desert', key: 'A', id: 'desert-a', side: 'outside',
    revised: "After your note: the Obstacle is a great obelisk, toppled and broken across the caravan road. The road runs up to it and stops.",
    name: 'Desert', title: 'Salt and sunset',
    pitch: 'The sun is going down on the dunes, enormous and close. There is nowhere to hide, and every card stands up black against the light.',
    notes: [
      ['Light', 'One giant sun sitting on the horizon. The sky burns gold around it; everything on the ground is a dark shape with a bright edge.'],
      ['Detail', 'Rock spires banded in layers, dunes with sharp crests and rippled faces, heat shimmer on the far dunes, a caravan crossing in the distance, birds circling.'],
      ['Vista', 'Wide dunes running to spires on both sides. The card is on the crest in front of the sun: a worm arching out of the sand, a traveller with a lantern, a sword glowing where it was driven in, a broken obelisk lying across the caravan road, an old road running into the sun.'],
      ['World', 'The sunset only along the top, behind the vista. Under the table the dunes fall into the long shadow of a great spire, with sand blowing across.'],
    ],
    palette: ['#FEFEDD', '#FDCA72', '#F9B67F', '#FD9557', '#B9733A', '#6B3E22', '#2A1810', '#140B07', '#F47F64'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['sky', 'sun'] });
      const u = H / 134; const gx = W / 2;
      const hor = 93 * u; const R = 15 * u; const sy = 90 * u;
      skyA(p, W, hor + 2 * u, gx, sy, R, 1.1);
      sunDisc(p, gx, sy, R);
      const wf = waves(41, 22 * u, 0.6);
      duneRow(p, W, H, (x) => hor + 1 * u - 4 * u * wf(x), { ramp: 'haze', v: 2.6, lit: 0.8, litNear: 0.6, reach: 20 * u, lightX: gx, rim: 2, rimW: 1.2, fall: 0.12, depth: 6 * u, faceD: 4 * u, lean: 0.7, z: 1 });
      const wm = waves(46, 40 * u, 0.7, -1);
      duneRow(p, W, H, (x) => 98.5 * u - 5 * u * wm(x), { ramp: 'sand', v: 3.6, lit: 1.4, litNear: 1, reach: 18 * u, lightX: gx, rim: 4.8, rimW: 1.2, rimNear: 0.5, fall: 0.08, depth: 8 * u, faceD: 4 * u, lean: -0.8, z: 2 });
      // The ground under the arch and in front: the spire's shadow, and the sun's patch thrown through the arch.
      const floorY = Math.round(106 * u); const g0 = 101 * u;
      p.fill(C.rect(0, g0, W, H - g0), 'sand', (x, y) => 1.8 - (y - g0) * 0.025 * u, 3);
      p.shade(C.rect(0, g0, W, H - g0), (x, y) => {
        const t = (y - g0) / (H - g0);
        const e = 1 - Math.abs(x + 0.5 - gx) / (18 * u + 15 * u * t);
        const rp = Math.sqrt((y - g0) / u + 1) * 2.3 + Math.sin(x * 0.23 + y * 0.11) * 0.4 + Math.sin(x * 0.07 + 1) * 0.35;
        const q = rp - Math.floor(rp);
        const lit = clamp(e * 3.2, 0, 1);
        return (7.8 - 3.4 * t) * lit + (q < 0.2 ? -0.9 * (0.4 + lit) : q < 0.32 ? 0.5 * lit : 0);
      }, 3);
      // Footprints walking in toward the sun.
      for (let k = 0; k < 6; k += 1) {
        const y = H - 5 * u - k * 4.4 * u; const x = gx + (k % 2 ? 2.5 : -2.5) * u + Math.sin(k * 0.7) * 2 * u;
        p.shade(C.rect(Math.round(x), Math.round(y), 2, 1), -2.4, 3);
        p.shade(C.rect(Math.round(x), Math.round(y) + 1, 2, 1), 0.8, 3);
      }
      // The spire, the hole through it, and the hole's lit thickness.
      const hole = ragged(gx, 27 * u, 24 * u, floorY + 1, 1.6 * u, 5);
      const inner = ragged(gx + 1.5 * u, 32 * u, 20 * u, floorY + 1, 1.2 * u, 9);
      const face = C.join(C.rect(0, 0, W, floorY + 1), hole);
      p.fill(face, 'rock', 1.6, 4);
      p.grain(face, 0.9, 7, 21, 4);
      p.shade(face, (x, y) => {
        const b = (y + Math.sin(x * 0.11) * 3 + Math.sin(x * 0.37) * 1) / (6 * u);
        const f = b - Math.floor(b);
        let dv = f < 0.13 ? -1.2 : (f < 0.24 ? 0.8 : 0);
        if (Math.floor(b) % 3 === 0) dv += 0.3;
        if (hash(Math.floor(x / 2), Math.floor(y / 2), 13) < 0.03) dv -= 0.9;
        return dv;
      }, 4);
      // Dark streaks of varnish down the face from the top.
      for (const [sx, len] of [[0.12, 40], [0.3, 22], [0.78, 34], [0.9, 50]]) {
        p.shade(C.rect(W * sx, 0, 3 * u, len * u), (x, y) => -0.8 * (1 - y / (len * u)), 4);
      }
      p.light(gx, 92 * u, 72 * u, 3.2, null, { zMin: 4, zMax: 4 });
      p.fill(C.join(hole, inner), 'rock', (x, y) => 4.4 + 3.2 * clamp((y - 30 * u) / (floorY - 30 * u), 0, 1) + (x > gx ? 1.2 : 0), 5);
      p.shade(C.join(hole, inner), (x, y) => (Math.floor((y + Math.sin(x * 0.11) * 3) / (6 * u)) % 2 ? -0.5 : 0.3), 5);
      p.backlit(5, 'sky', 1.5, 'rock', 10.4);
      p.backlit(5, 'sun', 0, 'rock', 11);
      vignette(p, W, H, 1.6, 0.5, 0);
      return {
        p,
        over(img) {
          sprite(img, Math.round(gx - 9 * u), Math.round(56 * u), BIRD[0], { a: '#82502B' });
          sprite(img, Math.round(gx + 7 * u), Math.round(50 * u), BIRD[1], { a: '#82502B' });
          sprite(img, Math.round(W * 0.27), Math.round(127 * u), SKULL, { a: '#9E8C6A', b: '#6A5A44', c: '#1E1610' });
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['sky', 'sun'] });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const hor = 66 * u; const R = 24 * u; const sy = hor - 2 * u;
      const open = cat === 'clear-path';
      skyA(p, W, hor + 2 * u, gx, sy, R, open ? 1.35 : 1, open);
      sunDisc(p, gx, sy, R);
      spiresA(p, W, H, gx, hor, u);
      // Far dunes, pale with distance.
      const wf = waves(51, 34 * u, 0.62);
      duneRow(p, W, H, (x) => hor + 1.5 * u - 5 * u * wf(x), { ramp: 'haze', v: 2.6, lit: 0.8, litNear: 0.8, reach: 60 * u, lightX: gx, rim: 2, rimNear: 0.8, rimW: 1.2, fall: 0.1, depth: 10 * u, faceD: 4 * u, lean: 0.8, z: 1 });
      // A row of middle dunes, open in the centre.
      const wm = waves(53, 52 * u, 0.68);
      duneRow(p, W, H, (x) => hor + 13 * u - 11 * u * wm(x) * smooth(24 * u, 56 * u, Math.abs(x - gx)), { ramp: 'sand', v: 3.6, lit: 1.3, litNear: 1.2, reach: 60 * u, lightX: gx, rim: 4.4, rimNear: 0.8, rimW: 1.2, fall: 0.06, depth: 12 * u, faceD: 6 * u, lean: -0.9, ripple: 2.2 * u, seed: 2, z: 3 });
      // The crest the card stands on: one sharp dune in front of the sun.
      const crestY = (open ? 78 : 73) * u;
      const hill = (x) => { const d = (x - gx) / (44 * u); return crestY + 18 * u * Math.abs(d) ** 1.25 * (d < 0 ? 0.85 : 1); };
      duneRow(p, W, H, hill, { ramp: 'sand', v: 2.6, lit: 1.3, litNear: 0.8, reach: 40 * u, lightX: gx + 6 * u, rim: 5.4, rimNear: 0.9, rimW: 1.3, fall: 0.05, depth: 16 * u, faceD: 8 * u, lean: 0.5, ripple: 2.6 * u, seed: 4, z: 4 });
      // The card, on the crest, against the sun.
      const fy = crestY + 0.5;
      if (cat === 'monster') {
        const w = worm(p, gx, fy, 44 * u, ramp, 6);
        p.backlit(6, 'sun', 0, 'sand', 10.6);
        p.backlit(6, 'sky', 2.2, 'sand', 9.6);
        p.fill(C.ellipse(w.base[0], fy + 1.5 * u, 12 * u, 3 * u, 16), 'sand', 3.4, 7);
        p.fill(C.ellipse(w.base[0], fy - 0.2 * u, 8 * u, 1, 16), 'sand', 7.5, 7);
        p.tint(w.hx, w.hy - 2 * u, 7 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const l = traveller(p, gx, fy, 32 * u, 6, ramp);
        p.backlit(6, 'sun', 0, 'sand', 10.6);
        p.backlit(6, 'sky', 2.2, 'sand', 9.6);
        p.tint(l.lx, l.ly, 11 * u, CARD[ramp][3], 0.6, flicker(0.9, 0.15));
        p.tint(l.lx, fy + 2 * u, 9 * u, CARD[ramp][2], 0.4, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        const m = sword(p, gx + 2 * u, fy + 15 * u, 24 * u, 6, ramp);
        p.tint(m[0], m[1], 12 * u, hex, 0.6, flicker(2, 0.15, 0.7));
        p.tint(m[0], fy + 12 * u, 20 * u, CARD[ramp][2], 0.4, flicker(2.4, 0.2, 0.7));
      } else if (cat === 'obstacle') {
        // The caravan road runs up the crest, and its footprints stop: an obelisk lies across it.
        caravanRoad(p, gx, fy, H, u, 5.6, fy + 9 * u);
        const ob = toppledObelisk(p, gx, fy, 86 * u, u, 6, ramp);
        p.backlit(6, 'sun', 0, ramp, 2.8);
        p.backlit(6, 'sky', 1.5, ramp, 2.5);
        // Sand drifted against its near side, a lit lip along the top.
        const pts = [[ob.xb + 3 * u, fy + 5 * u]];
        for (let x = ob.xb + 6 * u; x < ob.xt - 8 * u; x += 5 * u) pts.push([x, ob.cy(x) + ob.th(x) * 0.5 - 1.2 * u * Math.sin(x * 0.21 / u)]);
        pts.push([ob.xt - 4 * u, fy + 3 * u], [ob.xt - 10 * u, fy + 7 * u], [gx, fy + 7.5 * u], [ob.xb + 8 * u, fy + 7 * u]);
        const drift = C.poly(pts);
        p.fill(drift, 'sand', 4, 7);
        p.shade(drift, (x, y, i) => (p.z[i - W] !== 7 ? 2.8 : 0), 7);
        ob.rubble();
        // The signs' light, a little on the stone round them and on the sand at its foot.
        for (const [x, y] of ob.glow.filter((_, k) => k % 6 === 3)) p.tint(x, y, 4 * u, CARD[ramp][2], 0.22, flicker(x, 0.2, 0.8));
        p.tint(gx, fy + 4 * u, 22 * u, CARD[ramp][2], 0.24, flicker(0.5, 0.12, 0.6));
      } else if (open) {
        // The old road surfacing from the sand, running up over the crest into the sun.
        const road = C.poly([[gx - 3 * u, fy], [gx + 3 * u, fy], [gx + 26 * u, H], [gx - 26 * u, H]]);
        p.fill(road, 'sand', (x, y) => 8.4 - 2.6 * ((y - fy) / (H - fy)), 5);
        p.floor(road, { vx: gx, vy: fy - 6 * u, rows: 3, size: 1.2, d0: 6 * u, joint: -1.6, top: 0.6, vary: 0.9, chip: 0.05, seed: 7, z: 5 });
        p.tint(gx, sy - 4 * u, 40 * u, CARD.path[4], 0.3, flicker(0.2, 0.08, 0.4));
      }
      // Near dunes, dark, low in the middle so the crest stays clear.
      const wn = waves(57, 80 * u, 0.7);
      duneRow(p, W, H, (x) => 101 * u - 24 * u * wn(x) * smooth(30 * u, 76 * u, Math.abs(x - gx)), { ramp: 'sand', v: 1.6, lit: 1.1, litNear: 0.6, reach: 90 * u, lightX: gx, rim: 3, rimNear: 0.6, rimW: 1.2, fall: 0.04, depth: 12 * u, faceD: 8 * u, lean: 0.6, ripple: 2.8 * u, seed: 5, z: 8 });
      vignette(p, W, H, 1.2, 0.5, 0);
      const birds = [[gx - 52 * u, 22 * u, 0], [gx - 44 * u, 27 * u, 2.1], [gx + 64 * u, 18 * u, 4]];
      return {
        p,
        over(img, t) {
          shimmer(img, p, hor - 8 * u, hor + 3 * u, t, 1);
          for (const [bx, by, ph] of birds) {
            const x = bx + Math.cos(t * 0.45 + ph) * 9 * u; const y = by + Math.sin(t * 0.45 + ph) * 2.5 * u;
            sprite(img, Math.round(x), Math.round(y), BIRD[Math.floor(t * 3 + ph) % 2], { a: '#6B3E22' });
          }
          // A caravan on the far dunes, so small it is barely there.
          const cxv = gx + (cat === 'obstacle' ? 66 : 42) * u + Math.sin(t * 0.05) * 4 * u;
          for (const [dx, spr, f] of [[0, CAMEL, 0], [-10, CAMEL, 1], [7, WALKER, 0]]) sprite(img, Math.round(cxv + dx), Math.round(hor + 0.5 * u), spr[Math.floor(t * 2 + f) % 2], { a: '#74402C' });
          for (const q of particles('sand', Math.round(W / 6), [0, 82 * u, W, 18 * u], t, 41)) put(img, q.x, q.y, q.big ? '#B9733A' : '#6B3E22', q.a * 0.8);
          if (cat === 'monster') for (const q of particles('drip', 6, [gx - 12 * u, 46 * u, 10 * u, 26 * u], t, 43)) put(img, q.x, q.y, '#8E5530', 0.9);
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 8 * u, 64 * u, 20 * u, 26 * u], t, 45)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['dusk'] });
      const gx = W / 2; const hor = Math.round(H * 0.25);
      const sx = W * 0.58; const spx = W * 0.56;
      // The sky: dusk at the top, the sunset glow only along the horizon, under the vista.
      p.fill(C.rect(0, 0, W, hor + 8), 'dusk', (x, y) => {
        const t = clamp(y / hor, 0, 1);
        const g = Math.exp(-(((x - sx) / (W * 0.28)) ** 2));
        return 0.4 + 4.6 * t ** 2.6 + 4.4 * g * t ** 5;
      }, 0);
      // The great spire, black against it, and two smaller far off.
      spire(p, spx, hor + 8, 84, 42, { ramp: 'rock', v: 0.7, z: 2, seed: 61, k: 0.3, band: 5, mesa: true, jit: 0.07 });
      spire(p, W * 0.16, hor + 3, 34, 20, { ramp: 'rock', v: 1.3, z: 1, seed: 62, k: 0.2, band: 4, mesa: true });
      spire(p, W * 0.88, hor + 3, 18, 30, { ramp: 'rock', v: 1.3, z: 1, seed: 63, k: 0.2, band: 4, cap: 0.2 });
      p.backlit(2, 'dusk', 6, 'rock', 6);
      p.backlit(1, 'dusk', 5, 'rock', 5);
      // The ground: lit low from the horizon, dying toward you; dunes and ripples in perspective.
      p.fill(C.rect(0, hor, W, H - hor), 'sand', (x, y) => {
        if (p.z[y * W + x] === 2) return null;
        const dy = y + 0.5 - hor;
        const g = Math.exp(-(((x - sx) / (W * 0.35)) ** 2));
        return 4.2 - 2.4 * Math.min(1, dy / (H * 0.6)) ** 0.7 + 1.8 * g * Math.exp(-dy / 6);
      }, 3);
      duneField(p, W, H, hor, { z: 3, vx: gx, k: 300, c: 8, wf: 1.3, seed: 3, rimF: 0.07, rim: 0.9, dark: 1.3, rip: 7, ripV: 0.35, fade0: 2, fade1: 20 });
      // The spire's shadow, falling toward you over the table; the sun still on the far margins.
      // Its edges run straight from the spire's foot out past the table's corners.
      const y0 = hor + 8; const y1 = H * 0.42;
      p.shade(C.rect(0, hor, W, H - hor), (x, y, i) => {
        if (p.z[i] !== 3) return 0;
        const t = (y + 0.5 - y0) / (y1 - y0);
        if (t < -0.05) return 0;
        const l = lerp(spx - 32, W * 0.06, t); const r = lerp(spx + 32, W * 0.94, t);
        const e = Math.min(x + 0.5 - l, r - x - 0.5) / (1 + Math.max(0, t) * 3);
        return -1.25 * smooth(-1.5, 1.5, e);
      }, 3);
      // Near dunes at the bottom corners, their crests just catching the last light.
      const wn = waves(67, 110, 0.7);
      duneRow(p, W, H, (x) => H + 2 - 46 * wn(x) * smooth(W * 0.3, W * 0.5, Math.abs(x - gx)), { ramp: 'sand', v: 1.2, lit: 0.5, rim: 1.4, rimW: 1.2, lightX: sx, fall: 0.02, depth: 30, faceD: 10, lean: 0.8, ripple: 4, seed: 9, z: 4 });
      return {
        p,
        over(img, t) {
          for (const q of particles('sand', 70, [0, hor + 10, W, H - hor - 10], t, 61)) put(img, q.x, q.y, q.big ? '#4E2E1A' : '#3A2214', q.a * 0.7);
          for (const q of particles('sand', 24, [0, hor - 2, W, 16], t, 62)) put(img, q.x, q.y, '#8E5530', q.a * 0.7);
        },
      };
    },
  };

  /* ================= B: the buried gate ================= */

  const RAMPS_B = {
    sky: ['#04060A', '#070A10', '#0B0F17', '#10161F', '#161E28', '#1E2731', '#28323B', '#343D44'],
    moon: ['#7C8486', '#B4BAB6', '#DADDD3', '#F2F3EA'],
    sand: ['#05060A', '#090B10', '#0E1116', '#14181D', '#1B2025', '#23282C', '#2E3234', '#3B3D3C', '#544A3C', '#76603F', '#A07D4C', '#CCA162', '#EEC685'],
    stone: ['#05060A', '#0A0C11', '#10131A', '#181C22', '#20252B', '#2A2F34', '#383B3D', '#4F473B', '#6E5A40', '#94754E', '#BC9662', '#E2BC80'],
    dark: ['#010203', '#040507', '#07090C', '#0B0E12'],
    fire: ['#4A1C0C', '#8E3A14', '#D06A22', '#F2A23E', '#FFD27A', '#FFF4C8'],
    glow: ['#2E1C0C', '#5A3612', '#8E581C', '#C8842E', '#EEB04E', '#FFD98A', '#FFF3CC'],
    deep: ['#0A0806', '#170F09', '#2A190C', '#462A10', '#6E4216', '#9A601E'],
    chitin: ['#040405', '#09080A', '#110E0E', '#1C1612', '#2A2018', '#3E2E1E', '#5A4028', '#7E5A34', '#A47A46'],
    shadow: ['#030405', '#07090C', '#0D1014', '#14181C'],
    wood: ['#0E0A07', '#1E140C', '#33220F', '#4E3416', '#6E4A1E'],
    ...CARD,
  };
  const FLAME = { a: '#8E3A14', b: '#F2A23E', c: '#FFF4C8', d: '#4E3416' };

  /** The night sky: navy, a little lighter at the horizon and round the moon. */
  function skyB(p, W, hor, mx, my, mr) {
    p.fill(C.rect(0, 0, W, hor), 'sky', (x, y) => {
      const t = clamp((y + 0.5) / hor, 0, 1);
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my) / mr;
      return 0.7 + 3.4 * t ** 2.4 + 2.6 * Math.max(0, 1 - d / 7) ** 2;
    }, 0);
  }

  function moonDisc(p, mx, my, mr) {
    p.glow(C.circle(mx, my, mr, 32), 'moon', mx - mr * 0.35, my - mr * 0.35, mr * 1.7, 3.3, 1.5, 0);
    for (const [dx, dy, r] of [[-0.25, -0.05, 0.34], [0.22, 0.28, 0.26], [0.32, -0.3, 0.18]]) p.shade(C.circle(mx + dx * mr, my + dy * mr, r * mr, 12), -0.6, 0);
  }

  /** Stars: fixed points on the sky's layer, fewer and dimmer toward the horizon, some twinkling. */
  function stars(img, p, W, y1, t, seed, n, avoid) {
    const r = rng(seed);
    for (let k = 0; k < n; k += 1) {
      const x = Math.floor(r() * W); const y = Math.floor(r() * y1); const b = r(); const ph = r() * 6.28;
      if (y < 0 || y >= p.h || p.z[y * W + x] !== 0) continue;
      if (avoid && Math.hypot(x - avoid[0], y - avoid[1]) < avoid[2]) continue;
      const tw = 0.65 + 0.35 * Math.sin(t * (0.8 + b * 2.4) + ph);
      const a = (b > 0.85 ? 1 : 0.6) * tw * (1 - 0.7 * (y / y1));
      put(img, x, y, b > 0.85 ? '#DCE0D8' : b > 0.5 ? '#8E98A0' : '#5C6670', a);
      if (b > 0.96) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(img, x + dx, y + dy, '#5C6670', a * 0.55);
    }
  }

  /**
   * The temple's front, sunk to its doorway in a dune: a battered wall of big
   * blocks under a flared cornice, a framed door with a winged disc carved
   * over it, steps going down into the dark.
   */
  function temple(p, cx, sill, u, o = {}) {
    const hw = (o.hw || 36) * u; const top = sill - (o.h || 52) * u;
    const dw = (o.dw || 8) * u; const dTop = sill - (o.dh || 32) * u;
    const wall = C.poly([[cx - hw - 4 * u, sill + 14 * u], [cx - hw, top + 8 * u], [cx + hw, top + 8 * u], [cx + hw + 4 * u, sill + 14 * u]]);
    p.fill(wall, 'stone', 3.1, 2);
    p.masonry(wall, { bw: 10 * u, bh: 6 * u, oy: top + 8 * u, joint: -1.2, top: 0.5, left: 0.3, vary: 0.7, chip: 0.04, seed: o.seed || 31, z: 2 });
    // Pilasters at the corners.
    for (const px of [-hw, hw - 5 * u]) p.shade(C.rect(cx + px, top + 8 * u, 5 * u, sill - top + 6 * u), (x) => (x - cx - px < 1 ? 0.7 : 0.35), 2);
    // Rows of carved signs either side of the door.
    for (const m of [-1, 1]) {
      for (let col = 0; col < 3; col += 1) {
        const x0 = cx + m * (dw + 7 * u + col * 4.5 * u);
        for (let y = top + 13 * u; y < sill - 6 * u; y += 3.2 * u) {
          if (hash(Math.round(x0), Math.round(y), 5) < 0.3) continue;
          p.shade(C.rect(x0, y, Math.max(1, 2 * u), Math.max(1, 1.4 * u)), hash(Math.round(y), col, 9) < 0.5 ? -0.9 : 0.6, 2);
        }
      }
    }
    // The cornice: a flared lip, fluted, with a roll moulding under it.
    const cor = C.poly([[cx - hw - 0.5 * u, top + 8 * u], [cx - hw - 4.5 * u, top + 1.6 * u], [cx + hw + 4.5 * u, top + 1.6 * u], [cx + hw + 0.5 * u, top + 8 * u]]);
    p.fill(cor, 'stone', (x, y) => 2.6 + ((top + 8 * u - y) / (6.4 * u)) * 1.6, 3);
    p.shade(cor, (x) => (((x - cx + 300 * u) % (3 * u)) < 1 ? -0.8 : 0), 3);
    p.fill(C.rect(cx - hw - 4.5 * u, top, 2 * hw + 9 * u, 1.8 * u), 'stone', 4, 3);
    p.fill(C.rect(cx - hw - 0.5 * u, top + 8 * u, 2 * hw + u, 1.4 * u), 'stone', 4.2, 3);
    // The door's frame: jambs carved with a band of signs, a heavy lintel under its own small cornice.
    const fw = (o.fw || 3.5) * u; const ly = dTop - 7 * u;
    const frame = C.rect(cx - dw - fw, ly, 2 * (dw + fw), sill - ly + 14 * u);
    p.fill(frame, 'stone', 3.9, 3);
    for (const m of [-1, 1]) {
      const x0 = m < 0 ? cx - dw - fw + 1 : cx + dw + 1; const bw = Math.max(1, fw - 2);
      p.fill(C.rect(x0, dTop, bw, sill - dTop), 'stone', 2.4, 3);            // the band, cut back
      for (let y = dTop + 1, k = 0; y < sill - 1; y += Math.max(2, 2.4 * u), k += 1) {
        const g = hash(m, k, 21);
        const gw = g < 0.33 ? bw : Math.max(1, bw - 1); const gx0 = g > 0.66 ? x0 + bw - gw : x0;
        p.fill(C.rect(gx0, y, gw, Math.max(1, 1.4 * u)), 'stone', 4.6, 3);   // a raised sign, catching the light
      }
      p.fill(C.rect(m < 0 ? cx - dw - fw : cx + dw + fw - 1, ly, 1, sill - ly + 14 * u), 'stone', 4.6, 3); // the jamb's outer arris
      p.fill(C.rect(m < 0 ? cx - dw - 1 : cx + dw, dTop, 1, sill - dTop + 14 * u), 'stone', 2, 3);         // the reveal, in shadow
    }
    p.fill(C.rect(cx - dw - fw - 1.5 * u, ly - 1.6 * u, 2 * (dw + fw + 1.5 * u), 1.6 * u), 'stone', 4.8, 3);
    p.fill(C.rect(cx - dw - fw, ly + 7 * u - 1, 2 * (dw + fw), 1), 'stone', 2, 3);
    // On the lintel, a sun disc between spread wings.
    const sy = ly + 3.3 * u;
    for (const m of [-1, 1]) {
      p.fill(C.poly([[cx + m * 2.2 * u, sy - 1.4 * u], [cx + m * (dw + fw - 0.5 * u), sy - 2.2 * u], [cx + m * (dw + fw - 1.5 * u), sy + 0.6 * u], [cx + m * 2.2 * u, sy + 1 * u]]), 'stone', 4.4, 4);
      for (let k = 1; k < 4; k += 1) p.fill(C.rect(cx + m * (2.2 + k * 2.4) * u - (m < 0 ? 1 : 0), sy - 1.6 * u, 1, 2.4 * u), 'stone', 2.6, 4);
    }
    p.fill(C.circle(cx, sy, 2.4 * u, 16), 'stone', 5.4, 4);
    p.fill(C.circle(cx - 0.6 * u, sy - 0.6 * u, 1.1 * u, 10), 'stone', 6.4, 4);
    // The door: black, and far down the stair a faint warm light, the treads above it lit from below.
    const door = C.rect(cx - dw, dTop, 2 * dw, sill - dTop + 14 * u);
    p.fill(door, 'dark', (x, y) => 0.5 + 1.6 * Math.max(0, 1 - (y - dTop) / (6 * u)) * (1 - Math.abs(x + 0.5 - cx) / dw), 4);
    if (o.deep) {
      p.fill(door, 'deep', (x, y) => {
        const d = Math.hypot((x + 0.5 - cx) / 1.5, y + 0.5 - sill) / (12 * u);
        return d < 1 ? o.deep * (1 - d) ** 1.4 : null;
      }, 4);
      for (let k = 1; k <= 3; k += 1) p.fill(C.rect(cx - dw + 1, sill - 1 * u - k * 2.6 * u, 2 * dw - 2, 1), 'deep', o.deep + 0.6 - k * 0.9, 4);
      p.light(cx, sill - 1 * u, 18 * u, 3, null, { zMin: 3, zMax: 5 });
    } else {
      for (let k = 1; k <= 3; k += 1) p.fill(C.rect(cx - dw, sill - 1 * u - k * 2.4 * u, 2 * dw, 1), 'stone', 2.6 - k * 0.5, 4);
    }
    // The moon on the upper left of the front.
    p.light(cx - hw - 20 * u, top - 10 * u, hw * 2.4, 1.3, null, { zMin: 2, zMax: 3 });
    return { door, dTop, dw, top, hw };
  }

  /** Steps cut down to the door, each wider than the one behind it, lit on their treads. */
  function steps(p, cx, sill, dw, u, n = 4) {
    for (let k = 0; k < n; k += 1) {
      const y = sill - 1 * u + k * 2.6 * u; const w = dw + 1 * u + k * 1.6 * u;
      p.fill(C.rect(cx - w, y, 2 * w, 2.6 * u), 'stone', 2.6 + k * 0.15, 5);
      p.fill(C.rect(cx - w, y, 2 * w, 1), 'stone', 3.8 + k * 0.2, 5);
    }
  }

  /** A campfire: a ring of stones, crossed sticks; the flames are a sprite drawn per frame. */
  function campfire(p, x, y, u) {
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2;
      p.fill(C.ellipse(x + Math.cos(a) * 4.2 * u, y + Math.sin(a) * 1.4 * u, 1.3 * u, 0.9 * u, 8), 'stone', 3.4, 7);
    }
    p.fill(C.poly([[x - 3.5 * u, y + 0.6 * u], [x + 2.5 * u, y - 1.4 * u], [x + 3 * u, y - 0.6 * u], [x - 3 * u, y + 1.4 * u]]), 'wood', 2.2, 7);
    p.fill(C.poly([[x + 3.5 * u, y + 0.6 * u], [x - 2.5 * u, y - 1.4 * u], [x - 3 * u, y - 0.6 * u], [x + 3 * u, y + 1.4 * u]]), 'wood', 1.8, 7);
    p.fill(C.ellipse(x, y - 0.2 * u, 2.2 * u, 0.9 * u, 10), 'fire', 2.6, 8);
  }

  /**
   * A cobra taller than the door, risen out of the sand on the steps: coils
   * at the foot, the hood spread, the banded throat toward the fire, two
   * eyes in the card's colour.
   */
  function cobra(p, cx, fy, s, z, ramp) {
    // Coils on the steps.
    for (const [dx, dy, rx] of [[-0.2, -0.03, 0.2], [0.16, -0.02, 0.22], [-0.02, -0.08, 0.18]]) {
      p.fill(C.ellipse(cx + dx * s, fy + dy * s, rx * s, 0.06 * s, 18), 'chitin', 1.6, z);
      p.fill(C.ellipse(cx + dx * s, fy + dy * s - 0.025 * s, rx * s * 0.8, 0.02 * s, 14), 'chitin', 3, z);
    }
    // The neck, rising and leaning a little toward you.
    const neck = C.poly([[cx - 0.07 * s, fy - 0.08 * s], [cx - 0.06 * s, fy - 0.4 * s], [cx + 0.07 * s, fy - 0.42 * s], [cx + 0.08 * s, fy - 0.08 * s]]);
    p.fill(neck, 'chitin', 1.4, z);
    // The hood: broad, round-shouldered, narrowing to the head.
    const hood = C.poly([[cx - 0.06 * s, fy - 0.38 * s], [cx - 0.2 * s, fy - 0.52 * s], [cx - 0.27 * s, fy - 0.7 * s], [cx - 0.24 * s, fy - 0.84 * s], [cx - 0.12 * s, fy - 0.94 * s], [cx - 0.06 * s, fy - 0.98 * s],
      [cx + 0.06 * s, fy - 0.98 * s], [cx + 0.12 * s, fy - 0.94 * s], [cx + 0.24 * s, fy - 0.84 * s], [cx + 0.27 * s, fy - 0.7 * s], [cx + 0.2 * s, fy - 0.52 * s], [cx + 0.07 * s, fy - 0.4 * s]]);
    p.fill(hood, 'chitin', 1.1, z);
    // Its markings: a darker ring on each side of the hood.
    for (const m of [-1, 1]) p.fill(C.ellipse(cx + m * 0.15 * s, fy - 0.74 * s, 0.05 * s, 0.07 * s, 12), 'chitin', 0.2, z);
    // The throat, banded, lit by the fire.
    const throat = C.poly([[cx - 0.06 * s, fy - 0.1 * s], [cx - 0.07 * s, fy - 0.82 * s], [cx + 0.07 * s, fy - 0.82 * s], [cx + 0.06 * s, fy - 0.1 * s]]);
    p.fill(throat, 'chitin', (x, y) => ((fy - y) % (0.06 * s) < 1 ? 2.2 : 3.4), z + 1);
    // The head, bowed forward at the hood's top; eyes and a flicker of tongue.
    p.fill(C.ellipse(cx, fy - 0.94 * s, 0.075 * s, 0.055 * s, 14), 'chitin', 2.2, z + 2);
    p.fill(C.rect(Math.round(cx - 0.05 * s), Math.round(fy - 0.95 * s), 1, 1), ramp, 4, z + 3);
    p.fill(C.rect(Math.round(cx + 0.04 * s), Math.round(fy - 0.95 * s), 1, 1), ramp, 4, z + 3);
    p.fill(C.rect(Math.round(cx), Math.round(fy - 0.89 * s), 1, 2), ramp, 2.4, z + 3);
    return { ex: cx, ey: fy - 0.95 * s };
  }

  /** The stone that seals the door, carved with signs, let down most of the way. */
  function sealStone(p, cx, dTop, sill, dw, u, ramp, low) {
    const top = lerp(dTop, sill, low);
    const slab = C.rect(cx - dw - 0.5, top, 2 * dw + 1, sill + 2 * u - top);
    p.fill(slab, ramp, 0.9, 8);
    p.shade(slab, (x, y) => {
      const gx = Math.floor((x - cx + dw) / (3 * u)); const gy = Math.floor((y - top) / (3.2 * u));
      const lx = (x - cx + dw) % (3 * u); const ly = (y - top) % (3.2 * u);
      if (y - top < 1) return 1.6;
      return (lx < 2 * u && ly < 1.6 * u && hash(gx, gy, 3) > 0.35) ? 0.8 : 0;
    }, 8);
    p.fill(C.poly([[cx - 1 * u, top + 2 * u], [cx + 1.5 * u, top + 7 * u], [cx - 0.5 * u, top + 11 * u], [cx + 0.5 * u, top + 11 * u], [cx + 2.5 * u, top + 7 * u], [cx, top + 2 * u]]), ramp, 0.4, 8);
  }

  /** An obelisk leaning out of a dune, its point catching the moon on one face. */
  function obelisk(p, x, by, h, z, lean) {
    const w = h * 0.13; const tx = x + lean * h;
    p.fill(C.poly([[x - w, by], [tx - w * 0.62, by - h * 0.86], [tx, by - h], [tx + w * 0.62, by - h * 0.86], [x + w, by]]), 'stone', 2.4, z);
    p.fill(C.poly([[x - w, by], [tx - w * 0.62, by - h * 0.86], [tx, by - h], [tx - w * 0.05, by - h * 0.86], [x - w * 0.1, by]]), 'stone', 4.4, z);
    for (let k = 1; k < 6; k += 1) {
      const t = k / 7; const yy = by - h * 0.8 * t; const xx = lerp(x, tx, t * 0.86);
      p.fill(C.rect(xx - w * 0.3, yy, Math.max(1, w * 0.3), 1), 'stone', 1.4, z);
    }
    p.fill(C.ellipse(x, by, w * 3, w * 0.8, 14), 'sand', 3.8, z);
  }

  /** A colossal head buried to the chin: a striped headdress, a calm face, blind eyes. Moonlit from the left. */
  function colossus(p, x, by, s, z) {
    const X = (k) => Math.round(x + k * s); const Y = (k) => Math.round(by - k * s);
    // The headdress: flared lappets, striped, the moon on its left side.
    const hd = C.poly([[x - 0.46 * s, by], [x - 0.46 * s, by - 0.36 * s], [x - 0.34 * s, by - 0.82 * s], [x - 0.14 * s, by - s], [x + 0.14 * s, by - s], [x + 0.34 * s, by - 0.82 * s], [x + 0.46 * s, by - 0.36 * s], [x + 0.46 * s, by]]);
    p.fill(hd, 'stone', 1.8, z);
    p.shade(hd, (px, py) => (Math.floor((by - py) / Math.max(2, 0.09 * s)) % 2 ? -0.5 : 0.3) + (px < x - 0.12 * s ? 1.6 : 0), z);
    // The face, set in the headdress: its left half moonlit, its right in shade.
    const face = C.poly([[x - 0.2 * s, by - 0.04 * s], [x - 0.23 * s, by - 0.74 * s], [x + 0.23 * s, by - 0.74 * s], [x + 0.2 * s, by - 0.04 * s]]);
    p.fill(face, 'stone', (px) => (px < x ? 4.4 : 2.8), z);
    // The brow: a lit ridge, the eyes in shadow under it.
    p.fill(C.rect(X(-0.21), Y(0.63), X(0.21) - X(-0.21), 1), 'stone', 6.4, z);
    p.fill(C.rect(X(-0.16), Y(0.63) + 1, Math.max(2, X(-0.04) - X(-0.16)), 1), 'stone', 0.4, z);
    p.fill(C.rect(X(0.05), Y(0.63) + 1, Math.max(2, X(0.17) - X(0.05)), 1), 'stone', 0.4, z);
    // The nose: its left edge lit, its shadow thrown right.
    p.fill(C.rect(X(0) - 1, Y(0.55), 1, Math.max(3, Y(0.36) - Y(0.55))), 'stone', 6.4, z);
    p.fill(C.rect(X(0), Y(0.52), 1, Math.max(3, Y(0.34) - Y(0.52))), 'stone', 0.6, z);
    // The lips: a lit upper edge over a dark line; the chin.
    p.fill(C.rect(X(-0.08), Y(0.25), X(0.08) - X(-0.08) + 1, 1), 'stone', 6, z);
    p.fill(C.rect(X(-0.07), Y(0.25) + 1, X(0.07) - X(-0.07) + 1, 1), 'stone', 0.6, z);
    p.fill(C.ellipse(x + 0.1 * s, by + 0.04 * s, 0.9 * s, 0.13 * s, 16), 'sand', 4.2, z);
  }

  /** Moonlit dunes behind, sand drifted up against the temple on both sides, a cut down to the steps. */
  function drifts(p, W, H, cx, sill, dw, u, far, o = {}) {
    const A = (o.rise || 30) * u; const D = (o.reach || 42) * u;
    // Each side climbs away from the door in a concave sweep, then runs on as the dunes behind.
    const crest = (x) => {
      const d = Math.abs(x - cx) - dw - 4 * u;
      if (d < 0) return Math.max(sill + 9 * u, far(x));
      const k = x < cx ? 1 : 1.12;
      const cut = sill + 3 * u - A * k * (d / D) ** 1.35 - 1.2 * u * Math.sin(d / (5 * u));
      const f = far(x); const s = 4 * u;
      return (cut + f + Math.sqrt((cut - f) ** 2 + s * s)) / 2;
    };
    duneRow(p, W, H, crest, { ramp: 'sand', v: 2.2 + (o.lift || 0), lit: 3.6, litNear: 0, lightX: -1e6, rim: 2.4 + (o.lift || 0), rimNear: 0, rimW: 1.2, fall: 0.03, depth: 30 * u, faceD: 12 * u, soft: 0.5, lean: 0, ripple: 3.2 * u, rippleV: 1.4, seed: 8, z: 5 });
    return crest;
  }

  const B = {
    job: 4, setting: 'desert', key: 'B', id: 'desert-b',
    name: 'Desert', title: 'The buried gate',
    pitch: 'Night in the deep desert. A temple door half sunk in a dune, a small fire at its foot, and the stars all the way down to the sand.',
    notes: [
      ['Light', 'A campfire is the only warm thing: it lights the steps and the door frame, and the sand turns from moonlit grey to gold where it reaches.'],
      ['Detail', 'A temple wall of big blocks under a fluted cornice, a door frame carved with signs and a winged sun disc, steps going down into black with a faint warm light far below, a colossal head buried to the chin, a full moon and real stars.'],
      ['Vista', 'Moonlit dunes on both sides and the half-buried front at the centre. The card is in the doorway by the fire: a cobra risen out of the sand, a traveller with a lantern, a violet jar spilling light, the seal stone dropping, the door burning gold.'],
      ['World', 'Dark sand with wind ripples under the table, the fire’s warmth along the top, embers drifting up, a few stars only at the very top.'],
    ],
    palette: ['#04060A', '#10161F', '#28323B', '#1B2025', '#3B3D3C', '#383B3D', '#A07D4C', '#F2A23E', '#F2F3EA'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['sky', 'moon', 'dark', 'fire', 'glow', 'deep'] });
      const u = H / 134; const gx = W / 2;
      const hor = 76 * u; const mx = 21 * u; const my = 19 * u; const mr = 5.5 * u;
      skyB(p, W, hor + 4 * u, mx, my, mr);
      moonDisc(p, mx, my, mr);
      const wf = rolling(71, 7 * u);
      duneRow(p, W, H, (x) => hor - 2 * u - 7 * u * wf(x), { ramp: 'sand', v: 3.6, lit: 2.8, lightX: -1e6, rim: 2.4, rimW: 1.2, fall: 0.05, depth: 10 * u, faceD: 8 * u, soft: 0.8, lean: 0.3, z: 1 });
      const sill = 98 * u;
      const tp = temple(p, gx, sill, u, { hw: 30, h: 50, dw: 8, dh: 34, fw: 4.5, deep: 4.4, seed: 35 });
      steps(p, gx, sill, tp.dw, u, 4);
      const fr = rolling(72, 9 * u); const far = (x) => hor + 2 * u - 5 * u * fr(x);
      drifts(p, W, H, gx, sill, tp.dw, u, far, { rise: 32, reach: 22, lift: 0.9 });
      // Sand drifted over the cornice.
      p.fill(C.poly([[gx - 33 * u, sill - 50 * u], [gx - 12 * u, sill - 53 * u], [gx + 6 * u, sill - 51.5 * u], [gx + 26 * u, sill - 54 * u], [gx + 36 * u, sill - 50 * u]]), 'sand', 3.6, 3);
      // The camp: the fire left of the steps, a rolled blanket and a staff stuck in the sand on the right.
      const fx = gx - 13 * u; const fy = 111 * u;
      campfire(p, fx, fy, u);
      p.fill(C.ellipse(gx + 17 * u, 113 * u, 7 * u, 1.9 * u, 16), 'wood', 2.6, 7);
      for (const dx of [-3.5, 0.5, 4]) p.fill(C.rect(gx + (17 + dx) * u, 111 * u, 1, 4 * u), 'wood', 1, 7);
      p.fill(C.rect(gx + 27 * u, 92 * u, 1, 21 * u), 'wood', 2.2, 7);
      p.fill(C.ellipse(gx + 27.5 * u, 99 * u, 1.4 * u, 2.4 * u, 10), 'wood', 2.8, 7);
      // Footprints from you to the steps.
      for (let k = 0; k < 6; k += 1) {
        const y = H - 5 * u - k * 4.4 * u; const x = gx + 4 * u + (k % 2 ? 2 : -2) * u - k * 0.6 * u;
        p.shade(C.rect(Math.round(x), Math.round(y), 2, 1), -1.6, 5);
      }
      // The fire's pool: hot on the steps and the sand round it, falling off to the moonlit blue.
      p.light(fx, fy - 3 * u, 40 * u, 8.6, null, { zMin: 1, hard: true });
      p.light(fx, fy - 3 * u, 70 * u, 2.6, null, { zMin: 1 });
      p.tint(fx, fy - 2 * u, 26 * u, '#D06A22', 0.3);
      p.rim(-1, 0, 0.6, 2);
      vignette(p, W, H, 1.3, 0.55, 0);
      return {
        p,
        over(img) {
          stars(img, p, W, hor, 0.7, 77, 70, [mx, my, mr * 3]);
          sprite(img, Math.round(fx), Math.round(fy - 0.5 * u), SPRITES.flame[0], FLAME);
          for (const [x, y] of [[fx + 2, fy - 12 * u], [fx - 3, fy - 17 * u], [fx + 1, fy - 22 * u]]) put(img, x, y, '#F2A23E', 0.8);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['sky', 'moon', 'dark', 'fire', 'glow', 'deep'] });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const hor = 62 * u; const mx = gx - 70 * u; const my = 20 * u; const mr = 6.5 * u;
      skyB(p, W, hor + 6 * u, mx, my, mr);
      moonDisc(p, mx, my, mr);
      // Spires far off, black on the sky.
      for (const [d, w, h, s, kind] of [[-118, 26, 22, 81, 'mesa'], [132, 12, 34, 82, 'cap'], [-196, 14, 30, 83, ''], [226, 30, 18, 84, 'mesa'], [-290, 28, 20, 85, 'mesa'], [310, 12, 30, 86, '']]) {
        const x = gx + d * u;
        if (x < -30 * u || x > W + 30 * u) continue;
        spire(p, x, hor + 4 * u, w * u, h * u, { ramp: 'stone', v: 1.3, z: 1, seed: s, k: 0.2, band: 3 * u, cap: kind === 'cap' ? 0.2 : 0, mesa: kind === 'mesa' });
      }
      const wf = rolling(73, 15 * u);
      duneRow(p, W, H, (x) => hor + 2 * u - 8 * u * wf(x), { ramp: 'sand', v: 2.6, lit: 2.8, lightX: -1e6, rim: 1.2, rimW: 1.2, fall: 0.05, depth: 10 * u, faceD: 6 * u, soft: 0.8, lean: 0.3, ripple: 2.6 * u, rippleV: 0.9, seed: 1, z: 1 });
      const sill = 84 * u;
      const tp = temple(p, gx, sill, u, { hw: 36, h: 52, dw: 8, dh: 32, deep: ['monster', 'wanderer', 'item'].includes(cat) ? 2.6 : 0 });
      // Inside the door: what the card is.
      const open = cat === 'clear-path';
      if (open) {
        p.glow(tp.door, 'glow', gx, sill - 6 * u, 30 * u, 6.4, 3.2, 4);
      }
      steps(p, gx, sill, tp.dw, u, 4);
      // Broken things in the sand along the width: an obelisk's stump, a toppled head, column drums.
      const props = [];
      for (let d = 64; d < 400; d += 150) props.push(-d, d + 30);
      const wm = rolling(75, 22 * u);
      const far = (x) => hor + 9 * u - 11 * u * wm(x);
      drifts(p, W, H, gx, sill, tp.dw, u, far);
      for (const d of props) {
        const x = gx + d * u; if (x < -20 * u || x > W + 20 * u) continue;
        const by = far(x) + 4 * u;
        if (d < 0) obelisk(p, x, by, 30 * u, 6, hash(d, 0, 4) < 0.5 ? 0.12 : -0.1);
        else colossus(p, x, by + 1 * u, 26 * u, 6);
      }
      // The card, in the doorway, by the fire.
      const fx = gx - 17 * u; const fy = sill + 6 * u;
      if (cat === 'monster') {
        const c = cobra(p, gx + 1 * u, sill + 5 * u, 42 * u, 8, ramp);
        p.tint(c.ex, c.ey, 4.5 * u, hex, 0.35, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const l = traveller(p, gx + 1 * u, sill, 28 * u, 8, ramp, 'wand', 0.7, 'wood');
        p.tint(l.lx, l.ly, 12 * u, hex, 0.6, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        const m = urn(p, gx + 1 * u, sill + 1 * u, 18 * u, 8, ramp, -0.12, ramp, 1.3, null);
        p.tint(m[0], m[1] - 2 * u, 12 * u, hex, 0.55, flicker(2, 0.15, 0.7));
        p.tint(gx, sill + 4 * u, 20 * u, CARD[ramp][2], 0.35, flicker(2.4, 0.2, 0.7));
      } else if (cat === 'obstacle') {
        sealStone(p, gx, tp.dTop, sill, tp.dw, u, ramp, 0.25);
        p.tint(gx, sill + 4 * u, 16 * u, CARD[ramp][2], 0.3, flicker(0.5, 0.12, 0.6));
      } else if (open) {
        p.light(gx, sill, 50 * u, 4.4, flicker(0.2, 0.06, 0.4), { zMin: 2, sy: 0.6 });
        p.tint(gx, sill - 10 * u, 26 * u, CARD.path[3], 0.3, flicker(0.2, 0.08, 0.4));
      }
      campfire(p, fx, fy, u);
      // The fire: full on the sand and stone, softer on the card so its own colour holds.
      p.light(fx, fy - 3 * u, 44 * u, 6.2, flicker(0.8, 0.14, 0.9), { zMin: 1, zMax: 7, hard: true });
      p.light(fx, fy - 3 * u, 92 * u, 1.6, null, { zMin: 1, zMax: 7 });
      p.light(fx, fy - 3 * u, cat === 'monster' ? 54 * u : 40 * u, { monster: 6, obstacle: 0.7 }[cat] ?? 1.6, flicker(0.8, 0.14, 0.9), { zMin: 8, hard: true });
      p.rim(-1, 0, cat === 'monster' ? 2.2 : 0.9, 8);
      p.rim(-1, 0, 0.7, 5);
      vignette(p, W, H, 1.4, 0.5, 0);
      return {
        p,
        over(img, t) {
          stars(img, p, W, hor, t, 79, Math.round(W * 0.7), [mx, my, mr * 3]);
          sprite(img, Math.round(fx), Math.round(fy - 0.5 * u), SPRITES.flame[Math.floor(t * 8) % 3], FLAME);
          for (const q of particles('ember', 10, [fx - 6 * u, 20 * u, 12 * u, fy - 24 * u], t, 81)) put(img, q.x, q.y, q.big ? '#FFD27A' : '#D06A22', q.a * 0.9);
          if (cat === 'obstacle') {
            for (const q of particles('drip', 30, [gx - 5 * u, tp.dTop - 6 * u, 10 * u, sill - tp.dTop + 12 * u], t * 1.6, 83)) put(img, q.x, q.y, q.i % 3 ? '#76603F' : '#A07D4C', 0.95);
          }
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 8 * u, sill - 26 * u, 18 * u, 26 * u], t, 85)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          if (open) for (const q of particles('mote', 14, [gx - 10 * u, sill - 30 * u, 20 * u, 34 * u], t, 87)) put(img, q.x, q.y, q.big ? '#FFD98A' : '#C8842E', q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['sky'] });
      const gx = W / 2; const hor = Math.round(H * 0.24);
      skyB(p, W, hor + 14, -400, -400, 1);
      const wf = waves(91, 60, 0.64, -1);
      duneRow(p, W, H, (x) => hor + 3 - 9 * wf(x), { ramp: 'sand', v: 3.2, lit: 1.6, lightX: -1e6, rim: 1.2, rimW: 1.2, fall: 0.03, depth: 10, faceD: 8, lean: 0.6, z: 1 });
      p.fill(C.rect(0, hor + 6, W, H - hor - 6), 'sand', (x, y) => {
        const dy = y + 0.5 - hor;
        return 3.4 - 2 * Math.min(1, dy / (H * 0.62)) ** 0.7;
      }, 3);
      duneField(p, W, H, hor + 6, { z: 3, vx: gx, k: 300, c: 8, wf: 1.3, seed: 5, rimF: 0.08, rim: 0.9, dark: 1.1, rip: 7, ripV: 0.4, fade0: 1, fade1: 16 });
      // The fire's warmth, from behind the vista, along the top.
      p.light(gx - 10, hor + 6, 120, 2.6, flicker(0.8, 0.12, 0.9), { zMin: 1, sy: 0.7 });
      p.tint(gx - 10, hor + 6, 110, '#33251A', 0.7, flicker(0.8, 0.12, 0.9));
      return {
        p,
        over(img, t) {
          stars(img, p, W, hor, t, 93, 60);
          for (const q of particles('ember', 14, [gx - 60, 10, 100, hor + 40], t, 95)) put(img, q.x, q.y, q.big ? '#D06A22' : '#8E3A14', q.a * 0.7);
        },
      };
    },
  };

  /* ================= C: the temple halls (inside A) ================= */

  // The same sandstone as A's spires, the same sand; the sun comes in only as shafts of gold.
  const RAMPS_C = {
    stone: RAMPS_A.rock,
    sand: RAMPS_A.sand,
    beam: ['#2A1708', '#4E2C10', '#7E4A1C', '#B26E2C', '#DE9A44', '#F4C26C', '#FDDC96', '#FEF4C8'],
    dark: ['#050302', '#0B0705', '#120C08', '#1A110B'],
    sky: RAMPS_A.sky, sun: RAMPS_A.sun, haze: RAMPS_A.haze,
    shadow: RAMPS_A.shadow, bone: RAMPS_A.bone,
    ...CARD,
  };
  const FLAME_C = { a: '#7E3A12', b: '#E08A2E', c: '#FFE08A', d: '#3A2010' };
  const SLANT = -0.22; // the shafts lean the same way everywhere: the sun is low in the west

  /** A shaft of sun through a crack in the roof: it brightens whatever it passes in front of, and pools where it lands. */
  function shaft(p, x0, y0, y1, w0, w1, k, pool = 0, sl = SLANT, fade = 0) {
    const x1 = x0 + sl * (y1 - y0);
    const poly = C.poly([[x0 - w0 / 2, y0], [x0 + w0 / 2, y0], [x1 + w1 / 2, y1], [x1 - w1 / 2, y1]]);
    p.shade(poly, (x, y) => {
      const t = clamp((y - y0) / (y1 - y0), 0, 1);
      const e = 1 - Math.abs(x + 0.5 - lerp(x0, x1, t)) / (lerp(w0, w1, t) / 2);
      return k * clamp(e * (fade ? 1.4 : 2.4), 0, 1) * (0.8 + 0.2 * Math.sin(t * 11 + x0)) * (1 - fade + fade * t);
    });
    if (pool) p.light(x1, y1, pool, k * 0.9, null, { zMin: 1, sy: 0.32 });
    return { x1, y1 };
  }

  /** The crack a shaft comes through: a jagged slot of daylight in the roof. */
  function crack(p, x, y0, y1, u) {
    for (let y = Math.floor(y0), k = 0; y < y1; y += 1, k += 1) {
      const w = Math.max(1, Math.round((1.2 + hash(k, 0, Math.round(x)) * 1.6) * u));
      p.fill(C.rect(Math.round(x - w / 2 + (hash(k, 1, 5) - 0.5) * 1.5 * u), y, w, 1), 'beam', 6.6, 3);
    }
  }

  /**
   * A sandstone column: a shaft rounded by its shading, bands under a flared
   * papyrus capital, a square abacus, a round base, and a panel of figures
   * cut into it.
   */
  function column(p, x, top, base, w, z, v, seed) {
    const ab = w * 0.28; const cap = w * 0.85; const bh = w * 0.22; const st = top + ab + cap;
    const shaftP = C.poly([[x - w / 2, base - bh], [x - w * 0.43, st], [x + w * 0.43, st], [x + w / 2, base - bh]]);
    p.fill(shaftP, 'stone', v, z);
    p.shade(shaftP, (px) => { const t = (px + 0.5 - (x - w / 2)) / w; return 0.9 * Math.cos((t - 0.35) * Math.PI * 1.1) - 0.5; }, z);
    const capP = C.poly([[x - w * 0.43, st], [x - w * 0.78, top + ab], [x + w * 0.78, top + ab], [x + w * 0.43, st]]);
    p.fill(capP, 'stone', v + 0.4, z);
    p.shade(capP, (px) => (((px - x + 200 * w) % Math.max(2, w * 0.26)) < 1 ? -0.8 : 0), z);
    p.fill(C.rect(x - w * 0.55, top, w * 1.1, ab), 'stone', v + 0.7, z);
    p.fill(C.rect(x - w * 0.6, base - bh, w * 1.2, bh), 'stone', v + 0.5, z);
    p.fill(C.rect(x - w * 0.6, base - bh, w * 1.2, 1), 'stone', v + 1.2, z);
    for (let k = 0; k < 3; k += 1) p.shade(C.rect(x - w / 2, st + 1 + k * Math.max(2, w * 0.14), w, 1), -1, z);
    // A panel of figures: little standing people cut in, each a head over a body, one arm raised.
    const y0 = st + w * 0.7; const y1 = Math.min(base - bh - w * 0.5, y0 + w * 2.2);
    for (let y = y0, row = 0; y + 4 < y1; y += Math.max(5, w * 0.62), row += 1) {
      for (let fx = x - w * 0.32, k = 0; fx < x + w * 0.3; fx += Math.max(3, w * 0.24), k += 1) {
        if (hash(row, k, seed) < 0.25) continue;
        const X = Math.round(fx); const Y = Math.round(y);
        p.shade(C.rect(X, Y, 1, 1), -1.1, z); p.shade(C.rect(X, Y + 2, 1, 3), -1.1, z);
        p.shade(C.rect(X + 1, Y + (hash(row, k, seed + 1) < 0.5 ? 1 : 3), 1, 1), -1.1, z);
        p.shade(C.rect(X - 1, Y + 2, 1, 3), 0.7, z);
      }
    }
  }

  /**
   * A colossus seated on its throne and facing you: the striped headdress
   * falling to the chest, the false beard, hands flat on the knees.
   */
  function colossusSeated(p, cx, base, s, z, v, c = 0) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, base - y * s]));
    p.fill(P([[-0.36, 0], [-0.36, 0.54], [0.36, 0.54], [0.36, 0]]), 'stone', v - 0.7, z);                       // the throne
    for (const m of [-1, 1]) {
      p.fill(P([[m * 0.02, 0.02], [m * 0.02, 0.46], [m * 0.19, 0.46], [m * 0.2, 0.02]]), 'stone', v, z);          // shins
      p.fill(P([[m * 0.01, 0], [m * 0.01, 0.05], [m * 0.22, 0.05], [m * 0.22, 0]]), 'stone', v + 0.5, z);         // feet
      p.fill(P([[m * 0.17, 0.5], [m * 0.18, 0.78], [m * 0.26, 0.76], [m * 0.25, 0.5]]), 'stone', v - 0.3, z);       // arms
      p.fill(P([[m * 0.06, 0.44], [m * 0.06, 0.5], [m * 0.17, 0.5], [m * 0.17, 0.44]]), 'stone', v + 0.7, z);      // hands on the knees
    }
    p.fill(P([[-0.2, 0.44], [-0.2, 0.52], [0.2, 0.52], [0.2, 0.44]]), 'stone', v + 0.5, z);                     // the lap
    p.fill(P([[-0.16, 0.5], [-0.2, 0.8], [0.2, 0.8], [0.16, 0.5]]), 'stone', v + 0.2, z);                       // the body
    const hd = P([[-0.2, 0.62], [-0.23, 0.86], [-0.15, 0.98], [-0.07, 1.02], [0.07, 1.02], [0.15, 0.98], [0.23, 0.86], [0.2, 0.62], [0.12, 0.62], [0.11, 0.84], [-0.11, 0.84], [-0.12, 0.62]]);
    p.fill(hd, 'stone', v + 0.2, z);
    p.shade(hd, (px, py) => ((Math.floor((base - py) / Math.max(2, s * 0.03)) % 2) ? -0.6 : 0), z);           // its stripes
    p.fill(P([[-0.1, 0.8], [-0.11, 0.96], [0.11, 0.96], [0.1, 0.8]]), 'stone', v + 0.9, z);                     // the face
    p.fill(P([[-0.025, 0.71], [-0.03, 0.8], [0.03, 0.8], [0.025, 0.71]]), 'stone', v, z);                       // the beard
    const Y = (k) => Math.round(base - k * s); const X = (k) => Math.round(cx + k * s);
    p.fill(C.rect(X(-0.09), Y(0.915), X(0.09) - X(-0.09), 1), 'stone', v + 2, z);                               // the brow
    p.fill(C.rect(X(-0.07), Y(0.9), Math.max(1, X(-0.02) - X(-0.07)), 1), 'stone', v - 1.4, z);                  // eyes
    p.fill(C.rect(X(0.025), Y(0.9), Math.max(1, X(0.07) - X(0.025)), 1), 'stone', v - 1.4, z);
    p.fill(C.rect(X(0.005), Y(0.885), 1, Math.max(2, Y(0.845) - Y(0.885))), 'stone', v - 1, z);                  // the nose's shadow
    p.fill(C.rect(X(-0.04), Y(0.83), X(0.04) - X(-0.04), 1), 'stone', v - 1.2, z);                              // the mouth
    for (const k of [0.18, 0.34, 0.62]) p.shade(P([[-0.36, k], [0.36, k], [0.36, k - 0.008], [-0.36, k - 0.008]]), -0.5, z); // block joints
    if (!c) return;
    // Modelled harder, for a small size: the throne sunk in shadow, a gap between the shins,
    // the knees, hands and lap catching the light, the arms' outer edges lit.
    p.shade(P([[-0.36, 0], [-0.36, 0.54], [-0.2, 0.54], [-0.2, 0]]), -c * 1.6, z);
    p.shade(P([[0.2, 0], [0.2, 0.54], [0.36, 0.54], [0.36, 0]]), -c * 1.6, z);
    p.shade(P([[-0.36, 0.54], [-0.36, 0.6], [-0.26, 0.6], [-0.26, 0.54]]), -c * 1.2, z);
    p.shade(P([[0.26, 0.54], [0.26, 0.6], [0.36, 0.6], [0.36, 0.54]]), -c * 1.2, z);
    p.fill(C.rect(X(-0.01), Y(0.44), Math.max(1, X(0.01) - X(-0.01)), Y(0.02) - Y(0.44)), 'stone', v - 2.2 * c, z);
    p.shade(P([[-0.2, 0.47], [-0.2, 0.52], [0.2, 0.52], [0.2, 0.47]]), c * 1.4, z);
    for (const m of [-1, 1]) {
      p.shade(P([[m * 0.06, 0.44], [m * 0.06, 0.5], [m * 0.17, 0.5], [m * 0.17, 0.44]]), c * 1.6, z);
      p.shade(P([[m * 0.24, 0.5], [m * 0.25, 0.77], [m * 0.27, 0.76], [m * 0.26, 0.5]]), c * 1.4, z);
      p.shade(P([[m * 0.02, 0.36], [m * 0.02, 0.44], [m * 0.19, 0.44], [m * 0.19, 0.36]]), c * 0.9, z);
    }
    p.shade(P([[-0.1, 0.8], [-0.11, 0.96], [0.11, 0.96], [0.1, 0.8]]), c * 0.8, z);
  }

  /** A bronze brazier on three legs, coals glowing; the flame is a sprite per frame. Returns where the flame sits. */
  function brazier(p, x, fy, u, z) {
    for (const [a, b] of [[-3.2, -1.2], [3.2, 1.2], [0, 0]]) {
      p.fill(C.poly([[x + a * u - 0.5, fy], [x + b * u - 0.5, fy - 6 * u], [x + b * u + 0.6, fy - 6 * u], [x + a * u + 0.6, fy]]), 'shadow', 2.6, z);
    }
    p.fill(C.poly([[x - 3.6 * u, fy - 7.6 * u], [x + 3.6 * u, fy - 7.6 * u], [x + 2.4 * u, fy - 5.6 * u], [x - 2.4 * u, fy - 5.6 * u]]), 'stone', 3.4, z);
    p.fill(C.rect(x - 3.6 * u, fy - 7.6 * u, 7.2 * u, 1), 'stone', 5.4, z);
    p.fill(C.ellipse(x, fy - 7.8 * u, 2.6 * u, 0.7 * u, 10), 'beam', 4.4, z + 1);
    return [x, fy - 8 * u];
  }

  /** A cone of sand poured in from the roof, rippled, lit on top. */
  function sandHeap(p, x, fy, w, h, z, v) {
    const pts = []; for (let i = 0; i <= 12; i += 1) { const t = i / 12; pts.push([x - w + 2 * w * t, fy - h * Math.sin(t * Math.PI) ** 1.4]); }
    pts.push([x + w, fy + 1], [x - w, fy + 1]);
    p.fill(C.poly(pts), 'sand', (px, py) => v + 1.6 * (1 - Math.abs(px - x) / w) - ((py * 0.8 + px * 0.3) % 3 < 0.8 ? 0.6 : 0), z);
  }

  /**
   * Signs cut in a line along a face: little irregular columns of marks,
   * worn here and there; where `lit(x)` they glow in the card's colour.
   */
  function inscribe(p, x0, x1, cy, h, ramp, z, seed, lit, skip = () => false) {
    const glow = []; let x = x0; let k = 0;
    while (x < x1) {
      if (skip(x)) { x += 1; continue; }
      const on = lit(x, k); const rows = 2 + Math.floor(hash(k, 1, seed) * 3);
      for (let r = 0; r < rows; r += 1) {
        if (hash(k, r, seed + 2) < 0.22) continue;
        const y = Math.round(cy(x) - h(x) * 0.55 + r * Math.max(2, h(x) * 0.42) + (hash(k, r, seed + 3) < 0.5 ? 0 : 1));
        p.fill(C.rect(Math.round(x), y, hash(k, r, seed + 4) < 0.4 ? 2 : 1, 1), ramp, on ? 2.5 + hash(k, r, seed + 5) * 1.1 : 0.7, z);
        if (on) glow.push([Math.round(x), y]);
      }
      x += 2 + Math.floor(hash(k, 9, seed) * 3); k += 1;
    }
    return glow;
  }

  /**
   * A column come down toward you in the aisle: its drums tumbled in a
   * heap, round fluted faces turned to you, each cut with a ring of signs;
   * the broken stump still standing beside them. Black against the door.
   */
  function fallenDrums(p, cx, fy, u, z, ramp) {
    const glow = [];
    // The stump, still standing.
    p.fill(C.poly([[cx - 26 * u, fy], [cx - 26 * u, fy - 24 * u], [cx - 23.5 * u, fy - 27 * u], [cx - 21 * u, fy - 23 * u], [cx - 18 * u, fy - 25 * u], [cx - 18 * u, fy]]), 'shadow', 0.6, z);
    for (let y = fy - 22 * u; y < fy; y += 3 * u) p.fill(C.rect(cx - 26 * u, y, 8 * u, 1), 'shadow', 1.6, z);
    const drums = [[-11, -7.5, 7.5, 3], [12, -8, 8, 1], [0, -10, 10, 7], [5, -24, 7, 5]];
    for (const [dx, dy, r, seed] of drums) {
      const x = cx + dx * u; const y = fy + dy * u; const R = r * u;
      // The face: fluted round its edge, a carved ring, the dowel hole in the middle.
      const face = C.poly(Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; const k = R * (1 - 0.06 * Math.abs(Math.sin(a * 10))); return [x + Math.cos(a) * k, y + Math.sin(a) * k]; }));
      p.fill(face, 'stone', 1.9, z);
      p.shade(face, (px, py) => {
        const d = Math.hypot(px + 0.5 - x, py + 0.5 - y) / R;
        if (d > 0.88) return -1.6;                                                // its edge, dark, so the drums part
        let v = (y - py) / R > 0.45 ? 1.6 : 0;                                    // its top, catching the shaft
        if (d > 0.62 && d < 0.74) v += 2.4;                                       // the carved ring
        return v;
      }, z);
      p.fill(C.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2), 'stone', 0, z);
      p.fill(C.rect(Math.round(x) - 1, Math.round(y) + 1, 2, 1), 'stone', 2.6, z);
      // Signs cut round the ring, a few still holding the light.
      for (let a = 0, k = 0; a < Math.PI * 2; a += 0.42 + hash(k, 0, seed) * 0.3, k += 1) {
        if (hash(k, 1, seed) < 0.25) continue;
        const rr = R * (0.82 + hash(k, 2, seed) * 0.08); const gx0 = Math.round(x + Math.cos(a) * rr); const gy0 = Math.round(y + Math.sin(a) * rr);
        const on = hash(k, 3, seed) < 0.22;
        p.fill(C.rect(gx0, gy0, 1, 1), ramp, on ? 2.8 + hash(k, 4, seed) : 0.7, z + 1);
        if (on) glow.push([gx0, gy0]);
      }
    }
    return glow;
  }

  /** The far door: a tall tapered opening in a carved frame, a winged disc on its lintel. */
  function farDoor(p, cx, top, base, u, z) {
    const hb = 8 * u; const ht = 6.5 * u; const f = 3.5 * u;
    p.fill(C.poly([[cx - hb - f, base], [cx - ht - f, top - 5 * u], [cx + ht + f, top - 5 * u], [cx + hb + f, base]]), 'stone', 2.4, z);
    p.fill(C.rect(cx - ht - f - 1.5 * u, top - 6.5 * u, 2 * (ht + f + 1.5 * u), 1.6 * u), 'stone', 3.6, z);
    for (const m of [-1, 1]) {
      p.fill(C.poly([[cx + m * 2 * u, top - 3.6 * u], [cx + m * (ht + f - 0.5 * u), top - 4.2 * u], [cx + m * (ht + f - 1.4 * u), top - 1.6 * u], [cx + m * 2 * u, top - 1.4 * u]]), 'stone', 3.4, z);
    }
    p.fill(C.circle(cx, top - 2.6 * u, 1.9 * u, 12), 'stone', 4.4, z);
    return C.poly([[cx - hb, base], [cx - ht, top], [cx + ht, top], [cx + hb, base]]);
  }

  const DC = {
    job: 4, setting: 'desert', key: 'C', id: 'desert-c', side: 'inside',
    name: 'Desert', title: 'The temple halls',
    pitch: 'Inside the buried temple, out of the sun. Columns as thick as towers, colossi on their thrones, and the sunset coming in through cracks in the roof as shafts of gold, with the sand pouring down them.',
    notes: [
      ['Light', 'The same gold light as outside, let in only through cracks in the roof: slanting shafts that pool on the floor. Braziers glow low between the columns; everything else is dark sandstone.'],
      ['Detail', 'Papyrus columns with banded capitals and carved figures, seated colossi with striped headdresses, a winged disc over the far door, sand falling in the shafts and heaped on the flagstones.'],
      ['Vista', 'Columns and colossi across the hall; the card stands in the aisle against the lit far door: the worm breaking up through the floor, a traveller with a lantern, a violet jar on an altar, a column fallen in a heap of drums, the far door open on the sunset.'],
      ['World', 'Sand-drifted flagstones under the table, the far end’s glow along the top, a shaft of gold falling at each edge with sand sifting down it.'],
    ],
    palette: ['#0A0605', '#28180F', '#4A2C19', '#82502B', '#D08C46', '#F4C26C', '#FEF4C8', '#6B3E22', '#FCDC92'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['beam', 'dark'] });
      const u = H / 134; const gx = W / 2; const floorY = Math.round(104 * u);
      // The back wall and its carving: a winged disc above the colossus.
      p.fill(C.rect(0, 0, W, floorY), 'stone', 0.8, 1);
      p.masonry(C.rect(0, 0, W, floorY), { bw: 12 * u, bh: 7 * u, joint: -0.7, top: 0.3, left: 0.2, vary: 0.5, chip: 0.03, seed: 51, z: 1 });
      const wy = 31 * u;
      for (const m of [-1, 1]) p.fill(C.poly([[gx + m * 3 * u, wy - 1.6 * u], [gx + m * 20 * u, wy - 3.4 * u], [gx + m * 17 * u, wy + 0.4 * u], [gx + m * 3 * u, wy + 1.6 * u]]), 'stone', 2.8, 1);
      for (let k = 1; k < 6; k += 1) for (const m of [-1, 1]) p.shade(C.rect(gx + m * (3 + k * 3) * u - (m < 0 ? 1 : 0), wy - 2.8 * u, 1, 3.6 * u), -0.9, 1);
      p.fill(C.circle(gx, wy, 2.8 * u, 16), 'stone', 3.6, 1);
      // The floor: flags, sand drifted over them.
      p.fill(C.rect(0, floorY, W, H - floorY), 'stone', 1.7, 1);
      p.floor(C.rect(0, floorY, W, H - floorY), { vx: gx, vy: floorY - 34 * u, rows: 4, size: 0.9, d0: 34 * u, joint: -1.2, top: 0.45, vary: 0.7, seed: 52, z: 1 });
      p.fill(C.rect(0, floorY, W, H - floorY), 'sand', (x, y) => {
        const n = Math.sin(x * 0.09 + y * 0.05) + Math.sin(x * 0.031 - y * 0.12 + 2) * 0.8;
        return n > 0.55 ? 2 + (y - floorY) * 0.01 - ((y * 0.9 + x * 0.25) % 3 < 0.8 ? 0.6 : 0) : null;
      }, 1);
      // The colossus.
      colossusSeated(p, gx, floorY, 62 * u, 2, 3.8);
      // The roof and its beam, the crack the sun comes through.
      p.fill(C.rect(0, 0, W, 8 * u), 'stone', 0.9, 3);
      p.masonry(C.rect(0, 0, W, 8 * u), { bw: 20 * u, bh: 8 * u, joint: -0.8, vary: 0.5, seed: 53, z: 3 });
      p.fill(C.rect(0, 8 * u, W, 6 * u), 'stone', 1.8, 3);
      p.fill(C.rect(0, 14 * u - 1, W, 1), 'stone', 3, 3);
      crack(p, 61 * u, 0, 8 * u, u);
      // The columns either side, in front, with braziers at their feet.
      column(p, 6 * u, 14 * u, H + 4 * u, 22 * u, 4, 2, 54);
      column(p, W - 6 * u, 14 * u, H + 4 * u, 22 * u, 4, 2, 55);
      const b1 = brazier(p, 25 * u, 116 * u, u, 5); const b2 = brazier(p, W - 25 * u, 116 * u, u, 5);
      // The shaft: in at the crack, across the colossus's face, down to the heap it has poured.
      const sh = shaft(p, 61 * u, 8 * u, floorY + 2 * u, 5 * u, 9 * u, 5.2, 18 * u);
      sandHeap(p, sh.x1, floorY + 3 * u, 9 * u, 4 * u, 6, 3.6);
      p.light(sh.x1, floorY + 1 * u, 16 * u, 4, null, { zMin: 6, zMax: 6 });
      // The shaft's glow thrown back onto the colossus round it.
      p.light(gx + 2 * u, 62 * u, 30 * u, 2, null, { zMin: 2, zMax: 2 });
      for (const [x, y] of [b1, b2]) {
        p.light(x, y, 40 * u, 5.4, null, { zMin: 1, hard: true });
        p.light(x, y, 64 * u, 1.2, null, { zMin: 1 });
      }
      p.rim(1, 0, 0.8, 4);
      vignette(p, W, H, 1.6, 0.5, -1);
      return {
        p,
        over(img) {
          for (const [x, y] of [b1, b2]) sprite(img, Math.round(x), Math.round(y), SPRITES.flame[x < gx ? 0 : 1], FLAME_C);
          // Sand sifting down the shaft, caught in the light.
          for (let k = 0; k < 14; k += 1) {
            const y = 10 * u + hash(k, 0, 61) * (floorY - 12 * u); const x = 61 * u + SLANT * (y - 8 * u) + (hash(k, 1, 61) - 0.5) * 2 * u;
            put(img, x, y, k % 3 ? '#F4C26C' : '#FEF4C8', 0.85);
          }
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['beam', 'dark', 'sky', 'sun'] });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const far = 80 * u; const floor = 91 * u; const top = 12 * u;
      // The back wall, two bands of carved figures along it.
      // (A step lighter than the near columns, for depth: the far end of the hall holds the dust and the light.)
      p.fill(C.rect(0, 0, W, far), 'stone', 1.7, 1);
      p.masonry(C.rect(0, 0, W, far), { bw: 12 * u, bh: 7 * u, joint: -0.7, top: 0.3, left: 0.2, vary: 0.5, chip: 0.03, seed: 61, z: 1 });
      for (const by of [24 * u, 56 * u]) {
        p.shade(C.rect(0, by - 1, W, 1), 0.8, 1); p.shade(C.rect(0, by + 7 * u, W, 1), 0.8, 1);
        for (let x = 1, k = 0; x < W; x += Math.max(3, 3.6 * u), k += 1) {
          if (hash(k, Math.round(by), 63) < 0.2) continue;
          p.shade(C.rect(x, by + 1.2 * u, 1, 1), -1, 1); p.shade(C.rect(x, by + 2.6 * u, 1, 3 * u), -1, 1);
          p.shade(C.rect(x + 1, by + (hash(k, 1, 63) < 0.5 ? 2.6 : 4) * u, 1, 1), -1, 1);
        }
      }
      // The floor: flags, sand drifted over them.
      p.fill(C.rect(0, far, W, H - far), 'stone', 1.8, 1);
      p.floor(C.rect(0, far, W, H - far), { vx: gx, vy: far - 22 * u, rows: 4, size: 1, d0: 22 * u, joint: -1.1, top: 0.45, vary: 0.7, seed: 64, z: 1 });
      p.fill(C.rect(0, far, W, H - far), 'sand', (x, y) => {
        const n = Math.sin(x * 0.05 / u + y * 0.04 / u) + Math.sin(x * 0.019 / u - y * 0.1 / u + 2) * 0.8;
        return n > 0.6 ? 2.1 - ((y * 0.9 + x * 0.25) % (3 * u) < u ? 0.6 : 0) : null;
      }, 1);
      // The far door, and what is beyond it.
      const door = farDoor(p, gx, 36 * u, far, u, 2);
      if (open) {
        // The sunset beyond: an orange sky deepening upward, the sun a crisp disc on the dunes.
        p.fill(door, 'sky', (x, y) => 1.1 + 0.3 * clamp((y - 36 * u) / (far - 36 * u), 0, 1), 3);
        p.fill(C.circle(gx, far - 6 * u, 6.5 * u, 28), 'sun', 2.4, 3);
        p.fill(C.circle(gx - 1.5 * u, far - 7.5 * u, 3.2 * u, 16), 'sun', 3.2, 3);
        p.fill(door, 'haze', (x, y) => (y > far - 4 * u + Math.sin(x * 0.9 / u) * u ? 1.1 : null), 3);
      } else {
        p.fill(door, 'beam', (x, y) => 2.6 + 2.8 * clamp((y - 36 * u) / (far - 36 * u), 0, 1) ** 1.4 * (1 - 0.5 * Math.abs(x + 0.5 - gx) / (8 * u)), 3);
      }
      // The colossi either side of it.
      colossusSeated(p, gx - 27 * u, far, 48 * u, 2, 3.4, 1);
      colossusSeated(p, gx + 27 * u, far, 48 * u, 2, 3.4, 1);
      p.light(gx, far - 4 * u, 34 * u, open ? 3 : 1.8, null, { zMin: 2, zMax: 2 }); // the door's glow on the colossi
      // Columns: smaller ones further back between the near ones, which stand right in front.
      for (let d = 98; d < W / u; d += 88) for (const m of [-1, 1]) column(p, gx + m * d * u, 18 * u, far + 4 * u, 8 * u, 2, 2.8, 66 + d);
      // The roof, its architrave, the cracks.
      p.fill(C.rect(0, 0, W, 8 * u), 'stone', 0.8, 3);
      p.masonry(C.rect(0, 0, W, 8 * u), { bw: 22 * u, bh: 8 * u, joint: -0.8, vary: 0.5, seed: 67, z: 3 });
      p.fill(C.rect(0, 8 * u, W, 4 * u), 'stone', 1.7, 3);
      p.fill(C.rect(0, top - 1, W, 1), 'stone', 2.8, 3);
      for (let d = 54; d < W / u + 20; d += 88) for (const m of [-1, 1]) column(p, gx + m * d * u, top, floor + 3 * u, 12 * u, 4, 1.1, 68 + d);
      // The near columns' edges, rimmed by the shafts either side of them.
      p.rim(1, 0, 2.2, 4); p.rim(-1, 0, 1.4, 4);
      // The shafts: two across the colossi's faces, more out along the hall, some with sand pouring down them.
      const shafts = [[32.6, 4, 7, 4.6, false], [-21.4, 4, 7, 4.6, false]];
      for (let d = 120; d < W / u; d += 88) shafts.push([d, 3.5, 8, 4.2, true], [-d + 12, 3.5, 8, 4.2, true]);
      const falls = [];
      for (const [d, w0, w1, k, sand] of shafts) {
        const x0 = gx + d * u; if (x0 < -20 * u || x0 > W + 30 * u) continue;
        crack(p, x0, 0, 8 * u, u);
        const s = shaft(p, x0, 8 * u, floor, w0 * u, w1 * u, open ? k + 0.8 : k, 12 * u);
        if (sand) { sandHeap(p, s.x1, floor + 1 * u, 7 * u, 3.2 * u, 5, 3.4); falls.push([x0, s.x1]); }
      }
      // Braziers between the colossi and the columns.
      const flames = [brazier(p, gx - 45 * u, floor, u, 5), brazier(p, gx + 45 * u, floor, u, 5)];
      for (const [x, y] of flames) {
        p.light(x, y, 38 * u, 5.2, flicker(x, 0.16), { zMin: 1, hard: true });
        p.light(x, y, 60 * u, 1.2, null, { zMin: 1 });
        // Firelight up the colossus beside it: knees, hands, the arm.
        p.light(x + (x < gx ? 6 : -6) * u, y, 34 * u, 3.4, flicker(x, 0.16), { zMin: 2, zMax: 2, hard: true });
      }
      // Each colossus's face and chest in its own shaft.
      for (const m of [-1, 1]) p.light(gx + m * 27 * u, far - 41 * u, 10 * u, 2.8, null, { zMin: 2, zMax: 2 });
      // The door's glow spilling onto the floor in front of it.
      p.light(gx, far, 36 * u, 2.4, null, { zMin: 1, zMax: 1, sy: 0.45 });
      // The card, in the aisle, against the far door.
      const fy = floor;
      if (cat === 'monster') {
        const w = worm(p, gx, fy + 1 * u, 40 * u, ramp, 8);
        p.backlit(8, 'beam', 1.4, 'stone', 9.4);
        p.fill(C.poly([[gx - 6 * u, fy + 3 * u], [gx - 2 * u, fy - 2 * u], [gx + 4 * u, fy - 3 * u], [gx + 16 * u, fy + 3 * u]]), 'sand', 3.4, 9);
        for (const [dx, dy] of [[-10, 1], [12, 0.5], [-4, 2]]) p.fill(C.rect(gx + dx * u, fy + dy * u - 1.5 * u, 4 * u, 2 * u), 'stone', 2.2, 9);
        p.tint(w.hx, w.hy - 2 * u, 7 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const l = traveller(p, gx, fy, 32 * u, 8, ramp);
        p.backlit(8, 'beam', 1.4, 'stone', 9.4);
        // The lantern: small and bright; its pool on the floor round the figure, the figure itself left in clean bands.
        p.light(l.lx, fy, 12 * u, 2.6, flicker(0.9, 0.15), { zMin: 1, zMax: 7, sy: 0.5 });
        p.tint(l.lx, l.ly, 3 * u, CARD[ramp][3], 0.5, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        p.fill(C.rect(gx - 8 * u, fy - 9 * u, 16 * u, 9 * u), 'stone', 2.4, 7);
        p.fill(C.rect(gx - 9 * u, fy - 10 * u, 18 * u, 1.4 * u), 'stone', 4, 7);
        const m = urn(p, gx, fy - 9.5 * u, 15 * u, 8, ramp, 0.08, ramp, 1.3, null);
        p.tint(m[0], m[1] - 1 * u, 12 * u, hex, 0.6, flicker(2, 0.15, 0.7));
        p.tint(gx, fy - 4 * u, 20 * u, CARD[ramp][2], 0.35, flicker(2.4, 0.2, 0.7));
      } else if (cat === 'obstacle') {
        const glow = fallenDrums(p, gx, fy, u, 8, ramp);
        p.backlit(8, 'beam', 1.4, ramp, 2.6);
        for (const [x, y] of glow.filter((_, k) => k % 3 === 1)) p.tint(x, y, 3 * u, CARD[ramp][2], 0.25, flicker(x, 0.2, 0.8));
        p.tint(gx, fy + 3 * u, 12 * u, CARD[ramp][2], 0.15, flicker(0.5, 0.12, 0.6));
        // Sand pouring onto it through a hole in the roof.
        crack(p, gx + 6 * u, 0, 8 * u, u);
        shaft(p, gx + 6 * u, 8 * u, fy - 6 * u, 3 * u, 5 * u, 3.4);
        falls.push([gx + 6 * u, gx + 6 * u + SLANT * (fy - 14 * u)]);
      } else if (open) {
        // The sunset outside, pouring in down the aisle.
        p.light(gx, floor, 56 * u, 5.4, flicker(0.2, 0.06, 0.4), { zMin: 1, sy: 0.36 });
        p.light(gx, far - 6 * u, 30 * u, 2.4, null, { zMin: 2, zMax: 2 });
        p.tint(gx, floor + 2 * u, 22 * u, CARD.path[3], 0.25, flicker(0.2, 0.08, 0.4));
      }
      vignette(p, W, H, 1.3, 0.45, -1);
      return {
        p,
        over(img, t) {
          flames.forEach(([x, y], i) => sprite(img, Math.round(x), Math.round(y), SPRITES.flame[Math.floor(t * 8 + i) % 3], FLAME_C));
          for (const [x0, x1] of falls) {
            for (const q of particles('drip', 9, [0, 8 * u, 1, floor - 9 * u], t, Math.round(x0))) {
              const f = (q.y - 8 * u) / (floor - 8 * u);
              put(img, lerp(x0, x1, f) + (q.i % 3) - 1, q.y, q.i % 2 ? '#F4C26C' : '#D08C46', 0.9);
            }
          }
          for (const q of particles('mote', Math.round(W / 10), [0, 12 * u, W, floor - 14 * u], t, 69)) {
            if (p.v[Math.round(q.y) * W + Math.round(q.x)] > 5) put(img, q.x, q.y, '#FDDC96', q.a * 0.8);
          }
          if (open) for (const q of particles('mote', 16, [gx - 16 * u, far + 1 * u, 32 * u, floor - far], t, 71)) put(img, q.x, q.y, q.big ? '#FEF4C8' : '#F4C26C', q.a);
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 8 * u, fy - 30 * u, 16 * u, 20 * u], t, 73)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['beam', 'dark'] });
      const u = H / 250;
      // The floor: big flags in perspective, drifts of sand across them.
      p.fill(C.rect(0, 0, W, H), 'stone', 1.6, 1);
      p.floor(C.rect(0, 0, W, H), { vx: W / 2, vy: -90 * u, rows: 3.2, size: 1.1, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.25, vary: 0.8, chip: 0.04, seed: 71, z: 1 });
      // Drifts: long tongues of sand across the flags, rippled, their far edges catching the light from the hall.
      // Sand over most of it; the flags show where the draught has swept them bare.
      const dn = (x, y) => Math.sin(x * 0.022 + y * 0.012) + 0.8 * Math.sin(x * 0.009 - y * 0.045 + 2) + 0.3 * Math.sin(x * 0.07 + y * 0.03 + 1);
      p.fill(C.rect(0, 0, W, H), 'sand', (x, y) => {
        const n = dn(x, y);
        if (n < -0.35) return null;
        const rp = (y + Math.sin(x * 0.045 + y * 0.01) * 4 + x * 0.18) / (3.6 + y * 0.012);
        return 1.9 + Math.min(0.6, (n + 0.35) * 0.5) - (rp - Math.floor(rp) < 0.24 ? 0.7 : 0) + (dn(x, y + 2) < -0.35 ? 1 : 0);
      }, 1);
      // The far end's glow along the top, under the vista.
      p.light(W / 2, -24 * u, 180 * u, 2.8, flicker(0.7, 0.06, 0.5), { sx: 1.7 });
      // A shaft of gold at each edge, sand sifting down it to a heap.
      // (Seen from above, the parallel shafts lean apart, away from the middle.)
      const sh = [[-8, 0.13], [W + 8, -0.13]].map(([x, sl]) => ({ ...shaft(p, x, -4, H * 0.7, 16, 30, 5.6, 0, sl, 0.75), sl, x0: x }));
      for (const s of sh) {
        p.light(s.x1, s.y1, 18, 4.6, null, { zMin: 1, sy: 0.4 });
        sandHeap(p, s.x1, s.y1 + 4, 11, 5, 2, 2.6);
      }
      p.shade(null, (x, y) => -2 * Math.max(0, y / H - 0.36));
      return {
        p,
        over(img, t) {
          for (const s of sh) {
            for (const q of particles('drip', 10, [0, 0, 1, s.y1], t, Math.round(s.x0))) put(img, s.x0 + s.sl * q.y + (q.i % 3) - 1, q.y, q.i % 2 ? '#F4C26C' : '#B26E2C', 0.85);
            for (const q of particles('mote', 10, [-5, 0, 10, s.y1], t, Math.round(s.x0) + 3)) put(img, s.x0 + s.sl * q.y + q.x, q.y, '#DE9A44', q.a * 0.7);
          }
          for (const q of particles('dust', 30, [20, 40, W - 40, H * 0.5], t, 75)) put(img, q.x, q.y, '#4A2C19', q.a * 0.6);
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B, DC]);
})();

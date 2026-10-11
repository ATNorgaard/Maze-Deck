/* New setting, the High Road: a mountain pass in a summer storm, and the cave under it. */
import PX from '../px.js';

  const { C, Painter, put, flicker, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => v - Math.floor(v);
  /** Smooth noise, 0..1, in one and two dimensions, and a few octaves of it. */
  const n1 = (x, s = 0) => { const i = Math.floor(x); return lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(x - i)); };
  const n2 = (x, y, s = 0) => {
    const i = Math.floor(x); const j = Math.floor(y); const fx = smooth(x - i); const fy = smooth(y - j);
    return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), fx), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), fx), fy);
  };
  const fbm = (x, y, s) => n2(x, y, s) * 0.55 + n2(x * 2.1, y * 2.1, s + 7) * 0.3 + n2(x * 4.3, y * 4.3, s + 13) * 0.15;

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

  /** A one-pixel line into the painter. */
  function line(p, x0, y0, x1, y1, ramp, v, z) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const ri = p.ri(ramp);
    for (let k = 0; k <= n; k += 1) {
      const x = Math.round(lerp(x0, x1, k / n)); const y = Math.round(lerp(y0, y1, k / n));
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const i = y * p.w + x; p.r[i] = ri; p.v[i] = typeof v === 'function' ? v(x, y) : v; p.z[i] = z;
    }
  }
  /** A one-pixel line onto the snapped picture. */
  function lineImg(img, x0, y0, x1, y1, hex, a = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k += 1) put(img, lerp(x0, x1, k / n), lerp(y0, y1, k / n), hex, a);
  }

  /* ---------- the storm ---------- */

  /**
   * A bolt of lightning from (x0, y0) to (x1, y1): a trunk that zigzags by
   * midpoint displacement, and a few forks off it. Returns its segments.
   */
  function boltPath(x0, y0, x1, y1, seed, o = {}) {
    const r = rng(seed); const jag = o.jag ?? 0.32;
    let pts = [[x0, y0], [x1, y1]];
    for (let pass = 0; pass < (o.passes ?? 4); pass += 1) {
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i += 1) {
        const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i];
        const len = Math.hypot(bx - ax, by - ay);
        out.push([(ax + bx) / 2 + (r() - 0.5) * len * jag * 2, (ay + by) / 2 + (r() - 0.5) * len * 0.15], [bx, by]);
      }
      pts = out;
    }
    const segs = [pts];
    for (let f = 0; f < (o.forks ?? 2); f += 1) {
      const at = 2 + Math.floor(r() * (pts.length * 0.6));
      const [sx, sy] = pts[at]; const m = r() < 0.5 ? -1 : 1; const len = Math.hypot(x1 - x0, y1 - y0) * (0.18 + r() * 0.2);
      const fork = [[sx, sy]];
      let fx = sx; let fy = sy;
      for (let k = 0; k < 5; k += 1) { fx += m * len * (0.06 + r() * 0.16); fy += len * (0.12 + r() * 0.1); fork.push([fx, fy]); }
      segs.push(fork);
    }
    return segs;
  }
  function boltInto(p, segs, ramp, z, v = 5) {
    segs.forEach((s, k) => { for (let i = 1; i < s.length; i += 1) line(p, s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], ramp, k ? v - 1.4 : v, z); });
  }
  function boltOnto(img, segs, a = 1) {
    segs.forEach((s, k) => {
      for (let i = 1; i < s.length; i += 1) {
        if (!k) { lineImg(img, s[i - 1][0] + 1, s[i - 1][1], s[i][0] + 1, s[i][1], '#7F96B8', a * 0.5); lineImg(img, s[i - 1][0] - 1, s[i - 1][1], s[i][0] - 1, s[i][1], '#7F96B8', a * 0.35); }
        lineImg(img, s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], k ? '#B6C8DE' : '#FFFFFF', a);
      }
    });
  }

  /** A strike every `per` seconds: a bright flash, a dimmer re-strike, a fade. 0 between. */
  const strike = (per, ph) => (t) => {
    const f = ((t + ph) % per + per) % per;
    if (f < 0.07) return 1;
    if (f < 0.13) return 0.25;
    if (f < 0.2) return 0.85;
    if (f < 0.9) return 0.5 * Math.exp(-(f - 0.2) * 6);
    return 0;
  };
  const striking = (per, ph, t) => { const f = ((t + ph) % per + per) % per; return f < 0.07 || (f >= 0.13 && f < 0.2); };

  /**
   * The storm sky. A ceiling of dark cloud hangs over everything, its lower
   * edge lumpy and lifted over the break, where the storm light comes
   * through: pale, brightest at (gx, gy), irregular. Long dark bands of
   * cloud cross the break. Wherever a cloud is thin, at its edges, it glows
   * with the light behind it, so every edge near the break is silvered.
   * Rain hangs in slanting curtains from the ceiling at the sides.
   * bands: [cx, cy, half-length, thickness] in pixels.
   */
  function stormSky(p, W, y1, o) {
    const { u, gx, gy, grx, gry, seed = 1 } = o;
    const S = p.ri(o.ramp || 'sky');
    const top = o.top ?? 1.2; const hor = o.hor ?? 6; const gk = o.gk ?? 6;
    const gapAt = (x, y) => {
      const a = Math.atan2(y - gy, (x - gx) * 0.5);
      const wob = (n1(a * 2.2 + 4, seed + 3) - 0.5) * 0.7;
      return clamp(1 - Math.hypot((x - gx) / grx, (y - gy) / gry) * (1 + wob), 0, 1);
    };
    const cw = (o.ceilW ?? 80) * u;
    const ceil = new Float32Array(W);
    for (let x = 0; x < W; x += 1) {
      const g = smooth(clamp(1 - Math.abs(x + 0.5 - gx) / cw, 0, 1));
      const base = lerp(o.ceilSide * u, o.ceilGap * u, g);
      const lobes = -Math.abs(Math.sin((x + 0.5) / (4.2 * u) + n1(x / (24 * u), seed + 4) * 7)) * 2.6 * u;
      ceil[x] = base + (n1(x / (11 * u), seed + 1) - 0.5) * 8 * u + lobes + (n1(x / (3 * u), seed + 2) - 0.5) * 1.5 * u;
    }
    const bands = (o.bands || []).map(([cx, cy, hl, th], k) => ({ cx, cy, hl, th, k }));
    const lineW = (o.lining ?? 1.3) * u;
    const kind = new Uint8Array(W * p.h);
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const cx = x + 0.5; const cy = y + 0.5;
      const g = gapAt(cx, cy);
      const sky = Math.round(lerp(top, hor, clamp(cy / y1, 0, 1) ** 1.4) + gk * g ** (o.gp ?? 0.8));
      p.r[i] = S; p.z[i] = 0;
      // The ceiling.
      const d = ceil[x] - cy;
      if (d > 0) {
        const billow = fbm(cx / (9 * u), cy / (3.6 * u), seed + 9);
        let v = (o.cloud ?? 2.2) - Math.min(1, d / (16 * u)) + (billow > 0.56 ? 0.6 : billow < 0.4 ? -0.4 : 0) + sky * 0.1;
        kind[i] = 1;
        if (d < lineW) { v = Math.max(v, sky * 0.9 + 0.6); kind[i] = 2; } else if (d < lineW * 2) v = Math.max(v, sky * 0.45 + 0.6);
        p.v[i] = Math.round(v * 2) / 2; return;
      }
      // The bands across the break.
      for (const c of bands) {
        const f = (cx - c.cx) / c.hl;
        if (Math.abs(f) >= 1) continue;
        const prof = Math.sqrt(1 - f * f);
        const lump = 0.6 + 0.4 * n1(cx / (3 * u), seed + 11 + c.k * 3) + 0.35 * n1(cx / (9 * u), seed + 12 + c.k);
        const tp = c.cy - c.th * prof * lump; const bt = c.cy + c.th * prof * 0.45 * (0.7 + 0.6 * n1(cx / (6 * u), seed + 13 + c.k));
        if (cy < tp || cy > bt) continue;
        const into = Math.min(cy - tp, bt - cy);
        let v = (o.band ?? 2.4) + sky * 0.12;
        kind[i] = 1;
        if (into < lineW) { v = sky * 0.92 + 0.8; kind[i] = 2; } else if (into < lineW * 2) v = sky * 0.5 + 0.6;
        p.v[i] = Math.round(v * 2) / 2; return;
      }
      p.v[i] = sky;
    });
    // Rain hanging in curtains from the ceiling, slanting with the wind, dark against the light.
    if (o.curtains) {
      p.shade(C.rect(0, 0, W, y1), (x, y) => {
        if (y < ceil[x]) return 0;
        const m = n1(x / (o.curtains * u), seed + 5) * (0.5 + 0.5 * clamp(Math.abs(x - gx) / cw, 0, 1));
        if (m < 0.38) return 0;
        const band = frac((x - y * 0.3) / (2.4 * u) + n1(y / (6 * u), seed + 6) * 0.6) < 0.45 ? 1 : 0;
        return -(m - 0.38) * 5 * (0.35 + 0.65 * band) * clamp((y - ceil[x]) / (8 * u), 0, 1);
      }, 0);
    }
    return { ceil, gapAt, kind };
  }

  /** Rain: short slanting streaks blown right, falling fast. */
  function rain(img, W, H, t, n, o = {}) {
    const r = rng(o.seed || 7); const u = o.u || 1; const sl = o.slant ?? 0.3; const len = (o.len ?? 3.5) * u;
    for (let k = 0; k < n; k += 1) {
      const bx = r() * W * 1.3; const by = r() * H; const sp = 0.7 + r() * 0.6;
      const vy = (o.speed ?? 110) * u * sp;
      const y = (by + t * vy) % (H + len) - len; const x = ((bx + y * sl + t * vy * sl * 0.1) % (W * 1.3)) - W * 0.15;
      if (o.mask && !o.mask(x, y)) continue;
      const a = (o.a ?? 0.5) * (0.5 + 0.5 * sp);
      for (let s = 0; s < len; s += 1) put(img, x + s * sl, y + s, s < len * 0.5 ? (o.dim || '#61758B') : (o.hex || '#90A3B6'), a * (0.5 + s / len * 0.5));
    }
  }

  /* An eagle seen from below, gliding: two frames, wings level and wings tipped. */
  const EAGLE = [['aa.....aa', '.aaa.aaa.', '...aaa...', '....a....'], ['.........', 'aaa...aaa', '.aaaaaaa.', '....a....']];
  function eagles(img, list, t, hex = '#0E1217') {
    for (const [cx, cy, rx, ry, ph, sp] of list) {
      const a = t * sp + ph; const x = cx + Math.cos(a) * rx; const y = cy + Math.sin(a) * ry;
      const rows = EAGLE[Math.floor(t * 1.5 + ph) % 2];
      for (let r = 0; r < rows.length; r += 1) for (let c = 0; c < rows[r].length; c += 1) if (rows[r][c] !== '.') put(img, x - 4 + c, y - 2 + r, hex);
    }
  }

  /* ---------- the granite ---------- */

  /**
   * Granite: blocky, jointed in sheets, each block lit on the side toward
   * the light; wet streaks down the fall line, a dark stain and a bright
   * sheen beside it; olive moss along the ledges.
   */
  function granite(p, shape, o) {
    const u = o.u; const z = o.z;
    p.cells(shape, { size: o.size * u, sx: o.sx ?? 1.35, sy: o.sy ?? 0.72, joint: o.joint ?? 0.85, jointV: o.jointV ?? -1.3, vary: o.vary ?? 0.9, bevel: o.bevel ?? 0.7, lit: o.lit || [-0.5, -0.8], seed: o.seed, z });
    if (o.wet) {
      const per = (o.wetPer ?? 9) * u;
      p.shade(shape, (x, y) => {
        const c = Math.floor(x / per); const xs = c * per + hash(c, 0, o.seed) * per * 0.6 + n1(y / (7 * u), c) * 1.6 * u;
        const on = hash(c, 1, o.seed) < 0.55 && n1(y / (14 * u), c + 3) > 0.35;
        if (!on) return 0;
        const d = x + 0.5 - xs;
        return d >= 0 && d < 1 ? o.wet : d >= 1 && d < 2.2 * u ? -0.7 : 0;
      }, z);
    }
  }
  /**
   * A granite face's big structure: buttresses between vertical joints, each
   * with a lit plane and a shadowed one, crossed by sheeting ledges whose
   * tops catch the light. Small blocks (granite()) go on top of this.
   */
  function buttresses(p, shape, o) {
    const u = o.u; const z = o.z; const bw = o.bw * u; const seed = o.seed || 1; const lh = (o.lh ?? 9) * u;
    const lit = o.lit ?? 2; const dark = o.dark ?? -1; const crack = o.crack ?? -2; const ledge = o.ledge ?? 2;
    p.each(shape, (x, y, i) => {
      if (p.z[i] !== z) return;
      const xs = x + 0.5 + (n1(y / (7 * u), seed) - 0.5) * 3 * u + (y * (o.lean ?? 0));
      const c = Math.floor(xs / bw); const f = (xs - c * bw) / bw;
      const split = 0.35 + hash(c, 0, seed) * 0.35;
      let dv = f < split ? lit * (0.6 + 0.4 * hash(c, 1, seed)) : dark;
      if (f * bw < 1 || (f > split && (f - split) * bw < 0.8)) dv = f * bw < 1 ? crack : dv - 0.4;
      // Sheeting: long ledges running across the face, stepping a little at each joint.
      const yy = y + 0.5 + (o.sheets ? (hash(c, 2, seed) - 0.5) * 2 * u + (x - c * bw) * (o.dip ?? 0) : hash(c, 2, seed) * lh);
      const ly = yy / lh; const lf = (ly - Math.floor(ly)) * lh;
      if (hash(o.sheets ? Math.floor(x / (bw * 3)) : c, Math.floor(ly), seed + 3) < (o.ledges ?? 0.55)) {
        if (lf < 1) dv += ledge; else if (lf < 2.2 * u) dv -= 1.1;
      }
      p.v[i] += dv;
    });
  }

  /**
   * Setts in perspective: rough squared stones laid in rows that widen toward
   * us, each nearest-point cell a stone, the joints dark between them, each
   * stone's far edge catching the sky, a few wet tops glinting.
   */
  function setts(p, shape, o) {
    const seed = o.seed || 7;
    p.each(shape, (x, y, i) => {
      if (o.z !== undefined && p.z[i] !== o.z) return;
      const d = y + 0.5 - o.vy; if (d <= 0) return;
      const Y = Math.log(d / o.d0) * o.rows; const X = ((x + 0.5 - o.vx) / d) * o.cols;
      const sx = d / o.cols; const sy = d / o.rows;
      const gx = Math.floor(X); const gy = Math.floor(Y);
      let d1 = 1e9; let d2 = 1e9; let best = 0; let byY = 0;
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          const cy = gy + j; const cx = gx + k + (cy % 2 ? 0.5 : 0);
          const px = cx + 0.25 + hash(Math.floor(cx * 2), cy, seed) * 0.5; const py = cy + 0.25 + hash(Math.floor(cx * 2), cy, seed + 1) * 0.5;
          const dd = Math.hypot((X - px) * sx, (Y - py) * sy);
          if (dd < d1) { d2 = d1; d1 = dd; best = Math.floor(cx * 2) * 7349 + cy; byY = (Y - py); } else if (dd < d2) d2 = dd;
        }
      }
      let dv;
      if (d2 - d1 < (o.joint ?? 1.2)) dv = o.jointV ?? -1.2;
      else {
        dv = (hash(best, 0, seed + 2) - 0.5) * (o.vary ?? 0.8) + (byY < -0.3 ? 0.8 : byY > 0.3 ? -0.3 : 0);
        if (byY < -0.1 && hash(best, 3, seed) < (o.wet ?? 0.14)) dv += 1;
      }
      p.v[i] += dv;
    });
  }

  /** Snap a layer's values to whole steps, so its light falls off in clean bands, not dither. */
  function quant(p, z, step = 1) {
    for (let i = 0; i < p.v.length; i += 1) if (p.z[i] === z) p.v[i] = Math.round(p.v[i] / step) * step;
  }

  /** Moss and grass on the ledges: olive tufts where a block's top edge meets the joint above. */
  function moss(p, shape, o) {
    const G = p.ri('grass'); const R = p.ri('rock'); const z = o.z; const W = p.w;
    const hits = [];
    p.each(shape, (x, y, i) => {
      if (y < 1 || p.z[i] !== z || p.r[i] !== R) return;
      const above = i - W;
      if (p.v[above] < p.v[i] - 0.9 && hash(x >> 1, y, o.seed) < (o.k ?? 0.35) && n2(x / (8 * o.u), y / (5 * o.u), o.seed) > (o.thresh ?? 0.45)) hits.push([i, above]);
    });
    for (const [i, a] of hits) { p.r[i] = G; p.v[i] = o.v + (hash(i, 2, 3) < 0.5 ? 0.6 : 0); if (hash(i, 3, 3) < 0.6) { p.r[a] = G; p.v[a] = o.v + 0.8; p.z[a] = z; } }
  }

  /** A ridge line: peaks at a steady-ish pitch, each a steep blocky summit. Returns the top y for each column. */
  function ridge(W, u, o) {
    const r = rng(o.seed); const pk = [];
    for (let x = -40 * u + r() * o.gap * u; x < W + 40 * u; x += o.gap * (0.6 + r() * 0.8) * u) pk.push([x, (o.y0 + r() * (o.y1 - o.y0)) * u, o.sl * (0.7 + r() * 0.6), o.sl * (0.7 + r() * 0.6)]);
    const top = new Float32Array(W); const own = new Int16Array(W);
    for (let x = 0; x < W; x += 1) {
      let best = o.base * u; let bi = 0;
      pk.forEach(([px, py, sl, sr], k) => {
        const dx = x + 0.5 - px; const y = py + Math.abs(dx) * (dx < 0 ? sl : sr);
        if (y < best) { best = y; bi = k; }
      });
      // Blocky steps, like jointed granite, not smooth slopes.
      const st = (o.step ?? 2.5) * u;
      top[x] = Math.round(best / st) * st + (n1(x / (3 * u), o.seed + 3) - 0.5) * 2 * u; own[x] = bi;
    }
    top.own = own; top.peaks = pk;
    return top;
  }

  /**
   * Crags: each summit of a ridge drops an arête down the face; the side of
   * it facing the light at lx is lit, scored by dark gullies down the fall
   * line; the other side is in shadow, streaked where wet rock catches the
   * sky. Big clean planes, the way rock reads at this size.
   */
  function crags(p, top, o) {
    const u = o.u; const z = o.z; const lx = o.lx; const seed = o.seed || 1;
    p.each(C.rect(0, 0, p.w, p.h), (x, y, i) => {
      if (p.z[i] !== z) return;
      const k = top.own[x]; const [px, py] = top.peaks[k];
      const h = y + 0.5 - py; if (h < 0) return;
      const lean = (hash(k, 4, seed) - 0.5) * 0.5;
      const ax = px + h * lean + (n1(h / (5 * u), k + seed) - 0.5) * 5 * u * Math.min(1, h / (6 * u));
      const lit = px > lx ? x + 0.5 < ax : x + 0.5 > ax;
      const d = Math.abs(x + 0.5 - ax);
      const fade = clamp(1 - h / (o.depth * u), 0.2, 1);
      let dv = lit ? o.lit * fade : o.shade;
      if (d < 1) dv += lit ? 1.4 : 0.8;
      else if (lit && d < 22 * u && frac((x - ax) / (5.5 * u) + n1(y / (6 * u), k + 7) * 0.7) < 0.14 && n1(y / (9 * u), k + 9) > 0.32) dv -= 1.6;
      else if (!lit && frac((x - ax) / (7 * u) + n1(y / (8 * u), k + 11) * 0.6) < 0.08 && n1(y / (11 * u), k + 13) > 0.4) dv += 1.2;
      // A ledge here and there, its top catching the light.
      const ly = Math.floor((y + hash(Math.floor(x / (9 * u)), 0, seed) * 6 * u) / (6 * u));
      if (hash(Math.floor(x / (9 * u)), ly, seed + 5) < 0.16 && frac((y + hash(Math.floor(x / (9 * u)), 0, seed) * 6 * u) / (6 * u)) < 0.17) dv += lit ? 1.6 : 1;
      p.v[i] += dv;
    });
  }

  /* ================= A: the High Road ================= */

  const RAMPS_A = {
    sky: ['#06080C', '#0A0D13', '#0F131B', '#151B25', '#1C2430', '#242E3C', '#2D3949', '#374557', '#435367', '#506278', '#61758B', '#768A9F', '#90A3B6', '#AFC0CF', '#D2DDE7', '#F0F5F9'],
    rock: ['#050606', '#090B0B', '#0E1110', '#141816', '#1B201D', '#232925', '#2D342F', '#38403A', '#454E47', '#555E56', '#687169', '#808A82', '#A0A9A4', '#C5CDCB'],
    grass: ['#060805', '#0A0D08', '#10140C', '#161C10', '#1E2615', '#27311A', '#313D20', '#3D4A27', '#4B5A2F', '#5C6B39'],
    pine: ['#030504', '#060908', '#0A0E0C', '#0F1411', '#151B17', '#1C241F'],
    water: ['#070A0D', '#0D1216', '#141B21', '#1D262D', '#28333B', '#36434C', '#47555F', '#5B6A74', '#73838D', '#909FA8', '#B2BFC6', '#D5DEE3', '#F2F6F8'],
    wood: ['#0A0807', '#13100D', '#1D1814', '#28211B', '#352C23', '#43382C', '#544636', '#675641', '#7D6A51', '#968265'],
    rope: ['#0D0B08', '#1A160F', '#292216', '#3A301F', '#4D402A', '#625236', '#7A6744', '#958053'],
    cloth: ['#14161A', '#262A30', '#3E444C', '#5E6670', '#8590A0', '#B5BFCB'],
    shadow: ['#020304', '#05070A', '#090C10', '#0E1217', '#141A20'],
    bolt: ['#2A3548', '#4D6080', '#7F96B8', '#B6C8DE', '#E2ECF6', '#FFFFFF'],
    sun: ['#3D2A0E', '#6E4A18', '#A06C26', '#C98C36', '#E3A445', '#F2CB8A', '#FFE7B0', '#FFF6DC'],
    ...CARD,
  };

  /**
   * A rope bridge seen from the side between two points: the deck sagging,
   * its planks' ends ticking along it, a hand rope above with the hangers
   * down to the deck, a post at each end.
   */
  function span(p, x0, y0, x1, y1, o) {
    const { u, z = 5 } = o;
    const sag = o.sag ?? 4 * u; const ph = o.post ?? 5.5 * u;
    const ramp = o.ramp || 'wood'; const rope = o.rope || 'rope';
    const v = o.v ?? 3; const rv = o.rv ?? 3.4;
    const deck = (x) => { const t = clamp((x - x0) / (x1 - x0), 0, 1); return lerp(y0, y1, t) + sag * 4 * t * (1 - t); };
    const hand = (x) => { const t = clamp((x - x0) / (x1 - x0), 0, 1); return lerp(y0, y1, t) - ph + sag * 0.75 * 4 * t * (1 - t); };
    const a = Math.round(Math.min(x0, x1)); const b = Math.round(Math.max(x0, x1));
    const hang = Math.max(2, Math.round(2.6 * u));
    for (let x = a; x <= b; x += 1) {
      const dy = Math.round(deck(x + 0.5)); const hy = Math.round(hand(x + 0.5));
      p.fill(C.rect(x, dy, 1, 1), ramp, v + ((x - a) % 2 ? 0.8 : -0.2), z);
      p.fill(C.rect(x, dy + 1, 1, 1), ramp, v - 1.6, z);
      p.fill(C.rect(x, hy, 1, 1), rope, rv, z);
      if ((x - a) % hang === 0 && x > a && x < b) for (let y = hy + 1; y < dy; y += 1) p.fill(C.rect(x, y, 1, 1), rope, rv - 1.2, z);
    }
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      p.fill(C.rect(Math.round(x) - 1, y - ph - 1, 2, ph + 2), ramp, v - 0.4, z);
      p.fill(C.rect(Math.round(x) - 1, y - ph - 1, 2, 1), ramp, v + 1, z);
    }
    return { deck, hand };
  }

  /**
   * A broken span: the bridge cut, its half hanging from its post and still
   * swinging, the deck angled down into the gorge, planks sticking out of it
   * at all angles, the hand rope trailing slack past its frayed end.
   */
  function broken(p, x0, y0, m, L, o) {
    const { u, z = 5, ramp, seed = 1 } = o;
    const ph = 5 * u;
    const at = (s, k = 0) => { const a = 0.1 + (s / L) * 0.14 + k; return [x0 + m * Math.sin(a) * s, y0 + Math.cos(a) * s]; };
    if (o.post !== false) {
      p.fill(C.rect(Math.round(x0) - 1, y0 - ph - 1, 2, ph + 2), ramp, 2, z);
      p.fill(C.rect(Math.round(x0) - 1, y0 - ph - 1, 2, 1), ramp, 3.4, z);
    }
    // The hand rope, slack, from the post's top past the deck's end.
    let prev = [x0, y0 - ph];
    for (let s = 1; s <= L + 5 * u; s += 1) {
      const [x, y] = at(s, -0.12); const q = [x - m * 1.5 * u * Math.sin(s / L * 3), y - ph * (1 - s / L) * 0.6];
      line(p, prev[0], prev[1], q[0], q[1], ramp, 2.4, z); prev = q;
    }
    // The deck, its planks' ends, a few planks hanging askew.
    for (let s = 0; s <= L; s += 0.5) { const [x, y] = at(s); p.fill(C.rect(Math.round(x), Math.round(y), 1, 1), ramp, 2.6, z); p.fill(C.rect(Math.round(x) + m, Math.round(y), 1, 1), ramp, 1.4, z); }
    const step = Math.max(2, 2.4 * u);
    for (let s = step, k = 0; s < L; s += step, k += 1) {
      if (hash(k, 1, seed) < 0.2) continue;
      const [x, y] = at(s); const tw = (hash(k, 2, seed) - 0.5) * 1.2; const len = 2.2 * u;
      line(p, x - m * len * 0.5 * Math.cos(tw), y + len * 0.5 * Math.sin(tw), x + m * len * Math.cos(tw), y - len * Math.sin(tw), ramp, 3.6 - (s / L) * 0.8, z);
    }
    const [ex, ey] = at(L);
    line(p, ex, ey, ex + m * 1.5 * u, ey + 3 * u, ramp, 2, z); // a frayed end
  }

  /** Edges toward a light, brightened: pixels on layer z whose neighbour (dx, dy) is on a lower layer take +f(x, y). */
  function addEdge(p, z, dx, dy, f) {
    const hit = [];
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
        if (p.z[ny * p.w + nx] < z) hit.push([i, x, y]);
      }
    }
    for (const [i, x, y] of hit) p.v[i] += f(x, y);
  }

  /**
   * The sun breaking through: a crisp disc in the gap, the open sky and the
   * cloud linings round it turned to gold in clean steps, the billows dark
   * blue-grey against it, and rays fanning down from it.
   */
  function sunBreak(p, W, sx, sy, u, y1, kind, R = 40) {
    const S = p.ri('sun');
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      if (p.z[i] !== 0) return;
      const d = Math.hypot((x + 0.5 - sx) / 1.3, y + 0.5 - sy) / u;
      if (kind[i] === 0 && d < R * 0.36) { p.r[i] = S; p.v[i] = d < R * 0.14 ? 6.6 : d < R * 0.22 ? 5.6 : d < R * 0.29 ? 4.8 : 4; }
      else if (kind[i] === 2 && d < R) { p.r[i] = S; p.v[i] = d < R * 0.45 ? 6.6 : d < R * 0.7 ? 5.6 : 4.6; }
    });
    p.fill(C.circle(sx, sy, 3.2 * u, 20), 'sun', 7.4, 0);
    p.shade(C.rect(0, 0, W, p.h), (x, y) => {
      if (y < sy + 5 * u) return 0;
      const a = Math.atan2(y - sy, x - sx); const d = Math.hypot((x - sx) / 1.4, y - sy);
      return (frac(a / Math.PI * 11 + 0.15) < 0.34 ? 1.4 : 0) * clamp(1 - d / (90 * u), 0, 1);
    });
  }

  /** The sun on the scene: bright water and lit rock edges near it go gold, in clean steps. */
  function gild(p, shape, f) {
    const S = p.ri('sun'); const Wt = p.ri('water'); const Rk = p.ri('rock'); const Wd = p.ri('wood');
    p.each(shape, (x, y, i) => {
      const k = f(x, y); if (k < 0.2) return;
      const r = p.r[i]; const v = p.v[i];
      if (r === Wt && v > 6) { p.r[i] = S; p.v[i] = clamp(2 + (v - 6) * 0.9 * k + k * 2, 2, 7); }
      else if ((r === Rk || r === Wd) && v > 7.5 - k * 2) { p.r[i] = S; p.v[i] = clamp((v - 4) * 0.8 * k + 1.5, 1, 6); }
    });
  }

  /**
   * The roc, perched with its wings raised and spread like a banner's eagle:
   * fingered primaries up and out, a hooked beak turned left, the tail fanned
   * below its talons. Black, rimmed by the storm light behind it.
   */
  function roc(p, cx, fy, s, z, ramp) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    // Body and legs.
    p.fill(P([[-0.1, 0], [-0.16, -0.18], [-0.2, -0.42], [-0.18, -0.6], [-0.1, -0.7], [0.1, -0.7], [0.18, -0.6], [0.2, -0.42], [0.16, -0.18], [0.1, 0]]), 'shadow', 0.6, z);
    // The head, turned to the left, the hooked beak, the hackles.
    p.fill(P([[-0.1, -0.66], [-0.11, -0.8], [-0.06, -0.88], [0.04, -0.89], [0.1, -0.82], [0.09, -0.68]]), 'shadow', 0.6, z);
    p.fill(P([[-0.08, -0.84], [-0.2, -0.83], [-0.25, -0.79], [-0.24, -0.73], [-0.2, -0.77], [-0.1, -0.76]]), 'shadow', 0.9, z);
    p.fill(P([[0.08, -0.82], [0.16, -0.78], [0.11, -0.74], [0.17, -0.7], [0.1, -0.68]]), 'shadow', 0.6, z);
    // The tail, fanned below.
    p.fill(P([[-0.08, -0.08], [-0.15, 0.16], [-0.05, 0.19], [0, 0.15], [0.05, 0.19], [0.15, 0.16], [0.08, -0.08]]), 'shadow', 0.6, z);
    for (const m of [-1, 1]) {
      // The wing: up and out from the shoulder to the wrist, the primaries fingered at its tip, the trailing edge scalloped back to the flank.
      p.fill(P([[0.14 * m, -0.62], [0.36 * m, -0.86], [0.62 * m, -1.08], [0.86 * m, -1.28], [0.98 * m, -1.44], [1.0 * m, -1.32],
        [1.1 * m, -1.4], [1.08 * m, -1.26], [1.2 * m, -1.3], [1.14 * m, -1.15], [1.28 * m, -1.15], [1.18 * m, -1.02], [1.32 * m, -0.98],
        [1.18 * m, -0.88], [1.26 * m, -0.78], [1.06 * m, -0.74], [0.92 * m, -0.66], [0.82 * m, -0.7], [0.7 * m, -0.58], [0.58 * m, -0.6],
        [0.46 * m, -0.48], [0.34 * m, -0.5], [0.2 * m, -0.38]]), 'shadow', 0.9, z);
      // Feathered legs and the talons gripping the rock.
      p.fill(P([[0.04 * m, -0.2], [0.14 * m, -0.24], [0.13 * m, -0.04], [0.07 * m, 0.02]]), 'shadow', 0.6, z);
      p.fill(P([[0.04 * m, 0.0], [0.2 * m, 0.0], [0.24 * m, 0.06], [0.18 * m, 0.04], [0.06 * m, 0.04]]), 'shadow', 1.2, z);
    }
    // The eye: one bright point of the card's colour, toward the beak.
    const ex = Math.round(cx - 0.06 * s); const ey = Math.round(fy - 0.82 * s);
    p.fill(C.rect(ex - 1, ey, 2, 1), ramp, 4, z + 2);
    return { ex, ey };
  }

  /** A goatherd in a hooded cloak, his crook in his right hand, his lantern held out in his left. */
  function goatherd(p, cx, fy, s, z, ramp) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    p.fill(P([[-0.24, 0], [-0.19, -0.36], [-0.17, -0.62], [-0.13, -0.8], [-0.06, -0.92], [0.03, -0.96], [0.11, -0.88], [0.15, -0.74], [0.17, -0.58],
      [0.22, -0.38], [0.3, -0.12], [0.36, -0.02], [0.26, 0]]), 'shadow', 1.2, z);
    p.fill(P([[-0.03, -0.86], [0.08, -0.85], [0.08, -0.74], [-0.02, -0.74]]), 'shadow', 0, z + 1);
    // The crook: a staff with its hook at the top.
    const sx = Math.round(cx + 0.3 * s);
    p.fill(C.rect(sx, fy - s * 1.08, 1, s * 1.08), 'shadow', 1.6, z);
    p.fill(C.rect(sx - 2, fy - s * 1.14, 3, 1), 'shadow', 1.6, z);
    p.fill(C.rect(sx - 2, fy - s * 1.14, 1, 3), 'shadow', 1.6, z);
    // The arm held out, the lantern hanging from the hand: a dark frame round a bright core of the card's colour.
    const lx = Math.round(cx - 0.42 * s); const ly = Math.round(fy - 0.5 * s);
    p.fill(P([[-0.14, -0.64], [-0.4, -0.6], [-0.4, -0.56], [-0.14, -0.56]]), 'shadow', 1.2, z);
    p.fill(C.rect(lx + 1, ly - 3, 1, 3), 'shadow', 1, z);
    p.fill(C.rect(lx - 1, ly, 5, 5), 'shadow', 1.4, z);
    p.fill(C.rect(lx, ly + 1, 3, 3), ramp, 4, z + 1);
    p.fill(C.rect(lx - 1, ly - 1, 5, 1), 'shadow', 2, z);
    return { lx: lx + 1.5, ly: ly + 2.5 };
  }

  /** A goat, side on, facing left: a barrel body, thin legs, a short tail up, horns swept back. */
  function goat(p, cx, fy, s, z, v = 1.2) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    p.fill(P([[-0.42, -0.62], [-0.3, -0.72], [0.3, -0.7], [0.44, -0.62], [0.42, -0.42], [0.3, -0.36], [-0.34, -0.38]]), 'shadow', v, z);
    p.fill(P([[-0.4, -0.66], [-0.56, -0.94], [-0.66, -0.96], [-0.74, -0.86], [-0.7, -0.78], [-0.56, -0.78], [-0.46, -0.56]]), 'shadow', v, z);
    p.fill(P([[-0.6, -0.94], [-0.5, -1.12], [-0.38, -1.16], [-0.46, -1.06], [-0.54, -0.92]]), 'shadow', v + 0.6, z);
    p.fill(P([[-0.7, -0.8], [-0.7, -0.66], [-0.66, -0.68]]), 'shadow', v, z);
    p.fill(P([[0.4, -0.68], [0.52, -0.84], [0.5, -0.66]]), 'shadow', v, z);
    for (const lx of [-0.34, -0.22, 0.22, 0.34]) p.fill(C.rect(Math.round(cx + lx * s), fy - s * 0.4, 1, s * 0.4), 'shadow', v, z);
  }

  /**
   * The travellers' shrine on the needle: a chorten of stacked stones with a
   * niche, a cap stone, prayer flags strung from its top to the bridge.
   * With an offering, a bowl in the niche glows in the card's colour.
   */
  function shrine(p, cx, fy, s, z, o = {}) {
    const stones = [[0, 0.16, 0.5, 0.17], [0.02, 0.42, 0.42, 0.15], [-0.01, 0.64, 0.33, 0.12], [0.01, 0.82, 0.22, 0.1]];
    for (const [dx, hy, rw, rh] of stones) {
      const y = fy - hy * s;
      p.fill(C.ellipse(cx + dx * s, y, rw * s, rh * s, 18), 'rock', (x, yy) => (o.v ?? 6) + ((cx - x) / s > 0.05 ? 1.4 : (cx - x) / s < -0.15 ? -1 : 0) - ((yy - y) / (rh * s) > 0.4 ? 1.2 : 0), z);
      p.fill(C.rect(cx + dx * s - rw * s * 0.8, y - rh * s, rw * s * 1.6, 1), 'rock', (o.v ?? 6) + 3, z);
    }
    p.fill(C.poly([[cx - 0.1 * s, fy - 0.9 * s], [cx, fy - 1.12 * s], [cx + 0.1 * s, fy - 0.9 * s]]), 'rock', (o.v ?? 6) + 2.4, z);
    // The niche in the second stone.
    const ny = Math.round(fy - 0.48 * s); const nw = Math.max(3, Math.round(0.24 * s));
    p.fill(C.rect(Math.round(cx - nw / 2), ny - Math.round(0.14 * s), nw, Math.round(0.18 * s)), 'shadow', 0.4, z + 1);
    let flame = null;
    if (o.ramp) {
      p.fill(C.rect(Math.round(cx - nw / 2) + 1, ny - 1, nw - 2, 2), o.ramp, 3.4, z + 2);
      // The offering: a bronze bowl before the shrine, a violet flame standing in it.
      const bx = Math.round(cx - 0.36 * s); const bw = Math.max(4, Math.round(0.34 * s)); const by = Math.round(fy);
      p.fill(C.poly([[bx - bw / 2, by - 0.16 * s], [bx + bw / 2, by - 0.16 * s], [bx + bw * 0.3, by], [bx - bw * 0.3, by]]), 'wood', 4.6, z + 2);
      p.fill(C.rect(bx - bw / 2, by - 0.16 * s - 1, bw, 1), 'wood', 7.4, z + 2);
      const fh = 0.42 * s; const fb = by - 0.16 * s - 1;
      p.fill(C.poly([[bx - bw * 0.32, fb], [bx - bw * 0.2, fb - fh * 0.55], [bx, fb - fh], [bx + bw * 0.22, fb - fh * 0.5], [bx + bw * 0.32, fb]]), o.ramp, (x, y) => ((fb - y) / fh > 0.62 ? 3 : Math.abs(x + 0.5 - bx) < bw * 0.14 ? 4.6 : 3.8), z + 3);
      flame = [bx, fb - fh * 0.4];
    }
    return { top: [cx, fy - 1.1 * s], niche: [cx, ny], flame };
  }
  /** Prayer flags along a line: little cloth squares hanging from a cord, faded by weather. */
  function flags(p, x0, y0, x1, y1, sag, u, z) {
    const n = Math.max(2, Math.ceil(Math.abs(x1 - x0)));
    for (let k = 0; k <= n; k += 1) {
      const t = k / n; const x = Math.round(lerp(x0, x1, t)); const y = Math.round(lerp(y0, y1, t) + sag * 4 * t * (1 - t));
      p.fill(C.rect(x, y, 1, 1), 'rope', 2.4, z);
      if (k % Math.max(3, Math.round(3 * u)) === 1) p.fill(C.rect(x, y + 1, Math.max(2, Math.round(1.8 * u)), Math.max(2, Math.round(2.2 * u))), 'cloth', 2 + (k % 4 === 1 ? 2 : k % 4 === 3 ? 1 : 0), z);
    }
  }

  /**
   * A waterfall: a column of white water pouring from `top` to `bottom`,
   * widening as it falls, streaked down its length, brightest where it is
   * thin at its edges and where it catches the light; mist where it lands.
   */
  function fall(p, cx, top, bottom, w0, w1, u, o = {}) {
    const z = o.z ?? 2; const v = o.v ?? 7; const seed = o.seed || 3;
    const hw = (y) => lerp(w0, w1, clamp((y - top) / (bottom - top), 0, 1) ** 1.2) / 2 + (n1(y / (5 * u), seed) - 0.5) * 1.6 * u + (n1(y / (1.6 * u), seed + 9) - 0.5) * 0.9 * u;
    const pts = [];
    for (let i = 0; i <= 16; i += 1) { const y = lerp(top, bottom, i / 16); pts.push([cx - hw(y), y]); }
    for (let i = 16; i >= 0; i -= 1) { const y = lerp(top, bottom, i / 16); pts.push([cx + hw(y), y]); }
    const shape = C.poly(pts);
    p.fill(shape, 'water', (x, y) => {
      const q = (x + 0.5 - cx) / Math.max(1, hw(y));
      if (o.gaps && o.gaps.some(([g, w]) => Math.abs(q - g - (n1(y / (8 * u), seed + 5) - 0.5) * 0.08) < w * (1.2 - clamp((y - top) / (bottom - top), 0, 1) * 0.6))) return null;
      const st = frac(q * (o.flutes ?? 3) + n1(y / (9 * u), seed + 1) * 0.6);
      const t = clamp((y - top) / (bottom - top), 0, 1);
      const lip = y - top < 2 * u ? 1.4 : 0;
      return Math.round(v - Math.abs(q) * 1.2 + (st < 0.3 ? -1.6 : st > 0.78 ? 0.9 : 0) - t * (o.fade ?? 1.2) + lip + (hash(Math.floor(x / 2), Math.floor(y / (3 * u)), seed) < 0.12 ? -1 : 0));
    }, z);
    return { shape, hw };
  }

  /**
   * Foam where a fall lands: a bank of white water, lumpy along its top,
   * and clouds of spray standing up off it, pale and broken.
   */
  function foam(p, cx, y0, hw, u, gold, zs = [2], zTo = 2) {
    const R = p.ri(gold ? 'sun' : 'water');
    p.each(C.rect(cx - hw * 1.2, y0 - 22 * u, hw * 2.4, p.h - y0 + 22 * u), (x, y, i) => {
      if (!zs.includes(p.z[i])) return;
      const dx = Math.abs(x + 0.5 - cx) / hw; if (dx > 1.15) return;
      const topF = y0 + (n1(x / (3 * u), 21) - 0.5) * 4 * u + dx * dx * 4 * u - Math.abs(Math.sin(x / (2.6 * u))) * 2 * u;
      if (y + 0.5 >= topF) {
        p.r[i] = R; p.z[i] = zTo;
        p.v[i] = gold ? 6 + (y - topF < 1.5 * u ? 1 : 0) : 11 + (y - topF < 1.5 * u ? 1 : 0) - (hash(x >> 1, y >> 1, 22) < 0.2 ? 1 : 0) - clamp((y - topF) / (14 * u), 0, 1) * 1.6;
        return;
      }
      // Spray: puffs standing up off the foam, thinning upward.
      const sp = n2(x / (4 * u), y / (3 * u), 23) - (topF - y) / (22 * u) * 0.9 - dx * 0.25;
      if (sp > 0.38) { p.r[i] = R; p.z[i] = zTo; p.v[i] = gold ? 4.4 + (sp > 0.5 ? 1 : 0) : 8.6 + (sp > 0.5 ? 1.4 : 0); }
    });
  }

  /** A wind-bent pine: a crooked trunk leaning right, flat tiers of needles streaming downwind. */
  function pine(p, x, by, h, u, z, o = {}) {
    const lean = o.lean ?? 0.35; const seed = o.seed || 1; const v = o.v ?? 1.4;
    const tx = (t) => x + lean * h * t * t;
    for (let k = 0; k < h; k += 1) {
      const t = k / h; const xx = Math.round(tx(t) + (n1(t * 4, seed) - 0.5) * 2 * u);
      p.fill(C.rect(xx, Math.round(by - k), Math.max(1, Math.round((1 - t) * 2 * u)), 1), 'pine', v - 0.4, z);
    }
    const tiers = Math.max(3, Math.round(h / (4 * u)));
    for (let i = 0; i < tiers; i += 1) {
      const t = 0.35 + (i / tiers) * 0.62; const ty = by - h * t; const cx = tx(t);
      const wl = (1 - t) * h * 0.22 + 2 * u; const wr = (1 - t) * h * 0.5 + 3 * u;
      p.fill(C.poly([[cx - wl, ty + 1.2 * u], [cx - wl * 0.6, ty - 0.6 * u], [cx + wr * 0.5, ty - 1.4 * u], [cx + wr, ty - 0.2 * u], [cx + wr * 0.8, ty + 1.4 * u]]), 'pine', (xx, yy) => v + (yy < ty - 0.4 * u ? 0.8 : 0), z);
    }
  }

  /** A cairn: a few flat stones stacked, lit on top. */
  function cairn(p, x, by, s, z, v = 3) {
    for (let k = 0; k < 4; k += 1) {
      const w = Math.max(1, Math.round(s * (0.55 - k * 0.11))); const y = Math.round(by - k * Math.max(1, s * 0.22));
      p.fill(C.rect(Math.round(x - w / 2), y - 1, w, Math.max(1, Math.round(s * 0.22))), 'rock', v + (k === 3 ? 1.2 : 0), z);
      p.fill(C.rect(Math.round(x - w / 2), y - 1, w, 1), 'rock', v + 1.4, z);
    }
  }

  /**
   * The near ground: wet rocks and grass tussocks, low in the middle, rising
   * toward the edges, lit along their tops by the storm light.
   */
  function nearGround(p, W, H, u, o) {
    const gx = W / 2; const z = o.z ?? 9; const seed = o.seed || 4;
    const topAt = (x) => {
      const d = Math.abs(x - gx); const lift = clamp((d - o.clear * u) / (70 * u), 0, 1);
      return o.y * u - lift * o.rise * u - (n1(x / (9 * u), seed) - 0.5) * 5 * u - (n1(x / (3 * u), seed + 1) - 0.5) * 1.6 * u;
    };
    const tops = new Float32Array(W);
    for (let x = 0; x < W; x += 1) tops[x] = topAt(x + 0.5);
    const shape = C.rect(0, Math.min(...tops) - 1, W, H);
    const R = p.ri('rock'); const G = p.ri('grass');
    p.each(shape, (x, y, i) => {
      const d = y + 0.5 - tops[x]; if (d < 0) return;
      const g = n2(x / (6 * u), y / (3 * u), seed + 2) > 0.52;
      p.r[i] = g ? G : R; p.z[i] = z;
      p.v[i] = (g ? 2.2 : 1.6) - Math.min(1.2, d / (6 * u)) + (d < 1 ? (g ? 1.4 : 1.8) : 0);
    });
    p.cells(shape, { size: 5 * u, sx: 1.4, sy: 0.8, joint: 0.7, jointV: -0.9, vary: 0.6, bevel: 0.6, lit: [0, -1], seed: seed + 3, z });
    // Tussocks: blades of grass standing up off the edge, bent by the wind.
    const hits = [];
    for (let x = 0; x < W; x += 1) {
      if (hash(x, 0, seed + 5) > 0.42) continue;
      const y0 = Math.round(tops[x]); const L = 1 + Math.floor(hash(x, 1, seed + 5) * 3 * u);
      for (let k = 1; k <= L; k += 1) hits.push([x + Math.round(k * 0.4), y0 - k]);
    }
    for (const [x, y] of hits) if (x >= 0 && x < W && y >= 0) { const i = y * W + x; p.r[i] = G; p.v[i] = 2.2; p.z[i] = z; }
    return tops;
  }

  const A = {
    job: 0, setting: 'high-road', key: 'A', id: 'high-road-a', side: 'outside',
    name: 'The High Road', title: 'The storm on the pass',
    pitch: 'Summer, high in the granite, and a thunderstorm breaking over the pass. The road is cut into the cliff, a rope bridge crosses the gorge by way of a stone needle, and the waterfalls are running white with rain.',
    notes: [
      ['Light', 'Storm light: dark cloud lit from behind through one break over the gorge, the waterfall under it the brightest thing on the board, lightning striking the far peaks out at the sides. Gold comes only when the sun breaks through, for a Clear Path. On a face-down card the bridge runs away into the rain and the bolt strikes off to one side, never at its end.'],
      ['Detail', 'Green-grey granite crags, each lit on the face toward the break and shadowed on the other, wet streaks and moss on the ledges; the road cut into the cliff with cairns along it, a rope bridge, waterfalls, wind-bent pines, eagles, rain.'],
      ['Vista', 'The cliff road across the board, a gorge cut into it with a waterfall pouring down its back. The bridge crosses by a granite needle with a shrine on top, where the card waits against the white water: a roc landing with its wings raised, a goatherd with his lantern, an offering burning violet in a bowl, the bridge cut and hanging, the cloud parting on the sun and the falls running gold.'],
      ['World', 'Sky high, table low: the storm and the peaks along the top, then the wet cobbled road under the table with rain ringing in its puddles, the cliff and its waterfall on one side, the drop into the gorge on the other. Only the sky flashes.'],
    ],
    palette: ['#06080C', '#1C2430', '#435367', '#90A3B6', '#F2F6F8', '#141816', '#38403A', '#687169', '#3D4A27'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['bolt'], dither: 0.22 });
      const u = H / 134; const gx = W / 2;
      const bx = gx + 15 * u; const by = 60 * u; // where the bolt strikes: up and to the right, never at the bridge's end
      stormSky(p, W, 96 * u, {
        u, gx: bx - 3 * u, gy: 38 * u, grx: 34 * u, gry: 30 * u, gk: 10.4, gp: 0.9, top: 1.4, hor: 3.4, seed: 11, ceilSide: 28, ceilGap: 14, ceilW: 34, curtains: 12, cloud: 2, band: 2.4, lining: 1.4,
        bands: [[gx - 16 * u, 46 * u, 26 * u, 3.5 * u], [gx + 28 * u, 30 * u, 16 * u, 2.5 * u], [gx - 6 * u, 60 * u, 34 * u, 2.5 * u]],
      });
      // The far ridge, flat grey in the rain, its edge catching the flash.
      const far = ridge(W, u, { seed: 'b-far', gap: 22, y0: 60, y1: 70, sl: 1.1, base: 90, step: 2 });
      p.each(C.rect(0, 50 * u, W, 50 * u), (x, y, i) => { if (y + 0.5 >= far[x]) { p.r[i] = p.ri('sky'); p.v[i] = 2.6 - (y - far[x]) / (16 * u); p.z[i] = 1; } });
      addEdge(p, 1, 0, -1, (x) => 0.6 + 3 * clamp(1 - Math.abs(x - bx) / (30 * u), 0, 1));
      // The struck peak: granite, up to the right, lit hard by the bolt.
      const peak = ridge(W, u, { seed: 'b-peak', gap: 30, y0: 68, y1: 78, sl: 1.5, base: 96, step: 2.5 });
      for (let x = 0; x < W; x += 1) { const dx = x + 0.5 - bx; peak[x] = Math.min(peak[x], by + Math.abs(dx) * (dx < 0 ? 1.1 : 1.6) + (n1(x / (2 * u), 4) - 0.5) * 2 * u); }
      const peaks = C.rect(0, 50 * u, W, 50 * u);
      p.each(peaks, (x, y, i) => { if (y + 0.5 >= peak[x]) { p.r[i] = p.ri('rock'); p.v[i] = 1.2 - (y - peak[x]) / (16 * u); p.z[i] = 2; } });
      granite(p, peaks, { u, size: 4, sx: 0.8, sy: 1.3, z: 2, seed: 3, lit: [0.6, -0.8], bevel: 1 });
      p.light(bx, by, 22 * u, 6.4, null, { zMin: 2, zMax: 2, hard: true });
      addEdge(p, 2, 0, -1, (x) => 1.4 + 5 * clamp(1 - Math.abs(x - bx) / (24 * u), 0, 1));
      // The bolt, from the cloud to the peak, its glow in the cloud round it.
      const segs = boltPath(bx - 8 * u, 18 * u, bx, by + 1, 'b-bolt', { jag: 0.26, forks: 3 });
      boltInto(p, segs, 'bolt', 3, 5);
      // The gorge: black, mist hanging in it.
      p.fill(C.rect(0, 80 * u, W, 54 * u), 'sky', (x, y) => 1 + (n2(x / (14 * u), y / (2.6 * u), 9) > 0.58 ? 1.6 : 0), 3);
      // Its far side, the bridge's far end lost in the rain on it, a waterfall pouring down it.
      const farSide = C.poly([[0, 79 * u], [20 * u, 77 * u], [44 * u, 80 * u], [66 * u, 77 * u], [W, 80 * u], [W, 96 * u], [0, 96 * u]]);
      p.fill(farSide, 'rock', (x, y) => 1 - (y - 78 * u) / (12 * u), 4);
      granite(p, farSide, { u, size: 3.5, z: 4, seed: 7, lit: [0.5, -0.8], bevel: 0.8 });
      addEdge(p, 4, 0, -1, () => 2);
      fall(p, 26 * u, 78 * u, 104 * u, 3 * u, 7 * u, u, { z: 4, v: 8.4, seed: 5, flutes: 2, fade: 3.4 });
      p.light(bx, 66 * u, 46 * u, 2.2, null, { zMin: 3, zMax: 4 });
      // Rain hanging between us and the far side, so the bridge runs into grey.
      p.shade(C.rect(0, 70 * u, W, 30 * u), (x, y) => (n2(x / (10 * u), y / (3 * u), 13) > 0.5 ? 0.8 : 0), 4);
      // The bridge, running away from us over the gorge, its far end bending left into the rain.
      const yN = 136 * u; const yF = 81 * u; const hwN = 27 * u; const hwF = 3 * u; const sag = 6 * u;
      const cxAt = (t) => gx - 7 * u * t ** 1.6;
      const at = (t) => [lerp(hwN, hwF, t), lerp(yN, yF, t) + sag * 4 * t * (1 - t), cxAt(t)];
      for (let k = 0; k < 44; k += 1) {
        const t0 = 1 - 0.9 ** k; const t1 = 1 - 0.9 ** (k + 0.62);
        if (t0 > 0.99) break;
        const [hw0, y0, c0] = at(t0); const [hw1, y1, c1] = at(t1);
        const sk = (hash(k, 1, 3) - 0.5) * 1.4 * u * (1 - t0);
        p.fill(C.poly([[c0 - hw0 + sk, y0], [c0 + hw0 + sk, y0 - sk * 0.3], [c1 + hw1, y1], [c1 - hw1, y1]]), 'wood',
          (x, y) => 2.8 - t0 * 2.6 + (y < y1 + 1 ? 2.4 * (1 - t0 * 0.6) : 0) - Math.abs(x - c0) / hw0 * 0.9 + (hash(k, 2, 3) - 0.5) * 0.7, 5);
      }
      // The posts, the hand ropes sagging between them, the hangers.
      const postN = 30 * u; const postF = 3.5 * u;
      for (const m of [-1, 1]) {
        const px = gx + m * (hwN + 2 * u);
        p.fill(C.poly([[px - 2.6 * u, H], [px - 2 * u, yN - 34 * u], [px + 2 * u, yN - 35 * u], [px + 2.6 * u, H]]), 'wood', (x) => 2 + (m * (x - px) < 0 ? 1.6 : 0), 6);
        p.fill(C.rect(px - 2.4 * u, yN - 36 * u, 4.8 * u, 1.6 * u), 'wood', 4.4, 6);
        const ropeAt = (t) => [cxAt(t) + m * lerp(hwN + 2 * u, hwF + 0.5 * u, t), lerp(yN - postN, yF - postF, t) + 9 * u * 4 * t * (1 - t)];
        let prev = ropeAt(0);
        for (let k = 1; k <= 60; k += 1) {
          const t = k / 60; const q = ropeAt(t);
          line(p, prev[0], prev[1], q[0], q[1], 'rope', 5.6 - t * 3, 6); line(p, prev[0], prev[1] + 1, q[0], q[1] + 1, 'rope', 2, 6);
          prev = q;
        }
        for (let k = 1; k < 18; k += 1) {
          const t = 1 - 0.87 ** k; const [rx, ry] = ropeAt(t); const [hw, dy, c] = at(t);
          line(p, rx, ry + 1, c + m * hw, dy, 'rope', 3.2 - t * 1.4, 6);
        }
      }
      // The cliffs we stand between, outside the arch: wet granite, its inner edges catching the flash.
      for (const m of [-1, 1]) {
        const pts = [[gx + m * 52 * u, 0], [gx + m * 33 * u, 12 * u], [gx + m * 30 * u, 34 * u], [gx + m * 35 * u, 56 * u], [gx + m * 32 * u, 80 * u], [gx + m * 37 * u, 102 * u], [gx + m * 41 * u, H], [gx + m * 52 * u, H]];
        const cl = C.poly(pts.map(([x, y], i) => [x + (y > 0 && y < H ? (hash(i, m + 3, 5) - 0.5) * 4 * u : 0), y]));
        p.fill(cl, 'rock', (x, y) => 1.4 - Math.abs(x - gx) / (W * 0.5) * 1.2 - y / H * 0.4, 7);
        buttresses(p, cl, { u, z: 7, bw: 9, seed: 20 + m, lh: 8, lit: m < 0 ? 0.6 : 1.4, dark: m < 0 ? -0.6 : -0.3 });
        granite(p, cl, { u, size: 4, sx: 0.8, sy: 1.3, z: 7, seed: 20 + m, lit: [-m * 0.7, -0.6], bevel: 0.5, vary: 0.5, wet: 1.8, wetPer: 5 });
        moss(p, cl, { u, z: 7, seed: 4 + m, v: 2.4, k: 0.25, thresh: 0.55 });
      }
      p.light(bx, 40 * u, 70 * u, 3.4, null, { zMin: 7, zMax: 7 });
      addEdge(p, 7, 1, 0, (x, y) => 3.4 - y / H); addEdge(p, 7, -1, 0, (x, y) => 4.4 - y / H * 1.6);
      pine(p, gx + 36 * u, 24 * u, 22 * u, u, 8, { lean: 0.5, seed: 3, v: 1.6 });
      vignette(p, W, H, 1.4, 0.42);
      return {
        p,
        over(img) {
          rain(img, W, H, 2.2, 60, { u, seed: 3, a: 0.4 });
          eagles(img, [[gx - 18 * u, 36 * u, 0, 0, 0, 0]], 0.4, '#141A20');
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['bolt', 'sun', 'path'], dither: 0.22 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const roadY = 66 * u; const pinTop = 68 * u; const lipY = 40 * u; const gy = 24 * u;
      // The sky: the storm, broken over the gorge; for a Clear Path the break is the sun.
      const sky = stormSky(p, W, 64 * u, {
        u, gx, gy, grx: 70 * u, gry: 30 * u, gk: 10.4, gp: 0.75, top: 1.4, hor: 3.6, seed: 21, ceilSide: 20, ceilGap: 2, ceilW: 90, curtains: 26, cloud: 2, band: 2.4, lining: 1.6,
        bands: [[gx - 34 * u, 30 * u, 44 * u, 4 * u], [gx + 40 * u, 20 * u, 36 * u, 3 * u], [gx + 6 * u, 42 * u, 60 * u, 2.5 * u], [gx - 130 * u, 40 * u, 60 * u, 4 * u], [gx + 140 * u, 36 * u, 70 * u, 4 * u]],
      });
      if (open) sunBreak(p, W, gx, gy - 4 * u, u, 64 * u, sky.kind);
      // The far peaks behind the cliffs, grey in the rain, brightest under the break.
      const far = ridge(W, u, { seed: 'v-far', gap: 30, y0: 22, y1: 38, sl: 1.1, base: 60, step: 2 });
      p.each(C.rect(0, 0, W, 64 * u), (x, y, i) => {
        if (y + 0.5 < far[x]) return;
        const g = clamp(1 - Math.abs(x - gx) / (90 * u), 0, 1);
        p.r[i] = p.ri('sky'); p.z[i] = 1; p.v[i] = 2.6 + g * 1.2 - Math.min(1, (y - far[x]) / (14 * u));
      });
      addEdge(p, 1, 0, -1, (x) => 0.6 + 4 * clamp(1 - Math.abs(x - gx) / (80 * u), 0, 1));
      // The cliff the road is cut into, its top stepping up to crags; the gorge cut down through it at the middle.
      const cliffTop = ridge(W, u, { seed: 'v-cliff', gap: 40, y0: 32, y1: 48, sl: 0.9, base: 58, step: 1 });
      const hwAt = (y) => (27 + (roadY - y) / u * 0.36) * u;
      const xL = (y) => gx - hwAt(y) + (n1(y / (3 * u), 5) - 0.5) * 3 * u;
      const xR = (y) => gx + hwAt(y) + (n1(y / (3 * u), 6) - 0.5) * 3 * u;
      const lipK = cliffTop.peaks.length; cliffTop.peaks.push([gx - 34 * u, lipY - 3 * u], [gx + 34 * u, lipY - 3 * u]);
      for (let x = 0; x < W; x += 1) {
        const d = Math.abs(x + 0.5 - gx); const ly = lipY - 3 * u + Math.max(0, d - 36 * u) * 0.14;
        if (d < 60 * u && ly < cliffTop[x]) { cliffTop[x] = ly; cliffTop.own[x] = lipK + (x < gx ? 0 : 1); }
      }
      const all = C.rect(0, 0, W, H);
      const inGorge = (x, y) => y > lipY - 6 * u && x + 0.5 > xL(y) && x + 0.5 < xR(y);
      // The gorge's back wall, far and grey, and the waterfall pouring down it.
      p.each(all, (x, y, i) => {
        if (!inGorge(x, y) || y + 0.5 < cliffTop[x] + 1 * u) return;
        p.r[i] = p.ri('sky'); p.z[i] = 2; p.v[i] = 6.2 - (y - lipY) / (40 * u);
      });
      granite(p, all, { u, size: 4, z: 2, seed: 5, lit: [0, -1], bevel: 0.8, vary: 0.6 });
      fall(p, gx + 1 * u, lipY - 1 * u, H, 54 * u, 64 * u, u, { z: 2, v: 9.6, seed: 7, flutes: 9, fade: 1.4, gaps: [[-0.66, 0.025], [0.58, 0.02]] });
      // The cliff itself, either side of the gorge: lit from the sky above, so every block's top catches it.
      const R = p.ri('rock');
      p.each(all, (x, y, i) => {
        if (y + 0.5 < cliffTop[x] || inGorge(x, y)) return;
        p.r[i] = R; p.z[i] = 3; p.v[i] = 1.6 - (y - cliffTop[x]) / (50 * u);
      });
      crags(p, cliffTop, { u, z: 3, lx: gx, seed: 9, lit: 3.4, shade: -0.5, depth: 46 });
      // Side waterfalls pouring down the cliff from notches in its top.
      for (let d = 92 * u, k = 0; d < W / 2 + 30 * u; d += (84 + hash(k, 0, 9) * 34) * u, k += 1) {
        for (const m of [-1, 1]) {
          const x = gx + m * d + (hash(k, m + 2, 9) - 0.5) * 24 * u;
          if (x < -10 || x > W + 10) continue;
          fall(p, x, cliffTop[clamp(Math.round(x), 0, W - 1)] + 1, H, 2.4 * u, 6 * u, u, { z: 3, v: 8.6, seed: 11 + k * 2 + m, flutes: 1.5, fade: 3 });
          p.light(x, 56 * u, 26 * u, 2.6, null, { zMin: 3, zMax: 3 });
        }
      }
      // The storm light from the break: a pool on the cliffs round the gorge, dark further out.
      p.light(gx, gy + 18 * u, 80 * u, open ? 7.4 : 6.6, null, { zMin: 2, zMax: 3 });
      p.light(gx, gy + 18 * u, 130 * u, 1.2, null, { zMin: 2, zMax: 3 });
      addEdge(p, 3, 0, -1, (x) => 0.8 + 3.2 * clamp(1 - Math.abs(x - gx) / (80 * u), 0, 1));
      // The gorge's lips: wet granite catching the break, a bright edge and streaks of sheen running down beside it.
      p.shade(all, (x, y) => {
        if (p.z[y * W + x] !== 3 || y < lipY - 4 * u) return 0;
        const dl = xL(y) - (x + 0.5); const dr = (x + 0.5) - xR(y);
        const d = dl > 0 ? dl : dr > 0 ? dr : -1; if (d < 0) return 0;
        const fade = clamp(1 - (y - lipY) / (55 * u), 0.25, 1);
        if (d < 1) return 4.4 * fade; if (d < 1.6 * u) return 2.4 * fade;
        if (d < 9 * u && frac((d + n1(y / (5 * u), x > gx ? 3 : 4) * 3 * u) / (3.2 * u)) < 0.18 && n1(y / (7 * u), x > gx ? 5 : 6) > 0.4) return 2.6 * fade;
        return d < 12 * u ? -0.6 : 0;
      }, 3);
      moss(p, all, { u, z: 3, seed: 6, v: 3.4, k: 0.45, thresh: 0.46 });
      // The road: a ledge cut along the face, the overhang's shadow over it, its worn edge lit; cairns along it.
      const rY = (x) => roadY + Math.max(0, Math.abs(x - gx) - 30 * u) * 0.05 + (n1(x / (40 * u), 3) - 0.5) * 3 * u;
      p.shade(all, (x, y) => {
        if (inGorge(x, y) || p.z[y * W + x] !== 3) return 0;
        const d = y + 0.5 - rY(x + 0.5);
        return d > -4.5 * u && d < -1 ? -2.4 : d >= -1 && d < 1 ? 3.4 : d >= 1 && d < 2 ? 1 : d >= 2 && d < 4 * u ? -0.6 : 0;
      }, 3);
      // Its parapet: a stone here and there along the outer edge.
      for (let x = 0; x < W; x += 1) {
        if (inGorge(x, roadY) || hash(Math.floor(x / Math.max(2, 2.4 * u)), 0, 12) < 0.45) continue;
        const y = Math.round(rY(x + 0.5)) - 1;
        p.fill(C.rect(x, y, 1, 1), 'rock', 4.6 + 2 * clamp(1 - Math.abs(x - gx) / (80 * u), 0, 1), 3);
      }
      for (let x = gx - 64 * u, k = 0; x > -10 * u; x -= (58 + hash(k, 2, 4) * 40) * u, k += 1) cairn(p, x, rY(x) - 1, 4.4 * u, 4, 4);
      for (let x = gx + 70 * u, k = 0; x < W + 10 * u; x += (58 + hash(k, 3, 4) * 40) * u, k += 1) cairn(p, x, rY(x) - 1, 4.4 * u, 4, 4);
      // Wind-bent pines clinging to the cliff above the road.
      for (let d = 78 * u, k = 0; d < W / 2 + 10 * u; d += (70 + hash(k, 5, 4) * 50) * u, k += 1) for (const m of [-1, 1]) pine(p, gx + m * d, rY(gx + m * d) - 4.5 * u, 13 * u, u, 4, { lean: 0.45, seed: k * 2 + m + 5, v: 1.4 });
      // The needle: a granite pillar standing up out of the gorge, its top flat, lit on its left.
      const needle = C.poly([[gx - 12 * u, pinTop + 1 * u], [gx - 11 * u, pinTop - 1 * u], [gx + 10.5 * u, pinTop - 1 * u], [gx + 12 * u, pinTop + 1.5 * u], [gx + 8 * u, pinTop + 5 * u], [gx + 7 * u, pinTop + 14 * u], [gx + 9.5 * u, H], [gx - 10 * u, H], [gx - 8 * u, pinTop + 12 * u], [gx - 8.5 * u, pinTop + 4 * u]]);
      p.fill(needle, 'rock', (x, y) => (y < pinTop + 1.6 * u ? 6 : 3 - (y - pinTop) / (20 * u)) + (x < gx - 1 * u ? 1.2 : -0.4), 4);
      buttresses(p, needle, { u, z: 4, bw: 7, seed: 13, lh: 6, lit: 0.8, dark: -0.4 });
      addEdge(p, 4, 0, -1, () => (open ? 7 : 6)); addEdge(p, 4, -1, 0, () => 3.4); addEdge(p, 4, 1, 0, () => 2.2);
      p.backlit(4, 'water', 7, 'rock', 7.4);
      foam(p, gx, 82 * u, 34 * u, u, open, [2, 4], 5);
      // Mist rising out of the gorge where the fall lands.
      p.shade(C.rect(0, 78 * u, W, 22 * u), (x, y) => {
        const m = n2(x / (12 * u), y / (3 * u), 17) - 0.42 + (1 - Math.min(1, Math.abs(x - gx) / (40 * u))) * 0.35;
        return m > 0.28 ? 1.6 + ((y - 78 * u) / (22 * u)) * 2.2 : 0;
      }, 2);
      // The bridge, across the gorge by way of the needle.
      const lx0 = xL(roadY) - 1 * u; const rx0 = xR(roadY) + 1 * u;
      const bv = open ? 4.6 : 3.6;
      if (cat === 'obstacle') {
        broken(p, lx0, roadY, 1, 26 * u, { u, z: 5, ramp, seed: 1 });
        broken(p, rx0, roadY, -1, 22 * u, { u, z: 5, ramp, seed: 2 });
        broken(p, gx - 11 * u, pinTop, -1, 7 * u, { u, z: 5, ramp, seed: 3, post: false });
        broken(p, gx + 11 * u, pinTop, 1, 6 * u, { u, z: 5, ramp, seed: 4, post: false });
        p.tint(gx - 6 * u, roadY + 12 * u, 10 * u, hex, 0.35, flicker(0.5, 0.12, 0.6));
        p.tint(gx + 8 * u, roadY + 10 * u, 9 * u, hex, 0.3, flicker(1.5, 0.12, 0.6));
      }
      // The card, on the needle.
      const fy = Math.round(pinTop - 1.2 * u);
      if (cat === 'monster') {
        const e = roc(p, gx, fy, 37 * u, 7, ramp);
        p.backlit(7, 'sky', 6, 'sky', 11.6);
        addEdge(p, 7, 0, -1, (x, y) => (p.r[(y - 1) * W + x] === p.ri('water') ? 0 : 1.4));
        p.tint(e.ex, e.ey, 2.6 * u, CARD[ramp][3], 0.6, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const l = goatherd(p, gx + 3 * u, fy, 27 * u, 7, ramp);
        p.backlit(7, 'sky', 6, 'sky', 13);
        p.tint(l.lx, l.ly, 4 * u, CARD[ramp][4], 0.8, flicker(0.9, 0.15));
        p.tint(l.lx, l.ly + 4 * u, 14 * u, hex, 0.45, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        const s = shrine(p, gx + 3 * u, fy, 22 * u, 7, { ramp });
        flags(p, s.top[0], s.top[1], lx0, roadY - 5 * u, 3 * u, u, 6);
        flags(p, s.top[0], s.top[1], rx0, roadY - 5 * u, 3 * u, u, 6);
        p.backlit(7, 'water', 6, 'water', 11);
        p.tint(s.flame[0], s.flame[1], 5 * u, CARD[ramp][4], 0.55, flicker(2, 0.15, 0.9));
        p.tint(s.flame[0], s.flame[1], 12 * u, hex, 0.4, flicker(2, 0.15, 0.7));
      } else {
        const s = shrine(p, gx, fy, 15 * u, 7, {});
        p.backlit(7, 'water', 6, 'water', 10.4);
        if (!open) { flags(p, s.top[0], s.top[1], lx0, roadY - 5 * u, 3 * u, u, 6); flags(p, s.top[0], s.top[1], rx0, roadY - 5 * u, 3 * u, u, 6); }
        if (open) {
          flags(p, s.top[0], s.top[1], lx0, roadY - 5 * u, 3 * u, u, 6); flags(p, s.top[0], s.top[1], rx0, roadY - 5 * u, 3 * u, u, 6);
          // The sun on the water, the needle and the road: the light comes down the gorge.
          gild(p, all, (x, y) => clamp(1 - Math.hypot((x - gx) / 1.6, y - gy) / (70 * u), 0, 1));
          // The whole fall runs gold.
          const Wt = p.ri('water'); const Sn = p.ri('sun');
          p.each(C.rect(gx - 26 * u, lipY - 2 * u, 52 * u, H - lipY + 2 * u), (x, y, i) => { if (p.r[i] === Wt && p.z[i] === 2) { p.r[i] = Sn; p.v[i] = clamp(Math.round((p.v[i] - 4) * 0.85), 2, 7); } });
        }
      }
      // The bridge, crossing the gorge by the needle, in front of whatever stands on it.
      if (cat !== 'obstacle') {
        const so = { u, z: 8, sag: 4 * u, post: 5 * u, v: bv + 0.6, rv: bv + 1.2 };
        span(p, lx0, roadY, gx - 11 * u, pinTop + 0.5 * u, so);
        span(p, gx + 11 * u, pinTop + 0.5 * u, rx0, roadY, so);
        addEdge(p, 8, 0, -1, () => 1.6);
      }
      // The near ground, dark rocks and grass rising toward the edges, a pine here and there.
      nearGround(p, W, H, u, { y: 95, rise: 16, clear: 34, z: 9, seed: 5 });
      for (let d = 64 * u, k = 0; d < W / 2 + 20 * u; d += (100 + hash(k, 6, 2) * 60) * u, k += 1) for (const m of [-1, 1]) {
        const x = gx + m * d + (hash(k, m + 4, 2) - 0.5) * 16 * u;
        pine(p, x, H, (22 + hash(k, m, 7) * 12) * u, u, 10, { lean: 0.4, seed: k * 3 + m, v: 1.2 });
      }
      vignette(p, W, H, 1.4, 0.4);
      for (const z of [2, 3, 4, 8, 9, 10]) quant(p, z);
      // The lightning: strikes on the far peaks out at the sides, never over the card.
      const strikes = [];
      for (let d = 72 * u, k = 0; d < W / 2 + 10 * u; d += (104 + hash(k, 8, 1) * 60) * u, k += 1) for (const m of [-1, 1]) strikes.push(gx + m * d);
      const bolts = strikes.map((x, k) => {
        const per = 3.6 + hash(k, 1, 2) * 3; const ph = hash(k, 2, 2) * per;
        const tx = clamp(Math.round(x), 0, W - 1);
        p.light(x, far[tx], 60 * u, 3.4, strike(per, ph), { zMax: 1 });
        p.light(x, far[tx], 50 * u, 1.6, strike(per, ph), { zMin: 3, zMax: 3 });
        return { per, ph, segs: boltPath(x - 6 * u, 0, x, far[tx] + 1, `v-bolt-${k}`, { jag: 0.3, forks: 2 }) };
      });
      const flock = [[gx - 58 * u, 34 * u, 14 * u, 4 * u, 0.4, 0.3], [gx + 76 * u, 40 * u, 18 * u, 5 * u, 2.2, -0.26]];
      if (W > 250) flock.push([gx - 150 * u, 30 * u, 16 * u, 4 * u, 1.3, 0.22]);
      const ffx = gx + 1 * u;
      return {
        p,
        over(img, t) {
          for (const b of bolts) if (striking(b.per, b.ph, t)) boltOnto(img, b.segs);
          eagles(img, flock, t);
          // The fall running: bright streaks sliding down it.
          for (let k = 0; k < 16; k += 1) {
            const y = lipY + frac(t * 0.8 + hash(k, 2, 31)) * (H - lipY);
            const x = ffx + (hash(k, 1, 31) - 0.5) * lerp(7, 16, (y - lipY) / (H - lipY)) * u;
            const i = (Math.round(y) * W + Math.round(x));
            if (p.z[i] !== 2) continue;
            put(img, x, y, open ? '#FFF6DC' : '#F2F6F8', 0.8); put(img, x, y - 1, open ? '#FFE7B0' : '#D5DEE3', 0.5);
          }
          for (let k = 0; k < 14; k += 1) {
            const f = frac(t * 0.35 + hash(k, 3, 41)); const x = gx + (hash(k, 4, 41) - 0.5) * 50 * u + Math.sin(t * 0.8 + k) * 2 * u;
            put(img, x, 88 * u - f * 22 * u, open ? '#FFE7B0' : '#D5DEE3', (1 - f) * 0.6);
          }
          if (cat === 'obstacle') {
            // A plank still falling into the gorge.
            const f = frac(t * 0.35);
            put(img, gx - 9 * u + f * 3 * u, roadY + 8 * u + f * f * 30 * u, CARD.obst[3], 1 - f);
            put(img, gx - 8 * u + f * 3 * u, roadY + 8 * u + f * f * 30 * u, CARD.obst[2], 1 - f);
          }
          rain(img, W, H, t, Math.round(W / 4.5), { u, seed: 9, a: 0.3 });
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['bolt'], dither: 0.22 });
      const u = H / 200; const gx = W / 2;
      stormSky(p, W, 58 * u, {
        u, gx, gy: 20 * u, grx: 110 * u, gry: 22 * u, gk: 9, gp: 0.8, top: 1.4, hor: 3.4, seed: 31, ceilSide: 12, ceilGap: 2, ceilW: 160, curtains: 30, cloud: 2, band: 2.4, lining: 1.4,
        bands: [[gx - 70 * u, 24 * u, 70 * u, 4 * u], [gx + 84 * u, 16 * u, 60 * u, 3 * u]],
      });
      const far = ridge(W, u, { seed: 'w-far', gap: 34, y0: 26, y1: 42, sl: 1, base: 60, step: 1 });
      p.each(C.rect(0, 0, W, 64 * u), (x, y, i) => {
        if (y + 0.5 < far[x]) return;
        p.r[i] = p.ri('sky'); p.z[i] = 1; p.v[i] = 2.6 + clamp(1 - Math.abs(x - gx) / (120 * u), 0, 1) - Math.min(1, (y - far[x]) / (10 * u));
      });
      addEdge(p, 1, 0, -1, (x) => 0.6 + 3 * clamp(1 - Math.abs(x - gx) / (120 * u), 0, 1));
      // The road, from under the table up to the bridge: rough wet setts in perspective.
      const vy = -60 * u; const top = 54 * u;
      const roadL = (y) => gx - 0.5 * (y - vy) - 4 * u; const roadR = (y) => gx + 0.52 * (y - vy) + 2 * u;
      const ground = C.rect(0, top, W, H - top);
      p.fill(ground, 'rock', 1.6, 2);
      setts(p, ground, { vx: gx, vy, d0: 60 * u, rows: 26, cols: 18, seed: 41, z: 2 });
      // Puddles in the low places, the storm light lying in them, brightest on their far edges.
      const pr = rng('w-puddles'); const puddles = [];
      for (let j = 0; j < 12; j += 1) {
        const y = (64 + pr() ** 0.9 * 126) * u; const x = lerp(roadL(y) + 16 * u, roadR(y) - 16 * u, pr()); const rx = (10 + pr() * 18) * u * (0.5 + y / H);
        puddles.push([x, y, rx]);
        p.fill(C.rect(x - rx * 1.3, y - rx * 0.5, rx * 2.6, rx), 'sky', (px, py) => {
          const d = Math.hypot((px - x) / rx, (py - y) / (rx * 0.26)) + (n2(px / (4 * u), py / (2 * u), j) - 0.5) * 0.7;
          if (d > 1) return null;
          return (py < y - rx * 0.12 && d > 0.62 ? 3.6 : 2.4) - (y / H) * 1.4;
        }, 2);
      }
      // The gutter along the cliff's foot, running with rain.
      p.fill(C.poly([[roadL(top) - 1 * u, top], [roadL(top) + 3 * u, top], [roadL(H) + 6 * u, H], [roadL(H) - 1 * u, H]]), 'water', (x, y) => 2.2 + (frac((y - x * 0.4) / (5 * u)) < 0.25 ? 1.4 : 0) - y / H * 1.2, 2);
      // The cliff on the left, rising out of the road's edge: wet granite, its foot catching the light.
      const wallL = C.poly([[0, top], [roadL(top), top], [roadL(H), H], [0, H]]);
      p.fill(wallL, 'rock', (x, y) => 1.4 + (x - roadL(y)) / (80 * u), 3);
      granite(p, wallL, { u, size: 11, sx: 1, sy: 1.1, z: 3, seed: 43, lit: [0.7, -0.6], bevel: 0.9, vary: 0.8, joint: 1, jointV: -1.3, wet: 1.6, wetPer: 10 });
      moss(p, wallL, { u, z: 3, seed: 44, v: 2.4, k: 0.5, thresh: 0.42 });
      // A waterfall down it at the very edge, out of the table's way.
      fall(p, 9 * u, top, H, 6 * u, 13 * u, u, { z: 4, v: 7, seed: 45, flutes: 2.5, fade: 4.4 });
      p.light(9 * u, 70 * u, 30 * u, 2, null, { zMin: 3, zMax: 3 });
      // The parapet on the right, low and stacked, and the drop beyond it into the gorge, misty.
      const dropR = C.poly([[roadR(top) + 6 * u, top], [W, top], [W, H], [roadR(H) + 10 * u, H]]);
      p.fill(dropR, 'sky', (x, y) => {
        const m = n2(x / (22 * u), y / (4 * u), 46) * 0.7 + n2(x / (7 * u), y / (2 * u), 47) * 0.3;
        return 1 + (m > 0.55 ? 1 + (m > 0.68 ? 1 : 0) : 0) - (y / H) * 0.6;
      }, 3);
      const par = C.poly([[roadR(top), top], [roadR(top) + 6 * u, top], [roadR(H) + 10 * u, H], [roadR(H), H]]);
      p.fill(par, 'rock', (x, y) => { const d = (x + 0.5 - roadR(y)) / (6 * u + (y / H) * 4 * u); return d < 0.3 ? 2.6 : 1.4; }, 4);
      p.cells(par, { size: 6 * u, sx: 1.2, sy: 0.7, joint: 0.8, jointV: -1.2, vary: 0.7, bevel: 0.6, lit: [-0.4, -0.9], seed: 47, z: 4 });
      // The storm light from the top, on the road and the walls, falling off toward the hand.
      p.light(gx, 10 * u, 170 * u, 2.6, null, { zMin: 2, zMax: 4, sx: 1.6 });
      addEdge(p, 4, 0, -1, () => 1);
      // A pine clinging over the drop, a cairn by the cliff.
      pine(p, W - 24 * u, 150 * u, 74 * u, u, 6, { lean: 0.26, seed: 9, v: 1.4 });
      cairn(p, roadL(122 * u) + 12 * u, 122 * u, 10 * u, 5, 2);
      p.shade(null, (x, y) => -2.4 * Math.max(0, y / H - 0.32), 2);
      p.shade(null, (x, y) => -1.6 * Math.max(0, y / H - 0.4), 3);
      p.shade(null, (x, y) => -1.6 * Math.max(0, y / H - 0.4), 4);
      for (const z of [2, 3, 4]) quant(p, z, 0.5);
      // Lightning out over the peaks: the sky flashes; the ground does not.
      const bolts = [[gx - 108 * u, 6.1, 0.8], [gx + 100 * u, 7.3, 3.9], [gx + 22 * u, 9.7, 6.4]].map(([x, per, ph], k2) => {
        const tx = clamp(Math.round(x), 0, W - 1);
        p.light(x, far[tx], 90 * u, 3.4, strike(per, ph), { zMax: 1 });
        return { per, ph, segs: boltPath(x - 8 * u, 0, x, far[tx] + 1, `w-bolt-${k2}`, { jag: 0.3, forks: 2 }) };
      });
      const rip = puddles.map(([x, y, rx], j) => [x + (hash(j, 1, 9) - 0.5) * rx, y, hash(j, 2, 9) * 3, rx]);
      return {
        p,
        over(img, t) {
          for (const b of bolts) if (striking(b.per, b.ph, t)) boltOnto(img, b.segs);
          eagles(img, [[gx - 84 * u, 18 * u, 22 * u, 5 * u, 0.4, 0.25], [gx + 124 * u, 12 * u, 16 * u, 4 * u, 2.6, -0.3]], t);
          // Rings spreading in the puddles where the rain hits.
          for (const [x, y, ph, rx] of rip) {
            for (let k = 0; k < 2; k += 1) {
              const f = frac(t * 0.8 + ph + k * 0.5); const r = 1 + f * rx * 0.45;
              for (let a = 0; a < 14; a += 1) put(img, x + Math.cos(a / 14 * Math.PI * 2) * r, y + Math.sin(a / 14 * Math.PI * 2) * r * 0.26, '#243042', (1 - f) * 0.8);
            }
          }
          // The waterfall running.
          for (let j = 0; j < 14; j += 1) {
            const x = 9 * u + (hash(j, 1, 51) - 0.5) * 9 * u; const y = top + frac(t * 0.8 + hash(j, 2, 51)) * (H - top);
            put(img, x, y, '#B2BFC6', 0.7 * (1 - y / H));
          }
          rain(img, W, H, t, 150, { u, seed: 13, a: 0.3, len: 4, mask: (x, y) => y < 60 * u || x < 26 * u || x > W - 26 * u || hash(Math.round(x), Math.round(y), 2) < 0.4 });
        },
      };
    },
  };

  /* ================= B: the cave under the pass ================= */

  const RAMPS_B = {
    rock: RAMPS_A.rock,
    quartz: ['#141B26', '#1F2A3A', '#2E3E55', '#425775', '#5B7495', '#7B94B4', '#A0B6CF', '#C6D6E6', '#E6EEF6', '#FFFFFF'],
    water: RAMPS_A.water,
    ember: ['#1E0D05', '#4A1F0A', '#7E3A12', '#B8621F', '#E39A3E', '#FFD58A'],
    wood: RAMPS_A.wood, rope: RAMPS_A.rope, cloth: RAMPS_A.cloth, shadow: RAMPS_A.shadow,
    sky: RAMPS_A.sky, sun: RAMPS_A.sun, bolt: RAMPS_A.bolt,
    ...CARD,
  };
  // Layers: 1 the walls, 2 the hollow and veins, 3 stalagmites and columns, 4 stalactites, 5 the floor's things, 6+ the card.
  // No daylight anywhere: every light is the quartz's own glow ('quartz' is emissive), and the embers of a fire.

  /**
   * A seam of quartz in the rock, following its strata: a wavy band along
   * yAt(x) from x0 to x1, thick in the middle and pinching out at its ends,
   * set in a darker seam of rock. Branches split off it, cross to the next
   * bed and pinch out; a cluster of crystals bursts from the end of each.
   * Returns the clusters' tips.
   */
  function seam(p, x0, x1, yAt, w, u, o = {}) {
    const z = o.z ?? 2; const v = o.v ?? 6; const r = rng(`${o.seed}-s`); const tips = [];
    const band = (xa, xb, yf, ww, pinchA) => {
      const n = Math.max(1, Math.round(Math.abs(xb - xa))); const sgn = xb > xa ? 1 : -1;
      for (let k = 0; k <= n; k += 1) {
        const x = xa + sgn * k; const t = k / n;
        // Swelling and pinching along its length, like lenses strung on a thread.
        const lens = 0.35 + 0.9 * Math.abs(Math.sin(x / (7 * u) + (o.ph ?? 0)));
        const th = Math.max(1, ww * (pinchA ? Math.sin(Math.PI * t) ** 0.5 : (1 - t) ** 0.7) * lens);
        const yc = yf(x);
        p.shade(C.rect(Math.round(x), Math.round(yc - th / 2 - 1.4 * u), 1, Math.round(th + 2.8 * u)), -1.1, 1);
        // A granular core: crystal faces catching the glow at random, not a smooth stroke.
        p.fill(C.rect(Math.round(x), Math.round(yc - th / 2), 1, Math.max(1, Math.round(th))), 'quartz',
          (px, py) => v - 1 + (Math.abs(py + 0.5 - yc) < th * 0.3 ? 0.8 : -0.4) + (hash(px, py, 77) < 0.3 ? 1.8 : hash(px, py, 78) < 0.15 ? -1 : 0), z);
      }
    };
    band(x0, x1, yAt, w, true);
    // Branches: off the band, across to the next bed, pinching out at a cluster.
    for (let b = 0; b < (o.branches ?? 2); b += 1) {
      const t = 0.2 + r() * 0.6; const xb = lerp(x0, x1, t); const dir = r() < 0.5 ? -1 : 1; const slope = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.4);
      const L = (o.branchLen ?? 18) * u * (0.6 + r() * 0.6);
      const yf = (x) => yAt(x) + slope * Math.abs(x - xb) + Math.sin(Math.abs(x - xb) / (5 * u)) * 1.2 * u;
      band(xb, xb + dir * L, yf, w * 0.55, false);
      const ex = xb + dir * L; const ey = yf(ex);
      if (o.clusters !== false) tips.push(...quartz(p, ex, ey + 1 * u, (o.tip ?? 5) * u, u, { seed: `${o.seed}-b${b}`, n: 3, v: v - 0.6, dir: Math.atan2(-0.8, dir * 0.6), spread: 0.5, z }));
    }
    // A cluster at each end.
    if (o.ends !== false) {
      for (const [ex, m] of [[x0, -1], [x1, 1]]) {
        if (o.ends === 'left' && m > 0) continue; if (o.ends === 'right' && m < 0) continue;
        tips.push(...quartz(p, ex, yAt(ex) + 1 * u, (o.endTip ?? 8) * u, u, { seed: `${o.seed}-e${m}`, n: 4, v: v - 0.4, dir: Math.atan2(-0.9, m * 0.5), spread: 0.6, z }));
      }
    }
    // Its glow on the rock round it.
    const mx = (x0 + x1) / 2; const len = Math.abs(x1 - x0) / 2; const rr = Math.max(8 * u, w * 3 + 6 * u);
    if (o.halo !== false) p.light(mx, yAt(mx), rr, o.halo ?? 2.6, null, { zMin: 1, zMax: 1, sx: Math.max(1, len / rr), hard: true });
    return tips;
  }

  /** The beds of the rock: wavy lines across it, `gap` apart; strata(x) is how far a bed rises or falls at x. */
  const strata = (u, seed) => (x) => 3 * u * Math.sin(x / (17 * u) + seed) + (n1(x / (31 * u), seed) - 0.5) * 7 * u;
  function beds(p, shape, u, gap, st, z, dv = -1.1) {
    p.shade(shape, (x, y) => (frac((y + 0.5 - st(x)) / gap) < 0.1 ? dv : frac((y + 0.5 - st(x)) / gap) < 0.2 ? 0.6 : 0), z);
  }

  /** A cluster of quartz crystals growing from (cx, cy) toward `dir`: hexagonal prisms, each lit down one face, a bright tip. */
  function quartz(p, cx, cy, h, u, o = {}) {
    const r = rng(o.seed || 'q'); const z = o.z ?? 2; const n = o.n ?? 5; const v = o.v ?? 5; const dir = o.dir ?? -Math.PI / 2; const spread = o.spread ?? 0.9;
    const tips = [];
    const list = [];
    for (let i = 0; i < n; i += 1) { const f = n > 1 ? i / (n - 1) - 0.5 : 0; list.push({ a: dir + f * spread * 1.6 + (r() - 0.5) * spread * 0.5, L: h * (0.35 + r() * 0.65) * (1 - Math.abs(f) * 0.6), w: Math.max(1.6, h * (0.17 + r() * 0.08)), ox: f * h * 0.45 }); }
    list.sort((a, b) => b.L - a.L);
    for (const c of list) {
      const bx = cx + c.ox; const ca = Math.cos(c.a); const sa = Math.sin(c.a);
      const nx = -sa; const ny = ca;
      const tx = bx + ca * c.L; const ty = cy + sa * c.L;
      const sx = bx + ca * c.L * 0.78; const sy = cy + sa * c.L * 0.78;
      const hw = c.w / 2;
      p.fill(C.poly([[bx + nx * hw, cy + ny * hw], [sx + nx * hw, sy + ny * hw], [tx, ty], [sx - nx * hw, sy - ny * hw], [bx - nx * hw, cy - ny * hw]]), 'quartz',
        (x, y) => { const side = (x + 0.5 - bx) * nx + (y + 0.5 - cy) * ny; return v + (side > hw * 0.15 ? 1.4 : side < -hw * 0.4 ? -1 : 0) + (Math.hypot(x - tx, y - ty) < 2 ? 1.6 : 0); }, z);
      tips.push([Math.round(tx), Math.round(ty)]);
    }
    return tips;
  }

  /** Stalactites hanging from hangAt(x): lumpy stone cones, lit on the side toward litX, a wet bead at each tip. */
  function stalactites(p, x0, x1, hangAt, u, o) {
    const r = rng(o.seed); const z = o.z ?? 4; const tips = [];
    for (let x = x0 + r() * 3 * u; x < x1;) {
      const y0 = hangAt(x);
      const big = r() < (o.big ?? 0.3);
      const L = (big ? o.max * (0.6 + r() * 0.4) : o.min + r() * (o.max - o.min) * 0.45) * u; const w = Math.max(2, L * (0.22 + r() * 0.12));
      const tx = x + (r() - 0.5) * w * 0.3; const lit = o.litX === undefined ? 1 : (x < o.litX ? 1 : -1);
      p.fill(C.poly([[x - w / 2, y0 - 2], [x + w / 2, y0 - 2], [x + w * 0.32, y0 + L * 0.45], [tx + 0.6, y0 + L], [tx - 0.6, y0 + L], [x - w * 0.3, y0 + L * 0.5]]), 'rock',
        (px, py) => (o.v ?? 2) + ((px - x) * lit > w * 0.08 ? (o.lit ?? 1.6) : (px - x) * lit < -w * 0.2 ? -0.6 : 0) - ((py - y0) / L > 0.85 ? -0.6 : 0), z);
      tips.push([Math.round(tx), Math.round(y0 + L)]);
      x += (big ? 4 : 2) * u + r() * (o.gap ?? 5) * u;
    }
    return tips;
  }

  /** A stalagmite: a rounded stone cone up from the floor, ringed by growth bands, lit on one side. */
  function stalagmite(p, x, by, h, w, u, o = {}) {
    const z = o.z ?? 3; const lit = o.lit ?? 1;
    const pts = [];
    for (let i = 0; i <= 10; i += 1) { const t = i / 10; pts.push([x - (w / 2) * (1 - t ** 1.6) - (hash(i, 1, Math.round(x)) - 0.5) * u, by - h * t]); }
    pts.push([x + 0.6, by - h - 0.6 * u]);
    for (let i = 10; i >= 0; i -= 1) { const t = i / 10; pts.push([x + (w / 2) * (1 - t ** 1.6) + (hash(i, 2, Math.round(x)) - 0.5) * u, by - h * t]); }
    p.fill(C.poly(pts), 'rock', (px, py) => (o.v ?? 2) + ((px - x) * lit < -w * 0.1 ? 1.4 : (px - x) * lit > w * 0.2 ? -0.6 : 0) + (frac((by - py) / (3 * u)) < 0.18 ? -0.6 : 0), z);
  }

  /** A column where a stalactite met its stalagmite: waisted, banded with flowstone, lit on one side. */
  function cavecol(p, x, top, bottom, w, u, o = {}) {
    const z = o.z ?? 3; const lit = o.lit ?? 1; const seed = Math.round(x);
    const hw = (y) => { const t = (y - top) / (bottom - top); return (w / 2) * (0.5 + 0.5 * Math.abs(t - 0.5) * 2 ** 1) + (t < 0.12 ? (0.12 - t) * w * 2.4 : 0) + (t > 0.85 ? (t - 0.85) * w * 2.6 : 0) + (n1(y / (4 * u), seed) - 0.5) * 1.4 * u; };
    const pts = [];
    for (let i = 0; i <= 18; i += 1) { const y = lerp(top, bottom, i / 18); pts.push([x - hw(y), y]); }
    for (let i = 18; i >= 0; i -= 1) { const y = lerp(top, bottom, i / 18); pts.push([x + hw(y), y]); }
    p.fill(C.poly(pts), 'rock', (px, py) => { const q = (px + 0.5 - x) / hw(py) * lit; return (o.v ?? 2) + (q < -0.3 ? 1.6 : q > 0.45 ? -0.7 : 0.3) + (frac(py / (2.6 * u) + n1(px / (3 * u), seed) * 0.6) < 0.2 ? -0.7 : 0); }, z);
  }

  /** The owlbear, reared up: a bear's barrel body on its hind legs, arms raised with hooked claws, an owl's round head with ear tufts, and two round eyes. */
  function owlbear(p, cx, fy, s, z, ramp) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    p.fill(P([[-0.22, 0], [-0.24, -0.16], [-0.28, -0.3], [-0.31, -0.46], [-0.3, -0.6], [-0.22, -0.7], [-0.12, -0.73], [0.12, -0.73], [0.22, -0.7], [0.3, -0.6], [0.31, -0.46], [0.28, -0.3], [0.24, -0.16], [0.22, 0],
      [0.08, 0], [0.06, -0.12], [-0.06, -0.12], [-0.08, 0]]), 'shadow', 0.8, z);
    // The head: round, the ear tufts up and out, a beak hooked under the eyes.
    p.fill(C.ellipse(cx, fy - 0.83 * s, 0.17 * s, 0.14 * s, 20), 'shadow', 0.8, z);
    for (const m of [-1, 1]) {
      p.fill(P([[m * 0.08, -0.93], [m * 0.17, -1.06], [m * 0.19, -0.95], [m * 0.15, -0.86]]), 'shadow', 0.8, z);
      // The arm, raised, the paw spread, three hooked claws.
      p.fill(P([[m * 0.22, -0.66], [m * 0.36, -0.82], [m * 0.46, -0.98], [m * 0.54, -0.96], [m * 0.48, -0.84], [m * 0.4, -0.66], [m * 0.3, -0.54]]), 'shadow', 0.8, z);
      for (const [a, b] of [[0.42, -1.0], [0.5, -1.04], [0.57, -1.0]]) p.fill(P([[m * (a - 0.02), b + 0.04], [m * (a + 0.01), b - 0.04], [m * (a + 0.04), b - 0.02], [m * (a + 0.03), b + 0.04]]), 'shadow', 0.8, z);
      // The hind feet, clawed.
      p.fill(P([[m * 0.08, 0], [m * 0.26, 0], [m * 0.3, 0.03], [m * 0.08, 0.03]]), 'shadow', 1.2, z);
    }
    p.fill(P([[-0.03, -0.8], [0.03, -0.8], [0, -0.74]]), 'shadow', 2.6, z + 1);
    const ey = Math.round(fy - 0.86 * s); const ex = Math.max(2, Math.round(0.075 * s));
    for (const m of [-1, 1]) p.fill(C.rect(Math.round(cx) + (m < 0 ? -ex - 2 : ex), ey, 2, 2), ramp, 3.6, z + 2);
    return { ex: cx, ey };
  }

  /** An iron-bound coffer left on a flat rock, its lid thrown back, light of the card's colour spilling out. */
  function coffer(p, cx, fy, s, z, ramp) {
    const w = s * 0.5; const h = s * 0.36;
    p.fill(C.poly([[cx - w * 0.95, fy - h], [cx - w * 0.82, fy - h - s * 0.4], [cx + w * 0.82, fy - h - s * 0.4], [cx + w * 0.95, fy - h]]), 'wood', 3.4, z);
    p.fill(C.rect(cx - w * 0.8, fy - h - s * 0.36, w * 1.6, 1), 'shadow', 3, z + 1);
    p.fill(C.rect(cx - w * 0.86, fy - h - s * 0.12, w * 1.72, s * 0.14), ramp, (x, y) => (y < fy - h - s * 0.06 ? 4.6 : 3.4), z + 1);
    for (const [ox, oy] of [[-0.3, -0.22], [0.12, -0.3], [0.34, -0.2], [-0.08, -0.17]]) p.fill(C.rect(cx + ox * s, fy - h + oy * s, 1, 1), ramp, 4.6, z + 2);
    p.fill(C.rect(cx - w, fy - h, w * 2, h), 'wood', (x, y) => 4.4 - (y - (fy - h)) / h * 2 + ((x - cx + w) % (s * 0.22) < 1 ? -1 : 0), z);
    p.fill(C.rect(cx - w, fy - h, w * 2, 1.2), 'wood', 6.4, z + 1);
    for (const x of [cx - w * 0.72, cx + w * 0.72 - 2]) p.fill(C.rect(x, fy - h, 2, h), 'shadow', 3.4, z + 1);
    p.fill(C.rect(cx - 1.5, fy - h + 2, 3, 3), 'shadow', 3.8, z + 1);
    return [cx, fy - h - s * 0.05];
  }

  /** A traveller's pack slumped against a rock, a bedroll strapped on top. */
  function pack(p, cx, fy, s, z) {
    p.fill(C.poly([[cx - s * 0.4, fy], [cx - s * 0.46, fy - s * 0.5], [cx - s * 0.24, fy - s * 0.8], [cx + s * 0.22, fy - s * 0.78], [cx + s * 0.4, fy - s * 0.4], [cx + s * 0.36, fy]]), 'cloth', (x) => 1.6 + (x < cx ? 0.8 : 0), z);
    p.fill(C.ellipse(cx, fy - s * 0.84, s * 0.4, s * 0.14, 14), 'wood', (x) => 3 + (x < cx ? 1 : 0), z);
    p.fill(C.rect(cx - s * 0.06, fy - s * 0.95, 1, s * 0.4), 'rope', 2, z + 1);
  }

  /** The travellers' fire, burned down: a ring of stones, the embers still red in it, a charred stick. */
  function embers(p, cx, fy, s, z) {
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2; const x = cx + Math.cos(a) * s * 0.55; const y = fy + Math.sin(a) * s * 0.16;
      p.fill(C.ellipse(x, y - s * 0.06, s * 0.13, s * 0.09, 10), 'rock', (px, py) => 4.4 - (py - y) / (s * 0.1) * 1.2, z + (Math.sin(a) > 0 ? 1 : 0));
    }
    p.fill(C.ellipse(cx, fy, s * 0.4, s * 0.1, 14), 'ember', (x, y) => (hash(Math.round(x), Math.round(y), 3) < 0.4 ? 3.4 : 2) + (Math.abs(x - cx) < s * 0.15 ? 1 : 0), z);
    p.fill(C.poly([[cx - s * 0.36, fy - s * 0.02], [cx + s * 0.2, fy - s * 0.2], [cx + s * 0.24, fy - s * 0.15], [cx - s * 0.32, fy + s * 0.03]]), 'shadow', 1.6, z + 1);
    return [cx, fy - 1];
  }

  /**
   * The crystal hollow: an opening in the back wall at the foot of the great
   * vein, lined with quartz, its back a mass of crystals glowing blue-white.
   * open: the crystals part on a passage full of gold light.
   */
  function hollow(p, cx, top, hw, bottom, u, o = {}) {
    const seed = o.seed || 3;
    const pts = [];
    const sq = 0.9; const spring = top + hw * sq;
    for (let i = 0; i <= 6; i += 1) pts.push([cx - hw, lerp(bottom, spring, i / 6)]);
    for (let i = 0; i <= 20; i += 1) { const a = Math.PI - (i / 20) * Math.PI; pts.push([cx + hw * Math.cos(a), spring - hw * sq * Math.sin(a)]); }
    for (let i = 6; i >= 0; i -= 1) pts.push([cx + hw, lerp(bottom, spring, i / 6)]);
    const shape = C.poly(pts.map(([x, y], i) => (y >= bottom - 0.01 ? [x, y] : [x + (hash(i, 1, seed) - 0.5) * 3 * u, y + (hash(i, 2, seed) - 0.5) * 2 * u])));
    // The rim: rock lit by the glow inside it.
    p.fill(C.join(shape, C.poly(pts.map(([x, y]) => [cx + (x - cx) * 1.14, y < bottom - 0.01 ? top + (y - top) * 1.02 - 2 * u : y]))), 'rock', 3.4, 2);
    if (o.open) {
      // A passage through the crystals, gold.
      p.fill(shape, 'quartz', (x, y) => 4 + clamp(1 - Math.hypot((x - cx) / hw, (y - bottom) / (bottom - top)), 0, 1) * 2, 2);
      const lane = C.poly([[cx - hw * 0.5, bottom], [cx - hw * 0.16, top + hw * 0.9], [cx + hw * 0.16, top + hw * 0.9], [cx + hw * 0.5, bottom]]);
      p.fill(lane, 'sun', (x, y) => 3.4 + 3.6 * clamp(1 - Math.abs(x - cx) / (hw * 0.5), 0, 1) * clamp((y - top) / (bottom - top) + 0.4, 0, 1), 2);
    } else {
      const k = o.k ?? 1;
      p.fill(shape, 'quartz', (x, y) => Math.round(1 + (1.4 + 3.4 * clamp(1.1 - Math.hypot((x - cx) / hw, (y - (bottom - (bottom - top) * 0.25)) / ((bottom - top) * 0.75)), 0, 1)) * k), 2);
    }
    // Crystals growing in from its walls, pointing at its middle.
    const tips = [];
    const r = rng(`hollow-${seed}`);
    for (let k = 0; k < 16; k += 1) {
      const t = k / 15; const a = Math.PI + t * Math.PI; // round the arch from left to right
      const px = cx + Math.cos(a) * hw * 0.92; const py = Math.min(bottom - 2 * u, spring + Math.sin(a) * hw * sq * 0.92);
      if (o.open && Math.abs(px - cx) < hw * 0.4 && py > top + hw * 0.6) continue;
      const dir = Math.atan2((bottom - (bottom - top) * 0.4) - py, cx - px);
      tips.push(...quartz(p, px, py, (5 + r() * 7) * u, u, { seed: `h-${seed}-${k}`, n: 3, v: o.open ? 4 : 2.6 + 3 * (o.k ?? 1), dir, spread: 0.5, z: 2 }));
    }
    // And a bed of them along its floor.
    for (let k = 0; k < 5; k += 1) {
      const px = cx + (k / 4 - 0.5) * hw * 1.5;
      if (o.open && Math.abs(px - cx) < hw * 0.4) continue;
      tips.push(...quartz(p, px, bottom, (6 + r() * 8) * u, u, { seed: `hf-${seed}-${k}`, n: 4, v: 2.8 + 3 * (o.k ?? 1), dir: -Math.PI / 2 + (cx - px) / hw * 0.4, spread: 0.6, z: 2 }));
    }
    return { shape, tips };
  }

  function twinkle(img, tips, t, hex = '#E6EEF6') {
    tips.forEach(([x, y], i) => {
      const a = clamp(Math.sin(t * 1.5 + i * 2.3) * 1.6 - 0.7, 0, 1);
      if (a <= 0) return;
      put(img, x, y, hex, a); put(img, x - 1, y, hex, a * 0.4); put(img, x + 1, y, hex, a * 0.4); put(img, x, y - 1, hex, a * 0.4);
    });
  }

  const B = {
    job: 0, setting: 'high-road', key: 'B', id: 'high-road-b', side: 'inside',
    name: 'The High Road', title: 'The cave under the pass',
    pitch: 'Out of the storm, into the mountain. A cavern in the same green-grey granite, stalactites overhead and a cold stream across the floor, lit by seams of quartz that glow pale blue-white along the rock’s beds. Someone sheltered here before you; their fire is still warm.',
    notes: [
      ['Light', 'The quartz’s own cold blue-white glow, brightest in a crystal hollow where the great seam swells into a pocket, falling to black between the clusters. The embers of an old fire are the only warm light, and they are small. On a face-down card the way on is a ragged opening dropping into the dark between two seams, with no light at its end.'],
      ['Detail', 'The outside’s granite, lumpy and wet, stalactites with dripping tips, stalagmites and columns, wavy seams of quartz following the beds, branching and pinching out in clusters of crystals, a fallen boulder at the way on, a stream holding the glow, a ring of fire stones, a pack left behind.'],
      ['Vista', 'The cavern runs the width of the board, a seam and its cluster at each pitch, a pool of light round each and dark between. The card waits across the stream before the crystal hollow: an owlbear reared up, a goatherd sheltering with his lantern and goat, a coffer spilling violet, a rockfall choking the hollow, the crystals parting on a passage of gold.'],
      ['World', 'The cave floor under the table, wet and dark, the stream running down one side, quartz glowing at the edges and the fire’s last embers in a corner; drips falling.'],
    ],
    palette: ['#050606', '#1B201D', '#38403A', '#687169', '#2E3E55', '#7B94B4', '#C6D6E6', '#FFFFFF', '#B8621F'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['quartz', 'ember'], dither: 0.22 });
      const u = H / 134; const gx = W / 2; const floorY = 98 * u;
      const mcx = gx - 1 * u; const vpY = 80 * u; // the way on, and where the walls' beds run to
      // The chamber's walls: lumpy granite, its beds running in toward the way on.
      const all = C.rect(0, 0, W, H);
      p.fill(all, 'rock', 1, 1);
      p.cells(C.rect(0, 0, gx, H), { size: 8 * u, sx: 1.1, sy: 0.9, joint: 0.9, jointV: -1.1, vary: 0.6, bevel: 1.1, lit: [0.8, -0.5], seed: 31, z: 1 });
      p.cells(C.rect(gx, 0, W - gx, H), { size: 8 * u, sx: 1.1, sy: 0.9, joint: 0.9, jointV: -1.1, vary: 0.6, bevel: 1.1, lit: [-0.8, -0.5], seed: 32, z: 1 });
      p.shade(C.rect(0, 0, W, floorY), (x, y) => {
        const a = Math.atan2(y + 0.5 - vpY, Math.abs(x + 0.5 - mcx) + 6 * u) + n1(Math.abs(x - mcx) / (9 * u), x > mcx ? 5 : 6) * 0.06;
        const f = frac(a / 0.14); return f < 0.12 ? -1.2 : f < 0.24 ? 0.6 : 0;
      }, 1);
      // The way on: a ragged opening in the far wall, rock teeth round its lip, the passage dropping away inside it.
      const mTop = 58 * u; const mBot = floorY + 1 * u;
      const lip = (k) => {
        const pts = [];
        for (let i = 0; i <= 26; i += 1) {
          const a = Math.PI + (i / 26) * Math.PI;
          const rx = (i < 13 ? 15 : 12) * u * k; const ry = (mBot - mTop) * k;
          const jag = 1 + (n1(i * 0.9, 41) - 0.5) * 0.36 + (hash(i, 3, 41) - 0.5) * 0.12;
          pts.push([mcx + Math.cos(a) * rx * jag, Math.min(mBot, mBot + Math.sin(a) * ry * jag)]);
        }
        return pts;
      };
      const outer = lip(1);
      p.fill(C.poly(outer.map(([x, y]) => [mcx + (x - mcx) * 1.16, y < mBot - 0.01 ? mBot - (mBot - y) * 1.08 : y])), 'rock', 2.2, 9);
      p.fill(C.poly(outer), 'shadow', 1.2, 10);
      // Inside: the floor drops away, so the passage's rings run down as they go deeper, darker each time.
      [[0.78, 0.9, 4], [0.58, 0.6, 9], [0.4, 0.3, 14], [0.24, 0, 19]].forEach(([k, v, dy], j) => {
        p.fill(C.poly(lip(k).map(([x, y]) => [x, y + dy * u * 0.6])), 'shadow', v, 11 + j);
      });
      // Two ledges at the lip, the first steps down.
      for (const [y, w, v] of [[mBot - 3 * u, 11, 2.6], [mBot - 6.5 * u, 7, 1.6]]) {
        p.fill(C.poly([[mcx - w * u, y + 2 * u], [mcx - w * 0.9 * u, y], [mcx + w * 0.8 * u, y + 0.5 * u], [mcx + w * u, y + 2.4 * u]]), 'rock', v, 15);
        p.fill(C.rect(mcx - w * 0.9 * u, y, w * 1.7 * u, 1), 'rock', v + 1.6, 15);
      }
      // Rock teeth hanging from its upper lip and standing up from its sill.
      const r = rng('b-teeth');
      for (let k = 0; k < 7; k += 1) {
        const i = 4 + Math.floor((k / 6) * 18 + r() * 2); const [tx, ty] = outer[Math.min(25, i)];
        const L = (3 + r() * 6) * u; const w = (1.6 + r() * 1.6) * u;
        p.fill(C.poly([[tx - w, ty - 1 * u], [tx + w, ty - 1 * u], [tx + w * 0.2, ty + L]]), 'rock', (x) => 2.4 + (x < tx ? 0 : 1.4), 16);
      }
      for (const [dx, h] of [[-9, 5], [6, 4]]) p.fill(C.poly([[mcx + (dx - 2) * u, mBot + 1], [mcx + (dx - 0.3) * u, mBot - h * u], [mcx + (dx + 2) * u, mBot + 1]]), 'rock', (x) => 2.2 + (x > mcx + dx * u ? 1.4 : 0), 16);
      // The floor in front, wet rock, and the stream winding down into the dark.
      const flo = C.rect(0, floorY, W, H - floorY);
      p.fill(flo, 'rock', (x, y) => 1.2 + (y - floorY) / (H - floorY) * 0.8, 17);
      p.cells(flo, { size: 6 * u, sx: 1.7, sy: 0.6, joint: 0.8, jointV: -1, vary: 0.6, bevel: 0.7, lit: [0, -1], seed: 41, z: 17 });
      const sx = (y) => { const t = (y - floorY) / (H - floorY); return mcx + 2 * u + Math.sin(t * 4.4 + 0.3) * 8 * u * t ** 0.7 + t * 6 * u; };
      const sw = (y) => lerp(3 * u, 12 * u, ((y - floorY) / (H - floorY)) ** 1.1);
      p.fill(flo, 'water', (x, y) => {
        const d = Math.abs(x + 0.5 - sx(y)); if (d > sw(y)) return null;
        return 0.8 + (d > sw(y) - 1 ? 1.6 : 0) + (hash(Math.floor(x / 2), Math.floor(y / (1.6 * u)), 8) < 0.06 ? 1.8 : 0);
      }, 18);
      // A boulder fallen from the roof, half across the opening.
      const bx = mcx - 13 * u; const by = floorY + 4 * u;
      const boulder = C.poly([[bx - 10 * u, by], [bx - 9 * u, by - 7 * u], [bx - 4 * u, by - 12 * u], [bx + 3 * u, by - 13 * u], [bx + 8 * u, by - 9 * u], [bx + 10 * u, by - 3 * u], [bx + 9 * u, by]]);
      p.fill(boulder, 'rock', (x, y) => 2.6 + (x > bx - 2 * u && y < by - 6 * u ? 3 : x > bx + 2 * u ? 1.6 : 0), 19);
      p.cells(boulder, { size: 5 * u, joint: 0.8, jointV: -1.2, vary: 0.6, bevel: 1, lit: [0.7, -0.7], seed: 44, z: 19 });
      p.shade(C.ellipse(bx + 2 * u, by + 1 * u, 13 * u, 2.4 * u, 16), -1, 17);
      // The quartz: seams along the beds on either wall, pinching out in clusters beside the opening; a cluster at each foot.
      const tipsR = [
        ...seam(p, gx + 17 * u, W + 3 * u, (x) => 70 * u - (x - (gx + 17 * u)) * 0.95 + Math.sin(x / (5 * u)) * 1.4 * u, 4 * u, u, { seed: 'b-s1', z: 20, v: 6, branches: 2, branchLen: 12, ends: 'left', endTip: 7, halo: false }),
        ...quartz(p, gx + 19 * u, floorY + 1 * u, 14 * u, u, { seed: 'b-q1', n: 7, v: 5.4, dir: -Math.PI / 2 - 0.15, spread: 0.6, z: 21 }),
      ];
      const tipsL = [
        ...seam(p, -3 * u, gx - 21 * u, (x) => 50 * u + (x + 3 * u) * 0.62 + Math.sin(x / (5 * u) + 2) * 1.2 * u, 3 * u, u, { seed: 'b-s2', z: 20, v: 5.6, branches: 1, branchLen: 10, ends: 'right', endTip: 5, halo: false }),
        ...quartz(p, gx - 26 * u, floorY + 1 * u, 9 * u, u, { seed: 'b-q2', n: 5, v: 4.6, dir: -Math.PI / 2 + 0.2, spread: 0.6, z: 21 }),
      ];
      p.light(gx + 18 * u, 72 * u, 56 * u, 5.4, null, { zMin: 1, zMax: 19, hard: true });
      p.light(gx + 18 * u, 72 * u, 96 * u, 1.6, null, { zMin: 1, zMax: 19 });
      p.light(gx - 22 * u, 76 * u, 30 * u, 3, null, { zMin: 1, zMax: 19, hard: true });
      addEdge(p, 9, 0, -1, () => 1.4); addEdge(p, 16, 1, 0, () => 1.6); addEdge(p, 19, 0, -1, () => 1.8);
      // Nothing lights the passage itself: whatever reached it goes dark again inside.
      for (let z = 10; z <= 14; z += 1) p.shade(null, (x, y) => -1.6 * clamp((y - mTop) / (mBot - mTop) + 0.4, 0, 1), z);
      // The stream holding the cluster's light, in short broken glints.
      p.each(flo, (x, y, i) => {
        if (p.r[i] !== p.ri('water')) return;
        const w = 1 - Math.hypot((x + 0.5 - (gx + 12 * u)) / (14 * u), (y - floorY) / (26 * u));
        if (w <= 0 || hash(Math.floor(x / 3), Math.floor(y / (1.4 * u)), 6) > 0.22 + w * 0.3) return;
        p.r[i] = p.ri('quartz'); p.v[i] = 2 + w * 4;
      });
      // The roof: stalactites hanging inside the arch.
      const roof = (x) => 3 * u + Math.abs(x - gx) * 0.1 + (n1(x / (6 * u), 3) - 0.5) * 4 * u;
      const drips = stalactites(p, -2 * u, W + 2 * u, roof, u, { seed: 'b-roof', min: 4, max: 24, big: 0.3, gap: 4, v: 1.8, lit: 2.4, litX: gx + 18 * u, z: 22 });
      p.light(gx + 18 * u, 50 * u, 70 * u, 4, null, { zMin: 22, zMax: 22, hard: true });
      addEdge(p, 22, 0, 1, () => 1.4);
      // The fire, burned down, on the bank at the lower left; a pack left by it.
      const fire = embers(p, gx - 30 * u, 124 * u, 15 * u, 23);
      p.light(fire[0], fire[1] - 2 * u, 22 * u, 3, null, { zMin: 1, zMax: 23, hard: true });
      pack(p, gx - 41 * u, 130 * u, 12 * u, 23);
      vignette(p, W, H, 1.5, 0.48);
      for (const z of [1, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23]) quant(p, z);
      p.tint(fire[0], fire[1] - 2 * u, 8 * u, '#E39A3E', 0.3);
      return {
        p,
        over(img) {
          twinkle(img, [...tipsR, ...tipsL].filter((_, i) => i % 3 === 0), 0.8);
          for (const [x, y] of drips.filter((_, i) => i % 4 === 1)) put(img, x, y + 2, '#7B94B4', 0.8);
          for (let k = 0; k < 4; k += 1) put(img, fire[0] + (k % 2) - 1, fire[1] - 3 * u - k * 2 * u, '#5B7495', 0.45 - k * 0.1);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['quartz', 'ember', 'sun', 'path'], dither: 0.22 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const floorY = 80 * u; const fy = 83 * u;
      // The back wall: granite, jointed, near black away from the lights.
      const wall = C.rect(0, 0, W, floorY + 2 * u);
      p.fill(wall, 'rock', 1.1, 1);
      p.cells(C.rect(0, 0, gx, floorY + 2 * u), { size: 9 * u, sx: 1.1, sy: 0.9, joint: 0.9, jointV: -1.1, vary: 0.6, bevel: 1.1, lit: [0.8, -0.6], seed: 61, z: 1 });
      p.cells(C.rect(gx, 0, W - gx, floorY + 2 * u), { size: 9 * u, sx: 1.1, sy: 0.9, joint: 0.9, jointV: -1.1, vary: 0.6, bevel: 1.1, lit: [-0.8, -0.6], seed: 61, z: 1 });
      p.cells(wall, { size: 3.4 * u, joint: 0.6, jointV: -0.5, vary: 0.3, bevel: 0.3, seed: 62, z: 1 });
      const st = strata(u, 2);
      beds(p, C.rect(0, 0, W, floorY), u, 11 * u, st, 1);
      // The floor: the far bank, the stream, the near bank.
      p.fill(C.rect(0, floorY, W, H - floorY), 'rock', 1.2, 1);
      p.cells(C.rect(0, floorY, W, 8 * u), { size: 5 * u, sx: 1.8, sy: 0.5, joint: 0.7, jointV: -0.9, vary: 0.6, bevel: 0.6, lit: [0, -1], seed: 62, z: 1 });
      const sTop = (x) => 88 * u + Math.sin(x / (21 * u)) * 1.2 * u; const sBot = (x) => 95 * u + Math.sin(x / (17 * u) + 2) * 1.2 * u;
      p.fill(C.rect(0, 86 * u, W, 12 * u), 'water', (x, y) => (y < sTop(x) || y > sBot(x) ? null : 1.4 + (y - sTop(x) < 1 ? 1.4 : 0)), 1);
      p.cells(C.rect(0, 94 * u, W, 6 * u), { size: 3 * u, sx: 1.5, sy: 0.7, joint: 0.6, jointV: -0.9, vary: 0.8, bevel: 0.6, lit: [0, -1], seed: 63, z: 1 });
      // The great vein and the hollow at its foot, the focal light.
      const hTop = 24 * u; const hw = 22 * u;
      const hk = cat === 'wanderer' ? 0.55 : cat === 'item' ? 0.5 : 1;
      const hol = hollow(p, gx, hTop, hw, floorY + 1 * u, u, { seed: 5, open, k: hk });
      p.light(gx, 58 * u, 84 * u, open ? 6.4 : 5.6 * hk, null, { zMin: 1, zMax: 1, hard: true });
      p.light(gx, 58 * u, 40 * u, open ? 2.4 : 1.6, null, { zMin: 1, zMax: 1 });
      // Clusters along the cavern, each with its own pool of light and dark between.
      const tips = [...hol.tips];
      // The great seam: a band of quartz along one bed, swelling into the hollow from either side: the hollow is its pocket.
      const bedAt = (y) => Math.round(y / (11 * u)) * 11 * u;
      tips.push(...seam(p, gx - 66 * u, gx - hw + 1 * u, (x) => bedAt(50 * u) + st(x) + 1 * u, 5 * u, u, { seed: 'v-seamL', z: 2, v: 6, branches: 2, branchLen: 14, ends: 'left', endTip: 8, halo: 3 }));
      tips.push(...seam(p, gx + hw - 1 * u, gx + 66 * u, (x) => bedAt(39 * u) + st(x) + 1 * u, 5 * u, u, { seed: 'v-seamR', z: 2, v: 6, ph: 1.7, branches: 2, branchLen: 14, ends: 'right', endTip: 8, halo: 3 }));
      const pools = [];
      for (let d = 72 * u, k = 0; d < W / 2 + 30 * u; d += (78 + hash(k, 0, 5) * 20) * u, k += 1) {
        for (const m of [-1, 1]) {
          const x = gx + m * d + (hash(k, m + 2, 5) - 0.5) * 12 * u;
          if (x < -20 * u || x > W + 20 * u) continue;
          const y = (48 + hash(k, m + 4, 5) * 14) * u;
          const by = bedAt(y);
          if (k > 0) tips.push(...seam(p, x - m * 30 * u, x + m * 8 * u, (xx) => by + st(xx) + 1 * u, 4 * u, u, { seed: `v-s-${k}-${m}`, ph: k + m, z: 2, v: 5.6, branches: 1, branchLen: 10, ends: m > 0 ? 'right' : 'left', endTip: 6, halo: 2.2 }));
          tips.push(...quartz(p, x, floorY, (10 + hash(k, m, 6) * 6) * u, u, { seed: `v-c-${k}-${m}`, n: 5, v: 4.8, z: 2, spread: 0.8 }));
          p.light(x, floorY - 14 * u, 44 * u, 4.4, null, { zMin: 1, zMax: 1, hard: true });
          pools.push(x);
        }
      }
      // Stalagmites and columns between the pools.
      for (let d = 40 * u, k = 0; d < W / 2 + 30 * u; d += (38 + hash(k, 3, 7) * 26) * u, k += 1) {
        for (const m of [-1, 1]) {
          const x = gx + m * d; if (x < -10 * u || x > W + 10 * u || pools.some((q) => Math.abs(q - x) < 14 * u)) continue;
          if (hash(k, m, 8) < 0.35) cavecol(p, x, 0, floorY + 2 * u, (9 + hash(k, m, 9) * 5) * u, u, { lit: -m, v: 1.6 });
          else stalagmite(p, x, floorY + 2 * u, (10 + hash(k, m, 9) * 16) * u, (6 + hash(k, m, 10) * 4) * u, u, { lit: -m, v: 1.6 });
        }
      }
      p.light(gx, 50 * u, 90 * u, 4, null, { zMin: 3, zMax: 3, hard: true });
      for (const x of pools) p.light(x, floorY - 12 * u, 36 * u, 3.4, null, { zMin: 3, zMax: 3, hard: true });
      // The fire, burned down, on the far bank to the left, a pack beside it.
      const fire = embers(p, gx - 40 * u, fy - 1 * u, 9 * u, 5);
      pack(p, gx - 50 * u, fy, 8 * u, 5);
      p.light(fire[0], fire[1], 14 * u, 2.4, flicker(0.4, 0.2, 0.6), { zMin: 1, zMax: 5 });
      // The card, across the stream before the hollow.
      let motes = null;
      if (cat === 'monster') {
        const e = owlbear(p, gx, fy, 46 * u, 7, ramp);
        p.backlit(7, 'quartz', 3.5, 'quartz', 8.6);
        p.tint(e.ex, e.ey, 3 * u, CARD[ramp][3], 0.5, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        goat(p, gx + 9 * u, fy, 14 * u, 7, 1.2);
        const l = goatherd(p, gx - 9 * u, fy, 34 * u, 7, ramp);
        p.backlit(7, 'quartz', 2.5, 'quartz', 6.4);
        p.light(l.lx, l.ly, 26 * u, 3.4, flicker(0.9, 0.12), { zMin: 1, zMax: 5, hard: true });
        p.tint(l.lx, l.ly, 4 * u, CARD[ramp][4], 0.8, flicker(0.9, 0.15));
        p.tint(l.lx, l.ly + 6 * u, 16 * u, hex, 0.45, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        p.fill(C.poly([[gx - 13 * u, fy + 1], [gx - 11 * u, fy - 5 * u], [gx + 12 * u, fy - 6 * u], [gx + 14 * u, fy + 1]]), 'rock', 3.4, 6);
        p.fill(C.rect(gx - 11 * u, fy - 6 * u, 23 * u, 1), 'rock', 6, 6);
        const c = coffer(p, gx + 1 * u, fy - 5.5 * u, 26 * u, 7, ramp);
        pack(p, gx - 15 * u, fy, 12 * u, 8);
        p.backlit(7, 'quartz', 3.5, 'quartz', 8);
        p.tint(c[0], c[1], 8 * u, CARD[ramp][4], 0.6, flicker(2, 0.15, 0.9));
        p.tint(c[0], c[1] - 3 * u, 18 * u, hex, 0.55, flicker(2, 0.15, 0.7));
        motes = [c[0], c[1]];
      } else if (cat === 'obstacle') {
        // The hollow choked by a rockfall: boulders heaped across it, its light leaking teal between them.
        const heap = C.poly([[gx - 30 * u, fy + 1], [gx - 24 * u, fy - 14 * u], [gx - 14 * u, fy - 30 * u], [gx - 4 * u, fy - 40 * u], [gx + 8 * u, fy - 36 * u], [gx + 18 * u, fy - 24 * u], [gx + 26 * u, fy - 12 * u], [gx + 31 * u, fy + 1]]);
        p.fill(heap, 'rock', (x, y) => 2.4 - (y - (fy - 40 * u)) / (40 * u) * 1.2, 7);
        p.cells(heap, { size: 7 * u, joint: 1.1, jointV: -2, vary: 1, bevel: 1, seed: 71, z: 7, lit: [0, -1] });
        // The light through the gaps between them.
        p.each(heap, (x, y, i) => { if (p.z[i] === 7 && p.v[i] < 0.6 && hash(x >> 1, y >> 1, 9) < 0.4 && y < fy - 6 * u) { p.r[i] = p.ri(ramp); p.v[i] = 2.6 + hash(x >> 1, y >> 1, 3) * 1.2; } });
        p.backlit(7, 'quartz', 3.5, ramp, 3.4);
        p.tint(gx, fy - 22 * u, 12 * u, hex, 0.35, flicker(0.5, 0.12, 0.6));
      } else if (cat === 'clear-path') {
        // The way through: gold pouring out of the passage, across the floor and the stream.
        p.light(gx, fy, 40 * u, 4, flicker(0.2, 0.06, 0.4), { zMin: 1, zMax: 1, sy: 0.4 });
        p.tint(gx, fy + 1 * u, 16 * u, CARD.path[3], 0.4, flicker(0.2, 0.08, 0.4));
      }
      // The stream holding the hollow's glow, broken by ripples.
      const reflR = open ? p.ri('sun') : p.ri('quartz');
      p.each(C.rect(gx - hw, 86 * u, hw * 2, 12 * u), (x, y, i) => {
        if (p.r[i] !== p.ri('water')) return;
        const w = 1 - Math.abs(x + 0.5 - gx) / hw;
        if (frac((y - 86 * u) / (1.6 * u) + hash(Math.floor(x / 2), Math.floor(y / (1.6 * u)), 4) * 0.5) < 0.5 || w < 0.15) return;
        p.r[i] = reflR; p.v[i] = 1.6 + w * (open ? 4 : 3.4);
      });
      // Stalactites all along the roof.
      const roof = (x) => (n1(x / (9 * u), 5) - 0.5) * 6 * u + 2 * u;
      stalactites(p, -4 * u, W + 4 * u, (x) => (Math.abs(x - gx) < 6 * u ? null : roof(x)), u, { seed: 'v-roof', min: 3, max: 26, big: 0.3, gap: 5, v: 1.6, lit: 2.2, litX: gx, z: 4 });
      p.light(gx, 30 * u, 80 * u, 4, null, { zMin: 4, zMax: 4, hard: true });
      for (const x of pools) p.light(x, 30 * u, 40 * u, 3, null, { zMin: 4, zMax: 4, hard: true });
      addEdge(p, 4, 0, 1, () => 1.2);
      vignette(p, W, H, 1.6, 0.42);
      for (const z of [1, 3, 4, 5]) quant(p, z);
      p.tint(fire[0], fire[1] - 1 * u, 5 * u, '#E39A3E', 0.3, flicker(0.4, 0.2, 0.6));
      const shown = tips.filter(([x], i) => x > 0 && x < W && i % 2 === 0);
      const mo = motes;
      return {
        p,
        over(img, t) {
          twinkle(img, shown, t);
          for (let k = 0; k < Math.round(W / 30); k += 1) {
            const x = hash(k, 1, 77) * W; const f = frac(t * 0.5 + hash(k, 2, 77));
            if (f < 0.75) put(img, x, 6 * u + f * f * (floorY - 6 * u) * 1.6, '#7B94B4', 0.85);
          }
          for (let k = 0; k < 3; k += 1) { const f = frac(t * 0.3 + k / 3); put(img, fire[0] + Math.sin(t + k) * 1.5, fire[1] - 2 * u - f * 12 * u, '#5B7495', (1 - f) * 0.4); }
          if (open) for (let k = 0; k < 12; k += 1) { const f = frac(t * 0.2 + hash(k, 3, 7)); put(img, gx + (hash(k, 4, 7) - 0.5) * hw, floorY - f * 40 * u, '#FFE7B0', (1 - f) * 0.8); }
          if (mo) for (let k = 0; k < 9; k += 1) { const f = frac(t * 0.25 + hash(k, 5, 7)); put(img, mo[0] + (hash(k, 6, 7) - 0.5) * 12 * u + Math.sin(t + k) * u, mo[1] - f * 22 * u, CARD.item[f < 0.5 ? 4 : 3], (1 - f) * 0.9); }
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['quartz', 'ember'], dither: 0.22 });
      const u = H / 200; const gx = W / 2;
      // The far wall behind the vista: the great vein's glow coming down it.
      const wall = C.rect(0, 0, W, 54 * u);
      p.fill(wall, 'rock', 1, 1);
      granite(p, wall, { u, size: 9, z: 1, seed: 81, bevel: 0.8, vary: 0.7, joint: 0.9, jointV: -1 });
      const st = strata(u, 4);
      beds(p, wall, u, 12 * u, st, 1);
      const wtips = seam(p, gx - 110 * u, gx + 110 * u, (x) => 30 * u + st(x), 4.4 * u, u, { seed: 'w-seam', z: 2, v: 6, branches: 4, branchLen: 18, endTip: 8, halo: 3 });
      p.light(gx, 40 * u, 90 * u, 3.6, null, { zMin: 1, zMax: 1 });
      // The floor: wet granite slabs in perspective, running up to the far wall.
      const vy = -80 * u; const top = 52 * u;
      const ground = C.rect(0, top, W, H - top);
      p.fill(ground, 'rock', 1.4, 3);
      setts(p, ground, { vx: gx, vy, d0: 60 * u, rows: 7, cols: 4, seed: 83, z: 3, joint: 1, jointV: -0.7, vary: 0.6, wet: 0.1 });
      p.shade(ground, (x, y) => { const n = n2(x / (40 * u), y / (16 * u), 84); return n > 0.62 ? 0.7 : n < 0.3 ? -0.5 : 0; }, 3);
      // Shallow pools in the hollows of the floor, holding the vein's light.
      const pr = rng('w-b-pools');
      for (let j = 0; j < 8; j += 1) {
        const y = (66 + pr() * 120) * u; const x = (40 + pr() * 200) * u; const rx = (8 + pr() * 14) * u * (0.5 + y / H);
        p.fill(C.rect(x - rx * 1.3, y - rx * 0.5, rx * 2.6, rx), 'water', (px, py) => {
          const d = Math.hypot((px - x) / rx, (py - y) / (rx * 0.3)) + (n2(px / (4 * u), py / (2 * u), j + 40) - 0.5) * 0.7;
          return d > 1 ? null : (py < y - rx * 0.12 && d > 0.6 ? 2.6 : 1.4) - (y / H) * 0.6;
        }, 4);
      }
      // Rubble: stones fallen from the roof, their tops catching the glow.
      const rr = rng('w-b-rubble');
      for (let j = 0; j < 46; j += 1) {
        const y = (58 + rr() ** 0.8 * 140) * u; const x = rr() * W; const r0 = (1.2 + rr() * 2.6) * u * (0.5 + y / H);
        p.fill(C.ellipse(x, y, r0 * 1.4, r0 * 0.8, 10), 'rock', (px, py) => (py < y - r0 * 0.3 ? 3.4 : 2.2), 3);
        p.shade(C.ellipse(x + r0 * 0.6, y + r0 * 0.7, r0 * 1.6, r0 * 0.5, 10), -0.8, 3);
      }
      // The stream down the right side, from under the far wall to the bottom edge.
      const sx = (y) => gx + 96 * u + (y - top) * 0.36 + Math.sin(y / (24 * u)) * 8 * u;
      const sw = (y) => lerp(6 * u, 22 * u, (y - top) / (H - top));
      p.fill(ground, 'water', (x, y) => {
        const d = Math.abs(x + 0.5 - sx(y)); if (d > sw(y)) return null;
        return 1 + (d > sw(y) - 1.2 ? 1.2 : 0) + (frac((y + Math.sin(x * 0.3) * 3) / (5 * u)) < 0.16 ? 0.8 : 0);
      }, 4);
      // Quartz at the edges, its glow on the floor round it; stalagmites at the margins.
      const tips = [];
      for (const [x, y, h, m] of [[8 * u, 112 * u, 24, 1], [W - 8 * u, 98 * u, 22, -1], [14 * u, 198 * u, 14, 1], [W - 14 * u, 194 * u, 16, -1]]) {
        tips.push(...quartz(p, x, y, h * u, u, { seed: `w-q-${x}`, n: 6, v: 4.4, z: 5, dir: -Math.PI / 2 + m * 0.3, spread: 0.5 }));
        p.light(x, y - 6 * u, 40 * u, 3.2, flicker(x, 0.05, 0.4), { zMin: 3, zMax: 4, hard: true });
      }
      for (const [x, by, h, w] of [[6 * u, 80 * u, 30, 12], [W - 6 * u, 70 * u, 26, 11], [W - 18 * u, 150 * u, 40, 16], [8 * u, 168 * u, 34, 14]]) stalagmite(p, x, by, h * u, w * u, u, { z: 5, v: 1.6, lit: x < gx ? -1 : 1 });
      // The fire's last embers in the bottom-left corner, out of the hand's way.
      const fire = embers(p, 13 * u, 156 * u, 18 * u, 6);
      p.light(fire[0], fire[1], 36 * u, 2.8, flicker(0.4, 0.2, 0.6), { zMin: 3, zMax: 6 });
      p.light(gx, 30 * u, 120 * u, 2.6, null, { zMin: 3, zMax: 4, sx: 1.6 });
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.34), 3);
      p.shade(null, (x, y) => -1.6 * Math.max(0, y / H - 0.4), 4);
      for (const z of [1, 3, 4, 5]) quant(p, z, 0.5);
      p.tint(fire[0], fire[1] - 2 * u, 8 * u, '#E39A3E', 0.3, flicker(0.4, 0.2, 0.6));
      return {
        p,
        over(img, t) {
          twinkle(img, [...tips, ...wtips].filter((_, i) => i % 2 === 0), t * 0.8, '#A0B6CF');
          for (let k = 0; k < 16; k += 1) {
            const x = hash(k, 1, 91) * W; const f = frac(t * 0.45 + hash(k, 2, 91));
            if (f < 0.7) put(img, x, f * f * H * 1.4, '#425775', 0.8);
          }
          for (let k = 0; k < 4; k += 1) { const f = frac(t * 0.3 + k / 4); put(img, fire[0] + Math.sin(t + k) * 2, fire[1] - 3 * u - f * 20 * u, '#2E3E55', (1 - f) * 0.5); }
        },
      };
    },
  };


export default [A, B];

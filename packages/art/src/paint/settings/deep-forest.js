/* Job 3, the deep forest: two directions. */
import PX from '../px.js';

  const { C, Painter, put, particles, flicker, SUBJECT, CARD, hash, rng, clamp, lerp, hexRgb, BAYER } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const FLY = '#F2CB8A'; const FLY_HALO = '#8A5E1E'; // fireflies: Clear Path gold, kept to single pixels

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }

  /* ---------- shapes that grow ---------- */

  /** Points along a quadratic curve. */
  function bez(a, b, c, n = 10) {
    const out = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n; const m = 1 - t;
      out.push([m * m * a[0] + 2 * m * t * b[0] + t * t * c[0], m * m * a[1] + 2 * m * t * b[1] + t * t * c[1]]);
    }
    return out;
  }
  function lengths(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i += 1) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return acc;
  }
  /** A ribbon around a path, w0 wide at its start and w1 at its end; `taper` > 1 keeps it thick longer. */
  function ribbon(pts, w0, w1, taper = 1) {
    const acc = lengths(pts); const T = acc[acc.length - 1] || 1;
    const L = []; const R = [];
    pts.forEach((pt, i) => {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0]; let dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = lerp(w0, w1, (acc[i] / T) ** taper) / 2;
      L.push([pt[0] - dy * w, pt[1] + dx * w]); R.push([pt[0] + dy * w, pt[1] - dx * w]);
    });
    return [L.concat(R.reverse())];
  }
  const off = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
  /** A path that wanders: a curve from a through b to c, bent side to side as roots are. */
  function wander(a, b, c, n, amp, waves, seed) {
    return bez(a, b, c, n).map(([x, y], i, all) => {
      const j = Math.min(all.length - 1, i + 1); const k = Math.max(0, i - 1);
      const dx = all[j][0] - all[k][0]; const dy = all[j][1] - all[k][1]; const l = Math.hypot(dx, dy) || 1;
      const t = i / (all.length - 1); const s = amp * Math.sin(t * waves * Math.PI + seed) * Math.min(1, t * 4);
      return [x - (dy / l) * s, y + (dx / l) * s];
    });
  }

  /**
   * A limb: a trunk, a branch or a root along a path, tapering from w0 to w1.
   * Each pixel knows how far along the limb it is and where across it, so
   * the bark's furrows run along the limb and wrap round it, and the side
   * facing `lit` (a direction) catches the light, with a rim on its edge.
   */
  function limb(p, pts, w0, w1, ramp, v, z, o = {}) {
    const acc = lengths(pts); const T = acc[acc.length - 1] || 1;
    const tp = o.taper || 1;
    const shape = ribbon(pts, w0, w1, tp);
    const lit = o.lit || [0, 0];
    const fw = o.fw || 3; const seed = o.seed || 1; const plate = o.plate || 8;
    const fn = typeof v === 'function';
    // Each segment's box, padded by the limb's widest half: a pixel can only be nearest a segment whose box holds it.
    const pad = Math.max(w0, w1) / 2 + 2; const nseg = pts.length - 1;
    const box = new Float32Array(nseg * 4);
    for (let i = 0; i < nseg; i += 1) {
      box[i * 4] = Math.min(pts[i][0], pts[i + 1][0]) - pad; box[i * 4 + 1] = Math.max(pts[i][0], pts[i + 1][0]) + pad;
      box[i * 4 + 2] = Math.min(pts[i][1], pts[i + 1][1]) - pad; box[i * 4 + 3] = Math.max(pts[i][1], pts[i + 1][1]) + pad;
    }
    p.fill(shape, ramp, (x, y) => {
      const px = x + 0.5; const py = y + 0.5;
      let best = 1e9; let bi = 0; let bt = 0;
      for (let pass = 0; pass < 2 && best === 1e9; pass += 1) {
        for (let i = 0; i < nseg; i += 1) {
          if (!pass && (px < box[i * 4] || px > box[i * 4 + 1] || py < box[i * 4 + 2] || py > box[i * 4 + 3])) continue;
          const ax = pts[i][0]; const ay = pts[i][1]; const dx = pts[i + 1][0] - ax; const dy = pts[i + 1][1] - ay;
          const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
          const qx = ax + dx * t - px; const qy = ay + dy * t - py; const d = qx * qx + qy * qy;
          if (d < best) { best = d; bi = i; bt = t; }
        }
      }
      const ax = pts[bi][0]; const ay = pts[bi][1]; const dx = pts[bi + 1][0] - ax; const dy = pts[bi + 1][1] - ay;
      const len = Math.hypot(dx, dy) || 1; const nx = -dy / len; const ny = dx / len;
      const a = acc[bi] + bt * len;
      const hw = Math.max(0.5, lerp(w0, w1, (a / T) ** tp) / 2);
      const q = clamp(((px - ax - dx * bt) * nx + (py - ay - dy * bt) * ny) / hw, -1, 1);
      let val = fn ? v(x, y, a / T) : v;
      const facing = nx * lit[0] + ny * lit[1];
      val += (o.side ?? 1.1) * q * facing - (o.edge ?? 0.5) * q * q;
      if (o.rim && Math.abs(facing) > 0.25 && q * Math.sign(facing) > 1 - 1.7 / hw) val += typeof o.rim === 'function' ? o.rim(x, y) : o.rim;
      if (hw * 2 >= (o.texMin ?? 4.5)) {
        const s = Math.asin(q) * hw + Math.sin(a * 0.13 + seed) * 0.7;
        const k = Math.floor(s / fw); const fr = s / fw - k;
        const of = hash(k, 0, seed) * plate * 2;
        const j = Math.floor((a + of) / plate);
        if (fr < 0.3) val -= o.furrow ?? 1.0;
        else if (Math.floor((a - 1 + of) / plate) !== j) val -= 0.55;
        else val += (hash(k, j, seed + 1) - 0.5) * (o.vary ?? 0.6);
      }
      return val;
    }, z);
    return shape;
  }

  /** A root lying on the floor: its shadow on the ground below it first, then the root, lit along its top. */
  function root(p, pts, w0, w1, v, z, o = {}) {
    p.shade(ribbon(off(pts, 0, (o.drop ?? 1.6) + w0 * 0.15), w0 * 1.1, w1 * 1.1, o.taper || 1), o.shadow ?? -1.1, o.groundZ ?? 1);
    return limb(p, pts, w0, w1, o.ramp || 'bark', v, z, { lit: [-0.3, -1], side: 1.3, rim: o.rim ?? 1.3, fw: o.fw || 3, seed: o.seed || 1, plate: o.plate || 7, taper: o.taper || 1 });
  }

  /** A clump of leaves: overlapping ovals, each lit on the side toward `lit`. */
  function foliage(p, cx, cy, rx, ry, ramp, v, z, seed, n = 8, lit = [0, -1], amt = 0.8) {
    const r = rng(seed);
    for (let i = 0; i < n; i += 1) {
      const a = r() * Math.PI * 2; const d = Math.sqrt(r());
      const x = cx + Math.cos(a) * d * rx; const y = cy + Math.sin(a) * d * ry;
      const rr = (0.35 + r() * 0.35) * Math.min(rx, ry);
      p.fill(C.ellipse(x, y, rr * 1.3, rr, 14), ramp, (px, py) => (typeof v === 'function' ? v(px, py) : v) + (((px + 0.5 - x) * lit[0] + (py + 0.5 - y) * lit[1]) / rr) * amt + (hash(px >> 1, py >> 1, seed) - 0.5) * 0.7, z);
    }
  }

  /** A fern: fronds arching out of one root, each a curved stem with leaflets. */
  function fern(p, x, y, s, ramp, v, z, seed, n = 5) {
    const r = rng(seed);
    for (let i = 0; i < n; i += 1) {
      const a = lerp(-1, 1, n > 1 ? i / (n - 1) : 0.5) + (r() - 0.5) * 0.3;
      const tip = [x + Math.sin(a) * s * 1.1, y - Math.cos(a) * s * 0.5];
      const pts = bez([x, y], [x + Math.sin(a) * s * 0.6, y - s * (0.9 - Math.abs(a) * 0.3)], tip, 8);
      p.fill(ribbon(pts, 1.3, 0.8), ramp, v + 0.4, z);
      for (let j = 2; j < pts.length - 1; j += 1) {
        const [fx, fy] = pts[j]; const l = s * 0.16 * (1 - j / pts.length);
        p.fill(C.poly([[fx, fy], [fx + 0.8, fy], [fx + Math.sign(a || 1) * l, fy + l * 0.7], [fx - Math.sign(a || 1) * l * 0.3, fy + l]]), ramp, v, z);
      }
    }
  }

  /** Little mushrooms, their caps glowing: a cluster around (x, y). */
  function fungi(p, x, y, n, u, ramp, z, seed, cap = 3.6) {
    const r = rng(seed);
    for (let i = 0; i < n; i += 1) {
      const fx = Math.round(x + (i - (n - 1) / 2) * 2.8 * u + (r() - 0.5) * u); const h = Math.round((2 + r() * 3) * u); const w = Math.max(1, Math.round((0.8 + r() * 1) * u));
      p.fill(C.rect(fx, y - h, 1, h), ramp, cap - 1.8, z);
      p.fill(C.rect(fx - w, y - h - 1, w * 2 + 1, 1), ramp, cap - 0.3 - r() * 0.5, z);
      p.fill(C.rect(fx - w + 1, y - h - 2, Math.max(1, w * 2 - 1), 1), ramp, cap, z);
    }
  }

  /** A band of mist: value added along a wavering line, `gain(x)` stronger near the light. */
  function mist(p, W, yc, h, amt, gain, seed) {
    p.shade(C.rect(0, yc - h * 2.6, W, h * 5.2), (x, y) => {
      const wav = Math.sin(x * 0.09 + seed) * h * 0.35 + Math.sin(x * 0.027 + seed * 3) * h * 0.7;
      const e = (y + 0.5 - yc + wav) / h;
      const lump = 0.75 + 0.25 * Math.sin(x * 0.045 + seed * 1.7);
      return amt * Math.exp(-e * e) * lump * gain(x);
    });
  }

  /** The near floor in perspective, as tufts: finer toward the horizon at vy. */
  function turf(p, shape, o) {
    const { vx, vy, z } = o; const k = o.k || 5; const seed = o.seed || 3;
    p.each(shape, (x, y, i) => {
      if (z !== undefined && p.z[i] !== z) return;
      const d = y + 0.5 - vy; if (d <= 0) return;
      const Y = Math.log(d) * k; const row = Math.floor(Y);
      const X = ((x + 0.5 - vx) / d) * k * (o.sx || 2.4) + hash(row, 0, seed) * 3;
      const col = Math.floor(X); const fy = Y - row; const fx = X - col;
      let dv = (hash(col, row, seed + 1) - 0.5) * (o.vary ?? 0.9);
      const bump = 1 - Math.abs(fx - 0.5) * 2;
      if (fy < 0.3 * bump) dv += o.top ?? 0.5; else if (fy > 0.82) dv -= o.foot ?? 0.7;
      p.v[i] += dv;
    });
  }

  /** Fallen leaves: small lozenges at all angles, on layer z inside `shape`, each a little lighter than the floor. */
  function leaves(p, shape, n, seed, z, ramp, dv = 0.8, size = 1.6, shadow = 0) {
    const r = rng(seed); const li = p.ri(ramp);
    let y0 = Infinity; let y1 = -Infinity; let x0 = Infinity; let x1 = -Infinity;
    for (const c of shape) for (const [x, y] of c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let k = 0; k < n; k += 1) {
      const cx = x0 + r() * (x1 - x0); const cy = y0 + r() * (y1 - y0); const a = r() * Math.PI; const l = size * (0.7 + r() * 0.7);
      const ca = Math.cos(a) * l; const sa = Math.sin(a) * l * 0.6; const lit = dv + (r() - 0.5) * 0.6;
      const leaf = C.poly([[cx - ca, cy - sa], [cx - sa * 0.4, cy + ca * 0.25], [cx + ca, cy + sa], [cx + sa * 0.4, cy - ca * 0.25]]);
      const mine = [];
      p.each(leaf, (x, y, i) => { if (p.z[i] === z) mine.push(i); });
      if (shadow) p.each(C.poly(leaf[0].map(([x, y]) => [x + 0.6, y + 1.2])), (x, y, i) => { if (p.z[i] === z && !mine.includes(i)) p.v[i] += shadow; });
      for (const i of mine) { p.r[i] = li; p.v[i] += lit; }
    }
  }

  /** A shaft of moonlight from (x0, y0) to (x1, y1), w0 wide at the top and w1 at the foot: in the air, so on every layer. */
  function shaft(p, x0, y0, x1, y1, w0, w1, s, k = null, o = {}) {
    const f = new Float32Array(p.w * p.h);
    const dx = x1 - x0; const dy = y1 - y0; const L2 = dx * dx + dy * dy; const len = Math.sqrt(L2);
    const nx = -dy / len; const ny = dx / len; const wm = Math.max(w0, w1);
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - wm)); const bx1 = Math.min(p.w - 1, Math.ceil(Math.max(x0, x1) + wm));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1))); const by1 = Math.min(p.h - 1, Math.ceil(Math.max(y0, y1) + wm * 0.3));
    for (let y = by0; y <= by1; y += 1) {
      for (let x = bx0; x <= bx1; x += 1) {
        const i = y * p.w + x;
        if (p.emit[p.r[i]]) continue;
        if (o.zMax !== undefined && p.z[i] > o.zMax) continue;
        const px = x + 0.5 - x0; const py = y + 0.5 - y0;
        const t = (px * dx + py * dy) / L2; if (t < 0 || t > 1.12) continue;
        const hw = lerp(w0, w1, Math.min(1, t)) / 2;
        const d = Math.abs(px * nx + py * ny) / hw; if (d >= 1) continue;
        f[i] = s * (1 - d * d) * (t > 1 ? Math.max(0, 1 - (t - 1) / 0.12) : 1) * Math.min(1, 0.35 + t * 1.3);
      }
    }
    if (k) p.fields.push({ f, k }); else for (let i = 0; i < f.length; i += 1) p.v[i] += f[i];
  }

  /** Inside an ellipse, pixels on the `from` ramps move to `to` at the same value, dithered at the edge (light changing colour). */
  function reramp(p, cx, cy, rx, ry, from, to, edge = 0.72, zs = null) {
    const ti = p.ri(to); const fr = from.map((n) => p.ri(n));
    p.each(C.ellipse(cx, cy, rx, ry, 36), (x, y, i) => {
      if (!fr.includes(p.r[i])) return;
      if (zs && (p.z[i] < zs[0] || p.z[i] > zs[1])) return;
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d > edge && (d - edge) / (1 - edge) > BAYER[(y & 3) * 4 + (x & 3)]) return;
      p.r[i] = ti;
    });
  }

  /** A gaunt antlered thing, black, two eyes of the card's colour. `s` is its height to the crown. Returns the eyes' centre. */
  function stalker(p, cx, fy, s, ramp, z, body = 0.3) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    const S = (pts) => pts.map(([x, y]) => [cx + x * s, fy + y * s]);
    p.fill(P([[-0.15, 0], [-0.11, -0.4], [-0.14, -0.6], [-0.24, -0.78], [-0.12, -0.85], [-0.065, -0.86], [-0.08, -0.95], [-0.04, -1.01], [0.04, -1.01], [0.08, -0.95],
      [0.065, -0.86], [0.12, -0.85], [0.24, -0.78], [0.14, -0.6], [0.11, -0.4], [0.15, 0], [0.06, 0], [0.02, -0.33], [-0.02, -0.33], [-0.06, 0]]), 'shadow', body, z);
    const lw = Math.max(1.3, s * 0.065);
    for (const m of [-1, 1]) {
      p.fill(ribbon(S([[0.2 * m, -0.78], [0.3 * m, -0.56], [0.27 * m, -0.3]]), lw * 1.2, lw * 0.85), 'shadow', body, z);
      for (const [ex, ey] of [[0.23, -0.17], [0.28, -0.16], [0.32, -0.19]]) p.fill(ribbon(S([[0.27 * m, -0.31], [ex * m, ey]]), lw * 0.7, 0.9), 'shadow', body, z);
      const tw = Math.max(1.1, s * 0.035);
      p.fill(ribbon(S([[0.03 * m, -0.99], [0.12 * m, -1.12], [0.2 * m, -1.32]]), tw * 1.3, tw), 'shadow', body, z);
      p.fill(ribbon(S([[0.11 * m, -1.1], [0.05 * m, -1.24]]), tw, tw * 0.8), 'shadow', body, z);
      p.fill(ribbon(S([[0.17 * m, -1.22], [0.29 * m, -1.27]]), tw, tw * 0.8), 'shadow', body, z);
    }
    const ey = Math.round(fy - s * 0.93); const ex = Math.round(cx);
    p.fill(C.rect(ex - 2, ey, 1, 1), ramp, 2.4, z + 1); p.fill(C.rect(ex - 1, ey, 1, 1), ramp, 4, z + 1);
    p.fill(C.rect(ex + 1, ey, 1, 1), ramp, 4, z + 1); p.fill(C.rect(ex + 2, ey, 1, 1), ramp, 2.4, z + 1);
    return [ex, ey];
  }

  /**
   * A wall of thorns: a low dense tangle of stems first, then taller ones
   * arching over it, every stem set with thorns, so the top edge is jagged
   * against whatever is behind it.
   */
  function thornWall(p, cx, fy, hw, h, ramp, z, seed, u, v = 0.6) {
    const r = rng(seed);
    for (let k = 0; k < 28; k += 1) {
      const low = k < 13;
      const x0 = cx - hw + r() * hw * 2;
      const x1 = clamp(x0 + (0.25 + r() * 0.55) * hw * (r() < 0.5 ? -1 : 1), cx - hw, cx + hw);
      const edge = Math.max(0.3, 1 - (((x0 + x1) / 2 - cx) / hw) ** 2);
      const hh = h * edge * (low ? 0.28 + r() * 0.3 : 0.6 + r() * 0.4);
      const pts = bez([x0, fy + 1], [lerp(x0, x1, 0.4), fy - hh * 1.7], [x1, fy + 1 - r() * hh * 0.5], 16);
      const w = (low ? 1.3 : 0.8) * u + 0.6;
      p.fill(ribbon(pts, w * 1.4, w * 0.7), ramp, v + r() * 0.3, z);
      for (let j = 1; j < pts.length - 1; j += 1) {
        if (r() > 0.6) continue;
        const [tx, ty] = pts[j]; const sd = r() < 0.5 ? -1 : 1;
        p.fill(C.poly([[tx - 0.7, ty + 0.3], [tx + 0.7, ty + 0.3], [tx + sd * 1.4 * u, ty - 2.2 * u]]), ramp, v + 0.2, z);
      }
    }
  }

  /** A chest with its lid thrown back, the card's light coming out of it and lighting the lid's underside. */
  function chest(p, cx, fy, s, ramp, z) {
    const w = s * 0.55; const hb = s * 0.42; const lt = fy - hb;
    p.fill(C.poly([[cx - w * 0.95, lt + 1], [cx + w * 0.95, lt + 1], [cx + w * 0.8, lt - s * 0.4], [cx - w * 0.8, lt - s * 0.4]]), 'wood', 1.2, z);
    p.fill(C.poly([[cx - w * 0.75, lt], [cx + w * 0.75, lt], [cx + w * 0.66, lt - s * 0.33], [cx - w * 0.66, lt - s * 0.33]]), ramp, (x, y) => 0.8 + 2 * clamp((y - (lt - s * 0.33)) / (s * 0.33), 0, 1), z);
    p.fill(C.rect(cx - w, lt, w * 2, hb), 'wood', (x, y) => 2.2 - (y - lt) / hb * 0.8 + (Math.floor((y - lt) / Math.max(2, s * 0.14)) % 2 ? -0.3 : 0.2), z + 1);
    for (const bx of [-0.62, 0.62]) p.fill(C.rect(cx + bx * w - 0.5, lt, 1.5, hb), 'shadow', 2.4, z + 1);
    p.fill(C.rect(cx - w, lt, w * 2, 1), 'wood', 3.6, z + 1);
    p.fill(C.rect(cx - w * 0.8, lt - 1, w * 1.6, 1.5), ramp, 4, z + 1);
    p.fill(C.rect(cx - 1, lt + hb * 0.25, 2, Math.max(2, hb * 0.3)), ramp, 2.6, z + 2);
  }

  /**
   * The wanderer, in clean bands of its card's blue: the cloak one value, the
   * side by the lantern one step up, a rim where the light behind it shows.
   * The lantern is a few solid pixels; its light falls on the floor as a pool
   * (the floor there takes the lantern's ramp, then a light walks it up), so
   * nothing is tinted and nothing dithers into a checkerboard.
   */
  function wanderer(p, wx, fy, ws, z, rimFrom, rimMin, floorRamps, floorZ, poolR, poolS = 3.2) {
    SUBJECT.wanderer(p, wx, fy, ws, 'wand', z, false);
    const wi = p.ri('wand');
    const lx = Math.round(wx + ws * 0.3); const ly = Math.round(fy - ws * 0.5);
    const mine = [];
    p.each(C.rect(wx - ws, fy - ws * 1.2, ws * 2, ws * 1.3), (x, y, i) => {
      if (p.z[i] !== z || p.r[i] !== wi) return;
      p.v[i] = Math.hypot(x + 0.5 - lx, y + 0.5 - ly) < ws * 0.2 ? 2 : 1;
      mine.push(i);
    });
    p.backlit(z, rimFrom, rimMin, 'wand', 2);
    p.fill(C.rect(lx - 1, ly - 2, 3, 1), 'shadow', 1, z + 1);
    p.fill(C.rect(lx - 1, ly - 1, 3, 3), 'wand', 3, z + 1);
    p.fill(C.rect(lx, ly, 1, 1), 'wand', 4, z + 2);
    reramp(p, lx, fy, poolR * 1.2, poolR * 0.45, floorRamps, 'lamp', 1, floorZ);
    p.light(lx, fy, poolR, poolS, flicker(0.9, 0.08), { zMin: floorZ[0], zMax: floorZ[1], sy: 0.38 });
    return { lx, ly, keep: mine.map((i) => [i, p.r[i], p.v[i]]) };
  }

  /** Smooth value noise, and a few octaves of it. */
  function vnoise(x, y, seed) {
    const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
    const a = hash(xi, yi, seed); const b = hash(xi + 1, yi, seed); const c = hash(xi, yi + 1, seed); const d = hash(xi + 1, yi + 1, seed);
    const sx = xf * xf * (3 - 2 * xf); const sy = yf * yf * (3 - 2 * yf);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }
  const fbm = (x, y, seed) => vnoise(x, y, seed) * 0.6 + vnoise(x * 2.3, y * 2.3, seed + 7) * 0.28 + vnoise(x * 5.1, y * 5.1, seed + 13) * 0.12;

  /** Soft ground: mounds from a smooth noise, lit on the slopes that face up (toward the light beyond the vista). */
  function mounds(p, shape, o) {
    const { sx, sy, seed, z } = o; const amp = o.amp ?? 1.2; const lit = o.lit ?? 9;
    // The noise once per pixel (a row above and below the picture for the slope), the slope from the rows either side.
    const W = p.w; const n = new Float32Array(W * (p.h + 4));
    for (let y = -2; y < p.h + 2; y += 1) for (let x = 0; x < W; x += 1) n[(y + 2) * W + x] = fbm(x / sx, y / sy, seed);
    p.each(shape, (x, y, i) => {
      if (z !== undefined && p.z[i] !== z) return;
      const c = (y + 2) * W + x;
      p.v[i] += (n[c] - 0.5) * amp + (n[c + W] + n[c + 2 * W] - n[c - W] - n[c - 2 * W]) * 0.25 * lit;
    });
  }

  /** Rows of trunks going back into the mist; each farther row paler, as a share of the light behind it. */
  function treeRows(p, W, cx, bg, rows) {
    for (const R of rows) {
      const r = rng(R.seed);
      const step = () => R.sp * (r() < 0.22 ? 1.5 + r() * 1.3 : 0.45 + r() * 0.8);
      const xs = [];
      for (let x = cx + R.gap + r() * R.sp * 0.5; x < W + R.w * 3; x += step()) xs.push(x);
      for (let x = cx - R.gap - r() * R.sp * 0.5; x > -R.w * 3; x -= step()) xs.push(x);
      for (const x of xs) {
        const big = r() < 0.2; const leaner = !big && r() < (R.leaners || 0);
        const w = R.w * (big ? 1.5 + r() * 0.6 : 0.55 + r() * 0.6);
        const lean = leaner ? (r() < 0.5 ? -1 : 1) * R.lean * (3 + r() * 2) : (r() - 0.5) * R.lean * (big ? 0.4 : 1);
        const foot = R.foot + (r() - 0.5) * R.footJ;
        const f = R.fade * (0.86 + r() * 0.28);
        const val = (px, py) => bg(px + 0.5, py + 0.5) * f + (R.dv || 0);
        limb(p, [[x, foot], [x + lean * (leaner ? 0.6 : 0.4), foot * 0.5], [x + lean, -3]], w * 1.2, w * 0.85, R.ramp || 'night', val, R.z,
          { lit: [Math.sign(cx - x), 0], side: R.side ?? 0.6, edge: 0.5, texMin: 99, rim: R.rim ? (px, py) => bg(px + 0.5, py + 0.5) * R.rim : 0 });
        if (R.crowns && r() < R.crowns) foliage(p, x + lean, foot * (0.12 + r() * 0.25), R.w * 4, R.w * 2.2, R.ramp || 'night', (px, py) => bg(px + 0.5, py + 0.5) * f * 0.95, R.z, 300 + Math.round(x), 6, [Math.sign(cx - x), 0.5], 0.5);
        for (let b = 0; b < (R.branches || 0); b += 1) {
          if (r() < 0.45) continue;
          const by = foot * (0.2 + r() * 0.45); const sd = r() < 0.5 ? -1 : 1; const bl = R.w * (2 + r() * 3);
          const bx = x + lean * (1 - by / foot);
          limb(p, [[bx, by], [bx + sd * bl * 0.6, by - bl * 0.45], [bx + sd * bl, by - bl * 1.1]], Math.max(1, w * 0.45), 0.8, R.ramp || 'night', val, R.z, { texMin: 99, edge: 0 });
        }
      }
      // Bushes at the trees' feet, as pale as the row they stand in; the row's mist then covers their foot.
      if (R.bushes) {
        const br = rng(R.seed + 500);
        for (const x of xs) {
          if (br() > R.bushes) continue;
          const bx = x + (br() - 0.5) * R.sp; const rx = R.w * (3 + br() * 2.6); const ry = rx * 0.55;
          if (Math.abs(bx - cx) < R.gap + rx * 1.3) continue;
          const by = R.foot - ry * 0.35; const b = bg(bx, by) * R.fade;
          leafCluster(p, bx, by, rx, ry, R.ramp || 'night', (px, py) => bg(px + 0.5, py + 0.5) * R.fade * 0.95, R.z, 700 + Math.round(bx * 7),
            { n: 5, lit: Math.max(1.3, b * 0.4), dark: Math.max(0.6, b * 0.2), leaf: Math.max(1.2, R.w * 0.9) });
        }
      }
      if (R.mist) R.mist();
    }
  }

  /** Fireflies: a gold pixel each, the near ones with a dim pixel either side. */
  function flies(img, list, scale = 1, halo = true) {
    for (const q of list) {
      const a = q.a * scale; if (a <= 0.05) continue;
      put(img, q.x, q.y, FLY, a);
      if (halo && q.big) { put(img, q.x - 1, q.y, FLY_HALO, a * 0.5); put(img, q.x + 1, q.y, FLY_HALO, a * 0.5); }
    }
  }

  /** Eyes in the dark that open, look, blink and close again on their own slow cycles. */
  function watchers(img, list, t, hex) {
    for (const [x, y, ph, gap = 2] of list) {
      const c = (t * 0.21 + ph) % 1;
      const open = clamp(Math.sin(c * Math.PI) * 2.2 - 0.6, 0, 1);
      if (open <= 0.05 || ((t * 1.7 + ph * 9) % 3.1) < 0.12) continue;
      put(img, x, y, hex, open); put(img, x + gap, y, hex, open);
    }
  }

  /** Motes of a card's colour rising off something that glows. */
  function rising(img, x, y, w, h, n, t, seed, hex) {
    for (const q of particles('mote', n, [x - w / 2, y - h, w, h], t, seed)) put(img, q.x, q.y, hex, q.a * clamp((q.y - (y - h)) / (h * 0.6), 0, 1));
  }

  /**
   * Mist drifting across the floor, drawn per frame: wavering bands of a
   * pale colour laid over the picture in three dithered steps, sliding
   * sideways at their own speeds, swelling and thinning as they go.
   */
  function driftMist(img, bands, t) {
    const W = img.width; const d = img.data;
    for (const b of bands) {
      const c = hexRgb(b.hex); const of = t * b.speed;
      const wav = new Float32Array(W); const den = new Float32Array(W);
      for (let x = 0; x < W; x += 1) {
        const X = x - of;
        wav[x] = Math.sin(X * 0.043 + b.seed) * b.h * 0.6 + Math.sin(X * 0.013 + b.seed * 2.3) * b.h * 1.1;
        den[x] = clamp(0.55 + 0.45 * Math.sin(X * 0.027 + b.seed * 1.7) + 0.25 * Math.sin(X * 0.071 - t * 0.3 + b.seed), 0, 1) * (b.gain ? b.gain(x) : 1);
      }
      const breathe = b.breathe ? b.breathe(t) : 1;
      for (let y = Math.max(0, Math.floor(b.y - b.h * 3)); y < Math.min(img.height, Math.ceil(b.y + b.h * 3)); y += 1) {
        for (let x = 0; x < W; x += 1) {
          const e = (y - b.y + wav[x]) / b.h;
          const a = Math.exp(-e * e) * den[x] * breathe;
          const lvl = Math.floor(a * 3 + BAYER[(y & 3) * 4 + (x & 3)]) / 3;
          if (lvl <= 0) continue;
          const k = Math.min(1, lvl) * b.a; const o = (y * W + x) * 4;
          d[o] = lerp(d[o], c[0], k); d[o + 1] = lerp(d[o + 1], c[1], k); d[o + 2] = lerp(d[o + 2], c[2], k);
        }
      }
    }
  }

  /* ================= A: the firefly hollow ================= */

  const RAMPS_A = {
    night: ['#04050C', '#070B14', '#0B121D', '#0E1C28', '#152A36', '#1C3541', '#23404B', '#2A5059', '#30606A', '#3A7873', '#43917B', '#5FA894', '#7FC0AC', '#A3D8C6', '#C8F0E2'],
    sun: ['#06060A', '#0D0C0E', '#151210', '#1F1912', '#2B2114', '#382A16', '#463318', '#573E1A', '#6E4C1C', '#8A5E1E', '#B07A2C', '#E3A445', '#F2CB8A', '#FBE2AE', '#FFF1C4'],
    bark: ['#020307', '#05070C', '#090C12', '#0D1219', '#121920', '#182229', '#1F2C32', '#29393D', '#354948', '#455C57', '#5A7468', '#7A9483'],
    moss: ['#030506', '#070B0C', '#0B1112', '#101817', '#15201E', '#1B2925', '#23342E', '#2C4038', '#364E43', '#425D4F', '#516E5C', '#68866F', '#86A288'],
    litter: ['#050506', '#09090A', '#0F0E0E', '#151413', '#1C1A18', '#24211E', '#2D2925', '#37322C', '#433C34', '#51483E'],
    shadow: ['#020305', '#05070B', '#090D13', '#0E141B'],
    wood: ['#0B0806', '#150F0A', '#21170F', '#2F2115', '#3F2C1C', '#523A25'],
    lamp: ['#030506', '#06090D', '#0A0F15', '#0E151D', '#131C27', '#1A2532', '#22303F', '#2C3D4E', '#34495C', '#4B6680', '#6B8CA6', '#A6C0D4'],
    leaf: ['#020405', '#04090B', '#070F10', '#0A1615', '#0E1E1C', '#132823', '#19322C', '#203E36', '#284B41', '#325A4E', '#3F6D5E', '#538672', '#6FA38C', '#94C2AC'],
    ...CARD,
  };

  /**
   * A cluster of leaves: a few rounded clumps, back to front, each in three
   * clean bands (a lit top where the moon catches it, the body, a dark
   * underside) and fringed with single leaves at its edge, the lower ones
   * hanging. `val(x, y)` is the body's value, so a far bush can take the
   * mist's value and fade like the trees.
   */
  function leafCluster(p, cx, cy, rx, ry, ramp, val, z, seed, o = {}) {
    const r = rng(seed); const n = o.n ?? 5; const lit = o.lit ?? 1.6; const dark = o.dark ?? 1; const leaf = o.leaf ?? 1.5; const hang = o.hang ?? 0.6;
    const V = typeof val === 'function' ? val : () => val;
    const clumps = [];
    for (let i = 0; i < n; i += 1) {
      const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * 0.65; const s = 0.45 + r() * 0.35;
      clumps.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, s * rx * 0.62 + 0.8, s * ry * 0.85 + 0.6]);
    }
    clumps.sort((a, b) => a[1] - b[1]);
    for (const [x, y, ax, ay] of clumps) {
      // A lit crescent along the clump's top, a dark one along its underside, the body between.
      const band = (px, py) => {
        const nx = (px + 0.5 - x) / ax; const ny = (py + 0.5 - y) / ay;
        if (nx * nx + (ny - 0.5) ** 2 > 1 && ny < 0.2) return lit;
        if (nx * nx + (ny + 0.45) ** 2 > 1 && ny > 0) return -dark;
        return 0;
      };
      const m = Math.max(6, Math.round((ax + ay) * 1.3));
      for (let k = 0; k < m; k += 1) {
        const t = (k / m) * Math.PI * 2 + r() * 0.4;
        const ex = x + Math.cos(t) * ax * 0.85; const ey = y + Math.sin(t) * ay * 0.85;
        let dx = Math.cos(t); let dy = Math.sin(t) + hang; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const len = leaf * (0.9 + r() * 0.8);
        p.fill(C.poly([[ex - dy * 0.8, ey + dx * 0.8], [ex + dx * len, ey + dy * len], [ex + dy * 0.8, ey - dx * 0.8]]), ramp, (px, py) => V(px, py) + band(px, py), z);
      }
      p.fill(C.ellipse(x, y, ax, ay, 16), ramp, (px, py) => { const b = band(px, py); return V(px, py) + b + (b >= 0 && hash(px >> 1, py, seed + 3) < 0.1 ? 0.7 : 0); }, z);
    }
  }

  /** Ivy up a trunk: a thin vine along `path(t)` (t 0 at the foot, 1 at the top), leaves either side, each lit along its top. */
  function ivy(p, path, n, ramp, v, z, seed, u, lit = 1.4) {
    const r = rng(seed);
    let prev = path(0);
    for (let i = 1; i <= n * 3; i += 1) { const q = path(i / (n * 3)); p.fill(ribbon([prev, q], 1.2, 1.2), ramp, v - 0.8, z); prev = q; }
    for (let i = 0; i < n; i += 1) {
      const [x, y] = path((i + 0.2 + r() * 0.5) / n); const s = i % 2 ? 1 : -1; const l = (1.5 + r()) * u;
      p.fill(C.poly([[x, y], [x + s * l * 1.2, y - l * 0.7], [x + s * l * 1.4, y + l * 0.3], [x + s * l * 0.5, y + l * 0.7]]), ramp, v, z);
      p.fill(C.rect(Math.round(x + s * l * 0.7 - (s < 0 ? 1 : 0)), Math.round(y - l * 0.5), 2, 1), ramp, v + lit, z);
    }
  }

  /** Leaves drifting down with the fireflies, turning as they fall: two pixels each, a lit face and a dark one. */
  function driftLeaves(img, n, area, t, seed, lit, dark) {
    const r = rng(seed); const [ax, ay, aw, ah] = area;
    for (let i = 0; i < n; i += 1) {
      const bx = r() * aw; const by = r() * ah; const ph = r() * 6.283; const sp = 0.6 + r() * 0.8;
      const y = ay + ((by + t * 3 * sp) % ah);
      const x = ax + (((bx + Math.sin(t * 0.9 * sp + ph) * 5 + t * 1.2 * sp) % aw) + aw) % aw;
      const turn = Math.sin(t * 2.6 * sp + ph);
      put(img, x, y, turn > 0 ? lit : dark);
      if (turn > 0.3) put(img, x + 1, y, dark); else if (turn < -0.3) put(img, x, y + 1, dark);
    }
  }

  /** The light of the clearing: a pool of moonlit mist, and a band of it the width of the wood. */
  function glowA(u, cx, hz, cy, rx, ry, bright, band = 2.6, reach = 140) {
    return (x, y) => 1.0 + 10.8 * bright * Math.max(0, 1 - Math.hypot((x - cx) / (rx * u), (y - cy) / (ry * u))) ** 1.25
      + band * bright * Math.exp(-(((y - hz + 3 * u) / (6.5 * u)) ** 2)) * (0.35 + 0.65 * Math.max(0, 1 - Math.abs(x - cx) / (reach * u)));
  }

  /*
   * A's vista in passes, so what does not change between cards is built once:
   * the wood behind the card, the card, the wood in front of it, the finish.
   * Monster, wanderer and item share one picture of the wood (per size); the
   * card is drawn into a copy and the wood in front is put back over it.
   * A finished vista is kept too, so turning the same kind of card again is free.
   */
  const vistaMemoA = new Map(); const vistaBaseA = new Map();
  function ctxA(W, H, cat) {
    const u = H / 100; const gx = W / 2;
    const warm = cat === 'clear-path'; const bright = cat === 'obstacle' ? 0.9 : 1;
    return { W, H, u, gx, hz: 70 * u, floor: 87 * u, warm, bright, bg: glowA(u, gx, 70 * u, 62 * u, 62, 48, bright) };
  }

  /** The wood behind the card: the glow, the floor of the clearing, the rows of trees and bushes in the mist, the moonbeams. */
  function sceneBackA(p, c) {
    const { W, H, u, gx, hz, floor, warm, bright, bg } = c;
    p.fill(C.rect(0, 0, W, H), 'night', (x, y) => bg(x + 0.5, y + 0.5), 0);
    // The gap in the canopy the moon comes through, a faint haze the leaves stand against.
    p.shade(C.ellipse(gx, 8 * u, 34 * u, 16 * u), (x, y) => 2.6 * bright * Math.max(0, 1 - Math.hypot((x + 0.5 - gx) / (34 * u), (y + 0.5 - 8 * u) / (16 * u))) ** 1.1, 0);
    const ground = C.rect(0, hz - 2 * u, W, H - hz + 2 * u);
    p.fill(ground, 'moss', (x, y) => {
      const d = (y - hz) / (H - hz);
      const pool = 6 * bright * Math.max(0, 1 - Math.hypot((x - gx) / (40 * u), (y - floor) / (8 * u))) ** 1.1;
      return 1.2 + bg(x, hz) * 0.75 * Math.exp(-d * 4) + pool;
    }, 1);
    turf(p, ground, { vx: gx, vy: hz - 12 * u, k: 5, sx: 2.4, z: 1, seed: 6, vary: 0.7, top: 0.4 });
    leaves(p, C.rect(0, hz + 10 * u, W, H - hz), Math.round(W / 4), 7, 1, 'litter', 0.6, 1.4);
    p.shade(C.poly([[gx - 1.5 * u, floor - 2 * u], [gx + 1.5 * u, floor - 2 * u], [gx + 12 * u, H], [gx - 9 * u, H]]), (x, y) => 1.1 * (1 - (y - floor) / (H - floor) * 0.5), 1);
    const gain = (x) => clamp(bg(x, hz) / 12, 0.18, 1);
    const open = warm ? 1.6 : 1;
    treeRows(p, W, gx, bg, [
      { z: 2, sp: 7.5 * u, w: 1.5 * u, fade: 0.84, foot: hz + 0.5 * u, footJ: u, gap: 6 * u * open, lean: 2 * u, seed: 31, bushes: 0.3, mist: () => { mist(p, W, hz - 1.5 * u, 4 * u, 2.6 * bright, gain, 1); mist(p, W, hz - 17 * u, 2.5 * u, 1.6 * bright, gain, 7); } },
      { z: 3, sp: 11 * u, w: 2.6 * u, fade: 0.6, foot: hz + 3 * u, footJ: 1.5 * u, gap: 12 * u * open, lean: 4 * u, seed: 32, branches: 1, leaners: 0.15, crowns: 0.35, rim: 0.1, bushes: 0.5, mist: () => { mist(p, W, hz + 1.5 * u, 4 * u, 1.8 * bright, gain, 2); mist(p, W, hz - 10 * u, 2 * u, 0.9 * bright, gain, 8); } },
      { z: 4, sp: 17 * u, w: 4.4 * u, fade: 0.34, foot: hz + 6 * u, footJ: 2 * u, gap: 20 * u * open, lean: 6 * u, seed: 33, branches: 2, leaners: 0.12, rim: 0.3, bushes: 0.45, mist: () => mist(p, W, hz + 5 * u, 4 * u, 1.2 * bright, gain, 3) },
    ]);
    // Moonlight coming down into the clearing.
    if (!warm) {
      shaft(p, gx - 20 * u, 4 * u, gx - 6 * u, hz + 2 * u, 4 * u, 12 * u, 1.5 * bright, (t) => 0.75 + 0.25 * Math.sin(t * 0.8), { zMax: 4 });
      shaft(p, gx + 10 * u, 6 * u, gx + 16 * u, hz + 2 * u, 3 * u, 7 * u, 1.1 * bright, (t) => 0.75 + 0.25 * Math.sin(t * 0.8 + 1.5), { zMax: 4 });
    }
  }

  /** The card, in the clearing. Returns where its motes rise from, if it has any. */
  function subjectA(p, c, cat) {
    const { u, gx, hz, floor, warm } = c;
    const ramp = catRamp(cat); const hex = CARD[ramp][3];
    const sx = gx; const sy = floor;
    if (cat === 'monster') {
      const e = stalker(p, sx, sy, 34 * u, ramp, 5);
      p.backlit(5, 'night', 5, 'night', 11);
      p.tint(e[0], e[1], 5 * u, hex, 0.5, flicker(0.3, 0.3, 1.4));
    } else if (cat === 'wanderer') {
      wanderer(p, sx - 3 * u, sy, 28 * u, 5, 'night', 5, ['moss', 'litter'], [1, 1], 22 * u);
    } else if (cat === 'item') {
      p.fill(C.ellipse(sx, sy, 13 * u, 3.5 * u), 'moss', 4, 5);
      p.cells(C.ellipse(sx, sy, 13 * u, 3.5 * u), { size: 3 * u, z: 5, seed: 3, vary: 0.8, bevel: 0.7 });
      chest(p, sx, sy - 1 * u, 20 * u, ramp, 5);
      limb(p, [[sx - 15 * u, sy + 1 * u], [sx - 10 * u, sy - 5 * u], [sx - 5 * u, sy - 3 * u]], 2.4 * u, 1, 'bark', 2.4, 8, { lit: [0, -1], rim: 1.6, texMin: 99 });
      p.light(sx, sy - 2 * u, 20 * u, 2.4, flicker(2, 0.15, 0.7), { zMin: 1, zMax: 1, sy: 0.4 });
      p.tint(sx, sy - 12 * u, 13 * u, hex, 0.65, flicker(2, 0.15, 0.7));
      return [sx, sy - 12 * u];
    } else if (cat === 'obstacle') {
      thornWall(p, sx, sy, 38 * u, 36 * u, ramp, 5, 9, u, 0.15);
      p.backlit(5, 'night', 5.5, ramp, 3);
    } else if (warm) {
      reramp(p, gx, hz - 6 * u, 50 * u, 38 * u, ['night'], 'sun');
      reramp(p, gx, hz + 1 * u, 44 * u, 7 * u, ['moss', 'litter'], 'sun', 0.6);
      reramp(p, gx, floor + 4 * u, 26 * u, 16 * u, ['moss', 'litter'], 'sun', 0.6);
      p.light(gx, hz - 2 * u, 34 * u, 2.4, flicker(0.2, 0.06, 0.4), { zMax: 4 });
    }
    return null;
  }

  /** The wood in front of the card: the near trees with their moss, ivy, roots and undergrowth; the canopy and its vines. Everything here is on layer 6 or above. */
  function sceneFrontA(p, c) {
    const { W, u, gx, warm, bright } = c;
    // The near trees, black but for the side that faces the clearing.
    const near = [];
    { const r = rng(41); let d = 31 * u;
      while (d < W / 2 + 24 * u) { for (const s of [-1, 1]) near.push([gx + s * (d + (r() - 0.5) * 6 * u), s]); d += (24 + r() * 24) * u; } }
    near.forEach(([x, s], i) => {
      const r = rng(50 + i);
      const foot = (95 + r() * 7) * u; const w = (7 + r() * 7) * u; const lean = (r() - 0.35) * 7 * u * s;
      const k01 = clamp(1 - Math.abs(x - gx) / (100 * u), 0, 1);
      const rimK = (0.6 + 4.4 * k01 ** 1.4) * bright * (warm ? 0.7 : 1);
      const path = [[x, foot + 3 * u], [x + lean * 0.4, 50 * u], [x + lean, -4 * u]];
      const sh = limb(p, path, w * 1.3, w * 0.85, 'bark', 1.2 + k01 * 1.4, 6,
        { lit: [-s, 0], side: 0.5 + k01 * 1.6, rim: rimK, fw: 3 * u + 0.5, seed: i, plate: 8 * u });
      // Moss up the lower trunk; ivy climbing the side that faces the clearing.
      p.each(sh, (px, py, j) => { if (p.z[j] === 6 && py > 58 * u && fbm(px / (3 * u), py / (5 * u), 30 + i) > 0.56) p.r[j] = p.ri('moss'); });
      if (k01 > 0.12) {
        const cAt = (yy) => (yy > 50 * u ? lerp(path[1][0], path[0][0], (yy - 50 * u) / (foot + 3 * u - 50 * u)) : lerp(path[2][0], path[1][0], (yy + 4 * u) / (54 * u)));
        ivy(p, (t) => { const yy = lerp(foot, 22 * u, t); return [cAt(yy) - s * w * (0.25 + 0.2 * Math.sin(t * 9 + i)), yy]; }, 12, 'leaf', 2.2 + k01 * 1.6, 6, 140 + i, u, 1.6 + k01 * 1.4);
      }
      for (const sd of [-1, 1]) {
        root(p, [[x + sd * w * 0.3, foot], [x + sd * w * 0.9, foot + 2 * u], [x + sd * w * (1.5 + r()), foot + 4.5 * u]], w * 0.45, 1, 1.4 + k01, 7, { rim: rimK * 0.5, seed: i * 3 + sd });
      }
      // Undergrowth at its feet.
      leafCluster(p, x - s * w * 0.9, foot - 3 * u, w * 1.4, w * 0.7, 'leaf', 1.8 + k01 * 1.4, 7, 400 + i, { n: 6, lit: 2 + k01 * 1.8, dark: 1, leaf: 1.6 * u });
      if (r() < 0.7) fern(p, x - s * w * (1.6 + r()), foot + 3 * u, (6 + r() * 4) * u, 'leaf', 2 + k01 * 1.8, 7, 90 + i, 5);
    });
    // The canopy closing over the clearing: a bough from each of the nearest trees, clusters of leaves across the top,
    // lower and brighter toward the gap the moon comes through, and vines hanging from it.
    for (const s of [-1, 1]) {
      const [tx] = near.find(([, ss]) => ss === s);
      limb(p, [[tx, 20 * u], [lerp(tx, gx, 0.5), 10 * u], [gx + s * 12 * u, 12 * u]], 4 * u, 1.2, 'bark', 1.4, 7, { lit: [0, -1], side: 0.8, rim: 1.4, texMin: 99 });
    }
    for (let x = -10 * u, k = 0; x < W + 10 * u; x += (12 + hash(k, 1, 7) * 8) * u, k += 1) {
      const dx = Math.abs(x - gx); if (dx < 11 * u) continue;
      const n01 = clamp(1 - dx / (70 * u), 0, 1);
      const y = (hash(k, 2, 7) * 6 - 1) * u + n01 * 9 * u * (0.4 + hash(k, 5, 7) * 0.6);
      leafCluster(p, x, y, (9 + hash(k, 3, 7) * 6) * u, (5 + hash(k, 4, 7) * 2) * u, 'leaf', 1.8, 8, 60 + k, { n: 5, lit: 2.2 + 3 * n01, dark: 1, leaf: 1.6 * u, hang: 0.9 });
    }
    for (const [dx, len] of [[-24, 20], [-16, 12], [17, 15], [27, 22]]) {
      const x0 = gx + dx * u;
      ivy(p, (t) => [x0 + Math.sin(t * 2.4 + dx) * 1.5 * u, (7 + t * len) * u], Math.round(len / 3.4), 'leaf', 2.4, 8, 200 + dx, u, 1.8);
    }
    if (warm) reramp(p, gx, 62 * u, 64 * u, 46 * u, ['bark', 'moss', 'leaf'], 'sun', 0.55);
  }

  /** The finish over everything: the clearing's breath, the vignette, the lit top edges. */
  function finishA(p, c) {
    const { W, H, u, gx, hz, bright } = c;
    p.light(gx, hz - 8 * u, 64 * u, 1.3 * bright, (t) => 0.5 + 0.5 * Math.sin(t * 0.8), { zMax: 4, sx: 1.8 });
    vignette(p, W, H, 1.2, 0.5);
    p.rim(0, -1, 0.6, 6);
  }

  const A = {
    job: 3, setting: 'deep-forest', key: 'A', id: 'deep-forest-a', side: 'outside',
    revised: "After your note: more foliage. Leafy boughs close over the clearing, ferns at the trunks’ feet, bushes fading into the mist, ivy on the near trunks, leaves drifting with the fireflies.",
    name: 'Deep forest', title: 'The firefly hollow',
    pitch: 'Every card is a gap between two old trunks. Beyond it, rows of trees go back into the mist to a clearing where the moonlight pools, the fireflies drift, and something always stands.',
    notes: [
      ['Light', 'The mist is the light: a pale teal pool over the clearing that swells and ebbs like breath. The trees nearest it are lit on the side that faces it; the rest of the wood is black.'],
      ['Detail', 'Rows of trunks that grow paler as they go back, bark that wraps round the near trees, roots, ferns, moss and fallen leaves, fireflies blinking on their own time.'],
      ['Vista', 'Trees across the whole board with the clearing in the middle. The card stands in the clearing against the mist: an antlered thing, a wanderer with a blue lantern, a chest in the moss, a wall of thorns, or the mist turning gold.'],
      ['World', 'The forest floor under the table, dark moss, roots and leaves, the moonlight coming down from the clearing above. Mist slides across it, and at the edges eyes open and close.'],
    ],
    palette: ['#04050C', '#0E1C28', '#23404B', '#30606A', '#43917B', '#7FC0AC', '#C8F0E2', '#1B2925', '#F2CB8A'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A);
      const u = H / 134; const cx = W / 2;
      const hz = 88 * u; const floor = 100 * u;
      const bg = glowA(u, cx, hz, 82 * u, 34, 50, 1.08, 3, 44);
      p.fill(C.rect(0, 0, W, H), 'night', (x, y) => bg(x + 0.5, y + 0.5), 0);
      // The gap in the leaves overhead that the moon comes through.
      p.shade(C.ellipse(cx, 22 * u, 16 * u, 13 * u), (x, y) => 2.4 * Math.max(0, 1 - Math.hypot((x + 0.5 - cx) / (16 * u), (y + 0.5 - 22 * u) / (13 * u))) ** 1.2, 0);
      // The floor of the clearing, the mist lying on it far off, a pool of light where the card stands.
      const ground = C.rect(0, hz - 2 * u, W, H - hz + 2 * u);
      p.fill(ground, 'moss', (x, y) => {
        const d = (y - hz) / (H - hz);
        const pool = 6 * Math.max(0, 1 - Math.hypot((x - cx) / (26 * u), (y - floor) / (8 * u))) ** 1.1;
        return 1.2 + bg(x, hz) * 0.75 * Math.exp(-d * 4) + pool;
      }, 1);
      turf(p, ground, { vx: cx, vy: hz - 14 * u, k: 5, sx: 2.6, z: 1, seed: 4, vary: 0.7, top: 0.4 });
      leaves(p, C.rect(0, hz + 8 * u, W, H - hz), 60, 5, 1, 'litter', 0.6);
      p.shade(C.poly([[cx - 1.5 * u, floor - 3 * u], [cx + 1.5 * u, floor - 3 * u], [cx + 10 * u, H], [cx - 7 * u, H]]), (x, y) => 1.1 * (1 - (y - floor) / (H - floor) * 0.6), 1);
      const gain = (x) => clamp(bg(x, hz) / 12, 0.2, 1);
      treeRows(p, W, cx, bg, [
        { z: 2, sp: 6.5 * u, w: 1.3 * u, fade: 0.84, foot: hz + 0.5 * u, footJ: u, gap: 3 * u, lean: 2 * u, seed: 11, bushes: 0.3, mist: () => { mist(p, W, hz - 2 * u, 3.5 * u, 2.6, gain, 1); mist(p, W, hz - 22 * u, 2.5 * u, 1.6, gain, 7); } },
        { z: 3, sp: 8.5 * u, w: 2.2 * u, fade: 0.6, foot: hz + 3 * u, footJ: 1.5 * u, gap: 7 * u, lean: 3 * u, seed: 12, branches: 1, leaners: 0.15, crowns: 0.3, rim: 0.1, bushes: 0.55, mist: () => { mist(p, W, hz + 2 * u, 3.5 * u, 1.8, gain, 2); mist(p, W, hz - 13 * u, 2 * u, 0.9, gain, 8); } },
        { z: 4, sp: 14 * u, w: 3.6 * u, fade: 0.34, foot: hz + 7 * u, footJ: 2 * u, gap: 12 * u, lean: 4 * u, seed: 13, branches: 2, leaners: 0.12, rim: 0.3, bushes: 0.5, mist: () => mist(p, W, hz + 6 * u, 3.5 * u, 1.1, gain, 3) },
      ]);
      // Moonlight coming down into the clearing through a gap in the leaves.
      shaft(p, cx - 12 * u, 20 * u, cx - 3 * u, hz + 2 * u, 3 * u, 8 * u, 1.6, null, { zMax: 4 });
      shaft(p, cx + 4 * u, 22 * u, cx + 8 * u, hz + 2 * u, 2 * u, 5 * u, 1.2, null, { zMax: 4 });
      // The two trunks that make the arch, leaning in until their crowns meet; lit on the side that faces the clearing.
      const rimA = (x, y) => 0.8 + 5 * clamp(1 - Math.hypot((x - cx) / (38 * u), (y - 84 * u) / (58 * u)), 0, 1) ** 1.2;
      const trunkPath = [[9, 140], [11, 110], [13, 84], [15, 64], [18, 46], [25, 30], [36, 18], [52, 8]];
      const trunkX = (y) => { // the left trunk's centre at height y (in u), along its path
        for (let k = 0; k + 1 < trunkPath.length; k += 1) {
          const [x0, y0] = trunkPath[k]; const [x1, y1] = trunkPath[k + 1];
          if (y <= y0 && y >= y1) return lerp(x0, x1, (y0 - y) / (y0 - y1));
        }
        return 18;
      };
      for (const s of [-1, 1]) {
        const X = (x) => cx + s * (cx - x);
        const sh = limb(p, trunkPath.map(([x, y]) => [X(x * u), y * u]),
          20 * u, 8 * u, 'bark', (x, y) => 1.4 + 1.8 * clamp(1 - Math.hypot((x - cx) / (40 * u), (y - 86 * u) / (54 * u)), 0, 1), 6,
          { lit: [-s, 0.25], side: 1.4, rim: rimA, fw: 3.2 * u, seed: 20 + s, plate: 9 * u });
        // Moss in patches up the lower trunk, and ivy climbing its lit side.
        p.each(sh, (x, y, i) => { if (p.z[i] === 6 && y > 70 * u && fbm(x / (3 * u), y / (5 * u), 20 + s) > 0.55) p.r[i] = p.ri('moss'); });
        ivy(p, (t) => {
          const y = lerp(126, 52, t); const hwT = 9.5 - 3.4 * (126 - y) / 74;
          return [X((trunkX(y) + hwT * 0.4 + Math.sin(t * 11 + s) * hwT * 0.3) * u), y * u];
        }, 13, 'leaf', 3.4, 6, 45 + s, u, 2.6);
        limb(p, [[X(16), 52 * u], [X(8), 38 * u], [X(-2), 30 * u]], 4 * u, 1.5 * u, 'bark', 1.2, 6, { lit: [0, -1], side: 0.6, fw: 2.5 * u, seed: 30 + s });
        root(p, [[X(13), 116 * u], [X(22), 122 * u], [X(32), 128 * u], [X(40), 136 * u]], 6 * u, 1.5 * u, 2.2, 7, { rim: 2, seed: 40 + s });
        root(p, [[X(16), 110 * u], [X(24), 111 * u], [X(31), 115 * u]], 4 * u, 1 * u, 2.6, 7, { rim: 2.4, seed: 50 + s });
        root(p, [[X(8), 122 * u], [X(2), 128 * u], [X(-4), 131 * u]], 6 * u, 3 * u, 1.4, 7, { seed: 60 + s });
        // Undergrowth at the trunk's feet: ferns and low leaves.
        leafCluster(p, X(4), 112 * u, 10 * u, 6 * u, 'leaf', 1.5, 7, 90 + (s > 0 ? 1 : 0), { n: 6, lit: 1.8, dark: 0.9, leaf: 1.8 * u });
        leafCluster(p, X(20), 119 * u, 7 * u, 4 * u, 'leaf', 1.9, 7, 92 + (s > 0 ? 1 : 0), { n: 4, lit: 2.2, dark: 0.9, leaf: 1.6 * u });
        fern(p, X(25), 109 * u, 9 * u, 'leaf', 2.6, 7, 80 + s, 5);
        fern(p, X(7), 126 * u, 10 * u, 'leaf', 1.8, 7, 84 + s, 5);
      }
      // The canopy closing over the clearing: a bough from each trunk, leaves hanging round the gap the moon comes through.
      for (const s of [-1, 1]) {
        const X = (x) => cx + s * (cx - x);
        limb(p, [[X(20), 42 * u], [X(30), 32 * u], [X(42), 31 * u]], 3 * u, 1.2, 'bark', 1.6, 7, { lit: [0, -1], side: 0.8, rim: 1.2, texMin: 99 });
        [[4, 12, 11, 6], [17, 5, 12, 6], [32, 9, 12, 6], [9, 30, 8, 5], [24, 25, 9, 5], [34, 32, 7, 4.5], [41, 26, 5, 3.5]].forEach(([x, y, rx, ry], k) => {
          const near = clamp(1 - Math.hypot(x - cx / u, y - 26) / 30, 0, 1);
          leafCluster(p, X(x * u), y * u, rx * u, ry * u, 'leaf', 1.3, 8, 70 + k * 2 + (s > 0 ? 1 : 0), { n: 5, lit: 1.8 + 2.4 * near, dark: 0.9, leaf: 1.8 * u, hang: 0.9 });
        });
      }
      p.light(cx, 86 * u, 40 * u, 1.8, null, { zMin: 6 });
      vignette(p, W, H, 1.8, 0.58);
      p.rim(0, -1, 0.7, 6);
      const fl = particles('firefly', 18, [12 * u, 56 * u, W - 24 * u, 66 * u], 1.9, 77).filter((q) => q.a > 0.35);
      return {
        p,
        over(img) {
          driftLeaves(img, 4, [26 * u, 40 * u, 44 * u, 56 * u], 2.2, 13, '#538672', '#203E36');
          flies(img, fl, 1);
          put(img, Math.round(67 * u), Math.round(77 * u), '#A3D8C6', 0.65); put(img, Math.round(69 * u), Math.round(77 * u), '#A3D8C6', 0.65);
        },
      };
    },

    vista(W, H, cat) {
      const key = `${W}x${H}:${cat}`;
      if (vistaMemoA.has(key)) return vistaMemoA.get(key);
      const c = ctxA(W, H, cat);
      const { u, gx, warm } = c;
      const p = new Painter(W, H, RAMPS_A);
      let rise;
      if (cat === 'monster' || cat === 'wanderer' || cat === 'item') {
        // The wood is the same for these three: built once per size, copied, the card drawn in, the wood in front put back.
        const bk = `${W}x${H}`;
        let base = vistaBaseA.get(bk);
        if (!base) {
          base = new Painter(W, H, RAMPS_A);
          sceneBackA(base, c); sceneFrontA(base, c);
          vistaBaseA.set(bk, base);
        }
        p.r.set(base.r); p.v.set(base.v); p.z.set(base.z);
        p.fields = base.fields.slice(); p.tints = base.tints.slice();
        rise = subjectA(p, c, cat);
        for (let i = 0; i < base.z.length; i += 1) if (base.z[i] >= 6) { p.r[i] = base.r[i]; p.v[i] = base.v[i]; p.z[i] = base.z[i]; }
      } else {
        sceneBackA(p, c);
        rise = subjectA(p, c, cat);
        sceneFrontA(p, c);
      }
      finishA(p, c);
      const watch = [[gx - 52 * u, 46 * u, 0.1], [gx + 70 * u, 38 * u, 0.55], [gx - 96 * u, 52 * u, 0.8], [gx + 118 * u, 50 * u, 0.3]].map(([x, y, ph]) => [Math.round(x), Math.round(y), ph]);
      const made = {
        p,
        over(img, t) {
          flies(img, particles('firefly', Math.round(W / 9), [0, 30 * u, W, 60 * u], t, 7), 1);
          flies(img, particles('firefly', warm ? 16 : 8, [gx - 36 * u, 44 * u, 72 * u, 46 * u], t, 8), 1);
          driftLeaves(img, Math.round(W / 30), [0, 10 * u, W, 80 * u], t, 9, warm ? '#8A5E1E' : '#538672', '#203E36');
          if (cat === 'monster') watchers(img, watch, t, CARD.mons[2]);
          if (rise) rising(img, rise[0], rise[1], 10 * u, 22 * u, 6, t, 5, CARD.item[3]);
        },
      };
      vistaMemoA.set(key, made);
      return made;
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A);
      const u = H / 250;
      const all = C.rect(0, 0, W, H);
      p.fill(all, 'moss', 1.6, 1);
      mounds(p, all, { sx: 22 * u, sy: 13 * u, seed: 9, z: 1, amp: 0.9, lit: 7 });
      // Drifts of fallen leaves in the hollows between the moss (the drift's edge is broken in 2-pixel blocks, so its noise is taken at half size).
      const hw2 = (W + 1) >> 1; const drift = new Float32Array(hw2 * ((H + 1) >> 1));
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) drift[(y >> 1) * hw2 + (x >> 1)] = fbm(x / (40 * u), y / (26 * u), 3);
      const li = p.ri('litter');
      p.each(all, (x, y, i) => {
        if (drift[(y >> 1) * hw2 + (x >> 1)] > 0.56 + hash(x >> 1, y >> 1, 3) * 0.08) { p.r[i] = li; p.v[i] += (hash(x, y, 4) - 0.5) * 0.7; }
      });
      leaves(p, all, 420, 13, 1, 'litter', 1.9, 2.2, -0.9);
      leaves(p, all, 200, 14, 1, 'moss', 1.5, 1.8, -0.6);
      // Mossy stones, half sunk.
      const R = rng('hollow-roots');
      for (let k = 0; k < 7; k += 1) {
        const sx = k % 2 ? W - (14 + R() * 30) * u : (14 + R() * 30) * u; const sy = (30 + R() * 210) * u; const rx = (5 + R() * 6) * u;
        const st = C.ellipse(sx, sy, rx, rx * 0.6, 16);
        p.shade(C.ellipse(sx + 1, sy + rx * 0.4, rx * 1.1, rx * 0.4, 14), -1, 1);
        p.fill(st, 'moss', (x, y) => 2.4 - (y - sy) / rx * 1.2, 2);
        p.cells(st, { size: 3 * u, z: 2, seed: k, vary: 0.8, bevel: 0.9, joint: 0.7 });
      }
      // Roots crossing the floor from the trees at the edges: thick, lit along their backs, a shadow under each.
      const roots = [
        [-1, 40, 150, 70], [1, 70, 170, 96], [-1, 132, 130, 160], [1, 150, 120, 190], [-1, 196, 160, 214], [1, 220, 150, 240],
      ];
      roots.forEach(([side, y0, len, y1], k) => {
        const x0 = side < 0 ? 0 : W; const x1 = x0 - side * len * u;
        const mid = [lerp(x0, x1, 0.45), lerp(y0, y1, 0.5) * u + (R() - 0.5) * 30 * u];
        const pts = wander([x0, y0 * u], mid, [x1, y1 * u], 22, (5 + R() * 4) * u, 2 + R() * 1.5, R() * 6);
        root(p, pts, (18 + R() * 6) * u, 2, 2.3, 3, { rim: 1.8, seed: k + 3, fw: 3.4 * u, plate: 10 * u, taper: 2.2 });
        const [bx, by] = pts[9];
        root(p, wander([bx, by], [bx - side * 20 * u, by + 14 * u], [bx - side * 38 * u, by + (24 + R() * 14) * u], 12, 3 * u, 2, R() * 6), 8 * u, 1, 2.2, 3, { rim: 1.6, seed: k + 30, taper: 1.8 });
      });
      // The trees at the edges: their feet and the flared roots they stand on.
      for (const side of [-1, 1]) {
        const x = side < 0 ? -2 * u : W + 2 * u;
        limb(p, [[x, H + 4], [x - side * 3 * u, H * 0.5], [x, -4]], 46 * u, 38 * u, 'bark', 1.4, 5, { lit: [-side, -0.2], side: 1.4, rim: 2.4, fw: 3.4 * u, seed: 90 + side, plate: 12 * u });
        for (let k = 0; k < 4; k += 1) {
          const y = (24 + k * 58 + R() * 16) * u;
          root(p, wander([x - side * 14 * u, y], [x - side * 30 * u, y + 8 * u], [x - side * (46 + R() * 20) * u, y + (16 + R() * 10) * u], 12, 3 * u, 1.5, R() * 6), 14 * u, 2, 2.2, 5, { rim: 1.8, seed: 100 + k * side, fw: 3 * u, taper: 2 });
        }
        // Ivy up the tree's inner side, undergrowth along its foot, leaves hanging from above.
        ivy(p, (t) => [x - side * (17 + Math.sin(t * 9 + side) * 4 + Math.sin(t * 23) * 1.5) * u, lerp(H + 2, -2, t)], 52, 'leaf', 2.6, 6, 150 + side, u * 1.2, 2);
        // A bank of undergrowth all down the edge, clumps overlapping, the near ones lower.
        for (let yy = 8, k = 0; yy < 262; yy += 19 + hash(k, side + 5, 2) * 8, k += 1) {
          const ox = 16 + (k % 2) * 12 + hash(k, side + 7, 2) * 6;
          leafCluster(p, x - side * ox * u, yy * u, (13 + hash(k, side + 9, 2) * 6) * u, (7 + hash(k, side + 11, 2) * 3) * u, 'leaf', 1.6, 6, 160 + k * 2 + side, { n: 6, lit: 2, dark: 1, leaf: 2.2 * u });
        }
        leafCluster(p, x - side * 18 * u, 4 * u, 20 * u, 10 * u, 'leaf', 1.6, 8, 170 + side, { n: 7, lit: 2.4, dark: 1, leaf: 2.4 * u, hang: 1 });
        leafCluster(p, x - side * 48 * u, -3 * u, 18 * u, 8 * u, 'leaf', 1.5, 8, 172 + side, { n: 6, lit: 2.2, dark: 1, leaf: 2.4 * u, hang: 1 });
        leafCluster(p, x - side * 46 * u, 250 * u, 28 * u, 12 * u, 'leaf', 1.5, 6, 174 + side, { n: 8, lit: 1.9, dark: 1, leaf: 2.4 * u });
        fern(p, x - side * 34 * u, 240 * u, 20 * u, 'leaf', 2.4, 6, 120 + side, 6);
        fern(p, x - side * 26 * u, 104 * u, 14 * u, 'leaf', 2.2, 6, 130 + side, 5);
      }
      // The clearing's light coming down from behind the vista, breathing.
      p.light(W / 2, -24 * u, 170 * u, 2.8, (t) => 0.92 + 0.08 * Math.sin(t * 0.8), { sx: 1.9 });
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.34));
      p.rim(0, -1, 1.2, 3); p.rim(-1, 0, 0.5, 3);
      const watch = [[10 * u, 120 * u, 0.15], [W - 14 * u, 88 * u, 0.62], [12 * u, 196 * u, 0.4]].map(([x, y, ph]) => [Math.round(x), Math.round(y), ph]);
      const breathe = (t) => 0.8 + 0.2 * Math.sin(t * 0.8);
      const bands = [
        { y: 54 * u, h: 7 * u, speed: 2.2, hex: '#30606A', a: 0.34, seed: 1, breathe },
        { y: 112 * u, h: 6 * u, speed: -1.6, hex: '#23404B', a: 0.3, seed: 2, breathe },
        { y: 170 * u, h: 7 * u, speed: 1.2, hex: '#23404B', a: 0.26, seed: 3, breathe },
        { y: 226 * u, h: 6 * u, speed: -1.0, hex: '#1C3541', a: 0.3, seed: 4, breathe },
      ];
      return {
        p,
        over(img, t) {
          driftMist(img, bands, t);
          driftLeaves(img, 10, [0, 0, W, H], t, 31, '#325A4E', '#132823');
          flies(img, particles('firefly', 20, [0, 10 * u, W, H - 20 * u], t, 21), 0.9, false);
          watchers(img, watch, t, '#A3D8C6');
        },
      };
    },
  };

  /* ================= B: the old tree ================= */

  const RAMPS_B = {
    night: ['#04050C', '#070B14', '#0B121D', '#0E1C28', '#152A36', '#1C3541', '#23404B', '#2A5059', '#30606A', '#3A7873', '#43917B', '#5FA894', '#7FC0AC', '#A3D8C6', '#C8F0E2'],
    bark: ['#030405', '#06080A', '#0A0D10', '#0F1316', '#14191C', '#1B2124', '#232A2C', '#2D3535', '#39423F', '#48524C', '#5C675D', '#768271', '#93A08B'],
    hollow: ['#010203', '#030507', '#060A0D', '#0A1214', '#0F1C1D', '#162A28', '#203D37', '#2E5749', '#43917B', '#7FC0AC', '#C8F0E2'],
    glow: ['#203D37', '#2E5749', '#43917B', '#7FC0AC', '#C8F0E2'],
    moss: ['#030506', '#070B0C', '#0B1112', '#101817', '#15201E', '#1B2925', '#23342E', '#2C4038', '#364E43', '#425D4F', '#516E5C', '#68866F'],
    litter: ['#050506', '#09090A', '#0F0E0E', '#151413', '#1C1A18', '#24211E', '#2D2925', '#37322C', '#433C34', '#51483E', '#615648'],
    shadow: ['#020305', '#05070B', '#090D13', '#0E141B'],
    wood: ['#0B0806', '#150F0A', '#21170F', '#2F2115', '#3F2C1C', '#523A25'],
    lamp: ['#030506', '#06090D', '#0A0F15', '#0E151D', '#131C27', '#1A2532', '#22303F', '#2C3D4E', '#34495C', '#4B6680', '#6B8CA6', '#A6C0D4'],
    sun: ['#0A0806', '#140F09', '#20170C', '#2E2010', '#3F2B13', '#553816', '#6E4818', '#8A5E1E', '#B07A2C', '#E3A445', '#F2CB8A', '#FBE2AE', '#FFF1C4'],
    ...CARD,
  };

  /**
   * The great trunk: wider toward its foot, furrowed bark in long plates that
   * wrap round it, lit from the left where the moon comes in.
   */
  function greatTrunk(p, o) {
    const { cx, yTop, yBot, wT, wB, z, seed } = o;
    const hw = (y) => wT + (wB - wT) * clamp((y - yTop) / (yBot - yTop), 0, 1) ** 2.6;
    const wob = (y) => Math.sin(y * 0.05 / o.u + seed) * 1.5 * o.u;
    const pts = []; const n = 28;
    for (let i = 0; i <= n; i += 1) { const y = lerp(yTop, yBot, i / n); pts.push([cx + wob(y) - hw(y), y]); }
    for (let i = n; i >= 0; i -= 1) { const y = lerp(yTop, yBot, i / n); pts.push([cx + wob(y) + hw(y), y]); }
    const shape = [pts];
    const fw = o.fw; const plate = o.plate;
    p.fill(shape, 'bark', (x, y) => {
      const h = hw(y + 0.5); const q = clamp((x + 0.5 - cx - wob(y + 0.5)) / h, -1, 1);
      let v = o.v - (o.side ?? 1.0) * q - (o.edge ?? 0.9) * q * q;
      const s = Math.asin(q) * h * 0.95 + Math.sin(y * 0.08 / o.u + seed) * 1.4 * o.u;
      const k = Math.floor(s / fw); const fr = s / fw - k;
      const of = hash(k, 0, seed) * plate;
      const j = Math.floor((y + of) / plate);
      if (fr < 0.24) v -= o.furrow ?? 1.3;
      else if (fr < 0.36) v += 0.5;
      else v += (hash(k, j, seed + 1) - 0.5) * 0.8;
      if (fr >= 0.24 && Math.floor((y - 1 + of) / plate) !== j) v -= 0.9;
      const e = 1 - 1.6 * o.u / h;   // the outermost pixel or two: a rim where the mist or the moon is behind
      if (q < -e && o.rimL) v += typeof o.rimL === 'function' ? o.rimL(y) : o.rimL;
      if (q > e && o.rimR) v += typeof o.rimR === 'function' ? o.rimR(y) : o.rimR;
      return v;
    }, z);
    // The moonlit edge: the outermost pixels on each side moved to another ramp (pale teal), in two clean steps.
    for (const [side, E] of [[-1, o.edgeL], [1, o.edgeR]]) {
      if (!E) continue;
      const ni = p.ri(E.ramp);
      p.each(shape, (x, y, i) => {
        if (p.z[i] !== z) return;
        const h = hw(y + 0.5); const inPx = (1 - side * clamp((x + 0.5 - cx - wob(y + 0.5)) / h, -1, 1)) * h;
        const v = typeof E.v === 'function' ? E.v(y) : E.v;
        if (v === null) return;
        if (inPx < E.w1) { p.r[i] = ni; p.v[i] = v; } else if (inPx < E.w2) { p.r[i] = ni; p.v[i] = v - E.step; }
      });
    }
    return { shape, hw, wob };
  }

  /** The door in the tree: a rough pointed hollow, a lip of bark grown round it; inside, lit from its floor (where the fungi grow). */
  function hollowDoor(p, cx, top, hw, bottom, u, o = {}) {
    const rough = (sh, sd, k) => sh[0].map(([x, y], i) => [x + (hash(i, 3, sd) - 0.5) * k * u, y + (hash(i, 5, sd) - 0.5) * k * 0.6 * u]);
    const lipW = o.lip ?? 4 * u;
    const outer = [rough(C.arch(cx, top - lipW, hw + lipW, bottom + 1, 0.35), 7, 2.2)];
    const inner = [rough(C.arch(cx, top, hw, bottom, 0.35), 8, 1.4)];
    const z = o.z ?? 4;
    p.fill(outer, 'bark', (x, y) => {
      const ring = Math.sin(Math.hypot(x - cx, (y - top - hw) * 0.7) * 1.4 / u);
      return (o.lipV ?? 2.8) - 1.3 * clamp((x - cx) / (hw + lipW), -1, 1) + ring * 0.45 + (y < top + hw ? 0.4 : 0);
    }, z);
    // the groove where the lip turns in
    p.fill([rough(C.arch(cx, top - 1, hw + 1, bottom, 0.35), 8, 1.4)], 'bark', 0.4, z);
    const g = o.glow ?? 5; const gy = o.gy ?? bottom; const gr = o.gr ?? 2.2; const fall = o.fall ?? 1.4;
    const inRamp = o.ramp || 'hollow';
    p.fill(inner, inRamp, (x, y) => {
      const d = Math.hypot((x + 0.5 - cx) / (hw * 1.2), (y + 0.5 - gy) / (hw * gr));
      const wall = Math.abs(x + 0.5 - cx) / hw;
      const lit = o.flood ? clamp(0.62 + 0.38 * (y - top) / (bottom - top) - wall * wall * 0.25, 0, 1) : Math.max(0, 1 - d) ** fall;
      const grain = (hash(Math.floor((x - cx) / (1.6 * u) + Math.sin(y * 0.2 / u) * 0.4), 0, 31) - 0.5) * 1.1 * Math.min(1, lit * 3);
      return 0.5 + g * lit - wall * wall * 1.1 + grain;
    }, z + 1);
    // The edge of the door catching the light from inside: one clean band round the arch, a step brighter low down.
    if (o.rimV) {
      const ii = p.ri(inRamp); const ri = p.ri(o.rimRamp || inRamp); const hits = [];
      p.each(outer, (x, y, i) => {
        if (p.z[i] !== z || x < 1 || x >= p.w - 1) return;
        for (const j of [i - 1, i + 1, i - p.w, i + p.w]) if (p.z[j] === z + 1 && p.r[j] === ii) { hits.push([i, y]); break; }
      });
      for (const [i, y] of hits) { p.r[i] = ri; p.z[i] = z; p.v[i] = y > top + (bottom - top) * 0.6 ? o.rimV + 1 : o.rimV; }
    }
    return inner;
  }

  const B = {
    job: 3, setting: 'deep-forest', key: 'B', id: 'deep-forest-b',
    name: 'Deep forest', title: 'The old tree',
    pitch: 'At the heart of the wood stands a tree older than the paths, and every card is the door in its trunk. The moon comes down through the canopy in shafts; whatever the card is waits in the hollow.',
    notes: [
      ['Light', 'Moonbeams fall through the canopy as pale teal shafts and land on the roots before the door. Inside the hollow, mushrooms glow faintly on its floor; everything else is the black of the trunk.'],
      ['Detail', 'Deep furrowed bark in long plates, a lip of bark grown round the door, roots spilling out over the sill, glowing fungi, moss and leaves between the roots, fireflies round the hollow.'],
      ['Vista', 'The great trunk in the middle of the board with its door, smaller trees either side going back into mist, shafts of moonlight across the width. The card is at the door: eyes inside, a wanderer on the sill, a chest, thorns grown across it, or gold light pouring out.'],
      ['World', 'The old tree’s roots run under the whole table through drifts of leaves. Pools of moonlight lie at the edges and slowly brighten and fade as the canopy moves.'],
    ],
    palette: ['#04050C', '#0A0D10', '#1B2124', '#39423F', '#768271', '#162A28', '#43917B', '#C8F0E2', '#2D2925'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['glow'] });
      const u = H / 134; const cx = W / 2;
      const floor = 110 * u;
      // Behind the tree: a dark wood, the moon's haze at the top left.
      p.fill(C.rect(0, 0, W, H), 'night', (x, y) => 1.2 + 6 * Math.max(0, 1 - Math.hypot((x - 4 * u) / (34 * u), (y + 4 * u) / (44 * u))) + 2 * Math.exp(-(((y - 84 * u) / (10 * u)) ** 2)), 0);
      for (const [x, w] of [[4, 3], [10, 2], [87, 3], [93, 2.4], [81, 1.6]]) limb(p, [[x * u, 104 * u], [x * u, -2]], w * u, w * u * 0.8, 'night', (px, py) => 1.0 + 2.6 * Math.max(0, 1 - py / (64 * u)) * (px < cx ? 1 : 0.25), 1, { texMin: 99 });
      // The ground.
      const ground = C.rect(0, floor - 4 * u, W, H - floor + 4 * u);
      p.fill(ground, 'litter', 2, 2);
      leaves(p, ground, 50, 3, 2, 'litter', 0.9, 1.6);
      greatTrunk(p, { cx, yTop: -2, yBot: floor + 6 * u, wT: 33 * u, wB: 52 * u, z: 3, seed: 2, v: 3, side: 1.3, furrow: 2, fw: 4.4 * u, plate: 14 * u, u,
        rimR: (y) => 0.4 + 1.6 * Math.exp(-(((y - 84 * u) / (12 * u)) ** 2)),
        edgeL: { ramp: 'night', v: (y) => (y < 74 * u ? 11 : null), step: 3, w1: 1.5, w2: 3 } });
      // Where the beam lands on the bark.
      p.light(19 * u, 50 * u, 24 * u, 3.2, null, { zMin: 3, zMax: 3, sx: 0.6 });
      // Bracket fungi up the trunk: pale shelves, a shadow under each.
      for (const [x, y, w] of [[78, 64, 4], [75, 71, 3]]) {
        p.fill(C.ellipse(x * u, y * u + 0.5, w * u + 0.5, 1.4 * u, 16), 'bark', (px, py) => (py + 0.5 > y * u ? 0.5 : null), 4);
        p.fill(C.ellipse(x * u, y * u, w * u, 2.4 * u, 16), 'bark', (px, py) => (py + 0.5 > y * u ? null : 4.6 + (y * u - py) * 0.7 - Math.abs(px - x * u) / (w * u) * 1.2), 4);
      }
      // The door, lit low from inside by the mushrooms on its floor.
      const top = 30 * u; const hw = 17 * u; const sill = 106 * u;
      hollowDoor(p, cx, top, hw, sill, u, { z: 4, glow: 7.2, gy: sill - 16 * u, gr: 3.8, fall: 0.85, lip: 4.5 * u, lipV: 3.2, rimV: 7 });
      p.fill(C.poly([[cx - hw, sill], [cx - hw * 0.5, sill - 4 * u], [cx + hw * 0.5, sill - 5 * u], [cx + hw, sill]]), 'hollow', 6, 5);
      fungi(p, cx + 3 * u, sill - 3.5 * u, 4, u * 1.15, 'glow', 6, 4, 3.6);
      fungi(p, cx - 9 * u, sill - 2 * u, 2, u * 1.1, 'glow', 6, 5, 3);
      // More of them climbing the inside walls, so the glow goes up the hollow.
      for (const [x, y, s] of [[cx - hw + 0.5, 84 * u, 1], [cx + hw - 0.5, 72 * u, -1], [cx - hw + 0.5, 60 * u, 1], [cx + hw - 0.5, 48 * u, -1]]) {
        p.light(x + s * 3 * u, y, 11 * u, 2.4, null, { zMin: 5, zMax: 5 });
        p.fill(C.rect(s > 0 ? x : x - 3 * u, y, 3 * u, 1), 'glow', 3, 6);
        p.fill(C.rect(s > 0 ? x : x - 2 * u, y - 1, 2 * u, 1), 'glow', 2, 6);
      }
      p.light(cx, sill - 6 * u, 26 * u, 1.6, null, { zMin: 4, zMax: 4 });
      // Roots spilling out over the sill, and the tree's own roots either side.
      const rootsB = [
        [[[cx - 6 * u, sill - 2 * u], [cx - 12 * u, sill + 4 * u], [cx - 22 * u, 122 * u], [cx - 34 * u, 140 * u]], 7 * u, 2.5 * u],
        [[[cx + 5 * u, sill - 3 * u], [cx + 12 * u, sill + 3 * u], [cx + 24 * u, 120 * u], [cx + 38 * u, 138 * u]], 7 * u, 2.5 * u],
        [[[cx - 1 * u, sill - 1 * u], [cx + 1 * u, sill + 8 * u], [cx - 3 * u, 124 * u], [cx + 2 * u, 140 * u]], 6 * u, 3 * u],
        [[[cx - 40 * u, 100 * u], [cx - 46 * u, 114 * u], [cx - 54 * u, 126 * u]], 12 * u, 6 * u],
        [[[cx + 40 * u, 100 * u], [cx + 47 * u, 113 * u], [cx + 55 * u, 124 * u]], 12 * u, 6 * u],
        [[[cx - 26 * u, 112 * u], [cx - 32 * u, 124 * u], [cx - 30 * u, 140 * u]], 8 * u, 3 * u],
        [[[cx + 26 * u, 112 * u], [cx + 34 * u, 126 * u], [cx + 30 * u, 140 * u]], 8 * u, 3 * u],
      ];
      rootsB.forEach(([pts, w0, w1], i) => root(p, pts, w0, w1, 2.8, 6, { rim: 1.8, fw: 3 * u, seed: 10 + i, groundZ: 2 }));
      // Moss on the roots' backs.
      p.each(C.rect(0, sill - 4 * u, W, H), (x, y, i) => { if (p.z[i] === 6 && p.v[i] > 3.4 && hash(x >> 1, y >> 1, 9) < 0.35) p.r[i] = p.ri('moss'); });
      // The moonbeam, down from the top left across the trunk to the sill, where the floor it lights is moss.
      reramp(p, cx - 4 * u, 121 * u, 26 * u, 9 * u, ['litter'], 'moss', 0.5);
      shaft(p, -8 * u, -6 * u, cx - 4 * u, 122 * u, 10 * u, 22 * u, 5.4);
      p.light(cx - 4 * u, 118 * u, 24 * u, 2.4, null, { zMin: 2, sy: 0.45 });
      vignette(p, W, H, 2, 0.5);
      p.rim(-1, 0, 0.5, 6);
      const fl = particles('firefly', 14, [cx - 36 * u, 56 * u, 72 * u, 54 * u], 2.3, 19).filter((q) => q.a > 0.3)
        .concat(particles('firefly', 5, [cx - hw * 0.6, top + hw, hw * 1.2, sill - top - hw * 1.5], 1.1, 29).map((q) => ({ ...q, a: 0.8, big: false })));
      const motes = particles('mote', 14, [0, 8 * u, 48 * u, 100 * u], 3, 23);
      return {
        p,
        over(img) {
          for (const q of motes) {
            const t = (q.y + 6 * u) / (128 * u); const bx = lerp(-8 * u, cx - 4 * u, t);
            if (Math.abs(q.x - bx) < lerp(4, 10, t) * u) put(img, q.x, q.y, '#A3D8C6', 0.7);
          }
          flies(img, fl, 1);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['glow'] });
      const u = H / 100; const gx = W / 2;
      const hz = 74 * u; const floor = 90 * u;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const warm = cat === 'clear-path';
      // The wood behind: dark and blue with a thin mist low down, so the old tree stands out of it.
      const bg = (x, y) => 0.8 + (2.0 + 0.8 * Math.sin(x * 0.04 / u + 1) * Math.sin(x * 0.011 / u)) * Math.exp(-(((y - hz + 4 * u + Math.sin(x * 0.03 / u) * 2 * u) / (9 * u)) ** 2)) * (0.45 + 0.55 * Math.max(0, 1 - Math.abs(x - gx) / (150 * u)));
      p.fill(C.rect(0, 0, W, H), 'night', (x, y) => bg(x + 0.5, y + 0.5), 0);
      const gain = (x) => clamp(0.4 + 0.6 * (1 - Math.abs(x - gx) / (150 * u)), 0.3, 1);
      treeRows(p, W, gx, bg, [
        { z: 1, sp: 7 * u, w: 1.8 * u, fade: 0.62, foot: hz + 1 * u, footJ: u, gap: 0, lean: 2 * u, seed: 61, mist: () => mist(p, W, hz - 1 * u, 4 * u, 1.2, gain, 4) },
        { z: 1, sp: 13 * u, w: 3 * u, fade: 0.36, foot: hz + 4 * u, footJ: 1.5 * u, gap: 0, lean: 3 * u, seed: 62, branches: 1, mist: () => mist(p, W, hz + 3 * u, 4 * u, 0.8, gain, 5) },
      ]);
      // The floor: leaves and moss.
      const ground = C.rect(0, hz + 2 * u, W, H - hz);
      p.fill(ground, 'litter', (x, y) => 1.3 + 2 * Math.exp(-(y - hz) / (6 * u)), 2);
      turf(p, ground, { vx: gx, vy: hz - 10 * u, k: 5, sx: 2.6, z: 2, seed: 8, vary: 0.8, top: 0.4 });
      leaves(p, ground, Math.round(W / 3), 9, 2, 'moss', 0.5, 1.4);
      // Smaller trees either side, in the dark wood's own blue: only a thin rim toward the old tree.
      const r = rng(71);
      for (let d = 64 * u, k = 0; d < W / 2 + 20 * u; d += (34 + r() * 26) * u, k += 1) {
        for (const s of [-1, 1]) {
          const x = gx + s * (d + (r() - 0.5) * 10 * u); const w = (6 + r() * 5) * u; const foot = (86 + r() * 8) * u;
          limb(p, [[x, foot + 2 * u], [x + s * r() * 4 * u, 40 * u], [x + s * (2 + r() * 6) * u, -4 * u]], w * 1.3, w * 0.8, 'night', 1.5, 3,
            { lit: [-s, -0.2], side: 0.5, rim: 1.6, fw: 2.6 * u, seed: k * 2 + s, furrow: 0.6, vary: 0.3 });
          for (const sd of [-1, 1]) root(p, [[x, foot], [x + sd * w, foot + 2.5 * u], [x + sd * w * 2, foot + 4 * u]], w * 0.5, 1, 1.5, 3, { rim: 1, seed: k + sd, groundZ: 2, ramp: 'night' });
        }
      }
      // The great trunk: deep grooves, pale where the moon catches its left edge.
      greatTrunk(p, { cx: gx, yTop: -4, yBot: floor + 4 * u, wT: 31 * u, wB: 48 * u, z: 4, seed: 5, v: 3.8, side: 1.4, edge: 1.0, furrow: 2.4, fw: 4.6 * u, plate: 13 * u, u,
        edgeL: { ramp: 'night', v: (y) => (y < hz - 12 * u ? 12 : 10), step: 3, w1: 1.1 * u + 0.5, w2: 2.6 * u + 0.8 },
        edgeR: { ramp: 'night', v: 5, step: 0, w1: 0.8 * u + 0.4, w2: 0 } });
      const roots = [
        [[gx - 34 * u, 80 * u], [gx - 50 * u, 90 * u], [gx - 72 * u, 95 * u], [gx - 96 * u, 99 * u]], [[gx + 34 * u, 80 * u], [gx + 52 * u, 89 * u], [gx + 74 * u, 94 * u], [gx + 100 * u, 98 * u]],
        [[gx - 22 * u, 86 * u], [gx - 32 * u, 96 * u], [gx - 40 * u, 104 * u]], [[gx + 24 * u, 86 * u], [gx + 34 * u, 97 * u], [gx + 44 * u, 104 * u]],
        [[gx - 42 * u, 74 * u], [gx - 58 * u, 82 * u], [gx - 78 * u, 86 * u]], [[gx + 42 * u, 74 * u], [gx + 60 * u, 81 * u], [gx + 80 * u, 85 * u]],
        [[gx - 8 * u, floor - 2 * u], [gx - 12 * u, floor + 4 * u], [gx - 18 * u, floor + 12 * u]], [[gx + 7 * u, floor - 2 * u], [gx + 12 * u, floor + 5 * u], [gx + 16 * u, floor + 12 * u]],
      ];
      roots.forEach((pts, i) => root(p, pts, (i < 2 ? 12 : i < 4 ? 8 : i < 6 ? 9 : 6) * u, 1.5, 2.8, 6, { rim: 1.8, fw: 3 * u, seed: 20 + i, groundZ: 2 }));
      // The door, bigger, lit from inside by the mushrooms on its floor; its edge catches that light.
      const top = 22 * u; const hw = 16 * u; const sill = floor - 1 * u;
      const look = {
        monster: { glow: 7.5, gy: sill - 26 * u, gr: 3, fall: 1.1 }, obstacle: { glow: 6.5, gy: sill - 20 * u, gr: 3.2, fall: 1.1 },
        'clear-path': { glow: 11.5, flood: true }, item: { glow: 5, gy: sill - 4 * u, gr: 3, fall: 1.2 }, wanderer: { glow: 6.5, gy: sill - 6 * u, gr: 3.4, fall: 1.1 },
      }[cat];
      const inner = hollowDoor(p, gx, top, hw, sill, u, { z: 7, lip: 4 * u, lipV: 3.4, ramp: warm ? 'sun' : 'hollow', rimV: warm ? 9 : 7, ...look });
      if (!warm) {
        p.fill(C.poly([[gx - hw, sill + 0.5], [gx - hw * 0.55, sill - 3 * u], [gx + hw * 0.5, sill - 3.5 * u], [gx + hw, sill + 0.5]]), 'hollow', 7, 8);
        if (cat !== 'item') fungi(p, gx + 4 * u, sill - 2 * u, 4, u, 'glow', 9, 6, 3.4);
        // The roots and the floor at the sill catch the mushrooms' light.
        reramp(p, gx, sill + 4 * u, 34 * u, 9 * u, ['bark'], 'hollow', 0.75, [6, 6]);
        reramp(p, gx, sill + 5 * u, 30 * u, 8 * u, ['litter'], 'moss', 0.75, [2, 2]);
        p.light(gx, sill + 2 * u, 30 * u, 3, null, { zMin: 2, zMax: 6, sy: 0.45 });
      }
      // The card, at the door.
      let rise = null; let keep = null;
      if (cat === 'monster') {
        const e = stalker(p, gx, sill + 1 * u, 40 * u, ramp, 9, 0.1);
        p.backlit(9, 'hollow', 3.4, 'hollow', 7.2);
        for (const f of [0, 1, 2]) p.fill(C.rect(gx + hw - 1, top + hw * 1.6 + f * 2 * u, 3 * u, 1.2), 'shadow', 0.3, 10);
        p.tint(e[0], e[1], 5 * u, hex, 0.5, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        keep = wanderer(p, gx - 1 * u, sill + 3 * u, 30 * u, 9, 'hollow', 3, ['litter', 'moss', 'bark', 'hollow'], [2, 6], 22 * u, 2).keep;
      } else if (cat === 'item') {
        chest(p, gx, sill - 0.5 * u, 18 * u, ramp, 9);
        fungi(p, gx - 10 * u, sill - 1 * u, 2, u, 'glow', 9, 6, 3);
        p.light(gx, sill - 8 * u, 18 * u, 3, flicker(2, 0.15, 0.7), { zMin: 8, zMax: 8 });
        p.tint(gx, sill - 10 * u, 11 * u, hex, 0.65, flicker(2, 0.15, 0.7));
        rise = [gx, sill - 10 * u];
      } else if (cat === 'obstacle') {
        // Thorned stems grown across the door from lip to lip, criss-crossed.
        const rr = rng(4);
        for (let k = 0; k < 16; k += 1) {
          const lft = rr() < 0.5;
          const y0 = top + hw * 0.6 + rr() * (sill - top - hw * 0.6); const y1 = y0 + (rr() - 0.5) * 30 * u;
          const a = [gx + (lft ? -1 : 1) * (hw + 2 * u), y0]; const b = [gx + (lft ? 1 : -1) * (hw + 2 * u), clamp(y1, top + hw * 0.6, sill + 2 * u)];
          const pts = bez(a, [gx + (rr() - 0.5) * 6 * u, (a[1] + b[1]) / 2 + (rr() - 0.2) * 7 * u], b, 14);
          p.fill(ribbon(pts, (1.2 + rr() * 0.6) * u + 0.4, 0.9 * u + 0.4), ramp, 0.1, 9);
          for (let j = 1; j < pts.length - 1; j += 1) if (rr() < 0.5) { const [tx, ty] = pts[j]; const sd = rr() < 0.5 ? -1 : 1; p.fill(C.poly([[tx - 0.7, ty], [tx + 0.7, ty], [tx + sd * 0.6 * u, ty - 2.2 * u]]), ramp, 0.2, 9); }
        }
        p.backlit(9, 'hollow', 2.6, ramp, 2.6);
        p.rim(0, -1, 0.9, 9);
        p.tint(gx, sill - 24 * u, 12 * u, hex, 0.35, flicker(0.5, 0.12, 0.6));
      } else if (warm) {
        reramp(p, gx, sill + 6 * u, 48 * u, 14 * u, ['litter', 'moss', 'bark'], 'sun', 0.6);
        reramp(p, gx, sill - 20 * u, hw + 9 * u, 38 * u, ['bark'], 'sun', 0.5);
        p.light(gx, sill + 2 * u, 52 * u, 4, flicker(0.2, 0.06, 0.4), { zMin: 2, zMax: 6, sy: 0.4 });
        p.light(gx, sill - 18 * u, 24 * u, 2.6, flicker(0.2, 0.06, 0.4), { zMin: 7, zMax: 7 });
      }
      // The limbs of the old tree spread overhead, its leaves lost in the dark.
      for (const s of [-1, 1]) {
        limb(p, [[gx + s * 18 * u, 14 * u], [gx + s * 50 * u, 4 * u], [gx + s * 96 * u, -2 * u]], 12 * u, 4 * u, 'bark', 2, 5, { lit: [0, -1], side: 1.2, rim: 1.8, fw: 3 * u, seed: 40 + s });
        for (let k = 0; k < 5; k += 1) foliage(p, gx + s * (40 + k * 34) * u, (hash(k, s + 3, 3) * 6 - 2) * u, 16 * u, 6 * u, 'night', 1.2, 8, 80 + k * 2 + s, 6, [0, -1], 0.6);
      }
      // Moonbeams through the canopy, the brightest down the trunk's left side to the roots before the door.
      shaft(p, gx - 52 * u, -6 * u, gx - 9 * u, floor + 8 * u, 10 * u, 24 * u, 6.5, flicker(0.2, 0.08, 0.25), { zMax: 8 });
      const beams = [];
      for (let d = 90 * u, k = 0; d < W / 2 + 30 * u; d += (70 + hash(k, 2, 5) * 50) * u, k += 1) for (const s of [-1, 1]) beams.push(gx + s * d);
      beams.forEach((x, i) => shaft(p, x - 30 * u, -6 * u, x, floor + 6 * u, 6 * u, 14 * u, 3.6 + hash(i, 1, 2) * 1.4, flicker(i * 1.3, 0.2, 0.2), { zMax: 6 }));
      p.light(gx - 9 * u, floor + 6 * u, 26 * u, 2.6, null, { zMin: 2, zMax: 6, sy: 0.35 });
      vignette(p, W, H, 1.1, 0.5);
      p.rim(0, -1, 0.5, 5);
      if (keep) for (const [i, ri, v] of keep) { p.r[i] = ri; p.v[i] = v; }
      const watch = [[gx - 30 * u, 12 * u, 0.2], [gx + 26 * u, 18 * u, 0.6], [gx + 84 * u, 30 * u, 0.85], [gx - 110 * u, 40 * u, 0.4]].map(([x, y, ph]) => [Math.round(x), Math.round(y), ph]);
      return {
        p,
        over(img, t) {
          flies(img, particles('firefly', Math.round(W / 14), [gx - 70 * u, 30 * u, 140 * u, 60 * u], t, 41), 1);
          flies(img, particles('firefly', Math.round(W / 24), [0, 30 * u, W, 60 * u], t, 42), 0.8);
          if (cat === 'monster') watchers(img, watch, t, CARD.mons[2]);
          if (rise) rising(img, rise[0], rise[1], 9 * u, 24 * u, 6, t, 5, CARD.item[3]);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['glow'] });
      const u = H / 250;
      const all = C.rect(0, 0, W, H);
      p.fill(all, 'litter', 1.6, 1);
      mounds(p, all, { sx: 26 * u, sy: 15 * u, seed: 19, z: 1, amp: 0.9, lit: 7 });
      p.each(all, (x, y, i) => {
        if (fbm(x / (36 * u), y / (22 * u), 6) > 0.58 + hash(x >> 1, y >> 1, 6) * 0.08) { p.r[i] = p.ri('moss'); p.v[i] += (hash(x, y, 7) - 0.4) * 0.7; }
      });
      leaves(p, all, 560, 17, 1, 'litter', 1.9, 2.2, -0.9);
      leaves(p, all, 140, 18, 1, 'moss', 1.4, 1.8, -0.6);
      // The old tree's roots, out from under the vista and across the whole floor, forking as they go.
      const R = rng('old-roots');
      const mains = [[0.36, -1, 150], [0.46, -0.45, 230], [0.56, 0.4, 220], [0.66, 1, 160]];
      mains.forEach(([fx, dir, reach], k) => {
        const x0 = W * fx; const x2 = x0 + dir * (90 + R() * 40) * u; const y2 = reach * u;
        const pts = wander([x0, -8 * u], [x0 + dir * 50 * u, y2 * 0.35], [x2, y2], 24, (6 + R() * 4) * u, 2.5 + R(), R() * 6);
        root(p, pts, 22 * u, 3 * u, 2.6, 3, { rim: 1.8, fw: 3.4 * u, seed: 200 + k, taper: 1.8, plate: 11 * u });
        for (let j = 0; j < 2; j += 1) {
          const [bx, by] = pts[7 + j * 8]; const sd = (j ? 1 : -1) * (dir || 1);
          root(p, wander([bx, by], [bx + sd * 30 * u, by + 14 * u], [bx + sd * (54 + R() * 30) * u, by + (30 + R() * 30) * u], 14, 4 * u, 2, R() * 6), 10 * u, 1.2, 2.4, 3, { rim: 1.6, seed: 220 + k * 3 + j, taper: 1.8 });
        }
      });
      // Pools of moonlight where the canopy opens, at the edges; they brighten and fade.
      const pools = [[18 * u, 196 * u, 42, 0], [W - 22 * u, 214 * u, 48, 1.7], [W * 0.2, 4 * u, 48, 3.1], [W * 0.82, 8 * u, 44, 4.4], [6 * u, 92 * u, 30, 2.2], [W - 6 * u, 124 * u, 30, 5]];
      pools.forEach(([x, y, r, ph]) => {
        reramp(p, x, y, r * u, r * u * 0.5, ['litter'], 'moss', 0.5);
        p.light(x, y, r * u, 2.2, null, { sy: 0.5 });
        p.light(x, y, r * u * 0.7, 2.4, (t) => 0.55 + 0.45 * Math.sin(t * 0.45 + ph), { sy: 0.5 });
      });
      fungi(p, 12 * u, 150 * u, 3, u * 1.3, 'glow', 4, 3, 3);
      fungi(p, W - 12 * u, 62 * u, 3, u * 1.3, 'glow', 4, 4, 3);
      fungi(p, W - 10 * u, 176 * u, 3, u * 1.3, 'glow', 4, 5, 3);
      p.light(W / 2, -24 * u, 150 * u, 2, null, { sx: 1.8 });
      p.shade(null, (x, y) => -1.8 * Math.max(0, y / H - 0.4) * (1 - Math.abs(x - W / 2) / W));
      p.rim(0, -1, 1.1, 3); p.rim(-1, 0, 0.9, 3);
      return {
        p,
        over(img, t) {
          flies(img, particles('firefly', 10, [0, 20 * u, W, H - 30 * u], t, 51), 0.9, false);
        },
      };
    },
  };


  /* ================= C: the heartwood hall (inside A's wood) ================= */

  const RAMPS_C = {
    night: RAMPS_A.night,
    grain: ['#030409', '#060810', '#0A0D17', '#0E131F', '#131A27', '#19222F', '#202B37', '#28363F', '#324349', '#3E5354', '#506862', '#688274'],
    bark: RAMPS_A.bark,
    glow: ['#203D37', '#2E5749', '#43917B', '#7FC0AC', '#C8F0E2'],
    moss: RAMPS_A.moss, leaf: RAMPS_A.leaf, litter: RAMPS_A.litter, shadow: RAMPS_A.shadow,
    wood: RAMPS_A.wood, lamp: RAMPS_A.lamp, sun: RAMPS_A.sun,
    ...CARD,
  };
  const breath = (ph) => (t) => 0.85 + 0.15 * Math.sin(t * 0.8 + ph); // the fungi glow with the forest's breath

  /** The inside of the trunk: grain running up the curved wall (wider apart near us, closer toward the heart), bending round knots. */
  function grainWall(p, shape, o) {
    const { cx, f, sp, z, seed, u } = o; const knots = o.knots || [];
    p.each(shape, (x, y, i) => {
      if (z !== undefined && p.z[i] !== z) return;
      let X = x + 0.5 - cx;
      for (const [kx, ky, kr] of knots) {
        const dx = x + 0.5 - kx; const dy = (y + 0.5 - ky) * 0.55;
        X += Math.sign(dx) * kr * 1.5 * Math.exp(-(dx * dx + dy * dy) / (kr * kr * 1.6));
      }
      const th = Math.atan(X / f) * f * 0.6 + X * 0.4 + Math.sin(y * 0.07 / u + X * 0.02) * 2 * u;
      const line = Math.floor(th / sp); const fr = th / sp - line;
      let dv = (hash(line, 0, seed) - 0.5) * 0.6;
      if (fr < 0.17) dv -= 0.85; else if (fr < 0.32) dv += 0.3;
      p.v[i] += dv;
    });
    for (const [kx, ky, kr] of knots) {
      p.shade(C.ellipse(kx, ky, kr * 0.6, kr, 16), (x, y) => {
        const d = Math.hypot((x + 0.5 - kx) / (kr * 0.6), (y + 0.5 - ky) / kr);
        return d < 0.4 ? -1.8 : (Math.floor(d * 4) % 2 ? -0.6 : 0.35);
      }, z);
    }
  }

  /** A shelf fungus on the wall, seen from the front: a half-disc, a pale top edge, its gills in shadow underneath. */
  function bracket(p, x, y, w, z) {
    const h = Math.max(2, w * 0.6);
    p.fill(C.ellipse(x, y + 0.5, w * 0.9, Math.max(1, h * 0.35), 14), 'glow', (px, py) => (py + 0.5 > y ? 0.3 : null), z);
    p.fill(C.ellipse(x, y, w, h, 16), 'glow', (px, py) => (py + 0.5 > y ? null : (y - (py + 0.5) > h - 1.2 ? 3 : 2)), z);
  }

  /** The far wall of the heart: a tall rough-pointed recess, glowing up from its floor, its grain showing in the light. */
  function heartRecess(p, cx, top, hw, bottom, g, z, u, ramp = 'night', flood = false) {
    const sh = [C.arch(cx, top, hw, bottom, 0.45)[0].map(([x, y], i) => [x + (hash(i, 6, 3) - 0.5) * 1.4 * u, y])];
    p.fill(sh, ramp, (x, y) => {
      if (flood) return 1.2 + g * clamp(0.62 + 0.38 * (y - top) / (bottom - top) - ((x + 0.5 - cx) / hw) ** 2 * 0.3, 0, 1);
      const d = Math.hypot((x + 0.5 - cx) / (hw * 1.1), (y + 0.5 - bottom) / ((bottom - top) * 0.95));
      return 1.2 + g * Math.max(0, 1 - d) ** 1.15;
    }, z);
    p.shade(sh, (x, y) => ((((x - cx) / (2.4 * u) + Math.sin(y * 0.12 / u) * 0.5) % 1 + 1) % 1 < 0.2 ? -0.7 : 0), z);
    return sh;
  }

  /** A rib of root arching overhead: two halves rising from the floor and meeting at the top, lit on the side toward `lit`. */
  function ribArch(p, cx, hw, base, top, w, v, z, o = {}) {
    const seed = o.seed || 1;
    for (const s of [-1, 1]) {
      // A root, not a moulding: its line wavers and it swells and thins as it climbs.
      const raw = [[cx + s * hw, base], [cx + s * hw * 1.04, lerp(base, top, 0.3)], [cx + s * hw * 1.0, lerp(base, top, 0.58)], [cx + s * hw * 0.84, top + hw * 0.45], [cx + s * hw * 0.5, top + hw * 0.1], [cx - s * hw * 0.08, top]];
      const pts = raw.map(([x, y], i) => (i === 0 || i === raw.length - 1 ? [x, y] : [x + (hash(i, s + 2, seed) - 0.5) * w * 0.7, y + (hash(i, s + 5, seed) - 0.5) * w * 0.5]));
      limb(p, pts, w, w * 0.6, 'bark', v, z, { lit: [-s, 0.6], side: o.side ?? 1.4, rim: o.rim ?? 2, fw: o.fw || 2.6, seed: seed + s, plate: o.plate || 7, edge: 0.7 });
      // A knuckle where it bends, and rootlets hanging from it.
      const [kx, ky] = pts[3];
      p.fill(C.ellipse(kx, ky, w * 0.7, w * 0.55, 12), 'bark', (px, py) => (typeof v === 'function' ? v(px, py) : v) + (py < ky ? 0.8 : -0.6), z);
      for (let j = 0; j < (o.rootlets ?? 2); j += 1) {
        const [rx, ry] = pts[1 + j * 2] || pts[1];
        const len = w * (2 + hash(j, s, seed + 9) * 2);
        limb(p, [[rx, ry], [rx - s * len * 0.3, ry + len * 0.5], [rx - s * len * 0.2, ry + len]], Math.max(1, w * 0.3), 0.8, 'bark', typeof v === 'function' ? v : v + 0.3, z, { lit: [-s, 0], side: 0.6, texMin: 99, rim: (o.rim ?? 2) * 0.6 });
      }
      // Shelf fungus growing on the root, glowing, lighting the root round it.
      if (o.fungus) {
        const [fx, fy] = pts[s < 0 ? 2 : 1];
        const bx = fx - s * w * 0.45; const by = fy + (s < 0 ? 0 : w * 0.8);
        p.light(bx, by + 1, w * 2.6, 2.6, null, { zMin: z, zMax: z });
        bracket(p, bx, by, Math.max(1.6, w * 0.42), z);
      }
    }
  }

  /** A knot-hole window: a rough hole in the wood, pale with moonlight, its lip catching it, leaves hanging in. */
  function knotHole(p, kx, ky, rx, ry, z, u, seed) {
    p.fill(C.ellipse(kx, ky, rx + 1.6 * u, ry + 1.4 * u, 18), 'bark', (x, y) => (y + 0.5 < ky - ry * 0.3 ? 4 : 2), z);
    const hole = [C.ellipse(kx, ky, rx, ry, 16)[0].map(([x, y], i) => [x + (hash(i, 2, seed) - 0.5) * 1.4 * u, y + (hash(i, 4, seed) - 0.5) * u])];
    p.fill(hole, 'night', (x, y) => 10.2 - Math.hypot((x + 0.5 - kx) / rx, (y + 0.5 - ky) / ry) * 1.2, z + 1);
    p.fill(C.circle(kx + rx * 0.25, ky - ry * 0.1, Math.max(1.2, rx * 0.42), 14), 'night', 14, z + 1);
    leafCluster(p, kx - rx * 0.7, ky - ry * 0.95, rx * 0.55, ry * 0.4, 'leaf', 1, z + 2, seed, { n: 3, lit: 1.6, dark: 0.6, leaf: 1.3 * u, hang: 1.4 });
    ivy(p, (t) => [kx + rx * 0.4 + Math.sin(t * 3) * u, ky + ry * 0.6 + t * ry * 3.4], 4, 'leaf', 2.6, z + 2, seed + 1, u, 2);
  }

  /** Roots woven over and under each other: two families crossing, each round in section and lit along its upper edge, the floor dark between. */
  function weave(p, shape, o) {
    const { s, z, seed } = o; const sy = o.sy || 1; const wf = o.w ?? 0.5; const li = p.ri(o.gapRamp || 'litter');
    p.each(shape, (x, y, i) => {
      if (z !== undefined && p.z[i] !== z) return;
      const Y = (y + 0.5) * sy; const X = x + 0.5;
      const a = (X * 0.75 + Y) / s + Math.sin(Y * 0.045 + X * 0.017 + seed) * 0.45;
      const b = (X * 0.75 - Y) / s + Math.sin(X * 0.039 - Y * 0.028 + seed * 2) * 0.45;
      const ia = Math.floor(a); const ib = Math.floor(b); const fa = a - ia - 0.5; const fb = b - ib - 0.5;
      const thick = o.vary ? 0.55 + 0.9 * vnoise(X / o.vary, Y / o.vary, seed + 9) : 1; // the weave looser here, tighter there
      const skip = o.skip ?? 0.15;
      const ha = hash(ia, 0, seed) < skip ? 0 : wf * thick * (0.7 + hash(ia, 1, seed) * 0.6) / 2;
      const hb = hash(ib, 2, seed) < skip ? 0 : wf * thick * (0.7 + hash(ib, 3, seed) * 0.6) / 2;
      const inA = Math.abs(fa) < ha; const inB = Math.abs(fb) < hb;
      const aOver = ((ia + ib) & 1) === 0;
      if (!inA && !inB) { p.r[i] = li; p.v[i] += o.gap ?? -1; return; }
      const useA = inA && (!inB || aOver);
      const q = useA ? fa / ha : fb / hb; const up = useA ? -q : q;
      let dv = up * 0.8 - q * q * 0.7;
      if (up > 0.55) dv += o.rim ?? 0.9;
      const under = useA ? (!inB && Math.abs(fb) < hb + 0.07 && !aOver) : (!inA && Math.abs(fa) < ha + 0.07 && aOver);
      if (under) dv -= 1;
      dv += (hash(useA ? ia : ib, Math.floor((useA ? b : a) * 2), seed + 5) - 0.5) * 0.5;
      p.v[i] += dv;
    });
  }

  const Cdesign = {
    job: 3, setting: 'deep-forest', key: 'C', id: 'deep-forest-c', side: 'inside',
    name: 'Deep forest', title: 'The heartwood hall',
    pitch: 'Inside the old wood’s greatest tree: a hall of living grain, roots arching overhead like ribs, a stair of roots going down to the heart, where the mushrooms glow and the moon comes in through a knot-hole.',
    notes: [
      ['Light', 'The same teal as the wood outside: mushrooms and shelf fungus glowing in the alcoves and on the heart’s floor, breathing slowly, and one shaft of moonlight from a knot-hole. The heart is brightest; the grain between falls away to black.'],
      ['Detail', 'Grain running up the curved walls and bending round knots, ribs of root, a stair of roots, shelf fungus, moss, ferns and ivy that came in with the light, leaves hanging in the knot-hole, fireflies drifting inside.'],
      ['Vista', 'Ribs of root across the board with a glowing alcove between each pair. In the middle, the heart under the knot-hole, two root steps down to it. The card stands in the heart: the antlered thing, the wanderer with the blue lantern, a chest among the mushrooms, roots and thorns grown across, or gold light where the heart opens to the outside.'],
      ['World', 'The floor under the table is roots woven over and under each other, leaves caught in them. Mushrooms glow in the crooks of the big roots at the edges, and the heart’s light comes down from the top.'],
    ],
    palette: ['#04050C', '#0E131F', '#202B37', '#324349', '#1F2C32', '#43917B', '#7FC0AC', '#C8F0E2', '#F2CB8A'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['glow'] });
      const u = H / 134; const cx = W / 2;
      const hf = 97 * u; // the heart's floor, at the foot of the stair
      // The curved wall of the hollow, lighter toward the heart.
      const all = C.rect(0, 0, W, H);
      p.fill(all, 'grain', (x, y) => 1.1 + 2.2 * Math.max(0, 1 - Math.hypot((x - cx) / (34 * u), (y - hf) / (54 * u))) ** 1.3, 0);
      grainWall(p, all, { cx, f: 40 * u, sp: 3 * u, z: 0, seed: 6, u, knots: [[14 * u, 62 * u, 4 * u], [82 * u, 46 * u, 3.5 * u], [70 * u, 86 * u, 2.5 * u]] });
      p.each(all, (x, y, i) => { if (y > 78 * u && fbm(x / (4 * u), y / (6 * u), 9) > 0.57) p.r[i] = p.ri('moss'); });
      // The heart, down the stair: its far wall glowing up from the mushrooms on its floor.
      heartRecess(p, cx, 54 * u, 12 * u, hf, 10.5, 1, u);
      fungi(p, cx - 4 * u, hf - 0.5 * u, 4, u, 'glow', 2, 31, 3.6);
      fungi(p, cx + 7 * u, hf, 2, u, 'glow', 2, 32, 3);
      // The stair: its floor, lit near the heart; then roots laid across it, far to near.
      p.fill(C.poly([[cx - 12 * u, hf], [cx + 12 * u, hf], [cx + 40 * u, H + 1], [cx - 40 * u, H + 1]]), 'litter', (x, y) => 1.3 + 3.4 * Math.max(0, 1 - Math.hypot((x - cx) / (20 * u), (y - hf) / (16 * u))), 1);
      [[101, 13, 2.2], [107, 17, 2.8], [115, 22, 3.4], [125, 28, 4.2], [137, 35, 5.2]].forEach(([y, hw, th], k) => {
        const yy = y * u; const near = clamp(1 - (y - 97) / 40, 0, 1);
        p.shade(C.rect(cx - hw * u, yy, hw * 2 * u, th * u * 0.9), -1.1, 1);
        limb(p, [[cx - hw * u, yy + 1.2 * u], [cx, yy - 0.6 * u], [cx + hw * u, yy + 1.2 * u]], th * u, th * u * 0.85, 'bark', 1.6 + near * 2.2, 3,
          { lit: [0, -1], side: 1.3, rim: 1.6 + near * 2.4, fw: 2.4 * u, seed: 50 + k, plate: 6 * u });
      });
      p.each(C.rect(0, 98 * u, W, H), (x, y, i) => { if (p.z[i] === 3 && p.v[i] > 2.6 && hash(x >> 1, y, 4) < 0.3) p.r[i] = p.ri('moss'); });
      // The knot-hole high in the vault, the moon coming down through it into the heart.
      const kx = cx + 7 * u; const ky = 33 * u;
      knotHole(p, kx, ky, 5 * u, 4 * u, 2, u, 41);
      shaft(p, kx - 1 * u, ky + 3 * u, cx - 1 * u, hf, 4 * u, 11 * u, 3, null, { zMax: 3 });
      // Shelf fungus on the walls between the ribs, glowing, each lighting the grain round it.
      for (const [x, y, w] of [[18, 70, 3.5], [21, 76, 2.5], [78, 60, 3.5], [75, 66, 2.6], [27, 50, 2.4], [70, 82, 2.4]]) {
        p.light(x * u, y * u + 2 * u, 15 * u, 3.4, null, { zMax: 1, hard: true });
        bracket(p, x * u, y * u, w * u, 2);
      }
      // Ribs of root arching overhead, the deepest first; their faces catch the heart's light, more the deeper they are.
      const heartLit = (k) => (x, y) => [3.4, 2.8, 2.2, 1.6][k] + [3.2, 2.2, 1.4, 0.8][k] * Math.max(0, 1 - Math.hypot((x - cx) / (30 * u), (y - hf) / (40 * u)));
      [[14, 99, 50, 3.4, 4.6], [18.5, 105, 38, 4.6, 3.8], [24, 118, 24, 6.2, 3], [32, 142, 1, 11, 2.2]].forEach(([hw, base, top, w, rim], k) => {
        ribArch(p, cx, hw * u, base * u, top * u, w * u, heartLit(k), 4 + k, { rim, seed: 60 + k * 3, fw: 2.6 * u, rootlets: k > 1 ? 2 : 1, fungus: k > 0 });
      });
      // What came in with the light: ivy on the near rib, ferns at the stair's sides.
      for (const s of [-1, 1]) {
        ivy(p, (t) => [cx + s * (32 - 1.5 + Math.sin(t * 9 + s) * 1.5) * u, lerp(132, 60, t) * u], 11, 'leaf', 2.6, 8, 70 + s, u, 2.2);
        fern(p, cx + s * 30 * u, 128 * u, 9 * u, 'leaf', 2.2, 8, 72 + s, 5);
        fern(p, cx + s * 17 * u, 104 * u, 5 * u, 'leaf', 3.2, 8, 74 + s, 4);
      }
      p.light(cx, hf - 4 * u, 34 * u, 2.2, null, { zMin: 3, zMax: 7 });
      vignette(p, W, H, 1.8, 0.6);
      p.rim(0, -1, 0.6, 3);
      const fl = particles('firefly', 16, [cx - 22 * u, 44 * u, 44 * u, 66 * u], 2.6, 61).filter((q) => q.a > 0.3);
      return {
        p,
        over(img) {
          driftLeaves(img, 3, [kx - 8 * u, ky + 4 * u, 14 * u, 30 * u], 1.7, 17, '#538672', '#203E36');
          flies(img, fl, 1);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['glow'] });
      const u = H / 100; const gx = W / 2;
      const floor = 84 * u;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const warm = cat === 'clear-path';
      const bright = cat === 'obstacle' ? 0.85 : 1;
      // The curved wall of the hollow, the grain bending round knots.
      const wall = C.rect(0, 0, W, floor + 2 * u);
      p.fill(wall, 'grain', (x, y) => 1.2 + 1.2 * Math.exp(-(((x - gx) / (50 * u)) ** 2)), 0);
      const knots = [];
      { const r = rng(5); for (let x = 30 * u + r() * 20 * u; x < W / 2 + 40 * u; x += (34 + r() * 40) * u) for (const s of [-1, 1]) knots.push([gx + s * x, (18 + r() * 44) * u, (2.5 + r() * 2.5) * u]); }
      grainWall(p, wall, { cx: gx, f: 70 * u, sp: 3.2 * u, z: 0, seed: 3, u, knots });
      p.each(wall, (x, y, i) => { if (y > 62 * u && fbm(x / (4 * u), y / (6 * u), 11) > 0.57) p.r[i] = p.ri('moss'); });
      // The heart: a tall recess in the far wall, lit up from its floor.
      heartRecess(p, gx, 6 * u, 22 * u, floor, (warm ? 11 : 10.5) * bright, 1, u, 'night', warm);
      // The knot-hole in the heart's vault, and the moon through it.
      const kx = gx + 6 * u; const ky = 18 * u;
      knotHole(p, kx, ky, 5 * u, 4 * u, 2, u, 21);
      // The floor: roots woven over and under, lit around the heart.
      const ground = C.rect(0, floor, W, H - floor);
      p.fill(ground, 'bark', (x, y) => 1.5 + 4 * bright * Math.max(0, 1 - Math.hypot((x - gx) / (44 * u), (y - floor) / (10 * u))), 1);
      weave(p, ground, { s: 9 * u, sy: 2.4, z: 1, seed: 7, w: 0.55, gap: -0.9, rim: 0.9 });
      // The mushroom bed in the heart.
      if (!warm) {
        fungi(p, gx - 13 * u, floor + 0.5 * u, 3, u, 'glow', 3, 33, 3.6);
        fungi(p, gx + 12 * u, floor + 1 * u, 3, u, 'glow', 3, 34, 3.4);
      }
      // The card, in the heart.
      const sx = gx; const sy = floor;
      let rise = null;
      if (cat === 'monster') {
        const e = stalker(p, sx, sy, 36 * u, ramp, 6);
        p.backlit(6, 'night', 7.5, 'night', 9);
        p.tint(e[0], e[1], 5 * u, hex, 0.5, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        wanderer(p, sx - 3 * u, sy, 28 * u, 6, 'night', 5, ['bark', 'litter'], [1, 1], 22 * u);
      } else if (cat === 'item') {
        chest(p, sx, sy - 0.5 * u, 20 * u, ramp, 6);
        fungi(p, sx + 8 * u, sy + 0.5 * u, 2, u, 'glow', 8, 35, 3);
        p.light(sx, sy - 2 * u, 18 * u, 2.4, flicker(2, 0.15, 0.7), { zMin: 1, zMax: 1, sy: 0.4 });
        p.tint(sx, sy - 12 * u, 13 * u, hex, 0.65, flicker(2, 0.15, 0.7));
        rise = [sx, sy - 12 * u];
      } else if (cat === 'obstacle') {
        thornWall(p, sx, sy, 22 * u, 40 * u, ramp, 6, 13, u, 0.15);
        p.backlit(6, 'night', 5.5, ramp, 3);
      } else if (warm) {
        reramp(p, gx, 46 * u, 27 * u, 47 * u, ['night', 'grain'], 'sun', 0.75);
        reramp(p, gx, floor + 6 * u, 30 * u, 12 * u, ['bark', 'litter', 'moss'], 'sun', 0.6);
        p.light(gx, floor - 6 * u, 40 * u, 3, flicker(0.2, 0.06, 0.4), { zMax: 4 });
      }
      // The moon through the knot-hole and the mushrooms' glow, made after the card so they light round it, not on it.
      shaft(p, kx - 1 * u, ky + 3 * u, gx - 2 * u, floor + 2 * u, 5 * u, 15 * u, 3 * bright, breath(0.4), { zMax: 5 });
      if (!warm) p.light(gx, floor - 3 * u, 34 * u, 2.6 * bright, breath(1), { zMax: 4 });
      // Two root steps down to the heart.
      for (const [dy, hw, th] of [[6, 26, 3], [13, 40, 4]]) {
        const yy = floor + dy * u;
        p.shade(C.rect(gx - hw * u, yy, hw * 2 * u, th * u), -1.1, 1);
        limb(p, [[gx - hw * u, yy + 1.5 * u], [gx, yy - 0.5 * u], [gx + hw * u, yy + 1.5 * u]], th * u, th * u * 0.85, 'bark', 2.6 + (13 - dy) * 0.15, 7,
          { lit: [0, -1], side: 1.4, rim: 3.2 * bright, fw: 2.6 * u, seed: dy });
      }
      // Ribs of root across the hall, the two by the heart larger; a glowing alcove of shelf fungus between each pair.
      ribArch(p, gx, 27 * u, floor + 5 * u, -14 * u, 11 * u, 2, 8, { rim: 3.6 * bright, seed: 80, fw: 3 * u });
      const lights = [];
      for (let d = 66 * u, k = 0; d < W / 2 + 40 * u; d += (36 + hash(k, 1, 4) * 8) * u, k += 1) {
        for (const s of [-1, 1]) {
          const x = gx + s * d;
          limb(p, [[x, floor + 4 * u], [x - s * 2 * u, 46 * u], [x - s * 10 * u, 12 * u], [x - s * 20 * u, -6 * u]], 10 * u, 5 * u, 'bark', 1.8, 6,
            { lit: [s, 0.3], side: 1.3, rim: 2.8, fw: 2.8 * u, seed: 90 + k * 2 + s, edge: 0.7 });
          root(p, [[x - 2 * u, floor + 2 * u], [x - 8 * u, floor + 5 * u], [x - 13 * u, floor + 9 * u]], 4 * u, 1, 1.6, 7, { rim: 1.4, seed: 95 + k * 2 + s });
          const ax = x - s * 19 * u;
          fern(p, x - s * 5 * u, floor + 4 * u, 7 * u, 'leaf', 2, 7, 130 + k * 2 + s, 5);
          if (Math.abs(ax - gx) < 34 * u) continue;
          // The alcoves glow less the farther they are from the heart, and some along the hall have gone dark.
          const near = clamp(1 - (Math.abs(ax - gx) - 40 * u) / (150 * u), 0.2, 1);
          if (k > 0 && hash(k, s + 6, 4) < 0.4) { fungi(p, ax, floor + 1 * u, 1, u, 'glow', 5, 120 + k * 2 + s, 2); continue; }
          const ay = (44 + hash(k, s + 4, 4) * 12) * u;
          bracket(p, ax - 2 * u, ay, 5.5 * u, 5); bracket(p, ax + 4 * u, ay + 7 * u, 4.4 * u, 5);
          if (near > 0.5) bracket(p, ax - 3 * u, ay + 14 * u, 3.4 * u, 5);
          fungi(p, ax, floor + 1 * u, 2, u, 'glow', 5, 120 + k * 2 + s, 3);
          reramp(p, ax, ay + 6 * u, 20 * u, 22 * u, ['grain'], 'night', 0.55, [0, 0]);
          lights.push([ax, ay + 6 * u, k + s, near]);
        }
      }
      lights.forEach(([x, y, ph, near]) => p.light(x, y, 26 * u, 5.5 * near, breath(ph), { zMax: 8, hard: true }));
      // Roots crossing overhead where the ribs meet.
      for (const s of [-1, 1]) limb(p, [[gx + s * 4 * u, -2 * u], [gx + s * 40 * u, 4 * u], [gx + s * 90 * u, 1 * u]], 6 * u, 3 * u, 'bark', 1.3, 9, { lit: [0, 1], side: 0.8, rim: 1.2, fw: 2.6 * u, seed: 140 + s });
      if (warm) reramp(p, gx, 50 * u, 46 * u, 50 * u, ['bark', 'leaf'], 'sun', 0.55);
      vignette(p, W, H, 1.2, 0.5);
      p.rim(0, -1, 0.5, 6);
      const watch = [[gx - 84 * u, 30 * u, 0.1], [gx + 86 * u, 26 * u, 0.55], [gx - 120 * u, 36 * u, 0.8], [gx + 122 * u, 40 * u, 0.3]].map(([x, y, ph]) => [Math.round(x), Math.round(y), ph]);
      return {
        p,
        over(img, t) {
          flies(img, particles('firefly', Math.round(W / 10), [0, 20 * u, W, 62 * u], t, 71), 1);
          flies(img, particles('firefly', warm ? 14 : 8, [gx - 26 * u, 30 * u, 52 * u, 50 * u], t, 72), 1);
          driftLeaves(img, Math.round(W / 50) + 2, [kx - 20 * u, ky, 40 * u, 60 * u], t, 73, warm ? '#8A5E1E' : '#538672', '#203E36');
          if (cat === 'monster') watchers(img, watch, t, CARD.mons[2]);
          if (rise) rising(img, rise[0], rise[1], 10 * u, 22 * u, 6, t, 5, CARD.item[3]);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['glow'] });
      const u = H / 250;
      const all = C.rect(0, 0, W, H);
      p.fill(all, 'bark', 1.8, 1);
      weave(p, all, { s: 15 * u, sy: 1.25, z: 1, seed: 4, w: 0.52, gap: -0.7, rim: 1, vary: 60 * u, skip: 0.24 });
      p.each(all, (x, y, i) => { if (p.r[i] === p.ri('litter') && vnoise(x / (30 * u), y / (20 * u), 8) > 0.6) p.r[i] = p.ri('moss'); });
      leaves(p, all, 150, 13, 1, 'litter', 1.4, 2, -0.6);
      leaves(p, all, 80, 14, 1, 'leaf', 1.3, 1.8, -0.5);
      // A few great roots lying over the weave, from the heart toward the edges.
      for (const [x0, x1, y1, w] of [[0.4, 0.1, 150, 18], [0.6, 0.92, 140, 18], [0.47, 0.3, 250, 14], [0.55, 0.74, 260, 14]]) {
        root(p, wander([W * x0, -6 * u], [lerp(W * x0, W * x1, 0.4), y1 * 0.45 * u], [W * x1, y1 * u], 22, 5 * u, 2.5, x0 * 9), w * u, 2, 2.3, 3, { rim: 1.8, fw: 3.4 * u, seed: Math.round(x0 * 100), taper: 1.8, plate: 11 * u });
      }
      // The walls' feet at the edges: big roots flaring onto the floor, mushrooms glowing in their crooks, undergrowth.
      const glows = [];
      for (const side of [-1, 1]) {
        const x = side < 0 ? -2 * u : W + 2 * u;
        limb(p, [[x, H + 4], [x - side * 3 * u, H * 0.5], [x, -4]], 40 * u, 34 * u, 'grain', 1.8, 5, { lit: [-side, -0.2], side: 1.3, rim: 2.2, fw: 3.4 * u, seed: 90 + side });
        for (let k = 0; k < 5; k += 1) {
          const y = (16 + k * 50 + hash(k, side + 3, 3) * 14) * u;
          root(p, wander([x - side * 12 * u, y], [x - side * 28 * u, y + 8 * u], [x - side * (44 + hash(k, side + 3, 4) * 18) * u, y + (16 + hash(k, side + 3, 5) * 10) * u], 12, 3 * u, 1.5, k),
            14 * u, 2, 2.2, 5, { rim: 1.8, seed: 100 + k * 2 + side, fw: 3 * u, taper: 2 });
          const fx = x - side * (19 + hash(k, side + 3, 6) * 5) * u; const fy = y + 12 * u;
          fungi(p, fx, fy, 3, u * 1.3, 'glow', 6, 200 + k * 2 + side, 3);
          glows.push([fx, fy - 3 * u, k * 1.7 + side]);
          if (k % 2) leafCluster(p, x - side * 24 * u, y + 32 * u, 13 * u, 7 * u, 'leaf', 1.6, 6, 210 + k * 2 + side, { n: 6, lit: 2, dark: 1, leaf: 2.2 * u });
        }
        fern(p, x - side * 32 * u, 240 * u, 18 * u, 'leaf', 2.4, 6, 120 + side, 6);
      }
      glows.forEach(([x, y, ph]) => p.light(x, y, 24 * u, 2.8, breath(ph), { sy: 0.6, zMax: 5 }));
      // The heart's glow and the moon through the knot-hole, coming down from behind the vista.
      p.light(W / 2, -24 * u, 170 * u, 2.6, breath(0), { sx: 1.9 });
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.34));
      p.rim(0, -1, 0.9, 3);
      const watch = [[12 * u, 132 * u, 0.25], [W - 14 * u, 70 * u, 0.7]].map(([x, y, ph]) => [Math.round(x), Math.round(y), ph]);
      return {
        p,
        over(img, t) {
          driftLeaves(img, 6, [0, 0, W, H], t, 41, '#325A4E', '#132823');
          flies(img, particles('firefly', 16, [0, 10 * u, W, H - 20 * u], t, 81), 0.9, false);
          watchers(img, watch, t, '#A3D8C6');
        },
      };
    },
  };


export default [A, B, Cdesign];

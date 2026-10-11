/* The Sunken Jungle, a new setting (2026-10-11): outside, the canopy and the pyramid; inside, the temple within it. */
import PX from '../px.js';

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

  /* ---------- shapes that grow and hang ---------- */

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
  /** A ribbon around a path, w0 wide at its start and w1 at its end. */
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

  /** Each pixel on a one-pixel line from (x0, y0) to (x1, y1): fn(i, x, y, t). */
  function line(p, x0, y0, x1, y1, fn) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k += 1) {
      const t = k / n; const x = Math.floor(lerp(x0, x1, t)); const y = Math.floor(lerp(y0, y1, t));
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      fn(y * p.w + x, x, y, t);
    }
  }
  const ink = (p, ramp, v, z) => { const R = p.ri(ramp); return (i) => { p.r[i] = R; p.v[i] = typeof v === 'function' ? v(i) : v; p.z[i] = z; }; };

  /**
   * A limb: a trunk, a root or a liana along a path, tapering from w0 to w1,
   * the side toward `lit` catching the light, bark furrows running along it.
   */
  function limb(p, pts, w0, w1, ramp, v, z, o = {}) {
    const acc = lengths(pts); const T = acc[acc.length - 1] || 1;
    const shape = ribbon(pts, w0, w1, o.taper || 1);
    const lit = o.lit || [-1, 0]; const fw = o.fw || 3; const seed = o.seed || 1; const plate = o.plate || 7;
    const nseg = pts.length - 1; const pad = Math.max(w0, w1) / 2 + 2;
    p.fill(shape, ramp, (x, y) => {
      const px = x + 0.5; const py = y + 0.5;
      let best = 1e9; let bi = 0; let bt = 0;
      for (let i = 0; i < nseg; i += 1) {
        const ax = pts[i][0]; const ay = pts[i][1]; const dx = pts[i + 1][0] - ax; const dy = pts[i + 1][1] - ay;
        if (px < Math.min(ax, ax + dx) - pad || px > Math.max(ax, ax + dx) + pad || py < Math.min(ay, ay + dy) - pad || py > Math.max(ay, ay + dy) + pad) continue;
        const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const qx = ax + dx * t - px; const qy = ay + dy * t - py; const d = qx * qx + qy * qy;
        if (d < best) { best = d; bi = i; bt = t; }
      }
      const ax = pts[bi][0]; const ay = pts[bi][1]; const dx = pts[bi + 1][0] - ax; const dy = pts[bi + 1][1] - ay;
      const len = Math.hypot(dx, dy) || 1; const nx = -dy / len; const ny = dx / len;
      const a = acc[bi] + bt * len;
      const hw = Math.max(0.5, lerp(w0, w1, (a / T) ** (o.taper || 1)) / 2);
      const q = clamp(((px - ax - dx * bt) * nx + (py - ay - dy * bt) * ny) / hw, -1, 1);
      let val = typeof v === 'function' ? v(x, y, a / T) : v;
      const facing = nx * lit[0] + ny * lit[1];
      val += (o.side ?? 1.2) * q * facing - 0.4 * q * q;
      if (o.rim && q * Math.sign(facing) > 1 - 1.6 / hw && Math.abs(facing) > 0.2) val += o.rim;
      if (hw * 2 >= 4.5) {
        const s = Math.asin(q) * hw + Math.sin(a * 0.13 + seed) * 0.7;
        const k = Math.floor(s / fw); const fr = s / fw - k;
        const j = Math.floor((a + hash(k, 0, seed) * plate * 2) / plate);
        if (fr < 0.3) val -= o.furrow ?? 0.9;
        else val += (hash(k, j, seed + 1) - 0.5) * 0.6;
      }
      return val;
    }, z);
    return shape;
  }

  /**
   * Leaf texture: overlapping clumps in rows, each lower row in front, every
   * clump lit along its top edge and dark underneath. +1 lit, 0 body, -1 under, -1.4 a gap.
   */
  function scallop(px, py, cw, rh, seed) {
    const r0 = Math.floor(py / rh);
    for (let r = r0 + 1; r >= r0 - 1; r -= 1) {
      const off = (r & 1) * 0.5; const k0 = Math.floor(px / cw - off);
      for (let k = k0 - 1; k <= k0 + 1; k += 1) {
        const ccx = (k + off + 0.5 + (hash(k, r, seed) - 0.5) * 0.5) * cw;
        const ccy = (r + 0.5) * rh + (hash(k, r, seed + 1) - 0.5) * rh * 0.4;
        const ax = cw * 0.64; const ay = rh * 0.98;
        const dx = (px + 0.5 - ccx) / ax; const dy = (py + 0.5 - ccy) / ay;
        if (dx * dx + dy * dy > 1) continue;
        const top = ccy - ay * Math.sqrt(1 - dx * dx);
        if (py + 0.5 - top < 1.1) return 1;
        return dy > 0.38 ? -1 : 0;
      }
    }
    return -1.4;
  }

  /**
   * Tree crowns, back to front: each a lumpy round that runs down into the
   * mass beneath it, in clean bands (the sunlit top toward the upper left,
   * the body, a dark underside), scalloped into clumps of leaves.
   */
  function crowns(p, list, o) {
    const R = p.ri(o.ramp || 'leaf'); const z = o.z ?? 3; const seed = o.seed || 1;
    const cw = o.cw || 5; const rh = o.rh || 3.4; const amp = o.amp ?? 0.9;
    const lit = o.lit ?? 1.6; const dark = o.dark ?? 1.2; const bottom = o.bottom ?? p.h;
    const [sx, sy] = o.sun || [-0.55, -0.83];
    const order = list.slice().sort((a, b) => a.y - b.y);
    order.forEach((c, ci) => {
      const { x, y, rx, ry } = c; const v0 = c.v ?? o.v;
      const x0 = Math.max(0, Math.floor(x - rx * 1.25)); const x1 = Math.min(p.w - 1, Math.ceil(x + rx * 1.25));
      const y0 = Math.max(0, Math.floor(y - ry * 1.25)); const y1 = Math.min(p.h - 1, Math.ceil(c.bottom ?? bottom));
      const ph = hash(ci, 7, seed) * 6.28; const sd = seed + ci * 13;
      for (let py = y0; py <= y1; py += 1) {
        for (let px = x0; px <= x1; px += 1) {
          const dx = (px + 0.5 - x) / rx; const dy = (py + 0.5 - y) / ry;
          const a = Math.atan2(dy, dx);
          const wob = 1 + 0.08 * Math.sin(a * 5 + ph) + 0.05 * Math.sin(a * 9 + ph * 2);
          const d = Math.hypot(dx, dy);
          let val;
          if (d < wob) {
            const dot = dx * sx + dy * sy;
            val = v0 + (dot > 0.42 ? lit : dot > -0.3 ? 0 : -dark);
            val += amp * scallop(px - x + 500, py - y + 500, cw, rh, sd);
          } else if (dy > 0 && Math.abs(dx) < 0.96) {
            val = v0 - dark - Math.min(1.2, (dy - 1) * 0.5) + amp * 0.5 * scallop(px - x + 500, py - y + 500, cw, rh, sd);
          } else if (dy < 0.3 && d < wob + 1.4 / rx && hash(px, py, sd) < 0.3) val = v0 + (dx * sx + dy * sy > 0.3 ? lit : 0);
          else continue;
          if (o.fade) val += o.fade(px, py);
          const i = py * p.w + px; p.r[i] = R; p.v[i] = val; p.z[i] = z;
        }
      }
    });
  }

  /** Crowns along a row: every `gap` or so from x0 to x1, their tops near top(x), radii r0..r1. */
  function crownRow(x0, x1, o) {
    const r = rng(o.seed); const out = [];
    for (let x = x0 + r() * o.gap * 0.5; x < x1; x += o.gap * (0.6 + r() * 0.7)) {
      const rx = lerp(o.r0, o.r1, r()); const ry = rx * (o.flat ?? 0.82);
      if (o.skip && o.skip(x, rx)) continue;
      out.push({ x, y: o.top(x) + ry + (r() - 0.5) * (o.jit ?? 0), rx, ry });
    }
    return out;
  }

  /**
   * A giant leaf along a curving midrib from its stalk (a) through b to its
   * tip (c): broad in the middle, pointed, cut into lobes by splits that
   * slant toward the tip. The half toward the sun a step brighter, its edge
   * rimmed; the midrib pale; veins darker.
   */
  function bigLeaf(p, a, b, c, width, ramp, v, z, o = {}) {
    const n = o.n || 16; const pts = bez(a, b, c, n); const seed = o.seed || 1;
    const R = p.ri(ramp); const [sx, sy] = o.sun || [-0.55, -0.83];
    const prof = (t) => width * Math.pow(Math.sin(Math.PI * Math.min(1, (o.base ?? 0.06) + t * (1 - (o.base ?? 0.06)))), o.round ?? 0.7) / 2;
    const nm = pts.map((pt, i) => {
      const q0 = pts[Math.max(0, i - 1)]; const q1 = pts[Math.min(n, i + 1)];
      const dx = q1[0] - q0[0]; const dy = q1[1] - q0[1]; const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
    const lag = o.lag ?? 1.5;
    const edge = (i, s) => { const j = clamp(i + lag, 0, n); const jf = Math.floor(j); const jt = Math.min(n, jf + 1); const f = j - jf; const w = prof(j / n) * s;
      const px = lerp(pts[jf][0], pts[jt][0], f); const py = lerp(pts[jf][1], pts[jt][1], f); const nx = lerp(nm[jf][0], nm[jt][0], f); const ny = lerp(nm[jf][1], nm[jt][1], f);
      return [px + nx * w, py + ny * w]; };
    for (const s of [-1, 1]) {
      const mid = nm[Math.floor(n / 2)]; const litSide = (mid[0] * sx + mid[1] * sy) * s > 0;
      const val = v + (litSide ? (o.lit ?? 1) : 0);
      // Lobes: the splits fall at a few places along each side.
      const cuts = [0];
      if (o.splits) for (let i = 2; i < n - 2; i += 1) if (hash(i, s, seed) < o.splits) cuts.push(i);
      cuts.push(n);
      for (let k = 0; k + 1 < cuts.length; k += 1) {
        const i0 = cuts[k]; const i1 = cuts[k + 1];
        const poly = [];
        for (let i = i0; i <= i1; i += 1) poly.push(pts[i]);
        for (let i = i1; i >= i0; i -= 1) poly.push(edge(i - (k + 1 < cuts.length - 1 && i === i1 ? 0.9 : 0), s));
        p.fill(C.poly(poly), ramp, val, z);
      }
      // Veins, slanting out toward the tip.
      for (let i = 2; i < n - 1; i += 2) {
        const e = edge(i, s * 0.85);
        line(p, pts[i][0], pts[i][1], e[0], e[1], (j) => { if (p.z[j] === z && p.r[j] === R) p.v[j] = val - (o.vein ?? 0.8); });
      }
      // The rim along the lit edge.
      if (litSide) for (let i = 1; i < n; i += 1) { const e0 = edge(i - 1, s); const e1 = edge(i, s); line(p, e0[0], e0[1], e1[0], e1[1], (j) => { if (p.z[j] === z) p.v[j] = val + (o.rim ?? 1.4); }); }
    }
    for (let i = 0; i < n; i += 1) line(p, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], (j) => { if (p.z[j] === z) { p.r[j] = R; p.v[j] = v + (o.midrib ?? 1.6); } });
    if (o.stalk) line(p, o.stalk[0], o.stalk[1], a[0], a[1], ink(p, ramp, v + 0.4, z));
  }

  /** A fern: fronds arching out of one root, each a curved stem with leaflets. */
  function fern(p, x, y, s, ramp, v, z, seed, n = 5) {
    const r = rng(seed);
    for (let i = 0; i < n; i += 1) {
      const a = lerp(-1.1, 1.1, n > 1 ? i / (n - 1) : 0.5) + (r() - 0.5) * 0.3;
      const tip = [x + Math.sin(a) * s * 1.1, y - Math.cos(a) * s * 0.55];
      const pts = bez([x, y], [x + Math.sin(a) * s * 0.6, y - s * (0.95 - Math.abs(a) * 0.3)], tip, 8);
      p.fill(ribbon(pts, 1.2, 0.8), ramp, v + 0.5, z);
      for (let j = 2; j < pts.length - 1; j += 1) {
        const [fx, fy] = pts[j]; const l = s * 0.17 * (1 - j / pts.length);
        const sg = Math.sign(a || 1);
        p.fill(C.poly([[fx, fy], [fx + 0.9, fy], [fx + sg * l, fy + l * 0.8], [fx - sg * l * 0.3, fy + l]]), ramp, v + (j % 2 ? 0.6 : 0), z);
      }
    }
  }

  /** A liana: a loop sagging between two points, or a strand hanging (y1 below y0, small sag), a few leaves on it. */
  function liana(p, x0, y0, x1, y1, sag, ramp, v, z, seed, leaves = 3, u = 1) {
    const r = rng(seed); const pts = [];
    for (let k = 0; k <= 24; k += 1) { const t = k / 24; pts.push([lerp(x0, x1, t) + Math.sin(t * 7 + seed) * 0.6 * u, lerp(y0, y1, t) + sag * 4 * t * (1 - t)]); }
    for (let k = 0; k < 24; k += 1) line(p, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], ink(p, ramp, v, z));
    for (let k = 0; k < leaves; k += 1) {
      const [lx, ly] = pts[Math.floor((0.2 + r() * 0.75) * 24)]; const m = r() < 0.5 ? -1 : 1; const l = (2 + r() * 1.6) * u;
      p.fill(C.poly([[lx, ly], [lx + m * l, ly + l * 0.4], [lx + m * l * 0.6, ly + l * 1.1]]), ramp, v + 0.6, z);
      p.fill(C.rect(Math.floor(lx + m * l * 0.5), Math.floor(ly + l * 0.3), 1, 1), ramp, v + 1.8, z);
    }
  }

  /** A shaft of sun from (x0, y0) to (x1, y1), w0 wide at the top and w1 at the foot: in the air, so on every layer. */
  function shaft(p, x0, y0, x1, y1, w0, w1, s, o = {}) {
    const f = new Float32Array(p.w * p.h);
    const dx = x1 - x0; const dy = y1 - y0; const L2 = dx * dx + dy * dy; const len = Math.sqrt(L2);
    const nx = -dy / len; const ny = dx / len; const wm = Math.max(w0, w1);
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - wm)); const bx1 = Math.min(p.w - 1, Math.ceil(Math.max(x0, x1) + wm));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1))); const by1 = Math.min(p.h - 1, Math.ceil(Math.max(y0, y1) + wm * 0.3));
    for (let y = by0; y <= by1; y += 1) {
      for (let x = bx0; x <= bx1; x += 1) {
        const i = y * p.w + x;
        if (p.emit[p.r[i]]) continue;
        if (o.zMin !== undefined && p.z[i] < o.zMin) continue;
        if (o.zMax !== undefined && p.z[i] > o.zMax) continue;
        const px = x + 0.5 - x0; const py = y + 0.5 - y0;
        const t = (px * dx + py * dy) / L2; if (t < 0 || t > 1.1) continue;
        const hw = lerp(w0, w1, Math.min(1, t)) / 2;
        const d = Math.abs(px * nx + py * ny) / hw; if (d >= 1) continue;
        f[i] = s * (d < 0.55 ? 1 : 0.55) * (t > 1 ? Math.max(0, 1 - (t - 1) / 0.1) : 1) * Math.min(1, 0.3 + t * 1.6);
      }
    }
    if (o.k) p.fields.push({ f, k: o.k }); else for (let i = 0; i < f.length; i += 1) p.v[i] += f[i];
  }

  /** A band of steam: value added along a wavering line. */
  function steam(p, W, yc, h, amt, seed, gain = () => 1, zMax = 255) {
    p.shade(C.rect(0, yc - h * 2.6, W, h * 5.2), (x, y, i) => {
      if (p.z[i] > zMax) return 0;
      const wav = Math.sin(x * 0.09 + seed) * h * 0.35 + Math.sin(x * 0.027 + seed * 3) * h * 0.7;
      const e = (y + 0.5 - yc + wav) / h;
      const g = Math.exp(-e * e) * (0.7 + 0.3 * Math.sin(x * 0.045 + seed * 1.7)) * gain(x);
      return amt * (g > 0.6 ? 1 : g > 0.25 ? 0.5 : 0);
    });
  }

  /** The edge of a figure on layer z toward each direction in `dirs`, where the neighbour is not the figure and is bright enough. */
  function rimLight(p, z, dirs, ramp, v, minV = -99, figure = [z]) {
    const R = p.ri(ramp); const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < p.w - 1; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        for (const [dx, dy] of dirs) {
          const j = i + dy * p.w + dx;
          if (!figure.includes(p.z[j]) && p.v[j] >= minV) { hit.push([i, y]); break; }
        }
      }
    }
    for (const [i, y] of hit) { p.r[i] = R; p.v[i] = typeof v === 'function' ? v(y) : v; }
  }

  /* ---------- the materials both sides share ---------- */

  // Limestone under moss: a warm grey, going cream where the sun or the fire finds it.
  const STONE = ['#060505', '#0B0A08', '#12100D', '#1A1713', '#231F1A', '#2D2721', '#383027', '#463B2F', '#554737', '#665541', '#7A654B', '#907755', '#A98B60', '#C2A26F', '#D9BB88', '#EDD5A8'];
  // Leaves: grey-green in the shade, khaki in the sun. Never teal, never lime.
  const LEAF = ['#040605', '#080B09', '#0C110D', '#111711', '#171E16', '#1E261B', '#262E20', '#2F3725', '#39402A', '#454A2F', '#535535', '#64623C', '#776F45', '#8C7E50', '#A2905F', '#B9A374'];
  const BARK = ['#040303', '#090706', '#0F0C0A', '#16120E', '#1E1813', '#272018', '#31281E', '#3D3225', '#4A3C2C', '#594834', '#6A563E', '#7E6649'];
  const ROPE = ['#0A0705', '#140E09', '#1F160E', '#2C1F14', '#3B2A1A', '#4C3721', '#60462A', '#765734', '#8E6A40'];
  const SHADOW = ['#020202', '#060605', '#0B0A08', '#11100D', '#181612'];
  // Worked gold: the idol, deep brown in its hollows, white-hot where the light catches it.
  const GOLD = ['#140C04', '#24160A', '#38220E', '#4E3112', '#664217', '#80551C', '#9C6A22', '#B8812C', '#D19A3B', '#E5B451', '#F2CB70', '#FADF96', '#FFF0C2'];


  /* ---------- the subjects the cards become ---------- */

  /** Pixels of an ellipse whose neighbour above lies outside it: fn(i, x, y, ex) with ex its place across, -1..1. */
  function ellipseTop(p, cx, cy, rx, ry, fn) {
    p.each(C.ellipse(cx, cy, rx, ry, 28), (x, y, i) => {
      const ex = (x + 0.5 - cx) / rx; const ey = (y - 0.5 - cy) / ry;
      if (ex * ex + ey * ey > 1) fn(i, x, y, ex);
    });
  }

  /**
   * The great serpent, reared to strike: coils heaped on the ground, the body
   * climbing in an S to a wedge head in profile, jaws gaping, fangs pale.
   * Black (the shadow ramp at `body`), a sheen of the light along every coil
   * and up its body; its eye a point of the card's colour. `s` is its height.
   * Returns the eye.
   */
  function serpent(p, cx, fy, s, ramp, z, o = {}) {
    const body = o.body ?? 0.5; const [shR, shV] = o.sheen || ['gold', 6.6];
    const S = (x, y) => [cx + x * s, fy + y * s];
    const SR = p.ri(shR);
    const coils = [[0.1, -0.215, 0.27, 0.075], [-0.03, -0.135, 0.39, 0.085], [0.03, -0.052, 0.5, 0.072]];
    coils.forEach(([dx, dy, rx, ry], k) => {
      p.fill(C.ellipse(cx + dx * s, fy + dy * s, rx * s, ry * s, 28), 'shadow', body, z);
      if (k) ellipseTop(p, cx + dx * s, fy + dy * s, rx * s, ry * s, (i, x, y, ex) => { if (ex < 0.55) { p.r[i] = SR; p.v[i] = shV - 1 + (ex < -0.2 ? 0.8 : 0); } });
    });
    const path = bez(S(0.24, -0.2), S(0.46, -0.46), S(0.1, -0.6), 8).concat(bez(S(0.1, -0.6), S(-0.22, -0.72), S(-0.03, -0.885), 8).slice(1));
    p.fill(ribbon(path, 0.19 * s, 0.1 * s), 'shadow', body, z);
    // The head, facing left and tilted up, the jaws gaping on the light behind.
    p.fill(C.poly([S(0.03, -0.86), S(0.04, -0.95), S(-0.05, -1.02), S(-0.21, -1.055), S(-0.37, -1.045), S(-0.41, -1.005), S(-0.2, -0.965), S(-0.07, -0.905)]), 'shadow', body, z);
    p.fill(C.poly([S(-0.05, -0.885), S(-0.2, -0.905), S(-0.35, -0.868), S(-0.36, -0.838), S(-0.17, -0.842), S(-0.02, -0.82)]), 'shadow', body, z);
    // The sheen: along every edge facing up or to the left.
    rimLight(p, z, [[-1, 0], [0, -1]], shR, shV);
    // Fangs, and the forked tongue.
    const fx = Math.round(cx - 0.38 * s); const fu = Math.round(fy - 1.0 * s); const fl = Math.round(fy - 0.868 * s);
    p.fill(C.rect(fx, fu, 1, Math.max(2, Math.round(s * 0.05))), 'stone', 14, z + 1);
    p.fill(C.rect(fx + 1, fl - Math.max(1, Math.round(s * 0.035)), 1, Math.max(1, Math.round(s * 0.035))), 'stone', 13, z + 1);
    const ty = Math.round(fy - 0.935 * s);
    line(p, cx - 0.37 * s, ty, cx - 0.5 * s, ty + 0.01 * s, ink(p, ramp, 2.4, z + 1));
    p.fill(C.rect(Math.round(cx - 0.52 * s), ty - 1, 1, 1), ramp, 2.4, z + 1);
    p.fill(C.rect(Math.round(cx - 0.52 * s), ty + 1, 1, 1), ramp, 2.4, z + 1);
    const ex = Math.round(cx - 0.15 * s); const ey = Math.round(fy - 1.0 * s);
    p.fill(C.rect(ex - 1, ey, 2, 1), ramp, 4, z + 2);
    return { ex, ey };
  }

  /**
   * The guide: a wide-brimmed hat, a coat to the knee, a pack with a coil of
   * rope, a machete at the hip, a lantern held out ahead. Facing left, in
   * shadow. Returns where the lantern hangs.
   */
  function guide(p, cx, fy, s, z, ramp = 'shadow', bv = 0.8) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy - y * s]));
    p.fill(P([[-0.17, 0], [-0.11, 0.42], [-0.02, 0.42], [-0.07, 0]]), ramp, bv, z);           // the leading leg
    p.fill(P([[0.04, 0], [0.0, 0.42], [0.09, 0.42], [0.14, 0]]), ramp, bv, z);                // the trailing leg
    p.fill(P([[-0.16, 0.34], [-0.12, 0.76], [0.12, 0.76], [0.15, 0.34]]), ramp, bv, z);       // the coat
    p.fill(P([[0.08, 0.42], [0.09, 0.8], [0.27, 0.78], [0.28, 0.44]]), ramp, bv + 0.3, z);    // the pack
    p.fill(C.join(C.ellipse(cx + 0.18 * s, fy - 0.82 * s, 0.11 * s, 0.05 * s, 16), C.ellipse(cx + 0.18 * s, fy - 0.82 * s, 0.05 * s, 0.02 * s, 12)), ramp, bv + 0.5, z); // a coil of rope on it
    p.fill(C.circle(cx - 0.01 * s, fy - 0.83 * s, 0.075 * s, 14), ramp, bv, z);               // the head
    p.fill(P([[-0.23, 0.87], [0.2, 0.87], [0.16, 0.915], [-0.19, 0.915]]), ramp, bv, z);      // the hat's brim
    p.fill(P([[-0.09, 0.9], [-0.075, 1.0], [0.07, 1.0], [0.085, 0.9]]), ramp, bv, z);         // its crown
    p.fill(P([[-0.1, 0.72], [-0.3, 0.6], [-0.33, 0.55], [-0.28, 0.54], [-0.1, 0.64]]), ramp, bv, z); // the arm, out
    p.fill(P([[0.1, 0.36], [0.24, 0.12], [0.27, 0.13], [0.13, 0.38]]), ramp, bv + 0.4, z);   // the machete
    return { lx: Math.round(cx - 0.32 * s), ly: Math.round(fy - 0.5 * s) };
  }

  /** The guide's lantern: a dark frame round a core of the card's colour. */
  function lantern(p, lx, ly, ramp, z) {
    p.fill(C.rect(lx, ly - 2, 1, 2), 'shadow', 1, z);
    p.fill(C.rect(lx - 1, ly, 3, 4), 'shadow', 1.4, z);
    p.fill(C.rect(lx, ly + 1, 1, 2), ramp, 4, z + 1);
  }

  /**
   * The idol: a squat god seated cross-legged with a bowl on its belly, a
   * broad head with round gem eyes and a wide grin, and behind it a solid
   * crest like a sunburst, grooved with rays and beaded round its rim. In
   * `ramp`, in clean bands lit from the left, hard highlights on its lit
   * edges. `s` is its height with the crest; `v` its middle value.
   */
  function idol(p, cx, fy, s, ramp, z, o = {}) {
    const v = o.v ?? 6; const hi = o.hi ?? 3; const lo = o.lo ?? 2.4;
    const R = p.ri(ramp);
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy - y * s]));
    const metal = (x) => { const a = (x + 0.5 - cx) / s; return v + (a < -0.12 ? hi * 0.55 : a < 0.1 ? 0 : -lo); };
    // The crest: a half-disc behind the head, grooved with rays, its rim beaded.
    const hx = cx; const hy = fy - 0.66 * s; const R0 = 0.5 * s;
    p.each(C.circle(hx, hy, R0, 36), (x, y, i) => {
      const dx = x + 0.5 - hx; const dy = y + 0.5 - hy;
      if (dy > 0.06 * s) return;
      const r = Math.hypot(dx, dy) / R0; const a = Math.atan2(-dy, dx);
      let val = v - 0.6 + (dx < -0.12 * s ? hi * 0.35 : dx > 0.12 * s ? -lo * 0.6 : 0);
      if (r > 0.84) val += (Math.floor(a * 7) % 2 ? 1.4 : -0.6);
      else if (frac(a / Math.PI * 8 + 0.5) < 0.24) val -= 1.6;
      p.r[i] = R; p.v[i] = val; p.z[i] = z;
    });
    p.fill(P([[-0.44, 0], [-0.4, 0.17], [0.4, 0.17], [0.44, 0]]), ramp, (x) => metal(x) - 0.4, z);              // the crossed legs
    p.fill(P([[-0.4, 0.17], [0.4, 0.17], [0.4, 0.15], [-0.4, 0.15]]), ramp, v - lo - 0.6, z);
    p.fill(P([[-0.28, 0.15], [-0.31, 0.4], [-0.22, 0.52], [0.22, 0.52], [0.31, 0.4], [0.28, 0.15]]), ramp, metal, z); // the body
    p.fill(P([[-0.2, 0.33], [0.2, 0.33], [0.14, 0.22], [-0.14, 0.22]]), ramp, (x) => metal(x) + 1, z + 1);        // the bowl
    p.fill(P([[-0.2, 0.33], [0.2, 0.33], [0.2, 0.3], [-0.2, 0.3]]), ramp, v - lo, z + 1);
    p.fill(P([[-0.24, 0.5], [-0.26, 0.78], [-0.2, 0.88], [0.2, 0.88], [0.26, 0.78], [0.24, 0.5]]), ramp, (x) => metal(x) + 0.4, z); // the head
    for (const m of [-1, 1]) p.fill(C.circle(cx + m * 0.29 * s, fy - 0.68 * s, Math.max(1, 0.06 * s), 10), ramp, (x) => metal(x) + 0.8, z + 1); // ear spools
    const Y = (k) => Math.round(fy - k * s); const X = (k) => Math.round(cx + k * s);
    p.fill(C.rect(X(-0.21), Y(0.8), X(0.21) - X(-0.21), 1), ramp, v - lo - 0.6, z + 1);                           // the brow
    const gem = o.gem || ramp; const gv = o.gemV ?? v + hi + 1;
    const er = Math.max(1, 0.06 * s);
    for (const m of [-1, 1]) {
      p.fill(C.circle(cx + m * 0.11 * s, fy - 0.715 * s, er + 0.6, 12), ramp, v - lo - 0.4, z + 1);
      p.fill(C.circle(cx + m * 0.11 * s, fy - 0.715 * s, er, 12), gem, gv, z + 2);
    }
    p.fill(C.rect(X(-0.02), Y(0.68), Math.max(1, X(0.02) - X(-0.02)), Math.max(1, Y(0.6) - Y(0.68))), ramp, v + hi * 0.8, z + 1); // the nose
    p.fill(C.rect(X(-0.14), Y(0.58), X(0.14) - X(-0.14), Math.max(1, Y(0.54) - Y(0.58))), ramp, v - lo - 1, z + 1);  // the grin
    // Highlights on its lit edges.
    for (const [x0, y0, y1] of [[-0.29, 0.4, 0.17], [-0.25, 0.8, 0.52], [-0.42, 0.14, 0.02]]) p.fill(C.rect(X(x0), Y(y0), 1, Math.max(1, Y(y1) - Y(y0))), ramp, v + hi + 0.6, z + 1);
    p.fill(C.rect(X(-0.18), Y(0.88), X(0.1) - X(-0.18), 1), ramp, v + hi + 0.6, z + 1);
    return { x: cx, y: fy - 0.66 * s, top: fy - 1.16 * s, ex: cx, ey: fy - 0.715 * s };
  }

  /**
   * A stair come down: carved blocks tumbled in a heap across the way, the
   * big ones at the bottom, glyphs cut in their faces. In the card's colour,
   * lit along their tops. `hw` and `h` are the heap's half-width and height.
   */
  function rubble(p, cx, fy, hw, h, ramp, z, seed, u, k = 0) {
    const r = rng(seed); const blocks = [];
    for (const [n, hf, wf, sz] of [[5, 0.0, 0.92, 1], [4, 0.34, 0.7, 0.92], [3, 0.62, 0.48, 0.84], [1, 0.86, 0, 0.74]]) {
      for (let k = 0; k < n; k += 1) {
        const t = n === 1 ? 0 : lerp(-1, 1, k / (n - 1)) * wf;
        const bw = (hw * 2 / 4.4) * sz * (0.85 + r() * 0.3); const bh = bw * (0.5 + r() * 0.16);
        blocks.push({ x: cx + t * hw + (r() - 0.5) * 3 * u, y: fy - hf * h - bh * 0.5 + (r() - 0.3) * u, bw, bh, a: (r() - 0.5) * (n === 5 ? 0.25 : 0.6), g: r() < 0.7, sd: Math.floor(r() * 99) });
      }
    }
    blocks.sort((a, b) => a.y - b.y);
    const R = p.ri(ramp);
    for (const b of blocks) {
      const ca = Math.cos(b.a); const sa = Math.sin(b.a);
      const corner = (lx, ly) => [b.x + lx * ca - ly * sa, b.y + lx * sa + ly * ca];
      p.each(C.poly([corner(-b.bw / 2, -b.bh / 2), corner(b.bw / 2, -b.bh / 2), corner(b.bw / 2, b.bh / 2), corner(-b.bw / 2, b.bh / 2)]), (x, y, i) => {
        const dx = x + 0.5 - b.x; const dy = y + 0.5 - b.y;
        const lx = dx * ca + dy * sa; const ly = -dx * sa + dy * ca;
        const gx = lx / (b.bw * 0.5); const gy = ly / (b.bh * 0.5);
        let v = 2.1 - k;
        if (ly < -b.bh / 2 + 1.4) v = 3.5 - k * 0.6;
        else if (lx < -b.bw / 2 + 1.2) v = 2.8 - k;
        else if (ly > b.bh / 2 - 1.2 || lx > b.bw / 2 - 1.2) v = 1.1 - k * 0.3;
        else if (b.g && b.bw > 7) {
          // A glyph: a squared spiral, or a face of two eyes over a mouth.
          const fx = Math.abs(gx); const fy2 = gy;
          if (b.sd % 2) { if ((fx < 0.42 && Math.abs(fy2 + 0.1) < 0.5) && ((fx > 0.3) || (Math.abs(fy2 - 0.32) < 0.14) || (fx < 0.1 && fy2 < 0.1 && fy2 > -0.6))) v = 1.2; }
          else if ((Math.abs(fy2 + 0.25) < 0.14 && fx > 0.12 && fx < 0.34) || (Math.abs(fy2 - 0.3) < 0.13 && fx < 0.3)) v = 1.2;
        }
        p.r[i] = R; p.v[i] = v; p.z[i] = z;
      });
    }
  }

  /* ================= A: the canopy and the pyramid ================= */

  // The sky over the canopy: a hot gold haze, amber overhead, cream at the horizon. Never blue.
  const SKY = ['#0E0B08', '#181209', '#23190D', '#2F2111', '#3C2A15', '#4B3419', '#5C3F1D', '#6E4B22', '#815827', '#95662D', '#A87536', '#BA8642', '#CA9851', '#D8AA63', '#E4BC78', '#EECD8F', '#F6DDA8', '#FBEBC6', '#FEF6E4'];
  const WATER = ['#070807', '#0C0E0D', '#131614', '#1A1E1B', '#232822', '#2E332C', '#3B3F37', '#4A4E44', '#5C5F53', '#717265', '#89897A', '#A3A192', '#BFBBAA', '#D9D4C2', '#EFEBDC', '#FCFAF0'];
  const RAMPS_A = { sky: SKY, stone: STONE, leaf: LEAF, bark: BARK, water: WATER, rope: ROPE, shadow: SHADOW, gold: GOLD, ...CARD };
  const BIRD = [['a...a', '.a.a.', '..a..'], ['.....', 'aa.aa', '..a..']];

  /** The sky: a hot haze, brightest toward the sun, paling to the horizon. */
  function haze(p, W, y1, o) {
    const R = p.ri('sky');
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const t = clamp(y / o.hor, 0, 1);
      let v = lerp(o.top, o.low, t ** (o.pow ?? 1.3));
      const d = Math.hypot((x - o.sx) / o.sr, (y - o.sy) / (o.sr * 0.6));
      v += o.sun * Math.max(0, 1 - d) ** 1.5;
      p.r[i] = R; p.v[i] = v; p.z[i] = 0;
    });
  }

  /** A far skyline: everything under top(x) down to y1, on `ramp` at v, its top edge a step paler. */
  function skyline(p, W, top, y1, ramp, v, z, rimV = 0.8) {
    const R = p.ri(ramp);
    for (let x = 0; x < W; x += 1) {
      const t = top(x);
      for (let y = Math.max(0, Math.floor(t)); y < Math.min(p.h, y1); y += 1) {
        const i = y * p.w + x; p.r[i] = R; p.z[i] = z; p.v[i] = v + (y < t + 1 ? rimV : 0);
      }
    }
  }

  /**
   * A step pyramid from the front, in sun from the upper left: tiers each a
   * band of laid blocks with a lit terrace edge and a shadowed moulding, the
   * right flank turning into shadow; a stair up the middle between
   * balustrades; a temple on the summit with a black door and a slotted roof
   * comb.
   */
  function pyramid(p, o) {
    const { cx, top, base, hw, u } = o;
    const z = o.z ?? 2; const n = o.tiers || 7; const v = o.v ?? 8; const seed = o.seed || 3; const ramp = o.ramp || 'stone';
    const hwT = o.hwTop ?? hw * 0.26; const th = (base - top) / n;
    const R = p.ri(ramp); const flank = o.flank ?? 0.8; const ledge = o.ledge ?? 1.8;
    for (let k = 0; k < n; k += 1) {
      const yb = base - k * th; const yt = yb - th;
      const wb = lerp(hw, hwT, k / n); const wt = wb - th * 0.32;
      p.each(C.poly([[cx - wb, yb], [cx - wt, yt], [cx + wt, yt], [cx + wb, yb]]), (x, y, i) => {
        const ly = y + 0.5 - yt; const w = lerp(wt, wb, ly / th);
        const ax = (x + 0.5 - cx) / w;
        let val = v - ax * 0.8;
        if (ax > flank) val -= 2.6;
        else if (ax < -1 + 1.4 / w) val += 2;
        if (o.detail === false) { if (ly < 1) val += 1; }
        else if (ly < 1) val += ax > flank ? ledge * 0.4 : ledge;
        else if (ly < 2) val -= 1.2;
        else {
          const ch = Math.max(2, (th - 2) / 2); const c = Math.floor((ly - 2) / ch);
          const bw = Math.max(3, 5 * u); const off = hash(c, k, seed) * bw;
          const bx = (((x + off) % bw) + bw) % bw;
          if ((ly - 2) - c * ch < 1 || bx < 1) val -= 0.7;
          else val += (hash(Math.floor((x + off) / bw), c * 31 + k, seed) - 0.5) * 0.5;
          if (n2(x / (7 * u), y / (5 * u), seed + 5) > 0.7) val -= 0.8;
        }
        p.r[i] = R; p.v[i] = val; p.z[i] = z;
      });
    }
    // The stair, between its balustrades.
    const sw0 = o.stair ?? hw * 0.15; const sw1 = sw0 * 0.72;
    const sh = o.step ?? Math.max(2, 1.6 * u);
    if (o.stairOn !== false) {
      p.each(C.poly([[cx - sw0, base + 1], [cx - sw1, top], [cx + sw1, top], [cx + sw0, base + 1]]), (x, y, i) => {
        const t = (base - y - 0.5) / (base - top); const w = lerp(sw0, sw1, t);
        const ax = (x + 0.5 - cx) / w;
        const f = frac((base - y - 0.5) / sh);
        let val = v + 0.6 - ax * 0.4 + (f < 0.5 ? 0.8 : -0.7);
        if (Math.abs(ax) > 1 - Math.max(1, 1.4 * u) / w) val = v + (ax < 0 ? 2 : -1.6);
        p.r[i] = R; p.v[i] = val; p.z[i] = z + 1;
      });
    }
    // The temple on the summit.
    const tw = o.templeW ?? hwT * 0.8; const tH = o.templeH ?? th * 1.4; const ty = top - tH;
    p.each(C.rect(cx - tw, ty, tw * 2, tH), (x, y, i) => {
      const ax = (x + 0.5 - cx) / tw; const ly = y + 0.5 - ty;
      let val = v + 0.5 - ax * 0.6 + (ax > 0.72 ? -2.6 : 0);
      if (ly < 1) val += 1.6;
      else if (ly < Math.max(2, tH * 0.34)) val += (Math.floor((x - cx + 100) / Math.max(2, 2 * u)) % 2 ? 0.5 : -0.5);
      else if (ly < Math.max(3, tH * 0.34 + 1)) val -= 1.2;
      p.r[i] = R; p.v[i] = val; p.z[i] = z + 1;
    });
    const dw = Math.max(2, Math.round(tw * 0.42)); const dh = Math.max(2, Math.round(tH * 0.5));
    if (o.door !== false) p.fill(C.rect(Math.round(cx - dw / 2), Math.round(top - dh), dw, dh), 'shadow', 0.4, z + 2);
    // The roof comb: a tall slotted wall on the roof, narrowing upward.
    const rw = tw * 0.62; const rH = o.combH ?? tH * 0.95; const ry = ty - rH;
    p.each(C.poly([[cx - rw, ty], [cx - rw * 0.78, ry], [cx + rw * 0.78, ry], [cx + rw, ty]]), (x, y, i) => {
      const ax = (x + 0.5 - cx) / rw;
      let val = v + 0.3 - ax * 0.6 + (ax > 0.6 ? -2.4 : 0);
      if (y + 0.5 - ry < 1) val += 1.2;
      const slotW = Math.max(2, rw * 0.5);
      if (y > ry + 1 && y < ty - 1 && Math.abs(((x + 0.5 - cx) / slotW + 100.5) % 1 - 0.5) < 0.2 && Math.abs(ax) < 0.75) { p.r[i] = p.ri('shadow'); p.v[i] = 1; p.z[i] = z + 1; return; }
      p.r[i] = R; p.v[i] = val; p.z[i] = z + 1;
    });
    return { th, hwT, tw, ty, ry, tH, sw0, sw1, door: [cx, top - dh, dw, dh] };
  }

  /** Plants rooted on a pyramid's terraces: small crowns along its ledges, strands hanging down its faces. */
  function overgrowth(p, g, o) {
    const { cx, base, hw, u, n } = o; const r = rng(o.seed || 'og'); const list = [];
    for (let k = 1; k < n; k += 1) {
      const yt = base - k * g.th; const wt = lerp(hw, g.hwT, k / n) - g.th * 0.32;
      const m = 1 + Math.floor(r() * 2.5);
      for (let j = 0; j < m; j += 1) {
        let x = cx + (r() * 2 - 1) * wt * 0.95;
        if (Math.abs(x - cx) < g.sw0 * 1.4) x += (x < cx ? -1 : 1) * g.sw0 * 1.6;
        const rx = (1.6 + r() * 2.4) * u * (o.k ?? 1);
        list.push({ x, y: yt - rx * 0.3, rx, ry: rx * 0.7, bottom: yt + rx * 0.5 });
        if (r() < 0.6) liana(p, x + (r() - 0.5) * rx, yt, x + (r() - 0.5) * 2 * u, yt + (3 + r() * 5) * u * (o.k ?? 1), 0, 'leaf', o.v - 1.4, o.z, Math.floor(r() * 99), 1, u);
      }
    }
    crowns(p, list, { ramp: 'leaf', v: o.v, lit: 3.6, dark: 1.4, z: o.z, cw: Math.max(2, 2.4 * u), rh: Math.max(2, 1.8 * u), amp: 0.6, seed: 41 });
  }

  /** A rope bridge slung between two trees: a deck of planks, two hand ropes above it, hangers between. */
  function ropeBridge(p, x0, y0, x1, y1, sag, h, v, z, u) {
    const yAt = (x, s) => { const t = (x - x0) / (x1 - x0); return lerp(y0, y1, t) + s * 4 * t * (1 - t); };
    const R = p.ri('rope'); const step = Math.max(3, Math.round(3.4 * u));
    for (let x = Math.ceil(x0); x <= x1; x += 1) {
      if (x < 0 || x >= p.w) continue;
      const dy = yAt(x + 0.5, sag); const ry = yAt(x + 0.5, sag * 0.78) - h;
      const set = (y, val) => { y = Math.floor(y); if (y < 0 || y >= p.h) return; const i = y * p.w + x; p.r[i] = R; p.v[i] = val; p.z[i] = z; };
      set(dy, v + ((x - x0) % 3 < 1 ? -0.8 : 0.8));
      set(dy + 1, v - 0.8);
      set(ry, v + 0.4);
      if (((x - Math.ceil(x0)) % step) === 0) for (let y = Math.floor(ry) + 1; y < Math.floor(dy); y += 1) set(y, v - 0.4);
    }
  }

  /** A big tree: a bole leaning a little, buttress roots flaring at its foot, lit on the side toward `lit`. */
  function bigTree(p, x, top, fy, w, u, o = {}) {
    const z = o.z ?? 4; const v = o.v ?? 2; const lean = o.lean ?? 0; const L = o.lit ?? -1;
    limb(p, [[x, fy + 2], [x + lean * 0.4, lerp(fy, top, 0.5)], [x + lean, top]], w, w * 0.8, 'bark', v, z, { lit: [L, -0.3], rim: o.rim ?? 1.6, side: 1.4, fw: Math.max(2, 2.6 * u), seed: o.seed || 3 });
    for (const [m, k] of [[-1, 1], [1, 0.8], [-0.4, 0.6], [0.5, 0.5]]) {
      const bx = x + m * w * 0.35;
      p.fill(C.poly([[bx, fy - w * 1.8 * k], [bx + m * w * 1.2 * k, fy + 1], [bx - m * w * 0.25, fy + 1]]), 'bark', (px) => v - 0.3 + ((px - x) * L > 0 ? 1 : -0.4), z);
      line(p, bx, fy - w * 1.8 * k, bx + m * w * 1.2 * k, fy + 1, (i) => { if (p.z[i] === z) p.v[i] = v + (m * L > 0 ? 2 : 0.2); });
    }
  }

  /**
   * A colossal head sunk to the chin: a rounded helmet with a band, a heavy
   * brow over shadowed eyes, a broad flat nose, thick lips. Lit from the left.
   * The roots of the tree that grew on it pour over the helmet and down its
   * cheeks into the ground.
   */
  function stoneHead(p, cx, fy, s, z, v, u, o = {}) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy - y * s]));
    const R = p.ri('stone'); const L = o.lit ?? 1;
    p.each(P([[-0.44, -0.02], [-0.47, 0.35], [-0.46, 0.62], [-0.38, 0.84], [-0.22, 0.97], [0, 1.0], [0.22, 0.97], [0.38, 0.84], [0.46, 0.62], [0.47, 0.35], [0.44, -0.02]]), (x, y, i) => {
      const ax = (x + 0.5 - cx) / s; const ay = (fy - y - 0.5) / s; const aa = Math.abs(ax);
      let val = v - ax * 2.2 * L - 1.6 * (aa / 0.46) ** 4;
      if (ay > 0.72) val += 0.4;
      else if (ay > 0.66) val += ay > 0.69 ? 1 : -1.2;                                    // the helmet's band
      else if (ay > 0.56 && ay <= 0.6 && aa < 0.34) val += 1.2;                          // the brow
      else if (ay > 0.46 && ay <= 0.56 && aa > 0.05 && aa < 0.32) val -= aa > 0.12 && aa < 0.25 && ay > 0.49 && ay < 0.53 ? 0.8 : 1.8; // the eyes in shadow
      if (ay > 0.3 && ay <= 0.56 && aa < 0.06 + (0.56 - ay) * 0.3) val += ax * L < 0 ? 0.9 : -0.9; // the nose
      if (ay > 0.3 && ay <= 0.34 && aa > 0.04 && aa < 0.13) val -= 1.6;                   // nostrils
      if (aa < 0.21) {
        if (ay > 0.245 && ay <= 0.29) val += 0.8;                                          // the upper lip
        else if (ay > 0.215 && ay <= 0.245) val -= 2;                                      // the mouth
        else if (ay > 0.15 && ay <= 0.215 && aa < 0.17) val += 0.4;                        // the lower lip
        else if (ay > 0.12 && ay <= 0.15 && aa < 0.15) val -= 1;
      }
      if (aa > 0.4 && ay > 0.28 && ay < 0.6) val -= 0.6;                                   // the ear flaps
      if (hash(x >> 1, y >> 1, 17) < 0.12) val -= 0.6;
      p.r[i] = R; p.v[i] = val; p.z[i] = z;
    });
    // Moss on the helmet.
    p.each(P([[-0.4, 0.82], [-0.2, 0.96], [0.15, 0.98], [0.36, 0.86], [0.1, 0.9]]), (x, y, i) => { if (p.z[i] === z && hash(x, y, 23) < 0.7) { p.r[i] = p.ri('leaf'); p.v[i] = v + 0.6 - (x - cx) / s * 2 * L; } });
    // Roots poured over it.
    const rv = o.rootV ?? v - 1.6; const rw = Math.max(1.5, s * 0.07);
    const roots = [
      [[-0.06, 1.02], [-0.4, 0.98], [-0.55, 0.5], [-0.62, -0.02]],
      [[0.04, 1.02], [0.42, 0.95], [0.46, 0.45], [0.6, -0.02]],
      [[0.0, 1.0], [-0.22, 0.86], [-0.3, 0.62], [-0.34, 0.44]],
      [[0.08, 1.0], [0.28, 0.8], [0.4, 0.66], [0.42, 0.5]],
    ];
    roots.forEach((rt, k) => {
      const pts = bez([cx + rt[0][0] * s, fy - rt[0][1] * s], [cx + rt[1][0] * s, fy - rt[1][1] * s], [cx + rt[2][0] * s, fy - rt[2][1] * s], 6)
        .concat(bez([cx + rt[2][0] * s, fy - rt[2][1] * s], [cx + lerp(rt[2][0], rt[3][0], 0.5) * s, fy - lerp(rt[2][1], rt[3][1], 0.5) * s], [cx + rt[3][0] * s, fy - rt[3][1] * s], 4).slice(1));
      limb(p, pts, k < 2 ? rw * 1.4 : rw, k < 2 ? rw * 1.8 : rw * 0.5, 'bark', rv, z + 1, { lit: [-L, -0.5], rim: 1.4, side: 1, seed: 7 + k });
    });
    if (o.tree !== undefined) limb(p, [[cx, fy - 0.95 * s], [cx + 0.05 * s, fy - 1.4 * s], [cx + 0.02 * s, o.tree]], rw * 3, rw * 2.2, 'bark', rv, z + 1, { lit: [-L, -0.3], rim: 1.4, seed: 12 });
  }

  /**
   * A waterfall pouring off a cliff's lip: a pale strip streaked down its
   * length, darker at its edges, bright where it tips over.
   */
  function waterfall(p, x, y0, y1, w0, w1, v, z) {
    const R = p.ri('water');
    p.each(C.poly([[x - w0 / 2, y0], [x + w0 / 2, y0], [x + w1 / 2, y1], [x - w1 / 2, y1]]), (px, py, i) => {
      const t = (py + 0.5 - y0) / (y1 - y0); const hw = lerp(w0, w1, t) / 2;
      const q = (px + 0.5 - x) / hw;
      const streak = hash(px, Math.floor((py + hash(px, 1, 3) * 9) / 5), 4);
      let val = v - (Math.abs(q) > 0.7 ? 1.6 : 0) + (streak > 0.6 ? 1 : streak < 0.25 ? -0.8 : 0) - t * 0.6;
      if (py < y0 + 1.5) val += 1.4;
      p.r[i] = R; p.v[i] = val; p.z[i] = z;
    });
  }

  /** A cliff the waterfall drops from: a jagged face of rock, ledged, darker downward. */
  function cliff(p, pts, v, z, u, seed) {
    const shape = C.poly(pts);
    p.fill(shape, 'stone', (x, y) => v - (y / p.h) * 1.5, z);
    p.cells(shape, { size: 5 * u, sy: 0.6, joint: 0.8, jointV: -1.1, vary: 0.8, bevel: 0.7, lit: [-0.6, -0.8], seed, z });
  }

  /** Giant leaves rising from the bottom edge: [x, foot y, direction, length, width, seed, splits]. */
  function leafFrame(p, list, z, v, o = {}) {
    for (const [x, fy, dir, len, w, sd, splits] of list) {
      const a = [x, fy]; const c = [x + dir * len * 0.62, fy - len * 0.78];
      const b = [x + dir * len * 0.05, fy - len * 0.7];
      bigLeaf(p, a, b, c, w, 'leaf', v, z, { seed: sd, splits, lit: o.lit ?? 1.2, rim: o.rim ?? 2.2, vein: 0.8, midrib: o.midrib ?? 1.8, lag: 1.6, n: 16 });
    }
  }

  const A = {
    job: 0, setting: 'sunken-jungle', key: 'A', id: 'sunken-jungle-a', side: 'outside',
    name: 'The Sunken Jungle', title: 'The pyramid in the canopy',
    pitch: 'Steaming jungle in the gold of late afternoon. A step pyramid breaks the canopy, a waterfall drops behind it, rope bridges hang between the great trees, and old stone heads sink under the roots. Whatever the card is waits at the foot of the stair.',
    notes: [
      ['Light', 'Gold: a hot haze over the canopy, and the sun lying on the foot of the pyramid’s stair, where the card stands. Under the trees it is near black, cut by a few shafts of sun.'],
      ['Detail', 'Tiered stone with lit terrace edges and a slotted roof comb on the temple, plants rooted on every ledge, buttressed trunks, rope bridges and hanging lianas, colossal heads with fig roots poured over them, giant split leaves.'],
      ['Vista', 'The canopy the width of the board, the pyramid breaking it in the middle. At the stair’s foot: a serpent reared to strike, a guide with a lantern, a violet idol on a plinth, the stair collapsed in a heap of carved blocks, the sun pouring down the stair.'],
      ['World', 'Sky high, table low: the haze and the canopy only along the top, then the old paved road under the table, giant leaves and ferns crowding in from the sides, shafts of sun down the great trunks at the edges.'],
    ],
    palette: ['#0C110D', '#262E20', '#454A2F', '#776F45', '#453C30', '#8B785C', '#D3BC9C', '#BA8642', '#F6DDA8'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { dither: 0.26 });
      const u = H / 134; const gx = W / 2;
      haze(p, W, 100 * u, { u, top: 8, low: 15.5, hor: 72 * u, sx: 28 * u, sy: 30 * u, sr: 50 * u, sun: 2.4 });
      // Far hills and the far canopy, in the haze.
      skyline(p, W, (x) => 62 * u + n1(x / (14 * u), 4) * 6 * u, 100 * u, 'sky', 12.6, 1);
      crowns(p, crownRow(-8, W + 8, { seed: 'ab-far', gap: 8 * u, r0: 4 * u, r1: 7 * u, top: (x) => 69 * u + Math.sin(x / (9 * u)) * 2 * u }), { ramp: 'sky', v: 10.6, lit: 1, dark: 0.8, z: 1, cw: 3, rh: 2.4, amp: 0.45, bottom: 104 * u, seed: 5 });
      // The waterfall, off a cliff behind the pyramid's right shoulder.
      cliff(p, [[58 * u, 80 * u], [61 * u, 50 * u], [66 * u, 45 * u], [74 * u, 46 * u], [84 * u, 42 * u], [W, 44 * u], [W, 82 * u]], 9.2, 1, u, 8);
      waterfall(p, 70.5 * u, 46 * u, 78 * u, 3.4 * u, 4.6 * u, 13.4, 1);
      // The pyramid.
      const g = pyramid(p, { cx: gx, top: 44 * u, base: 100 * u, hw: 32 * u, u, tiers: 6, v: 8.4, z: 2, stair: 4.8 * u, step: 2, templeH: 10 * u, combH: 8 * u, ledge: 3.4 });
      overgrowth(p, g, { cx: gx, base: 100 * u, hw: 32 * u, u, n: 6, v: 4.6, z: 3, seed: 'ab-og' });
      steam(p, W, 77 * u, 3 * u, 1.6, 2);
      // The canopy round its foot, rising to the sides.
      const mid = crownRow(-10 * u, W + 10 * u, { seed: 'ab-mid', gap: 9 * u, r0: 7 * u, r1: 11 * u, top: (x) => 78 * u - 16 * u * clamp(Math.abs(x - gx) / (40 * u), 0, 1) ** 1.5 });
      crowns(p, mid, { ramp: 'leaf', v: 5, lit: 6, dark: 2, z: 3, cw: 4 * u, rh: 3 * u, amp: 0.8, bottom: H, seed: 9, fade: (x, y) => -clamp((y - 86 * u) / (24 * u), 0, 1) * 3 });
      // The great trees at the sides, the bridge slung between them across the pyramid.
      bigTree(p, 5 * u, -4, H, 13 * u, u, { v: 1.4, lean: 2 * u, seed: 4, lit: 1, rim: 2.4 });
      bigTree(p, W - 4 * u, -4, H, 12 * u, u, { v: 1.2, lean: -2 * u, seed: 6, lit: -1, rim: 2 });
      ropeBridge(p, 10 * u, 52 * u, W - 9 * u, 57 * u, 9 * u, 4 * u, 2, 5, u);
      liana(p, 8 * u, 6 * u, 40 * u, 2 * u, 22 * u, 'leaf', 2, 5, 3, 3, u);
      liana(p, W - 8 * u, 10 * u, 62 * u, -2 * u, 18 * u, 'leaf', 1.8, 5, 4, 2, u);
      liana(p, 21 * u, 0, 22 * u, 46 * u, 0, 'leaf', 2.2, 5, 5, 3, u);
      liana(p, 76 * u, 0, 75 * u, 38 * u, 0, 'leaf', 2, 5, 6, 2, u);
      // The floor, a head under the roots at the edge of the clearing, ferns.
      p.fill(C.rect(0, 110 * u, W, H - 110 * u), 'leaf', (x, y) => 1.8 - (y - 110 * u) / (24 * u) * 1.4 + (hash(x >> 1, y, 3) < 0.2 ? 0.8 : 0), 5);
      stoneHead(p, 33 * u, 114 * u, 21 * u, 6, 7, u, { lit: 1 });
      fern(p, 64 * u, 116 * u, 10 * u, 'leaf', 2.6, 7, 12, 5);
      leafFrame(p, [[2 * u, H + 4, 1, 56 * u, 19 * u, 21, 0.3], [W - 1 * u, H + 4, -1, 52 * u, 17 * u, 22, 0.25], [52 * u, H + 8, 1, 26 * u, 10 * u, 23, 0]], 8, 2.4, { lit: 1.6, rim: 3 });
      // A shaft of sun through the canopy onto the head.
      shaft(p, 14 * u, 74 * u, 32 * u, 112 * u, 6 * u, 13 * u, 4, { zMin: 3 });
      shaft(p, 60 * u, 80 * u, 74 * u, 114 * u, 3 * u, 7 * u, 2.2, { zMin: 3, zMax: 5 });
      vignette(p, W, H, 1.6, 0.42);
      return {
        p,
        over(img) {
          for (const [k, [x, y]] of [[60, 30], [68, 26], [38, 24]].entries()) sprite(img, Math.round(x * u), Math.round(y * u), BIRD[k % 2], { a: '#3C2A15' });
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['path'], dither: 0.26 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const floor = 90 * u; const top = 22 * u;
      haze(p, W, 80 * u, { u, top: 8.4, low: 15.4, hor: 56 * u, sx: gx - 50 * u, sy: 30 * u, sr: 110 * u, sun: 1.6 });
      // Far hills, far canopy, a far pyramid or two, all in the haze.
      skyline(p, W, (x) => 46 * u + n1(x / (30 * u), 6) * 8 * u, 80 * u, 'sky', 13, 1);
      for (const [dx, s] of [[-122, 1], [176, 0.8], [-240, 0.7]]) {
        const x = gx + dx * u; if (x < -30 * u || x > W + 30 * u) continue;
        pyramid(p, { cx: x, top: (40 - 10 * s) * u, base: 62 * u, hw: 26 * s * u, u, tiers: 5, v: 11.6, z: 1, ramp: 'sky', detail: false, stairOn: false, door: false, templeH: 5 * s * u, combH: 4 * s * u, flank: 0.7 });
      }
      crowns(p, crownRow(-10, W + 10, { seed: 'av-far', gap: 9 * u, r0: 5 * u, r1: 8 * u, top: (x) => 52 * u + Math.sin(x / (11 * u)) * 2 * u }), { ramp: 'sky', v: 10.8, lit: 1, dark: 0.8, z: 1, cw: 4 * u, rh: 3 * u, amp: 0.4, bottom: 80 * u, seed: 7 });
      // The waterfall, off a cliff to the right.
      const wx = gx + 106 * u;
      if (wx < W + 40 * u) {
        cliff(p, [[wx - 18 * u, 70 * u], [wx - 14 * u, 24 * u], [wx - 6 * u, 18 * u], [wx + 8 * u, 20 * u], [wx + 30 * u, 14 * u], [wx + 60 * u, 18 * u], [wx + 60 * u, 70 * u]], 9.4, 1, u, 9);
        waterfall(p, wx, 20 * u, 62 * u, 4 * u, 6 * u, 13.4, 1);
      }
      // The pyramid breaking the canopy.
      const g = pyramid(p, { cx: gx, top, base: floor, hw: 66 * u, u, tiers: 8, v: 8.2, z: 2, step: Math.max(2, 1.6 * u), templeH: 10 * u, combH: 8 * u, ledge: 3.4 });
      overgrowth(p, g, { cx: gx, base: floor, hw: 66 * u, u, n: 8, v: 4.8, z: 3, seed: 'av-og' });
      steam(p, W, 55 * u, 3.2 * u, 1.6, 4, (x) => 0.5 + 0.5 * clamp(1 - Math.abs(x - gx) / (120 * u), 0, 1), 3);
      // The canopy either side, clear of the stair, rising toward the edges.
      const canTop = (x) => 56 * u - 28 * u * clamp((Math.abs(x - gx) - 30 * u) / (120 * u), 0, 1) ** 0.8;
      const mid = crownRow(-12 * u, W + 12 * u, { seed: 'av-mid', gap: 11 * u, r0: 8 * u, r1: 14 * u, top: canTop, skip: (x, rx) => Math.abs(x - gx) < 27 * u + rx * 0.6 });
      crowns(p, mid, { ramp: 'leaf', v: 5, lit: 6, dark: 2, z: 3, cw: 4.4 * u, rh: 3.2 * u, amp: 0.8, bottom: floor + 2 * u, seed: 11, fade: (x, y) => -clamp((y - 58 * u) / (26 * u), 0, 1) * 3 });
      // The great trees, the bridges between them, lianas.
      const trees = [];
      for (let d = 74; gx + d * u < W + 24 * u; d += 112) trees.push(gx - d * u, gx + d * u);
      trees.forEach((x, k) => bigTree(p, x, -4, floor + 3 * u, (k < 2 ? 15 : 12 + (k % 3)) * u, u, { v: 1.2, lean: (k % 2 ? 2 : -2) * u, seed: 5 + k, lit: x < gx ? 1 : -1, rim: k < 2 ? 2.6 : 1.6 }));
      for (let k = 0; k + 2 < trees.length; k += 2) {
        for (const m of [0, 1]) {
          const a = trees[k + m]; const b = trees[k + 2 + m];
          const y0 = (30 + ((k + m) % 3) * 4) * u;
          ropeBridge(p, Math.min(a, b) + 5 * u, y0, Math.max(a, b) - 5 * u, y0 + 3 * u, 9 * u, 3.6 * u, 2, 5, u);
          liana(p, Math.min(a, b) + 6 * u, 4 * u, Math.max(a, b) - 6 * u, 2 * u, 15 * u, 'leaf', 1.8, 5, k + m, 2, u);
        }
      }
      // The clearing floor at the stair's foot: worn flags, dark to the sides.
      const fl = C.rect(0, floor, W, H - floor);
      p.fill(fl, 'stone', 4.6, 4);
      p.floor(fl, { vx: gx, vy: floor - 30 * u, rows: 4, size: 0.9, d0: 30 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 13, z: 4 });
      p.shade(fl, (x) => -clamp((Math.abs(x - gx) - 26 * u) / (34 * u), 0, 1) * 3.6, 4);
      // The heads either side of the stair, sunk under the roots, lit from the clearing.
      for (const m of [-1, 1]) stoneHead(p, gx + m * 44 * u, floor + 3 * u, 21 * u, 5, 5.8, u, { lit: m });
      // The sun lying on the stair's foot and the clearing.
      p.light(gx - 2 * u, floor - 10 * u, 40 * u, open ? 4 : 3.6, null, { zMin: 2, zMax: 6, sy: 0.7 });
      p.light(gx, floor + 4 * u, 34 * u, 2.4, null, { zMin: 4, zMax: 4, sy: 0.35 });
      // Shafts through the canopy at the sides.
      for (const [x0, x1] of [[-136, -100], [80, 112], [-216, -180], [156, 192]]) {
        if (gx + x1 * u < -10 * u || gx + x0 * u > W + 10 * u) continue;
        shaft(p, gx + x0 * u, 34 * u, gx + x1 * u, floor + 2 * u, 4 * u, 9 * u, 2.4, { zMin: 3, zMax: 4 });
      }
      // The card, at the foot of the stair.
      const fy = floor + 2 * u;
      if (cat === 'monster') {
        const e = serpent(p, gx + 3 * u, fy, 46 * u, ramp, 7);
        p.tint(e.ex, e.ey, 3 * u, hex, 0.35, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 36 * u;
        const l = guide(p, gx + 4 * u, fy, s, 7);
        rimLight(p, 7, [[-1, 0], [0, -1]], 'gold', 7);
        lantern(p, l.lx, l.ly, ramp, 9);
        p.tint(l.lx, l.ly + 2, 7 * u, CARD[ramp][4], 0.6, flicker(0.9, 0.15));
        p.tint(l.lx, l.ly + 2, 14 * u, hex, 0.25, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        p.fill(C.rect(gx - 9 * u, fy - 9 * u, 18 * u, 9 * u), 'stone', 7.4, 6);
        p.fill(C.rect(gx - 10.5 * u, fy - 10.5 * u, 21 * u, 1.6 * u), 'stone', 10.4, 6);
        p.fill(C.rect(gx - 9 * u, fy - 9 * u, 18 * u, 1), 'stone', 4.6, 6);
        const id = idol(p, gx, fy - 10.5 * u, 30 * u, ramp, 7, { v: 1.9, hi: 1.8, lo: 0.9, gemV: 4.4 });
        rimLight(p, 7, [[0, -1]], ramp, 3.6);
        p.tint(id.ex, id.ey, 5 * u, CARD[ramp][4], 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        // The stair broken off above the heap: a ragged black gap.
        const gt = floor - 40 * u; const gb = floor - 14 * u;
        p.fill(C.poly([[gx - g.sw0 * 0.8, gb], [gx - g.sw0 * 0.6, gt + 4 * u], [gx - g.sw0 * 0.2, gt], [gx + g.sw0 * 0.3, gt + 3 * u], [gx + g.sw0 * 0.75, gt + 1 * u], [gx + g.sw0 * 0.9, gb]]), 'shadow', 0.6, 6);
        rubble(p, gx, fy + 1 * u, 36 * u, 32 * u, ramp, 7, 'av-rubble', u);
      } else if (cat === 'clear-path') {
        // The sun stands over the temple and pours down the stair.
        const sx = gx; const sy = g.ry - 1 * u; const sr = 7 * u;
        p.shade(null, (x, y, i) => {
          if (p.z[i] > 1) return 0;
          const d = Math.hypot(x - sx, y - sy); if (d < sr) return 0;
          const a = Math.atan2(y - sy, x - sx);
          return (frac(a / (Math.PI * 2) * 16 + 0.25) < 0.4 ? 2 : 0.6) * clamp(1 - d / (80 * u), 0, 1);
        });
        p.each(C.circle(sx, sy, sr), (x, y, i) => { if (p.z[i] <= 1) { p.r[i] = p.ri('path'); p.v[i] = 4.6 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / sr * 1.4; p.z[i] = 0; } });
        const pi = p.ri('path'); const si = p.ri('stone');
        const sh = Math.max(2, 1.6 * u);
        p.each(C.poly([[gx - g.sw0, floor + 1], [gx - g.sw1, top], [gx + g.sw1, top], [gx + g.sw0, floor + 1]]), (x, y, i) => {
          if (p.z[i] !== 3 || p.r[i] !== si) return;
          const f = frac((floor - y - 0.5) / sh); const t = (floor - y) / (floor - top);
          p.r[i] = pi; p.v[i] = (f < 0.5 ? 3.7 : 2.6) + (t < 0.3 ? 0.4 : 0) - (Math.abs(x + 0.5 - gx) > g.sw0 * 0.8 ? 1 : 0);
        });
        p.fill(C.rect(Math.round(gx - g.door[2] / 2), Math.round(g.door[1]), g.door[2], g.door[3]), 'path', 4.4, 4);
        p.tint(sx, sy, sr * 1.8, CARD.path[4], 0.6);
      }
      // Giant leaves and ferns in front, at the edges.
      const frame = [];
      for (let d = 92; d < W / u / 2 + 40; d += 74) frame.push([gx - d * u, H + 4, 1, (52 + (d % 3) * 6) * u, 19 * u, d, 0.3], [gx + d * u, H + 4, -1, (48 + (d % 4) * 5) * u, 18 * u, d + 1, 0.25]);
      leafFrame(p, frame, 9, 1.6);
      for (let d = 64; d < W / u / 2; d += 52) for (const m of [-1, 1]) fern(p, gx + m * d * u, H + 1, 12 * u, 'leaf', 2.2, 9, d + m, 5);
      vignette(p, W, H, 1.7, 0.42);
      p.shade(null, (x) => -2 * clamp((Math.abs(x + 0.5 - gx) - 120 * u) / (120 * u), 0, 1));
      return {
        p,
        over(img, t) {
          if (wx < W + 40 * u) for (let k = 0; k < 14; k += 1) {
            const ph = frac(t * 0.8 + hash(k, 2, 7)); const x = wx + (hash(k, 3, 7) - 0.5) * 3 * u; const y = lerp(20 * u, 62 * u, ph);
            put(img, x, y, '#FCFAF0', 0.7 * (1 - ph * 0.6));
          }
          for (let k = 0; k < 3; k += 1) {
            const a = t * 0.3 + k * 2.1; const bx = gx + Math.cos(a) * (44 + k * 12) * u; const by = (12 + k * 6) * u + Math.sin(a * 1.3) * 4 * u;
            sprite(img, Math.round(bx), Math.round(by), BIRD[Math.floor(t * 4 + k) % 2], { a: '#4B3419' });
          }
          for (const q of particles('mote', Math.round(W / 14), [0, 40 * u, W, floor - 40 * u], t, 21)) put(img, q.x, q.y, q.big ? '#F6DDA8' : '#CA9851', q.a * 0.5);
          if (open) for (const q of particles('mote', 16, [gx - 14 * u, top, 28 * u, floor - top], t, 23)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a);
          if (cat === 'item') for (const q of particles('mote', 8, [gx - 8 * u, fy - 40 * u, 16 * u, 26 * u], t, 25)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { dither: 0.26 });
      const u = H / 250; const gx = W / 2;
      haze(p, W, 80 * u, { u, top: 9, low: 15, hor: 56 * u, sx: gx - 80 * u, sy: 30 * u, sr: 160 * u, sun: 1.6 });
      skyline(p, W, (x) => 34 * u + n1(x / (40 * u), 6) * 8 * u, 80 * u, 'sky', 12.6, 1);
      pyramid(p, { cx: gx, top: 18 * u, base: 72 * u, hw: 46 * u, u, tiers: 6, v: 8.2, z: 2, templeH: 7 * u, combH: 6 * u });
      crowns(p, crownRow(-10, W + 10, { seed: 'aw-far', gap: 12 * u, r0: 7 * u, r1: 12 * u, top: (x) => 50 * u + Math.sin(x / (14 * u)) * 3 * u - 10 * u * clamp(Math.abs(x - gx) / (160 * u), 0, 1), skip: (x) => Math.abs(x - gx) < 24 * u }), { ramp: 'leaf', v: 5, lit: 6, dark: 2, z: 3, cw: 5 * u, rh: 3.6 * u, amp: 0.7, bottom: 90 * u, seed: 15 });
      // The old road to the pyramid, paved in limestone, running up under the table; the jungle floor either side.
      const vy = -30 * u; const k = 0.34; const half = (y) => k * (y - vy);
      p.fill(C.rect(0, 72 * u, W, H - 72 * u), 'leaf', (x, y) => 2.2 - (y - 72 * u) / (H - 72 * u) * 1.2 + (n2(x / (20 * u), y / (8 * u), 3) > 0.62 ? 0.6 : 0), 4);
      const road = C.poly([[gx - half(72 * u), 72 * u], [gx + half(72 * u), 72 * u], [gx + half(H), H], [gx - half(H), H]]);
      p.fill(road, 'stone', 4.2, 4);
      p.floor(road, { vx: gx, vy, rows: 9, size: 1.1, d0: 100 * u, joint: -1.4, top: 0.6, left: 0.3, vary: 1, chip: 0.05, seed: 19, z: 4 });
      // Broken up: soil and leaf litter where stones are gone, worn ruts, its edges lost under the leaves.
      const LI = p.ri('leaf');
      p.each(road, (x, y, i) => {
        const e = Math.abs(x + 0.5 - gx) / half(y + 0.5);
        const gone = n2(x / (9 * u), y / (7 * u), 7) + (e > 0.75 ? (e - 0.75) * 2.4 : 0);
        if (gone > 0.72) { p.r[i] = LI; p.v[i] = 2.6 + (hash(x >> 1, y >> 1, 5) < 0.3 ? 0.9 : 0) - (gone < 0.76 ? 0.8 : 0); }
        else if (gone > 0.66) p.v[i] -= 1.1;
      });
      for (const [x0, y0, x1, y1, w] of [[-10, 120, 140, 150, 3.4], [W + 6, 170, 190, 200, 4], [-6, 220, 120, 236, 4.4]]) {
        const pts = bez([x0, y0 * u], [lerp(x0, x1, 0.5), y0 * u + 16 * u], [x1, y1 * u], 10);
        p.shade(ribbon(pts.map(([x, y]) => [x, y + 2 * u]), w * u * 1.2, w * u * 0.4), -1.2, 4);
        limb(p, pts, w * u, w * u * 0.3, 'bark', 2.2, 5, { lit: [0, -1], rim: 1.4, side: 1.2, seed: Math.round(y0) });
      }
      const r = rng('aw-floor'); const items = [];
      for (let k2 = 0; k2 < 64; k2 += 1) {
        const t = r() ** 0.8; const y = (78 + t * 190) * u;
        const side = r() < 0.5 ? -1 : 1; const x = gx + side * (half(y) * (0.9 + r() * 0.9) + r() * 30 * u);
        items.push([x, y, 0.7 + t * 1.5, Math.floor(r() * 1e6), r(), side]);
      }
      items.sort((a, b) => a[1] - b[1]);
      for (const [x, y, sc, sd, kind, side] of items) {
        const dark = clamp((y - 80 * u) / (120 * u), 0, 1);
        if (kind < 0.6) {
          const dir = -side; const len = (18 + hash(sd, 2, 1) * 14) * sc * u;
          bigLeaf(p, [x, y - len * 0.12], [x + dir * len * 0.3, y - len * 0.62], [x + dir * len * 0.9, y - len * 0.5], len * 0.4, 'leaf', 3.2 - dark * 0.8, 5, { seed: sd, splits: hash(sd, 3, 1) < 0.5 ? 0.28 : 0, lit: 0.9, rim: 1.6, vein: 0.8, midrib: 1.4, n: 12, stalk: [x - dir * 2 * u, y + 2 * u] });
        } else fern(p, x, y, 11 * sc * u, 'leaf', 2.6 - dark * 0.6, 5, sd, 5);
      }
      // Great trunks at the edges, a shaft of sun down each.
      bigTree(p, 4 * u, -4, H, 24 * u, u, { v: 1.4, lean: 4 * u, seed: 31, z: 6, lit: 1, rim: 2 });
      bigTree(p, W - 4 * u, -4, H, 22 * u, u, { v: 1.2, lean: -4 * u, seed: 32, z: 6, lit: -1, rim: 2 });
      shaft(p, 30 * u, 70 * u, 4 * u, H * 0.8, 10 * u, 20 * u, 2.8, { zMin: 4 });
      shaft(p, W - 30 * u, 70 * u, W - 4 * u, H * 0.8, 10 * u, 20 * u, 2.8, { zMin: 4 });
      for (const z of [3, 4]) p.shade(null, (x, y) => -1.2 * clamp((y / H - 0.28) / 0.06, 0, 1) - 2 * Math.max(0, y / H - 0.36), z);
      p.shade(null, (x, y) => -0.8 * clamp((y / H - 0.28) / 0.06, 0, 1) - 1.2 * Math.max(0, y / H - 0.4), 5);
      return {
        p,
        over(img, t) {
          for (const q of particles('mote', 40, [0, 50 * u, W, H * 0.4], t, 41)) put(img, q.x, q.y, q.big ? '#815827' : '#4B3419', q.a * 0.5);
          for (const s of [0, 1]) for (const q of particles('mote', 10, [s ? W - 34 * u : 4 * u, 80 * u, 30 * u, 110 * u], t, 43 + s)) put(img, q.x, q.y, '#CA9851', q.a * 0.7);
        },
      };
    },
  };


  /* ================= B: the temple inside the pyramid ================= */

  // Firelight: orange-gold, never red. Lights do not touch it.
  const FIRE = ['#2E1606', '#5A2C0C', '#8A4614', '#B8661E', '#DE8A2C', '#F4AE45', '#FDCF73', '#FFE9A8', '#FFF8DE'];
  // Still black water in the channels, faintly green.
  const POOL = ['#030404', '#060807', '#0A0D0B', '#0F1310', '#151A16', '#1C221D', '#242B25'];
  const RAMPS_B = { stone: STONE, leaf: LEAF, bark: BARK, shadow: SHADOW, gold: GOLD, fire: FIRE, pool: POOL, ...CARD };
  const FLAME = { a: '#8A4614', b: '#F4AE45', c: '#FFE9A8', d: '#3A2010', e: '#FFF8DE' };
  const BIG_FLAME = [
    ['...a...', '..aba..', '..bcb..', '.abcba.', '.bcccb.', 'abcecba', '.bcccb.', '..ddd..'],
    ['..a....', '..ab...', '..bcb..', '.abcba.', '.bcccb.', 'abcecba', '.bcccb.', '..ddd..'],
    ['....a..', '...ba..', '..bcb..', '.abcba.', '.bcccb.', 'abcecba', '.bcccb.', '..ddd..'],
  ];

  /** A corbel arch's outline: jambs up to the spring, then each course stepping in to a narrow capstone. */
  function corbelPts(cx, top, hw, spring, bottom, cap, steps) {
    const L = [[cx - hw, bottom], [cx - hw, spring]];
    for (let k = 1; k <= steps; k += 1) {
      const x0 = lerp(cx - hw, cx - cap, (k - 1) / steps); const x1 = lerp(cx - hw, cx - cap, k / steps); const y = lerp(spring, top, k / steps);
      L.push([x0, y], [x1, y]);
    }
    return L.concat(L.slice().reverse().map(([x, y]) => [2 * cx - x, y]));
  }

  /**
   * A corbel-vaulted niche: a frame of cut stone round the opening, lit
   * along its inner edge; the recess laid in courses, darker toward its top.
   * Returns the inside's outline.
   */
  function niche(p, cx, top, hw, spring, bottom, u, o = {}) {
    const z = o.z ?? 1; const th = o.th ?? 3 * u; const cap = o.cap ?? Math.max(2, hw * 0.2);
    const steps = Math.max(2, Math.round((spring - top) / Math.max(2, 3 * u)));
    const outer = C.poly(corbelPts(cx, top - th, hw + th, spring - th * 0.5, bottom, cap + th * 0.6, steps));
    const inner = C.poly(corbelPts(cx, top, hw, spring, bottom, cap, steps));
    p.fill(outer, 'stone', o.frameV ?? 2.2, z);
    p.masonry(outer, { bw: 5 * u, bh: Math.max(2, 2.6 * u), joint: -1.1, top: 0.5, left: 0.3, vary: 0.7, seed: o.seed || 3, z });
    p.fill(inner, 'stone', (x, y) => (o.backV ?? 0.9) - clamp((spring - y) / (spring - top), 0, 1) * 0.6, z + 1);
    p.masonry(inner, { bw: 6 * u, bh: Math.max(2, 3 * u), joint: -0.8, top: 0.3, vary: 0.5, seed: (o.seed || 3) + 1, z: z + 1 });
    // The inner edge of the frame, catching the light from below.
    rimLight(p, z, [[1, 0], [-1, 0], [0, 1]], 'stone', (y) => (o.lipV ?? 4) - clamp((spring - y) / (spring - top), 0, 1) * 1.6, -99, [z]);
    return inner;
  }

  /** A carved serpent along a band of the wall: its scaled body undulating between two mouldings. */
  function frieze(p, x0, x1, y, h, z, v, u, seed = 0) {
    const R = p.ri('stone'); const per = 22 * u;
    p.each(C.rect(x0, y, x1 - x0, h), (x, yy, i) => {
      const ly = yy + 0.5 - y; let val = v;
      if (ly < 1) val += 1.6;
      else if (ly < 2) val -= 0.8;
      else if (ly > h - 1) val -= 1.2;
      else if (ly > h - 2) val += 0.9;
      else {
        const yc = y + h / 2 + Math.sin(((x + 0.5) / per) * Math.PI * 2 + seed) * h * 0.16;
        const bw = h * 0.24; const d = (yy + 0.5 - yc) / bw;
        if (Math.abs(d) < 1) val += 1.1 + (d < -0.45 ? 0.9 : 0) - ((Math.floor((x + 0.5) / Math.max(2, 2 * u)) + (d > 0 ? 1 : 0)) % 2 ? 0.6 : 0);
        else if (d >= 1 && d < 1.7) val -= 0.9;
        else val -= 0.2;
      }
      p.r[i] = R; p.v[i] = val; p.z[i] = z;
    });
  }

  /**
   * A serpent's head carved at the foot of a balustrade, facing you: the
   * lower jaw on the floor with the tongue lolling over it, the mouth black,
   * two fangs, a broad snout with a curled nose, round eyes, plumes behind.
   * Lit from the front by the fire.
   */
  function serpentHead(p, cx, fy, s, z, v) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy - y * s]));
    const lit = (x) => v + (x + 0.5 < cx ? 0.6 : -0.6);
    for (let k = 0; k < 5; k += 1) { const a = lerp(-1, 1, k / 4); p.fill(P([[a * 0.42 - 0.08, 0.7], [a * 0.62, 1.12], [a * 0.42 + 0.08, 0.7]]), 'stone', v - 0.8 + (k % 2 ? 0.6 : 0), z); } // the plumes
    p.fill(P([[-0.5, 0], [-0.52, 0.2], [0.52, 0.2], [0.5, 0]]), 'stone', lit, z);                    // the lower jaw
    p.fill(P([[-0.5, 0.2], [-0.5, 0.22], [0.5, 0.22], [0.5, 0.2]]), 'stone', v + 1.6, z);
    p.fill(P([[-0.44, 0.2], [-0.44, 0.48], [0.44, 0.48], [0.44, 0.2]]), 'shadow', 0.3, z);                // the mouth
    p.fill(P([[-0.56, 0.46], [-0.56, 0.74], [-0.4, 0.86], [0.4, 0.86], [0.56, 0.74], [0.56, 0.46]]), 'stone', (x) => lit(x) + 0.5, z); // the snout
    p.fill(P([[-0.56, 0.46], [-0.56, 0.5], [0.56, 0.5], [0.56, 0.46]]), 'stone', v - 0.6, z);
    for (const m of [-1, 1]) {
      p.fill(P([[m * 0.42, 0.48], [m * 0.27, 0.48], [m * 0.35, 0.24]]), 'stone', v + 2.6, z + 1);       // fangs
      p.fill(P([[m * 0.16, 0.2], [m * 0.06, 0.2], [m * 0.11, 0.33]]), 'stone', v + 1.8, z + 1);
      p.fill(C.circle(cx + m * 0.36 * s, fy - 0.78 * s, Math.max(1.2, 0.13 * s), 12), 'stone', v + 1.2, z + 1); // eyes
      p.fill(C.circle(cx + m * 0.36 * s, fy - 0.76 * s, Math.max(0.6, 0.06 * s), 8), 'shadow', 0.4, z + 2);
    }
    p.fill(P([[-0.1, 0.6], [-0.12, 0.76], [0.12, 0.76], [0.1, 0.6]]), 'stone', v + 1.4, z + 1);        // the nose
    p.fill(P([[-0.04, 0.64], [-0.05, 0.7], [0.05, 0.7], [0.04, 0.64]]), 'stone', v - 0.6, z + 2);
  }

  /** A stone brazier: a bowl on a short ringed pillar, coals glowing in it. Returns where the flame sits. */
  function brazier(p, x, fy, u, z, h = 10) {
    const ph = h * u;
    p.fill(C.rect(x - 3 * u, fy - 2 * u, 6 * u, 2 * u + 1), 'stone', 2.6, z);
    p.fill(C.poly([[x - 2.2 * u, fy - 2 * u], [x - 1.8 * u, fy - ph], [x + 1.8 * u, fy - ph], [x + 2.2 * u, fy - 2 * u]]), 'stone', (px) => 2.6 + (px < x ? 0.8 : -0.6), z);
    for (let y = fy - 4 * u; y > fy - ph + u; y -= 2.5 * u) p.fill(C.rect(x - 2.2 * u, y, 4.4 * u, 1), 'stone', 1.4, z);
    p.fill(C.poly([[x - 5.5 * u, fy - ph - 4 * u], [x + 5.5 * u, fy - ph - 4 * u], [x + 3.2 * u, fy - ph], [x - 3.2 * u, fy - ph]]), 'stone', (px) => 3.4 + (px < x ? 0.8 : -0.8), z);
    p.fill(C.rect(x - 5.5 * u, fy - ph - 4 * u, 11 * u, 1), 'stone', 6.4, z);
    p.fill(C.ellipse(x, fy - ph - 4.3 * u, 4.4 * u, Math.max(0.8, 1 * u), 12), 'fire', 4.6, z + 1);
    return [Math.round(x), Math.round(fy - ph - 4 * u)];
  }

  /** Light from a brazier: a hard pool and a long soft reach, flickering. */
  function fireLight(p, x, y, u, k, ph, zMin = 1, zMax = 8, s = 1) {
    p.light(x, y, 42 * u * k, 8 * s, flicker(ph, 0.14), { zMin, zMax, hard: true });
    p.light(x, y, 90 * u * k, 2.2 * s, flicker(ph + 1, 0.08), { zMin, zMax });
  }

  /**
   * A channel of still black water between lit kerbs, slow ripples across
   * it. `edge(y)` gives its two sides at y.
   */
  function channel(p, y0, y1, edge, z, u, o = {}) {
    const PR = p.ri('pool'); const SR = p.ri('stone');
    const rip = o.rip ?? 2.6 * u;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      const [a, b] = edge(y + 0.5); const t = (y - y0) / (y1 - y0);
      for (let x = Math.max(0, Math.floor(a) - 1); x <= Math.min(p.w - 1, Math.ceil(b)); x += 1) {
        const i = y * p.w + x;
        if (x + 0.5 < a - 1 || x + 0.5 > b + 1) continue;
        if (x + 0.5 < a || x + 0.5 > b) { p.r[i] = SR; p.v[i] = (o.kerbV ?? 3.2) - t * 0.8; p.z[i] = z; continue; }
        const rp = frac((y + Math.sin(x * 0.4) * 0.6) / (rip * (0.6 + t)));
        p.r[i] = PR; p.v[i] = 1.4 + (rp < 0.18 ? 0.9 : 0) - t * 0.6; p.z[i] = o.waterZ ?? 0;
      }
    }
  }

  /**
   * A flame held in still water: short dashes stacked down the water from
   * y0, widest and brightest near the top, broken by ripples, dimming as it
   * comes toward you. Only on pixels of the `pool` ramp.
   */
  function streak(p, cx, y0, y1, w, v0, fall, u, k = null) {
    const GR = p.ri('gold'); const PR = p.ri('pool'); const sd = Math.round(cx * 7 + y0);
    const rows = Math.max(1, 1.3 * u);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      const t = (y - y0) / (y1 - y0); const row = Math.floor((y - y0) / rows);
      if (row > 0 && hash(row, 1, sd) < 0.1 + t * 0.35) continue;
      const hw = w * (0.45 + hash(row, 2, sd) * 0.7) * (1 - t * 0.3);
      const off = (hash(row, 3, sd) - 0.5) * w * 0.3;
      for (let x = Math.floor(cx + off - hw); x <= Math.ceil(cx + off + hw); x += 1) {
        if (x < 0 || x >= p.w) continue;
        const i = y * p.w + x; if (p.r[i] !== PR) continue;
        const d = Math.abs(x + 0.5 - cx - off) / hw; if (d > 1) continue;
        const val = v0 - t * fall - (d > 0.55 ? 1.8 : 0);
        if (val < 1.2) continue;
        p.r[i] = GR; p.v[i] = val;
      }
    }
  }

  /**
   * The water holds what stands above it: each pixel of still water takes
   * the picture mirrored about the line yw, darker, shaken sideways by the
   * ripples and broken by their lines. The lit idol, the coals and the gold
   * show in it; the dark walls stay dark. Returns the water's pixels.
   */
  function mirror(p, x0, x1, y0, y1, yw, o = {}) {
    const PR = p.ri('pool'); const dim = o.dim ?? 1.4; const amp = o.amp ?? 1;
    const sr = p.r.slice(); const sv = p.v.slice(); const mask = new Uint8Array(p.w * p.h);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const sy = Math.round(2 * yw - y - 1); if (sy < 0) continue;
      const off = Math.round(Math.sin(y * 1.9 + (o.seed || 0)) * amp * (0.4 + t));
      const rip = frac((y - y0) / (o.rip ?? 2.4)) < 0.34;
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(p.w, Math.ceil(x1)); x += 1) {
        const i = y * p.w + x; if (p.r[i] !== PR) continue;
        mask[i] = 1;
        const j = sy * p.w + clamp(x + off, 0, p.w - 1);
        const val = sv[j] - dim - t * (o.fall ?? 1.4) - (rip ? 1 : 0);
        if (sr[j] === PR || val <= p.v[i] + 0.4) continue;
        p.r[i] = sr[j]; p.v[i] = val;
      }
    }
    return mask;
  }

  /** A flame's reflection: the sprite upside down under the waterline, dimmer, only on the water. */
  function flameIn(img, mask, x, y, yw, frame, a = 0.55) {
    const rows = BIG_FLAME[frame % 3]; const w = rows[0].length; const h = rows.length;
    for (let r = 0; r < h; r += 1) {
      const ry = Math.round(2 * yw - (y - h + r) - 1); if (ry < 0 || ry >= img.height) continue;
      const off = Math.round(Math.sin(ry * 1.9) * 0.8);
      for (let c = 0; c < w; c += 1) {
        const ch = rows[r][c]; if (ch === '.') continue;
        const rx = x - (w >> 1) + c + off; if (rx < 0 || rx >= img.width) continue;
        if (!mask[ry * img.width + rx] || (ry - Math.round(yw)) % 3 === 0) continue;
        put(img, rx, ry, FLAME[ch], a);
      }
    }
  }

  /** A rain god's mask in the wall: a block face with round eyes under a brow, a long nose hooked up, a band of teeth. */
  function mask(p, cx, cy, s, z, v) {
    const R = p.ri('stone');
    p.each(C.rect(cx - s / 2, cy - s / 2, s, s), (x, y, i) => {
      const ax = (x + 0.5 - cx) / s; const ay = (y + 0.5 - cy) / s; const aa = Math.abs(ax);
      let val = v - ax * 1.2;
      if (ay < -0.38) val += ay < -0.46 ? 1.4 : 0.4;                                        // the brow
      else if (ay < -0.32) val -= 1;
      const ex = aa - 0.25; const ey = ay + 0.12; const er = Math.hypot(ex, ey);
      if (er < 0.13) val += er < 0.06 ? -1.6 : (ey < 0 ? 1.2 : -0.4);                     // eyes
      if (aa < 0.07 && ay > -0.2 && ay < 0.2) val += ax < 0 ? 1.2 : 0.4;                   // the nose
      if (ay >= 0.16 && ay < 0.24 && ax > -0.2 && ax < 0.07) val += 1;                    // its hook, curling out
      if (ay > 0.28 && ay < 0.42 && aa < 0.34) val += (Math.floor((x - cx + 100) / 2) % 2 ? 0.6 : -0.9); // teeth
      if (aa > 0.42) val -= 0.6;
      p.r[i] = R; p.v[i] = val; p.z[i] = z;
    });
  }

  /** A root come down through the vault: from a crack at the top, down the wall, tendrils at its end. */
  function hangingRoot(p, x, y0, y1, w, z, v, seed, u) {
    const r = rng(seed);
    const pts = []; for (let k = 0; k <= 10; k += 1) { const t = k / 10; pts.push([x + Math.sin(t * 3 + seed) * 3 * u * t, lerp(y0, y1, t)]); }
    limb(p, pts, w, Math.max(1, w * 0.35), 'bark', v, z, { lit: [0, 1], rim: 1.2, side: 0.8, seed });
    for (let k = 0; k < 3; k += 1) {
      const [tx, ty] = pts[6 + Math.floor(r() * 4)]; const m = r() < 0.5 ? -1 : 1; const l = (4 + r() * 6) * u;
      line(p, tx, ty, tx + m * l * 0.4, ty + l, ink(p, 'bark', v - 0.2, z));
    }
  }

  const B = {
    job: 0, setting: 'sunken-jungle', key: 'B', id: 'sunken-jungle-b', side: 'inside',
    name: 'The Sunken Jungle', title: 'The serpent temple',
    pitch: 'Inside the pyramid, sealed from the sun. Water runs in stone channels from the mouths of carved serpents, braziers burn either side of the altar stair, and on the altar the gold idol gleams. The roots of the jungle have found their way down through the vault.',
    notes: [
      ['Light', 'Fire and gold: two braziers flank the altar stair and throw hard warm pools; the idol on the altar gleams in their light, and the still water in the channels holds the flames upside down. Everything else is dark limestone.'],
      ['Detail', 'Corbel vaults stepping in to a capstone, a carved serpent running the length of the wall, gaping serpent heads at the stair’s foot, the same colossal heads as outside set in the side bays, rain-god masks, roots come down through the cracks.'],
      ['Vista', 'The hall’s bays the width of the board, the altar in the middle. The card stands on the causeway before the stair: a serpent reared against the fire, the guide with a lantern, the idol turned violet, the stair collapsed across the way, the sealed door behind the altar thrown open on the sun.'],
      ['World', 'Flagstones under the table, the two channels running down it from the stair, a last glint of the fire in them, carved walls and braziers at the edges, roots creeping in across the floor.'],
    ],
    palette: ['#060505', '#1A1713', '#383027', '#665541', '#A98B60', '#0F1310', '#9C6A22', '#F2CB70', '#FFE9A8'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['fire'], dither: 0.26 });
      const u = H / 134; const gx = W / 2; const floor = 106 * u;
      // The wall and the vault's ceiling.
      p.fill(C.rect(0, 0, W, floor), 'stone', 1.2, 1);
      p.masonry(C.rect(0, 12 * u, W, floor - 12 * u), { bw: 8 * u, bh: 5 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 0.9, chip: 0.05, seed: 61, z: 1 });
      p.fill(C.rect(0, 0, W, 12 * u), 'stone', 0.8, 1);
      p.masonry(C.rect(0, 0, W, 12 * u), { bw: 22 * u, bh: 6 * u, joint: -0.9, top: 0.3, vary: 0.5, seed: 62, z: 1 });
      frieze(p, 0, W, 13 * u, 8 * u, 1, 1.6, u, 1);
      // Masks in the wall either side.
      for (const m of [-1, 1]) for (const y of [36, 60, 84]) mask(p, gx + m * 38 * u, y * u, 13 * u, 1, 2.8);
      // The niche, the altar in it.
      const inner = niche(p, gx, 30 * u, 21 * u, 54 * u, 92 * u, u, { th: 3 * u, seed: 63, backV: 0.8, lipV: 4 });
      p.each(C.rect(gx - 9 * u, 56 * u, 18 * u, 36 * u), (x, y, i) => { if (p.z[i] === 2) p.v[i] += (Math.abs(x + 0.5 - gx) > 8 * u || y < 57 * u ? -0.8 : 0); }); // a sealed slab behind the altar
      frieze(p, gx - 8 * u, gx + 8 * u, 62 * u, 6 * u, 2, 1.2, u, 2);
      // The altar platform: steps down to the floor, balustrades either side ending in serpent heads.
      for (let k = 0; k < 4; k += 1) {
        const y = 92 * u + k * 3.5 * u; const hw = (16 + k * 2.6) * u;
        p.fill(C.rect(gx - hw, y, hw * 2, 3.5 * u + 1), 'stone', (x, yy) => 2.4 + (yy < y + 1 ? 1.6 : 0) - (x - gx) / (hw * 2), 3);
      }
      for (const m of [-1, 1]) {
        p.fill(C.poly([[gx + m * 14 * u, 86 * u], [gx + m * 19 * u, 86 * u], [gx + m * 27 * u, floor - 4 * u], [gx + m * 22 * u, floor - 4 * u]]), 'stone', 3, 4);
        line(p, gx + m * 14 * u, 86 * u, gx + m * 22 * u, floor - 4 * u, (i) => { if (p.z[i] === 4) p.v[i] = 5.4; });
        serpentHead(p, gx + m * 26 * u, floor + 1 * u, 15 * u, 5, 5);
      }
      p.fill(C.rect(gx - 8 * u, 84 * u, 16 * u, 8 * u), 'stone', (x) => 3.6 - (x - gx) / (16 * u), 3);
      p.fill(C.rect(gx - 9 * u, 83 * u, 18 * u, 1.5 * u), 'stone', 5.6, 3);
      // The idol.
      idol(p, gx, 83 * u, 27 * u, 'gold', 6, { v: 5.4, hi: 4, lo: 2.6, gem: 'fire', gemV: 7.4 });
      // The braziers.
      const fl = [brazier(p, gx - 31 * u, floor + 1 * u, u, 6, 14), brazier(p, gx + 31 * u, floor + 1 * u, u, 6, 14)];
      // The floor and the channel across it.
      p.fill(C.rect(0, floor, W, H - floor), 'stone', 1.6, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: gx, vy: floor - 40 * u, rows: 4, size: 0.9, d0: 40 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 64, z: 1 });
      channel(p, 111 * u, 126 * u, () => [-2, W + 2], 2, u, { kerbV: 4, rip: 2 * u });
      // Roots down through the vault.
      hangingRoot(p, 9 * u, 0, 46 * u, 4 * u, 5, 3, 3, u);
      hangingRoot(p, W - 12 * u, 0, 34 * u, 3.4 * u, 5, 2.8, 4, u);
      hangingRoot(p, 30 * u, 0, 22 * u, 2.4 * u, 5, 2.6, 5, u);
      // Lights.
      fl.forEach(([x, y], k) => fireLight(p, x, y - 3 * u, u, 1, k * 2.1));
      p.light(gx, 66 * u, 24 * u, 3, null, { zMin: 2, zMax: 2 });
      p.light(gx, 86 * u, 30 * u, 1.6, null, { zMin: 3, zMax: 5 });
      const wm = mirror(p, 0, W, 111 * u, 126 * u, 104 * u, { dim: 1.2, fall: 2, amp: 1, rip: 2.2 * u });
      vignette(p, W, H, 1.9, 0.5);
      return {
        p,
        over(img) {
          fl.forEach(([x, y], k) => { sprite(img, x, y, BIG_FLAME[k], FLAME); flameIn(img, wm, x, y, 104 * u, k, 0.6); });
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['fire', 'path'], dither: 0.26 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const far = 70 * u;
      // The wall, the vault's ceiling, the serpent frieze.
      p.fill(C.rect(0, 0, W, far), 'stone', 1.3, 1);
      p.masonry(C.rect(0, 10 * u, W, far - 10 * u), { bw: 8 * u, bh: 5 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 0.9, chip: 0.05, seed: 71, z: 1 });
      p.fill(C.rect(0, 0, W, 10 * u), 'stone', 0.7, 1);
      frieze(p, 0, W, 10 * u, 8 * u, 1, 1.8, u, 2);
      // The side bays: niches with masks, braziers between them.
      const bays = []; for (let d = 74; gx + d * u < W + 30 * u; d += 66) bays.push(gx - d * u, gx + d * u);
      for (const [k, x] of bays.entries()) {
        niche(p, x, 28 * u, 15 * u, 42 * u, far, u, { th: 2.6 * u, seed: 72 + k, backV: 0.7, lipV: 3 });
        p.fill(C.rect(x - 10 * u, far - 5 * u, 20 * u, 5 * u + 1), 'stone', 2.2, 2); p.fill(C.rect(x - 10 * u, far - 5 * u, 20 * u, 1), 'stone', 3.6, 2);
        stoneHead(p, x, far - 5 * u, 24 * u, 2, 3.2, u, { lit: x < gx ? 1 : -1, rootV: 2 });
      }
      // The centre: the niche, the sealed door, the altar and its platform.
      const inner = niche(p, gx, 20 * u, 26 * u, 40 * u, far, u, { th: 3.4 * u, seed: 73, backV: 0.8, lipV: 4.2 });
      const door = C.poly(corbelPts(gx, 24 * u, 11 * u, 36 * u, 54 * u, 3 * u, 3));
      if (open) {
        // The sealed door thrown open: the sun pouring in down the stair.
        p.glow(door, 'path', gx, 50 * u, 20 * u, 4.6, 2.4, 3, { sy: 1.4 });
      } else {
        p.fill(door, 'stone', 0.6, 2);
        frieze(p, gx - 10 * u, gx + 10 * u, 40 * u, 6 * u, 2, 1.4, u, 3);
      }
      for (let k = 0; k < 4; k += 1) {
        const y = 54 * u + k * 4 * u; const hw = (15 + k * 3) * u;
        p.fill(C.rect(gx - hw, y, hw * 2, 4 * u + 1), 'stone', (x, yy) => 2.6 + (yy < y + 1 ? 1.8 : 0) - (x - gx) / (hw * 2), 3);
      }
      for (const m of [-1, 1]) {
        p.fill(C.poly([[gx + m * 12 * u, 48 * u], [gx + m * 17 * u, 48 * u], [gx + m * 26 * u, far - 2 * u], [gx + m * 21 * u, far - 2 * u]]), 'stone', 3, 4);
        line(p, gx + m * 12 * u, 48 * u, gx + m * 21 * u, far - 2 * u, (i) => { if (p.z[i] === 4) p.v[i] = 5.6; });
        serpentHead(p, gx + m * 25 * u, far + 4 * u, 14 * u, 5, 5);
      }
      p.fill(C.rect(gx - 7 * u, 46 * u, 14 * u, 8 * u), 'stone', (x) => 3.6 - (x - gx) / (14 * u), 3);
      p.fill(C.rect(gx - 8 * u, 45 * u, 16 * u, 1.5 * u), 'stone', 5.8, 3);
      // The floor: flags, the two channels running toward you from the serpents' mouths.
      const fl = C.rect(0, far, W, H - far);
      p.fill(fl, 'stone', 1.7, 1);
      p.floor(fl, { vx: gx, vy: far - 34 * u, rows: 4, size: 0.9, d0: 34 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 74, z: 1 });
      // The braziers, and the hall's own fires out in the bays.
      const flames = [brazier(p, gx - 38 * u, far + 4 * u, u, 4, 12), brazier(p, gx + 38 * u, far + 4 * u, u, 4, 12)];
      for (let d = 107; gx + d * u < W + 10 * u; d += 66) flames.push(brazier(p, gx - d * u, far + 1 * u, u * 0.85, 3, 10), brazier(p, gx + d * u, far + 1 * u, u * 0.85, 3, 10));
      const chEdge = (m) => (y) => { const t = (y - far - 3 * u) / (H - far); const c = gx + m * (24 + t * 30) * u; const w = (3 + t * 7) * u; return [c - w, c + w]; };
      for (const m of [-1, 1]) {
        const e = chEdge(m);
        channel(p, far + 4 * u, H + 1, e, 2, u);
      }
      // Roots come down through the vault.
      for (const [d, l, w] of [[-52, 40, 3.6], [50, 30, 3], [-128, 34, 3.4], [124, 46, 4], [-190, 26, 3], [196, 36, 3.4]]) {
        if (gx + d * u < -8 * u || gx + d * u > W + 8 * u) continue;
        hangingRoot(p, gx + d * u, 0, l * u, w * u, 5, 2.8, d, u);
      }
      const fy = 94 * u;
      if (open) {
        p.light(gx, 56 * u, 40 * u, 3.6, flicker(0.2, 0.06, 0.4), { zMin: 2, zMax: 4, sy: 0.9 });
        p.shade(C.ellipse(gx, fy - 4 * u, 34 * u, 15 * u, 32), (x, y) => { const d = Math.hypot((x + 0.5 - gx) / 34, (y + 0.5 - fy + 4 * u) / 15) / u; return d < 0.45 ? 3.2 : d < 0.75 ? 2 : 1; }, 1);
      }
      // The idol on its altar: gold, or the card's violet.
      const isItem = cat === 'item';
      const id = idol(p, gx, 45 * u, 26 * u, isItem ? ramp : 'gold', isItem ? 9 : 6, isItem ? { v: 2.2, hi: 1.6, lo: 1, gemV: 4.4 } : open ? { v: 2.6, hi: 1.6, lo: 1.4, gem: 'fire', gemV: 7 } : { v: 5.6, hi: 4, lo: 2.6, gem: 'fire', gemV: 7.4 });
      if (open) rimLight(p, 6, [[0, -1], [-1, 0], [1, 0]], 'path', 4.2, -99, [6, 7, 8]);
      // The card, on the causeway before the stair.
      if (cat === 'monster') {
        const e = serpent(p, gx + 3 * u, fy, 40 * u, ramp, 9, { sheen: ['fire', 4.6] });
        p.tint(e.ex, e.ey, 3 * u, hex, 0.35, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const l = guide(p, gx + 4 * u, fy, 34 * u, 9);
        rimLight(p, 9, [[-1, 0], [1, 0], [0, -1]], 'fire', 2.6);
        lantern(p, l.lx, l.ly, ramp, 11);
        p.tint(l.lx, l.ly + 2, 7 * u, CARD[ramp][4], 0.6, flicker(0.9, 0.15));
        p.tint(l.lx, l.ly + 2, 14 * u, hex, 0.25, flicker(0.9, 0.15));
      } else if (isItem) {
        p.tint(id.ex, id.ey, 5 * u, CARD[ramp][4], 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        rubble(p, gx, fy - 2 * u, 34 * u, 34 * u, ramp, 9, 'bv-rubble', u, 0.5);
      } else if (open) {
        p.tint(gx, 44 * u, 8 * u, CARD.path[4], 0.5, flicker(0.4, 0.06, 0.3));
      }
      // Lights: the fires, and the idol's own gleam.
      flames.forEach(([x, y], k) => fireLight(p, x, y - 3 * u, u, k < 2 ? 1 : 0.8, k * 1.7, 1, 8, clamp(1 - (Math.abs(x - gx) - 90 * u) / (140 * u), 0.3, 1)));
      p.light(gx, 34 * u, 24 * u, open ? 3 : 2.2, null, { zMin: 2, zMax: 3 });
      const wm = mirror(p, 0, W, far + 4 * u, H, far + 3 * u, { dim: 1.2, fall: 1.6, amp: 1, rip: 2.4 * u });
      vignette(p, W, H, 1.4, 0.42);
      p.shade(null, (x) => -2.6 * clamp((Math.abs(x + 0.5 - gx) - 90 * u) / (110 * u), 0, 1));
      return {
        p,
        over(img, t) {
          flames.forEach(([x, y], k) => { sprite(img, x, y, BIG_FLAME[Math.floor(t * 8 + k) % 3], FLAME); flameIn(img, wm, x, y, far + 3 * u, Math.floor(t * 8 + k + 1), 0.6); });
          for (const q of particles('ember', Math.round(W / 24), [0, 10 * u, W, far - 14 * u], t, 31)) put(img, q.x, q.y, q.big ? '#FDCF73' : '#B8661E', q.a * 0.85);
          if (open) for (const q of particles('mote', 18, [gx - 16 * u, 24 * u, 32 * u, fy - 24 * u], t, 33)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a);
          if (isItem) for (const q of particles('mote', 10, [gx - 10 * u, 18 * u, 20 * u, 30 * u], t, 35)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['fire'], dither: 0.26 });
      const u = H / 250; const gx = W / 2;
      p.fill(C.rect(0, 0, W, H), 'stone', 1.4, 1);
      p.floor(C.rect(0, 0, W, H), { vx: gx, vy: -90 * u, rows: 3.2, size: 1.1, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.25, vary: 0.8, chip: 0.04, seed: 81, z: 1 });
      // The channels, running down from the serpents' mouths under the vista, the fires above lying in them.
      const chEdge = (m) => (y) => { const t = y / H; const c = gx + m * (44 + t * 70) * u; const w = (9 + t * 16) * u; return [c - w, c + w]; };
      for (const m of [-1, 1]) {
        const e = chEdge(m);
        channel(p, 0, H + 1, e, 2, u, { rip: 3.2 * u, kerbV: 2.6 });
        for (let k = 0; k < 2; k += 1) { const [a0, b0] = e(H * 0.27); streak(p, (a0 + b0) / 2 + (k ? 5 : -4) * u * m, H * 0.27, H * 0.46, 2.6 * u, 1.9, 0.6, u); }
      }
      // The side walls: carved, a brazier at the foot of each.
      for (const side of [0, 1]) {
        const wall = C.rect(side ? W - 20 * u : 0, 0, 20 * u, H);
        p.fill(wall, 'stone', 1.2, 3);
        p.masonry(wall, { bw: 12 * u, bh: 7 * u, joint: -1, top: 0.4, vary: 0.7, chip: 0.04, z: 3, seed: 83 + side });
        frieze(p, side ? W - 20 * u : 0, side ? W : 20 * u, 40 * u, 9 * u, 3, 1.4, u, side);
      }
      // Roots creeping in across the floor from the sides.
      for (const [x0, y0, x1, y1, w, s] of [[0, 120, 70, 170, 5, 1], [W, 90, W - 60 * u, 150, 4, 2], [0, 200, 52, 238, 4, 3], [W, 210, W - 80 * u, 246, 5, 4]]) {
        const pts = bez([x0, y0 * u], [lerp(x0, x1, 0.6), y0 * u - 8 * u], [x1, y1 * u], 10);
        p.shade(ribbon(pts.map(([x, y]) => [x, y + 2 * u]), w * u * 1.3, w * u * 0.4), -1, 1);
        limb(p, pts, w * u, w * u * 0.3, 'bark', 1.8, 4, { lit: [0, -1], rim: 1.2, side: 1, seed: s });
      }
      // The fires: above the table, under the vista, and one at the foot of each wall.
      p.light(gx - 60 * u, -10 * u, 150 * u, 3, flicker(0.7, 0.08, 0.5), { sx: 1.2 });
      p.light(gx + 60 * u, -10 * u, 150 * u, 3, flicker(2.1, 0.08, 0.5), { sx: 1.2 });
      const side = [[22 * u, 56 * u], [W - 22 * u, 56 * u]];
      side.forEach(([x, y], k) => p.light(x, y, 60 * u, 4, flicker(k * 2.1, 0.2), { zMin: 1, hard: true }));
      p.shade(null, (x, y) => -2 * Math.max(0, y / H - 0.36));
      return {
        p,
        over(img, t) {
          side.forEach(([x, y], k) => sprite(img, Math.round(x), Math.round(y), BIG_FLAME[Math.floor(t * 8 + k) % 3], FLAME));
          for (const q of particles('ember', 18, [0, 0, W, H * 0.5], t, 87)) put(img, q.x, q.y, q.big ? '#B8661E' : '#5A2C0C', q.a * 0.8);
        },
      };
    },
  };


export default [A, B];

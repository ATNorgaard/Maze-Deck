/* The Mire: the swamp, outside only. */
import PX from '../px.js';

  const { C, Painter, put, particles, flicker, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];
  const smooth = (t) => t * t * (3 - 2 * t);
  /** Smooth noise, 0..1, in one and two dimensions. */
  const n1 = (x, s = 0) => { const i = Math.floor(x); return lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(x - i)); };
  const n2 = (x, y, s = 0) => {
    const i = Math.floor(x); const j = Math.floor(y); const fx = smooth(x - i); const fy = smooth(y - j);
    return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), fx), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), fx), fy);
  };

  /*
   * The marsh-light is teal-green (hue about 160), the Obstacle family's own,
   * kept well away from the Trap's acid yellow-green: no ramp here climbs
   * toward yellow. Wood and moss are grey with a cold green in them; the
   * planks a rotten brown that greys as it climbs into the light.
   */
  const RAMPS = {
    fog: ['#020405', '#040909', '#070E0E', '#0A1414', '#0E1B1A', '#132421', '#192E2A', '#203A34', '#284840', '#31574D', '#3C695C', '#4A7D6D', '#5B9481', '#72AD98', '#92C8B3', '#BBE2D2', '#E4F7EE'],
    water: ['#010203', '#020505', '#040808', '#060B0C', '#091010', '#0C1515', '#101C1B', '#152422'],
    wood: ['#020303', '#050707', '#090B0B', '#0D1110', '#121716', '#181E1C', '#1F2724', '#28312E', '#323D39', '#3F4B46', '#4E5D56', '#627269', '#7B8D83'],
    plank: ['#040404', '#0A0908', '#100E0D', '#171513', '#1E1C19', '#26241F', '#2E2C27', '#37352F', '#413F38', '#4C4B44', '#5A5C54', '#6B7068', '#80897F', '#9AA79C', '#BACAC0'],
    moss: ['#030505', '#070B0A', '#0C1210', '#121A17', '#18231F', '#1F2D28', '#283A33', '#324840', '#3E584E', '#4C6B5F', '#5E8273', '#769C8C'],
    pad: ['#020404', '#050908', '#09100E', '#0E1714', '#14201B', '#1B2A23', '#23362D', '#2D4438', '#3A5545', '#4C6A57'],
    shadow: ['#010202', '#030505', '#060908', '#0A0F0D'],
    wisp: ['#173A30', '#2C6655', '#4E9F86', '#86D7BC', '#C9F8E7', '#F4FFFB'],
    lamp: ['#1A3A33', '#3A7466', '#6FB8A4', '#B2EBDA', '#EEFFF8'],
    // The Clear Path's dawn, and the firm ground it lights: only there.
    dawn: ['#0B0907', '#17120B', '#251C10', '#382915', '#4F391A', '#6B4C1F', '#8A5E1E', '#B07A2C', '#D5963C', '#E3A445', '#F2CB8A', '#FBE2AE', '#FFF1C4'],
    earth: ['#030302', '#080705', '#0F0C08', '#17120C', '#211910', '#2D2214', '#3B2D18', '#4D3A1D', '#654B23', '#82602B', '#A57A36', '#CC9A48', '#E8BE6C'],
    ...CARD,
  };
  const WISP = ['#4E9F86', '#86D7BC', '#C9F8E7', '#F4FFFB'];

  /* Layers. Water is 0, so anything a light may touch is 1 and up. */
  const Z = { water: 0, sky: 1, far: 2, mid: 3, pad: 4, walk: 5, post: 6, near: 7, sub: 8, subD: 9, reed: 10 };

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }

  /** A field of added value weighed every frame: fn(x, y, i) → value, k(t) its weight. Emitting ramps are left alone. */
  function field(p, fn, k, rect) {
    const f = new Float32Array(p.w * p.h);
    const [x0, y0, x1, y1] = rect || [0, 0, p.w, p.h];
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(p.w, Math.ceil(x1)); x += 1) {
        const i = y * p.w + x;
        if (p.emit[p.r[i]]) continue;
        const v = fn(x, y, i);
        if (v) f[i] = v;
      }
    }
    if (k) p.fields.push({ f, k });
    else for (let i = 0; i < f.length; i += 1) p.v[i] += f[i];
  }

  /** One pixel wide, from one point to another. */
  function line(p, x0, y0, x1, y1, ramp, v, z, keep = -1) {
    const ri = p.ri(ramp); const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k += 1) {
      const x = Math.floor(lerp(x0, x1, k / n)); const y = Math.floor(lerp(y0, y1, k / n));
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const i = y * p.w + x;
      if (p.z[i] > keep && keep >= 0) continue;
      p.r[i] = ri; p.v[i] = typeof v === 'function' ? v(x, y) : v; p.z[i] = z;
    }
  }

  /** A tapered stroke along a centre line of [x, y, width] points, as one polygon. */
  function stroke(pts) {
    const L = []; const R = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; const ny = dx / len; const w = pts[i][2] / 2;
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    return C.poly([...L, ...R.reverse()]);
  }

  /** A smooth curve through control points (each [x, y, ...]), `n` steps between each pair. */
  function spline(pts, n) {
    const out = [];
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k += 1) {
        const t = k / n; const t2 = t * t; const t3 = t2 * t;
        out.push(p1.map((_, j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  /**
   * Edges that face a light at (lx, ly): pixels on layers z0..z1 whose
   * neighbour toward it lies behind them, brighter the nearer the light.
   */
  function rimToward(p, lx, ly, R, amt, z0, z1 = z0, sy = 1) {
    const W = p.w; const add = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const i = y * W + x; const z = p.z[i];
        if (z < z0 || z > z1 || p.emit[p.r[i]]) continue;
        const dx = lx - (x + 0.5); const dy = ly - (y + 0.5); const d = Math.hypot(dx, dy / sy);
        if (d > R) continue;
        const ax = Math.abs(dx); const ay = Math.abs(dy);
        const sx = ax > ay * 0.4 ? Math.sign(dx) : 0; const sgy = ay > ax * 0.4 ? Math.sign(dy) : 0;
        if ((sx && p.z[i + sx] < z) || (sgy && p.z[i + sgy * W] < z)) add.push(i, amt * (1 - d / R));
      }
    }
    for (let k = 0; k < add.length; k += 2) p.v[add[k]] += add[k + 1];
  }

  /**
   * Silhouettes against the fog: an edge pixel on layers z0..z1 that touches
   * the fog (the sky or the far shore) takes its value from the fog there,
   * so an edge glows as brightly as what is behind it. `to` moves the rim
   * onto another ramp (a black figure's rim onto the fog's).
   */
  function fogRim(p, z0, z1, k, o = {}) {
    const W = p.w; const hit = []; const min = o.min ?? 3; const to = o.to ? p.ri(o.to) : -1;
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const i = y * W + x; const z = p.z[i];
        if (z < z0 || z > z1 || p.emit[p.r[i]]) continue;
        if (o.keepThin) {
          const inn = (j) => p.z[j] >= z0 && p.z[j] <= z1;
          if ((!inn(i - 1) && !inn(i + 1)) || (!inn(i - W) && !inn(i + W))) continue;
        }
        let best = 0;
        for (const j of [i - 1, i + 1, i - W, i + W]) { const zj = p.z[j]; if ((zj === Z.sky || zj === Z.far || (o.water && zj === Z.water && j !== i + W)) && p.v[j] > best) best = p.v[j]; }
        if (best >= min) hit.push(i, best * k + (o.add ?? 0));
      }
    }
    for (let q = 0; q < hit.length; q += 2) {
      const i = hit[q];
      if (to >= 0) { p.r[i] = to; p.v[i] = hit[q + 1]; } else if (p.v[i] < hit[q + 1]) p.v[i] = hit[q + 1];
    }
  }

  /* ---------------- the fog, the far shore, the water ---------------- */

  /**
   * The fog over the water: near black overhead, paling toward the far
   * waterline, lit from within by the marsh-light (ellipses in `glows`) in
   * clean bands. Strata drawn out sideways bend the bands into banks of fog,
   * not rings. Returns the fog's value at a point, for what stands in it.
   */
  function fogSky(p, W, yh, u, glows, o = {}) {
    const fi = p.ri('fog'); const di = p.ri('dawn'); const seed = o.seed || 1;
    const at = (x, y) => {
      const base = (o.top ?? 0.6) + (o.rise ?? 2.4) * clamp(y / yh, 0, 1) ** 1.8;
      let g = 0;
      for (const L of glows) {
        const d = Math.hypot((x + 0.5 - L.x) / L.rx, (y + 0.5 - L.y) / L.ry);
        if (d < 1) g += L.k * (1 - d) ** (L.pow ?? 1.6);
      }
      const st = (n2(x / (40 * u), y / (3 * u), seed) - 0.5) * (0.8 + g * 0.12) + (n2(x / (16 * u), y / (2 * u), seed + 3) - 0.5) * 0.25;
      return [Math.round(base + g + st), g];
    };
    for (let y = 0; y < Math.ceil(yh); y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x; const [v, g] = at(x, y);
        const dw = o.dawn ? Math.hypot((x + 0.5 - o.dawn.x) / o.dawn.rx, (y + 0.5 - o.dawn.y) / o.dawn.ry) : 2;
        if (dw < 1) { p.r[i] = di; p.v[i] = Math.round(1.6 + o.dawn.k * (1 - dw) ** 0.8 + (v - g - 3) * 0.9); } else { p.r[i] = fi; p.v[i] = v; }
        p.z[i] = Z.sky;
      }
    }
    return (x, y) => {
      if (o.dawn && Math.hypot((x + 0.5 - o.dawn.x) / o.dawn.rx, (y + 0.5 - o.dawn.y) / o.dawn.ry) < 1) return 3;
      return at(x, y)[0];
    };
  }

  /**
   * The far shore, in the fog: a ragged line of scrub along the water, and
   * the thin ghosts of dead trees standing out of it. Each is the fog
   * itself made darker, so they fade where the fog is dark and stand out
   * black where it glows. Two depths, the nearer darker.
   */
  function farShore(p, W, yh, u, fogAt, o) {
    const seed = o.seed || 5;
    for (const [k, kk, gap, hMin, hMax, dy] of [[0.62, 0.55, 14, 6, 22, 0], [0.42, 0.35, 22, 10, 34, 1.2]]) {
      const mask = new Uint8Array(p.w * p.h);
      const set = (x, y) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < p.w && y < yh + dy * u) mask[y * p.w + x] = 1; };
      for (let x = 0; x < W; x += 1) {
        const top = yh + dy * u - (1 + n1(x / (7 * u), seed + kk * 10) * 2.6 + (n1(x / (31 * u), seed + 2) > 0.6 ? 2.4 : 0)) * u * (1 + kk);
        for (let y = Math.floor(top); y < yh + dy * u; y += 1) set(x, y);
        if (hash(x, 7, seed + kk * 9) < 0.18) for (let y = Math.floor(top - (1 + hash(x, 8, seed) * 3) * u); y < top; y += 1) set(x, y); // reeds
      }
      const r = rng(seed * 31 + Math.round(kk * 100));
      for (let x = r() * gap * u; x < W; x += (gap * 0.4 + r() * gap) * u) {
        const h = (hMin + r() ** 2 * (hMax - hMin)) * u; const lean = (r() - 0.5) * 0.12; const b = yh + dy * u;
        if (o.clear && Math.abs(x - o.clear[0]) < o.clear[1]) continue;
        const tw = h > 22 * u ? 2 : 1;
        for (let y = 0; y < h; y += 1) for (let w = 0; w < tw + (y < 2.5 * u ? 1 : 0) + (y < 1 * u ? 1 : 0); w += 1) set(x + lean * y + w - (y < 1 * u ? 1 : 0), b - y);
        // Limbs forking up and out, like a hand; twigs off them.
        const nb = 2 + Math.floor(r() * 3);
        for (let j = 0; j < nb; j += 1) {
          const t = 0.5 + r() * 0.42; const s = j % 2 ? 1 : -1; const L = (0.2 + r() * 0.3) * h;
          const ax = x + lean * h * t; const ay = b - h * t; const sl = 0.35 + r() * 0.5;
          for (let q = 0; q < L; q += 0.6) set(ax + s * q * sl, ay - q);
          if (r() < 0.6) { const q0 = L * (0.4 + r() * 0.3); for (let q = 0; q < L * 0.4; q += 0.6) set(ax + s * q0 * sl + s * q * 0.9, ay - q0 - q * 0.6); }
        }
      }
      for (let i = 0; i < mask.length; i += 1) {
        if (!mask[i]) continue;
        const x = i % p.w; const y = (i - x) / p.w;
        p.r[i] = p.ri('fog'); p.v[i] = Math.round(fogAt(x, Math.min(y, yh - 1)) * k); p.z[i] = Z.far;
      }
    }
  }

  /**
   * A tree further off, in the fog: drawn whole (moss and all), then made of
   * the fog itself at `k` of its brightness, so the further it stands the
   * more it fades, and it is black only where the fog behind it glows.
   */
  function ghostTree(p, o, fogAt, k, yh) {
    const TMP = 15;
    const t = deadTree(p, { ...o, z: TMP });
    if (o.moss) moss(p, t.limbs, { u: o.u, z: TMP, seed: o.seed + 1, len: o.moss, skip: 0.45 });
    const fi = p.ri('fog');
    for (let i = 0; i < p.z.length; i += 1) {
      if (p.z[i] !== TMP) continue;
      const x = i % p.w; const y = (i - x) / p.w;
      p.r[i] = fi; p.v[i] = Math.round(fogAt(x, Math.min(y, yh - 1)) * k); p.z[i] = Z.far;
    }
  }

  /** A low bank of fog lying along the far shore, in front of it: the trees' feet are lost in it. */
  function fogBank(p, W, yh, u, fogAt, seed, h = 6) {
    for (let x = 0; x < W; x += 1) {
      const top = yh - (h * 0.4 + n1(x / (24 * u), seed) * h) * u;
      for (let y = Math.max(0, Math.floor(top)); y < Math.ceil(yh); y += 1) {
        const i = y * W + x;
        if (p.z[i] !== Z.far) continue;
        p.v[i] = Math.round(lerp(p.v[i], fogAt(x, y), 0.55 + 0.4 * (y - top) / (yh - top)));
      }
    }
  }

  /**
   * The water mirrors what stands on it. Each water pixel below `base`
   * takes the pixel as far above `base` (if it is on one of the layers
   * `zs`), darker, and darker still with distance; each row is nudged
   * sideways by the ripples, and broken into dashes where they turn away.
   */
  function mirror(p, o) {
    const { base, u, zs } = o; const seed = o.seed ?? 1; const W = p.w;
    const x0 = Math.max(0, Math.floor(o.x0 ?? 0)); const x1 = Math.min(W, Math.ceil(o.x1 ?? W));
    const y1 = Math.min(p.h, Math.ceil(o.y1 ?? p.h));
    const dim = o.dim ?? 1.6; const fade = o.fade ?? 0.035; const gap = o.gap ?? 0.3; const dash = (o.dash ?? 7) * u;
    for (let y = Math.max(0, Math.ceil(base)); y < y1; y += 1) {
      const d = y + 0.5 - base;
      const ys = Math.floor(base - d * (o.sq ?? 1));
      if (ys < 0) break;
      const amp = Math.min(o.ampMax ?? 1.6, 0.4 + (d / u) * (o.amp ?? 0.05));
      const rowOff = Math.sin(y * 2.3 + seed) * amp + (hash(y, 1, seed) - 0.5) * amp;
      for (let x = x0; x < x1; x += 1) {
        const i = y * W + x;
        if (p.z[i] !== Z.water) continue;
        const xs = clamp(Math.round(x + rowOff), 0, W - 1);
        const j = ys * W + xs;
        if (!zs.includes(p.z[j])) continue;
        const m = n2(x / (dash * (1 + d / (40 * u))), y * 0.8 + seed * 3, seed);
        if (m < gap) continue;
        p.r[i] = p.r[j];
        p.v[i] = p.v[j] - dim - (d / u) * fade - (m < gap + 0.1 ? 0.9 : 0);
      }
    }
  }

  /** The ripples moving: two sets of short bright dashes on the lit reflections, handing over to each other. */
  function shimmer(p, y0, y1, u, seed, s = 0.9) {
    const mk = (o) => (x, y, i) => (p.z[i] === Z.water && p.v[i] > 3.4 && n2(x / (2.6 * u), y * 0.9 + o, seed + o) > 0.76 ? s * Math.min(1, (p.v[i] - 3.4) / 3) : 0);
    field(p, mk(0), (t) => 0.5 + 0.5 * Math.sin(t * 1.6), [0, y0, p.w, y1]);
    field(p, mk(17), (t) => 0.5 - 0.5 * Math.sin(t * 1.6), [0, y0, p.w, y1]);
  }

  /* ---------------- trees, moss, huts ---------------- */

  /**
   * A dead cypress standing in the water: a trunk swollen at its foot,
   * tapering to a snapped top, a few crooked limbs reaching out and up with
   * twigs off them, knees standing out of the water round its foot.
   * Returns its limbs, for the moss.
   */
  function deadTree(p, o) {
    const { x, by, h, u, z, seed } = o; const r = rng(seed);
    const ramp = o.ramp || 'wood'; const v = o.v ?? 1.1;
    const lean = o.lean ?? 0; const wB = Math.max(2, (o.w ?? 0.1) * h); const wT = Math.max(1.4, wB * 0.3);
    const n = 10; const trunk = [];
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const tx = x + lean * h * t + (n1(t * 3.2, seed) - 0.5) * h * 0.08;
      let w = lerp(wB, wT, t ** 0.65);
      if (t < 0.16) w *= 1 + ((0.16 - t) / 0.16) ** 1.6 * 1.1; // the swollen foot
      trunk.push([tx, by - h * t, w]);
    }
    p.fill(stroke(trunk), ramp, v, z);
    // Buttresses, flaring into the water.
    for (const m of [-1, 1]) p.fill(C.poly([[x + m * wB * 0.2, by - h * 0.14], [x + m * wB * 1.25, by + 0.5], [x + m * wB * 0.5, by + 0.5]]), ramp, v, z);
    // The snapped top: a splinter or two.
    const [tx, ty] = trunk[n];
    p.fill(C.poly([[tx - wT / 2, ty + 1], [tx - wT * 0.4, ty - (1 + r() * 3) * u], [tx - wT * 0.05, ty - 0.5 * u], [tx + wT * 0.2, ty - (2 + r() * 5) * u], [tx + wT / 2, ty + 1]]), ramp, v, z);
    const limbs = [];
    const nb = o.limbs ?? (3 + Math.floor(r() * 3));
    for (let b = 0; b < nb; b += 1) {
      const t = (o.from ?? 0.4) + (b / nb) * (0.92 - (o.from ?? 0.4)) + r() * 0.06;
      const side = (b % 2 ? 1 : -1) * (o.flip ? -1 : 1) * (o.side && b === nb - 1 ? -1 : 1);
      const k = Math.min(n - 1, Math.floor(t * n)); const f = t * n - k;
      const ax = lerp(trunk[k][0], trunk[k + 1][0], f); const ay = by - h * t;
      const ang = (0.15 + r() * 0.55) * Math.PI / 2;
      const L = h * (0.16 + r() * 0.2) * (o.reach ?? 1) * (1.15 - t * 0.4);
      const droop = r() < 0.3;
      const mx = ax + side * L * 0.5 * Math.cos(ang * 0.5); const my = ay - L * 0.5 * Math.sin(ang * 0.5);
      const ex = ax + side * L * Math.cos(ang); const ey = ay - L * Math.sin(ang) + (droop ? L * 0.45 : 0);
      const w0 = Math.max(1.2, lerp(wB, wT, t) * 0.55);
      if (w0 > 1.7) p.fill(stroke([[ax, ay, w0], [mx, my, Math.max(1.3, w0 * 0.6)], [ex, ey, 1]]), ramp, v, z);
      line(p, ax, ay, mx, my, ramp, v, z); line(p, mx, my, ex, ey, ramp, v, z);
      limbs.push([ax, ay, mx, my], [mx, my, ex, ey]);
      // Twigs off it, bent.
      const nt = 1 + Math.floor(r() * 2.5);
      for (let j = 0; j < nt; j += 1) {
        const q = 0.4 + r() * 0.55; const sx = lerp(mx, ex, q); const sy = lerp(my, ey, q);
        const tl = L * (0.2 + r() * 0.3); const ta = ang + (r() < 0.5 ? 0.6 : -0.4);
        const qx = sx + side * tl * Math.cos(ta) * 0.6; const qy = sy - tl * Math.max(0.2, Math.sin(ta));
        line(p, sx, sy, qx, qy, ramp, v, z);
        limbs.push([sx, sy, qx, qy]);
      }
    }
    // Knees: short stumps of root standing out of the water round its foot.
    for (let j = 0; j < (o.knees ?? 2); j += 1) {
      const kx = x + (r() < 0.5 ? -1 : 1) * wB * (1.3 + r() * 1.4); const kh = (1.5 + r() * 2.5) * u * (h / (60 * u)) + 1;
      p.fill(C.poly([[kx - 1.2 * u, by + 1], [kx - 0.3, by - kh], [kx + 0.6, by - kh + 0.6], [kx + 1.2 * u, by + 1]]), ramp, v, z);
    }
    return { limbs, top: [tx, ty], x0: x - wB * 1.5 - (o.reach ?? 1) * h * 0.4, x1: x + wB * 1.5 + (o.reach ?? 1) * h * 0.4 };
  }

  /** Moss hanging off limbs in beards: tongues tapering down, streaked, each its own length. */
  function moss(p, limbs, o) {
    const { u, z, seed } = o; const len = o.len ?? 10; const MS = p.ri('moss');
    let k = 0;
    for (const [x0, y0, x1, y1] of limbs) {
      const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.floor(L / ((o.every ?? 2.4) * u)));
      for (let j = 1; j <= n; j += 1) {
        k += 1;
        if (hash(k, 1, seed) < (o.skip ?? 0.4)) continue;
        const t = j / (n + 1); const bx = lerp(x0, x1, t); const byy = lerp(y0, y1, t);
        const ll = Math.max(2, len * u * (0.25 + hash(k, 2, seed) * 0.9));
        const hw = (0.4 + hash(k, 3, seed) * 1.1) * u;
        for (let dy = 0; dy < ll; dy += 1) {
          const w = hw * (1 - dy / ll) ** 0.6;
          const sway = Math.sin(dy * 0.3 + k) * 0.6 * u;
          for (let dx = -Math.round(w); dx <= Math.round(w); dx += 1) {
            const X = Math.round(bx + dx + sway); const Y = Math.round(byy + dy);
            if (X < 0 || Y < 0 || X >= p.w || Y >= p.h) continue;
            if (dy > ll * 0.45 && hash(X, Y, seed) < 0.35) continue;
            const i = Y * p.w + X;
            if (p.z[i] > z) continue;
            p.r[i] = MS; p.v[i] = (o.v ?? 1.4) + ((X + k) % 2 ? 0.45 : -0.2) - (dy / ll) * 0.6; p.z[i] = z;
          }
        }
      }
    }
  }

  /**
   * A hut on stilts over the water: a deck on crooked poles, walls of
   * upright boards, a sagging thatched roof, a crooked stovepipe, the door
   * dark, and one lantern lit under the eave (or none, for a dead one).
   */
  function hut(p, o) {
    const { x, by, u, z, seed } = o; const s = o.s ?? 1; const r = rng(seed);
    const w = 22 * u * s; const deckY = by - 9 * u * s; const wallTop = deckY - 11 * u * s; const roofTop = wallTop - 9 * u * s;
    const tilt = (o.tilt ?? 0) * u * s;
    // The stilts, each its own lean, and a brace across them.
    for (const k of [-0.46, -0.16, 0.18, 0.47]) {
      const sx = x + k * w; const lean = (r() - 0.5) * 2 * u * s;
      p.fill(stroke([[sx + lean, by + 1, 1.6 * u * s + 0.4], [sx, deckY, 1.4 * u * s + 0.4]]), 'wood', 1.0, z);
    }
    line(p, x - 0.46 * w, by - 3 * u * s, x + 0.18 * w, deckY + 1, 'wood', 1.2, z);
    // The deck and its edge.
    p.fill(C.poly([[x - w * 0.6, deckY + tilt * 0.6], [x + w * 0.62, deckY - tilt * 0.6], [x + w * 0.62, deckY + 2 * u * s - tilt * 0.6], [x - w * 0.6, deckY + 2 * u * s + tilt * 0.6]]), 'plank', 2.0, z);
    // The walls, upright boards.
    const wall = C.poly([[x - w / 2, deckY + tilt * 0.5], [x - w / 2, wallTop + tilt * 0.5], [x + w / 2, wallTop - tilt * 0.5], [x + w / 2, deckY - tilt * 0.5]]);
    p.fill(wall, 'plank', (px) => 1.5 + (Math.floor(px / Math.max(2, 2.6 * u * s)) % 2 ? 0.3 : -0.2) + (hash(Math.floor(px / Math.max(2, 2.6 * u * s)), 0, seed) - 0.5) * 0.6, z);
    // The door, dark, and a shuttered window.
    p.fill(C.rect(x - w * 0.3, deckY - 8 * u * s, 4.4 * u * s, 8 * u * s), 'shadow', 0.3, z);
    p.fill(C.rect(x + w * 0.08, wallTop + 3 * u * s, 4 * u * s, 3 * u * s), 'shadow', 0.6, z);
    // The roof, sagging in the middle, its thatch ragged at the eave.
    const eL = x - w * 0.72; const eR = x + w * 0.7;
    const roof = [];
    for (let k = 0; k <= 12; k += 1) {
      const t = k / 12; const rx = lerp(eL, eR, t);
      const ridge = t < 0.45 ? lerp(wallTop + 2 * u * s, roofTop, t / 0.45) : lerp(roofTop, wallTop + 1.4 * u * s, (t - 0.45) / 0.55);
      roof.push([rx, ridge + Math.sin(t * Math.PI) * 0.8 * u * s + (hash(k, 3, seed) - 0.5) * u * s - (t - 0.5) * tilt]);
    }
    const eave = [];
    for (let k = 0; k <= 16; k += 1) { const t = k / 16; eave.push([lerp(eR, eL, t), wallTop + (2.6 + hash(k, 4, seed) * 2) * u * s + (t - 0.5) * tilt]); }
    p.fill(C.poly([...roof, ...eave]), 'moss', (px, py) => 1.6 + ((px + py * 0.6) % (2.5 * u * s) < 1 ? -0.6 : 0.2), z);
    // The stovepipe, crooked.
    const sp = x + w * 0.28;
    p.fill(stroke([[sp, roofTop + 4 * u * s, 1.8 * u * s], [sp + 0.6 * u * s, roofTop - 3 * u * s, 1.6 * u * s], [sp + 1.8 * u * s, roofTop - 5 * u * s, 1.6 * u * s]]), 'wood', 1.4, z);
    // The lantern, hung on a bracket under the eave.
    let lamp = null;
    if (o.lit !== false) {
      const lx = Math.round(x + w * 0.62); const ly = Math.round(wallTop + 6 * u * s);
      line(p, x + w * 0.5, wallTop + 2.4 * u * s, lx, wallTop + 2.4 * u * s, 'wood', 1.6, z);
      line(p, lx, wallTop + 2.4 * u * s, lx, ly - 2, 'wood', 1.6, z);
      const lw = o.lampW ?? 3; const l0 = lx - (lw >> 1);
      p.fill(C.rect(l0, ly - 2, lw, 1), 'wood', 2.4, z);
      p.fill(C.rect(l0, ly - 1, lw, Math.max(2, Math.round(2.6 * u * s))), 'lamp', lw > 1 ? 3.4 : 2.6, z + 1);
      if (lw > 1) p.fill(C.rect(lx, ly - 1, 1, Math.max(2, Math.round(2.6 * u * s))), 'lamp', 4, z + 1);
      lamp = [lx + 0.5, ly + 0.5];
    }
    return { lamp, x0: eL - 2 * u, x1: eR + 4 * u, top: roofTop - 6 * u * s, base: by };
  }

  /* ---------------- the causeway ---------------- */

  /**
   * The causeway: a boardwalk of rotting planks lying on the water, seen
   * from just above it. D is how near a row is (1 at y1, 0 at the far
   * waterline yh); the walk's middle runs along cx(D) and its half-width
   * there is hw * D. The planks cross it, spaced on a log scale so the far
   * ones still read; some are gone, some slipped sideways, some drowned.
   * Returns its posts.
   */
  function causeway(p, o) {
    const { yh, y1, u, seed } = o; const span = y1 - yh; const W = p.w;
    const P = p.ri('plank'); const S = p.ri('shadow');
    const kq = o.kq ?? 13; const dFar = o.dFar;
    // True perspective: a board's depth is constant, so its height on screen
    // falls with the square of its distance and the far planks close up into
    // one strip, which keeps the walk flat on the water, not a stair.
    for (let y = Math.max(0, Math.floor(yh + dFar * span)); y < p.h; y += 1) {
      const D = (y + 0.5 - yh) / span;
      if (D < dFar) continue;
      if (o.cut && o.cut(D)) continue;
      const c = o.cx(D); const h = o.hw * D;
      const bpx = (span * D * D) / kq; // a board's height here, in pixels
      for (let x = Math.max(0, Math.floor(c - h * 1.3)); x <= Math.min(W - 1, Math.ceil(c + h * 1.3)); x += 1) {
        // Each board lies a little askew.
        const b0 = Math.floor(-kq / D);
        const skew = (hash(b0, 9, seed) - 0.5) * 0.09 * (x + 0.5 - c);
        const Ds = (y + 0.5 + skew - yh) / span;
        const bF = -kq / Ds; const b = Math.floor(bF); const f = bF - b;
        if (D > dFar + 0.05 && hash(b, 2, seed) < (o.missing ?? 0.1)) continue; // gone: the water shows
        const drowned = hash(b, 3, seed) < (o.drowned ?? 0.15);
        const slip = (hash(b, 7, seed) - 0.5) * 0.2 * h;
        const eL = h * (0.84 + hash(b, 5, seed) * 0.24); const eR = h * (0.84 + hash(b, 6, seed) * 0.24);
        const lx = x + 0.5 - c - slip;
        if (lx < -eL || lx > eR) continue;
        const i = y * W + x;
        if (bpx >= 2.6 && f * bpx < 1) { p.r[i] = S; p.v[i] = 0.2; p.z[i] = o.z; continue; } // the gap, water under it
        const vary = Math.min(1, bpx / 2);
        let v = (o.v ?? 2.4) + (hash(b, 4, seed) - 0.5) * 1.2 * vary - (drowned ? 1.4 : 0) - (o.fadeNear ?? 0.8) * D;
        // The grain: a long streak along the board; where two planks meet end to end, a seam; now and then a knot.
        if (bpx >= 4 && Math.abs(f - (0.45 + hash(b, 14, seed) * 0.3)) * bpx < 0.5 && hash(Math.floor((x - c) / (14 * u) + hash(b, 15, seed) * 3), b, seed + 9) < 0.55) v -= 0.45;
        if (o.seams && bpx >= 2) { const s1 = (hash(b, 13, seed) - 0.5) * 1.3 * h; if (Math.abs(lx - s1) < 0.6 || Math.abs(lx - s1 - (s1 < 0 ? 0.95 : -0.95) * h) < 0.6) v -= 1.4; }
        if (bpx >= 2 && hash(x, y, seed + 11) < 0.006) v -= 0.9;
        if (lx < -eL + 1 || lx > eR - 1) v -= 0.6;                        // rotten ends
        p.r[i] = P; p.v[i] = v; p.z[i] = o.z;
      }
    }
    // Posts, leaning, along both sides; ropes slung between some.
    const posts = [];
    const r = rng(seed * 7 + 3);
    for (let D = dFar + 0.04; D < 1.25; D *= 1 + (o.postStep ?? 0.22)) {
      if (o.cut && o.cut(D)) continue;
      for (const s of [-1, 1]) {
        if (r() < 0.25) continue;
        const y = yh + D * span; const c = o.cx(D); const h = o.hw * D;
        const px = c + s * h * 1.02; const ph = (5 + r() * 7) * u * D * (o.postH ?? 1.6); const pw = Math.max(1, Math.round(1.6 * u * D * (o.postW ?? 1.6)));
        const lean = (r() - 0.5) * ph * 0.35;
        const top = y - ph;
        p.fill(C.poly([[px - pw / 2, y + 1], [px + pw / 2, y + 1], [px + pw / 2 + lean, top], [px - pw / 2 + lean, top + 0.6]]), 'wood', 1.4, Z.post);
        posts.push({ x: px, y, top, lean, pw, s, D });
      }
    }
    if (o.rope) {
      for (const s of [-1, 1]) {
        const ps = posts.filter((q) => q.s === s).sort((a, b) => a.D - b.D);
        for (let k = 0; k + 1 < ps.length; k += 1) {
          const a = ps[k]; const b = ps[k + 1];
          if (hash(k, s + 3, seed) < 0.35) continue;
          const ax = a.x + a.lean * 0.9; const ay = a.top + 1; const bx = b.x + b.lean * 0.9; const by = b.top + 1;
          const n = Math.max(2, Math.ceil(Math.abs(bx - ax) + Math.abs(by - ay)));
          for (let j = 0; j <= n; j += 1) {
            const t = j / n; const X = Math.floor(lerp(ax, bx, t)); const Y = Math.floor(lerp(ay, by, t) + Math.sin(t * Math.PI) * Math.abs(by - ay) * 0.35 + Math.sin(t * Math.PI) * 1.5 * u * b.D);
            if (X < 0 || Y < 0 || X >= W || Y >= p.h) continue;
            const i = Y * W + X; if (p.z[i] > Z.post) continue;
            p.r[i] = p.ri('wood'); p.v[i] = 1.6; p.z[i] = Z.post;
          }
        }
      }
    }
    return posts;
  }

  /* ---------------- things on the water ---------------- */

  /** Lily pads, flat on the water in perspective: a round leaf with its notch, a lit far rim; a few with a pale flower. */
  function lilies(p, list, u, seed) {
    const PD = p.ri('pad');
    list.forEach(([x, y, rx, v], k) => {
      const ry = Math.max(1, rx * 0.34); const a0 = hash(k, 1, seed) * Math.PI * 2;
      p.each(C.ellipse(x, y, rx, ry, 16), (px, py, i) => {
        if (p.z[i] !== Z.water) return;
        const a = Math.atan2((py + 0.5 - y) / ry, (px + 0.5 - x) / rx);
        let da = Math.abs(((a - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da > Math.PI - 0.35) return; // the notch
        const e = Math.hypot((px + 0.5 - x) / rx, (py + 0.5 - y) / ry);
        const far = (py + 0.5 - y) / ry < -0.3 && e > 0.7;
        p.r[i] = PD; p.v[i] = v + (far ? 0.8 : 0) - (e < 0.5 ? 0.3 : 0) + (hash(px, py, seed) < 0.1 ? -0.5 : 0); p.z[i] = Z.pad;
      });
      if (hash(k, 2, seed) < 0.18 && rx > 3) p.fill(C.rect(Math.round(x + rx * 0.2), Math.round(y - ry * 0.4), 1, 1), 'fog', 9, Z.pad);
    });
  }

  /** A clump of reeds and bulrushes: blades leaning and bending, some with a dark head. */
  function reeds(p, bx, by, u, o) {
    const r = rng(o.seed); const n = o.n ?? 8; const tips = [];
    for (let k = 0; k < n; k += 1) {
      const x0 = bx + (r() - 0.5) * (o.w ?? 6) * u; const h = (o.h ?? 18) * u * (0.45 + r() * 0.75);
      const lean = (r() - 0.5) * 0.5 + (o.lean ?? 0); const bend = (r() - 0.5) * 0.5;
      let px = x0; let py = by;
      const steps = Math.ceil(h);
      for (let s = 0; s < steps; s += 1) {
        const t = s / steps;
        const x = x0 + (lean * t + bend * t * t) * h; const y = by - t * h;
        const X = Math.floor(x); const Y = Math.floor(y);
        if (X >= 0 && Y >= 0 && X < p.w && Y < p.h) { const i = Y * p.w + X; p.r[i] = p.ri('moss'); p.v[i] = (o.v ?? 0.9) + t * 0.6; p.z[i] = o.z ?? Z.reed; }
        if (t < 0.3 && (o.thick ?? true) && X + 1 < p.w && Y < p.h && Y >= 0) { const i = Y * p.w + X + 1; p.r[i] = p.ri('moss'); p.v[i] = (o.v ?? 0.9) - 0.3; p.z[i] = o.z ?? Z.reed; }
        px = x; py = y;
      }
      tips.push([px, py]);
      if (r() < (o.heads ?? 0.3)) {
        const hl = Math.max(2, Math.round(2.6 * u)); const X = Math.floor(px - (lean + bend) * 2 * u);
        p.fill(C.rect(X, Math.floor(py + 2 * u), Math.max(1, Math.round(1.4 * u)), hl), 'plank', 1.8, o.z ?? Z.reed);
      }
    }
    return tips;
  }

  /** Eyes just above the waterline: the dark hump of a head, two glints, and their glints again in the water. */
  function eyes(p, x, y, u, z = Z.pad) {
    p.fill(C.ellipse(x, y, 3.2 * u, 1.1 * u + 0.4, 12), 'shadow', 0.5, z);
    p.fill(C.rect(Math.round(x - 2.2 * u), Math.round(y - 1.1 * u - 0.4), Math.round(4.4 * u), 1), 'wood', 2.6, z);
    return [[Math.round(x - 1.4 * u), Math.round(y - 0.6 * u)], [Math.round(x + 1.4 * u), Math.round(y - 0.6 * u)]];
  }

  /* ---------------- what the card becomes ---------------- */

  /**
   * Something long, rising out of the water: a neck as thick as a tree
   * curving up and over into a long-jawed head, a crest of spines down its
   * back, two coils of its body breaking the surface behind it. Black,
   * to be rimmed by the light behind it; its eyes the card's colour.
   */
  function serpent(p, cx, wy, s, ramp, z) {
    const P = (x, y) => [cx + x * s, wy + y * s];
    const spine = spline([[0, 0.08, 0.2], [0.05, -0.2, 0.17], [0.12, -0.42, 0.15], [0.12, -0.6, 0.135], [0.05, -0.73, 0.125], [-0.04, -0.79, 0.12]], 5)
      .map(([x, y, w]) => [cx + x * s, wy + y * s, w * s]);
    p.fill(stroke(spine), 'shadow', 0.4, z);
    // The skull and upper jaw, long and low; the lower jaw dropped open, the light showing between.
    p.fill(C.poly([P(0.05, -0.86), P(-0.04, -0.91), P(-0.18, -0.905), P(-0.32, -0.87), P(-0.44, -0.82), P(-0.46, -0.795), P(-0.3, -0.785), P(-0.14, -0.775), P(-0.02, -0.74), P(0.06, -0.76)]), 'shadow', 0.4, z);
    p.fill(C.poly([P(-0.04, -0.76), P(-0.18, -0.725), P(-0.32, -0.67), P(-0.37, -0.645), P(-0.33, -0.635), P(-0.2, -0.665), P(-0.02, -0.7)]), 'shadow', 0.4, z);
    // Teeth down from the upper jaw, up from the lower.
    for (let k = 0; k < 5; k += 1) {
      const [tx, ty] = P(-0.17 - k * 0.055, -0.78 + k * 0.004);
      p.fill(C.rect(Math.round(tx), Math.round(ty), 1, Math.max(1, Math.round(s * 0.03))), 'shadow', 0.4, z);
      const [bx, by] = P(-0.15 - k * 0.04, -0.72 + k * 0.016);
      if (k % 2 === 0) p.fill(C.rect(Math.round(bx), Math.round(by) - Math.max(1, Math.round(s * 0.025)), 1, Math.max(1, Math.round(s * 0.025))), 'shadow', 0.4, z);
    }
    // A crest of spines down the back of the neck, and swept back off the skull.
    for (let k = 2; k < spine.length - 3; k += 3) {
      const a = spine[k - 1]; const b = spine[k + 1]; const [x, y, w] = spine[k];
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L; const ny = dx / L; const tx = dx / L; const ty = dy / L;
      const sl = s * (0.05 + 0.03 * Math.sin(k)); const ox = x + nx * w * 0.45; const oy = y + ny * w * 0.45;
      p.fill(C.poly([[ox - tx * s * 0.03, oy - ty * s * 0.03], [ox + tx * s * 0.03, oy + ty * s * 0.03], [ox + nx * sl - tx * s * 0.04, oy + ny * sl - ty * s * 0.04]]), 'shadow', 0.4, z);
    }
    for (const [ax, ay, bx, by] of [[-0.02, -0.89, 0.14, -0.99], [0.03, -0.86, 0.19, -0.9], [-0.08, -0.9, 0.04, -1.04]]) {
      p.fill(C.poly([P(ax - 0.03, ay + 0.02), P(ax + 0.04, ay - 0.01), P(bx, by)]), 'shadow', 0.4, z);
    }
    // Coils of its body breaking the water behind it.
    for (const [dx, rr] of [[0.38, 0.12], [0.66, 0.085]]) {
      const ccx = cx + dx * s; const ccy = wy + 0.03 * s;
      p.fill(C.join(C.circle(ccx, ccy, rr * s, 24), C.circle(ccx, ccy, rr * s * 0.42, 16)), 'shadow', (x, y) => (y < wy ? 0.4 : null), z);
    }
    // The eyes.
    const [ex, ey] = P(-0.13, -0.85);
    p.fill(C.rect(Math.round(ex) - 1, Math.round(ey), 2, 1), ramp, 3, z + 1);
    return { ex, ey };
  }

  /**
   * The witch: bent under a wide-brimmed hat whose tall crown has slumped
   * over at the tip, her shawl and skirts down to the planks, a hooked nose
   * out under the brim, and her crooked staff out in front with the lantern
   * swinging from its crook. Returns where the lantern hangs.
   */
  function witch(p, cx, fy, s, z) {
    const P = (x, y) => [cx + x * s, fy + y * s];
    // Skirts and shawl, hunched forward toward the staff.
    p.fill(C.poly([P(-0.24, 0), P(-0.2, -0.22), P(-0.18, -0.42), P(-0.16, -0.55), P(-0.1, -0.64), P(0.0, -0.69), P(0.1, -0.67), P(0.17, -0.58), P(0.2, -0.42), P(0.22, -0.2), P(0.3, 0)]), 'shadow', 0.6, z);
    // The head, bowed forward, and the hooked nose.
    p.fill(C.circle(cx - 0.1 * s, fy - 0.7 * s, Math.max(1.5, 0.07 * s), 14), 'shadow', 0.6, z);
    p.fill(C.poly([P(-0.15, -0.71), P(-0.22, -0.67), P(-0.2, -0.645), P(-0.14, -0.66)]), 'shadow', 0.6, z);
    // The hat: a broad flat brim, then the crown, tall, its tip flopped back.
    const by = Math.round(fy - 0.77 * s);
    p.fill(C.rect(Math.round(cx - 0.36 * s), by, Math.round(0.56 * s), Math.max(2, Math.round(0.04 * s))), 'shadow', 0.6, z);
    p.fill(C.poly([P(-0.17, -0.765), P(-0.13, -0.86), P(-0.09, -0.95), P(-0.05, -1.02), P(0.0, -1.06), P(0.06, -1.07), P(0.13, -1.03), P(0.17, -0.98), P(0.1, -0.99), P(0.04, -0.96), P(0.02, -0.88), P(0.03, -0.765)]), 'shadow', 0.6, z);
    // A fringe of shawl hanging at her back.
    for (let k = 0; k < 4; k += 1) { const [fx, fyy] = P(0.13 + k * 0.025, -0.5 + k * 0.03); p.fill(C.rect(Math.round(fx), Math.round(fyy), 1, Math.max(1, Math.round(0.07 * s))), 'shadow', 0.6, z); }
    // Her arm out to the staff.
    p.fill(stroke([[...P(-0.08, -0.6), 0.09 * s], [...P(-0.22, -0.55), 0.065 * s], [...P(-0.32, -0.57), 0.05 * s]]), 'shadow', 0.6, z);
    // The staff, crooked, with a hook at its top.
    const st = spline([[-0.36, 0.0], [-0.34, -0.35], [-0.35, -0.7], [-0.33, -0.98], [-0.38, -1.05], [-0.44, -1.03], [-0.45, -0.98]], 4);
    for (let k = 0; k + 1 < st.length; k += 1) { const [ax, ay] = P(...st[k]); const [bx, by2] = P(...st[k + 1]); line(p, ax, ay, bx, by2, 'shadow', 1.4, z); }
    const [lx, ly] = P(-0.45, -0.88);
    line(p, lx, fy - 0.98 * s, lx, ly - 2, 'shadow', 1.4, z);
    return { lx: Math.round(lx), ly: Math.round(ly) };
  }

  /**
   * A bottle tree on a hummock: a short gnarled trunk splitting into limbs
   * that reach up and out unevenly, a bottle pushed over the end of each,
   * more hung on strings, all glowing the card's colour. Returns the bottles.
   */
  function bottleTree(p, cx, fy, s, ramp, z) {
    const r = rng('bottle-tree');
    // The hummock: roots and mud, a lit top.
    p.fill(C.poly([[cx - 0.55 * s, fy + 1], [cx - 0.38 * s, fy - 0.06 * s], [cx - 0.1 * s, fy - 0.12 * s], [cx + 0.2 * s, fy - 0.1 * s], [cx + 0.44 * s, fy - 0.04 * s], [cx + 0.58 * s, fy + 1]]), 'moss', 1.1, z);
    const trunk = [[cx - 0.03 * s, fy - 0.07 * s, 0.16 * s], [cx + 0.02 * s, fy - 0.2 * s, 0.11 * s], [cx - 0.02 * s, fy - 0.34 * s, 0.1 * s], [cx + 0.02 * s, fy - 0.44 * s, 0.09 * s]];
    p.fill(stroke(trunk), 'wood', 0.9, z);
    const bottles = [];
    const ends = [[-0.5, -0.66], [-0.42, -0.9], [-0.22, -0.98], [-0.08, -0.8], [0.06, -1.06], [0.24, -0.94], [0.46, -0.84], [0.56, -0.6], [-0.3, -0.62], [0.3, -0.7]];
    ends.forEach(([ex, ey], k) => {
      const ax = cx + (ex < 0 ? -0.02 : 0.02) * s; const ay = fy - (0.4 + Math.abs(ex) * 0.08) * s;
      const mx = cx + ex * 0.5 * s + (r() - 0.5) * 0.08 * s; const my = fy + (ey * 0.7 + 0.08) * s;
      const bx = cx + ex * s; const by = fy + ey * s;
      if (k < 8) p.fill(stroke([[ax, ay, Math.max(1.4, 0.06 * s)], [mx, my, Math.max(1.2, 0.035 * s)], [bx, by, 1]]), 'wood', 0.9, z);
      line(p, k < 8 ? mx : ax, k < 8 ? my : ay, bx, by, 'wood', 0.9, z);
      // The bottle over the branch's end, neck down; each its own size.
      const X = Math.round(bx); const Y = Math.round(by);
      const bh = Math.max(3, Math.round((0.07 + hash(k, 1, 3) * 0.05) * s)); const bw = Math.max(2, Math.round((0.04 + hash(k, 2, 3) * 0.03) * s));
      p.fill(C.rect(X - (bw >> 1), Y - bh - 1, bw, bh), ramp, 2.8 + (k % 3) * 0.4, z + 1);
      p.fill(C.rect(X - (bw >> 1), Y - bh - 1, 1, bh), ramp, 4, z + 1);
      p.fill(C.rect(X, Y - 1, 1, 1), ramp, 2.2, z + 1);
      bottles.push([X, Y - bh * 0.6 - 1]);
      // Some hung below on strings.
      if (k % 3 === 0) {
        const hx = Math.round(lerp(mx, bx, 0.5)); const hy = Math.round(lerp(my, by, 0.5));
        const L = Math.round((0.05 + r() * 0.1) * s);
        line(p, hx, hy, hx, hy + L, 'wood', 1.6, z);
        p.fill(C.rect(hx - (bw >> 1), hy + L + 1, bw, bh - 1), ramp, 3.2, z + 1);
        bottles.push([hx, hy + L + 1 + bh / 2]);
      }
    });
    return bottles;
  }

  /**
   * A great dead tree fallen across the causeway: its root plate torn up
   * and standing on end on the left, roots splayed round it; the trunk
   * running down from it across the planks to its crown, which lies in the
   * water on the right with its limbs sticking up out of it. The planks
   * under it are broken and going down. Drawn dark in the card's colour,
   * to be rimmed by the light behind. `wy` is the waterline where it lies.
   * Returns where the bubbles rise.
   */
  function fallenTree(p, c, wy, u, ramp, z) {
    const R = p.ri('shadow'); const r = rng('fallen');
    const set = (x, y, v) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= p.w || y >= p.h || y > wy + 1.5 * u) return; const i = y * p.w + x; p.r[i] = R; p.v[i] = v; p.z[i] = z; };
    const rx0 = c - 28 * u; const ry0 = wy - 20 * u; // where the trunk leaves the root plate
    // The root plate: a ragged disc on end, clods of mud on it, roots splaying out of its rim.
    const plate = [];
    for (let k = 0; k < 22; k += 1) {
      const a = (k / 22) * Math.PI * 2; const j = 0.75 + hash(k, 1, 31) * 0.4;
      plate.push([rx0 - 3 * u + Math.cos(a) * 10 * u * j, ry0 + Math.sin(a) * 16 * u * j]);
    }
    p.fill(C.poly(plate), 'shadow', (x, y) => (y > wy + 1.5 * u ? null : (hash(Math.floor(x / (2 * u)), Math.floor(y / (2 * u)), 32) < 0.25 ? 1 : 0.2)), z);
    for (let k = 0; k < 13; k += 1) {
      const a = (k / 13) * Math.PI * 2 + r() * 0.3; const L = (5 + r() * 8) * u;
      const x0 = rx0 - 3 * u + Math.cos(a) * 9 * u; const y0 = ry0 + Math.sin(a) * 14 * u;
      const bend = (r() - 0.5) * 0.8;
      for (let q = 0; q < L; q += 0.5) set(x0 + Math.cos(a + bend * q / L) * q, y0 + Math.sin(a + bend * q / L) * q, 0.2);
    }
    // The trunk, from the plate down across the causeway into the water.
    const cx1 = c + 34 * u; const cy1 = wy + 1 * u;
    const trunk = spline([[rx0, ry0, 10 * u], [c - 8 * u, wy - 12 * u, 8.5 * u], [c + 12 * u, wy - 4.5 * u, 7 * u], [cx1, cy1, 5.4 * u]], 6);
    p.fill(stroke(trunk), 'shadow', (x, y) => (y > wy + 1.5 * u ? null : 0.2), z);
    // Bark split along it: a few long paler streaks.
    for (let k = 0; k + 1 < trunk.length; k += 1) {
      const [x, y, w] = trunk[k];
      for (const o of [-0.22, 0.12]) if (hash(k, Math.round(o * 10), 33) < 0.6) set(x, y + o * w, 1);
    }
    // A snapped limb standing up off the trunk, and the crown's limbs up out of the water.
    const limbs = [[c - 2 * u, wy - 11 * u, -0.25, 15], [c + 20 * u, wy - 3 * u, 0.35, 15], [c + 27 * u, wy - 1 * u, -0.15, 20], [c + 33 * u, wy + 1 * u, 0.55, 13], [c + 38 * u, wy + 1 * u, 0.15, 9], [c + 12 * u, wy - 5 * u, -0.6, 9]];
    for (const [x0, y0, ang, len] of limbs) {
      const L = len * u; const w0 = 2.2 * u;
      p.fill(stroke([[x0, y0, w0], [x0 + Math.sin(ang) * L * 0.6, y0 - Math.cos(ang) * L * 0.6, w0 * 0.6], [x0 + Math.sin(ang * 1.4) * L, y0 - Math.cos(ang * 1.4) * L, 1]]), 'shadow', (x, y) => (y > wy + 1.5 * u ? null : 0.2), z);
      const fx = x0 + Math.sin(ang) * L * 0.6; const fyy = y0 - Math.cos(ang) * L * 0.6;
      const t = ang + (r() < 0.5 ? 0.7 : -0.7); const tl = L * 0.4;
      for (let q = 0; q < tl; q += 0.5) set(fx + Math.sin(t) * q, fyy - Math.cos(t) * q, 0.2);
    }
    // Planks broken under it, tipping and going down.
    for (const [dx, dy, ang, len] of [[-10, 2, 0.5, 9], [-2, 3, -0.4, 8], [6, 1.5, 0.9, 7], [-18, 1, 0.2, 7]]) {
      const x0 = c + dx * u; const y0 = wy + dy * u; const L = len * u;
      p.fill(stroke([[x0, y0, 1.8 * u], [x0 + Math.cos(ang) * L, y0 - Math.sin(ang) * L, 1.6 * u]]), 'plank', (x, y) => (y > wy + 4 * u ? null : 4.2), z - 1);
    }
    return [[c + 30 * u, wy + 1.5 * u], [c + 44 * u, wy + 2 * u], [c - 6 * u, wy + 3 * u], [c + 16 * u, wy + 2.5 * u]];
  }

  /**
   * Firm ground: a long low bank across the far end, rough grass on its
   * crest standing black against the dawn, and a dry path running up and
   * over it, pale in the light.
   */
  function bank(p, cx, wy, u, W, z) {
    const top = (x) => wy - (5.5 * Math.exp(-(((x - cx) / (46 * u)) ** 2)) + 1.2 + n1(x / (9 * u), 4) * 1.4) * u;
    p.fill(C.rect(0, wy - 9 * u, W, 10 * u), 'earth', (x, y) => {
      const t = top(x); if (y < t || Math.abs(x - cx) > 120 * u) return null;
      const lit = clamp(1 - Math.abs(x - cx) / (60 * u), 0, 1);
      return 1.6 + lit * 4.2 - (y - t) / u * 0.5 + (y - t < 1 ? 2 + lit * 2 : 0);
    }, z);
    // Grass on the crest.
    for (let x = cx - 110 * u; x < cx + 110 * u; x += 1) {
      if (hash(Math.round(x), 2, 9) < 0.45) continue;
      const t = top(x); const gh = (1 + hash(Math.round(x), 3, 9) * 2.4) * u;
      line(p, x, t, x + (hash(Math.round(x), 4, 9) - 0.5) * 2, t - gh, 'earth', 1.2, z);
    }
    // The dry path up and over the crest.
    p.each(C.poly([[cx - 6 * u, wy + 0.5], [cx + 6 * u, wy + 0.5], [cx + 2 * u, top(cx) + 0.5], [cx - 1.5 * u, top(cx) + 0.5]]), (x, y, i) => {
      if (p.z[i] !== z) return;
      p.v[i] = Math.max(p.v[i], 7.4 - (wy - y) / u * 0.1);
    });
    return top;
  }

  /* ---------------- the wisps ---------------- */

  /** A will-o'-wisp: a hot core, a halo, a faint outer ring, wavering. */
  function wispSprite(img, x, y, t, ph, big) {
    const a = 0.75 + 0.25 * Math.sin(t * 3.1 + ph);
    const X = Math.round(x); const Y = Math.round(y);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(img, X + dx, Y + dy, WISP[0], 0.35 * a);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(img, X + dx, Y + dy, WISP[1], 0.8 * a);
    put(img, X, Y, WISP[3], 1);
    if (big) { put(img, X + 1, Y, WISP[2], 0.9); put(img, X, Y - 1, WISP[2], 0.9); put(img, X + 1, Y - 1, WISP[3], 0.85); }
    // A thread of light trailing below it.
    put(img, X + Math.round(Math.sin(t * 1.7 + ph)), Y + 3, WISP[0], 0.5 * a);
  }
  /** A wisp's reflection: level dashes under it in the water, wavering. */
  function wispReflection(img, p, x, y, base, t, ph, u) {
    const ry = 2 * base - y; const tick = Math.floor(t * 4 + ph * 3);
    for (let k = 0; k < 6; k += 1) {
      const Y = Math.round(ry - 2 * u + k * 1.5 * u); if (Y < 0 || Y >= p.h) continue;
      if (hash(k, tick, 5) < 0.2) continue;
      const len = Math.round((k < 3 ? 1.6 : 1) * u * (0.6 + hash(k, tick, 6)));
      const X = Math.round(x + (hash(k, tick, 7) - 0.5) * 2.4 * u);
      for (let dx = -len; dx <= len; dx += 1) {
        const xx = X + dx; if (xx < 0 || xx >= p.w || p.z[Y * p.w + xx] !== Z.water) continue;
        put(img, xx, Y, dx === 0 && k < 3 ? WISP[2] : WISP[1], (0.8 - k * 0.11) * (1 - Math.abs(dx) / (len + 1.5)));
      }
    }
  }
  const pulse = (ph) => (t) => 0.75 + 0.25 * Math.sin(t * 3.1 + ph) + 0.15 * Math.sin(t * 0.7 + ph * 2);

  /** Rings spreading on the water where something just rose: ellipses in perspective, fading out. */
  function rings(img, p, list, t, u) {
    list.forEach(([x, y, rmax, ph], k) => {
      for (let j = 0; j < 2; j += 1) {
        const f = ((t * 0.45 + ph + j * 0.5) % 1);
        const rx = 1 + f * rmax; const ry = rx * 0.3;
        const n = Math.max(10, Math.round(rx * 3));
        for (let q = 0; q < n; q += 1) {
          const a = (q / n) * Math.PI * 2; const X = Math.round(x + Math.cos(a) * rx); const Y = Math.round(y + Math.sin(a) * ry);
          if (X < 0 || Y < 0 || X >= p.w || Y >= p.h || p.z[Y * p.w + X] !== Z.water) continue;
          put(img, X, Y, Math.sin(a) < 0 ? '#3C695C' : '#192E2A', (1 - f) * 0.8);
        }
      }
    });
  }

  /* ================= A: the sunken causeway ================= */

  const A = {
    job: 0, setting: 'mire', key: 'A', id: 'mire-a', side: 'outside',
    name: 'The Mire', title: 'The sunken causeway',
    pitch: 'Black water and dead cypress in the fog, and a causeway of rotting planks that runs out across it and sinks. The marsh-light glows where the way goes, the wisps drift in to lure you off it, and everything is doubled in the water.',
    notes: [
      ['Light', 'The marsh-light: a teal-green glow lying low in the fog, in clean bands, with the dead trees standing black against it and rimmed by it. Wisps make small lights of their own. Everything else is black water. On a face-down card the causeway runs off into the dark; the light is a wisp off to the side, not at the way’s end.'],
      ['Detail', 'Cypress with swollen feet and knees, snapped tops, moss hanging in beards; a hut on stilts with its one lantern; posts and a slack rope along the planks, boards missing and drowned; lily pads, bulrushes, eyes just above the water. Every light and silhouette is mirrored and broken by ripples.'],
      ['Vista', 'The causeway comes in from the left and ends in the glow, and the card waits there: a serpent rising out of the water, the witch with her lantern, a bottle tree hung with violet lights, a great dead tree fallen across the planks, roots torn up and crown in the water, or the fog parting on a gold dawn over firm ground.'],
      ['World', 'The landing you stand on: rotten planks under the table, black water at the sides with lily pads, reeds and dead trunks, wisps drifting at the edges, eyes that blink, rings spreading where something moved.'],
    ],
    palette: ['#020405', '#0E1B1A', '#203A34', '#3C695C', '#72AD98', '#E4F7EE', '#121716', '#35312B', '#4C6B5F'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['wisp', 'lamp'], dither: 0.24 });
      const u = H / 134; const yh = 80 * u;
      // The wisp: off the path, to the right, luring. It is the brightest thing, and the way itself runs off into the dark.
      const wx = 63 * u; const wy = 56 * u; const wb = 88 * u;
      const fogAt = fogSky(p, W, yh, u, [
        { x: wx, y: wy + 1 * u, rx: 30 * u, ry: 27 * u, k: 9.4, pow: 1.2 },
        { x: 50 * u, y: yh - 3 * u, rx: 84 * u, ry: 16 * u, k: 3, pow: 1.2 },
        { x: 39 * u, y: yh - 5 * u, rx: 15 * u, ry: 11 * u, k: -2.8, pow: 1 },
      ], { seed: 21, top: 1.8, rise: 4.6 });
      p.fill(C.rect(0, yh, W, H - yh), 'water', 0.8, Z.water);
      farShore(p, W, yh, u, fogAt, { seed: 23 });
      fogBank(p, W, yh, u, fogAt, 24, 5);
      // A hut far off on the left, dark but for its one lantern.
      const hb = hut(p, { x: 29 * u, by: yh + 1.5 * u, u, z: Z.mid, s: 0.6, seed: 25, tilt: 1.2, lampW: 1 });
      // The dead cypress on the right, its limbs reaching over the arch, moss hanging.
      const tr = deadTree(p, { x: 83 * u, by: 88 * u, h: 90 * u, u, z: Z.mid, seed: 27, lean: -0.04, w: 0.12, limbs: 4, from: 0.5, reach: 1.1, flip: true, side: true, knees: 3 });
      moss(p, tr.limbs, { u, z: Z.mid, seed: 28, len: 13, skip: 0.3 });
      // The near cypress on the left, out of the picture at the top, a limb across.
      const tl = deadTree(p, { x: 5 * u, by: 130 * u, h: 150 * u, u, z: Z.near, seed: 29, lean: 0.02, w: 0.1, limbs: 3, from: 0.62, reach: 0.9, knees: 1 });
      moss(p, tl.limbs, { u, z: Z.near, seed: 30, len: 16, skip: 0.25, v: 1.1 });
      fogRim(p, Z.mid, Z.near, 1, { to: 'fog', min: 3.5, add: 1.8, keepThin: true });
      // The water mirrors it all.
      mirror(p, { base: yh, u, zs: [Z.sky, Z.far], seed: 3, dim: 1.3, fade: 0.05, gap: 0.18, dash: 14, amp: 0.03 });
      mirror(p, { base: hb.base, u, zs: [Z.mid, Z.mid + 1], x0: hb.x0, x1: hb.x1, seed: 4, dim: 1.1 });
      mirror(p, { base: 88 * u, u, zs: [Z.mid], x0: 60 * u, x1: W, seed: 5, dim: 1.0 });
      // The wisp's reflection: a column of broken light in the water under it.
      field(p, (x, y, i) => {
        if (p.z[i] !== Z.water) return 0;
        const ry = 2 * wb - wy; const d = Math.abs(y + 0.5 - ry) / (26 * u);
        const sway = (hash(y, 3, 7) - 0.5) * 3 * u;
        const hw = (1.4 + Math.abs(y - ry) * 0.14) * u;
        const dx = Math.abs(x + 0.5 - wx - sway) / hw;
        if (dx > 1 || d > 1 || hash(y, 5, 7) < 0.25) return 0;
        return 8 * (1 - d) ** 0.7 * (1 - dx * dx);
      }, null, [wx - 10 * u, yh, wx + 10 * u, H]);
      // The causeway, curving in from the near left and off into the dark.
      const posts = causeway(p, {
        yh, y1: 134 * u, u, seed: 31, z: Z.walk, dFar: 0.06, hw: 26 * u, v: 5.6, fadeNear: 1.6, missing: 0.12, drowned: 0.2, rope: true,
        cx: (D) => 39 * u + 14 * u * D + Math.sin(D * 6) * 2.5 * u * D, postStep: 0.3, postH: 1.4, kq: 9,
      });
      fogRim(p, Z.post, Z.post, 1, { to: 'fog', min: 3.5, add: 0.8 });
      for (const q of posts) mirror(p, { base: q.y + 0.5, u, zs: [Z.post], x0: q.x - 4 * u, x1: q.x + 4 * u, seed: Math.round(q.x), dim: 0.9, gap: 0.2 });
      // Lily pads on the open water right of the planks.
      lilies(p, [[67 * u, 99 * u, 4 * u, 1.8], [77 * u, 105 * u, 5 * u, 1.6], [62 * u, 112 * u, 6 * u, 1.5], [87 * u, 114 * u, 6 * u, 1.4], [27 * u, 106 * u, 4.4 * u, 1.4], [71 * u, 92 * u, 3 * u, 2], [20 * u, 116 * u, 6 * u, 1.2]], u, 32);
      // Eyes at the waterline, left of the planks.
      const ey = eyes(p, 27 * u, 94 * u, u);
      // Reeds in the near corners.
      reeds(p, 88 * u, 133 * u, u, { seed: 33, n: 9, h: 34, w: 12, lean: -0.15 });
      reeds(p, 15 * u, 134 * u, u, { seed: 34, n: 7, h: 26, w: 10, lean: 0.12 });
      // The wisp's light: on the trunk beside it, and down across the planks.
      p.light(wx, wy, 30 * u, 2.6, null, { zMin: Z.mid, zMax: Z.mid, hard: true });
      p.light(wx, wy + 30 * u, 50 * u, 3.2, null, { zMin: Z.walk, zMax: Z.post, sx: 0.9 });
      rimToward(p, wx, wy, 60 * u, 3, Z.walk, Z.post);
      rimToward(p, wx, wy, 80 * u, 2.6, Z.reed, Z.reed);
      vignette(p, W, H, 1.4, 0.5);
      return {
        p,
        over(img) {
          wispSprite(img, wx, wy, 0.4, 0, true);
          wispReflection(img, p, wx, wy, wb, 0.4, 0, u);
          for (const [x, y] of ey) { put(img, x, y, '#C9F8E7'); put(img, x, y + Math.round(2.6 * u), '#2C6655', 0.8); }
          // A second wisp far off over the water, small.
          put(img, Math.round(16 * u), Math.round(67 * u), WISP[2], 0.9); put(img, Math.round(16 * u), Math.round(93 * u), WISP[0], 0.6);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: ['wisp', 'lamp'], dither: 0.24 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const open = cat === 'clear-path';
      const yh = 60 * u; const span = 40 * u; const dFar = 0.27; const fy = yh + dFar * span;
      // The marsh-light low in the fog behind where the card stands; for a Clear Path the fog parts on the dawn.
      const glows = [
        { x: gx, y: yh - 3 * u, rx: 110 * u, ry: 20 * u, k: open ? 2.4 : 4.5, pow: 1.2 },   // a wide band low over the water
        { x: gx, y: 44 * u, rx: 46 * u, ry: 42 * u, k: open ? 2.4 : 7, pow: 1.3 },   // the core, tall behind the card
      ];
      const wisps = [[-30, 45, 64], [66, 51, 64], [-96, 39, 63], [154, 46, 63], [-206, 50, 64], [234, 41, 63], [-300, 44, 63], [300, 48, 64]]
        .map(([dx, y, b], k) => [gx + dx * u, y * u, b * u, k * 1.7]).filter(([x]) => x > -6 && x < W + 6);
      for (const [x, y] of wisps) glows.push({ x, y, rx: 24 * u, ry: 17 * u, k: 2.8, pow: 1.3 });
      const fogAt = fogSky(p, W, yh, u, glows, { seed: 3, top: 2.4, rise: 5.2, dawn: open ? { x: gx, y: yh + 1 * u, rx: 150 * u, ry: 19 * u, k: 11.5 } : null });
      p.fill(C.rect(0, yh, W, H - yh), 'water', 0.8, Z.water);
      farShore(p, W, yh, u, fogAt, { seed: 5, clear: [gx, 24 * u] });
      // A row of cypress further off, half lost in the fog.
      const rg = rng('mire-ghosts');
      for (let d = 36 + rg() * 12; d < W / u / 2 + 30; d += 38 + rg() * 34) {
        for (const m of [-1, 1]) {
          const x = gx + m * (d + rg() * 10) * u; if (x < -30 * u || x > W + 30 * u) continue;
          ghostTree(p, { x, by: yh + 0.5 * u, h: (30 + rg() * 26) * u, u, seed: Math.round(x * 7), lean: (rg() - 0.5) * 0.1, w: 0.08, knees: 0, moss: 7 }, fogAt, 0.4, yh);
        }
      }
      fogBank(p, W, yh, u, fogAt, 6, 7);
      // Dead cypress across the width, the two nearest framing the glow; huts; broken snags.
      const trees = [[-52, 3.5, 78, -0.05, 0], [50, 4.5, 84, 0.05, 1], [-120, 2, 58, 0.03, 1], [132, 2.5, 62, -0.04, 0], [-182, 3, 72, 0.02, 0], [200, 2, 50, 0.03, 1]];
      const r = rng('mire-vista');
      for (let d = 250; d < W / u / 2 + 30; d += 52 + r() * 30) trees.push([-d - r() * 12, 1.5 + r() * 3, 46 + r() * 34, (r() - 0.5) * 0.1, 0], [d + r() * 12, 1.5 + r() * 3, 46 + r() * 34, (r() - 0.5) * 0.1, 1]);
      const mids = [];
      trees.forEach(([dx, b, h, lean, flip], k) => {
        const x = gx + dx * u; if (x < -40 * u || x > W + 40 * u) return;
        const t = deadTree(p, { x, by: yh + b * u, h: h * u, u, z: Z.mid, seed: 40 + k, lean, flip: !!flip, w: 0.1, reach: 1, knees: 2 });
        moss(p, t.limbs, { u, z: Z.mid, seed: 60 + k, len: 12, skip: 0.35 });
        mids.push({ base: yh + b * u, x0: t.x0, x1: t.x1 });
      });
      const huts = [];
      for (const [dx, b, s, lit, tilt] of [[92, 3.5, 1, true, 0.5], [-232, 2.5, 0.85, false, 2.4]]) {
        const x = gx + dx * u; if (x < -30 * u || x > W + 30 * u) continue;
        const hh = hut(p, { x, by: yh + b * u, u, z: Z.mid, s, lit, seed: 70 + dx, tilt });
        huts.push(hh); mids.push({ base: hh.base, x0: hh.x0, x1: hh.x1, lamp: true });
      }
      for (const [dx, b, h] of [[-84, 7, 15], [74, 9, 11], [164, 6, 19], [-150, 8, 10], [-280, 7, 14], [290, 8, 12]]) {
        const x = gx + dx * u; if (x < -10 * u || x > W + 10 * u) continue;
        const t = deadTree(p, { x, by: yh + b * u, h: h * u, u, z: Z.mid, seed: 90 + dx, w: 0.18, limbs: 1, from: 0.6, knees: 0 });
        mids.push({ base: yh + b * u, x0: t.x0, x1: t.x1 });
      }
      fogRim(p, Z.mid, Z.mid + 1, 1, { to: 'fog', min: 4, add: 2.2, keepThin: true });
      // The water mirrors it.
      mirror(p, { base: yh, u, zs: [Z.sky, Z.far], seed: 3, dim: 1.3, fade: 0.08, gap: 0.12, dash: 26, amp: 0.02, ampMax: 1 });
      for (const m of mids) mirror(p, { base: m.base, u, zs: [Z.mid, Z.mid + 1], x0: m.x0, x1: m.x1, seed: Math.round(m.x0), dim: m.lamp ? 1.1 : 1.0, gap: 0.3 });
      // The glow's light laid on the water toward us: a column of ripples, the causeway crossing it.
      const colK = open ? 5.2 : 4.4;
      field(p, (x, y, i) => {
        if (p.z[i] !== Z.water) return 0;
        const f = (y + 0.5 - yh) / span; const hw = (12 + f * 22) * u;
        const sway = (hash(y, 3, 21) - 0.5) * 4 * u;
        const dx = Math.abs(x + 0.5 - gx - sway) / hw;
        if (dx > 1 || hash(y, 5, 21) < 0.22) return 0;
        const dash = hash(Math.floor((x + hash(y, 6, 21) * 9) / ((2 + f * 5) * u)), y, 22) < 0.3 ? 0.3 : 1;
        return colK * (1 - f * 0.55) * (1 - dx * dx) * dash;
      }, null, [gx - 40 * u, yh, gx + 40 * u, H]);
      // The causeway, in from the near left to the card.
      const cut = cat === 'obstacle' ? (D) => D < 0.37 : null;
      const cxw = (D) => gx - 36 * u * (D - dFar) / (1 - dFar) + Math.sin(D * 7) * 3 * u * (D - dFar);
      const posts = causeway(p, { yh, y1: yh + span, u, seed: 11, z: Z.walk, dFar: open ? 0.16 : dFar, kq: 13, hw: 19 * u, v: 4.4, fadeNear: 1.6, missing: 0.1, drowned: 0.18, cx: cxw, rope: true, cut });
      fogRim(p, Z.post, Z.post, 1, { to: 'fog', min: 4, add: 1 });
      for (const q of posts) mirror(p, { base: q.y + 0.5, u, zs: [Z.post], x0: q.x - 3 * u, x1: q.x + 3 * u, seed: Math.round(q.x), dim: 0.9, gap: 0.2 });
      // Lily pads, kept off the bright column under the card.
      const lil = [];
      const rl = rng('mire-lilies');
      for (let k = 0; k < Math.round(W / u / 9); k += 1) {
        const x = rl() * W; const D = 0.3 + rl() ** 1.4 * 0.75; const y = yh + D * span;
        if (Math.abs(x - gx) < 16 * u * (1 + D) || Math.abs(x - cxw(D)) < 19 * u * D + 4 * u) continue;
        lil.push([x, y, (2 + rl() * 3.4) * u * D * 1.5, 1.2 + rl() * 0.8]);
      }
      lilies(p, lil, u, 12);
      const eyeList = [[38, 79], [-150, 73], [222, 76], [-262, 80]].map(([dx, y]) => [gx + dx * u, y * u]).filter(([x]) => x > 0 && x < W);
      const glints = eyeList.flatMap(([x, y]) => eyes(p, x, y, u));
      // The card, where the causeway ends.
      const fx = cxw(dFar);
      let ringsAt = [];
      let bubbles = [];
      let lantern = null; let bottles = [];
      if (cat === 'monster') {
        const s = 48 * u;
        const m = serpent(p, fx + 4 * u, fy + 1 * u, s, ramp, Z.sub);
        fogRim(p, Z.sub, Z.sub, 1.0, { to: 'fog', min: 4, add: 2.6, keepThin: true });
        fogRim(p, Z.sub, Z.sub, 1.0, { to: 'fog', min: 2.5, add: 3, water: true });
        mirror(p, { base: fy + 1.5 * u, u, zs: [Z.sub, Z.subD], x0: fx - 30 * u, x1: fx + 40 * u, seed: 9, dim: 1.1, gap: 0.24, dash: 5 });
        p.tint(m.ex, m.ey, 2.6 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
        ringsAt = [[fx + 4 * u, fy + 2 * u, 14 * u, 0], [fx + 4 * u + 0.38 * s, fy + 2 * u, 9 * u, 0.4], [fx + 4 * u + 0.66 * s, fy + 2 * u, 7 * u, 0.7]];
      } else if (cat === 'wanderer') {
        const s = 40 * u;
        const l = witch(p, fx + 2 * u, fy, s, Z.sub);
        fogRim(p, Z.sub, Z.sub, 1.0, { to: 'fog', min: 4, add: 2.2, keepThin: true });
        const lh = Math.max(3, Math.round(4 * u));
        p.fill(C.rect(l.lx - 1, l.ly - 1, 3, 1), 'shadow', 1.4, Z.subD);
        p.fill(C.rect(l.lx - 1, l.ly, 3, lh), ramp, 2.2, Z.subD);
        p.fill(C.rect(l.lx, l.ly + 1, 1, lh - 2), ramp, 3.4, Z.subD);
        p.fill(C.rect(l.lx - 1, l.ly + lh, 3, 1), 'shadow', 1.4, Z.subD);
        mirror(p, { base: fy + 0.5, u, zs: [Z.sub, Z.subD], x0: fx - 20 * u, x1: fx + 20 * u, seed: 9, dim: 0.8, gap: 0.24, dash: 5 });
        p.light(l.lx, l.ly, 16 * u, 2.4, flicker(0.9, 0.15), { zMin: Z.walk, zMax: Z.post });
        p.tint(l.lx + 0.5, l.ly + 2, 4 * u, CARD.wand[4], 0.55, flicker(0.9, 0.15));
        p.tint(l.lx + 0.5, l.ly + 2, 13 * u, hex, 0.5, flicker(0.9, 0.15));
        lantern = [l.lx, l.ly];
      } else if (cat === 'item') {
        const s = 38 * u;
        bottles = bottleTree(p, fx + 2 * u, fy, s, ramp, Z.sub);
        fogRim(p, Z.sub, Z.sub, 0.9, { min: 4.5, keepThin: true });
        mirror(p, { base: fy + 0.5, u, zs: [Z.sub, Z.subD], x0: fx - 26 * u, x1: fx + 28 * u, seed: 9, dim: 0.8, gap: 0.24, dash: 5 });
        for (const [bx, by] of bottles.filter((_, k) => k % 2 === 0)) p.tint(bx, by, 6 * u, CARD.item[3], 0.4, flicker(bx, 0.2, 0.8));
        p.tint(fx + 2 * u, fy - s * 0.7, 26 * u, hex, 0.3, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        const D = 0.4; const y = yh + D * span;
        bubbles = fallenTree(p, cxw(D), y, u, ramp, Z.sub);
        fogRim(p, Z.sub, Z.sub, 0.3, { to: ramp, min: 3, add: 0.9, keepThin: true, water: true });
        mirror(p, { base: y + 0.5, u, zs: [Z.sub], x0: cxw(D) - 52 * u, x1: cxw(D) + 64 * u, y1: y + 14 * u, seed: 9, dim: 1.1, gap: 0.28, dash: 5, fade: 0.1 });
        p.tint(cxw(D) + 30 * u, y - 4 * u, 5 * u, hex, 0.3, flicker(0.5, 0.12, 0.6));
        ringsAt = bubbles.map(([x, by], k) => [x, by, 6 * u, k * 0.27]);
      } else if (cat === 'clear-path') {
        // Firm ground across the far end, the dry path over it into the dawn.
        bank(p, gx, yh + 0.5, u, W, Z.mid + 1);
        mirror(p, { base: yh + 0.5, u, zs: [Z.mid + 1], seed: 13, dim: 1.6, gap: 0.3 });
        p.light(gx, yh, 40 * u, 2.6, null, { zMin: Z.walk, zMax: Z.walk, sy: 0.5 });
        p.tint(gx, yh - 6 * u, 22 * u, CARD.path[4], 0.45, flicker(0.4, 0.06, 0.3));
        p.tint(cxw(0.3), yh + 0.3 * span, 18 * u, CARD.path[3], 0.4);
      }
      // Reeds along the near water, black against the reflections.
      const rr = rng('mire-reeds');
      for (let x = rr() * 30 * u; x < W; x += (22 + rr() * 34) * u) {
        if (Math.abs(x - gx) < 22 * u || Math.abs(x - cxw(1)) < 26 * u) continue;
        reeds(p, x, (100 + rr() * 4) * u, u, { seed: Math.round(x) + 5, n: 5 + Math.floor(rr() * 5), h: 16 + rr() * 14, w: 8 });
      }
      // Light: the glow rims everything that stands against it, and catches the causeway's far boards.
      rimToward(p, gx, 54 * u, 70 * u, 2.4, Z.post, Z.post);
      rimToward(p, gx, 50 * u, 90 * u, 1.6, Z.reed, Z.reed);
      p.light(gx, fy, 54 * u, 7.5, null, { zMin: Z.walk, zMax: Z.walk, sy: 0.55 });
      for (const h of huts) if (h.lamp) p.light(h.lamp[0], h.lamp[1], 16 * u, 3.4, flicker(1.7, 0.08, 0.6), { zMin: Z.mid, zMax: Z.mid });
      // The wisps: each a small light on the fog and the trees, pulsing.
      for (const [x, y, , ph] of wisps) p.light(x, y, 18 * u, 2.6, pulse(ph), { zMin: Z.sky, zMax: Z.mid });
      shimmer(p, yh, H, u, 14);
      vignette(p, W, H, 1.5, 0.42);
      return {
        p,
        over(img, t) {
          for (const [x, y, b, ph] of wisps) {
            const X = x + Math.sin(t * 0.4 + ph) * 2.4 * u; const Y = y + Math.sin(t * 0.9 + ph) * 1.4 * u;
            wispReflection(img, p, X, Y, b, t, ph, u);
            wispSprite(img, X, Y, t, ph, false);
          }
          glints.forEach(([x, y], k) => {
            if ((t * 0.5 + k * 0.37) % 4 < 0.12) return; // a blink
            put(img, x, y, '#C9F8E7'); put(img, x, y + Math.round(3 * u), '#2C6655', 0.7);
          });
          rings(img, p, ringsAt, t, u);
          if (lantern) put(img, lantern[0], lantern[1] + Math.round(3 * u) + 2 * Math.round(fy - lantern[1]), CARD.wand[3], 0.6);
          if (cat === 'item') for (const q of particles('firefly', 10, [fx - 18 * u, fy - 40 * u, 40 * u, 34 * u], t, 7)) put(img, q.x, q.y, CARD.item[q.big ? 4 : 3], q.a);
          if (cat === 'obstacle') {
            bubbles.forEach(([x], k) => {
              const f = (t * 0.6 + k * 0.37) % 1; const y = yh + 0.42 * span - f * 2 * u;
              put(img, x + Math.sin(t * 3 + k) * 0.6, y, CARD.obst[4], (1 - f) * 0.9);
            });
          }
          if (open) for (const q of particles('mote', 16, [gx - 30 * u, yh - 30 * u, 60 * u, 30 * u], t, 71)) put(img, q.x, q.y, q.big ? '#FFF1C4' : '#F2CB8A', q.a * 0.9);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['wisp', 'lamp'], dither: 0.24 });
      const u = H / 250; const cx = W / 2;
      const yh = 30;
      // The fog and the far shore along the top, mostly under the vista; its glow carries down into the water.
      const fogAt = fogSky(p, W, yh, u, [{ x: cx, y: yh - 4, rx: 170, ry: 30, k: 7.5, pow: 1.3 }], { seed: 41, top: 1, rise: 3 });
      p.fill(C.rect(0, yh, W, H - yh), 'water', 0.7, Z.water);
      farShore(p, W, yh, u, fogAt, { seed: 43 });
      fogBank(p, W, yh, u, fogAt, 44, 4);
      // A dead cypress standing in the water at each side, up out of the picture.
      const sides = [];
      for (const [s, x, by] of [[-1, 9, 124], [1, W - 10, 140]]) {
        const t = deadTree(p, { x, by, h: 190, u: 1, z: Z.near, seed: 51 + s, lean: -s * 0.03, w: 0.085, limbs: 3, from: 0.6, reach: 0.75, flip: s > 0, knees: 3 });
        moss(p, t.limbs, { u: 1, z: Z.near, seed: 53 + s, len: 20, skip: 0.3, v: 1.1 });
        sides.push({ base: by, x0: t.x0, x1: t.x1 });
      }
      fogRim(p, Z.near, Z.near, 0.75);
      mirror(p, { base: yh, u, zs: [Z.sky, Z.far], seed: 3, dim: 1.6, fade: 0.06, gap: 0.3, dash: 10, y1: yh + 56 });
      for (const m of sides) mirror(p, { base: m.base, u: 1, zs: [Z.near], x0: m.x0, x1: m.x1, seed: m.base, dim: 1.2, fade: 0.02, gap: 0.3, dash: 7 });
      // The causeway you stand on, running on toward the vista: planks across, posts and a slack rope along it.
      const vy = -300; const span = H - vy;
      const posts = causeway(p, {
        yh: vy, y1: H, u, seed: 47, z: Z.walk, dFar: (yh + 1 - vy) / span, kq: 56, hw: 68, v: 3.6, fadeNear: 0.6, missing: 0.07, drowned: 0.18, seams: true,
        cx: () => cx, rope: true, postStep: 0.07, postH: 1.3, postW: 2.2,
      });
      for (const q of posts) mirror(p, { base: q.y + 0.5, u: 1, zs: [Z.post], x0: q.x - 5, x1: q.x + 5, seed: Math.round(q.x), dim: 1, gap: 0.2 });
      const half = (y) => 68 * (y - vy) / span;
      // The water at the sides: lily pads, duckweed along the planks, eyes, reeds.
      const rl = rng('mire-world');
      const lil = [];
      for (let j = 0; j < 80; j += 1) {
        const y = 36 + rl() ** 0.8 * 168; const x = rl() * W;
        if (Math.abs(x - cx) < half(y) + 5) continue;
        lil.push([x, y, (4 + rl() * 7) * (0.45 + (y - yh) / 170), 2.6 + rl() * 1.2]);
      }
      lilies(p, lil, u, 49);
      const duck = p.ri('pad');
      for (let y = yh + 4; y < H; y += 1) {
        for (const s of [-1, 1]) {
          for (let k = 0; k < 3; k += 1) {
            const x = Math.round(cx + s * (half(y) + 2 + hash(y, k, 58 + s) ** 2 * 16));
            const i = y * W + x;
            if (x < 0 || x >= W || p.z[i] !== Z.water || hash(y, k + 5, 59) < 0.55) continue;
            p.r[i] = duck; p.v[i] = 1.6 + hash(x, y, 60); p.z[i] = Z.pad;
          }
        }
      }
      const glints = [[24, 158], [296, 100], [52, 74]].flatMap(([x, y]) => eyes(p, x, y, 1.1));
      for (const [x, y, n, h] of [[16, 202, 10, 50], [44, 176, 5, 22], [304, 202, 11, 54], [280, 166, 6, 26], [30, 96, 5, 18], [292, 84, 5, 18]]) reeds(p, x, y, 1, { seed: x + y, n, h, w: 12, v: 0.8 });
      // Light: the glow from beyond the vista down the far planks and the water; wisps at the edges, pulsing.
      p.light(cx, 8, 150, 3.4, flicker(0.7, 0.05, 0.4), { sx: 1.7, zMin: Z.pad });
      const wisps = [[29, 54, 0], [291, 58, 1.7], [15, 120, 3.1], [305, 142, 4.4]];
      for (const [x, y, ph] of wisps) {
        p.light(x, y, 34, 3, pulse(ph), { zMin: Z.pad });
        field(p, (px, py, i) => {
          if (p.z[i] !== Z.water) return 0;
          const ry = y + 16; const d = Math.abs(py - ry) / 16; const dx = Math.abs(px - x - (hash(py, 3, ph * 9) - 0.5) * 3) / (1.5 + Math.abs(py - ry) * 0.18);
          if (d > 1 || dx > 1 || hash(py, 5, ph * 9) < 0.35) return 0;
          return 6 * (1 - d) * (1 - dx * dx);
        }, pulse(ph), [x - 10, y, x + 10, y + 34]);
      }
      rimToward(p, cx, 0, 150, 1.6, Z.walk, Z.post, 0.6);
      for (const [x, y] of wisps) rimToward(p, x, y, 60, 3.2, Z.pad, Z.reed);
      rimToward(p, cx, 0, 220, 1.4, Z.reed, Z.reed, 0.6);
      shimmer(p, yh, 90, u, 15, 0.8);
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.34));
      return {
        p,
        over(img, t) {
          for (const [x, y, ph] of wisps) wispSprite(img, x + Math.sin(t * 0.4 + ph) * 2.4, y + Math.sin(t * 0.9 + ph) * 1.6, t, ph, false);
          glints.forEach(([x, y], k) => { if ((t * 0.5 + k * 0.61) % 3.4 < 0.14) return; put(img, x, y, '#86D7BC'); put(img, x, y + 3, '#192E2A', 0.8); });
          rings(img, p, [[40, 186, 9, 0], [278, 122, 8, 0.5], [60, 132, 6, 0.25], [262, 182, 10, 0.75]], t, 1);
          for (const [x, y, ph] of wisps) for (const q of particles('mote', 4, [x - 12, y - 10, 24, 24], t, Math.round(ph * 10) + 3)) put(img, q.x, q.y, '#4E9F86', q.a * 0.7);
        },
      };
    },
  };


export default [A];

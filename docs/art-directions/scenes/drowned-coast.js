/* The Drowned Coast: the storm outside, the smugglers' cave inside. */
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
  /** A run of round lumps along t, each 0..1 high: the underside of a cloud, the top of a heap. */
  const billow = (t, s) => { const k = Math.floor(t); const g = t - k; return Math.sqrt(Math.max(0, 1 - (2 * g - 1) ** 2)) * (0.5 + 0.5 * hash(k, 0, s)); };

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }

  /** The edge of a figure toward a light: its pixels on layer z whose neighbour (dx, dy) lies on a lower layer. */
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
    for (const i of hit) { p.r[i] = r; p.v[i] = typeof v === 'function' ? v(i % p.w, Math.floor(i / p.w)) : v; }
  }

  /** The top edge of whatever is on layer z: wet rock catching the sky. */
  function wetTop(p, z, dv, rows = 1) {
    const add = [];
    for (let y = 1; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] !== z) continue;
        for (let k = 1; k <= rows; k += 1) {
          if (y - k < 0) break;
          if (p.z[i - k * p.w] < z) { add.push([i, k === 1 ? dv : dv * 0.45]); break; }
        }
      }
    }
    for (const [i, dv2] of add) p.v[i] += dv2;
  }

  /** A line of single pixels from (x0, y0) to (x1, y1). */
  function line(p, x0, y0, x1, y1, ramp, v, z) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const R = p.ri(ramp);
    for (let k = 0; k <= n; k += 1) {
      const x = Math.round(lerp(x0, x1, k / n)); const y = Math.round(lerp(y0, y1, k / n));
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const i = y * p.w + x; p.r[i] = R; p.v[i] = typeof v === 'function' ? v(x, y) : v; p.z[i] = z;
    }
  }

  /** A skyline: a polygon from x0 to x1 whose top runs along topAt(x), down to y1. */
  function skyline(x0, x1, y1, topAt, step = 2) {
    const pts = [[x0, y1]];
    for (let x = x0; x < x1; x += step) pts.push([x, topAt(x)]);
    pts.push([x1, topAt(x1)], [x1, y1]);
    return C.poly(pts);
  }

  /*
   * One palette for both sides: storm blue-blacks and slate that climb
   * toward warm cream, so that wherever the gold light falls the stone, the
   * sea and the wood warm as they brighten. The blues stay grey and dark
   * enough never to read as the Wanderer's.
   */
  const RAMPS = {
    sky: ['#05070A', '#090C11', '#0D1218', '#12181F', '#171F28', '#1E2731', '#26303B', '#2F3A45', '#3A4550', '#47515B', '#575F67', '#6B7177', '#83878A'],
    sea: ['#020407', '#05090D', '#091016', '#0D161E', '#121D27', '#182531', '#1F2E3A', '#283844', '#33434E', '#425059', '#566169', '#717A7D', '#949A97', '#BEBFB3', '#E6E1CC', '#FFF8E4'],
    rock: ['#030405', '#07090B', '#0C0F12', '#12161A', '#191E22', '#22272B', '#2C3133', '#393C3B', '#4A4A44', '#5E5A4E', '#776E5A', '#958665'],
    tower: ['#0A0C0F', '#121519', '#1B1F24', '#262A2F', '#33363A', '#424446', '#545552', '#6A685F', '#84806F', '#A29A82', '#C1B796', '#DED3AE', '#F3EACA'],
    wood: ['#060709', '#0C0D0F', '#141412', '#1D1B16', '#29241B', '#373021', '#483D28', '#5D4D30', '#77623A', '#967B47'],
    iron: ['#040506', '#0A0C0E', '#121519', '#1C2025', '#272C32', '#353B42', '#474E55', '#5F656A'],
    weed: ['#040504', '#0A0B07', '#11120C', '#191A10', '#232215', '#2E2C1A', '#3B3920', '#4B4726', '#5E582E'],
    beam: ['#252B33', '#35353A', '#4B4239', '#6A5437', '#8E6A37', '#B88638', '#E3A445', '#F2C67E', '#FBE3AE', '#FFF6DA'],
    lamp: ['#6A3C12', '#B87426', '#EBB45A', '#FFE7A8', '#FFF8E2'],
    bronze: ['#0C0A07', '#1A140C', '#2C2113', '#45321A', '#634722', '#86612E', '#AD8140', '#D6A75C'],
    shadow: ['#020304', '#05070A', '#090C10', '#0F1318'],
    ...CARD,
  };
  const BEAM_HI = '#FBE3AE'; const BEAM_MID = '#E3A445';

  /* ================= A: the lighthouse rocks ================= */

  /**
   * The storm: banks of cloud across the sky, dark in their bodies and
   * hanging in round lumps underneath, their undersides silvered near the
   * lamp. Between them the sky pales toward the horizon. Returns which
   * pixels are cloud, so a beam passing through can light them.
   * banks: [y, thickness, lump width, value], far (low) first.
   */
  function stormSky(p, W, y1, o) {
    const { u, lx, ly, seed = 3 } = o;
    const S = p.ri('sky'); const R = o.reach ?? 80 * u;
    const cloud = new Uint8Array(p.w * p.h);
    const banks = o.banks || [];
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const cx = x + 0.5; const cy = y + 0.5;
      const m = Math.max(0, 1 - Math.hypot((cx - lx) / 2.2, cy - ly) / R); const m2 = m * m;
      let v = o.v0 + (o.v1 - o.v0) * clamp(cy / y1, 0, 1) ** 1.4 + m2 * (o.halo ?? 2);
      let c = 0;
      for (let k = 0; k < banks.length; k += 1) {
        const [by, th, per, bv] = banks[k];
        const top = by - th * (0.45 + 0.55 * billow(cx / per + k * 3.7, seed + k));
        const bot = by + th * 0.4 * (0.25 + 0.75 * billow(cx / (per * 0.5) + k * 1.3, seed + k + 9));
        if (cy < top || cy > bot) continue;
        const up = (bot - cy) / u;
        const rim = up < 1 ? 1 : up < 2.5 ? 0.4 : 0;
        v = bv + m2 * 1.4 + rim * (0.5 + 4.4 * m2) + (cy - top < u ? 0.4 : 0);
        c = 1;
      }
      p.r[i] = S; p.v[i] = v; p.z[i] = 0; cloud[i] = c;
    });
    return cloud;
  }

  /**
   * One of the lighthouse's beams, side-on: a shaft out of the lamp at angle
   * `a`, widening as it goes, in three clean bands with the core brightest,
   * fading along its length. Cloud it passes through lights up. It shows
   * only on the sky (layer 0), so land and the tower cut it.
   */
  function beamShaft(p, lx, ly, a, o) {
    const { len, w0, spread, v, cloud } = o; const fall = o.fall ?? 1.1;
    const B = p.ri('beam'); const ca = Math.cos(a); const sa = Math.sin(a);
    const ex = lx + ca * len; const ey = ly + sa * len; const hw1 = w0 + spread * len;
    const x0 = Math.max(0, Math.floor(Math.min(lx, ex) - hw1)); const x1 = Math.min(p.w - 1, Math.ceil(Math.max(lx, ex) + hw1));
    const y0 = Math.max(0, Math.floor(Math.min(ly, ey) - hw1)); const y1 = Math.min(p.h - 1, Math.ceil(Math.max(ly, ey) + hw1));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = y * p.w + x;
        if (p.z[i] > (o.zMax ?? 0)) continue;
        const dx = x + 0.5 - lx; const dy = y + 0.5 - ly;
        const al = dx * ca + dy * sa; if (al < 0 || al > len) continue;
        const e = Math.abs(dy * ca - dx * sa) / (w0 + spread * al); if (e >= 1) continue;
        const t = al / len;
        const band = e < 0.28 ? 1 : e < 0.62 ? 0.7 : 0.42;
        const val = v * band * (1 - t) ** fall + (cloud && cloud[i] ? 1.3 * (1 - t) : 0);
        if (val < 1.1) continue;
        if (p.r[i] === B && p.v[i] >= val) continue;
        p.r[i] = B; p.v[i] = val;
      }
    }
  }

  /** The glow round the lamp, on the sky. */
  function halo(p, lx, ly, r, v, zMax = 0) {
    const B = p.ri('beam');
    p.each(C.circle(lx, ly, r, 24), (x, y, i) => {
      if (p.z[i] > zMax) return;
      const d = Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.2) / r;
      const val = v * Math.max(0, 1 - d) ** 1.7;
      if (val < 1.1) return;
      if (p.r[i] === B && p.v[i] >= val) return;
      p.r[i] = B; p.v[i] = val;
    });
  }

  /**
   * The lighthouse: a whitewashed tower tapering up from its rock, a gallery
   * with its railing, the lantern room blazing behind its glazing bars, a
   * dark iron cap and vane. Its own lamp lights it from above, so it is
   * palest under the gallery and falls into the dark toward its foot. One
   * window is lit: the keeper is in.
   */
  function lighthouse(p, cx, base, ly, u, o = {}) {
    const z = o.z ?? 3; const hwB = (o.hwB ?? 6.5) * u; const hwT = (o.hwT ?? 4) * u;
    const gal = ly + 3.4 * u; const top = gal + Math.max(1, 1.2 * u);
    p.fill(C.poly([[cx - hwB, base], [cx - hwT, top], [cx + hwT, top], [cx + hwB, base]]), 'tower', (x, y) => {
      const t = clamp((y - top) / (base - top), 0, 1);
      const hw = lerp(hwT, hwB, t); const dx = (x + 0.5 - cx) / hw;
      const course = u >= 0.9 && ((y - top) % (3 * u)) < 1 ? -0.5 : 0;
      return (o.v ?? 9.4) - t * (o.fall ?? 6) - 2.6 * dx * dx + (dx < -0.25 ? 0.6 : 0) + course;
    }, z);
    // Windows up the tower, dark, and one lit.
    const wy = [0.34, 0.62].map((t) => Math.round(lerp(top, base, t)));
    p.fill(C.rect(Math.round(cx), wy[0], 1, Math.max(2, 2 * u)), 'lamp', 2.2, z + 1);
    p.fill(C.rect(Math.round(cx), wy[1], 1, Math.max(2, 2 * u)), 'shadow', 0.5, z + 1);
    p.fill(C.rect(Math.round(cx - 1.2 * u), Math.round(base - 4.2 * u), Math.max(2, Math.round(2.4 * u)), Math.round(4.2 * u)), 'shadow', 0.6, z + 1);
    // The gallery and its railing, black against the lamp.
    const gw = hwT + 1.6 * u;
    p.fill(C.rect(cx - gw, gal, gw * 2, Math.max(1, 1.1 * u)), 'tower', o.galV ?? 10.6, z + 1);
    const rh = Math.max(1, Math.round(1.7 * u));
    p.fill(C.rect(cx - gw, gal - rh, gw * 2, 1), 'iron', 2.2, z + 1);
    for (let x = Math.round(cx - gw); x <= Math.round(cx + gw); x += 2) p.fill(C.rect(x, gal - rh, 1, rh), 'iron', 1.6, z + 1);
    // The lantern room.
    const lw = Math.max(3, Math.round(4.8 * u)); const lt = Math.round(ly - 2.8 * u);
    const lx0 = Math.round(cx - lw / 2);
    p.glow(C.rect(lx0, lt, lw, gal - rh - lt), 'lamp', cx, ly, 3.6 * u, 4.4, 2.4, z + 1);
    if (lw >= 5) for (const x of [lx0, lx0 + lw - 1, Math.round(cx) - (lw % 2 ? 0 : 1) + (lw >= 7 ? 0 : 99)]) p.fill(C.rect(x, lt, 1, gal - rh - lt), 'iron', 1.4, z + 2);
    // The cap and vane.
    const cw = lw / 2 + Math.max(1, 0.7 * u); const ch = Math.max(2, 2.6 * u);
    p.fill(C.poly([[cx - cw, lt], [cx - cw * 0.7, lt - ch * 0.7], [cx, lt - ch], [cx + cw * 0.7, lt - ch * 0.7], [cx + cw, lt]]), 'iron', (x) => 2 + (x < cx ? 0.8 : 0), z + 1);
    p.fill(C.rect(cx - cw, lt - 1, cw * 2, 1), 'iron', 4.2, z + 2);
    p.fill(C.rect(Math.round(cx), Math.round(lt - ch - 2.2 * u), 1, Math.round(2.2 * u)), 'iron', 2.6, z + 1);
    return { gal, top };
  }

  /**
   * Open sea in perspective, from the horizon at yH down to y1: rows of
   * waves crowding together toward the horizon. Down each row: the wave's
   * back, paling as it rises to a bright broken crest; the dark face under
   * the crest. Whitecaps break along some crests, longer toward us, their
   * foam spilling down the face. A light at refl.x is laid on the wave
   * backs below it in broken gold dashes, widening toward us.
   */
  function seaRows(p, x0, x1, yH, y1, o) {
    const { u, seed = 1, z = 1 } = o;
    const S = p.ri('sea'); const B = p.ri('beam');
    const d0 = (o.d0 ?? 2) * u; const rows = o.rows ?? 3;
    const R = o.refl; const capPx = o.capPx ?? 2.4;
    for (let y = Math.max(0, Math.floor(yH)); y < Math.min(p.h, Math.ceil(y1)); y += 1) {
      const d = y + 0.5 - yH; if (d <= 0) continue;
      const t = clamp(d / (y1 - yH), 0, 1);
      const dq = rows / (d0 + d);
      const sc = (3 + 20 * t + 24 * t * t) * u;
      const base = lerp(o.vFar, o.vNear, Math.sqrt(t));
      const rw = R ? lerp(R.w0, R.w1, t ** (R.pow ?? 0.85)) * u : 0;
      const rOff = R ? (n1(y * 0.41, seed + 8) - 0.5) * rw * 0.5 : 0;
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(p.w, Math.ceil(x1)); x += 1) {
        const i = y * p.w + x;
        if (o.under !== undefined && p.z[i] > o.under) continue;
        const q = Math.log(1 + d / d0) * rows + Math.sin(x / sc * 1.3 + seed) * 0.12 + (n1(x / (sc * 1.7), seed) - 0.5) * 0.7;
        const k = Math.floor(q); const f = q - k;
        const py = (f - 0.6) / dq; const face = 0.4 / dq;
        const seg = n1(x / (sc * 0.55) + k * 7.31, seed + 3);
        const cap = seg > o.capAt;
        let v = base; let r = S;
        if (py >= 0 && py < 1) v = cap ? o.cap : base + (seg > 0.3 ? o.crest + t * 1.6 : 0.9);
        else if (cap && py >= 1 && py < 1 + capPx * t) v = o.cap - 1.4 - (py - 1) * 0.6;
        else if (py >= 0) v = base - o.face * (py < face * 0.55 ? 1 : 0.5);
        else {
          v = base + o.back * clamp(1 + (py * dq) / 0.6, 0, 1) ** 2;
          // Foam lace: thin marbled streaks lying on the wave backs.
          if (o.lace && Math.abs(n2(x / (sc * 0.8), q * 1.7 + k * 3.1, seed + 11) - 0.5) < o.lace * (0.35 + t)) v += 2 + t * 1.4;
          else if (hash(x, y, seed + 9) < 0.014 * (0.3 + t)) v += 2;
        }
        // The light laid on the water: short gold dashes on the wave backs, thinning toward the path's edges.
        if (R && py < 1 && t < (R.end ?? 2)) {
          const dx = x + 0.5 - R.x - rOff;
          if (Math.abs(dx) < rw) {
            const e = Math.abs(dx) / rw;
            const len = (1 + 3.2 * t) * u * (0.6 + hash(y, 1, seed) * 0.8);
            const id = Math.floor((dx + 999 + hash(y, 2, seed) * len) / len);
            if (hash(id, y, seed + 5) > 0.16 + e * 0.6 - (py >= 0 ? 0.25 : 0)) {
              r = B; v = R.v * (1 - t * (R.fade ?? 0.4)) * (e < 0.3 ? 1 : e < 0.62 ? 0.74 : 0.5) + (py >= 0 ? 0.8 : 0);
              if (v < 1.6) { r = S; v = base + 1.4; }
            }
          }
        }
        p.r[i] = r; p.v[i] = v; p.z[i] = z;
      }
    }
  }

  /**
   * Foam heaped where a wave breaks: flattened lumps along a run, highest in
   * the middle, sitting on the water at `by`, each lit on top and grey
   * underneath. `v` is its lit top.
   */
  function foam(p, cx, by, hw, h, o) {
    const { u, z = 4, seed = 1 } = o; const r = rng(seed);
    const n = Math.max(3, Math.round((hw * 2) / (2.4 * u) * (o.dense ?? 1)));
    const puffs = [];
    for (let k = 0; k < n; k += 1) {
      const t = r(); const lift = 1 - Math.abs(t - 0.5) * 2;
      const rad = (o.r0 ?? 1) * u + (r() * 1.2 + lift * (o.swell ?? 1.4)) * u;
      puffs.push([cx + (t - 0.5) * 2 * hw, by - lift ** 0.8 * h * (0.4 + 0.6 * r()), rad]);
    }
    puffs.sort((a, b) => a[1] - b[1]);
    const ramp = o.ramp || 'sea'; const wide = o.wide ?? 1.6; const step = o.step ?? 1.3;
    const R = p.ri(ramp); const floorY = by + (o.sink ?? 0.6) * u;
    puffs.forEach(([x, y, rad], j) => {
      const rx = rad * wide;
      // A ragged lump: its outline broken by the spray, never a clean ball.
      p.each(C.rect(x - rx * 1.2, y - rad * 1.2, rx * 2.4, rad * 2.4), (px, py, i) => {
        if (py + 0.5 > floorY) return;
        const dx = (px + 0.5 - x) / rx; const dy = (py + 0.5 - y) / rad;
        const rr = 0.78 + 0.4 * n1(Math.atan2(dy, dx) * 2.4 + j * 5.3, seed + 5) - (dy < 0 ? 0.12 * hash(px, py, seed + 6) : 0);
        if (dx * dx + dy * dy > rr * rr) return;
        const k = ((y - py - 0.5) + (x - px - 0.5) * (o.side ?? 0.25)) / rad;
        p.r[i] = R; p.z[i] = z; p.v[i] = o.v + (k > 0.42 ? 0 : k > -0.25 ? -step : -step * 2.2);
      });
      // Droplets flung off its top.
      if (rad > 1.6 * u) {
        for (let q = 0; q < 4; q += 1) {
          const a = -Math.PI * (0.15 + 0.7 * hash(q, j, seed + 7)); const d = 1.1 + hash(q, j, seed + 8) * 0.7;
          const qx = Math.round(x + Math.cos(a) * rx * d); const qy = Math.round(y + Math.sin(a) * rad * d);
          if (qx < 0 || qy < 0 || qx >= p.w || qy >= p.h) continue;
          const i = qy * p.w + qx; if (p.z[i] > z) continue;
          p.r[i] = R; p.z[i] = z; p.v[i] = o.v - step * 0.8;
        }
      }
    });
    // A dark line of water under the foam where it sits.
    if (o.base !== false) {
      const yb = Math.round(by + (o.sink ?? 0.6) * u);
      for (const [x, y, rad] of puffs) if (y + rad > by - 0.5 * u) p.fill(C.rect(x - rad * wide * 0.8, yb, rad * wide * 1.6, 1), 'sea', o.baseV ?? 1.6, z);
    }
  }

  /**
   * A ship's lantern: a squat iron cage with a cap and a ring, its glass
   * glowing round the flame, its light thrown on everything near it.
   */
  function lantern(p, x, y, u, o = {}) {
    const z = o.z ?? 6; const s = o.s ?? 1;
    const w = Math.max(3, Math.round(4 * u * s)); const h = Math.max(4, Math.round(5 * u * s));
    const x0 = Math.round(x - w / 2); const y0 = Math.round(y - h / 2);
    p.glow(C.rect(x0, y0, w, h), 'lamp', x, y, Math.max(w, h) * 0.75, 4.4, 2.2, z);
    p.fill(C.rect(x0 - 1, y0 + h, w + 2, 1), 'iron', 2.2, z + 1);
    p.fill(C.rect(x0 - 1, y0, 1, h), 'iron', 2.4, z + 1); p.fill(C.rect(x0 + w, y0, 1, h), 'iron', 2.4, z + 1);
    if (w >= 5) p.fill(C.rect(Math.round(x0 + w / 2), y0, 1, h), 'iron', 1.6, z + 1);
    const ch = Math.max(2, Math.round(2 * u * s));
    p.fill(C.poly([[x0 - 1, y0], [x0 + w + 1, y0], [x0 + w / 2 + 0.5, y0 - ch]]), 'iron', 2.8, z + 1);
    p.fill(C.rect(Math.round(x0 + w / 2), y0 - ch - 2, 1, 2), 'iron', 2.4, z + 1);
    if (o.light !== false) {
      p.light(x, y, (o.r ?? 40) * u, o.k ?? 5.4, o.flick ? flicker(o.phase ?? 0, 0.12, 0.8) : null, { zMin: 1, hard: true });
      p.light(x, y, (o.r2 ?? 80) * u, o.k2 ?? 1.2, null, { zMin: 1 });
    }
  }

  /** A mass of rock: its cells lit from above. */
  function rocks(p, shape, o) {
    p.fill(shape, 'rock', o.v, o.z);
    p.cells(shape, { size: o.size, sx: o.sx ?? 1.5, sy: o.sy ?? 0.8, joint: o.joint ?? 0.7, jointV: o.jointV ?? -1.1, vary: o.vary ?? 0.7, bevel: o.bevel ?? 0.8, lit: o.lit || [0.3, -1], seed: o.seed, z: o.z });
  }

  /**
   * The wreck: a hull run up on the rocks, its bow lifted, its stern half
   * stripped to the ribs so the surf shows through them, a broken mast
   * leaning with a yard still across it and a rag of sail. Black against the
   * foam, the edges toward the lighthouse catching the light.
   * s: the hull's length; dir: 1 if its bow points right.
   */
  function wreck(p, cx, wy, s, o) {
    const z = o.z ?? 5; const dir = o.dir ?? 1; const th = o.heel ?? -0.16; const v = o.v ?? 1.0;
    const ca = Math.cos(th); const sa = Math.sin(th);
    // Hull coordinates: x along it, the bow at +0.5; y up is negative.
    const T = (x, y) => [cx + (x * ca - y * sa) * s * dir, wy + (x * sa + y * ca) * s];
    const keel = (x) => (x > 0.28 ? -(x - 0.28) * 0.55 : 0);
    const sheer = (x) => -0.2 - 0.03 * x - 0.26 * Math.max(0, x) ** 2;
    // The bow half, still planked: its torn end ragged, its strakes running along it.
    const bow = []; const aft = -0.1;
    for (let k = 0; k <= 14; k += 1) { const x = aft + (k / 14) * (0.5 - aft); bow.push(T(x, sheer(x))); }
    for (let k = 14; k >= 0; k -= 1) { const x = aft + (k / 14) * (0.48 - aft); bow.push(T(x, keel(x))); }
    for (let k = 1; k < 6; k += 1) { const y = lerp(keel(aft), sheer(aft), k / 6); bow.push(T(aft - (hash(k, 2, 7) * 0.08), y)); }
    p.fill(C.poly(bow), 'wood', v, z);
    p.shade(C.poly(bow), (x, y) => {
      // Strakes: lines along the hull, the planking between them.
      const ly = (y - wy) / s * ca - (x - cx) * dir / s * sa;
      return frac(ly / 0.045) < 0.3 ? -0.5 : 0.25;
    }, z);
    // The bowsprit, and the stem's lit edge.
    const [bx0, by0] = T(0.48, sheer(0.48)); const [bx1, by1] = T(0.66, sheer(0.48) - 0.1);
    line(p, bx0, by0, bx1, by1, 'wood', v + 0.4, z);
    // The stern half, stripped: the keel, a stump of gunwale and the bare ribs standing.
    const kw = Math.max(1, Math.round(s * 0.03));
    for (let k = 0; k <= 24; k += 1) { const x = -0.5 + (k / 24) * (aft + 0.5); const [ax, ay] = T(x, keel(x)); p.fill(C.rect(Math.round(ax), Math.round(ay) - kw + 1, 1, kw), 'wood', v, z); }
    const step = Math.max(2.4, 2.6 * (o.u || 1)) / s; let k = 0;
    for (let x = aft - step; x > -0.48; x -= step, k += 1) {
      const broke = hash(k, 1, 9);
      const top = lerp(keel(x), sheer(x), broke < 0.25 ? 0.6 : broke < 0.5 ? 1.15 : 1.3 + hash(k, 2, 9) * 0.35);
      const [ax, ay] = T(x, keel(x)); const [gx, gy] = T(x - 0.025, top);
      line(p, ax, ay, gx, gy, 'wood', v + 0.2, z);
    }
    // The mast: snapped, leaning aft, the stub of a yard across it.
    const ml = o.mast ?? 0.6; const mx = 0.08; const lean = o.lean ?? -0.3;
    const [m0x, m0y] = T(mx, sheer(mx)); const [m1x, m1y] = T(mx + Math.sin(lean) * ml, sheer(mx) - Math.cos(lean) * ml);
    line(p, m0x, m0y, m1x, m1y, 'wood', v + 0.4, z);
    const [yx, yy] = [lerp(m0x, m1x, 0.74), lerp(m0y, m1y, 0.74)];
    const ya = (th + (o.yard ?? 0.35)) * dir; const yl = s * 0.16;
    line(p, yx - Math.cos(ya) * yl, yy - Math.sin(ya) * yl * dir, yx + Math.cos(ya) * yl, yy + Math.sin(ya) * yl * dir, 'wood', v + 0.3, z);
    // One slack stay from the masthead to the bowsprit, where it shows at all.
    const sag = (a, b2, t) => lerp(a, b2, t);
    for (let q = 0; q <= 16 && o.stay !== false; q += 1) {
      const t = q / 16; const x = sag(m1x, bx1, t); const y = sag(m1y, by1, t) + Math.sin(t * Math.PI) * s * 0.06;
      p.fill(C.rect(Math.round(x), Math.round(y), 1, 1), 'wood', v, z);
    }
    return { mast: [m1x, m1y], bow: [bx1, by1] };
  }

  /**
   * The merrow: a hulking fish-man risen out of the surf to the waist, a
   * spined fin standing up off its skull, frills at its jaw, one webbed claw
   * hanging, the other raising a trident. Black against the light; its eyes
   * the card's red.
   */
  function merrow(p, cx, wy, s, ramp, z) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, wy + y * s]));
    const b = 0.3;
    // A broad back and shoulders tapering to the waist, the head hunched low between them.
    p.fill(P([[-0.2, 0.06], [-0.22, -0.2], [-0.3, -0.42], [-0.38, -0.56], [-0.32, -0.66], [-0.16, -0.7], [-0.12, -0.78], [-0.11, -0.87], [-0.04, -0.93], [0.06, -0.93],
      [0.12, -0.87], [0.13, -0.78], [0.17, -0.7], [0.33, -0.66], [0.39, -0.56], [0.31, -0.42], [0.23, -0.2], [0.21, 0.06]]), 'shadow', b, z);
    // The fin on its skull: three long spines and the web between, and a ridge of them down its back.
    p.fill(P([[-0.1, -0.88], [-0.19, -1.06], [-0.07, -0.96], [-0.03, -1.17], [0.03, -0.97], [0.1, -1.12], [0.12, -0.95], [0.2, -1.02], [0.14, -0.86]]), 'shadow', b, z);
    // Frills at the jaw, spread like a fish's gills.
    for (const m of [-1, 1]) p.fill(P([[0.1 * m, -0.88], [0.3 * m, -0.97], [0.23 * m, -0.86], [0.31 * m, -0.82], [0.21 * m, -0.78], [0.26 * m, -0.72], [0.12 * m, -0.75]]), 'shadow', b, z);
    // The left arm hanging well clear of the body, elbow out, a fin on the forearm, its webbed claw spread.
    p.fill(P([[-0.33, -0.66], [-0.5, -0.6], [-0.62, -0.44], [-0.66, -0.26], [-0.65, -0.08], [-0.57, -0.08], [-0.57, -0.26], [-0.53, -0.42], [-0.4, -0.52]]), 'shadow', b, z);
    p.fill(P([[-0.66, -0.4], [-0.76, -0.36], [-0.67, -0.28]]), 'shadow', b, z);
    p.fill(P([[-0.67, -0.09], [-0.75, 0.03], [-0.67, -0.02], [-0.65, 0.06], [-0.61, -0.02], [-0.56, 0.05], [-0.56, -0.09]]), 'shadow', b, z);
    // The right arm raised, gripping the trident.
    p.fill(P([[0.33, -0.66], [0.48, -0.7], [0.58, -0.84], [0.6, -0.97], [0.53, -0.98], [0.51, -0.85], [0.44, -0.77], [0.36, -0.57]]), 'shadow', b, z);
    const tx = Math.round(cx + 0.56 * s); const tTop = wy - 1.36 * s;
    p.fill(C.rect(tx, tTop, 1, wy + 0.1 * s - tTop), 'shadow', b + 0.6, z);
    const cb = Math.round(wy - 1.2 * s); const tw = Math.max(2, Math.round(0.1 * s));
    p.fill(C.rect(tx - tw, cb, tw * 2 + 1, 1), 'shadow', b + 0.6, z);
    for (const dx of [-tw, tw]) p.fill(C.rect(tx + dx, Math.round(tTop + 0.05 * s), 1, cb - Math.round(tTop + 0.05 * s)), 'shadow', b + 0.6, z);
    for (const dx of [-tw, 0, tw]) p.fill(C.rect(tx + dx - (dx < 0 ? 1 : 0), Math.round(tTop + (dx ? 0.05 : 0) * s), 2, 1), 'shadow', b + 0.6, z);
    // Its eyes.
    const ey = Math.round(wy - 0.83 * s); const ex = Math.max(1, Math.round(s * 0.05));
    p.fill(C.rect(Math.round(cx) - ex - 1, ey, 2, 1), ramp, 4, z + 2);
    p.fill(C.rect(Math.round(cx) + ex, ey, 2, 1), ramp, 4, z + 2);
    return { ex: cx, ey };
  }

  /**
   * A beachcomber, bowed under a sack, a long gaff over his shoulder, his
   * lantern held out low before him. Black against the light. Returns where
   * the lantern hangs.
   */
  function beachcomber(p, cx, fy, s, z) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    const b = 0.5;
    p.fill(P([[-0.24, 0], [-0.21, -0.3], [-0.2, -0.55], [-0.17, -0.7], [-0.12, -0.79], [-0.04, -0.85], [0.06, -0.83], [0.12, -0.74], [0.17, -0.6], [0.2, -0.36], [0.27, 0]]), 'shadow', b, z);
    p.fill(P([[-0.16, -0.78], [-0.17, -0.9], [-0.09, -0.98], [0.02, -0.98], [0.08, -0.9], [0.07, -0.79]]), 'shadow', b, z);
    p.fill(C.ellipse(cx + 0.2 * s, fy - 0.66 * s, 0.16 * s, 0.19 * s), 'shadow', b + 0.3, z);
    line(p, cx - 0.1 * s, fy - 0.2 * s, cx + 0.4 * s, fy - 1.22 * s, 'shadow', b + 0.8, z);
    line(p, cx + 0.4 * s, fy - 1.22 * s, cx + 0.48 * s, fy - 1.18 * s, 'shadow', b + 0.8, z);
    line(p, cx + 0.48 * s, fy - 1.18 * s, cx + 0.48 * s, fy - 1.1 * s, 'shadow', b + 0.8, z);
    p.fill(P([[-0.15, -0.68], [-0.36, -0.5], [-0.38, -0.45], [-0.32, -0.46], [-0.12, -0.6]]), 'shadow', b, z);
    return { lx: Math.round(cx - 0.37 * s), ly: Math.round(fy - 0.42 * s) };
  }

  /** A sea chest washed up: iron-bound, its lid burst open, weed hanging off it, the card's light inside. */
  function seaChest(p, cx, fy, s, ramp, z) {
    const w = s * 0.62; const h = s * 0.4;
    p.fill(C.poly([[cx - w * 0.95, fy - h], [cx - w * 0.85, fy - h - s * 0.4], [cx + w * 0.8, fy - h - s * 0.44], [cx + w * 0.92, fy - h]]), 'wood', 3.6, z);
    p.fill(C.rect(cx - w * 0.82, fy - h - s * 0.36, w * 1.6, 1), 'iron', 3, z + 1);
    p.glow(C.rect(cx - w * 0.86, fy - h - s * 0.12, w * 1.72, s * 0.14), ramp, cx, fy - h - s * 0.05, w, 4, 2.2, z + 1);
    p.fill(C.rect(cx - w, fy - h, w * 2, h), 'wood', (x, y) => 5.4 - (y - (fy - h)) / h * 2.2 + ((x - cx + w) % (s * 0.22) < 1 ? -1 : 0), z);
    p.fill(C.rect(cx - w, fy - h, w * 2, 1.4), 'wood', 6.8, z + 1);
    for (const x of [cx - w * 0.68, cx + w * 0.68 - 2]) p.fill(C.rect(x, fy - h, 2, h), 'iron', 2.6, z + 1);
    p.fill(C.rect(cx - 1.5, fy - h + 2, 3, 3), 'iron', 3.8, z + 1);
    // Weed draped over its corner, and a strand down its front.
    p.fill(C.poly([[cx - w, fy - h - 1], [cx - w * 0.55, fy - h - 1], [cx - w * 0.7, fy - h * 0.55], [cx - w * 0.8, fy - h * 0.2], [cx - w * 0.92, fy - h * 0.6]]), 'weed', 3.2, z + 1);
    p.fill(C.rect(cx + w * 0.3, fy - h, 1, h * 0.7), 'weed', 3, z + 1);
    for (const [ox, oy] of [[-0.3, -0.24], [0.12, -0.3], [0.36, -0.2], [-0.06, -0.17]]) p.fill(C.rect(cx + ox * s, fy - h + oy * s, 1, 1), ramp, 4.6, z + 2);
  }

  /**
   * A great wave breaking across the way: its face rising out of the sea on
   * the right, the lip thrown over to the left and falling, the hollow dark
   * under it, foam bursting where it lands. In the card's colour.
   */
  function breaker(p, cx, fy, s, ramp, z, u) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    const shape = P([[1.1, 0], [0.9, -0.12], [0.62, -0.42], [0.42, -0.78], [0.2, -0.98], [-0.04, -1.04], [-0.26, -0.96], [-0.42, -0.78], [-0.5, -0.58],
      [-0.46, -0.5], [-0.36, -0.62], [-0.2, -0.72], [-0.06, -0.7], [0.06, -0.58], [0.1, -0.36], [0.02, -0.12], [-0.3, 0]]);
    p.fill(shape, ramp, (x, y) => {
      const lx = (x - cx) / s; const ly = (fy - y) / s;
      const curve = lx * 0.9 + ly * 0.6;
      const streak = frac(curve * 9 + n1(ly * 6, 3) * 0.6) < 0.18 ? 0.6 : 0;
      return ly > 0.86 ? 3.6 : (lx > 0.15 ? 1.9 - (lx - 0.15) * 0.8 : 2.4 - ly * 0.6) + streak;
    }, z);
    // The hollow under the lip.
    p.fill(P([[-0.38, -0.6], [-0.2, -0.69], [-0.06, -0.67], [0.05, -0.56], [0.08, -0.36], [0.0, -0.16], [-0.2, -0.2], [-0.34, -0.4]]), ramp, 0.6, z);
    // The lip's edge, white.
    p.fill(P([[-0.04, -1.04], [-0.26, -0.96], [-0.42, -0.78], [-0.5, -0.58], [-0.46, -0.52], [-0.38, -0.72], [-0.22, -0.9], [0.02, -0.98], [0.2, -0.96]]), ramp, 4, z + 1);
    foam(p, cx - 0.32 * s, fy + 0.02 * s, 0.42 * s, 0.34 * s, { u, z: z + 2, seed: 41, v: 4, ramp, step: 1, swell: 2.2, dense: 1.3 });
    foam(p, cx + 0.62 * s, fy + 0.04 * s, 0.4 * s, 0.1 * s, { u, z: z + 2, seed: 42, v: 3.6, ramp, step: 1, swell: 1 });
  }

  const BUOY = { a: '#0E1114', b: '#3A3F44', c: '#B88638', d: '#FFE7A8' };
  const BUOY_ROWS = [
    ['..d..', '..c..', '.a.a.', '.aca.', 'a...a', 'aaaaa', 'abbba', '.aaa.'],
    ['...d.', '..c..', '.a.a.', '.aca.', 'a...a', 'aaaaa', 'abbba', '.aaa.'],
    ['.d...', '..c..', '.a.a.', '.aca.', 'a...a', 'aaaaa', 'abbba', '.aaa.'],
  ];
  const GULL = [
    ['a.....a', '.a...a.', '..a.a..', '...a...'],
    ['.......', 'aa...aa', '..aaa..', '...a...'],
    ['.......', '.......', 'aaaaaaa', '...a...'],
  ];
  const GULL_S = [['a...a', '.a.a.', '..a..'], ['.....', 'aa.aa', '..a..'], ['.....', '.....', 'aaaaa']];

  /** Rain: short slanting streaks, glittering gold where they cross a beam. */
  function rain(img, p, n, t, seed, o = {}) {
    const B = p.ri('beam'); const L = p.ri('lamp');
    const W = img.width; const H = img.height; const sl = o.slant ?? 0.45; const len = o.len ?? 3;
    for (let i = 0; i < n; i += 1) {
      const sp = 0.8 + hash(i, 1, seed) * 0.5;
      const y0 = (hash(i, 2, seed) * (H + 20) + t * 70 * sp) % (H + 20) - 10;
      const x0 = ((hash(i, 3, seed) * (W + 40) - y0 * sl + t * 6) % (W + 40) + W + 40) % (W + 40) - 20;
      for (let k = 0; k < len; k += 1) {
        const x = Math.round(x0 - k * sl); const y = Math.round(y0 - k);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * p.w + x;
        const lit = p.r[j] === B || p.r[j] === L;
        if (lit) put(img, x, y, BEAM_HI, (0.75 - k * 0.15) * Math.min(1, p.v[j] / 4));
        else if (!o.litOnly) put(img, x, y, '#6B7177', (o.dim ?? 0.22) - k * 0.05);
      }
    }
  }

  /** Gulls wheeling: each on its own slow loop, flapping, pale where the beam catches them. */
  function gulls(img, p, list, t, small) {
    const B = p.ri('beam');
    list.forEach(([x, y, rx, ry, ph], i) => {
      const a = t * 0.35 + ph; const gx = Math.round(x + Math.cos(a) * rx); const gy = Math.round(y + Math.sin(a * 1.3) * ry);
      const j = clamp(gy, 0, p.h - 1) * p.w + clamp(gx, 0, p.w - 1);
      const col = p.r[j] === B ? '#FFF6DA' : '#8A9094';
      const fr = Math.floor(t * 5 + i * 1.7) % 4;
      sprite(img, gx, gy, (small ? GULL_S : GULL)[[0, 1, 2, 1][fr]], { a: col }, Math.cos(a) < 0);
    });
  }

  /** Spray thrown up off the rocks: bursts that rise and fall back, each on its own beat. */
  function spray(img, sites, t, u, hot) {
    sites.forEach(([x, y, w, hgt, ph, lit], s) => {
      const life = frac(t * 0.45 + ph);
      if (life > 0.7) return;
      const lt = life / 0.7;
      for (let k = 0; k < 10; k += 1) {
        const vx = (hash(k, s, 7) - 0.5) * w; const up = (0.5 + hash(k, s, 8) * 0.5) * hgt;
        const px = x + vx * lt; const py = y - up * (4 * lt * (1 - lt));
        put(img, px, py, lit ? hot : '#949A97', (1 - lt) * 0.95);
      }
    });
  }

  /**
   * The tidal shelf seen from above, running out to the sea at its top: beds
   * of rock in perspective, each bed's far lip wet and catching the light
   * with a dark crack beyond it, split by joints that run out to the sea,
   * fringed with weed and specked with barnacles. Pools lie in the hollows,
   * their far rims bright. Returns each pixel's kind (1 a lip, 2 a pool,
   * 3 a pool's bright rim) for the beam to find.
   */
  function shelf(p, y0, y1, o) {
    const { u, vx, vy, d0, rows, cols, seed = 1 } = o; const W = p.w;
    const S = p.ri('rock'); const Wt = p.ri('sea'); const Wd = p.ri('weed');
    const kind = new Uint8Array(W * p.h);
    for (let y = Math.max(0, y0); y < Math.min(p.h, y1); y += 1) {
      const d = y + 0.5 - vy; const db = rows / d; const bedPx = 1 / db;
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        const X = (x + 0.5 - vx) / d;
        const b0 = Math.log(d / d0) * rows + (n1(X * 9 + 3, seed) - 0.5) * 0.9 + (n1(X * 31, seed + 1) - 0.5) * 0.3;
        const b = b0 + (hash(Math.floor(X * 46), 0, seed + 12) - 0.5) * 0.2;
        const k = Math.floor(b); const g = (b - k) / db;
        const sw = 1 + hash(k, 0, seed) * 0.7;
        const c = X * cols * sw + hash(k, 1, seed) * 7 + (n1(b * 2.3, seed + 2) - 0.5) * 0.4;
        const ci = Math.floor(c); const cf = (c - ci) * (d / (cols * sw));
        const slab = hash(ci, k, seed + 3);
        p.z[i] = 1; p.r[i] = S;
        let v = (o.v ?? 2.5) + (slab - 0.5) * 0.5 + (hash(k, 5, seed) - 0.5) * 0.4 + (hash(x >> 1, y >> 1, seed + 10) - 0.5) * 0.5 - (hash(x, y, seed + 11) < 0.04 ? 0.8 : 0);
        if (g < 1) { v += o.lip ?? 2.2; kind[i] = 1; }
        else if (g < 2) v += 0.7;
        else if (g > bedPx - 1.2) v = 0.4;
        else if (cf < 1 && hash(ci, k, seed + 4) < 0.6) v -= 1.1;
        else if (cf < 2) v += 0.35;
        else if (slab > 0.8 && g < bedPx * 0.5 * (0.55 + 0.45 * hash(x, k, seed + 6))) {
          p.r[i] = Wd; v = 2.4 + (hash(x, y >> 1, seed + 7) < 0.4 ? -0.9 : 0);
        }
        if (p.r[i] === S && g < 4 && hash(x, y, seed + 8) < 0.05) v += 1.5;
        p.v[i] = v;
      }
    }
    (o.pools || []).forEach(([px, py, rx, ry], j) => {
      // An irregular pool: its outline wanders; inside, still water paling toward its far rim, which shines.
      const R0 = (x, y) => {
        const dx = (x + 0.5 - px) / rx; const dy = (y + 0.5 - py) / ry;
        return [dx, dy, 0.78 + 0.3 * n1(Math.atan2(dy, dx) * 1.6 + j * 3.1, seed + 9)];
      };
      const inside = (x, y) => { const [dx, dy, rr] = R0(x, y); return dx * dx + dy * dy <= rr * rr; };
      p.each(C.rect(px - rx * 1.2, py - ry * 1.2, rx * 2.4, ry * 2.4), (x, y, i) => {
        if (y < y0 || !inside(x, y)) return;
        const above = y > 0 && inside(x, y - 1); const below = inside(x, y + 1);
        p.r[i] = Wt; p.z[i] = 1; kind[i] = 2;
        const [, dy] = R0(x, y);
        if (!above) { p.v[i] = 5; kind[i] = 3; } else if (!below) p.v[i] = 0.8; else p.v[i] = 1.3 + (1 - (dy + 1) / 2) * 1.3;
      });
    });
    return kind;
  }

  const A = {
    job: 0, setting: 'drowned-coast', key: 'A', id: 'drowned-coast-a', side: 'outside',
    name: 'The Drowned Coast', title: 'The lighthouse rocks',
    pitch: 'A storm on a wrecking coast at night. Out on its rock the lighthouse throws its gold beam through the rain, the surf bursts white on the reef, and a ship lies broken on the rocks where the light came too late.',
    notes: [
      ['Light', 'The lighthouse is the only lamp: its beam cuts gold through the rain and the storm cloud, its glow lights the surf round its rock, and its light lies broken on the waves below it. Everything else is storm blue and black.'],
      ['Detail', 'Waves in rows with sharp broken crests and whitecaps, foam heaped where they break, a wreck stripped to its ribs with the surf showing through, a bell buoy rocking, gulls in the beam, rain that only shows where the light catches it.'],
      ['Vista', 'The coast the width of the board: headlands, sea stacks, the wreck with its mast across the beam, the bell buoy. The card stands on the rock ledge in front of us, black against the lamp’s gold path on the water. For an Obstacle a wave breaks right over the ledge; for a Clear Path the beam swings round onto us and the gold path floods to our feet.'],
      ['World', 'The tidal shelf under the table: beds of black wet rock with lit lips, rock pools, weed and barnacles, a spar and a barrel from the wreck, and the wreckers’ lantern on its pole at the edge. The surf breaks just under the vista, and the beam sweeps across, flashing in the pools as it goes.'],
    ],
    palette: ['#05070A', '#171F28', '#2F3A45', '#121D27', '#425059', '#BEBFB3', '#22272B', '#B88638', '#FBE3AE'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['beam', 'lamp'], dither: 0.2 });
      const u = H / 134;
      const yH = 76 * u; const lx = Math.round(41 * u); const ly = Math.round(37 * u);
      const cloud = stormSky(p, W, yH + 1, {
        u, lx, ly, v0: 0.6, v1: 4.4, halo: 2.4, reach: 60 * u, seed: 5,
        banks: [[70, 3, 9, 3.2], [60, 5, 13, 2.6], [46, 6, 17, 2.0], [26, 8, 20, 1.5], [6, 10, 24, 1.1]].map(([y, th, per, v]) => [y * u, th * u, per * u, v]),
      });
      beamShaft(p, lx, ly, 0.2, { len: 90 * u, w0: 1.6 * u, spread: 0.2, v: 9, cloud, fall: 0.9 });
      beamShaft(p, lx, ly, Math.PI + 0.12, { len: 60 * u, w0: 1 * u, spread: 0.07, v: 6.4, cloud });
      halo(p, lx, ly, 13 * u, 8.8);
      // The sea, its rows crowding to the horizon, the lamp laid on it in broken gold.
      seaRows(p, 0, W, yH, 128 * u, { u, seed: 4, d0: 1.4, rows: 3.3, vFar: 6.2, vNear: 2.4, crest: 3.6, cap: 11.6, capAt: 0.68, capPx: 2.4, face: 1.7, back: 1.5, lace: 0.03, refl: { x: lx, w0: 1.4, w1: 10, v: 7.6, pow: 0.75, fade: 1.6, end: 0.56 } });
      p.light(lx, yH + 3 * u, 30 * u, 2.6, null, { zMin: 1, zMax: 1, sy: 0.4 });
      // A far headland on the left horizon.
      rocks(p, skyline(0, 24 * u, yH + 2 * u, (x) => yH - 6 * u + x * 0.2 + (n1(x / 2.5, 2) - 0.5) * 2 * u, 1), { v: 1.6, z: 2, size: 4 * u, seed: 3 });
      wetTop(p, 2, 1.2);
      // The lighthouse rock, the surf bursting round it.
      const rk = skyline(lx - 16 * u, lx + 15 * u, yH + 3 * u, (x) => yH - 2 * u - 7 * u * Math.exp(-(((x - lx) / (8 * u)) ** 2)) + (hash(Math.floor(x / 2), 1, 3) - 0.5) * 2 * u, 1);
      rocks(p, rk, { v: (x, y) => 2.4 - (y - (yH - 9 * u)) / (12 * u) * 1.6, z: 2, size: 3 * u, seed: 7, lit: [-0.2, -1] });
      p.light(lx, yH - 9 * u, 16 * u, 3.6, null, { zMin: 2, zMax: 2 });
      lighthouse(p, lx, yH - 7 * u, ly, u, { z: 3, hwB: 5.6, hwT: 3.6, fall: 5.6 });
      foam(p, lx - 10 * u, yH + 1 * u, 7 * u, 6 * u, { u, z: 4, seed: 11, v: 13.8, swell: 2.2, wide: 1.3 });
      foam(p, lx + 11 * u, yH + 1.5 * u, 6 * u, 3.5 * u, { u, z: 4, seed: 12, v: 12.6, wide: 1.4 });
      // The wreck on the reef to the right, the surf breaking white behind its ribs.
      foam(p, 78 * u, 94 * u, 17 * u, 13 * u, { u, z: 4, seed: 13, v: 12.6, swell: 3, wide: 1.2, dense: 1.4 });
      const reef = skyline(50 * u, 98 * u, 104 * u, (x) => 95 * u + (hash(Math.floor(x / 3), 2, 5) - 0.5) * 3 * u - Math.max(0, 1 - Math.abs(x - 72 * u) / (18 * u)) * 3 * u, 2);
      rocks(p, reef, { v: 1.8, z: 5, size: 4 * u, seed: 9, lit: [-0.6, -0.8] });
      wetTop(p, 5, 1.4);
      wreck(p, 70 * u, 97 * u, 38 * u, { u, z: 6, dir: -1, heel: -0.32, mast: 1.2, lean: -0.15, v: 1.0 });
      edge(p, 6, -1, 0, 'wood', 4); edge(p, 6, 0, -1, 'wood', 3.4);
      foam(p, 62 * u, 101 * u, 17 * u, 2.4 * u, { u, z: 7, seed: 14, v: 11.4, swell: 1, wide: 1.8 });
      // The foreground rocks we stand among, a pool in them holding the light.
      const fg = skyline(0, W, H + 1, (x) => {
        const d = Math.abs(x - 46 * u);
        return 116 * u + (n1(x / (6 * u), 8) - 0.5) * 5 * u - Math.max(0, d - 20 * u) * 0.32 + (hash(Math.floor(x / 2), 3, 9) - 0.5) * 1.6 * u;
      }, 1);
      rocks(p, fg, { v: (x, y) => 2.2 - (y - 100 * u) / (34 * u) * 1.6, z: 8, size: 6 * u, seed: 21, lit: [-0.3, -1] });
      wetTop(p, 8, 1.6, 2);
      p.fill(C.ellipse(30 * u, 126 * u, 9 * u, 2.2 * u), 'sea', 2.2, 9);
      p.fill(C.rect(Math.round(25 * u), Math.round(124.5 * u), Math.round(6 * u), 1), 'sea', 6.4, 9);
      p.fill(C.rect(Math.round(29 * u), Math.round(126.5 * u), Math.round(3 * u), 1), 'sea', 5, 9);
      vignette(p, W, H, 1.8, 0.42);
      return {
        p,
        over(img) {
          rain(img, p, 120, 2.1, 77);
          gulls(img, p, [[58 * u, 44 * u, 0, 0, 0.4], [70 * u, 50 * u, 0, 0, 2.3], [20 * u, 30 * u, 0, 0, 4.1]], 0.9, true);
          sprite(img, Math.round(14 * u), Math.round(86 * u), BUOY_ROWS[0], BUOY);
          spray(img, [[lx - 10 * u, yH - 2 * u, 12 * u, 14 * u, 0.1, 1], [74 * u, 86 * u, 18 * u, 12 * u, 0.5, 0]], 0.3, u, BEAM_HI);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: ['beam', 'lamp'], dither: 0.2 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const clear = cat === 'clear-path';
      const yH = 50 * u; const lx = gx; const ly = 13 * u;
      const B = p.ri('beam');
      const cloud = stormSky(p, W, yH + 1, {
        u, lx, ly, v0: 0.6, v1: 4.6, halo: 2.4, reach: 66 * u, seed: 8,
        banks: [[45, 2.5, 14, 3.4], [38, 4, 20, 2.8], [27, 6, 26, 2.2], [12, 8, 34, 1.6], [-3, 10, 40, 1.2]].map(([y, th, per, v]) => [y * u, th * u, per * u, v]),
      });
      if (!clear) {
        beamShaft(p, lx, ly, Math.PI - 0.06, { len: W * 0.7, w0: 1.4 * u, spread: 0.07, v: 8.6, cloud, fall: 0.9 });
        beamShaft(p, lx, ly, -0.03, { len: W * 0.6, w0: 1.1 * u, spread: 0.045, v: 7.6, cloud });
      } else {
        // The beam swung round onto us: a blaze of rays.
        p.each(C.rect(0, 0, W, yH + 1), (x, y, i) => {
          const a = Math.atan2(y + 0.5 - ly, x + 0.5 - lx); const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly);
          const ray = frac(a / (Math.PI * 2) * 14 + 0.25) < 0.42 ? 1 : 0.35;
          const val = 8.4 * ray * Math.max(0, 1 - d / (54 * u)) ** 1.3 + (cloud[i] ? 1 : 0) * Math.max(0, 1 - d / (54 * u));
          if (val > 1.2 && val > (p.r[i] === B ? p.v[i] : 0)) { p.r[i] = B; p.v[i] = val; }
        });
      }
      halo(p, lx, ly, (clear ? 22 : 12) * u, clear ? 9.6 : 8.8);
      // The sea, and the lamp laid on it: a path of broken gold from the lighthouse to our feet.
      seaRows(p, 0, W, yH, 100 * u, {
        u, seed: 3, d0: 1.5, rows: 3.1, vFar: 6.2, vNear: 2.4, crest: 3.6, cap: 11.6, capAt: 0.7, capPx: 2.2, face: 1.7, back: 1.5,
        lace: 0.03, refl: { x: lx, w0: 3, w1: clear ? 62 : 30, v: clear ? 9 : 7.4, fade: clear ? 0.05 : 0.3, pow: 0.6 },
      });
      p.light(lx, yH + 14 * u, 60 * u, clear ? 4.6 : 3.4, null, { zMin: 1, zMax: 1, sy: 0.5 });
      // Headlands both sides, stepping away along the coast, their faces toward the lamp catching it.
      const head = (x) => {
        const D = Math.abs(x - gx); const side = x < gx ? 0 : 1;
        if (D < 64 * u) return yH + 3 * u;
        const k = Math.floor((D - 64 * u) / (70 * u)); const f = ((D - 64 * u) % (70 * u)) / (70 * u);
        const h = (18 + 14 * hash(k, side, 31)) * u * Math.min(1, (k + 1) * 0.7);
        return yH + 1 * u - h * smooth(clamp(f * 2.2, 0, 1)) * (1 - 0.25 * f) - (k > 0 ? 6 * u : 0) - (n1(x / (5 * u), 4 + side) - 0.5) * 2.4 * u;
      };
      for (const side of [0, 1]) {
        const xa = side ? gx + 60 * u : 0; const xb = side ? W : gx - 60 * u;
        if (xb <= xa) continue;
        rocks(p, skyline(xa, xb, yH + 3 * u, head, 1), { v: (x, y) => 1.5 + clamp((y - yH + 34 * u) / (34 * u), 0, 1) * 0.4, z: 2, size: 5 * u, sx: 0.8, sy: 1.4, seed: 5 + side, lit: [side ? -0.8 : 0.8, -0.6] });
      }
      p.light(lx, ly, 150 * u, 2.6, null, { zMin: 2, zMax: 2, sy: 0.6 });
      edge(p, 2, 1, 0, 'rock', (x) => (x < gx ? 4.6 : 1.6)); edge(p, 2, -1, 0, 'rock', (x) => (x > gx ? 4.6 : 1.6));
      wetTop(p, 2, 1.6);
      for (let k = 0, D = 66 * u; gx + D < W + 10 * u; D += 70 * u, k += 1) {
        for (const s of [-1, 1]) foam(p, gx + s * (D + 6 * u), yH + 2.4 * u, 10 * u, 2 * u, { u, z: 3, seed: 60 + k * 2 + (s > 0 ? 1 : 0), v: 10.6, swell: 1, r0: 0.8, wide: 1.8 });
      }
      // Sea stacks.
      for (const [dx, w, h] of [[-96, 5, 20], [104, 4, 15], [-182, 6, 24], [196, 5, 19], [-290, 5, 17], [300, 6, 22], [-400, 5, 21], [410, 6, 18], [-520, 6, 19], [530, 5, 23]]) {
        const x = gx + dx * u; if (x < -10 * u || x > W + 10 * u) continue;
        const st = skyline(x - w * u, x + w * u, yH + 7 * u, (px) => yH + 6 * u - h * u * (1 - ((px - x) / (w * u)) ** 4) + (hash(Math.floor(px), 4, dx) - 0.5) * 1.5 * u, 1);
        rocks(p, st, { v: 1.4, z: 3, size: 3 * u, sx: 0.7, sy: 1.6, seed: 40 + dx, lit: [dx < 0 ? 0.8 : -0.8, -0.5] });
        foam(p, x, yH + 7 * u, w * 1.4 * u, 2.6 * u, { u, z: 4, seed: 70 + dx, v: 10.4, swell: 1, r0: 0.7 });
      }
      edge(p, 3, 1, 0, 'rock', (x) => (x < gx ? 3.8 : 1.4)); edge(p, 3, -1, 0, 'rock', (x) => (x > gx ? 3.8 : 1.4));
      // The lighthouse on its rock, the surf bursting round it.
      const rk = skyline(gx - 22 * u, gx + 22 * u, yH + 4 * u, (x) => yH - 1 * u - 6 * u * Math.exp(-(((x - gx) / (10 * u)) ** 2)) + (hash(Math.floor(x / 2), 1, 3) - 0.5) * 1.6 * u, 1);
      rocks(p, rk, { v: 2.2, z: 3, size: 3 * u, seed: 7, lit: [0, -1] });
      p.light(gx, yH - 7 * u, 18 * u, 3.4, null, { zMin: 3, zMax: 3 });
      lighthouse(p, gx, yH - 5 * u, ly, u, { z: 4, hwB: 5.4, hwT: 3.5, fall: 5 });
      foam(p, gx - 15 * u, yH + 1.5 * u, 9 * u, 6 * u, { u, z: 6, seed: 81, v: 13.8, swell: 2.2, wide: 1.3 });
      foam(p, gx + 15 * u, yH + 1.5 * u, 8 * u, 4 * u, { u, z: 6, seed: 82, v: 13.2, swell: 1.6, wide: 1.4 });
      // The wreck on its reef off to the left, its ribs against the surf.
      const wx = gx - 50 * u; const wy = 64 * u;
      foam(p, wx - 9 * u, wy + 1 * u, 14 * u, 10 * u, { u, z: 6, seed: 101, v: 12.2, swell: 2.6, wide: 1.2, dense: 1.4 });
      const reef = skyline(wx - 20 * u, wx + 22 * u, 72 * u, (x) => wy + 1.5 * u + (hash(Math.floor(x / 2), 6, 2) - 0.5) * 2 * u, 1);
      rocks(p, reef, { v: 1.6, z: 7, size: 3 * u, seed: 23 });
      wreck(p, wx, wy + 2 * u, 38 * u, { u, z: 7, dir: 1, heel: -0.3, mast: 1.2, lean: -0.3, v: 1.0, stay: false });
      edge(p, 7, 1, 0, 'wood', 3.8); edge(p, 7, 0, -1, 'wood', 3.2);
      foam(p, wx, wy + 4 * u, 13 * u, 1.6 * u, { u, z: 8, seed: 102, v: 10.8, swell: 0.8, wide: 1.8 });
      // A merrow comes up out of the water behind the ledge, so the surf and the ledge cover its waist.
      const fy = 89 * u;
      if (cat === 'monster') {
        const s = 42 * u;
        merrow(p, gx, 88 * u, s, ramp, 12);
        edge(p, 12, 0, -1, 'beam', 5.6, 88 * u - s * 0.5);
        edge(p, 12, -1, 0, 'beam', (x, y) => (y < 88 * u - s * 0.6 ? 3.6 : 2.4), 88 * u - s * 0.05); edge(p, 12, 1, 0, 'beam', (x, y) => (y < 88 * u - s * 0.6 ? 3.6 : 2.4), 88 * u - s * 0.05);
        p.tint(gx, 88 * u - s * 0.83, 5 * u, hex, 0.45, flicker(0.3, 0.3, 1.4));
      }
      // The ledge in front of us, rising into rocks at the sides, the surf breaking along its back.
      for (let x = gx - 40 * u, k = 0; x < gx + 40 * u; x += 9 * u, k += 1) {
        const c = 1 - Math.abs(x + 4.5 * u - gx) / (44 * u);
        foam(p, x + 4.5 * u, 87.5 * u, 6 * u, (1.5 + 2.5 * c) * u, { u, z: 8, seed: 120 + k, v: 11 + c * 2.4, swell: 1.2, wide: 1.6 });
      }
      const ledgeTop = (x) => {
        const D = Math.abs(x - gx);
        return 89 * u - smooth(clamp((D - 24 * u) / (46 * u), 0, 1)) * 21 * u - Math.max(0, D - 70 * u) * 0.04 + (n1(x / (7 * u), 9) - 0.5) * 4 * u * clamp((D - 16 * u) / (20 * u), 0.25, 1) + (hash(Math.floor(x / 2), 3, 9) - 0.5) * 1.2 * u;
      };
      const fg = skyline(0, W, H + 1, ledgeTop, 1);
      rocks(p, fg, { v: (x, y) => 1.9 - (y - 68 * u) / (32 * u) * 1.1, z: 9, size: 6 * u, seed: 31, lit: [0.2, -1] });
      wetTop(p, 9, 1.4, 2);
      p.light(gx, 89 * u, 30 * u, clear ? 4.4 : 2, null, { zMin: 9, zMax: 9, sy: 0.3 });
      // A pool in the rocks at each side, holding a glint of the beam.
      for (const s of [-1, 1]) {
        const px = gx + s * 52 * u; const py = ledgeTop(px) + 8 * u;
        p.fill(C.ellipse(px, py, 8 * u, 1.6 * u), 'sea', 2.2, 10);
        p.fill(C.rect(Math.round(px - 3 * u), Math.round(py - 1 * u), Math.round(4 * u), 1), 'beam', 3.6, 10);
      }
      // The card, on the ledge under the lamp.
      if (cat === 'wanderer') {
        const s = 30 * u;
        const { lx: lx2, ly: ly2 } = beachcomber(p, gx, fy, s, 12);
        edge(p, 12, 0, -1, 'beam', 5); edge(p, 12, 1, 0, 'beam', 3.2, fy - s * 0.4); edge(p, 12, -1, 0, 'beam', 3.2, fy - s * 0.4);
        p.fill(C.rect(lx2, ly2 - 1, 2, 1), 'shadow', 1, 14);
        p.fill(C.rect(lx2 - 1, ly2, 4, 4), 'shadow', 1.4, 14);
        p.fill(C.rect(lx2, ly2 + 1, 2, 2), ramp, 4, 15);
        p.tint(lx2 + 1, ly2 + 2, 10 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(lx2 + 1, ly2 + 2, 14 * u, hex, 0.3, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        seaChest(p, gx, fy + 2 * u, 24 * u, ramp, 12);
        edge(p, 12, 0, -1, 'beam', 4.6);
        p.tint(gx, fy - 9 * u, 12 * u, hex, 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        breaker(p, gx, fy, 36 * u, ramp, 12, u);
        p.tint(gx - 4 * u, fy - 22 * u, 14 * u, CARD[ramp][4], 0.3, flicker(0.5, 0.12, 0.6));
      } else if (clear) {
        p.tint(gx, 80 * u, 18 * u, CARD.path[4], 0.35);
      }
      vignette(p, W, H, 1.6, 0.4);
      const sites = [[gx - 15 * u, yH - 2 * u, 14 * u, 14 * u, 0.1, 1], [gx + 15 * u, yH - 1 * u, 12 * u, 10 * u, 0.55, 1], [wx, 56 * u, 16 * u, 12 * u, 0.3, 0], [gx - 20 * u, 86 * u, 10 * u, 8 * u, 0.75, 1], [gx + 22 * u, 86 * u, 10 * u, 7 * u, 0.2, 1]];
      for (let D = 66 * u, k = 0; gx + D < W + 10 * u; D += 70 * u, k += 1) for (const s of [-1, 1]) sites.push([gx + s * (D + 6 * u), yH, 10 * u, 8 * u, hash(k, s + 1, 3), 0]);
      const birds = [[gx - 34 * u, 20 * u, 10 * u, 3 * u, 0], [gx + 30 * u, 24 * u, 12 * u, 4 * u, 2], [gx - 120 * u, 30 * u, 14 * u, 4 * u, 4], [gx + 140 * u, 18 * u, 12 * u, 3 * u, 1]];
      const bx = gx + 44 * u; const by = 70 * u;
      return {
        p,
        over(img, t) {
          rain(img, p, Math.round(W * H / 90), t, 51);
          gulls(img, p, birds, t, u < 0.8);
          const rock = Math.sin(t * 1.1);
          sprite(img, Math.round(bx + rock * u), Math.round(by), BUOY_ROWS[rock > 0.35 ? 1 : rock < -0.35 ? 2 : 0], BUOY);
          spray(img, sites, t, u, BEAM_HI);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['beam', 'lamp'], dither: 0.2 });
      const u = H / 250; const gx = W / 2;
      const yH = 10 * u;
      stormSky(p, W, yH + 1, { u, lx: gx, ly: -30 * u, v0: 1.2, v1: 3.6, halo: 1.6, reach: 120 * u, seed: 12, banks: [[6 * u, 3 * u, 30 * u, 2.2]] });
      seaRows(p, 0, W, yH, 68 * u, { u, seed: 6, d0: 2, rows: 3, vFar: 5.6, vNear: 2.6, crest: 3.4, cap: 11, capAt: 0.7, capPx: 2.4, face: 1.4, back: 1.2, lace: 0.03 });
      // The surf breaking along the shelf's edge, just under the vista.
      for (let x = -10 * u, k = 0; x < W + 20 * u; k += 1) {
        const w = (10 + hash(k, 1, 5) * 14) * u;
        foam(p, x + w, 67 * u + hash(k, 2, 5) * 2 * u, w, (3 + hash(k, 3, 5) * 4) * u, { u, z: 3, seed: 200 + k, v: 10.8, swell: 1.6, wide: 1.6 });
        x += w * 1.7;
      }
      // The shelf, the rock pools in it.
      const r = rng('shelf-pools'); const pools = [];
      for (let k = 0; k < 11; k += 1) {
        const y = (96 + r() ** 1.1 * 140) * u; const sc = 0.5 + (y / H) * 1.1;
        pools.push([r() * W, y, (12 + r() * 16) * u * sc, (3 + r() * 3) * u * sc]);
      }
      const kind = shelf(p, Math.round(70 * u), H, { u, vx: gx, vy: -150 * u, d0: 224 * u, rows: 8, cols: 4.2, seed: 3, pools, v: 1.9, lip: 3 });
      // A spar from the wreck washed up across the rock, its rope trailing.
      const sp = C.poly([[14 * u, 168 * u], [98 * u, 132 * u], [101 * u, 138 * u], [18 * u, 175 * u]]);
      p.fill(sp, 'wood', (x, y) => 3 + (y < 134 * u + (98 * u - x) * 0.43 ? 0.8 : 0), 2);
      p.shade(sp, (x, y) => (frac((x - y * 2.3) / (9 * u)) < 0.12 ? -1 : 0), 2);
      for (const t of [0.22, 0.6]) p.fill(C.rect(Math.round(lerp(18, 98, t) * u), Math.round(lerp(170, 133, t) * u), 2, 6 * u), 'iron', 3, 3);
      wetTop(p, 2, 1.1);
      for (let k = 0; k <= 60; k += 1) { const t = k / 60; p.fill(C.rect(Math.round(lerp(99 * u, 150 * u, t)), Math.round(136 * u + Math.sin(t * 8) * 3 * u + t * 26 * u), 1, 1), 'wood', 3.4, 3); }
      // A barrel from the wreck washed up by the right edge, standing in a pool, a broken crate beside it.
      const bx = W - 16 * u; const byy = 160 * u;
      p.fill(C.ellipse(bx - 2 * u, byy + 1 * u, 16 * u, 3.4 * u, 20), 'sea', (x, y) => (y < byy - 1 * u ? 4.6 : 1.6), 2);
      barrel(p, bx, byy, u, { z: 3, v: 1.6, w: 8, h: 14, lit: -0.5 });
      crate(p, bx - 20 * u, byy + 4 * u, 12 * u, 8 * u, u, { z: 3, v: 1.4 });
      p.fill(C.poly([[bx - 26 * u, byy - 4 * u], [bx - 22 * u, byy - 9 * u], [bx - 20 * u, byy - 4 * u]]), 'shadow', 0.4, 4);
      wetTop(p, 3, 1);
      // The wreckers' lantern on its pole at the left edge: the false light that brought the ship in.
      const lpx = Math.round(9 * u); const lpy = Math.round(92 * u);
      p.fill(C.rect(lpx, lpy - 14 * u, Math.max(2, Math.round(2 * u)), 60 * u), 'wood', 2.6, 5);
      p.fill(C.rect(lpx, lpy - 14 * u, 10 * u, Math.max(1, Math.round(1.4 * u))), 'wood', 3, 5);
      p.fill(C.rect(lpx + Math.round(8 * u), lpy - 14 * u, 1, 5 * u), 'iron', 2.4, 5);
      lantern(p, lpx + 8 * u, lpy, u, { z: 6, r: 34, k: 5, r2: 60, k2: 1, flick: true, phase: 1.3 });
      p.shade(C.ellipse(lpx + 6 * u, lpy + 46 * u, 10 * u, 2.4 * u), -1, 1);
      // The lighthouse's glow from over the vista, and its beam sweeping: one field per bearing, handed on in turn.
      p.light(gx, -40 * u, 210 * u, 3, null, { sx: 1.8, zMin: 1 });
      const N = 15; const fan = []; const spanA = 1.9; const hwA = 0.085;
      const ang = new Float32Array(W * H); const str = new Float32Array(W * H);
      for (let y = 0; y < H; y += 1) {
        const fall = y < 74 * u ? 1 : clamp(1 - (y - 60 * u) / (190 * u), 0, 1) ** 2;
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x; const kd = kind[i];
          ang[i] = Math.atan2(y + 0.5 + 60 * u, x + 0.5 - gx);
          str[i] = fall * (kd === 3 ? 9 : kd === 1 ? 4.2 : kd === 2 ? 1.2 : p.z[i] >= 3 && p.z[i] <= 4 ? 3.4 : p.z[i] === 1 && y < 70 * u ? 3.4 : 2.2);
        }
      }
      for (let k = 0; k < N; k += 1) {
        const a = Math.PI / 2 + (k / (N - 1) - 0.5) * spanA;
        const f = new Float32Array(W * H);
        for (let i = 0; i < f.length; i += 1) { const e = Math.abs(ang[i] - a) / hwA; if (e < 1) f[i] = str[i] * (1 - e * e); }
        fan.push({ f, at: k });
      }
      const sweep = (t) => { const s = frac(t / 7); return s < 0.55 ? (s / 0.55) * (N - 1) : -9; };
      for (const F of fan) p.fields.push({ f: F.f, k: (t) => Math.max(0, 1 - Math.abs(sweep(t) - F.at)) });
      p.shade(null, (x, y) => -2.4 * Math.max(0, y / H - 0.34));
      // The rock just inside the surf is drenched and dark, under the caption.
      p.shade(null, (x, y) => -1.2 * clamp(1 - Math.abs(y + 0.5 - 0.35 * H) / (0.06 * H), 0, 1), 1);
      const sites = [];
      for (let k = 0; k < 7; k += 1) sites.push([hash(k, 1, 9) * W, 68 * u, 14 * u, 16 * u, hash(k, 2, 9), 0]);
      return {
        p,
        over(img, t) {
          rain(img, p, 160, t, 91, { dim: 0.12 });
          spray(img, sites, t, u, BEAM_HI);
          // The wash: a lace of foam sliding up the shelf's edge and back.
          const reach = 71 * u + (0.5 + 0.5 * Math.sin(t * 0.8)) * 3 * u;
          for (let x = 0; x < W; x += 1) {
            const y = Math.round(reach + Math.sin(x / (9 * u) + t * 0.6) * 1 * u + (n1(x / (5 * u), 3) - 0.5) * 2 * u);
            if (hash(x >> 1, Math.floor(t * 2), 4) < 0.7) put(img, x, y, '#566169', 0.55);
          }
        },
      };
    },
  };

  /* ================= B: the smugglers' cave ================= */

  /**
   * Cave rock: natural rock in cells, darker and wetter below the tide line,
   * where barnacles speck it and weed hangs in a ragged fringe; a pale salt
   * mark along the line itself.
   */
  function caveRock(p, shape, o) {
    const { u, tide, seed = 1, z = 1 } = o;
    p.fill(shape, 'rock', (x, y) => (typeof o.v === 'function' ? o.v(x, y) : o.v) + (tide && y > tide(x) ? -0.4 : 0), z);
    p.cells(shape, { size: o.size ?? 6 * u, sx: o.sx ?? 1.3, sy: o.sy ?? 0.9, joint: 0.8, jointV: -1.1, vary: 0.8, bevel: o.bevel ?? 0.9, lit: o.lit || [0, -1], seed, z });
    if (!tide) return;
    const Wd = p.ri('weed');
    p.each(shape, (x, y, i) => {
      if (p.z[i] !== z) return;
      const d = y + 0.5 - tide(x);
      if (d >= 0 && d < (1 + 3.4 * hash(x, 1, seed) * n1(x / (4 * u), seed)) * u) { p.r[i] = Wd; p.v[i] = 3 + (hash(x >> 1, y, seed) < 0.3 ? -1 : 0); }
      else if (d > 0 && hash(x, y, seed + 3) < 0.04) p.v[i] += 1.5;
      else if (d > -1 && d < 0) p.v[i] += 0.9;
    });
  }

  /** Still black water: faint ripple lines, longer toward us. */
  function stillWater(p, x0, x1, y0, y1, o) {
    const S = p.ri('sea');
    p.each(C.rect(x0, y0, x1 - x0, y1 - y0), (x, y, i) => {
      const t = clamp((y - y0) / (y1 - y0), 0, 1);
      let v = lerp(o.vTop, o.vBot, t);
      const len = (1.5 + 7 * t) * o.u;
      const id = Math.floor((x + hash(y, 0, o.seed) * 40) / len);
      if (hash(id, y, o.seed + 1) < 0.14) v += o.rip ?? 0.9;
      p.r[i] = S; p.v[i] = v; p.z[i] = o.z ?? 1;
    });
  }

  /**
   * A light's reflection in still water: a column of short gold dashes under
   * it, wobbling side to side, breaking up and fading as it comes toward us.
   */
  function stillRefl(p, x, y0, y1, o) {
    const { u, v = 6, w = 1.6, seed = 1 } = o;
    const B = p.ri('beam'); const S = p.ri('sea');
    for (let y = Math.max(0, Math.ceil(y0)); y < Math.min(p.h, y1); y += 1) {
      const t = (y - y0) / (y1 - y0);
      const hw = (w + t * (o.grow ?? 2.4)) * u;
      const off = Math.sin(y * 1.9 + seed) * hw * 0.4 + (hash(y, 1, seed) - 0.5) * hw * 0.5;
      const len = Math.max(0.6, hw * (0.5 + hash(y, 2, seed) * 0.8));
      if (hash(y, 3, seed) < 0.15 + t * 0.35) continue;
      for (let xx = Math.round(x + off - len); xx <= Math.round(x + off + len); xx += 1) {
        if (xx < 0 || xx >= p.w) continue;
        const i = y * p.w + xx; if (p.r[i] !== S) continue;
        const e = Math.abs(xx + 0.5 - x - off) / (len + 0.5);
        p.r[i] = B; p.v[i] = v * (1 - t * 0.55) * (e < 0.45 ? 1 : 0.7);
      }
    }
  }

  /** A dark thing's reflection: a wobbling dark streak under it in the water. */
  function darkRefl(p, x, w, y0, y1, seed, dv = -1.2) {
    const S = p.ri('sea');
    for (let y = Math.max(0, Math.ceil(y0)); y < Math.min(p.h, y1); y += 1) {
      if (hash(y, 5, seed) < 0.25) continue;
      const off = Math.round(Math.sin(y * 1.6 + seed) * 0.8);
      for (let xx = Math.round(x - w / 2) + off; xx < Math.round(x + w / 2) + off; xx += 1) {
        if (xx < 0 || xx >= p.w) continue;
        const i = y * p.w + xx; if (p.r[i] === S) p.v[i] += dv;
      }
    }
  }

  /** A standing barrel: rounded staves lit toward the light, two iron hoops, its lid's rim catching the light. */
  function barrel(p, x, fy, u, o = {}) {
    const w = (o.w ?? 4.5) * u; const h = (o.h ?? 8) * u; const z = o.z ?? 5; const v = o.v ?? 2.2; const lx = o.lit ?? -0.3;
    const shape = C.poly([[x - w * 0.84, fy], [x - w, fy - h * 0.5], [x - w * 0.84, fy - h], [x + w * 0.84, fy - h], [x + w, fy - h * 0.5], [x + w * 0.84, fy]]);
    const hoops = [fy - h * 0.22, fy - h * 0.78];
    const I = p.ri('iron'); const Wd = p.ri('wood');
    p.each(shape, (px, py, i) => {
      const k = (px + 0.5 - x) / w; const round = 1 - Math.abs(k - lx) * 0.9;
      p.z[i] = z;
      if (hoops.some((hy) => Math.abs(py + 0.5 - hy) < Math.max(0.5, 0.5 * u))) { p.r[i] = I; p.v[i] = v + 0.6 + round * 1.4; return; }
      p.r[i] = Wd; p.v[i] = v + round * 1.6 + (frac((px - x + w * 4) / (2.2 * u)) < 0.3 ? -0.7 : 0);
    });
    p.fill(C.rect(x - w * 0.84, fy - h, w * 1.68, 1), 'wood', v + 2.4, z);
  }

  /** A crate: planks across, a brace corner to corner, its top edge lit. */
  function crate(p, x, fy, w, h, u, o = {}) {
    const z = o.z ?? 5; const v = o.v ?? 2.2;
    p.fill(C.rect(x - w / 2, fy - h, w, h), 'wood', (px, py) => v + (frac((py - fy) / (2.4 * u)) < 0.3 ? -0.8 : 0) + (px < x - w * 0.2 ? 0.4 : 0), z);
    line(p, x - w / 2 + 1, fy - 1, x + w / 2 - 1, fy - h + 1, 'wood', v + 0.9, z);
    p.fill(C.rect(x - w / 2, fy - h, w, 1), 'wood', v + 2, z);
    p.fill(C.rect(x - w / 2, fy - h, 1, h), 'wood', v + 0.6, z); p.fill(C.rect(x + w / 2 - 1, fy - h, 1, h), 'wood', v - 0.6, z);
  }

  /**
   * A net hung to dry: a sagging rope between two pegs with cork floats on
   * it, the mesh hanging below in diamonds, its hem ragged.
   */
  function net(p, x0, x1, top, drop, u, o = {}) {
    const z = o.z ?? 4; const v = o.v ?? 2.2; const seed = o.seed || 1; const m = Math.max(2.5, (o.mesh ?? 2.8) * u);
    const sag = (x) => top + Math.sin(clamp((x - x0) / (x1 - x0), 0, 1) * Math.PI) * drop * 0.28;
    const hem = (x) => top + drop * (0.62 + 0.38 * Math.sin(clamp((x - x0) / (x1 - x0), 0, 1) * Math.PI)) + (hash(Math.floor(x / (2 * u)), 0, seed) - 0.5) * 2.4 * u;
    const R = p.ri('wood');
    p.each(C.rect(x0, top, x1 - x0, drop * 1.2 + 3 * u), (x, y, i) => {
      const yt = sag(x + 0.5); if (y + 0.5 < yt || y + 0.5 > hem(x + 0.5)) return;
      const a = frac((x + (y - yt) * 0.95) / m); const b = frac((x - (y - yt) * 0.95) / m);
      if (a * m >= 1 && b * m >= 1) return;
      p.r[i] = R; p.z[i] = z; p.v[i] = v - (y - yt) / drop * 0.8;
    });
    for (let x = Math.round(x0); x <= Math.round(x1); x += 1) p.fill(C.rect(x, Math.round(sag(x + 0.5)), 1, 1), 'wood', v + 1, z + 1);
    for (let k = 1; k < 4; k += 1) { const x = lerp(x0, x1, k / 4); p.fill(C.ellipse(x, sag(x) + 0.5, 1.4 * u, 1 * u), 'wood', v + 2.6, z + 1); }
    for (const x of [x0, x1]) p.fill(C.rect(Math.round(x) - 1, Math.round(top) - 1, 2, 2), 'iron', 2.6, z + 1);
  }

  /** A rowing boat afloat, side-on: a shallow hull rising to stem and stern, its strakes, its gunwale lit. */
  function boat(p, cx, wy, len, u, o = {}) {
    const z = o.z ?? 5; const h = len * 0.2; const v = o.v ?? 2;
    const top = (x) => { const t = (x - cx) / (len / 2); return wy - h - Math.abs(t) ** 2.4 * h * 0.55; };
    const pts = [];
    for (let k = 0; k <= 20; k += 1) { const x = cx - len / 2 + (k / 20) * len; pts.push([x, top(x)]); }
    pts.push([cx + len * 0.47, wy - h * 0.2], [cx + len * 0.4, wy + 0.5], [cx - len * 0.4, wy + 0.5], [cx - len * 0.47, wy - h * 0.2]);
    const hull = C.poly(pts);
    p.fill(hull, 'wood', (x, y) => v + (frac((y - top(x)) / (2.2 * u)) < 0.3 ? -0.7 : 0) - (y - top(x)) / h * 0.6, z);
    for (let x = Math.round(cx - len / 2); x <= Math.round(cx + len / 2); x += 1) p.fill(C.rect(x, Math.round(top(x + 0.5)), 1, 1), 'wood', v + 2.2, z + 1);
    return { top };
  }

  /**
   * The sea hag, in profile, facing left: a great hunched back, her head
   * thrust forward and low with its hooked nose and chin, her hair hanging
   * in wet ropes, one arm reaching out with long hooked claws, a crooked
   * staff in the other, her rags ragged at the hem. Black against the
   * light; her eye the card's red. Returns where her eye is.
   */
  function hag(p, cx, fy, s, ramp, z) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    const b = 0.3;
    const hem = [];
    for (let k = 0; k <= 8; k += 1) hem.push([-0.22 + (k / 8) * 0.46, k % 2 ? -0.05 : 0.01]);
    // Her body: rags from a ragged hem up a hunched back to the hump, the neck sloping forward.
    p.fill(P([...hem, [0.25, -0.2], [0.27, -0.42], [0.24, -0.58], [0.15, -0.7], [0.03, -0.74], [-0.06, -0.72], [-0.12, -0.64], [-0.13, -0.5], [-0.17, -0.3]]), 'shadow', b, z);
    // Her head, low and forward: brow, the hooked nose, the jutting chin.
    p.fill(P([[-0.04, -0.76], [-0.1, -0.8], [-0.17, -0.79], [-0.21, -0.75], [-0.27, -0.72], [-0.22, -0.7], [-0.2, -0.67], [-0.24, -0.63], [-0.17, -0.62], [-0.1, -0.64], [-0.03, -0.68]]), 'shadow', b, z);
    // Her hair, in ropes down from the crown over her hump.
    for (const [x0, len, sw] of [[-0.08, 0.36, 0.06], [-0.02, 0.44, 0.08], [0.04, 0.3, 0.1], [-0.12, 0.24, 0.02]]) {
      p.fill(P([[x0 - 0.025, -0.78], [x0 + 0.02, -0.79], [x0 + sw + 0.015, -0.78 + len], [x0 + sw - 0.02, -0.76 + len + 0.05]]), 'shadow', b, z);
    }
    // The reaching arm and its claws.
    p.fill(P([[-0.06, -0.62], [-0.2, -0.56], [-0.32, -0.58], [-0.36, -0.55], [-0.3, -0.52], [-0.18, -0.5], [-0.07, -0.54]]), 'shadow', b, z);
    for (const [a, l] of [[-0.25, 0.17], [0.05, 0.18], [0.35, 0.14]]) {
      const ax = cx - 0.35 * s; const ay = fy - 0.56 * s;
      line(p, ax, ay, ax - Math.cos(a) * l * s, ay + Math.sin(a) * l * s - l * s * 0.25, 'shadow', b + 0.4, z);
    }
    // The crooked staff behind.
    line(p, cx + 0.2 * s, fy - 0.5 * s, cx + 0.3 * s, fy, 'shadow', b + 0.6, z);
    line(p, cx + 0.2 * s, fy - 0.5 * s, cx + 0.15 * s, fy - 0.58 * s, 'shadow', b + 0.6, z);
    const ex = Math.round(cx - 0.17 * s); const ey = Math.round(fy - 0.74 * s);
    p.fill(C.rect(ex, ey, 2, 1), ramp, 4, z + 2);
    return { ex, ey };
  }
  /** A smuggler: long coat, a tricorn hat, a cutlass at his hip, his lantern held up beside him. Returns where it hangs. */
  function smuggler(p, cx, fy, s, z) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
    const b = 0.5;
    p.fill(P([[-0.12, 0], [-0.1, -0.16], [-0.22, -0.18], [-0.2, -0.5], [-0.16, -0.7], [-0.08, -0.76], [0.08, -0.76], [0.16, -0.7], [0.2, -0.5], [0.22, -0.18], [0.1, -0.16], [0.12, 0], [0.04, 0], [0, -0.12], [-0.04, 0]]), 'shadow', b, z);
    p.fill(C.ellipse(cx, fy - 0.82 * s, 0.07 * s, 0.08 * s), 'shadow', b, z);
    p.fill(P([[-0.2, -0.86], [-0.12, -0.95], [0, -0.91], [0.12, -0.95], [0.2, -0.86], [0.1, -0.86], [0, -0.83], [-0.1, -0.86]]), 'shadow', b, z);
    // The arm up, holding the lantern out on its hook.
    p.fill(P([[0.15, -0.72], [0.3, -0.78], [0.34, -0.9], [0.3, -0.92], [0.26, -0.82], [0.14, -0.64]]), 'shadow', b, z);
    line(p, cx - 0.16 * s, fy - 0.4 * s, cx - 0.3 * s, fy - 0.12 * s, 'shadow', b + 1, z);
    return { lx: Math.round(cx + 0.32 * s), ly: Math.round(fy - 0.86 * s) };
  }

  /** The bell that rings by itself: a ship's bell hung in a frame of two posts and a beam. */
  function bellFrame(p, x, fy, h, u, o = {}) {
    const z = o.z ?? 5; const w = h * 0.5;
    for (const dx of [-w / 2, w / 2]) p.fill(C.rect(Math.round(x + dx), fy - h, Math.max(1, Math.round(1.4 * u)), h), 'wood', 2.2, z);
    p.fill(C.rect(Math.round(x - w / 2 - 1.5 * u), Math.round(fy - h), Math.round(w + 3 * u), Math.max(1, Math.round(1.6 * u))), 'wood', 3, z);
    const bt = fy - h + 2 * u; const bh = h * 0.34; const bw = h * 0.17;
    p.fill(C.poly([[x - bw * 0.45, bt], [x + bw * 0.45, bt], [x + bw * 0.6, bt + bh * 0.7], [x + bw, bt + bh], [x - bw, bt + bh], [x - bw * 0.6, bt + bh * 0.7]]), 'bronze', (px) => 3 + (px < x ? 1.6 : 0) - Math.abs(px - x) / bw, z + 1);
    p.fill(C.rect(Math.round(x - bw), Math.round(bt + bh), Math.round(bw * 2), 1), 'bronze', 5.6, z + 1);
    p.fill(C.rect(Math.round(x), Math.round(bt + bh), 1, Math.max(2, Math.round(2.4 * u))), 'iron', 2, z + 1);
    p.fill(C.rect(Math.round(x), Math.round(bt - 1.5 * u), 1, Math.round(1.5 * u)), 'iron', 2.4, z + 1);
  }

  /**
   * A ship's figurehead taken from a wreck and spiked to the rock: a carved
   * woman leaning out, her hair streaming back, arms crossed on her breast,
   * her body tapering to a curled scroll. Gilt, worn, lit from the right.
   */
  function figurehead(p, x, fy, s, o = {}) {
    const z = o.z ?? 5;
    const P = (pts) => C.poly(pts.map(([px, py]) => [x + px * s, fy + py * s]));
    const lit = (px) => (o.v ?? 2) + clamp((px - x) / (s * 0.25), -1, 1) * 1.4;
    p.fill(P([[0.08, -0.8], [0.18, -0.72], [0.24, -0.6], [0.2, -0.5], [0.15, -0.36], [0.08, -0.2], [-0.02, -0.06], [-0.1, -0.02], [-0.14, -0.08],
      [-0.08, -0.18], [-0.04, -0.34], [-0.06, -0.52], [-0.04, -0.68]]), 'bronze', (px) => lit(px), z);
    p.fill(P([[0.12, -0.94], [0.0, -0.93], [-0.12, -0.86], [-0.2, -0.72], [-0.14, -0.6], [-0.1, -0.7], [0.02, -0.8], [0.1, -0.82]]), 'bronze', (px) => lit(px) - 0.6, z);
    p.fill(C.ellipse(x + 0.14 * s, fy - 0.85 * s, 0.07 * s, 0.075 * s), 'bronze', (px) => lit(px) + 0.4, z);
    p.fill(P([[0.02, -0.6], [0.21, -0.62], [0.2, -0.56], [0.02, -0.54]]), 'bronze', (px) => lit(px) + 0.8, z + 1);
    p.fill(C.join(C.circle(x - 0.08 * s, fy - 0.06 * s, 0.07 * s), C.circle(x - 0.08 * s, fy - 0.06 * s, 0.03 * s)), 'bronze', (px) => lit(px) + 0.5, z + 1);
    // The iron spike she hangs from.
    p.fill(C.rect(Math.round(x - 0.1 * s), Math.round(fy - 0.5 * s), Math.round(0.12 * s), 1), 'iron', 2.6, z + 1);
  }

  /** A natural arch in the rock: a rounded opening whose rim wanders. */
  function caveMouth(cx, top, hw, bottom, seed, jit = 0.12) {
    const pts = []; const n = 30; const spring = top + hw * 0.9;
    for (let k = 0; k <= n; k += 1) {
      const a = Math.PI - (k / n) * Math.PI; const j = 1 + (hash(k, 1, seed) - 0.5) * jit * 2;
      pts.push([cx + Math.cos(a) * hw * j, spring - Math.sin(a) * hw * 0.95 * j]);
    }
    pts.push([cx + hw * 1.04, bottom], [cx - hw * 1.04, bottom]);
    return C.poly(pts);
  }

  const B = {
    job: 0, setting: 'drowned-coast', key: 'B', id: 'drowned-coast-b', side: 'inside',
    name: 'The Drowned Coast', title: 'The smugglers’ cave',
    pitch: 'Under the cliffs, where the wreckers bring what the sea gives them. Lanterns hang on iron hooks over a channel of black water; barrels and nets crowd the jetty, a boat lies moored, and the tide is still rising.',
    notes: [
      ['Light', 'Ship’s lanterns on hooks along the rock are the only light: each a warm pool on the wet stone and a broken gold streak in the water under it, with storm-black between. Nothing opens to the sky.'],
      ['Detail', 'The tide line drawn on the rock with weed and barnacles below it, a jetty of wreck timbers on posts, barrels with iron hoops, nets drying with their cork floats, a moored boat, a ship’s bell in its frame, drips falling through the light.'],
      ['Vista', 'The cave wall and its jetty the width of the board, lantern after lantern. The card stands on the landing at the foot of the smugglers’ stair. For an Obstacle the tide surges up the channel and a wave breaks over the landing; for a Clear Path the stair is lit gold to its turn.'],
      ['World', 'Down on the jetty under the table: its planks running out over the black water, a lantern on a mooring pile out in the water at each side with its light streaming down, barrels and a lantern set down in one corner, a heap of net in the other, drips ringing the water.'],
    ],
    palette: ['#030405', '#12161A', '#2C3133', '#5E5A4E', '#121D27', '#29241B', '#5D4D30', '#B87426', '#FFE7A8'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['beam', 'lamp'], dither: 0.2 });
      const u = H / 134;
      const wy = 100 * u; const tide = (x) => 76 * u + Math.sin(x / (9 * u)) * 1.2 * u;
      // The cave: rock all round, the roof low and lumpy, a passage going up into the dark at the back.
      caveRock(p, C.rect(0, 0, W, wy + 1), { u, v: (x, y) => 1.6 - Math.max(0, 34 * u - y) / (34 * u) * 1.1, tide, seed: 4, size: 11 * u, sx: 1.9, sy: 0.65, bevel: 1.2 });
      const pass = caveMouth(44 * u, 26 * u, 11 * u, 66 * u, 9, 0.16);
      p.fill(pass, 'rock', (x, y) => 0.5 + (y - 26 * u) / (40 * u) * 0.5, 2);
      p.cells(pass, { size: 3 * u, sx: 1.6, sy: 0.6, joint: 0.6, jointV: -0.4, vary: 0.3, bevel: 0.3, seed: 10, z: 2 });
      for (let k = 0; k < 6; k += 1) p.fill(C.rect(44 * u - (8 - k) * u, (64 - k * 4.2) * u, (16 - 2 * k) * u, 1), 'rock', 1.6 - k * 0.2, 2);
      // The roof's lumps hanging down, weed trailing off them.
      const roof = skyline(0, W, 0, (x) => 14 * u + 6 * u * n1(x / (9 * u), 3) + 3 * u * billow(x / (7 * u), 4), 1);
      caveRock(p, roof, { u, v: 0.9, seed: 5, size: 9 * u, sx: 1.6, sy: 0.7, z: 3 });
      wetTop(p, 3, -0.6);
      // The jetty along the left: planks on posts, barrels standing on it.
      const jy = 88 * u;
      p.fill(C.rect(0, jy, 30 * u, 3 * u), 'wood', (x, y) => 2.6 + (y < jy + 1 ? 1.4 : 0) + (frac(x / (9 * u)) < 0.12 ? -1 : 0), 5);
      for (const x of [4 * u, 22 * u]) p.fill(C.rect(x, jy + 3 * u, 2.2 * u, wy - jy), 'wood', 1.6, 5);
      barrel(p, 8 * u, jy, u, { z: 6, v: 1.8, w: 4.6, h: 8.5 }); barrel(p, 18 * u, jy, u, { z: 6, v: 2.1, w: 4.4, h: 8 });
      barrel(p, 13 * u, jy - 8 * u, u, { z: 7, v: 2.4, w: 4.4, h: 7.6 });
      // A net hung on the right wall.
      net(p, 66 * u, 92 * u, 46 * u, 26 * u, u, { z: 5, v: 1.5, seed: 3 });
      // A figurehead from some wreck, spiked to the rock above the jetty, looking out over the boat.
      figurehead(p, 30 * u, 82 * u, 30 * u, { z: 5, v: 1.1 });
      // The black water of the channel.
      stillWater(p, 0, W, wy, H, { u, vTop: 2.2, vBot: 1.2, rip: 0.9, seed: 6, z: 1 });
      // The boat moored in it, cargo aboard, its lantern on a pole at the stern.
      const bc = 50 * u;
      const { top } = boat(p, bc, wy + 2 * u, 44 * u, u, { z: 8, v: 2.6 });
      barrel(p, bc - 6 * u, top(bc - 6 * u) + 2 * u, u, { z: 7, v: 2.6, w: 4, h: 6.5 });
      crate(p, bc + 5 * u, top(bc + 5 * u) + 2 * u, 8 * u, 5 * u, u, { z: 7, v: 2.6 });
      const lpx = Math.round(bc + 15 * u); const lpy = Math.round(68 * u);
      p.fill(C.rect(lpx - Math.round(2 * u), lpy + 3 * u, Math.max(1, Math.round(1.2 * u)), top(lpx) - lpy), 'wood', 2.6, 9);
      p.fill(C.rect(lpx - Math.round(2 * u), lpy - 7 * u, Math.max(1, Math.round(1.2 * u)), 4 * u), 'wood', 2.6, 9);
      p.fill(C.rect(lpx - Math.round(2 * u), lpy - 7 * u, Math.round(2.6 * u), 1), 'iron', 2.6, 9);
      lantern(p, lpx + 0.5, lpy, u, { z: 10, r: 56, k: 7, r2: 96, k2: 1.1 });
      stillRefl(p, lpx + 0.5, wy + 2 * u, 128 * u, { u, v: 7, w: 1.4, grow: 3, seed: 3 });
      darkRefl(p, bc, 40 * u, wy + 3 * u, wy + 10 * u, 7, -0.8);
      // The near edge of the jetty at our feet, a mooring ring and a coil of rope on it.
      const ny = 122 * u;
      p.fill(C.rect(0, ny, W, H - ny), 'wood', (x, y) => 2 - (y - ny) / (H - ny) * 0.8 + (y < ny + 1 ? 1.4 : 0) + (frac(x / (13 * u) + Math.floor((y - ny) / (4 * u)) * 0.37) < 0.06 ? -1 : 0) + (frac((y - ny) / (4 * u)) < 0.22 ? -0.8 : 0), 11);
      p.fill(C.join(C.ellipse(70 * u, 127 * u, 7 * u, 2.6 * u), C.ellipse(70 * u, 127 * u, 3.4 * u, 1.2 * u)), 'wood', 3.4, 12);
      p.fill(C.join(C.ellipse(26 * u, 124 * u, 2.6 * u, 1.6 * u), C.ellipse(26 * u, 124 * u, 1.4 * u, 0.7 * u)), 'iron', 3, 12);
      vignette(p, W, H, 2.1, 0.52);
      p.rim(-1, 0, 0.6, 5);
      return {
        p,
        over(img) {
          for (const [x, y] of [[0.3, 40], [0.58, 30], [0.8, 58]]) { put(img, W * x, y * u, '#776E5A'); put(img, W * x, y * u - 1, '#393C3B', 0.8); }
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS, { emit: ['beam', 'lamp'], dither: 0.2 });
      const u = H / 100; const gx = W / 2;
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const clear = cat === 'clear-path'; const flood = cat === 'obstacle';
      const deck = 76 * u; const wy = 81 * u;
      const tide = (x) => 58 * u + Math.sin(x / (11 * u)) * 1.5 * u + (n1(x / (5 * u), 2) - 0.5) * 1.6 * u;
      // The wall, the channel's water in front.
      caveRock(p, C.rect(0, 0, W, wy), { u, v: (x, y) => 1.5 - clamp((24 * u - y) / (24 * u), 0, 1) * 0.9, tide, seed: 11, size: 10 * u, sx: 1.9, sy: 0.62, bevel: 1.2 });
      // The roof's lumps hanging low over everything.
      caveRock(p, skyline(0, W, 0, (x) => 6 * u + 7 * u * n1(x / (14 * u), 3) + 4 * u * billow(x / (9 * u), 4), 1), { u, v: 0.8, seed: 13, size: 8 * u, sx: 1.6, sy: 0.7, z: 3 });
      wetTop(p, 3, -0.5);
      stillWater(p, 0, W, wy, H, { u, vTop: 2.2, vBot: 1.2, rip: 0.9, seed: 12, z: 1 });
      // The passage at the centre: a mouth in the rock, the smugglers' stair climbing away inside it to a turn.
      const mt = 22 * u; const mhw = 17 * u;
      const mouth = caveMouth(gx, mt, mhw, deck, 21);
      const B = p.ri('beam'); const RK = p.ri('rock');
      const glow = clear ? 1 : flood ? 0 : 0.42;
      const yTop = Math.round(mt + 15 * u); const n = 7;
      // Step edges in whole rows, shallower as they climb away; each step at least two rows.
      const rowsY = [Math.round(deck)];
      { const h0 = (deck - yTop) * (1 - 0.84) / (1 - 0.84 ** n); let acc = deck; for (let k = 0; k < n; k += 1) { acc -= h0 * 0.84 ** k; rowsY.push(Math.min(rowsY[k] - 2, Math.round(acc))); } }
      p.each(mouth, (x, y, i) => {
        p.z[i] = 2; p.r[i] = RK;
        const dx = Math.abs(x + 0.5 - gx);
        if (y < rowsY[n]) {
          // The wall where the stair turns, lit by what is round the corner on the right.
          const t = (y + 0.5 - mt) / (rowsY[n] - mt);
          const side = clamp((x + 0.5 - gx + mhw) / (2 * mhw), 0, 1);
          // Left of the corner, the turn's wall catching the light; right of it, the way round the corner it comes from.
          const cx2 = gx + 3 * u + (y - mt) * 0.12;
          if (glow > 0) {
            if (Math.abs(x + 0.5 - cx2) < 0.8) { p.v[i] = 0.6; return; }
            if (!clear && x + 0.5 < cx2) { p.v[i] = 1 + t * 0.8 + side * 0.6; return; }
            p.r[i] = B; p.v[i] = x + 0.5 > cx2 ? Math.round(2.4 + glow * 6 - t * 1.2) : Math.round(1.4 + glow * 3.2 * (0.5 + 0.5 * t) + side);
            if (p.v[i] < 1.2) { p.r[i] = RK; p.v[i] = 1; }
          } else p.v[i] = 0.6;
          return;
        }
        let k = 0; while (k < n - 1 && y < rowsY[k + 1]) k += 1;
        const half = mhw * (0.96 - 0.08 * k);
        const lit = (k + 1) / n;
        if (dx > half) { p.v[i] = 0.6 + lit * glow * 1.4; return; }
        if (y === rowsY[k + 1]) {
          // A tread's nosing, catching the light from above: gold toward the top of the stair.
          if (glow > 0 && lit > 0.4) { p.r[i] = B; p.v[i] = 1.6 + glow * 5.8 * lit - dx / half * 1.2; } else p.v[i] = 4.6 + lit * 1.6 - dx / half * 1.2;
        } else if (y === rowsY[k + 1] + 1) p.v[i] = 2.2 + lit * glow * 2;
        else p.v[i] = 0.9 + lit * (0.5 + glow * 2) - dx / half * 0.4;
      });
      // The mouth's rim catching the lanterns.
      const rimZ = 3;
      const ring = C.join(caveMouth(gx, mt - 2.6 * u, mhw + 2.6 * u, deck, 22), caveMouth(gx, mt, mhw, deck + 1, 21));
      p.fill(ring, 'rock', 2.6, rimZ);
      p.cells(ring, { size: 3 * u, joint: 0.6, jointV: -1, vary: 0.8, bevel: 0.9, lit: [0, -1], seed: 23, z: rimZ });
      if (clear) p.light(gx, deck - 10 * u, 44 * u, 4.6, flicker(0.2, 0.06, 0.4), { zMin: 3 });
      else if (glow) p.light(gx, mt + 10 * u, 26 * u, 1.6, null, { zMin: 3, zMax: 3 });
      // The jetty: a deck of planks along the wall's foot on posts into the water, a landing before the mouth.
      p.fill(C.rect(0, deck, W, 4 * u), 'wood', (x, y) => 2 + (y < deck + 1 ? 1.6 : y > deck + 3 * u ? -0.8 : 0) + (frac(x / (10 * u) + 0.3) < 0.1 ? -1 : 0), 5);
      const posts = [];
      for (let x = gx - Math.ceil(W / (21 * u)) * 21 * u; x < W + 10 * u; x += 21 * u) posts.push(x + 10.5 * u);
      for (const x of posts) { p.fill(C.rect(x - 1.2 * u, deck + 3 * u, 2.4 * u, wy - deck - 2 * u), 'wood', 1.5, 5); darkRefl(p, x, 2.4 * u, wy, wy + 9 * u, Math.round(x), -1); }
      // Lanterns on hooks along the wall, a pool each and dark between.
      const lamps = [];
      for (let d = 36 * u; gx + d < W + 20 * u; d += 72 * u) lamps.push(gx - d, gx + d);
      // Props in the bays between them, in turn.
      const bays = [];
      for (let d = 0; gx + d < W + 40 * u; d += 72 * u) bays.push(gx - d - 72 * u + 36 * u, gx + d + 72 * u - 36 * u);
      bays.forEach((bxRaw, j) => {
        const bx = bxRaw; const D = Math.abs(bx - gx); if (D < 40 * u || bx < -40 * u || bx > W + 40 * u) return;
        const kind = Math.floor(D / (72 * u)) + (bx < gx ? 0 : 1);
        if (kind % 3 === 0) {
          barrel(p, bx - 7 * u, deck, u, { z: 6, v: 1.6 }); barrel(p, bx + 2 * u, deck, u, { z: 6, v: 1.8 }); barrel(p, bx - 2.5 * u, deck - 8 * u, u, { z: 7, v: 2 });
          crate(p, bx + 12 * u, deck, 9 * u, 7 * u, u, { z: 6, v: 1.6 });
        } else if (kind % 3 === 1) {
          net(p, bx - 16 * u, bx + 14 * u, 34 * u, 30 * u, u, { z: 4, v: 2, seed: j + 3 });
          crate(p, bx + 6 * u, deck, 10 * u, 8 * u, u, { z: 6, v: 1.6 }); crate(p, bx + 6 * u, deck - 8 * u, 8 * u, 6 * u, u, { z: 6, v: 1.8 });
        } else {
          for (let q = 0; q < 3; q += 1) line(p, bx - 12 * u + q * 3 * u, deck, bx - 6 * u + q * 3 * u, deck - 26 * u, 'wood', 2.2, 4);
          barrel(p, bx + 4 * u, deck, u, { z: 6, v: 1.7, w: 5, h: 9 });
          p.fill(C.join(C.ellipse(bx + 14 * u, deck - 1.4 * u, 5 * u, 1.6 * u), C.ellipse(bx + 14 * u, deck - 1.4 * u, 2.4 * u, 0.7 * u)), 'wood', 2.6, 6);
        }
      });
      // The near bays: the bell in its frame on the left, the boat moored on the right.
      bellFrame(p, gx - 31 * u, deck, 22 * u, u, { z: 6 });
      const bc = gx + 40 * u;
      const bt = boat(p, bc, wy + 3 * u, 38 * u, u, { z: 7, v: 1.8 });
      p.fill(C.rect(bc - 2 * u, bt.top(bc) - 1 * u, 2 * u, 1.4 * u), 'wood', 2.6, 8);
      line(p, bc - 17 * u, bt.top(bc - 17 * u), bc - 22 * u, deck + 1 * u, 'wood', 2.6, 8);
      darkRefl(p, bc, 34 * u, wy + 4 * u, wy + 12 * u, 5, -0.8);
      lamps.forEach((x, k) => {
        const lx = Math.round(x); const ly = Math.round(40 * u);
        p.fill(C.rect(lx - Math.round(5 * u), ly - Math.round(8 * u), Math.round(5 * u) + 1, Math.max(1, Math.round(u))), 'iron', 2.6, 8);
        p.fill(C.rect(lx - Math.round(5 * u) - 1, ly - Math.round(9.5 * u), 2, Math.round(3 * u)), 'iron', 3, 8);
        p.fill(C.rect(lx, ly - Math.round(8 * u), 1, Math.round(3.5 * u)), 'iron', 2.4, 8);
        lantern(p, lx + 0.5, ly, u, { z: 9, r: 46, k: 5.8, r2: 84, k2: 0.9, flick: true, phase: k * 1.7 });
        stillRefl(p, lx + 0.5, wy, H, { u, v: 6.4, w: 1.2, grow: 2.6, seed: k + 1 });
      });
      // The card, on the landing at the foot of the stair.
      const fy = deck + 0.5;
      if (cat === 'monster') {
        const s = 38 * u;
        const { ex, ey } = hag(p, gx + 3 * u, fy, s, ramp, 12);
        edge(p, 12, 0, -1, 'beam', 5.2); edge(p, 12, 1, 0, 'beam', 3.4, fy - s * 0.3); edge(p, 12, -1, 0, 'beam', 2.6, fy - s * 0.3);
        p.tint(ex + 1, ey, 5 * u, hex, 0.45, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        const s = 34 * u;
        const { lx: l2x, ly: l2y } = smuggler(p, gx - 2 * u, fy, s, 12);
        edge(p, 12, 0, -1, 'beam', 4.6); edge(p, 12, -1, 0, 'beam', 3, fy - 4 * u); edge(p, 12, 1, 0, 'beam', 3, fy - 4 * u);
        p.fill(C.rect(l2x, l2y - 1, 1, 2), 'shadow', 1, 14);
        p.fill(C.rect(l2x - 1, l2y + 1, 4, 4), 'shadow', 1.4, 14);
        p.fill(C.rect(l2x, l2y + 2, 2, 2), ramp, 4, 15);
        p.tint(l2x + 1, l2y + 3, 9 * u, CARD[ramp][4], 0.7, flicker(0.9, 0.15));
        p.tint(l2x + 1, l2y + 3, 15 * u, hex, 0.3, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        seaChest(p, gx, fy, 24 * u, ramp, 12);
        edge(p, 12, 0, -1, 'beam', 4.6);
        p.tint(gx, fy - 9 * u, 12 * u, hex, 0.5, flicker(2, 0.15, 0.7));
      } else if (flood) {
        // The tide surging up the channel: a wave breaks right over the landing, cutting off the stair.
        breaker(p, gx + 2 * u, wy + 1 * u, 30 * u, ramp, 12, u);
        stillRefl(p, gx - 4 * u, wy + 2 * u, H, { u, v: 3.4, w: 6, grow: 6, seed: 9 });
        p.each(C.rect(gx - 22 * u, wy + 1, 44 * u, H - wy), (x, y, i) => { if (p.r[i] === p.ri('beam')) p.r[i] = p.ri(ramp); });
        p.tint(gx - 4 * u, deck - 14 * u, 14 * u, CARD[ramp][4], 0.3, flicker(0.5, 0.12, 0.6));
      }
      vignette(p, W, H, 1.8, 0.45);
      return {
        p,
        over(img, t) {
          for (const q of PX.particles('drip', Math.round(W / 30), [0, 0, W, wy], t, 19)) { put(img, q.x, q.y, '#776E5A', 0.95); put(img, q.x, q.y - 1, '#2C3133', 0.8); }
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS, { emit: ['beam', 'lamp'], dither: 0.2 });
      const u = H / 250; const gx = W / 2;
      // The black water under everything.
      stillWater(p, 0, W, 0, H, { u, vTop: 2.4, vBot: 1.2, rip: 0.8, seed: 31, z: 0 });
      // The jetty: wreck timbers laid as planks, running out from under us toward the landing.
      const vy = -375 * u; const k0 = 0.32;
      const half = (y) => k0 * (y - vy);
      const jet = C.poly([[gx - half(0), 0], [gx + half(0), 0], [gx + half(H), H], [gx - half(H), H]]);
      const n = 9; const Wd = p.ri('wood');
      p.each(jet, (x, y, i) => {
        const d = y + 0.5 - vy; const hw = half(y + 0.5);
        const c = ((x + 0.5 - gx) / hw + 1) / 2 * n; const kb = Math.floor(c);
        const px = (c - kb) * (2 * hw) / n;
        const len = Math.log(d / (100 * u)) * 7 + hash(kb, 1, 3) * 3; const seg = Math.floor(len);
        const fy = (len - seg) * (d / 7);
        let v = 1.7 + (hash(kb, seg, 4) - 0.5) * 0.8 + (hash(x >> 1, y >> 2, 5) - 0.5) * 0.35 + 0.4 * Math.max(0, 1 - Math.abs(x - gx) / (hw * 0.4));
        if (px < 1) v = 0.3; else if (px < 2) v += 0.9;
        if (fy < 1) v -= 1.1; else if (fy < 2) v += 0.3;
        if (fy > 2.5 && fy < 3.5 && (px > 2 && px < 3.2)) v += 1.2;
        if (kb === 0 || kb === n - 1) v -= 0.4;
        p.r[i] = Wd; p.v[i] = v; p.z[i] = 1;
      });
      // Its sides: the stringer's face dropping to the water, the piles under it.
      for (const s of [-1, 1]) {
        const face = C.poly([[gx + s * half(0), 0], [gx + s * (half(0) + 5 * u), 0], [gx + s * (half(H) + 8 * u), H], [gx + s * half(H), H]]);
        p.fill(face, 'wood', (x, y) => 1.2 - Math.abs(x - (gx + s * half(y))) / (8 * u) * 0.6, 1);
        for (let y = 20 * u; y < H; y += 46 * u) {
          const x = gx + s * (half(y) + 7 * u); const w = (4 + y / H * 4) * u;
          p.fill(C.rect(x - w / 2, y - 2 * u, w, 9 * u), 'wood', (px) => 1.6 + (px < x ? 0.6 : -0.2), 2);
          darkRefl(p, x, w, y + 7 * u, y + 24 * u, Math.round(y), -0.9);
        }
      }
      wetTop(p, 1, 0.8);
      // Puddles on the boards, holding a little of the light; one board stove in, the black water under it.
      for (const [x, y, rx, ry] of [[132 * u, 168 * u, 13 * u, 2.8 * u], [236 * u, 204 * u, 16 * u, 3.4 * u], [178 * u, 128 * u, 9 * u, 2 * u], [96 * u, 226 * u, 18 * u, 3.6 * u]]) {
        p.fill(C.ellipse(x, y, rx, ry, 20), 'sea', (px, py) => (py < y - ry * 0.5 ? 3.6 : 1.4), 1);
      }
      p.fill(C.poly([[gx - 30 * u, 186 * u], [gx - 16 * u, 184 * u], [gx - 14 * u, 200 * u], [gx - 22 * u, 204 * u], [gx - 32 * u, 201 * u]]), 'sea', 0.6, 1);
      p.fill(C.rect(gx - 31 * u, 185 * u, 17 * u, 1), 'wood', 3.2, 2);
      // The bottom corners, where the board shows the most: barrels on the right, a heap of net and its floats on the left.
      barrel(p, W - 12 * u, 214 * u, u, { z: 5, v: 1.8, w: 9, h: 15, lit: -0.6 });
      barrel(p, W - 30 * u, 232 * u, u, { z: 6, v: 1.6, w: 9, h: 15, lit: -0.6 });
      barrel(p, W - 10 * u, 248 * u, u, { z: 7, v: 1.4, w: 9, h: 15, lit: -0.6 });
      // A lantern set down on the boards among them.
      lantern(p, W - 44 * u, 238 * u, u, { z: 8, s: 1.4, r: 40, k: 4.6, r2: 70, k2: 1, flick: true, phase: 0.6 });
      p.shade(C.ellipse(W - 44 * u, 244 * u, 9 * u, 2 * u), -1, 1);
      const hx = 20 * u; const hy = 222 * u;
      p.fill(C.ellipse(hx, hy, 26 * u, 10 * u, 24), 'wood', (x, y) => 1.6 + ((frac((x + y) / (3 * u)) < 0.3 || frac((x - y) / (3 * u)) < 0.3) ? 1.1 : -0.3) - (y - hy) / (10 * u) * 0.6, 4);
      for (let k = 0; k < 5; k += 1) p.fill(C.ellipse(hx - 18 * u + k * 9 * u, hy - 6 * u + (k % 2) * 7 * u, 2.4 * u, 1.5 * u), 'wood', 3.8, 5);
      p.fill(C.join(C.ellipse(gx + 34 * u, 236 * u, 12 * u, 4.4 * u), C.ellipse(gx + 34 * u, 236 * u, 6 * u, 2 * u)), 'wood', (x, y) => 2 + (frac(Math.atan2(y - 236 * u, (x - gx - 34 * u) / 2.6) * 2.4) < 0.3 ? -0.8 : 0), 4);
      // Lanterns on mooring piles out in the water at each side, up by the landing: a warm pool on the water, their light streaming down it.
      const lamps = [[13 * u, 86 * u], [W - 13 * u, 82 * u]];
      lamps.forEach(([x, y], k) => {
        const lx = Math.round(x); const ly = Math.round(y);
        p.fill(C.rect(lx - Math.round(2.4 * u), ly + 4 * u, Math.round(4.8 * u), 30 * u), 'wood', (px) => 2 + (px < lx ? 0.8 : -0.3), 3);
        p.fill(C.rect(lx - Math.round(2.4 * u), ly + 4 * u, Math.round(4.8 * u), 1), 'wood', 3.4, 3);
        lantern(p, lx + 0.5, ly, u, { z: 6, r: 22, k: 4.6, r2: 44, k2: 1.2, flick: true, phase: k * 2.1 });
        p.light(lx + 0.5, ly + 34 * u, 22 * u, 2.6, flicker(k * 2.1, 0.12, 0.8), { zMax: 0, sy: 0.4 });
        stillRefl(p, lx + 0.5, ly + 34 * u, ly + 100 * u, { u, v: 4.4, w: 1.2, grow: 1.6, seed: k + 4 });
        darkRefl(p, lx, 4.8 * u, ly + 34 * u, ly + 52 * u, 9 + k, -0.8);
      });
      // The landing's lanterns, beyond the vista, lighting the boards from the top.
      p.light(gx, -40 * u, 160 * u, 4, flicker(0.7, 0.05, 0.5), { sx: 1.5, zMin: 1 });
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.36));
      const rip = [];
      for (let k = 0; k < 10; k += 1) rip.push([hash(k, 1, 51) < 0.5 ? hash(k, 2, 51) * 30 * u : W - hash(k, 2, 51) * 30 * u, (40 + hash(k, 3, 51) * 190) * u, hash(k, 4, 51)]);
      return {
        p,
        over(img, t) {
          for (const q of PX.particles('drip', 14, [20 * u, 0, W - 40 * u, H * 0.6], t, 41)) { put(img, q.x, q.y, '#5E5A4E', 0.9); put(img, q.x, q.y - 1, '#22272B', 0.8); }
          // Rings spreading where the drips land in the water at the sides.
          for (const [x, y, ph] of rip) {
            const life = frac(t * 0.5 + ph); const r = life * 7 * u;
            for (let a = 0; a < 12; a += 1) put(img, x + Math.cos(a / 12 * 6.283) * r, y + Math.sin(a / 12 * 6.283) * r * 0.35, '#33434E', (1 - life) * 0.6);
          }
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B]);
})();

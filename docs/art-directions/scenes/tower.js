/* Job 2, the tower: two directions. */
(() => {
  const { C, Painter, put, sprite, particles, flicker, SUBJECT, CARD, hash, clamp, lerp, rng } = PX;

  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }

  /* ---------- candles: wax on a dish, a light of its own, the flame drawn per frame ---------- */

  /** `wax` is an emitting ramp: a candle's own flame lights its top, and no other light reaches it. */
  function candle(p, x, fy, h, o = {}) {
    x = Math.round(x); fy = Math.round(fy);
    const z = o.z ?? 6;
    if (o.dish !== false) p.fill(C.rect(x - 1, fy - 1, 3, 1), 'brass', o.dv ?? 3, z);
    p.fill(C.rect(x, fy - h - (o.dish !== false ? 1 : 0), 1, h), 'wax', (xx, yy) => (o.wv ?? 4.2) - (yy - (fy - h)) * 0.9, z);
    const f = { x, y: fy - h - (o.dish !== false ? 2 : 1), ph: o.ph ?? hash(x, fy, 5) * 6.28, big: !!o.big };
    if (o.r) p.light(x + 0.5, f.y, o.r, o.s ?? 3, o.flick ? flicker(f.ph, o.depth ?? 0.22, 1.3) : null, { zMin: o.zMin ?? 1, zMax: o.zMax, hard: true });
    return f;
  }

  function flame(img, f, t = 0) {
    const k = Math.floor(t * 6 + f.ph * 5) % 5;
    const sway = [0, 0, -1, 0, 1][k];
    put(img, f.x, f.y, '#FFF1C4');
    put(img, f.x, f.y - 1, f.big ? '#FFF1C4' : '#F2CB8A');
    if (f.big) put(img, f.x, f.y - 2, '#F2CB8A');
    put(img, f.x + sway, f.y - (f.big ? 3 : 2), '#E3A445', k === 3 ? 0.45 : 0.95);
    put(img, f.x - 1, f.y, '#E3A445', 0.28); put(img, f.x + 1, f.y, '#E3A445', 0.28);
  }

  /* ---------- books: each shelf row its own run of spines ---------- */

  function bookRows(seed, nRamps) {
    const cache = new Map();
    return (ry) => {
      let row = cache.get(ry);
      if (row) return row;
      const r = rng(seed * 7919 + ry * 104729 + 17);
      const idx = new Int16Array(2048); const books = [];
      let s = 0;
      while (s < 2048) {
        const gap = r() < 0.07;
        const w = gap ? 1 + Math.floor(r() * 3) : (r() < 0.7 ? 1 : 2);
        books.push({ ramp: Math.floor(r() * nRamps), v: r() - 0.5, h: gap ? 0 : 0.55 + r() * 0.45, band: r() < 0.5 ? 0.2 + r() * 0.4 : -1 });
        for (let k = 0; k < w && s < 2048; k += 1) idx[s++] = books.length - 1;
      }
      row = { idx, books };
      cache.set(ry, row);
      return row;
    };
  }

  /**
   * One pixel of a bookcase: `s` across (in spines), `ly` down the row from
   * the shelf above, `rh` the row's height in pixels. Spines of uneven
   * height, gilt bands, the dark back of the shelf above short books, the
   * shelf's lit front edge under them.
   */
  function bookPixel(p, i, row, s, ly, rh, v0, rampIdx, woodIdx) {
    if (ly >= rh - 1) { p.r[i] = woodIdx; p.v[i] = v0 + 0.9; return; }
    const b = row.books[row.idx[(Math.floor(s) + 1024) & 2047]];
    const top = (rh - 1) * (1 - b.h);
    if (ly < top) { p.r[i] = woodIdx; p.v[i] = v0 - 0.75; return; }
    let v = v0 + b.v * 0.9;
    if (b.band >= 0 && Math.floor(ly) === Math.floor(top + b.band * (rh - 1 - top))) v += 0.8;
    if (Math.floor(ly) === Math.ceil(top)) v += 0.25;
    p.r[i] = rampIdx[b.ramp]; p.v[i] = v;
  }

  /** A flat wall of bookcases inside a shape: rows `rh` high, an upright every `bay`. */
  function shelves(p, shape, o) {
    const rows = bookRows(o.seed || 1, o.books.length);
    const ri = o.books.map((b) => p.ri(b)); const wi = p.ri(o.wood || 'wood');
    const rh = o.rh; const oy = o.oy || 0; const bay = o.bay || 1e9; const ox = o.ox || 0;
    p.each(shape, (x, y, i) => {
      const bx = ((x - ox) % bay + bay) % bay;
      p.z[i] = o.z;
      if (bx < 2) { p.r[i] = wi; p.v[i] = o.v0 + (bx < 1 ? 0.7 : 0.1); return; }
      const ry = Math.floor((y - oy) / rh);
      bookPixel(p, i, rows(ry), x * 1.0 + ry * 13, y - oy - ry * rh, rh, o.v0, ri, wi);
    });
  }

  /* ---------- floors ---------- */

  /** Floorboards in perspective: planks run to (vx, vy), butt joints staggered along each. */
  function boards(p, shape, o) {
    const { vx, vy } = o; const cw = o.cw || 6; const d0 = o.d0 || 10; const k = o.k || 1.4; const seed = o.seed || 3;
    p.each(shape, (x, y, i) => {
      if (o.z !== undefined && p.z[i] !== o.z) return;
      const d = y + 0.5 - vy;
      if (d <= 0) return;
      const colF = ((x + 0.5 - vx) / d) * cw; const col = Math.floor(colF);
      const fx = (colF - col) * (d / cw);
      const along = Math.log(d / d0) * k + hash(col, 0, seed) * 3;
      const seg = Math.floor(along); const fy = (along - seg) * (d / k);
      let dv = (hash(col, seg, seed + 1) - 0.5) * (o.vary ?? 0.7);
      if (fx < 1) dv = o.joint ?? -1.1;
      else if (fy < 1) dv = (o.joint ?? -1.1) * 0.8;
      else {
        if (fx < 2) dv += o.left ?? 0.3;
        dv += (hash(col, Math.floor(along * 5), seed + 2) - 0.5) * 0.3;
      }
      p.v[i] += dv;
    });
  }

  /* ---------- windows and moonlight ---------- */

  /** A lancet window: a stone frame, glass lit by the night, lead in diamonds, a mullion. */
  function lancetWindow(p, cx, top, hw, bottom, o = {}) {
    const z = o.z ?? 2; const th = o.th ?? 2;
    const glass = C.arch(cx, top, hw, bottom, 1);
    const frame = C.join(C.arch(cx, top - th, hw + th, bottom + th, 1), glass);
    p.fill(frame, 'stone', o.fv ?? 2.4, z);
    p.shade(frame, (x) => (x > cx ? 0.8 : -0.2), z);
    const mx = o.moon ? o.moon[0] : cx + hw; const my = o.moon ? o.moon[1] : top;
    p.fill(glass, 'sky', (x, y) => (o.gv ?? 4.2) + 2.6 * Math.max(0, 1 - Math.hypot(x - mx, y - my) / (hw * 3.2)) - (y - top) / (bottom - top) * 1.1, z);
    const q = o.q ?? 4; const mi = p.ri('moon');
    p.each(glass, (x, y, i) => {
      const a = ((x - Math.floor(cx) + y) % q + q) % q; const b = ((x - Math.floor(cx) - y) % q + q) % q;
      if (o.lead !== false && (a === 0 || b === 0)) { p.r[i] = p.ri('iron'); p.v[i] = 1.6; }
    });
    if (o.moon) moonDisc(p, o.moon[0], o.moon[1], o.moon[2], z);
    if (o.transoms) for (let y = bottom - o.transoms; y > top + hw * 1.2; y -= o.transoms) p.fill(C.rect(cx - hw, Math.round(y), hw * 2, 1), 'iron', 1.2, z);
    if (o.mullion !== false) p.fill(C.rect(Math.floor(cx), top, 1, bottom - top), 'iron', 1.2, z);
    p.fill(C.rect(cx - hw - th, bottom, (hw + th) * 2, 1.5), 'cold', o.sv ?? 5, z);
    return glass;
  }

  /** The moon: a pale disc, darker toward its limb, its seas a few blotches. */
  function moonDisc(p, mx, my, r, z) {
    p.fill(C.circle(mx, my, r, 24), 'moon', (x, y) => {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my) / r;
      let v = 4.6 - d * d * 1.6;
      const sea = hash(Math.floor((x - mx) / Math.max(1, r * 0.4) + 50), Math.floor((y - my) / Math.max(1, r * 0.4) + 50), 41);
      if (sea < 0.3 && d < 0.85) v -= 1.1;
      return v;
    }, z);
  }

  /**
   * Moonlight falling through a room: inside a slanting shaft from (x0..x1, y0)
   * down by `len`, drifting `dx`, the stone turns to its cold ramp and climbs it.
   */
  function moonbeam(p, x0, x1, y0, len, dx, s, o = {}) {
    const cold = p.ri('cold'); const spread = o.spread ?? 0.6; const fade = o.fade ?? 0.7;
    const zMax = o.zMax ?? 5;
    const hwT = Math.abs(x1 - x0) / 2 * (1 + spread);
    const poly = C.poly([[x0 - 1, y0], [x1 + 1, y0], [(x0 + x1) / 2 + dx + hwT + 1, y0 + len], [(x0 + x1) / 2 + dx - hwT - 1, y0 + len]]);
    p.each(poly, (x, y, i) => {
      if (p.emit[p.r[i]] || p.z[i] > zMax || (o.skip && o.skip.includes(p.r[i]))) return;
      const t = clamp((y - y0) / len, 0, 1);
      const xc = (x0 + x1) / 2 + dx * t; const hw = Math.abs(x1 - x0) / 2 * (1 + t * spread);
      const d = Math.abs(x + 0.5 - xc) / hw;
      if (d >= 1) return;
      p.r[i] = cold;
      p.v[i] += s * (1 - d * d) * (1 - t * fade) * (o.floorY !== undefined && y >= o.floorY ? o.floorK : 1);
    });
  }

  /* ---------- the cards at a doorway, shared by the inside and the outside ---------- */

  /**
   * A hooded traveller in a card's colour, in flat bands: the cloak dark, the side toward
   * the lantern lit, a gold rim where the doorway is behind; a staff; the lantern held out.
   */
  function traveller(p, cx, L, s, ramp, u) {
    const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, L + y * s]));
    p.fill(P([[-0.36, 0], [-0.22, -0.5], [-0.17, -0.72], [-0.09, -0.86], [0, -0.92], [0.1, -0.86], [0.18, -0.7], [0.24, -0.5], [0.34, 0]]), ramp, 0.2, 7);
    p.fill(P([[0.15, -0.66], [0.38, -0.58], [0.4, -0.53], [0.17, -0.57]]), ramp, 0.2, 7);           // the arm, held out
    p.fill(P([[-0.07, -0.82], [0.08, -0.82], [0.07, -0.7], [-0.05, -0.7]]), 'shadow', 0, 7);         // the face, in the hood
    p.fill(C.rect(Math.round(cx - 0.31 * s), Math.round(L - 1.04 * s), 1, Math.round(1.04 * s)), 'shadow', 1, 7); // the staff
    p.backlit(7, 'glow', 4, 'glow', 6.2);
    const lx = Math.round(cx + 0.39 * s); const ly = Math.round(L - 0.46 * s);
    p.fill(C.rect(lx, Math.round(L - 0.53 * s), 1, ly - Math.round(L - 0.53 * s)), 'shadow', 1, 7); // its handle
    // The lantern's side of the cloak: a lit band, its edge brighter.
    p.each(C.rect(cx - 0.4 * s, L - s, 0.85 * s, s), (x, y, i) => {
      if (p.z[i] !== 7 || p.r[i] === p.ri('shadow')) return;
      const d = Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 0.7);
      if (d > 0.42 * s) return;
      const edge = p.z[i + 1] !== 7 || p.z[i - p.w] !== 7;
      p.r[i] = p.ri(ramp); p.v[i] = edge ? 3.2 : d < 0.26 * s ? 2.2 : 1.2;
    });
    p.fill(C.rect(lx - 1, ly, 3, 3), ramp, 3.2, 8);
    p.fill(C.rect(lx, ly + 1, 1, 1), ramp, 4.2, 8);
    p.tint(lx + 0.5, ly + 1.5, 6 * u, CARD.wand[3], 0.7, flicker(0.9, 0.12));
    p.tint(lx + 0.5, L - 0.5, 7 * u, CARD.wand[2], 0.5, flicker(0.9, 0.12)); // its light on the landing
  }

  /** A lectern with an open grimoire on it, its pages alight. */
  function grimoire(p, gx, L, u, ramp, hex) {
    p.fill(C.poly([[gx - 2.5 * u, L], [gx - 1.2 * u, L - 15 * u], [gx + 1.2 * u, L - 15 * u], [gx + 2.5 * u, L]]), 'wood', 1.0, 7);
    p.fill(C.rect(gx - 6 * u, L - 2 * u, 12 * u, 2 * u), 'wood', 1.0, 7);
    p.fill(C.poly([[gx - 9 * u, L - 18 * u], [gx + 9 * u, L - 18 * u], [gx + 7 * u, L - 14 * u], [gx - 7 * u, L - 14 * u]]), 'wood', 1.4, 7);
    // The book lies open: two pages rising to the spine's valley, edges lit, lines of script.
    const by = L - 18 * u;
    for (const m of [-1, 1]) {
      const pg = C.poly([[gx, by], [gx + m * 11 * u, by - 1.5 * u], [gx + m * 11.5 * u, by - 7 * u], [gx + m * 1 * u, by - 5 * u]]);
      p.fill(pg, ramp, (x, y) => 3.9 - Math.abs(x - gx) / (11 * u) * 1.0 + (((by - y) % (1.6 * u)) < 0.6 && Math.abs(x - gx) > 2 * u ? -0.9 : 0), 8);
    }
    p.fill(C.rect(gx - 0.5, by - 5 * u, 1, 5 * u), ramp, 2.2, 8);
    p.backlit(7, 'glow', 4, 'glow', 6.2);
    p.tint(gx, by - 4 * u, 26 * u, hex, 0.6, flicker(2, 0.15, 0.7));
  }

  /** A ward drawn across a doorway: a ring, a triangle, a broken inner circle of script. */
  function ward(p, gx, wy, R, ramp, hex, u) {
    p.each(C.circle(gx, wy, R + 1.5), (x, y, i) => {
      const px = x + 0.5; const py = y + 0.5;
      const d = Math.hypot(px - gx, py - wy);
      const a = Math.atan2(py - wy, px - gx);
      let on = Math.abs(d - R) < 0.75;
      for (let k = 0; k < 3; k += 1) {
        const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / 3; const a1 = a0 + (2 * Math.PI) / 3;
        const ax = gx + R * Math.cos(a0); const ay = wy + R * Math.sin(a0); const bx = gx + R * Math.cos(a1); const by = wy + R * Math.sin(a1);
        const dist = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / Math.hypot(bx - ax, by - ay);
        if (dist < 0.6) on = true;
      }
      if (Math.abs(d - R * 0.42) < 0.6 && Math.sin(a * 5) > 0.2) on = true;
      if (on) { p.r[i] = p.ri(ramp); p.v[i] = 3.7; p.z[i] = 8; }
    });
    p.tint(gx, wy, 26 * u, hex, 0.5, flicker(0.5, 0.12, 0.6));
  }

  /* ================= A: the stair library ================= */

  const RAMPS_A = {
    stone: ['#07080C', '#0D0F16', '#131620', '#1B1C29', '#262638', '#302F43', '#3A394E', '#4A4656', '#605660', '#7B6A66', '#9B826C', '#C09F76'],
    cold: ['#07080C', '#0D0F15', '#13161F', '#1A1E29', '#232834', '#2E3442', '#3C4354', '#505869', '#6A7283', '#8C95A6', '#B5BECD', '#DCE3EE'],
    wood: ['#0A0708', '#120D0D', '#1B1312', '#261B17', '#34251D', '#453022', '#5A3E29', '#755233', '#966A40', '#BC8A52'],
    floor: ['#060506', '#0C0A0A', '#141010', '#1D1715', '#28201B', '#352A22', '#45362A', '#5A4534', '#755A42', '#957352'],
    leather: ['#0B0807', '#150F0C', '#211812', '#2F2218', '#3F2E1F', '#553D27', '#6F5132', '#8E6A40', '#B08A55'],
    vellum: ['#0C0B0A', '#171512', '#25211B', '#353026', '#4A4334', '#645A44', '#837556', '#A8966C', '#CDB98A'],
    cloth: ['#0A090C', '#131117', '#1D1A22', '#292430', '#36303D', '#463E4B', '#5A505C', '#73656E', '#917E82'],
    sky: ['#05060A', '#0A0C14', '#10131D', '#171B28', '#1F2535', '#293044', '#363E55', '#485169', '#5F6982', '#7F8AA3', '#A9B4C8', '#D5DDEA'],
    moon: ['#3F4A66', '#6D759C', '#97A3C4', '#C9D6EA', '#E4ECF6', '#F8FBFF'],
    glow: ['#120B06', '#24170B', '#3D2A0E', '#5C3E14', '#8A5E1E', '#B57E2E', '#E3A445', '#F2CB8A', '#FFE3A8', '#FFF1C4'],
    wax: ['#15110E', '#2A231C', '#4A3E30', '#76644C', '#A88F6C', '#D6C097', '#F2E3BE'],
    iron: ['#050507', '#0C0C10', '#15151B', '#202029', '#2E2E3A', '#43434F', '#606070'],
    brass: ['#0E0A05', '#1C140A', '#2E2110', '#453218', '#614822', '#82622F', '#A98242', '#D2A85E'],
    shadow: ['#030305', '#08080C', '#0F0F15', '#17161E'],
    rug: ['#0A0807', '#120E0B', '#1A1410', '#241B14', '#2F2318', '#3D2D1E', '#4F3A25', '#664B2E'],
    ...CARD,
  };
  const BOOKS_A = ['leather', 'vellum', 'cloth', 'leather', 'stone'];

  /**
   * One flight of stone steps rising from (x0, y0) to (x1, y1), either way:
   * a stepped top, a smooth underside `T` below the line. Far flights are lit
   * stone; near ones are dark, their step ends catching the candles.
   */
  function flight(p, f) {
    const dir = Math.sign(f.x1 - f.x0); const len = Math.abs(f.x1 - f.x0); const rise = f.y0 - f.y1;
    const sw = len / f.n; const sh = rise / f.n;
    const si = p.ri(f.ramp || 'stone');
    const xa = Math.min(f.x0, f.x1); const xb = Math.max(f.x0, f.x1);
    p.each(C.rect(xa, f.y1 - sh - 1, xb - xa, rise + sh + f.T + 2), (x, y, i) => {
      if (p.z[i] > f.z) return;
      const run = (x + 0.5 - f.x0) * dir;
      if (run < 0 || run > len) return;
      const k = Math.min(f.n - 1, Math.floor(run / sw));
      const yT = f.y0 - (k + 1) * sh; const yS = f.y0 - run * (rise / len) + f.T;
      const yy = y + 0.5;
      if (yy < yT || yy > yS) return;
      const kk = run / sw - k;
      let v = f.v;
      if (yy - yT < 1) v += f.nose ?? 1.4;
      else if (yy > yT + sh + 0.5) v += f.under ?? -1.1;
      else if ((dir > 0 ? kk : 1 - kk) < 0.14) v -= 0.7;
      if (f.edge && yy > yS - 1) v += f.edge;
      p.r[i] = si; p.v[i] = v; p.z[i] = f.z;
    });
    // Its railing: a rail `f.rail` above the line and a baluster on every other step.
    if (f.rail) {
      const ii = p.ri('iron');
      p.each(C.rect(xa, f.y1 - f.rail - 2, xb - xa, rise + f.rail + 3), (x, y, i) => {
        if (p.z[i] > f.rz) return;
        const run = (x + 0.5 - f.x0) * dir;
        if (run < 0 || run > len) return;
        const yr = f.y0 - run * (rise / len) - f.rail; const k = Math.floor(run / sw);
        const yT = f.y0 - (k + 1) * sh;
        const yy = y + 0.5;
        if (Math.abs(yy - yr) < 0.6) { p.r[i] = ii; p.v[i] = f.rv + 0.8; p.z[i] = f.rz; }
        else if (yy > yr && yy < yT && (run % (sw * 2)) < 1) { p.r[i] = ii; p.v[i] = f.rv; p.z[i] = f.rz; }
      });
    }
    return { sw, sh, dir, len };
  }

  /**
   * The tower's shaft through an opening: bookcases round its wall, and a
   * stair winding up it in flights that shorten as they climb, the far ones
   * lit, the near ones dark across the view, a candle every few steps on
   * both, so the flames trace the way up to the window and the moon.
   */
  function shaft(p, area, o) {
    const { cx, floor } = o;
    const rows = bookRows(o.seed || 3, BOOKS_A.length);
    const ri = BOOKS_A.map((b) => p.ri(b)); const wi = p.ri('wood');
    // The wall: rows of books, narrowing toward the sides as the wall turns away.
    const R = o.R;
    p.each(area, (x, y, i) => {
      const sx = clamp((x + 0.5 - cx) / R, -0.999, 0.999);
      const th = Math.asin(sx); const cs = Math.cos(th);
      const t = clamp((floor - y) / (floor - o.yTop), 0, 1);
      const rh = lerp(o.rh0, o.rh1, t);
      // Rows in a shrinking pitch: integrate the row height.
      const rowF = (floor - y) / rh;
      const ry = Math.floor(rowF); const ly = (1 - (rowF - ry)) * rh;
      const v0 = o.wallV - 1.2 * (1 - cs);
      p.z[i] = 1;
      const s = th * R * 1.1;
      if (((s + 400) % 17) < 1.4) { p.r[i] = wi; p.v[i] = v0 + 0.5; } else bookPixel(p, i, rows(ry), s + ry * 11, ly, Math.max(3, Math.round(rh)), v0, ri, wi);
    });
    if (o.onWall) o.onWall();
    // The flights, each a little shorter and narrower than the one below.
    const flames = [];
    let y = floor;
    for (let k = 0; k < o.rises.length; k += 1) {
      const rise = o.rises[k]; const sc = rise / o.rises[0];
      const hw = o.hw * (1 - k * 0.05);
      const near = k % 2 === 1;
      const x0 = near ? cx + hw : cx - hw; const x1 = near ? cx - hw : cx + hw;
      const T = (near ? o.Tn : o.Tf) * (0.5 + 0.5 * sc);
      const f = {
        x0, y0: y, x1, y1: y - rise, n: o.ns ? o.ns[k] : o.n, T, z: near ? 4 : 2, v: near ? o.nearV : o.stepV,
        nose: near ? 1.2 : 1.5, under: near ? 0 : -1.2, edge: near ? 0.5 : 0,
        rail: Math.max(3, o.rail * sc), rz: 3, rv: near ? 0.6 : 1.0,
      };
      const g = flight(p, f);
      // Candles: on a near flight they light what is behind it, so it stays a dark shape with lit edges.
      const n = o.ns ? o.ns[k] : o.n;
      for (let s = near ? 2 : 1; s < n; s += o.every) {
        const xs = x0 + g.dir * (s + 0.5) * g.sw; const ys = y - (s + 1) * g.sh;
        const r = o.candleR * (0.5 + 0.5 * sc);
        flames.push(candle(p, xs, ys, Math.max(1, Math.round(2 * sc + 0.3)), { z: f.z + 1, dish: false, r, s: o.candleS, zMax: near ? 3 : 4, flick: o.flick, ph: o.ph && o.ph(k, s) }));
        if (near) p.light(xs + 0.5, ys - 1, r * 0.45, 1.6, null, { zMin: 4, zMax: 4, hard: true });
      }
      y -= rise;
    }
    return { flames, top: y };
  }

  const A = {
    job: 2, setting: 'tower', key: 'A', id: 'tower-a', side: 'inside',
    name: 'Tower', title: 'The stair library',
    pitch: 'Everything climbs. A spiral stair winds up past shelves of books, a candle on every few steps, to a cold moon in a lancet window at the top. Someone has been reading up here for a long time.',
    notes: [
      ['Light', 'Many small amber candles, each flickering on its own, climbing with the stair; a cold moon through the lancet windows. The candles are the tower’s gold; the moonlight is pale, never blue.'],
      ['Detail', 'Bookcases of uneven spines with gilt bands, a stone stair with lit treads and an iron railing, leaded lancet windows with the moon in them, wax on the steps.'],
      ['Vista', 'A long library wall, shelves floor to ceiling, a stair rising across it to a landing. The card stands in the lit doorway at the landing: a shape against the candlelight, a grimoire glowing, a ward across the door.'],
      ['World', 'Dark floorboards under the table, moonlight falling in from the top, candles in the shelves at the sides, motes rising. Black toward the hand.'],
    ],
    palette: ['#07080C', '#1B1C29', '#3A394E', '#605660', '#9B826C', '#34251D', '#E3A445', '#F2CB8A', '#C9D6EA'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 134;
      const floor = Math.round(110 * u);
      const ox = W / 2; const ohw = 17 * u; const otop = 22 * u;
      const open = C.arch(ox, otop, ohw, floor, 1);
      // Through the opening: the shaft.
      const sh = shaft(p, C.rect(ox - ohw - 1, 0, ohw * 2 + 2, floor), {
        cx: ox, floor, yTop: 40 * u, R: 22 * u, rh0: 8 * u, rh1: 4 * u, hw: 15 * u,
        rises: [19, 15, 12, 9.5].map((r) => r * u), ns: [6, 6, 5, 5], Tf: 5 * u, Tn: 7 * u, rail: 7 * u,
        every: 2, candleR: 13 * u, candleS: 3.4, seed: 5, wallV: 1.1, stepV: 3.2, nearV: 0.25,
        onWall() {
          // The top: a lancet window with the moon, its light falling down the well.
          lancetWindow(p, ox, 26 * u, 8 * u, 50 * u, { z: 1, moon: [ox + 2 * u, 34 * u, 4.8 * u], th: 1.5, gv: 3.4, lead: false, mullion: false });
          for (const [sx, sy] of [[-5, 41], [-3, 46], [4, 44], [-6, 36], [5, 48]]) p.fill(C.rect(ox + sx * u, sy * u, 1, 1), 'sky', 8.5, 1);
          p.fill(C.rect(ox - 10 * u, 50 * u, 20 * u, 4 * u), 'stone', 2.6, 2); // the top landing
          p.fill(C.rect(ox - 10 * u, 50 * u, 20 * u, 1), 'cold', 5.5, 2);
        },
      });
      moonbeam(p, ox - 4 * u, ox + 4 * u, 52 * u, 40 * u, -4 * u, 1.3, { zMax: 3, spread: 0.6, fade: 0.9 });
      // Warmth from the foot of the stair.
      p.light(ox, floor, 60 * u, 1.8, null, { zMax: 4 });
      // The near wall, with the opening cut through it.
      const wall = C.join(C.rect(0, 0, W, floor), open);
      p.fill(wall, 'stone', 0.7, 5);
      p.masonry(wall, { bw: 8 * u, bh: 6 * u, joint: -1.1, top: 0.5, left: 0.3, vary: 1, chip: 0.05, seed: 7, z: 5 });
      const ring = C.join(C.arch(ox, otop - 4 * u, ohw + 4 * u, floor, 1), open);
      p.fill(ring, 'stone', 2.2, 6);
      p.shade(ring, (x, y) => {
        const a = Math.atan2(floor - y, x - ox);
        return ((a / Math.PI) * 13) % 1 < 0.16 ? -1.1 : (x < ox ? 0.3 : -0.1);
      }, 6);
      p.fill(C.rect(0, floor, W, H - floor), 'floor', 1.4, 5);
      boards(p, C.rect(0, floor, W, H - floor), { vx: ox, vy: floor - 30 * u, cw: 5, d0: 20 * u, k: 2.2, joint: -1.1, seed: 4, z: 5 });
      // Candle niches either side.
      const flames = [...sh.flames];
      for (const nx of [W * 0.16, W * 0.84]) {
        const ny = 66 * u;
        p.fill(C.arch(nx, ny - 12 * u, 5 * u, ny + 2 * u), 'stone', 0.5, 6);
        flames.push(candle(p, nx, ny + 1 * u, 3, { z: 7, big: true, r: 26 * u, s: 4.2, zMin: 5 }));
        p.light(nx, ny - 4 * u, 46 * u, 1.2, null, { zMin: 5 });
      }
      // The threshold, lit from inside.
      p.light(ox, floor, 26 * u, 2.6, null, { zMin: 5, sy: 0.5 });
      vignette(p, W, H, 2.4);
      p.rim(0, -1, 0.5, 5);
      return { p, over(img) { for (const f of flames) flame(img, f, 0); } };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 100; const gx = W / 2;
      const F = Math.round(88 * u); const L = Math.round(58 * u);
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      // The wall: bookcases floor to ceiling.
      shelves(p, C.rect(0, 0, W, F), { rh: Math.max(5, Math.round(9 * u)), oy: 2, bay: Math.round(26 * u), ox: Math.round(gx), books: BOOKS_A, v0: 1.0, z: 1, seed: 9 });
      p.fill(C.rect(0, 0, W, 3 * u), 'wood', 0.6, 1);
      // Lancet windows high in the wall, at a steady pitch; the moon in one.
      const wins = [];
      for (let d = 52 * u; gx + d < W + 20 * u; d += 66 * u) wins.push(gx + d, gx - d - 26 * u);
      wins.forEach((x, k) => lancetWindow(p, Math.round(x), 7 * u, 6 * u, 46 * u, {
        z: 2, moon: k === 1 ? [x + 1.5 * u, 18 * u, 4.4 * u] : null, th: Math.max(1.5, 2 * u), lead: false, transoms: Math.round(12 * u), gv: 3.6,
      }));
      // The floor.
      p.fill(C.rect(0, F, W, H - F), 'floor', 1.3, 1);
      boards(p, C.rect(0, F, W, H - F), { vx: gx, vy: F - 26 * u, cw: 7, d0: 12 * u, k: 1.6, seed: 6, z: 1 });
      // Moonlight through every window, down across the shelves to the floor.
      wins.forEach((x) => moonbeam(p, x - 5 * u, x + 5 * u, 47 * u, H - 47 * u + 4 * u, -30 * u, 0.7, { zMax: 2, spread: 0.7, fade: 0, floorY: F, floorK: 4 }));
      // The doorway at the landing, wide enough to stand a shape against its light.
      const dhw = 14 * u; const dtop = 5 * u;
      const door = C.arch(gx, dtop, dhw, L, 1);
      const th = Math.max(2, Math.round(3 * u));
      const ring = C.join(C.arch(gx, dtop - th, dhw + th, L, 1), door);
      p.fill(ring, 'stone', 2.4, 3);
      p.shade(ring, (x, y) => (((Math.atan2(L - y, x - gx) / Math.PI) * 13) % 1 < 0.16 ? -1.1 : 0.2), 3);
      const bright = cat === 'obstacle' ? 0.42 : cat === 'clear-path' ? 1.3 : 1;
      // Inside: candlelight, brightest low behind whatever stands there.
      p.glow(door, 'glow', gx, L - 6 * u, 26 * u, 8.9 * Math.min(1.12, bright), 3.4 * bright, 2, { sy: 1.4 });
      if (cat === 'clear-path') {
        // The stair goes on through the door, up into the light.
        const n = 7; const s0 = L - 2 * u;
        p.each(door, (x, y, i) => {
          const k = Math.floor((s0 - y) / (4 * u));
          if (k < 0 || k >= n) return;
          const ly = (s0 - y) - k * 4 * u;
          const w = dhw * (1 - k * 0.11);
          if (Math.abs(x + 0.5 - gx) > w) return;
          p.v[i] = 5.4 + k * 0.55 - (ly > 4 * u - 1 ? -1.2 : 0) - (ly < 1 ? 1.4 : 0);
        });
      }
      // The stair: up from the floor on the left to the landing, on from it to the right and out of the top.
      const step = 5 * u; const lw = 17 * u;
      const T = Math.max(4, Math.round(8 * u));
      const flights = [{ x0: gx - lw - (F - L), y0: F, x1: gx - lw, y1: L }, { x0: gx + lw, y0: L, x1: gx + lw + L + 8 * u, y1: -8 * u }];
      const flames = [];
      for (const fl of flights) {
        const n = Math.round((fl.y0 - fl.y1) / step);
        flight(p, { ...fl, n, T, z: 4, v: 2.2, nose: 1.6, under: -1.0, rail: 10 * u, rz: 5, rv: 1.4 });
        for (let k = 1; k < n - 1; k += 3) {
          const x = fl.x0 + (k + 0.5) * (fl.x1 - fl.x0) / n; const y = fl.y0 - (k + 1) * (fl.y0 - fl.y1) / n;
          if (y < 6 * u) continue;
          flames.push(candle(p, x, y, Math.max(2, Math.round(3 * u)), { z: 6, dish: false, r: 20 * u, s: 3.8, flick: true, zMin: 1 }));
        }
      }
      // The landing and the pier under it, books kept in an arched recess.
      p.fill(C.rect(gx - lw - 1, L, lw * 2 + 2, T), 'stone', 2.3, 4);
      p.fill(C.rect(gx - lw - 1, L, lw * 2 + 2, 1), 'stone', 3.9, 4);
      const pier = C.rect(gx - lw + 3 * u, L + T, lw * 2 - 6 * u, F - L - T);
      p.fill(pier, 'stone', 1.3, 3);
      p.masonry(pier, { bw: 7 * u, bh: 5 * u, joint: -1, top: 0.4, vary: 0.8, seed: 3, z: 3 });
      shelves(p, C.arch(gx, L + T + 4 * u, 8 * u, F), { rh: Math.max(4, Math.round(7 * u)), oy: 0, books: BOOKS_A, v0: 0.4, z: 3, seed: 31 });
      // Sconces of three candles on the bookcases between the windows: a warm pool each.
      const sconces = [];
      for (let d = 92 * u; gx + d < W + 10 * u; d += 132 * u) sconces.push(gx + d, gx - d + 30 * u);
      for (const sx of sconces) {
        const sy = Math.round(36 * u);
        p.fill(C.rect(sx - 4 * u, sy, 8 * u, 1), 'brass', 3, 6);
        p.fill(C.rect(sx - 0.5, sy, 1, 4 * u), 'brass', 2.6, 6);
        for (const dx of [-4, 0, 4]) flames.push(candle(p, sx + dx * u, sy, Math.max(2, Math.round(3 * u)) + (dx ? 0 : 1), { z: 6, dish: false, r: 30 * u, s: dx ? 1.6 : 3.4, flick: true, zMin: 1 }));
      }
      // A library ladder against the shelves here and there; a standing candelabrum at the stair's foot.
      // Each ladder stands in a sconce's pool, so its rails and rungs catch the light.
      for (const lx of [gx - 196 * u, gx + 78 * u]) {
        const top = 4 * u; const lean = 10 * u; const lw2 = 7 * u;
        p.fill(C.rect(lx - 1, F - 1, lw2 + 3, 1), 'shadow', 0.3, 3);
        for (const dx of [0, lw2]) p.fill(C.poly([[lx + dx, F], [lx + dx + 1.5, F], [lx + dx + lean + 1.5, top], [lx + dx + lean, top]]), 'wood', 3.6, 3);
        for (let y = F - 5 * u; y > top + 3 * u; y -= 5 * u) {
          const t = (F - y) / (F - top);
          p.fill(C.rect(lx + lean * t + 1, Math.round(y), lw2 - 0.5, 1), 'wood', 4.4, 3);
        }
      }
      {
        const cx = Math.round(gx - lw - (F - L) - 9 * u); const top = F - 22 * u;
        p.fill(C.poly([[cx - 4 * u, F], [cx + 4 * u, F], [cx + 1, F - 3 * u], [cx - 1, F - 3 * u]]), 'brass', 2.2, 5);
        p.fill(C.rect(cx, top, 1, F - top), 'brass', 2.6, 5);
        p.fill(C.rect(cx - 5 * u, top, 10 * u + 1, 1), 'brass', 3, 5);
        for (const dx of [-5, 0, 5]) flames.push(candle(p, cx + dx * u, top, Math.max(2, Math.round(3 * u)) + (dx ? 0 : 1), { z: 6, dish: false, r: dx ? 14 * u : 30 * u, s: dx ? 1.4 : 3.6, flick: true, zMin: 1 }));
      }
      // The card, in the doorway.
      const sub = 30 * u;
      if (cat === 'monster') {
        SUBJECT.monster(p, gx, L, sub, ramp, 7);
        p.backlit(7, 'glow', 4, 'glow', 6.2);
        p.tint(gx, L - sub * 0.9, 6 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        traveller(p, gx - 3 * u, L, sub + 3 * u, ramp, u);
      } else if (cat === 'item') {
        grimoire(p, gx, L, u, ramp, hex);
      } else if (cat === 'obstacle') {
        ward(p, gx, L - 22 * u, 10 * u, ramp, hex, u);
      } else if (cat === 'clear-path') {
        p.light(gx, L, 60 * u, 3.6, flicker(0.2, 0.06, 0.4), { zMin: 1, sy: 1.2 });
        p.tint(gx, L - 10 * u, 34 * u, CARD.path[3], 0.35, flicker(0.4, 0.08, 0.5));
      }
      // The doorway's light, on the landing and down the stair.
      p.light(gx, L - 2 * u, 40 * u, 3.4 * bright, flicker(1.1, 0.06, 0.5), { zMin: 3, zMax: 6 });
      vignette(p, W, H, 1.6, 0.4);
      p.rim(0, -1, 0.5, 4);
      return {
        p,
        over(img, t) {
          for (const f of flames) flame(img, f, t);
          for (const q of particles('mote', Math.round(W / 14), [0, 0, W, F], t, 12)) put(img, q.x, q.y, q.big ? '#E3A445' : '#8A5E1E', q.a * 0.7);
          if (cat === 'item') for (const q of particles('mote', 10, [gx - 9 * u, L - 46 * u, 18 * u, 24 * u], t, 4)) put(img, q.x, q.y, CARD.item[3], q.a);
          if (cat === 'clear-path') for (const q of particles('mote', 14, [gx - 14 * u, L - 44 * u, 28 * u, 44 * u], t, 6)) put(img, q.x, q.y, CARD.path[4], q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['glow', 'moon', 'wax'] });
      const u = H / 250;
      const vy = -110 * u;
      p.fill(C.rect(0, 0, W, H), 'floor', 1.2, 1);
      boards(p, C.rect(0, 0, W, H), { vx: W / 2, vy, cw: 9, d0: 40 * u, k: 1.6, seed: 9, z: 1 });
      // A long runner down the middle, in perspective with the boards: a lilac border, a worn
      // umber field with a row of lozenges, the boards showing at its frayed end.
      const rc = 0.2;
      const runner = C.poly([[W / 2 - rc * (0 - vy), 0], [W / 2 + rc * (0 - vy), 0], [W / 2 + rc * (H - vy), H], [W / 2 - rc * (H - vy), H]]);
      const rug = p.ri('rug'); const st = p.ri('stone');
      p.each(runner, (x, y, i) => {
        const d = y + 0.5 - vy; const e = Math.abs(x + 0.5 - W / 2) / (rc * d);
        const along = Math.log(d / (40 * u)) * 3.2;
        const fa = along - Math.floor(along);
        const lz = e * 3.2 + Math.abs(fa - 0.5) * 2;
        p.z[i] = 2;
        if (e > 1 - 1.2 / (rc * d)) { p.r[i] = rug; p.v[i] = 1.2; return; }        // the edge
        if (e > 0.84 && e < 0.92) { p.r[i] = st; p.v[i] = 2.6; return; }          // the border stripe
        p.r[i] = rug;
        p.v[i] = 2.2 + (lz < 0.6 ? (lz > 0.42 ? 0.9 : 0.4) : 0) + (hash(Math.floor(x / 2), Math.floor(y / 2), 61) - 0.5) * 0.35;
      });
      // Moonlight in from the top: three lancets laid on the boards.
      for (const [x, s] of [[W * 0.3, 1.8], [W * 0.5, 2.2], [W * 0.7, 1.8]]) moonbeam(p, x - 12 * u, x + 12 * u, -10 * u, 90 * u, (x - W / 2) * 0.3, s, { spread: 0.4, fade: 1 });
      // Fallen near the edges: an open book face down, loose pages, a closed book.
      const page = (x, y, w, h, a, v) => {
        const c = Math.cos(a); const s = Math.sin(a);
        const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
        p.fill(C.poly(pts), 'vellum', v, 4);
        p.fill(C.poly([pts[0], pts[1], [pts[1][0], pts[1][1] + 1], [pts[0][0], pts[0][1] + 1]]), 'vellum', v + 0.8, 4);
      };
      page(84 * u, 220 * u, 16 * u, 11 * u, -0.25, 4.0);
      page(104 * u, 236 * u, 14 * u, 10 * u, 0.4, 3.7);
      page(W - 64 * u, 214 * u, 15 * u, 10 * u, -0.5, 3.6);
      p.fill(C.poly([[62 * u, 240 * u], [80 * u, 234 * u], [96 * u, 240 * u], [80 * u, 246 * u]]), 'leather', 2.8, 4); // the open book, its spine up
      p.fill(C.poly([[78 * u, 234 * u], [82 * u, 234 * u], [82 * u, 246 * u], [78 * u, 246 * u]]), 'leather', 1.4, 4);
      // Candles burned down in a cluster on the floor at the bottom right, their pool on the boards.
      const flames = [];
      for (const [dx, dy, h] of [[0, 0, 4], [5, 3, 2], [-4, 4, 3], [2, 7, 1]]) flames.push(candle(p, W - 24 * u + dx * u, 186 * u + dy * u, h, { z: 5, dish: false, r: dx || dy ? 0 : 46 * u, s: 3.4, flick: true, zMin: 1 }));
      p.fill(C.ellipse(W - 23 * u, 192 * u, 9 * u, 3 * u), 'wax', 1.6, 3); // the wax run out round them
      flames.push(candle(p, 64 * u, 214 * u, 3, { z: 5, r: 40 * u, s: 3.2, flick: true, zMin: 1 })); // and one by the fallen book
      // Bookcases at the sides, a candle on each.
      for (const side of [0, 1]) {
        const wall = C.poly(side ? [[W - 30 * u, 0], [W, 0], [W, H], [W - 12 * u, H]] : [[0, 0], [30 * u, 0], [12 * u, H], [0, H]]);
        shelves(p, wall, { rh: Math.round(12 * u), bay: 1e9, books: BOOKS_A, v0: 1.0, z: 3, seed: 20 + side });
        const cx = side ? W - 20 * u : 20 * u;
        for (const [cy, k] of [[46 * u, 0], [86 * u, 1]]) flames.push(candle(p, cx + (k ? (side ? 3 : -3) * u : 0), cy, 3, { z: 6, r: 44 * u, s: 3.6, flick: true, zMin: 1, big: true }));
      }
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.36));
      return {
        p,
        over(img, t) {
          for (const f of flames) flame(img, f, t);
          for (const q of particles('mote', 26, [0, 30 * u, W, H * 0.62], t, 23)) put(img, q.x, q.y, q.big ? '#B57E2E' : '#6E4A1C', q.a * 0.8);
        },
      };
    },
  };


  /* ================= B: the observatory ================= */

  const RAMPS_B = {
    stone: ['#06070B', '#0B0D14', '#11141D', '#181B27', '#212433', '#2B2E40', '#363A4F', '#454A60', '#5A6075', '#767D92', '#9AA2B6', '#C6CEDD'],
    tile: ['#050609', '#0A0C12', '#10131B', '#171A25', '#1F2230', '#282B3B', '#333648', '#414558'],
    tilew: ['#050609', '#0A0C12', '#10121A', '#1E1A1F', '#3A2D2A', '#56422F', '#76583A', '#98743F'],
    stonew: ['#06070B', '#0B0D14', '#11141D', '#181B27', '#28232A', '#3A2D2B', '#52402F', '#6E5434', '#90703D', '#B38A47', '#D9A85A', '#F2CB8A'],
    cold: ['#07080C', '#0D0F15', '#13161F', '#1A1E29', '#232834', '#2E3442', '#3C4354', '#505869', '#6A7283', '#8C95A6', '#B5BECD', '#DCE3EE'],
    sky: ['#04050A', '#080A12', '#0C0F1A', '#121725', '#191F31', '#21293F', '#2C354F', '#3A4461', '#4D5876', '#66718E', '#8A94AE', '#B7C0D4'],
    moon: ['#4A5068', '#6D759C', '#97A3C4', '#B7C3DA', '#C9D6EA', '#E4ECF6', '#F8FBFF'],
    brass: ['#07060A', '#110D0B', '#1D160F', '#2C2114', '#3F2F1B', '#574124', '#75582F', '#98743D', '#BD9550', '#E0BB72'],
    wood: ['#0A0708', '#120D0D', '#1B1312', '#261B17', '#34251D', '#453022', '#5A3E29', '#755233', '#966A40', '#BC8A52'],
    leather: RAMPS_A.leather, vellum: RAMPS_A.vellum, cloth: RAMPS_A.cloth,
    paper: ['#0E0E10', '#1A1A1E', '#2A2A2F', '#3E3E44', '#57575D', '#75747A', '#99979A', '#C2BFBC'],
    glow: RAMPS_A.glow,
    wax: RAMPS_A.wax,
    iron: ['#040407', '#0A0A0F', '#121219', '#1C1C25', '#282834', '#383846', '#4E4E5E'],
    shadow: ['#020204', '#06070B', '#0C0D13', '#14151D'],
    ...CARD,
  };
  const BOOKS_B = ['leather', 'vellum', 'cloth', 'stone'];

  /** Checkered tiles on a floor in perspective, the joints running to (vx, vy). */
  function tiles(p, shape, o) {
    const { vx, vy } = o; const k = o.rows || 3; const cw = (o.size || 1) * k; const d0 = o.d0 || 10; const seed = o.seed || 4;
    p.each(shape, (x, y, i) => {
      if (o.z !== undefined && p.z[i] !== o.z) return;
      const d = y + 0.5 - vy;
      if (d <= 0) return;
      const rowF = Math.log(d / d0) * k; const row = Math.floor(rowF);
      const colF = ((x + 0.5 - vx) / d) * cw; const col = Math.floor(colF);
      const fy = (rowF - row) * (d / k); const fx = (colF - col) * (d / cw);
      let dv = ((col + row) & 1 ? o.check : -o.check) + (hash(col, row, seed) - 0.5) * (o.vary ?? 0.3);
      if (fy < 1 || fx < 1) dv = o.joint ?? -1;
      else if (fy < 2) dv += o.top ?? 0.3;
      p.v[i] += dv;
    });
  }

  /**
   * The one candle's reach: stone and tile inside it change to their warm
   * ramps (the same darks, amber at the top), so its light climbs to amber
   * while the moonlit room around stays cold. Keep it inside the light's
   * radius, where the two ramps still agree, and the edge never shows.
   */
  function warmPool(p, x, y, r, sy = 1) {
    const map = [['stone', 'stonew'], ['tile', 'tilew']].map(([a, b]) => [p.ri(a), p.ri(b)]);
    p.each(C.ellipse(x, y, r, r * sy), (xx, yy, i) => { for (const [a, b] of map) if (p.r[i] === a) p.r[i] = b; });
  }

  /**
   * The great round window: a ring of wedge stones, the night inside it,
   * stars, the moon, and iron tracery (a hub and spokes) over it all.
   */
  function oculus(p, cx, cy, r, o = {}) {
    const z = o.z ?? 2; const th = o.th ?? Math.max(3, r * 0.14);
    const glass = C.circle(cx, cy, r, 48);
    const ring = C.join(C.circle(cx, cy, r + th, 48), glass);
    p.fill(ring, 'stone', o.fv ?? 2.2, z);
    p.shade(ring, (x, y) => {
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const seg = ((a / Math.PI) * 10 + 20) % 1;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      return (seg < 0.12 ? -1.2 : 0) + (d > r + th - 1 ? -0.4 : d < r + 1 ? 0.9 : 0.2) + (y < cy ? 0.2 : -0.3);
    }, z);
    const [mx, my, mr] = o.moon || [cx, cy, 0];
    p.fill(glass, 'sky', (x, y) => {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      return (o.skyV ?? 2.4) + 4.4 * Math.max(0, 1 - (d - mr) / (r * 0.9)) ** 2;
    }, z);
    const rs = rng(o.seed || 'stars');
    for (let k = 0; k < (o.stars ?? 14); k += 1) {
      const a = rs() * Math.PI * 2; const d = Math.sqrt(rs()) * r * 0.92;
      const sx = cx + Math.cos(a) * d; const sy = cy + Math.sin(a) * d;
      if (Math.hypot(sx - mx, sy - my) < mr * 1.5) continue;
      p.fill(C.rect(Math.floor(sx), Math.floor(sy), 1, 1), 'sky', 8.5 + rs() * 2.5, z);
    }
    if (mr) moonDisc(p, mx, my, mr, z);
    if (o.tracery !== false) {
      const ti = p.ri('iron'); const hub = r * 0.24;
      p.each(glass, (x, y, i) => {
        const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const spoke = d > hub && Math.abs(Math.sin((a - Math.PI / 2) * 4)) * d < 0.6;
        if (spoke || d > r - 1) { p.r[i] = ti; p.v[i] = o.trV ?? 1.4; }
      });
    }
    return glass;
  }

  /**
   * A brass refractor on a tripod: a tapered tube with bands and a dew cap,
   * a finder, an eyepiece, a fork on the pivot and three legs.
   */
  function telescope(p, o) {
    const { x0, y0, x1, y1, r0, r1, z } = o;
    const ramp = o.ramp || 'brass'; const v = o.v ?? 1;
    const dx = x1 - x0; const dy = y1 - y0; const len = Math.hypot(dx, dy); const nx = -dy / len; const ny = dx / len;
    const at = (t, r) => [x0 + dx * t + nx * r, y0 + dy * t + ny * r];
    const seg = (t0, t1, ra, rb, val) => p.fill(C.poly([at(t0, ra), at(t1, rb), at(t1, -rb), at(t0, -ra)]), ramp, val, z);
    for (const [px, py] of o.feet) {
      const lx = px - o.pivot[0]; const ly = py - o.pivot[1]; const ll = Math.hypot(lx, ly); const w = o.leg ?? 0.7;
      p.fill(C.poly([[o.pivot[0] - (ly / ll) * w, o.pivot[1] + (lx / ll) * w], [px - (ly / ll) * w, py + (lx / ll) * w], [px + (ly / ll) * w, py - (lx / ll) * w], [o.pivot[0] + (ly / ll) * w, o.pivot[1] - (lx / ll) * w]]), ramp, v, z);
    }
    p.fill(C.rect(o.pivot[0] - r0 * 0.8, o.pivot[1] - r0 * 0.6, r0 * 1.6, r0 * 1.8), ramp, v + 0.4, z); // the head of the mount
    seg(0, 0.9, r0, r1, v);
    seg(0.86, 1, r1 * 1.25, r1 * 1.25, v + 0.2);        // the dew cap
    for (const t of [0.12, 0.42, 0.7]) seg(t, t + 0.035, r0 + (r1 - r0) * t + 0.6, r0 + (r1 - r0) * t + 0.6, v + 0.6);
    seg(0.25, 0.5, r0 * 0.45 + r1 * 0.2, r0 * 0.45 + r1 * 0.2, v); // the finder, beside it
    const fo = r0 + 1.6;
    p.fill(C.poly([at(0.28, fo - 0.7), at(0.5, fo + 0.2 - 0.7), at(0.5, fo + 0.2 + 0.7), at(0.28, fo + 0.7)]), ramp, v, z);
    p.fill(C.poly([at(-0.06, r0 * 0.5), at(0, r0 * 0.5), at(0, -r0 * 0.5), at(-0.06, -r0 * 0.5)]), ramp, v + 0.3, z); // the eyepiece
    const [cxw, cyw] = at(0.18, -r0 - 2.5);
    p.fill(C.circle(cxw, cyw, Math.max(1.2, r0 * 0.7), 10), ramp, v + 0.3, z); // a counterweight
  }

  /** A star chart pinned to the wall: a pale sheet, a few stars joined into a figure. */
  function starChart(p, x, y, w, h, seed, z = 3) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    p.fill(C.rect(x, y, w, h), 'paper', 1.9, z);
    p.fill(C.rect(x, y, w, 1), 'paper', 3.6, z);
    p.fill(C.rect(x + w - 1, y + 1, 1, h - 1), 'paper', 1.8, z);
    const r = rng(seed); const pts = [];
    for (let k = 0; k < 5; k += 1) pts.push([x + 1.5 + r() * (w - 3), y + 1.5 + r() * (h - 3)]);
    for (let k = 0; k + 1 < pts.length; k += 1) {
      const [ax, ay] = pts[k]; const [bx, by] = pts[k + 1]; const n = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let s = 1; s < n; s += 1) p.fill(C.rect(Math.floor(lerp(ax, bx, s / n)), Math.floor(lerp(ay, by, s / n)), 1, 1), 'paper', 1.9, z);
    }
    for (const [px, py] of pts) p.fill(C.rect(Math.floor(px), Math.floor(py), 1, 1), 'paper', 0.5, z);
  }

  /** A low bookcase, its top a shelf for things. */
  function bookcase(p, x, y, w, h, u, seed, z = 3) {
    p.fill(C.rect(x, y, w, h), 'wood', 1.4, z);
    shelves(p, C.rect(x + 1.5 * u, y + 2 * u, w - 3 * u, h - 2 * u), { rh: Math.max(4, Math.round(8 * u)), oy: y + 2 * u, books: BOOKS_B, v0: 1.1, z, seed });
    p.fill(C.rect(x - u, y, w + 2 * u, Math.max(1, 1.5 * u)), 'wood', 2.6, z);
  }

  /** An orrery: a brass sun on a stand, rings of orbits, planets on arms. */
  function orrery(p, x, fy, s, z = 4, v = 2) {
    p.fill(C.rect(x - s * 0.06, fy - s * 0.55, s * 0.12, s * 0.55), 'brass', v, z);
    p.fill(C.rect(x - s * 0.28, fy - 1, s * 0.56, 1.5), 'brass', v + 0.5, z);
    const cy = fy - s * 0.72;
    p.each(C.ellipse(x, cy, s * 0.55, s * 0.2), (xx, yy, i) => {
      const d = Math.hypot((xx + 0.5 - x) / (s * 0.55), (yy + 0.5 - cy) / (s * 0.2));
      const d2 = Math.hypot((xx + 0.5 - x) / (s * 0.34), (yy + 0.5 - cy) / (s * 0.12));
      if (d > 0.86 || Math.abs(d2 - 1) < 0.14) { p.r[i] = p.ri('brass'); p.v[i] = v + 1; p.z[i] = z; }
    });
    p.fill(C.circle(x, cy, s * 0.11, 10), 'brass', v + 2.2, z);
    for (const [ax, ay, r] of [[0.55, 0, 0.06], [-0.34, 0.06, 0.05], [0.2, -0.18, 0.045]]) p.fill(C.circle(x + ax * s, cy + ay * s, Math.max(0.8, r * s), 8), 'brass', v + 1.6, z);
  }

  /** A globe on a stand, its meridian ring. */
  function globe(p, x, fy, s, z = 4) {
    p.fill(C.poly([[x - s * 0.22, fy], [x - s * 0.05, fy - s * 0.4], [x + s * 0.05, fy - s * 0.4], [x + s * 0.22, fy]]), 'wood', 1.6, z);
    const cy = fy - s * 0.68;
    p.fill(C.circle(x, cy, s * 0.3, 16), 'paper', (xx, yy) => 2.4 - ((xx - x) / (s * 0.3)) * 0.8 + (hash(xx >> 1, yy >> 1, 9) < 0.35 ? -0.8 : 0), z);
    p.each(C.circle(x, cy, s * 0.38, 18), (xx, yy, i) => {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - cy);
      if (d > s * 0.32) { p.r[i] = p.ri('brass'); p.v[i] = 2.4; p.z[i] = z; }
    });
  }

  /** A desk with books stacked on it, a sheet of star chart, and the room's one candle. */
  function desk(p, x, fy, u, z = 4, flames) {
    const w = 26 * u; const top = fy - 12 * u;
    p.fill(C.rect(x - w / 2, top, w, 2 * u), 'wood', 2.2, z);
    p.fill(C.rect(x - w / 2, top, w, 1), 'wood', 3.2, z);
    for (const lx of [x - w / 2 + u, x + w / 2 - 3 * u]) p.fill(C.rect(lx, top + 2 * u, 2 * u, 10 * u), 'wood', 1.4, z);
    p.fill(C.rect(x - w / 2 + 2 * u, top + 2 * u, w - 4 * u, 3 * u), 'wood', 1.2, z);
    const sb = [[0, 7, 2.6, 'leather'], [1, 6, 2, 'cloth'], [0.5, 6.5, 2.2, 'vellum'], [0, 5, 1.8, 'leather']];
    let by = top;
    for (const [ox, bw, bh, r] of sb) { p.fill(C.rect(x - w / 2 + (2 + ox) * u, by - bh * u, bw * u, bh * u), r, 2.6, z); p.fill(C.rect(x - w / 2 + (2 + ox) * u, by - bh * u, bw * u, 1), r, 3.6, z); by -= bh * u; }
    p.fill(C.poly([[x - 1 * u, top], [x + 9 * u, top], [x + 8 * u, top - 1.2 * u], [x, top - 1.2 * u]]), 'paper', 4.2, z); // an open chart
    flames.push(candle(p, x + 4 * u, top, Math.max(2, Math.round(3 * u)), { z: z + 1, r: 24 * u, s: 6.2, flick: true, zMin: 1 }));
    p.light(x + 4 * u, top - 4 * u, 36 * u, 1.4, null, { zMin: 1 });
    warmPool(p, x + 4 * u, top - 2 * u, 30 * u);
  }

  const B = {
    job: 2, setting: 'tower', key: 'B', id: 'tower-b',
    name: 'Tower', title: 'The observatory',
    pitch: 'The top of the tower. A great round window filled by the moon, a brass telescope pointed at it, books stacked everywhere and one candle left burning on the desk. A cold room with one warm point.',
    notes: [
      ['Light', 'The moon is the light: it fills the great window, rims everything that stands before it and lays pale squares across the floor. One amber candle on the desk is the only warmth.'],
      ['Detail', 'A round window with iron spokes, a brass telescope with its bands and dew cap, an orrery, a globe, stacked books and a star chart; dust drifting in the moonlight.'],
      ['Vista', 'The dome room wide: tall windows round the wall, the telescope at the centre. The card stands on the dais against the moon, a black shape with a pale rim: shutters swing shut for an Obstacle, the window turns gold for a Clear Path.'],
      ['World', 'Checkered tiles under the table, the windows’ light falling across them in pale lancets with the bars’ shadows, dust in it. Black toward the hand.'],
    ],
    palette: ['#06070B', '#181B27', '#2B2E40', '#454A60', '#767D92', '#3F2F1B', '#98743D', '#E3A445', '#E4ECF6'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 134;
      const floor = Math.round(108 * u);
      const ox = W / 2; const oy = 54 * u; const orr = 20 * u;
      p.fill(C.rect(0, 0, W, floor), 'stone', 1.0, 1);
      p.masonry(C.rect(0, 0, W, floor), { bw: 11 * u, bh: 7 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 0.9, chip: 0.04, seed: 21, z: 1 });
      // The dome's ribs, curving in overhead.
      for (const xs of [-50, -20, 20, 50]) p.each(C.rect(0, 0, W, 26 * u), (x, y, i) => {
        const xr = ox + xs * u * ((y + 34 * u) / (60 * u)) ** 0.8;
        const dx = x + 0.5 - xr;
        if (Math.abs(dx) < 1.2) { p.r[i] = p.ri('stone'); p.v[i] = 2.0 + (dx * xs < 0 ? 0.6 : 0); }
        else if (Math.abs(dx - Math.sign(xs) * 1.8) < 0.6) { p.r[i] = p.ri('stone'); p.v[i] = 0.3; }
      });
      p.fill(C.rect(0, 26 * u, W, 2 * u), 'stone', 2.4, 1);
      p.fill(C.rect(0, 28 * u, W, 1), 'stone', 0.4, 1);
      p.fill(C.rect(0, floor, W, H - floor), 'tile', 2.2, 1);
      tiles(p, C.rect(0, floor, W, H - floor), { vx: ox, vy: floor - 26 * u, rows: 3, size: 1, d0: 26 * u, check: 0.6, joint: -1.4, seed: 2, z: 1 });
      // The great window.
      const mx = ox + 5 * u; const my = oy - 5 * u; const mr = 10.5 * u;
      oculus(p, ox, oy, orr, { z: 2, moon: [mx, my, mr], th: 4 * u, skyV: 2.2, stars: 16 });
      // Its light: a pale round patch on the floor, the spokes' shadows across it, and a shaft down to it.
      const px0 = ox - 8 * u; const py0 = 121 * u;
      p.each(C.ellipse(px0, py0, 19 * u, 6.5 * u), (x, y, i) => {
        if (p.z[i] !== 1) return;
        const dx = (x + 0.5 - px0) / (19 * u); const dy = (y + 0.5 - py0) / (6.5 * u); const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy * 3, dx); const spoke = d > 0.2 && Math.abs(Math.sin((a - Math.PI / 2) * 4)) * d < 0.05;
        p.r[i] = p.ri('cold'); p.v[i] += (spoke ? 0.8 : 3.0) * (1 - d * d * 0.6);
      });
      moonbeam(p, ox - 12 * u, ox + 12 * u, oy + 6 * u, 60 * u, -10 * u, 0.9, { zMax: 1, spread: 0.3, fade: 0.2 });
      // The telescope, black against the moon.
      telescope(p, { x0: ox - 22 * u, y0: 84 * u, x1: ox + 4 * u, y1: 56 * u, r0: 1.6 * u, r1: 2.7 * u, z: 6, v: 0.5, pivot: [ox - 13 * u, 76 * u], feet: [[ox - 24 * u, floor], [ox - 13 * u, floor + 1], [ox - 3 * u, floor]], leg: 0.6 * u });
      p.backlit(6, 'moon', 0, 'cold', 7.2);
      p.backlit(6, 'sky', 3.4, 'cold', 6);
      // The desk at the right with its candle; books stacked on the floor at the left.
      const flames = [];
      desk(p, ox + 22 * u, floor, u * 0.9, 4, flames);
      let sy = floor;
      for (const [bx, bw, bh, r] of [[10, 9, 2.4, 'leather'], [11, 8, 2, 'vellum'], [10.5, 9, 2.6, 'cloth'], [11.5, 7, 2, 'leather'], [11, 8, 2.2, 'vellum']]) {
        p.fill(C.rect(bx * u, sy - bh * u, bw * u, bh * u), r, 1.6, 4); p.fill(C.rect(bx * u, sy - bh * u, bw * u, 1), r, 2.4, 4); sy -= bh * u;
      }
      vignette(p, W, H, 2.4, 0.42);
      p.rim(0, -1, 0.5, 4);
      return {
        p,
        over(img) {
          for (const f of flames) flame(img, f, 0);
          for (const [x, y] of [[0.36, 88], [0.42, 96], [0.47, 84], [0.31, 100], [0.4, 106]]) put(img, W * x, y * u, '#8C95A6', 0.8);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 100; const gx = W / 2;
      const F = Math.round(86 * u); const D = Math.round(73 * u);
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      // The curved wall: big blocks, a cornice where the dome begins.
      p.fill(C.rect(0, 0, W, F), 'stone', 0.75, 1);
      p.masonry(C.rect(0, 0, W, F), { bw: 12 * u, bh: 8 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 0.9, chip: 0.04, seed: 23, z: 1 });
      p.fill(C.rect(0, 0, W, 6 * u), 'stone', 0.5, 1);
      p.fill(C.rect(0, 6 * u, W, 2 * u), 'stone', 2.2, 1);
      // Tall windows round the wall, each with its stars and a pale lancet of light on the floor.
      const wins = [];
      for (let d = 56 * u; gx + d < W + 10 * u; d += 44 * u) wins.push(gx + d, gx - d);
      const flames = [];
      for (const x of wins) {
        lancetWindow(p, Math.round(x), 14 * u, 6 * u, 62 * u, { z: 2, th: Math.max(1.5, 2 * u), lead: false, transoms: Math.round(12 * u), gv: 2.8 });
        const rs = rng(Math.round(x));
        for (let k = 0; k < 3; k += 1) p.fill(C.rect(Math.round(x - 4 * u + rs() * 8 * u), Math.round(20 * u + rs() * 34 * u), 1, 1), 'sky', 9, 2);
      }
      // The floor: checkered tiles.
      p.fill(C.rect(0, F, W, H - F), 'tile', 1.8, 1);
      tiles(p, C.rect(0, F, W, H - F), { vx: gx, vy: F - 22 * u, rows: 3, size: 1, d0: 22 * u, check: 0.55, joint: -1.3, seed: 5, z: 1 });
      for (const x of wins) moonbeam(p, x - 5 * u, x + 5 * u, 63 * u, H - 63 * u + 2 * u, (x - gx) * 0.12, 0.6, { zMax: 2, spread: 0.6, fade: 0, floorY: F, floorK: 4.4 });
      // Between the windows: bookcases, an orrery, a globe; the desk and its candle on one side.
      const spots = [];
      for (let d = 78 * u; gx + d < W + 10 * u; d += 44 * u) spots.push(gx + d, gx - d);
      spots.forEach((x, k) => {
        const kind = k === 0 ? 'desk' : ['case', 'orrery', 'case', 'globe', 'case', 'case'][k % 6];
        if (kind === 'desk') desk(p, x, F, u, 4, flames);
        else if (kind === 'case') { bookcase(p, x - 13 * u, F - 26 * u, 26 * u, 26 * u, u, k + 3, 3); if (k % 2) starChart(p, x - 7 * u, 30 * u, 14 * u, 18 * u, k * 7 + 1, 3); }
        else if (kind === 'orrery') { bookcase(p, x - 11 * u, F - 14 * u, 22 * u, 14 * u, u, k + 3, 3); orrery(p, x, F - 14 * u, 20 * u, 4, 1.4); }
        else globe(p, x, F, 22 * u, 4);
      });
      // The great window and the moon in it.
      const oy = 40 * u; const orr = 28 * u;
      const shut = cat === 'obstacle'; const gold = cat === 'clear-path';
      const mx = gx + 3 * u; const my = oy - 1 * u; const mr = 19 * u;
      if (gold) {
        oculus(p, gx, oy, orr, { z: 2, th: 4 * u, skyV: 2, stars: 0, tracery: false });
        p.glow(C.circle(gx, oy, orr, 48), 'glow', gx, oy + 6 * u, orr * 1.2, 9.4, 5.4, 2);
        p.each(C.circle(gx, oy, orr, 48), (x, y, i) => {
          const dx = x + 0.5 - gx; const dy = y + 0.5 - oy; const d = Math.hypot(dx, dy); const a = Math.atan2(dy, dx);
          if (d > orr * 0.24 && Math.abs(Math.sin((a - Math.PI / 2) * 4)) * d < 0.6) p.v[i] -= 2.2;
        });
      } else {
        oculus(p, gx, oy, orr, { z: 2, moon: [mx, my, mr], th: 4 * u, skyV: 2.2, stars: 22, trV: 1.2 });
      }
      // The window's light on the wall round it and on the floor before the dais.
      if (!shut) {
        p.light(gx, oy, 70 * u, gold ? 1.6 : 2.4, null, { zMin: 1, zMax: 1 });
        p.light(gx, F + 6 * u, 46 * u, gold ? 2.6 : 2.2, null, { zMin: 1, zMax: 1, sy: 0.35 });
      }
      // The dais: three steps up to the window, their edges catching the moon.
      for (let k = 0; k < 3; k += 1) {
        const hw = (38 - k * 6) * u;
        const top = F - (k + 1) * ((F - D) / 3);
        p.fill(C.rect(gx - hw, top, hw * 2, F - top), gold ? 'glow' : 'stone', gold ? 2.6 + k * 0.5 : 1.4 + k * 0.1, 4);
        p.fill(C.rect(gx - hw, top, hw * 2, 1), gold ? 'glow' : 'cold', gold ? 5.6 : 4.6, 4);
      }
      // The telescope on its tripod on the dais, pointed up through the window.
      telescope(p, { x0: gx - 38 * u, y0: 66 * u, x1: gx + 4 * u, y1: 16 * u, r0: 2 * u, r1: 3.6 * u, z: 6, v: 0.6, pivot: [gx - 25 * u, 56 * u], feet: [[gx - 34 * u, D], [gx - 25 * u, D + 1], [gx - 15 * u, D]], leg: 0.8 * u });
      const rimBright = gold ? 'glow' : 'moon';
      // The card, on the dais, against the moon.
      const s = (cat === 'monster' ? 34 : 30) * u;
      if (cat === 'monster') {
        SUBJECT.monster(p, gx + 4 * u, D, s, ramp, 7);
        p.tint(gx + 4 * u, D - s * 0.9, 4 * u, hex, 0.45, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        SUBJECT.wanderer(p, gx + 3 * u, D, s + 2 * u, 'shadow', 7, false);
        const lx = gx + 3 * u + (s + 2 * u) * 0.3; const ly = D - (s + 2 * u) * 0.62;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 8);
        p.tint(lx, ly, 16 * u, hex, 0.5, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        // A scrying orb on a tall stand, lit from within.
        p.fill(C.poly([[gx - 5 * u, D], [gx - 1.4 * u, D - 18 * u], [gx + 1.4 * u, D - 18 * u], [gx + 5 * u, D]]), 'shadow', 0.6, 7);
        p.fill(C.poly([[gx - 5 * u, D - 18 * u], [gx + 5 * u, D - 18 * u], [gx + 3 * u, D - 21 * u], [gx - 3 * u, D - 21 * u]]), 'shadow', 0.8, 7);
        const oyy = D - 27 * u; const orb = 6.5 * u;
        p.fill(C.circle(gx, oyy, orb + 1, 20), 'shadow', 0.4, 7);
        p.fill(C.circle(gx, oyy, orb, 20), ramp, (x, y) => {
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - oyy) / orb;
          return 1.4 + 2.6 * Math.max(0, 1 - d * 1.15) + (d > 0.8 ? 0.6 : 0);
        }, 8);
        p.fill(C.rect(gx - orb * 0.5, oyy - orb * 0.55, Math.max(1, 1.2 * u), Math.max(1, 1.2 * u)), ramp, 4.6, 8);
        p.tint(gx, oyy, 18 * u, hex, 0.45, flicker(2, 0.18, 0.7));
      } else if (shut) {
        // Iron shutters swung across the window, a slit of moon between them: planks, two straps, studs.
        const gap = 2 * u;
        p.each(C.circle(gx, oy, orr + 0.5, 48), (x, y, i) => {
          if (p.z[i] > 4) return;
          const dx = x + 0.5 - gx; const ady = Math.abs(y + 0.5 - oy);
          if (Math.abs(dx) < gap) return;
          const strap = Math.abs(ady - orr * 0.45) < 1.3 * u;
          const edge = Math.abs(dx) < gap + 1;
          const plank = (Math.abs(dx) % (4 * u)) < 1;
          const stud = strap && (Math.abs(dx) % (6 * u)) < 1.2;
          p.r[i] = p.ri(ramp); p.z[i] = 5;
          p.v[i] = stud ? 3.6 : edge ? 3.4 : strap ? 2.3 : plank ? 0.6 : 1.2 - Math.abs(dx) / orr * 0.6;
        });
        p.fill(C.rect(gx - 4 * u, oy - 2 * u, 8 * u, 6 * u), ramp, 2.8, 6); // the bar and lock across the slit
        p.fill(C.rect(gx - 1, oy, 2, 2), 'shadow', 0, 6);
        p.tint(gx, oy, 34 * u, hex, 0.35, flicker(0.5, 0.12, 0.6));
      } else if (gold) {
        p.light(gx, D, 70 * u, 3.4, flicker(0.2, 0.06, 0.4), { zMin: 3, sy: 0.7 });
        // A path of gold laid across the tiles, from the dais to you.
        const gi = p.ri('glow');
        p.each(C.poly([[gx - 20 * u, F], [gx + 20 * u, F], [gx + 40 * u, H], [gx - 40 * u, H]]), (x, y, i) => {
          if (p.z[i] !== 1) return;
          const t = (y - F) / (H - F); const e = Math.abs(x + 0.5 - gx) / (20 * u + 20 * u * t);
          p.r[i] = gi; p.v[i] = p.v[i] + 2.6 - t * 1.2 - e * e * 1.6;
        });
        p.tint(gx, oy + 6 * u, 32 * u, CARD.path[3], 0.28, flicker(0.4, 0.08, 0.5));
      }
      p.backlit(6, rimBright, 0, gold ? 'glow' : 'cold', gold ? 7.4 : 6.8);
      p.backlit(7, rimBright, 0, gold ? 'glow' : 'cold', gold ? 7.4 : 6.8);
      p.backlit(6, 'sky', 3.6, 'cold', 6.2);
      p.backlit(7, 'sky', 3.6, 'cold', 6.2);
      // Moonlight from the great window over the dais and the floor in front.
      if (!shut) p.light(gx, oy + 20 * u, 60 * u, gold ? 0 : 1.6, null, { zMin: 4, zMax: 4, sy: 0.8 });
      vignette(p, W, H, 1.8, 0.4);
      p.rim(0, -1, 0.5, 4);
      const beams = wins.map((x) => [x, (x - gx) * 0.12]);
      return {
        p,
        over(img, t) {
          for (const f of flames) flame(img, f, t);
          // Dust adrift in the moonlight: only where a window's light falls.
          for (const [x, dx] of beams) {
            for (const q of particles('dust', 2, [x - 6 * u, 64 * u, 12 * u, H - 64 * u], t, Math.round(x))) put(img, q.x + dx * ((q.y - 63 * u) / (H - 63 * u)), q.y, '#6A7283', q.a * 0.45);
          }
          for (const q of particles('dust', 7, [gx - orr * 0.8, oy + orr * 0.2, orr * 1.6, F - oy - orr * 0.2], t, 77)) put(img, q.x, q.y, gold ? '#F2CB8A' : '#8C95A6', q.a * 0.45);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 250;
      p.fill(C.rect(0, 0, W, H), 'tile', 1.4, 1);
      tiles(p, C.rect(0, 0, W, H), { vx: W / 2, vy: -100 * u, rows: 7, size: 1, d0: 50 * u, check: 0.14, joint: -0.8, top: 0.15, seed: 13, z: 1 });
      // The windows' light, laid across the floor in pale lancets, the bars' shadows in them.
      const ci = p.ri('cold');
      const lances = [[-0.36, 1.1], [-0.12, 1.25], [0.12, 1.25], [0.36, 1.1]];
      for (const [k, s] of lances) {
        const x0 = W / 2 + k * W * 0.9; const sk = k * 1.3; const w = 15 * u; const len = 120 * u;
        p.each(C.rect(0, 0, W, len + 4 * u), (x, y, i) => {
          const t = y / len; if (t > 1) return;
          const xc = x0 + sk * y; const hw = w * (1 - Math.max(0, t - 0.78) / 0.22 * 0.9);
          const dx = Math.abs(x + 0.5 - xc);
          if (dx > hw) return;
          const bar = Math.abs(x + 0.5 - xc) < 0.8 || ((y % Math.round(26 * u)) < 1.5);
          p.r[i] = ci;
          p.v[i] += (bar ? 0.4 : s * 2.4) * (1 - t) ** 1.3;
        });
      }
      // The one candle, on a stack of books at the left.
      const flames = [];
      let sy = 150 * u;
      for (const [bx, bw, bh, r] of [[8, 16, 4, 'leather'], [9, 14, 3, 'vellum'], [8.5, 15, 4, 'cloth']]) { p.fill(C.rect(bx * u, sy - bh * u, bw * u, bh * u), r, 1.8, 3); p.fill(C.rect(bx * u, sy - bh * u, bw * u, 1), r, 2.8, 3); sy -= bh * u; }
      flames.push(candle(p, 16 * u, sy, 4, { z: 4, r: 28 * u, s: 6.4, flick: true, zMin: 1, big: true, depth: 0.15 }));
      warmPool(p, 16 * u, sy - 6 * u, 34 * u);
      p.shade(null, (x, y) => -2.4 * Math.max(0, y / H - 0.34) - 1.2 * (Math.abs(x - W / 2) / (W / 2)) ** 3);
      return {
        p,
        over(img, t) {
          for (const f of flames) flame(img, f, t);
          for (const [k] of lances) {
            const x0 = W / 2 + k * W * 0.9; const sk = k * 1.3;
            for (const q of particles('dust', 7, [x0 - 14 * u, 0, 28 * u, 110 * u], t, Math.round(x0 * 7))) put(img, q.x + sk * q.y, q.y, '#6A7283', q.a * 0.7 * (1 - q.y / (130 * u)));
          }
        },
      };
    },
  };

  /* ================= C: the tower, outside ================= */

  const RAMPS_C = {
    ...RAMPS_A,
    rock: ['#050609', '#0A0B11', '#101219', '#171923', '#20212E', '#2A2A3A', '#363548', '#46435A', '#5A566C', '#736D82'],
    far: ['#0A0C14', '#10131D', '#171B28', '#1F2433', '#282E40', '#333A4F', '#424A60', '#565E74'],
    mist: ['#050609', '#0A0B11', '#11131A', '#1A1D25', '#252932', '#323741', '#444952', '#5B6068', '#7A7F86', '#A3A8AF'],
    warm: ['#07080C', '#0D0F16', '#131620', '#1F1A1E', '#30241F', '#463222', '#604526', '#7E5C2D', '#A57A36', '#C99A45', '#E3A445', '#F2CB8A'],
  };
  const RAVEN = { a: '#08080B', b: '#34343E' };
  const RAVEN_FLY = [
    ['a.....a', '.a...a.', '..aaa..', '...a...'],
    ['.......', '.aaaaa.', 'a..a..a', '...a...'],
  ];
  const RAVEN_SIT = [
    ['...aa.', '..aaab', 'aaaaa.', '.aaa..', '..a.a.'],
    ['......', '...aab', 'aaaaa.', '.aaa..', '..a.a.'],
  ];

  /** Where a candle's light falls outside, stone and rock turn to the warm ramp (the same darks), so it climbs to amber. */
  function warmAt(p, x, y, r, from, sy = 1) {
    const ids = from.map((n) => p.ri(n)); const wi = p.ri('warm');
    p.each(C.ellipse(x, y, r, r * sy), (xx, yy, i) => { if (ids.includes(p.r[i])) p.r[i] = wi; });
  }

  /**
   * A band of mist: inside its wavy edges everything turns to the mist ramp
   * and is drawn toward a pale value, most in the band's middle.
   */
  function mistBand(p, y0, y1, o) {
    const mi = p.ri('mist');
    p.each(C.rect(0, y0 - o.amp * 2, p.w, y1 - y0 + o.amp * 4), (x, y, i) => {
      if (p.emit[p.r[i]] || p.z[i] > (o.zMax ?? 9)) return;
      const top = y0 + Math.sin(x / o.wl + o.ph) * o.amp + Math.sin(x / (o.wl * 0.37) + 1.3) * o.amp * 0.5;
      const bot = y1 + Math.sin(x / (o.wl * 0.8) + 2 + o.ph) * o.amp * 0.6;
      if (y < top || y > bot) return;
      const t = (y + 0.5 - top) / Math.max(1, bot - top);
      const a = Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 1.6) * (o.a ?? 0.7);
      if (a < 0.08) return;
      p.r[i] = mi; p.v[i] = lerp(p.v[i], o.v ?? 4, a);
    });
  }

  /** Rock: natural slabs, lit toward the moon (up and right). */
  function rock(p, shape, z, o = {}) {
    p.fill(shape, 'rock', o.v ?? 1.2, z);
    p.cells(shape, { size: o.size ?? 6, joint: 0.8, jointV: -1.0, vary: 0.8, bevel: 0.7, lit: [0.6, -0.8], seed: o.seed || 9, z });
  }

  /** A path of trodden stones, its runs given as [x, y, half-thickness]; pale where the moon finds it. */
  function trail(p, pts, z, v) {
    for (let k = 0; k + 1 < pts.length; k += 1) {
      const [x0, y0, w0] = pts[k]; const [x1, y1, w1] = pts[k + 1];
      p.fill(C.poly([[x0, y0 - w0], [x1, y1 - w1], [x1, y1 + w1], [x0, y0 + w0]]), 'rock', (x, y) => v + (hash(x >> 1, y, 3) < 0.22 ? -0.8 : 0) + (hash(x, y, 4) < 0.08 ? 0.6 : 0), z);
      p.fill(C.circle(x1, y1, w1, 10), 'rock', v, z);
    }
  }

  /**
   * The tower seen from outside: a round body of laid stone, dark against
   * the moon with a pale rim on the moon's side, a slate cone for a roof,
   * and lancet windows climbing it in a spiral, each lit amber by the
   * candles on the stair inside, each throwing a little warmth on the stone.
   */
  function towerOut(p, o) {
    const { cx, R, top, base, u, z } = o;
    const bat = o.batter ?? 6 * u;
    const body = C.poly([[cx - R, top], [cx + R, top], [cx + R, base - bat], [cx + R + 2 * u, base], [cx - R - 2 * u, base], [cx - R, base - bat]]);
    p.fill(body, 'stone', (x) => {
      const s = clamp((x + 0.5 - cx) / R, -1, 1);
      return o.v + (o.lit ?? 1.5) * Math.max(0, s) ** (o.litK ?? 3) - 0.6 * (1 - Math.sqrt(1 - s * s));
    }, z);
    p.masonry(body, { bw: o.bw, bh: o.bh, joint: -0.9, top: 0.35, vary: 0.6, chip: 0.03, seed: o.seed || 41, z });
    // The moon's side: a pale edge.
    const ci = p.ri('cold');
    p.each(body, (x, y, i) => {
      const edge = (y > base - bat ? cx + R + 2 * u * (y - base + bat) / bat : cx + R) - (x + 0.5);
      if (edge >= 0 && edge < 1.8 * u) { p.r[i] = ci; p.v[i] = edge < 0.9 * u ? o.rimV : o.rimV - 1.4; }
    });
    if (o.roof) {
      const ov = 3 * u; const eh = Math.max(2, 2.5 * u);
      const cone = C.poly([[cx - R - ov, top], [cx + R + ov, top], [cx + 0.5, top - o.roof]]);
      p.fill(cone, 'rock', (x, y) => 1.5 + ((Math.floor((top - y) / Math.max(2, 2.4 * u)) % 2) ? -0.35 : 0.15) + (x > cx ? 0.5 : -0.2) - ((top - y) < 1 ? 0.6 : 0), z);
      p.fill(C.rect(Math.round(cx), Math.round(top - o.roof - 4 * u), 1, Math.round(4 * u)), 'iron', 3.4, z); // the finial
      p.fill(C.rect(cx - R - 1.5 * u, top, 2 * R + 3 * u, eh), 'stone', 2.0, z);                            // the eaves
      for (let x = cx - R; x < cx + R - u; x += 3.2 * u) p.fill(C.rect(Math.round(x), Math.round(top + eh), Math.max(1, Math.round(1.5 * u)), Math.max(1, Math.round(1.4 * u))), 'stone', 1.4, z);
    }
    const wins = [];
    for (const w of o.windows) {
      const s = Math.sin(w.th); const c = Math.cos(w.th);
      if (c < 0.14) continue;
      const x = cx + R * s; const ww = Math.max(1, Math.round(w.w * c)); const wh = Math.round(w.h);
      const x0 = Math.round(x - ww / 2); const y0 = Math.round(w.y - wh);
      warmAt(p, x, w.y - wh / 2, w.r * 0.95, ['stone'], 1.15);
      const shape = ww >= 3 ? C.arch(x0 + ww / 2, y0, ww / 2, y0 + wh, 1) : C.rect(x0, y0 + 1, ww, wh - 1);
      p.fill(shape, 'glow', (xx, yy) => w.v - ((yy - y0) / wh) * 1.0, z + 1);
      if (ww >= 2) p.fill(C.rect(s > 0 ? x0 + ww - 1 : x0, y0 + 2, 1, wh - 2), 'glow', w.v - 2.4, z + 1); // the reveal's far side
      p.fill(C.rect(x0 - (ww > 2 ? 1 : 0), y0 + wh, ww + (ww > 2 ? 2 : 0), 1), 'warm', 5.2, z);           // the sill, in the light
      p.light(x + 0.5, w.y - wh / 2, w.r, w.s, o.flick ? flicker(w.th * 3.1, 0.14, 0.9) : null, { zMin: z, zMax: z, hard: true });
      wins.push({ x0, y0, ww, wh, ph: w.th * 3.1 });
    }
    return wins;
  }

  /** Windows climbing a spiral: every `dth` round and `dy` up from (th0, y0), smaller as they climb. */
  function spiral(th0, dth, y0, dy, n, size, u) {
    return Array.from({ length: n }, (_, k) => {
      const f = 1 - k * 0.04;
      return { th: th0 + k * dth, y: y0 - k * dy, w: size[0] * f * u, h: size[1] * f * u, v: 6.6, r: size[2] * u, s: 2.6 };
    });
  }

  /** Each window's candles breathing: a faint warm wash over it, frame by frame. */
  function windowFlicker(img, wins, t) {
    for (const w of wins) {
      const a = 0.18 * (0.5 + 0.5 * Math.sin(t * 5.3 + w.ph) * Math.sin(t * 2.1 + w.ph * 1.7));
      for (let y = w.y0 + 1; y < w.y0 + w.wh; y += 1) for (let x = w.x0; x < w.x0 + w.ww; x += 1) put(img, x, y, '#FFE3A8', a);
    }
  }

  /** A dead tree on the crag: a leaning trunk and a few bare branches. */
  function deadTree(p, x, fy, s, z, seed) {
    const r = rng(seed);
    const lean = (r() - 0.5) * 0.4;
    const tx = x + lean * s;
    p.fill(C.poly([[x - 1.2, fy], [x + 1.2, fy], [tx + 0.6, fy - s], [tx - 0.4, fy - s]]), 'shadow', 1.2, z);
    const branch = (bx, by, a, len, depth) => {
      const ex = bx + Math.cos(a) * len; const ey = by - Math.sin(a) * len; const n = Math.ceil(len);
      for (let k = 0; k <= n; k += 1) p.fill(C.rect(Math.round(lerp(bx, ex, k / n)), Math.round(lerp(by, ey, k / n)), 1, 1), 'shadow', 1.2, z);
      if (depth > 0) { branch(ex, ey, a + 0.5 + r() * 0.3, len * 0.6, depth - 1); branch(ex, ey, a - 0.5 - r() * 0.3, len * 0.55, depth - 1); }
    };
    branch(tx, fy - s, 1.35 + lean, s * 0.35, 2);
    branch(lerp(x, tx, 0.6), fy - s * 0.6, 0.5, s * 0.4, 1);
    branch(lerp(x, tx, 0.5), fy - s * 0.5, 2.5, s * 0.32, 1);
    return [lerp(x, tx, 0.6) + Math.cos(0.5) * s * 0.32, fy - s * 0.6 - Math.sin(0.5) * s * 0.32]; // a perch on the first branch
  }

  const C3 = {
    job: 2, setting: 'tower', key: 'C', id: 'tower-c', side: 'outside',
    // Set aside 2026-10-11: the author keeps this setting inside only.
    dropped: true,
    name: 'Tower', title: 'The tower on the crag',
    pitch: 'The same tower from outside: on a crag under the moon, its windows climbing in a spiral, each lit amber by the candles on the stair inside, one bright window at the top where someone is still reading. A path winds up to the door.',
    notes: [
      ['Light', 'The moon behind the tower makes it a dark shape with a pale edge; the candles inside show only as amber windows climbing it, and as the open door at its foot.'],
      ['Detail', 'Laid stone round a round tower, a slate cone and finial, lancet windows with lit sills, a winding path, a dead tree with a raven in it, mist in the valleys.'],
      ['Vista', 'The foot of the tower on its crag, the windows climbing out of sight, ridges and mist behind. The card meets you at the door on the path: a shape in the lit doorway, the same ward on a shut door, the door flung open and gold down the path.'],
      ['World', 'The courtyard’s worn flagstones under the table, the tower’s long shadow down the middle, warm squares from its windows far off at the top, parapets at the sides, a raven on the wall.'],
    ],
    palette: ['#05060A', '#171B28', '#363E55', '#3A394E', '#605660', '#20212E', '#E3A445', '#F2CB8A', '#C9D6EA'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 134;
      const cx = W / 2 - 3 * u; const mx = W / 2 + 9 * u; const my = 41 * u; const mr = 10.5 * u;
      // The sky: lighter toward the hills, a halo round the moon, stars.
      p.fill(C.rect(0, 0, W, H), 'sky', (x, y) => 1.0 + (y / H) * 3.6 + 4.4 * Math.max(0, 1 - Math.hypot(x - mx, y - my) / (46 * u)) ** 2, 1);
      const rs = rng('tower-c-stars');
      for (let k = 0; k < 26; k += 1) { const sx = rs() * W; const sy = rs() * 80 * u; if (Math.hypot(sx - mx, sy - my) > mr * 2.2) p.fill(C.rect(Math.floor(sx), Math.floor(sy), 1, 1), 'sky', 7 + rs() * 3, 1); }
      moonDisc(p, mx, my, mr, 1);
      // Far ridges, mist between them and the crag.
      p.fill(C.poly([[0, H], [0, 86 * u], [10 * u, 82 * u], [20 * u, 88 * u], [30 * u, 92 * u], [62 * u, 94 * u], [74 * u, 86 * u], [84 * u, 80 * u], [96 * u, 84 * u], [W, H]]), 'far', (x, y) => 2.6 - (y - 80 * u) / (30 * u), 2);
      mistBand(p, 90 * u, 104 * u, { wl: 9 * u, amp: 1.5 * u, ph: 0.4, v: 4.6, a: 0.85, zMax: 2 });
      // The crag the tower stands on, and the path up it.
      const crag = C.poly([[0, H], [0, 116 * u], [12 * u, 110 * u], [24 * u, 104 * u], [32 * u, 98 * u], [cx - 12 * u, 96 * u], [cx + 13 * u, 96 * u], [64 * u, 100 * u], [74 * u, 106 * u], [86 * u, 112 * u], [W, 114 * u], [W, H]]);
      rock(p, crag, 4, { size: 5 * u, seed: 12 });
      trail(p, [[66 * u, H + 2, 2.6 * u], [72 * u, 124 * u, 2.2 * u], [36 * u, 116 * u, 1.8 * u], [58 * u, 106 * u, 1.5 * u], [cx + 2 * u, 98 * u, 1.2 * u]], 4, 4.8);
      // The tower.
      towerOut(p, {
        cx, R: 11 * u, top: 44 * u, base: 97 * u, u, z: 5, v: 0.8, rimV: 6.4, bw: 5 * u, bh: 3 * u, roof: 21 * u, batter: 6 * u,
        windows: [...spiral(-1.3, 1.0, 88 * u, 3.6 * u, 9, [3, 4.6, 6], u).filter((w) => w.y > 57.5 * u), { th: 0.1, y: 54 * u, w: 4.2 * u, h: 7 * u, v: 8.6, r: 11 * u, s: 3.2 }],
      });
      // The door at its foot, open, and its light on the path.
      const door = C.arch(cx, 88 * u, 3 * u, 97 * u, 1);
      warmAt(p, cx, 97 * u, 12 * u, ['rock', 'stone', 'cold'], 0.6);
      p.fill(door, 'glow', (x, y) => 7.4 - (97 * u - y) / (9 * u) * 1.2, 6);
      p.light(cx, 97 * u, 12 * u, 3.4, null, { zMin: 4, zMax: 5, sy: 0.6, hard: true });
      // The roof and the tower's edge against the moon and its halo.
      p.backlit(5, 'moon', 0, 'cold', 7.2);
      p.backlit(5, 'sky', 5.4, 'cold', 5.4);
      // Mist low over the crag, the path going into it.
      mistBand(p, 110 * u, 128 * u, { wl: 11 * u, amp: 2 * u, ph: 1.7, v: 4.4, a: 0.75, zMax: 4 });
      vignette(p, W, H, 2.2, 0.42);
      p.rim(0, -1, 0.6, 4);
      return {
        p,
        over(img) {
          for (const [x, y, f] of [[24, 30, 0], [31, 26, 1], [74, 58, 0]]) sprite(img, Math.round(x * u), Math.round(y * u), RAVEN_FLY[f], RAVEN);
          sprite(img, Math.round(cx + 1), Math.round(19 * u), RAVEN_SIT[0], RAVEN); // on the finial
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 100; const gx = W / 2;
      const F = Math.round(80 * u);
      const ramp = catRamp(cat); const hex = CARD[ramp][3];
      const mx = gx + 64 * u; const my = 20 * u; const mr = 8 * u;
      // The sky and the moon, off to the right of the tower.
      p.fill(C.rect(0, 0, W, H), 'sky', (x, y) => 1.0 + (y / (60 * u)) * 3.4 + 4.2 * Math.max(0, 1 - Math.hypot(x - mx, y - my) / (40 * u)) ** 2, 1);
      const rs = rng('tower-c-vista');
      for (let k = 0; k < W / (7 * u); k += 1) { const sx = rs() * W; const sy = rs() * 50 * u; if (Math.hypot(sx - mx, sy - my) > mr * 2.4) p.fill(C.rect(Math.floor(sx), Math.floor(sy), 1, 1), 'sky', 7 + rs() * 3, 1); }
      moonDisc(p, mx, my, mr, 1);
      // Far ridges, mist in the valleys, a nearer ridge, more mist.
      const rx = (x) => (x - gx) / u;
      p.each(C.rect(0, 40 * u, W, 60 * u), (x, y, i) => {
        const X = rx(x);
        const r1 = 54 * u + (5 * Math.sin(X / 19) + 3 * Math.sin(X / 7 + 1) - 4 * Math.abs(Math.sin(X / 41))) * u;
        const r2 = 66 * u + (4 * Math.sin(X / 13 + 2) + 2 * Math.sin(X / 5) - 3 * Math.abs(Math.sin(X / 29 + 0.5))) * u;
        if (y >= r2) { p.r[i] = p.ri('rock'); p.v[i] = 1.4 + (y - r2 < 1 ? 1.6 : 0); p.z[i] = 3; }
        else if (y >= r1) { p.r[i] = p.ri('far'); p.v[i] = 2.7 + (y - r1 < 1 ? 1.5 : 0) - (y - r1) / (12 * u) * 0.8; p.z[i] = 2; }
      });
      mistBand(p, 60 * u, 70 * u, { wl: 12 * u, amp: 2 * u, ph: 0.3, v: 4.6, a: 0.85, zMax: 2 });
      mistBand(p, 71 * u, 82 * u, { wl: 15 * u, amp: 2 * u, ph: 2.1, v: 4.2, a: 0.75, zMax: 3 });
      // The crag in front, rising to the tower's foot, the path climbing it to the door.
      const crag = [];
      for (let x = -4; x <= W + 4; x += 4) { const X = rx(x); crag.push([x, F + Math.min(16, (X / 64) ** 2 * 9) * u + Math.sin(X / 6) * 0.8 * u]); }
      const cragShape = C.poly([[-4, H + 1], ...crag, [W + 4, H + 1]]);
      rock(p, cragShape, 4, { size: 6 * u, seed: 14, v: 1.5 });
      trail(p, [[gx - 150 * u, 99 * u, 2.4 * u], [gx - 96 * u, 95 * u, 2.2 * u], [gx - 58 * u, 90 * u, 2 * u], [gx - 26 * u, 86 * u, 1.8 * u], [gx - 10 * u, F + 5 * u, 1.6 * u]], 4, 5.4);
      // A dead tree on the crag, and another far along.
      const perch = deadTree(p, gx - 62 * u, F + 5 * u, 24 * u, 4, 7);
      deadTree(p, gx + 124 * u, F + 10 * u, 18 * u, 4, 11);
      // The tower: its foot here, its windows climbing out of sight.
      const wins = towerOut(p, {
        cx: gx, R: 25 * u, top: -20 * u, base: F, u, z: 5, v: 0.8, rimV: 5.2, lit: 2.2, litK: 2.2, bw: 8 * u, bh: 5 * u, batter: 9 * u, flick: true,
        windows: spiral(-1.3, 0.62, 46 * u, 6.4 * u, 9, [5, 8, 11], u),
      });
      // The door, a candle in a niche either side of it, steps down to the path.
      const dhw = 11 * u; const dtop = 40 * u;
      const door = C.arch(gx, dtop, dhw, F, 1);
      const th = Math.max(2, Math.round(3 * u));
      const ring = C.join(C.arch(gx, dtop - th, dhw + th, F, 1), door);
      p.fill(ring, 'stone', 2.2, 6);
      p.shade(ring, (x, y) => (((Math.atan2(F - y, x - gx) / Math.PI) * 13) % 1 < 0.16 ? -1.1 : 0.2), 6);
      const shut = cat === 'obstacle'; const open = cat === 'clear-path';
      const bright = open ? 1.3 : 1;
      if (shut) {
        // The door is shut: planks and iron straps, the ward on it.
        p.fill(door, 'wood', (x, y) => 1.6 + ((Math.abs(x + 0.5 - gx) % (3 * u)) < 1 ? -0.8 : 0) + (Math.abs(y - (F - 10 * u)) < 1.2 * u || Math.abs(y - (dtop + 14 * u)) < 1.2 * u ? 0.6 : 0), 6);
        p.each(door, (x, y, i) => { if (Math.abs(y - (F - 10 * u)) < 1.1 * u || Math.abs(y - (dtop + 14 * u)) < 1.1 * u) { p.r[i] = p.ri('iron'); p.v[i] = 2.4; } });
      } else {
        p.glow(door, 'glow', gx, F - 6 * u, 26 * u, 8.9 * Math.min(1.12, bright), 3.4 * bright, 6, { sy: 1.4 });
        if (open) {
          const n = 7; const s0 = F - 2 * u;
          p.each(door, (x, y, i) => {
            const k = Math.floor((s0 - y) / (4 * u));
            if (k < 0 || k >= n) return;
            const ly = (s0 - y) - k * 4 * u; const w = dhw * (1 - k * 0.11);
            if (Math.abs(x + 0.5 - gx) > w) return;
            p.v[i] = 5.4 + k * 0.55 + (ly > 4 * u - 1 ? 1.2 : 0) - (ly < 1 ? 1.4 : 0);
          });
        }
      }
      const flames = [];
      for (const sx of [gx - 19 * u, gx + 19 * u]) {
        p.fill(C.arch(sx, 46 * u, 3 * u, 58 * u, 1), 'shadow', 0.4, 6);
        warmAt(p, sx, 52 * u, 9 * u, ['stone', 'cold'], 1.2);
        flames.push(candle(p, sx, 58 * u, Math.max(2, Math.round(3 * u)), { z: 6, dish: false, r: 12 * u, s: 3.6, flick: true, zMin: 5, zMax: 6 }));
      }
      warmAt(p, gx, F + 4 * u, 40 * u, ['rock', 'stone', 'cold'], 0.45);
      for (let k = 0; k < 3; k += 1) {
        const hw = (14 + k * 4) * u; const y0 = F + k * 3 * u;
        p.fill(C.rect(gx - hw, y0, hw * 2, 3 * u + 1), 'warm', 2.2 - k * 0.3, 5);
        p.fill(C.rect(gx - hw, y0, hw * 2, 1), 'warm', 3.6 - k * 0.4, 5);
      }
      // The card, at the door.
      const sub = 30 * u;
      if (cat === 'monster') {
        SUBJECT.monster(p, gx, F, sub, ramp, 7);
        p.backlit(7, 'glow', 4, 'glow', 6.2);
        p.tint(gx, F - sub * 0.9, 6 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        traveller(p, gx - 3 * u, F, sub + 3 * u, ramp, u);
      } else if (cat === 'item') {
        grimoire(p, gx, F, u, ramp, hex);
      } else if (shut) {
        ward(p, gx, F - 22 * u, 10 * u, ramp, hex, u);
      } else if (open) {
        // Gold down the steps and along the path.
        p.light(gx, F, 64 * u, 3.4, flicker(0.2, 0.06, 0.4), { zMin: 4, zMax: 6, sy: 0.6 });
        p.tint(gx, F - 6 * u, 22 * u, CARD.path[3], 0.2, flicker(0.4, 0.08, 0.5));
      }
      // The door's light on the steps and the path.
      if (!shut) p.light(gx, F, 36 * u, 3.6 * bright, flicker(1.1, 0.06, 0.5), { zMin: 4, zMax: 5, sy: 0.6 });
      p.backlit(5, 'moon', 0, 'cold', 7);
      vignette(p, W, H, 1.6, 0.4);
      p.rim(0, -1, 0.6, 3);
      return {
        p,
        over(img, t) {
          for (const f of flames) flame(img, f, t);
          windowFlicker(img, wins, t);
          // Ravens wheeling round the tower, one sitting in the dead tree.
          for (let k = 0; k < 4; k += 1) {
            const a = t * (0.35 + k * 0.07) + k * 1.7;
            const x = gx + Math.cos(a) * (40 + k * 9) * u; const y = (14 + k * 6) * u + Math.sin(a * 1.3) * 5 * u;
            sprite(img, Math.round(x), Math.round(y), RAVEN_FLY[Math.floor(t * 5 + k) % 2], RAVEN, Math.sin(a) > 0);
          }
          sprite(img, Math.round(perch[0]), Math.round(perch[1]), RAVEN_SIT[Math.floor(t * 0.7) % 3 === 2 ? 1 : 0], RAVEN);
          // Mist wisps drifting along the valleys.
          for (let k = 0; k < Math.round(W / 10); k += 1) {
            const r0 = hash(k, 1, 77); const r1 = hash(k, 2, 77);
            const x = ((r0 * W + t * (2 + r1 * 3) * u) % (W + 20)) - 10; const y = (r1 < 0.5 ? 64 : 76) * u + hash(k, 3, 77) * 6 * u;
            for (let j = 0; j < 4; j += 1) put(img, x + j, y, '#5B6068', 0.25 * (1 - Math.abs(j - 1.5) / 2));
          }
          if (open) for (const q of particles('mote', 14, [gx - 14 * u, F - 44 * u, 28 * u, 52 * u], t, 6)) put(img, q.x, q.y, CARD.path[4], q.a);
          if (cat === 'item') for (const q of particles('mote', 10, [gx - 9 * u, F - 46 * u, 18 * u, 24 * u], t, 4)) put(img, q.x, q.y, CARD.item[3], q.a);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['moon', 'glow', 'wax'] });
      const u = H / 250;
      // The courtyard: worn flagstones running away to the tower's foot.
      p.fill(C.rect(0, 0, W, H), 'stone', 1.1, 1);
      p.floor(C.rect(0, 0, W, H), { vx: W / 2, vy: -60 * u, rows: 4.6, size: 1.0, d0: 30 * u, joint: -1.2, top: 0.5, left: 0.3, vary: 1.0, chip: 0.07, seed: 51, z: 1 });
      p.grain(C.rect(0, 0, W, H), 0.35, 5, 52, 1);
      // Puddles from the last rain, holding the sky.
      const si = p.ri('sky');
      const puddles = [[0.22, 54, 20, 5], [0.76, 72, 17, 4.5], [0.34, 116, 22, 5.5], [0.68, 142, 18, 5], [0.14, 168, 15, 4.5]];
      for (const [fx, y, rx, ry] of puddles) {
        const x0 = W * fx; const y0 = y * u;
        p.each(C.ellipse(x0, y0, rx * u, ry * u, 20), (x, y2, i) => {
          const d = Math.hypot((x + 0.5 - x0) / (rx * u), (y2 + 0.5 - y0) / (ry * u));
          p.r[i] = si; p.v[i] = 1.6 + (1 - d) * 1.2 + (y2 + 0.5 < y0 ? 0.5 : 0);
        });
      }
      // Moonlight from beyond the tower on the stones, except in its long shadow down the middle.
      const ci = p.ri('cold');
      const hw = (y) => 20 * u + y * 0.24;
      p.each(C.rect(0, 0, W, H * 0.7), (x, y, i) => {
        const out = (Math.abs(x + 0.5 - W / 2) - hw(y)) / (5 * u);
        if (out <= 0) { p.v[i] -= 0.35; return; }
        const a = Math.max(0, 1 - y / (H * 0.66));
        if (p.r[i] === si) { p.v[i] += 2.2 * a * a * Math.min(1, out); return; }
        p.r[i] = ci; p.v[i] += 2.6 * a * a * Math.min(1, out);
      });
      // The moon in the near puddles, where the shadow does not reach.
      for (const [fx, y, rx] of puddles.slice(0, 2)) p.fill(C.ellipse(W * fx + rx * 0.3 * u, y * u - 1, 2.2 * u, 0.9 * u, 10), 'sky', 9, 1);
      // The windows' light, warm lancets on the flagstones far off, inside the shadow.
      const wi = p.ri('warm');
      for (const [dx, y0, s] of [[-20, 8, 1.1], [12, 24, 1.0], [-6, 42, 0.9], [20, 56, 0.85], [-22, 66, 0.75]]) {
        const x0 = W / 2 + dx * u; const w = 8 * u * s; const h = 18 * u * s;
        p.each(C.arch(x0, y0 * u, w, y0 * u + h, 1), (x, y, i) => {
          const bar = Math.abs(x + 0.5 - x0) < 0.6 || Math.abs(y - (y0 * u + h * 0.55)) < 0.6;
          p.r[i] = wi; p.v[i] += (bar ? 0.5 : 3.6) * Math.max(0.2, 1 - y / (H * 0.42));
        });
      }
      // Parapets at the sides, crenellated, their merlons catching the moon.
      for (const side of [0, 1]) {
        const inner = (y) => (side ? W - 26 * u + 16 * u * (y / H) : 26 * u - 16 * u * (y / H));
        const wall = C.poly(side ? [[W - 26 * u, 0], [W, 0], [W, H], [W - 10 * u, H]] : [[0, 0], [26 * u, 0], [10 * u, H], [0, H]]);
        p.fill(wall, 'stone', 1.2, 3);
        p.masonry(wall, { bw: 12 * u, bh: 7 * u, joint: -1, top: 0.4, vary: 0.7, chip: 0.04, z: 3, seed: 60 + side });
        p.each(wall, (x, y, i) => {
          const ex = side ? x + 0.5 - inner(y) : inner(y) - (x + 0.5);
          if (ex < 0 || ex > 7 * u) return;
          const my = y / (14 * u); const merlon = Math.floor(my) % 2 === 0;
          const lit = Math.max(0, 1 - y / (H * 0.75));
          if (!merlon) { p.r[i] = p.ri('shadow'); p.v[i] = ex < 4 * u ? 0.4 : 1.2; return; }
          const edge = my - Math.floor(my) < 0.12;
          p.r[i] = ci; p.v[i] = (ex < 4 * u ? 2.6 + 3.0 * lit : 1.6 + 1.2 * lit) + (edge ? 1 : 0) + (ex < 1.2 ? 0.8 : 0);
        });
      }
      p.shade(null, (x, y) => -2.3 * Math.max(0, y / H - 0.36) - 0.8 * (Math.abs(x - W / 2) / (W / 2)) ** 4);
      return {
        p,
        over(img, t) {
          sprite(img, Math.round(21 * u), Math.round(97 * u), RAVEN_SIT[Math.floor(t * 0.8) % 3 === 2 ? 1 : 0], RAVEN, true);
          for (let k = 0; k < 18; k += 1) {
            const r0 = hash(k, 1, 91); const r1 = hash(k, 2, 91);
            const side = k % 2; const x = side ? W - 40 * u + ((r0 * 40 * u + t * 3 * u) % (40 * u)) : ((r0 * 40 * u + t * 3 * u) % (40 * u));
            const y = H * 0.55 + r1 * H * 0.4;
            for (let j = 0; j < 5; j += 1) put(img, x + j, y, '#444952', 0.22 * (1 - Math.abs(j - 2) / 2.5));
          }
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B, C3]);
})();
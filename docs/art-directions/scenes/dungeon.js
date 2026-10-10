/* Job 1, the dungeon: two directions. */
(() => {
  const { C, Painter, put, sprite, SPRITES, particles, flicker, SUBJECT, CARD, hash, clamp, lerp } = PX;

  const FLAME = { a: '#7E3A12', b: '#E08A2E', c: '#FFE08A', d: '#3A2010' };
  const RAT = { a: '#0B0807', b: '#C98A3E' };
  const catRamp = (cat) => PX.CATEGORIES.find((c) => c[0] === cat)[2];

  function chest(p, cx, fy, s, ramp, z = 6) {
    const w = s * 0.6; const h = s * 0.42;
    p.fill(C.poly([[cx - w * 0.92, fy - h], [cx - w * 0.78, fy - h - s * 0.42], [cx + w * 0.78, fy - h - s * 0.42], [cx + w * 0.92, fy - h]]), 'wood', 3.4, z); // the lid, open
    p.fill(C.rect(cx - w * 0.8, fy - h - s * 0.36, w * 1.6, 1), 'iron', 2.4, z + 1);
    p.glow(C.rect(cx - w * 0.85, fy - h - s * 0.12, w * 1.7, s * 0.14), ramp, cx, fy - h - s * 0.05, w, 4, 2.2, z + 1); // what is in it
    p.fill(C.rect(cx - w, fy - h, w * 2, h), 'wood', (x, y) => 5.6 - (y - (fy - h)) / h * 1.8 + ((x - cx + w) % (s * 0.25) < 1 ? -0.9 : 0), z);
    p.fill(C.rect(cx - w, fy - h, w * 2, 1.4), 'wood', 6.6, z + 1);
    for (const x of [cx - w * 0.7, cx + w * 0.7 - 2]) p.fill(C.rect(x, fy - h, 2, h), 'iron', 2.4, z + 1);
    p.fill(C.rect(cx - 1.5, fy - h + 2, 3, 3), 'iron', 3.6, z + 1);
    for (const [ox, oy] of [[-0.3, -0.24], [0.1, -0.3], [0.35, -0.2], [-0.05, -0.18]]) p.fill(C.rect(cx + ox * s, fy - h + oy * s, 1, 1), ramp, 4.6, z + 2);
  }

  function vignette(p, W, H, k = 2, cy = 0.45) {
    p.shade(null, (x, y) => -k * (((x - W / 2) / (W / 2)) ** 2 * 0.75 + ((y - H * cy) / (H * 0.62)) ** 2 * 0.55));
  }
  function soot(p, x, y, u) {
    p.shade(C.ellipse(x, y - 11 * u, 4 * u, 9 * u), (px, py) => -1.1 * (1 - Math.abs(px - x) / (4.5 * u)), 1);
  }

  /* ================= A: the gatehouse ================= */

  const RAMPS_A = {
    stone: ['#09080A', '#13100F', '#1D1715', '#2A201B', '#3A2B22', '#4E392B', '#674A37', '#835F45', '#A27857', '#C49A6E'],
    floor: ['#080607', '#110D0C', '#1B1412', '#271D18', '#352720', '#46342A', '#5E4535', '#7B5B44', '#9E7656'],
    iron: ['#050506', '#0E0E11', '#19191E', '#26262D', '#393943', '#52525E', '#74747F'],
    void: ['#040303', '#0C0907', '#160F0B', '#24170E', '#382212', '#563316', '#7D4A1B', '#AA6A25', '#D69238', '#F2BE63', '#FFE3A1'],
    shadow: ['#030203', '#09070A', '#120E10', '#1C1618'],
    wood: ['#100A07', '#1C120B', '#2C1D12', '#402A19', '#583A22', '#754E2D', '#96673C', '#BA8A55'],
    ...CARD,
  };

  /**
   * The gate, seen from the gatehouse: a round arch with a ring of wedge
   * stones; inside it the passage runs away to a lit opening, its walls and
   * floor catching that light; the portcullis hangs black against it.
   */
  function gate(p, W, H, g) {
    const { gx, hw, top, floor, u } = g;
    const th = Math.max(3, Math.round(5 * u));
    const hwi = hw * 0.8; const topi = top + hw * 0.24;          // the passage, behind the reveal
    const hwf = hw * 0.3; const springF = floor - hw * 1.55; const floorF = floor - hw * 0.62; // its far end
    const springI = topi + hwi;
    const front = C.arch(gx, top, hw, floor);
    const inner = C.arch(gx, topi, hwi, floor);
    const bright = g.bright ?? 1;
    // The ring of voussoirs, lit by the torches like the wall.
    const ring = C.join(C.arch(gx, top - th, hw + th, floor), C.arch(gx, top, hw, floor + 1));
    p.fill(ring, 'stone', 2.4, 3);
    p.shade(ring, (x, y) => {
      const cy = top + hw;
      if (y > cy) return Math.floor((y - cy) / (6 * u)) % 2 ? -0.3 : 0.3;
      const a = Math.atan2(cy - y, x - gx); const seg = (a / Math.PI) * 9; const f = seg - Math.floor(seg);
      return f < 0.14 ? -1.2 : (Math.floor(seg) % 2 ? 0.3 : -0.1);
    }, 3);
    p.fill(C.poly([[gx - th * 0.8, top - th - 1], [gx + th * 0.8, top - th - 1], [gx + th * 0.5, top + 1.5], [gx - th * 0.5, top + 1.5]]), 'stone', 3.4, 3);
    // The reveal: the wall's thickness, lit from inside.
    p.fill(C.join(front, inner), 'stone', (x, y) => 2.6 + 2.2 * bright * clamp((y - top) / (floor - top), 0, 1) * 0.5 + 1.2 * bright, 2);
    // The passage: its vault and walls glowing toward the far end, courses running away.
    const fcx = gx; const fcy = (springF + floorF) / 2;
    p.fill(inner, 'void', (x, y) => {
      const ax = Math.abs(x - gx);
      const t = clamp((hwi - ax) / (hwi - hwf), 0, 1);
      const yTop = lerp(springI, springF, t); const yBot = lerp(floor, floorF, t);
      const h = (y - yTop) / Math.max(1, yBot - yTop);
      const d = Math.hypot((x - fcx) / hwi, (y - fcy) / (hw * 1.4));
      let v = (8.2 - 6.2 * Math.min(1, d)) * bright;
      if (ax > hwf && h > 0 && h < 1 && ((h * 5) % 1) < 0.16) v -= 1.2;
      return v;
    }, 2);
    p.fill(C.poly([[gx - hwi, floor], [gx + hwi, floor], [gx + hwf, floorF], [gx - hwf, floorF]]), 'void', (x, y) => {
      const t = clamp((floor - y) / (floor - floorF), 0, 1);
      const line = ((Math.pow(1 - t, 0.6) * 6) % 1) < 0.18 ? -1 : 0;
      return (2.4 + 5.2 * t ** 1.4) * bright + line;
    }, 2);
    // The far opening.
    const far = C.arch(gx, springF - hwf, hwf, floorF);
    p.glow(far, 'void', gx, floorF - hwf * 1.2, hwf * 2.2, 10.4 * Math.min(1, bright + 0.15), 8.4 * bright, 2);
    // The light out of the gate, on the floor in front, striped by the bars' shadows.
    const spill = { gx, floor, hw, port: g.port };
    if (bright > 0.2) {
      p.light(gx, floor + 1, hw * 1.7, 4.4 * bright, g.flick ? flicker(1.1, 0.06, 0.5) : null, { zMin: 1, zMax: 1, sy: 0.42 });
    }
    // The portcullis, black against it.
    if (g.port !== undefined) {
      const iron = g.portRamp || 'iron';
      const step = Math.max(4, Math.round(5 * u));
      p.each(front, (x, y, i) => {
        if (y > g.port + 2) return;
        const bx = (x - gx + step * 60) % step; const by = (y - top + step * 60) % Math.round(step * 1.8);
        const bar = bx < 2 && (y <= g.port || (y <= g.port + 2 && bx >= 0.5 && bx < 1.5));
        const cross = by < 1.5 && y <= g.port - 1;
        if (!bar && !cross) return;
        p.r[i] = p.ri(iron); p.z[i] = 4;
        p.v[i] = iron === 'iron' ? (cross ? 1.2 : 0.4) : (cross ? 1.4 : bx < 1 ? 1.8 : 0.9);
      });
    }
    return spill;
  }

  /** Bars' shadows across the lit floor: stripes radiating from the gate. */
  function barShadows(p, W, H, s, u) {
    if (s.port === undefined) return;
    const step = Math.max(4, Math.round(5 * u));
    p.shade(C.rect(s.gx - s.hw * 1.8, s.floor, s.hw * 3.6, H - s.floor), (x, y) => {
      const k = (x - s.gx) / (1 + (y - s.floor) * 0.09);
      return (((k + step * 60) % step) < 2 && Math.abs(x - s.gx) < s.hw * (1 + (y - s.floor) * 0.08)) ? -1.1 : 0;
    }, 1);
  }

  function torch(p, x, y, u, flick, phase) {
    soot(p, x, y, u);
    p.fill(C.poly([[x - 2.5, y - 1], [x + 3.5, y - 1], [x + 2, y + 2], [x - 1, y + 2]]), 'iron', 2.6, 5);
    p.fill(C.rect(x, y + 2, 1, Math.max(3, 4 * u)), 'iron', 2.2, 5);
    p.fill(C.rect(x - 1, y + 2 + Math.max(3, 4 * u), 3, 2), 'iron', 1.8, 5);
    p.light(x, y - 3, 34 * u, 5.4, flick ? flicker(phase, 0.2) : null, { zMin: 1, hard: true });
    p.light(x, y - 3, 66 * u, 1.3, null, { zMin: 1 });
  }

  function chain(p, x, y0, y1) {
    for (let y = y0, k = 0; y < y1; y += 3, k += 1) {
      if (k % 2) p.fill(C.rect(x, y, 1, 3), 'iron', 3.4, 5);
      else { p.fill(C.rect(x - 1, y, 3, 3), 'iron', 3.9, 5); p.fill(C.rect(x, y + 1, 1, 1), 'shadow', 0, 5); }
    }
  }

  function barrel(p, x, fy, u) {
    const w = 7 * u; const h = 11 * u;
    p.fill(C.poly([[x - w, fy], [x - w * 1.15, fy - h * 0.5], [x - w, fy - h], [x + w, fy - h], [x + w * 1.15, fy - h * 0.5], [x + w, fy]]), 'wood', 2, 5);
    p.shade(C.rect(x - w * 1.2, fy - h, w * 2.4, h), (px) => ((px - x + w * 2) % (3 * u) < 1 ? -0.8 : 0) + (px < x ? 0.5 : -0.4), 5);
    p.fill(C.rect(x - w * 1.12, fy - h * 0.72, w * 2.24, 1), 'iron', 2.6, 5);
    p.fill(C.rect(x - w * 1.12, fy - h * 0.3, w * 2.24, 1), 'iron', 2.6, 5);
  }

  const A = {
    job: 1, setting: 'dungeon', key: 'A', id: 'dungeon-a',
    name: 'Dungeon', title: 'The gatehouse',
    pitch: 'Every card is a gate. You stand in a torchlit gatehouse before a half-lowered portcullis, and the passage beyond runs away to a light.',
    notes: [
      ['Light', 'Two wall torches throw warm pools onto dark stone. The passage glows from its far end, so the bars always read black against it.'],
      ['Detail', 'Laid blocks of uneven width, wedge stones and a keystone round the gate, soot above the torches, the bars’ shadows across the floor, chains, a rat.'],
      ['Vista', 'The gatehouse wall runs the width of the board, torch to torch. The card stands in the gate, against the light: the portcullis drops for an Obstacle and rises for a Clear Path.'],
      ['World', 'Flagstones under the table: the gate’s light spills down from the top, the torches burn high at the sides, embers rise. Black by the hand.'],
    ],
    palette: ['#09080A', '#2A201B', '#4E392B', '#835F45', '#C49A6E', '#19191E', '#74747F', '#AA6A25', '#FFE3A1'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['void'] });
      const u = H / 134;
      const floor = Math.round(104 * u);
      p.fill(C.rect(0, 0, W, floor), 'stone', 1.2, 1);
      p.masonry(C.rect(0, 0, W, floor), { bw: 8 * u, bh: 6 * u, joint: -1.2, top: 0.5, left: 0.35, vary: 1.1, chip: 0.05, seed: 3, z: 1 });
      p.fill(C.rect(0, floor, W, H - floor), 'floor', 1.7, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: W / 2, vy: floor - 40 * u, rows: 4, size: 0.9, d0: 40 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 4, z: 1 });
      const s = gate(p, W, H, { u, gx: W / 2, hw: 19 * u, top: 30 * u, floor, port: Math.round(80 * u) });
      barShadows(p, W, H, s, u);
      const tl = Math.round(W * 0.15); const tr = Math.round(W * 0.85); const ty = Math.round(60 * u);
      torch(p, tl, ty, u, false); torch(p, tr, ty, u, false);
      chain(p, Math.round(W / 2 - 27 * u), 0, 34 * u);
      chain(p, Math.round(W / 2 + 27 * u), 0, 34 * u);
      vignette(p, W, H, 2.6);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img) {
          sprite(img, tl, ty, SPRITES.flame[0], FLAME);
          sprite(img, tr, ty, SPRITES.flame[1], FLAME);
          sprite(img, Math.round(W * 0.7), Math.round(118 * u), SPRITES.rat[0], RAT, true);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['void'] });
      const u = H / 100;
      const gx = W / 2; const floor = Math.round(86 * u);
      const ramp = catRamp(cat);
      p.fill(C.rect(0, 0, W, floor), 'stone', 1.0, 1);
      p.masonry(C.rect(0, 0, W, floor), { bw: 9 * u, bh: 7 * u, joint: -1.2, top: 0.5, left: 0.35, vary: 1.1, chip: 0.05, seed: 5, z: 1 });
      p.fill(C.rect(0, floor, W, H - floor), 'floor', 1.5, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: W / 2, vy: floor - 30 * u, rows: 4, size: 0.9, d0: 30 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 6, z: 1 });
      const g = { u, gx, hw: 22 * u, top: 18 * u, floor, flick: true };
      if (cat === 'obstacle') { g.port = floor - 1; g.portRamp = ramp; g.bright = 0.55; }
      else if (cat === 'clear-path') { g.bright = 1.25; }
      else g.port = Math.round(30 * u);
      const s = gate(p, W, H, g);
      // The card, against the light.
      const sub = Math.round(floor);
      const hex = PX.CARD[ramp][3];
      if (cat === 'monster') {
        SUBJECT.monster(p, gx, sub - 9 * u, 34 * u, ramp, 3);
        p.backlit(3, 'void', 3.2, 'void', 6.8);
        p.tint(gx, sub - 9 * u - 34 * u * 0.9, 7 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        SUBJECT.wanderer(p, gx - 3 * u, sub - 7 * u, 32 * u, 'shadow', 3, false);
        p.backlit(3, 'void', 3.2, 'void', 6.8);
        const lx = gx - 3 * u + 32 * u * 0.3; const ly = sub - 7 * u - 32 * u * 0.6;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 6);
        p.tint(lx, ly, 24 * u, hex, 0.55, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        chest(p, gx, sub + 6 * u, 32 * u, ramp, 6);
        p.backlit(6, 'void', 3, 'void', 6.4);
        p.tint(gx, sub - 14 * u, 30 * u, hex, 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        p.fill(C.rect(gx - 3 * u, floor - 34 * u, 6 * u, 6 * u), ramp, 3.6, 6); // the lock on the bars
        p.tint(gx, floor - 30 * u, 26 * u, hex, 0.3, flicker(0.5, 0.12, 0.6));
      }
      barShadows(p, W, H, s, u);
      // Torches along the wall, a pool of light each and dark between.
      const torches = [];
      for (let d = 46 * u; gx + d < W + 16 * u; d += 76 * u) torches.push(gx - d, gx + d);
      torches.forEach((x, i) => torch(p, Math.round(x), Math.round(44 * u), u, true, i * 1.7));
      for (let d = 84 * u; gx + d < W; d += 152 * u) { barrel(p, gx - d, floor + 2 * u, u); barrel(p, gx + d + 9 * u, floor + 2 * u, u); }
      chain(p, Math.round(gx - g.hw - 9 * u), 0, g.top + 12 * u);
      chain(p, Math.round(gx + g.hw + 9 * u), 0, g.top + 12 * u);
      vignette(p, W, H, 1.6, 0.4);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img, t) {
          torches.forEach((x, i) => sprite(img, Math.round(x), Math.round(44 * u), SPRITES.flame[Math.floor(t * 8 + i) % 3], FLAME));
          for (const q of particles('ember', Math.round(W / 16), [0, 0, W, floor], t, 11)) put(img, q.x, q.y, q.big ? '#F2BE63' : '#AA6A25', q.a * 0.9);
          const rx = W * 0.64 + Math.sin(t * 0.4) * 6 * u;
          sprite(img, Math.round(rx), Math.round(floor + 10 * u), SPRITES.rat[Math.floor(t * 4) % 2], RAT, Math.cos(t * 0.4) < 0);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_A, { emit: ['void'] });
      const u = H / 250;
      p.fill(C.rect(0, 0, W, H), 'floor', 1.2, 1);
      p.floor(C.rect(0, 0, W, H), { vx: W / 2, vy: -90 * u, rows: 3.2, size: 1.1, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.25, vary: 0.8, chip: 0.03, seed: 9, z: 1 });
      // The gate's light, spilling down from behind the vista.
      p.light(W / 2, -20 * u, 175 * u, 2.7, flicker(0.7, 0.07, 0.5), { sx: 1.7 });
      // The walls at the sides, a torch high on each.
      for (const side of [0, 1]) {
        const wall = C.poly(side ? [[W - 34 * u, 0], [W, 0], [W, H], [W - 14 * u, H]] : [[0, 0], [34 * u, 0], [14 * u, H], [0, H]]);
        p.fill(wall, 'stone', 1.0, 3);
        p.masonry(wall, { bw: 13 * u, bh: 8 * u, joint: -1, top: 0.4, vary: 0.7, chip: 0.04, z: 3, seed: 8 + side });
        const tx = side ? W - 22 * u : 22 * u;
        soot(p, tx, 54 * u, u * 1.3);
        p.light(tx, 50 * u, 60 * u, 4.2, flicker(side * 2.1, 0.22), { zMin: 1, hard: true });
      }
      chain(p, Math.round(50 * u), 0, 64 * u);
      chain(p, Math.round(W - 50 * u), 0, 78 * u);
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.36));
      return {
        p,
        over(img, t) {
          for (const x of [22 * u, W - 22 * u]) sprite(img, Math.round(x), Math.round(54 * u), SPRITES.flame[Math.floor(t * 8 + x) % 3], FLAME);
          for (const q of particles('ember', 22, [0, 20 * u, W, H * 0.6], t, 21)) put(img, q.x, q.y, q.big ? '#D69238' : '#7D4A1B', q.a * 0.85);
        },
      };
    },
  };

  /* ================= B: the deep cells ================= */

  const RAMPS_B = {
    stone: ['#05070A', '#0A0E12', '#11171B', '#1A2125', '#242B2E', '#323534', '#46433A', '#615641', '#806C4C', '#A8895C'],
    floor: ['#040607', '#090C0E', '#0F1416', '#161D20', '#20272A', '#2E3231', '#433F36', '#5E5340'],
    water: ['#020304', '#05080A', '#0A1013', '#11191D', '#1B262B', '#4A3B25', '#8C6A36', '#D9A85C', '#FFE0A0'],
    iron: ['#040405', '#0B0C0E', '#14161A', '#20232A', '#30343C', '#474C56', '#686E79', '#8C8466'],
    shadow: ['#020303', '#06080A', '#0C1013', '#13181B'],
    cell: ['#010102', '#040506', '#08090B', '#0E1012', '#15181A'],
    wood: ['#0E0A07', '#19120B', '#281C11', '#3A2918', '#51391F', '#6C4C28'],
    lamp: ['#6A3C12', '#B87426', '#EBB45A', '#FFE7A8', '#FFF8E2'],
    straw: ['#0E0B06', '#1E180C', '#332A14', '#4F421F', '#6E5C2C'],
    ...CARD,
  };

  /** A cell door: an arched opening in a thick stone frame, heavy bars, two bands, hinges and a lock. */
  function cellDoor(p, cx, top, hw, floor, u, o = {}) {
    const open = C.arch(cx, top, hw, floor);
    const th = Math.max(3, Math.round(5 * u));
    const ring = C.join(C.arch(cx, top - th, hw + th, floor), C.arch(cx, top, hw, floor + 1));
    p.fill(ring, 'stone', 2.2, 3);
    p.shade(ring, (x, y) => (Math.floor((y - top + th) / (6 * u)) % 2 ? -0.35 : 0.3) + (y < top + hw && ((Math.atan2(top + hw - y, x - cx) / Math.PI * 7) % 1) < 0.15 ? -1 : 0), 3);
    p.fill(open, 'cell', (x, y) => 0.7 + (1 - Math.abs(x - cx) / hw) * 0.6, 2);
    if (o.inside) o.inside(open);
    if (o.openDoor) return;
    const step = Math.max(4, Math.round(6 * u));
    const iron = o.ironRamp || 'iron';
    const b1 = top + hw * 0.95; const b2 = floor - hw * 0.8;
    p.each(open, (x, y, i) => {
      const bx = (x - cx + step * 40 + 1) % step;
      const band = Math.abs(y - b1) < 1.6 || Math.abs(y - b2) < 1.6;
      if (bx >= 2 && !band) return;
      p.r[i] = p.ri(iron); p.z[i] = 4;
      p.v[i] = band ? 2.2 : 1.4;
    });
    // Hinges on the left, the lock on the right.
    for (const y of [b1, b2]) p.fill(C.rect(cx - hw - th, y - 1.5, th + 3, 3), iron, 2.6, 5);
    p.fill(C.rect(cx + hw - 6 * u, b2 - 9 * u, 5 * u, 6 * u), iron, 3, 5);
    p.fill(C.rect(cx + hw - 4 * u, b2 - 7 * u, 1, 2), 'shadow', 0, 6);
  }

  function lantern(p, x, y, u, flick, armFrom) {
    if (armFrom !== undefined) {
      p.fill(C.rect(Math.min(armFrom, x), y - 9 * u, Math.abs(x - armFrom) + 1, 1.5), 'iron', 2.4, 5);
      p.fill(C.rect(armFrom - 1, y - 11 * u, 2, 5 * u), 'iron', 2.8, 5);
      p.fill(C.rect(x, y - 9 * u, 1, 4 * u), 'iron', 2.4, 5);
    } else p.fill(C.rect(x, 0, 1, y - 4 * u), 'iron', 2.4, 5);
    p.fill(C.poly([[x - 3 * u, y - 4 * u], [x + 4 * u, y - 4 * u], [x + 0.5, y - 6.5 * u]]), 'iron', 3, 5);
    p.glow(C.rect(x - 2.5 * u, y - 4 * u, 6 * u, 7 * u), 'lamp', x + 0.5, y - 0.5 * u, 4 * u, 4.4, 2.2, 6);
    p.fill(C.rect(x - 3 * u, y + 3 * u, 7 * u, 1.2), 'iron', 3.2, 5);
    p.fill(C.rect(x - 3 * u, y - 4 * u, 1, 7 * u), 'iron', 2.6, 6);
    p.fill(C.rect(x + 3.5 * u, y - 4 * u, 1, 7 * u), 'iron', 2.6, 6);
    p.light(x, y, 50 * u, 6.2, flick ? flicker(0.8, 0.1, 0.8) : null, { zMin: 1, hard: true });
    p.light(x, y, 96 * u, 1.4, null, { zMin: 1 });
  }

  function puddle(p, cx, cy, rx, ry, lx, v = 6.2) {
    p.fill(C.ellipse(cx, cy, rx, ry), 'water', 2.4, 1);
    // The lantern, upside down in it, broken by ripples.
    p.fill(C.rect(lx - 1.5, cy - ry * 0.7, 4, ry * 1.4), 'water', (x, y) => (y % 2 ? v : v - 1.4), 1);
    p.fill(C.rect(lx - 3, cy, 7, 1), 'water', v - 1.8, 1);
  }

  function tally(p, x, y, groups, u) {
    for (let gI = 0; gI < groups; gI += 1) {
      const gx = x + gI * 7 * u;
      for (let k = 0; k < 4; k += 1) p.fill(C.rect(gx + k * 1.4 * u, y, 1, 6 * u), 'stone', 4.6, 3);
      for (let k = 0; k < 6; k += 1) p.fill(C.rect(gx - 0.5 + k * u, y + 5 * u - k * u, 1, 1), 'stone', 5, 3);
    }
  }

  function streak(p, x, y0, y1, u) {
    p.shade(C.rect(x, y0, 2 * u, y1 - y0), (px, py) => (px - x < u ? -0.8 : 0.5) * (1 - (py - y0) / (y1 - y0)), 1);
  }

  const B = {
    job: 1, setting: 'dungeon', key: 'B', id: 'dungeon-b',
    name: 'Dungeon', title: 'The deep cells',
    pitch: 'Further down, where they kept people. A cell door under one lantern, cold wet stone, a shackle on the wall, and something behind the bars that has not moved in a long time.',
    notes: [
      ['Light', 'One warm lantern on cold blue-grey stone. Everything it doesn’t reach falls away to black, which keeps the rest of the row hidden.'],
      ['Detail', 'A barred door in a thick frame with hinges and a lock, a shackle and its chain, wet streaks down the wall, a puddle holding the lantern upside down.'],
      ['Vista', 'A row of cells along a wall, only the middle three in the light. The card is in the middle cell: eyes behind the bars, a chest left inside, its door open with light beyond.'],
      ['World', 'Wet flagstones under the table, the lantern’s pool swaying above, drips falling through it into the puddles.'],
    ],
    palette: ['#05070A', '#1A2125', '#323534', '#615641', '#A8895C', '#14161A', '#686E79', '#B87426', '#FFF8E2'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['lamp', 'cell'] });
      const u = H / 134;
      const floor = Math.round(106 * u);
      p.fill(C.rect(0, 0, W, floor), 'stone', 1.4, 1);
      p.masonry(C.rect(0, 0, W, floor), { bw: 8 * u, bh: 6 * u, joint: -1.2, top: 0.5, left: 0.35, vary: 1.1, chip: 0.05, seed: 12, z: 1 });
      streak(p, Math.round(W * 0.76), 0, 60 * u, u); streak(p, Math.round(W * 0.9), 0, 44 * u, u);
      p.fill(C.rect(0, floor, W, H - floor), 'floor', 1.9, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: W / 2, vy: floor - 40 * u, rows: 4, size: 0.9, d0: 40 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 3, z: 1 });
      cellDoor(p, W / 2 + 4 * u, 34 * u, 16 * u, floor, u, {
        inside() {
          const cx = W / 2 + 4 * u;
          p.fill(C.poly([[cx - 12 * u, floor], [cx - 6 * u, floor - 5 * u], [cx + 2 * u, floor - 4 * u], [cx + 10 * u, floor]]), 'straw', 1.4, 2);
          p.fill(C.rect(cx + 6 * u, 60 * u, 1, 9 * u), 'cell', 3, 2); p.fill(C.rect(cx + 5 * u, 69 * u, 3, 2), 'cell', 3.5, 2); // a shackle on the back wall
          p.fill(C.rect(cx - 5 * u, 86 * u, 1.4, 1), 'mons', 1.4, 2);
          p.fill(C.rect(cx - 1 * u, 86 * u, 1.4, 1), 'mons', 1.4, 2);
        },
      });
      const sx = Math.round(W * 0.84);
      p.fill(C.join(C.circle(sx, 64 * u, 3 * u), C.circle(sx, 64 * u, 1.6 * u)), 'iron', 2.6, 5);
      chain(p, sx, 67 * u, 82 * u);
      p.fill(C.join(C.circle(sx, 85 * u, 2.6 * u), C.circle(sx, 85 * u, 1.3 * u)), 'iron', 2.4, 5);
      const lx = Math.round(W * 0.17); const ly = Math.round(62 * u);
      lantern(p, lx, ly, u, false, Math.round(W * 0.04));
      puddle(p, W * 0.24, 119 * u, 15 * u, 3.6 * u, lx);
      vignette(p, W, H, 2.4);
      p.rim(-1, 0, 0.9, 4);
      return {
        p,
        over(img) {
          for (const [x, y] of [[0.5, 30], [0.62, 72]]) { put(img, W * x, y * u, '#806C4C'); put(img, W * x, y * u - 1, '#46433A'); }
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['lamp', 'cell'] });
      const u = H / 100;
      const gx = W / 2; const floor = Math.round(84 * u);
      const ramp = catRamp(cat);
      p.fill(C.rect(0, 0, W, floor), 'stone', 1.3, 1);
      p.masonry(C.rect(0, 0, W, floor), { bw: 9 * u, bh: 7 * u, joint: -1.2, top: 0.5, left: 0.35, vary: 1.1, chip: 0.05, seed: 14, z: 1 });
      p.fill(C.rect(0, floor, W, H - floor), 'floor', 1.7, 1);
      p.floor(C.rect(0, floor, W, H - floor), { vx: W / 2, vy: floor - 30 * u, rows: 4, size: 0.9, d0: 30 * u, joint: -1.2, top: 0.5, vary: 0.8, seed: 8, z: 1 });
      const pitch = 62 * u;
      for (let k = -Math.ceil(W / pitch); k <= Math.ceil(W / pitch); k += 1) {
        const cx = gx + k * pitch;
        if (cx < -30 * u || cx > W + 30 * u) continue;
        const mid = k === 0;
        if (Math.abs(k) === 1) streak(p, cx + 20 * u, 0, 40 * u, u);
        cellDoor(p, cx, 28 * u, 15 * u, floor, u, {
          openDoor: mid && (cat === 'clear-path' || cat === 'item'),
          ironRamp: mid && cat === 'obstacle' ? ramp : 'iron',
          inside(open) {
            if (!mid) return;
            if (cat === 'clear-path') {
              const n = 7; const top = 28 * u;
              p.each(open, (x, y, i) => {
                const k = Math.floor(((floor - y) / (floor - top - 6 * u)) * n);
                const lit = clamp((k + 1) / n, 0, 1);
                const edge = ((floor - y) / (floor - top - 6 * u)) * n % 1 < 0.2;
                p.r[i] = p.ri('lamp'); p.z[i] = 2;
                p.v[i] = 0.2 + lit * 3.2 - (edge ? 0.9 : 0) - Math.abs(x - cx) / (15 * u) * 0.8;
              });
              // The door, swung out against the wall to the left.
              p.each(C.poly([[cx - 15 * u, floor], [cx - 15 * u, top + 12 * u], [cx - 25 * u, top + 16 * u], [cx - 25 * u, floor + 3 * u]]), (x, y, i) => {
                if ((x - cx + 60) % 3 >= 1 && Math.abs(y - (top + 26 * u)) > 1 && Math.abs(y - (floor - 12 * u)) > 1) return;
                p.r[i] = p.ri('iron'); p.z[i] = 5; p.v[i] = 1.8;
              });
            }
            if (cat === 'monster') {
              SUBJECT.monster(p, cx, floor, 40 * u, ramp, 2);
              p.shade(open, (x, y) => (p.r[y * p.w + x] === p.ri('shadow') ? 1.2 : 0), 2);
              p.tint(cx, floor - 40 * u * 0.9, 7 * u, PX.CARD[ramp][3], 0.4, flicker(0.2, 0.3, 1.3));
            }
            if (cat === 'item') {
              SUBJECT.item(p, cx, floor - 1, 26 * u, ramp, 3);
              p.tint(cx, floor - 8 * u, 24 * u, PX.CARD[ramp][3], 0.5, flicker(1.1, 0.15));
            }
          },
        });
        if (mid && cat === 'obstacle') {
          const heap = C.poly([[cx - 24 * u, floor + 1], [cx - 14 * u, floor - 12 * u], [cx - 2 * u, floor - 7 * u], [cx + 9 * u, floor - 17 * u], [cx + 25 * u, floor + 1]]);
          p.fill(heap, 'stone', 2.4, 6);
          p.cells(heap, { size: 5 * u, joint: 0.9, jointV: -1.3, vary: 1, bevel: 0.8, seed: 2, z: 6 });
          p.tint(cx + 9 * u, floor - 28 * u, 26 * u, PX.CARD[ramp][3], 0.45, flicker(1, 0.12, 0.6));
        }
      }
      if (cat === 'wanderer') {
        SUBJECT.wanderer(p, gx + 22 * u, floor, 40 * u, ramp, 6, false);
        p.shade(C.rect(gx, 0, 44 * u, floor), -0.6, 6);
        const lx = gx + 22 * u + 40 * u * 0.3; const ly = floor - 40 * u * 0.6;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 7);
        p.tint(lx, ly, 26 * u, PX.CARD[ramp][3], 0.55, flicker(0.9, 0.15));
      }
      if (cat === 'clear-path') p.light(gx, floor - 20 * u, 40 * u, 2.4, flicker(0.2, 0.08, 0.4), { zMin: 1 });
      const lx = Math.round(gx - 31 * u);
      lantern(p, lx, Math.round(36 * u), u * 0.9, true);
      puddle(p, lx + 5 * u, floor + 8 * u, 20 * u, 3 * u, lx);
      vignette(p, W, H, 2.4, 0.4);
      p.rim(-1, 0, 0.8, 4);
      return {
        p,
        over(img, t) {
          for (const q of particles('drip', Math.round(W / 36), [0, 0, W, floor], t, 9)) { put(img, q.x, q.y, '#806C4C', 0.95); put(img, q.x, q.y - 1, '#323534', 0.8); }
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_B, { emit: ['lamp'] });
      const u = H / 250;
      p.fill(C.rect(0, 0, W, H), 'floor', 1.4, 1);
      p.floor(C.rect(0, 0, W, H), { vx: W / 2, vy: -90 * u, rows: 3.2, size: 1.1, d0: 50 * u, joint: -1.1, top: 0.45, left: 0.25, vary: 0.8, chip: 0.04, seed: 17, z: 1 });
      const r = PX.rng('cells-world');
      for (let k = 0; k < 10; k += 1) {
        const x = r() * W; const y = 20 * u + r() * H * 0.55;
        p.fill(C.ellipse(x, y, (12 + r() * 24) * u, (2.5 + r() * 3) * u), 'water', 2.6, 1);
      }
      for (const side of [0, 1]) {
        const wall = C.rect(side ? W - 20 * u : 0, 0, 20 * u, H);
        p.fill(wall, 'stone', 1.2, 3);
        p.masonry(wall, { bw: 14 * u, bh: 8 * u, joint: -1, top: 0.4, vary: 0.8, chip: 0.05, z: 3, seed: 3 + side });
        streak(p, side ? W - 12 * u : 9 * u, 0, 70 * u, u * 1.4);
      }
      // The lantern above the vista, swaying: two lights handing over.
      p.light(W * 0.42, -6 * u, 160 * u, 3.6, (t) => 0.5 + 0.5 * Math.sin(t * 0.9), { sx: 1.5, zMin: 1 });
      p.light(W * 0.58, -6 * u, 160 * u, 3.6, (t) => 0.5 - 0.5 * Math.sin(t * 0.9), { sx: 1.5, zMin: 1 });
      p.shade(null, (x, y) => -2 * Math.max(0, y / H - 0.36));
      return {
        p,
        over(img, t) {
          for (const q of particles('drip', 12, [24 * u, 0, W - 48 * u, H * 0.5], t, 31)) { put(img, q.x, q.y, '#615641', 0.9); put(img, q.x, q.y - 1, '#242B2E', 0.8); }
        },
      };
    },
  };

  window.DESIGNS = (window.DESIGNS || []).concat([A, B]);
})();

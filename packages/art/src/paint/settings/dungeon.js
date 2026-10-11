/* Job 1, the dungeon: two directions. */
import PX from '../px.js';

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
    if (g.dark) return darkPassage(p, g, { front, inner, hwi, hwf, springI, springF, floorF });
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

  /**
   * A face-down card's gate: the passage runs into the dark. No light at its
   * end (that is the Clear Path's), only the torches reaching a little way in,
   * and the portcullis grey iron in their light.
   */
  function darkPassage(p, g, s) {
    const { gx, hw, top, floor, u } = g;
    p.fill(C.join(s.front, s.inner), 'stone', 2.0, 2);
    p.fill(s.inner, 'stone', (x, y) => {
      const ax = Math.abs(x - gx);
      const t = clamp((s.hwi - ax) / (s.hwi - s.hwf), 0, 1);
      const yTop = lerp(s.springI, s.springF, t); const yBot = lerp(floor, s.floorF, t);
      const h = (y - yTop) / Math.max(1, yBot - yTop);
      let v = 1.5 - 1.9 * t - Math.max(0, (s.floorF - y) / (floor - top)) * 0.6;
      if (ax > s.hwf && h > 0 && h < 1 && ((h * 5) % 1) < 0.16) v -= 0.7;
      return v;
    }, 2);
    p.fill(C.poly([[gx - s.hwi, floor], [gx + s.hwi, floor], [gx + s.hwf, s.floorF], [gx - s.hwf, s.floorF]]), 'floor', (x, y) => {
      const t = clamp((floor - y) / (floor - s.floorF), 0, 1);
      return 1.8 - 2.2 * t - (((Math.pow(1 - t, 0.6) * 6) % 1) < 0.18 ? 0.8 : 0);
    }, 2);
    if (g.port !== undefined) {
      const step = Math.max(4, Math.round(5 * u));
      p.each(s.front, (x, y, i) => {
        if (y > g.port + 2) return;
        const bx = (x - gx + step * 60) % step; const by = (y - top + step * 60) % Math.round(step * 1.8);
        const bar = bx < 2 && (y <= g.port || (y <= g.port + 2 && bx >= 0.5 && bx < 1.5));
        const cross = by < 1.5 && y <= g.port - 1;
        if (!bar && !cross) return;
        p.r[i] = p.ri('iron'); p.z[i] = 4;
        p.v[i] = cross ? 2.5 : bx < 1 ? 3.1 : 2.1;
      });
    }
    return { gx, floor, hw };
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
    job: 1, setting: 'dungeon', key: 'A', id: 'dungeon-a', side: 'inside',
    revised: 'After your note: the back’s passage is dark now, with no light at its end, so a face-down card no longer looks like a Clear Path. In the vista only a Clear Path lights the far end fully.',
    name: 'Dungeon', title: 'The gatehouse',
    pitch: 'Every card is a gate. You stand in a torchlit gatehouse before a half-lowered portcullis, and the passage beyond runs into the dark. Only a Clear Path lights its far end.',
    notes: [
      ['Light', 'Two wall torches throw warm pools onto dark stone and catch the portcullis’ iron. On a face-down card the passage beyond is black: light at its end belongs to the Clear Path.'],
      ['Detail', 'Laid blocks of uneven width, wedge stones and a keystone round the gate, soot above the torches, chains, a rat.'],
      ['Vista', 'The gatehouse wall runs the width of the board, torch to torch. The card stands in the gate before a dull ember glow; the portcullis drops for an Obstacle, and for a Clear Path it rises and the far end blazes.'],
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
      gate(p, W, H, { u, gx: W / 2, hw: 19 * u, top: 30 * u, floor, port: Math.round(80 * u), dark: true });
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
      else { g.port = Math.round(30 * u); g.bright = 0.5; }
      const s = gate(p, W, H, g);
      // The card, against the light.
      const sub = Math.round(floor);
      const hex = PX.CARD[ramp][3];
      if (cat === 'monster') {
        SUBJECT.monster(p, gx, sub - 9 * u, 34 * u, ramp, 3);
        p.backlit(3, 'void', 1.6, 'void', 5.6);
        p.tint(gx, sub - 9 * u - 34 * u * 0.9, 7 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      } else if (cat === 'wanderer') {
        SUBJECT.wanderer(p, gx - 3 * u, sub - 7 * u, 32 * u, 'shadow', 3, false);
        p.backlit(3, 'void', 1.6, 'void', 5.6);
        const lx = gx - 3 * u + 32 * u * 0.3; const ly = sub - 7 * u - 32 * u * 0.6;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 6);
        p.tint(lx, ly, 24 * u, hex, 0.55, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        chest(p, gx, sub + 6 * u, 32 * u, ramp, 6);
        p.backlit(6, 'void', 1.6, 'void', 5.6);
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

  /* ================= C: the approach (the gatehouse from outside) ================= */

  const RAMPS_C = {
    stone: RAMPS_A.stone, floor: RAMPS_A.floor, iron: RAMPS_A.iron, void: RAMPS_A.void, shadow: RAMPS_A.shadow, wood: RAMPS_A.wood,
    // The night: cold and nearly grey, so it never reads as the Wanderer's blue.
    sky: ['#030406', '#06080B', '#0A0D11', '#0F1217', '#15191F', '#1C2027', '#252A31', '#30353C', '#3E434A', '#51555B', '#696C71', '#888A8C', '#AEAFAF'],
    moon: ['#6E7174', '#9A9C9C', '#C3C4C1', '#DEDED9', '#F0EFE9', '#FCFBF5'],
    rock: ['#050506', '#0A0A0C', '#111113', '#19191B', '#232224', '#2F2D2D', '#3E3A37', '#504A44', '#665D54'],
    chasm: ['#010102', '#030405', '#06070A', '#0A0C10', '#0F1216', '#15191E', '#1C2127'],
    ...CARD,
  };
  const CAGE = { a: '#141418', b: '#3A3A44' };
  const CAGE_ROWS = ['b..b..b', 'a..a..a', '.a.a.a.', '..aaa..'];
  const BOWL = { a: '#141418', b: '#7A5434', c: '#FFB050' };
  const BOWL_ROWS = ['bcbcbcbcbcb', '.aaaaaaaaa.', '..aaaaaaa..', '....aaa....'];
  const BIG_FLAME = { ...FLAME, e: '#FFF4C8' };
  const BIG_FLAME_ROWS = [
    ['...a...', '..aba..', '..bcb..', '.abcba.', '.bcccb.', 'abcecba', '.bcccb.', '..ddd..'],
    ['..a....', '..ab...', '..bcb..', '.abcba.', '.bcccb.', 'abcecba', '.bcccb.', '..ddd..'],
    ['....a..', '...ba..', '..bcb..', '.abcba.', '.bcccb.', 'abcecba', '.bcccb.', '..ddd..'],
  ];

  /** Smooth value noise, 0..1. */
  function vnoise(x, y, seed) {
    const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf); const sy = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi, seed), hash(xi + 1, yi, seed), sx), lerp(hash(xi, yi + 1, seed), hash(xi + 1, yi + 1, seed), sx), sy);
  }

  /**
   * The night sky: near black overhead with a few stars, paling to a cold
   * glow behind the skyline so the battlements stand black against it.
   * Long clouds lie across it, dark against the glow, lumpy on top, and
   * silvered along their tops where they pass near the moon. The moon is a
   * thin crescent, a small cold light that never takes the picture's focus.
   * clouds: [cx, cy, half-length, thickness], in pixels.
   */
  function nightSky(p, W, y1, o) {
    const { u, mx, my, mr, seed = 3, sky = y1 } = o;
    const R = o.halo || 40 * u; const glow = o.glow ?? 5.4; const pow = o.pow ?? 1.5;
    const sri = p.ri('sky'); const mri = p.ri('moon');
    const clouds = (o.clouds || []).map(([ccx, ccy, hl, th], k) => ({ ccx, ccy, hl, th, k }));
    const skyV = (cy) => 0.4 + glow * clamp(cy / sky, 0, 1) ** pow;
    p.each(C.rect(0, 0, W, y1), (x, y, i) => {
      const cx = x + 0.5; const cy = y + 0.5;
      const dm = Math.hypot(cx - mx, cy - my);
      const m = Math.max(0, 1 - dm / R); const m2 = m * m;
      p.z[i] = 0; p.r[i] = sri;
      for (const c of clouds) {
        const f = (cx - c.ccx) / c.hl;
        if (Math.abs(f) >= 1) continue;
        const prof = Math.sqrt(1 - f * f);
        const lump = 0.55 + 0.45 * vnoise(cx / (3.2 * u), c.k * 5.3, seed + 11) + 0.3 * vnoise(cx / (9 * u), c.k * 2.1, seed + 12);
        const top = c.ccy - c.th * prof * lump; const bot = c.ccy + c.th * prof * 0.32 * (0.7 + 0.6 * vnoise(cx / (6 * u), c.k, seed + 13));
        if (cy < top || cy > bot) continue;
        const into = (cy - top) / u;
        const lit = into < 1 ? 1 : into < 2 ? 0.4 : 0;
        p.v[i] = Math.max(1.3, skyV(cy) * 0.5) + 2.6 * m2 + lit * (0.9 + 6.2 * m2);
        return;
      }
      // A crescent, lit on its lower right; the rest of the disc barely paler than the sky.
      if (dm < mr) {
        const lit = Math.hypot(cx - (mx - mr * 0.42), cy - (my - mr * 0.3)) > mr * 0.86;
        if (lit) { p.r[i] = mri; p.v[i] = 3.6 - (dm < mr - 1.2 * u ? 0 : 0.8); return; }
        p.v[i] = 2.4; return;
      }
      let v = skyV(cy) + 2.6 * m2;
      if (hash(x, y, seed + 7) < (o.stars ?? 0.008) && m < 0.5 && cy < sky * 0.55) v = 4.6 + hash(x, y, seed + 8) * 3;
      p.v[i] = v;
    });
  }

  /** A far tower of the keep, behind the walls: a flat cold silhouette against the glow, merlons on top. */
  function farTower(p, x, w, top, bottom, u, v = 1.8) {
    const pitch = Math.max(4, 5 * u); const mw = Math.max(2, Math.round(pitch * 0.55));
    p.fill(C.rect(x - w / 2, top + 4 * u, w, bottom - top - 4 * u), 'sky', v, 0);
    p.fill(C.rect(x - w / 2 - u, top + 3 * u, w + 2 * u, 2.5 * u), 'sky', v + 0.4, 0);
    const n = Math.max(2, Math.round((w + 2 * u) / pitch));
    for (let k = 0; k <= n; k += 1) p.fill(C.rect(Math.round(x - w / 2 - u + ((w + 2 * u - mw) * k) / n), top, mw, 3.5 * u), 'sky', v + 0.4, 0);
  }

  /** Night on the walls: unlit stone falls toward black as it rises from the torches. */
  function nightFall(p, y0, y1, k, zs) {
    for (const z of zs) p.shade(null, (x, y) => -k * clamp((y1 - y) / (y1 - y0), 0, 1), z);
  }

  /**
   * Battlements along a straight wall: merlons with the sky between, a
   * parapet with a lit top, and under it a band of corbels with the
   * machicolations' dark holes between them.
   */
  function battlements(p, x0, x1, top, o) {
    const { u, z = 1, v = 1.2, seed = 2, ox = 0 } = o;
    const mh = o.mh ?? 5 * u; const ph = o.ph ?? 4 * u; const ch = o.ch ?? 3 * u;
    const pitch = o.pitch ?? Math.max(5, 7 * u); const mw = o.mw ?? Math.max(3, Math.round(pitch * 0.58));
    const ri = p.ri('stone'); const si = p.ri('shadow');
    p.each(C.rect(x0, top, x1 - x0, mh + ph + ch), (x, y, i) => {
      const yy = y + 0.5 - top; const f = (((x - ox) % pitch) + pitch) % pitch;
      let val;
      if (yy < mh) { if (f >= mw) return; val = v + (yy < 1 ? 0.7 : 0) + (f < 1 ? 0.35 : 0); }
      else if (yy < mh + ph) val = v + (yy - mh < 1 ? 0.55 : 0) + (yy >= mh + ph - 1 ? -0.5 : 0);
      else {
        const g = (((x - ox) % (pitch / 2)) + pitch) % (pitch / 2);
        if (g >= pitch / 4 && yy > mh + ph + 0.5) { p.r[i] = si; p.v[i] = 0.4; p.z[i] = z; return; }
        val = v - 0.25;
      }
      p.r[i] = ri; p.v[i] = val + (hash(Math.floor(x / (3 * u)), Math.floor(y / (3 * u)), seed) - 0.5) * 0.5; p.z[i] = z;
    });
  }

  /**
   * A round tower from the front: level courses whose joints close up
   * toward its sides, darker toward the edges. Its top is a parapet carried
   * out on corbels, with merlons spaced round it.
   */
  function drum(p, o) {
    const { cx, r, top, bottom, u, z = 5, seed = 1 } = o;
    const bw = o.bw || 6 * u; const bh = o.bh || 4 * u; const v0 = o.v ?? 1.2;
    const rp = r + Math.max(1, 1.5 * u);
    const mh = o.mh ?? 5 * u; const ph = o.ph ?? 4 * u; const ch = o.ch ?? 3 * u;
    const pitch = o.pitch ?? Math.max(5, 7 * u); const mw = pitch * 0.58;
    const ri = p.ri('stone'); const si = p.ri('shadow');
    const plinth = o.plinth || 0; const flare = 2.5 * u;
    p.each(C.rect(cx - rp - flare, top, (rp + flare) * 2, bottom - top), (x, y, i) => {
      const yy = y + 0.5 - top;
      const part = yy < mh ? 0 : yy < mh + ph ? 1 : yy < mh + ph + ch ? 2 : 3;
      const fl = plinth ? clamp((y + 0.5 - (bottom - plinth)) / plinth, 0, 1) : 0; // the battered foot
      const rr = part < 2 ? rp : r + fl * flare;
      const dx = (x + 0.5 - cx) / rr;
      if (Math.abs(dx) >= 1) return;
      const ang = Math.asin(dx); const s = ang * rr + 300 * u; const cs = Math.cos(ang);
      const round = v0 - 2.1 * dx * dx;
      let v;
      if (part === 0) { const f = s % pitch; if (f >= mw) return; v = round + 0.2 + (yy < 1 ? 0.7 : 0); }
      else if (part === 1) v = round + (yy - mh < 1 ? 0.55 : 0) + (yy >= mh + ph - 1 ? -0.5 : 0);
      else if (part === 2) {
        if ((s % (pitch / 2)) >= pitch / 4 && yy > mh + ph + 0.5) { p.r[i] = si; p.v[i] = 0.4; p.z[i] = z; return; }
        v = round - 0.25;
      } else {
        const by = yy - (mh + ph + ch);
        const course = Math.floor(by / bh); const ly = by - course * bh;
        const bx = (s + hash(course, 0, seed) * bw) / bw; const k = Math.floor(bx);
        const lx = (bx - k) * bw * cs;
        v = round + (hash(k, course, seed) - 0.5) * 0.9;
        if (ly < 1 || lx < 1) v = round - 1.1;
        else if (ly < 2) v += 0.4;
        else if (hash(x, y, seed + 3) < 0.05) v -= 0.6;
        if (fl > 0 && fl < 0.18) v += 0.8; // the foot's sloped top catches the light
        if (o.glow) v += o.glow[1] * cs * cs * Math.max(0, 1 - Math.abs(y + 0.5 - o.glow[0]) / o.glow[2]);
      }
      p.r[i] = ri; p.v[i] = v; p.z[i] = z;
    });
  }

  /** An arrow slit: a dark cross in the stone, its sill catching the light. */
  function slit(p, x, y, h, z) {
    x = Math.round(x); y = Math.round(y); h = Math.max(4, Math.round(h));
    p.fill(C.rect(x, y, 1, h), 'shadow', 0, z);
    p.fill(C.rect(x - 1, y + Math.round(h * 0.38), 3, 1), 'shadow', 0, z);
    p.fill(C.rect(x - 1, y + h, 3, 1), 'stone', 3.4, z);
  }

  function sootOn(p, x, y, u, z) {
    p.shade(C.ellipse(x, y - 10 * u, 3.5 * u, 8 * u), (px) => -1.1 * (1 - Math.abs(px - x) / (4 * u)), z);
  }

  /**
   * A torch burning in an iron cage on a bracket: the basket is drawn over
   * the flame in over(), black bars against the fire.
   */
  function cage(p, x, y, u, z, flick, phase, k = 1) {
    sootOn(p, x, y, u, z);
    p.fill(C.rect(x, y + 1, 1, Math.max(2, 3 * u)), 'iron', 1.4, z + 1);
    p.fill(C.rect(x - 1, y + 1 + Math.max(2, 3 * u), 3, 1), 'iron', 0.8, z + 1);
    p.light(x, y - 3, 34 * u * k, 5.4, flick ? flicker(phase, 0.2) : null, { zMin: 1, hard: true });
    p.light(x, y - 3, 66 * u * k, 1.3, null, { zMin: 1 });
  }
  function cageOver(img, x, y, frame) {
    sprite(img, x, y, SPRITES.flame[frame % 3], FLAME);
    sprite(img, x, y + 1, CAGE_ROWS, CAGE);
  }

  /**
   * A subject lit from the front by the torches either side of it: a
   * one-pixel warm rim down both its sides and along every upward edge
   * (horns, shoulders, claws), brightest high up, level with the torches.
   */
  function torchRim(p, z, top, bottom) {
    const vi = p.ri('void'); const w = p.w;
    const body = (j) => p.z[j] === z || p.z[j] === z + 1;
    const hit = [];
    for (let y = 1; y < p.h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x;
        if (p.z[i] !== z) continue;
        const up = !body(i - w);
        if (up || !body(i - 1) || !body(i + 1)) hit.push([i, y, up]);
      }
    }
    for (const [i, y, up] of hit) { p.r[i] = vi; p.v[i] = 7.2 - clamp((y - top) / (bottom - top), 0, 1) * 2 + (up ? 0.4 : 0); }
  }

  /** A chain from (x0, y0) to (x1, y1): links of iron, alternately face-on and edge-on. */
  function chainTo(p, x0, y0, x1, y1, z = 5, v = 2.4) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
    for (let k = 0; k < n; k += 1) {
      const x = Math.round(lerp(x0, x1, k / n)); const y = Math.round(lerp(y0, y1, k / n));
      if (k % 2) p.fill(C.rect(x, y, 1, 3), 'iron', v - 0.5, z);
      else { p.fill(C.rect(x - 1, y, 3, 3), 'iron', v, z); p.fill(C.rect(x, y + 1, 1, 1), 'shadow', 0, z); }
    }
  }

  /**
   * The drawbridge, down: planks running toward the gate, so their seams
   * lead the eye into it, iron straps across, darker at its sides.
   */
  function bridge(p, gx, y0, hw0, y1, hw1, o) {
    const { u, z = 1, n = 6, v = 1.8, seed = 4, straps = [], fade = 0 } = o;
    const vy = y0 - ((y1 - y0) * hw0) / (hw1 - hw0); const d0 = y0 - vy;
    const wi = p.ri('wood'); const ii = p.ri('iron');
    p.each(C.poly([[gx - hw0, y0], [gx + hw0, y0], [gx + hw1, y1], [gx - hw1, y1]]), (x, y, i) => {
      const d = y + 0.5 - vy; const hw = (hw0 * d) / d0;
      const c = (((x + 0.5 - gx) / hw + 1) / 2) * n; const k = Math.floor(c);
      const px = ((c - k) * 2 * hw) / n;
      const t = (y - y0) / (y1 - y0);
      const strap = straps.some((sy) => Math.abs(y + 0.5 - sy) < 0.6 + t * 0.9);
      p.z[i] = z;
      if (strap) { const pw = (2 * hw) / n; p.r[i] = ii; p.v[i] = 1.8 - t * fade * 0.6 + (Math.abs(px - pw / 2) < 0.75 ? 1.3 : px < 1 ? -0.6 : 0); return; }
      p.r[i] = wi;
      let val = v - t * fade + (hash(k, Math.floor(Math.log(d / d0) * 5 + hash(k, 1, seed) * 2), seed) - 0.5) * 0.8 - Math.abs(c / n - 0.5) * 1.2;
      if (px < 1 || k < 0 || k >= n) val -= 1.4;
      else if (px < 2) val += 0.35;
      p.v[i] = val;
    });
  }

  /** The crag the walls stand on, its foot lost in the chasm. */
  function crag(p, x0, x1, top, depth, u, seed) {
    const shape = C.rect(x0, top, x1 - x0, depth + 8 * u);
    p.fill(shape, 'rock', (x, y) => {
      const foot = top + depth + (vnoise(x / (5 * u), 0.5, seed) - 0.5) * 9 * u;
      if (y > foot) return null;
      return 3.2 - ((y - top) / depth) * 2.8;
    }, 1);
    p.cells(shape, { size: 5 * u, sy: 0.7, joint: 0.8, jointV: -1.1, vary: 0.9, bevel: 0.7, lit: [0, -1], seed, z: 1 });
  }

  /** The chasm: cold black, a few wisps of mist hanging in it. */
  function chasmFill(p, shape, u, seed, k = 1) {
    p.fill(shape, 'chasm', (x, y) => {
      const w = vnoise(x / (22 * u), y / (2.2 * u), seed);
      return 0.6 + (w > 0.62 ? (w - 0.62) * 9 * k : 0);
    }, 0);
  }

  const C3 = {
    job: 1, setting: 'dungeon', key: 'C', id: 'dungeon-c', side: 'outside',
    // Set aside 2026-10-11: the author keeps this setting inside only.
    dropped: true,
    name: 'Dungeon', title: 'The approach',
    pitch: 'The same gate, from outside, at night. A drawbridge crosses a black chasm to the gatehouse; torches burn in iron cages on its round towers, the portcullis is down, and a thin moon hangs over the battlements.',
    notes: [
      ['Light', 'Two caged torches light the towers in tall warm strips and catch the portcullis’ iron. Above, a cold glow behind the skyline turns the battlements black, and a crescent moon silvers the cloud near it. On a face-down card the gate stays black: light pouring out of it belongs to the Clear Path.'],
      ['Detail', 'The inside’s laid stone and wedge-stoned arch, round towers with corbels and machicolations, the keep’s towers dark behind the walls, the drawbridge’s planks and iron straps, its chains running up into the wall.'],
      ['Vista', 'The curtain wall runs the width of the board along its crag, a torch in each tower’s pool. The card meets you at the gate: the monster on the bridge, the portcullis slamming down for an Obstacle, the gate thrown open and light pouring down the bridge for a Clear Path.'],
      ['World', 'The causeway’s worn flagstones under the table, the chasm black at its sides, braziers on its parapet, the gate’s torchlight from the top, embers blowing out over the drop.'],
    ],
    palette: ['#030406', '#252A31', '#51555B', '#F0EFE9', '#2A201B', '#835F45', '#19191E', '#583A22', '#F2BE63'],

    back(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['void', 'moon'] });
      const u = H / 134; const gx = W / 2;
      const floor = Math.round(100 * u);
      const tw = 11 * u; const tlx = 11 * u; const trx = W - 11 * u; // the round towers' radius and centres
      nightSky(p, W, 64 * u, {
        u, mx: 77 * u, my: 12 * u, mr: 5.5 * u, seed: 4, sky: 38 * u, halo: 48 * u,
        clouds: [[76 * u, 20 * u, 27 * u, 4.5 * u], [16 * u, 9 * u, 24 * u, 3 * u], [42 * u, 30 * u, 24 * u, 3.5 * u], [66 * u, 28 * u, 11 * u, 2 * u]],
      });
      farTower(p, 35 * u, 15 * u, 21 * u, 40 * u, u);
      chasmFill(p, C.rect(0, floor - 4 * u, W, H - floor + 4 * u), u, 3, 1.6);
      crag(p, 0, W, floor - 2 * u, 18 * u, u, 6);
      // The gatehouse wall between its towers, in their shadow at its sides.
      const wall = C.rect(16 * u, 46 * u, 64 * u, floor + 2 * u - 46 * u);
      p.fill(wall, 'stone', 1.0, 1);
      p.masonry(wall, { bw: 6 * u, bh: 4 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 1.0, chip: 0.05, seed: 31, z: 1 });
      battlements(p, 16 * u, 80 * u, 36 * u, { u, z: 1, v: 1.2, ox: gx + 2 * u });
      const nearTower = (x) => Math.min(Math.abs(x + 0.5 - tlx), Math.abs(x + 0.5 - trx)) - tw;
      p.shade(null, (x) => -1.8 * clamp(1 - nearTower(x) / (5 * u), 0, 1), 1);
      bridge(p, gx, floor, 13 * u, H, 27 * u, { u, n: 6, v: 3.0, fade: 1.8, straps: [floor + 9 * u, floor + 24 * u] });
      gate(p, W, H, { u, gx, hw: 13 * u, top: 60 * u, floor, port: Math.round(93 * u), dark: true });
      drum(p, { cx: tlx, r: tw, top: 20 * u, bottom: floor + 6 * u, u, seed: 3, plinth: 8 * u, glow: [74 * u, 2.2, 28 * u] });
      drum(p, { cx: trx, r: tw, top: 20 * u, bottom: floor + 6 * u, u, seed: 4, plinth: 8 * u, glow: [74 * u, 2.2, 28 * u] });
      slit(p, tlx, 49 * u, 7 * u, 6); slit(p, trx, 49 * u, 7 * u, 6);
      nightFall(p, 54 * u, 16 * u, 1.4, [1, 5]);
      const tl = Math.round(tlx); const tr = Math.round(trx); const ty = Math.round(74 * u);
      cage(p, tl, ty, u, 5, false, 0, 1.2); cage(p, tr, ty, u, 5, false, 0, 1.2);
      p.backlit(1, 'sky', 7.4, 'sky', 7.8);
      p.backlit(5, 'sky', 7.4, 'sky', 7.8);
      vignette(p, W, H, 2.0);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img) {
          cageOver(img, tl, ty, 0);
          cageOver(img, tr, ty, 1);
        },
      };
    },

    vista(W, H, cat) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['void', 'moon'] });
      const u = H / 100;
      const gx = W / 2; const floor = Math.round(84 * u);
      const ramp = catRamp(cat);
      nightSky(p, W, 70 * u, {
        u, mx: gx + 74 * u, my: 10 * u, mr: 5.5 * u, seed: 7, sky: 28 * u,
        clouds: [[84, 22, 40, 4.5], [-40, 8, 50, 3], [-120, 21, 46, 3.5], [160, 22, 40, 3], [-232, 11, 44, 3], [262, 9, 52, 3]].map(([x, y, l, t]) => [gx + x * u, y * u, l * u, t * u]),
      });
      for (const [dx, w, top] of [[-68, 15, 7], [57, 11, 12], [-178, 13, 10], [186, 16, 6]]) farTower(p, gx + dx * u, w * u, top * u, 30 * u, u);
      chasmFill(p, C.rect(0, 80 * u, W, H - 80 * u), u, 5, 1.8);
      crag(p, 0, W, 78 * u, 16 * u, u, 9);
      // The curtain wall along the crag, a square tower at a steady pitch.
      const cw = C.rect(0, 35 * u, W, 47 * u);
      p.fill(cw, 'stone', 1.0, 1);
      p.masonry(cw, { bw: 7 * u, bh: 5 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 1.0, chip: 0.05, seed: 41, z: 1 });
      battlements(p, 0, W, 26 * u, { u, z: 1, v: 1.1, ch: 0, ox: gx });
      const towers = [];
      for (let d = 104 * u; gx + d < W + 20 * u; d += 112 * u) towers.push(gx - d, gx + d);
      // Each tower stands out from the curtain: the wall beside it is in its shadow.
      p.shade(null, (px) => {
        let k = 0;
        for (const x of towers) k = Math.max(k, clamp(1 - (Math.abs(px + 0.5 - x) - 10 * u) / (6 * u), 0, 1));
        return -1.2 * k;
      }, 1);
      for (const x of towers) {
        const t = C.rect(x - 10 * u, 22 * u, 20 * u, 60 * u);
        p.fill(t, 'stone', 1.2, 2);
        p.masonry(t, { bw: 6 * u, bh: 5 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 1.0, chip: 0.05, seed: 43, z: 2 });
        p.shade(t, (px) => (px < x - 8 * u ? 0.5 : px > x + 7 * u ? -0.6 : 0), 2);
        battlements(p, x - 11.5 * u, x + 11.5 * u, 10 * u, { u, z: 2, v: 1.3, ox: x - 11.5 * u });
        slit(p, x, 40 * u, 8 * u, 3);
      }
      // The gatehouse: its wall, the gate, its two round towers.
      const gw = C.rect(gx - 30 * u, 26 * u, 60 * u, floor + 2 * u - 26 * u);
      p.fill(gw, 'stone', 1.0, 1);
      p.masonry(gw, { bw: 7 * u, bh: 5 * u, joint: -1.1, top: 0.45, left: 0.3, vary: 1.0, chip: 0.05, seed: 45, z: 1 });
      battlements(p, gx - 30 * u, gx + 30 * u, 13 * u, { u, z: 1, v: 1.2, ox: gx + 2 * u });
      const g = { u, gx, hw: 17 * u, top: 38 * u, floor, flick: true };
      if (cat === 'obstacle') { g.port = floor - 1; g.portRamp = ramp; g.bright = 0.55; }
      else if (cat === 'clear-path') { g.bright = 1.25; }
      else { g.port = Math.round(44 * u); g.bright = cat === 'monster' ? 0.45 : 0.6; }
      bridge(p, gx, floor, 17 * u, H + 1, 25 * u, { u, n: 7, straps: [floor + 8 * u] });
      gate(p, W, H, g);
      // The gate's light, out along the bridge's planks.
      p.light(gx, floor, 30 * u, 3.4 * g.bright, flicker(1.3, 0.06, 0.5), { zMin: 1, zMax: 1, sx: 0.75 });
      for (const s of [-1, 1]) drum(p, { cx: gx + s * 37 * u, r: 13 * u, top: 3 * u, bottom: 90 * u, u, seed: 5 + s, bw: 6 * u, bh: 5 * u, plinth: 8 * u, glow: [58 * u, 2, 26 * u] });
      for (const s of [-1, 1]) slit(p, gx + s * 37 * u, 30 * u, 8 * u, 6);
      nightFall(p, 50 * u, 8 * u, 1.2, [1, 2, 5]);
      // The card, at the gate.
      const hex = PX.CARD[ramp][3];
      if (cat === 'wanderer') {
        SUBJECT.wanderer(p, gx - 3 * u, floor + 3 * u, 32 * u, ramp, 3, false);
        p.shade(C.rect(gx - 20 * u, floor - 36 * u, 40 * u, 40 * u), -0.9, 3);
        p.backlit(3, 'void', 1.6, 'void', 5.6);
        const lx = gx - 3 * u + 32 * u * 0.3; const ly = floor + 3 * u - 32 * u * 0.6;
        p.fill(C.rect(lx - 1.5, ly, 4, 4), ramp, 4, 6);
        p.tint(lx, ly, 24 * u, hex, 0.55, flicker(0.9, 0.15));
      } else if (cat === 'item') {
        chest(p, gx, floor + 9 * u, 30 * u, ramp, 6);
        p.backlit(6, 'void', 1.6, 'void', 5.6);
        p.tint(gx, floor - 8 * u, 30 * u, hex, 0.5, flicker(2, 0.15, 0.7));
      } else if (cat === 'obstacle') {
        p.fill(C.rect(gx - 3 * u, floor - 30 * u, 6 * u, 6 * u), ramp, 3.6, 6);
        p.tint(gx, floor - 26 * u, 26 * u, hex, 0.3, flicker(0.5, 0.12, 0.6));
      }
      // The drawbridge's chains, up into the wall over the gate.
      for (const s of [-1, 1]) chainTo(p, Math.round(gx + s * 21 * u), Math.round(31 * u), Math.round(gx + s * 26 * u), H, 5, 2.0);
      if (cat === 'monster') {
        // A step out of the dark gate onto the bridge's first planks, in front of the arch and its chains,
        // lit from the front by the caged torches either side.
        const ms = 38 * u; const fy = floor + 7 * u;
        SUBJECT.monster(p, gx, fy, ms, ramp, 8);
        torchRim(p, 8, fy - ms * 1.2, fy);
        p.tint(gx, fy - ms * 0.9, 7 * u, hex, 0.4, flicker(0.3, 0.3, 1.4));
      }
      // Torches: one caged on each round tower, one in each of the curtain's pools.
      const torches = [[gx - 37 * u, 58 * u], [gx + 37 * u, 58 * u]];
      for (let d = 76 * u; gx + d < W + 16 * u; d += 112 * u) torches.push([gx - d - 28 * u, 56 * u], [gx + d + 28 * u, 56 * u]);
      torches.forEach(([x, y], i) => cage(p, Math.round(x), Math.round(y), u, i < 2 ? 6 : 1, true, i * 1.7, 1.12));
      p.backlit(1, 'sky', 7.4, 'sky', 7.8);
      p.backlit(2, 'sky', 7.4, 'sky', 7.8);
      p.backlit(5, 'sky', 7.4, 'sky', 7.8);
      vignette(p, W, H, 1.8, 0.45);
      p.rim(0, -1, 0.5, 3);
      return {
        p,
        over(img, t) {
          torches.forEach(([x, y], i) => cageOver(img, Math.round(x), Math.round(y), Math.floor(t * 8 + i)));
          for (const q of particles('ember', Math.round(W / 18), [0, 20 * u, W, floor - 20 * u], t, 13)) put(img, q.x, q.y, q.big ? '#F2BE63' : '#AA6A25', q.a * 0.9);
        },
      };
    },

    world(W, H) {
      const p = new Painter(W, H, RAMPS_C, { emit: ['void'] });
      const u = H / 250; const cx = W / 2;
      // The causeway runs up to the gate; its edges and its joints meet at one point far above.
      const vy = -408 * u; const k = 0.352;
      const half = (y) => k * (y - vy);
      // The chasm: black, with moonlit mist hanging in it, palest near the top.
      p.fill(C.rect(0, 0, W, H), 'chasm', (x, y) => {
        const w = vnoise(x / (26 * u), y / (3 * u), 8) * 0.7 + vnoise(x / (9 * u), y / (1.6 * u), 9) * 0.3;
        return 0.5 + (w > 0.55 ? (w - 0.55) * 14 * (1 - y / H) : 0);
      }, 0);
      const road = C.poly([[cx - half(0), 0], [cx + half(0), 0], [cx + half(H), H], [cx - half(H), H]]);
      p.fill(road, 'floor', 1.2, 1);
      p.floor(road, { vx: cx, vy, rows: 12, size: 1.25, d0: 408 * u, joint: -1.1, top: 0.45, left: 0.25, vary: 0.9, chip: 0.06, seed: 19, z: 1 });
      // Worn smooth down the middle, where the traffic goes; cracked in places.
      p.shade(road, (x, y) => 0.35 * Math.max(0, 1 - Math.abs(x - cx) / (half(y) * 0.45)), 1);
      p.shade(road, (x, y) => (vnoise(x / (40 * u), y / (40 * u), 61) > 0.58 && Math.abs(vnoise(x / (7 * u), y / (7 * u), 62) - 0.5) < 0.022 ? -0.9 : 0), 1);
      for (const s of [-1, 1]) {
        const at = (y, d) => cx + s * (half(y) + d * u);
        // The causeway's side, dropping into the dark.
        const face = C.poly([[at(0, 0), 0], [at(0, 10), 0], [at(H, 10), H], [at(H, 0), H]]);
        p.fill(face, 'stone', (x, y) => 1.6 - Math.abs(x - at(y, 0)) / (10 * u) * 2.2, 1);
        p.masonry(face, { bw: 9 * u, bh: 5 * u, joint: -0.9, top: 0.2, vary: 0.6, seed: 23 + s, z: 1 });
        // The parapet along its edge: a lit coping, its inner face a step darker.
        const par = C.poly([[at(0, -7), 0], [at(0, 0), 0], [at(H, 0), H], [at(H, -7), H]]);
        p.fill(par, 'stone', (x, y) => { const d = Math.abs(x + 0.5 - at(y, 0)) / u; return d > 5.2 ? 1.0 : 2.3 + (d > 4.2 ? 0.5 : 0); }, 3);
        p.masonry(par, { bw: 40 * u, bh: 14 * u, joint: -1.2, top: 0.5, vary: 0.6, seed: 27 + s, z: 3 });
      }
      // The gate's torchlight down the causeway from the top.
      p.light(cx, -20 * u, 190 * u, 3.0, flicker(0.7, 0.07, 0.5), { sx: 1.7, zMin: 1 });
      // A brazier on the parapet each side, beside the table.
      const by = Math.round(H * 0.47);
      const braz = [-1, 1].map((s) => Math.round(cx + s * (half(by * 1) - 3 * u)));
      for (const [i, x] of braz.entries()) {
        // A brazier: a broad iron bowl on a post, its foot on the coping.
        p.fill(C.rect(x, by + 4, 1, 7 * u), 'iron', 0.9, 4);
        p.fill(C.rect(x - 2, by + 4 + 7 * u, 5, 1), 'iron', 0.6, 4);
        p.shade(C.ellipse(x + 0.5, by + 5 + 7 * u, 8 * u, 2 * u), -0.9, 3);
        p.light(x, by - 3, 30 * u, 4.4, flicker(i * 2.1, 0.22), { zMin: 1, hard: true, sx: 0.65 });
        p.light(x, by - 3, 56 * u, 0.9, null, { zMin: 1, sx: 0.7 });
      }
      p.shade(null, (x, y) => -2.2 * Math.max(0, y / H - 0.4));
      return {
        p,
        over(img, t) {
          braz.forEach((x, i) => { sprite(img, x, by + 1, BIG_FLAME_ROWS[Math.floor(t * 8 + i) % 3], BIG_FLAME); sprite(img, x, by + 4, BOWL_ROWS, BOWL); });
          for (const s of [0, 1]) {
            for (const q of particles('ember', 9, [braz[s] - 10 * u, by - 60 * u, 20 * u, 60 * u], t, 51 + s)) put(img, q.x + (by - q.y) * 0.25 * (s ? 1 : -1), q.y, q.big ? '#D69238' : '#7D4A1B', q.a * 0.9);
          }
          for (const q of particles('ember', 10, [0, 0, W, H * 0.3], t, 57)) put(img, q.x, q.y, '#7D4A1B', q.a * 0.7);
        },
      };
    },
  };


export default [A, B, C3];

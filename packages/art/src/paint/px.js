/* ============================================================
   px.js: a small pixel painter for the art-direction mock-ups.

   A picture is painted into a grid where each pixel holds a ramp (a
   material: stone, sky, wood, a card's colour) and a value along it,
   0 the darkest step. Shapes are filled back to front. Lights add
   value, so a torch walks stone up its ramp; flickering lights are
   kept as fields and weighed per frame. The value is snapped to the
   ramp with a narrow ordered dither: flat areas stay one colour and
   only a light's edge is dithered. Sprites and particles go on top of
   the snapped picture, per frame.
   ============================================================ */
const PX = (() => {
  'use strict';

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /*
   * A salt on every random number a design draws, for a variation of
   * the same picture (vistaOf, a narration line's own take on its card).
   * 0, the default, is the picture as approved, to the byte.
   */
  let SALT = 0;
  function withSalt(salt, fn) {
    const was = SALT;
    SALT = salt | 0;
    try { return fn(); } finally { SALT = was; }
  }

  function rng(seed) {
    let s = typeof seed === 'string'
      ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
      : seed >>> 0;
    if (SALT) s = Math.imul(s ^ SALT, 2654435761) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(x, y, s = 0) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653) + Math.imul(SALT, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ---------- contours: a shape is a list of closed point lists, filled even-odd ---------- */
  const C = {
    rect: (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]],
    poly: (pts) => [pts],
    circle: (cx, cy, r, n = 28) => [Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)])],
    ellipse: (cx, cy, rx, ry, n = 28) => [Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)])],
    /** An arch: straight sides from `bottom` up to the spring, a round top. `pointed` > 0 makes a Gothic arch. */
    arch: (cx, top, hw, bottom, pointed = 0) => {
      const spring = top + hw * (1 + pointed);
      const pts = [[cx - hw, bottom], [cx - hw, spring]];
      const n = 14;
      if (!pointed) {
        for (let i = 1; i < 2 * n; i += 1) {
          const a = Math.PI - (i / (2 * n)) * Math.PI;
          pts.push([cx + hw * Math.cos(a), spring - hw * Math.sin(a)]);
        }
      } else {
        // Two arcs meeting at a point: each centred across the opening from its own side.
        const R = hw * (1 + pointed);
        const apexA = Math.acos((hw - R) / R);
        for (let i = 1; i <= n; i += 1) { const a = Math.PI - (i / n) * (Math.PI - apexA); pts.push([cx - hw + R + R * Math.cos(a), spring - R * Math.sin(a)]); }
        for (let i = n - 1; i >= 1; i -= 1) { const a = Math.PI - (i / n) * (Math.PI - apexA); pts.push([cx + hw - R - R * Math.cos(a), spring - R * Math.sin(a)]); }
      }
      pts.push([cx + hw, spring], [cx + hw, bottom]);
      return [pts];
    },
    join: (...shapes) => shapes.flat(),
  };

  class Painter {
    /**
     * @param ramps {name: [hex, ...]} darkest first
     * @param opts.emit ramp names lights do not touch (flames, glows)
     * @param opts.dither how wide the dithered band between two steps is, 0..1
     */
    constructor(w, h, ramps, opts = {}) {
      this.w = w; this.h = h;
      this.names = Object.keys(ramps);
      this.cols = this.names.map((n) => ramps[n].map(hexRgb));
      this.emit = new Uint8Array(this.names.map((n) => ((opts.emit || []).includes(n) ? 1 : 0)));
      this.dither = opts.dither ?? 0.34;
      const N = w * h;
      this.r = new Uint8Array(N);
      this.v = new Float32Array(N);
      this.z = new Uint8Array(N);
      this.fields = [];
      this.tints = [];
    }

    ri(name) {
      const i = this.names.indexOf(name);
      if (i < 0) throw new Error(`no ramp ${name}`);
      return i;
    }

    /** Every pixel whose centre is inside the contours: fn(x, y, i). */
    each(contours, fn) {
      if (!contours) {
        for (let y = 0; y < this.h; y += 1) for (let x = 0; x < this.w; x += 1) fn(x, y, y * this.w + x);
        return;
      }
      let y0 = Infinity; let y1 = -Infinity;
      for (const c of contours) for (const p of c) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      const r0 = Math.max(0, Math.floor(y0)); const r1 = Math.min(this.h - 1, Math.ceil(y1));
      const xs = [];
      for (let cy = r0; cy <= r1; cy += 1) {
        const y = cy + 0.5;
        xs.length = 0;
        for (const c of contours) {
          for (let i = 0, j = c.length - 1; i < c.length; j = i, i += 1) {
            const yi = c[i][1]; const yj = c[j][1];
            if ((yi > y) !== (yj > y)) xs.push(c[i][0] + ((y - yi) * (c[j][0] - c[i][0])) / (yj - yi));
          }
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const a = Math.max(0, Math.ceil(xs[k] - 0.5));
          const b = Math.min(this.w - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
          for (let cx = a; cx <= b; cx += 1) fn(cx, cy, cy * this.w + cx);
        }
      }
    }

    /** Fill a shape with a ramp at a value (a number, or fn(x, y) → number, or null to skip a pixel). */
    fill(contours, ramp, v, z = 0) {
      const ri = this.ri(ramp);
      const fn = typeof v === 'function';
      this.each(contours, (x, y, i) => {
        const val = fn ? v(x, y) : v;
        if (val === null || val === undefined) return;
        this.r[i] = ri; this.v[i] = val; this.z[i] = z;
      });
      return this;
    }

    /** Add to the value inside a shape (or everywhere), optionally only on one layer. */
    shade(contours, dv, onlyZ) {
      const fn = typeof dv === 'function';
      this.each(contours, (x, y, i) => {
        if (onlyZ !== undefined && this.z[i] !== onlyZ) return;
        this.v[i] += fn ? dv(x, y, i) : dv;
      });
      return this;
    }

    /** A vertical run of the whole width: the sky, a wall. */
    band(y0, y1, ramp, v0, v1, z = 0) {
      return this.fill(C.rect(0, y0, this.w, y1 - y0), ramp, (x, y) => lerp(v0, v1, (y - y0) / Math.max(1, y1 - y0)), z);
    }

    /**
     * Blocks of stone or brick inside a shape: a darker joint, each block a
     * little lighter or darker than the next, its top edge catching light.
     */
    masonry(contours, o) {
      const bw = o.bw; const bh = o.bh;
      const ox = o.ox || 0; const oy = o.oy || 0;
      // Each course its own run of block widths, so the wall is laid, not tiled.
      const rows = new Map();
      const course = (ry) => {
        if (rows.has(ry)) return rows.get(ry);
        const r = rng((o.seed || 1) * 7919 + ry * 104729);
        const edges = [];
        let x = Math.round(-bw * (0.3 + r() * 0.7) + ox);
        while (x < this.w + bw) { edges.push(x); x += Math.max(3, Math.round(bw * (o.irregular === false ? 1 : 0.6 + r() * 0.8))); }
        edges.push(x);
        rows.set(ry, edges);
        return edges;
      };
      this.each(contours, (x, y, i) => {
        if (o.z !== undefined && this.z[i] !== o.z) return;
        const ry = Math.floor((y - oy) / bh);
        const edges = course(ry);
        let k = 0;
        while (k + 1 < edges.length && edges[k + 1] <= x) k += 1;
        const lx = x - Math.floor(edges[k]); const ly = y - oy - ry * bh;
        let dv = (hash(k, ry, o.seed || 1) - 0.5) * (o.vary ?? 0.8);
        if (ly < 1 || lx < 1) dv = o.joint ?? -1.2;
        else if (ly < 2 && o.top) dv += o.top;
        else if (ly >= bh - 1 && o.bottom) dv += o.bottom;
        else if (lx < 2 && o.left) dv += o.left;
        else if (o.chip && hash(x, y, (o.seed || 1) + 3) < o.chip) dv -= 0.7;
        this.v[i] += dv;
      });
      return this;
    }

    /**
     * Natural slabs, rocks or cobbles: the nearest of a jittered grid of
     * points decides the stone; where two are nearly as near, a joint. Each
     * stone is lit a little on the side toward `lit` (dx, dy).
     */
    cells(contours, o) {
      const s = o.size; const seed = o.seed || 5;
      const sx = o.sx || 1; const sy = o.sy || 1;
      const lit = o.lit || [-0.6, -0.8];
      this.each(contours, (x, y, i) => {
        if (o.z !== undefined && this.z[i] !== o.z) return;
        const fx = x / (s * sx); const fy = y / (s * sy);
        const gx = Math.floor(fx); const gy = Math.floor(fy);
        let d1 = 1e9; let d2 = 1e9; let best = 0; let bx = 0; let by = 0;
        for (let j = -1; j <= 1; j += 1) {
          for (let k = -1; k <= 1; k += 1) {
            const cx = gx + k; const cy = gy + j;
            const px = cx + 0.15 + hash(cx, cy, seed) * 0.7; const py = cy + 0.15 + hash(cx, cy, seed + 1) * 0.7;
            const d = Math.hypot((fx - px) * s * sx, (fy - py) * s * sy);
            if (d < d1) { d2 = d1; d1 = d; best = cx * 7349 + cy; bx = (fx - px) * s * sx; by = (fy - py) * s * sy; } else if (d < d2) d2 = d;
          }
        }
        let dv;
        if (d2 - d1 < (o.joint ?? 1.1)) dv = o.jointV ?? -1.3;
        else {
          dv = (hash(best, 0, seed + 2) - 0.5) * (o.vary ?? 0.8);
          const len = Math.hypot(bx, by) || 1;
          dv += ((-bx * lit[0] - by * lit[1]) / len) * (o.bevel ?? 0.45) * Math.min(1, len / (s * 0.45));
        }
        this.v[i] += dv;
      });
      return this;
    }

    /**
     * Flagstones on a floor seen in perspective: rows widen toward the viewer
     * and the joints run to a vanishing point at (vx, vy), above the shape.
     * `size` is a stone's width in rows' units (about square at 1).
     */
    floor(contours, o) {
      const vx = o.vx; const vy = o.vy; const k = o.rows || 3; const cw = (o.size || 1) * k;
      const d0 = o.d0 || 10; const seed = o.seed || 4;
      this.each(contours, (x, y, i) => {
        if (o.z !== undefined && this.z[i] !== o.z) return;
        const d = y + 0.5 - vy;
        if (d <= 0) return;
        const rowF = Math.log(d / d0) * k; const row = Math.floor(rowF);
        const colF = ((x + 0.5 - vx) / d) * cw + (row % 2 ? 0.5 : 0) + (hash(row, 0, seed) - 0.5) * 0.6;
        const col = Math.floor(colF);
        const rowPx = d / k; const colPx = d / cw; // a stone's size in pixels here
        const fy = (rowF - row) * rowPx; const fx = (colF - col) * colPx;
        let dv;
        if (fy < 1 || fx < 1) dv = o.joint ?? -1.2;
        else {
          dv = (hash(col, row, seed + 1) - 0.5) * (o.vary ?? 0.8);
          if (fy < 2) dv += o.top ?? 0.45;
          else if (fx < 2) dv += o.left ?? 0.25;
          else if (o.chip && hash(x, y, seed + 2) < o.chip) dv -= 0.6;
        }
        this.v[i] += dv;
      });
      return this;
    }

    /** Fill with a radial ramp of values: `vIn` at the centre, `vOut` at radius r and beyond. */
    glow(contours, ramp, cx, cy, r, vIn, vOut, z = 0, o = {}) {
      const sx = o.sx || 1; const sy = o.sy || 1;
      return this.fill(contours, ramp, (x, y) => {
        const d = Math.min(1, Math.hypot((x + 0.5 - cx) / sx, (y + 0.5 - cy) / sy) / r);
        return lerp(vIn, vOut, o.linear ? d : Math.sqrt(d));
      }, z);
    }

    /** Blocky variation, so a large flat area is not dead. */
    grain(contours, amp, cell = 3, seed = 7, onlyZ) {
      this.each(contours, (x, y, i) => {
        if (onlyZ !== undefined && this.z[i] !== onlyZ) return;
        this.v[i] += (hash(Math.floor(x / cell), Math.floor(y / cell), seed) - 0.5) * amp;
      });
      return this;
    }

    /**
     * A light: value added to everything near it, falling off as the square
     * of the distance's complement. With `k(t)` it is kept and weighed every
     * frame (a flicker); without, it is painted in now.
     */
    light(x, y, r, s, k = null, o = {}) {
      const f = new Float32Array(this.w * this.h);
      const x0 = Math.max(0, Math.floor(x - r)); const x1 = Math.min(this.w - 1, Math.ceil(x + r));
      const y0 = Math.max(0, Math.floor(y - r)); const y1 = Math.min(this.h - 1, Math.ceil(y + r));
      const sx = o.sx || 1; const sy = o.sy || 1;
      for (let py = y0; py <= y1; py += 1) {
        for (let px = x0; px <= x1; px += 1) {
          const i = py * this.w + px;
          if (this.emit[this.r[i]]) continue;
          if (o.zMin !== undefined && this.z[i] < o.zMin) continue;
          if (o.zMax !== undefined && this.z[i] > o.zMax) continue;
          const d = Math.hypot((px + 0.5 - x) / sx, (py + 0.5 - y) / sy) / r;
          if (d >= 1) continue;
          const t = 1 - d;
          f[i] = s * (o.hard ? t : t * t);
        }
      }
      if (k) this.fields.push({ f, k });
      else for (let i = 0; i < f.length; i += 1) this.v[i] += f[i];
      return this;
    }

    /** A silhouette backlit: its pixels on layer z that touch something bright become a rim. */
    backlit(z, brightRamp, minV, toRamp, v) {
      const br = this.ri(brightRamp); const to = this.ri(toRamp);
      const hit = [];
      for (let y = 1; y < this.h - 1; y += 1) {
        for (let x = 1; x < this.w - 1; x += 1) {
          const i = y * this.w + x;
          if (this.z[i] !== z) continue;
          for (const j of [i - 1, i + 1, i - this.w, i + this.w]) {
            if (this.r[j] === br && this.z[j] !== z && this.v[j] >= minV) { hit.push(i); break; }
          }
        }
      }
      for (const i of hit) { this.r[i] = to; this.v[i] = v; }
      return this;
    }

    /** Edges that face a light: a pixel on layer >= zMin whose neighbour toward the light is farther. */
    rim(dx, dy, amount, zMin = 1) {
      const add = new Float32Array(this.w * this.h);
      for (let y = 0; y < this.h; y += 1) {
        for (let x = 0; x < this.w; x += 1) {
          const i = y * this.w + x;
          if (this.z[i] < zMin || this.emit[this.r[i]]) continue;
          const nx = x + dx; const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          if (this.z[ny * this.w + nx] < this.z[i]) add[i] = amount;
        }
      }
      for (let i = 0; i < add.length; i += 1) this.v[i] += add[i];
      return this;
    }

    /**
     * Coloured light: a card's colour glowing on whatever is near it. Ramps
     * cannot change hue, so this is blended over the snapped colour in a few
     * dithered steps, never smoothly.
     */
    tint(x, y, r, hex, max = 0.5, k = null) {
      const f = new Float32Array(this.w * this.h);
      for (let py = Math.max(0, Math.floor(y - r)); py <= Math.min(this.h - 1, Math.ceil(y + r)); py += 1) {
        for (let px = Math.max(0, Math.floor(x - r)); px <= Math.min(this.w - 1, Math.ceil(x + r)); px += 1) {
          const d = Math.hypot(px + 0.5 - x, py + 0.5 - y) / r;
          if (d < 1) f[py * this.w + px] = max * (1 - d) * (1 - d);
        }
      }
      this.tints.push({ f, c: hexRgb(hex), k });
      return this;
    }

    /** The picture at time t, into an ImageData of the painter's size. */
    /**
     * Get ready to resolve many frames: the pixels no light or coloured
     * light reaches are snapped once, and each light keeps the list of
     * pixels it touches. A frame then copies the still pixels and works
     * out only the lit ones, in the same order and arithmetic as
     * resolveReference, so the picture is the same to the byte.
     */
    prepare() {
      const N = this.w * this.h;
      const lit = new Uint8Array(N);
      this._fx = this.fields.map((F) => {
        const idx = [];
        for (let i = 0; i < N; i += 1) if (F.f[i] !== 0) { idx.push(i); lit[i] = 1; }
        return Int32Array.from(idx);
      });
      for (const T of this.tints) for (let i = 0; i < N; i += 1) if (T.f[i] > 0) lit[i] = 1;
      const dyn = [];
      for (let i = 0; i < N; i += 1) if (lit[i]) dyn.push(i);
      this._dyn = Int32Array.from(dyn);
      this._acc = new Float64Array(N);
      this._base = new Uint8ClampedArray(N * 4);
      for (let i = 0; i < N; i += 1) if (!lit[i]) this._pixel(i, this.v[i], null, this._base);
      this._prepared = true;
      return this;
    }

    /** Forget what prepare() worked out, after changing the picture. */
    invalidate() { this._prepared = false; return this; }

    /** Snap one pixel at value v (with the coloured lights at strengths tk) into d. */
    _pixel(i, v, tk, d) {
      const x = i % this.w; const y = (i - x) / this.w;
      const D = this.dither;
      const ramp = this.cols[this.r[i]];
      const fl = Math.floor(v); const fr = v - fl;
      const b = BAYER[(y & 3) * 4 + (x & 3)];
      let q = fr < 0.5 - D / 2 ? fl : fr > 0.5 + D / 2 ? fl + 1 : ((fr - 0.5 + D / 2) / D > b ? fl + 1 : fl);
      q = q < 0 ? 0 : q >= ramp.length ? ramp.length - 1 : q;
      let c = ramp[q];
      if (tk) {
        for (let j = 0; j < this.tints.length; j += 1) {
          const a = this.tints[j].f[i] * tk[j];
          if (a <= 0.02) continue;
          const step = Math.floor(a * 5 + b) / 5; // in fifths, dithered
          if (step <= 0) continue;
          const tc = this.tints[j].c;
          c = [lerp(c[0], tc[0], step), lerp(c[1], tc[1], step), lerp(c[2], tc[2], step)];
        }
      }
      const o = i * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }

    /** The picture at time t, into an ImageData of the painter's size. */
    resolve(t, img) {
      if (!this._prepared) this.prepare();
      const d = img.data;
      d.set(this._base);
      const dyn = this._dyn; const acc = this._acc; const v = this.v;
      for (let n = 0; n < dyn.length; n += 1) acc[dyn[n]] = v[dyn[n]];
      for (let j = 0; j < this.fields.length; j += 1) {
        const k = this.fields[j].k(t); const f = this.fields[j].f; const idx = this._fx[j];
        for (let n = 0; n < idx.length; n += 1) { const i = idx[n]; acc[i] += k * f[i]; }
      }
      const tk = this.tints.map((T) => (T.k ? T.k(t) : 1));
      for (let n = 0; n < dyn.length; n += 1) this._pixel(dyn[n], acc[dyn[n]], tk, d);
      return img;
    }

    /** The picture at time t, every pixel worked out: the reference resolve() is tested against. */
    resolveReference(t, img) {
      const d = img.data;
      const ks = this.fields.map((F) => F.k(t));
      const tk = this.tints.map((T) => (T.k ? T.k(t) : 1));
      const D = this.dither;
      for (let y = 0; y < this.h; y += 1) {
        for (let x = 0; x < this.w; x += 1) {
          const i = y * this.w + x;
          let v = this.v[i];
          for (let j = 0; j < ks.length; j += 1) v += ks[j] * this.fields[j].f[i];
          const ramp = this.cols[this.r[i]];
          const fl = Math.floor(v); const fr = v - fl;
          const b = BAYER[(y & 3) * 4 + (x & 3)];
          let q = fr < 0.5 - D / 2 ? fl : fr > 0.5 + D / 2 ? fl + 1 : ((fr - 0.5 + D / 2) / D > b ? fl + 1 : fl);
          q = q < 0 ? 0 : q >= ramp.length ? ramp.length - 1 : q;
          let c = ramp[q];
          for (let j = 0; j < this.tints.length; j += 1) {
            const a = this.tints[j].f[i] * tk[j];
            if (a <= 0.02) continue;
            const step = Math.floor(a * 5 + b) / 5; // in fifths, dithered
            if (step <= 0) continue;
            const tc = this.tints[j].c;
            c = [lerp(c[0], tc[0], step), lerp(c[1], tc[1], step), lerp(c[2], tc[2], step)];
          }
          const o = i * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      return img;
    }
  }

  /* ---------- drawing on the snapped picture ---------- */

  function put(img, x, y, hex, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const c = typeof hex === 'string' ? hexRgb(hex) : hex;
    const o = (y * img.width + x) * 4; const d = img.data;
    d[o] = lerp(d[o], c[0], a); d[o + 1] = lerp(d[o + 1], c[1], a); d[o + 2] = lerp(d[o + 2], c[2], a);
  }

  /** A sprite from rows of characters; map: char → hex; '.' is clear. Anchored at its bottom centre. */
  function sprite(img, x, y, rows, map, flip = false) {
    const h = rows.length; const w = rows[0].length;
    for (let r = 0; r < h; r += 1) {
      for (let c = 0; c < w; c += 1) {
        const ch = rows[r][flip ? w - 1 - c : c];
        if (ch === '.' || ch === ' ') continue;
        put(img, x - (w >> 1) + c, y - h + r, map[ch]);
      }
    }
  }

  /* Small sprites the settings share. */
  const SPRITES = {
    flame: [
      ['..a..', '.aba.', '.bcb.', 'abcba', '.bcb.', '..d..'],
      ['.a...', '.ab..', '.bcb.', 'abcba', '.bcb.', '..d..'],
      ['...a.', '..ba.', '.bcb.', 'abcba', '.bcb.', '..d..'],
    ],
    candle: [['.a.', '.b.', '.c.', 'ddd', 'ddd', 'ddd'], ['a..', '.b.', '.c.', 'ddd', 'ddd', 'ddd']],
    rat: [
      ['.....aa.', 'aaaaaaab', '.a..a...', ],
      ['.....aa.', 'aaaaaaab', '..a..a..'],
    ],
    bat: [['a.....a', 'aa.a.aa', '.aaaaa.', '...a...'], ['.......', 'aaaaaaa', '.aaaaa.', '...a...']],
  };

  /* Particles, as positions at time t: deterministic, so a still frame is a real frame. */
  function particles(kind, n, area, t, seed) {
    const r = rng(seed);
    const [ax, ay, aw, ah] = area;
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const bx = r() * aw; const by = r() * ah; const ph = r() * 6.283; const sp = 0.5 + r();
      let x; let y; let a = 1;
      if (kind === 'dust') { x = bx + Math.sin(t * 0.25 * sp + ph) * 4; y = (by - t * 1.2 * sp + ah * 10) % ah; a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.4 + ph)); }
      else if (kind === 'ember') { x = bx + Math.sin(t * 1.1 * sp + ph) * 3; y = (by - t * 6 * sp + ah * 50) % ah; a = clamp(1 - ((ah - y) / ah) * 0.2, 0, 1) * (0.5 + 0.5 * Math.sin(t * 5 + ph)); }
      else if (kind === 'firefly') { x = bx + Math.sin(t * 0.35 * sp + ph) * 6; y = by + Math.cos(t * 0.28 * sp + ph) * 4; a = clamp((Math.sin(t * 1.3 * sp + ph) - 0.2) / 0.8, 0, 1); }
      else if (kind === 'snow') { x = (bx + Math.sin(t * 0.6 + ph) * 3 + t * 2 * sp + aw * 10) % aw; y = (by + t * 7 * sp) % ah; a = 0.6 + 0.4 * (sp - 0.5); }
      else if (kind === 'drip') { const life = (t * 0.45 * sp + ph) % 1.6; if (life > 1) continue; x = bx; y = life * life * ah; a = 1; }
      else if (kind === 'sand') { x = (bx + t * 14 * sp) % aw; y = by + Math.sin(t * 2 + ph) * 1.5; a = 0.6; }
      else if (kind === 'mote') { x = bx + Math.sin(t * 0.3 * sp + ph) * 5; y = (by - t * 2.4 * sp + ah * 20) % ah; a = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.9 + ph)); }
      else { x = bx; y = by; }
      out.push({ x: ax + x, y: ay + y, a, i, big: sp > 1.25 });
    }
    return out;
  }

  /** A slow irregular flicker, 1 on average. */
  const flicker = (phase = 0, depth = 0.25, speed = 1) => (t) =>
    1 + depth * (0.55 * Math.sin(t * 9.1 * speed + phase) * Math.sin(t * 3.7 * speed + phase * 1.7) + 0.45 * Math.sin(t * 1.3 * speed + phase * 0.6));

  /* ---------- the subject a card turns into, painted in its own colour ----------
     Each takes the painter, where it stands (centre x, floor y), its height,
     and the card's ramp name; settings place them in their own doorway. */
  const SUBJECT = {
    /**
     * A hunched thing: broad shoulders, a small horned head, arms hanging
     * past its knees. Black (the 'shadow' ramp, at `body`), its eyes two
     * slits of the card's colour. `s` is its height without the horns.
     */
    monster(p, cx, fy, s, ramp, z = 6, body = 0.2) {
      const P = (pts) => C.poly(pts.map(([x, y]) => [cx + x * s, fy + y * s]));
      p.fill(P([[-0.36, 0], [-0.28, -0.34], [-0.42, -0.6], [-0.3, -0.76], [-0.12, -0.8], [-0.13, -0.93], [-0.05, -1], [0.05, -1], [0.13, -0.93],
        [0.12, -0.8], [0.3, -0.76], [0.42, -0.6], [0.28, -0.34], [0.36, 0], [0.11, 0], [0.05, -0.28], [-0.05, -0.28], [-0.11, 0]]), 'shadow', body, z);
      for (const m of [-1, 1]) {
        p.fill(P([[0.42 * m, -0.6], [0.55 * m, -0.4], [0.6 * m, -0.12], [0.52 * m, -0.1], [0.47 * m, -0.36], [0.34 * m, -0.56]]), 'shadow', body, z);
        p.fill(P([[0.6 * m, -0.12], [0.64 * m, -0.04], [0.57 * m, -0.09], [0.52 * m, -0.03], [0.52 * m, -0.1]]), 'shadow', body, z);
        p.fill(P([[0.11 * m, -0.93], [0.24 * m, -1.06], [0.3 * m, -1.2], [0.19 * m, -1.1], [0.05 * m, -0.99]]), 'shadow', body, z);
      }
      const ey = Math.round(fy - s * 0.9);
      p.fill(C.rect(Math.round(cx - s * 0.075) - 1, ey, 2, 1), ramp, 4, z + 1);
      p.fill(C.rect(Math.round(cx + s * 0.075), ey, 2, 1), ramp, 4, z + 1);
    },
    wanderer(p, cx, fy, s, ramp, z = 6, lantern = true) {
      const w = s * 0.26;
      p.fill(C.poly([[cx - w * 1.3, fy], [cx - w * 0.75, fy - s * 0.72], [cx + w * 0.75, fy - s * 0.72], [cx + w * 1.3, fy]]), ramp, 1.1, z);
      p.fill(C.circle(cx, fy - s * 0.8, w * 0.72), ramp, 1.6, z);
      p.fill(C.rect(cx - w * 0.45, fy - s * 0.82, w * 0.9, w * 0.6), 'shadow', 0, z + 1); // the face in the hood's shadow
      p.fill(C.rect(cx + w * 1.15, fy - s * 0.98, 1, s * 0.98), 'shadow', 1, z); // a staff
      if (lantern) p.fill(C.rect(cx + w * 1.15 - 1.5, fy - s * 0.62, 4, 4), ramp, 3, z + 1);
    },
    item(p, cx, fy, s, ramp, z = 6) {
      const w = s * 0.55;
      p.fill(C.rect(cx - w, fy - s * 0.42, w * 2, s * 0.42), 'wood', 1.4, z);
      p.fill(C.rect(cx - w, fy - s * 0.28, w * 2, 1.2), 'wood', 0.3, z + 1);
      p.fill(C.poly([[cx - w, fy - s * 0.42], [cx - w * 0.9, fy - s * 0.78], [cx + w * 0.9, fy - s * 0.78], [cx + w, fy - s * 0.42]]), 'wood', 2.2, z);
      p.fill(C.rect(cx - w * 0.75, fy - s * 0.52, w * 1.5, s * 0.1), ramp, 3, z + 1);
      p.fill(C.rect(cx - 1, fy - s * 0.36, 2, s * 0.14), ramp, 2.4, z + 1);
    },
  };

  /* ---------- the card back's frame, as the game draws it ---------- */
  function frame(ctx, W, H) {
    const s = W / 250;
    const cx = W / 2; const top = H * 0.17; const half = W * 0.27; const bottom = H * 0.8;
    const arch = (inset = 0) => {
      const p = new Path2D();
      p.moveTo(cx - half + inset, bottom); p.lineTo(cx - half + inset, top + half);
      p.arc(cx, top + half, half - inset, Math.PI, 0); p.lineTo(cx + half - inset, bottom);
      return p;
    };
    const gold = '#D2A04A';
    ctx.strokeStyle = 'rgba(210,160,74,.85)'; ctx.lineWidth = 1.6 * s;
    ctx.strokeRect(W * 0.055, W * 0.055, W - W * 0.11, H - W * 0.11);
    ctx.strokeStyle = 'rgba(210,160,74,.45)'; ctx.lineWidth = 0.8 * s;
    ctx.strokeRect(W * 0.075, W * 0.075, W - W * 0.15, H - W * 0.15);
    ctx.strokeStyle = gold; ctx.lineWidth = 3 * s; ctx.stroke(arch());
    ctx.strokeStyle = 'rgba(210,160,74,.7)'; ctx.lineWidth = 1.4 * s; ctx.stroke(arch(W * 0.03));
    ctx.beginPath(); ctx.moveTo(cx - half - W * 0.07, bottom); ctx.lineTo(cx + half + W * 0.07, bottom);
    ctx.lineWidth = 3 * s; ctx.strokeStyle = gold; ctx.stroke();
  }

  /* The card colours, as the game's palette has them (700, 500, 300, and a light 100). */
  const CARD = {
    path: ['#3D2A0E', '#8A5E1E', '#E3A445', '#F2CB8A', '#FFF1C4'],
    obst: ['#12302A', '#235347', '#43917B', '#7FC0AC', '#C8F0E2'],
    wand: ['#1C2834', '#34495C', '#6B8CA6', '#A6C0D4', '#E3EEF6'],
    item: ['#2A1231', '#4E2359', '#8B4F9C', '#C08FCE', '#EBD3F2'],
    mons: ['#330A10', '#66161F', '#A93343', '#D9707C', '#F4C2C8'],
    // The expansions' families: a Dead End is drawn as an Obstacle in grey, a Trap in its acid green.
    dead: ['#1E1D1B', '#45443F', '#7C7B78', '#B2B1AD', '#E2E1DE'],
    trap: ['#232809', '#4E5718', '#97A63A', '#C7D477', '#EEF3C9'],
  };
  const CATEGORIES = [
    ['monster', 'Monster', 'mons'], ['obstacle', 'Obstacle', 'obst'], ['wanderer', 'Wanderer', 'wand'],
    ['item', 'Item', 'item'], ['clear-path', 'Clear Path', 'path'],
    // Before any card is turned: the place, with nothing in it.
    ['none', 'Nothing yet', 'path'],
  ];

  return { BAYER, hexRgb, clamp, lerp, rng, hash, withSalt, C, Painter, put, sprite, SPRITES, particles, flicker, SUBJECT, frame, CARD, CATEGORIES };
})();
export default PX;

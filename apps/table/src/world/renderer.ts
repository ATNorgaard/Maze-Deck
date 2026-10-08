/* ============================================================
   The world, drawn.

   One WebGL2 canvas behind the table, two programs:

   - the GROUND, a full-screen triangle: the setting's ink, slow fog,
     a pool of its light that breathes, paper grain and a vignette —
     the animated SVG grounds' picture, made of arithmetic instead of
     a 2560 x 1440 SVG re-rasterised every frame;
   - the AIR, one draw of points: dust, motes, sand, drips, snow or
     embers, whatever the setting has. Every particle's path is a
     function of time and four random numbers, worked out in the
     vertex shader, so nothing is uploaded after the first frame.

   The main thread's whole job per frame is to ease a few numbers
   towards the mood and set them as uniforms. No React, no DOM beyond
   the canvas. See docs/overhaul.md, phase 3.
   ============================================================ */

import type { Particle } from '@maze-deck/art';

export type Rgb = readonly [number, number, number];

export interface WorldColors {
  ink900: Rgb;
  ink800: Rgb;
  ink700: Rgb;
  parchment100: Rgb;
  parchment300: Rgb;
  parchment400: Rgb;
  /** The setting's own light (its `light` category), 500 and 300. */
  light: Rgb;
  lightSoft: Rgb;
  /** The Monster red, for the edge of the dark as threat rises. */
  threat: Rgb;
}

/**
 * What the dark brings with it in this setting (docs/overhaul.md, phase
 * 5): shapes at the edge in the setting's own idiom, all of them nothing
 * at no threat and more of them as it rises.
 */
export interface Edge {
  /** Pairs of eyes in the dark: how many at most, how big, how low they keep (0 anywhere, 1 the floor). */
  eyes: { count: number; size: number; low: number; color: Rgb };
  /** How far the dark's edge reaches in, in tendrils rather than a ring. */
  reach: number;
  /** Frost creeping in from the edge instead of the dark. */
  rime: number;
  /** A wall of blown sand closing in. */
  storm: number;
  /** The colour of the rime or the storm. */
  color: Rgb;
  /** The light guttering, like a flame about to go. */
  gutter: number;
}

export const NO_EDGE: Edge = {
  eyes: { count: 0, size: 1, low: 0, color: [0, 0, 0] }, reach: 1, rime: 0, storm: 0, color: [0, 0, 0], gutter: 0,
};

/** What the table wants the world to look like. The renderer eases towards it. */
export interface Mood {
  /** Where the phase is, in 0..1 of the viewport (y down), or null. */
  focus: { x: number; y: number } | null;
  /** 0..1: strikes against the encounter. */
  threat: number;
  /** 0..1: Clear Paths against the target. */
  progress: number;
  /** 0..1: one strike short of being found, the air goes still. */
  hush: number;
  /** The light going out: the run lost. */
  dim: number;
  /** Gold over everything: the party through. */
  bloom: number;
  /** Pointer parallax in CSS px, desktop only. */
  parallax: { x: number; y: number };
}

const KINDS: Record<Particle, number> = { dust: 0, motes: 1, sand: 2, drips: 3, snow: 4, embers: 5 };

const GROUND_VS = `#version 300 es
void main() {
  // One triangle that covers the screen.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const GROUND_FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_ink0, u_ink1, u_ink2, u_parch, u_light, u_threatC, u_flashC;
uniform vec3 u_pool;      // x, y (0..1, y down), radius as a fraction of the longer side
uniform vec2 u_focus;     // 0..1, y down
uniform float u_focusAmt, u_flash, u_threat, u_dim, u_bloom, u_grain, u_fog, u_vignette, u_progress;
uniform vec2 u_par;       // parallax, px
// The setting's idiom for the dark (Edge): eyes = count, size, how low; then
// reach, rime, storm and gutter, and the colours of the eyes and the edge.
uniform vec3 u_eyes;
uniform vec3 u_eyeC, u_edgeC;
uniform float u_reach, u_rime, u_storm, u_gutter;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.y = 1.0 - uv.y;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 par = u_par / u_res.y;

  // The ink, a shade lighter at the top where the light is.
  vec3 col = mix(u_ink1, u_ink0, smoothstep(0.0, 0.9, uv.y));

  // How close the dark is, 0..1. Past 1 (found) only the vignette floods.
  float th = clamp(u_threat, 0.0, 1.0);

  // The light as the dark sees it: cooler and redder with every strike.
  vec3 grey = vec3(dot(u_light, vec3(0.299, 0.587, 0.114)));
  vec3 light = mix(u_light, mix(grey * vec3(0.78, 0.86, 1.0), u_threatC, 0.45), th * 0.8);

  // Fog: two slow layers of noise drifting at different paces. It thins
  // as the party gets on: the way opening up.
  float t = u_time;
  vec2 q = (p + par * 0.6) * 1.4;
  float f1 = fbm(q + vec2(t * 0.011, t * 0.004));
  float f2 = fbm(q * 2.2 - vec2(t * 0.019, -t * 0.005) + 7.3);
  float fog = smoothstep(0.42, 0.95, f1 * 0.7 + f2 * 0.3);
  col = mix(col, u_ink2, fog * u_fog * (1.0 - 0.3 * u_progress));

  // The pool of the setting's light, as the grounds drew it: 0.15 at
  // the centre, 0.045 at 45%, nothing at the rim. It breathes, it widens
  // a little with the ground gained, and where the setting burns flames
  // it gutters as the dark comes.
  vec2 pc = vec2(u_pool.x * aspect, u_pool.y) + par;
  float r = u_pool.z * max(aspect, 1.0) * (1.0 + 0.06 * sin(t * 0.571)) * (1.0 + 0.12 * u_progress);
  float d = length(p - pc) / r;
  float pool = mix(0.15, 0.045, smoothstep(0.0, 0.45, d)) * (1.0 - smoothstep(0.45, 1.0, d));
  pool *= 1.0 + 0.1 * sin(t * 0.898) + 0.6 * u_bloom;
  pool *= 1.0 - u_gutter * th * (0.35 * noise(vec2(t * 6.0, 1.3)) + 0.25 * noise(vec2(t * 15.0, 4.1)));
  col = mix(col, light, pool * (1.0 - u_dim));

  // Where the phase is: a low light leaning there, felt not seen.
  vec2 fc = vec2(u_focus.x * aspect, u_focus.y);
  float fd = length(p - fc);
  col = mix(col, light, u_focusAmt * 0.05 * exp(-fd * fd * 6.0) * (1.0 - u_dim));

  // A card turned: its colour washes out from the river, and goes.
  col = mix(col, u_flashC, u_flash * 0.16 * exp(-fd * fd * 3.0));

  // Grain, fixed to the page like the paper it stands for.
  col = mix(col, u_parch, (hash(floor(gl_FragCoord.xy)) - 0.5) * u_grain);

  // The vignette. Threat draws it in and warms its edge, and it does not
  // close evenly: it reaches in, in tendrils that shift slowly.
  // Everything the dark adds is skipped outright before the first strike:
  // the branches are on uniforms, so every pixel takes the same one.
  vec2 off = uv - 0.5;
  float vd = length(off / 0.7);
  if (th > 0.0) {
    vec2 dir = off / max(length(off), 1e-4);
    float rag = fbm(dir * 2.6 + vec2(vd * 2.0 - t * 0.025, t * 0.011));
    vd += (rag - 0.5) * 0.42 * u_reach * th;
  }
  float inner = max(0.1, 0.45 - 0.26 * u_threat);
  float vig = smoothstep(inner, 1.0, vd) * (u_vignette + 0.42 * u_threat);
  col = mix(col, mix(u_ink0 * 0.55, u_threatC * 0.36, min(1.0, u_threat * 0.7)), clamp(vig, 0.0, 1.0));

  // The setting's own way of closing in. Frost creeping over the edge,
  // crystalline; or a wall of blown sand, streaked and moving.
  float edge = smoothstep(inner, 1.0, vd) * th;
  if (u_rime * th > 0.0) {
    float frost = smoothstep(0.45, 0.8, fbm(uv * vec2(aspect, 1.0) * 16.0 + 3.1));
    col = mix(col, u_edgeC, edge * u_rime * 0.55 * (0.35 + 0.65 * frost));
  }
  if (u_storm * th > 0.0) {
    float sand = fbm(vec2(p.x * 1.6 - t * 0.16, p.y * 10.0));
    col = mix(col, u_edgeC, edge * u_storm * (0.25 + 0.45 * sand));
  }

  // Eyes in the dark: pairs that come and go, and blink, near the edge.
  // More of them as the threat rises; none at all before the first strike.
  float eyeA = 0.0;
  for (int i = 0; i < 12; i++) {
    if (th <= 0.0) break;
    float fi = float(i);
    if (fi >= u_eyes.x) break;
    float h1 = hash(vec2(fi, 3.7)), h2 = hash(vec2(fi, 9.1)), h3 = hash(vec2(fi, 17.3));
    float a = h1 * 6.2831853;
    vec2 ring = vec2(cos(a), sin(a));
    // Out at the sides, where the table is not; u_eyes.z keeps them to the floor.
    ring.x = sign(ring.x) * (0.82 + 0.18 * abs(ring.x));
    ring.y = mix(ring.y, abs(ring.y) * 0.8 + 0.2, u_eyes.z);
    vec2 c = 0.5 + ring * vec2(0.47, 0.44) * (0.86 + 0.12 * h2);
    float shown = smoothstep(0.35, 0.75, 0.5 + 0.5 * sin(t * (0.06 + 0.05 * h3) + h2 * 6.2831853));
    shown *= smoothstep(h3 * 0.5, h3 * 0.5 + 0.25, th);
    float open = step(0.05, fract(t * (0.11 + 0.09 * h1) + h3));
    vec2 dd = (uv - c) * vec2(aspect, 1.0);
    float er = 0.0032 * u_eyes.y;
    float es = 0.0095 * u_eyes.y;
    vec2 e1 = (dd - vec2(es, 0.0)) * vec2(1.0, 1.8);
    vec2 e2 = (dd + vec2(es, 0.0)) * vec2(1.0, 1.8);
    float g = exp(-dot(e1, e1) / (er * er)) + exp(-dot(e2, e2) / (er * er));
    g += 0.18 * exp(-dot(dd, dd) / (er * er * 50.0));
    eyeA += g * shown * open;
  }
  col = mix(col, u_eyeC, clamp(eyeA, 0.0, 1.0) * smoothstep(0.0, 0.25, vig) * (1.0 - u_dim));

  // Through: gold rises over everything. Lost: the light goes out.
  col = mix(col, u_light, u_bloom * 0.22 * exp(-dot(p - pc, p - pc) * 1.2));
  col *= 1.0 - 0.62 * u_dim;

  o = vec4(col, 1.0);
}`;

const AIR_VS = `#version 300 es
precision highp float;
in vec4 a_r;              // four random numbers per particle
uniform float u_time, u_scale;
uniform int u_kind;
uniform vec2 u_res, u_pool, u_par;
out float v_a;
out float v_shape;
out float v_size;
out float v_tint;
const float TAU = 6.2831853;

void main() {
  float t = u_time;
  float x = a_r.x, y = a_r.y, s = a_r.z, w = a_r.w;
  float size = 2.0, alpha = 0.3, shape = 0.0;   // shape: 0 round, 1 falling streak, 2 blown streak

  if (u_kind == 0) {          // dust: hangs, drifts, settles
    x += 0.013 * sin(t * 0.18 * (0.6 + s) + w * TAU);
    y = fract(y + 0.01 * cos(t * 0.15 * (0.6 + s) + w * TAU) + t * 0.0018 * (0.3 + s));
    size = mix(1.2, 3.6, s); alpha = mix(0.10, 0.45, w);
  } else if (u_kind == 1) {   // motes: drawn to the light, and twinkle
    float k = 0.25 + 0.75 * s;
    x = u_pool.x + (x - u_pool.x) * k + 0.010 * sin(t * 0.21 * (0.5 + s) + w * TAU);
    y = u_pool.y + (y - u_pool.y) * k + 0.012 * cos(t * 0.17 * (0.5 + w) + s * TAU);
    size = mix(1.2, 3.6, s); alpha = mix(0.15, 0.55, w) * (0.65 + 0.35 * sin(t * 0.8 + w * TAU));
  } else if (u_kind == 2) {   // sand: blown across
    x = fract(x + t * 0.05 * (0.6 + s));
    y += 0.01 * sin(t * 0.6 + w * TAU);
    size = mix(14.0, 60.0, s); alpha = mix(0.08, 0.25, w); shape = 2.0;
  } else if (u_kind == 3) {   // drips: fall
    y = fract(y + t * 0.07 * (0.7 + s));
    size = mix(8.0, 30.0, s); alpha = mix(0.10, 0.30, w); shape = 1.0;
  } else if (u_kind == 4) {   // snow: falls, and sways as it does
    y = fract(y + t * 0.0117 * (0.6 + s));
    x += 0.011 * sin(t * 0.47 * (0.7 + s) + w * TAU);
    size = mix(2.0, 6.4, s); alpha = mix(0.25, 0.75, w);
  } else {                    // embers: rise
    y = fract(y - t * 0.0136 * (0.6 + s));
    x += 0.007 * sin(t * 0.6 * (0.7 + s) + w * TAU);
    size = mix(1.6, 5.2, s); alpha = mix(0.35, 0.9, w);
  }

  // Nearer particles move further with the pointer.
  vec2 pos = vec2(x, y) + u_par / u_res * (0.4 + s);
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
  gl_PointSize = size * u_scale;
  v_a = alpha; v_shape = shape; v_size = size * u_scale; v_tint = w;
}`;

const AIR_FS = `#version 300 es
precision mediump float;
in float v_a;
in float v_shape;
in float v_size;
in float v_tint;
uniform vec3 u_c0, u_c1;
uniform float u_fade;
out vec4 o;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float a;
  float line = 1.2 / max(v_size, 1.0);   // a streak is about a pixel wide
  if (v_shape < 0.5) a = smoothstep(0.5, 0.15, length(pc));
  else if (v_shape < 1.5) a = (1.0 - smoothstep(0.0, line, abs(pc.x))) * smoothstep(0.5, 0.2, abs(pc.y));
  else a = (1.0 - smoothstep(0.0, line, abs(pc.y))) * smoothstep(0.5, 0.2, abs(pc.x));
  o = vec4(mix(u_c0, u_c1, step(0.5, v_tint)), a * v_a * u_fade);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('No shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader: ${log}`);
  }
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('No program');
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Link: ${gl.getProgramInfoLog(p)}`);
  return p;
}

/** Ease `from` towards `to` with a time constant of `tau` seconds. */
const ease = (from: number, to: number, dt: number, tau: number) => from + (to - from) * (1 - Math.exp(-dt / tau));

/** A small seeded generator, so a setting's air is the same every visit. */
function seeded(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WorldRenderer {
  private gl: WebGL2RenderingContext;
  private ground: WebGLProgram;
  private air: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private ua: Record<string, WebGLUniformLocation | null> = {};
  private count = 0;
  private kind = 0;
  private pool: [number, number, number] = [0.5, 0.08, 0.55];
  private colors: WorldColors | null = null;
  private edge: Edge = NO_EDGE;
  private scale = 1;
  /** The constants need sending again (see `constants`). */
  private dirty = true;

  /* The mood as drawn, easing towards the mood as asked for. */
  private now = {
    fx: 0.5, fy: 0.55, focusAmt: 0, threat: 0, progress: 0, dim: 0, bloom: 0, px: 0, py: 0, flash: 0,
    /** How fast the air moves: slows as the party nears being found. */
    air: 1,
  };
  private flashColor: Rgb = [0, 0, 0];
  /**
   * The air's own clock. Every particle's path is a function of time, so
   * slowing the air means slowing the time it is given — run on its own
   * clock, it slows without a jump.
   */
  private airTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'low-power',
    });
    if (!gl) throw new Error('No WebGL2');
    this.gl = gl;
    this.ground = program(gl, GROUND_VS, GROUND_FS);
    this.air = program(gl, AIR_VS, AIR_FS);
    for (const n of ['u_res', 'u_time', 'u_ink0', 'u_ink1', 'u_ink2', 'u_parch', 'u_light', 'u_threatC', 'u_flashC',
      'u_pool', 'u_focus', 'u_focusAmt', 'u_flash', 'u_threat', 'u_dim', 'u_bloom', 'u_grain', 'u_fog', 'u_vignette', 'u_par',
      'u_progress', 'u_eyes', 'u_eyeC', 'u_edgeC', 'u_reach', 'u_rime', 'u_storm', 'u_gutter']) {
      this.u[n] = gl.getUniformLocation(this.ground, n);
    }
    for (const n of ['u_time', 'u_scale', 'u_kind', 'u_res', 'u_pool', 'u_par', 'u_c0', 'u_c1', 'u_fade']) {
      this.ua[n] = gl.getUniformLocation(this.air, n);
    }
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error('No buffers');
    this.vao = vao;
    this.buffer = buffer;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const loc = gl.getAttribLocation(this.air, 'a_r');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /**
   * True when WebGL is being drawn by the CPU (SwiftShader, llvmpipe): a
   * device with no GPU to speak of, where a loop would block the page.
   */
  isSoftware(): boolean {
    const gl = this.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software/i.test(name);
  }

  /** The setting: its colours, what is in its air, where its light hangs, how its dark comes. */
  setting(id: string, colors: WorldColors, particle: Particle, poolY: number, count: number, edge: Edge = NO_EDGE): void {
    this.colors = colors;
    this.edge = edge;
    this.kind = KINDS[particle];
    this.pool = [0.5, poolY, 0.55];
    const r = seeded(`${id}:air`);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < data.length; i += 1) data[i] = r();
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.count = count;
    this.dirty = true;
  }

  resize(cssW: number, cssH: number, scale: number): void {
    const c = this.gl.canvas as HTMLCanvasElement;
    const w = Math.max(1, Math.round(cssW * scale));
    const h = Math.max(1, Math.round(cssH * scale));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.scale = scale;
    this.dirty = true;
  }

  /** A card turned: wash its colour out from where the eye is. */
  flash(color: Rgb): void {
    this.flashColor = color;
    this.now.flash = 1;
    this.dirty = true;
  }

  /**
   * Ease towards `mood` by `dt` seconds and draw at `time`. A `dt` of
   * Infinity jumps straight there, which is how the still tier draws.
   */
  frame(time: number, dt: number, mood: Mood, air: boolean): void {
    const c = this.colors;
    if (!c) return;
    const n = this.now;
    n.fx = ease(n.fx, mood.focus?.x ?? n.fx, dt, 0.9);
    n.fy = ease(n.fy, mood.focus?.y ?? n.fy, dt, 0.9);
    n.focusAmt = ease(n.focusAmt, mood.focus ? 1 : 0, dt, 0.9);
    n.threat = ease(n.threat, mood.threat, dt, 1.4);
    n.progress = ease(n.progress, mood.progress, dt, 1.4);
    n.dim = ease(n.dim, mood.dim, dt, 0.7);
    n.bloom = ease(n.bloom, mood.bloom, dt, 0.6);
    n.px = ease(n.px, mood.parallax.x, dt, 0.5);
    n.py = ease(n.py, mood.parallax.y, dt, 0.5);
    n.flash = Number.isFinite(dt) ? n.flash * Math.exp(-dt / 0.55) : 0;
    n.air = ease(n.air, mood.hush > 0 ? 0.3 : 1, dt, 1.6);
    this.airTime = Number.isFinite(dt) ? this.airTime + dt * n.air : time;

    const gl = this.gl;
    const u = this.u;
    const a = this.ua;
    if (this.dirty) this.constants(c);

    gl.disable(gl.BLEND);
    gl.useProgram(this.ground);
    gl.uniform1f(u.u_time!, time);
    gl.uniform2f(u.u_focus!, n.fx, n.fy);
    gl.uniform1f(u.u_focusAmt!, n.focusAmt);
    gl.uniform1f(u.u_flash!, n.flash);
    gl.uniform1f(u.u_threat!, n.threat);
    gl.uniform1f(u.u_progress!, n.progress);
    gl.uniform1f(u.u_dim!, n.dim);
    gl.uniform1f(u.u_bloom!, n.bloom);
    gl.uniform2f(u.u_par!, n.px * this.scale, n.py * this.scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!air || this.count === 0) return;
    gl.enable(gl.BLEND);
    gl.useProgram(this.air);
    gl.uniform1f(a.u_time!, this.airTime);
    gl.uniform2f(a.u_par!, n.px * this.scale, n.py * this.scale);
    gl.uniform1f(a.u_fade!, 1 - 0.7 * n.dim);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
  }

  /**
   * Everything that changes only with the setting, the size or a flash's
   * colour. A program keeps its uniforms, so these go once, not per frame:
   * the per-frame work is the time and the eased mood.
   */
  private constants(c: WorldColors): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const u = this.u;
    const a = this.ua;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.ground);
    gl.uniform2f(u.u_res!, canvas.width, canvas.height);
    gl.uniform3fv(u.u_ink0!, c.ink900);
    gl.uniform3fv(u.u_ink1!, c.ink800);
    gl.uniform3fv(u.u_ink2!, c.ink700);
    gl.uniform3fv(u.u_parch!, c.parchment300);
    gl.uniform3fv(u.u_light!, c.light);
    gl.uniform3fv(u.u_threatC!, c.threat);
    gl.uniform3fv(u.u_flashC!, this.flashColor);
    gl.uniform3fv(u.u_pool!, this.pool);
    gl.uniform1f(u.u_grain!, 0.05);
    gl.uniform1f(u.u_fog!, 0.5);
    gl.uniform1f(u.u_vignette!, 0.55);
    const e = this.edge;
    gl.uniform3f(u.u_eyes!, e.eyes.count, e.eyes.size, e.eyes.low);
    gl.uniform3fv(u.u_eyeC!, e.eyes.color);
    gl.uniform3fv(u.u_edgeC!, e.color);
    gl.uniform1f(u.u_reach!, e.reach);
    gl.uniform1f(u.u_rime!, e.rime);
    gl.uniform1f(u.u_storm!, e.storm);
    gl.uniform1f(u.u_gutter!, e.gutter);

    gl.useProgram(this.air);
    gl.uniform1f(a.u_scale!, this.scale);
    gl.uniform1i(a.u_kind!, this.kind);
    gl.uniform2f(a.u_res!, canvas.width, canvas.height);
    gl.uniform2f(a.u_pool!, this.pool[0], this.pool[1]);
    const k = this.kind;
    // What each kind is made of, as the grounds drew it.
    const [c0, c1] =
      k === 4 ? [c.parchment100, c.parchment100]
      : k === 5 ? [c.light, c.lightSoft]
      : k === 1 || k === 3 ? [c.lightSoft, c.lightSoft]
      : k === 2 ? [c.parchment400, c.parchment400]
      : [c.parchment300, c.parchment300];
    gl.uniform3fv(a.u_c0!, c0);
    gl.uniform3fv(a.u_c1!, c1);
    this.dirty = false;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.ground);
    gl.deleteProgram(this.air);
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
  }
}

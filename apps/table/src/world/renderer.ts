/* ============================================================
   The world, drawn (docs/settings-build.md, set/3).

   The world is the played side's design (packages/art/src/paint). The
   design resolves its own picture a dozen times a second, in a worker
   (paint.worker.ts): only the pixels its lights touch are worked out
   again, then its sprites, particles and haze go on top, exactly as
   approved.
   That picture, at the design's own size (about 200 pixels on its
   short side), is all this file is given. Two cheap GPU passes follow:

   - the MOOD, at the design's size: the table's state laid over the
     picture in the painter's own idiom, blends in dithered fifths per
     design pixel. So the dark closing in, a card's colour washing out,
     the light going out and the gold of getting through stay pixel
     art; the eyes in the dark are a pixel each;
   - the SCREEN: that scaled up to cover the viewport, nearest
     neighbour, nudged a few device pixels by the pointer.

   The main thread's job per frame is to ease a few numbers towards the
   mood; the picture is uploaded only when the design draws a new one.
   ============================================================ */

export type Rgb = readonly [number, number, number];

export interface WorldColors {
  /** The setting's darkest ink: what the light going out goes to. */
  dark: Rgb;
  /** The setting's own light (its `light` category, 500): the gold of getting through. */
  light: Rgb;
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
  /** The setting's own lights guttering, like flames about to go (World.tsx). */
  gutter: number;
}

export const NO_EDGE: Edge = {
  eyes: { count: 0, size: 1, low: 0, color: [0, 0, 0] }, reach: 1, rime: 0, storm: 0, color: [0, 0, 0], gutter: 0,
};

/**
 * Where the screen has words over the world, in 0..1 of the viewport
 * (y down), and how bright the world may be behind them: relative
 * luminance, the budget docs/art-jobs.md sets and check-art.cjs reads.
 */
export interface WordRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  budget: number;
}

/** At most this many regions of words are kept clear. */
export const MAX_WORDS = 6;

/** How far, in CSS pixels, the words' budget takes to relax outside them. */
const WORDS_FADE = 40;

/** What the table wants the world to look like. The renderer eases towards it. */
export interface Mood {
  /** Where the phase is, in 0..1 of the viewport (y down), or null: where a card's colour washes out from. */
  focus: { x: number; y: number } | null;
  /** 0..1: strikes against the encounter. Past 1, found. */
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
  /** Where the words are, measured from the layout (World.tsx). */
  words: readonly WordRegion[];
}

const QUAD_VS = `#version 300 es
void main() {
  // One triangle that covers the target.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/*
 * Rows: the picture is uploaded top row first, so texel row 0 is its top,
 * and the mood pass keeps that order (its fragment row y is the
 * picture's row y, counting down). The screen pass turns it the right
 * way up.
 */
const MOOD_FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_pic;
uniform vec4 u_view;      // the part of the picture on screen, in its pixels: x0, y0, x1, y1
uniform float u_time;
uniform vec3 u_dark, u_threatC, u_flashC, u_light, u_eyeC, u_edgeC;
uniform vec2 u_focus;     // 0..1 of the viewport, y down
uniform float u_flash, u_threat, u_dim, u_bloom;
uniform vec3 u_eyes;      // count, size, how low
uniform float u_reach, u_rime, u_storm;
uniform vec4 u_words[${MAX_WORDS}];  // where the words are: x0, y0, x1, y1 of the viewport
uniform float u_budget[${MAX_WORDS}];
uniform int u_nwords;
uniform float u_fade;     // design pixels
out vec4 o;

float lin(float v) { return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4); }
float lum(vec3 c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }

const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

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

// As the painter blends a coloured light: in fifths, the step dithered.
vec3 fifths(vec3 c, vec3 to, float a, float b) {
  if (a <= 0.02) return c;
  float s = floor(a * 5.0 + b) / 5.0;
  return s <= 0.0 ? c : mix(c, to, min(s, 1.0));
}

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(u_pic, ip, 0).rgb;
  float b = (BAYER[(ip.y & 3) * 4 + (ip.x & 3)] + 0.5) / 16.0;

  // Where this pixel is on screen, 0..1, y down; every sum below is taken
  // at the pixel's centre, so a design pixel is one colour.
  vec2 span = u_view.zw - u_view.xy;
  vec2 uv = (vec2(ip) + 0.5 - u_view.xy) / span;
  float aspect = span.x / span.y;
  float t = u_time;
  float th = clamp(u_threat, 0.0, 1.0);

  // A card turned: its colour washes out from where the eye is, and goes.
  vec2 fd = (uv - u_focus) * vec2(aspect, 1.0);
  c = fifths(c, u_flashC, u_flash * 0.5 * exp(-dot(fd, fd) * 3.0), b);

  // The dark. Nothing at rest; threat draws it in and reddens it, and it
  // does not close evenly: it reaches in, in tendrils that shift slowly.
  vec2 off = uv - 0.5;
  float vd = length(off / 0.7);
  if (th > 0.0) {
    vec2 dir = off / max(length(off), 1e-4);
    float rag = fbm(dir * 2.6 + vec2(vd * 2.0 - t * 0.025, t * 0.011));
    vd += (rag - 0.5) * 0.42 * u_reach * th;
  }
  float inner = max(0.1, 0.5 - 0.3 * u_threat);
  float vig = smoothstep(inner, 1.0, vd) * 1.1 * u_threat;
  c = fifths(c, mix(u_dark, u_threatC * 0.4, min(1.0, u_threat * 0.7)), clamp(vig, 0.0, 1.0), b);

  // The setting's own way of closing in: frost, or a wall of blown sand.
  float edge = smoothstep(inner, 1.0, vd) * th;
  if (u_rime * th > 0.0) {
    float frost = smoothstep(0.45, 0.8, fbm(vec2(ip) * 0.09 + 3.1));
    c = fifths(c, u_edgeC, edge * u_rime * 0.7 * (0.35 + 0.65 * frost), b);
  }
  if (u_storm * th > 0.0) {
    float sand = fbm(vec2(uv.x * aspect * 1.6 - t * 0.16, uv.y * 10.0));
    c = fifths(c, u_edgeC, edge * u_storm * (0.3 + 0.5 * sand), b);
  }

  // Eyes in the dark, a pixel each: pairs that come and go, and blink,
  // out at the sides where the table is not. More of them as the threat
  // rises; none before the first strike.
  float eye = 0.0;
  for (int i = 0; i < 12; i++) {
    if (th <= 0.0) break;
    float fi = float(i);
    if (fi >= u_eyes.x) break;
    float h1 = hash(vec2(fi, 3.7)), h2 = hash(vec2(fi, 9.1)), h3 = hash(vec2(fi, 17.3));
    float a = h1 * 6.2831853;
    vec2 ring = vec2(cos(a), sin(a));
    ring.x = sign(ring.x) * (0.82 + 0.18 * abs(ring.x));
    ring.y = mix(ring.y, abs(ring.y) * 0.8 + 0.2, u_eyes.z);
    vec2 at = 0.5 + ring * vec2(0.47, 0.44) * (0.86 + 0.12 * h2);
    float shown = smoothstep(0.35, 0.75, 0.5 + 0.5 * sin(t * (0.06 + 0.05 * h3) + h2 * 6.2831853));
    shown *= smoothstep(h3 * 0.5, h3 * 0.5 + 0.25, th);
    float open = step(0.05, fract(t * (0.11 + 0.09 * h1) + h3));
    ivec2 e = ivec2(floor(u_view.xy + at * span));
    int gap = u_eyes.y > 1.05 ? 2 : 1;
    ivec2 d = ip - e;
    bool hit = d.y == 0 && (d.x == -gap || d.x == gap || (u_eyes.y > 1.05 && (d.x == -gap - 1 || d.x == gap + 1)));
    if (hit) eye = max(eye, shown * open);
  }
  c = fifths(c, u_eyeC, eye * smoothstep(0.0, 0.25, vig) * (1.0 - u_dim), b);

  // Through: gold rises over everything. Lost: the light goes out.
  vec2 bc = off * vec2(aspect, 1.0);
  c = fifths(c, u_light, u_bloom * 0.45 * exp(-dot(bc, bc) * 1.2), b);
  c = fifths(c, u_dark, u_dim * 0.85, b);

  // Words stay readable. Behind them, a pixel brighter than the budget
  // steps towards the dark, a fifth at a time, until it is under: a
  // torch or a chain passing behind the title dims there, and the dark
  // that is most of every world is left alone. The budget holds a
  // design pixel past the words' edge, then relaxes over u_fade more
  // (WORDS_FADE, in the design's pixels), so where a bright sky is
  // dimmed it fades in like a shadow rather than stopping at a box.
  float least = 1.0;
  for (int i = 0; i < ${MAX_WORDS}; i++) {
    if (i >= u_nwords) break;
    vec4 r = u_words[i];
    vec2 out2 = max(max(r.xy - uv, uv - r.zw), 0.0) * span;
    float s = smoothstep(1.0, 1.0 + u_fade, length(out2) + (b - 0.5) * 2.0);
    least = min(least, exp(mix(log(u_budget[i]), 0.0, s)));
  }
  if (least < 1.0 && lum(c) > least) {
    vec3 was = c;
    for (int k = 1; k <= 5; k++) {
      c = mix(was, u_dark, float(k) / 5.0);
      if (lum(c) <= least) break;
    }
  }

  o = vec4(c, 1.0);
}`;

const SCREEN_FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_mood;
uniform vec2 u_res;       // the canvas, in its pixels
uniform vec4 u_view;      // the part of the picture on screen, in its pixels
uniform vec2 u_par;       // parallax, canvas pixels
out vec4 o;
void main() {
  vec2 s = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) - u_par;
  vec2 d = u_view.xy + s / u_res * (u_view.zw - u_view.xy);
  ivec2 size = textureSize(u_mood, 0);
  ivec2 ip = clamp(ivec2(floor(d)), ivec2(0), size - 1);
  o = vec4(texelFetch(u_mood, ip, 0).rgb, 1.0);
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

function texture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('No texture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** Ease `from` towards `to` with a time constant of `tau` seconds. */
const ease = (from: number, to: number, dt: number, tau: number) => from + (to - from) * (1 - Math.exp(-dt / tau));

/** How much larger than the screen the picture is drawn, so the parallax never shows its edge. */
const OVERSCAN = 1.025;

export class WorldRenderer {
  private gl: WebGL2RenderingContext;
  private mood: WebGLProgram;
  private screen: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private um: Record<string, WebGLUniformLocation | null> = {};
  private us: Record<string, WebGLUniformLocation | null> = {};
  private pic: WebGLTexture | null = null;
  private out: WebGLTexture | null = null;
  private fbo: WebGLFramebuffer | null = null;
  /** The picture's size, in its own pixels. */
  private W = 0;
  private H = 0;
  /** No picture uploaded yet: nothing to draw. */
  private empty = true;
  private colors: WorldColors | null = null;
  private edge: Edge = NO_EDGE;
  /** CSS pixels to canvas pixels. */
  private scale = 1;
  /** The part of the picture on screen, in its pixels. */
  private view: [number, number, number, number] = [0, 0, 1, 1];
  /** The constants need sending again (see `constants`). */
  private dirty = true;
  /** No frame drawn yet: the first goes straight to the mood. */
  private first = true;

  /* The mood as drawn, easing towards the mood as asked for. */
  private now = {
    fx: 0.5, fy: 0.55, threat: 0, dim: 0, bloom: 0, px: 0, py: 0, flash: 0,
    /** How fast the design's own clock runs: slows as the party nears being found. */
    air: 1,
  };
  private flashColor: Rgb = [0, 0, 0];

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'low-power',
    });
    if (!gl) throw new Error('No WebGL2');
    this.gl = gl;
    this.mood = program(gl, QUAD_VS, MOOD_FS);
    this.screen = program(gl, QUAD_VS, SCREEN_FS);
    for (const n of ['u_pic', 'u_view', 'u_time', 'u_dark', 'u_threatC', 'u_flashC', 'u_light', 'u_eyeC', 'u_edgeC',
      'u_focus', 'u_flash', 'u_threat', 'u_dim', 'u_bloom', 'u_eyes', 'u_reach', 'u_rime', 'u_storm',
      'u_words', 'u_budget', 'u_nwords', 'u_fade']) {
      this.um[n] = gl.getUniformLocation(this.mood, n);
    }
    for (const n of ['u_mood', 'u_res', 'u_view', 'u_par']) this.us[n] = gl.getUniformLocation(this.screen, n);
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('No vertex array');
    this.vao = vao;
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

  /** The setting: its colours and how its dark comes. */
  setting(colors: WorldColors, edge: Edge = NO_EDGE): void {
    this.colors = colors;
    this.edge = edge;
    this.dirty = true;
  }

  /** The design's picture size. Its textures are made again only when it changes. */
  picture(W: number, H: number): void {
    if (W === this.W && H === this.H) return;
    const gl = this.gl;
    if (this.pic) gl.deleteTexture(this.pic);
    if (this.out) gl.deleteTexture(this.out);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    this.pic = texture(gl, W, H);
    this.out = texture(gl, W, H);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.out, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.W = W;
    this.H = H;
    this.empty = true;
    this.dirty = true;
  }

  /** A new frame of the design: RGBA, top row first, at the picture's size. */
  upload(pixels: Uint8Array): void {
    if (!this.pic || pixels.length !== this.W * this.H * 4) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.pic);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    this.empty = false;
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

  /** How fast the design's clock should run now (the hush slows it). */
  get clock(): number {
    return this.now.air;
  }

  /** The threat as drawn, eased: what the setting's lights gutter by. */
  get threat(): number {
    return Math.min(1, this.now.threat);
  }

  /**
   * Ease towards `mood` by `dt` seconds and draw, with the mood's own
   * motion (the tendrils, the eyes) at `time`. A `dt` of Infinity jumps
   * straight there, which is how the still tier draws.
   */
  frame(time: number, dt: number, mood: Mood): void {
    const c = this.colors;
    if (!c) return;
    // The first frame starts where it is asked to, rather than easing in
    // from nothing: a board opened at one strike is already dark, and the
    // opening of a crossing starts in the dark and lights up (phase 7).
    if (this.first) { this.first = false; dt = Infinity; }
    const n = this.now;
    n.fx = ease(n.fx, mood.focus?.x ?? n.fx, dt, 0.9);
    n.fy = ease(n.fy, mood.focus?.y ?? n.fy, dt, 0.9);
    n.threat = ease(n.threat, mood.threat, dt, 1.4);
    n.dim = ease(n.dim, mood.dim, dt, 0.7);
    n.bloom = ease(n.bloom, mood.bloom, dt, 0.6);
    n.px = ease(n.px, mood.parallax.x, dt, 0.5);
    n.py = ease(n.py, mood.parallax.y, dt, 0.5);
    n.flash = Number.isFinite(dt) ? n.flash * Math.exp(-dt / 0.55) : 0;
    n.air = ease(n.air, mood.hush > 0 ? 0.3 : 1, dt, 1.6);
    if (this.empty || !this.fbo) return;

    const gl = this.gl;
    if (this.dirty) this.constants(c);
    gl.bindVertexArray(this.vao);

    // The mood, at the picture's size.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.mood);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.pic);
    const m = this.um;
    gl.uniform1f(m.u_time!, time);
    gl.uniform2f(m.u_focus!, n.fx, n.fy);
    gl.uniform1f(m.u_flash!, n.flash);
    gl.uniform1f(m.u_threat!, n.threat);
    gl.uniform1f(m.u_dim!, n.dim);
    gl.uniform1f(m.u_bloom!, n.bloom);
    const words = mood.words.slice(0, MAX_WORDS);
    if (words.length) {
      gl.uniform4fv(m.u_words!, words.flatMap((w) => [w.x0, w.y0, w.x1, w.y1]));
      gl.uniform1fv(m.u_budget!, words.map((w) => w.budget));
    }
    gl.uniform1i(m.u_nwords!, words.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The screen.
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.screen);
    gl.bindTexture(gl.TEXTURE_2D, this.out);
    gl.uniform2f(this.us.u_par!, Math.round(n.px * this.scale), Math.round(n.py * this.scale));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /**
   * Everything that changes only with the setting, the size or a flash's
   * colour. A program keeps its uniforms, so these go once, not per frame.
   */
  private constants(c: WorldColors): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    // The picture covers the screen, centred, a little larger than it.
    const k = Math.max(canvas.width / this.W, canvas.height / this.H) * OVERSCAN;
    const vw = canvas.width / k;
    const vh = canvas.height / k;
    this.view = [(this.W - vw) / 2, (this.H - vh) / 2, (this.W + vw) / 2, (this.H + vh) / 2];

    const m = this.um;
    gl.useProgram(this.mood);
    gl.uniform1i(m.u_pic!, 0);
    gl.uniform4fv(m.u_view!, this.view);
    gl.uniform3fv(m.u_dark!, c.dark);
    gl.uniform3fv(m.u_light!, c.light);
    gl.uniform3fv(m.u_threatC!, c.threat);
    gl.uniform3fv(m.u_flashC!, this.flashColor);
    const e = this.edge;
    gl.uniform3f(m.u_eyes!, e.eyes.count, e.eyes.size, e.eyes.low);
    gl.uniform3fv(m.u_eyeC!, e.eyes.color);
    gl.uniform3fv(m.u_edgeC!, e.color);
    gl.uniform1f(m.u_reach!, e.reach);
    gl.uniform1f(m.u_rime!, e.rime);
    gl.uniform1f(m.u_storm!, e.storm);
    // The words' fade, from CSS pixels to the design's.
    gl.uniform1f(m.u_fade!, (WORDS_FADE * this.scale) / k);

    const s = this.us;
    gl.useProgram(this.screen);
    gl.uniform1i(s.u_mood!, 0);
    gl.uniform2f(s.u_res!, canvas.width, canvas.height);
    gl.uniform4fv(s.u_view!, this.view);
    this.dirty = false;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.mood);
    gl.deleteProgram(this.screen);
    gl.deleteVertexArray(this.vao);
    if (this.pic) gl.deleteTexture(this.pic);
    if (this.out) gl.deleteTexture(this.out);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
  }
}

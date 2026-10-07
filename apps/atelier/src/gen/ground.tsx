/* ============================================================
   GROUNDS

   The page behind the table. In the app this is `--t-biome-ground`:
   the setting's ink plus one faint pool of its light, drifting on
   a fixed layer (apps/table/src/app.css). This generator makes a
   richer version of the same idea — pool, texture, whatever is in
   the air, a vignette — and hands it back two ways: as a picture
   to export, and as a CSS value with the texture tile inlined,
   which drops straight into biomes.css.

   With `animate` on, the picture moves on its own: the pool
   breathes and what is in the air drifts, falls or rises, as SMIL
   inside the SVG. Nothing else is needed — the file animates as
   an <img> and as a CSS background. Falling and rising things loop
   seamlessly by drawing each lane twice, one period apart, and
   sliding the pair exactly one period. Pixel style moves in steps.
   ============================================================ */

import type { ReactElement, ReactNode } from 'react';
import { alpha, hexToRgb } from '../core/biomes';
import type { BiomeVocab, Palette, Particle } from '../core/biomes';
import { svgDataUri } from '../core/export';
import { range, rngFor } from '../core/rng';
import type { Style } from '../core/style';

export interface GroundParams {
  seed: string;
  style: Style;
  width: number;
  height: number;
  /** Pool centre, in percent of the picture. */
  poolX: number;
  poolY: number;
  /** Pool radius as a fraction of the longer side, 0.2–1. */
  poolSize: number;
  /** 0–1. */
  poolStrength: number;
  texture: number;
  particles: number;
  vignette: number;
  /** Put the motion into the SVG. */
  animate: boolean;
}

export const DEFAULT_GROUND: Omit<GroundParams, 'seed' | 'style'> = {
  width: 2560, height: 1440,
  poolX: 50, poolY: 8, poolSize: 0.55, poolStrength: 0.5,
  texture: 0.5, particles: 0.35, vignette: 0.55,
  animate: true,
};

/* ---------- the texture tile ------------------------------------
   Seamless, small, and drawn once — the picture uses it as a
   pattern and the CSS export inlines it as a data: URI.          */

export interface TextureTile { size: number; node: ReactElement }

export function textureTile(style: Style, pal: Palette, vocab: BiomeVocab, amount: number, seed: string, id: string): TextureTile | null {
  if (amount <= 0) return null;
  const light = pal.cat[vocab.light][500];
  if (style === 'flat') {
    const size = 160;
    const [r, g, b] = hexToRgb(pal.parchment[300]).map((c) => (c / 255).toFixed(3));
    const fid = `${id}-grain`;
    return {
      size,
      node: (
        <svg viewBox={`0 0 ${size} ${size}`}>
          <filter id={fid} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" seed={String(rngSeedNumber(seed))} />
            <feColorMatrix values={`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${(0.22 * amount).toFixed(3)} 0`} />
          </filter>
          <rect width={size} height={size} filter={`url(#${fid})`} />
        </svg>
      ),
    };
  }
  if (style === 'engraving') {
    const size = 8;
    return {
      size,
      node: (
        <svg viewBox={`0 0 ${size} ${size}`}>
          <line x1="0" y1={size} x2={size} y2="0" stroke={pal.parchment[400]} strokeWidth="0.7" opacity={0.42 * amount} />
        </svg>
      ),
    };
  }
  if (style === 'pixel') {
    const size = 6;
    return {
      size,
      node: (
        <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
          <rect x="0" y="0" width="2" height="2" fill={light} opacity={0.45 * amount} />
          <rect x="3" y="3" width="2" height="2" fill={light} opacity={0.3 * amount} />
        </svg>
      ),
    };
  }
  const size = 28;
  return {
    size,
    node: (
      <svg viewBox={`0 0 ${size} ${size}`}>
        <line x1="0" y1="0.5" x2={size} y2="0.5" stroke={pal.parchment[400]} strokeWidth="0.6" opacity={0.16 * amount} />
      </svg>
    ),
  };
}

function rngSeedNumber(seed: string): number {
  return Math.floor(rngFor(seed, 'grain')() * 1000);
}

/* ---------- motion ----------------------------------------------- */

const EASE = { calcMode: 'spline', keyTimes: '0;0.5;1', keySplines: '0.4 0 0.6 1;0.4 0 0.6 1' } as const;

/** A translate that goes out and back. */
function Sway({ dx, dy, dur, begin, discrete, additive }: {
  dx: number; dy: number; dur: number; begin: number; discrete: boolean; additive?: boolean;
}) {
  const f = (n: number) => Math.round(n * 10) / 10;
  if (discrete) {
    const steps = 6;
    const vals: string[] = [];
    for (let i = 0; i <= steps * 2; i++) {
      const t = i <= steps ? i / steps : (2 * steps - i) / steps;
      vals.push(`${f(dx * t)} ${f(dy * t)}`);
    }
    return <animateTransform attributeName="transform" type="translate" additive={additive ? 'sum' : undefined}
      values={vals.join(';')} calcMode="discrete" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />;
  }
  return <animateTransform attributeName="transform" type="translate" additive={additive ? 'sum' : undefined}
    values={`0 0;${f(dx)} ${f(dy)};0 0`} {...EASE} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />;
}

/** A translate that runs one period and starts again — seamless when the content repeats at that period. */
function Flow({ dy, dur, begin, discrete }: { dy: number; dur: number; begin: number; discrete: boolean }) {
  const f = (n: number) => Math.round(n * 10) / 10;
  if (discrete) {
    const steps = 10;
    const vals = Array.from({ length: steps + 1 }, (_, i) => `0 ${f((dy * i) / steps)}`);
    return <animateTransform attributeName="transform" type="translate"
      values={vals.join(';')} calcMode="discrete" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />;
  }
  return <animateTransform attributeName="transform" type="translate"
    values={`0 0;0 ${f(dy)}`} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />;
}

interface Motion { mode: 'down' | 'up' | 'sway'; dx: number; dy: number; dur: number; sway?: number }

/* Loops are fractions of the height; sways are pixels at 1080p. */
const MOTION: Record<Particle, Motion> = {
  snow: { mode: 'down', dx: 0, dy: 0.35, dur: 30, sway: 22 },
  drips: { mode: 'down', dx: 0, dy: 0.25, dur: 10 },
  embers: { mode: 'up', dx: 0, dy: 0.3, dur: 22, sway: 14 },
  dust: { mode: 'sway', dx: 26, dy: -12, dur: 34 },
  motes: { mode: 'sway', dx: 18, dy: 22, dur: 28 },
  sand: { mode: 'sway', dx: 90, dy: 5, dur: 18 },
};

/** One third of what is in the air, with its own pace, so nothing moves in step. */
function Lane({ nodes, lane, kind, H, discrete }: { nodes: ReactNode[]; lane: number; kind: Particle; H: number; discrete: boolean }) {
  const m = MOTION[kind];
  const pace = [1, 1.35, 1.7][lane];
  const begin = -lane * 7;
  const T = H / 1080;
  if (m.mode === 'sway') {
    return <g><Sway dx={m.dx * T} dy={m.dy * T} dur={m.dur * pace} begin={begin} discrete={discrete} />{nodes}</g>;
  }
  const D = m.dy * H * (m.mode === 'down' ? 1 : -1);
  return (
    <g>
      <Flow dy={D} dur={m.dur * pace} begin={begin} discrete={discrete} />
      {m.sway ? <Sway dx={m.sway * T} dy={0} dur={m.dur * 0.45 * pace} begin={begin} discrete={discrete} additive /> : null}
      <g>{nodes}</g>
      <g transform={`translate(0,${-D})`}>{nodes}</g>
    </g>
  );
}

/* ---------- what is in the air ---------------------------------- */

function particles(p: GroundParams, pal: Palette, vocab: BiomeVocab): ReactNode[][] {
  const lanes: ReactNode[][] = [[], [], []];
  if (p.particles <= 0) return lanes;
  const r = rngFor(p.seed, 'air');
  const W = p.width, H = p.height;
  const n = Math.round(p.particles * 220 * Math.sqrt((W * H) / (1920 * 1080)));
  const px = (W * p.poolX) / 100;
  const py = (H * p.poolY) / 100;
  const light = pal.cat[vocab.light];
  const pixel = p.style === 'pixel';
  const line = p.style === 'line';
  const crisp = pixel ? { shapeRendering: 'crispEdges' as const } : {};
  const kind = vocab.particle;

  for (let i = 0; i < n; i++) {
    const out = lanes[i % 3];
    let x = range(r, 0, W);
    let y = range(r, 0, H);
    if (kind === 'embers' || kind === 'motes') {
      // Drawn to the light.
      const t = r();
      x = px + (x - px) * (0.25 + 0.75 * t);
      y = py + (y - py) * (0.25 + 0.75 * t);
    }
    const key = `p${i}`;
    if (kind === 'sand') {
      const len = range(r, 14, 60);
      const tilt = range(r, -0.08, 0.08);
      out.push(<line key={key} x1={x} y1={y} x2={x + len} y2={y + len * tilt}
        stroke={pal.parchment[400]} strokeWidth={pixel ? 3 : 1} opacity={range(r, 0.08, 0.25)} {...crisp} />);
      continue;
    }
    if (kind === 'drips') {
      const len = range(r, 8, 30);
      out.push(<line key={key} x1={x} y1={y} x2={x} y2={y + len}
        stroke={light[300]} strokeWidth={pixel ? 3 : 1} opacity={range(r, 0.1, 0.3)} {...crisp} />);
      continue;
    }
    const fill =
      kind === 'embers' ? (r() < 0.5 ? light[500] : light[300])
      : kind === 'snow' ? pal.parchment[100]
      : kind === 'motes' ? light[300]
      : pal.parchment[300];
    const op = kind === 'embers' ? range(r, 0.35, 0.9) : kind === 'snow' ? range(r, 0.25, 0.75) : range(r, 0.1, 0.45);
    const rad = kind === 'snow' ? range(r, 1, 3.2) : kind === 'embers' ? range(r, 0.8, 2.6) : range(r, 0.6, 1.8);
    if (pixel) {
      const s = Math.max(2, Math.round(rad * 2));
      out.push(<rect key={key} x={Math.round(x)} y={Math.round(y)} width={s} height={s} fill={fill} opacity={op} {...crisp} />);
    } else if (line) {
      out.push(<circle key={key} cx={x} cy={y} r={rad + 0.6} fill="none" stroke={fill} strokeWidth="0.8" opacity={op} />);
    } else {
      out.push(<circle key={key} cx={x} cy={y} r={rad} fill={fill} opacity={op} />);
    }
  }
  return lanes;
}

/* ---------- the picture ----------------------------------------- */

export function GroundArt({ p, pal, vocab, id }: { p: GroundParams; pal: Palette; vocab: BiomeVocab; id: string }) {
  const W = p.width, H = p.height;
  const light = pal.cat[vocab.light][500];
  const px = (W * p.poolX) / 100;
  const py = (H * p.poolY) / 100;
  const pr = Math.max(W, H) * p.poolSize;
  const tex = textureTile(p.style, pal, vocab, p.texture, p.seed, id);
  const pixel = p.style === 'pixel';
  const anim = p.animate;

  const poolId = `${id}-pool`, vigId = `${id}-vig`, texId = `${id}-tex`, maskId = `${id}-mask`, maskGradId = `${id}-mg`;

  // Where the texture shows: hatching lives in the shadow, dither
  // and grain live in the light.
  const texInShadow = p.style === 'engraving';

  const poolLayer: ReactNode = pixel ? (
    // Stepped, not smooth: four ellipses, each a band of the pool.
    <g>
      {[1, 0.78, 0.56, 0.34].map((k, i) => (
        <ellipse key={i} cx={px} cy={py} rx={pr * k} ry={pr * k * 0.72}
          fill={light} opacity={0.045 * p.poolStrength * (i + 1)} shapeRendering="crispEdges">
          {anim ? (
            <>
              <animate attributeName="rx" values={[1, 1.04, 1.08, 1.04, 1].map((m) => Math.round(pr * k * m)).join(';')}
                calcMode="discrete" dur={`${9 + i}s`} repeatCount="indefinite" />
              <animate attributeName="ry" values={[1, 1.04, 1.08, 1.04, 1].map((m) => Math.round(pr * k * 0.72 * m)).join(';')}
                calcMode="discrete" dur={`${9 + i}s`} repeatCount="indefinite" />
            </>
          ) : null}
        </ellipse>
      ))}
    </g>
  ) : (
    <rect width={W} height={H} fill={`url(#${poolId})`} />
  );

  const contours: ReactNode = p.style === 'line' ? (
    <g fill="none" stroke={light}>
      {Array.from({ length: 9 }, (_, i) => {
        const k = (i + 1) / 9;
        return <ellipse key={i} cx={px} cy={py} rx={pr * k} ry={pr * k * 0.72}
          strokeWidth={1} opacity={0.32 * p.poolStrength * (1 - k * 0.85)} />;
      })}
    </g>
  ) : null;

  const lanes = particles(p, pal, vocab);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={poolId} cx={px} cy={py} r={pr} gradientUnits="userSpaceOnUse">
          {anim ? <animate attributeName="r" values={`${pr * 0.94};${pr * 1.06};${pr * 0.94}`} {...EASE} dur="11s" repeatCount="indefinite" /> : null}
          <stop offset="0" stopColor={light} stopOpacity={0.3 * p.poolStrength}>
            {anim ? <animate attributeName="stop-opacity" values={`${0.3 * p.poolStrength};${0.36 * p.poolStrength};${0.3 * p.poolStrength}`} {...EASE} dur="7s" repeatCount="indefinite" /> : null}
          </stop>
          <stop offset="0.45" stopColor={light} stopOpacity={0.09 * p.poolStrength} />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={vigId} cx="50%" cy="50%" r="70%">
          <stop offset="0.45" stopColor={pal.ink[900]} stopOpacity="0" />
          <stop offset="1" stopColor={pal.ink[900]} stopOpacity={p.vignette} />
        </radialGradient>
        {tex ? (
          <>
            <radialGradient id={maskGradId} cx={px} cy={py} r={pr * 1.4} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={texInShadow ? '#000' : '#fff'} />
              <stop offset="1" stopColor={texInShadow ? '#fff' : '#000'} />
            </radialGradient>
            <mask id={maskId}>
              <rect width={W} height={H} fill={`url(#${maskGradId})`} />
            </mask>
            <pattern id={texId} width={tex.size} height={tex.size} patternUnits="userSpaceOnUse">
              {tex.node.props.children}
            </pattern>
          </>
        ) : null}
      </defs>
      <rect width={W} height={H} fill={pal.ink[900]} />
      {poolLayer}
      {tex ? <rect width={W} height={H} fill={`url(#${texId})`} mask={p.style === 'flat' ? undefined : `url(#${maskId})`} /> : null}
      {contours}
      {anim
        ? lanes.map((nodes, i) => <Lane key={i} nodes={nodes} lane={i} kind={vocab.particle} H={H} discrete={pixel} />)
        : <g>{lanes.flat()}</g>}
      <rect width={W} height={H} fill={`url(#${vigId})`} />
    </svg>
  );
}

/** The `--t-biome-ground` value for biomes.css, gradients and a texture tile only. */
export function groundCss(p: GroundParams, pal: Palette, vocab: BiomeVocab): string {
  const light = pal.cat[vocab.light][500];
  const tex = textureTile(p.style, pal, vocab, p.texture, p.seed, 'css');
  const sx = Math.round(p.poolSize * 100);
  const sy = Math.round(p.poolSize * 72);
  const layers: string[] = [];
  if (p.vignette > 0) {
    layers.push(`radial-gradient(ellipse 70% 70% at 50% 50%, transparent 45%, ${alpha(pal.ink[900], Math.min(1, p.vignette))} 100%)`);
  }
  layers.push(`radial-gradient(ellipse ${sx}% ${sy}% at ${p.poolX}% ${p.poolY}%, ${alpha(light, 0.3 * p.poolStrength)}, ${alpha(light, 0.09 * p.poolStrength)} 45%, transparent 100%)`);
  if (tex) layers.push(`url("${svgDataUri(tex.node, tex.size, tex.size)}") 0 0 / ${tex.size}px ${tex.size}px repeat`);
  layers.push('var(--md-ink-900)');
  return `  --t-biome-ground:\n    ${layers.join(',\n    ')};`;
}

/** The `--t-biome-ground` value that uses the exported picture itself, motion and all. */
export function groundFileCss(biome: string): string {
  return [
    `  --t-biome-ground:`,
    `    url("./biomes/art/ground-${biome}.svg") center / cover no-repeat,`,
    `    var(--md-ink-900);`,
  ].join('\n');
}

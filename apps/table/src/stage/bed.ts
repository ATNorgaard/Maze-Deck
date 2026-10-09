/* ============================================================
   The bed: each setting's own air, under the table
   (docs/overhaul.md, phase 9).

   Synthesised with WebAudio like the voices in sound.ts, with no
   files: wind on the pass, drips and a long room in the dungeon, the
   crackle of torches over running water in the undercity, insects and
   leaves in the forest, hiss and gusts in the desert, a far bell over
   the tower.

   It moves with the same mood the world layer draws (one mood, many
   layers), so the sound and the picture never disagree:
   - threat narrows the filter and brings in a low pulse that quickens;
   - one strike short, the air goes still, as the world's does;
   - near the far side the bed opens up;
   - through, it warms; lost, it goes out with the light;
   - every voice ducks it for a moment, so the beats are heard.

   It plays under conversation at a real table, so it is quiet, and it
   is only ever on when sound is (the one toggle, per device).

   The graph is built on any BaseAudioContext and schedules its own
   events ahead of time from a seeded generator, so the same bed can be
   rendered offline to be measured and listened to
   (scripts/capture-sound.cjs) — that is `renderBed`.
   ============================================================ */

import * as React from 'react';
import { range, rngFor } from '@maze-deck/art';
import type { Rng } from '@maze-deck/art';
import type { BiomeId } from '../biomes/types';
import { audio, isSoundOn, onPlay, subscribeSound } from './sound';
import type { Voice } from './sound';

/** The part of the world's mood the bed follows. */
export interface BedMood {
  /** Strikes against the encounter: 0..1, more while found. */
  threat: number;
  /** Clear Paths against the target, 0..1. */
  progress: number;
  /** One strike short, or found: the air goes still. */
  hush: number;
  /** The light going out (the run lost), or not yet up (the opening). */
  dim: number;
  /** The party through. */
  bloom: number;
}

export const CALM: BedMood = { threat: 0, progress: 0, hush: 0, dim: 0, bloom: 0 };

/** What a mood asks of the bed: the numbers its graph eases towards. */
export interface BedParams {
  /** The whole bed, 0..1. The dark takes it out. */
  level: number;
  /** The setting's own layers, 0..1. The hush thins them. */
  texture: number;
  /** How much the wind and the like wander, 0..1. The hush stills them. */
  wander: number;
  /** The lowpass over the setting's layers, in Hz. */
  cutoff: number;
  /** A high shelf over them, in dB: open air, or closed in. */
  air: number;
  /** The low pulse under threat: beats a minute (0 for none), and loudness 0..1. */
  pulse: { rate: number; gain: number };
  /** A warm chord under the party coming through, 0..1. */
  warmth: number;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * The mood, as the bed hears it. Pure, so it is tested
 * (stage/bed.test.ts) rather than listened for.
 */
export function bedParams(m: BedMood): BedParams {
  const t = clamp(m.threat, 0, 1.4);
  const p = clamp(m.progress);
  const hush = clamp(m.hush);
  const bloom = clamp(m.bloom);
  // A pulse from the first strike, quickening to being found.
  const pulsing = t >= 0.25;
  return {
    level: clamp(1 - m.dim),
    texture: clamp(1 - 0.55 * hush - 0.15 * Math.min(t, 1)),
    wander: clamp(1 - 0.75 * hush),
    cutoff: clamp(7000 * 2 ** (1.0 * p + 1.2 * bloom - 2.6 * t), 280, 16000),
    air: clamp(5 * p + 4 * bloom - 3 * Math.min(t, 1), -6, 8),
    pulse: pulsing
      ? { rate: 46 + 24 * (t - 0.25) / 1.15, gain: clamp(0.35 + 0.45 * (t / 1.4) + 0.2 * hush) }
      : { rate: 0, gain: 0 },
    warmth: bloom,
  };
}

/* ---------------- building blocks ---------------- */

type Noise = 'white' | 'pink' | 'brown';

const noiseCache = new WeakMap<BaseAudioContext, Map<Noise, AudioBuffer>>();

/** Four seconds of noise, made once per context and looped. */
function noiseBuffer(c: BaseAudioContext, kind: Noise): AudioBuffer {
  let byKind = noiseCache.get(c);
  if (!byKind) { byKind = new Map(); noiseCache.set(c, byKind); }
  const hit = byKind.get(kind);
  if (hit) return hit;
  const r = rngFor('bed-noise', kind);
  const length = c.sampleRate * 4;
  const buf = c.createBuffer(1, length, c.sampleRate);
  const d = buf.getChannelData(0);
  // Pink by Paul Kellet's economy filter; brown as leaky integrated white.
  let b0 = 0; let b1 = 0; let b2 = 0; let last = 0;
  for (let i = 0; i < length; i += 1) {
    const w = r() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // The loop's seam, smoothed over a few milliseconds.
  const fade = Math.floor(c.sampleRate * 0.01);
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    d[length - fade + i] = d[length - fade + i]! * (1 - k) + d[i]! * k;
  }
  byKind.set(kind, buf);
  return buf;
}

const roomCache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

/** A room, as an impulse response: decaying noise, seeded, in stereo. */
function room(c: BaseAudioContext, seconds: number): AudioBuffer {
  let bySize = roomCache.get(c);
  if (!bySize) { bySize = new Map(); roomCache.set(c, bySize); }
  const hit = bySize.get(seconds);
  if (hit) return hit;
  const length = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const r = rngFor('bed-room', `${seconds}:${ch}`);
    const d = buf.getChannelData(ch);
    for (let i = 0; i < length; i += 1) d[i] = (r() * 2 - 1) * (1 - i / length) ** 2.6;
  }
  bySize.set(seconds, buf);
  return buf;
}

/** What a layer is given to build with. */
interface Kit {
  c: BaseAudioContext;
  /** Straight into the setting's bus. */
  dry: AudioNode;
  /** Into the room first. */
  wet: AudioNode;
  /** A generator of its own, so one layer never reshuffles another. */
  rng: (salt: string) => Rng;
  /** What the mood asks for, as events are scheduled. */
  params: () => BedParams;
}

/** Something the bed is made of. */
interface Layer {
  start(at: number): void;
  /** Lay down events and wandering from `from` up to `until`, audio time. */
  schedule(from: number, until: number): void;
  stop(at: number): void;
}

/** Events at random intervals: each is scheduled once, ahead of time. */
function every(
  rng: Rng, gap: [number, number], fire: (at: number) => void,
): Pick<Layer, 'schedule'> {
  let next = -1;
  return {
    schedule(from, until) {
      // After a gap (a hidden page) or at the start: begin again from now.
      if (next < from) next = from + rng() * gap[0];
      while (next < until) {
        fire(next);
        next += range(rng, gap[0], gap[1]);
      }
    },
  };
}

/** A parameter that wanders: a new target every so often, eased towards. */
function wanders(
  param: AudioParam, rng: Rng, lo: number, hi: number, gap: [number, number], tau: number,
  depth: () => number,
): Pick<Layer, 'schedule'> {
  const mid = (lo + hi) / 2;
  return every(rng, gap, (at) => {
    const target = mid + (range(rng, lo, hi) - mid) * depth();
    param.setTargetAtTime(target, at, tau);
  });
}

/** Looped noise through a filter, into `dest`. Its gain and frequency can wander. */
function noiseBed(
  k: Kit, kind: Noise, type: BiquadFilterType, freq: number, q: number, gain: number, dest: AudioNode,
) {
  const src = k.c.createBufferSource();
  src.buffer = noiseBuffer(k.c, kind);
  src.loop = true;
  // Each bed starts somewhere else in the loop, so two never line up.
  const offset = k.rng(`${kind}:${type}:${freq}`)() * 3.5;
  const f = k.c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = k.c.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  return {
    filter: f,
    gain: g,
    start: (at: number) => src.start(at, offset),
    stop: (at: number) => { try { src.stop(at); } catch { /* never started */ } },
  };
}

function panned(c: BaseAudioContext, dest: AudioNode, pan: number): AudioNode {
  if (!c.createStereoPanner) return dest;
  const p = c.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
  p.connect(dest);
  return p;
}

function env(g: GainNode, at: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

/** A sine, swept, with a quick envelope. */
function blip(
  c: BaseAudioContext, dest: AudioNode, at: number,
  type: OscillatorType, from: number, to: number, peak: number, attack: number, decay: number,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + attack + decay * 0.6);
  env(g, at, peak, attack, decay);
  o.connect(g);
  g.connect(dest);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

/** A burst of noise, filtered: a pop, a grain, a rustle. */
function burst(
  c: BaseAudioContext, dest: AudioNode, at: number,
  type: BiquadFilterType, freq: number, peak: number, dur: number,
) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 'white');
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  env(g, at, peak, 0.001, dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(at, (at * 7.31) % 3.5);
  src.stop(at + dur + 0.02);
}

/* ---------------- what each setting is made of ---------------- */

/** Wind: a roar that gusts, and a whistle in it now and then. */
function wind(k: Kit, roar: [number, number], strength: number, whistle: number): Layer {
  const r = k.rng('wind');
  const low = noiseBed(k, 'pink', 'bandpass', (roar[0] + roar[1]) / 2, 0.7, 0.5 * strength, k.dry);
  const high = noiseBed(k, 'white', 'bandpass', 1300, 14, 0, k.dry);
  const depth = () => k.params().wander;
  const moves = [
    wanders(low.gain.gain, r, 0.2 * strength, 0.95 * strength, [1.4, 4], 1.1, depth),
    wanders(low.filter.frequency, r, roar[0], roar[1], [2, 5], 1.6, depth),
    wanders(high.gain.gain, r, 0, 0.4 * whistle, [2, 6], 1.4, depth),
    wanders(high.filter.frequency, r, 900, 1800, [3, 7], 2, depth),
  ];
  return {
    start: (at) => { low.start(at); high.start(at); },
    schedule: (from, until) => moves.forEach((m) => m.schedule(from, until)),
    stop: (at) => { low.stop(at); high.stop(at); },
  };
}

/** A water drop: a quick upward chirp, mostly heard as the room answering it. */
function drips(k: Kit, gap: [number, number], loud: number): Layer {
  const r = k.rng('drips');
  const fire = (at: number) => {
    const pan = range(r, -0.8, 0.8);
    const f = range(r, 900, 1900);
    const peak = range(r, 0.05, 0.12) * loud;
    const wet = panned(k.c, k.wet, pan);
    const dry = panned(k.c, k.dry, pan);
    blip(k.c, wet, at, 'sine', f, f * 1.9, peak, 0.002, 0.07);
    blip(k.c, dry, at, 'sine', f, f * 1.9, peak * 0.35, 0.002, 0.05);
    // Sometimes a second, from the same place.
    if (r() < 0.25) blip(k.c, wet, at + range(r, 0.12, 0.26), 'sine', f * 1.06, f * 2, peak * 0.6, 0.002, 0.06);
  };
  return { start: () => {}, stop: () => {}, ...every(r, gap, fire) };
}

/** A low tone of the place: a room, a sewer, the ground. */
function hum(k: Kit, freq: number, gain: number): Layer {
  const b = noiseBed(k, 'brown', 'lowpass', freq, 0.5, gain, k.dry);
  const r = k.rng(`hum:${freq}`);
  const move = wanders(b.gain.gain, r, gain * 0.7, gain * 1.15, [3, 8], 2.5, () => k.params().wander);
  return { start: b.start, stop: b.stop, schedule: move.schedule };
}

/** Water running somewhere below: a band of noise that never settles. */
function stream(k: Kit, gain: number): Layer {
  const r = k.rng('stream');
  const b = noiseBed(k, 'pink', 'bandpass', 800, 1.2, gain, k.dry);
  const depth = () => k.params().wander;
  const moves = [
    wanders(b.filter.frequency, r, 520, 1150, [1.5, 4], 1.2, depth),
    wanders(b.gain.gain, r, gain * 0.7, gain * 1.2, [1, 3], 0.8, depth),
  ];
  return { start: b.start, stop: b.stop, schedule: (f, u) => moves.forEach((m) => m.schedule(f, u)) };
}

/** Torches: pops in little clusters, close by. */
function crackle(k: Kit): Layer {
  const r = k.rng('crackle');
  const fire = (at: number) => {
    const pan = range(r, -0.35, 0.35);
    const dest = panned(k.c, k.dry, pan);
    const n = 1 + Math.floor(r() * 4);
    let t = at;
    for (let i = 0; i < n; i += 1) {
      burst(k.c, dest, t, 'highpass', range(r, 1200, 3200), range(r, 0.04, 0.16), range(r, 0.003, 0.009));
      t += range(r, 0.004, 0.028);
    }
    if (r() < 0.2) burst(k.c, k.wet, at, 'bandpass', 700, 0.05, 0.03);
  };
  return { start: () => {}, stop: () => {}, ...every(r, [0.12, 1.1], fire) };
}

/** Crickets, each at its own pitch and place, each with its own patience. */
function insects(k: Kit, count: number): Layer {
  const layers = Array.from({ length: count }, (_, i) => {
    const r = k.rng(`cricket:${i}`);
    const f = range(r, 3800, 5600);
    const pan = range(r, -0.9, 0.9);
    const dest = panned(k.c, k.dry, pan);
    const fire = (at: number) => {
      if (r() < 0.2) return; // a rest
      const pulses = 2 + Math.floor(r() * 3);
      const peak = range(r, 0.012, 0.028);
      for (let p = 0; p < pulses; p += 1) blip(k.c, dest, at + p * 0.032, 'sine', f, f * 0.985, peak, 0.004, 0.018);
    };
    return every(r, [0.45, 1.4], fire);
  });
  return {
    start: () => {}, stop: () => {},
    schedule: (from, until) => layers.forEach((l) => l.schedule(from, until)),
  };
}

/** Leaves moving: a rustle that comes and goes in gusts. */
function leaves(k: Kit, gain: number): Layer {
  const r = k.rng('leaves');
  const b = noiseBed(k, 'pink', 'bandpass', 2800, 0.9, 0, k.dry);
  const depth = () => k.params().wander;
  const moves = [
    wanders(b.gain.gain, r, 0, gain, [0.8, 2.6], 0.45, depth),
    wanders(b.filter.frequency, r, 1800, 4200, [1.5, 4], 1, depth),
  ];
  return { start: b.start, stop: b.stop, schedule: (f, u) => moves.forEach((m) => m.schedule(f, u)) };
}

/** Sand on the move: a steady hiss, high. */
function hiss(k: Kit, gain: number): Layer {
  const b = noiseBed(k, 'white', 'highpass', 4500, 0.7, gain, k.dry);
  const r = k.rng('hiss');
  const move = wanders(b.gain.gain, r, gain * 0.6, gain * 1.3, [1, 3], 0.9, () => k.params().wander);
  return { start: b.start, stop: b.stop, schedule: move.schedule };
}

/** A bell a long way off, struck now and then. Inharmonic, as a real one is. */
function bell(k: Kit, gap: [number, number]): Layer {
  const r = k.rng('bell');
  const fire = (at: number) => {
    const base = [98, 110, 131][Math.floor(r() * 3)]!;
    const far = k.c.createBiquadFilter();
    far.type = 'lowpass';
    far.frequency.value = 1600;
    far.connect(panned(k.c, k.wet, range(r, -0.5, 0.5)));
    const dry = k.c.createGain();
    dry.gain.value = 0.25;
    far.connect(dry);
    dry.connect(k.dry);
    for (const [ratio, peak, decay] of [[1, 0.06, 5], [2, 0.035, 3.5], [2.4, 0.025, 2.6], [3, 0.02, 2], [4.2, 0.012, 1.4]] as const) {
      blip(k.c, far, at, 'sine', base * ratio, base * ratio, peak, 0.004, decay);
    }
  };
  return { start: () => {}, stop: () => {}, ...every(r, gap, fire) };
}

/** Each setting: its room, and what it is made of. */
const RECIPES: Record<BiomeId, { room: number; wet: number; trim: number; layers: (k: Kit) => Layer[] }> = {
  'frozen-pass': { room: 1.2, wet: 0.15, trim: 1, layers: (k) => [wind(k, [180, 520], 1, 1)] },
  tower: {
    room: 4.5, wet: 0.5, trim: 1,
    layers: (k) => [wind(k, [250, 700], 0.6, 0.5), bell(k, [18, 40])],
  },
  dungeon: { room: 3.8, wet: 0.6, trim: 1, layers: (k) => [hum(k, 230, 0.3), drips(k, [0.8, 4], 1)] },
  undercity: {
    room: 2.5, wet: 0.35, trim: 1,
    layers: (k) => [stream(k, 0.3), hum(k, 140, 0.12), crackle(k), drips(k, [4, 10], 0.5)],
  },
  'deep-forest': {
    room: 0.8, wet: 0.2, trim: 1,
    layers: (k) => [hum(k, 240, 0.12), leaves(k, 0.5), insects(k, 3)],
  },
  desert: { room: 0.6, wet: 0.1, trim: 1, layers: (k) => [hiss(k, 0.06), wind(k, [300, 1100], 0.8, 0.2)] },
};

/** The bed's loudness against the voices, which play at full. */
const BED_LEVEL = 0.6;

/* ---------------- the graph ---------------- */

/** One setting's bed, built and running. */
export interface BedGraph {
  /** Ease towards what the mood asks; `instant` jumps there. */
  apply(p: BedParams, at: number, instant?: boolean): void;
  schedule(from: number, until: number): void;
  /** Push the whole bed down for a moment. */
  duck(depth: number, at: number, holdMs: number): void;
  /** How loud the bed is right now, 0..1 of what the mood can ask. */
  heard(): number;
  /** Fade out and stop by `at + fade`. */
  stop(at: number, fade: number): void;
}

/** A setting's bed on any context, into `out`. Silent until `apply`. */
export function buildBed(c: BaseAudioContext, out: AudioNode, biome: BiomeId, seed = 'bed'): BedGraph {
  const recipe = RECIPES[biome];
  let current = bedParams(CALM);

  // texture → lowpass → shelf ┐
  // room ──────────────────────┤→ level → duck → out
  // pulse ─────────────────────┤
  // warmth ────────────────────┘
  const duckGain = c.createGain();
  duckGain.connect(out);
  const level = c.createGain();
  level.gain.value = 0;
  level.connect(duckGain);
  const shelf = c.createBiquadFilter();
  shelf.type = 'highshelf';
  // Low enough to reach the wind's whistle and the leaves, not only the hiss.
  shelf.frequency.value = 2500;
  shelf.connect(level);
  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = current.cutoff;
  lowpass.Q.value = 0.5;
  lowpass.connect(shelf);
  const texture = c.createGain();
  texture.connect(lowpass);
  const convolver = c.createConvolver();
  convolver.buffer = room(c, recipe.room);
  const wetGain = c.createGain();
  wetGain.gain.value = recipe.wet;
  convolver.connect(wetGain);
  wetGain.connect(texture);
  const low = c.createGain();
  low.connect(level);

  // The warm chord, always running, silent until the party is through.
  const warm = c.createGain();
  warm.gain.value = 0;
  warm.connect(level);
  const chord = [196, 294, 392].map((f) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(warm);
    return o;
  });

  const kit: Kit = {
    c, dry: texture, wet: convolver,
    rng: (salt) => rngFor(seed, `${biome}:${salt}`),
    params: () => current,
  };
  const layers = recipe.layers(kit);

  // The pulse: lub-dub, low, felt as much as heard. A triangle an octave
  // up lets a laptop's small speakers carry it.
  const pulseRng = kit.rng('pulse');
  let nextPulse = -1;
  const pulse = (from: number, until: number) => {
    if (nextPulse < from) nextPulse = from + 0.2;
    while (nextPulse < until) {
      const { rate, gain } = current.pulse;
      if (rate <= 0) { nextPulse = until; break; }
      const peak = 0.5 * gain;
      for (const [dt, k] of [[0, 1], [0.2, 0.7]] as const) {
        blip(c, low, nextPulse + dt, 'sine', 58, 36, peak * k, 0.008, 0.18);
        blip(c, low, nextPulse + dt, 'triangle', 116, 72, peak * k * 0.25, 0.008, 0.12);
      }
      nextPulse += (60 / rate) * range(pulseRng, 0.97, 1.03);
    }
  };

  const start = c.currentTime;
  layers.forEach((l) => l.start(start));
  chord.forEach((o) => o.start(start));

  return {
    apply(p, at, instant = false) {
      current = p;
      const ease = (param: AudioParam, v: number, tau: number) => {
        if (instant) param.setValueAtTime(v, at);
        else param.setTargetAtTime(v, at, tau);
      };
      ease(level.gain, p.level * recipe.trim * BED_LEVEL, 1.0);
      ease(texture.gain, p.texture, 1.2);
      ease(lowpass.frequency, p.cutoff, 1.5);
      ease(shelf.gain, p.air, 1.5);
      ease(warm.gain, p.warmth * 0.05, 2.5);
    },
    schedule(from, until) {
      layers.forEach((l) => l.schedule(from, until));
      pulse(from, until);
    },
    heard: () => level.gain.value / (recipe.trim * BED_LEVEL),
    duck(depth, at, holdMs) {
      const g = duckGain.gain;
      g.cancelScheduledValues(at);
      g.setTargetAtTime(1 - depth, at, 0.04);
      g.setTargetAtTime(1, at + holdMs / 1000, 0.6);
    },
    stop(at, fade) {
      level.gain.cancelScheduledValues(at);
      level.gain.setTargetAtTime(0, at, fade / 4);
      const end = at + fade;
      layers.forEach((l) => l.stop(end));
      chord.forEach((o) => { try { o.stop(end); } catch { /* fine */ } });
      // Let go of the graph once it is silent.
      if (typeof window !== 'undefined') window.setTimeout(() => duckGain.disconnect(), (fade + 0.5) * 1000);
    },
  };
}

/* ---------------- ducking under the voices ---------------- */

/** How far, and for how long, each voice pushes the bed down. */
const DUCK: Partial<Record<Voice, [number, number]>> = {
  flip: [0.35, 400],
  slam: [0.6, 700],
  growl: [0.5, 900],
  dread: [0.7, 1600],
  swell: [0.3, 900],
  bell: [0.25, 1200],
  tumble: [0.4, 700],
  chime: [0.3, 600],
  buzz: [0.3, 400],
  thud: [0.3, 300],
  riffle: [0.4, 600],
  glint: [0.15, 300],
};

/* ---------------- the live bed ---------------- */

/** How far ahead events are laid down, and how often. */
const AHEAD = 1.0;
const TICK_MS = 250;
const FADE_OUT = 2.4;

let wanted: { biome: BiomeId; owner: object } | null = null;
let mood: BedMood = CALM;
let live: { biome: BiomeId; graph: BedGraph; ctx: AudioContext } | null = null;
let ticker: number | null = null;
let ducks = 0;

/** What is playing now, for the checks in scripts/capture-sound.cjs. */
export function bedNow(): {
  biome: BiomeId; params: BedParams; heard: number; state: AudioContextState; ducks: number;
} | null {
  return live
    ? { biome: live.biome, params: bedParams(mood), heard: live.graph.heard(), state: live.ctx.state, ducks }
    : null;
}

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * Bring what is playing in line with what is wanted. `jump`: a screen
 * has just taken the bed over, and it starts where that screen's mood is
 * (as the world's first frame does), rather than easing from the last.
 */
function refresh(jump = false): void {
  const want = isSoundOn() && wanted && !hidden() ? wanted.biome : null;
  if (live && live.biome === want) {
    if (jump) live.graph.apply(bedParams(mood), live.ctx.currentTime, true);
    return;
  }
  if (live) {
    live.graph.stop(live.ctx.currentTime, FADE_OUT);
    live = null;
  }
  if (!want) {
    if (ticker !== null) { window.clearInterval(ticker); ticker = null; }
    return;
  }
  const a = audio();
  if (!a) return;
  const graph = buildBed(a.ctx, a.master, want, `bed:${Date.now()}`);
  graph.apply(bedParams(mood), a.ctx.currentTime);
  live = { biome: want, graph, ctx: a.ctx };
  graph.schedule(a.ctx.currentTime, a.ctx.currentTime + AHEAD);
  if (ticker === null) {
    ticker = window.setInterval(() => {
      if (live) live.graph.schedule(live.ctx.currentTime, live.ctx.currentTime + AHEAD);
    }, TICK_MS);
  }
}

if (typeof window !== 'undefined') {
  subscribeSound(() => refresh());
  document.addEventListener('visibilitychange', () => refresh());
  onPlay((voice) => {
    const d = DUCK[voice];
    if (live && d) { live.graph.duck(d[0], live.ctx.currentTime, d[1]); ducks += 1; }
  });
}

/**
 * Play this setting's bed while mounted, moving with `mood`. The last
 * screen to ask is the one heard; nothing plays while sound is off.
 */
export function useBed(biome: BiomeId | null, m: BedMood): void {
  const owner = React.useRef({}).current;
  const first = React.useRef(m);
  first.current = m;
  React.useEffect(() => {
    if (!biome) return undefined;
    wanted = { biome, owner };
    mood = first.current;
    refresh(true);
    return () => {
      if (wanted?.owner !== owner) return;
      wanted = null;
      // A moment's grace: the next screen may want the same setting, and
      // then the bed carries on instead of starting again.
      window.setTimeout(() => { if (wanted === null) refresh(); }, 0);
    };
  }, [biome, owner]);
  React.useEffect(() => {
    mood = m;
    if (live) live.graph.apply(bedParams(m), live.ctx.currentTime);
  }, [m.threat, m.progress, m.hush, m.dim, m.bloom]);
}

/* ---------------- offline, to measure and to hear ---------------- */

/**
 * A bed rendered offline: `moods` change at their times, `ducks` push it
 * down at theirs. For scripts/capture-sound.cjs, which measures each
 * setting and writes what it rendered to listen to. Goes through the same
 * master level the live voices do.
 */
export async function renderBed(
  biome: BiomeId,
  seconds: number,
  moods: { at: number; mood: BedMood }[],
  ducks: { at: number; voice: Voice }[] = [],
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const c = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = c.createGain();
  master.gain.value = 0.5;
  master.connect(c.destination);
  const graph = buildBed(c, master, biome, 'render');
  // Mood by mood, as the live bed would meet them: the pulse and the
  // wind read the mood as their events are laid down.
  const steps = moods.length ? [...moods].sort((a, b) => a.at - b.at) : [{ at: 0, mood: CALM }];
  steps.forEach(({ at, mood: m }, i) => {
    graph.apply(bedParams(m), at, i === 0);
    graph.schedule(at, steps[i + 1]?.at ?? seconds);
  });
  for (const { at, voice } of ducks) {
    const d = DUCK[voice];
    if (d) graph.duck(d[0], at, d[1]);
  }
  return c.startRendering();
}

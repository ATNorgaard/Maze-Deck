/* ============================================================
   Sound.

   Half of what makes a card game feel like objects on a table is the
   sound they make. Everything here is synthesised with WebAudio at the
   moment it is needed — no asset files, nothing to load, nothing to
   ship — and every voice is short, quiet and low, because it plays
   under conversation at a real table.

   Off by default. One toggle, remembered per device. A player's phone
   stays silent unless its owner turns it on. `play()` is a no-op while
   off, so callers never check.
   ============================================================ */

import * as React from 'react';
import type { Beat } from './beats';
import { MOTION } from './motion';

export type Voice =
  /** A card sliding across the table. */
  | 'slide'
  /** A card turning over. */
  | 'flip'
  /** A pip filling. */
  | 'tick'
  /** A die in the air: a run of clicks that slows. */
  | 'tumble'
  /** A check passed. */
  | 'chime'
  /** A check failed. */
  | 'buzz'
  /** A Monster. Low, and felt more than heard. */
  | 'growl'
  /** A blocker landing where it is. */
  | 'thud'
  /** A card dropping onto a pile. */
  | 'drop'
  /** The turn passing. */
  | 'baton';

const KEY = 'mazedeck.sound';

let enabled = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const listeners = new Set<() => void>();

try {
  enabled = window.localStorage.getItem(KEY) === 'on';
} catch { /* storage blocked: stays off */ }

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isSoundOn(): boolean { return enabled; }

/** Flip the switch. Call from a user gesture: that is what unlocks audio. */
export function setSoundOn(on: boolean): void {
  enabled = on;
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* fine */ }
  if (on) { context(); play('baton'); }
  for (const l of listeners) l();
}

export function useSoundOn(): [boolean, (on: boolean) => void] {
  const on = React.useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    isSoundOn,
    () => false,
  );
  return [on, setSoundOn];
}

/* ---------------- voices ---------------- */

type Osc = OscillatorType;

function tone(
  c: AudioContext, at: number, type: Osc, from: number, to: number,
  dur: number, peak: number, attack = 0.005,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(master as GainNode);
  o.start(at);
  o.stop(at + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(c: AudioContext, at: number, dur: number, peak: number, lowpassFrom: number, lowpassTo: number) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== c.sampleRate) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(lowpassFrom, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(lowpassTo, 20), at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master as GainNode);
  src.start(at);
  src.stop(at + dur + 0.02);
}

const VOICES: Record<Voice, (c: AudioContext, at: number) => void> = {
  slide: (c, at) => noise(c, at, 0.14, 0.18, 2200, 500),
  flip: (c, at) => {
    noise(c, at, 0.05, 0.22, 4000, 1200);
    tone(c, at + 0.03, 'sine', 520, 780, 0.09, 0.08);
  },
  tick: (c, at) => {
    tone(c, at, 'sine', 880, 880, 0.07, 0.16);
    tone(c, at + 0.04, 'sine', 1320, 1320, 0.05, 0.09);
  },
  tumble: (c, at) => {
    // Seven clicks, each a little later than the last.
    let t = at;
    for (let i = 0; i < 7; i += 1) {
      noise(c, t, 0.03, 0.14 - i * 0.012, 3000, 800);
      t += 0.05 + i * 0.022;
    }
  },
  chime: (c, at) => {
    tone(c, at, 'sine', 660, 660, 0.35, 0.14, 0.02);
    tone(c, at + 0.12, 'sine', 990, 990, 0.42, 0.12, 0.02);
  },
  buzz: (c, at) => tone(c, at, 'square', 160, 120, 0.22, 0.06, 0.01),
  growl: (c, at) => {
    tone(c, at, 'sawtooth', 55, 42, 0.7, 0.12, 0.05);
    noise(c, at, 0.5, 0.06, 400, 120);
  },
  thud: (c, at) => {
    tone(c, at, 'sine', 90, 38, 0.22, 0.28);
    noise(c, at, 0.06, 0.12, 900, 200);
  },
  drop: (c, at) => {
    tone(c, at, 'sine', 140, 70, 0.1, 0.12);
    noise(c, at, 0.04, 0.1, 1800, 400);
  },
  baton: (c, at) => tone(c, at, 'sine', 520, 520, 0.08, 0.07, 0.01),
};

/**
 * What a beat sounds like. Called as the beat starts, so a voice that
 * belongs to its end (the card landing on the discard) is delayed by
 * the beat's own length.
 */
export function cue(beat: Beat): void {
  if (!enabled) return;
  switch (beat.kind) {
    case 'reveal': play('flip', 40); break;
    case 'depart': play('slide'); play('drop', MOTION.fly - 40); break;
    case 'settle': play('thud'); break;
    case 'discard': play('drop'); break;
    case 'progress': play('tick'); break;
    case 'strike': play('growl'); break;
    case 'deal':
      beat.slots.forEach((_, i) => play('slide', i * MOTION.dealStagger));
      break;
    case 'turn': if (beat.from !== beat.to) play('baton'); break;
    case 'sync': break;
  }
}

/** The same voice asked for twice within this window plays once. */
const DEDUPE_MS = 40;
const lastPlayed = new Map<string, number>();

/**
 * Play one voice, optionally a little later. No-op while sound is off.
 *
 * Deduplicated: React's StrictMode runs effects twice in development,
 * and two dice share one tumble. Nothing on this table legitimately
 * makes the same sound twice in 40ms.
 */
export function play(voice: Voice, delayMs = 0): void {
  if (!enabled) return;
  const c = context();
  if (!c || !master) return;
  const key = `${voice}:${delayMs}`;
  const now = performance.now();
  if ((lastPlayed.get(key) ?? -Infinity) > now - DEDUPE_MS) return;
  lastPlayed.set(key, now);
  try {
    VOICES[voice](c, c.currentTime + delayMs / 1000);
  } catch { /* an odd browser; silence is fine */ }
}

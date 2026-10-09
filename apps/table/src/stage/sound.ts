/* ============================================================
   Sound.

   Half of what makes a card game feel like objects on a table is the
   sound they make. Everything here is synthesised with WebAudio at the
   moment it is needed — no asset files, nothing to load, nothing to
   ship — and every voice is short, quiet and low, because it plays
   under conversation at a real table.

   Off by default. One toggle, remembered per device, and the threshold
   asks once (DECISIONS O6). A player's phone stays silent unless its
   owner turns it on. `play()` is a no-op while off, so callers never
   check.

   Under the voices, each setting's bed (bed.ts) plays on the same
   toggle; every voice played here ducks it for a moment.
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
  | 'baton'
  /** The river jammed and swept: one heavy blow. */
  | 'slam'
  /** The discard riffled back into the deck. */
  | 'riffle'
  /** Found: a low swell that does not resolve. */
  | 'dread'
  /** A new round: a soft, low bell. */
  | 'bell'
  /** A Clear Path's light pouring out: an airy rise. */
  | 'swell'
  /** An Item's glint: a small high ring. */
  | 'glint';

const KEY = 'mazedeck.sound';

let enabled = false;
/** Whether this device has ever said: set by the toggle or the threshold's question. */
let chosen = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const listeners = new Set<() => void>();
const playListeners = new Set<(voice: Voice) => void>();

try {
  const stored = window.localStorage.getItem(KEY);
  enabled = stored === 'on';
  chosen = stored === 'on' || stored === 'off';
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

/** Whether this device has been asked, or has answered without being asked. */
export function isSoundChosen(): boolean { return chosen; }

/** Flip the switch. Call from a user gesture: that is what unlocks audio. */
export function setSoundOn(on: boolean): void {
  enabled = on;
  chosen = true;
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* fine */ }
  if (on) { context(); play('baton'); }
  for (const l of listeners) l();
}

/** The context and the master level, made on first use; null where there is no WebAudio. */
export function audio(): { ctx: AudioContext; master: GainNode } | null {
  const c = context();
  return c && master ? { ctx: c, master } : null;
}

/** Told whenever the switch moves. Returns the unsubscribe. */
export function subscribeSound(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Told of every voice that actually plays, as it plays. */
export function onPlay(l: (voice: Voice) => void): () => void {
  playListeners.add(l);
  return () => { playListeners.delete(l); };
}

// A page reloaded with sound on makes its context without a gesture, and
// a browser keeps that context suspended. The first tap or key wakes it.
if (typeof window !== 'undefined') {
  const wake = () => { if (enabled && ctx?.state === 'suspended') void ctx.resume(); };
  window.addEventListener('pointerdown', wake, { capture: true });
  window.addEventListener('keydown', wake, { capture: true });
}

export function useSoundOn(): [boolean, (on: boolean) => void] {
  const on = React.useSyncExternalStore(subscribeSound, isSoundOn, () => false);
  return [on, setSoundOn];
}

/** Whether to ask: true until this device has answered once. */
export function useSoundChosen(): boolean {
  return React.useSyncExternalStore(subscribeSound, isSoundChosen, () => true);
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
  slam: (c, at) => {
    tone(c, at, 'sine', 70, 30, 0.4, 0.32);
    noise(c, at, 0.25, 0.2, 1400, 160);
  },
  riffle: (c, at) => {
    // A dozen quick flicks, close together, then the deck squared up.
    for (let i = 0; i < 12; i += 1) noise(c, at + i * 0.028, 0.02, 0.09, 5000, 2200);
    tone(c, at + 0.4, 'sine', 120, 80, 0.08, 0.1);
  },
  dread: (c, at) => {
    tone(c, at, 'sawtooth', 41, 36, 1.4, 0.1, 0.6);
    tone(c, at, 'sine', 82, 73, 1.4, 0.08, 0.5);
    noise(c, at, 1.2, 0.05, 300, 90);
  },
  bell: (c, at) => {
    tone(c, at, 'sine', 196, 196, 1.6, 0.09, 0.01);
    tone(c, at, 'sine', 392, 392, 1.1, 0.04, 0.01);
    tone(c, at, 'sine', 587, 587, 0.7, 0.02, 0.01);
  },
  swell: (c, at) => {
    tone(c, at, 'sine', 440, 660, 0.9, 0.06, 0.35);
    tone(c, at + 0.08, 'sine', 660, 990, 0.8, 0.04, 0.3);
    noise(c, at, 0.7, 0.03, 6000, 2500);
  },
  glint: (c, at) => {
    tone(c, at, 'sine', 1760, 1760, 0.25, 0.06, 0.004);
    tone(c, at + 0.05, 'sine', 2640, 2640, 0.3, 0.035, 0.004);
  },
};

/**
 * What a beat sounds like. Called as the beat starts, so a voice that
 * belongs to its end (the card landing on the discard) is delayed by
 * the beat's own length.
 *
 * With the board's signatures (phase 6) a reveal also sounds like
 * what turned up, and the Monster's growl moves from its strike to its
 * reveal, where the red seeps in; the strike that follows is a blow.
 */
export function cue(beat: Beat, signatures = false): void {
  if (!enabled) return;
  switch (beat.kind) {
    case 'reveal':
      play('flip', 40);
      if (!signatures) break;
      if (beat.category === 'clear-path') play('swell', MOTION.flip / 2);
      else if (beat.category === 'monster') play('growl', MOTION.flip / 2);
      else if (beat.category === 'obstacle') play('slam', Math.round(MOTION.flip * 0.45) + 220);
      else if (beat.category === 'item') play('glint', MOTION.flipSlow);
      break;
    case 'depart': play('slide'); play('drop', MOTION.fly - 40); break;
    case 'settle': play('thud'); break;
    case 'discard': play('drop'); break;
    case 'progress': play('tick'); break;
    case 'strike': play(signatures ? 'thud' : 'growl'); break;
    case 'deal':
      beat.slots.forEach((_, i) => play('slide', i * MOTION.dealStagger));
      break;
    case 'jam':
      play('slam');
      beat.slots.forEach((_, i) => play('slide', 60 + i * MOTION.sweepStagger));
      break;
    // The Monster lands on the pile, and is heard doing it.
    case 'feed': play('slide'); play('growl', MOTION.feed - 160); break;
    case 'reshuffle': play('riffle'); break;
    case 'found': play('dread'); break;
    case 'turn':
      if (beat.from !== beat.to) play('baton');
      if (beat.round) play('bell', 120);
      break;
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
  if (delayMs > 0) window.setTimeout(() => { for (const l of playListeners) l(voice); }, delayMs);
  else for (const l of playListeners) l(voice);
}

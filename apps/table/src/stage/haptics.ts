/* ============================================================
   Haptics: the beats, felt (docs/overhaul.md, phase 8).

   A phone at the table spends most of the crossing face up beside a
   drink, or in a pocket. What happens on the board can reach it as a
   touch: a light tick for ground gained, a long buzz for a strike, a
   pattern nobody could mistake for being found, and the double tap that
   says it is your turn.

   On by default — unlike sound, it disturbs nobody else — and one
   toggle, remembered per device. `buzz()` does nothing where the device
   cannot vibrate (desktops, iPhones), so callers never check.
   ============================================================ */

import * as React from 'react';
import type { Beat } from './beats';

const KEY = 'mazedeck.haptics';

let enabled = true;
const listeners = new Set<() => void>();

try {
  enabled = window.localStorage.getItem(KEY) !== 'off';
} catch { /* storage blocked: stays on */ }

export function hapticsOn(): boolean { return enabled; }

export function setHapticsOn(on: boolean): void {
  enabled = on;
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* fine */ }
  if (on) buzz(18);
  for (const l of listeners) l();
}

export function useHapticsOn(): [boolean, (on: boolean) => void] {
  const on = React.useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    hapticsOn,
    () => true,
  );
  return [on, setHapticsOn];
}

/** Whether this device can be felt at all. */
export function canBuzz(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** One pattern: milliseconds on, off, on… No-op while off or unsupported. */
export function buzz(pattern: number | number[]): void {
  if (!enabled || !canBuzz()) return;
  try { navigator.vibrate(pattern); } catch { /* an odd browser; stillness is fine */ }
}

/** The patterns, by moment. */
export const FEEL = {
  /** Your turn: two taps. */
  turn: [40, 60, 40],
  /** Ground gained: one light tick. */
  progress: 14,
  /** A strike: one long buzz. */
  strike: 260,
  /** The river jammed: two hard knocks. */
  jam: [70, 50, 70],
  /** Found: a rising pattern nobody could mistake. */
  found: [90, 70, 90, 70, 320],
  /** A thrown die landing. */
  landed: 30,
} as const;

/** What a beat feels like, if anything: only the ones that matter. */
export function feel(beat: Beat): void {
  switch (beat.kind) {
    case 'progress': buzz(FEEL.progress); break;
    case 'strike': buzz(FEEL.strike); break;
    case 'jam': buzz([...FEEL.jam]); break;
    case 'found': buzz([...FEEL.found]); break;
    default: break;
  }
}

/* ============================================================
   How much of the world this device draws.

   One choice, remembered per device like the sound: `auto` lets the
   world pick its tier and step down if frames run long; the others
   pin it. `off` is the old ground — the setting's animated picture
   on the page — and is the kill switch if a device misbehaves.
   ============================================================ */

import * as React from 'react';

export type Tier = 'high' | 'low' | 'still';
export type WorldChoice = 'auto' | Tier | 'off';

export const WORLD_CHOICES: readonly { id: WorldChoice; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'high', name: 'Full' },
  { id: 'low', name: 'Light' },
  { id: 'still', name: 'Still' },
  { id: 'off', name: 'Off' },
];

const KEY = 'mazedeck.world';
const listeners = new Set<() => void>();

function isChoice(x: unknown): x is WorldChoice {
  return WORLD_CHOICES.some((c) => c.id === x);
}

let choice: WorldChoice = 'auto';
try {
  const stored = window.localStorage.getItem(KEY);
  if (isChoice(stored)) choice = stored;
} catch { /* storage blocked: auto */ }

export function setWorldChoice(next: WorldChoice): void {
  choice = next;
  try { window.localStorage.setItem(KEY, next); } catch { /* not remembered */ }
  for (const l of listeners) l();
}

export function useWorldChoice(): [WorldChoice, (next: WorldChoice) => void] {
  const value = React.useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => choice,
  );
  return [value, setWorldChoice];
}

/**
 * Where an `auto` world starts. A phone or a machine with few cores
 * starts light; everything else starts full and is watched, and steps
 * down if it cannot keep up (World.tsx).
 */
export function startingTier(): Tier {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return cores >= 4 && !coarse ? 'high' : 'low';
}

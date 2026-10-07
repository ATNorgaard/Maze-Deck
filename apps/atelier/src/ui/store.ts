import { useCallback, useState } from 'react';

const PREFIX = 'maze-deck.atelier.v1.';

/**
 * A recipe in the URL. `?biome=tower&seed=x` sets the globals;
 * `?back.mode=scene&ground.animate=1` sets a bench's fields. Values
 * take the type of the field's default. This is what lets a script
 * (scripts/bake-art.cjs) ask the atelier for a specific picture.
 */
function fromQuery<T extends object>(key: string, initial: T): Partial<T> {
  const out: Partial<T> = {};
  if (typeof location === 'undefined') return out;
  const prefix = key === 'globals' ? '' : `${key}.`;
  for (const [k, v] of new URLSearchParams(location.search)) {
    if (!k.startsWith(prefix)) continue;
    const field = k.slice(prefix.length);
    if (!Object.prototype.hasOwnProperty.call(initial, field)) continue;
    const cur = (initial as Record<string, unknown>)[field];
    (out as Record<string, unknown>)[field] =
      typeof cur === 'number' ? Number(v)
      : typeof cur === 'boolean' ? v === '1' || v === 'true'
      : v;
  }
  return out;
}

/** React state mirrored to localStorage, so a recipe survives a reload. */
export function useStored<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void, () => void] {
  const full = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    let stored: Partial<T> = {};
    try {
      const raw = localStorage.getItem(full);
      if (raw) stored = JSON.parse(raw) as Partial<T>;
    } catch { /* a fresh start is fine */ }
    return { ...initial, ...stored, ...fromQuery(key, initial) };
  });
  const patch = useCallback((p: Partial<T>) => {
    setValue((v) => {
      const next = { ...v, ...p };
      try { localStorage.setItem(full, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
      return next;
    });
  }, [full]);
  const reset = useCallback(() => {
    try { localStorage.removeItem(full); } catch { /* ignore */ }
    setValue(initial);
  }, [full, initial]);
  return [value, patch, reset];
}

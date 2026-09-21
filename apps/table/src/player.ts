/* ============================================================
   Who this browser is.

   Not an account and not a password: an anonymous id the device
   keeps, so a player who reloads or comes back next week lands
   back on their own seat. See docs/DECISIONS.md P5.
   ============================================================ */

const KEY = 'mazedeck.player.v1';

export interface PlayerIdentity {
  playerId: string;
  /** Last seat claimed, per join code, so returning is one tap. */
  seats: Record<string, string>;
}

function fresh(): PlayerIdentity {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return { playerId: id, seats: {} };
}

export function loadIdentity(): PlayerIdentity {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const made = fresh();
      window.localStorage.setItem(KEY, JSON.stringify(made));
      return made;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
    if (!parsed.playerId) return fresh();
    return { playerId: parsed.playerId, seats: parsed.seats ?? {} };
  } catch {
    return fresh();
  }
}

export function rememberSeat(code: string, seatId: string): void {
  try {
    const id = loadIdentity();
    id.seats[code] = seatId;
    window.localStorage.setItem(KEY, JSON.stringify(id));
  } catch { /* storage blocked; the server remembers anyway */ }
}

/**
 * Where the session authority lives.
 *
 * In production the same Vercel deployment serves this app and the
 * /api/session functions, so the server is wherever the page came from
 * and there is nothing to configure. `VITE_SESSION_ENDPOINT` overrides
 * it, which is how a `vite dev` app on 5180 points at a deployment —
 * or at `vercel dev`, which serves both halves the way production does.
 */
export const API_BASE: string =
  (import.meta.env.VITE_SESSION_ENDPOINT as string | undefined)?.replace(/\/+$/, '')
  ?? (typeof window === 'undefined' ? '' : window.location.origin);

/**
 * The Realtime topic, or nothing.
 *
 * These two are public by construction: `maze_sessions` has RLS on and
 * no policies, so the publishable key opens no door to the database at
 * all, and the topic itself carries a version number and nothing else.
 * The deck is never on this wire.
 *
 * Absent, the game still works — RemoteSession falls back to polling.
 * It is slower and it is not what anyone should ship, but a missing
 * environment variable should not be the thing that ends a session.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const REALTIME: { url: string; anonKey: string } | null =
  url && anonKey ? { url, anonKey } : null;

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

/** Where the session server lives. Overridable at build time. */
export const SESSION_ENDPOINT: string =
  import.meta.env.VITE_SESSION_ENDPOINT ?? 'http://localhost:8787';

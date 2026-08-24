/* ============================================================
   The wire.

   Shared by the browser and the Durable Object, so the two cannot
   drift. Nothing here carries game secrets: the server sends a
   GameView, which is already the redacted form.
   ============================================================ */

import type { GameAction } from './types';
import type { GameView, Viewer } from './view';

/** How a client asks to be let in. */
export interface JoinRequest {
  /** The session's join code, as typed. */
  code: string;
  /** GM if they hold the run's key, otherwise a seat. */
  role: 'gm' | 'player';
  /** Which seat a player is claiming. */
  seatId?: string;
  /**
   * The browser's anonymous, persistent id. Not a password — it
   * identifies a returning device so a reconnect lands back on the
   * same seat. See DECISIONS P5.
   */
  playerId: string;
}

export type ClientMessage =
  | ({ t: 'join' } & JoinRequest)
  | { t: 'action'; action: GameAction }
  | { t: 'ping' };

export interface Presence {
  seatId: string | null;
  role: 'gm' | 'player';
  connected: boolean;
}

export type ServerMessage =
  /** Accepted. Carries the first view and who the server thinks you are. */
  | { t: 'welcome'; viewer: Viewer; view: GameView; presence: Presence[] }
  /** The state moved. Full view each time — they are small. */
  | { t: 'view'; view: GameView; presence: Presence[] }
  /** Refused, or something went wrong. Never fatal on its own. */
  | { t: 'error'; message: string }
  /** The run has not started yet. */
  | { t: 'waiting'; presence: Presence[] }
  | { t: 'pong' };

/**
 * Join codes are short and safe to read aloud across a table.
 *
 * I, O, 0 and 1 are left out, so there is no pair a listener can
 * confuse — which is why normalising does NOT try to remap
 * lookalikes. There is nothing to remap them to, and a well-meant
 * substitution would corrupt a code that was typed correctly.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function makeJoinCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'A';
  }
  return out;
}

/** Tidy a typed code: case and stray punctuation only. */
export function normaliseJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}

export function isJoinCode(input: string): boolean {
  const code = normaliseJoinCode(input);
  return code.length === CODE_LENGTH
    && [...code].every((c) => CODE_ALPHABET.includes(c));
}

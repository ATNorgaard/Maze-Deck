/* ============================================================
   Who is allowed to send what.

   The engine deliberately does not check this. `apply` will
   happily let a player overrule their own failed roll, because
   the engine's job is the rules, not the table's politics.

   So this is the server's job, and it lives here — pure, and
   next to the rules it defends — so the Durable Object and the
   client can run exactly the same check. The client uses it to
   grey a control out; the server uses it to refuse. Only the
   server's answer counts.
   ============================================================ */

import type { GameAction } from './types';
import type { GameView, Viewer } from './view';

export type Verdict = { ok: true } | { ok: false; reason: string };

const OK: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

/**
 * How long a revealed card is held before it resolves.
 *
 * The server owns this timer, so client and server must agree on it:
 * the board's flip-hold-fly runs slightly under, and the state changes
 * once the card has landed.
 */
/**
 * How long a picked card is held face up before it resolves. Long enough
 * for the turn (520ms), the flare of its light (700ms, overlapping) and a
 * beat of stillness after — the table's own choreography, not a rule.
 */
export const REVEAL_MS = 1800;

/** Actions no client may ever send, whatever their role. */
function serverOwned(action: GameAction): boolean {
  // The reveal advances on the server's own clock. Making it
  // unsendable is what stops two clients double-resolving it.
  return action.type === 'ADVANCE_REVEAL';
}

/** Actions that are the GM's alone, even on a player's turn. */
function gmOnly(action: GameAction): boolean {
  switch (action.type) {
    // Letting a roll land, or overturning it, is the GM's call. A
    // player who could send this could pass every check they failed.
    case 'CONFIRM_CHECK':
    // Combat happened at the table; the GM reports what happened.
    case 'RESOLVE_ENCOUNTER':
    case 'END_RUN':
      return true;
    // A Wanderer lingering or moving on is a scene decision, not a
    // move — the card's own rule hands it to the GM.
    case 'RESOLVE_CHOICE':
      return action.payload.kind === 'wanderer-stays';
    default:
      return false;
  }
}

function isActiveSeat(v: GameView, seatId: string): boolean {
  if (v.order.length === 0) return false;
  return v.order[v.turn % v.order.length] === seatId;
}

/**
 * May this actor send this action, given what the table looks like?
 *
 * Takes the VIEW rather than the state so both sides can call it —
 * everything it needs is public.
 */
export function mayAct(v: GameView, actor: Viewer, action: GameAction): Verdict {
  if (serverOwned(action)) {
    return no('The server advances the reveal on its own.');
  }

  if (v.phase === 'over') {
    return no('The run is over.');
  }

  if (actor.role === 'gm') return OK;

  if (gmOnly(action)) {
    return no('Only the GM can do that.');
  }

  if (!isActiveSeat(v, actor.seatId)) {
    return no('It is not your turn.');
  }

  return OK;
}

/**
 * The server's own dispatch of the reveal, which bypasses `mayAct`.
 *
 * Idempotent by construction: if the phase has already moved on —
 * a second alarm, a reconnect, a duplicate timer — this says no and
 * the action is dropped rather than double-resolving.
 */
export function mayAdvanceReveal(v: GameView): boolean {
  return v.phase === 'reveal';
}

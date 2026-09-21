/* ============================================================
   The session authority.

   This is workers/session/src/room.ts, moved. Same job, same shape,
   same refusals: own GameState, refuse what mayAct rejects, own the
   reveal clock, emit only views.

   Three things a Durable Object gave for free had to be rebuilt:

   1. ONE THREAD.  A DO handled messages one at a time. Here every
      write is a compare-and-swap on `version` (see server/store.ts), and a
      lost swap re-reads and re-applies. `attempt()` is that loop.

   2. THE ALARM.   `storage.setAlarm` has no serverless equivalent at
      this granularity, so the reveal deadline is a column and a client
      may only NUDGE it — `tick` refuses before `reveal_due_at`, and
      `mayAdvanceReveal` refuses a nudge that arrives after the phase
      has already moved. No client can make the reveal land early, and
      no two nudges can double-resolve it. ADVANCE_REVEAL stays
      unsendable through `act`, exactly as authority.ts says.

   3. A SOCKET PER VIEWER.  A DO wrote a separate redaction down each
      socket. Realtime broadcasts one payload to a topic, which cannot
      carry a per-recipient redaction — so it carries no game data at
      all, just a version number, and each client comes back to `view`
      for its own. The redaction still happens once per recipient, in
      exactly the place it did before.

   Presence moved the other way: it used to be derived from
   ctx.getWebSockets(), and is now Supabase Realtime presence, tracked
   by the clients themselves. This file no longer knows who is looking.
   ============================================================ */

import { apply, createGame, IllegalActionError } from '../../packages/rules/src/engine.js';
import { mayAct, mayAdvanceReveal } from '../../packages/rules/src/authority.js';
import { isJoinCode, normaliseJoinCode } from '../../packages/rules/src/protocol.js';
import { view } from '../../packages/rules/src/view.js';
import type { GameAction } from '../../packages/rules/src/types.js';
import type { Viewer } from '../../packages/rules/src/view.js';
import type { RunSetup, SeatOffer } from '../../packages/rules/src/protocol.js';
// In server/, not api/: api/ is a routes directory and everything in it
// is reachable, so shared plumbing does not belong there. (An earlier
// note here blamed the _-prefix for a deploy failure. It was innocent --
// _-prefixed files are built fine. The culprit was the module system.)
import { bump, create, read, swap, topicFor } from '../../server/store.js';
import type { Patch, Row } from '../../server/store.js';

export const config = { maxDuration: 15 };

/* ---------------- replies ---------------- */

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Rooms are never cacheable: the whole point is that they moved.
      'Cache-Control': 'no-store',
    },
  });

/** A refusal. Never fatal on its own — the client shows it and carries on. */
const refuse = (message: string, status = 200): Response =>
  json({ error: message }, status);

/* ---------------- who is asking ---------------- */

/**
 * The GM is whoever opened the room, not whoever claims to be.
 *
 * A client asking for 'gm' without the id that created the room is not
 * an error to be argued with — it is simply somebody else, and gets
 * seated as a player or offered the roster.
 */
function viewerFor(row: Row, playerId: string): Viewer | null {
  if (row.gm_player_id !== null && row.gm_player_id === playerId) return { role: 'gm' };
  const seatId = row.seats[playerId];
  return seatId ? { role: 'player', seatId } : null;
}

/** The roster, marked with what is already claimed by somebody else. */
function seatOffers(row: Row, asking: string): SeatOffer[] {
  const seats = row.state?.config.seats ?? [];
  return seats.map((s) => {
    const holder = Object.entries(row.seats).find(([, sid]) => sid === s.id)?.[0];
    const offer: SeatOffer = {
      id: s.id,
      name: s.name,
      taken: holder !== undefined && holder !== asking,
    };
    if (s.cls !== undefined) offer.cls = s.cls;
    return offer;
  });
}

/** What every successful reply carries: your view, and nothing else's. */
function snapshotFor(row: Row, viewer: Viewer): unknown {
  return {
    viewer,
    view: row.state ? view(row.state, viewer) : null,
    version: row.version,
    topic: topicFor(row.code),
  };
}

/* ---------------- the compare-and-swap loop ---------------- */

const ATTEMPTS = 5;

/**
 * Read, decide, write — and if somebody else wrote first, do it again
 * against what they wrote.
 *
 * `decide` must be pure with respect to the row it is handed: it is
 * called once per attempt, and any attempt but the last may be thrown
 * away. It returns a Patch to write, or a Response to send instead
 * (a refusal, which needs no write and must not be retried).
 */
async function attempt(
  code: string,
  decide: (row: Row) => Patch | Response,
  reply: (row: Row) => unknown = (row) => ({ ok: true, version: row.version }),
): Promise<Response> {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const row = await read(code);
    if (!row) return refuse('No session with that code.', 404);

    const decided = decide(row);
    if (decided instanceof Response) return decided;

    const written = await swap(code, row.version, decided);
    if (written) {
      await bump(code, written.version);
      return json(reply(written));
    }
    // Somebody else got there first. Their write is now the truth, so
    // go back and decide again against it.
  }
  return refuse('The table is busy — try that again.', 409);
}

/* ---------------- the operations ---------------- */

/** Open a session here. Whoever does this is its GM. */
async function opCreate(code: string, playerId: string, setup: RunSetup): Promise<Response> {
  // The seed is generated HERE and never travels. It is the one value
  // that would let a browser compute the whole deck. See view.ts.
  const state = createGame({ ...setup, seed: crypto.randomUUID() });
  const fresh: Patch = { state, gm_player_id: playerId, seats: {} };

  const made = await create(code, fresh);
  if (made) {
    await bump(code, made.version);
    return json(snapshotFor(made, { role: 'gm' }));
  }

  // The code is taken. That is fine if it is taken by this GM —
  // re-creating is how they start a fresh crossing in the same room.
  const row = await read(code);
  if (!row) return refuse('That code is already in use.');
  if (row.gm_player_id !== playerId) return refuse('That code is already in use.');

  const written = await swap(code, row.version, fresh);
  if (!written) return refuse('The table is busy — try that again.', 409);
  await bump(code, written.version);
  return json(snapshotFor(written, { role: 'gm' }));
}

/** Come back to a session, claiming a seat or asking who is at the table. */
async function opJoin(
  code: string,
  playerId: string,
  role: 'gm' | 'player',
  seatId: string | undefined,
): Promise<Response> {
  const row = await read(code);
  if (!row) return refuse('No session with that code.', 404);

  const isGm = row.gm_player_id !== null && row.gm_player_id === playerId;
  if (role === 'gm' && !isGm) return refuse('This session already has a GM.');
  if (isGm) return json(snapshotFor(row, { role: 'gm' }));

  const claimed = seatId ?? row.seats[playerId];
  const seat = row.state?.config.seats.find((s) => s.id === claimed);
  if (!seat) {
    // Not an error: a player cannot know the roster until they arrive,
    // so arriving without a seat is how you ask for it.
    return json({ seats: seatOffers(row, playerId), topic: topicFor(code) });
  }

  // Already holding it — no write, so two reloads do not race each other.
  if (row.seats[playerId] === seat.id) {
    return json(snapshotFor(row, { role: 'player', seatId: seat.id }));
  }

  const taken = Object.entries(row.seats).find(([id, sid]) => sid === seat.id && id !== playerId);
  if (taken) return refuse('Somebody already has that seat.');

  const written = await swap(code, row.version, {
    seats: { ...row.seats, [playerId]: seat.id },
  });
  if (!written) return refuse('The table is busy — try that again.', 409);
  await bump(code, written.version);
  return json(snapshotFor(written, { role: 'player', seatId: seat.id }));
}

/** Your own redaction of wherever the room has got to. */
async function opView(code: string, playerId: string): Promise<Response> {
  const row = await read(code);
  if (!row) return refuse('No session with that code.', 404);

  const viewer = viewerFor(row, playerId);
  if (!viewer) return json({ seats: seatOffers(row, playerId), topic: topicFor(code) });
  return json(snapshotFor(row, viewer));
}

/** Try to do something. The refusal here is the one that counts. */
async function opAct(code: string, playerId: string, action: GameAction): Promise<Response> {
  return attempt(
    code,
    (row) => {
      if (!row.state) return refuse('No run here yet.');
      const viewer = viewerFor(row, playerId);
      if (!viewer) return refuse('Join first.');

      // The same check the client ran to grey the control out. Only this
      // one decides anything.
      const verdict = mayAct(view(row.state, viewer), viewer, action);
      if (!verdict.ok) return refuse(verdict.reason);

      try {
        return { state: apply(row.state, action).state };
      } catch (e) {
        return refuse(e instanceof IllegalActionError ? e.message : 'That did not work.');
      }
    },
    // The one who pressed the button does not wait for the bell to come
    // back round: they are handed their own redaction here. Everyone
    // else hears the bump and fetches theirs.
    (row) => snapshotFor(row, viewerFor(row, playerId) ?? { role: 'gm' }),
  );
}

/**
 * Nudge the held reveal.
 *
 * The client says "I think the card has been up long enough". It is not
 * an action and carries no action: the only thing it can cause is
 * ADVANCE_REVEAL, and only once the server's own deadline has passed.
 * Early is refused, late is a no-op, and a second nudge finds the phase
 * moved on. No caller is trusted with anything but the timing of the ask.
 */
async function opTick(code: string): Promise<Response> {
  return attempt(code, (row) => {
    if (!row.state) return json({ ok: true, idle: true });
    if (!mayAdvanceReveal(view(row.state, { role: 'gm' }))) {
      return json({ ok: true, version: row.version });
    }
    if (row.reveal_due_at && Date.now() < Date.parse(row.reveal_due_at)) {
      return json({ ok: true, early: true, version: row.version });
    }
    try {
      return { state: apply(row.state, { type: 'ADVANCE_REVEAL' }).state };
    } catch {
      return json({ ok: true, version: row.version });
    }
  });
}

/* ---------------- the doorway ---------------- */

interface Body {
  playerId?: unknown;
  role?: unknown;
  seatId?: unknown;
  setup?: unknown;
  action?: unknown;
  code?: unknown;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const op = url.pathname.split('/').filter(Boolean).pop() ?? '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    let body: Body = {};
    if (request.method === 'POST') {
      try {
        body = (await request.json()) as Body;
      } catch {
        return refuse('Unreadable request.', 400);
      }
    }

    const code = normaliseJoinCode(
      String(body.code ?? url.searchParams.get('code') ?? ''),
    );
    if (!isJoinCode(code)) return refuse('That is not a join code.', 400);

    const playerId = String(body.playerId ?? url.searchParams.get('playerId') ?? '');
    if (op !== 'tick' && !playerId) return refuse('Who are you?', 400);

    try {
      switch (op) {
        case 'create':
          return await opCreate(code, playerId, body.setup as RunSetup);
        case 'join':
          return await opJoin(
            code,
            playerId,
            body.role === 'gm' ? 'gm' : 'player',
            typeof body.seatId === 'string' ? body.seatId : undefined,
          );
        case 'view':
          return await opView(code, playerId);
        case 'act':
          return await opAct(code, playerId, body.action as GameAction);
        case 'tick':
          return await opTick(code);
        default:
          return refuse('No such operation.', 404);
      }
    } catch (e) {
      // Never let a stack trace out: this process holds the deck.
      console.error('session', op, code, e);
      return refuse('The session server had a problem.', 500);
    }
  },
};

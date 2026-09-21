/* ============================================================
   The room's storage, and the bell that says it moved.

   What a Durable Object gave for free — one room, one thread, one
   copy of the state — is assembled here from two ordinary pieces:
   a Postgres row and a Realtime topic.

   Nothing in this file understands the game. It reads a row, swaps
   a row and rings a bell. The rules live one directory up the
   import, in packages/rules, and the redaction lives in view.ts.

   Deliberately no @supabase/supabase-js: everything here is two
   REST calls and a fetch, and keeping the dependency out means the
   repo root still installs to almost nothing. See .design-sync/NOTES.md
   for why an empty root node_modules is worth protecting.

   It lives here rather than in api/ because api/ is a routes
   directory: every file in it is a reachable endpoint, and shared
   plumbing is not an endpoint.
   ============================================================ */

// REVEAL_MS is imported rather than re-declared: client, server and this
// deadline must agree, and there is one definition of it.
import { REVEAL_MS } from '../packages/rules/src/authority.js';
import type { GameState } from '../packages/rules/src/types.js';

const TABLE = 'maze_sessions';

/** Read once, at module scope, so a missing variable fails loudly and early. */
function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set on this deployment.`);
  return value;
}

const base = (): string => env('SUPABASE_URL').replace(/\/+$/, '');

/**
 * The service role key. It bypasses RLS, which is the entire point:
 * `maze_sessions` has RLS on and no policies, so this process is the
 * only thing in the world that can read `state`. It must never be
 * sent to a browser, and no response built in this directory may
 * contain anything but a GameView.
 */
const headers = (): Record<string, string> => {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
};

export interface Row {
  code: string;
  version: number;
  state: GameState | null;
  gm_player_id: string | null;
  /** playerId -> seatId. */
  seats: Record<string, string>;
  reveal_due_at: string | null;
}

/** What a write changes. `version` and `updated_at` are ours to set. */
export interface Patch {
  state?: GameState | null;
  gm_player_id?: string | null;
  seats?: Record<string, string>;
}

async function rest(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${base()}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await response.text();
  if (!response.ok) {
    // 409 is a primary-key conflict, which `create` treats as "taken"
    // rather than as a failure. Everything else is genuinely wrong.
    if (response.status === 409) return null;
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

function first(rows: unknown): Row | null {
  return Array.isArray(rows) && rows.length > 0 ? (rows[0] as Row) : null;
}

export async function read(code: string): Promise<Row | null> {
  return first(await rest(`${TABLE}?code=eq.${code}&select=*&limit=1`, { method: 'GET' }));
}

/** Claim a code. Null means somebody else already holds it. */
export async function create(code: string, patch: Patch): Promise<Row | null> {
  return first(await rest(TABLE, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ code, version: 1, ...withReveal(patch) }]),
  }));
}

/**
 * Compare and swap: write only if the row is still at the version we read.
 *
 * This is the Durable Object's single thread, rebuilt. Two actions that
 * raced both computed their result from the same base state; exactly one
 * of them wins the UPDATE, and the loser gets null and starts over. The
 * alternative — a last-write-wins UPDATE — would silently drop a turn.
 */
export async function swap(
  code: string,
  version: number,
  patch: Patch,
): Promise<Row | null> {
  return first(await rest(`${TABLE}?code=eq.${code}&version=eq.${version}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      version: version + 1,
      updated_at: new Date().toISOString(),
      ...withReveal(patch),
    }),
  }));
}

/**
 * The reveal deadline is derived from the state being written, never
 * passed in — so no code path can forget to set it, and none can set it
 * to a time of its own choosing. This is `storage.setAlarm`, moved into
 * the row it guards.
 */
function withReveal(patch: Patch): Patch & { reveal_due_at?: string | null } {
  if (!('state' in patch)) return patch;
  const due = patch.state?.phase === 'reveal'
    ? new Date(Date.now() + REVEAL_MS).toISOString()
    : null;
  return { ...patch, reveal_due_at: due };
}

/**
 * Ring the bell.
 *
 * The payload is a version number and nothing else. That is the whole
 * security argument for using a public Realtime topic: there is no
 * secret on it to leak, because a client that hears the bell comes back
 * to /api/session/view and is handed its OWN redaction. The per-recipient
 * guarantee in view.ts is untouched by this file.
 *
 * Fire and forget. A bell that fails to ring costs a client nothing but
 * latency — it polls as a backstop and refetches on reconnect — so this
 * must never fail an action that has already been applied.
 */
export async function bump(code: string, version: number): Promise<void> {
  try {
    await fetch(`${base()}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        messages: [{ topic: topicFor(code), event: 'bump', payload: { v: version } }],
      }),
    });
  } catch {
    /* the bell is an optimisation, not the truth */
  }
}

/** One topic per room. The client subscribes to exactly this string. */
export function topicFor(code: string): string {
  return `session:${code}`;
}

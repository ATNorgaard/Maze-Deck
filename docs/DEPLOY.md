# Putting it on the internet

**One Vercel project, one Supabase project, one URL.** Vercel serves the app
*and* runs the authority; Supabase holds the rooms and carries the bell that
says one moved. There is no second host to configure and no CORS, because the
app talks to whatever origin served it.

Project: `maze-deck` on Vercel, `etpxfpgtxbjhfakgutwc` on Supabase.

> **This replaced Cloudflare.** Until 2026-09-21 the whole thing was one Worker
> with a Durable Object per join code. That is gone — `workers/` is deleted and
> `wrangler.toml` with it. What the move cost, and what had to be rebuilt, is
> [below](#what-a-durable-object-was-giving-us-for-free).

## The shape of it

```
  browser ──POST /api/session/act──▶ Vercel function ──▶ Postgres row (CAS on version)
     ▲                                     │
     │                                     └──▶ Realtime: broadcast { v: 41 }
     │                                                      │
     └──── GET /api/session/view ◀── "the room moved" ◀──────┘
```

The topic carries **a version number and nothing else**. That is deliberate:
Realtime broadcasts one payload to everyone on a topic, and `view.ts` builds a
*different* redaction for every recipient, so the two cannot be reconciled by
putting game data on the wire. Instead the bell wakes each client and each one
comes back for its own view. The guarantee in `packages/rules/test/view.test.ts`
— two states differing only in hidden information produce byte-identical views
— still governs everything a client can see.

## What you need

- A Vercel account with the repo connected. Already done.
- A Supabase project. Already done.
- **One secret pasted in by hand** — see the next section. Nobody can do that
  on your behalf.

## First deploy: the one manual step

The authority reads `maze_sessions`, and that table has **RLS on and no
policies at all** — the publishable key opens no door to it whatsoever. The
only thing that can read a room is the Vercel function, using the service role
key, because it is the only code that knows how to redact.

So that key has to exist as an environment variable, and it must never be
committed or pasted into a chat window:

1. Supabase → **Project Settings → API Keys** → copy the `service_role` /
   secret key.
2. Vercel → `maze-deck` → **Settings → Environment Variables** → add
   `SUPABASE_SERVICE_ROLE_KEY`, marked **Sensitive**, for all environments.
3. Redeploy.

Without it every `/api/session/*` call answers *"The session server had a
problem."* and the logs say `SUPABASE_SERVICE_ROLE_KEY is not set`.

The three non-secret variables are already set: `SUPABASE_URL`,
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The last two are baked into
the browser bundle at build time, which is fine — they are public by
construction.

### Vercel Authentication must be off

A fresh Vercel project turns on SSO protection, and a protected deployment
answers your friends with a login wall. **Settings → Deployment Protection →
Vercel Authentication → Disabled.** A join code is the only key this game has;
that is the correct amount of security for a game among friends, and the
[not done](#things-that-are-not-done) list says so out loud.

## Deploying

Push to `main`. The Git integration builds and promotes it.

```
installCommand  npm install && cd packages/ui && npm ci && cd ../../apps/table && npm ci
buildCommand    cd apps/table && npm run build
outputDirectory apps/table/dist
```

Both sub-packages are installed by hand because there is **no npm workspace
root** — hoisting breaks the design-system sync, and `.design-sync/NOTES.md`
explains why. The root `package.json` exists for Vercel and holds no runtime
dependency; the authority functions import `packages/rules` as source and pull
in nothing else.

There are no rewrites. Routing is hash-based (`#/join/CODE`), so `/` serves the
app and everything else is a genuine 404 — the same reasoning as the old
`not_found_handling = "none"`.

`api/` holds only routes — every file in it is a reachable endpoint — so
shared plumbing lives in `server/`.

**The root `package.json` declares `"type": "module"`, and must keep it.**
Nothing else lives directly under the root, so that one line is what makes
`api/` and `server/` compile to ES modules. Without it they are CommonJS,
`require()` of `packages/rules` (which declares `"type": "module"`) throws
`ERR_REQUIRE_ESM`, and **every function 500s at load** with nothing in the
response to say why. Relatedly, every relative specifier in `api/`,
`server/` and `packages/rules` must carry its `.js` extension: ESM never
appends one, and a bundler-style specifier resolves at typecheck and then
fails at runtime.

**Rooms survive a deploy.** They are rows, not process state. This is the one
thing that got strictly better: redeploying mid-session is no longer forbidden.

## Local development

`vercel dev` serves the app and the functions together on one port, which is a
faithful rehearsal of production:

```bash
npx vercel dev            # http://localhost:3000 — app + /api/session/*
```

It needs the secrets locally; `npx vercel env pull` writes them to `.env.local`,
which is gitignored.

For actual work on the board, the Vite dev server is still much faster, and the
single-screen GM mode needs no backend at all:

```bash
cd apps/table && npm run dev     # http://localhost:5180, hot reload
```

To point that at a real backend, set `VITE_SESSION_ENDPOINT` to a deployment's
origin.

## What a Durable Object was giving us for free

Worth writing down, because all three are now load-bearing code rather than
platform guarantees.

**One thread per room.** A DO handled one message at a time, so read-decide-write
could not interleave. Here `version` is a compare-and-swap token: every write is
`UPDATE … WHERE code = $1 AND version = $2`, and a write that loses the race
re-reads and re-applies against whatever landed first. `attempt()` in
`api/session/[op].ts` is that loop; without it, two players acting at once would
silently drop a turn.

**The reveal alarm.** `storage.setAlarm(now + 1800ms)` has no serverless
equivalent at that granularity — pg_cron's floor is a minute, and the reveal is
under two seconds. So the deadline became a column, `reveal_due_at`, written
from the state itself so no code path can forget it, and clients **nudge**:
`POST /api/session/tick` carries no action and can cause exactly one thing.
Early is refused against the server's own clock, late is a no-op because
`mayAdvanceReveal` finds the phase already moved, and every client in the room
rings it so the run does not stall if one of them closes.

`ADVANCE_REVEAL` is still unsendable through `act`, so `authority.ts` did not
change. The only thing a client gained is the ability to *ask*.

**A socket per viewer.** Covered above: the bell carries a version, each client
fetches its own view.

## What your friends do

Unchanged.

1. You open the URL, set up the campaign, and press **"Open a room your players
   can join from their own devices"**.
2. The board shows a six-character join code — no `I`, `O`, `0` or `1`, so it
   survives being read out loud.
3. They open the same URL and press **Join a maze**, or you send them
   `https://<your-url>/#/join/UQY535` and they skip straight to claiming a seat.

Their character is remembered against that code in their own browser, so a
reload puts them back on the same seat.

## Housekeeping

Abandoned rooms hold their six-character code forever. There is a sweeper, and
it is deliberately not scheduled:

```sql
select public.maze_sessions_sweep();            -- default: older than 30 days
select public.maze_sessions_sweep('7 days');
```

## If you would rather use your own domain

Add it in Vercel → Settings → Domains. Nothing in the app hardcodes a hostname,
so it needs no code change.

## Things that are not done

- **No authentication at all.** Anyone with a join code can take a seat. For a
  game among friends that is the correct amount of security; do not treat it as
  private.
- **The Realtime topic is public.** Anyone who knows a join code can subscribe
  to it and can even publish a fake bump. The worst that does is make the room's
  clients refetch a view they are entitled to — there is nothing on the topic to
  steal — but it is worth knowing before this is ever used for anything real.
- **A closed GM tab leaves players watching a board that has stopped.** The room
  itself survives in Postgres — reopening the same code picks the run back up —
  but nothing tells the players what happened. (The reveal, at least, no longer
  stalls: any client can nudge it.)
- **The player view has never been opened on a real phone**, only in a
  phone-sized browser window.

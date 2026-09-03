# Putting it on the internet

**It is live: <https://maze-deck-session.andreastorp123.workers.dev>**

Deployed 2026-09-03 and verified on the real edge, not just locally: the app
loads, a room opened over `wss://`, a second client joined by code from a
phone-sized window and tracked the run live, and the GM's roll reached that
client **without its verdict** — because the GM can still overturn it — with no
GM controls anywhere on their screen. The free plan accepted the SQLite-backed
Durable Objects with no upgrade prompt.

The whole thing is **one deploy to one place**: a single Cloudflare Worker that
serves the app *and* runs the sessions. There is no database, no second host, no
CORS, and nothing to configure — the app talks to whatever origin served it.

## What you need

A Cloudflare account, and one click in its dashboard the first time — see the
next section. Both are steps nobody can do on your behalf.

The session rooms are SQLite-backed Durable Objects (`new_sqlite_classes` in
`wrangler.toml`) — the variant Cloudflare made available on the free plan. If
the deploy asks you to upgrade, that is the thing to check first.

## First deploy on a new account: do this once, first

**Open [dash.cloudflare.com](https://dash.cloudflare.com) and click into
"Workers & Pages" once**, before deploying. Just loading that page creates the
`*.workers.dev` subdomain your Worker will live on.

Skip it and the deploy gets most of the way — login fine, build fine, assets
uploaded fine — and then dies on the last step with:

```
You need a workers.dev subdomain in order to proceed. [code: 10063]
```

Wrangler normally offers to create the subdomain for you mid-deploy, but that
prompt does not fire for a Worker with Durable Objects, so it errors instead.
It is a [known Cloudflare
issue](https://github.com/cloudflare/workers-sdk/issues/2908), not a problem
with this project. There is no CLI command for it — the dashboard is the only
way.

Nothing is left half-broken when it happens. Re-running the deploy after the
subdomain exists is safe.

## Deploying

```bash
cd workers/session
npx wrangler login
npm run deploy
```

`wrangler login` opens a browser and asks you to authorise. `npm run deploy`
builds the app and ships both halves together.

It prints a URL like `https://maze-deck-session.<your-subdomain>.workers.dev`.
That is the site. Send it to your friends.

## What your friends do

1. You open the URL, set up the campaign, and press **"Open a room your players
   can join from their own devices"**.
2. The board shows a six-character join code — no `I`, `O`, `0` or `1`, so it
   survives being read out loud.
3. They open the same URL and press **Join a maze**, or you send them
   `https://<your-url>/#/join/UQY535` and they skip straight to claiming a seat.

Phones work. Their character is remembered against that code in their own
browser, so a reload puts them back on the same seat.

## Redeploying

Same command. `npm run deploy` always rebuilds the app first, so you cannot
accidentally ship a stale bundle.

**Rooms in progress do not survive a deploy of the Durable Object class.** Do it
between sessions, not during one.

## Local development

Unchanged, and still needs no account:

```bash
cd workers/session && npm run dev   # the server, port 8787
cd apps/table && npm run dev        # the app with hot reload, port 5180
```

In dev the app defaults to `http://localhost:8787` for the server. In a
production build it uses its own origin. `VITE_SESSION_ENDPOINT` overrides
either, which is how you point a local app at the deployed server.

`wrangler dev` also serves the built app from `apps/table/dist`, so
`http://localhost:8787` on its own is a faithful rehearsal of production — but
that copy is only as fresh as your last `npm run build`. Use port 5180 for
actual work.

## If you would rather use your own domain

Add a route in `wrangler.toml` and point the DNS at Cloudflare. Nothing in the
app hardcodes a hostname, so it needs no code change.

## Things that are not done

- **No authentication at all.** Anyone with a join code can take a seat. For a
  game among friends that is the correct amount of security; do not treat it as
  private.
- **A closed GM tab leaves players watching a board that has stopped.** The room
  itself survives in Durable Object storage — reopening the same code picks the
  run back up — but nothing tells the players what happened.
- **The player view has never been opened on a real phone**, only in a
  phone-sized browser window.

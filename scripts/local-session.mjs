/* ============================================================
   A hosted game, rehearsed on this machine — no Supabase, no Vercel.

   Runs the real session authority (api/session/[op].ts, bundled with
   the app's own esbuild) against an in-memory stand-in for the one
   table it uses: just enough of PostgREST to answer server/store.ts —
   a read by code, an insert that refuses a taken code, and a PATCH
   that only lands on the version it names (the compare-and-swap). The
   Realtime broadcast is swallowed, so clients keep up by polling, as
   they do when Realtime is not configured.

   With --app it also serves the table app pointed at it
   (VITE_SESSION_ENDPOINT), on its own port and dependency cache, so
   the ordinary dev server can keep running beside it.

     node scripts/local-session.mjs [--port=8790] [--app] [--app-port=5182]
                                     [--unmigrated]

       --unmigrated   a table without the `scene` column, as the live one
                      is until server/migrations/ has been run: proves the
                      code is safe to deploy first (docs/overhaul.md, phase 8)

   Nothing here is used in production. It exists so phase 8's phones,
   and anything after, can be tested end to end without touching the
   live database, which other apps share.
   ============================================================ */
import { createRequire } from 'node:module';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const appDir = path.join(root, 'apps', 'table');
const requireApp = createRequire(path.join(appDir, 'package.json'));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const port = Number(flag('port', '8790'));
const appPort = Number(flag('app-port', '5182'));
const migrated = !args.includes('--unmigrated');
const withApp = args.includes('--app');

/* ---------------- the authority, bundled ---------------- */

const esbuild = requireApp('esbuild');
const bundle = path.join(os.tmpdir(), `maze-session-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, 'api', 'session', '[op].ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: bundle,
  logLevel: 'warning',
});
process.env.SUPABASE_URL = `http://127.0.0.1:${port}/mock`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-only';
const authority = (await import(pathToFileURL(bundle).href)).default;

/* ---------------- the table, in memory ---------------- */

const COLUMNS = new Set(['code', 'version', 'state', 'gm_player_id', 'seats', 'reveal_due_at', 'created_at', 'updated_at',
  ...(migrated ? ['scene'] : [])]);
const rows = new Map();

const unknownColumn = (obj) => Object.keys(obj).find((k) => !COLUMNS.has(k));
const filters = (query) => {
  const out = {};
  for (const [k, v] of query) if (v.startsWith('eq.')) out[k] = v.slice(3);
  return out;
};
const matches = (row, f) => Object.entries(f).every(([k, v]) => String(row[k]) === v);

/** PostgREST's answer to a column that is not there. */
const missingColumn = (col) => ({
  status: 400,
  body: { code: 'PGRST204', message: `Could not find the '${col}' column of 'maze_sessions' in the schema cache` },
});

function table(method, query, body) {
  const f = filters(query);
  if (method === 'GET') {
    const found = [...rows.values()].filter((r) => matches(r, f)).slice(0, 1);
    return { status: 200, body: found };
  }
  if (method === 'POST') {
    const [obj] = body;
    const bad = unknownColumn(obj);
    if (bad) return missingColumn(bad);
    if (rows.has(obj.code)) return { status: 409, body: { code: '23505', message: 'duplicate key' } };
    const now = new Date().toISOString();
    const row = {
      code: obj.code, version: 1, state: null, gm_player_id: null, seats: {}, reveal_due_at: null,
      created_at: now, updated_at: now, ...(migrated ? { scene: null } : {}), ...obj,
    };
    rows.set(row.code, row);
    return { status: 201, body: [row] };
  }
  if (method === 'PATCH') {
    const bad = unknownColumn(body);
    if (bad) return missingColumn(bad);
    const row = rows.get(f.code);
    if (!row || !matches(row, f)) return { status: 200, body: [] };
    Object.assign(row, body);
    return { status: 200, body: [row] };
  }
  return { status: 405, body: { message: 'Not here.' } };
}

/* ---------------- the doorway ---------------- */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, accept, apikey, authorization, prefer',
};

const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS, ...headers });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  const raw = await readBody(req);

  if (url.pathname === '/mock/rest/v1/maze_sessions') {
    const out = table(req.method, url.searchParams, raw.length ? JSON.parse(raw.toString()) : null);
    send(out.status, out.body);
    return;
  }
  if (url.pathname === '/mock/realtime/v1/api/broadcast') { send(202, {}); return; }

  if (url.pathname.startsWith('/api/session/')) {
    const request = new Request(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      ...(req.method === 'POST' ? { body: raw } : {}),
    });
    const response = await authority.fetch(request);
    const text = await response.text();
    const op = url.pathname.split('/').pop();
    if (op !== 'view') console.log(`${op.padEnd(6)} ${text.slice(0, 120)}`);
    send(response.status, text);
    return;
  }
  send(404, { error: 'Not here.' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`The session authority, on http://127.0.0.1:${port} — a table in memory, ${migrated ? 'with' : 'WITHOUT'} the scene column.`);
});

/* ---------------- the app, pointed at it ---------------- */

if (withApp) {
  process.env.VITE_SESSION_ENDPOINT = `http://127.0.0.1:${port}`;
  // Vite's ES module entry: resolving 'vite' from here finds its
  // deprecated CommonJS build.
  const viteDir = path.dirname(requireApp.resolve('vite/package.json'));
  const { createServer } = await import(pathToFileURL(path.join(viteDir, 'dist', 'node', 'index.js')).href);
  const vite = await createServer({
    root: appDir,
    configFile: path.join(appDir, 'vite.config.ts'),
    cacheDir: path.join(os.tmpdir(), 'maze-local-session-vite'),
    server: { port: appPort, strictPort: true },
    logLevel: 'warn',
  });
  await vite.listen();
  console.log(`The app, hosted games going to it: http://localhost:${appPort}`);
}

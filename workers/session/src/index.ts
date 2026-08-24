/* ============================================================
   The session server.

   A Worker that does nothing but route a join code to its Durable
   Object. All the interesting behaviour is in SessionRoom.

   The code IS the object's name, so two people typing the same
   code land in the same room with no lookup table anywhere.
   ============================================================ */

import { isJoinCode, normaliseJoinCode } from '../../../packages/rules/src/protocol';

export { SessionRoom } from './room';

export interface Env {
  SESSIONS: DurableObjectNamespace;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/health') {
      return new Response('ok', { headers: CORS });
    }

    const match = /^\/session\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    const code = normaliseJoinCode(match[1] ?? '');
    if (!isJoinCode(code)) {
      return new Response('That is not a join code', { status: 400, headers: CORS });
    }

    const id = env.SESSIONS.idFromName(code);
    return env.SESSIONS.get(id).fetch(request);
  },
};

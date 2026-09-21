/* TEMPORARY. A near-exact clone of api/session/[op].ts's SHAPE: nested one
   directory deep, dynamic segment, a config export, and the same ../../
   imports. Everything the real file has except its logic. */
import { readdir } from 'node:fs/promises';
import { createGame } from '../../packages/rules/src/engine.js';
import { isJoinCode } from '../../packages/rules/src/protocol.js';
import { topicFor } from '../../server/store.js';

export const config = { maxDuration: 15 };

async function ls(dir: string): Promise<unknown> {
  try {
    return await readdir(dir, { recursive: true });
  } catch (e) {
    return String((e as { message?: string }).message ?? e).slice(0, 200);
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({
      probe: 'j',
      imports: [typeof createGame, typeof isJoinCode, typeof topicFor].join(','),
      topic: topicFor('ABCD23'),
      task: await ls('/var/task'),
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  },
};

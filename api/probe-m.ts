/* TEMPORARY. Variable: does `export const config` break the fetch handler? */
import { isJoinCode } from '../packages/rules/src/protocol.js';

export const config = { maxDuration: 15 };

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'm', ok: isJoinCode('ABCD23') }),
      { headers: { 'Content-Type': 'application/json' } });
  },
};

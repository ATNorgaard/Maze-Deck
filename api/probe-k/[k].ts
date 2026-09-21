/* TEMPORARY. Variable: nesting + ../../ imports. */
import { isJoinCode } from '../../packages/rules/src/protocol.js';

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'k', ok: isJoinCode('ABCD23') }),
      { headers: { 'Content-Type': 'application/json' } });
  },
};

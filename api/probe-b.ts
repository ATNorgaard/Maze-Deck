/* TEMPORARY. Does an extensionless TS import across packages/ resolve at runtime? */
import { isJoinCode } from '../packages/rules/src/protocol';

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'b', style: 'web-fetch+import', ok: isJoinCode('ABCD23') }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

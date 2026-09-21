/* TEMPORARY. Variable: is server/ traced into the bundle at all? */
import { topicFor } from '../server/store.js';

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'l', topic: topicFor('ABCD23') }),
      { headers: { 'Content-Type': 'application/json' } });
  },
};

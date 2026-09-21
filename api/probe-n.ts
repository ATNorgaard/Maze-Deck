/* TEMPORARY. Static import of an _-prefixed sibling, to correct the record. */
import { HELLO } from './_helper.js';

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'n', HELLO }),
      { headers: { 'Content-Type': 'application/json' } });
  },
};

/* TEMPORARY. The real import chain, statically, at a static filename. */
import { apply, createGame } from '../packages/rules/src/engine.js';
import { mayAct, mayAdvanceReveal } from '../packages/rules/src/authority.js';
import { isJoinCode } from '../packages/rules/src/protocol.js';
import { view } from '../packages/rules/src/view.js';
import { topicFor } from '../_storeless.js';

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({
      probe: 'g',
      loaded: [typeof apply, typeof createGame, typeof mayAct,
               typeof mayAdvanceReveal, typeof isJoinCode, typeof view].join(','),
      topic: topicFor('ABCD23'),
    }), { headers: { 'Content-Type': 'application/json' } });
  },
};

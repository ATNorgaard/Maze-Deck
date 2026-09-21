/* TEMPORARY. The classic Node signature, plus the same cross-package import. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isJoinCode } from '../packages/rules/src/protocol';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ probe: 'c', style: 'node-req-res', ok: isJoinCode('ABCD23') }));
}

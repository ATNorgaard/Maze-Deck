/* TEMPORARY. Is packages/rules in the lambda at all, and under what name? */
import { readdir } from 'node:fs/promises';

async function ls(dir: string): Promise<unknown> {
  try {
    return await readdir(dir);
  } catch (e) {
    return String((e as { message?: string }).message ?? e).slice(0, 200);
  }
}

export default {
  async fetch(): Promise<Response> {
    const out: Record<string, unknown> = {
      cwd: process.cwd(),
      task: await ls('/var/task'),
      api: await ls('/var/task/api'),
      packages: await ls('/var/task/packages'),
      rulesSrc: await ls('/var/task/packages/rules/src'),
    };
    // If the files ARE there as .js, an explicit extension will load.
    try {
      const m = await import('../packages/rules/src/protocol.js');
      out.withExtension = Object.keys(m).length;
    } catch (e) {
      const err = e as { code?: string; message?: string };
      out.withExtension = { code: err.code ?? null, message: String(err.message ?? e).slice(0, 300) };
    }
    return new Response(JSON.stringify(out, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

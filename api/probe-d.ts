/* TEMPORARY. Import packages/rules at request time and report what breaks.
   Static imports fail at module load, where the error is invisible without
   log access; dynamic ones fail inside the handler, where it can be read. */
export default {
  async fetch(): Promise<Response> {
    const out: Record<string, unknown> = { node: process.version };

    for (const [name, load] of Object.entries({
      protocol: () => import('../packages/rules/src/protocol'),
      types: () => import('../packages/rules/src/types'),
      rng: () => import('../packages/rules/src/rng'),
      engine: () => import('../packages/rules/src/engine'),
    })) {
      try {
        out[name] = Object.keys(await load()).length;
      } catch (e) {
        const err = e as { message?: string; code?: string };
        out[name] = { code: err.code ?? null, message: String(err.message ?? e).slice(0, 400) };
      }
    }
    return new Response(JSON.stringify(out, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

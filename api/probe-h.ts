/* TEMPORARY. Which module in the chain fails, and what does the lambda
   think its module system is? */
import { readdir, readFile } from 'node:fs/promises';

async function safe<T>(f: () => Promise<T>): Promise<T | string> {
  try { return await f(); } catch (e) {
    return String((e as { message?: string }).message ?? e).slice(0, 300);
  }
}

const CHAIN: Record<string, () => Promise<unknown>> = {
  'rules/rng': () => import('../packages/rules/src/rng.js'),
  'ui/types': () => import('../packages/ui/src/types.js'),
  'rules/types': () => import('../packages/rules/src/types.js'),
  'rules/view': () => import('../packages/rules/src/view.js'),
  'rules/authority': () => import('../packages/rules/src/authority.js'),
  'rules/engine': () => import('../packages/rules/src/engine.js'),
};

export default {
  async fetch(): Promise<Response> {
    const modules: Record<string, unknown> = {};
    for (const [name, load] of Object.entries(CHAIN)) {
      const r = await safe(load);
      modules[name] = typeof r === 'string' ? { error: r } : Object.keys(r as object).length;
    }
    return new Response(JSON.stringify({
      rootPackageJson: await safe(() => readFile('/var/task/package.json', 'utf8')),
      packages: await safe(() => readdir('/var/task/packages', { recursive: true })),
      modules,
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  },
};

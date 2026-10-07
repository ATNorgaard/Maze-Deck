import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Same shape as apps/table: the component library is consumed as
 * SOURCE, so the atelier previews its artwork on the real cards and
 * picks up a token change the moment it is saved. No workspace root
 * (see .design-sync/NOTES.md), so the aliases point at files.
 */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@maze-deck/ui/styles': here('../../packages/ui/src/styles/index.css'),
      '@maze-deck/ui': here('../../packages/ui/src/index.ts'),
      '@maze-deck/rules': here('../../packages/rules/src/index.ts'),
    },
  },
  server: { port: 5181, fs: { allow: [here('../..')] } },
});

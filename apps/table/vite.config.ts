import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Both packages are consumed as SOURCE, not as built output: the app
 * gets hot reload straight into the component library, and there is
 * deliberately no npm workspace root — hoisting node_modules breaks
 * the design-sync converter. See .design-sync/NOTES.md.
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
  server: { port: 5180 },
});

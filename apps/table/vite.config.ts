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
      '@maze-deck/art': here('../../packages/art/src/index.ts'),
    },
    // packages/art has no node_modules of its own, so its React is the
    // app's. Said outright rather than left to how a build resolves a bare
    // import from a directory with none: two Reacts would break every hook.
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5180 },
});

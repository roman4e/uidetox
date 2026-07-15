import { defineConfig } from 'vitest/config';
import { uidetoxEsbuild } from 'ui-detox/vite';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true, // `describe` / `it` / `expect` available in .md `ts test` blocks
  },
  // Compile .dtx/.md (and re-emit their colocated test blocks) via the esbuild bridge.
  optimizeDeps: { esbuildOptions: { plugins: [uidetoxEsbuild({ mode: 'test' })] } },
});

import { defineConfig } from 'vite';
import uidetox from 'ui-detox/vite';

export default defineConfig({
  plugins: [uidetox()],
  server: { port: 5173 },
});

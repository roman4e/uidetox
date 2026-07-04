import { defineConfig } from 'vite';
import uidetox from 'uidetox/vite';

export default defineConfig({
  plugins: [uidetox()],
  server: { port: 5173 },
});

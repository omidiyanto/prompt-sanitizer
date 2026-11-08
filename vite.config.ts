import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  worker: { format: 'es' },
  build: { sourcemap: false },
  test: { include: ['src/**/*.test.ts'] },
});

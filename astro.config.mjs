import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [],
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**', '**/*.db', '**/*.db-journal', '**/*.db-wal', '**/*.db-shm']
      }
    }
  }
});
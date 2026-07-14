import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  integrations: [],
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**', '**/*.db', '**/*.db-journal', '**/*.db-wal', '**/*.db-shm']
      }
    }
  }
});
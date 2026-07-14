import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
const baseRoute = process.env.PUBLIC_BASE_PATH || env.PUBLIC_BASE_PATH || '/';

// https://astro.build/config
export default defineConfig({
  base: baseRoute,
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
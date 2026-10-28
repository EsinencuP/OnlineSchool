import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync } from 'node:fs';

const packageInfo = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };
const migrations = readdirSync(new URL('../../packages/db/prisma/migrations', import.meta.url))
  .filter((name) => /^\d{14}_/.test(name))
  .sort();

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_INFO__: JSON.stringify({
      version: packageInfo.version,
      builtAt: new Date().toISOString(),
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_COMMIT_SHA || null,
      expectedMigration: migrations.at(-1) ?? null,
    }),
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/student': { target: 'http://127.0.0.1:5174' },
      '/api': { target: 'http://127.0.0.1:3000' },
      '/health': { target: 'http://127.0.0.1:3000' },
    },
  },
});

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Generation is offline. Migration commands require DIRECT_URL, never DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'pnpm run seed:run' },
  ...(process.env.DIRECT_URL ? { datasource: { url: process.env.DIRECT_URL } } : {}),
});

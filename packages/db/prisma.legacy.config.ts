import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Existing TASK-02/03 databases retain their exact migration IDs and checksums.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations-history', seed: 'pnpm run seed:run' },
  ...(process.env.DIRECT_URL ? { datasource: { url: process.env.DIRECT_URL } } : {}),
});

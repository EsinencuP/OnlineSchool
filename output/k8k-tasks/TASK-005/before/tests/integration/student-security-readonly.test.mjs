import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { securitySqlCases, securityFixtureQuery } from '../support/security-readonly-fixture.mjs';
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg');
const connectionString = process.env.STU_READONLY_DATABASE_URL;
(connectionString ? test : test.skip)(
  'read-only PostgreSQL personal manager isolation, enabled account, role and assignment period',
  async () => {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      await client.query('BEGIN READ ONLY');
      for (const item of securitySqlCases) {
        const query = await securityFixtureQuery(item),
          { rows } = await client.query(query.text, query.values);
        expect(rows).toHaveLength(item.count);
        if (item.whatsapp) expect(rows[0].whatsapp).toBe(item.whatsapp);
      }
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      await client.end();
    }
  },
);

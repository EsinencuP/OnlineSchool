import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createDirectClient } from '../dist/index.js';

const roleCodes = ['DIRECTOR', 'MANAGER', 'TEACHER', 'STUDENT', 'TECH_OPERATOR'];

export async function seedReferenceData(client) {
  try {
    const inserted = await client.$transaction(async (tx) => {
      let count = 0;
      for (const code of roleCodes) {
        // Native ON CONFLICT is atomic under concurrent seeds and never updates old IDs/timestamps.
        count += await tx.$executeRaw`
          INSERT INTO roles (id, code) VALUES (gen_random_uuid(), ${code}::"RoleCode")
          ON CONFLICT (code) DO NOTHING
        `;
      }
      return count;
    });
    return { ok: true, value: { inserted, roleCount: roleCodes.length } };
  } catch {
    return { ok: false, error: { code: 'REFERENCE_SEED_FAILED' } };
  }
}

async function main() {
  const connection = createDirectClient();
  if (!connection.ok) {
    console.error(`Seed configuration failed: ${connection.error.code}`);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await seedReferenceData(connection.value);
    if (!result.ok) {
      console.error(result.error.code);
      process.exitCode = 1;
      return;
    }
    console.log(
      `Reference seed: ${result.value.roleCount} roles; ${result.value.inserted} inserted.`,
    );
  } finally {
    await connection.value.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => {
    console.error('Seed initialization failed.');
    process.exitCode = 1;
  });
}

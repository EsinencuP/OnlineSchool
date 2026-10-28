import { expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
const snapshot = JSON.parse(
  await readFile(new URL('../evidence/task15-live-schema.json', import.meta.url), 'utf8'),
);
const models = JSON.parse(
  await readFile(new URL('../evidence/task15-prisma-contract.json', import.meta.url), 'utf8'),
);

// This is a verification of the timestamped read-only Neon catalog capture.
// It is deliberately not represented as a fresh PostgreSQL CI integration run.
test('recorded real PostgreSQL 18 catalog matches its frozen TASK-15 Prisma contract', () => {
  expect(Math.floor(snapshot.serverVersion / 10000)).toBe(18);
  expect([...new Set(snapshot.columns.map((c) => c.table))].sort()).toEqual(
    models.map((m) => m.table).sort(),
  );
  const byName = new Map(models.map((m) => [m.name, m]));
  const actualFk = snapshot.foreignKeys.map((k) => ({
    table: k.table,
    target: k.target,
    from: k.from,
    to: k.to,
    name: k.name,
  }));
  const expectedFk = [];
  for (const model of models) {
    const actual = snapshot.columns.filter((c) => c.table === model.table);
    expect(actual.map((c) => c.column).sort()).toEqual(model.fields.map((f) => f.column).sort());
    for (const field of model.fields) {
      const column = actual.find((c) => c.column === field.column);
      // Prisma scalar lists coerce SQL NULL to []; SQL array nullability is not scalar optionality.
      if (!field.list)
        expect({ table: model.table, column: field.column, nullable: column.nullable }).toEqual({
          table: model.table,
          column: field.column,
          nullable: field.nullable,
        });
      if (field.native?.[0] === 'Decimal') expect(column.type).toBe('numeric');
      if (field.native?.[0] === 'Uuid') expect(column.type).toBe('uuid');
    }
    for (const relation of model.relations) {
      const target = byName.get(relation.type);
      const key = {
        table: model.table,
        target: target.table,
        from: relation.from.map((name) => model.fields.find((f) => f.name === name).column),
        to: relation.to.map((name) => target.fields.find((f) => f.name === name).column),
        name: relation.constraint,
      };
      expectedFk.push(key);
    }
  }
  expect(actualFk.sort((a, b) => a.name.localeCompare(b.name))).toEqual(
    expectedFk.sort((a, b) => a.name.localeCompare(b.name)),
  );
});
test('recorded SQL enforces exclusions, unique consumption, immutable audit and ledger RLS', () => {
  const exclusions = snapshot.constraints.filter((c) => c.type === 'x').map((c) => c.name);
  expect(exclusions).toEqual(
    expect.arrayContaining(['no_overlapping_confirmed_lessons', 'no_overlapping_availability']),
  );
  const consumption = snapshot.indexes.find((i) => i.name === 'uq_active_lesson_consumption');
  expect(consumption.definition).toMatch(
    /UNIQUE.*lesson_occurrence_id.*WHERE.*cancelled_at IS NULL/,
  );
  expect(snapshot.rls.find((r) => r.table === 'ledger_entries').enabled).toBe(true);
  expect(snapshot.runtime).toEqual({ auditDelete: false, auditUpdate: false, superuser: false });
  expect(
    snapshot.triggers.some(
      (t) => t.table === 'audit_events' && t.enabled !== 'D' && /append_only/.test(t.name),
    ),
  ).toBe(true);
  expect(
    snapshot.triggers.some(
      (t) =>
        t.table === 'ledger_entries' && t.enabled !== 'D' && /publication_balance/.test(t.name),
    ),
  ).toBe(true);
});
test('working migration checksums match all versioned SQL sources without changing the database', async () => {
  expect(snapshot.migrations.length).toBeGreaterThanOrEqual(7);
  const { createHash } = await import('node:crypto');
  for (const migration of snapshot.migrations) {
    const bytes = await readFile(
      new URL(
        `../../packages/db/prisma/migrations/${migration.name}/migration.sql`,
        import.meta.url,
      ),
    );
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(migration.checksum);
  }
});

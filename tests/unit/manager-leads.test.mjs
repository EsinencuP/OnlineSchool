import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';
import {
  leadTransition,
  leadConfig,
  LEAD_STAGES,
  publicStage,
} from '../../apps/api/dist/modules/manager/leads/policy.js';
import {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsQueryDto,
} from '../../apps/api/dist/modules/manager/dto/manager-lead.dto.js';
import { ManagerScopeService } from '../../apps/api/dist/modules/manager/scope/manager-scope.service.js';
import {
  readLeadCursor,
  writeLeadCursor,
} from '../../apps/api/dist/modules/manager/leads/lead-cursor.js';
import { leadSummarySql } from '../../apps/api/dist/modules/manager/leads/summary.sql.js';
import { closeLeadTasks } from '../../apps/api/dist/modules/manager/leads/events.js';

test('automatic task closure preserves OPEN -> IN_PROGRESS -> RESOLVED and identifies SYSTEM', async () => {
  let status = 'OPEN';
  const writes = [];
  const tx = {
    crmTask: {
      updateMany: async ({ where, data }) => {
        expect(where.status).toBe(status);
        if (data.status === 'RESOLVED') {
          expect(status).toBe('IN_PROGRESS');
          expect(data.system_resolved).toBe(true);
          expect(data.resolved_by_staff_id).toBeNull();
          expect(data.resolved_at).toBeInstanceOf(Date);
        }
        status = data.status;
        writes.push(data.status);
        return { count: 1 };
      },
    },
  };
  await closeLeadTasks(tx, randomUUID(), ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'], new Date());
  expect(writes).toEqual(['IN_PROGRESS', 'RESOLVED']);
});
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { plainToInstance } = require('class-transformer'),
  { validateSync } = require('class-validator');
const allowed = {
  NEW: ['IN_PROGRESS', 'LOST'],
  IN_PROGRESS: ['TRIAL', 'AWAITING_PAYMENT', 'LOST'],
  TRIAL: ['IN_PROGRESS', 'AWAITING_PAYMENT', 'LOST'],
  AWAITING_PAYMENT: ['TRIAL', 'LOST'],
  CONVERTED: [],
  LOST: ['IN_PROGRESS'],
};
test.each(LEAD_STAGES.flatMap((from) => LEAD_STAGES.map((to) => [from, to])))(
  'stage matrix %s -> %s',
  (from, to) => {
    const r = leadTransition(
      from,
      to,
      to === 'IN_PROGRESS' ? 'CANCELLED' : 'ATTENDED',
      'Owner approved skip',
    );
    expect(r.ok).toBe(allowed[from].includes(to));
    if (!r.ok)
      expect(r.error.code).toBe(
        from === 'CONVERTED' ? 'LEAD_TERMINAL' : 'INVALID_STAGE_TRANSITION',
      );
  },
);
test('trial transition needs teacher attendance; skip needs a meaningful reason', () => {
  expect(leadTransition('TRIAL', 'AWAITING_PAYMENT', 'PENDING').error.code).toBe(
    'TRIAL_OUTCOME_REQUIRED',
  );
  expect(leadTransition('IN_PROGRESS', 'AWAITING_PAYMENT').error.code).toBe(
    'SKIP_TRIAL_REASON_REQUIRED',
  );
  expect(leadTransition('TRIAL', 'IN_PROGRESS', 'ATTENDED').ok).toBe(false);
  expect(publicStage('TRIAL_DONE')).toBe('TRIAL');
  expect(publicStage('CONTACTED')).toBe('IN_PROGRESS');
});
test('confirmed owner defaults and malformed configuration', () => {
  const keys = [
      'TRIAL_LESSON_MINUTES',
      'LEAD_FOLLOWUP_DUE_MINUTES',
      'TRIAL_FEEDBACK_VISIBLE_TO_MANAGER',
      'LEADS_PER_MANAGER_PER_MINUTE',
    ],
    saved = keys.map((k) => process.env[k]);
  try {
    keys.forEach((k) => delete process.env[k]);
    expect(leadConfig().value).toEqual({
      minutes: 50,
      followupMinutes: 120,
      feedbackVisible: true,
      perMinute: 30,
    });
    for (const raw of ['0', '-1', '50x', '1.5', 'NaN', '121']) {
      process.env.TRIAL_LESSON_MINUTES = raw;
      expect(leadConfig().ok).toBe(false);
    }
    delete process.env.TRIAL_LESSON_MINUTES;
    process.env.TRIAL_FEEDBACK_VISIBLE_TO_MANAGER = 'false';
    expect(leadConfig().value.feedbackVisible).toBe(false);
  } finally {
    keys.forEach((k, i) =>
      saved[i] === undefined ? delete process.env[k] : (process.env[k] = saved[i]),
    );
  }
});
test('DTO requires contact and guardian; partial update need not resend contacts', () => {
  const dto = {
    audience: 'CHILD',
    contactName: 'Student',
    guardianName: 'Parent',
    phone: '+37360000123',
    subjectId: randomUUID(),
    source: 'PHONE',
  };
  expect(validateSync(plainToInstance(CreateLeadDto, dto))).toHaveLength(0);
  expect(
    validateSync(plainToInstance(CreateLeadDto, { ...dto, phone: undefined })).length,
  ).toBeGreaterThan(0);
  expect(
    validateSync(plainToInstance(CreateLeadDto, { ...dto, guardianName: undefined })).length,
  ).toBeGreaterThan(0);
  expect(
    validateSync(plainToInstance(UpdateLeadDto, { version: 1, contactName: 'Renamed' })),
  ).toHaveLength(0);
  for (const overdue of ['yes', '0', 'FALSE'])
    expect(validateSync(plainToInstance(ListLeadsQueryDto, { overdue })).length).toBeGreaterThan(0);
});
test('cursor authenticates manager, filters, tuple and snapshot without exposing contacts', () => {
  const saved = process.env.MANAGER_CURSOR_SECRET;
  process.env.MANAGER_CURSOR_SECRET = 'lead-cursor-unit-secret-32-bytes-minimum';
  try {
    const ctx = { managerId: randomUUID() },
      q = { limit: 25, search: 'private@example.test' },
      now = new Date(),
      id = randomUUID();
    const cursor = writeLeadCursor(ctx, q, { now }, id, now);
    expect(cursor.ok).toBe(true);
    expect(cursor.value).not.toContain(q.search);
    expect(readLeadCursor(ctx, { ...q, cursor: cursor.value }, now).value.id).toBe(id);
    expect(
      readLeadCursor({ managerId: randomUUID() }, { ...q, cursor: cursor.value }, now).ok,
    ).toBe(false);
    expect(readLeadCursor(ctx, { ...q, stage: ['NEW'], cursor: cursor.value }, now).ok).toBe(false);
    expect(readLeadCursor(ctx, { ...q, cursor: cursor.value.slice(0, -4) + 'AAAA' }, now).ok).toBe(
      false,
    );
  } finally {
    saved === undefined
      ? delete process.env.MANAGER_CURSOR_SECRET
      : (process.env.MANAGER_CURSOR_SECRET = saved);
  }
});
test('summary binds school timezone, assigned portfolio, all trial attempts and integer conversion', () => {
  const scope = new ManagerScopeService({}),
    ctx = { managerId: randomUUID() },
    now = new Date(),
    q = leadSummarySql(scope.leadSql(ctx, now), now, 'Europe/Chisinau');
  expect(q.values).toContain(ctx.managerId);
  expect(q.values).toContain('Europe/Chisinau');
  expect(q.text).toContain('l.trial_lead_id');
  expect(q.text).toContain('converted*10000/cohort');
  expect(q.text).not.toContain(ctx.managerId);
});
test('manager cannot write teacher outcomes or ledger; all lead controllers use ManagerRoute', async () => {
  const lint = new ESLint();
  const results = await lint.lintFiles([
    'apps/api/src/modules/manager/leads/*.ts',
    'apps/api/src/modules/manager/dto/manager-lead.dto.ts',
  ]);
  expect(
    results.flatMap((r) =>
      r.messages.filter((m) => m.severity === 2).map((m) => `${r.filePath}: ${m.message}`),
    ),
  ).toEqual([]);
  for (const model of [
    'lessonOccurrence',
    'lessonOutcomeReport',
    'lessonActualOutcome',
    'ledgerEntry',
  ]) {
    const invalid = await lint.lintText(
      `async function change(tx: any){ await tx.${model}.create({}); }`,
      { filePath: 'apps/api/src/modules/manager/leads/violation.ts' },
    );
    expect(invalid[0].messages.some((m) => m.ruleId === 'manager/no-protected-writes')).toBe(true);
  }
  const text = await readFile(
    'apps/api/src/modules/manager/leads/manager-leads.controller.ts',
    'utf8',
  );
  expect(text).toContain('@ManagerRoute()');
  expect(text).not.toMatch(/@Post\(['"](?:convert|outcome|feedback)/);
});

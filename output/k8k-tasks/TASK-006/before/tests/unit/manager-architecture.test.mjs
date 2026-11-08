import { expect, test } from '@jest/globals';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { ESLint } from 'eslint';
const root = path.resolve('apps/api/src/modules/manager');
const eslint = new ESLint();
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name),
      ),
    )
  ).flat();
}
function violations(source) {
  const ast = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
  const missing = [];
  const decoratorName = (node) =>
    ts.isCallExpression(node.expression)
      ? node.expression.expression.getText(ast)
      : node.expression.getText(ast);
  const visit = (node) => {
    if (ts.isClassDeclaration(node)) {
      const names = (ts.getDecorators(node) ?? []).map(decoratorName);
      if (names.includes('Controller') && !names.includes('ManagerRoute'))
        missing.push(node.name?.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return missing;
}
const lint = async (source, filename = 'probe.ts') =>
  (await eslint.lintText(source, { filePath: path.join(root, filename) }))[0].messages;
test('every manager controller is protected by ManagerRoute, including future nested controllers', async () => {
  const controllers = [];
  for (const filename of await files(root)) {
    if (!filename.endsWith('.ts')) continue;
    const source = await readFile(filename, 'utf8');
    expect(violations(source)).toEqual([]);
    if (source.includes('@Controller(')) controllers.push(filename);
  }
  expect(controllers.length).toBeGreaterThan(0);
  expect(violations("@Controller('manager') class Unprotected {}")).toEqual(['Unprotected']);
});
test('real manager sources obey all invariant ESLint rules', async () => {
  const results = await eslint.lintFiles([root]);
  expect(
    results.flatMap((r) => r.messages.map((m) => `${r.filePath}: ${m.ruleId}: ${m.message}`)),
  ).toEqual([]);
});
test.each([
  'db.skillEntry.update({data:{}});',
  'db.skillAssessment.createMany({data:[]});',
  'db.homeworkAssignment.deleteMany({});',
  'db.homeworkSubmission.upsert({});',
  'db.submissionReview.updateManyAndReturn({});',
  'tx.educationReport.create({});',
  "tx['ledgerEntry']['create']({});",
  'tx.ledgerLine.createMany({});',
  'tx.ledgerDocument.delete({});',
  'const entry = tx.ledgerEntry; entry.update({});',
  'const {ledgerEntry: entry} = tx; entry.delete({});',
  'const {create: write} = tx.ledgerEntry; write({});',
  'const write = tx.ledgerEntry.create.bind(tx.ledgerEntry); write({});',
  'const entry = tx?.ledgerEntry; entry?.update({});',
  'tx.$executeRaw`UPDATE ledger_entries SET status=1`;',
  'tx.$queryRawUnsafe("DELETE FROM homework_assignments");',
])('INV-02/03 mutation fixture fails architecture check: %s', async (source) => {
  expect((await lint(source)).some((m) => m.ruleId === 'manager/no-protected-writes')).toBe(true);
});
test('read-only education/ledger delegates remain allowed', async () => {
  const messages = await lint(
    'db.skillEntry.findMany({}); db.educationReport.count({}); tx.ledgerEntry.findFirst({});',
  );
  expect(messages.filter((m) => m.ruleId === 'manager/no-protected-writes')).toEqual([]);
});
test.each([
  'const amount = Number(value);',
  'const amount = parseFloat(value);',
  'const amount = Number.parseFloat(value);',
  'const amount = new Number(value);',
  'interface Money { amount: number }',
  'class Money { price!: number }',
  'const after = balance - amount;',
])('INV-05 rejects unsafe money fixture: %s', async (source) => {
  expect(
    (await lint(source)).some((m) =>
      ['no-restricted-syntax', 'manager/no-money-number'].includes(m.ruleId),
    ),
  ).toBe(true);
});
test('INV-08 rejects throw and async service methods without explicit Result', async () => {
  expect(
    (await lint('function bad() { throw new Error(); }')).some(
      (m) => m.ruleId === 'no-restricted-syntax',
    ),
  ).toBe(true);
  expect(
    (
      await lint(
        'class Service { async get(): Promise<string> { return "bad"; } }',
        'probe.service.ts',
      )
    ).some((m) => m.ruleId === 'manager/result-services'),
  ).toBe(true);
  expect(
    (
      await lint(
        'class Service { async get(): Promise<Result<string, DomainError>> { return ok("ok"); } }',
        'probe.service.ts',
      )
    ).filter((m) => m.ruleId === 'manager/result-services'),
  ).toEqual([]);
});

import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const journal = '/api/v1/teacher/journal';
const checkpointPath = '/api/v1/teacher/checkpoints';
const reportsPage = '/teacher/reports';
const uuid = (part) => '00000000-0000-4000-8000-000000000' + part;
const skillCheckpointId = uuid('801');
const reportCheckpointId = uuid('802');
const reportId = uuid('803');
const snapshotId = uuid('804');
const otherCheckpointId = uuid('805');

export function teacherReportsFixture({ date, lessonId, priorLessonId, enrollmentId, studentId }) {
  const lessons = [
    {
      lessonId,
      startsAt: date,
      endsAt: date,
      state: 'AWAITING_REPORT',
      kind: 'REGULAR',
      studentId,
      studentName: 'Анна Мирова',
      subjectName: 'Математика',
      reportDeadlineAt: date,
      overdue: true,
      latestReportResult: null,
    },
    {
      lessonId: priorLessonId,
      startsAt: date,
      endsAt: date,
      state: 'CONDUCTED',
      kind: 'TRIAL',
      studentId,
      studentName: 'Борис Иванов',
      subjectName: 'Английский',
      reportDeadlineAt: date,
      overdue: false,
      latestReportResult: 'CONDUCTED',
    },
  ];
  const periodStart = new Date(Date.parse(date) - 27 * 86400 * 1000).toISOString();
  const base = {
    triggeredAt: date,
    state: 'PENDING',
    completedAt: null,
    enrollmentId,
    studentId,
    studentName: 'Анна Мирова',
    subjectName: 'Математика',
  };
  const checkpoints = [
    {
      ...base,
      checkpointId: skillCheckpointId,
      type: 'LESSON_4',
      confirmedLessonCount: 4,
    },
    {
      ...base,
      checkpointId: reportCheckpointId,
      type: 'LESSON_8',
      confirmedLessonCount: 8,
    },
  ];
  const otherCheckpoint = {
    ...base,
    checkpointId: otherCheckpointId,
    type: 'LESSON_8',
    confirmedLessonCount: 8,
    studentId: uuid('806'),
    enrollmentId: uuid('807'),
    studentName: 'Виктор Лунгу',
  };
  const otherTeacherDraft = {
    reportId: uuid('808'),
    status: 'DRAFT',
    periodStart,
    periodEnd: date,
    publishedAt: null,
    achievements: 'Уверенно выполняет базовые действия.',
    growthAreas: 'Проверка вычислений.',
    recommendations: 'Два упражнения на деление.',
    teacherSignature: 'Бывший преподаватель',
  };
  let teacherSummary = null;
  let report = null;
  const queries = [];
  const commands = { complete: [], save: [], publish: [] };

  function handle(url, req, json) {
    const path = url.pathname;
    if (path !== journal && path !== checkpointPath && !path.startsWith(checkpointPath + '/'))
      return undefined;
    const state = url.searchParams.get('state');
    const type = url.searchParams.get('type');
    const cursor = url.searchParams.get('cursor');
    if (path === journal) {
      queries.push({ path, state, cursor });
      const matching = lessons.filter((entry) => !state || entry.state === state);
      return json({
        items: matching.slice(cursor ? 1 : 0, cursor ? 2 : 1),
        nextCursor: matching.length > 1 && !cursor ? 'journal-cursor' : null,
        asOf: date,
      });
    }
    if (path === checkpointPath) {
      queries.push({ path, state, type, cursor });
      return json({
        items: checkpoints.filter(
          (entry) => (!state || entry.state === state) && (!type || entry.type === type),
        ),
        nextCursor: null,
      });
    }

    const [, id, action, subaction] = path.slice(checkpointPath.length).split('/');
    const card =
      id === otherCheckpointId
        ? otherCheckpoint
        : checkpoints.find((entry) => entry.checkpointId === id);
    if (!card) return json({ code: 'NOT_FOUND' }, 404);
    if (req.method() === 'GET') {
      return json({
        ...card,
        teacherSummary: card.type === 'LESSON_4' ? teacherSummary : null,
        snapshotId: card.type === 'LESSON_4' && card.state === 'COMPLETED' ? snapshotId : null,
        suggestedPeriodStart: card.type === 'LESSON_8' ? periodStart : null,
        suggestedPeriodEnd: card.type === 'LESSON_8' ? date : null,
        report:
          id === otherCheckpointId ? otherTeacherDraft : card.type === 'LESSON_8' ? report : null,
      });
    }
    assert.equal(req.method(), 'POST');
    const key = req.headers()['idempotency-key'];
    const body = req.postDataJSON();
    assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
    assert.match(key, /^[a-f0-9-]{36}$/);
    if (action === 'complete') {
      assert.equal(card.type, 'LESSON_4');
      commands.complete.push({ key, body });
      assert.equal(card.state, 'PENDING');
      teacherSummary = body.teacherSummary;
      Object.assign(card, { state: 'COMPLETED', completedAt: date });
      return json({ id, completedAt: date, snapshotId });
    }
    assert.equal(action, 'report');
    assert.equal(card.type, 'LESSON_8');
    if (id === otherCheckpointId) return json({ code: 'REPORT_AUTHOR_MISMATCH' }, 409);
    if (subaction === 'publish') {
      commands.publish.push({ key, body });
      assert.equal(body, null);
      if (commands.publish.length === 1) {
        assert.equal(report.status, 'DRAFT');
        report = { ...report, status: 'PUBLISHED', publishedAt: date };
        Object.assign(card, { state: 'COMPLETED', completedAt: date });
        return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      }
      assert.deepEqual(commands.publish[1], commands.publish[0]);
      return json({ id: reportId, status: 'PUBLISHED', publishedAt: date });
    }
    commands.save.push({ key, body });
    assert.notEqual(report?.status, 'PUBLISHED');
    report = {
      ...body,
      reportId,
      status: 'DRAFT',
      periodStart,
      periodEnd: date,
      publishedAt: null,
    };
    return json({ id: reportId, status: 'DRAFT' });
  }

  return { handle, queries, commands, lessonId };
}

export async function verifyTeacherReportDirectory(page, base, api, output) {
  const pageUrl = base + reportsPage;
  await page.goto(pageUrl);
  await page.getByText('Просрочен отчёт', { exact: true }).waitFor();
  if (output)
    await page.screenshot({ path: resolve(output, 'teacher-journal.png'), fullPage: true });
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('link', { name: /Борис Иванов/ }).waitFor();
  assert.deepEqual(api.queries.at(-1), { path: journal, state: null, cursor: 'journal-cursor' });
  await page.getByRole('combobox', { name: 'Статус', exact: true }).selectOption('AWAITING_REPORT');
  await page.waitForURL(pageUrl + '?state=AWAITING_REPORT');
  await page.getByRole('link', { name: /Анна Мирова/ }).click();
  await page.waitForURL(base + '/teacher/lessons/' + api.lessonId);
  await page.goto(pageUrl);
  await page.getByRole('link', { name: 'Срезы и отчёты' }).click();
  await page.getByRole('combobox', { name: 'Вид контрольной точки' }).selectOption('LESSON_4');
  await page.getByRole('link', { name: /Срез навыков · Анна Мирова/ }).waitFor();
  assert.deepEqual(api.queries.at(-1), {
    path: checkpointPath,
    state: null,
    type: 'LESSON_4',
    cursor: null,
  });
  assert.equal(
    await page.getByRole('link', { name: /Отчёт об обучении · Анна Мирова/ }).count(),
    0,
  );
  await page.getByRole('link', { name: /Срез навыков · Анна Мирова/ }).click();
  await page.waitForURL(pageUrl + '/' + skillCheckpointId + '?type=LESSON_4');
  await page.getByRole('link', { name: 'К срезам и отчётам' }).waitFor();
}

export async function verifyTeacherReportCommands(page, base, api, output) {
  const title = page.getByRole('textbox', { name: 'Итог преподавателя', exact: true });
  const summary = 'Ученик уверенно сравнивает дроби одного знаменателя.';
  await title.fill(summary);
  await page.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await page.getByText('Зафиксированный срез навыков', { exact: true }).waitFor();
  assert.equal(await title.count(), 0);
  assert.equal(api.commands.complete.length, 1);
  assert.deepEqual(api.commands.complete[0].body, { teacherSummary: summary });
  await page.getByRole('link', { name: 'Карта навыков ученика', exact: true }).waitFor();
  await page.getByRole('link', { name: 'К срезам и отчётам' }).click();
  await page.waitForURL(base + reportsPage + '?view=checkpoints&type=LESSON_4');
  await page.getByRole('combobox', { name: 'Вид контрольной точки' }).selectOption('LESSON_8');
  await page.getByRole('link', { name: /Отчёт об обучении · Анна Мирова/ }).click();
  await page.waitForURL(base + reportsPage + '/' + reportCheckpointId + '?type=LESSON_8');

  const fields = [
    { label: 'Достижения', key: 'achievements', value: 'Сравнивает обыкновенные дроби.' },
    { label: 'Зоны роста', key: 'growthAreas', value: 'Проверять общий знаменатель.' },
    {
      label: 'Рекомендации',
      key: 'recommendations',
      value: 'Решить три задачи на сложение дробей.',
    },
    { label: 'Подпись преподавателя', key: 'teacherSignature', value: 'Андрей Петров' },
  ];
  const edit = (name) => page.getByRole('textbox', { name, exact: true });
  const save = page.getByRole('button', { name: 'Сохранить черновик', exact: true });
  const publish = page.getByRole('button', { name: 'Опубликовать отчёт', exact: true });
  for (const { label, value } of fields) await edit(label).fill(value);
  assert.ok((await publish.count()) === 0 || (await publish.isDisabled()));
  await save.click();
  await publish.waitFor();
  assert.equal(await publish.isEnabled(), true);
  if (output)
    await page.screenshot({ path: resolve(output, 'teacher-report-draft.png'), fullPage: true });

  fields[2].value = 'Повторить сложение дробей с разными знаменателями.';
  await edit(fields[2].label).fill(fields[2].value);
  assert.equal(await publish.isEnabled(), false);
  await save.click();
  await page.waitForFunction(() => {
    const button = Array.from(globalThis.document.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === 'Опубликовать отчёт',
    );
    return button && !button.disabled;
  });
  assert.equal(api.commands.save.length, 2);
  assert.deepEqual(
    api.commands.save[1].body,
    Object.fromEntries(fields.map(({ key, value }) => [key, value])),
  );
  await publish.click();
  const dialog = page.getByRole('alertdialog', { name: 'Опубликовать отчёт?' });
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.equal(api.commands.publish.length, 0);
  await publish.click();
  await dialog.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await page.getByRole('button', { name: 'Повторить команду', exact: true }).click();
  await page.getByText('Отчёт опубликован', { exact: true }).first().waitFor();
  await page.getByText(fields[2].value, { exact: true }).waitFor();
  assert.equal(await save.count(), 0);
  assert.equal(api.commands.publish.length, 2);
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1280, height: 920 });
  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ro');
  await page.getByText('Raport publicat', { exact: true }).first().waitFor();
  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ru');
  await page.getByText('Отчёт опубликован', { exact: true }).first().waitFor();

  await page.goto(base + reportsPage + '/' + otherCheckpointId);
  const achievements = edit('Достижения');
  const localDraft = 'Локальные замечания должны остаться после обновления.';
  await achievements.fill(localDraft);
  await save.click();
  await page.getByText('Черновик принадлежит другому преподавателю.', { exact: true }).waitFor();
  assert.equal(await achievements.inputValue(), localDraft);
  assert.equal(await achievements.getAttribute('readonly'), '');
  assert.equal(await save.isEnabled(), false);
  assert.equal(await publish.isEnabled(), false);
}

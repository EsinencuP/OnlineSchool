import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const urlPath = '/teacher/homework';
const apiPath = '/api/v1' + urlPath;
const uuid = (part) => '00000000-0000-4000-8000-000000000' + part;
const original = uuid('770');
const older = uuid('771');
const issued = uuid('772');
const first = uuid('773');
const second = uuid('774');
const third = uuid('775');
const reviewId = uuid('776');
const studentId = uuid('777');
const enrollmentId = uuid('778');
const secondEnrollmentId = uuid('779');
const fileId = uuid('780');

export function teacherHomeworkFixture({ date, lessonId, subjectId, alternateSubjectId }) {
  const issues = [];
  const reviews = [];
  const queries = [];
  const newest = {
    submissionId: second,
    version: 2,
    submittedAt: date,
    text: 'Решение после доработки',
    review: null,
  };
  const olderVersion = {
    submissionId: first,
    version: 1,
    submittedAt: date,
    text: 'Первый ответ',
    review: {
      reviewId,
      result: 'NEEDS_REVISION',
      comment: 'Проверьте знаменатель.',
      reviewedAt: date,
    },
  };
  let submissions = [newest, olderVersion];
  const item = {
    deliveryId: original,
    title: 'Задачи на дроби',
    issuedAt: date,
    dueAt: date,
    state: 'AWAITING_REVIEW',
    studentId,
    studentName: 'Анна Мирова',
    subjectName: 'Математика',
    submissionCount: 2,
    latestSubmittedAt: date,
    isLate: true,
  };
  function handle(url, req, json) {
    if (url.pathname === '/api/v1/teacher/enrollments') {
      return json({
        items: [
          {
            enrollmentId,
            studentId,
            studentName: 'Анна Мирова',
            subjectId,
            subjectName: 'Математика',
          },
          {
            enrollmentId: secondEnrollmentId,
            studentId: uuid('781'),
            studentName: 'Борис Иванов',
            subjectId: alternateSubjectId,
            subjectName: 'Английский',
          },
        ],
      });
    }
    if (url.pathname === '/api/v1/teacher/materials') {
      assert.equal(url.searchParams.get('state'), 'VERIFIED');
      return json({
        items: [
          { fileId, fileName: 'worksheet.pdf', status: 'VERIFIED' },
          { fileId: uuid('782'), fileName: 'pending.pdf', status: 'UPLOADING' },
        ],
        nextCursor: null,
      });
    }
    if (!url.pathname.startsWith(apiPath)) return undefined;
    if (req.method() === 'POST') {
      const key = req.headers()['idempotency-key'];
      const body = req.postDataJSON();
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      assert.match(key, /^[a-f0-9-]{36}$/);
      if (url.pathname === apiPath) {
        issues.push({ key, body });
        if (issues.length === 1) return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
        assert.deepEqual(issues[1], issues[0]);
        return json({
          id: uuid('783'),
          deliveries: [{ deliveryId: issued, enrollmentId, studentId }],
        });
      }
      assert.equal(url.pathname, apiPath + '/' + original + '/review');
      reviews.push({ key, body });
      if (reviews.length === 1) {
        assert.equal(body.submissionId, second);
        submissions = [
          { ...newest, submissionId: third, version: 3, text: 'Последний ответ ученика' },
          ...submissions,
        ];
        return json({ code: 'NOT_LATEST_SUBMISSION' }, 409);
      }
      assert.equal(body.submissionId, third);
      if (reviews.length === 2) {
        submissions[0] = {
          ...submissions[0],
          review: { reviewId, result: body.result, comment: body.comment, reviewedAt: date },
        };
        return json({ code: 'COMMAND_IN_PROGRESS' }, 409);
      }
      assert.deepEqual(reviews[2], reviews[1]);
      return json({ id: reviewId, deliveryId: original, submissionId: third, result: body.result });
    }
    if (url.pathname === apiPath) {
      const state = url.searchParams.get('state');
      const cursor = url.searchParams.get('cursor');
      queries.push({ state, cursor });
      return cursor
        ? json({ items: [{ ...item, deliveryId: older, title: 'Геометрия' }], nextCursor: null })
        : json({ items: [item], nextCursor: 'test-opaque-cursor' });
    }
    if (url.pathname === apiPath + '/' + original)
      return json({
        ...item,
        state: submissions[0].review ? 'NEEDS_REVISION' : 'AWAITING_REVIEW',
        description: 'Сравните дроби и объясните решение.',
        lessonId,
        canReview: !submissions[0].review,
        submissions,
      });
    if (url.pathname === apiPath + '/' + issued)
      return json({
        ...item,
        deliveryId: issued,
        title: 'Повторение дробей',
        state: 'NOT_SUBMITTED',
        description: 'Решите задачи из файла.',
        lessonId,
        canReview: false,
        submissions: [],
      });
    return json({ code: 'NOT_FOUND' }, 404);
  }

  return { handle, issues, reviews, queries, subjectId, enrollmentId, studentId };
}

export async function verifyTeacherHomework(page, base, lessonId, api, output) {
  await page.goto(base + urlPath);
  await page.getByLabel('Статус задания').selectOption('AWAITING_REVIEW');
  await page.waitForURL(base + urlPath + '?state=AWAITING_REVIEW');
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('link', { name: 'Геометрия' }).waitFor();
  assert.deepEqual(api.queries.at(-1), { state: 'AWAITING_REVIEW', cursor: 'test-opaque-cursor' });
  await page.getByRole('button', { name: 'Назад' }).click();
  await page.getByRole('link', { name: 'Задачи на дроби' }).click();
  await page.getByText('Первый ответ', { exact: true }).waitFor();
  if (output)
    await page.screenshot({ path: resolve(output, 'teacher-homework-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Сохранить проверку' }).click();
  await page.getByText('Ответ обновился или уже проверен. Карточка перезагружена.').waitFor();
  await page.getByText('Последний ответ ученика', { exact: true }).waitFor();
  await page.getByLabel('Результат', { exact: true }).selectOption('NEEDS_REVISION');
  await page.getByLabel('Комментарий', { exact: true }).fill(' ');
  await page.getByRole('button', { name: 'Сохранить проверку' }).click();
  await page.getByLabel('Комментарий', { exact: true }).fill('Уточните порядок действий.');
  await page.getByRole('button', { name: 'Сохранить проверку' }).click();
  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await page.getByText('Проверка сохранена.', { exact: true }).waitFor();
  await page.getByText('Уточните порядок действий.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Сохранить проверку' }).count(), 0);
  assert.equal(api.reviews.length, 3);
  assert.notEqual(api.reviews[0].key, api.reviews[1].key);
  assert.deepEqual(api.reviews[1].body, {
    submissionId: third,
    result: 'NEEDS_REVISION',
    comment: 'Уточните порядок действий.',
  });
  await page.getByRole('link', { name: 'К списку заданий' }).click();
  await page.waitForURL(base + urlPath + '?state=AWAITING_REVIEW');
  await page.goto(base + '/teacher/lessons/' + lessonId);
  await page.getByRole('link', { name: 'Выдать задание', exact: true }).click();
  await page.waitForURL(base + urlPath + '/new?lessonId=' + lessonId);
  await page.getByText(/Связанный урок · Анна Мирова/).waitFor();
  await page.getByLabel('Название', { exact: true }).fill('Повторение дробей');
  await page.getByLabel('Инструкция', { exact: true }).fill('Решите задачи из файла.');
  await page.getByLabel('Предмет', { exact: true }).selectOption(api.subjectId);
  await page.getByRole('checkbox', { name: 'Анна Мирова' }).check();
  assert.equal(await page.getByRole('checkbox', { name: 'Борис Иванов' }).count(), 0);
  await page.locator('summary').filter({ hasText: 'Вложения из моих материалов' }).click();
  await page.getByRole('checkbox', { name: 'worksheet.pdf' }).check();
  assert.equal(await page.getByRole('checkbox', { name: 'pending.pdf' }).count(), 0);
  if (output)
    await page.screenshot({ path: resolve(output, 'teacher-homework-issue.png'), fullPage: true });
  await page.getByRole('button', { name: 'Выдать задание' }).click();
  await page.getByRole('button', { name: 'Повторить отправку' }).waitFor();
  assert.equal(await page.getByLabel('Название', { exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await page.getByText('Задание выдано.', { exact: true }).waitFor();
  assert.equal(api.issues.length, 2);
  assert.deepEqual(api.issues[0].body, {
    title: 'Повторение дробей',
    description: 'Решите задачи из файла.',
    enrollmentIds: [api.enrollmentId],
    lessonId,
    attachmentFileIds: [fileId],
  });
  await page.getByRole('link', { name: 'Анна Мирова' }).click();
  await page.getByText('Ученик ещё не сдал задание.', { exact: true }).waitFor();
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
    true,
  );
  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ro');
  await page.getByText('Răspunsurile elevului', { exact: true }).waitFor();
}

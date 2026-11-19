import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const teacherStudents = '/teacher/students';
const enrollmentsPath = '/api/v1/teacher/enrollments';
const uuid = (part) => '00000000-0000-4000-8000-000000000' + part;
const foreignEnrollmentId = uuid('791');
const otherEnrollmentId = uuid('792');
const otherStudentId = uuid('793');
const skillId = uuid('794');
const personalSkillId = uuid('795');
const pausedGoalId = uuid('796');
const createdGoalId = uuid('797');
const assessmentId = uuid('798');

export function teacherStudentsFixture({
  date,
  future,
  lessonId,
  priorLessonId,
  homework,
  alternateSubjectId,
}) {
  const { enrollmentId, studentId, subjectId } = homework;
  const own = enrollmentsPath + '/' + enrollmentId;
  const reads = [];
  const created = [];
  const changed = [];
  const assessed = [];
  const goals = [
    {
      goalId: pausedGoalId,
      text: 'Повторить умножение',
      targetDate: null,
      status: 'PAUSED',
      skillId: null,
      createdAt: date,
      updatedAt: date,
    },
  ];
  const skills = [
    {
      skillId,
      name: 'Сравнение дробей',
      category: 'Арифметика',
      personal: false,
      status: 'NOT_STUDIED',
      assessedAt: null,
      assessedByName: null,
      publicComment: null,
    },
    {
      skillId: personalSkillId,
      name: 'Устный счёт',
      category: 'Арифметика',
      personal: true,
      status: 'FAMILIARIZING',
      assessedAt: date,
      assessedByName: 'Андрей Петров',
      publicComment: null,
    },
  ];
  const history = [];
  function handle(url, req, json) {
    const path = url.pathname;
    if (path !== enrollmentsPath && !path.startsWith(enrollmentsPath + '/')) return undefined;
    if (req.method() === 'GET') {
      reads.push(path);
      if (path === enrollmentsPath) {
        return json({
          items: [
            {
              enrollmentId,
              studentId,
              studentName: 'Анна Мирова',
              subjectId,
              subjectName: 'Математика',
              assignedFrom: date,
              confirmedLessons: 8,
              nextLessonAt: future,
            },
            {
              enrollmentId: otherEnrollmentId,
              studentId: otherStudentId,
              studentName: 'Борис Иванов',
              subjectId: alternateSubjectId,
              subjectName: 'Английский',
              assignedFrom: date,
              confirmedLessons: 1,
              nextLessonAt: null,
            },
          ],
        });
      }
      if (path === own + '/overview')
        return json({
          enrollmentId,
          studentId,
          studentName: 'Анна Мирова',
          subjectName: 'Математика',
          confirmedLessons: 8,
          lessonsToNextReview: 4,
          pendingCheckpoints: 2,
          activeGoals: goals.filter((goal) => goal.status === 'ACTIVE').length,
          upcomingLessons: [{ lessonId, startsAt: future, status: 'SCHEDULED' }],
          recentLessons: [{ lessonId: priorLessonId, startsAt: date, status: 'CONDUCTED' }],
          homework: { notSubmitted: 2, awaitingReview: 5, needsRevision: 1, reviewed: 3 },
          skills: {
            notStudied: Number(skills[0].status === 'NOT_STUDIED'),
            familiarizing: 1,
            practicing: Number(skills[0].status === 'PRACTICING'),
            applying: 0,
          },
        });
      if (path === own + '/goals') return json({ enrollmentId, goals });
      if (path === own + '/skills')
        return json({
          enrollmentId,
          studentName: 'Анна Мирова',
          subjectName: 'Математика',
          skills,
        });
      if (path === own + '/skills/' + skillId + '/history')
        return json({ skillId, skillName: 'Сравнение дробей', items: history });
      return json({ code: 'NOT_FOUND' }, 404);
    }
    const body = req.postDataJSON();
    const key = req.headers()['idempotency-key'];
    assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
    assert.match(key, /^[a-f0-9-]{36}$/);
    if (path === own + '/goals') {
      assert.equal(req.method(), 'POST');
      created.push({ body, key });
      if (created.length === 1) {
        goals.unshift({
          ...body,
          goalId: createdGoalId,
          status: 'ACTIVE',
          createdAt: date,
          updatedAt: date,
        });
        return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      }
      assert.deepEqual(created[1], created[0]);
      return json({ id: createdGoalId, status: 'ACTIVE' });
    }
    if (path === own + '/goals/' + createdGoalId) {
      assert.equal(req.method(), 'PATCH');
      changed.push({ body, key });
      const index = goals.findIndex((goal) => goal.goalId === createdGoalId);
      goals[index] = { ...goals[index], ...body };
      return json({ id: createdGoalId, status: goals[index].status });
    }
    if (path === own + '/skills/' + skillId + '/assessments') {
      assert.equal(req.method(), 'POST');
      assessed.push({ body, key });
      if (assessed.length === 1) {
        skills[0] = {
          ...skills[0],
          status: body.level,
          assessedAt: date,
          assessedByName: 'Андрей Петров',
          publicComment: body.publicComment,
        };
        history.unshift({
          auditId: assessmentId,
          changedAt: date,
          fromStatus: 'NOT_STUDIED',
          toStatus: body.level,
          teacherName: 'Андрей Петров',
          publicComment: body.publicComment,
          basis: body.basis,
        });
        return json({ code: 'COMMAND_IN_PROGRESS' }, 409);
      }
      assert.deepEqual(assessed[1], assessed[0]);
      return json({
        id: assessmentId,
        skillId,
        enrollmentId,
        fromStatus: 'NOT_STUDIED',
        toStatus: body.level,
        assessedAt: date,
      });
    }
    return json({ code: 'NOT_FOUND' }, 404);
  }

  return { handle, reads, created, changed, assessed, enrollmentId, priorLessonId };
}

export async function verifyTeacherStudentOverview(page, base, api, output) {
  const path = base + teacherStudents;
  await page.goto(path);
  const search = page.getByRole('searchbox', { name: 'Поиск по имени' });
  await search.fill('Борис');
  await page.getByRole('link', { name: /Борис Иванов/ }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Анна Мирова/ }).count(), 0);
  await search.fill('');
  await page.getByRole('combobox', { name: 'Предмет' }).selectOption({ label: 'Математика' });
  assert.equal(await page.getByRole('link', { name: /Борис Иванов/ }).count(), 0);
  await page.getByRole('link', { name: /Анна Мирова/ }).click();
  await page.waitForURL(path + '/' + api.enrollmentId);
  await page.getByRole('heading', { name: 'Анна Мирова' }).waitFor();
  await page.getByRole('heading', { name: 'Недавние уроки' }).waitFor();
  const summary = page.locator('.cab-roster-metrics');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['8', '4', '0', '2']);
  await page
    .locator('.cab-roster-overview')
    .getByRole('link', { name: /Проведён/ })
    .waitFor();
  if (output)
    await page.screenshot({
      path: resolve(output, 'teacher-student-overview.png'),
      fullPage: true,
    });
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1280, height: 920 });

  const before = api.reads.length;
  await page.goto(path + '/' + foreignEnrollmentId + '?tab=skills');
  await page.getByRole('alert').filter({ hasText: 'Данные ученика недоступны.' }).waitFor();
  assert.deepEqual(api.reads.slice(before), [
    enrollmentsPath + '/' + foreignEnrollmentId + '/overview',
  ]);
  await page.getByRole('link', { name: 'К списку учеников', exact: true }).click();
  await page.getByRole('link', { name: /Анна Мирова/ }).click();
}

export async function verifyTeacherStudentWorkflows(page, base, api, output) {
  const record = base + teacherStudents + '/' + api.enrollmentId;
  const tabs = page.getByRole('navigation', { name: 'Разделы карточки ученика' });
  await tabs.getByRole('link', { name: 'Цели обучения', exact: true }).click();
  await page.waitForURL(record + '?tab=goals');
  await page.getByText('Повторить умножение', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Новая цель' }).click();
  await page.getByRole('textbox', { name: 'Текст цели' }).fill('Применять общий знаменатель');
  await page.getByLabel('Целевая дата', { exact: true }).fill('2099-02-01');
  await page.getByRole('combobox', { name: 'Связанный навык' }).selectOption(skillId);
  await page.getByRole('button', { name: 'Создать цель' }).click();
  await page.getByRole('button', { name: 'Повторить сохранение' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Текст цели' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Повторить сохранение' }).click();
  await page.getByText('Цель создана.', { exact: true }).waitFor();
  const goal = page.getByRole('listitem').filter({ hasText: 'Применять общий знаменатель' });
  await goal.getByText('Сравнение дробей', { exact: true }).waitFor();
  assert.equal(api.created.length, 2);
  assert.deepEqual(api.created[0].body, {
    text: 'Применять общий знаменатель',
    targetDate: '2099-02-01',
    skillId,
  });
  if (output)
    await page.screenshot({ path: resolve(output, 'teacher-student-goals.png'), fullPage: true });

  await goal.getByRole('button', { name: 'Изменить', exact: true }).click();
  await page.getByRole('button', { name: 'Очистить дату' }).click();
  await page.getByRole('combobox', { name: 'Статус', exact: true }).selectOption('ARCHIVED');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await goal.getByText('В архиве', { exact: true }).waitFor();
  assert.equal(await goal.getByRole('button', { name: 'Изменить' }).count(), 0);
  assert.equal(api.changed.length, 1);
  assert.deepEqual(api.changed[0].body, { targetDate: null, status: 'ARCHIVED' });

  await tabs.getByRole('link', { name: 'Карта навыков', exact: true }).click();
  await page.waitForURL(record + '?tab=skills');
  const skill = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Сравнение дробей', exact: true }),
  });
  await skill.getByText('Не изучено', { exact: true }).waitFor();
  const historyPath = enrollmentsPath + '/' + api.enrollmentId + '/skills/' + skillId + '/history';
  assert.equal(api.reads.includes(historyPath), false);
  await skill.getByText('История навыка', { exact: true }).click();
  await skill.getByText('Изменений пока нет.', { exact: true }).waitFor();
  await skill.getByRole('button', { name: 'Оценить навык', exact: true }).click();
  await page.getByRole('combobox', { name: 'Новый этап' }).selectOption('PRACTICING');
  await page
    .getByRole('combobox', { name: 'Подтверждённый урок (необязательно)' })
    .selectOption(api.priorLessonId);
  await page
    .getByRole('textbox', { name: 'Внутреннее обоснование' })
    .fill('Самостоятельно сравнил три пары дробей.');
  await page
    .getByRole('textbox', { name: 'Комментарий для ученика' })
    .fill('Попробуй сравнить дроби с разными знаменателями.');
  await page.getByRole('button', { name: 'Сохранить оценку' }).click();
  await page.getByRole('button', { name: 'Повторить отправку' }).waitFor();
  assert.equal(
    await page.getByRole('textbox', { name: 'Внутреннее обоснование' }).isDisabled(),
    true,
  );
  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await page.getByText('Оценка сохранена.', { exact: true }).waitFor();
  await skill.getByText(/Самостоятельно сравнил три пары дробей/).waitFor();
  assert.equal(api.assessed.length, 2);
  assert.deepEqual(api.assessed[0].body, {
    level: 'PRACTICING',
    basis: 'Самостоятельно сравнил три пары дробей.',
    publicComment: 'Попробуй сравнить дроби с разными знаменателями.',
    lessonId: api.priorLessonId,
  });
  if (output)
    await page.screenshot({ path: resolve(output, 'teacher-student-skills.png'), fullPage: true });

  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ro');
  await page.getByRole('heading', { name: 'Harta competențelor', exact: true }).waitFor();
  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ru');
  await page.getByRole('heading', { name: 'Карта навыков', exact: true }).waitFor();
}

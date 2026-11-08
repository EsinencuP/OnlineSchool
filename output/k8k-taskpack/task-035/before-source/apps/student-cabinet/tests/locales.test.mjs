import assert from 'node:assert/strict';
import test from 'node:test';
import {
  studentMessages,
  translateStudent,
  studentLessonCount,
  formatMoneyAmount,
  formatDateOnly,
} from '@online-school/ui';
import { formatStudentDate, lessonCountdown } from '../src/student-presentation.ts';

test('TASK-034 every student message has RU/RO and matching complete placeholders', () => {
  assert.deepEqual(Object.keys(studentMessages.ru).sort(), Object.keys(studentMessages.ro).sort());
  for (const locale of ['ru', 'ro'])
    for (const [key, value] of Object.entries(studentMessages[locale])) {
      const params = Object.fromEntries(
        [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => [name, 'synthetic']),
      );
      const actual = Object.keys(params).length
        ? translateStudent(locale, key, params)
        : translateStudent(locale, key);
      assert(actual.trim());
      assert.notEqual(actual, key);
      assert(!/\{\w+\}/.test(actual));
      assert.deepEqual(
        [...value.matchAll(/\{(\w+)\}/g)].map(([, n]) => n).sort(),
        [...studentMessages.ru[key].matchAll(/\{(\w+)\}/g)].map(([, n]) => n).sort(),
      );
    }
  assert.equal(translateStudent('ro', 'student.alias'), 'Cum să ne adresăm');
  assert.equal(translateStudent('ro', 'home'), 'Acasă');
});
test('TASK-034 locale does not move date-only, change server countdown or round exact money', () => {
  for (const locale of ['ru', 'ro']) {
    assert.equal(
      formatStudentDate('2026-11-01', 'America/New_York', true, locale),
      formatDateOnly('2026-11-01', locale),
    );
    assert.match(formatMoneyAmount('600.1234', 'MDL', locale), /600,1234/);
    assert.equal(
      formatStudentDate('bad', 'America/New_York', false, locale),
      translateStudent(locale, 'student.notSpecified'),
    );
  }
  const clock = lessonCountdown('2026-11-08T12:10:00Z', Date.parse('2026-11-08T12:00:00Z'));
  assert(clock);
  assert.equal(studentLessonCount('ru', 1), '1 урок');
  assert.equal(studentLessonCount('ru', 2), '2 урока');
  assert.equal(studentLessonCount('ru', 8), '8 уроков');
  assert.equal(studentLessonCount('ro', 1), '1 lecție');
  assert.equal(studentLessonCount('ro', 8), '8 lecții');
  assert.equal(studentLessonCount('ro', 21), '21 de lecții');
});

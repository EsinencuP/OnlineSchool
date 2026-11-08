import assert from 'node:assert/strict';
import test from 'node:test';
import {
  meetPresentation,
  meetClockFor,
  meetTime,
  rememberMeetRead,
  lessonCountdown,
  formatStudentDate,
  notificationTarget,
} from '../src/student-presentation.ts';
import { findSubjectPlan, subjectSubscriptionRows } from '../src/subscription-presentation.ts';
import { anchors, subscriptionSubjects } from './k8k-subscriptions/data.mjs';
const starts = Date.parse('2026-11-03T10:00:00Z');
const url = 'https://meet.google.com/abc-defg-hij';
const lesson = {
  scheduledAt: new Date(starts).toISOString(),
  status: 'SCHEDULED',
  canJoin: true,
  meetLink: url,
};
test('Meet is denied before T-10 even with inconsistent positive capability', () => {
  const state = meetPresentation(lesson, url, true, starts - 600_001);
  assert.equal(state.kind, 'disabled');
  assert.match(state.reason, /10 минут/);
});
test('T-10 opens only with a valid URL and positive server capability', () => {
  assert.equal(meetPresentation(lesson, url, true, starts - 600_000).kind, 'ready');
  assert.equal(meetPresentation({ ...lesson, canJoin: false }, url, true, starts).kind, 'disabled');
  assert.equal(meetPresentation(lesson, undefined, true, starts).kind, 'unavailable');
});
test('clock progression alone cannot turn a negative server capability into admission', () => {
  for (const serverNow of [starts - 600_001, starts - 600_000, starts, starts + 1000])
    assert.notEqual(
      meetPresentation({ ...lesson, canJoin: false }, url, true, serverNow).kind,
      'ready',
    );
});
test('stale or cancelled data never exposes the capability URL', () => {
  for (const state of [
    meetPresentation(lesson, url, false, starts),
    meetPresentation({ ...lesson, status: 'CANCELLED' }, url, true, starts),
  ]) {
    assert.notEqual(state.kind, 'ready');
    assert.ok(!('url' in state));
  }
});
test('missing clock or authoritative status cannot enable a cached URL', () => {
  assert.equal(meetPresentation(lesson, url, true, null).reasonKey, 'refresh');
  assert.equal(
    meetPresentation({ ...lesson, status: undefined }, url, true, starts).reasonKey,
    'refresh',
  );
  assert.equal(meetPresentation({ ...lesson, canJoin: false }, url, true, null).kind, 'disabled');
  assert.equal(lessonCountdown(lesson.scheduledAt, null), null);
});
test('server reference uses monotonic request timing and closes conservatively', () => {
  const snapshot = {};
  const asOf = '2026-11-03T09:30:00Z';
  rememberMeetRead(snapshot, 1_000, 1_025);
  const clock = meetClockFor(snapshot, asOf);
  const sample = meetTime(clock, 30_025);
  assert.equal(sample, Date.parse('2026-11-03T09:30:29Z'));
  assert.equal(lessonCountdown(lesson.scheduledAt, sample), 'Через 30 мин.');
  assert.equal(meetTime(clock, 30_025, true), sample + 25);
  assert.equal(meetClockFor({}, asOf), null);
  assert.equal(meetClockFor(snapshot, 'invalid'), null);
});
test('T0 and T+60 retain an authorized URL, +1ms closes it', () => {
  assert.equal(lessonCountdown(lesson.scheduledAt, starts), 'Урок начался');
  assert.equal(lessonCountdown(lesson.scheduledAt, starts, 'ro'), 'Lecția a început');
  assert.equal(meetPresentation(lesson, url, true, starts + 3_600_000).kind, 'ready');
  assert.equal(meetPresentation(lesson, url, true, starts + 3_600_001).reasonKey, 'ended');
});
test('date-only validity is not shifted or given a fictional time', () => {
  assert.equal(formatStudentDate('2026-11-30', 'America/New_York'), '30 ноября');
  assert.equal(formatStudentDate('2026-11-30', 'America/New_York', true), '30 ноября');
  assert.match(formatStudentDate('2026-11-30T02:00:00Z', 'America/New_York', true), /29 ноября/);
});
test('event targets use only owned API object IDs and existing routes', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  assert.equal(notificationTarget({ lessonId: id }).href, `/student/lessons/${id}`);
  assert.equal(notificationTarget({ homeworkId: id }).href, `/student/homework/${id}`);
  assert.equal(
    notificationTarget({ subscriptionId: id }).href,
    `/student/subscription?subscriptionId=${id}`,
  );
  assert.equal(notificationTarget({ lessonId: 'javascript:alert(1)' }), null);
  assert.equal(notificationTarget({ url: 'https://example.invalid' }), null);
  assert.equal(
    notificationTarget({ reportId: id }).href,
    `/student/reports?reportId=${id}`,
    'educational reports have their own route, separate from snapshots',
  );
});

test('TASK-033 event type restricts the entity kind and labels follow locale without using payload URLs', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  assert.equal(
    notificationTarget({ lessonId: id, reportId: id }, 'REPORT_READY', 'ro').href,
    '/student/reports?reportId=' + id,
  );
  assert.equal(notificationTarget({ lessonId: id }, 'HOMEWORK_REVIEWED'), null);
  assert.equal(notificationTarget({ lessonId: id }, 'MANUAL_MESSAGE'), null);
  assert.equal(notificationTarget({ subscriptionId: id }, 'UNSUPPORTED'), null);
  assert.equal(
    notificationTarget(
      { reportId: 'javascript:alert(1)', url: 'https://example.invalid' },
      'REPORT_READY',
    ),
    null,
  );
  assert.equal(
    notificationTarget({ subscriptionId: id }, 'PAYMENT_CONFIRMED', 'ro').label,
    'Deschide abonamentul',
  );
  assert.equal(
    notificationTarget({ homeworkId: id }, 'HOMEWORK_NEEDS_REVISION', 'ro').label,
    'Deschide tema',
  );
});
test('subject rows preserve financial anchors and distinguish no plan, unknown and zero', () => {
  const [math, physics] = subscriptionSubjects('partial');
  const [row] = subjectSubscriptionRows(math);
  const url = new URL(row.href, 'http://localhost');
  assert.equal(url.searchParams.get('subscriptionId'), anchors.math);
  assert.notEqual(url.searchParams.get('subscriptionId'), anchors.wrapper);
  assert.equal(row.plan.paidLessonsRemaining, 0);
  assert.equal(row.plan.temporaryAdmission.lessonsRemaining, 2);
  assert.equal(subjectSubscriptionRows(physics)[0].plan.paidLessonsRemaining, null);
  assert.equal(subjectSubscriptionRows(subscriptionSubjects('no-plan')[1])[0].plan, null);
});
test('a grouping ID can identify returned details but never selects an explicit plan', () => {
  const items = subscriptionSubjects();
  assert.equal(findSubjectPlan(items, anchors.wrapper), undefined);
  assert.equal(findSubjectPlan(items, anchors.wrapper, true).plan.subscriptionId, anchors.math);
  assert.equal(findSubjectPlan(items, anchors.future), undefined);
});

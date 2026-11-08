import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  StateBoundary,
  PriorityEvents,
  queryBoundaryState,
  roleNavigation,
  activeNavigation,
  operationalQueryInterval,
  FreshnessLabel,
  StagesTrack,
} from '../dist/index.js';
const privateContent = h('p', null, 'PRIVATE_LESSON');
const render = (state) =>
  renderToStaticMarkup(h(StateBoundary, { state, at: Date.UTC(2026, 10, 2, 8) }, privateContent));
for (const status of [
  'loading',
  'empty',
  'ready',
  'stale',
  'error',
  'pending',
  'forbidden',
  'subscription-limited',
  'session-expired',
]) {
  test(`VIS-11: ${status}`, () => {
    const state =
      status === 'pending'
        ? { status, outcome: 'unknown' }
        : status === 'subscription-limited'
          ? { status, message: 'Ограничена только математика' }
          : { status };
    const html = render(state);
    assert.ok(html.includes(`data-state="${status}"`));
    assert.equal(
      html.includes('PRIVATE_LESSON'),
      ['ready', 'stale', 'pending', 'subscription-limited'].includes(status),
    );
    if (status === 'pending') {
      assert.ok(html.includes('Результат действия пока неизвестен'));
      assert.ok(!html.includes('<button'));
    }
    if (status === 'loading') assert.ok(!html.includes('Пока нет'));
  });
}
test('ACL and session denial take precedence over cached data and loading', () => {
  for (const [errorStatus, expected] of [
    [401, 'session-expired'],
    [403, 'forbidden'],
  ]) {
    const state = queryBoundaryState({ isPending: true, hasData: true, error: true, errorStatus });
    assert.equal(state.status, expected);
    assert.ok(!render(state).includes('PRIVATE_LESSON'));
  }
});
test('cached error and stale empty response never claim a fresh empty list', () => {
  assert.equal(
    queryBoundaryState({ isPending: false, hasData: true, error: true, empty: true }).status,
    'stale',
  );
  assert.equal(
    queryBoundaryState({ isPending: true, hasData: false, empty: true }).status,
    'loading',
  );
  assert.equal(
    queryBoundaryState({ isPending: false, hasData: true, empty: true }).status,
    'empty',
  );
});
test('no event source produces no event card or artificial zero', () => {
  assert.equal(renderToStaticMarkup(h(PriorityEvents)), '');
});
test('VIS-07: supplied primary and full queue count remain separate', () => {
  const html = renderToStaticMarkup(
    h(PriorityEvents, {
      enabled: true,
      source: {
        primary: {
          id: 'selected-by-source',
          title: 'Событие Б',
          action: h('a', { href: '#object' }, 'Открыть объект'),
        },
        criticalCount: 4,
        queueAction: h('a', { href: '#queue' }, 'Вся очередь'),
      },
    }),
  );
  assert.ok(html.includes('Событие Б'));
  assert.ok(html.includes('<strong>4</strong>'));
  assert.ok(html.includes('Вся очередь'));
});
test('stable role navigation contains only existing entries', () => {
  assert.deepEqual(Object.keys(roleNavigation), [
    'STUDENT',
    'MANAGER',
    'TEACHER',
    'DIRECTOR',
    'TECH_OPERATOR',
  ]);
  for (const items of Object.values(roleNavigation))
    assert.ok(!items.some((x) => /сообщения|написать менеджеру|уведомления/i.test(x.label)));
  assert.equal(
    activeNavigation(roleNavigation.MANAGER, '/manager/students/id/account'),
    'students',
  );
  assert.equal(activeNavigation(roleNavigation.STUDENT, '/student/homework/id'), 'homework');
  assert.ok(roleNavigation.TEACHER.every((x) => !x.href));
});
test('operational refresh never polls financial, published or archived data', () => {
  assert.equal(operationalQueryInterval(['manager', 'dashboard']), 60_000);
  assert.equal(operationalQueryInterval(['manager', 'payments']), false);
  assert.equal(operationalQueryInterval(['student', 'skills']), false);
  assert.equal(operationalQueryInterval(['student', 'lessons', 'archive', 'list']), false);
  assert.equal(operationalQueryInterval(['student', 'lessons', 'archive', 'calendar']), 60_000);
});
test('unknown freshness is explicit and invalid dates cannot crash rendering', () => {
  for (const at of [undefined, 0, NaN, Infinity, 1e100])
    assert.match(renderToStaticMarkup(h(FreshnessLabel, { at })), /неизвестно/);
});
test('server asOf and client receipt have independent labels and instants', () => {
  const html = renderToStaticMarkup(
    h(FreshnessLabel, { asOf: '2026-11-04T09:00:00+02:00', receivedAt: Date.UTC(2026, 10, 4, 8) }),
  );
  assert.match(
    html,
    /Данные сервера на <time data-time-source="server"[^>]*2026-11-04T07:00:00\.000Z/,
  );
  assert.match(html, /Получено в <time data-time-source="client"[^>]*2026-11-04T08:00:00\.000Z/);
  const receiptOnly = renderToStaticMarkup(
    h(FreshnessLabel, { asOf: '2026-11-04T09:00:00', at: Date.UTC(2026, 10, 4, 8) }),
  );
  assert.doesNotMatch(receiptOnly, /data-time-source="server"/);
  assert.match(receiptOnly, /data-time-source="client"/);
  assert.match(
    renderToStaticMarkup(
      h(FreshnessLabel, { asOf: '2026-11-04T09:00:00Z', timeZone: 'Invalid/Zone' }),
    ),
    /неизвестно/,
  );
});
test('stale empty describes the old response without presenting a fresh empty state', () => {
  const state = queryBoundaryState({ isPending: false, hasData: true, tooOld: true, empty: true });
  assert.deepEqual(state, { status: 'stale', empty: true });
  assert.match(render(state), /Последняя загрузка не вернула записей/);
});
test('denial and unknown result suppress contextual actions and retries', () => {
  for (const state of [
    { status: 'forbidden' },
    { status: 'session-expired' },
    { status: 'pending', outcome: 'unknown' },
  ]) {
    const html = renderToStaticMarkup(
      h(
        StateBoundary,
        {
          state,
          retryRead: () => assert.fail('unexpected retry'),
          action: h('button', null, 'Context action'),
        },
        privateContent,
      ),
    );
    assert.doesNotMatch(html, /<button|Context action/);
  }
});
test('the track displays exactly three qualitative stages without treating NOT_STUDIED as a stage', () => {
  const html = renderToStaticMarkup(h(StagesTrack, { label: 'Fixture', stage: 'PRACTICING' }));
  assert.equal(html.match(/<li\b/g).length, 3);
  assert.match(html, /aria-current="step">Практикую/);
  assert.doesNotMatch(html, /%|progressbar|button/);
  const neutral = renderToStaticMarkup(h(StagesTrack, { label: 'Fixture', stage: 'NOT_STUDIED' }));
  assert.match(neutral, /Ещё не изучали/);
  assert.doesNotMatch(neutral, /aria-current/);
});

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DenseTable, KanbanColumn, ListRow } from '../dist/index.js';

const base = {
  caption: 'Fixture',
  rows: [
    { id: 'z', value: 'first supplied row' },
    { id: 'a', value: 'second supplied row' },
  ],
  rowKey: (row) => row.id,
  columns: [
    { id: 'value', header: 'Value', cell: (row) => row.value, sortDirections: ['asc', 'desc'] },
  ],
  state: { status: 'ready' },
  pageInfo: { total: null, hasMore: true },
};
test('server order survives sorting metadata and unknown totals retain the next action', () => {
  const html = renderToStaticMarkup(
    h(DenseTable, {
      ...base,
      sort: { columnId: 'value', direction: 'asc' },
      onPageChange: () => assert.fail('render navigates'),
    }),
  );
  assert.match(html, /aria-sort="ascending"/);
  assert.ok(html.indexOf('first supplied row') < html.indexOf('second supplied row'));
  assert.match(html, /Общее число неизвестно.*Есть ещё записи.*Следующая страница/);
});
test('denial removes cached cells, selection and pagination', () => {
  for (const status of ['forbidden', 'session-expired']) {
    const html = renderToStaticMarkup(
      h(DenseTable, {
        ...base,
        state: { status },
        selection: { ids: new Set(['z']), label: () => 'private name', onChange: () => {} },
      }),
    );
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /supplied row|private name|<table|Страницы списка/);
  }
});
test('Kanban uses the given count and leaves ListRow links and actions accessible', () => {
  const html = renderToStaticMarkup(
    h(
      KanbanColumn,
      { title: 'Fixture', count: 0, pending: true },
      h(
        'ul',
        null,
        h(ListRow, {
          title: h('a', { href: '/fixture' }, 'Open object'),
          actions: h('button', { type: 'button' }, 'Fixture action'),
        }),
      ),
    ),
  );
  assert.match(html, /Всего 0/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<li.*href="\/fixture".*Fixture action/);
});

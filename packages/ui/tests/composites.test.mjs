import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroCard, StatTile, Toast } from '../dist/index.js';

const supplied = {
  title: 'Fixture',
  value: '12345678901234567890.123456789',
  unit: 'MDL',
  source: 'Synthetic source',
  period: 'Synthetic period',
  action: h('a', { href: '#fixture' }, 'Synthetic action'),
  state: { status: 'ready' },
  stateText: 'Fixture state',
};
test('information cards preserve a supplied decimal string and its metadata', () => {
  for (const Component of [HeroCard, StatTile]) {
    const html = renderToStaticMarkup(h(Component, supplied));
    for (const text of [
      supplied.value,
      supplied.unit,
      supplied.source,
      supplied.period,
      'Synthetic action',
    ])
      assert.ok(html.includes(text));
    const absent = renderToStaticMarkup(h(Component, { ...supplied, value: undefined }));
    assert.doesNotMatch(absent, /k8k-information-value|>0</);
  }
});
test('denied information cards omit cached value, provenance and action from DOM', () => {
  for (const status of ['forbidden', 'session-expired']) {
    const html = renderToStaticMarkup(h(StatTile, { ...supplied, state: { status } }));
    assert.match(html, /Fixture state/);
    assert.doesNotMatch(html, /1234567890|Synthetic source|Synthetic period|Synthetic action/);
  }
});
test('toast deduplicates result IDs and cannot style an uncertain result as success', () => {
  const items = [
    { id: 'one', outcome: 'queued', tone: 'success', message: 'Queued fixture' },
    { id: 'one', outcome: 'confirmed', tone: 'success', message: 'Duplicate fixture' },
    { id: 'two', outcome: 'unknown', tone: 'success', message: 'Unknown fixture' },
  ];
  const html = renderToStaticMarkup(
    h(Toast, { items, label: 'Results', onDismiss: () => assert.fail('render invokes dismissal') }),
  );
  assert.equal(html.match(/data-toast-id=/g).length, 2);
  assert.match(html, /data-outcome="queued" data-tone="info"/);
  assert.match(html, /data-outcome="unknown" data-tone="warning"/);
  assert.doesNotMatch(html, /Duplicate fixture|data-tone="success"/);
});

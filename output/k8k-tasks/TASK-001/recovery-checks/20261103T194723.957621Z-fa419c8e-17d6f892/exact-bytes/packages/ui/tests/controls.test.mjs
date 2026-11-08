import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, Field, StatusChip, Avatar } from '../dist/index.js';
test('pending button prevents duplicate intent and exposes busy state', () => {
  const html = renderToStaticMarkup(h(Button, { pending: true }, 'Save'));
  assert.match(html, /type="button"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
});
test('field keeps caller description and links validation to input', () => {
  const html = renderToStaticMarkup(
    h(Field, { id: 'email', label: 'Email', error: 'Invalid', 'aria-describedby': 'help' }),
  );
  assert.match(html, /for="email"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="help email-description"/);
  assert.match(html, /id="email-description" role="alert"/);
});
test('status always contains text; decorative glyph is hidden', () => {
  const html = renderToStaticMarkup(h(StatusChip, { tone: 'success' }, 'Active'));
  assert.match(html, /Active/);
  assert.match(html, /aria-hidden="true"/);
});
test('avatar uses initials and a full accessible name without an image', () => {
  const html = renderToStaticMarkup(h(Avatar, { name: 'Ana Rusu' }));
  assert.match(html, /aria-label="Ana Rusu"/);
  assert.match(html, />AR</);
  assert.doesNotMatch(html, /<img/);
});

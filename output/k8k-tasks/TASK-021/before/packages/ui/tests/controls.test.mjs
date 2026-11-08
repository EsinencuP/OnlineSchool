import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  Field,
  Select,
  StatusChip,
  Avatar,
  Card,
  IconButton,
  Icon,
} from '../dist/index.js';
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
test('default Button is safe in forms while explicit submit and native attrs survive', () => {
  const html = renderToStaticMarkup(h(Button, { name: 'action', value: 'save' }, 'Save'));
  assert.match(html, /type="button"/);
  assert.match(html, /name="action"/);
  assert.match(html, /value="save"/);
  assert.match(renderToStaticMarkup(h(Button, { type: 'submit' }, 'Save')), /type="submit"/);
});
test('disabled reason is visible and merged with external explanation', () => {
  const html = renderToStaticMarkup(
    h(
      Button,
      {
        disabled: true,
        disabledReason: 'Approval is required',
        'aria-describedby': 'external external',
      },
      'Save',
    ),
  );
  assert.match(html, /Approval is required/);
  assert.match(html, /aria-describedby="external [^"]+-reason"/);
  assert.match(html, /id="[^"]+-reason"/);
});
test('hint and error coexist with stable primary description and deduped external IDs', () => {
  const html = renderToStaticMarkup(
    h(Field, {
      id: 'name',
      label: 'Name',
      hint: 'Existing help',
      error: 'Invalid value',
      'aria-describedby': 'external external name-description',
      'aria-invalid': false,
    }),
  );
  assert.match(html, /aria-describedby="external name-description name-hint"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /id="name-hint"/);
  assert.match(html, /id="name-description" role="alert"/);
  assert.match(html, /Existing help/);
  assert.match(html, /Invalid value/);
});
test('Field preserves native controlled props, name, autocomplete, inputMode and caller class', () => {
  const html = renderToStaticMarkup(
    h(Field, {
      label: 'Code',
      name: 'code',
      value: '0012',
      onChange: () => undefined,
      autoComplete: 'off',
      inputMode: 'numeric',
      maxLength: 8,
      readOnly: true,
      className: 'caller',
      containerClassName: 'wrapper',
    }),
  );
  for (const pattern of [
    /name="code"/,
    /value="0012"/,
    /autoComplete="off"/,
    /inputMode="numeric"/,
    /maxLength="8"/,
    /class="caller"/,
    /wrapper/,
    /readonly=""/,
  ])
    assert.match(html, pattern);
});
test('Select is a native labelled control with options, pending and validation linkage', () => {
  const html = renderToStaticMarkup(
    h(
      Select,
      {
        id: 'language',
        label: 'Language',
        name: 'language',
        value: 'ro',
        onChange: () => undefined,
        hint: 'Choose',
        error: 'Check',
        'aria-describedby': 'outside',
        pending: true,
      },
      h('option', { value: 'ru' }, 'Русский'),
      h('option', { value: 'ro' }, 'Română'),
    ),
  );
  assert.match(html, /<select[^>]*name="language"/);
  assert.match(html, /for="language"/);
  assert.match(html, /value="ro" selected=""/);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-describedby="outside language-hint language-description"/);
  assert.doesNotMatch(html, /role="combobox"/);
});
test('unknown tone never echoes a success label or unknown status code', () => {
  for (const tone of ['paid', '__proto__', 'constructor']) {
    const html = renderToStaticMarkup(h(StatusChip, { tone }, 'Paid successfully'));
    assert.match(html, /k8k-status-neutral/);
    assert.match(html, /Статус неизвестен/);
    assert.doesNotMatch(html, /Paid successfully|k8k-status-success/);
  }
});
test('Card has a named native section, selectable heading level, description and actions', () => {
  const html = renderToStaticMarkup(
    h(
      Card,
      {
        id: 'summary',
        title: 'Overview',
        headingLevel: 3,
        description: 'Context',
        actions: h(Button, null, 'Refresh'),
        className: 'caller',
      },
      'Content',
    ),
  );
  assert.match(html, /<section[^>]*aria-labelledby="summary-title"/);
  assert.match(html, /<h3 id="summary-title">Overview/);
  assert.match(html, /Context/);
  assert.match(html, /Content/);
  assert.match(html, /Refresh/);
});
test('empty Avatar is explicitly unknown; IconButton keeps label and pending contract', () => {
  const avatar = renderToStaticMarkup(
    h(Avatar, { name: '   ', unknownLabel: 'Nume nespecificat' }),
  );
  assert.match(avatar, /Nume nespecificat/);
  assert.match(avatar, />—<\/span>/);
  assert.doesNotMatch(avatar, /<img/);
  const button = renderToStaticMarkup(
    h(IconButton, { label: 'Deschide', pending: true }, h(Icon, { name: 'calendar' })),
  );
  assert.match(button, /aria-label="Deschide"/);
  assert.match(button, /disabled=""/);
  assert.match(button, /aria-hidden="true"/);
});

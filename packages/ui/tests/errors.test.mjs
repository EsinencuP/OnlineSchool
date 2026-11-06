import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describeError,
  errorText,
  ErrorFeedback,
  errorMessageKeys,
  setLocale,
  translate,
} from '../dist/index.js';

test('every mapped error has RU/RO copy and never exposes the incoming message', () => {
  for (const [code, key] of Object.entries(errorMessageKeys)) {
    for (const locale of ['ru', 'ro']) {
      const output = translate(locale, key);
      assert.notEqual(output, key, code);
      assert(output.trim().length > 0, code);
    }
  }
  for (const code of ['NEW_PROVIDER_FAILURE', 'constructor', '__proto__']) {
    const error = {
      code,
      status: 422,
      message: 'SQL private-child-id secret',
      details: { note: 'private' },
    };
    assert.equal(errorText(error, 'ro'), 'Solicitarea nu a putut fi executată.');
  }
});
test('error policy distinguishes credential correction, forbidden, read retry and unknown command', () => {
  const password = describeError({
    code: 'CURRENT_PASSWORD_INVALID',
    status: 401,
    operation: 'write',
  });
  assert.equal(password.key, 'errors.CURRENT_PASSWORD_INVALID');
  assert.deepEqual(password.fields, ['currentPassword']);
  assert.equal(password.nextAction, 'edit');
  assert.equal(describeError({ status: 403 }).key, 'forbidden');
  assert.equal(describeError({ status: 401 }).nextAction, 'sign-in');
  assert.equal(describeError({ code: 'NETWORK_ERROR', status: 0 }).nextAction, 'retry-read');
  for (const code of ['NETWORK_ERROR', 'COMMAND_IN_PROGRESS', 'INVALID_RESPONSE']) {
    const error = { code, status: code === 'COMMAND_IN_PROGRESS' ? 409 : 0, operation: 'write' };
    assert.equal(describeError(error).outcome, 'unknown');
    assert.equal(describeError(error).nextAction, 'reconcile');
  }
  assert.deepEqual(
    describeError({ details: { fields: ['amount', 'amount', '<private>', {}, 'note'] } }).fields,
    ['amount', 'note'],
  );
});
test('feedback suppresses raw diagnostic and write retry and formats own exact money', () => {
  setLocale('ru');
  const markup = renderToStaticMarkup(
    createElement(ErrorFeedback, {
      error: {
        status: 503,
        code: 'INTERNAL',
        operation: 'write',
        message: 'SQL-private',
        requestId: 'foreign-id',
      },
      retryRead: () => assert.fail('Not invoked'),
      amount: { value: '9007199254740993.0001', currency: 'MDL' },
    }),
  );
  assert.doesNotMatch(markup, /SQL-private|foreign-id|<button/u);
  assert.match(markup, /9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0993,0001/u);
  assert.match(markup, /data-outcome="unknown"/u);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatMoneyAmount,
  formatRelativeTime,
  formatTime,
  intlLocaleFor,
  isPlainMessageKey,
  translate,
} from '../dist/index.js';

test('typed catalog lookup keeps names literal and handles unknown input safely', () => {
  assert.equal(
    translate('ro', 'validation.required', { label: 'Ștefan {label}' }),
    'Completează câmpul „Ștefan {label}”.',
  );
  assert.equal(
    translate('ru', 'validation.required', { label: 'Пароль' }),
    'Заполните поле «Пароль».',
  );
  assert.equal(translate('ro', 'missing.key'), 'missing.key');
  assert.equal(translate('ro', 'constructor'), 'constructor');
  assert.equal(translate('en', 'auth.welcome'), 'Вход в кабинет');
  assert.equal(isPlainMessageKey('workspace'), true);
  assert.equal(isPlainMessageKey('validation.required'), false);
  assert.equal(isPlainMessageKey('constructor'), false);
  assert.equal(intlLocaleFor('ro'), 'ro-MD');
  assert.equal(intlLocaleFor('ru'), 'ru-MD');
});

test('civil dates never shift with time zones, and instant labels use the explicit zone', () => {
  const date = '2026-11-30';
  const instant = '2026-11-30T02:00:00Z';
  assert.equal(formatDateOnly(date, 'ro'), '30 noiembrie');
  assert.equal(formatDateOnly(date, 'ru'), '30 ноября');
  assert.equal(formatDateOnly('2026-02-29', 'ro'), null);
  assert.equal(formatDateOnly(instant, 'ro'), null);
  assert.equal(formatDate(instant, 'ro', 'America/New_York'), '29 noiembrie');
  assert.equal(formatDate(instant, 'ro', 'Europe/Chisinau'), '30 noiembrie');
  assert.match(formatDateTime(instant, 'ru', 'Europe/Chisinau'), /30 ноября.*04:00/u);
  assert.equal(formatDateTime('2026-11-30T02:00:00', 'ro', 'UTC'), null);
  assert.equal(formatDateTime('2026-02-29T02:00:00Z', 'ro', 'UTC'), null);
  assert.equal(formatDateTime(instant, 'ro', 'Bad/Zone'), null);
  assert.equal(formatDateTime(instant, 'ro', ''), null);
  assert.equal(formatTime('2026-10-25T03:10:00+03:00', 'ro', 'UTC'), '00:10');
  assert.equal(formatTime('2026-10-25T03:10:00+02:00', 'ro', 'UTC'), '01:10');
});

test('relative time pluralizes with the Moldovan locale tags', () => {
  assert.equal(formatRelativeTime(1, 'minute', 'ro'), 'peste 1 minut');
  assert.equal(formatRelativeTime(2, 'minute', 'ro'), 'peste 2 minute');
  assert.equal(formatRelativeTime(20, 'minute', 'ro'), 'peste 20 de minute');
  assert.equal(formatRelativeTime(-2, 'minute', 'ro'), 'acum 2 minute');
  assert.equal(formatRelativeTime(21, 'minute', 'ru'), 'через 21 минуту');
});

test('money keeps the full decimal precision and currency code', () => {
  const amount = '900719925474099312345.100000000000000001';
  assert.equal(
    formatMoneyAmount(amount, 'MDL', 'ro'),
    '900.719.925.474.099.312.345,100000000000000001\u00a0MDL',
  );
  assert.equal(
    formatMoneyAmount(amount, 'EUR', 'ru'),
    '900\u00a0719\u00a0925\u00a0474\u00a0099\u00a0312\u00a0345,100000000000000001\u00a0EUR',
  );
  assert.equal(formatMoneyAmount('-0.0001', 'MDL', 'ru-RU'), '−0,0001\u00a0MDL');
  assert.equal(formatMoneyAmount('0.1', 'MDL', 'ru-RU'), '0,10\u00a0MDL');
  assert.equal(formatMoneyAmount('1.23400', 'MDL', 'ro'), '1,234\u00a0MDL');
  assert.equal(formatMoneyAmount('1e5', 'MDL', 'ro'), null);
  assert.equal(formatMoneyAmount('1', 'invalid', 'ro'), null);
});

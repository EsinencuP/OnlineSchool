import { intlLocaleFor } from './messages.js';
import type { Locale } from './messages.js';

/** Format an exact decimal string. Currency calculations stay with the caller. */
export function formatMoneyAmount(
  value: string,
  currency: string,
  locale: Locale | 'ru-RU',
): string | null {
  const parts = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(value);
  if (!parts?.[2] || !/^[A-Za-z]{3}$/u.test(currency)) return null;
  const [, sign, whole, fraction = ''] = parts;
  const format = new Intl.NumberFormat(locale === 'ru-RU' ? locale : intlLocaleFor(locale), {
    style: 'currency',
    currency,
    currencyDisplay: locale === 'ru-RU' ? 'symbol' : 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(BigInt(whole));
  const integer = format
    .filter(({ type }) => type === 'integer' || type === 'group')
    .map(({ value }) => value)
    .join('');
  const decimal = format.find(({ type }) => type === 'decimal')?.value ?? ',';
  const label = format.find(({ type }) => type === 'currency')?.value ?? currency;
  return `${sign ? '−' : ''}${integer}${decimal}${fraction.replace(/0+$/u, '').padEnd(2, '0')}\u00a0${label}`;
}

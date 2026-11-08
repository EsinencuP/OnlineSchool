import Decimal from 'decimal.js';
export const MONEY_REGEX = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/;
export function validMoney(value: string): boolean {
  return MONEY_REGEX.test(value) && new Decimal(value).gt(0);
}
export function formatMoney(value: string, currency: string): string {
  const decimal = new Decimal(value);
  const [whole = '0', fraction = ''] = decimal.abs().toFixed(4).split('.');
  const trimmed = fraction.replace(/0+$/, '').padEnd(2, '0');
  const integer = new Intl.NumberFormat('ru-RU').format(BigInt(whole));
  const symbol =
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency })
      .formatToParts(1n)
      .find((p) => p.type === 'currency')?.value ?? currency;
  return `${decimal.isNegative() ? '−' : ''}${integer},${trimmed}\u00a0${symbol}`;
}

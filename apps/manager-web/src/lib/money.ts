import Decimal from 'decimal.js';
import { formatMoneyAmount } from '@online-school/ui';
export { MONEY_REGEX, validMoney } from './money-validation.js';
export function formatMoney(value: string, currency: string): string {
  const decimal = new Decimal(value);
  const fixed = `${decimal.isNegative() ? '-' : ''}${decimal.abs().toFixed(4)}`;
  return formatMoneyAmount(fixed, currency, 'ru-RU') ?? `${value} ${currency}`;
}

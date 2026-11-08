import { domainError, fail } from '../../core/errors/domain-error.js';
export const SUPPORTED_RECEIPT_CURRENCIES = ['MDL'] as const;
export type ReceiptCurrency = (typeof SUPPORTED_RECEIPT_CURRENCIES)[number];
export const RECEIPT_MONEY_REGEX = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/;
export const positiveReceiptAmount = (value: unknown): value is string =>
  typeof value === 'string' && RECEIPT_MONEY_REGEX.test(value) && /[1-9]/.test(value);
export function receiptCurrency(value: unknown = 'MDL'): ReceiptCurrency {
  return value === 'MDL' ? value : fail(domainError('CURRENCY_NOT_SUPPORTED', 422));
}

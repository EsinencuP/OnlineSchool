import { ValidateBy } from 'class-validator';
import { positiveReceiptAmount, RECEIPT_MONEY_REGEX } from '../../finance/receipt-policy.js';
export const MONEY_REGEX = RECEIPT_MONEY_REGEX;
export const IsMoneyString = (): PropertyDecorator =>
  ValidateBy({
    name: 'isMoneyString',
    validator: { validate: positiveReceiptAmount, defaultMessage: () => 'INVALID_MONEY' },
  });

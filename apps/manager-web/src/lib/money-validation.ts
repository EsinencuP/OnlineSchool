export const MONEY_REGEX = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/;
export function validMoney(value: string): boolean {
  return MONEY_REGEX.test(value) && /[1-9]/u.test(value);
}

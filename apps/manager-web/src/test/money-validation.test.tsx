import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BalanceSummary from '../pages/student/BalanceSummary.js';
import { validMoney } from '../lib/money-validation.js';
it('payment validation keeps exact positivity and the original input limits', () => {
  expect(validMoney('0.0001')).toBe(true);
  expect(validMoney('999999999999.9999')).toBe(true);
  expect(validMoney('0.0000')).toBe(false);
  expect(validMoney('1000000000000')).toBe(false);
  expect(validMoney('1e3')).toBe(false);
  expect(validMoney('1.00001')).toBe(false);
});
it('the overview balance retains the existing four-place format and payments link', () => {
  render(
    <MemoryRouter>
      <BalanceSummary balances={[{ amount: '1234567.8912', currency: 'MDL' }]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('1 234 567,8912 MDL').textContent).toBe(
    '1\u00a0234\u00a0567,8912\u00a0MDL',
  );
  expect(screen.getByRole('link').getAttribute('href')).toBe('/?tab=payments');
});

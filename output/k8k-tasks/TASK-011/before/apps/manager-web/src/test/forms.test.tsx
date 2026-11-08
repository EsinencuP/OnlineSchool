import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PaymentForm,
  FreezeForm,
  RescheduleForm,
  DisputeForm,
} from '../components/business-forms.js';
import { ru } from '../i18n/ru.js';
import { formatMoney, validMoney } from '../lib/money.js';
import { localToIso } from '../lib/time.js';

describe('decimal strings and school timezone', () => {
  it('formats without binary float rounding', () => {
    expect(formatMoney('0.1', 'MDL')).toBe('0,10\u00a0MDL');
    expect(formatMoney('1234567.8912', 'MDL')).toBe('1\u00a0234\u00a0567,8912\u00a0MDL');
    expect(formatMoney('-0.0001', 'MDL')).toBe('−0,0001\u00a0MDL');
    expect(validMoney('1.00001')).toBe(false);
    expect(validMoney('1e3')).toBe(false);
    expect(validMoney('0')).toBe(false);
  });
  it('uses school offset and rejects ambiguous or skipped DST times', () => {
    expect(localToIso('2026-11-01T12:00', 'Europe/Chisinau')).toBe('2026-11-01T12:00:00+02:00');
    expect(localToIso('2026-10-25T03:30', 'Europe/Chisinau')).toBeNull();
    expect(localToIso('2026-03-29T03:30', 'Europe/Chisinau')).toBeNull();
  });
});
it('payment submits exact four-place string, MDL and explicit offset', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<PaymentForm timezone="Europe/Chisinau" busy={false} error={null} submit={submit} />);
  await user.type(screen.getByLabelText(ru.money), '1234567.8912');
  await user.selectOptions(screen.getByLabelText(ru.method), 'BANK_TRANSFER');
  await user.selectOptions(screen.getByLabelText(ru.purpose), 'FIRST_PAYMENT');
  const input = screen.getByLabelText(ru.receivedAt);
  await user.type(input, '2026-11-01T12:00');
  await user.click(screen.getByRole('button', { name: ru.registerPayment }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '1234567.8912',
        currency: 'MDL',
        receivedAt: '2026-11-01T12:00:00+02:00',
      }),
    ),
  );
});
it('freeze requires explicit consequences consent and cancellation is independent', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<FreezeForm busy={false} error={null} submit={submit} />);
  await user.type(screen.getByLabelText(ru.startsOn), '2026-11-02');
  await user.type(screen.getByLabelText(ru.endsOn), '2026-11-10');
  await user.selectOptions(screen.getByLabelText(ru.reason), 'ILLNESS');
  await user.click(screen.getByRole('button', { name: ru.freeze }));
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByLabelText(ru.acknowledge));
  await user.click(screen.getByRole('button', { name: ru.freeze }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith({
      startsOn: '2026-11-02',
      endsOn: '2026-11-10',
      reason: 'ILLNESS',
      cancelConflictingLessons: false,
    }),
  );
});
it('reschedule preserves reason across a version conflict and reload', async () => {
  const user = userEvent.setup();
  const submit = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn().mockResolvedValue(undefined);
  const props = {
    timezone: 'Europe/Chisinau',
    teachers: [],
    initialTime: '2026-11-03T12:00',
    busy: false,
    error: null,
    submit,
    reload,
  };
  const { rerender } = render(<RescheduleForm {...props} />);
  await user.type(screen.getByLabelText(ru.reason), 'Нужно перенести урок');
  rerender(
    <RescheduleForm
      {...props}
      error={{ code: 'VERSION_CONFLICT', status: 409, message: ru.conflictHelp }}
    />,
  );
  await user.click(screen.getByRole('button', { name: ru.reloadVersion }));
  expect(reload).toHaveBeenCalled();
  expect((screen.getByLabelText(ru.reason) as HTMLTextAreaElement).value).toBe(
    'Нужно перенести урок',
  );
});
it('dispute ACCEPT is a proposal and requires consent; partial money stays string', async () => {
  const user = userEvent.setup();
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<DisputeForm version={7} busy={false} error={null} submit={submit} />);
  await user.selectOptions(screen.getByLabelText(ru.decision), 'ACCEPT');
  await user.type(screen.getByLabelText(ru.reason), 'Урок не был проведён');
  await user.type(screen.getByLabelText(ru.refundAmount), '0.1001');
  await user.type(screen.getByLabelText(ru.refundLessons), '1');
  await user.click(screen.getByRole('button', { name: ru.resolve }));
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByLabelText(ru.acknowledge));
  await user.click(screen.getByRole('button', { name: ru.resolve }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith({
      decision: 'ACCEPT',
      reason: 'Урок не был проведён',
      version: 7,
      refundAmount: '0.1001',
      refundLessons: 1,
    }),
  );
});
it('busy form disables fields and duplicate submission', async () => {
  const submit = vi.fn();
  render(<PaymentForm timezone="Europe/Chisinau" busy error={null} submit={submit} />);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole('button'));
  expect(submit).not.toHaveBeenCalled();
});

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  createManagerPayment,
  schoolFetch,
  sendManagerStudentNotification,
} from '@online-school/api-contracts';
import { initializeLocale, LanguageSelector, useLocale } from '@online-school/ui';
import { queryClient, read } from '../../src/api/client.js';
import { useCommand } from '../../src/hooks/use-command.js';
import { FormShell, Input, State } from '../../src/components/ui.js';
import { ChangePassword } from '../../../student-cabinet/src/pages/Account.js';
import { QueryState } from '../../../student-cabinet/src/components.js';
import '@online-school/ui/style.css';
import './fixture.css';

const studentId = '10000000-0000-4000-8000-000000000001';
const mode = new URLSearchParams(window.location.search).get('case') ?? 'manager';
function Manager() {
  const { locale, t } = useLocale();
  const command = useCommand();
  const [amount, setAmount] = useState('9007199254740993.0001');
  const [queued, setQueued] = useState(false);
  return (
    <section>
      <h1>{locale === 'ro' ? 'Formular sintetic' : 'Синтетическая форма'}</h1>
      <LanguageSelector />
      <FormShell
        busy={command.busy}
        error={command.error}
        amount={{ value: amount, currency: 'MDL' }}
        submit={async (data) => {
          setAmount(String(data.get('amount')));
          const result =
            mode === 'queued'
              ? await command.run({ body: 'Synthetic local message' }, (options) =>
                  sendManagerStudentNotification(
                    studentId,
                    { channel: 'IN_APP', body: 'Synthetic local message' },
                    options,
                  ),
                )
              : await command.run({ amount: String(data.get('amount')) }, (options) =>
                  createManagerPayment(
                    studentId,
                    {
                      amount: String(data.get('amount')),
                      currency: 'MDL',
                      method: 'CASH',
                      purpose: 'OTHER',
                      receivedAt: '2026-11-04T09:00:00+02:00',
                    },
                    options,
                  ),
                );
          if (result && 'status' in result && result.status === 'QUEUED') setQueued(true);
        }}
      >
        <Input
          name="amount"
          label={locale === 'ro' ? 'Sumă' : 'Сумма'}
          defaultValue={amount}
          required
        />
        <Input
          name="email"
          label={t('auth.email')}
          type="email"
          defaultValue="local@example.invalid"
          required
        />
        <Input
          name="note"
          label={locale === 'ro' ? 'Comentariu' : 'Комментарий'}
          defaultValue="Synthetic unchanged note"
        />
      </FormShell>
      {queued && <p role="status">{t('errors.queued')}</p>}
    </section>
  );
}
function CachedRead() {
  const { t } = useLocale();
  const query = useQuery({
    queryKey: ['fixture-protected'],
    queryFn: ({ signal }) =>
      read((options) => schoolFetch<{ text: string }>('/fixture/read', options), signal),
    retry: false,
  });
  return (
    <section>
      <LanguageSelector />
      <button onClick={() => void query.refetch()}>{t('retry')}</button>
      {mode === 'student-denied' ? (
        <QueryState query={query}>{query.data && <p data-private>{query.data.text}</p>}</QueryState>
      ) : (
        <State query={query}>{(data) => <p data-private>{data.text}</p>}</State>
      )}
    </section>
  );
}
initializeLocale();
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      {mode === 'student' ? (
        <ChangePassword />
      ) : mode.endsWith('denied') ? (
        <CachedRead />
      ) : (
        <Manager />
      )}
    </MemoryRouter>
  </QueryClientProvider>,
);

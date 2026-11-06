import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Field, StateBoundary, queryBoundaryState, useLocale } from '@online-school/ui';
import { State } from '../../src/components/ui.js';
import { QueryState } from '../../../student-cabinet/src/components.js';
import { ReadStates } from '../../../../packages/ui/stories/states.stories.js';
import '@online-school/ui/style.css';
import './fixture.css';

type Result = { items: string[]; asOf?: string };
type FixtureError = Error & { status: number; code: string };
const params = new URLSearchParams(globalThis.location.search);
const mode = params.get('mode');
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Transition() {
  const { locale } = useLocale();
  const [outcome, setOutcome] = useState<'pending' | 'unknown' | null>(null);
  const [retries, setRetries] = useState(0);
  const query = useQuery<Result, FixtureError>({
    queryKey: ['state-fixture'],
    queryFn: async ({ signal }) => {
      const response = await globalThis.fetch('/fixture-state', { signal, cache: 'no-store' });
      if (!response.ok)
        throw Object.assign(new Error('Synthetic read error'), {
          status: response.status,
          code: 'FIXTURE_ERROR',
        });
      return response.json() as Promise<Result>;
    },
  });
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => void refetch();
    const pending = () => setOutcome('pending');
    const unknown = () => setOutcome('unknown');
    const ready = () => setOutcome(null);
    globalThis.addEventListener('fixture:refresh', refresh);
    globalThis.addEventListener('fixture:pending', pending);
    globalThis.addEventListener('fixture:unknown', unknown);
    globalThis.addEventListener('fixture:ready', ready);
    return () => {
      globalThis.removeEventListener('fixture:refresh', refresh);
      globalThis.removeEventListener('fixture:pending', pending);
      globalThis.removeEventListener('fixture:unknown', unknown);
      globalThis.removeEventListener('fixture:ready', ready);
    };
  }, [refetch]);
  const empty = query.data?.items.length === 0;
  const readState = queryBoundaryState({
    isPending: query.isPending,
    error: !!query.error,
    errorStatus: query.error?.status,
    hasData: !!query.data,
    empty,
  });
  const state =
    outcome && readState.status !== 'forbidden' && readState.status !== 'session-expired'
      ? { status: 'pending' as const, outcome }
      : readState;
  const editor = !empty && (
    <section data-private-content>
      <p>{query.data?.items[0]}</p>
      <Field
        id="draft"
        label={locale === 'ro' ? 'Ciornă' : 'Черновик'}
        defaultValue="Synthetic initial text"
      />
    </section>
  );
  if (mode === 'manager')
    return (
      <State query={query} empty={empty}>
        {() => editor}
      </State>
    );
  if (mode === 'student')
    return (
      <QueryState query={query} empty={empty} sourceTimestamp={query.data?.asOf}>
        {editor}
      </QueryState>
    );
  return (
    <>
      <output data-retries>{retries}</output>
      <StateBoundary
        state={state}
        asOf={query.data?.asOf}
        receivedAt={query.dataUpdatedAt}
        refreshing={query.isFetching}
        retryRead={() => {
          setRetries((n) => n + 1);
          void refetch();
        }}
        action={
          <button type="button" data-private-action>
            {locale === 'ro' ? 'Acțiune contextuală' : 'Контекстное действие'}
          </button>
        }
      >
        {editor}
      </StateBoundary>
    </>
  );
}

function Fixture() {
  const { locale } = useLocale();
  return (
    <main className="state-fixture k8k-role-manager">
      {mode === 'catalog' ? <ReadStates locale={locale} /> : <Transition />}
    </main>
  );
}
createRoot(globalThis.document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <Fixture />
  </QueryClientProvider>,
);

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import {
  Button,
  DenseTable,
  Field,
  KanbanColumn,
  ListRow,
  queryBoundaryState,
  useLocale,
} from '@online-school/ui';
import type { DenseColumn, TablePageInfo, TableSort } from '@online-school/ui';
import Leads from '../../src/pages/Leads.js';
import { RequireManager, SessionBoundary } from '../../src/session.js';
import { queryClient } from '../../src/api/client.js';
import '../../src/style.css';
import '@online-school/ui/style.css';
import './fixture.css';

type Row = { id: string; name: string; amount: string; group: string };
type Page = {
  rows: Row[];
  pageInfo: TablePageInfo;
  next: string | null;
  previous: string | null;
  sort: TableSort | null;
};
type ReadError = Error & { status: number };
const rowKey = (row: Row) => row.id;
const directions = ['asc', 'desc'] as const;

function TableFixture() {
  const { locale } = useLocale();
  const ro = locale === 'ro';
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const detail = location.pathname.startsWith('/objects/');
  const [selected, setSelected] = useState(new Set<string>());
  const filter = params.get('filter') ?? '';
  const request = new URLSearchParams();
  for (const key of ['filter', 'direction', 'cursor', 'total', 'state']) {
    const value = params.get(key);
    if (value) request.set(key, value);
  }
  const query = useQuery<Page, ReadError>({
    queryKey: ['table-fixture', request.toString()],
    enabled: !detail,
    queryFn: async ({ signal }) => {
      const response = await globalThis.fetch(`/fixture-table?${request}`, {
        signal,
        cache: 'no-store',
      });
      if (!response.ok)
        throw Object.assign(new Error('Synthetic read failure'), { status: response.status });
      return response.json() as Promise<Page>;
    },
  });
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => void refetch();
    globalThis.addEventListener('fixture:refresh', refresh);
    return () => globalThis.removeEventListener('fixture:refresh', refresh);
  }, [refetch]);
  if (detail) return <h1>{ro ? 'Fișă de test' : 'Тестовая карточка'}</h1>;
  const columns: DenseColumn<Row>[] = [
    {
      id: 'name',
      header: ro ? 'Nume' : 'Имя',
      sortDirections: directions,
      cell: (row) => <Link to={`/objects/${row.id}`}>{row.name}</Link>,
    },
    {
      id: 'amount',
      header: ro ? 'Sumă exactă' : 'Точная сумма',
      cell: (row) => <span data-amount>{row.amount}</span>,
    },
    { id: 'group', header: ro ? 'Grup' : 'Группа', cell: (row) => row.group },
    {
      id: 'action',
      header: ro ? 'Acțiune' : 'Действие',
      cell: (row) => (
        <Link to={`/objects/${row.id}`} data-row-action>
          {ro ? 'Deschide fișa' : 'Открыть карточку'}
        </Link>
      ),
    },
  ];
  const state = queryBoundaryState({
    isPending: query.isPending,
    hasData: !!query.data,
    error: !!query.error,
    errorStatus: query.error?.status,
    empty: query.data?.rows.length === 0,
  });
  function change(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }
  return (
    <>
      <form
        key={filter}
        className="fixture-filter"
        onSubmit={(e) => {
          e.preventDefault();
          change({
            filter: String(new FormData(e.currentTarget).get('filter') ?? ''),
            cursor: null,
          });
        }}
      >
        <Field name="filter" label={ro ? 'Filtru' : 'Фильтр'} defaultValue={filter} />
        <Button type="submit">{ro ? 'Aplică filtrul' : 'Применить фильтр'}</Button>
      </form>
      <DenseTable
        caption={ro ? 'Registru sintetic' : 'Синтетический реестр'}
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={rowKey}
        state={state}
        sort={query.data?.sort ?? null}
        {...(query.data ? { pageInfo: query.data.pageInfo } : {})}
        onSortChange={(sort) => change({ direction: sort.direction, cursor: null })}
        onPageChange={(intent) =>
          change({
            cursor:
              intent === 'next'
                ? (query.data?.next ?? null)
                : intent === 'previous'
                  ? (query.data?.previous ?? null)
                  : null,
          })
        }
        selection={{
          ids: selected,
          label: (row) => (ro ? 'Selectează ' : 'Выбрать ') + row.id,
          onChange: (id, checked) => {
            setSelected((old) => {
              const next = new Set(old);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            });
          },
        }}
      />
      <KanbanColumn
        title={ro ? 'Coloană de test' : 'Тестовая колонка'}
        count={null}
        pending={params.has('pending')}
        actions={<Link to="/?total=known">{ro ? 'Vezi lista' : 'К списку'}</Link>}
      >
        <ul>
          <ListRow
            title={
              <Link to="/objects/sample">{ro ? 'Fișă sintetică' : 'Синтетическая карточка'}</Link>
            }
            details={[
              {
                id: 'source',
                label: ro ? 'Sursă' : 'Источник',
                value: ro ? 'Exemplu local' : 'Локальный пример',
              },
            ]}
            actions={<Link to="/objects/sample">{ro ? 'Detalii' : 'Подробнее'}</Link>}
          />
        </ul>
      </KanbanColumn>
    </>
  );
}

function Fixture() {
  const { pathname } = useLocation();
  if (!pathname.startsWith('/manager/')) return <TableFixture />;
  return (
    <Routes>
      <Route element={<SessionBoundary />}>
        <Route element={<RequireManager />}>
          <Route path="/manager/leads" element={<Leads />} />
          <Route path="/manager/leads/:id" element={<h1>Карточка fixture</h1>} />
        </Route>
      </Route>
    </Routes>
  );
}

createRoot(globalThis.document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <main className="table-fixture k8k-role-manager">
        <Fixture />
      </main>
    </BrowserRouter>
  </QueryClientProvider>,
);

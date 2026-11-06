import { useState } from 'react';
import { Button, DenseTable, KanbanColumn, ListRow } from '../src/index.js';
import type { BoundaryState, Locale, TableSort } from '../src/index.js';

export default { title: 'UI/Lists and tables' };

type RecordRow = { id: string; title: string };
const ids = ['A', 'B', 'C', 'D'];
function TableExample({ locale, state }: { locale: Locale; state: BoundaryState }) {
  const ro = locale === 'ro';
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<TableSort>({ columnId: 'title', direction: 'asc' });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The local fixture simulates ordered pages supplied by a read adapter.
  const order = sort.direction === 'asc' ? ids : [...ids].reverse();
  const rows: RecordRow[] = order.slice(page * 2, page * 2 + 2).map((id) => ({
    id,
    title: ro
      ? `Înregistrare sintetică cu denumire mai lungă ${id}`
      : `Синтетическая запись с длинным названием ${id}`,
  }));
  return (
    <DenseTable
      caption={ro ? 'Înregistrări sintetice' : 'Синтетические записи'}
      rows={state.status === 'empty' ? [] : rows}
      columns={[
        {
          id: 'title',
          header: ro ? 'Denumire' : 'Название',
          cell: (row) => row.title,
          sortDirections: ['asc', 'desc'],
        },
        {
          id: 'id',
          header: ro ? 'Referință locală' : 'Локальный идентификатор',
          cell: (row) => row.id,
        },
      ]}
      rowKey={(row) => row.id}
      state={state}
      sort={sort}
      onSortChange={(next) => {
        setSort(next);
        setPage(0);
      }}
      pageInfo={{
        total: null,
        hasMore: page === 0 && state.status === 'ready',
        canPrevious: page > 0,
      }}
      onPageChange={(intent) => setPage(intent === 'next' ? 1 : 0)}
      selection={{
        ids: selected,
        label: (row) => (ro ? `Selectează ${row.id}` : `Выбрать ${row.id}`),
        onChange: (id, enabled) =>
          setSelected((current) => {
            const next = new Set(current);
            if (enabled) next.add(id);
            else next.delete(id);
            return next;
          }),
      }}
    />
  );
}
export const OrderedPages = { args: { state: { status: 'ready' } }, render: TableExample };
export const EmptyTable = { args: { state: { status: 'empty' } }, render: TableExample };
export const UnknownTableResult = {
  args: { state: { status: 'pending', outcome: 'unknown' } },
  render: TableExample,
};

export const QueueColumns = {
  render: ({ locale }: { locale: Locale }) => {
    const ro = locale === 'ro';
    const [details, setDetails] = useState(false);
    return (
      <>
        <KanbanColumn title={ro ? 'Exemple disponibile' : 'Доступные примеры'} count={1}>
          <ul>
            <ListRow
              title={
                ro
                  ? 'O înregistrare sintetică cu denumire mai lungă'
                  : 'Синтетическая запись с длинным названием'
              }
              details={
                details ? [{ id: 'ref', label: ro ? 'Referință' : 'Ссылка', value: 'A' }] : []
              }
              actions={
                <Button
                  variant="secondary"
                  aria-expanded={details}
                  onClick={() => setDetails(!details)}
                >
                  {ro ? 'Detalii' : 'Подробности'}
                </Button>
              }
            />
          </ul>
        </KanbanColumn>
        <KanbanColumn
          title={ro ? 'Coloană în curs de încărcare' : 'Колонка загружается'}
          count={null}
          pending
        >
          {null}
        </KanbanColumn>
        <KanbanColumn title={ro ? 'Coloană goală' : 'Пустая колонка'} count={0}>
          <p>{ro ? 'Lista este goală.' : 'Список пуст.'}</p>
        </KanbanColumn>
      </>
    );
  },
};

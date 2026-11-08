import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from './controls.js';
import { Icon } from './icon.js';
import { useLocale } from './locale.js';
import type { BoundaryState } from './state.js';

export type TableSortDirection = 'asc' | 'desc';
export type TableSort = { columnId: string; direction: TableSortDirection };
export type TablePageIntent = 'first' | 'previous' | 'next';
export type TablePageInfo = {
  total: number | null;
  hasMore: boolean;
  canFirst?: boolean;
  canPrevious?: boolean;
};
export type DenseColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortDirections?: readonly TableSortDirection[];
};
export type TableSelection<T> = {
  ids: ReadonlySet<string>;
  label: (row: T) => string;
  onChange: (id: string, selected: boolean) => void;
};
export type DenseTableProps<T> = {
  caption: string;
  rows: readonly T[];
  columns: readonly DenseColumn<T>[];
  rowKey: (row: T) => string;
  state: BoundaryState;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  pageInfo?: TablePageInfo;
  onPageChange?: (intent: TablePageIntent) => void;
  selection?: TableSelection<T>;
};
const coreRowModel = /* @__PURE__ */ getCoreRowModel();
const stateKey = {
  loading: 'loading',
  empty: 'empty',
  stale: 'stale',
  error: 'error',
  pending: 'tablePending',
  forbidden: 'forbidden',
  'session-expired': 'session',
} as const;

/** Column and row IDs are unique and stable. The caller supplies a server-ordered page. */
export function DenseTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  state,
  sort,
  onSortChange,
  pageInfo,
  onPageChange,
  selection,
}: DenseTableProps<T>) {
  const { t, intlLocale } = useLocale();
  const { status } = state;
  const denied = status === 'forbidden' || status === 'session-expired';
  const showRows =
    status === 'ready' ||
    status === 'stale' ||
    status === 'pending' ||
    status === 'subscription-limited';
  const data = useMemo(() => (showRows ? [...rows] : []), [rows, showRows]);
  const definitions = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        cell: ({ row }) => column.cell(row.original),
      })),
    [columns],
  );
  const table = useReactTable({
    data,
    columns: definitions,
    getRowId: rowKey,
    getCoreRowModel: coreRowModel,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    state: { sorting: sort ? [{ id: sort.columnId, desc: sort.direction === 'desc' }] : [] },
  });
  const message =
    status === 'ready'
      ? ''
      : ('message' in state && state.message) ||
        (status === 'pending' && state.outcome === 'unknown'
          ? t('tableUnknownResult')
          : status === 'subscription-limited'
            ? state.message
            : t(stateKey[status]));
  if (denied)
    return (
      <p className="k8k-table-state" data-state={status} role="alert">
        {message}
      </p>
    );
  const format = new Intl.NumberFormat(intlLocale);
  const visibleRows = table.getRowModel().rows;
  const tableStatus = status === 'loading' || status === 'pending';
  return (
    <section className="k8k-table-shell" data-state={status}>
      {message && (
        <p className="k8k-table-state" role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      <p className="k8k-table-scroll-hint">{t('tableScroll')}</p>
      <div className="k8k-table-scroll" role="region" aria-label={caption} tabIndex={0}>
        <table className="k8k-dense-table" aria-busy={tableStatus || undefined}>
          <caption>{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {selection && <th scope="col">{t('tableSelect')}</th>}
                {group.headers.map((header) => {
                  const column = columns[header.index];
                  const selected = header.column.getIsSorted();
                  const directions = column?.sortDirections;
                  const current = selected || undefined;
                  const position = current ? (directions?.indexOf(current) ?? -1) : -1;
                  const direction = directions?.length
                    ? directions[(position + 1) % directions.length]
                    : undefined;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        selected === 'asc'
                          ? 'ascending'
                          : selected === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {direction && onSortChange ? (
                        <button
                          type="button"
                          className="k8k-table-sort"
                          onClick={() => onSortChange({ columnId: header.column.id, direction })}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Icon
                            name="arrow"
                            className={`k8k-sort-${selected || 'none'}`}
                            size={16}
                          />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.id} style={{ animationDelay: `${Math.min(index, 9) * 30}ms` }}>
                {selection && (
                  <td>
                    <label className="k8k-table-check">
                      <input
                        type="checkbox"
                        aria-label={selection.label(row.original)}
                        checked={selection.ids.has(row.id)}
                        onChange={(e) => selection.onChange(row.id, e.target.checked)}
                      />
                    </label>
                  </td>
                )}
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(showRows || status === 'empty') && pageInfo && (
        <div className="k8k-table-footer">
          <p>
            <span>
              {t('tableShown')} {format.format(visibleRows.length)}
            </span>
            {' · '}
            <span>
              {pageInfo.total === null
                ? t('tableTotalUnknown')
                : `${t('tableTotal')} ${format.format(pageInfo.total)}`}
            </span>
            {pageInfo.hasMore && (
              <>
                {' '}
                · <span>{t('tableMore')}</span>
              </>
            )}
          </p>
          {onPageChange && (
            <nav className="k8k-table-pager" aria-label={t('tablePages')}>
              {pageInfo.canFirst && (
                <Button variant="secondary" onClick={() => onPageChange('first')}>
                  {t('tableFirst')}
                </Button>
              )}
              {pageInfo.canPrevious && (
                <Button variant="secondary" onClick={() => onPageChange('previous')}>
                  {t('tablePrevious')}
                </Button>
              )}
              {pageInfo.hasMore && (
                <Button variant="secondary" onClick={() => onPageChange('next')}>
                  {t('tableNext')}
                </Button>
              )}
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

export type ListRowProps = {
  title: ReactNode;
  details?: readonly { id: string; label: string; value: ReactNode }[];
  actions?: ReactNode;
};
export function ListRow({ title, details, actions }: ListRowProps) {
  return (
    <li className="k8k-list-row">
      <div className="k8k-list-row-title">{title}</div>
      {!!details?.length && (
        <dl>
          {details.map((detail) => (
            <div key={detail.id}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="k8k-list-row-actions">{actions}</div>}
    </li>
  );
}
export type KanbanColumnProps = {
  title: string;
  count: number | null;
  pending?: boolean;
  children: ReactNode;
  actions?: ReactNode;
};
export function KanbanColumn({ title, count, pending, children, actions }: KanbanColumnProps) {
  const { t, intlLocale } = useLocale();
  return (
    <section className="k8k-kanban-column" aria-label={title}>
      <header>
        <h3>{title}</h3>
        <p>
          {count === null
            ? t('tableTotalUnknown')
            : `${t('tableTotal')} ${new Intl.NumberFormat(intlLocale).format(count)}`}
        </p>
        {actions}
      </header>
      {pending && <p role="status">{t('loading')}</p>}
      <div className="k8k-kanban-list" aria-busy={pending || undefined}>
        {children}
      </div>
    </section>
  );
}

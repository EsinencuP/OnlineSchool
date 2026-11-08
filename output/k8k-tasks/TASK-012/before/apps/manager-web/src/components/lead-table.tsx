import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { LeadListItemDto } from '@online-school/api-contracts';
import { DenseTable, useLocale } from '@online-school/ui';
import type { DenseColumn, TablePageIntent } from '@online-school/ui';
import { Badge } from './ui.js';
import { displayTime } from '../lib/time.js';
import { label, ru } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';

const rowKey = (row: LeadListItemDto) => row.leadId;
export function LeadTable({
  rows,
  timeZone,
  nextCursor,
  canFirst,
  onPageChange,
}: {
  rows: readonly LeadListItemDto[];
  timeZone: string;
  nextCursor: string | null;
  canFirst: boolean;
  onPageChange: (intent: TablePageIntent) => void;
}) {
  const { locale } = useLocale();
  const ro = locale === 'ro';
  const columns = useMemo<DenseColumn<LeadListItemDto>[]>(
    () => [
      {
        id: 'contact',
        header: ro ? 'Contact' : ru.contactName,
        cell: (row) => <Link to={routes.lead(row.leadId)}>{row.contactName}</Link>,
      },
      { id: 'stage', header: ro ? 'Stare' : ru.status, cell: (row) => <Badge value={row.stage} /> },
      {
        id: 'subject',
        header: ro ? 'Disciplină' : ru.studySubject,
        cell: (row) => row.subjectName,
      },
      { id: 'phone', header: ro ? 'Telefon' : ru.phone, cell: (row) => row.maskedPhone ?? ru.dash },
      { id: 'source', header: ro ? 'Sursă' : ru.source, cell: (row) => label(row.source) },
      {
        id: 'trial',
        header: ro ? 'Lecție de probă' : ru.trial,
        cell: (row) => (row.trialAt ? displayTime(row.trialAt, timeZone) : ru.dash),
      },
      {
        id: 'due',
        header: ro ? 'Termen' : ru.dueAt,
        cell: (row) => (
          <span className={row.isOverdue ? 'danger-text' : ''}>
            {row.nextActionAt ? displayTime(row.nextActionAt, timeZone) : ru.dash}
          </span>
        ),
      },
    ],
    [ro, timeZone],
  );
  return (
    <DenseTable
      caption={ro ? 'Lista solicitărilor' : 'Список заявок'}
      columns={columns}
      rows={rows}
      rowKey={rowKey}
      state={{ status: 'ready' }}
      pageInfo={{ total: null, canFirst, hasMore: nextCursor !== null }}
      onPageChange={onPageChange}
    />
  );
}

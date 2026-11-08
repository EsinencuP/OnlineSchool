import { Prisma } from '@online-school/db';
import { ManagerPaymentStatus } from './contracts.js';
type ReceiptStatusFacts = {
  rejected_at: Date | null;
  confirmed_by_director_at: Date | null;
  approval_requested_at: Date | null;
  t03_ledgerdocument_payment_id: {
    t03_ledgerentry_document_id: { published_at: Date | null } | null;
  } | null;
};
export const receiptStatus = (row: ReceiptStatusFacts): ManagerPaymentStatus =>
  row.rejected_at
    ? ManagerPaymentStatus.REJECTED
    : row.confirmed_by_director_at &&
        row.t03_ledgerdocument_payment_id?.t03_ledgerentry_document_id?.published_at
      ? ManagerPaymentStatus.CONFIRMED
      : row.approval_requested_at || row.confirmed_by_director_at
        ? ManagerPaymentStatus.AWAITING_APPROVAL
        : ManagerPaymentStatus.PENDING;
// Alias p is fixed inside Finance-owned read queries, not request-controlled.
export const receiptStatusSql = (
  now: Date,
): Prisma.Sql => Prisma.sql`CASE WHEN p.rejected_at IS NOT NULL THEN 'REJECTED'
 WHEN p.confirmed_by_director_at<=${now} AND EXISTS(SELECT 1 FROM ledger_documents d JOIN ledger_entries le ON le.document_id=d.id WHERE d.payment_id=p.id AND le.published_at<=${now}) THEN 'CONFIRMED'
 WHEN p.approval_requested_at IS NOT NULL OR p.confirmed_by_director_at IS NOT NULL THEN 'AWAITING_APPROVAL' ELSE 'PENDING' END`;
const publishedReceipt: Prisma.PaymentReceiptWhereInput = {
  confirmed_by_director_at: { not: null },
  t03_ledgerdocument_payment_id: {
    is: { t03_ledgerentry_document_id: { is: { published_at: { not: null } } } },
  },
};
export function statusWhere(status?: ManagerPaymentStatus): Prisma.PaymentReceiptWhereInput {
  if (!status) return {};
  if (status === 'CONFIRMED') return publishedReceipt;
  if (status === 'REJECTED') return { rejected_at: { not: null } };
  if (status === 'PENDING')
    return { confirmed_by_director_at: null, approval_requested_at: null, rejected_at: null };
  return {
    rejected_at: null,
    OR: [{ approval_requested_at: { not: null } }, { confirmed_by_director_at: { not: null } }],
    NOT: publishedReceipt,
  };
}

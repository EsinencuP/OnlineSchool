import type { ManagerPaymentMethod, ManagerPaymentPurpose, Prisma } from '@online-school/db';
export enum ManagerPaymentStatus {
  PENDING = 'PENDING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}
export type CreateReceipt = {
  amount: string;
  currency?: string;
  method: ManagerPaymentMethod;
  purpose: ManagerPaymentPurpose;
  receivedAt: string;
  externalRef?: string;
  note?: string;
};
export type ReceiptView = {
  id: string;
  studentId: string;
  amount: string;
  currency: string;
  method: ManagerPaymentMethod | null;
  purpose: ManagerPaymentPurpose | null;
  status: ManagerPaymentStatus;
  receivedAt: string;
  externalRef: string | null;
  ledgerPublicationId: string | null;
  createdAt: string;
  rejectionReason: string | null;
};
export type ReceiptPage = { items: ReceiptView[]; total: number; page: number; pageSize: number };
export type ReceiptQuery = { page: number; pageSize: number; status?: ManagerPaymentStatus };
export type PrepareDistribution = {
  enrollmentId: string;
  planId: string;
  amount: string;
  startsAt?: string;
};
export type AllocateReceipt = { subscriptionId: string; amount: string };
export type DistributionView = {
  id: string;
  paymentId: string;
  studentId: string;
  subscriptionId: string;
  enrollmentId: string;
  planId: string;
  amount: string;
  currency: string;
  status: ManagerPaymentStatus;
  consumed: boolean;
  ledgerPublicationId: string | null;
};
export type DistributionPage = {
  items: DistributionView[];
  total: number;
  page: number;
  pageSize: number;
};
export type ManagerAdjustmentCommand = {
  studentId: string;
  originalConsumptionId: string;
  reason: string;
  amount?: string;
  lessons?: number;
};
export type ReceiptMetadata = Pick<
  Prisma.PaymentReceiptUncheckedCreateInput,
  'method' | 'purpose' | 'received_at' | 'manager_note'
>;

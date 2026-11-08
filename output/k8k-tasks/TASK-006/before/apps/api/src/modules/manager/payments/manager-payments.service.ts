import { Injectable } from '@nestjs/common';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { ManagerFinanceFacade } from '../finance/manager-finance.facade.js';
import type { ManagerContext } from '../context/manager-context.js';
import type {
  CreateReceipt,
  ReceiptView,
  ReceiptPage,
  ReceiptQuery,
  PrepareDistribution,
  AllocateReceipt,
  DistributionView,
  DistributionPage,
} from '../../finance/manager-payments/contracts.js';
@Injectable()
export class ManagerPaymentsService {
  constructor(
    private readonly finance: ManagerFinanceFacade,
    private readonly transactions: TransactionService,
  ) {}
  create(
    ctx: ManagerContext,
    student: string,
    dto: CreateReceipt,
    c: CriticalContext,
  ): Promise<Result<ReceiptView, DomainError>> {
    return this.finance.createPayment(ctx, student, dto, c);
  }
  confirm(
    ctx: ManagerContext,
    id: string,
    c: CriticalContext,
  ): Promise<Result<ReceiptView, DomainError>> {
    return this.finance.publishPayment(ctx, id, c);
  }
  reject(
    ctx: ManagerContext,
    id: string,
    reason: string,
    c: CriticalContext,
  ): Promise<Result<ReceiptView, DomainError>> {
    return this.finance.rejectPayment(ctx, id, reason, c);
  }
  list(
    ctx: ManagerContext,
    student: string,
    q: ReceiptQuery,
  ): Promise<Result<ReceiptPage, DomainError>> {
    return this.transactions.runResult((tx) => this.finance.listPayments(ctx, student, q, tx));
  }
  get(ctx: ManagerContext, id: string): Promise<Result<ReceiptView, DomainError>> {
    return this.transactions.runResult((tx) => this.finance.getPayment(ctx, id, tx));
  }
  prepare(
    ctx: ManagerContext,
    id: string,
    input: PrepareDistribution,
    c: CriticalContext,
  ): Promise<Result<DistributionView, DomainError>> {
    return this.finance.prepareDistribution(ctx, id, input, c);
  }
  allocate(
    ctx: ManagerContext,
    id: string,
    input: AllocateReceipt,
    c: CriticalContext,
  ): Promise<Result<DistributionView, DomainError>> {
    return this.finance.allocatePayment(ctx, id, input, c);
  }
  distributions(
    ctx: ManagerContext,
    student: string,
    q: ReceiptQuery,
  ): Promise<Result<DistributionPage, DomainError>> {
    return this.transactions.runResult((tx) => this.finance.listDistributions(ctx, student, q, tx));
  }
}

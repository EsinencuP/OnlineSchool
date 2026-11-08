import { Injectable } from '@nestjs/common';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { ManagerFinanceFacade } from '../finance/manager-finance.facade.js';
import type {
  SubscriptionView,
  CreateSubscription,
  RenewSubscription,
  FreezeSubscription,
} from '../../finance/manager-subscriptions/contracts.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
@Injectable()
export class ManagerSubscriptionsService {
  constructor(
    private readonly finance: ManagerFinanceFacade,
    private readonly scope: ManagerScopeService,
    private readonly transactions: TransactionService,
  ) {}
  list(ctx: ManagerContext, studentId: string): Promise<Result<SubscriptionView[], DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const scope = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
      return scope.ok ? this.finance.listSubscriptions(ctx, studentId, tx) : scope;
    });
  }
  create(
    ctx: ManagerContext,
    studentId: string,
    dto: CreateSubscription,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    return this.finance.subscriptionCreate(ctx, studentId, dto, command);
  }
  renew(
    ctx: ManagerContext,
    id: string,
    dto: RenewSubscription,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    return this.finance.subscriptionRenew(ctx, id, dto, command);
  }
  freeze(
    ctx: ManagerContext,
    id: string,
    dto: FreezeSubscription,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    return this.finance.subscriptionFreeze(ctx, id, dto, command);
  }
  unfreeze(
    ctx: ManagerContext,
    id: string,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    return this.finance.subscriptionUnfreeze(ctx, id, command);
  }
}

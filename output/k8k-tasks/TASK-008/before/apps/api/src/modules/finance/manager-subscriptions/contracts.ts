import type {
  Prisma,
  ManagerSubscriptionStatus,
  ManagerFreezeReason,
  Subscription,
  SaleCondition,
} from '@online-school/db';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
export type SubscriptionView = {
  id: string;
  studentId: string;
  enrollmentId: string;
  planId: string;
  status: ManagerSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  frozenUntil: string | null;
  totalLessons: number;
  remainingLessons: number;
  freezeDaysUsed: number;
  price: string;
  currency: string;
};
export type CreateSubscription = { planId: string; distributionId: string; startsAt?: string };
export type RenewSubscription = { distributionId: string; planId?: string };
export type FreezeSubscription = {
  startsOn: string;
  endsOn: string;
  reason: ManagerFreezeReason;
  comment?: string;
  cancelConflictingLessons?: boolean;
};
export type SubscriptionActor = { accountId: string; managerId: string; requestId: string };
export type Funding = {
  sub: Subscription;
  plan: SaleCondition;
  distributionId: string;
  publicationId: string;
  fullyPaid: boolean;
};
export interface ManagerFinancePort {
  resolveFunding(
    ctx: CriticalContext,
    studentId: string,
    distributionId: string,
    planId?: string,
  ): Promise<Result<Funding, DomainError>>;
  attach(
    ctx: CriticalContext,
    subscriptionId: string,
    funding: Funding,
  ): Promise<Result<void, DomainError>>;
}
export abstract class LessonCancellationPort {
  abstract cancelWithoutCharge(
    ctx: SubscriptionActor,
    lessonIds: string[],
    reason: string,
    tx: Prisma.TransactionClient,
    command: CriticalContext,
  ): Promise<Result<void, DomainError>>;
}

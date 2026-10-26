import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import type { LedgerEntry, PrismaClient } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';

export type LedgerPublishError = {
  code:
    | 'INVALID_INPUT'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'ALREADY_PUBLISHED'
    | 'UNBALANCED'
    | 'CLOSED_PERIOD'
    | 'CONFLICT'
    | 'RETRYABLE'
    | 'DATABASE_ERROR';
};

// Explicit publication policies are rechecked inside the caller transaction.
// HTTP commands also validate the document source and canonical accounting lines.
export abstract class LedgerPublicationPolicy {
  abstract authorize(
    tx: Prisma.TransactionClient,
    actorStaffId: string,
    entryId: string,
  ): Promise<Result<undefined, LedgerPublishError>>;
}

@Injectable()
export class DenyLedgerPublicationPolicy extends LedgerPublicationPolicy {
  authorize(): Promise<Result<undefined, LedgerPublishError>> {
    return Promise.resolve(err({ code: 'FORBIDDEN' }));
  }
}

@Injectable()
export class DirectorLedgerPublicationPolicy extends LedgerPublicationPolicy {
  async authorize(
    tx: Prisma.TransactionClient,
    actorStaffId: string,
  ): Promise<Result<undefined, LedgerPublishError>> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT s.id FROM staff_accounts s JOIN auth_accounts p ON p.id=s.account_id JOIN role_assignments a ON a.account_id=p.id JOIN roles r ON r.id=a.role_id WHERE s.id=${actorStaffId}::uuid AND s.deactivated_at IS NULL AND p.disabled_at IS NULL AND r.code='DIRECTOR' AND a.valid_from<=clock_timestamp() AND (a.valid_to IS NULL OR a.valid_to>clock_timestamp())`;
    return rows.length ? ok(undefined) : err({ code: 'FORBIDDEN' });
  }
}

@Injectable()
export class ContextualLedgerPublicationPolicy extends LedgerPublicationPolicy {
  async authorize(
    tx: Prisma.TransactionClient,
    actorStaffId: string,
    entryId: string,
  ): Promise<Result<undefined, LedgerPublishError>> {
    const direct = await new DirectorLedgerPublicationPolicy().authorize(tx, actorStaffId);
    if (direct.ok) return direct;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT s.id FROM staff_accounts s JOIN auth_accounts p ON p.id=s.account_id
      JOIN role_assignments a ON a.account_id=p.id JOIN roles r ON r.id=a.role_id
      JOIN ledger_entries e ON e.id=${entryId}::uuid JOIN ledger_documents d ON d.id=e.document_id
      LEFT JOIN entitlement_consumptions c ON c.id=d.consumption_id
      LEFT JOIN subscriptions sub ON sub.id=c.subscription_id
      LEFT JOIN student_subject_enrollments en ON en.id=sub.enrollment_id
      LEFT JOIN confirmed_payouts pay ON pay.id=d.payout_id LEFT JOIN payout_attempts pa ON pa.id=pay.attempt_id LEFT JOIN payroll_obligations po ON po.id=pa.obligation_id
      LEFT JOIN teacher_accruals ac ON ac.id=coalesce(d.accrual_id,po.accrual_id)
      LEFT JOIN lesson_actual_outcomes o ON o.id=ac.lesson_actual_outcome_id LEFT JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
      LEFT JOIN student_subject_enrollments ae ON ae.id=l.enrollment_id
      JOIN assigned_managers m ON m.manager_id=s.id AND m.student_id=coalesce(en.student_id,ae.student_id)
      WHERE s.id=${actorStaffId}::uuid AND s.deactivated_at IS NULL AND p.disabled_at IS NULL
      AND r.code='MANAGER' AND a.valid_from<=clock_timestamp() AND (a.valid_to IS NULL OR a.valid_to>clock_timestamp())
      AND m.assigned_at<=clock_timestamp() AND (m.ended_at IS NULL OR m.ended_at>clock_timestamp())
      AND (d.consumption_id IS NOT NULL OR d.accrual_id IS NOT NULL OR d.payout_id IS NOT NULL)`;
    return rows.length ? ok(undefined) : err({ code: 'FORBIDDEN' });
  }
}

export type PublishLedgerCommand = {
  entryId: string;
  actorStaffId: string;
  operationId: string;
};

@Injectable()
export class LedgerPublicationService {
  constructor(private readonly policy: LedgerPublicationPolicy) {}

  // Finance commands already own their SERIALIZABLE transaction and atomic audit/outbox.
  async publishInTransaction(
    tx: Prisma.TransactionClient,
    command: PublishLedgerCommand,
  ): Promise<Result<LedgerEntry, LedgerPublishError>> {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM ledger_entries WHERE id=${command.entryId}::uuid FOR UPDATE`;
    if (!locked.length) return err({ code: 'NOT_FOUND' });
    const permission = await this.policy.authorize(tx, command.actorStaffId, command.entryId);
    if (!permission.ok) return permission;
    const entry = await tx.ledgerEntry.findUniqueOrThrow({ where: { id: command.entryId } });
    if (entry.published_at)
      return entry.publication_operation_id === command.operationId
        ? ok(entry)
        : err({ code: 'ALREADY_PUBLISHED' });
    const period = await tx.$queryRaw<
      { closed_at: Date | null }[]
    >`SELECT closed_at FROM financial_periods WHERE id=${entry.financial_period_id}::uuid FOR UPDATE`;
    if (period.length !== 1 || period[0]!.closed_at) return err({ code: 'CLOSED_PERIOD' });
    const totals = await tx.$queryRaw<
      { currency: string; debit: string | null; credit: string | null; count: bigint }[]
    >`
      SELECT currency,sum(amount) FILTER(WHERE direction='DEBIT')::text AS debit,sum(amount) FILTER(WHERE direction='CREDIT')::text AS credit,count(*) AS count FROM ledger_lines WHERE entry_id=${entry.id}::uuid GROUP BY currency`;
    if (
      !totals.length ||
      totals.some(
        (r) =>
          r.count < 2n ||
          !r.debit ||
          !r.credit ||
          !new Prisma.Decimal(r.debit).gt(0) ||
          !new Prisma.Decimal(r.debit).eq(r.credit),
      )
    )
      return err({ code: 'UNBALANCED' });
    const snapshot = Object.fromEntries(
      totals.map((r) => [
        r.currency,
        {
          debit: new Prisma.Decimal(r.debit!).toFixed(4),
          credit: new Prisma.Decimal(r.credit!).toFixed(4),
        },
      ]),
    );
    const now = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    return ok(
      await tx.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          balanced_at: now,
          published_at: now,
          published_by_id: command.actorStaffId,
          publication_operation_id: command.operationId,
          balance_snapshot: snapshot,
        },
      }),
    );
  }

  async publish(
    client: PrismaClient,
    command: PublishLedgerCommand,
  ): Promise<Result<LedgerEntry, LedgerPublishError>> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      ![command.entryId, command.actorStaffId, command.operationId].every((id) => uuid.test(id))
    ) {
      return err({ code: 'INVALID_INPUT' });
    }
    try {
      const result = await client.$transaction(
        async (tx): Promise<Result<LedgerEntry, LedgerPublishError>> => {
          // The line trigger takes this same lock, so line edits cannot race publication.
          const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM ledger_entries WHERE id = ${command.entryId}::uuid FOR UPDATE
        `;
          if (rows.length === 0) return err({ code: 'NOT_FOUND' });
          const permission = await this.policy.authorize(tx, command.actorStaffId, command.entryId);
          if (!permission.ok) return permission;
          const entry = await tx.ledgerEntry.findUnique({ where: { id: command.entryId } });
          if (!entry) return err({ code: 'NOT_FOUND' });
          if (entry.published_at) {
            return entry.publication_operation_id === command.operationId
              ? ok(entry)
              : err({ code: 'ALREADY_PUBLISHED' });
          }
          const periods = await tx.$queryRaw<{ closed_at: Date | null }[]>`
          SELECT closed_at FROM financial_periods WHERE id = ${entry.financial_period_id}::uuid FOR UPDATE
        `;
          if (periods.length !== 1 || periods[0]?.closed_at) return err({ code: 'CLOSED_PERIOD' });
          const lines = await tx.ledgerLine.groupBy({
            by: ['currency', 'direction'],
            where: { entry_id: entry.id },
            _sum: { amount: true },
            _count: { _all: true },
          });
          const balances = new Map<
            string,
            { debit: Prisma.Decimal; credit: Prisma.Decimal; count: number }
          >();
          for (const line of lines) {
            const balance = balances.get(line.currency) ?? {
              debit: new Prisma.Decimal(0),
              credit: new Prisma.Decimal(0),
              count: 0,
            };
            const amount = line._sum.amount ?? new Prisma.Decimal(0);
            // PostgreSQL already summed each (currency, direction) group exactly.
            // Avoid re-adding in Decimal.js: aggregate totals may exceed its default precision.
            if (line.direction === 'DEBIT') balance.debit = amount;
            else balance.credit = amount;
            balance.count += line._count._all;
            balances.set(line.currency, balance);
          }
          if (
            balances.size === 0 ||
            [...balances.values()].some(
              (balance) =>
                balance.count < 2 || !balance.debit.gt(0) || !balance.debit.eq(balance.credit),
            )
          )
            return err({ code: 'UNBALANCED' });

          // Decimal strings preserve NUMERIC(20,4) exactly; no JS number arithmetic.
          const snapshot: Record<string, { debit: string; credit: string }> = {};
          for (const [currency, balance] of balances) {
            snapshot[currency] = {
              debit: balance.debit.toFixed(4),
              credit: balance.credit.toFixed(4),
            };
          }
          const now = new Date();
          const published = await tx.ledgerEntry.update({
            where: { id: entry.id },
            data: {
              balanced_at: now,
              published_at: now,
              balance_snapshot: snapshot,
              published_by_id: command.actorStaffId,
              publication_operation_id: command.operationId,
            },
          });
          const actor = await tx.staffAccount.findUniqueOrThrow({
            where: { id: command.actorStaffId },
            select: { account_id: true },
          });
          const audit = await tx.auditEvent.create({
            data: {
              actor_kind: 'ACCOUNT',
              actor_id: actor.account_id,
              action: 'ledger.publish',
              resource_type: 'LedgerEntry',
              resource_id: entry.id,
              result: 'SUCCESS',
              request_id: command.operationId,
              source_operation_id: command.operationId,
              event_key: `ledger.publish:${command.operationId}`,
            },
          });
          await tx.outboxEvent.create({
            data: {
              topic: 'ledger.published.v1',
              aggregate_type: 'LedgerEntry',
              aggregate_id: entry.id,
              source_operation_id: command.operationId,
              audit_event_id: audit.id,
              event_key: `ledger.published:${entry.id}`,
              payload: { entryId: entry.id, documentId: entry.document_id, schemaVersion: 1 },
            },
          });
          return ok(published);
        },
        { timeout: 10_000 },
      );
      if (!result.ok && result.error.code === 'CLOSED_PERIOD') {
        const actor = await client.staffAccount.findUniqueOrThrow({
          where: { id: command.actorStaffId },
          select: { account_id: true },
        });
        // A denied command has no business transaction to commit; persist its audit separately.
        await client.auditEvent.createMany({
          skipDuplicates: true,
          data: [
            {
              actor_kind: 'ACCOUNT',
              actor_id: actor.account_id,
              action: 'ledger.publish.denied',
              resource_type: 'LedgerEntry',
              resource_id: command.entryId,
              result: 'DENIED',
              request_id: command.operationId,
              source_operation_id: command.operationId,
              event_key: `ledger.publish.denied:${command.operationId}:${command.entryId}`,
              metadata: { reason: 'CLOSED_PERIOD' },
            },
          ],
        });
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return err({ code: 'CONFLICT' });
        if (error.code === 'P2034') return err({ code: 'RETRYABLE' });
      }
      return err({ code: 'DATABASE_ERROR' });
    }
  }
}

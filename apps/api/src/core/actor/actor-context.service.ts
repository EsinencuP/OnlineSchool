import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { DatabaseService } from '../database/database.module.js';
import { domainError, fail } from '../errors/domain-error.js';
import type { AccountContext } from '../http.js';
import type { StaffActorContextDto } from './actor-context.dto.js';

export const sourceTimestamp = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null;

@Injectable()
export class StaffActorContextService {
  constructor(private readonly db: DatabaseService) {}

  async get(
    actor: AccountContext,
    transaction?: Prisma.TransactionClient,
  ): Promise<StaffActorContextDto> {
    const teacher = actor.role === 'TEACHER';
    if (
      actor.recoveryOnly ||
      actor.roles.length !== 1 ||
      actor.roles[0] !== actor.role ||
      (teacher ? actor.kind !== 'TEACHER' : actor.kind !== 'STAFF') ||
      !['TEACHER', 'MANAGER', 'DIRECTOR', 'TECH_OPERATOR'].includes(actor.role)
    )
      return fail(domainError('FORBIDDEN', 403));
    const tx = transaction ?? this.db.client;
    const account = await tx.authAccount.findUnique({
      where: { id: actor.accountId },
      select: { disabled_at: true, updated_at: true },
    });
    if (!account || account.disabled_at) return fail(domainError('FORBIDDEN', 403));
    const profile = teacher
      ? await tx.teacherAccount.findFirst({
          where: { account_id: actor.accountId, deactivated_at: null },
          select: { id: true, full_name: true, updated_at: true },
        })
      : await tx.staffAccount.findFirst({
          where: { account_id: actor.accountId, deactivated_at: null },
          select: { id: true, full_name: true, updated_at: true },
        });
    if (!profile) return fail(domainError('FORBIDDEN', 403));
    const timezone = process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau';
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      return fail(domainError('CONFIGURATION_INVALID', 503));
    }
    const now = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    return {
      accountId: actor.accountId,
      role: actor.role as StaffActorContextDto['role'],
      staffProfileId: teacher ? null : profile.id,
      teacherProfileId: teacher ? profile.id : null,
      displayName: profile.full_name,
      timezone,
      timezoneSource:
        process.env.SCHOOL_TIMEZONE === undefined ? 'SCHOOL_DEFAULT' : 'SCHOOL_CONFIGURATION',
      asOf: now.toISOString(),
      accountUpdatedAt: sourceTimestamp(account.updated_at),
      profileUpdatedAt: sourceTimestamp(profile.updated_at),
    };
  }
}

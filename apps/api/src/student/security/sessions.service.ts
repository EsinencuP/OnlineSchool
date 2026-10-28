import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError } from '../../core/errors/domain-error.js';
import { IdentityService, now } from '../../modules/identity/identity.service.js';
import { SESSION_IDLE_MS } from '../../core/session/session.store.js';
import { object } from '../../modules/identity/input.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import type { SessionInfoDto } from './security.dto.js';
import { StudentSecurityCommands } from './security-commands.js';
@Injectable()
export class StudentSessionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly commands: StudentSecurityCommands,
    private readonly identity: IdentityService,
  ) {}
  async list(student: IStudentContext, currentId: string): Promise<SessionInfoDto[]> {
    const time = await now(this.db.client);
    const rows = await this.db.client.session.findMany({
      where: {
        account_id: student.userId,
        revoked_at: null,
        expires_at: { gt: time },
        OR: [
          { last_seen_at: { gte: new Date(+time - SESSION_IDLE_MS) } },
          { last_seen_at: null, created_at: { gte: new Date(+time - SESSION_IDLE_MS) } },
        ],
      },
      orderBy: [{ last_seen_at: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        created_at: true,
        last_seen_at: true,
        user_agent: true,
        ip_address: true,
      },
    });
    return rows.map((s) => ({
      sessionId: s.id,
      createdAt: s.created_at.toISOString(),
      lastActiveAt: (s.last_seen_at ?? s.created_at).toISOString(),
      userAgent: s.user_agent ?? '',
      ipAddress: s.ip_address ?? '',
      isCurrent: s.id === currentId,
    }));
  }
  async revoke(
    req: StudentRequest,
    student: IStudentContext,
    id: string,
    body: unknown,
  ): Promise<void> {
    object(body ?? {}, []);
    await this.commands.run(req, student, 'student.session.revoke', async (tx, account, actor) => {
      if (id === actor.sessionId)
        return { resourceId: id, error: domainError('CURRENT_SESSION_CANNOT_BE_REVOKED', 409) };
      const target = await tx.session.findFirst({
        where: { id, account_id: account.id },
        select: { id: true, revoked_at: true },
      });
      if (!target) return { resourceId: account.id, error: domainError('SESSION_NOT_FOUND', 404) };
      if (!target.revoked_at)
        await this.identity.revoke(
          tx,
          account.id,
          account.id,
          'STUDENT_SESSION_REVOKED',
          false,
          id,
        );
      return { resourceId: id, body: {} };
    });
  }
}

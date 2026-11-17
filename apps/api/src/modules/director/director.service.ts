import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { StaffActorContextService } from '../../core/actor/actor-context.service.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import type { DirectorContext } from './context/director-context.js';
import { DirectorDecisionsService } from './director-decisions.service.js';
import { DirectorEscalationsService } from './director-escalations.service.js';
import type { DirectorMeDto } from './dto/director.dto.js';

@Injectable()
export class DirectorService {
  constructor(
    private readonly actors: StaffActorContextService,
    private readonly decisions: DirectorDecisionsService,
    private readonly escalations: DirectorEscalationsService,
  ) {}

  async me(
    ctx: DirectorContext,
    actor: AccountContext,
  ): Promise<Result<DirectorMeDto, DomainError>> {
    try {
      const actorContext = await this.actors.get(actor);
      return ok({
        actorContext,
        staffId: ctx.staffId,
        displayName: actorContext.displayName,
        role: 'DIRECTOR',
        timezone: actorContext.timezone,
        pending: await this.decisions.counts(),
        openEscalations: await this.escalations.openCount(),
      });
    } catch (error: unknown) {
      return err(error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503));
    }
  }
}

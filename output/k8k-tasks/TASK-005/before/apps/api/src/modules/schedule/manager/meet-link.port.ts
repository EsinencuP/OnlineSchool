import { Injectable } from '@nestjs/common';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
export abstract class MeetLinkPort {
  abstract generate(lesson: { id: string }): Promise<Result<string, DomainError>>;
}
@Injectable()
export class UnavailableMeetLink extends MeetLinkPort {
  generate(): Promise<Result<string, DomainError>> {
    return Promise.resolve(
      err(
        domainError(
          process.env.MEET_AUTO_GENERATION_ENABLED === 'true'
            ? 'MEET_ADAPTER_NOT_CONFIGURED'
            : 'MEET_GENERATION_DISABLED',
          503,
        ),
      ),
    );
  }
}

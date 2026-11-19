import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  SetMetadata,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Length } from 'class-validator';
import type { Prisma } from '@online-school/db';
import { ok } from '@online-school/shared';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { CurrentAccount, RequireVerifiedMfa } from '../../core/rbac/decorators.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { STRICT_INPUT_DTO } from '../../openapi/dto-validation.pipe.js';
import { ApiError } from '../../openapi/dtos.js';
import { FinanceAccess } from '../finance/finance-access.service.js';
import { at } from '../finance/finance-common.js';
import { string, uuid } from '../identity/input.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

const command = (action: string, resourceType: string) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type: `director.meet.${action}`,
      resourceType,
      topic: `director.meet.${action}.v1`,
      conflictOnPayloadMismatch: true,
    }),
  );

@SetMetadata(STRICT_INPUT_DTO, true)
class MeetDecisionInputDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Length(5, 500)
  basis!: string;
}

class MeetDirectorPairDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
}

class MeetDirectorUnknownDto extends MeetDirectorPairDto {
  @ApiProperty({ format: 'uuid' }) assignmentId!: string;
  @ApiProperty({ type: String, nullable: true }) diagnosticCode!: string | null;
  @ApiProperty({ format: 'date-time' }) queuedAt!: string;
}

class MeetDirectorSpaceDto extends MeetDirectorPairDto {
  @ApiProperty({ format: 'date-time' }) publishedAt!: string;
  @ApiProperty({ format: 'date-time' }) lastVerifiedAt!: string;
}

class MeetDirectorInventoryDto {
  @ApiProperty({ type: [MeetDirectorUnknownDto] }) unresolved!: MeetDirectorUnknownDto[];
  @ApiProperty({ type: [MeetDirectorSpaceDto] }) spaces!: MeetDirectorSpaceDto[];
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) nextUnresolved!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) nextSpace!: string | null;
}

class MeetDirectorDecisionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['CLOSED_WITHOUT_SPACE', 'RETIRED'] }) state!: string;
}

@DirectorRoute()
@RequireVerifiedMfa()
@ApiResponse({ status: 404, type: ApiError })
@ApiResponse({ status: 409, type: ApiError })
@Controller('api/v1/director/meet')
export class DirectorMeetController {
  constructor(
    private readonly transactions: TransactionService,
    private readonly access: FinanceAccess,
  ) {}

  private director(ctx: CriticalContext) {
    if (ctx.actor.role !== 'DIRECTOR' || !ctx.actor.mfaCompleted)
      return fail(domainError('FORBIDDEN', 403));
    return this.access.staff(ctx, true);
  }

  private async lockIdlePair(
    tx: Prisma.TransactionClient,
    pair: { student_id: string; teacher_id: string },
  ) {
    await tx.$queryRaw`SELECT id FROM teacher_accounts WHERE id=${pair.teacher_id}::uuid FOR UPDATE`;
    const active = await tx.teacherMeetOperation.findFirst({
      where: {
        student_id: pair.student_id,
        teacher_id: pair.teacher_id,
        state: { in: ['QUEUED', 'DISPATCHING'] },
      },
      select: { id: true },
    });
    if (active) return fail(domainError('MEET_OPERATION_PENDING', 409));
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorMeetInventory',
    summary: 'Read unresolved creation attempts and published pair spaces',
  })
  @ApiQuery({
    name: 'afterUnresolved',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'afterSpace', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: MeetDirectorInventoryDto })
  async read(
    @CurrentAccount() actor: AccountContext,
    @Query('afterUnresolved') afterUnresolved?: string,
    @Query('afterSpace') afterSpace?: string,
  ) {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        await this.director({ tx, actor, requestId: '', operationId: '' });
        const limit = 50;
        const unresolved = await tx.teacherMeetOperation.findMany({
          where: {
            state: 'UNKNOWN',
            ...(afterUnresolved ? { id: { gt: uuid(afterUnresolved) } } : {}),
          },
          select: {
            id: true,
            student_id: true,
            teacher_id: true,
            assignment_id: true,
            queued_at: true,
            diagnostic_code: true,
          },
          take: limit + 1,
          orderBy: { id: 'asc' },
        });
        const spaces = await tx.teacherMeetSpace.findMany({
          where: { retired_at: null, ...(afterSpace ? { id: { gt: uuid(afterSpace) } } : {}) },
          select: {
            id: true,
            student_id: true,
            teacher_id: true,
            published_at: true,
            last_verified_at: true,
          },
          take: limit + 1,
          orderBy: { id: 'asc' },
        });
        return ok({
          unresolved: unresolved.slice(0, limit).map((row) => ({
            id: row.id,
            studentId: row.student_id,
            teacherId: row.teacher_id,
            assignmentId: row.assignment_id,
            queuedAt: row.queued_at.toISOString(),
            diagnosticCode: row.diagnostic_code,
          })),
          spaces: spaces.slice(0, limit).map((row) => ({
            id: row.id,
            studentId: row.student_id,
            teacherId: row.teacher_id,
            publishedAt: row.published_at.toISOString(),
            lastVerifiedAt: row.last_verified_at.toISOString(),
          })),
          nextUnresolved: unresolved.length > limit ? unresolved[limit - 1]!.id : null,
          nextSpace: spaces.length > limit ? spaces[limit - 1]!.id : null,
        });
      }),
    );
  }

  @Post('operations/:id/close-without-space')
  @command('close-without-space', 'TeacherMeetOperation')
  @ApiOperation({
    operationId: 'closeDirectorUnknownMeetCreation',
    summary: 'Record that an external investigation found no created space and allow a new request',
  })
  @ApiOkResponse({ type: MeetDirectorDecisionDto })
  async close(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') rawId: string,
    @Body() dto: MeetDecisionInputDto,
  ) {
    const staff = await this.director(ctx);
    const id = uuid(rawId);
    const row = await ctx.tx.teacherMeetOperation.findUnique({ where: { id } });
    if (!row) return fail(domainError('MEET_UNKNOWN_OPERATION_NOT_FOUND', 404));
    await this.lockIdlePair(ctx.tx, row);
    const changed = await ctx.tx.teacherMeetOperation.updateMany({
      where: { id, state: 'UNKNOWN' },
      data: {
        state: 'CLOSED_WITHOUT_SPACE',
        closed_at: await at(ctx.tx),
        closed_by_id: staff,
        closure_basis: string(dto.basis, 5, 500),
      },
    });
    if (!changed.count) return fail(domainError('MEET_OPERATION_ALREADY_SETTLED', 409));
    return { id, state: 'CLOSED_WITHOUT_SPACE' };
  }

  @Post('spaces/:id/retire')
  @command('retire-space', 'TeacherMeetSpace')
  @ApiOperation({
    operationId: 'retireDirectorMeetSpace',
    summary: 'Retire the future-use link after reviewing the need for replacement',
  })
  @ApiOkResponse({ type: MeetDirectorDecisionDto })
  async retire(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') rawId: string,
    @Body() dto: MeetDecisionInputDto,
  ) {
    const staff = await this.director(ctx);
    const id = uuid(rawId);
    const row = await ctx.tx.teacherMeetSpace.findUnique({ where: { id } });
    if (!row) return fail(domainError('MEET_SPACE_NOT_FOUND', 404));
    await this.lockIdlePair(ctx.tx, row);
    const now = await at(ctx.tx);
    if (row.retired_at || now <= row.published_at)
      return fail(domainError('MEET_SPACE_NOT_RETIRABLE', 409));
    const changed = await ctx.tx.teacherMeetSpace.updateMany({
      where: { id, retired_at: null },
      data: { retired_at: now, retired_by_id: staff, retirement_basis: string(dto.basis, 5, 500) },
    });
    if (!changed.count) return fail(domainError('MEET_SPACE_NOT_RETIRABLE', 409));
    return { id, state: 'RETIRED' };
  }
}

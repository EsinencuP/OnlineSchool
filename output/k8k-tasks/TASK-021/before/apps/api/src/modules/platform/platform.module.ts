import { Controller, Get, Module, Param, Req, Res, Header, applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { Authenticated, Public, RequireRole } from '../../core/rbac/decorators.js';
import { DatabaseService } from '../../core/database/database.module.js';
import type { HttpRequest, HttpResponse } from '../../core/http.js';
import { demoAccounts, demoSwitchAllowed } from '../identity/demo-accounts.js';
import {
  PlatformAccountsDto,
  PlatformWorkspaceDto,
  WorkspaceDetailDto,
  workspaceDetailSections,
} from './platform.dto.js';
import {
  StaffActorContextDto,
  StaffActionEligibilityDto,
} from '../../core/actor/actor-context.dto.js';
import { StaffActorContextService } from '../../core/actor/actor-context.service.js';
import { CoreModule } from '../../core/core.module.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ok } from '@online-school/shared';
import { uuid } from '../identity/input.js';
import { ScheduleModule } from '../schedule/schedule.module.js';
import { OutcomesService } from '../schedule/outcomes.service.js';
import { FinanceInfrastructureModule } from '../finance/finance-infrastructure.module.js';
import { PaymentsService } from '../finance/payments.service.js';
import { PlatformWorkspaceService } from './workspace.service.js';
import { ApiError } from '../../openapi/dtos.js';

const staffRead = () =>
  applyDecorators(
    ApiCookieAuth('sessionCookie'),
    Header('Cache-Control', 'private, no-store'),
    ApiResponse({ status: 400, type: ApiError, description: 'INVALID_INPUT' }),
    ApiResponse({ status: 401, type: ApiError, description: 'UNAUTHENTICATED' }),
    ApiResponse({ status: 403, type: ApiError, description: 'FORBIDDEN or MFA_REQUIRED' }),
    ApiResponse({
      status: 503,
      type: ApiError,
      description: 'Data store or configuration unavailable',
    }),
  );

@Controller('api/v1/platform')
@ApiTags('Platform')
export class PlatformController {
  constructor(
    private readonly db: DatabaseService,
    private readonly actors: StaffActorContextService,
    private readonly transactions: TransactionService,
    private readonly workspaces: PlatformWorkspaceService,
    private readonly outcomes: OutcomesService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('actor-context')
  @Authenticated()
  @RequireRole('TEACHER', 'DIRECTOR', 'TECH_OPERATOR')
  @staffRead()
  @ApiResponse({ status: 200, type: StaffActorContextDto })
  @ApiOperation({
    operationId: 'getStaffActorContext',
    summary: 'Own active staff identity; manager context is served by getManagerMe',
  })
  async actorContext(@Req() req: HttpRequest): Promise<StaffActorContextDto> {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) =>
        ok(await this.actors.get(req.account!, tx)),
      ),
    );
  }

  @Get('lessons/:id/start-eligibility')
  @RequireRole('TEACHER')
  @staffRead()
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: StaffActionEligibilityDto })
  @ApiOperation({
    operationId: 'getTeacherLessonStartEligibility',
    summary: 'Advisory only; startLesson repeats the same policy inside the command transaction',
  })
  async lessonEligibility(
    @Req() req: HttpRequest,
    @Param('id') id: string,
  ): Promise<StaffActionEligibilityDto> {
    id = uuid(id);
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        await this.actors.get(req.account!, tx);
        return ok(
          await this.outcomes.startEligibility(
            { tx, actor: req.account!, requestId: req.requestId!, operationId: req.requestId! },
            id,
          ),
        );
      }),
    );
  }

  @Get('payments/:id/confirm-eligibility')
  @RequireRole('DIRECTOR')
  @staffRead()
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: StaffActionEligibilityDto })
  @ApiOperation({
    operationId: 'getDirectorPaymentConfirmationEligibility',
    summary: 'Director receipt confirmation policy; no allocation or ledger write',
  })
  async paymentEligibility(
    @Req() req: HttpRequest,
    @Param('id') id: string,
  ): Promise<StaffActionEligibilityDto> {
    id = uuid(id);
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        await this.actors.get(req.account!, tx);
        return ok(
          await this.payments.confirmationEligibility(
            { tx, actor: req.account!, requestId: req.requestId!, operationId: req.requestId! },
            id,
          ),
        );
      }),
    );
  }

  @Get('accounts')
  @Public()
  @ApiResponse({ status: 200, type: PlatformAccountsDto })
  @ApiOperation({
    operationId: 'getPlatformAccounts',
    summary: 'Public demo names and current switching eligibility; no credentials',
  })
  async accounts(
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<PlatformAccountsDto> {
    res.setHeader('Cache-Control', 'no-store');
    const account = req.account
      ? await this.db.client.authAccount.findUnique({
          where: { id: req.account.accountId },
          select: { login_id: true },
        })
      : null;
    return {
      enabled: demoSwitchAllowed(req.account, account?.login_id ?? ''),
      currentKey: demoAccounts.find((a) => a.login === account?.login_id)?.key ?? null,
      items: process.env.PLATFORM_DEMO_SWITCHING === 'true' ? demoAccounts : [],
    };
  }

  @Get('workspace')
  @Authenticated()
  @RequireRole('TEACHER', 'DIRECTOR')
  @staffRead()
  @ApiResponse({ status: 200, type: PlatformWorkspaceDto })
  @ApiOperation({
    operationId: 'getPlatformWorkspace',
    summary: 'Teacher own lessons and assignments, or director school overview',
  })
  async workspace(
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<PlatformWorkspaceDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.workspaces.get(req.account!);
  }

  @Get('workspace/:section/:id')
  @Authenticated()
  @RequireRole('TEACHER', 'DIRECTOR')
  @staffRead()
  @ApiParam({ name: 'section', enum: workspaceDetailSections })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: WorkspaceDetailDto })
  @ApiResponse({
    status: 404,
    type: ApiError,
    description: 'Object absent or outside visible scope',
  })
  @ApiOperation({
    operationId: 'getPlatformWorkspaceDetail',
    summary: 'Read a single object in the existing staff workspace scope',
  })
  workspaceDetail(
    @Req() req: HttpRequest,
    @Param('section') section: string,
    @Param('id') id: string,
  ) {
    return this.workspaces.getDetail(req.account!, section, uuid(id));
  }
}
@Module({
  imports: [CoreModule, ScheduleModule, FinanceInfrastructureModule],
  controllers: [PlatformController],
  providers: [PlatformWorkspaceService],
})
export class PlatformModule {}

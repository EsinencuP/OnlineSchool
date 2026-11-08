import { Body, Controller, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext, HttpResponse } from '../../../core/http.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import type { ManagerRequest } from '../context/manager-context.js';
import {
  CreateStudentAccountDto,
  ResetStudentPasswordDto,
  StudentAccountIssuedDto,
} from '../dto/student-account.dto.js';
import { ManagerAccountsService } from './manager-accounts.service.js';
import { ManagerAccountsGuard } from './manager-accounts.guard.js';

@ManagerRoute()
@ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
@ApiHeader({ name: 'X-CSRF-Token', required: true })
@ApiBadRequestResponse({ type: ApiError, description: 'IDEMPOTENCY_KEY_REQUIRED' })
@ApiNotFoundResponse({ type: ApiError, description: 'STUDENT_NOT_FOUND or ACCOUNT_NOT_FOUND' })
@ApiConflictResponse({
  type: ApiError,
  description:
    'FIRST_PAYMENT_NOT_CONFIRMED, ACCOUNT_ALREADY_EXISTS, EMAIL_ALREADY_USED, IDEMPOTENCY_KEY_REUSED',
})
@ApiTooManyRequestsResponse({
  type: ApiError,
  description: 'RESET_LIMIT_EXCEEDED or AUTH_RATE_LIMITED',
})
@ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_INPUT' })
@ApiServiceUnavailableResponse({ type: ApiError })
@Controller('api/v1/manager/students/:studentId/account')
export class ManagerAccountsController {
  constructor(private readonly accounts: ManagerAccountsService) {}
  private once(
    req: ManagerRequest,
    res: HttpResponse,
    issued: StudentAccountIssuedDto,
  ): StudentAccountIssuedDto {
    res.setHeader('Cache-Control', 'no-store');
    let password = issued.temporaryPassword;
    // Only this request owns the secret. Retry/replay clears this projection in the core.
    req.afterCriticalCommit = async (body) => {
      const once = password;
      password = null;
      delete req.afterCriticalCommit;
      return {
        ...(body as StudentAccountIssuedDto),
        temporaryPassword: once,
        passwordAlreadyIssued: once === null,
      };
    };
    return { ...issued, temporaryPassword: null, passwordAlreadyIssued: true };
  }
  @Post()
  @UseGuards(ManagerAccountsGuard)
  @ApiOperation({ operationId: 'createManagerStudentAccount' })
  @ApiCreatedResponse({ type: StudentAccountIssuedDto })
  @ApiOkResponse({
    type: StudentAccountIssuedDto,
    description: 'Idempotent replay; password already issued',
  })
  @CriticalCommand({
    type: 'manager.student.account.create',
    resourceType: 'AuthAccount',
    topic: 'manager.student.account-issued.v1',
    resultIdField: 'accountId',
    successStatus: 201,
    replaySuccessStatus: 200,
    conflictOnPayloadMismatch: true,
    redactResultFields: ['temporaryPassword'],
  })
  async create(
    @Req() req: ManagerRequest,
    @Res({ passthrough: true }) res: HttpResponse,
    @Param('studentId') id: string,
    @Body() dto: CreateStudentAccountDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<StudentAccountIssuedDto> {
    return this.once(
      req,
      res,
      unwrap(
        await this.accounts.createAccount(req.managerCtx!, id, dto, req.idempotencyKey!, command),
      ),
    );
  }
  @Post('reset-password')
  @UseGuards(ManagerAccountsGuard)
  @ApiOperation({ operationId: 'resetManagerStudentPassword' })
  @ApiOkResponse({ type: StudentAccountIssuedDto })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @CriticalCommand({
    type: 'manager.student.account.reset',
    resourceType: 'AuthAccount',
    topic: 'manager.student.password-reset.v1',
    resultIdField: 'accountId',
    successStatus: 200,
    replaySuccessStatus: 200,
    conflictOnPayloadMismatch: true,
    redactResultFields: ['temporaryPassword'],
  })
  async reset(
    @Req() req: ManagerRequest,
    @Res({ passthrough: true }) res: HttpResponse,
    @Param('studentId') id: string,
    @Body() _dto: ResetStudentPasswordDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<StudentAccountIssuedDto> {
    return this.once(
      req,
      res,
      unwrap(await this.accounts.resetPassword(req.managerCtx!, id, req.idempotencyKey!, command)),
    );
  }
}

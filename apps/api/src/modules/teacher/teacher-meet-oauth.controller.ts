import { Body, Controller, Get, Header, HttpCode, Post, Req, SetMetadata } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { RequireVerifiedMfa } from '../../core/rbac/decorators.js';
import { STRICT_INPUT_DTO } from '../../openapi/dto-validation.pipe.js';
import { ApiError } from '../../openapi/dtos.js';
import type { TeacherRequest } from './context/teacher-context.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherMeetOAuthService } from './teacher-meet-oauth.service.js';

class TeacherMeetConnectionDto {
  @ApiProperty({ enum: ['DISCONNECTED', 'REVOCATION_PENDING', 'CONNECTED'] })
  state!: string;

  @ApiProperty()
  available!: boolean;
}

class StartTeacherMeetOAuthResponseDto {
  @ApiProperty({ format: 'uri' })
  authorizationUrl!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
class CompleteTeacherMeetOAuthDto {
  @ApiProperty()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  state!: string;

  @ApiProperty()
  @Matches(/^[!-~]{8,2048}$/)
  code!: string;
}

@TeacherRoute()
@RequireVerifiedMfa()
@Controller('api/v1/teacher/meet/oauth')
export class TeacherMeetOAuthController {
  constructor(private readonly service: TeacherMeetOAuthService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getTeacherMeetConnection',
    summary: 'Read the connection state for the signed-in teacher',
  })
  @ApiOkResponse({ type: TeacherMeetConnectionDto })
  status(@Req() req: TeacherRequest) {
    return this.service.status(req.teacherCtx!);
  }

  @Post('start')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'startTeacherMeetOAuth',
    summary: 'Start the teacher Google consent flow',
  })
  @ApiOkResponse({ type: StartTeacherMeetOAuthResponseDto })
  @ApiResponse({ status: 503, type: ApiError })
  start(@Req() req: TeacherRequest) {
    return this.service.start(req.teacherCtx!);
  }

  @Post('complete')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'completeTeacherMeetOAuth',
    summary: 'Complete consent once using the originating teacher session',
  })
  @ApiOkResponse({ type: TeacherMeetConnectionDto })
  @ApiResponse({ status: 409, type: ApiError })
  @ApiResponse({ status: 422, type: ApiError })
  @ApiResponse({ status: 503, type: ApiError })
  complete(@Req() req: TeacherRequest, @Body() body: CompleteTeacherMeetOAuthDto) {
    return this.service.complete(req.teacherCtx!, body.state, body.code);
  }

  @Post('disconnect')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'disconnectTeacherMeetOAuth',
    summary: 'Disable the connection locally and request Google token revocation',
  })
  @ApiOkResponse({ type: TeacherMeetConnectionDto })
  disconnect(@Req() req: TeacherRequest) {
    return this.service.disconnect(req.teacherCtx!);
  }
}

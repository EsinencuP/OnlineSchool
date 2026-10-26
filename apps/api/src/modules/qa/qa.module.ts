import { Controller, Get, Module, Param, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, RequireMfa, RequireRole } from '../../core/rbac/decorators.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { HttpRequest, HttpResponse } from '../../core/http.js';
import { ComponentStatusResponse, FileAccessResponse } from './qa.dto.js';

@ApiTags('QA diagnostics')
@ApiCookieAuth('sessionCookie')
@Controller('api/v1/qa')
@Authenticated()
@RequireMfa()
@RequireRole('DIRECTOR', 'MANAGER', 'TEACHER', 'TECH_OPERATOR')
export class QaController {
  constructor(private readonly database: DatabaseService) {}

  @Get('components')
  @ApiOperation({
    operationId: 'getComponentStatus',
    summary: 'Read actual API/DB/worker liveness',
    description:
      'Requires an ordinary MFA staff/teacher session. Worker heartbeat is process liveness, not queue or release readiness.',
  })
  @ApiResponse({ status: 200, type: ComponentStatusResponse })
  async components(
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<ComponentStatusResponse> {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const rows = await this.database.client.$queryRaw<
        {
          now: Date;
          migration: string | null;
          last_seen: Date | null;
          stopped: Date | null;
          live: boolean;
        }[]
      >`SELECT clock_timestamp() AS now, runtime_migration_version() AS migration,
        h.last_seen_at AS last_seen,h.stopped_at AS stopped,
        EXISTS(SELECT 1 FROM runtime_heartbeats WHERE component='worker' AND stopped_at IS NULL
          AND last_seen_at>clock_timestamp()-interval '30 seconds') AS live
        FROM (SELECT 1) singleton LEFT JOIN LATERAL
        (SELECT last_seen_at,stopped_at FROM runtime_heartbeats WHERE component='worker'
          ORDER BY last_seen_at DESC LIMIT 1) h ON true`;
      const row = rows[0]!;
      return {
        api: 'ok',
        db: 'ok',
        worker: row.live ? 'ok' : !row.last_seen ? 'unknown' : row.stopped ? 'stopped' : 'stale',
        workerLastSeenAt: row.last_seen?.toISOString() ?? null,
        migrationVersion: row.migration,
        checkedAt: row.now.toISOString(),
      };
    } catch {
      return {
        api: 'ok',
        db: 'unavailable',
        worker: 'unknown',
        workerLastSeenAt: null,
        migrationVersion: null,
        checkedAt: new Date().toISOString(),
      };
    }
  }
}

@ApiTags('Files')
@ApiCookieAuth('sessionCookie')
@Controller('api/v1/files')
@Authenticated()
@RequireMfa()
export class FileAccessController {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Get(':id/access')
  @ApiOperation({
    operationId: 'checkFileAccess',
    summary: 'Check the current account file grant',
    description:
      'Read-only permission check. Revoked/expired/foreign/unverified objects return 403; no signed S3 URL is issued.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: FileAccessResponse })
  @ApiResponse({ status: 403, description: 'No current file grant' })
  async check(
    @Param('id') id: string,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<FileAccessResponse> {
    res.setHeader('Cache-Control', 'no-store');
    const actor = req.account!;
    const rows = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
      ? await this.database.client.$queryRaw<{ can_download: boolean }[]>`
        SELECT p.can_download FROM file_permissions p JOIN s3_objects o ON o.id=p.s3_object_id
        WHERE o.id=${id}::uuid AND o.status='VERIFIED' AND p.subject_id=${actor.accountId}::uuid
          AND p.subject_type=${actor.kind}::"AccountKind" AND p.revoked_at IS NULL
          AND p.granted_at<=clock_timestamp() AND (p.expires_at IS NULL OR p.expires_at>clock_timestamp()) LIMIT 1`
      : [];
    if (!rows.length) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor,
          action: 'file.access-check',
          code: 'FILE_ACCESS_DENIED',
        }),
      );
      return fail(domainError('FILE_ACCESS_DENIED', 403));
    }
    return { objectId: id, accessible: true, canDownload: rows[0]!.can_download };
  }
}

@Module({ controllers: [QaController, FileAccessController] })
export class QaModule {}

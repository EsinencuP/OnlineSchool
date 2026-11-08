import { Controller, Get, Module, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, Public, RequireRole } from '../../core/rbac/decorators.js';
import { DatabaseService } from '../../core/database/database.module.js';
import type { HttpRequest, HttpResponse } from '../../core/http.js';
import { demoAccounts, demoSwitchAllowed } from '../identity/demo-accounts.js';
import { PlatformAccountsDto, PlatformWorkspaceDto } from './platform.dto.js';

@Controller('api/v1/platform')
@ApiTags('Platform')
export class PlatformController {
  constructor(private readonly db: DatabaseService) {}

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
    const actor = req.account!;
    const director = actor.role === 'DIRECTOR';
    const db = this.db.client;
    const profile = director
      ? await db.staffAccount.findFirstOrThrow({
          where: { account_id: actor.accountId, deactivated_at: null },
        })
      : await db.teacherAccount.findFirstOrThrow({
          where: { account_id: actor.accountId, deactivated_at: null },
        });
    const lessons = await db.lessonOccurrence.findMany({
      where: {
        ...(director ? {} : { scheduled_teacher_id: profile.id }),
        scheduled_at: { gte: new Date(Date.now() - 86400000) },
      },
      orderBy: { scheduled_at: 'asc' },
      take: 100,
      include: {
        enrollment_ref: { include: { student_ref: true, subject_ref: true } },
        scheduled_teacher_ref: true,
      },
    });
    const assignments = await db.teachingAssignment.findMany({
      where: {
        ...(director ? {} : { teacher_id: profile.id }),
        valid_from: { lte: new Date() },
        OR: [{ valid_to: null }, { valid_to: { gt: new Date() } }],
      },
      take: 100,
      include: { enrollment_ref: { include: { student_ref: true, subject_ref: true } } },
    });
    const homework = await db.homeworkAssignment.findMany({
      where: director ? {} : { issued_by: profile.id },
      orderBy: { due_at: 'asc' },
      take: 50,
      include: { subject_ref: true },
    });
    const tasks = director
      ? await db.crmTask.findMany({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          orderBy: { due_at: 'asc' },
          take: 50,
          include: { assigned_to: true },
        })
      : [];
    return {
      name: profile.full_name,
      role: actor.role,
      lessons: lessons.map((l) => ({
        id: l.id,
        startsAt: l.scheduled_at.toISOString(),
        endsAt: l.scheduled_end_at.toISOString(),
        status: l.status,
        subject: l.enrollment_ref.subject_ref.name,
        student:
          l.enrollment_ref.student_ref.display_name ?? l.enrollment_ref.student_ref.full_name,
        teacher: l.scheduled_teacher_ref.full_name,
        meetUrl: l.google_meet_link,
      })),
      students: assignments.map((a) => ({
        id: a.enrollment_ref.student_id,
        name: a.enrollment_ref.student_ref.display_name ?? a.enrollment_ref.student_ref.full_name,
        subject: a.enrollment_ref.subject_ref.name,
      })),
      homework: homework.map((h) => ({
        id: h.id,
        title: h.title,
        subject: h.subject_ref.name,
        dueAt: h.due_at?.toISOString() ?? null,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueAt: t.due_at.toISOString(),
        manager: t.assigned_to?.full_name ?? 'Не назначен',
      })),
    };
  }
}
@Module({ controllers: [PlatformController] })
export class PlatformModule {}

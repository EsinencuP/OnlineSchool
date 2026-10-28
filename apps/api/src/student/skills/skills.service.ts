import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { HistoryPage } from '../history/history.dto.js';
import type {
  SkillAuditQuery,
  SkillAuditResponseDto,
  SkillSelection,
  SkillSnapshotResponseDto,
  SubjectSkillMapDto,
} from './skills.dto.js';
import { skillAuditSql, skillMapSql, skillSnapshotsSql } from './skills.sql.js';

@Injectable()
export class StudentSkillsService {
  constructor(private readonly database: DatabaseService) {}
  private async read<T>(sql: Prisma.Sql): Promise<T> {
    const [row] = await this.database.client.$queryRaw<{ forbidden: boolean; data: T }[]>(sql);
    if (!row) return fail(domainError('SKILLS_UNAVAILABLE', 503));
    if (row.forbidden) return fail(domainError('SKILLS_FORBIDDEN', 403));
    return row.data;
  }
  async maps(student: IStudentContext, query: SkillSelection): Promise<SubjectSkillMapDto[]> {
    const maps = await this.read<SubjectSkillMapDto[]>(
      skillMapSql(student.studentProfileId, query, new Date()),
    );
    for (const map of maps) {
      if (map.lastSnapshotAt) map.lastSnapshotAt = new Date(map.lastSnapshotAt).toISOString();
      for (const skill of map.skills)
        skill.lastUpdatedAt = new Date(skill.lastUpdatedAt).toISOString();
    }
    return maps;
  }
  async audit(student: IStudentContext, query: SkillAuditQuery): Promise<SkillAuditResponseDto> {
    const data = await this.read<Pick<SkillAuditResponseDto, 'items' | 'total'>>(
      skillAuditSql(student.studentProfileId, query, new Date()),
    );
    for (const entry of data.items) entry.changedAt = new Date(entry.changedAt).toISOString();
    return { ...data, page: query.page, pageSize: query.pageSize };
  }
  async snapshots(student: IStudentContext, query: HistoryPage): Promise<SkillSnapshotResponseDto> {
    const data = await this.read<Pick<SkillSnapshotResponseDto, 'items' | 'total'>>(
      skillSnapshotsSql(student.studentProfileId, query, new Date()),
    );
    for (const snapshot of data.items)
      snapshot.createdAt = new Date(snapshot.createdAt).toISOString();
    return { ...data, page: query.page, pageSize: query.pageSize };
  }
}

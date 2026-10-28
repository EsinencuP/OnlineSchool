import { Prisma } from '@online-school/db';
import { Temporal } from '@js-temporal/polyfill';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { StorageModule } from '../../modules/storage/storage.module.js';
import { MeService } from '../me/me.service.js';
import { skillMapSql } from '../skills/skills.sql.js';
import type { SubjectSkillMapDto } from '../skills/skills.dto.js';
import type { EducationalReportDto, ExportSelection } from './reports.dto.js';
import { publishedReportsCte, reportJson } from './reports.sql.js';
export { MeService } from '../me/me.service.js';
export {
  PrivateUploads,
  PDF_READ_TTL_SECONDS,
} from '../../modules/storage/private-uploads.service.js';
export { exportSelection } from './reports.dto.js';
export const PDF_EXPORT_JOB_TYPE = 'student.education-pdf.generate.v1';
export interface EducationPdfData {
  schemaVersion: 1;
  studentName: string;
  asOf: string;
  timeZone: string;
  periodFrom: string;
  periodTo: string;
  skills: SubjectSkillMapDto[];
  reports: EducationalReportDto[];
  lessons: {
    lessonId: string;
    date: string;
    subjectName: string;
    teacherName: string;
    status: string;
  }[];
}
export function calendarDate(value: string, zone = 'Europe/Chisinau'): string {
  return Temporal.Instant.from(value).toZonedDateTimeISO(zone).toPlainDate().toString();
}
export function normalizeReport(report: EducationalReportDto, zone?: string): EducationalReportDto {
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    reportId: report.reportId,
    subjectName: report.subjectName,
    createdAt: new Date(report.createdAt).toISOString(),
    periodFrom: calendarDate(report.periodFrom, zone),
    periodTo: calendarDate(report.periodTo, zone),
    lessonCount: report.lessonCount,
    teacherName: report.teacherName,
    isNew: report.isNew,
    content: {
      achievements: text(report.content.achievements),
      growthAreas: text(report.content.growthAreas),
      recommendations: text(report.content.recommendations),
      teacherSignature: text(report.content.teacherSignature),
    },
  };
}
export function selectionBounds(selection: ExportSelection, zone: string) {
  const instant = (date: string) =>
    new Date(
      Number(
        Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: zone, plainTime: '00:00' })
          .epochMilliseconds,
      ),
    );
  return {
    from: selection.periodFrom ? instant(selection.periodFrom) : null,
    until: selection.periodTo
      ? instant(Temporal.PlainDate.from(selection.periodTo).add({ days: 1 }).toString())
      : null,
  };
}
export function educationPdfDataSql(
  studentId: string,
  selection: ExportSelection,
  time: Date,
  zone: string,
): Prisma.Sql {
  const { from, until } = selectionBounds(selection, zone);
  return Prisma.sql`${publishedReportsCte(studentId, time)}, maps AS (${skillMapSql(studentId, selection, time)}),
    reports AS (SELECT r.* FROM published_reports r WHERE true
      ${selection.subjectId ? Prisma.sql`AND r.subject_id=${selection.subjectId}::uuid` : Prisma.empty}
      ${from ? Prisma.sql`AND r.period_end>=${from}` : Prisma.empty}
      ${until ? Prisma.sql`AND r.period_start<${until}` : Prisma.empty}),
    lessons AS (
      SELECT l.id,coalesce(o.actual_started_at,l.scheduled_at) AS lesson_at,s.name AS subject_name,
        coalesce(actual.full_name,scheduled.full_name) AS teacher_name,
        CASE WHEN l.status='CONDUCTED' AND o.confirmed_at<=${time} THEN 'COMPLETED'
        WHEN l.status='CANCELLED' AND lr.result='NOT_CONDUCTED' AND lr.student_no_show THEN 'NO_SHOW'
        WHEN l.status='CANCELLED' THEN 'CANCELLED' WHEN l.status='DISPUTED' THEN 'DISPUTED'
        ELSE 'NOT_CONFIRMED' END AS status
      FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
      JOIN subjects s ON s.id=e.subject_id JOIN teacher_accounts scheduled ON scheduled.id=l.scheduled_teacher_id
      LEFT JOIN lesson_actual_outcomes o ON o.lesson_occurrence_id=l.id AND o.confirmed_at<=${time}
      LEFT JOIN lesson_outcome_reports lr ON lr.id=l.confirmed_report_id AND lr.lesson_occurrence_id=l.id AND lr.reported_at<=${time}
      LEFT JOIN teacher_accounts actual ON actual.id=o.actual_teacher_id
      WHERE e.student_id=${studentId}::uuid AND coalesce(o.actual_started_at,l.scheduled_at)<=${time}
      ${selection.subjectId ? Prisma.sql`AND e.subject_id=${selection.subjectId}::uuid` : Prisma.empty}
      ${from ? Prisma.sql`AND coalesce(o.actual_started_at,l.scheduled_at)>=${from}` : Prisma.empty}
      ${until ? Prisma.sql`AND coalesce(o.actual_started_at,l.scheduled_at)<${until}` : Prisma.empty}
    ) SELECT (SELECT forbidden FROM maps) AS forbidden,(SELECT data FROM maps) AS skills,
      coalesce((SELECT jsonb_agg(${reportJson} ORDER BY r.created_at DESC,r.id DESC) FROM reports r),'[]'::jsonb) AS reports,
      coalesce((SELECT jsonb_agg(jsonb_build_object('lessonId',id,'date',lesson_at,'subjectName',subject_name,
        'teacherName',teacher_name,'status',status) ORDER BY lesson_at,id) FROM lessons),'[]'::jsonb) AS lessons`;
}
@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [MeService],
  exports: [MeService, StorageModule],
})
export class EducationExportSupportModule {}

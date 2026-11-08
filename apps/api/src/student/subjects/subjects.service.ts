import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import { StudentErrors } from '../student-context.interface.js';
import type { IStudentContext } from '../student-context.interface.js';
import type {
  StudentSubjectDto,
  StudentSubjectSubscriptionDto,
  StudentSubjectsResponseDto,
  StudentTemporaryAdmissionDto,
} from './subjects.dto.js';
import { studentSubjectsSql } from './subjects.sql.js';

type SubjectFact = {
  subjectId: string;
  subjectName: string;
  enrollmentId: string;
  enrollmentStatus: 'ACTIVE' | 'PAUSED' | 'ENDED';
  subscriptionId: string | null;
  managerSubscriptionId: string | null;
  validUntil: string | null;
  frozenUntil: string | null;
  periodCurrent: boolean | null;
  frozen: boolean | null;
  fullyPaid: boolean | null;
  grantBalance: number | null;
  admission: StudentTemporaryAdmissionDto | null;
  homework: boolean;
  materials: boolean;
  lessons: boolean;
};

type Display = Pick<StudentSubjectSubscriptionDto, 'displayStatus' | 'reasonCode' | 'liveAccess'>;

function periodDisplay(fact: SubjectFact, paidRemaining: number | null): Display {
  if (fact.enrollmentStatus === 'ENDED')
    return { displayStatus: 'EXPIRED', reasonCode: 'ENROLLMENT_ENDED', liveAccess: false };
  if (!fact.periodCurrent)
    return { displayStatus: 'EXPIRED', reasonCode: 'PERIOD_EXPIRED', liveAccess: false };
  if (fact.frozen) return { displayStatus: 'FROZEN', reasonCode: 'FROZEN', liveAccess: false };
  if (fact.enrollmentStatus === 'PAUSED')
    return { displayStatus: 'LIMITED', reasonCode: 'ENROLLMENT_PAUSED', liveAccess: false };
  if (fact.fullyPaid && paidRemaining !== null && paidRemaining > 0)
    return { displayStatus: 'ACTIVE', reasonCode: 'PAID_RIGHTS', liveAccess: true };
  if (fact.fullyPaid === false && fact.admission)
    return { displayStatus: 'LIMITED', reasonCode: 'TEMPORARY_ADMISSION', liveAccess: true };
  const reasonCode =
    fact.fullyPaid === false
      ? 'PAYMENT_OR_ADMISSION_REQUIRED'
      : fact.fullyPaid === null || paidRemaining === null
        ? 'RIGHTS_UNKNOWN'
        : 'NO_PAID_RIGHTS';
  return { displayStatus: 'LIMITED', reasonCode, liveAccess: false };
}

const displayOrder = (view: Display) => {
  if (view.displayStatus === 'ACTIVE') return 0;
  if (view.liveAccess) return 1;
  if (view.displayStatus === 'FROZEN') return 2;
  return view.displayStatus === 'LIMITED' ? 3 : 4;
};

function projectSubjects(rows: SubjectFact[]): StudentSubjectDto[] {
  const bySubject = new Map<string, SubjectFact[]>();
  for (const row of rows) {
    const group = bySubject.get(row.subjectId);
    if (group) group.push(row);
    else bySubject.set(row.subjectId, [row]);
  }
  return [...bySubject].map(([subjectId, facts]) => {
    const byPlan = new Map<string, StudentSubjectSubscriptionDto[]>();
    for (const fact of facts) {
      if (!fact.subscriptionId) continue;
      let paidLessonsRemaining = fact.grantBalance;
      if (paidLessonsRemaining === null && fact.periodCurrent && fact.fullyPaid === false)
        paidLessonsRemaining = 0;
      if (paidLessonsRemaining !== null && paidLessonsRemaining < 0) paidLessonsRemaining = null;
      const plan = {
        subscriptionId: fact.subscriptionId,
        managerSubscriptionId: fact.managerSubscriptionId,
        enrollmentId: fact.enrollmentId,
        validUntil: fact.validUntil ? new Date(fact.validUntil).toISOString() : null,
        frozenUntil:
          fact.frozen && fact.frozenUntil ? new Date(fact.frozenUntil).toISOString() : null,
        paidLessonsRemaining,
        temporaryAdmission: fact.admission && {
          maxLessons: fact.admission.maxLessons,
          lessonsRemaining: fact.admission.lessonsRemaining,
          validUntil: new Date(fact.admission.validUntil).toISOString(),
        },
        ...periodDisplay(fact, paidLessonsRemaining),
      };
      const key = fact.managerSubscriptionId
        ? `manager:${fact.managerSubscriptionId}`
        : `period:${fact.subscriptionId}`;
      const periods = byPlan.get(key);
      if (periods) periods.push(plan);
      else byPlan.set(key, [plan]);
    }
    const compare = (a: Display, b: Display) => displayOrder(a) - displayOrder(b);
    const subscriptions = [...byPlan.values()]
      .map((periods) => {
        const [anchor] = periods.sort(compare);
        const quantities = periods.map((period) => period.paidLessonsRemaining);
        return {
          ...anchor!,
          paidLessonsRemaining: quantities.every((quantity) => quantity !== null)
            ? quantities.reduce((total, quantity) => total + quantity, 0)
            : null,
        };
      })
      .sort(compare);
    const preferred = subscriptions[0];
    const liveAccess = preferred?.liveAccess ?? false;
    return {
      subjectId,
      subjectName: facts[0]!.subjectName,
      enrollmentIds: [...new Set(facts.map((fact) => fact.enrollmentId))],
      displayStatus: preferred?.displayStatus ?? 'NONE',
      reasonCode: preferred?.reasonCode ?? 'NO_SUBSCRIPTION',
      liveAccess,
      subscriptions,
      capabilities: {
        canViewHomework: facts.some((fact) => fact.homework),
        canViewMaterials: facts.some((fact) => fact.materials),
        canOpenSubscription: subscriptions.length > 0,
        canOpenLessons: liveAccess || facts.some((fact) => fact.lessons),
      },
    };
  });
}

@Injectable()
export class StudentSubjectsService {
  constructor(private readonly database: DatabaseService) {}

  async list(student: IStudentContext): Promise<StudentSubjectsResponseDto> {
    try {
      const [snapshot] = await this.database.client.$queryRaw<
        {
          generatedAt: Date;
          mustChangePassword: boolean | null;
          rows: SubjectFact[];
        }[]
      >(studentSubjectsSql(student));
      if (!snapshot || !Array.isArray(snapshot.rows))
        return fail(domainError('SUBSCRIPTION_UNAVAILABLE', 503));
      if (snapshot.mustChangePassword === null)
        return fail(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
      if (snapshot.mustChangePassword)
        return fail(domainError(StudentErrors.MUST_CHANGE_PASSWORD, 403));
      return {
        generatedAt: snapshot.generatedAt.toISOString(),
        items: projectSubjects(snapshot.rows),
      };
    } catch (error) {
      return fail(
        error instanceof AppException ? error.domain : domainError('SUBSCRIPTION_UNAVAILABLE', 503),
      );
    }
  }
}

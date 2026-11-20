import type { IconName } from '@online-school/ui';
import type { Role } from './contract.js';
import { actionTitle } from './actionCopy.js';

export type Section = {
  id: string;
  title: string;
  icon: IconName;
  reads: string[];
  commands: string[];
};

function section(
  id: string,
  title: string,
  icon: IconName,
  reads: string[],
  commands: string[] = [],
): Section {
  return { id, title, icon, reads, commands };
}

export const sections: Record<Role, Section[]> = {
  STUDENT: [
    section('home', 'Обзор', 'home', ['getStudentDashboard']),
    section('lessons', 'Расписание', 'calendar', [
      'getStudentLessons',
      'getStudentUpcomingLessons',
      'getStudentLessonHistory',
    ]),
    section(
      'homework',
      'Домашние задания',
      'tasks',
      ['getStudentHomework', 'getStudentHomeworkDetail'],
      ['saveStudentHomeworkDraft', 'submitStudentHomework'],
    ),
    section('subjects', 'Мои предметы', 'brand', [
      'getStudentSubjects',
      'getStudentSkillMaps',
      'getStudentSkillSnapshots',
      'getStudentSkillAudit',
    ]),
    section('materials', 'Материалы', 'materials', [
      'getStudentMaterials',
      'getStudentMaterialUrl',
    ]),
    section('reports', 'Отчёты', 'skills', []),
    section('subscription', 'Абонемент', 'wallet', []),
    section('notifications', 'Уведомления', 'bell', []),
    section('profile', 'Профиль', 'profile', []),
    section('help', 'Помощь', 'manager', []),
    section('security', 'Безопасность', 'health', []),
  ],
  TEACHER: [
    section('home', 'Обзор', 'home', ['getTeacherToday']),
    section(
      'lessons',
      'Расписание',
      'calendar',
      ['getTeacherToday', 'getTeacherAvailability', 'getTeacherScheduleRequests'],
      ['manageTeacherAvailability', 'requestScheduleChange'],
    ),
    section(
      'students',
      'Ученики',
      'users',
      [
        'getTeacherEnrollments',
        'getTeacherStudentOverview',
        'getTeacherGoals',
        'getTeacherSkillMap',
        'getTeacherSkillHistory',
      ],
      ['createTeacherGoal', 'updateTeacherGoal', 'assessTeacherSkill'],
    ),
    section(
      'homework',
      'Домашние задания',
      'tasks',
      ['getTeacherHomework', 'getTeacherHomeworkCard'],
      ['issueTeacherHomework', 'reviewTeacherHomework'],
    ),
    section(
      'reports',
      'Журнал и отчёты',
      'skills',
      ['getTeacherJournal', 'getTeacherCheckpoints', 'getTeacherCheckpoint'],
      ['completeTeacherCheckpoint', 'saveTeacherReportDraft', 'publishTeacherReport'],
    ),
    section(
      'materials',
      'Материалы',
      'materials',
      ['getTeacherMaterials', 'getTeacherSharedMaterials', 'checkFileAccess'],
      ['shareTeacherMaterial', 'revokeTeacherMaterial'],
    ),
    section(
      'meet',
      'Google Meet',
      'video',
      ['getTeacherMeetConnection', 'getTeacherMeetPair'],
      [
        'disconnectTeacherMeetOAuth',
        'createTeacherMeetSpace',
        'reconcileTeacherMeetSpace',
        'verifyTeacherMeetSpace',
      ],
    ),
    section('payroll', 'Начисления', 'wallet', ['getTeacherPayrollStatement', 'getTeacherPayroll']),
    section(
      'notifications',
      'Уведомления',
      'bell',
      ['getTeacherNotifications', 'getTeacherNotificationSummary'],
      ['markTeacherNotificationsRead', 'markAllTeacherNotificationsRead'],
    ),
    section(
      'profile',
      'Профиль',
      'profile',
      ['getTeacherProfile', 'getTeacherMe'],
      ['updateTeacherProfile'],
    ),
  ],
  MANAGER: [
    section('home', 'Обзор', 'home', ['getManagerDashboard']),
    section(
      'students',
      'Ученики',
      'users',
      ['listManagerStudents', 'getManagerStudentCard', 'getManagerOptions'],
      [
        'createManagerStudent',
        'updateManagerStudentContacts',
        'createManagerStudentAccount',
        'resetManagerStudentPassword',
        'createStudent',
        'createEnrollment',
        'createHousehold',
        'addHouseholdMember',
        'createSubject',
      ],
    ),
    section(
      'leads',
      'Заявки',
      'leads',
      [
        'listManagerLeads',
        'getManagerLead',
        'getManagerLeadSummary',
        'listManagerLeadTeacherCandidates',
      ],
      [
        'createManagerLead',
        'updateManagerLead',
        'claimManagerLead',
        'transitionManagerLead',
        'loseManagerLead',
        'reopenManagerLead',
        'scheduleManagerTrial',
      ],
    ),
    section(
      'schedule',
      'Расписание',
      'calendar',
      ['listManagerSchedule', 'getScheduleChangeApproval'],
      [
        'createManagerLesson',
        'rescheduleManagerLesson',
        'cancelManagerLesson',
        'setManagerLessonMeetLink',
        'clearManagerLessonMeetLink',
        'confirmLessonOutcome',
        'createRecurringSlot',
        'changeRecurringSlot',
        'generateSlotOccurrences',
        'createLesson',
        'cancelLesson',
        'rescheduleLesson',
      ],
    ),
    section(
      'tasks',
      'Задачи',
      'tasks',
      ['listManagerTasks', 'getManagerTask'],
      [
        'claimManagerTask',
        'resolveManagerTaskGeneral',
        'resolveManagerTaskReschedule',
        'resolveManagerTaskDispute',
      ],
    ),
    section('payments', 'Оплаты', 'wallet', []),
    section(
      'subscriptions',
      'Абонементы',
      'brand',
      ['listManagerSubscriptions'],
      [
        'createManagerSubscription',
        'renewManagerSubscription',
        'freezeManagerSubscription',
        'unfreezeManagerSubscription',
        'consumeEntitlement',
        'createSubscription',
      ],
    ),
    section(
      'teachers',
      'Преподаватели',
      'users',
      ['listManagerTeachers', 'getManagerTeacherAvailability'],
      [
        'assignManagerTeacher',
        'revokeManagerTeacher',
        'createTeachingAssignment',
        'revokeTeachingAssignment',
      ],
    ),
    section(
      'requests',
      'Запросы руководителю',
      'materials',
      ['listManagerRequests', 'getManagerRefund'],
      [
        'createManagerRequest',
        'withdrawManagerRequest',
        'prepareManagerRefund',
        'reportManagerRefundTransfer',
      ],
    ),
    section(
      'contacts',
      'Журнал контактов',
      'manager',
      ['listManagerContacts', 'listManagerPendingContacts', 'listManagerStudentNotifications'],
      ['recordManagerContact', 'sendManagerStudentNotification'],
    ),
    section(
      'profile',
      'Мой профиль',
      'profile',
      ['getManagerMe', 'getManagerAvailability'],
      ['setManagerAvailability'],
    ),
  ],
  DIRECTOR: [
    section('home', 'Обзор', 'home', ['getDirectorDecisionSummary']),
    section(
      'decisions',
      'Решения',
      'tasks',
      [
        'getDirectorDecisions',
        'getDirectorDecision',
        'getDirectorLessonOutcomeDispute',
        'getCrmDisputeResolution',
      ],
      [
        'directorApproveDistribution',
        'directorApproveScheduleException',
        'directorApproveDispute',
        'directorApproveRequest',
        'directorDeclineRequest',
        'resolveDirectorLessonOutcomeDispute',
        'approveCrmDisputeResolution',
        'approveDistribution',
      ],
    ),
    section(
      'escalations',
      'Эскалации',
      'warning',
      ['listDirectorEscalations', 'getDirectorEscalation'],
      ['acceptDirectorEscalation'],
    ),
    section(
      'staff',
      'Команда',
      'users',
      [
        'listDirectorStaff',
        'getDirectorStaffCard',
        'listDirectorManagerAvailability',
        'listDirectorHandovers',
      ],
      [
        'deactivateDirectorStaff',
        'reactivateDirectorStaff',
        'reassignStudentManager',
        'reassignLeadManager',
      ],
    ),
    section(
      'finance',
      'Финансы',
      'wallet',
      [
        'getDirectorPayrollSummary',
        'getDirectorPayrollTeacher',
        'getDirectorUnresolvedFinance',
        'listDirectorPeriods',
        'getDirectorPeriodDisputes',
        'listFinancialPeriods',
      ],
      [
        'createDirectorPeriod',
        'closeDirectorPeriod',
        'closeFinancialPeriod',
        'createTeacherAccrual',
        'createPayoutAttempt',
        'confirmPayout',
        'reconcilePayout',
        'publishLedgerEntry',
        'correctLedgerEntry',
        'adjustEntitlement',
        'grantEntitlement',
        'grantTemporaryAccess',
      ],
    ),
    section(
      'refunds',
      'Возвраты и корректировки',
      'materials',
      [
        'listDirectorRefundCases',
        'getDirectorRefund',
        'listDirectorAllocationCorrections',
        'getAllocationCorrection',
      ],
      ['decideDirectorRefund', 'reviewDirectorRefundTransfer', 'reviewAllocationCorrection'],
    ),
    section(
      'plans',
      'Условия продажи',
      'brand',
      ['listDirectorSaleConditions'],
      ['publishDirectorSaleCondition', 'retireDirectorSaleCondition'],
    ),
    section(
      'meet',
      'Google Meet',
      'video',
      ['getDirectorMeetInventory'],
      ['closeDirectorUnknownMeetCreation', 'retireDirectorMeetSpace'],
    ),
    section(
      'schedule',
      'Расписание',
      'calendar',
      ['getPlatformWorkspace', 'getPlatformWorkspaceDetail'],
      ['confirmLessonOutcome', 'approveScheduleChange'],
    ),
    section('profile', 'Мой профиль', 'profile', ['getDirectorMe']),
  ],
  TECH_OPERATOR: [
    section('home', 'Обзор', 'home', ['getComponentStatus']),
    section('health', 'Состояние сервисов', 'health', [
      'getComponentStatus',
      'getApiHealth',
      'getWorkerHealth',
      'getHealth',
    ]),
    section('queues', 'Очереди', 'tasks', ['getQueueHealth'], ['replayAuditOutboxEvent']),
    section('profile', 'Сессия', 'profile', ['getStaffActorContext']),
  ],
};

export const sectionAliases: Record<string, string> = {
  calendar: 'lessons',
  skills: 'subjects',
  dashboard: 'home',
  settings: 'profile',
  schedule: 'schedule',
  journal: 'reports',
  payroll: 'finance',
  team: 'staff',
};
export const profileOperation: Record<Role, string | null> = {
  STUDENT: 'getStudentMe',
  TEACHER: 'getTeacherMe',
  MANAGER: 'getManagerMe',
  DIRECTOR: 'getDirectorMe',
  TECH_OPERATOR: 'getStaffActorContext',
};

export function friendly(value: string) {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
export function operationName(id: string) {
  return actionTitle(id);
}

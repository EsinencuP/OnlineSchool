import type { Details } from './contract.js';

export const managerPaymentsLink = (studentId: string) =>
  '/manager/students/' + encodeURIComponent(studentId) + '/payments';

export const teacherStudentsPath = '/teacher/students';
export const teacherReportsPath = '/teacher/reports';

export const homeworkPath = '/teacher/homework';

export const teacherHomeworkNavigation = {
  ru: { title: 'Домашние задания', newTitle: 'Новое задание', issue: 'Выдать задание' },
  ro: { title: 'Teme pentru acasă', newTitle: 'Temă nouă', issue: 'Atribuie tema' },
};

export function issueHomeworkUrl(lessonId?: string) {
  return homeworkPath + '/new' + (lessonId ? '?' + new URLSearchParams({ lessonId }) : '');
}

const records = [
  {
    path: '/student/lessons',
    lists: ['getStudentLessons', 'getStudentUpcomingLessons', 'getStudentLessonHistory'],
    read: 'getStudentLesson',
    keys: ['lessonId'],
  },
  {
    path: '/student/homework',
    lists: ['getStudentHomework'],
    read: 'getStudentHomeworkDetail',
    keys: ['homeworkId'],
    params: ['hwId'],
  },
  {
    path: '/student/reports',
    lists: ['getStudentReports'],
    read: 'getStudentReport',
    keys: ['reportId'],
  },
  {
    path: '/teacher/lessons',
    lists: ['getTeacherToday'],
    read: 'getTeacherLesson',
    keys: ['lessonId'],
    params: ['id'],
  },
  {
    path: teacherStudentsPath,
    lists: ['getTeacherEnrollments'],
    read: 'getTeacherStudentOverview',
    keys: ['enrollmentId'],
  },
  {
    path: homeworkPath,
    lists: ['getTeacherHomework'],
    read: 'getTeacherHomeworkCard',
    keys: ['deliveryId'],
  },
  {
    path: teacherReportsPath,
    lists: ['getTeacherCheckpoints'],
    read: 'getTeacherCheckpoint',
    keys: ['checkpointId'],
  },
  {
    path: '/manager/students',
    lists: ['listManagerStudents'],
    read: 'getManagerStudentCard',
    keys: ['studentId'],
  },
  { path: '/manager/leads', lists: ['listManagerLeads'], read: 'getManagerLead', keys: ['leadId'] },
  { path: '/manager/tasks', lists: ['listManagerTasks'], read: 'getManagerTask', keys: ['taskId'] },
  {
    path: '/manager/payments',
    lists: ['listManagerPayments'],
    read: 'getManagerPayment',
    keys: ['id'],
    params: ['paymentId'],
  },
  {
    path: '/director/decisions',
    lists: ['getDirectorDecisions'],
    read: 'getDirectorDecision',
    keys: ['kind', 'id'],
  },
  {
    path: '/director/escalations',
    lists: ['listDirectorEscalations'],
    read: 'getDirectorEscalation',
    keys: ['escalationId'],
    params: ['id'],
  },
  {
    path: '/director/staff',
    lists: ['listDirectorStaff'],
    read: 'getDirectorStaffCard',
    keys: ['kind', 'id'],
  },
  {
    path: '/director/refunds',
    lists: ['listDirectorRefundCases'],
    read: 'getDirectorRefund',
    keys: ['requestId'],
  },
];

export function recordUrl(operation: string, row: Details) {
  const page = records.find(({ lists }) => lists.includes(operation));
  if (!page) return null;
  const values = page.keys.map((key) => row[key]);
  if (!values.every((value): value is string => typeof value === 'string' && value.length > 0)) {
    return null;
  }
  return page.path + '/' + values.map(encodeURIComponent).join('/');
}

export type RecordPage = { operation: string; params: Record<string, string> };

export function recordPage(path: string, first?: string, second?: string): RecordPage | undefined {
  const page = records.find((entry) => entry.path === path);
  if (!page || !first || (page.keys.length > 1 && !second)) return undefined;
  const segments = [first, second];
  try {
    const params = Object.fromEntries(
      (page.params ?? page.keys).map((key, index) => [key, decodeURIComponent(segments[index]!)]),
    );
    return { operation: page.read, params };
  } catch {
    return undefined;
  }
}

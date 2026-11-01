export const MANAGER_ROUTES = {
  dashboard: '/manager',
  students: '/manager/students',
  student: (id: string) => `/manager/students/${encodeURIComponent(id)}`,
  studentAccount: (id: string) => `/manager/students/${encodeURIComponent(id)}/account`,
  schedule: '/manager/schedule',
  tasks: '/manager/tasks',
  task: (id: string) => `/manager/tasks/${encodeURIComponent(id)}`,
  login: '/manager/login',
} as const;

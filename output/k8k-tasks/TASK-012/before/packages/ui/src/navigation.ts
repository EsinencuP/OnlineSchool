export type CabinetRole = 'STUDENT' | 'MANAGER' | 'TEACHER' | 'DIRECTOR' | 'TECH_OPERATOR';
export interface NavigationItem {
  id: string;
  label: string;
  shortLabel?: string;
  href?: string;
  icon:
    | 'home'
    | 'calendar'
    | 'tasks'
    | 'skills'
    | 'materials'
    | 'wallet'
    | 'profile'
    | 'users'
    | 'leads'
    | 'health';
}
// Only existing entry points. No inferred permissions or invented staff routes.
export const roleNavigation: Record<CabinetRole, readonly NavigationItem[]> = {
  STUDENT: [
    { id: 'home', href: '/student', label: 'Главная', icon: 'home' },
    { id: 'lessons', href: '/student/lessons', label: 'Уроки', icon: 'calendar' },
    {
      id: 'homework',
      href: '/student/homework',
      label: 'Домашние задания',
      shortLabel: 'Задания',
      icon: 'tasks',
    },
    {
      id: 'skills',
      href: '/student/skills',
      label: 'Мой путь знаний',
      shortLabel: 'Мой путь',
      icon: 'skills',
    },
    { id: 'materials', href: '/student/materials', label: 'Материалы', icon: 'materials' },
    { id: 'subscription', href: '/student/subscription', label: 'Абонемент', icon: 'wallet' },
    { id: 'profile', href: '/student/profile', label: 'Профиль и настройки', icon: 'profile' },
  ],
  MANAGER: [
    { id: 'home', href: '/manager', label: 'Обзор', icon: 'home' },
    { id: 'leads', href: '/manager/leads', label: 'Заявки', icon: 'leads' },
    { id: 'students', href: '/manager/students', label: 'Ученики', icon: 'users' },
    { id: 'schedule', href: '/manager/schedule', label: 'Расписание', icon: 'calendar' },
    { id: 'tasks', href: '/manager/tasks', label: 'Задачи', icon: 'tasks' },
  ],
  TEACHER: [
    { id: 'overview', label: 'Обзор', icon: 'home' },
    { id: 'lessons', label: 'Расписание', icon: 'calendar' },
    { id: 'students', label: 'Мои ученики', icon: 'users' },
    { id: 'homework', label: 'Домашние задания', shortLabel: 'Задания', icon: 'tasks' },
  ],
  DIRECTOR: [
    { id: 'overview', label: 'Обзор', icon: 'home' },
    { id: 'lessons', label: 'Расписание', icon: 'calendar' },
    { id: 'students', label: 'Ученики школы', shortLabel: 'Ученики', icon: 'users' },
    { id: 'tasks', label: 'Задачи менеджеров', shortLabel: 'Задачи', icon: 'tasks' },
  ],
  TECH_OPERATOR: [{ id: 'overview', label: 'Состояние платформы', icon: 'health' }],
};
export const cabinetLabels: Record<CabinetRole, string> = {
  STUDENT: 'Кабинет ученика',
  MANAGER: 'Кабинет менеджера',
  TEACHER: 'Кабинет преподавателя',
  DIRECTOR: 'Кабинет руководителя',
  TECH_OPERATOR: 'Технический кабинет',
};
export function activeNavigation(items: readonly NavigationItem[], pathname: string): string {
  return (
    [...items]
      .reverse()
      .find((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
      ?.id ??
    items[0]?.id ??
    ''
  );
}

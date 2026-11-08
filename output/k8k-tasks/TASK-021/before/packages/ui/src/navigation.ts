import type { PlainMessageKey } from './messages.js';

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
type LocalizedNavigationItem = NavigationItem & {
  labelKey: PlainMessageKey;
  compactLabelKey?: PlainMessageKey;
};

// Only existing entry points. No inferred permissions or invented staff routes.
export const roleNavigation: Record<CabinetRole, readonly LocalizedNavigationItem[]> = {
  STUDENT: [
    { id: 'home', href: '/student', label: 'Главная', labelKey: 'home', icon: 'home' },
    {
      id: 'lessons',
      href: '/student/lessons',
      label: 'Уроки',
      labelKey: 'lessonsShort',
      icon: 'calendar',
    },
    {
      id: 'homework',
      href: '/student/homework',
      label: 'Домашние задания',
      labelKey: 'nav.homework',
      shortLabel: 'Задания',
      compactLabelKey: 'homework',
      icon: 'tasks',
    },
    {
      id: 'skills',
      href: '/student/skills',
      label: 'Мой путь знаний',
      labelKey: 'skills',
      shortLabel: 'Мой путь',
      compactLabelKey: 'skillsShort',
      icon: 'skills',
    },
    {
      id: 'materials',
      href: '/student/materials',
      label: 'Материалы',
      labelKey: 'materials',
      icon: 'materials',
    },
    {
      id: 'subscription',
      href: '/student/subscription',
      label: 'Абонемент',
      labelKey: 'subscription',
      icon: 'wallet',
    },
    {
      id: 'profile',
      href: '/student/profile',
      label: 'Профиль и настройки',
      labelKey: 'profile',
      icon: 'profile',
    },
  ],
  MANAGER: [
    { id: 'home', href: '/manager', label: 'Обзор', labelKey: 'overview', icon: 'home' },
    { id: 'leads', href: '/manager/leads', label: 'Заявки', labelKey: 'leads', icon: 'leads' },
    {
      id: 'students',
      href: '/manager/students',
      label: 'Ученики',
      labelKey: 'students',
      icon: 'users',
    },
    {
      id: 'schedule',
      href: '/manager/schedule',
      label: 'Расписание',
      labelKey: 'schedule',
      icon: 'calendar',
    },
    { id: 'tasks', href: '/manager/tasks', label: 'Задачи', labelKey: 'tasks', icon: 'tasks' },
  ],
  TEACHER: [
    { id: 'overview', label: 'Обзор', labelKey: 'overview', icon: 'home' },
    { id: 'lessons', label: 'Расписание', labelKey: 'lessons', icon: 'calendar' },
    { id: 'students', label: 'Мои ученики', labelKey: 'nav.teacherStudents', icon: 'users' },
    {
      id: 'homework',
      label: 'Домашние задания',
      labelKey: 'nav.homework',
      shortLabel: 'Задания',
      compactLabelKey: 'homework',
      icon: 'tasks',
    },
  ],
  DIRECTOR: [
    { id: 'overview', label: 'Обзор', labelKey: 'overview', icon: 'home' },
    { id: 'lessons', label: 'Расписание', labelKey: 'lessons', icon: 'calendar' },
    {
      id: 'students',
      label: 'Ученики школы',
      labelKey: 'nav.schoolStudents',
      shortLabel: 'Ученики',
      compactLabelKey: 'students',
      icon: 'users',
    },
    {
      id: 'tasks',
      label: 'Задачи менеджеров',
      labelKey: 'nav.managerTasks',
      shortLabel: 'Задачи',
      compactLabelKey: 'tasks',
      icon: 'tasks',
    },
  ],
  TECH_OPERATOR: [
    {
      id: 'overview',
      label: 'Состояние платформы',
      labelKey: 'health',
      compactLabelKey: 'nav.shortHealth',
      icon: 'health',
    },
  ],
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

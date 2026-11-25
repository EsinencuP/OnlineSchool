import type { Tone } from '../shared/ui';
import type { HomeworkStatus, LessonHistoryItem, LessonStatus, NotificationItem, SkillStatus } from './types';

export const homeworkStatus: Record<HomeworkStatus, { label: string; tone: Tone }> = {
  NOT_SUBMITTED: { label: 'Нужно сдать', tone: 'blue' },
  SUBMITTED: { label: 'На проверке', tone: 'yellow' },
  NEEDS_REVISION: { label: 'Доработать', tone: 'coral' },
  REVIEWED: { label: 'Проверено', tone: 'teal' },
};

export const lessonStatus: Record<LessonStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Запланирован', tone: 'blue' },
  COMPLETED: { label: 'Проведён', tone: 'teal' },
  CANCELLED: { label: 'Отменён', tone: 'neutral' },
  NO_SHOW: { label: 'Пропуск', tone: 'coral' },
  STAR_PENDING: { label: 'Ждёт продления', tone: 'yellow' },
  DISPUTED: { label: 'Оспаривается', tone: 'violet' },
};

export const attendance: Record<LessonHistoryItem['attendanceStatus'], { label: string; tone: Tone }> = {
  COMPLETED: { label: 'Проведён', tone: 'teal' },
  NO_SHOW: { label: 'Не подключился', tone: 'coral' },
  CANCELLED: { label: 'Отменён', tone: 'neutral' },
};

/** Rule 9.1: three learning stages plus the technical "not studied yet". */
export const SKILL_STAGES: SkillStatus[] = ['FAMILIARIZING', 'PRACTICING', 'APPLYING'];
export const skillStatus: Record<SkillStatus, { label: string; tone: Tone; color: string }> = {
  NOT_STUDIED: { label: 'Ещё не изучали', tone: 'neutral', color: 'var(--surface-3)' },
  FAMILIARIZING: { label: 'Знакомлюсь', tone: 'blue', color: 'var(--blue)' },
  PRACTICING: { label: 'Практикую', tone: 'yellow', color: 'var(--yellow)' },
  APPLYING: { label: 'Применяю', tone: 'teal', color: 'var(--teal)' },
};

export const notificationTone = (t: NotificationItem['type']): Tone =>
  t.startsWith('HOMEWORK_NEEDS') || t === 'SUBSCRIPTION_EXPIRING' || t === 'SUBSCRIPTION_EXPIRED'
    ? 'coral'
    : t.startsWith('SUBSCRIPTION') || t === 'PAYMENT_CONFIRMED'
      ? 'violet'
      : t.startsWith('LESSON') || t === 'RESCHEDULE_DECLINED'
        ? 'blue'
        : 'teal';

export { SUBJECT_ICON, SUBJECT_TONE } from '../shared/subjects';

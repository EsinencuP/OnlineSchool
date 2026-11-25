import type {
  LeadLostReason,
  LeadSource,
  LeadStage,
  LessonStatus,
  PaymentStatus,
  StudentStatus,
  TaskStatus,
  TaskType,
} from './types';

import type { Tone } from '../shared/ui';
export type { Tone };

export const LEAD_STAGES: LeadStage[] = [
  'NEW',
  'IN_PROGRESS',
  'TRIAL',
  'AWAITING_PAYMENT',
  'CONVERTED',
  'LOST',
];

export const leadStage: Record<LeadStage, { label: string; tone: Tone }> = {
  NEW: { label: 'Новая', tone: 'blue' },
  IN_PROGRESS: { label: 'В работе', tone: 'violet' },
  TRIAL: { label: 'Пробный урок', tone: 'yellow' },
  AWAITING_PAYMENT: { label: 'Ждём оплату', tone: 'coral' },
  CONVERTED: { label: 'Ученик', tone: 'teal' },
  LOST: { label: 'Закрыта', tone: 'neutral' },
};

export const leadSource: Record<LeadSource, string> = {
  SITE: 'Сайт',
  PHONE: 'Звонок',
  MESSENGER: 'Мессенджер',
  REFERRAL: 'Рекомендация',
  OTHER: 'Другое',
};

export const lostReason: Record<LeadLostReason, string> = {
  NOT_INTERESTED: 'Не заинтересован',
  PRICE: 'Цена',
  NO_CONTACT: 'Нет связи',
  COMPETITOR: 'Выбрал другую школу',
  SCHEDULE_MISMATCH: 'Не подошло расписание',
  TRIAL_NO_SHOW: 'Не пришёл на пробный',
  OTHER: 'Другое',
};

export const studentStatus: Record<StudentStatus, { label: string; tone: Tone }> = {
  LEAD: { label: 'Заявка', tone: 'blue' },
  ACTIVE: { label: 'Учится', tone: 'teal' },
  FROZEN: { label: 'Заморожен', tone: 'violet' },
  EXPIRED: { label: 'Абонемент истёк', tone: 'coral' },
  ARCHIVED: { label: 'Архив', tone: 'neutral' },
};

export const taskType: Record<TaskType, { label: string; tone: Tone }> = {
  LEAD_FOLLOWUP: { label: 'Связаться с заявкой', tone: 'blue' },
  ASSIGN_TEACHER: { label: 'Назначить преподавателя', tone: 'violet' },
  RESCHEDULE_REQUEST: { label: 'Перенос урока', tone: 'yellow' },
  CHARGE_DISPUTE: { label: 'Спор по списанию', tone: 'coral' },
  SUBSCRIPTION_EXPIRING: { label: 'Абонемент заканчивается', tone: 'teal' },
  GENERAL: { label: 'Общая задача', tone: 'neutral' },
};

export const taskStatus: Record<TaskStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Новая', tone: 'blue' },
  IN_PROGRESS: { label: 'В работе', tone: 'yellow' },
  RESOLVED: { label: 'Решена', tone: 'teal' },
  REJECTED: { label: 'Отклонена', tone: 'neutral' },
};

export const lessonStatus: Record<LessonStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Запланирован', tone: 'blue' },
  STAR_PENDING: { label: 'Ждёт оценки', tone: 'yellow' },
  CONDUCTED: { label: 'Проведён', tone: 'teal' },
  CANCELLED: { label: 'Отменён', tone: 'neutral' },
  DISPUTED: { label: 'Оспорен', tone: 'coral' },
};

export const paymentStatus: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Зарегистрирован', tone: 'blue' },
  AWAITING_APPROVAL: { label: 'У директора', tone: 'yellow' },
  CONFIRMED: { label: 'Подтверждён', tone: 'teal' },
  REJECTED: { label: 'Отклонён', tone: 'coral' },
};

export const paymentMethod: Record<string, string> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  BANK_TRANSFER: 'Перевод',
  ONLINE: 'Онлайн',
};

export const approvalStatus: Record<string, string> = {
  NONE: '',
  AWAITING_DIRECTOR: 'Ждёт решения директора',
  MANUAL_FINANCE_REVIEW: 'Ручная финансовая проверка',
  AWAITING_SCHEDULE_APPROVAL: 'Ждёт согласования расписания',
};

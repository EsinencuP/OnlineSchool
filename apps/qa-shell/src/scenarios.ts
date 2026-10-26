import type { ClientError, LedgerLineInput, SchoolRequestOptions, SessionResponse } from './api.js';
import {
  approveDistribution,
  checkFileAccess,
  confirmPayment,
  consumeEntitlement,
  createLesson,
  createSubscription,
  grantEntitlement,
  proposePaymentDistribution,
  publishLedgerEntry,
  registerPayment,
  reportLessonOutcome,
} from './api.js';
import type { Result } from '@online-school/shared';

export type Role = SessionResponse['account']['roles'][number];
export type Values = Record<string, string>;
export type Field = {
  name: string;
  label: string;
  kind?: 'uuid' | 'money' | 'datetime' | 'number' | 'textarea';
  value?: string;
  options?: readonly string[];
  optional?: boolean;
};
export type Action = {
  id: string;
  title: string;
  button: string;
  roles: readonly Role[];
  fields: Field[];
  readOnly?: boolean;
  execute(values: Values, options: SchoolRequestOptions): Promise<Result<unknown, ClientError>>;
};
export type Scenario = { id: string; title: string; description: string; actions: Action[] };
const staff = ['DIRECTOR', 'MANAGER'] as const;
const uuid = (name: string, label: string): Field => ({ name, label, kind: 'uuid' });
const amount: Field = { name: 'amount', label: 'Сумма', kind: 'money' };
const currency: Field = { name: 'currency', label: 'Валюта', value: 'MDL' };
const iso = (value: string) => new Date(value).toISOString();

export const canRun = (session: SessionResponse | null, action: Action): boolean =>
  !!session?.mfa_completed &&
  !session.recovery_only &&
  action.roles.some((role) => session.account.roles.includes(role));

export const scenarios: Scenario[] = [
  {
    id: 'payment',
    title: 'Зарегистрировать платёж',
    description: 'Фиксирует поступление на проверку. Деньги подтверждает директор.',
    actions: [
      {
        id: 'registerPayment',
        title: 'Регистрация платежа',
        button: 'Зарегистрировать',
        roles: staff,
        fields: [uuid('studentId', 'ID ученика'), amount, currency],
        execute: (v, o) =>
          registerPayment({ studentId: v.studentId!, amount: v.amount!, currency: v.currency! }, o),
      },
    ],
  },
  {
    id: 'confirmation',
    title: 'Подтвердить платёж',
    description: 'Подтверждение факта поступления денег директором.',
    actions: [
      {
        id: 'confirmPayment',
        title: 'Подтверждение платежа',
        button: 'Подтвердить платёж',
        roles: ['DIRECTOR'],
        fields: [uuid('paymentId', 'ID платежа')],
        execute: (v, o) => confirmPayment(v.paymentId!, {}, o),
      },
    ],
  },
  {
    id: 'subscription',
    title: 'Абонемент и право',
    description:
      'Шаги выполняются отдельно. Выдача права требует полной подтверждённой оплаты и одобренного распределения.',
    actions: [
      {
        id: 'createSubscription',
        title: '1. Абонемент',
        button: 'Создать абонемент',
        roles: staff,
        fields: [
          uuid('enrollmentId', 'ID зачисления на предмет'),
          uuid('saleConditionId', 'ID условия продажи'),
        ],
        execute: (v, o) =>
          createSubscription(
            { enrollmentId: v.enrollmentId!, saleConditionId: v.saleConditionId! },
            o,
          ),
      },
      {
        id: 'proposeDistribution',
        title: '2. Распределение',
        button: 'Предложить распределение',
        roles: staff,
        fields: [
          uuid('paymentId', 'ID подтверждённого платежа'),
          uuid('subscriptionId', 'ID абонемента'),
          amount,
        ],
        execute: (v, o) =>
          proposePaymentDistribution(
            v.paymentId!,
            { subscriptionId: v.subscriptionId!, amount: v.amount! },
            o,
          ),
      },
      {
        id: 'approveDistribution',
        title: '3. Одобрение',
        button: 'Одобрить распределение',
        roles: ['DIRECTOR'],
        fields: [uuid('distributionId', 'ID распределения')],
        execute: (v, o) => approveDistribution(v.distributionId!, {}, o),
      },
      {
        id: 'grantEntitlement',
        title: '4. Право',
        button: 'Выдать право',
        roles: staff,
        fields: [
          uuid('subscriptionId', 'ID абонемента'),
          uuid('distributionId', 'ID одобренного распределения'),
          { name: 'quantity', label: 'Количество уроков', kind: 'number' },
        ],
        execute: (v, o) =>
          grantEntitlement(
            {
              subscriptionId: v.subscriptionId!,
              distributionId: v.distributionId!,
              quantity: Number(v.quantity),
            },
            o,
          ),
      },
    ],
  },
  {
    id: 'lesson',
    title: 'Забронировать урок',
    description: 'Бронирует урок по действующему назначению. Занятость и доступ проверяет API.',
    actions: [
      {
        id: 'createLesson',
        title: 'Бронирование урока',
        button: 'Забронировать',
        roles: staff,
        fields: [
          uuid('teachingAssignmentId', 'ID назначения преподавателя'),
          { name: 'startsAt', label: 'Начало (местное время)', kind: 'datetime' },
          { name: 'endsAt', label: 'Конец (местное время)', kind: 'datetime' },
          { name: 'status', label: 'Статус', options: ['SCHEDULED', 'STAR_PENDING'] },
          { name: 'basis', label: 'Основание', kind: 'textarea' },
        ],
        execute: (v, o) =>
          createLesson(
            {
              teachingAssignmentId: v.teachingAssignmentId!,
              startsAt: iso(v.startsAt!),
              endsAt: iso(v.endsAt!),
              status: v.status as 'SCHEDULED' | 'STAR_PENDING',
              basis: v.basis!,
            },
            o,
          ),
      },
    ],
  },
  {
    id: 'outcome',
    title: 'Сообщить факт урока',
    description:
      'Сообщение преподавателя. Подтверждение, списание и начисление — отдельные команды.',
    actions: [
      {
        id: 'reportLessonOutcome',
        title: 'Сообщение об уроке',
        button: 'Сообщить факт',
        roles: ['TEACHER'],
        fields: [
          uuid('lessonId', 'ID урока'),
          {
            name: 'result',
            label: 'Результат',
            options: ['CONDUCTED', 'NOT_CONDUCTED', 'DISPUTED'],
          },
          {
            name: 'actualStartedAt',
            label: 'Фактическое начало',
            kind: 'datetime',
            optional: true,
          },
          { name: 'durationMin', label: 'Длительность, минут', kind: 'number', optional: true },
          { name: 'note', label: 'Комментарий', kind: 'textarea' },
        ],
        execute: (v, o) =>
          reportLessonOutcome(
            v.lessonId!,
            {
              result: v.result as 'CONDUCTED' | 'NOT_CONDUCTED' | 'DISPUTED',
              note: v.note!,
              ...(v.actualStartedAt ? { actualStartedAt: iso(v.actualStartedAt) } : {}),
              ...(v.durationMin ? { durationMin: Number(v.durationMin) } : {}),
            },
            o,
          ),
      },
    ],
  },
  {
    id: 'consume',
    title: 'Списать право',
    description: 'Только по подтверждённому факту урока. Не создаёт факт проведения.',
    actions: [
      {
        id: 'consumeEntitlement',
        title: 'Списание права',
        button: 'Списать право',
        roles: staff,
        fields: [
          uuid('studentId', 'ID ученика'),
          uuid('grantId', 'ID выданного права'),
          uuid('lessonId', 'ID подтверждённого урока'),
        ],
        execute: (v, o) =>
          consumeEntitlement(
            { studentId: v.studentId!, grantId: v.grantId!, lessonId: v.lessonId! },
            o,
          ),
      },
    ],
  },
  {
    id: 'ledger',
    title: 'Опубликовать проводку',
    description:
      'Две равные строки по одной валюте. API сверяет документ-основание, счета и открытый период.',
    actions: [
      {
        id: 'publishLedgerEntry',
        title: 'Сбалансированная проводка',
        button: 'Опубликовать проводку',
        roles: ['DIRECTOR'],
        fields: [
          uuid('documentId', 'ID документа-основания'),
          uuid('periodId', 'ID финансового периода'),
          amount,
          currency,
          {
            name: 'debit',
            label: 'Дебет',
            options: [
              'CASH',
              'UNALLOCATED_FUNDS',
              'CUSTOMER_ADVANCE',
              'LESSON_REVENUE',
              'TEACHER_EXPENSE',
              'TEACHER_PAYABLE',
              'REFUND_PAYABLE',
              'CORRECTION',
            ],
          },
          {
            name: 'credit',
            label: 'Кредит',
            options: [
              'UNALLOCATED_FUNDS',
              'CASH',
              'CUSTOMER_ADVANCE',
              'LESSON_REVENUE',
              'TEACHER_EXPENSE',
              'TEACHER_PAYABLE',
              'REFUND_PAYABLE',
              'CORRECTION',
            ],
          },
        ],
        execute: (v, o) =>
          publishLedgerEntry(
            {
              documentId: v.documentId!,
              periodId: v.periodId!,
              lines: [
                {
                  accountType: v.debit as LedgerLineInput['accountType'],
                  direction: 'DEBIT',
                  amount: v.amount!,
                  currency: v.currency!,
                },
                {
                  accountType: v.credit as LedgerLineInput['accountType'],
                  direction: 'CREDIT',
                  amount: v.amount!,
                  currency: v.currency!,
                },
              ],
            },
            o,
          ),
      },
    ],
  },
  {
    id: 'file',
    title: 'Проверить отзыв доступа',
    description:
      'Проверяет доступ текущего аккаунта к файлу. После отзыва ожидается FILE_ACCESS_DENIED (403).',
    actions: [
      {
        id: 'checkFileAccess',
        title: 'Проверка доступа к файлу',
        button: 'Проверить доступ',
        roles: ['DIRECTOR', 'MANAGER', 'TEACHER', 'TECH_OPERATOR'],
        readOnly: true,
        fields: [uuid('objectId', 'ID файлового объекта')],
        execute: (v, o) => checkFileAccess(v.objectId!, o),
      },
    ],
  },
];

import { createHash } from 'node:crypto';
import type { Prisma } from '@online-school/db';
import { UUID, type AccountContext } from '../../core/http.js';
import { qaPasswordOnlyLogin } from '../../core/session/qa-password-policy.js';

const namespace = 'platform-demo-2026-11-01-v1';
export function demoAccountId(key: string): string {
  const b = createHash('sha256').update(`${namespace}:account:${key}`).digest().subarray(0, 16);
  b[6] = (b[6]! & 15) | 80;
  b[8] = (b[8]! & 63) | 128;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const demoAccounts = [
  {
    key: 'anna',
    name: 'Анна Волкова',
    role: 'STUDENT',
    login: 'anna.demo@onlineschool.test',
    home: '/student',
  },
  {
    key: 'maksim',
    name: 'Максим Русу',
    role: 'STUDENT',
    login: 'maksim.demo@onlineschool.test',
    home: '/student',
  },
  {
    key: 'sofia',
    name: 'София Ионеску',
    role: 'STUDENT',
    login: 'sofia.demo@onlineschool.test',
    home: '/student',
  },
  {
    key: 'daniil',
    name: 'Даниил Марин',
    role: 'STUDENT',
    login: 'daniil.demo@onlineschool.test',
    home: '/student',
  },
  {
    key: 'andrei',
    name: 'Андрей Мельник',
    role: 'TEACHER',
    login: 'andrei.demo@onlineschool.test',
    home: '/teacher',
  },
  {
    key: 'elena',
    name: 'Елена Попеску',
    role: 'TEACHER',
    login: 'elena.demo@onlineschool.test',
    home: '/teacher',
  },
  {
    key: 'tamara',
    name: 'Тамара',
    role: 'MANAGER',
    login: 'tamara.demo@onlineschool.test',
    home: '/manager',
  },
  {
    key: 'pasha',
    name: 'Паша',
    role: 'DIRECTOR',
    login: 'pasha.demo@onlineschool.test',
    home: '/director',
  },
  {
    key: 'tech',
    name: 'Технический оператор',
    role: 'TECH_OPERATOR',
    login: 'qa.tech@onlineschool.test',
    home: '/operator',
  },
] as const;

// Existing owner-provisioned synthetic staff may enter the same demo school.
const legacyLogins = new Map([
  ['manager@onlineschool.test', 'MANAGER'],
  ['qa.director@onlineschool.test', 'DIRECTOR'],
  ['qa.teacher@onlineschool.test', 'TEACHER'],
  ['qa.tech@onlineschool.test', 'TECH_OPERATOR'],
]);
export function demoSwitchAllowed(actor: AccountContext | undefined, login: string): boolean {
  return (
    process.env.PLATFORM_DEMO_SWITCHING === 'true' &&
    !!actor &&
    qaPasswordOnlyLogin(actor) &&
    (demoAccounts.some(
      (a) =>
        a.login === login &&
        demoAccountId(a.key) === actor.accountId &&
        actor.roles.length === 1 &&
        actor.role === a.role,
    ) ||
      legacyLogins.get(login) === actor.roles[0])
  );
}

type DemoAccount = (typeof demoAccounts)[number];

export async function availableDemoAccounts(
  db: Prisma.TransactionClient,
  choices: readonly DemoAccount[] = demoAccounts,
) {
  if (
    process.env.PLATFORM_DEMO_SWITCHING !== 'true' ||
    process.env.QA_PASSWORD_ONLY_LOGIN !== 'true'
  )
    return [];

  const ids = (process.env.QA_PASSWORD_ONLY_ACCOUNT_IDS ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id) => UUID.test(id));
  if (!ids.length) return [];

  const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS now`;
  const accounts = await db.authAccount.findMany({
    where: {
      id: { in: ids },
      login_id: { in: choices.map((choice) => choice.login) },
      disabled_at: null,
      recovery_registration_required: false,
      OR: [
        { kind: 'STAFF', staff_profile: { deactivated_at: null } },
        { kind: 'TEACHER', teacher_profile: { deactivated_at: null } },
        {
          kind: 'STUDENT',
          student_profile: { deactivated_at: null, must_change_password: false },
        },
      ],
    },
    select: {
      id: true,
      login_id: true,
      kind: true,
      role_assignments: {
        where: {
          valid_from: { lte: now },
          OR: [{ valid_to: null }, { valid_to: { gt: now } }],
        },
        select: { role: { select: { code: true } } },
      },
    },
  });
  return choices.flatMap((choice) => {
    const account = accounts.find((row) => row.login_id === choice.login);
    if (!account || (choice.key !== 'tech' && account.id !== demoAccountId(choice.key))) return [];
    const roles = account.role_assignments.map(({ role }) => role.code);
    return roles[0] === choice.role &&
      qaPasswordOnlyLogin({ accountId: account.id, kind: account.kind, roles })
      ? [{ choice, accountId: account.id }]
      : [];
  });
}

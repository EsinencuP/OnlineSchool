import { createHash } from 'node:crypto';
import type { AccountContext } from '../../core/http.js';

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
const legacyLogins = new Set([
  'manager@onlineschool.test',
  'qa.director@onlineschool.test',
  'qa.teacher@onlineschool.test',
  'qa.tech@onlineschool.test',
]);
export function demoSwitchAllowed(actor: AccountContext | undefined, login: string): boolean {
  return (
    process.env.PLATFORM_DEMO_SWITCHING === 'true' &&
    process.env.QA_PASSWORD_ONLY_LOGIN === 'true' &&
    !!actor &&
    !actor.recoveryOnly &&
    (demoAccounts.some(
      (a) =>
        a.login === login &&
        demoAccountId(a.key) === actor.accountId &&
        actor.roles.length === 1 &&
        actor.role === a.role,
    ) ||
      (legacyLogins.has(login) && actor.kind !== 'STUDENT'))
  );
}

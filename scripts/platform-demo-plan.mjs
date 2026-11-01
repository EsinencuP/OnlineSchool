import { createHash } from 'node:crypto';

export const marker = 'OWNER-DEMO-NO-REAL-MONEY';
export const namespace = 'platform-demo-2026-11-01-v1';
export const accounts = [
  { key: 'tamara', role: 'MANAGER', name: 'Тамара', login: 'tamara.demo@onlineschool.test' },
  { key: 'pasha', role: 'DIRECTOR', name: 'Паша', login: 'pasha.demo@onlineschool.test' },
  {
    key: 'andrei',
    role: 'TEACHER',
    name: 'Андрей Мельник',
    login: 'andrei.demo@onlineschool.test',
  },
  { key: 'elena', role: 'TEACHER', name: 'Елена Попеску', login: 'elena.demo@onlineschool.test' },
  { key: 'anna', role: 'STUDENT', name: 'Анна Волкова', login: 'anna.demo@onlineschool.test' },
  { key: 'maksim', role: 'STUDENT', name: 'Максим Русу', login: 'maksim.demo@onlineschool.test' },
  { key: 'sofia', role: 'STUDENT', name: 'София Ионеску', login: 'sofia.demo@onlineschool.test' },
  { key: 'daniil', role: 'STUDENT', name: 'Даниил Марин', login: 'daniil.demo@onlineschool.test' },
];
export const pupils = [
  {
    key: 'anna',
    teacher: 'andrei',
    code: 'MATH',
    subject: 'Математика',
    quantity: 8,
    price: '3200.0000',
    unit: '400.0000',
    days: 30,
    offsets: [1, 3, 6],
    hour: 16,
    homework: 'Решите пять линейных уравнений и объясните ход решения.',
    dueDays: 3,
  },
  {
    key: 'maksim',
    teacher: 'andrei',
    code: 'CODE',
    subject: 'Программирование',
    quantity: 6,
    price: '2700.0000',
    unit: '450.0000',
    days: 30,
    offsets: [2, 4, 6],
    hour: 18,
    homework: 'Напишите функцию вычисления суммы элементов массива и приведите два примера.',
    dueDays: 4,
  },
  {
    key: 'sofia',
    teacher: 'elena',
    code: 'EN',
    subject: 'Английский язык',
    quantity: 4,
    price: '1400.0000',
    unit: '350.0000',
    days: 14,
    offsets: [1, 3, 6],
    hour: 18,
    homework: 'Write five sentences about your favourite book using Present Simple.',
    dueDays: 1,
  },
  {
    key: 'daniil',
    teacher: 'elena',
    code: 'RO',
    subject: 'Румынский язык',
    quantity: 4,
    price: '1200.0000',
    unit: '300.0000',
    days: 7,
    offsets: [2, 4, 6],
    hour: 16,
    homework: 'Scrie cinci propoziții despre familia ta.',
    dueDays: 5,
  },
];
export function demoId(label) {
  const b = createHash('sha256').update(`${namespace}:${label}`).digest().subarray(0, 16);
  b[6] = (b[6] & 15) | 80;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const operation = (label) => demoId(`operation:${label}`);
export function demoSetupInput(env, now = Date.now()) {
  const until = Number(env.PLATFORM_DEMO_SETUP_UNTIL);
  if (
    env.VERCEL_ENV !== 'production' ||
    env.VERCEL_PROJECT_ID !== 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ' ||
    env.QA_PASSWORD_ONLY_LOGIN !== 'true' ||
    !Number.isSafeInteger(until) ||
    until <= now ||
    until > now + 30 * 60_000
  )
    return null;
  if (env.PLATFORM_DEMO_MARKER !== marker) throw new Error('PLATFORM_DEMO_INVALID_MARKER');
  const rows = JSON.parse(env.PLATFORM_DEMO_ACCOUNT_HASHES ?? 'null');
  if (
    !Array.isArray(rows) ||
    rows.length !== accounts.length ||
    new Set(rows.map((r) => r.key)).size !== accounts.length ||
    accounts.some(
      (a) =>
        !rows.some(
          (r) =>
            r.key === a.key &&
            r.login === a.login &&
            r.role === a.role &&
            /^\$scrypt\$v=1\$N=131072,r=8,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(
              r.hash ?? '',
            ),
        ),
    )
  )
    throw new Error('PLATFORM_DEMO_INVALID_ACCOUNTS');
  const paid = env.PLATFORM_DEMO_FINANCE_APPROVAL === `${marker}:8500.0000-MDL:22-LESSONS`;
  if (env.PLATFORM_DEMO_FINANCE_APPROVAL && !paid)
    throw new Error('PLATFORM_DEMO_INVALID_FINANCE_APPROVAL');
  return { rows, paid };
}

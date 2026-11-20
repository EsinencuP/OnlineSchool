import { formatMoneyAmount, initializeLocale, Icon } from '@online-school/ui';
import type { IconName } from '@online-school/ui';
import { record } from './contract.js';
import type { Details } from './contract.js';
import { enumTitle, t } from './actionCopy.js';

// A readable profile for one person (manager, teacher, student) instead of a raw field dump.
// Built from the response shapes the cabinet already reads; unknown shapes fall back to the
// generic object view.

type Tone = 'violet' | 'mint' | 'peach' | 'rose' | 'blue';
type Stat = { label: string; value: string | number; icon: IconName; tone: Tone };
type Meter = { label: string; value: number; total: number; caption: string };
type Fact = { label: string; value: string; href?: string };
type Entry = { title: string; meta: string; tone?: Tone };
export type Person = {
  name: string;
  demo: boolean;
  role: string;
  roleIcon: IconName;
  status: { label: string; tone: Tone } | null;
  stats: Stat[];
  meters: Meter[];
  facts: Fact[];
  chips: string[];
  note: string | null;
  lists: { title: string; empty: string; entries: Entry[] }[];
};

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const arr = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);

function date(value: unknown, withTime = true) {
  const text = str(value);
  if (!text || !Number.isFinite(Date.parse(text))) return '—';
  return new Intl.DateTimeFormat(t('ru', 'ro'), {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }),
  }).format(new Date(text));
}
function money(amount: unknown, currency: unknown) {
  const a = str(amount),
    c = str(currency);
  if (!a || !c) return '—';
  return formatMoneyAmount(a, c, initializeLocale()) ?? `${a} ${c}`;
}
function hours(minutes: number | null) {
  if (minutes === null) return '—';
  const h = Math.round((minutes / 60) * 10) / 10;
  return t(`${h} ч`, `${h} h`);
}
function splitName(raw: string) {
  const demo = /^\[(ДЕМО|DEMO)\]\s*/i.test(raw);
  return { demo, name: raw.replace(/^\[(ДЕМО|DEMO)\]\s*/i, '') };
}
const statusTone = (value: string): Tone =>
  /ACTIVE|AVAILABLE/.test(value)
    ? 'mint'
    : /FROZEN|LEAD|PENDING/.test(value)
      ? 'peach'
      : /EXPIRED|ARCHIVED|OFF|UNAVAILABLE/.test(value)
        ? 'rose'
        : 'violet';

function staff(data: Details): Person | null {
  const kind = str(data.kind);
  const fullName = str(data.fullName);
  if (!fullName || (kind !== 'MANAGER' && kind !== 'TEACHER') || typeof data.active !== 'boolean')
    return null;
  const m = record(data.metrics);
  const { demo, name } = splitName(fullName);
  const isManager = kind === 'MANAGER';
  const availability = str(m.availability);
  const history = arr(data.statusHistory).map((row) => ({
    title:
      row.action === 'DEACTIVATED'
        ? t('Отключён', 'Dezactivat')
        : t('Возвращён к работе', 'Reactivat'),
    meta: [date(row.changedAt), str(row.byDirectorName), str(row.reason)]
      .filter(Boolean)
      .join(' · '),
    tone: (row.action === 'DEACTIVATED' ? 'rose' : 'mint') as Tone,
  }));
  const handovers = arr(data.handovers).map((row) => ({
    title: `${row.subjectKind === 'LEAD' ? t('Заявка', 'Cerere') : t('Ученик', 'Elev')}: ${
      str(row.fromManagerName) ?? '—'
    } → ${str(row.toManagerName) ?? '—'}`,
    meta: [
      date(row.handedOverAt),
      num(row.movedTasks) ? t(`задач: ${row.movedTasks}`, `sarcini: ${row.movedTasks}`) : null,
      str(row.comment),
    ]
      .filter(Boolean)
      .join(' · '),
  }));
  return {
    name,
    demo,
    role: isManager ? t('Менеджер', 'Manager') : t('Преподаватель', 'Profesor'),
    roleIcon: isManager ? 'manager' : 'users',
    status: data.active
      ? availability && availability !== 'AVAILABLE'
        ? { label: enumTitle(availability), tone: 'peach' }
        : { label: t('Работает', 'Activ'), tone: 'mint' }
      : {
          label: t(`Отключён с ${date(data.deactivatedAt, false)}`, `Dezactivat din ${date(data.deactivatedAt, false)}`),
          tone: 'rose',
        },
    stats: isManager
      ? [
          { label: t('Ученики', 'Elevi'), value: num(m.students) ?? '—', icon: 'users', tone: 'violet' },
          { label: t('Заявки', 'Cereri'), value: num(m.leads) ?? '—', icon: 'leads', tone: 'blue' },
          { label: t('Открытые задачи', 'Sarcini deschise'), value: num(m.openTasks) ?? '—', icon: 'tasks', tone: 'peach' },
          { label: t('Эскалации', 'Escaladări'), value: num(m.openEscalations) ?? '—', icon: 'warning', tone: 'rose' },
        ]
      : [
          { label: t('Активные ученики', 'Elevi activi'), value: num(m.activeStudents) ?? '—', icon: 'users', tone: 'violet' },
          { label: t('Уроков за 7 дней', 'Lecții în 7 zile'), value: num(m.lessonsNext7Days) ?? '—', icon: 'calendar', tone: 'mint' },
          { label: t('Всего впереди', 'Lecții viitoare'), value: num(m.futureLessons) ?? '—', icon: 'clock', tone: 'blue' },
        ],
    meters: [],
    facts: [],
    chips: [],
    note: null,
    lists: [
      {
        title: t('История статуса', 'Istoricul statutului'),
        empty: t('Статус не менялся', 'Statutul nu s-a schimbat'),
        entries: history,
      },
      ...(isManager
        ? [
            {
              title: t('Передачи клиентов', 'Transferuri de clienți'),
              empty: t('Передач не было', 'Nu au existat transferuri'),
              entries: handovers,
            },
          ]
        : []),
    ],
  };
}

function teacherRow(data: Details): Person | null {
  const fullName = str(data.fullName);
  if (!fullName || !Array.isArray(data.subjects) || num(data.activeStudents) === null) return null;
  const { demo, name } = splitName(fullName);
  const available = num(data.availableMinutesNext7Days) ?? 0;
  const free = num(data.freeMinutesNext7Days) ?? 0;
  return {
    name,
    demo,
    role: t('Преподаватель', 'Profesor'),
    roleIcon: 'users',
    status: data.teachesSubject === false ? { label: t('Не ведёт предмет', 'Nu predă disciplina'), tone: 'peach' } : null,
    stats: [
      { label: t('Активные ученики', 'Elevi activi'), value: num(data.activeStudents) ?? '—', icon: 'users', tone: 'violet' },
      { label: t('Уроков за 7 дней', 'Lecții în 7 zile'), value: num(data.lessonsNext7Days) ?? '—', icon: 'calendar', tone: 'mint' },
      { label: t('Свободно за 7 дней', 'Liber în 7 zile'), value: hours(free), icon: 'clock', tone: 'blue' },
    ],
    meters: available
      ? [
          {
            label: t('Загрузка на неделю', 'Încărcarea săptămânii'),
            value: Math.max(available - free, 0),
            total: available,
            caption: t(
              `${hours(available - free)} занято из ${hours(available)}`,
              `${hours(available - free)} ocupat din ${hours(available)}`,
            ),
          },
        ]
      : [],
    facts: [],
    chips: arr(data.subjects)
      .map((s) => str(s.name))
      .filter((s): s is string => Boolean(s)),
    note: null,
    lists: [],
  };
}

function student(data: Details): Person | null {
  const fullName = str(data.fullName);
  const status = str(data.status);
  if (!fullName || !status || !str(data.studentId)) return null;
  const { demo, name } = splitName(fullName);
  const contacts = record(data.contacts);
  const learning = record(data.learning);
  const subscription = record(data.subscription ?? data.activeSubscription);
  const balances = arr(data.balances);
  const facts: Fact[] = [];
  const phone = str(contacts.phone) ?? str(data.maskedPhone);
  if (phone)
    facts.push({ label: t('Телефон', 'Telefon'), value: phone, ...(str(contacts.phone) ? { href: `tel:${phone.replace(/[^\d+]/g, '')}` } : {}) });
  const email = str(contacts.email);
  if (email) facts.push({ label: 'E-mail', value: email, href: `mailto:${email}` });
  const guardian = str(contacts.guardianName);
  if (guardian)
    facts.push({
      label: t('Представитель', 'Reprezentant'),
      value: [guardian, str(contacts.guardianPhone)].filter(Boolean).join(' · '),
    });
  facts.push({
    label: t('Вход в кабинет', 'Acces în cabinet'),
    value: data.hasAccount ? t('Создан', 'Creat') : t('Не создан', 'Necreat'),
  });
  if (str(data.nextLessonAt))
    facts.push({ label: t('Ближайший урок', 'Lecția următoare'), value: date(data.nextLessonAt) });
  const subscriptionEnds = str(subscription.endsAt ?? subscription.validTo);
  if (subscriptionEnds)
    facts.push({ label: t('Абонемент до', 'Abonament până la'), value: date(subscriptionEnds, false) });
  const stats: Stat[] = [];
  const remaining = num(subscription.remainingLessons);
  if (remaining !== null)
    stats.push({ label: t('Осталось уроков', 'Lecții rămase'), value: remaining, icon: 'calendar', tone: 'violet' });
  if (balances.length || str(data.balance))
    stats.push({
      label: t('Баланс', 'Sold'),
      value: balances.length
        ? balances.map((b) => money(b.amount, b.currency)).join(' / ')
        : money(data.balance, data.balanceCurrency),
      icon: 'wallet',
      tone: 'mint',
    });
  const tasks = num(data.openTasksCount) ?? (Array.isArray(data.openTasks) ? data.openTasks.length : null);
  if (tasks !== null)
    stats.push({ label: t('Открытые задачи', 'Sarcini deschise'), value: tasks, icon: 'tasks', tone: 'peach' });
  const overdue = num(data.overdueTasksCount) ?? num(learning.homeworkOverdue);
  if (overdue !== null)
    stats.push({
      label: num(data.overdueTasksCount) !== null ? t('Просрочено задач', 'Sarcini restante') : t('Просрочено ДЗ', 'Teme restante'),
      value: overdue,
      icon: 'warning',
      tone: 'rose',
    });
  const meters: Meter[] = [];
  const mastered = num(learning.skillsMastered),
    skillsTotal = num(learning.skillsTotal);
  if (mastered !== null && skillsTotal)
    meters.push({
      label: t('Освоено навыков', 'Competențe însușite'),
      value: mastered,
      total: skillsTotal,
      caption: `${mastered} / ${skillsTotal}`,
    });
  const submitted = num(learning.homeworkSubmitted),
    pending = num(learning.homeworkPending) ?? 0;
  if (submitted !== null && submitted + pending > 0)
    meters.push({
      label: t('Сдано домашних заданий', 'Teme predate'),
      value: submitted,
      total: submitted + pending,
      caption: `${submitted} / ${submitted + pending}`,
    });
  return {
    name,
    demo,
    role: t('Ученик', 'Elev'),
    roleIcon: 'profile',
    status: { label: enumTitle(status), tone: statusTone(status) },
    stats,
    meters,
    facts,
    chips: [],
    note: str(data.managerNote),
    lists: [
      ...(Array.isArray(data.upcomingLessons)
        ? [
            {
              title: t('Ближайшие уроки', 'Lecții apropiate'),
              empty: t('Уроков не запланировано', 'Nu sunt lecții programate'),
              entries: arr(data.upcomingLessons).map((row) => ({
                title: str(row.subjectName) ?? t('Урок', 'Lecție'),
                meta: [date(row.startsAt), str(row.teacherName)].filter(Boolean).join(' · '),
              })),
            },
          ]
        : []),
      ...(Array.isArray(data.recentPayments)
        ? [
            {
              title: t('Последние оплаты', 'Ultimele plăți'),
              empty: t('Оплат пока нет', 'Încă nu există plăți'),
              entries: arr(data.recentPayments).map((row) => ({
                title: money(row.amount, row.currency),
                meta: [enumTitle(str(row.status) ?? ''), date(row.confirmedAt ?? row.registeredAt)]
                  .filter(Boolean)
                  .join(' · '),
                tone: (row.status === 'CONFIRMED' ? 'mint' : 'peach') as Tone,
              })),
            },
          ]
        : []),
      ...(Array.isArray(data.openTasks)
        ? [
            {
              title: t('Открытые задачи', 'Sarcini deschise'),
              empty: t('Задач нет', 'Nu există sarcini'),
              entries: arr(data.openTasks).map((row) => ({
                title: str(row.title) ?? enumTitle(str(row.type) ?? ''),
                meta: t(`срок ${date(row.dueAt)}`, `termen ${date(row.dueAt)}`),
              })),
            },
          ]
        : []),
    ],
  };
}

export function personFrom(sourceId: string, data: Details): Person | null {
  if (/DirectorStaff/.test(sourceId)) return staff(data);
  if (sourceId === 'listManagerTeachers') return teacherRow(data);
  if (sourceId === 'getManagerStudentCard' || sourceId === 'listManagerStudents') return student(data);
  return null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function PersonCard({ person }: { person: Person }) {
  return (
    <article className="cab-person" aria-label={person.name}>
      <header className="cab-person-head">
        <span className="cab-person-avatar" aria-hidden="true">
          {initials(person.name) || <Icon name={person.roleIcon} size={24} />}
        </span>
        <div className="cab-person-title">
          <h3>{person.name}</h3>
          <div className="cab-person-tags">
            <span className="cab-person-role">
              <Icon name={person.roleIcon} size={14} /> {person.role}
            </span>
            {person.status && (
              <span className={`cab-status cab-tone-${person.status.tone}`}>{person.status.label}</span>
            )}
            {person.demo && <span className="cab-person-demo">{t('Демо', 'Demo')}</span>}
          </div>
        </div>
      </header>
      {person.stats.length > 0 && (
        <dl className="cab-person-stats">
          {person.stats.map((stat) => (
            <div key={stat.label} className="cab-person-stat">
              <span className={`cab-person-stat-icon cab-tone-${stat.tone}`} aria-hidden="true">
                <Icon name={stat.icon} size={17} />
              </span>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(person.meters.length > 0 || person.chips.length > 0) && (
        <div className="cab-person-band">
          {person.meters.map((meter) => (
            <div key={meter.label} className="cab-person-meter">
              <div>
                <span>{meter.label}</span>
                <strong>{meter.caption}</strong>
              </div>
              <span
                className="cab-person-track"
                role="meter"
                aria-label={meter.label}
                aria-valuemin={0}
                aria-valuemax={meter.total}
                aria-valuenow={meter.value}
              >
                <span style={{ width: `${Math.min(100, (meter.value / meter.total) * 100)}%` }} />
              </span>
            </div>
          ))}
          {person.chips.length > 0 && (
            <div className="cab-person-chips">
              <span>{t('Предметы', 'Discipline')}</span>
              <div>
                {person.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {person.facts.length > 0 && (
        <dl className="cab-person-facts">
          {person.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.href ? <a href={fact.href}>{fact.value}</a> : fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {person.note && (
        <p className="cab-person-note">
          <Icon name="info" size={15} /> {person.note}
        </p>
      )}
      {person.lists.length > 0 && (
        <div className="cab-person-lists">
          {person.lists.map((list) => (
            <section key={list.title}>
              <h4>{list.title}</h4>
              {list.entries.length ? (
                <ul>
                  {list.entries.map((entry, index) => (
                    <li key={index}>
                      <span className={`cab-person-dot cab-tone-${entry.tone ?? 'violet'}`} aria-hidden="true" />
                      <span>
                        <strong>{entry.title}</strong>
                        {entry.meta && <small>{entry.meta}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cab-person-empty">{list.empty}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

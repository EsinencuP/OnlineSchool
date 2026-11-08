import { useContext, useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Icon as UIIcon,
  k8kEnabled,
  queryBoundaryState,
  StateBoundary,
  useDataAge,
  useLocale,
  ErrorFeedback,
  errorText,
} from '@online-school/ui';
import {
  formatStudentDate,
  meetPresentation,
  StudentReadFreshness,
} from './student-presentation.js';
import type { LessonCardDto, NextLessonDto } from '@online-school/api-contracts';

let studentTimeZone = 'Europe/Chisinau';
export function setDateZone(zone: string) {
  studentTimeZone = zone;
}
export const date = (value: string | null | undefined, time = false) =>
  k8kEnabled
    ? formatStudentDate(value, studentTimeZone, time)
    : value
      ? new Intl.DateTimeFormat('ru-RU', {
          day: 'numeric',
          month: 'long',
          ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
          timeZone: studentTimeZone,
        }).format(new Date(value))
      : 'Не указан';
export const dayKey = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: studentTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
const icons: Record<string, ReactNode> = {
  academy: (
    <>
      <path d="m2 8 10-5 10 5-10 5Z" />
      <path d="M6 10v7l6 3 6-3v-7M2 8v10" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  lessons: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6m10-6v6M3 11h18" />
    </>
  ),
  homework: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 2h6v4H9m-1 8 3 3 5-6" />
    </>
  ),
  skills: (
    <>
      <path d="M4 20V14m5 6V10m5 10V6m5 14V2" />
    </>
  ),
  materials: <path d="M3 6h7l2 3h9v12H3Zm0 0V3h7l2 3h9v3" />,
  subscription: (
    <>
      <rect x="2" y="5" width="20" height="15" rx="3" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  notifications: (
    <>
      <path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Zm5 3h4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  manager: (
    <>
      <path d="M4 14v-4a8 8 0 0 1 16 0v8l-4 3h-4" />
      <rect x="2" y="10" width="5" height="8" rx="2" />
      <rect x="17" y="10" width="5" height="8" rx="2" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="13" height="13" rx="2" />
      <path d="m15 10 7-4v13l-7-4" />
    </>
  ),
};
export function Icon({ name }: { name: string }) {
  if (k8kEnabled) {
    const names: Record<string, Parameters<typeof UIIcon>[0]['name']> = {
      academy: 'brand',
      home: 'home',
      lessons: 'calendar',
      homework: 'tasks',
      skills: 'skills',
      materials: 'materials',
      subscription: 'wallet',
      notifications: 'bell',
      profile: 'profile',
      manager: 'manager',
      menu: 'menu',
      more: 'more',
      video: 'video',
    };
    return <UIIcon name={names[name] ?? 'materials'} />;
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] ?? icons.materials}
    </svg>
  );
}
export function Panel({
  title,
  children,
  to,
  className = '',
}: {
  title: string;
  children: ReactNode;
  to?: string;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-heading">
        <h2>{title}</h2>
        {to && <Link to={to}>Все →</Link>}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  children = 'Пока ничего нет. Новые данные появятся здесь.',
}: {
  children?: ReactNode;
}) {
  return <p className="empty">{children}</p>;
}
export function ErrorNotice({ error }: { error: unknown }) {
  return <ErrorFeedback error={error} />;
}
export function QueryState({
  query,
  children,
  operational = false,
  sourceTimestamp,
  empty = false,
}: {
  query: {
    isPending: boolean;
    error: unknown;
    refetch(): unknown;
    data?: unknown;
    dataUpdatedAt?: number;
    isFetching?: boolean;
  };
  children: ReactNode;
  operational?: boolean;
  sourceTimestamp?: string | undefined;
  empty?: boolean;
}) {
  const tooOld = useDataAge(query.dataUpdatedAt, operational ? 120_000 : false);
  const { locale, t } = useLocale();
  const errorStatus =
    query.error &&
    typeof query.error === 'object' &&
    'status' in query.error &&
    typeof query.error.status === 'number'
      ? query.error.status
      : undefined;
  if (k8kEnabled) {
    const state = queryBoundaryState({
      isPending: query.isPending,
      hasData: query.data !== undefined,
      error: !!query.error,
      errorStatus,
      tooOld,
      empty,
    });
    return (
      <StateBoundary
        state={
          state.status === 'error'
            ? { status: 'error', message: errorText(query.error, locale) }
            : state
        }
        asOf={sourceTimestamp}
        receivedAt={query.dataUpdatedAt}
        timeZone={studentTimeZone}
        refreshing={query.isFetching ?? false}
        retryRead={() => void query.refetch()}
      >
        <StudentReadFreshness.Provider value={state.status === 'ready'}>
          {children}
        </StudentReadFreshness.Provider>
      </StateBoundary>
    );
  }
  if (errorStatus === 401 || errorStatus === 403)
    return (
      <StateBoundary state={{ status: errorStatus === 401 ? 'session-expired' : 'forbidden' }} />
    );
  if (query.isPending)
    return (
      <p role="status" className="empty">
        {t('loading')}
      </p>
    );
  if (query.error)
    return (
      <div>
        <ErrorNotice error={query.error} />
        <button onClick={() => void query.refetch()}>{t('retry')}</button>
      </div>
    );
  return <>{children}</>;
}
export const statusLabels: Record<string, string> = {
  SCHEDULED: 'По расписанию',
  COMPLETED: 'Проведён',
  CANCELLED: 'Отменён',
  NO_SHOW: 'Неявка',
  STAR_PENDING: 'Ожидает подтверждения',
  DISPUTED: 'На рассмотрении',
  NOT_SUBMITTED: 'Назначено',
  SUBMITTED: 'Сдано',
  REVIEWED: 'Проверено',
  NEEDS_REVISION: 'На доработку',
  NOT_STUDIED: 'Ещё не изучали',
  FAMILIARIZING: 'Знакомлюсь',
  PRACTICING: 'Практикую',
  APPLYING: 'Применяю',
  ACTIVE: 'Активен',
  EXPIRED: 'Истёк',
  FROZEN: 'Заморожен',
  NONE: 'Нет абонемента',
};
export function Status({ value }: { value: string }) {
  if (k8kEnabled) {
    const tone = ['ACTIVE', 'APPLYING', 'COMPLETED', 'REVIEWED'].includes(value)
      ? 'success'
      : ['NEEDS_REVISION', 'PRACTICING', 'STAR_PENDING', 'DISPUTED'].includes(value)
        ? 'warning'
        : ['EXPIRED', 'CANCELLED', 'NO_SHOW'].includes(value)
          ? 'danger'
          : ['FROZEN', 'FAMILIARIZING', 'SUBMITTED', 'SCHEDULED'].includes(value)
            ? 'info'
            : 'neutral';
    return (
      <span className={`k8k-student-status k8k-status-${tone}`}>
        <UIIcon
          name={
            tone === 'success'
              ? 'check'
              : tone === 'warning' || tone === 'danger'
                ? 'warning'
                : tone === 'info'
                  ? 'info'
                  : 'circle'
          }
        />
        {statusLabels[value] ?? value}
      </span>
    );
  }
  return (
    <span className={`status status-${value.toLowerCase()}`}>{statusLabels[value] ?? value}</span>
  );
}
export function plural(value: number, forms: [string, string, string]) {
  const mod = value % 100;
  return `${value} ${mod >= 11 && mod <= 14 ? forms[2] : value % 10 === 1 ? forms[0] : value % 10 >= 2 && value % 10 <= 4 ? forms[1] : forms[2]}`;
}
export function safeUrl(
  value: string | null | undefined,
  kind: 'meet' | 'whatsapp' | 'telegram' | 'https' = 'https',
) {
  if (!value) return undefined;
  const patterns = {
    meet: /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\?[^\s]*)?$/,
    whatsapp: /^https:\/\/wa\.me\/[1-9]\d{6,14}\/?$/,
    telegram: /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}\/?$/,
    https: /^https:\/\/[^\s]+$/,
  };
  return patterns[kind].test(value) ? value : undefined;
}
export function JoinButton({
  lesson,
  serverNow,
  status,
}: {
  lesson: NextLessonDto | LessonCardDto;
  serverNow?: number | null;
  status?: string | undefined;
}) {
  const client = useQueryClient();
  const fresh = useContext(StudentReadFreshness);
  const reasonId = useId();
  useEffect(() => {
    if (k8kEnabled) return;
    const wait = new Date(lesson.scheduledAt).getTime() - 600_000 - Date.now();
    if (lesson.canJoin || wait < 0 || wait > 2_147_483_647) return;
    const timer = setTimeout(() => {
      void client.invalidateQueries({ queryKey: ['student'] });
    }, wait + 100);
    return () => clearTimeout(timer);
  }, [client, lesson.scheduledAt, lesson.canJoin]);
  const url = safeUrl(lesson.meetLink, 'meet');
  if (k8kEnabled) {
    const presentation = meetPresentation(
      status ? { ...lesson, status } : lesson,
      url,
      fresh,
      serverNow,
    );
    return (
      <div className="k8k-meet-entry">
        {presentation.kind !== 'unavailable' && (
          <a
            className="button primary k8k-meet-action"
            href={presentation.kind === 'ready' ? presentation.url : undefined}
            target="_blank"
            rel="noreferrer"
            role="link"
            tabIndex={0}
            aria-disabled={presentation.kind === 'disabled' || undefined}
            aria-describedby={presentation.kind === 'disabled' ? reasonId : undefined}
            onClick={(event) => {
              if (presentation.kind !== 'ready') event.preventDefault();
            }}
          >
            <UIIcon name="video" />
            Войти в Google Meet
          </a>
        )}
        {presentation.kind !== 'ready' && (
          <p className="k8k-join-reason" id={reasonId}>
            {presentation.reason}
          </p>
        )}
      </div>
    );
  }
  return lesson.canJoin && url ? (
    <a className="button primary" href={url} target="_blank" rel="noreferrer">
      <Icon name="video" />
      Подключиться
    </a>
  ) : (
    <button disabled title="Кнопка станет доступна за 10 минут до урока, если встреча готова">
      <Icon name="video" />
      Подключиться
    </button>
  );
}
export function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (k8kEnabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (k8kEnabled) return null;
  const minutes = Math.max(0, Math.ceil((new Date(at).getTime() - now) / 60_000));
  return (
    <small>
      {minutes > 1440
        ? `Через ${Math.ceil(minutes / 1440)} дн.`
        : minutes > 60
          ? `Через ${Math.floor(minutes / 60)} ч. ${minutes % 60} мин.`
          : minutes > 0
            ? `Через ${minutes} мин.`
            : 'Время урока наступило'}
    </small>
  );
}
export function Pager({
  page,
  total,
  pageSize,
  change,
}: {
  page: number;
  total: number;
  pageSize: number;
  change(page: number): void;
}) {
  const { t } = useLocale();
  if (total <= pageSize) return null;
  return (
    <nav className="pager" aria-label={t('tablePages')}>
      <button disabled={page === 1} onClick={() => change(page - 1)}>
        {t('chrome.previous')}
      </button>
      <span>{t('chrome.page', { page, total: Math.ceil(total / pageSize) })}</span>
      <button disabled={page * pageSize >= total} onClick={() => change(page + 1)}>
        {t('chrome.next')}
      </button>
    </nav>
  );
}
export function Modal({
  title,
  children,
  close,
  busy = false,
  className = '',
}: {
  title: string;
  children: ReactNode;
  close(): void;
  busy?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    node?.showModal();
    return () => {
      node?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) closeRef.current();
      }}
    >
      <div className="section-heading">
        <h2 id={titleId}>{title}</h2>
        <button aria-label={t('closeOverlay')} disabled={busy} onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

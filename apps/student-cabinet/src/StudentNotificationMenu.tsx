import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { sessionSignal } from '@online-school/account-ui';
import {
  Button,
  NotificationBell,
  Drawer,
  StatusChip,
  StateBoundary,
  describeError,
  Icon,
} from '@online-school/ui';
import {
  getStudentNotifications,
  getStudentUnreadNotificationCount,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
} from '@online-school/api-contracts';
import { read, useStudentQuery, write } from './api.js';
import { ErrorNotice, Pager, QueryState } from './components.js';
import { notificationTarget } from './student-presentation.js';
import { formatSkillDate } from './skill-copy.js';
import { useNotificationCopy } from './notification-copy.js';

/** Read-only home preview; all read commands remain in the existing drawer. */
export function StudentNotificationPreview() {
  const { t, locale, text, typeLabel } = useNotificationCopy();
  const query = useStudentQuery(['notifications-home-preview', locale], (options) =>
    getStudentNotifications({ page: 1, pageSize: 5, locale }, options),
  );
  return (
    <section className="k8k-student-card k8k-home-events">
      <h2>{t('chrome.recentEvents')}</h2>
      <QueryState query={query} empty={query.data?.items.length === 0} emptyMessage={text('empty')}>
        {query.data && (
          <ul>
            {query.data.items.slice(0, 2).map((item) => {
              const target = notificationTarget(item.payload, item.type, locale);
              return (
                <li
                  key={item.notificationId}
                  data-event-kind={item.type.startsWith('LESSON') ? 'lesson' : 'info'}
                >
                  <Icon name={item.type.startsWith('LESSON') ? 'calendar' : 'info'} />
                  <div>
                    <h3>{item.title || typeLabel(item.type)}</h3>
                    <p>{item.body}</p>
                    {target && (
                      <Link to={target.href}>
                        {target.label} <Icon name="arrow" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
      <Link className="k8k-student-link" to="/student?events=1">
        {t('chrome.recentEvents')} <Icon name="arrow" />
      </Link>
    </section>
  );
}

export function StudentNotificationMenu({
  count,
  countError,
  retryCount,
  timeZone,
}: {
  count?: number | undefined;
  countError?: unknown;
  retryCount?: () => unknown;
  timeZone: string;
}) {
  const { t, locale, text, typeLabel } = useNotificationCopy();
  const [params, setParams] = useSearchParams();
  const open = params.getAll('events').length === 1 && params.get('events') === '1';
  const [page, setPage] = useState(1);
  const client = useQueryClient(),
    lease = useRef(sessionSignal());
  const mounted = useRef(true);
  const trigger = useRef<HTMLButtonElement>(null),
    title = useRef<HTMLSpanElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    navigating = useRef(false);
  const forbidden =
    !!countError &&
    typeof countError === 'object' &&
    'status' in countError &&
    countError.status === 403;
  const query = useStudentQuery(
    ['notifications-preview', page, locale],
    (o) => getStudentNotifications({ page, pageSize: 5, locale }, o),
    open && !forbidden,
  );
  const { refetch } = query;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open && !forbidden) void refetch({ cancelRefetch: false });
    else
      void client.cancelQueries(
        { queryKey: ['student', 'notifications-preview'] },
        { silent: true, revert: false },
      );
  }, [open, page, locale, forbidden, refetch, client]);
  const [phase, setPhase] = useState<'idle' | 'pending' | 'unknown'>('idle'),
    [error, setError] = useState<unknown>(null),
    [checked, setChecked] = useState(false),
    [checking, setChecking] = useState(false);
  const intent = useRef<{ key: string; notificationId: string | null }>();
  const lock = useRef(false);
  const fresh = !!query.data && !query.error && !query.isFetching && !forbidden;
  function changeOpen(value: boolean) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('events');
        if (value) next.set('events', '1');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  async function check() {
    if (lock.current || lease.current.aborted) return;
    lock.current = true;
    setChecking(true);
    setError(null);
    setChecked(false);
    try {
      await Promise.all([
        refetch({ throwOnError: true }),
        client.fetchQuery({
          queryKey: ['student', 'unread'],
          staleTime: 0,
          queryFn: ({ signal }) =>
            read(getStudentUnreadNotificationCount, AbortSignal.any([signal, lease.current])),
        }),
      ]);
      if (!lease.current.aborted && mounted.current) setChecked(true);
    } catch (value) {
      if (!lease.current.aborted && mounted.current) setError(value);
    } finally {
      lock.current = false;
      if (!lease.current.aborted && mounted.current) setChecking(false);
    }
  }
  async function perform(id: string | null, retry = false) {
    if (
      lock.current ||
      lease.current.aborted ||
      (!retry && (phase !== 'idle' || !fresh)) ||
      (retry && (!checked || !intent.current))
    )
      return;
    lock.current = true;
    setPhase('pending');
    setError(null);
    if (!retry) intent.current = { key: crypto.randomUUID(), notificationId: id };
    const current = intent.current!;
    try {
      await write(
        (o) =>
          current.notificationId
            ? markStudentNotificationRead(current.notificationId, o)
            : markAllStudentNotificationsRead(o),
        current.key,
        lease.current,
      );
      if (lease.current.aborted || !mounted.current) return;
      await client.invalidateQueries({ queryKey: ['student'] });
      if (lease.current.aborted || !mounted.current) return;
      intent.current = undefined;
      setPhase('idle');
      setChecked(false);
      title.current?.focus({ preventScroll: true });
    } catch (value) {
      if (!lease.current.aborted && mounted.current) {
        setError(value);
        const unknown = describeError(value, 'write').outcome === 'unknown';
        setPhase(unknown ? 'unknown' : 'idle');
        setChecked(false);
        if (!unknown) intent.current = undefined;
      }
    } finally {
      lock.current = false;
    }
  }
  return (
    <NotificationBell
      count={count}
      renderLink={(content, label) => (
        <Drawer
          open={open}
          onOpenChange={changeOpen}
          title={
            <span ref={title} tabIndex={-1}>
              {t('chrome.recentEvents')}
            </span>
          }
          description={text('help')}
          initialFocusRef={title}
          returnFocusRef={trigger}
          trigger={
            <Button ref={trigger} variant="ghost" className="k8k-bell" aria-label={label}>
              {content}
            </Button>
          }
          contentProps={{
            className: 'k8k-notification-drawer',
            onCloseAutoFocus: (event) => {
              if (navigating.current) {
                event.preventDefault();
                navigating.current = false;
              }
            },
          }}
        >
          {count === undefined && (
            <p role="status">
              {text('unavailable')}{' '}
              <Button variant="secondary" onClick={() => void retryCount?.()}>
                {text('retryCount')}
              </Button>
            </p>
          )}
          <div className="k8k-notification-actions">
            <Button
              variant="secondary"
              disabled={phase !== 'idle' || !fresh || !query.data?.unreadCount}
              onClick={() => void perform(null)}
            >
              {t('chrome.readAll')}
            </Button>
            <Button
              variant="secondary"
              disabled={checking || phase === 'pending'}
              onClick={() => void check()}
            >
              {text('refresh')}
            </Button>
          </div>
          <div ref={scroll} className="k8k-notification-scroll">
            {phase !== 'unknown' && <ErrorNotice error={error} />}
            {phase === 'pending' && <p role="status">{text('pending')}</p>}
            {phase === 'unknown' && (
              <div>
                <StateBoundary
                  state={{ status: 'pending', outcome: 'unknown' }}
                  receivedAt={query.dataUpdatedAt}
                  timeZone={timeZone}
                />
                <p>{text('unknown')}</p>
                <Button variant="secondary" disabled={checking} onClick={() => void check()}>
                  {text('check')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={checking || !checked}
                  onClick={() => void perform(null, true)}
                >
                  {text('retry')}
                </Button>
              </div>
            )}
            {!forbidden && query.data && (
              <p className="k8k-notification-counts" role="status">
                {text('globalUnread')}: {query.data.unreadCount} · {text('total')}:{' '}
                {query.data.total}
              </p>
            )}
            {forbidden ? (
              <StateBoundary state={{ status: 'forbidden' }} />
            ) : (
              <QueryState
                operational
                query={query}
                empty={query.data?.items.length === 0}
                emptyMessage={query.data?.total ? text('emptyPage') : text('empty')}
              >
                {query.data && (
                  <>
                    {!!query.data.items.length && (
                      <ul>
                        {query.data.items.map((item) => {
                          const target = notificationTarget(item.payload, item.type, locale);
                          return (
                            <li
                              key={item.notificationId}
                              data-notification-id={item.notificationId}
                            >
                              <p className="k8k-notification-type">{typeLabel(item.type)}</p>
                              <h3>{item.title}</h3>
                              <p className="preserve-lines">{item.body}</p>
                              <time dateTime={item.createdAt}>
                                {formatSkillDate(item.createdAt, timeZone, locale, true)}
                              </time>
                              <p>
                                <StatusChip tone={item.isRead ? 'neutral' : 'info'}>
                                  {t(item.isRead ? 'chrome.read' : 'chrome.unread')}
                                </StatusChip>
                              </p>
                              {target && (
                                <Link
                                  className="k8k-student-link"
                                  to={target.href}
                                  onClick={() => {
                                    navigating.current = true;
                                  }}
                                >
                                  {target.label}
                                </Link>
                              )}
                              {!item.isRead && (
                                <Button
                                  variant="secondary"
                                  disabled={phase !== 'idle' || !fresh}
                                  onClick={() => void perform(item.notificationId)}
                                >
                                  {t('read')}
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </QueryState>
            )}
          </div>
          {!forbidden &&
            query.data &&
            (!query.data.items.length && page > 1 ? (
              <Button variant="secondary" onClick={() => setPage(1)}>
                {text('firstPage')}
              </Button>
            ) : (
              <Pager
                {...query.data}
                change={(next) => {
                  setPage(next);
                  if (scroll.current) scroll.current.scrollTop = 0;
                }}
              />
            ))}
        </Drawer>
      )}
    />
  );
}

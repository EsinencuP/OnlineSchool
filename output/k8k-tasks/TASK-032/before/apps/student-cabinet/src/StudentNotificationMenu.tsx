import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NotificationBell, useLocale } from '@online-school/ui';
import {
  getStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
} from '@online-school/api-contracts';
import { useCommand, useStudentQuery, write } from './api.js';
import { date, ErrorNotice, Pager, QueryState } from './components.js';
import { notificationTarget } from './student-presentation.js';

export function StudentNotificationMenu({ count }: { count?: number | undefined }) {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const query = useStudentQuery(
    ['notifications-preview', page],
    (options) => getStudentNotifications({ page, pageSize: 5 }, options),
    open,
    60_000,
  );
  const mark = useCommand((id: string) =>
    write((options) => markStudentNotificationRead(id, options)),
  );
  const markAll = useCommand(() => write(markAllStudentNotificationsRead));
  useEffect(() => {
    if (params.get('events') === '1' && details.current) {
      details.current.open = true;
      setOpen(true);
    }
  }, [params]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details
      ref={details}
      className="k8k-notification-menu"
      onToggle={(event) => {
        const value = event.currentTarget.open;
        setOpen(value);
        if (!value && params.has('events')) {
          const next = new URLSearchParams(params);
          next.delete('events');
          setParams(next, { replace: true });
        }
      }}
    >
      <NotificationBell
        count={count}
        renderLink={(content, label) => (
          <summary className="k8k-bell" aria-label={label}>
            {content}
          </summary>
        )}
      />
      <section className="k8k-notification-popover" aria-label={t('chrome.recentEvents')}>
        <h2>{t('chrome.recentEvents')}</h2>
        <ErrorNotice error={mark.error ?? markAll.error} />
        <button
          type="button"
          disabled={markAll.isPending || !query.data?.unreadCount}
          onClick={() => markAll.mutate()}
        >
          {t('chrome.readAll')}
        </button>
        {open && (
          <QueryState operational query={query} empty={query.data?.items.length === 0}>
            {query.data?.items.length ? (
              <ul>
                {query.data.items.map((item) => {
                  const target = notificationTarget(item.payload);
                  return (
                    <li key={item.notificationId}>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                      <time dateTime={item.createdAt}>{date(item.createdAt, true)}</time>
                      <p>{t(item.isRead ? 'chrome.read' : 'chrome.unread')}</p>
                      {target && (
                        <Link
                          className="k8k-student-link"
                          to={target.href}
                          onClick={() => {
                            if (details.current) details.current.open = false;
                          }}
                        >
                          {target.label}
                        </Link>
                      )}
                      {!item.isRead && (
                        <button
                          type="button"
                          disabled={mark.isPending}
                          onClick={() => mark.mutate(item.notificationId)}
                        >
                          {t('read')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{t('chrome.noEvents')}</p>
            )}
          </QueryState>
        )}
        {query.data && <Pager {...query.data} change={setPage} />}
      </section>
    </details>
  );
}

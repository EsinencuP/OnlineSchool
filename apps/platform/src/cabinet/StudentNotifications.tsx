import { useEffect, useRef, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { sessionSignal } from '@online-school/account-ui';
import { Drawer, formatDateTime, Icon, useContextRefresh } from '@online-school/ui';
import { CabinetError, request } from './contract.js';
import { CabinLink } from './Home.js';
import { StudyPager } from './StudentLesson.js';
import { useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import {
  noticePresentation,
  studentNotificationsPath,
  useNotificationCopy,
} from './studentNotificationCopy.js';
import type { NotificationMessage } from './studentNotificationCopy.js';

type Schemas = components['schemas'];
type Notice = Schemas['NotificationItemDto'];
type Feed = Schemas['NotificationsResponseDto'];
type Navigate = (url: string, replace?: boolean, preserveScroll?: boolean) => void;
type Selection = { page: number; pageSize: number; locale: 'ru' | 'ro' };
type Intent = { key: string; id: string | null; selection: Selection };

function lostAccess(error: unknown) {
  return (
    error instanceof CabinetError &&
    ([401, 402, 403].includes(error.issue.status) || error.issue.code === 'MUST_CHANGE_PASSWORD')
  );
}

function outcomeUnknown(error: unknown) {
  return (
    !(error instanceof CabinetError) ||
    error.issue.status === 0 ||
    error.issue.status >= 500 ||
    (error.issue.status >= 200 && error.issue.status < 300) ||
    error.issue.code === 'COMMAND_IN_PROGRESS'
  );
}

export function useStudentNotificationInbox(enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [issue, setIssue] = useState<NotificationMessage | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<'write' | 'check' | null>(null);
  const active = useRef<AbortController | null>(null);
  const count = useEndpoint<Schemas['UnreadCountDto']>(
    enabled ? 'getStudentUnreadNotificationCount' : null,
    {},
    {},
    revision,
  );
  const denied = issue === 'access' || lostAccess(count.error);

  useEffect(() => {
    if (!enabled) {
      setBusy(null);
      setIssue(null);
      setIntent(null);
      setChecked(false);
    }
    return () => active.current?.abort();
  }, [enabled]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  useContextRefresh({
    enabled: enabled && !denied,
    context: 'operational',
    paused: !!busy || count.pending,
    refresh: async () => refresh(),
  });

  async function execute(command: Intent, action: 'write' | 'check') {
    if (!enabled || denied || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const lease = AbortSignal.any([controller.signal, sessionSignal()]);
    const signal = AbortSignal.any([lease, AbortSignal.timeout(15_000)]);
    setIntent(command);
    setBusy(action);
    setIssue(null);
    setChecked(false);
    try {
      if (action === 'check') {
        const current = await request<Feed>('getStudentNotifications', {
          query: command.selection,
          signal,
        });
        if (lease.aborted) return;
        const confirmed = command.id
          ? current.items.some((item) => item.notificationId === command.id && item.isRead)
          : current.unreadCount === 0;
        refresh();
        if (!confirmed) {
          setChecked(true);
          setIssue('current');
          return;
        }
      } else {
        await request<void>(
          command.id ? 'markStudentNotificationRead' : 'markAllStudentNotificationsRead',
          {
            ...(command.id ? { params: { id: command.id } } : {}),
            key: command.key,
            signal,
          },
        );
        if (lease.aborted) return;
        refresh();
      }
      setIntent(null);
      setIssue('saved');
    } catch (error) {
      if (lease.aborted) return;
      if (lostAccess(error)) {
        setIntent(null);
        setIssue('access');
        refresh();
      } else if (action === 'check') {
        setIssue('checkError');
      } else if (outcomeUnknown(error)) {
        setIssue('unknown');
      } else {
        setIntent(null);
        setIssue(
          error instanceof CabinetError && error.issue.status === 404 ? 'missing' : 'writeError',
        );
        refresh();
      }
    } finally {
      active.current = null;
      if (!lease.aborted) setBusy(null);
    }
  }

  return {
    count: denied ? undefined : count.data?.unreadCount,
    denied,
    revision,
    intent,
    busy,
    issue,
    checked,
    refresh,
    mark(id: string | null, selection: Selection) {
      if (!intent && (id === null || isRouteUuid(id)))
        void execute({ id, selection, key: crypto.randomUUID() }, 'write');
    },
    check() {
      if (intent) void execute(intent, 'check');
    },
    repeat() {
      if (intent && checked) void execute(intent, 'write');
    },
    retryAccess() {
      setIssue(null);
      refresh();
    },
  };
}

type Inbox = ReturnType<typeof useStudentNotificationInbox>;

function NoticeRows({
  items,
  zone,
  compact = false,
  navigate,
  mark,
}: {
  items: Notice[];
  zone: string;
  compact?: boolean;
  navigate: Navigate;
  mark?: (id: string) => void;
}) {
  const { locale, text } = useNotificationCopy();
  return (
    <ul className={'cab-notice-list' + (compact ? ' cab-notice-compact' : '')}>
      {items.map((item) => {
        const { category, icon, tone, target } = noticePresentation(item);
        const time = formatDateTime(item.createdAt, locale, zone);
        return (
          <li className="cab-notice-row" key={item.notificationId} data-unread={!item.isRead}>
            <span className={'cab-icon-disc cab-tone-' + tone}>
              <Icon name={icon} size={18} />
            </span>
            <div className="cab-notice-main">
              <div className="cab-notice-meta">
                <span>{text(category)}</span>
                {time && <time dateTime={item.createdAt}>{time}</time>}
                {!item.isRead && <span className="cab-status cab-tone-violet">{text('new')}</span>}
              </div>
              <h3>{item.title}</h3>
              {!compact && <p className="cab-long-copy">{item.body}</p>}
              {(target || (mark && !item.isRead)) && (
                <div className="cab-notice-actions">
                  {target && (
                    <CabinLink to={target.href} navigate={navigate} className="cab-inline-link">
                      {text(target.label)} <Icon name="arrow" size={15} />
                    </CabinLink>
                  )}
                  {mark && !item.isRead && isRouteUuid(item.notificationId) && (
                    <button
                      type="button"
                      className="cab-text-button"
                      onClick={() => mark(item.notificationId)}
                    >
                      <Icon name="check" size={16} /> {text('mark')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FeedState({ error, retry }: { error: unknown; retry: () => void }) {
  const { text } = useNotificationCopy();
  if (!error)
    return (
      <p className="cab-empty" role="status">
        <span className="cab-spinner" /> {text('loading')}
      </p>
    );
  return (
    <div className="cab-empty cab-empty-error" role="alert">
      {text(lostAccess(error) ? 'access' : 'loadError')}
      <button type="button" className="cab-text-button" onClick={retry}>
        {text('refresh')}
      </button>
    </div>
  );
}

function NotificationFeed({
  inbox,
  page,
  pageSize,
  change,
  zone,
  navigate,
}: {
  inbox: Inbox;
  page: number;
  pageSize: number;
  change: (page: number) => void;
  zone: string;
  navigate: Navigate;
}) {
  const { locale, text } = useNotificationCopy();
  const selection = { page, pageSize, locale };
  const list = useEndpoint<Feed>(
    inbox.denied ? null : 'getStudentNotifications',
    {},
    selection,
    inbox.revision,
  );
  const data = list.data;
  const active = !inbox.intent && !inbox.busy;
  const message =
    inbox.busy === 'write' ? 'reading' : inbox.busy === 'check' ? 'checking' : inbox.issue;
  return (
    <div className="cab-lesson-stack cab-notice-feed">
      <div className="cab-notice-toolbar">
        {data && (
          <p className="cab-notice-total">
            {text('unread')} <strong>{data.unreadCount}</strong>
          </p>
        )}
        <button
          type="button"
          className="cab-button cab-secondary"
          disabled={list.pending || !!inbox.busy}
          onClick={inbox.retryAccess}
        >
          <Icon name="refresh" size={16} /> {text('refresh')}
        </button>
        {data && data.unreadCount > 0 && (
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={!active}
            onClick={() => inbox.mark(null, selection)}
          >
            <Icon name="check" size={17} /> {text('markAll')}
          </button>
        )}
      </div>
      {message && (
        <p className="cab-notice-meta" role="status">
          {text(message)}
        </p>
      )}
      {inbox.intent && !inbox.denied && (
        <div className="cab-notice-actions">
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={!!inbox.busy}
            onClick={inbox.check}
          >
            {text('check')}
          </button>
          {inbox.checked && (
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={!!inbox.busy}
              onClick={inbox.repeat}
            >
              {text('repeat')}
            </button>
          )}
        </div>
      )}
      {inbox.denied ? (
        !message && (
          <p className="cab-empty cab-empty-error" role="alert">
            {text('access')}
          </p>
        )
      ) : !data ? (
        <FeedState error={list.error} retry={inbox.refresh} />
      ) : (
        <>
          {data.items.length ? (
            <NoticeRows
              items={data.items}
              zone={zone}
              navigate={navigate}
              {...(active ? { mark: (id: string) => inbox.mark(id, selection) } : {})}
            />
          ) : (
            <p className="cab-empty">{text(data.total ? 'emptyPage' : 'empty')}</p>
          )}
          <StudyPager {...data} change={change} />
        </>
      )}
    </div>
  );
}

export function StudentNotificationBell({
  inbox,
  path,
  search,
  zone,
  navigate,
}: {
  inbox: Inbox;
  path: string;
  search: string;
  zone: string;
  navigate: Navigate;
}) {
  const { text } = useNotificationCopy();
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLSpanElement>(null);
  const [page, setPage] = useState(1);
  const events = new URLSearchParams(search).getAll('events');
  const open = events.length === 1 && events[0] === '1';
  const unread = typeof inbox.count === 'number' && inbox.count > 0 ? inbox.count : 0;

  function setOpen(value: boolean) {
    if (value) setPage(1);
    const params = new URLSearchParams(search);
    params.delete('events');
    if (value) params.set('events', '1');
    navigate(path + (params.size ? '?' + params : ''), true, true);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={
        <span tabIndex={-1} ref={heading}>
          {text('title')}
        </span>
      }
      description={text('about')}
      initialFocusRef={heading}
      returnFocusRef={button}
      contentProps={{ className: 'cab-notice-drawer' }}
      trigger={
        <button
          type="button"
          ref={button}
          className="cab-icon-button cab-bell"
          aria-label={text('title') + (unread ? ' · ' + text('unread') + ' ' + unread : '')}
        >
          <Icon name="bell" size={20} />
          {unread > 0 && (
            <span className="cab-bell-count" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      }
    >
      {open && (
        <NotificationFeed
          inbox={inbox}
          page={page}
          pageSize={5}
          change={setPage}
          zone={zone}
          navigate={navigate}
        />
      )}
      <CabinLink
        to={studentNotificationsPath}
        navigate={(url) => {
          if (path === url) setOpen(false);
          else navigate(url);
        }}
        className="cab-inline-link cab-notice-all"
      >
        {text('all')} <Icon name="arrow" size={16} />
      </CabinLink>
    </Drawer>
  );
}

export function StudentNotifications({
  inbox,
  search,
  zone,
  navigate,
}: {
  inbox: Inbox;
  search: string;
  zone: string;
  navigate: Navigate;
}) {
  const raw = new URLSearchParams(search).get('page') ?? '';
  const page = /^[1-9]\d*$/.test(raw) && Number(raw) <= 2_147_483_647 ? Number(raw) : 1;
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <NotificationFeed
        inbox={inbox}
        page={page}
        pageSize={30}
        change={(next) => navigate(studentNotificationsPath + (next > 1 ? '?page=' + next : ''))}
        zone={zone}
        navigate={navigate}
      />
    </section>
  );
}

export function StudentNotificationPreview({
  inbox,
  zone,
  navigate,
}: {
  inbox: Inbox;
  zone: string;
  navigate: Navigate;
}) {
  const { locale, text } = useNotificationCopy();
  const list = useEndpoint<Feed>(
    inbox.denied ? null : 'getStudentNotifications',
    {},
    { page: 1, pageSize: 3, locale },
    inbox.revision,
  );
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <div className="cab-panel-title">
        <h2>{text('recent')}</h2>
        <CabinLink to={studentNotificationsPath} navigate={navigate} className="cab-inline-link">
          {text('all')}
        </CabinLink>
      </div>
      {inbox.denied ? (
        <p className="cab-empty">{text('access')}</p>
      ) : !list.data ? (
        <FeedState error={list.error} retry={list.refresh} />
      ) : list.data.items.length ? (
        <NoticeRows items={list.data.items} zone={zone} navigate={navigate} compact />
      ) : (
        <p className="cab-empty">{text('empty')}</p>
      )}
    </section>
  );
}

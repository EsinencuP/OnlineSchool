import { sessionSignal } from '@online-school/account-ui';
import { useMe } from '../Layout.js';
import { useStudentLocale } from '../student-locale.js';
import { formatStudentDate } from '../student-presentation.js';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, k8kEnabled } from '@online-school/ui';
import {
  getStudentMaterialUrl,
  getStudentMaterials,
  getStudentSkillMaps,
  getStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
} from '@online-school/api-contracts';
import { read, useCommand, useStudentQuery, write } from '../api.js';
import { scheduleReturn } from '../lesson-navigation.js';
import { useLessonCopy } from '../lesson-copy.js';
import { date, Empty, ErrorNotice, Pager, Panel, QueryState } from '../components.js';
import { SubjectBack, SubjectUnavailable, useSubjectSelection } from './Subjects.js';
import { useStudentCopy } from '../student-copy.js';

function SubjectFilter({
  selection,
  materials = false,
}: {
  selection: ReturnType<typeof useSubjectSelection>;
  materials?: boolean;
}) {
  const { copy } = useStudentCopy();
  const { query, selected, setSubject } = selection;
  return (
    <QueryState query={query}>
      {query.data && (
        <label className="filter">
          {copy.subject}
          <select
            value={selected?.subjectId ?? ''}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="">{copy.allSubjects}</option>
            {query.data.items
              .filter((item) => !materials || item.capabilities.canViewMaterials)
              .map((item) => (
                <option key={item.subjectId} value={item.subjectId}>
                  {item.subjectName}
                </option>
              ))}
          </select>
        </label>
      )}
    </QueryState>
  );
}

function SubjectResult({
  selection,
  allowed,
  children,
}: {
  selection: ReturnType<typeof useSubjectSelection>;
  allowed: boolean;
  children: ReactNode;
}) {
  if (!selection.requested) return <>{children}</>;
  return (
    <QueryState query={selection.query}>
      {selection.query.data &&
        (allowed ? (
          <>
            <SubjectBack id={selection.selected?.subjectId} />
            {children}
          </>
        ) : (
          <SubjectUnavailable />
        ))}
    </QueryState>
  );
}

export { SkillMap } from './SkillMap.js';
export function Materials() {
  const { t, locale, intlLocale } = useStudentLocale();
  const me = useMe();
  const { copy } = useStudentCopy();
  const { text } = useLessonCopy();
  const selection = useSubjectSelection();
  const [legacyPage, setLegacyPage] = useState(1);
  const [legacySubject, setLegacySubject] = useState('');
  const [params, setParams] = useSearchParams();
  const lessonId = params.get('lessonId') ?? undefined;
  const pageParam = params.get('page') ?? '';
  const page = k8kEnabled
    ? /^[1-9]\d*$/.test(pageParam) && Number.isSafeInteger(Number(pageParam))
      ? Number(pageParam)
      : 1
    : legacyPage;
  const subject = k8kEnabled ? selection.selected?.subjectId : legacySubject;
  const allowed =
    !selection.requested || selection.selected?.capabilities.canViewMaterials === true;
  const maps = useStudentQuery(['skills'], (o) => getStudentSkillMaps(undefined, o), !k8kEnabled);
  const query = useStudentQuery(
    ['materials', page, subject, lessonId],
    (o) =>
      getStudentMaterials(
        { page, ...(subject ? { subjectId: subject } : {}), ...(lessonId ? { lessonId } : {}) },
        o,
      ),
    allowed,
  );
  function changePage(next: number) {
    if (!k8kEnabled) return setLegacyPage(next);
    const updated = new URLSearchParams(params);
    updated.set('page', String(next));
    setParams(updated, { preventScrollReset: true });
  }
  const [pendingId, setPendingId] = useState<string>();
  const [fileError, setFileError] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);
  const actionLock = useRef(false),
    lease = useRef(sessionSignal()),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function openFile(fileId: string) {
    if (actionLock.current || lease.current.aborted) return;
    actionLock.current = true;
    setPendingId(fileId);
    setFileError(null);
    setExpired(false);
    try {
      const result = await read((o) => getStudentMaterialUrl(fileId, o), lease.current);
      if (lease.current.aborted || !mounted.current) return;
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.username || url.password) {
        setFileError({ code: 'INVALID_URL', status: 400 });
        return;
      }
      if (
        !Number.isFinite(Date.parse(result.expiresAt)) ||
        Date.parse(result.expiresAt) <= Date.now()
      ) {
        setExpired(true);
        return;
      }
      window.location.assign(url.href);
    } catch (error) {
      if (!lease.current.aborted && mounted.current) setFileError(error);
    } finally {
      actionLock.current = false;
      if (!lease.current.aborted && mounted.current) setPendingId(undefined);
    }
  }
  return (
    <>
      <h1>{copy.materials}</h1>
      {lessonId && (
        <Link
          className="k8k-student-link"
          to={
            '/student/lessons/' +
            encodeURIComponent(lessonId) +
            '?' +
            new URLSearchParams({ backTo: scheduleReturn(params.get('backTo')) })
          }
        >
          ← {text('lesson')}
        </Link>
      )}
      <p className="lead">{t('student.materialLead')}</p>
      {k8kEnabled ? (
        <SubjectFilter selection={selection} materials />
      ) : (
        <label className="filter">
          Предмет
          <select
            value={subject}
            onChange={(e) => {
              setLegacySubject(e.target.value);
              setLegacyPage(1);
            }}
          >
            <option value="">Все предметы</option>
            {maps.data?.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subjectName}
              </option>
            ))}
          </select>
        </label>
      )}
      <SubjectResult selection={selection} allowed={allowed}>
        <Panel title={t('student.library')}>
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('student.materialRefresh')}
          </Button>
          <p>{t('student.fileHelp')}</p>
          <ErrorNotice error={fileError} />
          {expired && <p role="alert">{t('student.fileExpired')}</p>}
          <QueryState
            query={query}
            empty={query.data?.items.length === 0}
            emptyMessage={t(
              query.data?.total ? 'student.materialPageEmpty' : 'student.materialEmpty',
            )}
          >
            {query.data?.items.length ? (
              <ul className="homework-list k8k-material-list">
                {query.data.items.map((m) => (
                  <li key={m.fileId}>
                    <div>
                      <small>
                        {m.subjectId === null ? t('student.noSubject') : m.subjectName} ·{' '}
                        {m.sharedByTeacherName}
                      </small>
                      <h3>{m.fileNameIsFallback ? t('student.material') : m.fileName}</h3>
                      <p className="muted">
                        {m.mimeType} ·{' '}
                        {t('student.megabytes', {
                          size: new Intl.NumberFormat(intlLocale, {
                            maximumFractionDigits: 1,
                          }).format(m.fileSizeBytes / 1048576),
                        })}{' '}
                        · {formatStudentDate(m.sharedAt, me.timeZone, false, locale)}
                      </p>
                      <p>{m.lessonTitle ?? t('student.noLesson')}</p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!!pendingId || !!query.error || query.isFetching}
                      onClick={() => void openFile(m.fileId)}
                    >
                      {pendingId === m.fileId
                        ? t('student.filePending')
                        : t(
                            m.canDownload === true
                              ? 'student.download'
                              : m.canDownload === false
                                ? 'student.view'
                                : 'student.fileOpen',
                          )}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t('student.materialEmpty')}</Empty>
            )}
          </QueryState>
          {query.data && <Pager {...query.data} change={changePage} />}
        </Panel>
      </SubjectResult>
    </>
  );
}
export function Notifications() {
  const [page, setPage] = useState(1);
  const query = useStudentQuery(
    ['notifications', page],
    (o) => getStudentNotifications({ page }, o),
    true,
    60_000,
  );
  const markAll = useCommand(() => write(markAllStudentNotificationsRead));
  const mark = useCommand((id: string) => write((o) => markStudentNotificationRead(id, o)));
  return (
    <>
      <h1>Уведомления</h1>
      <div className="toolbar">
        <p className="lead">Непрочитанных: {query.data?.unreadCount ?? '—'}</p>
        <button
          disabled={markAll.isPending || !query.data?.unreadCount}
          onClick={() => markAll.mutate()}
        >
          Прочитать все
        </button>
      </div>
      <ErrorNotice error={markAll.error ?? mark.error} />
      <Panel title="События обучения">
        <QueryState query={query}>
          {query.data?.items.length ? (
            <ul className="notification-list">
              {query.data.items.map((n) => (
                <li key={n.notificationId} className={n.isRead ? '' : 'unread'}>
                  <div>
                    <h3>{n.title}</h3>
                    <p className="preserve-lines">{n.body}</p>
                    <small>{date(n.createdAt, true)}</small>
                  </div>
                  {!n.isRead && (
                    <button disabled={mark.isPending} onClick={() => mark.mutate(n.notificationId)}>
                      Прочитано
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Новых событий пока нет.</Empty>
          )}
        </QueryState>
        {query.data && <Pager {...query.data} change={setPage} />}
      </Panel>
    </>
  );
}

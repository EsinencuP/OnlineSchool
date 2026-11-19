import { useEffect, useRef, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon, useContextRefresh } from '@online-school/ui';
import { CabinetError, request, safeMeet } from './contract.js';
import { CabinLink } from './Home.js';
import { useEndpoint } from './hooks.js';
import { StudentLessonRequest } from './StudentLessonRequest.js';
import { studyStatus, useStudy } from './studentStudyCopy.js';
import type { StudyText } from './studentStudyCopy.js';

type Schemas = components['schemas'];

function readProblem(error: unknown) {
  return (
    error instanceof CabinetError &&
    ([401, 402].includes(error.issue.status) || error.issue.code === 'MUST_CHANGE_PASSWORD')
  );
}

function Info({ text, retry, error }: { text: string; retry?: () => void; error?: boolean }) {
  const { text: t } = useStudy();
  return (
    <div
      className={error ? 'cab-empty cab-empty-error' : 'cab-empty'}
      role={error ? 'alert' : 'status'}
    >
      <span>{text}</span>
      {retry && (
        <button type="button" className="cab-text-button" onClick={retry}>
          {t('refresh')}
        </button>
      )}
    </div>
  );
}

function MaterialAction({
  file,
  onAccessChange,
}: {
  file: Schemas['MaterialItemDto'];
  onAccessChange: () => void;
}) {
  const { text } = useStudy();
  const [link, setLink] = useState<{ href: string; until: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!link) return;
    const timer = window.setTimeout(() => setLink(null), Math.max(0, link.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [link]);

  async function prepare() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFailed(false);
    setLink(null);
    try {
      const result = await request<Schemas['FileSignedUrlResponseDto']>('getStudentMaterialUrl', {
        params: { fileId: file.fileId },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
      });
      if (controller.signal.aborted) return;
      const url = new URL(result.url);
      const until = Date.parse(result.expiresAt);
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        Number.isFinite(until) &&
        until > Date.now()
      ) {
        setLink({ href: url.href, until: Math.min(until, Date.now() + 15 * 60_000) });
      } else setFailed(true);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailed(true);
        if (readProblem(error)) onAccessChange();
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      active.current = null;
    }
  }

  return (
    <div className="cab-lesson-file-action">
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="cab-inline-link"
          onClick={(event) => {
            if (Date.now() >= link.until) {
              event.preventDefault();
              setLink(null);
            }
          }}
        >
          {text(file.canDownload ? 'downloadFile' : 'openFile')}
          <Icon name="external" size={15} />
        </a>
      ) : (
        <button
          type="button"
          className="cab-button cab-secondary"
          disabled={busy}
          onClick={() => void prepare()}
        >
          {text(busy ? 'loading' : 'prepareFile')}
        </button>
      )}
      {failed && (
        <p role="alert" className="cab-form-error">
          {text('fileUnavailable')}
        </p>
      )}
    </div>
  );
}

function Pager({
  page,
  total,
  pageSize,
  change,
  text,
}: {
  page: number;
  total: number;
  pageSize: number;
  change: (page: number) => void;
  text: StudyText;
}) {
  if (total <= pageSize) return null;
  return (
    <div className="cab-form-actions">
      <button
        type="button"
        className="cab-button cab-secondary"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
      >
        {text('previous')}
      </button>
      <button
        type="button"
        className="cab-button cab-secondary"
        disabled={page * pageSize >= total}
        onClick={() => change(page + 1)}
      >
        {text('next')}
      </button>
    </div>
  );
}

function LessonResources({
  id,
  navigate,
  onAccessChange,
}: {
  id: string;
  navigate: (url: string) => void;
  onAccessChange: () => void;
}) {
  const { text } = useStudy();
  const [homeworkPage, setHomeworkPage] = useState(1);
  const [materialsPage, setMaterialsPage] = useState(1);
  const homework = useEndpoint<Schemas['HomeworkResponseDto']>(
    'getStudentHomework',
    {},
    { lessonId: id, page: homeworkPage, pageSize: 10 },
  );
  const materials = useEndpoint<Schemas['MaterialsResponseDto']>(
    'getStudentMaterials',
    {},
    { lessonId: id, page: materialsPage, pageSize: 10 },
  );

  return (
    <>
      <section className="cab-card cab-panel">
        <div className="cab-panel-title">
          <h2>{text('homework')}</h2>
        </div>
        {homework.pending || homework.error ? (
          <Info
            text={text(homework.pending ? 'loading' : 'unknowable')}
            error={!!homework.error}
            {...(homework.error ? { retry: homework.refresh } : {})}
          />
        ) : homework.data?.items.length ? (
          <>
            <ul className="cab-lesson-resources">
              {homework.data.items.map((work) => (
                <li key={work.homeworkId}>
                  <CabinLink
                    to={'/student/homework/' + encodeURIComponent(work.homeworkId)}
                    navigate={navigate}
                    className="cab-inline-link"
                  >
                    {work.title} <Icon name="arrow" size={15} />
                  </CabinLink>
                  <small>{studyStatus(work.status, text)}</small>
                </li>
              ))}
            </ul>
            <Pager
              page={homework.data.page}
              pageSize={homework.data.pageSize}
              total={homework.data.total}
              change={setHomeworkPage}
              text={text}
            />
          </>
        ) : (
          <Info text={text('emptyHomework')} />
        )}
      </section>
      <section className="cab-card cab-panel">
        <div className="cab-panel-title">
          <h2>{text('materials')}</h2>
        </div>
        {materials.pending || materials.error ? (
          <Info
            text={text(materials.pending ? 'loading' : 'unknowable')}
            error={!!materials.error}
            {...(materials.error ? { retry: materials.refresh } : {})}
          />
        ) : materials.data?.items.length ? (
          <>
            <ul className="cab-lesson-resources">
              {materials.data.items.map((file) => (
                <li key={file.fileId}>
                  <strong>{file.fileName}</strong>
                  <small>{file.sharedByTeacherName}</small>
                  <MaterialAction file={file} onAccessChange={onAccessChange} />
                </li>
              ))}
            </ul>
            <Pager
              page={materials.data.page}
              pageSize={materials.data.pageSize}
              total={materials.data.total}
              change={setMaterialsPage}
              text={text}
            />
          </>
        ) : (
          <Info text={text('emptyMaterials')} />
        )}
      </section>
    </>
  );
}

export function StudentLessonCard({
  id,
  accountId,
  zone,
  navigate,
  refreshAccess,
}: {
  id: string;
  accountId: string;
  zone: string;
  navigate: (url: string) => void;
  refreshAccess: () => void;
}) {
  const { locale, text } = useStudy();
  const result = useEndpoint<Schemas['LessonCardDto']>('getStudentLesson', { lessonId: id });
  const lesson = result.data?.lessonId === id ? result.data : null;
  const history = useEndpoint<Schemas['LessonHistoryResponseDto']>(
    lesson ? 'getStudentLessonHistory' : null,
    {},
    { lessonId: id, pageSize: 1 },
  );
  const item = history.data?.items.find((entry) => entry.lessonId === id);
  const meet = lesson?.canJoin === true ? safeMeet(lesson.meetLink) : null;
  const format = (value: string) => formatDateTime(value, locale, zone) ?? '—';

  function invalidate() {
    result.refresh();
    refreshAccess();
  }

  useContextRefresh({
    enabled: !!lesson,
    context: 'live-lesson',
    refresh: async () => result.refresh(),
  });

  return (
    <div className="cab-lesson-layout">
      <div className="cab-page-title">
        <h1>{text('details')}</h1>
      </div>
      <CabinLink to="/student/lessons" navigate={navigate} className="cab-inline-link">
        {text('back')}
      </CabinLink>
      {result.pending ? (
        <Info text={text('loading')} />
      ) : !lesson ? (
        <Info text={text('unknowable')} error retry={invalidate} />
      ) : (
        <div className="cab-lesson-grid">
          <div className="cab-lesson-stack">
            <article className="cab-card cab-panel cab-detail cab-lesson-summary">
              <div className="cab-panel-title">
                <h2>{lesson.subjectName}</h2>
                <span className="cab-status cab-tone-violet">
                  {studyStatus(lesson.status, text)}
                </span>
              </div>
              <p className="cab-detail-subtitle">{lesson.teacherName}</p>
              <p>
                <time dateTime={lesson.scheduledAt}>{format(lesson.scheduledAt)}</time> ·{' '}
                {lesson.durationMinutes} {text('minutes')}
              </p>
              {lesson.originalScheduledAt && lesson.originalScheduledAt !== lesson.scheduledAt && (
                <p className="cab-detail-subtitle">
                  {text('movedFrom')} ·{' '}
                  <time dateTime={lesson.originalScheduledAt}>
                    {format(lesson.originalScheduledAt)}
                  </time>
                </p>
              )}
              {meet ? (
                <a
                  className="cab-button cab-primary"
                  href={meet}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Icon name="video" size={18} /> {text('join')}
                </a>
              ) : (
                (lesson.status === 'SCHEDULED' || lesson.status === 'STAR_PENDING') && (
                  <Info text={text('meetWaiting')} retry={result.refresh} />
                )
              )}
              <div className="cab-form-actions">
                <StudentLessonRequest
                  lessonId={id}
                  accountId={accountId}
                  kind="reschedule"
                  allowed={lesson.canRequestReschedule === true}
                  onAccessChange={invalidate}
                />
              </div>
            </article>
            <section className="cab-card cab-panel">
              <div className="cab-panel-title">
                <h2>{text('history')}</h2>
              </div>
              {history.pending || history.error ? (
                <Info
                  text={text(history.pending ? 'loading' : 'unknowable')}
                  error={!!history.error}
                  {...(history.error ? { retry: history.refresh } : {})}
                />
              ) : item ? (
                <>
                  <p>
                    {studyStatus(item.attendanceStatus, text)} · {item.teacherName} ·{' '}
                    {item.durationMinutes} {text('minutes')}
                  </p>
                  <p className="cab-detail-subtitle">
                    {text(item.lessonDeducted ? 'deducted' : 'notDeducted')}
                  </p>
                  <dl className="cab-lesson-balance">
                    <div>
                      <dt>{text('before')}</dt>
                      <dd>{item.balanceBefore ?? text('balanceUnknown')}</dd>
                    </div>
                    <div>
                      <dt>{text('after')}</dt>
                      <dd>{item.balanceAfter ?? text('balanceUnknown')}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <Info text={text('emptyHistory')} />
              )}
              {!history.pending && !history.error && (
                <StudentLessonRequest
                  lessonId={id}
                  accountId={accountId}
                  kind="dispute"
                  allowed={item?.canDispute === true}
                  onAccessChange={invalidate}
                />
              )}
            </section>
          </div>
          <aside className="cab-lesson-stack">
            <LessonResources id={id} navigate={navigate} onAccessChange={invalidate} />
          </aside>
        </div>
      )}
    </div>
  );
}

export function StudentSuspended({
  contacts,
  refresh,
}: {
  contacts?: Schemas['ManagerContactsDto'];
  refresh: () => void;
}) {
  const { text } = useStudy();
  const phone = contacts?.phoneE164;
  const candidates = [
    ['WhatsApp', contacts?.whatsapp, /^https:\/\/(?:wa\.me|api\.whatsapp\.com)\//i],
    ['Telegram', contacts?.telegram, /^https:\/\/t\.me\//i],
  ] as const;
  const links = candidates.flatMap(([name, url, pattern]) =>
    url && pattern.test(url) ? [{ name, url }] : [],
  );
  const validPhone = phone && /^\+[1-9]\d{6,14}$/.test(phone);
  return (
    <section className="cab-card cab-panel cab-detail cab-password-gate">
      <h1>{text('suspended')}</h1>
      <p>{text('suspendedHint')}</p>
      <h2>{text('managerContacts')}</h2>
      {contacts?.displayName && <p>{contacts.displayName}</p>}
      {validPhone || links.length ? (
        <div className="cab-form-actions">
          {validPhone && (
            <a className="cab-button cab-secondary" href={'tel:' + phone}>
              {phone}
            </a>
          )}
          {links.map(({ name, url }) => (
            <a
              key={name}
              href={url}
              className="cab-button cab-secondary"
              target="_blank"
              rel="noreferrer noopener"
            >
              {name}
              <Icon name="external" size={15} />
            </a>
          ))}
        </div>
      ) : (
        <p className="cab-detail-subtitle">{text('noContacts')}</p>
      )}
      <button type="button" className="cab-button cab-secondary" onClick={refresh}>
        {text('refresh')}
      </button>
    </section>
  );
}

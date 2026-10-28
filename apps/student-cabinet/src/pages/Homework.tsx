import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useBlocker, useBeforeUnload } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  confirmStudentHomeworkUpload,
  getStudentHomework,
  getStudentHomeworkDetail,
  requestStudentHomeworkUpload,
  saveStudentHomeworkDraft,
  submitStudentHomework,
} from '@online-school/api-contracts';
import type { HomeworkItemDto, GetStudentHomeworkParams } from '@online-school/api-contracts';
import { errorMessage, useIntentKey, useStudentQuery, write } from '../api.js';
import {
  date,
  Empty,
  ErrorNotice,
  Modal,
  Pager,
  Panel,
  QueryState,
  safeUrl,
  Status,
} from '../components.js';
export function Homework() {
  const [status, setStatus] = useState(''),
    [page, setPage] = useState(1);
  const query = useStudentQuery(['homework', status, page], (o) =>
    getStudentHomework(
      {
        page,
        pageSize: 20,
        ...(status ? { status: status as NonNullable<GetStudentHomeworkParams['status']> } : {}),
      },
      o,
    ),
  );
  return (
    <>
      <h1>Домашние задания</h1>
      <p className="lead">Практика, которая помогает двигаться вперёд</p>
      <label className="filter">
        Статус
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все задания</option>
          <option value="NOT_SUBMITTED">Назначено</option>
          <option value="SUBMITTED">Сдано</option>
          <option value="REVIEWED">Проверено</option>
          <option value="NEEDS_REVISION">На доработку</option>
        </select>
      </label>
      <Panel title="Твои задания">
        <QueryState query={query}>
          {query.data?.items.length ? (
            <ul className="homework-list">
              {query.data.items.map((h) => (
                <li key={h.homeworkId}>
                  <div>
                    <small>
                      {h.subjectName} · {h.teacherName}
                    </small>
                    <h3>
                      <Link to={`/student/homework/${h.homeworkId}`}>{h.title}</Link>
                    </h3>
                    <p className="muted">
                      Назначено {date(h.assignedAt)} · Сдать до {date(h.dueAt, true)}
                    </p>
                  </div>
                  <div>
                    <Status value={h.status} />
                    {h.isLate && (
                      <span className="status status-needs_revision">Сдано с опозданием</span>
                    )}
                    <Link className="button" to={`/student/homework/${h.homeworkId}`}>
                      Открыть
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Заданий с этим статусом пока нет.</Empty>
          )}
        </QueryState>
        {query.data && <Pager {...query.data} change={setPage} />}
      </Panel>
    </>
  );
}
function HomeworkEditor({ item }: { item: HomeworkItemDto }) {
  const client = useQueryClient();
  const submitKey = useIntentKey();
  const [content, setContent] = useState(item.draftContent ?? ''),
    [saved, setSaved] = useState(item.draftContent ?? ''),
    [saveError, setSaveError] = useState<unknown>(null),
    [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<{ fileId: string; fileName: string }[]>([]),
    [submitted, setSubmitted] = useState(false),
    [isLate, setIsLate] = useState(item.isLate);
  const queue = useRef<Promise<unknown>>(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    mounted = useRef(true);
  const uploadIntent = useRef<
    | {
        file: File;
        key: string;
        confirmKey: string;
        presigned?: { fileId: string; uploadUrl: string };
        uploaded: boolean;
      }
    | undefined
  >(undefined);
  const editable = ['NOT_SUBMITTED', 'NEEDS_REVISION'].includes(item.status) && !submitted;
  const dirty = editable && content !== saved;
  const blocker = useBlocker(
    ({ nextLocation }) =>
      dirty &&
      !['/student/login', '/student/suspended', '/student/security/change-password'].includes(
        nextLocation.pathname,
      ),
  );
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function persist(text: string) {
    // Serialize writes; a slower old save must never overwrite newer text.
    setSaving(true);
    setSaveError(null);
    const operation = queue.current
      .catch(() => undefined)
      .then(() => write((o) => saveStudentHomeworkDraft(item.homeworkId, { content: text }, o)));
    queue.current = operation;
    void operation
      .then(
        () => {
          if (mounted.current) setSaved(text);
        },
        (error: unknown) => {
          if (mounted.current) setSaveError(error);
        },
      )
      .finally(() => {
        if (mounted.current && queue.current === operation) setSaving(false);
      });
    return operation;
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    if (!dirty || !editable) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void persistRef.current(content);
    }, 2000);
    return () => clearTimeout(timer.current);
  }, [content, dirty, editable]);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.size || file.size > 52_428_800 || files.length >= 20)
        return Promise.reject({ code: 'INVALID_FILE' });
      const mimeType = file.type || 'application/octet-stream';
      if (uploadIntent.current?.file !== file)
        uploadIntent.current = {
          file,
          key: crypto.randomUUID(),
          confirmKey: crypto.randomUUID(),
          uploaded: false,
        };
      const intent = uploadIntent.current;
      const presigned =
        intent.presigned ??
        (await write(
          (o) =>
            requestStudentHomeworkUpload(
              item.homeworkId,
              { fileName: file.name, fileSizeBytes: file.size, mimeType },
              o,
            ),
          intent.key,
        ));
      intent.presigned = presigned;
      if (!safeUrl(presigned.uploadUrl)) return Promise.reject({ code: 'INVALID_UPLOAD_URL' });
      // S3 gets neither session cookies nor CSRF; only the MIME header signed by the server.
      if (!intent.uploaded) {
        const response = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': mimeType },
          credentials: 'omit',
          signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) {
          if (response.status === 403) uploadIntent.current = undefined;
          return Promise.reject({
            code: response.status === 403 ? 'UPLOAD_EXPIRED' : 'UPLOAD_FAILED',
          });
        }
        intent.uploaded = true;
      }
      await write(
        (o) => confirmStudentHomeworkUpload(item.homeworkId, presigned.fileId, o),
        intent.confirmKey,
      );
      setFiles((current) => [...current, { fileId: presigned.fileId, fileName: file.name }]);
      uploadIntent.current = undefined;
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      clearTimeout(timer.current);
      await queue.current.catch(() => undefined);
      const body = { content, fileIds: files.map((f) => f.fileId) };
      return write((o) => submitStudentHomework(item.homeworkId, body, o), submitKey(body));
    },
    onSuccess: (result) => {
      setSubmitted(true);
      setIsLate(result.isLate);
      setSaved(content);
      void client.invalidateQueries({ queryKey: ['student'] });
    },
  });
  const busy = submit.isPending || upload.isPending;
  function send(event: FormEvent) {
    event.preventDefault();
    if (!busy && editable && content.trim()) submit.mutate();
  }
  return (
    <>
      <div className="detail-heading">
        <Status value={submitted ? 'SUBMITTED' : item.status} />
        {isLate && <span className="status status-needs_revision">Сдано с опозданием</span>}
      </div>
      <p className="preserve-lines">{item.description}</p>
      <p className="muted">
        {item.teacherName} · Сдать до {date(item.dueAt, true)}
      </p>
      {item.attachments.length > 0 && (
        <div>
          <h3>Вложения преподавателя</h3>
          <ul>
            {item.attachments.map((f) => (
              <li key={f.fileId}>
                {f.fileName} · {(f.fileSizeBytes / 1024).toFixed(0)} КБ
              </li>
            ))}
          </ul>
          <p className="muted">Доступные для скачивания файлы находятся в разделе «Материалы».</p>
        </div>
      )}
      {editable ? (
        <form onSubmit={send}>
          <fieldset disabled={busy}>
            <label>
              Твой ответ
              <textarea
                rows={9}
                value={content}
                maxLength={10000}
                required
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <p className="muted" role="status">
              {saving
                ? 'Сохраняем черновик…'
                : saveError
                  ? errorMessage(saveError)
                  : dirty
                    ? 'Изменения не сохранены'
                    : 'Черновик сохранён'}
            </p>
            {!!saveError && (
              <button type="button" onClick={() => void persist(content)}>
                Повторить сохранение
              </button>
            )}
            <label>
              Прикрепить файл
              <input
                type="file"
                disabled={busy || files.length >= 20}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && !busy) upload.mutate(file);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="muted">
              До 50 МБ на файл, до 20 файлов. Отправка доступна после завершения загрузки.
            </p>
            {upload.isPending && <p role="status">Загружаем и проверяем файл…</p>}
            <ErrorNotice error={upload.error} />
            {upload.isError && uploadIntent.current && (
              <button
                type="button"
                onClick={() => {
                  if (uploadIntent.current) upload.mutate(uploadIntent.current.file);
                }}
              >
                Повторить загрузку
              </button>
            )}
            <ul>
              {files.map((f) => (
                <li key={f.fileId}>
                  {f.fileName}{' '}
                  <button
                    type="button"
                    aria-label={`Убрать ${f.fileName}`}
                    onClick={() =>
                      setFiles((current) => current.filter((entry) => entry.fileId !== f.fileId))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <ErrorNotice error={submit.error} />
            <button className="primary" disabled={busy || !content.trim()} type="submit">
              {submit.isPending ? 'Отправляем…' : 'Сдать работу'}
            </button>
          </fieldset>
        </form>
      ) : (
        <p role="status">
          {submitted
            ? 'Работа сдана. Ждём комментарий преподавателя.'
            : 'Работа отправлена. Новую версию можно сдать после запроса доработки.'}
        </p>
      )}
      <h2>История версий</h2>
      {item.versions.length ? (
        <ol className="versions">
          {[...item.versions]
            .sort((a, b) => a.versionNumber - b.versionNumber)
            .map((v) => (
              <li key={v.versionNumber}>
                <h3>
                  Версия {v.versionNumber} <small>{date(v.submittedAt, true)}</small>
                </h3>
                <p className="preserve-lines">{v.content}</p>
                {v.teacherStatus && <Status value={v.teacherStatus} />}
                <p>{v.teacherComment ?? 'Комментарий преподавателя пока не добавлен'}</p>
                {v.attachments.map((f) => (
                  <p key={f.fileId}>{f.fileName}</p>
                ))}
              </li>
            ))}
        </ol>
      ) : (
        <Empty>Отправленных версий пока нет.</Empty>
      )}
      {blocker.state === 'blocked' && (
        <Modal title="Черновик ещё не сохранён" close={() => blocker.reset()}>
          <p>Дождитесь сохранения или вернитесь к заданию.</p>
          <button onClick={() => blocker.reset()}>Остаться</button>
          <button onClick={() => blocker.proceed()}>Уйти без сохранения</button>
        </Modal>
      )}
    </>
  );
}
export function HomeworkDetail() {
  const { id = '' } = useParams();
  const query = useStudentQuery(['homework-detail', id], (o) => getStudentHomeworkDetail(id, o));
  return (
    <>
      <Link to="/student/homework">← Все задания</Link>
      <h1>{query.data?.title ?? 'Домашнее задание'}</h1>
      <Panel title={query.data?.subjectName ?? 'Твоё задание'}>
        <QueryState query={query}>
          {query.data ? (
            <HomeworkEditor key={query.data.homeworkId} item={query.data} />
          ) : (
            <Empty>Задание не найдено или больше недоступно.</Empty>
          )}
        </QueryState>
      </Panel>
    </>
  );
}

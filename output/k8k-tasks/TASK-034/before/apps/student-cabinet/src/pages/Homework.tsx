import { useContext, useEffect, useRef, useState } from 'react';
import { sessionSignal } from '@online-school/account-ui';
import type { FormEvent } from 'react';
import {
  Link,
  useParams,
  useBlocker,
  useBeforeUnload,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  confirmStudentHomeworkUpload,
  getStudentHomework,
  getStudentHomeworkDetail,
  requestStudentHomeworkUpload,
  saveStudentHomeworkDraft,
  submitStudentHomework,
} from '@online-school/api-contracts';
import type {
  HomeworkItemDto,
  GetStudentHomeworkParams,
  SubmitHomeworkDto,
  SubmitResponseDto,
} from '@online-school/api-contracts';
import { read, useIntentKey, useStudentQuery, write } from '../api.js';
import {
  Button,
  ConfirmDialog,
  describeError,
  ListRow,
  Select,
  StateBoundary,
} from '@online-school/ui';
import { useMe } from '../Layout.js';
import { HomeworkStatus, useHomeworkCopy } from '../homework-copy.js';
import { homeworkReturn } from '../homework-navigation.js';
import { positivePage } from '../lesson-navigation.js';
import { formatStudentDate, StudentReadFreshness } from '../student-presentation.js';
import { Empty, ErrorNotice, Pager, Panel, QueryState, safeUrl } from '../components.js';
import { SubjectBack, subjectHref, useSubjectReturn } from './Subjects.js';

export function Homework() {
  const { text, locale, statusLabel } = useHomeworkCopy();
  const { timeZone } = useMe();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const fromSubject = useSubjectReturn();
  const detailHref = (id: string) => {
    const path = `/student/homework/${id}`;
    const query = new URLSearchParams({
      backTo: homeworkReturn(location.pathname + location.search),
    });
    if (fromSubject) query.set('fromSubjectId', fromSubject);
    return path + '?' + query;
  };
  const requestedStatus = params.get('status') ?? '';
  const status = ['NOT_SUBMITTED', 'SUBMITTED', 'REVIEWED', 'NEEDS_REVISION'].includes(
    requestedStatus,
  )
    ? requestedStatus
    : '';
  const page = positivePage(params.get('page'));
  const lessonId = params.get('lessonId') ?? undefined;
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { preventScrollReset: true });
  }
  const date = (value: string, time = false) => formatStudentDate(value, timeZone, time, locale);
  const query = useStudentQuery(['homework', status, page, lessonId ?? null], (o) =>
    getStudentHomework(
      {
        page,
        pageSize: 20,
        ...(lessonId ? { lessonId } : {}),
        ...(status ? { status: status as NonNullable<GetStudentHomeworkParams['status']> } : {}),
      },
      o,
    ),
  );
  return (
    <>
      <h1>{text('homework')}</h1>
      <SubjectBack id={fromSubject} />
      <p className="lead">{text('lead')}</p>
      <Select
        label={text('status')}
        containerClassName="filter"
        value={status}
        onChange={(e) => {
          change({ status: e.target.value, page: '1' });
        }}
      >
        <option value="">{text('all')}</option>
        {(['NOT_SUBMITTED', 'SUBMITTED', 'REVIEWED', 'NEEDS_REVISION'] as const).map((value) => (
          <option value={value} key={value}>
            {statusLabel(value)}
          </option>
        ))}
      </Select>
      <Panel title={text('yourTasks')}>
        <QueryState
          query={query}
          empty={query.data?.items.length === 0}
          emptyMessage={text('empty')}
        >
          {query.data?.items.length ? (
            <ul className="k8k-homework-list">
              {query.data.items.map((h) => (
                <ListRow
                  key={h.homeworkId}
                  title={
                    <Link className="k8k-student-link" to={detailHref(h.homeworkId)}>
                      {h.title}
                    </Link>
                  }
                  details={[
                    {
                      id: 'teacher',
                      label: text('teacher'),
                      value: h.subjectName + ' · ' + h.teacherName,
                    },
                    { id: 'assigned', label: text('assigned'), value: date(h.assignedAt) },
                    {
                      id: 'due',
                      label: text('due'),
                      value: h.dueAt ? date(h.dueAt, true) : text('noDeadline'),
                    },
                  ]}
                  actions={
                    <>
                      <HomeworkStatus value={h.status} />
                      {h.isLate && <p className="k8k-homework-late">{text('late')}</p>}
                    </>
                  }
                />
              ))}
            </ul>
          ) : (
            <Empty>{text('empty')}</Empty>
          )}
        </QueryState>
        {query.data && <Pager {...query.data} change={(next) => change({ page: String(next) })} />}
      </Panel>
    </>
  );
}
function HomeworkEditor({ item }: { item: HomeworkItemDto }) {
  const { text, locale } = useHomeworkCopy();
  const { timeZone } = useMe();
  const fresh = useContext(StudentReadFreshness);
  const answer = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const submittedNotice = useRef<HTMLParagraphElement>(null);
  const date = (value: string) => formatStudentDate(value, timeZone, true, locale);
  const { current: lease } = useRef(sessionSignal());
  const client = useQueryClient();
  const submitKey = useIntentKey();
  const [content, setContent] = useState(item.draftContent ?? ''),
    [saved, setSaved] = useState(item.draftContent ?? ''),
    [saveError, setSaveError] = useState<unknown>(null),
    [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<{ fileId: string; fileName: string }[]>([]),
    [receipt, setReceipt] = useState<{ versionNumber: number; isLate: boolean } | null>(null);
  const [draftSaved, setDraftSaved] = useState(item.draftContent !== null);
  const serverDraft = useRef(item.draftContent);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'pending' | 'unknown'>('idle');
  const [uploadPhase, setUploadPhase] = useState<'requesting' | 'uploading' | 'confirming' | null>(
    null,
  );
  const [checkMessage, setCheckMessage] = useState<'stillUnknown' | 'changedVersion' | null>(null);
  const submitLock = useRef(false);
  const uploadLock = useRef(false);
  const submitIntent = useRef<{ body: SubmitHomeworkDto; key: string; baseVersion: number }>();
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
  const pendingRead = !!receipt && (item.latestVersion?.versionNumber ?? 0) < receipt.versionNumber;
  const status = pendingRead ? 'SUBMITTED' : item.status;
  const isLate = pendingRead ? receipt.isLate : item.isLate;
  const editable = ['NOT_SUBMITTED', 'NEEDS_REVISION'].includes(status);
  const dirty = editable && content !== saved;
  useEffect(() => {
    const expired = serverDraft.current !== null && item.draftContent === null;
    serverDraft.current = item.draftContent;
    if (expired) {
      setDraftSaved(false);
      if (editable && submitPhase === 'idle') setSaved('');
    }
  }, [item.draftContent, editable, submitPhase]);
  const unsent = dirty || files.length > 0 || !!uploadIntent.current || submitPhase !== 'idle';
  function resourceDenied(error: unknown) {
    if (
      lease.aborted ||
      !error ||
      typeof error !== 'object' ||
      !('status' in error) ||
      error.status !== 403 ||
      !('code' in error) ||
      error.code !== 'HOMEWORK_FORBIDDEN'
    )
      return;
    const filter = { queryKey: ['student', 'homework-detail', item.homeworkId] };
    void client.cancelQueries(filter, { silent: true, revert: false });
    client
      .getQueryCache()
      .find(filter)
      ?.setState({
        data: undefined,
        dataUpdatedAt: 0,
        error: Object.assign(new Error('Forbidden'), error),
        status: 'error',
        fetchStatus: 'idle',
      });
  }
  const blocker = useBlocker(
    ({ nextLocation }) =>
      unsent &&
      !lease.aborted &&
      !['/student/login', '/student/suspended', '/student/security/change-password'].includes(
        nextLocation.pathname,
      ),
  );
  useEffect(() => {
    if (blocker.state === 'blocked' && !unsent) blocker.reset();
  }, [blocker, unsent]);
  useEffect(() => {
    if (receipt) submittedNotice.current?.focus({ preventScroll: true });
  }, [receipt]);
  useBeforeUnload((event) => {
    if (unsent && !lease.aborted) {
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
      .then(() => {
        if (lease.aborted || !mounted.current)
          return Promise.reject({ code: 'NETWORK_ERROR', status: 0, operation: 'write' });
        return write(
          (o) => saveStudentHomeworkDraft(item.homeworkId, { content: text }, o),
          undefined,
          lease,
        );
      });
    queue.current = operation;
    void operation
      .then(
        () => {
          if (lease.aborted) return;
          client.setQueryData<HomeworkItemDto>(
            ['student', 'homework-detail', item.homeworkId],
            (cached) => cached && { ...cached, draftContent: text },
          );
          if (mounted.current) setSaved(text);
          if (mounted.current) setDraftSaved(true);
        },
        (error: unknown) => {
          resourceDenied(error);
          if (mounted.current && !lease.aborted) setSaveError(error);
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
    if (!dirty || !editable || submitPhase !== 'idle') return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void persistRef.current(content);
    }, 2000);
    return () => clearTimeout(timer.current);
  }, [content, dirty, editable, submitPhase]);
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
      setUploadPhase('requesting');
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
          lease,
        ));
      intent.presigned = presigned;
      if (lease.aborted || !mounted.current) return;
      if (!safeUrl(presigned.uploadUrl)) return Promise.reject({ code: 'INVALID_UPLOAD_URL' });
      // S3 gets neither session cookies nor CSRF; only the MIME header signed by the server.
      if (!intent.uploaded) {
        setUploadPhase('uploading');
        const response = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': mimeType },
          credentials: 'omit',
          signal: AbortSignal.any([lease, AbortSignal.timeout(120_000)]),
        });
        if (!response.ok) {
          if (response.status === 403)
            uploadIntent.current = {
              file,
              key: crypto.randomUUID(),
              confirmKey: crypto.randomUUID(),
              uploaded: false,
            };
          return Promise.reject({
            code: response.status === 403 ? 'UPLOAD_EXPIRED' : 'UPLOAD_FAILED',
          });
        }
        intent.uploaded = true;
      }
      if (lease.aborted || !mounted.current) return;
      setUploadPhase('confirming');
      const confirmed = await write(
        (o) => confirmStudentHomeworkUpload(item.homeworkId, presigned.fileId, o),
        intent.confirmKey,
        lease,
      );
      if (lease.aborted || !mounted.current) return;
      if (confirmed.status !== 'VERIFIED' || confirmed.fileId !== presigned.fileId)
        return Promise.reject({ code: 'INVALID_RESPONSE', operation: 'write', status: 0 });
      setFiles((current) => [...current, { fileId: presigned.fileId, fileName: file.name }]);
      uploadIntent.current = undefined;
    },
    onError: (error) => {
      resourceDenied(error);
      if (
        !lease.aborted &&
        uploadIntent.current &&
        'code' in error &&
        error.code === 'UPLOAD_URL_EXPIRED'
      )
        uploadIntent.current = {
          file: uploadIntent.current.file,
          key: crypto.randomUUID(),
          confirmKey: crypto.randomUUID(),
          uploaded: false,
        };
    },
    onSettled: () => {
      uploadLock.current = false;
      if (!lease.aborted && mounted.current) setUploadPhase(null);
    },
  });
  async function inspectSubmission() {
    const intent = submitIntent.current!;
    const current = await read((o) => getStudentHomeworkDetail(item.homeworkId, o), lease);
    const expectedFiles = [...(intent.body.fileIds ?? [])].sort().join('|');
    const received = current.versions.some(
      (version) =>
        version.versionNumber > intent.baseVersion &&
        version.content === intent.body.content &&
        version.attachments
          .map((file) => file.fileId)
          .sort()
          .join('|') === expectedFiles,
    );
    const canRetry =
      (current.latestVersion?.versionNumber ?? 0) === intent.baseVersion &&
      ['NOT_SUBMITTED', 'NEEDS_REVISION'].includes(current.status);
    return { current, received, canRetry };
  }
  type Outcome = { result: SubmitResponseDto } | { current: HomeworkItemDto; received: boolean };
  function settleSubmission(outcome: Outcome) {
    if (lease.aborted) return;
    if ('current' in outcome) {
      client.setQueryData(['student', 'homework-detail', item.homeworkId], outcome.current);
      if (!outcome.received) {
        setSubmitPhase('unknown');
        setCheckMessage('changedVersion');
        return;
      }
      setReceipt({
        versionNumber: Math.max(
          ...outcome.current.versions.map((version) => version.versionNumber),
        ),
        isLate: outcome.current.isLate,
      });
    } else
      setReceipt({ versionNumber: outcome.result.versionNumber, isLate: outcome.result.isLate });
    setSubmitPhase('idle');
    setSaved(submitIntent.current!.body.content);
    setDraftSaved(false);
    setFiles([]);
    submitIntent.current = undefined;
    void client.invalidateQueries({ queryKey: ['student'] });
  }
  const submit = useMutation({
    mutationFn: async (
      retry: boolean,
    ): Promise<{ result: SubmitResponseDto } | { current: HomeworkItemDto; received: boolean }> => {
      clearTimeout(timer.current);
      await queue.current.catch(() => undefined);
      if (submitIntent.current && retry) {
        const inspected = await inspectSubmission();
        if (inspected.received || !inspected.canRetry)
          return { current: inspected.current, received: inspected.received };
      }
      const intent = submitIntent.current!;
      return {
        result: await write(
          (o) => submitStudentHomework(item.homeworkId, intent.body, o),
          intent.key,
          lease,
        ),
      };
    },
    onSuccess: settleSubmission,
    onError: (error) => {
      resourceDenied(error);
      if (lease.aborted || !mounted.current) return;
      const unknown = describeError(error, 'write').outcome === 'unknown';
      setSubmitPhase(unknown ? 'unknown' : 'idle');
      if (!unknown) submitIntent.current = undefined;
    },
    onSettled: () => {
      submitLock.current = false;
    },
  });
  const busy = submit.isPending || upload.isPending || submitPhase === 'pending';
  const unknown = submitPhase === 'unknown';
  function send(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || busy || !editable || !content.trim() || uploadIntent.current) return;
    if (!fresh && !unknown) return;
    const retry = unknown && !!submitIntent.current;
    if (!retry) {
      const body = { content, fileIds: files.map((file) => file.fileId) };
      submitIntent.current = {
        body,
        key: submitKey(body),
        baseVersion: item.latestVersion?.versionNumber ?? 0,
      };
    }
    submitLock.current = true;
    setSubmitPhase('pending');
    setCheckMessage(null);
    submit.mutate(retry);
  }
  async function checkResult() {
    if (!submitIntent.current || submitLock.current || lease.aborted) return;
    submitLock.current = true;
    setSubmitPhase('pending');
    try {
      const inspected = await inspectSubmission();
      if (lease.aborted) return;
      settleSubmission({ current: inspected.current, received: inspected.received });
      if (!inspected.received)
        setCheckMessage(inspected.canRetry ? 'stillUnknown' : 'changedVersion');
    } catch (error) {
      resourceDenied(error);
      if (!lease.aborted) {
        setSubmitPhase('unknown');
        setCheckMessage('stillUnknown');
      }
    } finally {
      submitLock.current = false;
    }
  }
  return (
    <div className="k8k-homework-editor">
      <div className="detail-heading">
        <HomeworkStatus value={status} />
        {isLate && <p className="k8k-homework-late">{text('late')}</p>}
      </div>
      <section className="k8k-homework-instruction">
        <h2>{text('instruction')}</h2>
        <p className="preserve-lines">{item.description}</p>
        <p>
          {item.teacherName} ·{' '}
          {item.dueAt ? text('due') + ' ' + date(item.dueAt) : text('noDeadline')}
        </p>
        {item.attachments.length > 0 && (
          <div>
            <h3>{text('teacherFiles')}</h3>
            <ul>
              {item.attachments.map((file) => (
                <li key={file.fileId}>
                  {file.fileName} · {(file.fileSizeBytes / 1024).toFixed(0)} KiB
                </li>
              ))}
            </ul>
            <p>{text('materialsHint')}</p>
          </div>
        )}
      </section>
      {editable || unknown ? (
        <form onSubmit={send} className="k8k-homework-form">
          <fieldset disabled={busy || unknown}>
            <label className="k8k-homework-answer">
              <span>{text('answer')}</span>
              <textarea
                ref={answer}
                rows={9}
                value={content}
                maxLength={10000}
                required
                aria-describedby="homework-answer-hint"
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
            <p id="homework-answer-hint">{text('answerHint')}</p>
            <p className="k8k-homework-save" role="status">
              {saving
                ? text('saving')
                : saveError
                  ? null
                  : dirty
                    ? text('dirty')
                    : draftSaved
                      ? text('saved')
                      : text('noDraft')}
            </p>
            <ErrorNotice error={saveError} />
            {!!saveError && (
              <Button
                variant="secondary"
                onClick={() => {
                  void persist(content);
                  answer.current?.focus({ preventScroll: true });
                }}
              >
                {text('retrySave')}
              </Button>
            )}
            <div className="k8k-homework-file">
              <Button
                variant="secondary"
                disabled={busy || files.length >= 20 || !fresh}
                onClick={() => fileInput.current?.click()}
              >
                {text('attach')}
              </Button>
              <input
                ref={fileInput}
                hidden
                type="file"
                aria-label={text('attach')}
                disabled={busy || files.length >= 20 || !fresh}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && !busy && !uploadLock.current) {
                    uploadLock.current = true;
                    upload.mutate(file);
                  }
                  event.target.value = '';
                }}
              />
            </div>
            <p>{text('limits')}</p>
            {uploadPhase && <p role="status">{text(uploadPhase)}</p>}
            {upload.error && 'code' in upload.error && upload.error.code === 'INVALID_FILE' ? (
              <p role="alert">{text('invalidFile')}</p>
            ) : upload.error &&
              'code' in upload.error &&
              ['UPLOAD_EXPIRED', 'UPLOAD_URL_EXPIRED'].includes(String(upload.error.code)) ? (
              <p role="alert">{text('uploadExpired')}</p>
            ) : (
              <ErrorNotice error={upload.error} />
            )}
            {upload.isError && uploadIntent.current && (
              <div className="k8k-homework-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (uploadIntent.current && !uploadLock.current) {
                      uploadLock.current = true;
                      upload.mutate(uploadIntent.current.file);
                    }
                  }}
                >
                  {text('retryUpload')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    uploadIntent.current = undefined;
                    upload.reset();
                  }}
                >
                  {text('cancelUpload')}
                </Button>
              </div>
            )}
            <ul className="k8k-homework-files">
              {files.map((file) => (
                <li key={file.fileId}>
                  <span>{file.fileName}</span>
                  <Button
                    variant="ghost"
                    aria-label={text('remove') + ' ' + file.fileName}
                    onClick={() =>
                      setFiles((current) => current.filter((entry) => entry.fileId !== file.fileId))
                    }
                  >
                    {text('remove')}
                  </Button>
                </li>
              ))}
            </ul>
          </fieldset>
          {submitPhase !== 'idle' && (
            <StateBoundary
              state={{ status: 'pending', outcome: unknown ? 'unknown' : 'pending' }}
            />
          )}
          {unknown && (
            <div className="k8k-homework-unknown">
              <p>{text('unknown')}</p>
              <Button variant="secondary" onClick={() => void checkResult()}>
                {text('check')}
              </Button>
              {checkMessage && <p role="status">{text(checkMessage)}</p>}
            </div>
          )}
          <ErrorNotice error={submit.error} />
          {!fresh && !unknown && <p role="status">{text('unavailable')}</p>}
          <Button
            type="submit"
            className="k8k-homework-submit"
            disabled={
              busy ||
              !editable ||
              checkMessage === 'changedVersion' ||
              !content.trim() ||
              !!uploadIntent.current ||
              (!fresh && !unknown)
            }
          >
            {submit.isPending ? text('sending') : text('send')}
          </Button>
        </form>
      ) : (
        <section>
          <p role="status" ref={submittedNotice} tabIndex={-1}>
            {status === 'REVIEWED'
              ? text('reviewed')
              : receipt
                ? text('submitted')
                : text('readonly')}
          </p>
          <p className="preserve-lines">{item.latestVersion?.content ?? content}</p>
        </section>
      )}
      <section aria-label={text('history')}>
        <h2>{text('history')}</h2>
        {item.versions.length ? (
          <ol className="versions">
            {[...item.versions]
              .sort((a, b) => a.versionNumber - b.versionNumber)
              .map((version) => (
                <li key={version.versionNumber}>
                  <h3>
                    {text('version')} {version.versionNumber}{' '}
                    <small>{date(version.submittedAt)}</small>
                  </h3>
                  <p className="preserve-lines">{version.content}</p>
                  {version.teacherStatus && <HomeworkStatus value={version.teacherStatus} />}
                  <p className="preserve-lines">{version.teacherComment ?? text('noComment')}</p>
                  {version.attachments.map((file) => (
                    <p key={file.fileId}>{file.fileName}</p>
                  ))}
                </li>
              ))}
          </ol>
        ) : (
          <Empty>{text('noVersions')}</Empty>
        )}
      </section>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={text('leaveTitle')}
        description={text('leaveHint')}
        confirmLabel={text('leave')}
        cancelLabel={text('stay')}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
        returnFocusRef={editable ? answer : submittedNotice}
        contentProps={{ className: 'k8k-role-student k8k-homework-confirm' }}
      />
    </div>
  );
}
export function HomeworkDetail() {
  const { text } = useHomeworkCopy();
  const [params] = useSearchParams();
  const fromSubject = useSubjectReturn();
  const { id = '' } = useParams();
  const query = useStudentQuery(['homework-detail', id], (o) => getStudentHomeworkDetail(id, o));
  return (
    <>
      <Link
        className="k8k-student-link"
        to={
          params.has('backTo')
            ? homeworkReturn(params.get('backTo'))
            : fromSubject
              ? subjectHref('/student/homework', fromSubject, 'fromSubjectId')
              : '/student/homework'
        }
      >
        ← {text('all')}
      </Link>
      <SubjectBack id={fromSubject} />
      <h1>{query.data?.title ?? text('task')}</h1>
      <Button variant="ghost" pending={query.isFetching} onClick={() => void query.refetch()}>
        {text('refresh')}
      </Button>
      <Panel title={query.data?.subjectName ?? text('yourTask')}>
        <QueryState query={query}>
          {query.data ? (
            <HomeworkEditor key={query.data.homeworkId} item={query.data} />
          ) : (
            <Empty>{text('notFound')}</Empty>
          )}
        </QueryState>
      </Panel>
    </>
  );
}

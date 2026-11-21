import { useEffect, useRef, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon } from '@online-school/ui';
import { CabinetError, request } from './contract.js';
import { CabinLink } from './Home.js';
import { useEndpoint } from './hooks.js';
import { LoadState } from './Operations.js';
import { studyStatus, useStudy } from './studentStudyCopy.js';
import type { StudyMessage } from './studentStudyCopy.js';
import { PrivateUpload } from './Workflows.js';

type Schemas = components['schemas'];
type Homework = Schemas['HomeworkItemDto'];
type Answer = Schemas['SubmitHomeworkDto'];
type Attachment = { id: string; name: string };
type Submission = { key: string; body: Answer; baseline: number };
type Feedback = { message: StudyMessage; error?: boolean };

function versionHistory(item: Homework) {
  return item.versions.length ? item.versions : item.latestVersion ? [item.latestVersion] : [];
}
function sameVersion(item: Homework, intent: Submission) {
  const ids = [...(intent.body.fileIds ?? [])].sort();
  return versionHistory(item).some((version) => {
    const files = version.attachments.map((file) => file.fileId).sort();
    return (
      version.versionNumber > intent.baseline &&
      version.content === intent.body.content &&
      files.length === ids.length &&
      files.every((file, index) => file === ids[index])
    );
  });
}

function uncertain(error: unknown) {
  return (
    !(error instanceof CabinetError) ||
    error.issue.status === 0 ||
    error.issue.status >= 500 ||
    error.issue.code === 'COMMAND_IN_PROGRESS'
  );
}

function HomeworkEditor({
  item,
  accepted,
  refreshAccess,
}: {
  item: Homework;
  accepted: () => void;
  refreshAccess: () => void;
}) {
  const { text } = useStudy();
  const id = item.homeworkId;
  const [answer, setAnswer] = useState(item.draftContent ?? '');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, setPending] = useState<Submission | null>(null);
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const action = useRef<AbortController | null>(null);
  const draftKey = useRef<{ content: string; key: string } | null>(null);
  useEffect(() => () => action.current?.abort(), []);

  function errorFor(error: unknown) {
    setFeedback({ message: 'assignmentError', error: true });
    if (error instanceof CabinetError && [401, 402, 403, 404].includes(error.issue.status))
      refreshAccess();
  }

  async function perform(intent: Submission | null, reconcile = false) {
    if (action.current || uploading) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    action.current = controller;
    setBusy(true);
    setFeedback(null);
    setChecked(false);
    try {
      if (reconcile && intent) {
        const current = await request<Homework>('getStudentHomeworkDetail', {
          params: { hwId: id },
          signal,
        });
        if (controller.signal.aborted) return;
        if (current.homeworkId === id && sameVersion(current, intent)) accepted();
        else {
          setChecked(
            current.homeworkId === id &&
              ['NOT_SUBMITTED', 'NEEDS_REVISION'].includes(current.status),
          );
          setFeedback({ message: 'notConfirmed' });
        }
      } else if (intent) {
        const result = await request<Schemas['SubmitResponseDto']>('submitStudentHomework', {
          params: { hwId: id },
          body: intent.body,
          key: intent.key,
          signal,
        });
        if (controller.signal.aborted) return;
        if (result.status === 'SUBMITTED' && result.versionNumber > intent.baseline) accepted();
        else {
          setPending(intent);
          setFeedback({ message: 'assignmentUnknown' });
        }
      } else {
        if (draftKey.current?.content !== answer)
          draftKey.current = { content: answer, key: crypto.randomUUID() };
        const result = await request<Schemas['SavedDraftDto']>('saveStudentHomeworkDraft', {
          params: { hwId: id },
          body: { content: answer },
          key: draftKey.current.key,
          signal,
        });
        if (controller.signal.aborted) return;
        setFeedback(
          result.status === 'SAVED' && result.homeworkId === id
            ? { message: 'saved' }
            : { message: 'assignmentError', error: true },
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!reconcile && intent && uncertain(error)) {
        setPending(intent);
        setFeedback({ message: 'assignmentUnknown' });
      } else {
        if (!reconcile) setPending(null);
        errorFor(error);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      action.current = null;
    }
  }

  const disabled = busy || !!pending;
  return (
    <div className="cab-assignment-editor">
      <label className="cab-form-label">
        <span>{text('answer')}</span>
        <textarea
          maxLength={10000}
          rows={7}
          value={answer}
          disabled={disabled}
          onChange={(event) => {
            setAnswer(event.target.value);
            setFeedback(null);
            setConfirming(false);
          }}
        />
      </label>
      {files.length < 20 && (
        <PrivateUpload
          homeworkId={id}
          disabled={disabled}
          onActivityChange={setUploading}
          uploaded={(file) => setFiles((old) => [...old, file])}
        />
      )}
      {!!files.length && (
        <ul className="cab-file-list">
          {files.map((file) => (
            <li key={file.id}>
              {file.name}
              <button
                type="button"
                className="cab-text-button"
                disabled={disabled}
                onClick={() => setFiles((old) => old.filter((row) => row.id !== file.id))}
              >
                ×{' '}
                <span className="cab-sr-only">
                  {text('removeFile')} {file.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {feedback && (
        <p
          role={feedback.error ? 'alert' : 'status'}
          className={feedback.error ? 'cab-form-error' : 'cab-detail-subtitle'}
        >
          {text(feedback.message)}
        </p>
      )}
      {pending ? (
        <div className="cab-form-actions">
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={busy}
            onClick={() => void perform(pending, true)}
          >
            {text('check')}
          </button>
          {checked && (
            <button
              type="button"
              className="cab-button cab-primary"
              disabled={busy}
              onClick={() => void perform(pending)}
            >
              {text('sendAgain')}
            </button>
          )}
        </div>
      ) : (
        <div className="cab-form-actions">
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={busy || uploading}
            onClick={() => void perform(null)}
          >
            {text('saveDraft')}
          </button>
          <button
            type="button"
            className="cab-button cab-primary"
            disabled={busy || uploading || !answer.trim() || confirming}
            onClick={() => {
              setFeedback(null);
              setConfirming(true);
            }}
          >
            {text('sendAssignment')}
          </button>
        </div>
      )}
      {confirming && !pending && (
        <div className="cab-confirm" role="group" aria-label={text('sendAssignment')}>
          <p>{text('confirmSend')}</p>
          <div className="cab-form-actions">
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {text('confirmSendNo')}
            </button>
            <button
              type="button"
              className="cab-button cab-primary"
              disabled={busy || uploading || !answer.trim()}
              onClick={() => {
                setConfirming(false);
                void perform({
                  key: crypto.randomUUID(),
                  body: { content: answer.trim(), fileIds: files.map(({ id }) => id) },
                  baseline: Math.max(
                    0,
                    ...versionHistory(item).map(({ versionNumber }) => versionNumber),
                  ),
                });
              }}
            >
              {text('confirmSendYes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileList({ files }: { files: readonly Schemas['HomeworkAttachmentDto'][] }) {
  const { locale } = useStudy();
  if (!files.length) return null;
  const bytes = new Intl.NumberFormat(locale, { style: 'unit', unit: 'byte' });
  return (
    <ul className="cab-file-list">
      {files.map((file) => (
        <li key={file.fileId}>
          {file.fileName} ·{' '}
          {file.fileSizeBytes < 1024
            ? bytes.format(file.fileSizeBytes)
            : Math.round(file.fileSizeBytes / 1024) + ' KiB'}
        </li>
      ))}
    </ul>
  );
}

export function StudentHomework({
  id,
  zone,
  navigate,
  refreshAccess,
}: {
  id: string;
  zone: string;
  navigate: (url: string) => void;
  refreshAccess: () => void;
}) {
  const { locale, text } = useStudy();
  const result = useEndpoint<Homework>('getStudentHomeworkDetail', { hwId: id });
  const [receipt, setReceipt] = useState(false);
  const item = result.data?.homeworkId === id ? result.data : null;
  const versions = item ? versionHistory(item) : [];
  const latestVersion = Math.max(0, ...versions.map(({ versionNumber }) => versionNumber));
  const editable = item && (item.status === 'NOT_SUBMITTED' || item.status === 'NEEDS_REVISION');
  const date = (value: string) => formatDateTime(value, locale, zone) ?? '—';
  function accepted() {
    setReceipt(true);
    result.refresh();
  }

  return (
    <div className="cab-lesson-layout">
      {receipt && (
        <p role="status" className="cab-empty">
          {text('assignmentSent')}
        </p>
      )}
      {!item ? (
        <LoadState error={result.error} refreshing={result.pending} retry={result.refresh} />
      ) : (
        <div className="cab-lesson-grid">
          <div className="cab-lesson-stack">
            <article className="cab-card cab-panel cab-detail cab-lesson-summary">
              <div className="cab-panel-title">
                <h2>{item.title}</h2>
                <span className="cab-status cab-tone-violet">{studyStatus(item.status, text)}</span>
              </div>
              <p className="cab-detail-subtitle">
                {item.subjectName} · {item.teacherName}
                {item.dueAt ? ' · ' + text('deadline') + ' ' + date(item.dueAt) : ''}
              </p>
              {item.isLate && <p className="cab-detail-subtitle">{text('late')}</p>}
              <p className="cab-long-copy">{item.description}</p>
              {!!item.attachments.length && (
                <div>
                  <h3>{text('assignmentFiles')}</h3>
                  <FileList files={item.attachments} />
                  <CabinLink
                    to="/student/materials"
                    navigate={navigate}
                    className="cab-inline-link"
                  >
                    {text('fileHint')} <Icon name="arrow" size={15} />
                  </CabinLink>
                </div>
              )}
              {editable && (
                <HomeworkEditor
                  key={id}
                  item={item}
                  accepted={accepted}
                  refreshAccess={refreshAccess}
                />
              )}
            </article>
          </div>
          <aside className="cab-lesson-stack">
            <section className="cab-card cab-panel">
              <div className="cab-panel-title">
                <h2>{text('versions')}</h2>
              </div>
              {versions.length ? (
                <ul className="cab-lesson-reports">
                  {[...versions]
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .map((version) => (
                      <li key={version.versionNumber}>
                        <strong>
                          {text('version')} {version.versionNumber}
                        </strong>
                        <time className="cab-detail-subtitle" dateTime={version.submittedAt}>
                          {date(version.submittedAt)}
                        </time>
                        <p className="cab-long-copy">{version.content}</p>
                        <FileList files={version.attachments} />
                        {version.teacherStatus ? (
                          <span className="cab-status cab-tone-violet">
                            {studyStatus(version.teacherStatus, text)}
                          </span>
                        ) : (
                          item?.status === 'SUBMITTED' &&
                          version.versionNumber === latestVersion && (
                            <span className="cab-status cab-tone-peach">
                              {text('awaitingReview')}
                            </span>
                          )
                        )}
                        {version.teacherComment && (
                          <div>
                            <strong>{text('review')}</strong>
                            <p className="cab-long-copy">{version.teacherComment}</p>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="cab-empty">{text('emptyVersions')}</p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

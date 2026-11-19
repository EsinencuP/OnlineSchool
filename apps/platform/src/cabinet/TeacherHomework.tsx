import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinLink } from './Home.js';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { homeworkPath, issueHomeworkUrl } from './recordRoutes.js';
import { homeworkStates, useHomeworkCopy } from './teacherHomeworkCopy.js';
import type { HomeworkCopy, HomeworkState } from './teacherHomeworkCopy.js';
import { HomeworkCommandFeedback } from './teacherHomeworkFlow.js';
import { CursorPager, TeacherRecordLoad, useCursorPages } from './teacherRecordControls.js';
import { TeacherHomeworkIssue } from './TeacherHomeworkIssue.js';

type Schemas = components['schemas'];
type Item = Schemas['TeacherHomeworkItemDto'];
type Card = Schemas['TeacherHomeworkCardDto'];
type Review = Schemas['ReviewHomeworkDto'];
type ReviewResponse = Schemas['ReviewHomeworkResponseDto'];
type Time = (instant: string) => string | null;
type Navigate = (url: string) => void;

const tones: Record<HomeworkState, string> = {
  NOT_SUBMITTED: 'violet',
  AWAITING_REVIEW: 'peach',
  NEEDS_REVISION: 'rose',
  REVIEWED: 'mint',
  CANCELLED: 'violet',
};

function readFilter(search: string) {
  const state = new URLSearchParams(search).get('state');
  return homeworkStates.find((value) => value === state);
}

function homeworkQuery(state?: HomeworkState) {
  return state ? '?' + new URLSearchParams({ state }) : '';
}

function Status({ state, t }: { state: HomeworkState; t: HomeworkCopy }) {
  return <span className={'cab-status cab-tone-' + tones[state]}>{t.states[state]}</span>;
}

function Due({ item, time, t }: { item: Item; time: Time; t: HomeworkCopy }) {
  return item.dueAt ? (
    <span>
      {t.dueAt} · <time dateTime={item.dueAt}>{time(item.dueAt)}</time>
    </span>
  ) : (
    <span>{t.noDue}</span>
  );
}

function HomeworkDirectory({
  state,
  time,
  navigate,
  t,
}: {
  state: HomeworkState | undefined;
  time: Time;
  navigate: Navigate;
  t: HomeworkCopy;
}) {
  const page = useCursorPages();
  const filterId = useId();
  const result = useEndpoint<Schemas['TeacherHomeworkPageDto']>(
    'getTeacherHomework',
    {},
    {
      limit: 20,
      ...(state ? { state } : {}),
      ...(page.cursor ? { cursor: page.cursor } : {}),
    },
  );
  return (
    <div className="cab-lesson-stack">
      <div className="cab-card cab-panel cab-teacher-homework-toolbar">
        <div className="cab-form-label">
          <label htmlFor={filterId}>{t.filter}</label>
          <select
            id={filterId}
            value={state ?? ''}
            onChange={(event) => {
              const next = homeworkStates.find((value) => value === event.target.value);
              navigate(homeworkPath + homeworkQuery(next));
            }}
          >
            <option value="">{t.all}</option>
            {homeworkStates.map((status) => (
              <option key={status} value={status}>
                {t.states[status]}
              </option>
            ))}
          </select>
        </div>
        <CabinLink to={issueHomeworkUrl()} navigate={navigate} className="cab-button cab-primary">
          <Icon name="tasks" size={17} /> {t.issue}
        </CabinLink>
      </div>
      {!result.data ? (
        <TeacherRecordLoad t={t} pending={result.pending} retry={result.refresh} />
      ) : result.data.items.length ? (
        <ul className="cab-teacher-homework-list">
          {result.data.items.map((item) => (
            <li className="cab-card cab-panel cab-teacher-homework-row" key={item.deliveryId}>
              <SubjectIcon subject={item.subjectName} compact />
              <div>
                <h2>
                  <CabinLink
                    to={
                      homeworkPath +
                      '/' +
                      encodeURIComponent(item.deliveryId) +
                      homeworkQuery(state)
                    }
                    navigate={navigate}
                    className="cab-inline-link"
                  >
                    {item.title}
                  </CabinLink>
                </h2>
                <p className="cab-detail-subtitle">
                  {item.studentName} · {item.subjectName}
                </p>
                <div className="cab-teacher-homework-meta">
                  <Due item={item} time={time} t={t} />
                </div>
              </div>
              <div className="cab-teacher-homework-meta">
                <Status state={item.state} t={t} />
                {item.isLate && <span>{t.late}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">{t.none}</p>
      )}
      <CursorPager page={page} next={result.data?.nextCursor} t={t} />
    </div>
  );
}

function ReviewForm({
  submissionId,
  t,
  busy,
  disabled,
  submit,
}: {
  submissionId: string;
  t: HomeworkCopy;
  busy: boolean;
  disabled: boolean;
  submit: (body: Review) => void;
}) {
  const resultId = useId();
  const [result, setResult] = useState<Review['result']>('ACCEPTED');
  const [validation, setValidation] = useState(false);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim();
    const length = [...comment].length;
    if ((comment || result === 'NEEDS_REVISION') && (length < 5 || length > 2000)) {
      setValidation(true);
      return;
    }
    setValidation(false);
    submit({ submissionId, result, ...(comment ? { comment } : {}) });
  }
  return (
    <form onSubmit={send}>
      <fieldset className="cab-fields cab-lesson-fields" disabled={disabled}>
        <div className="cab-form-label cab-lesson-note">
          <label htmlFor={resultId}>{t.result}</label>
          <select
            id={resultId}
            value={result}
            onChange={(event) => {
              setResult(event.target.value === 'NEEDS_REVISION' ? 'NEEDS_REVISION' : 'ACCEPTED');
              setValidation(false);
            }}
          >
            <option value="ACCEPTED">{t.results.ACCEPTED}</option>
            <option value="NEEDS_REVISION">{t.results.NEEDS_REVISION}</option>
          </select>
        </div>
        <label className="cab-form-label cab-lesson-note">
          <span>{t.comment}</span>
          <textarea
            name="comment"
            rows={4}
            minLength={5}
            maxLength={2000}
            required={result === 'NEEDS_REVISION'}
          />
        </label>
        {result === 'NEEDS_REVISION' && <p className="cab-detail-subtitle">{t.revisionNote}</p>}
        {validation && (
          <p role="alert" className="cab-form-error">
            {t.invalidComment}
          </p>
        )}
        <div className="cab-form-actions">
          <button type="submit" className="cab-button cab-primary">
            {busy ? t.submitting : t.saveReview}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function HomeworkCard({
  id,
  listUrl,
  time,
  navigate,
  t,
}: {
  id: string;
  listUrl: string;
  time: Time;
  navigate: Navigate;
  t: HomeworkCopy;
}) {
  const detail = useEndpoint<Card>('getTeacherHomeworkCard', { deliveryId: id });
  const card = detail.data?.deliveryId === id ? detail.data : null;
  const [saved, setSaved] = useState(false);
  const command = useCabinetCommand<Review, ReviewResponse, 'stale'>(
    'reviewTeacherHomework',
    (response, body) => {
      if (
        response?.deliveryId !== id ||
        response.submissionId !== body.submissionId ||
        response.result !== body.result
      )
        return false;
      setSaved(true);
      detail.refresh();
      return true;
    },
    (code) => {
      if (
        !['NOT_LATEST_SUBMISSION', 'HOMEWORK_ALREADY_REVIEWED', 'HOMEWORK_CANCELLED'].includes(code)
      )
        return undefined;
      detail.refresh();
      return 'stale';
    },
    { deliveryId: id },
  );
  const latest = card?.canReview && !card.submissions[0]?.review ? card.submissions[0] : undefined;
  return (
    <div className="cab-lesson-layout">
      <CabinLink to={listUrl} navigate={navigate} className="cab-inline-link">
        {t.list}
      </CabinLink>
      {saved && (
        <p role="status" className="cab-empty">
          {t.reviewed}
        </p>
      )}
      <HomeworkCommandFeedback t={t} command={command} />
      {!card ? (
        <TeacherRecordLoad t={t} pending={detail.pending} retry={detail.refresh} />
      ) : (
        <div className="cab-lesson-grid cab-teacher-homework-grid">
          <div className="cab-lesson-stack">
            <section className="cab-card cab-panel cab-lesson-stack">
              <div className="cab-panel-title">
                <h2>{card.title}</h2>
                <Status state={card.state} t={t} />
              </div>
              <p className="cab-detail-subtitle">
                {card.studentName} · {card.subjectName}
              </p>
              <div className="cab-teacher-homework-meta">
                <span>
                  {t.issuedAt} · <time dateTime={card.issuedAt}>{time(card.issuedAt)}</time>
                </span>
                <Due item={card} time={time} t={t} />
              </div>
              <p className="cab-long-copy cab-lesson-ref">{card.description}</p>
              {isRouteUuid(card.lessonId) && (
                <CabinLink
                  to={'/teacher/lessons/' + card.lessonId}
                  navigate={navigate}
                  className="cab-inline-link"
                >
                  {t.linkedLesson}
                </CabinLink>
              )}
            </section>
            <section className="cab-card cab-panel cab-lesson-stack">
              <div className="cab-panel-title">
                <h2>{t.history}</h2>
                {card.isLate && <span className="cab-status cab-tone-peach">{t.late}</span>}
              </div>
              {card.submissions.length ? (
                <ol className="cab-lesson-reports">
                  {card.submissions.map((submission) => (
                    <li key={submission.submissionId}>
                      <strong>
                        {t.version} {submission.version}
                      </strong>
                      <time className="cab-detail-subtitle" dateTime={submission.submittedAt}>
                        {time(submission.submittedAt)}
                      </time>
                      <p className="cab-long-copy">{submission.text || t.noText}</p>
                      {submission.review && (
                        <>
                          <span
                            className={
                              'cab-status cab-tone-' +
                              (submission.review.result === 'ACCEPTED' ? 'mint' : 'rose')
                            }
                          >
                            {t.outcomes[submission.review.result]}
                          </span>
                          <time
                            className="cab-detail-subtitle"
                            dateTime={submission.review.reviewedAt}
                          >
                            {time(submission.review.reviewedAt)}
                          </time>
                          {submission.review.comment && (
                            <p className="cab-long-copy">{submission.review.comment}</p>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="cab-detail-subtitle">{t.noSubmission}</p>
              )}
            </section>
          </div>
          {latest && (
            <section className="cab-card cab-panel">
              <h2>{t.review}</h2>
              <ReviewForm
                key={latest.submissionId}
                submissionId={latest.submissionId}
                t={t}
                busy={command.busy}
                disabled={command.unresolved || command.busy}
                submit={command.submit}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeacherHomework({
  detail,
  search,
  zone,
  navigate,
}: {
  detail?: string;
  search: string;
  zone: string;
  navigate: Navigate;
}) {
  const { locale, t } = useHomeworkCopy();
  const state = readFilter(search);
  const listUrl = homeworkPath + homeworkQuery(state);
  const time = (value: string) => formatDateTime(value, locale, zone);
  if (detail === 'new')
    return (
      <TeacherHomeworkIssue
        key={search}
        search={search}
        time={time}
        zone={zone}
        navigate={navigate}
        t={t}
      />
    );
  if (!detail)
    return (
      <HomeworkDirectory key={state ?? 'all'} state={state} time={time} navigate={navigate} t={t} />
    );
  if (isRouteUuid(detail))
    return (
      <HomeworkCard
        key={detail}
        id={detail.toLowerCase()}
        listUrl={listUrl}
        time={time}
        navigate={navigate}
        t={t}
      />
    );
  return (
    <div className="cab-lesson-layout">
      <CabinLink to={listUrl} navigate={navigate} className="cab-inline-link">
        {t.list}
      </CabinLink>
      <TeacherRecordLoad t={t} />
    </div>
  );
}

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { calendarDate, Icon, localDateTimeToIso } from '@online-school/ui';
import { CabinLink } from './Home.js';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { homeworkPath } from './recordRoutes.js';
import type { HomeworkCopy } from './teacherHomeworkCopy.js';
import { HomeworkCommandFeedback } from './teacherHomeworkFlow.js';
import { CursorPager, TeacherRecordLoad, useCursorPages } from './teacherRecordControls.js';

type Schemas = components['schemas'];
type Issue = Schemas['IssueHomeworkDto'];
type Issued = Schemas['IssueHomeworkResponseDto'];
type Material = Schemas['TeacherMaterialDto'];
type Enrollment = Schemas['TeacherEnrollmentDto'];
type Lesson = Schemas['TeacherLessonCardDto'] | Schemas['TeacherTodayLessonDto'];
type Time = (instant: string) => string | null;

function LessonPicker({
  initial,
  time,
  lesson,
  attach,
  t,
}: {
  initial: { pending: boolean; retry?: () => void } | null;
  time: Time;
  lesson: Lesson | null;
  attach: (lesson: Lesson | null) => void;
  t: HomeworkCopy;
}) {
  const [looking, setLooking] = useState(false);
  const [date, setDate] = useState('');
  const selectId = useId();
  const days = useEndpoint<Schemas['TeacherTodayResponseDto']>(
    looking && calendarDate(date) ? 'getTeacherToday' : null,
    {},
    { date },
  );
  function choose(value: string) {
    const item = days.data?.lessons.find((entry) => entry.lessonId === value);
    attach(item ?? null);
  }

  return (
    <div className="cab-lesson-stack">
      {lesson ? (
        <div className="cab-teacher-homework-toolbar">
          <p>
            {t.linkedLesson} · {lesson.studentName} · {lesson.subjectName} ·{' '}
            <time dateTime={lesson.startsAt}>{time(lesson.startsAt)}</time>
          </p>
          <button type="button" className="cab-text-button" onClick={() => attach(null)}>
            {t.removeLesson}
          </button>
        </div>
      ) : initial ? (
        <div className="cab-lesson-stack">
          {initial.pending ? (
            <TeacherRecordLoad t={t} pending />
          ) : (
            <p role="alert" className="cab-form-error">
              {t.invalidLesson}
            </p>
          )}
          <div className="cab-action-grid">
            {initial.retry && !initial.pending && (
              <button type="button" className="cab-text-button" onClick={initial.retry}>
                {t.retryRead}
              </button>
            )}
            <button type="button" className="cab-text-button" onClick={() => attach(null)}>
              {t.removeLesson}
            </button>
          </div>
        </div>
      ) : looking ? (
        <div className="cab-fields">
          <label className="cab-form-label">
            <span>{t.lessonDate}</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          {days.pending || days.error ? (
            <TeacherRecordLoad t={t} pending={days.pending} retry={days.refresh} />
          ) : days.data?.lessons.length ? (
            <div className="cab-form-label">
              <label htmlFor={selectId}>{t.chooseLesson}</label>
              <select id={selectId} value="" onChange={(event) => choose(event.target.value)}>
                <option value="">{t.chooseLesson}</option>
                {days.data.lessons.map((item) => (
                  <option key={item.lessonId} value={item.lessonId}>
                    {time(item.startsAt)} · {item.studentName} · {item.subjectName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            days.data && <p className="cab-detail-subtitle">{t.noLessons}</p>
          )}
        </div>
      ) : (
        <div>
          <button
            type="button"
            className="cab-button cab-secondary"
            onClick={() => setLooking(true)}
          >
            {t.lessonsOptional}
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialPicker({
  files,
  change,
  t,
}: {
  files: Material[];
  change: (files: Material[]) => void;
  t: HomeworkCopy;
}) {
  const [open, setOpen] = useState(false);
  const page = useCursorPages();
  const shelf = useEndpoint<Schemas['TeacherMaterialPageDto']>(
    open ? 'getTeacherMaterials' : null,
    {},
    { state: 'VERIFIED', limit: 20, ...(page.cursor ? { cursor: page.cursor } : {}) },
  );
  function toggle(file: Material) {
    if (files.some((item) => item.fileId === file.fileId)) {
      change(files.filter((item) => item.fileId !== file.fileId));
    } else if (files.length < 5) {
      change([...files, file]);
    }
  }
  const verified = shelf.data?.items.filter((file) => file.status === 'VERIFIED');
  const selectedOutsidePage =
    open && verified
      ? files.filter((file) => !verified.some((visible) => visible.fileId === file.fileId))
      : files;
  return (
    <div className="cab-lesson-stack">
      <details
        className="cab-homework-attachments"
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>{t.material}</summary>
        {open && (
          <div className="cab-lesson-stack">
            <p className="cab-detail-subtitle">{t.limitFiles}</p>
            {!verified ? (
              <TeacherRecordLoad t={t} pending={shelf.pending} retry={shelf.refresh} />
            ) : verified.length ? (
              <ul className="cab-homework-checklist">
                {verified.map((file) => {
                  const selected = files.some((item) => item.fileId === file.fileId);
                  return (
                    <li key={file.fileId}>
                      <label className="cab-lesson-checkbox">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!selected && files.length >= 5}
                          onChange={() => toggle(file)}
                        />
                        <span>{file.fileName}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="cab-detail-subtitle">{t.noFiles}</p>
            )}
            <CursorPager page={page} next={shelf.data?.nextCursor} t={t} />
          </div>
        )}
      </details>
      {selectedOutsidePage.length > 0 && (
        <ul className="cab-homework-checklist" aria-label={t.material}>
          {selectedOutsidePage.map((file) => (
            <li className="cab-teacher-homework-toolbar" key={file.fileId}>
              <span>{file.fileName}</span>
              <button
                type="button"
                className="cab-text-button"
                aria-label={t.remove + ' ' + file.fileName}
                onClick={() => toggle(file)}
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecipientPicker({
  enrolled,
  subjectId,
  selected,
  changeSubject,
  changeSelected,
  t,
}: {
  enrolled: Enrollment[];
  subjectId: string;
  selected: string[];
  changeSubject: (id: string) => void;
  changeSelected: (ids: string[]) => void;
  t: HomeworkCopy;
}) {
  const subjects = new Map(enrolled.map((item) => [item.subjectId, item.subjectName]));
  const subjectLabel = useId();
  if (!subjects.size) return <p className="cab-detail-subtitle">{t.noStudents}</p>;
  return (
    <>
      <div className="cab-form-label">
        <label htmlFor={subjectLabel}>{t.subject}</label>
        <select
          id={subjectLabel}
          value={subjectId}
          onChange={(event) => changeSubject(event.target.value)}
        >
          <option value="">{t.chooseSubject}</option>
          {[...subjects].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {subjectId && (
        <div className="cab-lesson-stack">
          <p className="cab-detail-subtitle">
            {t.studentLimit} · {selected.length}/20
          </p>
          <ul className="cab-homework-checklist" aria-label={t.students}>
            {enrolled
              .filter((row) => row.subjectId === subjectId)
              .map((row) => {
                const checked = selected.includes(row.enrollmentId);
                return (
                  <li key={row.enrollmentId}>
                    <label className="cab-lesson-checkbox">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selected.length >= 20}
                        onChange={() =>
                          changeSelected(
                            checked
                              ? selected.filter((id) => id !== row.enrollmentId)
                              : [...selected, row.enrollmentId],
                          )
                        }
                      />
                      <span>{row.studentName}</span>
                    </label>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </>
  );
}

export function TeacherHomeworkIssue({
  search,
  time,
  zone,
  navigate,
  t,
}: {
  search: string;
  time: Time;
  zone: string;
  navigate: (url: string) => void;
  t: HomeworkCopy;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<Material[]>([]);
  const [selectedLesson, setLesson] = useState<Lesson | null>(null);
  const [lessonRequested, setLessonRequested] = useState(() =>
    new URLSearchParams(search).has('lessonId'),
  );
  const [issued, setIssued] = useState<Issued | null>(null);
  const [validation, setValidation] = useState<
    'invalidText' | 'invalidDeadline' | 'invalidRecipients' | 'invalidLesson' | null
  >(null);
  const lessonIds = new URLSearchParams(search).getAll('lessonId');
  const lessonId =
    lessonIds.length === 1 && isRouteUuid(lessonIds[0]) ? lessonIds[0].toLowerCase() : null;
  const initial = useEndpoint<Schemas['TeacherLessonCardDto']>(
    lessonRequested && lessonId ? 'getTeacherLesson' : null,
    lessonId ? { id: lessonId } : {},
  );
  const lesson = lessonRequested
    ? initial.data?.lessonId === lessonId
      ? initial.data
      : null
    : selectedLesson;
  const enrollments =
    useEndpoint<Schemas['TeacherEnrollmentsResponseDto']>('getTeacherEnrollments');
  const available = enrollments.data?.items ?? [];
  const command = useCabinetCommand<Issue, Issued, 'materialUnavailable'>(
    'issueTeacherHomework',
    (result, body) => {
      if (
        !isRouteUuid(result?.id) ||
        !Array.isArray(result.deliveries) ||
        result.deliveries.length !== body.enrollmentIds.length
      )
        return false;
      const delivered = new Set(result.deliveries.map((item) => item.enrollmentId));
      if (
        !body.enrollmentIds.every((id) => delivered.has(id)) ||
        !result.deliveries.every((item) => isRouteUuid(item.deliveryId))
      )
        return false;
      setIssued(result);
      return true;
    },
    (code) => {
      if (code === 'HOMEWORK_ATTACHMENT_NOT_AVAILABLE') return 'materialUnavailable';
      if (code === 'HOMEWORK_ENROLLMENT_NOT_ASSIGNED' || code === 'ENROLLMENT_INACTIVE')
        enrollments.refresh();
      return undefined;
    },
  );
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollments.data || command.busy || command.unresolved) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const deadline = String(form.get('dueAt') ?? '');
    const dueAt = deadline ? localDateTimeToIso(deadline, zone) : null;
    const recipients = selected.map((id) =>
      available.find((row) => row.enrollmentId === id && row.subjectId === subjectId),
    );
    if (!title || !description) return setValidation('invalidText');
    if (deadline && (!dueAt || Date.parse(dueAt) <= Date.now()))
      return setValidation('invalidDeadline');
    if (lessonRequested && !lesson) return setValidation('invalidLesson');
    if (
      !recipients.length ||
      recipients.some((row) => !row) ||
      (lesson && !recipients.some((row) => row?.studentId === lesson.studentId))
    )
      return setValidation('invalidRecipients');
    setValidation(null);
    command.submit({
      title,
      description,
      enrollmentIds: selected,
      ...(dueAt ? { dueAt } : {}),
      ...(lesson ? { lessonId: lesson.lessonId } : {}),
      ...(files.length ? { attachmentFileIds: files.map((file) => file.fileId) } : {}),
    });
  }
  return (
    <div className="cab-lesson-layout">
      <CabinLink to={homeworkPath} navigate={navigate} className="cab-inline-link">
        {t.list}
      </CabinLink>
      {issued ? (
        <section className="cab-card cab-panel cab-lesson-stack">
          <h2 role="status">{t.success}</h2>
          <ul className="cab-homework-checklist">
            {issued.deliveries.map((item) => (
              <li key={item.deliveryId}>
                <CabinLink
                  to={homeworkPath + '/' + item.deliveryId}
                  navigate={navigate}
                  className="cab-inline-link"
                >
                  {available.find((row) => row.enrollmentId === item.enrollmentId)?.studentName ??
                    t.assignment}
                </CabinLink>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <form onSubmit={send} className="cab-lesson-stack">
          <HomeworkCommandFeedback t={t} command={command} />
          <fieldset
            className="cab-lesson-fields cab-lesson-stack cab-homework-issue-fields"
            disabled={command.busy || command.unresolved}
          >
            <div className="cab-lesson-grid cab-teacher-homework-grid">
              <section className="cab-card cab-panel cab-lesson-stack">
                <h2>{t.assignment}</h2>
                <label className="cab-form-label">
                  <span>{t.assignmentTitle}</span>
                  <input name="title" required maxLength={200} />
                </label>
                <label className="cab-form-label">
                  <span>{t.instructions}</span>
                  <textarea name="description" rows={5} required maxLength={5000} />
                </label>
                <label className="cab-form-label">
                  <span>
                    {t.dueAt} · {zone}
                  </span>
                  <input type="datetime-local" name="dueAt" />
                </label>
                <LessonPicker
                  initial={
                    lessonRequested
                      ? {
                          pending: initial.pending,
                          ...(lessonId ? { retry: initial.refresh } : {}),
                        }
                      : null
                  }
                  lesson={lesson}
                  time={time}
                  t={t}
                  attach={(next) => {
                    setLessonRequested(false);
                    setLesson(next);
                  }}
                />
                <MaterialPicker files={files} change={setFiles} t={t} />
              </section>
              <section className="cab-card cab-panel cab-lesson-stack">
                <h2>{t.students}</h2>
                {!enrollments.data ? (
                  <TeacherRecordLoad
                    t={t}
                    pending={enrollments.pending}
                    retry={enrollments.refresh}
                  />
                ) : (
                  <RecipientPicker
                    enrolled={available}
                    subjectId={subjectId}
                    selected={selected}
                    changeSelected={setSelected}
                    t={t}
                    changeSubject={(next) => {
                      setSubjectId(next);
                      setSelected([]);
                    }}
                  />
                )}
              </section>
            </div>
            {validation && (
              <p className="cab-form-error" role="alert">
                {t[validation]}
              </p>
            )}
            <div className="cab-form-actions">
              <button
                className="cab-button cab-primary"
                type="submit"
                disabled={!enrollments.data || !selected.length}
              >
                <Icon name="tasks" size={17} /> {command.busy ? t.submitting : t.issue}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}

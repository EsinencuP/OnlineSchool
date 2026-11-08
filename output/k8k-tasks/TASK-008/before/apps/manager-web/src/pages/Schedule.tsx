import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  listManagerSchedule,
  listManagerSubscriptions,
  createManagerLesson,
  rescheduleManagerLesson,
  cancelManagerLesson,
  setManagerLessonMeetLink,
  clearManagerLessonMeetLink,
} from '@online-school/api-contracts';
import type { ManagerLessonDto, ListManagerScheduleParams } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
import { useOptions } from '../hooks/use-options.js';
import { useManager } from '../session.js';
import {
  Badge,
  State,
  Dialog,
  FormShell,
  Input,
  Select,
  TextArea,
  Check,
  text,
  enumOptions,
  ErrorBox,
} from '../components/ui.js';
import { RescheduleForm } from '../components/business-forms.js';
import {
  displayTime,
  schoolDate,
  dateShift,
  weekStart,
  localToIso,
  localInput,
} from '../lib/time.js';
import { ru, label } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
const MEET = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
type Action =
  | { kind: 'create'; studentId: string }
  | { kind: 'reschedule' | 'cancel' | 'meet'; lesson: ManagerLessonDto };
export default function Schedule({ studentId: fixedStudent }: { studentId?: string }) {
  const me = useManager();
  const [params] = useSearchParams();
  const [date, setDate] = useState(schoolDate(me.timezone));
  const [view, setView] = useState('list');
  const [studentId, setStudentId] = useState(fixedStudent ?? params.get('studentId') ?? '');
  const [status, setStatus] = useState('SCHEDULED');
  const [kind, setKind] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [choosing, setChoosing] = useState(params.get('create') === 'true');
  const options = useOptions(fixedStudent);
  const start = view === 'week' ? weekStart(date) : date;
  const length = view === 'day' ? 1 : 7;
  const q: ListManagerScheduleParams = {
    ...(kind ? { kind: kind as 'REGULAR' | 'TRIAL' } : {}),
    from: localToIso(`${start}T00:00`, me.timezone)!,
    to: localToIso(`${dateShift(start, length)}T00:00`, me.timezone)!,
    ...(studentId ? { studentId } : {}),
    ...(status ? { status: status as NonNullable<ListManagerScheduleParams['status']> } : {}),
  };
  const query = useQuery({
    queryKey: ['manager', 'schedule', q],
    queryFn: ({ signal }) => read((o) => listManagerSchedule(q, o), signal),
  });
  const days = Array.from({ length }, (_, i) => dateShift(start, i));
  function newLesson() {
    if (studentId) setAction({ kind: 'create', studentId });
    else setChoosing(true);
  }
  return (
    <>
      <div className="page-heading">
        <h1>{ru.schedule}</h1>
        <button className="primary" type="button" onClick={newLesson}>
          + {ru.newLesson}
        </button>
      </div>
      <div className="filters">
        <Input
          name="calendarDate"
          label={ru.date}
          type="date"
          value={date}
          onChange={(e) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDate(e.target.value);
          }}
        />
        <Select
          name="view"
          label={ru.schedule}
          placeholder={false}
          value={view}
          options={[
            { id: 'day', label: ru.day },
            { id: 'week', label: ru.week },
            { id: 'list', label: ru.list },
          ]}
          onChange={(e) => setView(e.target.value)}
        />
        {!fixedStudent && (
          <Select
            name="studentId"
            label={ru.student}
            options={options.data?.students ?? []}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        )}
        <Select
          name="kind"
          label={ru.type}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={enumOptions(['REGULAR', 'TRIAL'])}
        />
        <Select
          name="lessonStatus"
          label={ru.status}
          options={enumOptions(['SCHEDULED', 'STAR_PENDING', 'CONDUCTED', 'CANCELLED', 'DISPUTED'])}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <button type="button" onClick={() => setDate(schoolDate(me.timezone))}>
          {ru.today}
        </button>
      </div>
      <div className="pagination">
        <button type="button" onClick={() => setDate(dateShift(date, -length))}>
          ← {ru.previous}
        </button>
        <strong>
          {start} — {dateShift(start, length - 1)}
        </strong>
        <button type="button" onClick={() => setDate(dateShift(date, length))}>
          {ru.next} →
        </button>
      </div>
      <p className="hint">{ru.leadHelp}</p>
      <State operational query={query} empty={query.data?.length === 0}>
        {(items) => (
          <div className={view === 'week' ? 'calendar week-view' : 'calendar list-view'}>
            {days.map((day) => (
              <section className="calendar-day" key={day}>
                <h2>
                  {new Intl.DateTimeFormat('ru-RU', {
                    timeZone: me.timezone,
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(localToIso(`${day}T12:00`, me.timezone)!))}
                </h2>
                {items
                  .filter((l) => localInput(l.startsAt, me.timezone).slice(0, 10) === day)
                  .map((l) => (
                    <article className="lesson-card" key={l.lessonId}>
                      <time>{displayTime(l.startsAt, me.timezone)}</time>
                      <Link className="record-title" to={routes.student(l.studentId)}>
                        {options.data?.students.find((s) => s.id === l.studentId)?.label ??
                          ru.student}
                      </Link>
                      <p>{l.teacherName}</p>
                      <Badge value={l.status} />
                      {l.kind === 'TRIAL' && (
                        <>
                          <Badge value="TRIAL" />
                          {l.trialBrief && (
                            <p>
                              <Link to={routes.lead(l.trialBrief.leadId)}>{ru.openLead}</Link> ·{' '}
                              {l.trialBrief.subjectName} · {l.trialBrief.level ?? ru.dash} ·{' '}
                              {label(l.trialBrief.audience)}
                              {l.trialBrief.ageYears
                                ? ` · ${ru.ageYears}: ${l.trialBrief.ageYears}`
                                : ''}
                              {l.trialBrief.grade ? ` · ${ru.grade}: ${l.trialBrief.grade}` : ''}
                            </p>
                          )}
                        </>
                      )}
                      {l.requiresApproval && <p className="warning">{ru.pendingApproval}</p>}
                      {l.meetLink && MEET.test(l.meetLink) && (
                        <a
                          className="button small"
                          href={l.meetLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ru.joinMeet}
                        </a>
                      )}
                      <div className="actions">
                        {l.status === 'SCHEDULED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAction({ kind: 'reschedule', lesson: l })}
                            >
                              {ru.reschedule}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAction({ kind: 'cancel', lesson: l })}
                            >
                              {ru.cancelLesson}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAction({ kind: 'meet', lesson: l })}
                            >
                              {ru.meet}
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        )}
      </State>
      {choosing && (
        <Dialog title={ru.selectStudent} close={() => setChoosing(false)}>
          <State query={options}>
            {(o) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = text(new FormData(e.currentTarget), 'student');
                  if (id) {
                    setAction({ kind: 'create', studentId: id });
                    setChoosing(false);
                  }
                }}
              >
                <Select name="student" label={ru.student} options={o.students} required />
                <button type="submit" className="primary">
                  {ru.continue}
                </button>
              </form>
            )}
          </State>
        </Dialog>
      )}
      {action && (
        <LessonAction
          key={action.kind + ('lesson' in action ? action.lesson.lessonId : action.studentId)}
          action={action}
          close={() => setAction(null)}
        />
      )}
    </>
  );
}
function LessonAction({ action, close }: { action: Action; close: () => void }) {
  const me = useManager();
  const command = useCommand();
  const studentId = action.kind === 'create' ? action.studentId : action.lesson.studentId;
  const options = useOptions(studentId);
  const [subscription, setSubscription] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [complete, setComplete] = useState<string | null>(null);
  const subscriptions = useQuery({
    queryKey: ['manager', 'subscriptions', studentId],
    queryFn: ({ signal }) => read((o) => listManagerSubscriptions(studentId, o), signal),
  });
  const root = action.kind === 'create' ? subscription : action.lesson.subscriptionId;
  const enrollment = subscriptions.data?.find((s) => s.id === root)?.enrollmentId;
  const teachers = Array.from(
    new Map(
      (
        options.data?.enrollments
          .filter((e) => !enrollment || e.id === enrollment)
          .flatMap((e) => e.teachers) ?? []
      ).map((t) => [t.id, t]),
    ).values(),
  );
  const title =
    action.kind === 'create'
      ? ru.newLesson
      : action.kind === 'reschedule'
        ? ru.reschedule
        : action.kind === 'cancel'
          ? ru.cancelLesson
          : ru.meet;
  const done = (result: ManagerLessonDto | undefined) => {
    if (result) setComplete(result.requiresApproval ? ru.pendingApproval : ru.saved);
  };
  return (
    <Dialog
      title={title}
      close={() => {
        if (!command.busy) close();
      }}
    >
      {complete ? (
        <>
          <p role="status">{complete}</p>
          <button type="button" onClick={close}>
            {ru.done}
          </button>
        </>
      ) : action.kind === 'reschedule' ? (
        <State query={options}>
          {() => (
            <RescheduleForm
              timezone={me.timezone}
              teachers={teachers}
              initialTime={localInput(action.lesson.startsAt, me.timezone)}
              busy={command.busy}
              error={command.error}
              submit={async (payload) =>
                done(
                  await command.run(payload, (o) =>
                    rescheduleManagerLesson(action.lesson.lessonId, payload, o),
                  ),
                )
              }
            />
          )}
        </State>
      ) : (
        <FormShell
          busy={command.busy}
          error={command.error}
          button={title}
          submit={async (f) => {
            if (action.kind === 'create') {
              const startsAt = localToIso(text(f, 'startsAt'), me.timezone);
              if (!startsAt) {
                setInvalid(true);
                return;
              }
              setInvalid(false);
              const payload = {
                teacherId: text(f, 'teacherId'),
                startsAt,
                durationMinutes: parseInt(text(f, 'durationMinutes'), 10) as 30 | 45 | 60 | 90,
                ...(subscription ? { subscriptionId: subscription } : {}),
              };
              done(await command.run(payload, (o) => createManagerLesson(studentId, payload, o)));
            }
            if (action.kind === 'cancel') {
              const payload = {
                reason: text(f, 'reason'),
                chargeable: f.has('chargeable'),
                overrideLateRule: f.has('overrideLateRule'),
                initiator: text(f, 'initiator') as 'STUDENT' | 'TEACHER' | 'ACADEMY',
              };
              done(
                await command.run(payload, (o) =>
                  cancelManagerLesson(action.lesson.lessonId, payload, o),
                ),
              );
            }
            if (action.kind === 'meet') {
              const url = text(f, 'url');
              if (url && !MEET.test(url)) {
                setInvalid(true);
                return;
              }
              setInvalid(false);
              done(
                url
                  ? await command.run({ url }, (o) =>
                      setManagerLessonMeetLink(action.lesson.lessonId, { url }, o),
                    )
                  : await command.run({ clear: true }, (o) =>
                      clearManagerLessonMeetLink(action.lesson.lessonId, {}, o),
                    ),
              );
            }
          }}
        >
          {action.kind === 'create' && (
            <>
              <p className="hint">{ru.leadHelp}</p>
              <State query={subscriptions}>
                {(s) => (
                  <Select
                    name="subscriptionId"
                    label={ru.subscriptions}
                    required
                    options={s
                      .filter((r) => r.status === 'ACTIVE')
                      .map((r) => ({
                        id: r.id,
                        label: `${options.data?.enrollments.find((e) => e.id === r.enrollmentId)?.label ?? ru.direction} · ${r.remainingLessons}`,
                      }))}
                    value={subscription}
                    onChange={(e) => setSubscription(e.target.value)}
                  />
                )}
              </State>
              <State query={options}>
                {() =>
                  teachers.length ? (
                    <Select
                      name="teacherId"
                      label={ru.teacher}
                      options={teachers}
                      required
                      key={subscription}
                    />
                  ) : (
                    <p className="warning">{ru.noTeachers}</p>
                  )
                }
              </State>
              <Input name="startsAt" label={ru.startsAt} type="datetime-local" required />
              <Select
                name="durationMinutes"
                label={ru.duration}
                required
                placeholder={false}
                defaultValue="60"
                options={[30, 45, 60, 90].map((n) => ({ id: String(n), label: String(n) }))}
              />
            </>
          )}
          {action.kind === 'cancel' && (
            <>
              <p>{ru.cancelConsequences}</p>
              <Select
                name="initiator"
                label={ru.initiator}
                options={enumOptions(['STUDENT', 'TEACHER', 'ACADEMY'])}
                required
                defaultValue="STUDENT"
              />
              <TextArea name="reason" label={ru.reason} minLength={3} maxLength={500} required />
              {action.kind === 'cancel' && action.lesson.kind !== 'TRIAL' && (
                <Check name="chargeable" label={ru.chargeable} />
              )}
              <Check name="overrideLateRule" label={ru.lateOverride} />
              <Check name="acknowledge" label={ru.acknowledge} required />
            </>
          )}
          {action.kind === 'meet' && (
            <>
              <Input
                name="url"
                label={ru.meetUrl}
                type="url"
                defaultValue={action.lesson.meetLink ?? ''}
                pattern={MEET.source}
              />
              <p className="hint">{ru.clearMeet}</p>
            </>
          )}
          <ErrorBox
            error={
              invalid
                ? {
                    code: 'VALIDATION_FAILED',
                    status: 422,
                    message: action.kind === 'meet' ? ru.invalidForm : ru.invalidTime,
                  }
                : null
            }
          />
        </FormShell>
      )}
    </Dialog>
  );
}

# Student lessons

`GET /api/v1/student/lessons` and
`POST /api/v1/student/lessons/:lessonId/reschedule-request` use the STU-01 session,
CSRF, context and active-access guards. A completely suspended account still gets
402, and an initial-password account gets 403. No teacher/staff MFA bypass or parent
account is added. Requests cannot select another Student.id through query/body data.

## List and calendar

Default period is `week`, page 1, pageSize 20 (maximum 100). Only the declared query
keys are allowed; duplicate/array/nested parameters, non-integers, unsafe offsets
and malformed dates are rejected. `month=YYYY-MM` selects the calendar, with page 1
and pageSize 62. Mixing that mode with pagination or a different period is a 400.
More than 62 calendar rows yields 422 CALENDAR_MONTH_LIMIT_EXCEEDED instead of
silently dropping lessons. Explicit `month=YYYY-MM&view=list` permits page/pageSize
for that same selected month. The default calendar contract keeps rejecting
pagination. Optional subjectId narrows the authenticated pupil's enrollments in
both modes and is applied before count/page. A foreign subject yields no owned rows.

StudentAccount now stores an IANA `timezone`, initially Europe/Chisinau. The trusted
context carries it internally. Today is local midnight to next local midnight;
week is ISO Monday to next Monday; month uses actual local calendar boundaries.
Temporal handles DST and converts boundaries to UTC. The upper bound is exclusive.
This does not use the API host's timezone or an arbitrary browser/query timezone.
Timezone preference editing belongs to the profile/security feature, not this task.

One parameterized SQL statement computes the filtered count and page from the same
statement snapshot. Non-archive lists sort ascending by scheduled_at/id; archive
sorts descending. Even an out-of-range page retains the true total. Neither list nor
calendar writes an outcome or spends a right.

The product's LessonAppointment maps to existing LessonOccurrence. CONDUCTED maps
to COMPLETED only with a confirmed actual outcome. CANCELLED remains CANCELLED.
A cancelled lesson is NO_SHOW only when its staff-confirmed report explicitly says
NOT_CONDUCTED and student_no_show=true. The new optional teacher report flag is
allowed only for NOT_CONDUCTED; confirmation uses the existing authorized staff
workflow. A teacher report alone, elapsed time or a note never proves no-show.
This classification adds no cancellation charge or attendance automation.

Lesson cards expose optional subjectId and originalScheduledAt from their existing
enrollment and occurrence. Original/current times identify a recorded move without
exposing staff reasons or marking the lesson conducted. Actual teacher/duration
and published quantitative balances come from the separate history read.

## Uncertain request result

GET `/api/v1/student/lessons/:lessonId/requests/:requestKey` checks the current
student and lesson scope, then reads the existing CRM task by its stable actor,
command type and original idempotency key. CREATED confirms only task creation.
Optional type selects the command namespace explicitly when an actor reused one
UUID in different commands. The UI always supplies it.
No committed task yields UNKNOWN, including an in-flight command. No body, staff
identity or other pupil's task is returned. This GET does not retry a command or
change attendance, rights or money.

The public enum also retains existing STAR_PENDING and DISPUTED so those real CRM
states are visible rather than being invented as completed/cancelled. An inconsistent
CONDUCTED record without a confirmed outcome is presented as DISPUTED. Archive
contains only COMPLETED/CANCELLED/NO_SHOW; unresolved records remain outside it.

## Buttons and permanent link

Meet uses the assignment link introduced in STU-02, without generating a new URL.
It requires SCHEDULED, an active matching teacher assignment/enrollment, an enabled
teacher/subject, paid remaining rights or an explicit limited director admission
for **that enrollment**, and no freeze. Only canonical HTTPS Meet URLs are exposed.
Access to one subject cannot open another subject's meeting.
Dashboard, list, calendar and detail share the eligibility SQL and response
projection. Assignment and enrollment scope cover the scheduled slot and the
read time. Each lesson card provides `meetAsOf` for that server snapshot.

canJoin uses exact milliseconds, including the endpoints at 10 minutes before and
60 minutes after scheduled start. A past, unresolved SCHEDULED lesson therefore
stays joinable within that hour; terminal/STAR_PENDING/DISPUTED never do. Outside
the window canJoin=false and meetLink=null. No response cache delays a button change.
canRequestReschedule requires SCHEDULED and at least 86,400,000ms until the lesson.

## Addressed reschedule request

POST accepts only a nonblank reason (at most 500 characters) and a real ISO
date-only preferredDate, today or later in the student's timezone. CSRF and UUID
Idempotency-Key headers are required. It returns 201 with `{crmTaskId,status:'CREATED'}`.

The lesson scope guard verifies ownership and installs a transactional authorizer.
CriticalCommand re-resolves the session and student access/initial-password stage,
and rechecks ownership inside its SERIALIZABLE transaction, including cached replay.
The service locks the lesson before checking its current status and the exact 24h
threshold against database time. A foreign/unknown lesson is 403; a closed window
or non-SCHEDULED status is 422.

StudentCrmTaskService creates type RESCHEDULE_REQUEST with an actual lesson FK,
Student.id, reason/preferredDate payload, and the active assigned manager (or an
unassigned task if none exists). Its due date is now. The existing critical command
pipeline writes mandatory AuditEvent and outbox in the same transaction. New command
metadata preserves 201 on replay and identifies crmTaskId as the audit/event resource.
Existing commands retain their default 200 and `id` behavior. Any audit/outbox failure
rolls the task and idempotency result back. Identical replay returns one task; a
different payload with the same key is 422. This does not change the lesson's date,
status, money or rights: a manager still decides and applies an approved move.

Worker observes `student.lesson.reschedule-requested.v1`; it does not recreate the
already committed task or dead-letter an unknown event. Reason/preferredDate stay in
the private task payload, not in the outbox notification or logs.
The same handler registry now also recognizes STU-01's existing
`student.password.change.v1` event, which previously had no registered observer.

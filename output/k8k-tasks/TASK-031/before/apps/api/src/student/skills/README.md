# STU-08 — «Мой путь знаний»: карта навыков

Read-only student routes use the STU-01 server context (`Student.id`), STUDENT
role, changed initial password and active cabinet access. No client-supplied
student ID is accepted and no skill mutation route exists in this namespace.
The shared pupil/family login and existing cookie sessions are preserved.

## API

- `GET /api/v1/student/skills`: `SubjectSkillMapDto[]` for all enrolled subjects,
  including historical enrollments and subjects with an empty skill catalog.
  Optional `subjectId` filters that array to one owned subject. An unknown/foreign
  subject returns the same 403 `SKILLS_FORBIDDEN`; no subjects returns `[]`.
- `GET /api/v1/student/skills/audit?skillId=…&page=1&pageSize=20`:
  `SkillAuditResponseDto`. History across the pupil's enrollments, newest first,
  ordered by `changed_at DESC, id DESC`. Unknown and foreign personal skills have
  the same 403. An owned unassessed skill has empty history.
- `GET /api/v1/student/skills/snapshots?page=1&pageSize=20`:
  `SkillSnapshotResponseDto` with `items`, `total`, `page`, `pageSize`. Immutable
  confirmed snapshots, newest first by `created_at DESC, id DESC`, including
  prior enrollments. A page past the end keeps the full `total`.

Paging defaults are 1/20, with pageSize at most 100. Unknown parameters, repeated
parameters, invalid UUIDs and malformed pagination are rejected. OpenAPI and the
generated client include all three routes. Responses are private `no-store`.

## Read projections and privacy

Public skill statuses are exactly `NOT_STUDIED`, `FAMILIARIZING`, `PRACTICING`,
`APPLYING`. Existing storage `INTRODUCING` maps to `FAMILIARIZING`. An absent
assessment maps to `NOT_STUDIED`; an explicit reset also uses `NOT_STUDIED`.
No ratings, percentages, badges or automatic advancement are introduced.
Current assessment selection includes earlier enrollments of the same pupil
and subject. A lesson-linked assessment needs confirmed conducted evidence.

An unassessed skill uses its actual catalog creation timestamp for
`lastUpdatedAt` and an empty teacher name. An uncategorized catalog entry has an
empty category; neither a teacher nor a category is fabricated. Personal skills
use `SkillEntry.student_id`; other pupils' entries are excluded from the map,
audit and dashboard counters. Catalog ownership/subject cannot be reassigned.

`SkillAssessment.basis` remains internal pedagogical information. Only the new
optional `public_comment` may enter the student audit and frozen snapshot.
Snapshot names and public comments are stored at confirmation, never rebuilt
from today's mutable catalog. New audit entries store the teacher/skill display
names at the change. Historical backfill uses known assessment IDs, timestamps,
states and the display names available at migration time; earlier names and
unrecorded public comments cannot be recovered and are not invented.

Goals are textual and teacher-authored. The model retains ACTIVE, ACHIEVED,
PAUSED, ARCHIVED and an immutable before/after revision journal. Student DTOs
show non-archived goals and `isAchieved` only for ACHIEVED. Target dates are
calendar dates (`date`), not host-timezone timestamps.

## Confirmed lesson counter and teacher integration

`nextSnapshotIn = 4 - (confirmedConductedLessons % 4)` independently per subject,
giving 4/3/2/1 and 4 at zero or an exact multiple of four. The projection joins
`LessonActualOutcome` to `LessonOccurrence` with actual `CONDUCTED` status.
Cancelled/corrected-away, missed, unconfirmed and other pupils' lessons do not
count. All enrollments in that subject are included, so a new subscription,
teacher replacement or study break does not reset the counter.

The prepared migration creates `SkillAuditLog` in the same transaction as every
new immutable `SkillAssessment` revision. It serializes a pupil's skill changes,
checks the assigned enabled teacher, rejects future/out-of-order changes and
stale revision links, and permits justified downgrades and explicit resets.
Failure to create the audit rolls back the assessment. Runtime has SELECT-only
access to the audit, frozen snapshots and goal history.

`ProgressCheckpoint` continues to distinguish LESSON_4 from LESSON_8. Its context
guard now checks the confirmed subject count across enrollments. The future
teacher command confirms a review with `completed_at`, `completed_by` and
optional `teacher_summary`; only its assigned enabled teacher may confirm it.
Confirmation of LESSON_4 atomically freezes one `SkillSnapshot`; later changes
cannot overwrite it. Unconfirmed drafts and legacy completed checkpoints with
unknown confirming teacher are not fabricated into snapshots. The existing
eight-lesson EducationReport model is preserved and is not replaced with a
second required report every four lessons.

This task supplies student reads and storage hooks. Teacher HTTP commands,
automatic checkpoint creation, the working-day calendar, 2/3-day deadlines,
reminders and manager escalation still require the teacher/report workflow.
No student GET performs any of those writes or changes a skill status.
CON-07/B's 4/8 cadence and deadlines remain requirements for that workflow.

## Verification and release boundary

Two additive migrations are prepared: `20261027160000_stu08_skill_level` and
`20261027160100_stu08_skills`. The enum extension is committed separately. No
existing migration is rewritten, and no STU-08 migration has been applied to
the working database. Do not publish this API before its schema is deployed
through an authorized release; earlier pending STU migrations still apply.

Targeted API/SDK compilation, 45 unit/actual Nest HTTP cases and changed-file
lint passed. SQL/PLpgSQL syntax was parsed offline. The 21 source-exact SQL CTE
cases are prepared in `tests/integration/student-skills-readonly.test.mjs`.
They run only with an explicit `STU_READONLY_DATABASE_URL`, inside BEGIN READ
ONLY, shadowing source tables with CTE fixtures and rolling back afterwards.

Actual PostgreSQL execution was deferred by the owner's explicit answer on
27.10.2026: «Завершить с отложенной PostgreSQL-проверкой». The connected Neon
session cannot authorize the working project, and Node cannot read its existing
private runtime file (EPERM). No alternate database, branch or container was
created; no secret was copied or bypassed. Mock tests and syntax parsing do not
prove SQL binding, row isolation or trigger execution on PostgreSQL.

Actual migrations, trigger rollback/immutability/concurrency tests, teacher
confirmation and student working acceptance remain pending. See
`infra/STU08_EVIDENCE.json`. STU-08 does not close FND-GATE or grant production GO.

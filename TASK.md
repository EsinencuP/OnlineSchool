# TASK — TEACH-05: teacher roster and skill map (assess a skill)

Outcome: a teacher sees who they currently teach (and the enrollment ids every teacher command needs),
reads a student's skill map and records a skill level change that the student then sees in "Мой путь знаний".

In scope:
- `GET /api/v1/teacher/enrollments` — active enrollments with an active assignment to the teacher
  (student, subject, confirmed lessons in the subject, next lesson). ≤ 200 rows.
- `GET /api/v1/teacher/enrollments/:enrollmentId/skills` — subject catalog (global + the student's personal skills)
  with the current public status (`NOT_STUDIED|FAMILIARIZING|PRACTICING|APPLYING`), same "current" rule as the student map
  (latest assessment across the student's enrollments of the subject).
- `POST /api/v1/teacher/enrollments/:enrollmentId/skills/:skillId/assessments` (critical command): new level, internal
  `basis`, optional student-visible `publicComment`, optional confirmed `lessonId`. Computes version/supersedes itself; unchanged level → 409.
- `GET /api/v1/teacher/enrollments/:enrollmentId/skills/:skillId/history` — audit trail, newest first (≤ 50).
- Migration: runtime role gets INSERT on `skill_assessments` (audit row is written by the existing SECURITY DEFINER trigger).
Out of scope: 4-lesson checkpoints, 8-lesson reports, learning goals, skill catalog admin, frontend, orval client.

Acceptance:
1. Only the actively assigned teacher reads/assesses; foreign enrollment/role → 404/403; archived/foreign-subject skill → 404.
2. Student-side `GET /student/skills` logic (same SQL rules) shows the new status; audit has from/to, teacher, public comment.
3. Replay of the same Idempotency-Key creates one assessment; sequential changes chain via supersedes/version.
4. PostgreSQL 18 integration tests, API+worker build, OpenAPI regenerated.

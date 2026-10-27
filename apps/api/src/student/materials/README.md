# STU-06 — Issued student materials

Status: source implementation and targeted checks pass; working migration/deployment and complete acceptance remain pending FND-GATE. No additional database, Neon branch, QA environment or storage credential is provisioned by this increment.

## API

- `GET /api/v1/student/materials?subjectId=<uuid>&page=1&pageSize=30` returns `{ items, total, page, pageSize }`. Page size is 1–100. Newest sharing time first, then file ID for stable ordering. The list contains metadata only, without bucket, object key or URL.
- `GET /api/v1/student/materials/:fileId/url` returns `{ url, expiresAt, fileName }` only after current authorization. Default maximum lifetime: 900 seconds. A grant expiring sooner shortens the URL lifetime rather than extending the permission. Missing, revoked, expired, foreign and unavailable-file permissions all return `FILE_ACCESS_DENIED` / 403, without revealing whether a guessed ID exists.

These GET routes use the normal student session cookie, active-access and forced-password-change guards. Students do not use WebAuthn. There is no CSRF or Idempotency-Key requirement for GET; issuing a capability appends audit evidence and does not change business access rights. Responses are `Cache-Control: no-store`.

## Explicit ownership and source mapping

The existing `FilePermission.subject_id` is the recipient **AuthAccount.id**, not a school subject or registry Student.id. Each query matches the session `userId`, `subject_type = STUDENT`, and the `StudentAccount` link to `studentProfileId`. Knowing another student's file ID provides no access. A teacher grant is explicit: `granted_by` must resolve to a TeacherAccount. Assignment, enrollment, subscription or possession of an upload does not implicitly share a file.

Only unrevoked grants already effective at server time and not expired are visible. Objects must be VERIFIED and already uploaded. Historical teacher names are preserved: a teacher's later deactivation does not silently revoke a student's explicit material permission. Revocation/expiry remains authoritative. PDF, image, video and office-document MIME metadata is passed through without manufacturing preview or public URLs.

The additive migration gives FilePermission optional `educational_subject_id`, `lesson_occurrence_id` and teacher-supplied `lesson_title`. This distinguishes the academic subject from the recipient field and attaches context to the particular student's grant. Foreign keys, lesson/student/subject consistency and teacher-assignment context guards protect new contextual grants. Existing grant immutability requires revoking/reissuing rather than changing ownership or educational context in place.

Legacy contextless grants are retained. They display `subjectName = 'Без предмета'`, `lessonTitle = null`, and use `'Материал'` if their original filename was not recorded. No subject, lesson title, filename derived from a private key, or historical backfill is invented. A subject filter matches only the explicit academic context. Defensive SELECT predicates also reject a foreign lesson/context even if supplied by an invalid imported row.

## Private Signed GET

The endpoint revalidates the session and student profile inside its transaction, then locks the current permission and object with `FOR SHARE` while signing and writing FileAuditLog. This serializes issuance with permission revocation and object quarantine. A failed audit transaction never returns a URL. Correlation `X-Request-ID` may be reused, so each actual issuance has a separate event identity. Neither the signed URL nor raw object key enters audit, outbox or idempotency storage.

The existing private-storage adapter signs a GetObject command, with HTTPS, path-style addressing, UTF-8 filename and `private, no-store` response overrides. The list never signs URLs. The separate authorized URL response necessarily carries the signed object's path inside its capability; there is no independent `s3Key`, bucket or unsigned-link field. The existing private bucket and server-only Vercel credentials from STU-05 are reused. No credentials are exposed to the frontend or CI.

The existing FilePermission itself grants READ. Unless the owner selects a stricter rule, `can_download=false` uses inline presentation and a VIEW audit event; true selects attachment presentation and DOWNLOAD. An inline browser response is readable bytes, not DRM or a guarantee against saving. This interpretation follows the requested READ endpoint; the optional owner clarification is tracked separately.

Revocation blocks new URL issuance immediately at the API. An already issued standalone S3 capability remains usable until its expiry; an application DB update cannot recall it. A request begun before expiry may finish afterward. These are [S3 presigned URL semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html); [Neon supports signed GET and response header overrides](https://neon.com/docs/storage/s3-compatibility). This increment does not promise an online authorization check for each S3 byte request.

## Evidence and boundaries

`pnpm test:stu06` runs 46 unit/actual Nest HTTP cases with mock Prisma/storage. Coverage includes session/role/activation, two student accounts, current permissions, revocation between guard and issuance, subject filter, pagination, stale/future/unverified objects, sanitized audit failure, signature TTL/UTF-8 disposition/no-store and expiry bounded by permission.

Seventeen exact-source SELECT projection/policy cases were executed as app_runtime on the existing working PostgreSQL 18.6 using fictional CTE-only rows. They prove metadata/predicate behavior without DML, DDL or persistent fixtures. CTEs are not lockable base tables, so the predicate check removes `FOR SHARE`; actual lock/revocation races remain pending. An optional reproducible read-only test is `tests/integration/student-materials-readonly.test.mjs` with an explicitly supplied `STU_READONLY_DATABASE_URL`.

The GET signer is verified using the actual AWS SDK with dummy credentials. No fresh working-object download/15-minute network expiry test is claimed by this increment. STU-05's earlier real private-storage smoke remains separate evidence. Full working-session material acceptance requires the prepared student migrations and real grants; no alternate database or destructive test suite is used to bypass FND-GATE.

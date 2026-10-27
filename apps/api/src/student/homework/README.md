# STU-05 — Student homework

Status: implemented in source; working migration/deployment and full PostgreSQL write/concurrency acceptance remain pending FND-GATE. This increment uses the existing working environment and does not provision a QA database, branch or container.

## Routes and identity

All routes are under `/api/v1/student/homework`. They use the existing server session, STUDENT role, forced-password-change and active-access guards. Students do not use WebAuthn. Each mutation requires `X-CSRF-Token` and a UUID `Idempotency-Key`; a new draft edit uses a new key. Ownership is checked before execution and again inside the SERIALIZABLE critical transaction, including cached replay.

| Method | Path | Result |
|---|---|---|
| GET | `?page=1&pageSize=20&status=...` | Newest-first `{ items, total, page, pageSize }`, optional status, maximum page size 100 |
| PATCH | `/:hwId/draft` | Overwrites one server draft; `{ homeworkId, status: 'SAVED', expiresAt }` |
| POST | `/:hwId/upload-url` | Creates PENDING `S3Object`; `{ fileId, uploadUrl }`, PUT expiry 900 seconds |
| POST | `/:hwId/files/:fileId/confirm` | Checks actual uploaded bytes/type and seals final object; `{ fileId, status: 'VERIFIED' }` |
| POST | `/:hwId/submit` | Creates a version and erases the draft; `{ submissionId, status: 'SUBMITTED', isLate, versionNumber }` |

`hwId` is the existing `HomeworkDelivery.id`, not the shared assignment ID. Owner identity comes from `StudentSubjectEnrollment.student_id` and the session context. Read SQL filters that identity before pagination and excludes withdrawn, future and archived assignments. The response contains no storage key, bucket, grading value or presigned download URL. Financial records are untouched.

## Lifecycle and persistence

Existing `HomeworkSubmission` rows already represent versions. `SubmissionReview.result = ACCEPTED` maps to `REVIEWED`; `NEEDS_REVISION` maps directly. No review means `SUBMITTED`; no submission means `NOT_SUBMITTED`. The latest review of the latest version determines list status. Older versions and their text comments remain visible. New versions are allowed only initially or after NEEDS_REVISION; SUBMITTED and REVIEWED return 409 for a new command. The same command key replays the original result.

Each write locks the delivery. Version numbers advance by exactly one and point to the previous submission. Existing append-only triggers preserve submissions/reviews; the prepared migration adds version-chain, owned confirmed attachment and latest-version review guards. Review insertion locks the same delivery. A submission attachment can be inserted only in the transaction that creates its version. Numeric grades are not introduced or exposed. The pre-existing nullable textual `SubmissionReview.grade` column is retained for historical compatibility; new review inserts must leave it null.

The deadline is soft, including null deadlines. Lateness compares server submission time with the delivery due time; equality is on time. Assignment descriptions support existing JSON text/description content, and new answer JSON stores `{ text }` without losing whitespace.

`HomeworkDraft` has one primary key per delivery. Saving overwrites its content and refreshes a 30-day server expiry. Expired drafts are hidden immediately by the list query. The standalone worker clears expired plaintext in batches of 100 using SKIP LOCKED, at most once a minute. Submission clears plaintext and expires the row in the same critical transaction; no runtime DELETE permission is needed. Client debounce (2 seconds) belongs to the future student frontend.

## Private direct uploads

Server configuration: `S3_ENDPOINT` (HTTPS), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`. Keys are server only. The working project uses one private `online-school-files` bucket on its existing Neon main branch. Production Vercel variables were added without triggering a deployment; sensitive variables are not available to CI. CORS allows the existing permanent origin `https://onlineschool-xi.vercel.app`, PUT/GET/HEAD and content headers.

The client requests an upload, PUTs exact bytes directly to the returned URL with the declared `Content-Type` and `credentials: 'omit'`, then calls the confirmation endpoint with session + CSRF + a new command key. The browser supplies Content-Length from the file body; do not set that forbidden browser header manually. Limit: 50 MiB per file, nonempty file, up to 20 distinct files per version. These bounds are documented in OpenAPI and validated again in the service. File IDs must belong to the same student and delivery and be confirmed. File names never become object keys.

The presigned URL signs size and MIME type, writes only a random staging key and expires after 15 minutes. Confirmation HEAD checks actual size/type and uses an ETag-conditional server-side COPY to a separate final key with attachment disposition. A final object is not writable by the staging URL, and a confirmed manifest is never copied again. This does not depend on storage versioning. Only file IDs are stored in the durable idempotency result; a server-installed response projection signs after commit, including replay, without extending the original deadline. Provider errors are sanitized.

An interrupted confirmation leaves the durable upload intent PENDING and can be retried. A signing failure after DB commit is recovered with the same command key, without another file record. Expired upload URLs require a new upload command. Unconfirmed staging-object retention/garbage collection is not a promised feature of this increment; the bucket's lifecycle policy is not assumed to execute cleanup. Download authorization remains a separate file-service feature; this route returns metadata only and never makes objects public.

## Verification and deployment boundary

`pnpm test:stu05` runs unit and actual Nest HTTP tests with mock Prisma/storage. Mock parallel writes verify application wiring, not PostgreSQL lock/index races. Five exact-source SELECT projections were also executed on existing PostgreSQL 18.6 as `app_runtime`, using CTE-only fictional rows: all four statuses, pagination/total, isolation, expiry, late flag, historical comments and verified version attachments. No working business rows were modified.

A real S3 probe on the working private bucket passed: CORS preflight 200, PUT 200, 900-second signature, HEAD size, conditional copy, final immutability after reusing staging PUT, unsigned GET 403, mismatched size/type 403. Probe objects were removed. No credentials or signed URLs are included in evidence.

The migration is prepared but unapplied. This evidence does not establish FND-GATE or grant permission to open the student cabinet. Full migration/real write races and manual working acceptance remain pending the approved gate; no alternate test database is created to bypass the owner's restriction.

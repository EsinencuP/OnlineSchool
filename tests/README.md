# TASK-15: foundation tests and acceptance status

The owner confirmed **no disposable PostgreSQL and no additional test databases**.
Only the existing working Vercel/Neon project is used. This restriction does not
authorize resetting its schema, closing its real financial periods, rewriting its
queue, or running historical synthetic seeds against it.

## What is verified now

- Jest unit tests, including exhaustive ordinary rates (200/220/250, no 230) and the
  exact six-calendar-month rehire boundary.
- A read-only capture from the actual PostgreSQL 18.6 catalogs: 73 tables/models,
  818 columns, 164 foreign keys, exclusion/unique constraints, audit append-only
  triggers, ledger RLS, runtime privilege restrictions and seven migration checksums.
- Prisma and the checked-in [ERD](../packages/db/ERD.md)/column-FK contract match that capture.
  The JSON capture has its own timestamp. Rechecking its JSON in CI **is not** a new
  real PostgreSQL CI integration run.
- Safe HTTPS checks of the actual API/worker and anonymous access rejection.
- Two Playwright tests passed in headless Chromium on the working permanent origin:
  password → limited session → native Chromium virtual WebAuthn registration →
  authentication → protected components; password-only access stays limited.
  Ordinary short-lived MANAGER identities were used without role/MFA overrides.
  Their accounts were disabled, role intervals ended, and all keys/sessions revoked
  immediately after the run. Owner credentials and financial records were not used.

## Commands

```powershell
$env:FND_WORKING_ORIGIN='https://onlineschool-xi.vercel.app'
pnpm test:fnd:safe
pnpm test:fnd:ci
```

The first command runs the permitted checks. The second also evaluates acceptance:
it exits nonzero while required groups lack a permitted test target. It must not
report a skipped integration suite as a passed FND-GATE.

`tests/unit`, `integration`, `api`, `concurrent`, `e2e` provide the requested layout.
Existing node:test assertions are registered with Jest through a test-only adapter;
their old commands remain compatible. API helpers use Supertest against the actual
NestJS server. No app route, guard, database adapter or business handler is mocked.
Prepared 5/5/3 race and file-permission tests require a separately authorized isolated
legacy target. Such a target is currently forbidden and **was not created or run**.
Existing 90 DB/API/worker tests remain historical evidence, not a fresh gate pass.

For a controlled repeat of the working WebAuthn check, `tests/support/live-identities.mjs`
prepares local private credentials for ordinary temporary staff accounts; an authorized
operator provisions the matching profiles/role intervals using the database connector.
Run the helper with `FND_WORKING_ORIGIN`, then disable those exact account IDs, revoke
their keys/sessions and end their role intervals with audit records. `--forget`
removes the local private credential file. Do not use an owner account, store these
credentials in GitHub, enable traces/videos, or add a production test bypass.

## Blockers

[FOUNDATION_STATUS.json](FOUNDATION_STATUS.json) is the complete group-by-group status.
Clean-schema and previous-version migration rehearsals need an empty/older database;
the single populated working database is neither. Financial concurrency, destructive
immutability and crash/reclaim suites also remain unexecuted on a permissible target.
CI has no permission to provision PostgreSQL or receive working database credentials.
The `foundation-gate` check therefore reports the unmet acceptance criteria explicitly.

No automatic cleanup deletes financial/audit history. No extra environments,
databases, branches, roles in Neon, or containers were created for TASK-15.
Temporary staff account role assignments used the existing MANAGER role.
Full critical/high defect clearance, manual QA acceptance and FND-GATE are open.

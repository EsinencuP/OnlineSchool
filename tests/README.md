# Проверки приложения

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
Integration tests requiring database writes use an isolated test database.

For a controlled repeat of the working WebAuthn check, `tests/support/live-identities.mjs`
prepares local private credentials for ordinary temporary staff accounts; an authorized
operator provisions the matching profiles/role intervals using the database connector.
Run the helper with `FND_WORKING_ORIGIN`, then disable those exact account IDs, revoke
their keys/sessions and end their role intervals with audit records. `--forget`
removes the local private credential file. Do not use an owner account, store these
credentials in GitHub, enable traces/videos, or add a production test bypass.


Условия приёмки описаны в [PHASE0_CHECKS.md](../PHASE0_CHECKS.md).

# TASK-001 — design note, 2026-11-03

Scope: preserve the existing `feat/k8k-design` working tree at HEAD
`171db2142858e035594737e141d422fa5378e844`. No predecessor is required.
Existing changes have unknown authorship; path relevance does not establish authorship.

Planned local interface: `pnpm k8k:baseline capture` and
`pnpm k8k:baseline verify <snapshot-directory>` delegate to
`scripts/k8k-baseline.py` (Python standard library + local Git only).
No DTO, operation, component prop, SDK, migration or dependency changes.

Snapshots are new timestamp/UUID directories under
`output/k8k-tasks/TASK-001/snapshots/`. Each contains a versioned manifest,
HEAD-to-worktree and HEAD-to-index binary patches, exact byte copies of dirty
tracked files and relevant untracked source/documents, and verification evidence.
Manifest entries record path, size, SHA256, tracked/untracked kind, source commit,
backup path and provenance. Deleted files are represented explicitly.

`tokens.css`, existing sources, archives, old baseline and current Git index are
read-only inputs. Exclude ignored files, secrets/session paths, dependencies,
untracked historical output and user archives. Copy the small PNG design reference
as binary. Record exclusions explicitly; hashes alone do not restore excluded data.
Save exact byte copies because Git CRLF normalization can make an otherwise valid
patch insufficient for physical-byte restoration.

Verification: read patch statistics; reconstruct all dirty tracked files from HEAD
and apply/check the patch only inside a new isolated local Git repository; compare
Git-normalized content, then restore exact backed-up bytes and compare all copies.
Also reconstruct the staged patch independently. Capture checks source hashes,
HEAD, branch, index patch and old baseline/archive hashes before/after. Repeat
capture verifies that prior snapshot files were not overwritten.

Only TASK-001 bookkeeping and the local capture command will be changed. Initial
and repeated snapshots precede the final journal/matrix/status update; the report
will explicitly identify these later, intentional documentation edits.

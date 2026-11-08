"""TASK-001 local recovery evidence. No network, env loading, DB or source writes."""

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/k8k-tasks/TASK-001"
SNAPSHOTS = OUTPUT / "snapshots"
TEXT_EXTENSIONS = {".md", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs",
                   ".css", ".html", ".py", ".yaml", ".yml", ".txt"}
TASK_FILES = {"package.json", "scripts/k8k-baseline.py"}
SECRET_PATTERNS = {
    "private-key": rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "provider-key": rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|AKIA[A-Z0-9]{16})",
    "jwt": rb"eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}",
    "credential-url": rb"(?:postgres(?:ql)?|https?)://[^\s/:@]+:[^\s/@]+@[^\s'\"<>]+",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def write_new(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(data)


def git(*args, cwd=ROOT, input_data=None):
    # Reconstruct canonical Git blobs independently of the host's Windows CRLF setting.
    local_config = ["-c", "core.autocrlf=false"] if cwd != ROOT else []
    result = subprocess.run(
        ["git", "--no-optional-locks", "-c", "core.safecrlf=false", *local_config, *args],
        cwd=cwd, input=input_data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode:
        # Do not print command output, which could contain source/credential data.
        raise RuntimeError(f"git {args[0]} failed: exit {result.returncode}")
    return result.stdout


def paths(data):
    return [p.decode("utf-8") for p in data.split(b"\0") if p]


def safe_path(base, relative):
    parts = PurePosixPath(relative)
    if parts.is_absolute() or ".." in parts.parts or "\\" in relative or ":" in relative:
        raise RuntimeError("Unsafe relative path")
    result = base.joinpath(*parts.parts)
    if not result.resolve().is_relative_to(base.resolve()):
        raise RuntimeError("Path escapes the intended directory")
    return result


def forbidden(path):
    parts = PurePosixPath(path.lower()).parts
    if any(p in {"node_modules", ".git", ".vercel", ".codex", ".identity-ops",
                 ".playwright-mcp", "dist", "dist-tools", "coverage", ".turbo"}
           for p in parts):
        return True
    return any(p.startswith(".env") or re.search(
        r"(?:^|[-_.])(cookies?|storage[-_]?state|auth[-_]?state|credentials?)(?:[-_.]|$)", p
    ) or p.endswith((".pem", ".key", ".p12", ".pfx", ".har")) for p in parts)


def scan(data, label):
    for name, pattern in SECRET_PATTERNS.items():
        for match in re.finditer(pattern, data):
            source_label = label.removeprefix("HEAD:").removeprefix("head/").removeprefix("files/")
            # This existing negative unit test verifies rejection of URL userinfo.
            # Exception is one exact fixture in one file, never a general URL bypass.
            if (name == "credential-url"
                    and source_label == "tests/unit/student-dashboard.test.mjs"
                    and match.group() == b"https://" + b"user:" + b"password@meet.google.com/abc-defg-hij"):
                continue
            raise RuntimeError(f"Potential secret ({name}) in {label}; no value printed")


def diff(*extra):
    return git("diff", "--binary", "--full-index", "--no-renames", "--no-ext-diff",
               "--no-textconv", *extra, "HEAD", "--")


def protected_inputs():
    # RARs are hashed only to prove preservation, never copied or extracted.
    candidates = list((ROOT / "output/k8k-implementation/baseline").glob("*"))
    candidates += [ROOT / "apps/apps.rar", ROOT / "uiux.rar"]
    return {p.relative_to(ROOT).as_posix(): {"size": p.stat().st_size,
            "sha256": digest(p.read_bytes())} for p in candidates if p.is_file()}


def inventory():
    dirty = set(paths(git("diff", "--no-renames", "--name-only", "-z", "HEAD", "--")))
    dirty.update(paths(git("diff", "--cached", "--no-renames", "--name-only", "-z", "HEAD", "--")))
    others = paths(git("ls-files", "--others", "--exclude-standard", "-z"))
    included, excluded = [], []
    for path, kind in [(p, "tracked") for p in sorted(dirty)] + [(p, "untracked") for p in others]:
        reason = None
        if forbidden(path):
            reason = "sensitive/session/dependency/generated path; content not read"
        elif path.lower().endswith((".rar", ".zip", ".7z")):
            reason = "user archive; original preserved, no backup content"
        elif kind == "untracked" and path.startswith("output/"):
            reason = "historical/generated/task output; excluded to avoid recursive backups and session artifacts"
        elif kind == "untracked" and not (
            Path(path).suffix.lower() in TEXT_EXTENSIONS or path == "template/newtemp.png"
        ):
            reason = "outside the redesign source/document/reference scope"
        if reason:
            if kind == "tracked":
                raise RuntimeError(f"Cannot safely capture a full tracked patch: {path}")
            excluded.append({"path": path, "type": kind, "reason": reason})
        else:
            source = safe_path(ROOT, path)
            if source.is_symlink():
                raise RuntimeError(f"Symlink requires separate review: {path}")
            if source.exists() and source.stat().st_size > 8 * 1024 * 1024:
                raise RuntimeError(f"Unexpected large source requires review: {path}")
            included.append((path, kind))
    return included, excluded


def tree_hashes(directory):
    return {p.relative_to(directory).as_posix(): digest(p.read_bytes())
            for p in directory.rglob("*") if p.is_file()}


def verify(snapshot, check_source=False, allow_changes=()):
    snapshot = snapshot.resolve()
    if not snapshot.is_relative_to(SNAPSHOTS.resolve()):
        raise RuntimeError("Snapshot must be inside the TASK-001 snapshots directory")
    manifest_data = (snapshot / "manifest.json").read_bytes()
    if digest(manifest_data) != (snapshot / "manifest.sha256").read_text().strip():
        raise RuntimeError("Manifest checksum mismatch")
    manifest = json.loads(manifest_data)
    for artifact in manifest["artifacts"]:
        data = safe_path(snapshot, artifact["path"]).read_bytes()
        if digest(data) != artifact["sha256"] or len(data) != artifact["size"]:
            raise RuntimeError("Artifact mismatch")
        scan(data, artifact["path"])
    for entry in manifest["files"]:
        if entry["exists"]:
            data = safe_path(snapshot, entry["backupPath"]).read_bytes()
            if digest(data) != entry["sha256"] or len(data) != entry["size"]:
                raise RuntimeError(f"Backup mismatch: {entry['path']}")
            scan(data, entry["path"])

    # A new isolated repository prevents Git from discovering/mutating the source index.
    recovery = OUTPUT / "recovery-checks" / f"{snapshot.name}-{uuid4().hex[:8]}"
    recovery.resolve().relative_to((OUTPUT / "recovery-checks").resolve())
    recovery.mkdir(parents=True, exist_ok=False)
    tracked = [e for e in manifest["files"] if e["type"] == "tracked"]
    patch_results = {}
    for mode, patch_name in [("worktree", "tracked.patch"), ("index", "staged.patch")]:
        target = recovery / mode
        target.mkdir()
        git("init", "--quiet", cwd=target)
        for entry in tracked:
            if entry["headBackupPath"]:
                write_new(safe_path(target, entry["path"]),
                          safe_path(snapshot, entry["headBackupPath"]).read_bytes())
        patch = snapshot / patch_name
        has_patch = patch.stat().st_size > 0
        if has_patch:
            git("apply", "--stat", "--numstat", str(patch), cwd=target)
            git("apply", "--check", "--binary", str(patch), cwd=target)
            git("apply", "--binary", str(patch), cwd=target)
        for entry in tracked:
            restored = safe_path(target, entry["path"])
            expected = entry["gitWorktreeOid"] if mode == "worktree" else entry["indexOid"]
            if expected is None:
                if restored.exists():
                    raise RuntimeError("Deleted file unexpectedly restored")
            elif not restored.is_file() or git("hash-object", "--no-filters", str(restored), cwd=target).decode().strip() != expected:
                raise RuntimeError(f"Patch reconstruction mismatch: {entry['path']}")
        patch_results[mode] = {"emptyPatch": not has_patch,
                               "statReadExitCode": 0 if has_patch else None,
                               "applyCheckExitCode": 0 if has_patch else None,
                               "applyExitCode": 0 if has_patch else None,
                               "gitContentMatches": True}
    exact = recovery / "exact-bytes"
    restored_count = 0
    for entry in manifest["files"]:
        if entry["exists"]:
            data = safe_path(snapshot, entry["backupPath"]).read_bytes()
            target = safe_path(exact, entry["path"])
            write_new(target, data)
            if target.read_bytes() != data:
                raise RuntimeError("Byte restoration mismatch")
            restored_count += 1
    result = {"snapshot": snapshot.relative_to(ROOT).as_posix(),
              "manifestSha256": digest(manifest_data), "sourceCommit": manifest["sourceCommit"],
              "dirtyDigest": manifest["dirtyDigest"], "patches": patch_results,
              "exactByteRestoredFiles": restored_count,
              "recoveryDirectory": recovery.relative_to(ROOT).as_posix(),
              "secretPatternScan": "PASS (bounded patterns; not a general secret audit)",
              "passed": True}
    if check_source:
        changed = []
        for entry in manifest["files"]:
            source = safe_path(ROOT, entry["path"])
            current_hash = digest(source.read_bytes()) if source.is_file() else None
            if current_hash != entry["sha256"]:
                if entry["path"] not in allow_changes:
                    raise RuntimeError(f"Unexpected source change: {entry['path']}")
                changed.append({"path": entry["path"], "beforeSha256": entry["sha256"],
                                "afterSha256": current_hash})
        if (protected_inputs() != manifest["protectedInputs"]
                or git("rev-parse", "HEAD").decode().strip() != manifest["sourceCommit"]
                or git("branch", "--show-current").decode().strip() != manifest["branch"]
                or digest(diff("--cached")) != next(a["sha256"] for a in manifest["artifacts"] if a["path"] == "staged.patch")):
            raise RuntimeError("Protected baseline/archive/HEAD/branch/index changed")
        result["sourceAudit"] = {"unchangedFiles": len(manifest["files"]) - len(changed),
                                 "intentionallyUpdated": changed,
                                 "protectedInputsHeadBranchIndexUnchanged": True}
    write_new(recovery / "verification.json", json_bytes(result))
    return result


def capture():
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    previous = {p.name: tree_hashes(p) for p in SNAPSHOTS.iterdir() if p.is_dir()}
    protected = protected_inputs()
    head = git("rev-parse", "HEAD").decode().strip()
    branch = git("branch", "--show-current").decode().strip()
    status = git("status", "--porcelain=v1", "-z", "--untracked-files=all")
    included, excluded = inventory()
    patch, staged = diff(), diff("--cached")
    scan(patch, "tracked.patch")
    scan(staged, "staged.patch")
    now = datetime.now(timezone.utc)
    snapshot = SNAPSHOTS / f"{now.strftime('%Y%m%dT%H%M%S.%fZ')}-{uuid4().hex[:8]}"
    snapshot.mkdir(exist_ok=False)
    artifacts = []

    def artifact(name, data):
        write_new(snapshot / name, data)
        artifacts.append({"path": name, "size": len(data), "sha256": digest(data)})

    artifact("tracked.patch", patch)
    artifact("staged.patch", staged)
    artifact("status.porcelain.z", status)
    files = []
    for path, kind in included:
        source = safe_path(ROOT, path)
        exists = source.is_file()
        data = source.read_bytes() if exists else None
        if data is not None:
            scan(data, path)
            write_new(safe_path(snapshot / "files", path), data)
        head_backup = None
        index_oid = worktree_oid = None
        if kind == "tracked":
            tree_entry = git("ls-tree", "HEAD", "--", path)
            if tree_entry:
                head_data = git("show", f"HEAD:{path}")
                scan(head_data, f"HEAD:{path}")
                head_backup = f"head/{path}"
                write_new(safe_path(snapshot, head_backup), head_data)
                artifacts.append({"path": head_backup, "size": len(head_data), "sha256": digest(head_data)})
            index_entry = git("ls-files", "--stage", "--", path).decode()
            if index_entry:
                if len(index_entry.splitlines()) != 1 or index_entry.split()[2] != "0":
                    raise RuntimeError("Unmerged index is not supported")
                index_oid = index_entry.split()[1]
            if exists:
                worktree_oid = git("hash-object", f"--path={path}", "--stdin", input_data=data).decode().strip()
        files.append({"path": path, "type": kind, "exists": exists,
                      "size": len(data) if data is not None else 0,
                      "sha256": digest(data) if data is not None else None,
                      "sourceCommit": head, "backupPath": f"files/{path}" if exists else None,
                      "headBackupPath": head_backup, "indexOid": index_oid,
                      "gitWorktreeOid": worktree_oid,
                      "provenance": "TASK-001 tooling" if path in TASK_FILES else "pre-existing; author not inferred"})
    dirty_digest = digest(json_bytes({"head": head, "patchSha256": digest(patch),
                                     "stagedSha256": digest(staged), "files": files}))
    old = json.loads((ROOT / "output/k8k-implementation/baseline/manifest.json").read_text(encoding="utf-8-sig"))
    old_files = {e["path"].replace("\\", "/"): e["sha256"] for e in old["files"]}
    comparison = [{"path": e["path"], "state": "not-in-old-manifest" if e["path"] not in old_files
                   else "same" if old_files[e["path"]] == e["sha256"] else "changed"}
                  for e in files]
    artifact("old-manifest-comparison.json", json_bytes({"oldCommit": old["commit"],
             "sameCommit": old["commit"] == head, "files": comparison,
             "scope": "currently captured files; historical manifest is hashes only"}))
    source_unchanged = all((safe_path(ROOT, e["path"]).is_file() == e["exists"] and
        (not e["exists"] or digest(safe_path(ROOT, e["path"]).read_bytes()) == e["sha256"])) for e in files)
    current_included, _ = inventory()
    checks = {"sourceHashesBeforeAfterMatch": source_unchanged,
              "sourceSetBeforeAfterMatches": included == current_included,
              "trackedPatchBeforeAfterMatches": patch == diff(),
              "stagedPatchBeforeAfterMatches": staged == diff("--cached"),
              "headBeforeAfterMatches": head == git("rev-parse", "HEAD").decode().strip(),
              "branchBeforeAfterMatches": branch == git("branch", "--show-current").decode().strip(),
              "protectedInputsBeforeAfterMatch": protected == protected_inputs(),
              "previousSnapshotsUnchanged": all(tree_hashes(SNAPSHOTS / name) == hashes for name, hashes in previous.items())}
    if not all(checks.values()):
        raise RuntimeError("Concurrent source/protected-input change; snapshot not accepted")
    manifest = {"schemaVersion": 1, "createdUtc": now.isoformat(), "sourceRoot": str(ROOT),
                "sourceCommit": head, "branch": branch, "dirtyDigest": dirty_digest,
                "backupDirectory": snapshot.relative_to(ROOT).as_posix(),
                "dirtyDigestDefinition": "SHA256 of UTF-8 indented JSON containing head, patchSha256, stagedSha256 and files (ordered entries)",
                "files": files, "artifacts": artifacts, "excludedUntracked": excluded,
                "excludedIgnoredPolicy": ["ignored files are neither read nor copied", ".env*", "node_modules/", "cookies/session/auth state", "generated outputs"],
                "protectedInputs": protected, "captureChecks": checks,
                "previousSnapshotCount": len(previous),
                "previousCompleteSnapshotCount": sum((SNAPSHOTS / name / "verification.json").is_file() for name in previous),
                "secretScanFixtureExceptions": [{"path": "tests/unit/student-dashboard.test.mjs",
                    "reason": "one exact synthetic negative-test URL userinfo literal; not live credentials"}],
                "limits": ["HEAD commit must remain available in local Git for a complete clean checkout",
                           "copies preserve file bytes, not ACLs/mtime/NTFS alternate streams",
                           "untracked historical output and archives are not backed up",
                           "bounded credential-pattern scan cannot prove absence of arbitrary secrets",
                           "output stays local; no publication, DB or provider access"]}
    data = json_bytes(manifest)
    write_new(snapshot / "manifest.json", data)
    write_new(snapshot / "manifest.sha256", (digest(data) + "\n").encode())
    result = verify(snapshot)
    write_new(snapshot / "verification.json", json_bytes(result))
    return {"snapshot": snapshot.relative_to(ROOT).as_posix(), "sourceCommit": head,
            "dirtyDigest": dirty_digest, "trackedFiles": sum(e["type"] == "tracked" for e in files),
            "untrackedFiles": sum(e["type"] == "untracked" for e in files),
            "captureChecks": checks, "verification": result}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("capture", help="read-only source capture; write a new local snapshot")
    check = sub.add_parser("verify", help="restore and check a snapshot in a new isolated directory")
    check.add_argument("snapshot", type=Path)
    check.add_argument("--check-source", action="store_true", help="also check current source preservation")
    check.add_argument("--allow-change", action="append", default=[], help="explicit bookkeeping path allowed to differ")
    args = parser.parse_args()
    print(json.dumps(capture() if args.command == "capture" else verify(
        args.snapshot, args.check_source, args.allow_change), indent=2))

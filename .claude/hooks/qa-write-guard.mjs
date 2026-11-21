#!/usr/bin/env node
// PreToolUse guard for the K8K QA system.
//   node qa-write-guard.mjs write      -> Edit/Write/NotebookEdit: allow only inside <repo>/qa/
//   node qa-write-guard.mjs bash-ro    -> Bash: deny commands that obviously mutate the repo (best-effort heuristic)
// Reads the hook JSON from stdin. Allow = no output, exit 0 (normal permission flow continues).
// Deny = PreToolUse JSON with permissionDecision "deny". Anything undeterminable is denied (fail closed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

function realish(p) {
  // realpath of the deepest existing ancestor + the non-existing tail (defeats symlink escapes).
  let head = p;
  const tail = [];
  while (!fs.existsSync(head)) {
    const parent = path.dirname(head);
    if (parent === head) return p;
    tail.unshift(path.basename(head));
    head = parent;
  }
  return path.join(fs.realpathSync(head), ...tail);
}

export function checkWritePath(rawPath, cwd = ROOT, root = ROOT) {
  if (typeof rawPath !== 'string' || !rawPath.trim() || rawPath.includes('\0')) {
    return { allow: false, reason: 'write path is missing or undeterminable' };
  }
  const unified = rawPath.replace(/^\/([a-zA-Z])\//, '$1:/'); // Git-Bash style /d/x -> d:/x
  const abs = path.resolve(path.isAbsolute(unified) ? unified : path.join(cwd, unified));
  const target = norm(realish(abs));
  const qaDir = norm(realish(path.join(root, 'qa')));
  if (target !== qaDir && !target.startsWith(qaDir + path.sep)) {
    return { allow: false, reason: `writes are allowed only inside qa/ (got ${abs})` };
  }
  const rel = path.relative(qaDir, target).split(path.sep);
  if (rel[0] === 'private' || (rel[0] === 'fixtures' && /\.env$|storage/i.test(rel[rel.length - 1] || ''))) {
    return { allow: false, reason: 'qa/private and credential fixtures are owner-only' };
  }
  return { allow: true };
}

const MUTATING = [
  /(^|[\s;&|(])(rm|rmdir|del|erase|mv|move|cp|copy|touch|mkdir|ni|ren|rename|chmod|chown|truncate|tee)(\s|$)/i,
  /(^|[^<>=!-])>>?(?!&)/, // output redirection (not 2>&1)
  /\bsed\b[^|;&]*\s-i/i,
  /\bgit\s+(add|commit|push|reset|clean|checkout|switch|restore|stash|merge|rebase|cherry-pick|apply|am|rm|mv|tag|branch\s+-[dD]|worktree)\b/i,
  /\b(npm|pnpm|yarn|npx)\s+(install|i|add|remove|rm|update|up|publish|run\s+(build|dev|start))\b/i,
  /\b(Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|Clear-Content)\b/i,
  /\b(curl|wget|Invoke-WebRequest|iwr)\b[^|;&]*(-X\s*(POST|PUT|PATCH|DELETE)|-d\s|--data|-Method\s+(Post|Put|Patch|Delete))/i,
  /\bprisma\s+(migrate|db\s+push|db\s+execute)\b/i,
];

export function checkBash(command) {
  if (typeof command !== 'string' || !command.trim()) return { allow: false, reason: 'empty command' };
  for (const re of MUTATING) {
    if (re.test(command)) return { allow: false, reason: `read-only Bash: pattern ${re} matched` };
  }
  return { allow: true };
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `K8K QA guard: ${reason}`,
      },
    }),
  );
}

async function main() {
  const mode = process.argv[2];
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return deny('hook input is not valid JSON');
  }
  const ti = input.tool_input ?? {};
  const cwd = input.cwd || ROOT;
  let res;
  if (mode === 'write') res = checkWritePath(ti.file_path ?? ti.notebook_path ?? ti.path, cwd);
  else if (mode === 'bash-ro') res = checkBash(ti.command);
  else res = { allow: false, reason: `unknown guard mode ${mode}` };
  if (!res.allow) deny(res.reason);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

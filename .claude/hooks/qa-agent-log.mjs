#!/usr/bin/env node
// SubagentStart / SubagentStop logger -> qa/reports/agent-log.jsonl (local, git-ignored). Never blocks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const name = String(input.agent_type ?? input.subagent_type ?? '');
  if (/^(qa-engineer|student-agent|teacher-agent|manager-agent|director-agent|qa-orchestrator)$/.test(name)) {
    const dir = path.join(root, 'qa', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'agent-log.jsonl'),
      JSON.stringify({ at: new Date().toISOString(), event: input.hook_event_name, agent: name, session: input.session_id }) + '\n',
    );
  }
} catch {
  /* logging must never break a run */
}

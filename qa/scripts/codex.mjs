import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { browserTools } from './browser-guard.mjs';
import { json, requireValue, validate } from './records.mjs';

const codex = process.platform === 'win32' ? 'codex.exe' : 'codex';
const coreEnvironment = /^(PATH|PATHEXT|COMSPEC|SYSTEMROOT|WINDIR|SYSTEMDRIVE|OS|USERPROFILE|HOME|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES(?:\(X86\))?|PROGRAMDATA|TEMP|TMP|TMPDIR|LANG|LC_.*|PLAYWRIGHT_BROWSERS_PATH|XDG_.*)$/i;
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => coreEnvironment.test(name)));
const configValue = (value) => JSON.stringify(value);
const mcpName = /^[a-zA-Z0-9_-]+$/;

export function prepareCodex(root) {
  const get = (args) => spawnSync(codex, args, { cwd: root, env, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  const login = get(['login', 'status']);
  requireValue(login.status === 0 && /Logged in using ChatGPT/i.test(login.stdout + login.stderr),
    'ChatGPT login is required for independent QA');
  const list = get(['mcp', 'list', '--json']);
  requireValue(list.status === 0, 'Codex effective MCP configuration is unavailable');
  const servers = JSON.parse(list.stdout);
  requireValue(servers.every(({ name }) => mcpName.test(name)), 'Unsupported MCP name in effective configuration');
  return servers;
}

export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 120_000, windowsHide: true }).trim();
}

export async function withWorktree(root, commit, work) {
  const temporary = await mkdtemp(join(tmpdir(), 'k8k-qa-git-'));
  const checkout = join(temporary, 'source');
  git(root, '-c', 'core.hooksPath=' + temporary, 'worktree', 'add', '--quiet', '--no-checkout', '--detach', checkout, commit);
  try {
    git(checkout, 'sparse-checkout', 'set', '--cone', '.github', 'api', 'apps', 'docs', 'infra', 'packages', 'scripts', 'tests');
    git(checkout, 'read-tree', '-mu', 'HEAD');
    return await work(checkout);
  } finally {
    git(root, 'worktree', 'remove', checkout);
    await rm(temporary, { recursive: true });
  }
}

export async function profile(root, name) {
  const source = await readFile(join(root, '.codex', 'agents', name + '.toml'), 'utf8');
  const id = source.match(/^name = "([^"]+)"\r?$/m)?.[1];
  const instructions = source.match(/^developer_instructions = """\r?\n([\s\S]+?)\r?\n"""\r?$/m)?.[1];
  requireValue(id === name && instructions, `Invalid Codex profile ${name}`);
  if (name !== 'qa_engineer') requireValue(/^shell_tool = false\r?$/m.test(source), 'Browser profile requires shell_tool = false');
  return instructions;
}

function localBrowser(servers) {
  const transport = servers.find(({ name, enabled }) => name === 'playwright' && enabled)?.transport;
  requireValue(transport?.type === 'stdio', 'A dedicated Playwright stdio MCP is required');
  const { command, args } = transport;
  const isNode = /(?:^|[/\\])node(?:\.exe)?$/i.test(command) && /(?:^|[/\\])@playwright[/\\]mcp[/\\]cli\.js$/i.test(args[0] ?? '');
  const isNpx = /(?:^|[/\\])npx(?:\.cmd)?$/i.test(command) && args[0] === '-y'
    && /^@playwright\/mcp@\d+\.\d+\.\d+$/.test(args[1] ?? '');
  requireValue(isNode || isNpx, 'Unsupported Playwright launcher. See qa/README.md.');
  if (isNpx && process.platform === 'win32') {
    const entry = join(resolve(process.execPath, '..'), 'node_modules', 'npm', 'bin', 'npx-cli.js');
    return { command: process.execPath, args: [entry, ...args.slice(0, 2)] };
  }
  return { command, args: args.slice(0, isNode ? 1 : 2) };
}

export async function browserConfig(servers, { scratch, origin, evidence, secrets }) {
  const base = localBrowser(servers);
  const settings = join(scratch, 'browser.json');
  await mkdir(evidence, { recursive: true });
  await json(settings, {
    command: base.command, origin, evidence,
    args: [...base.args, '--headless', '--isolated', '--allowed-origins', origin,
      '--output-dir', evidence, '--secrets', secrets],
  });
  return settings;
}

export function options({ servers, instructions, shell, browser }) {
  const overrides = {
    forced_login_method: 'chatgpt', developer_instructions: instructions, web_search: 'disabled',
    'agents.enabled': false, 'features.shell_tool': shell, 'features.apps': false,
    'features.plugins': false, 'features.memories': false, 'features.hooks': false,
    'features.request_permissions_tool': false, 'skills.bundled.enabled': false,
    'skills.include_instructions': false, 'shell_environment_policy.inherit': 'core',
  };
  for (const { name, transport } of servers) {
    const enabled = Boolean(browser && name === 'playwright');
    overrides[`mcp_servers.${name}.enabled`] = enabled;
    if (!enabled && transport.type === 'stdio') overrides[`mcp_servers.${name}.command`] = process.execPath;
    if (!enabled && transport.type === 'streamable_http') overrides[`mcp_servers.${name}.url`] = 'http://127.0.0.1:1/disabled';
  }
  if (browser) Object.assign(overrides, {
    'project_doc_max_bytes': 0,
    'mcp_servers.playwright.command': process.execPath,
    'mcp_servers.playwright.args': [join(import.meta.dirname, 'browser-guard.mjs'), browser],
    'mcp_servers.playwright.enabled_tools': browserTools,
    'mcp_servers.playwright.default_tools_approval_mode': 'approve',
    'mcp_servers.playwright.required': true,
    'mcp_servers.playwright.startup_timeout_sec': 60,
  });
  return Object.entries(overrides).flatMap(([key, value]) => ['-c', `${key}=${configValue(value)}`]);
}

async function execute(args, cwd, prompt, onEvent) {
  return new Promise((accept, reject) => {
    const child = spawn(codex, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let expired = false;
    const timeout = setTimeout(() => {
      expired = true;
      child.kill();
    }, 12 * 60_000);
    const debug = process.env.K8K_QA_DEBUG === '1';
    child.stderr.on('data', (chunk) => {
      if (!debug) return;
      const diagnostic = chunk.toString().split(/\r?\n/).filter((line) =>
        /error|warn|trust|sandbox|configuration|usage/i.test(line));
      if (diagnostic.length) process.stderr.write(diagnostic.join('\n') + '\n');
    });
    child.stdin.on('error', () => {});
    let turnError;
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        const event = JSON.parse(line);
        if (debug && (event.type === 'turn.failed' || event.type === 'error')) {
          turnError = event.error?.message ?? event.message;
        }
        onEvent(event);
      } catch { /* Non-JSON diagnostics are not used as evidence. */ }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 && !expired) accept();
      else {
        if (turnError) process.stderr.write(turnError.split(/\r?\n/)[0] + '\n');
        reject(new Error(expired ? 'Codex timed out' : `Codex failed with exit code ${code}`));
      }
    });
    child.stdin.end(prompt);
  });
}

export async function runCodex({ servers, cwd, scratch, schema, instructions, prompt, shell = false, browser }) {
  const schemaPath = join(scratch, 'schema.json');
  const output = join(scratch, 'answer.json');
  await json(schemaPath, schema);
  const receipt = { thread_id: null, command_executions: 0, file_changes: 0, mcp_tools: [], completed: false };
  const args = [
    '--no-daemon', '-a', 'never', '-s', 'read-only', '-C', cwd,
    ...options({ servers, instructions, shell, browser }),
    'exec', '--ephemeral', '--skip-git-repo-check', '--json',
    '--output-schema', schemaPath, '-o', output, '-',
  ];
  await execute(args, cwd, prompt, (event) => {
    if (event.type === 'thread.started') receipt.thread_id = event.thread_id;
    if (event.type === 'turn.completed') receipt.completed = true;
    if (event.type !== 'item.completed') return;
    if (event.item?.type === 'command_execution') receipt.command_executions++;
    if (event.item?.type === 'file_change') receipt.file_changes++;
    if (event.item?.type === 'mcp_tool_call' && event.item.status === 'completed') {
      const tool = `${event.item.server}.${event.item.tool}`;
      if (!receipt.mcp_tools.includes(tool)) receipt.mcp_tools.push(tool);
    }
  });
  requireValue(receipt.thread_id && receipt.completed, 'Codex did not complete an independent turn');
  requireValue(receipt.file_changes === 0 && (shell || receipt.command_executions === 0), 'Unexpected Codex tool execution');
  const result = JSON.parse(await readFile(output, 'utf8'));
  validate(schema, result);
  return { result, receipt };
}

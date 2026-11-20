import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export const browserTools = [
  'browser_navigate', 'browser_navigate_back', 'browser_snapshot', 'browser_click',
  'browser_fill_form', 'browser_type', 'browser_select_option', 'browser_press_key',
  'browser_hover', 'browser_tabs', 'browser_resize', 'browser_take_screenshot',
  'browser_wait_for', 'browser_handle_dialog', 'browser_find', 'browser_console_messages',
];

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const { command, args, origin, evidence } = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
  child.stdout.pipe(process.stdout);
  child.on('error', () => process.exit(1));
  child.on('exit', (code) => process.exit(code ?? 1));
  const deny = (id, message) => process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: message }] },
  }) + '\n');
  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    try {
      const request = JSON.parse(line);
      if (request.method === 'tools/call') {
        const { name, arguments: input = {} } = request.params;
        if (!browserTools.includes(name)) return deny(request.id, 'Tool disabled in role session.');
        if (request.params.arguments) delete input.filename;
        if (name === 'browser_navigate' || (name === 'browser_tabs' && input.url)) {
          let url;
          try { url = new URL(input.url); } catch { return deny(request.id, 'Invalid navigation URL.'); }
          if (url.origin !== origin || url.username || url.password) return deny(request.id, 'Outside approved QA origin.');
        }
        if (name === 'browser_take_screenshot') {
          request.params.arguments = { ...input, type: 'png', filename: join(evidence, `${randomUUID()}.png`) };
        }
      } else if (!['initialize', 'ping', 'tools/list', 'notifications/initialized',
        'notifications/cancelled', 'notifications/progress'].includes(request.method)) {
        if (request.id !== undefined) return deny(request.id, 'Method disabled in role session.');
        return;
      }
      child.stdin.write(JSON.stringify(request) + '\n');
    } catch {
      process.stderr.write('Invalid MCP request.\n');
    }
  });
  lines.on('close', () => child.stdin.end());
}

import assert from 'node:assert/strict';
import request from 'supertest';

// Supertest drives the actual listening NestJS server. No routes or responses are mocked.
export async function http(url, options = {}) {
  const target = new URL(url);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  let command = request(target.origin)[(options.method ?? 'GET').toLowerCase()](
    target.pathname + target.search,
  );
  for (const [key, value] of Object.entries(options.headers ?? {}))
    command = command.set(key, value);
  if (options.body !== undefined) command = command.send(options.body);
  const response = await command;
  const headers = new Headers();
  for (const [key, values] of Object.entries(response.headers)) {
    for (const value of Array.isArray(values) ? values : [values])
      if (value !== undefined) headers.append(key, String(value));
  }
  return {
    status: response.status,
    headers,
    json: async () => JSON.parse(response.text),
    text: async () => response.text,
  };
}

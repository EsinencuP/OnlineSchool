// Loaded only into the gate's unit/HTTP mock child process. No .env or real provider access.
import net from 'node:net';
const local = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const value = Array.isArray(args[0]) ? args[0] : args;
  const first = value[0];
  const options = typeof first === 'object' ? first : { port: first, host: value[1] };
  if (!options.path) {
    const host = options.host ?? options.hostname ?? 'localhost';
    if (!local(host) || [80, 443, 3000, 5432, 6432].includes(Number(options.port)))
      throw new Error('TASK-035 blocked non-fixture socket');
  }
  return connect.apply(this, args);
};
const fetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!local(url.hostname)) throw new Error('TASK-035 blocked non-fixture fetch');
  return fetch(input, options);
};

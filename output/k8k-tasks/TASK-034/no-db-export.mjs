import '../../../output/k8k-tasks/TASK-018/no-db-export.mjs';
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/export-openapi.mjs')) {
  const { Injector } = await import('../../../apps/api/node_modules/@nestjs/core/injector/injector.js');
  const { NestFactory } = await import('../../../apps/api/node_modules/@nestjs/core/index.js');
  const pending = new Map();
  const original = Injector.prototype.loadInstance;
  Injector.prototype.loadInstance = async function(wrapper, ...args) {
    const name = String(wrapper.name);
    pending.set(name, (pending.get(name) ?? 0) + 1);
    try { return await original.call(this, wrapper, ...args); }
    finally { pending.set(name, pending.get(name) - 1); }
  };
  const create = NestFactory.create.bind(NestFactory);
  NestFactory.create = async (...args) => {
    const timer = setTimeout(() => { console.error('EXPORT_PENDING_PROVIDER_NAMES', [...pending].filter(([,n]) => n).map(([name]) => name)); process.exit(2); }, 20000);
    try { return await create(...args); } finally { clearTimeout(timer); }
  };
}

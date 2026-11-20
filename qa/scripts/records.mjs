import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const roles = ['qa_engineer', 'student_agent', 'teacher_agent', 'manager_agent', 'director_agent'];
export const gates = ['FND-GATE', 'STUDENT-GATE', 'TEACHER-GATE', 'CRM-GATE', 'PUBLIC-GATE', 'RELEASE-GATE'];
export const types = ['BUG', 'SECURITY', 'PERFORMANCE', 'UX', 'REGRESSION', 'DATA_INTEGRITY', 'ACCESSIBILITY', 'ENHANCEMENT', 'PRODUCT_DECISION'];
export const severity = ['P0', 'P1', 'P2', 'P3'];
export const findingFields = [
  'requirement_id', 'module', 'route', 'type', 'severity', 'title', 'description',
  'preconditions', 'steps_to_reproduce', 'expected_result', 'actual_result', 'reproducibility',
  'business_impact', 'security_impact', 'evidence', 'suggested_fix', 'acceptance_criteria',
  'regression_scope',
];
const transitions = {
  OPEN: ['TRIAGED', 'REJECTED', 'DEFERRED'],
  TRIAGED: ['ACCEPTED', 'REJECTED', 'DEFERRED'],
  ACCEPTED: ['IN_PROGRESS', 'DEFERRED'],
  IN_PROGRESS: ['FIXED', 'DEFERRED'],
  FIXED: ['READY_FOR_RETEST'],
  READY_FOR_RETEST: ['VERIFIED', 'REOPENED'],
  REOPENED: ['TRIAGED', 'IN_PROGRESS', 'DEFERRED'],
  DEFERRED: ['TRIAGED'],
  REJECTED: [],
  VERIFIED: [],
};

export const now = () => new Date().toISOString();
export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
export const text = { type: 'string' };
const choices = (values) => ({ type: 'string', enum: values });
const array = (items) => ({ type: 'array', items });
const object = (properties) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const fields = (names) => Object.fromEntries(names.map((name) => [name, text]));
export const reports = object({
  role: choices(roles),
  status: choices(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']),
  unsafe_to_continue: { type: 'boolean' },
  summary: text,
  scenarios: array(object({ id: text, status: choices(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']), observation: text, evidence: text })),
  findings: array(object({ ...fields(findingFields), type: choices(types), severity: choices(severity) })),
});
export const triage = object({
  summary: text,
  decisions: array(object({
    candidate: text, disposition: choices(['confirmed', 'unconfirmed', 'owner']),
    group: text, reason: text,
  })),
});
export const retest = object({
  summary: text,
  results: array(object({
    id: text, status: choices(['VERIFIED', 'REOPENED', 'BLOCKED']), original: text,
    regression: text, evidence: text,
  })),
});

export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function validate(schema, value, location = 'report') {
  const validType = schema.type === 'array' ? Array.isArray(value)
    : schema.type === 'object' ? value && typeof value === 'object' && !Array.isArray(value)
      : typeof value === schema.type;
  requireValue(validType, `Invalid type at ${location}`);
  if (schema.type === 'string') {
    requireValue(value.trim() && (!schema.enum || schema.enum.includes(value)), `Invalid value at ${location}`);
  } else if (schema.type === 'array') {
    value.forEach((item, index) => validate(schema.items, item, `${location}[${index}]`));
  } else if (schema.type === 'object') {
    requireValue(Object.keys(value).length === schema.required.length, `Unexpected fields at ${location}`);
    for (const key of schema.required) validate(schema.properties[key], value[key], `${location}.${key}`);
  }
}

export async function json(file, data) {
  const pending = file + '.' + randomUUID() + '.tmp';
  await writeFile(pending, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  try {
    await link(pending, file);
  } finally {
    await unlink(pending);
  }
}

export function safeId(value) {
  requireValue(typeof value === 'string' && /^\d{8}T\d{9}Z-[a-z0-9]{8}$/.test(value), 'Invalid cycle ID');
  return value;
}

export async function folders(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && /^\d{8}T\d{9}Z-[a-z0-9]{8}$/.test(entry.name))
    .map(({ name }) => name).sort();
}

export async function register(directory, cards) {
  await mkdir(join(directory, 'events'));
  await json(join(directory, 'findings.json'), cards);
}

export async function ledger(directory) {
  const cards = await readJson(join(directory, 'findings.json'));
  const eventDir = join(directory, 'events');
  const history = [];
  for (const filename of (await readdir(eventDir)).filter((name) => /^\d+\.json$/.test(name)).sort()) {
    history.push(...await readJson(join(eventDir, filename)));
  }
  for (const event of history) {
    const card = cards.find(({ id }) => id === event.id);
    requireValue(card && card.status === event.from && transitions[card.status].includes(event.to), 'Invalid journal transition');
    card.status = event.to;
    if (event.to === 'READY_FOR_RETEST') {
      card.fix_commit = event.commit;
      card.browser_role = event.browser_role;
    }
    if (event.to === 'VERIFIED') card.verified_at = event.at;
    if (event.to === 'DEFERRED') card.accepted_risk = event.reason;
    if (event.from === 'DEFERRED') delete card.accepted_risk;
  }
  return { cards, history };
}

export async function append(directory, entries) {
  const { cards, history } = await ledger(directory);
  requireValue(entries.length > 0, 'No journal entries');
  const events = entries.map(({ id, to, reason, actor, ...data }) => {
    const card = cards.find((item) => item.id === id);
    requireValue(card && transitions[card.status].includes(to) && reason.trim(), `Invalid transition for ${id} to ${to}`);
    const event = { id, from: card.status, to, at: now(), reason, actor, ...data };
    card.status = to;
    return event;
  });
  const filename = String(history.length + 1).padStart(8, '0') + '.json';
  await json(join(directory, 'events', filename), events);
}

export function handoff(cycle, cards) {
  const header = [
    '# Передача разработчику', '', `Цикл ${cycle.id}`, `Сборка ${cycle.build.commit}`,
    `Среда ${cycle.build.environment}`, `Этап ${cycle.gate}`, '',
  ];
  const defects = cards.filter(({ type }) => !['ENHANCEMENT', 'PRODUCT_DECISION'].includes(type));
  if (defects.length === 0) header.push('Подтверждённых дефектов для разработки нет.', '');
  for (const card of defects) {
    header.push(`## ${card.id} · ${card.severity} · ${card.title}`, '',
      `Требование и область — ${card.requirement_id} · ${card.module} · ${card.route}`, '',
      `Предусловия — ${card.preconditions}`, '', `Шаги — ${card.steps_to_reproduce}`, '',
      `Ожидание — ${card.expected_result}`, '', `Факт — ${card.actual_result}`, '',
      `Доказательства — ${card.evidence}`, '', `Источники — ${card.sources.join(', ')}`, '',
      `Критерии исправления — ${card.acceptance_criteria}`, '',
      `Повторная проверка — ${card.regression_scope}`, '');
  }
  return header.join('\n');
}

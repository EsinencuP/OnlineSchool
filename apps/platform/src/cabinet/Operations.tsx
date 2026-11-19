import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Dialog, Icon } from '@online-school/ui';
import {
  operations,
  readableError,
  record,
  request,
  requestSchema,
  resolveSchema,
  rowsOf,
} from './contract.js';
import type { Details, Operation, Schema } from './contract.js';
import { useEndpoint } from './hooks.js';
import { friendly, operationName } from './sections.js';
import type { RecordPage } from './recordRoutes.js';
import type { Section } from './sections.js';

const labels: Record<string, string> = {
  id: 'Идентификатор',
  studentId: 'Ученик',
  teacherId: 'Преподаватель',
  lessonId: 'Урок',
  hwId: 'Домашнее задание',
  taskId: 'Задача',
  staffId: 'Сотрудник',
  requestId: 'Запрос',
  enrollmentId: 'Запись на предмет',
  subjectId: 'Предмет',
  periodId: 'Период',
  amount: 'Сумма',
  currency: 'Валюта',
  reason: 'Причина',
  note: 'Комментарий',
  basis: 'Основание',
  startsAt: 'Начало',
  endsAt: 'Окончание',
  from: 'С начала',
  to: 'До',
  date: 'Дата',
  status: 'Статус',
  kind: 'Тип',
  search: 'Поиск',
  currentPassword: 'Текущий пароль',
  newPassword: 'Новый пароль',
  email: 'Электронная почта',
  title: 'Название',
  version: 'Версия',
  decision: 'Решение',
  result: 'Результат',
  displayName: 'Имя',
  fullName: 'Полное имя',
  durationMinutes: 'Длительность, мин',
  createdAt: 'Создано',
  updatedAt: 'Обновлено',
  scheduledAt: 'Запланировано',
  summary: 'Сводка',
  subjectName: 'Предмет',
  studentName: 'Ученик',
  teacherName: 'Преподаватель',
  generatedAt: 'Обновлено',
  description: 'Описание',
  totals: 'Итого',
  contactName: 'Контакт',
  validUntil: 'Действует до',
  features: 'Возможности',
  reviewedAt: 'Проверено',
};
const statuses: Record<string, string> = {
  SCHEDULED: 'Запланирован',
  CONDUCTED: 'Проведён',
  CANCELLED: 'Отменён',
  COMPLETED: 'Завершён',
  STAR_PENDING: 'Ожидает продления',
  DISPUTED: 'Оспаривается',
  OPEN: 'Открыто',
  IN_PROGRESS: 'В работе',
  RESOLVED: 'Решено',
  REJECTED: 'Отклонено',
  PENDING: 'Ожидает',
  NOT_SUBMITTED: 'Не сдано',
  SUBMITTED: 'Сдано',
  REVIEWED: 'Проверено',
  NEEDS_REVISION: 'На доработке',
  ACTIVE: 'Активно',
  EXPIRED: 'Истёк',
  FROZEN: 'Заморожен',
  LIMITED: 'Ограничен',
  CONFIRMED: 'Подтверждено',
  APPROVED: 'Одобрено',
  ok: 'Работает',
  stale: 'Данные устарели',
  stopped: 'Остановлен',
  unknown: 'Неизвестно',
  unavailable: 'Недоступен',
  PAYMENT: 'Платёж',
  DISTRIBUTION: 'Распределение',
  TEMPORARY_ACCESS: 'Временный допуск',
};
export const fieldLabel = (key: string) => labels[key] ?? friendly(key);
const invisible =
  /(^id$|Id$|Ids$|Token$|^csrf|^signature|^password|^secret|^nonce|^url$|^signedUrl$|^uploadUrl$|^downloadUrl$|^meetLink$)/i;
const color = (value: string) =>
  /cancel|reject|stopped|error|unavailable/i.test(value)
    ? 'rose'
    : /pending|disputed|stale|revision/i.test(value)
      ? 'peach'
      : /complete|approve|active|reviewed|confirmed|^ok$/i.test(value)
        ? 'mint'
        : 'violet';

export function statusLabel(value: string) {
  return statuses[value] ?? value;
}
export function Status({ value }: { value: unknown }) {
  if (typeof value !== 'string' || !value) return null;
  return <span className={`cab-status cab-tone-${color(value)}`}>{statusLabel(value)}</span>;
}
export function LoadState({
  error,
  refreshing,
  retry,
}: {
  error?: unknown;
  refreshing?: boolean;
  retry?: () => void;
}) {
  if (refreshing)
    return (
      <div className="cab-empty" role="status">
        <span className="cab-spinner" /> Загружаем данные…
      </div>
    );
  if (!error)
    return (
      <div className="cab-empty">
        <Icon name="circle" size={18} /> Пока здесь нет записей
      </div>
    );
  return (
    <div className="cab-empty cab-empty-error" role="alert">
      <Icon name="warning" size={19} />
      <span>{readableError(error)}</span>
      {retry && (
        <button className="cab-text-button" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}
export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value))) {
      return new Intl.DateTimeFormat('ru', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    }
    return statusLabel(value);
  }
  if (typeof value === 'number') return new Intl.NumberFormat('ru').format(value);
  if (
    Array.isArray(value) &&
    value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))
  )
    return value.map(display).join(', ');
  return '—';
}
const titleKeys = [
  'title',
  'subjectName',
  'displayName',
  'fullName',
  'studentName',
  'teacherName',
  'name',
  'contactName',
  'label',
  'kind',
  'type',
];
function itemTitle(row: Details) {
  const key = titleKeys.find((key) => typeof row[key] === 'string' && row[key]);
  return key
    ? display(row[key])
    : typeof row.status === 'string'
      ? statusLabel(row.status)
      : 'Запись';
}
function visibleEntries(data: Details) {
  return Object.entries(data).filter(([key, value]) => !invisible.test(key) && value !== undefined);
}

export function ObjectDetails({ data, depth = 0 }: { data: Details; depth?: number }) {
  const entries = visibleEntries(data);
  if (!entries.length) return <LoadState />;
  return (
    <div className="cab-object">
      <dl>
        {entries
          .filter(
            ([, value]) =>
              value === null ||
              typeof value !== 'object' ||
              (Array.isArray(value) && value.every((x) => typeof x !== 'object')),
          )
          .map(([key, value]) => (
            <div key={key}>
              <dt>{fieldLabel(key)}</dt>
              <dd>{key === 'status' ? <Status value={value} /> : display(value)}</dd>
            </div>
          ))}
      </dl>
      {depth < 2 &&
        entries
          .filter(
            ([, value]) =>
              value !== null &&
              typeof value === 'object' &&
              (!Array.isArray(value) || value.some((x) => typeof x === 'object')),
          )
          .map(([key, value]) => (
            <details className="cab-disclosure" key={key}>
              <summary>
                {fieldLabel(key)}
                {Array.isArray(value) ? ` · ${value.length}` : ''}
              </summary>
              {Array.isArray(value) ? (
                value.map((item, index) => (
                  <ObjectDetails key={index} data={record(item)} depth={depth + 1} />
                ))
              ) : (
                <ObjectDetails data={record(value)} depth={depth + 1} />
              )}
            </details>
          ))}
    </div>
  );
}

function safeLink(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const linkResponses = new Set([
  'getStudentMaterialUrl',
  'checkFileAccess',
  'getStudentEducationPdfStatus',
]);
function ResponseBody({
  sourceId,
  value,
  onPick,
}: {
  sourceId: string;
  value: unknown;
  onPick?: (row: Details) => void;
}) {
  const [selected, setSelected] = useState<Details | null>(null);
  const rows = rowsOf(value);
  const object = record(value);
  const rawUrl =
    linkResponses.has(sourceId) && safeLink(object.downloadUrl ?? object.url ?? object.signedUrl);
  if (value === null || value === undefined || (!rows.length && !Object.keys(object).length))
    return <LoadState />;
  if (rawUrl)
    return (
      <a className="cab-button cab-primary" href={rawUrl} target="_blank" rel="noreferrer">
        Открыть файл <Icon name="external" size={16} />
      </a>
    );
  if (!rows.length) {
    if (
      Object.keys(object).some((key) => Array.isArray(object[key])) &&
      visibleEntries(object).every(([, item]) => Array.isArray(item) && !item.length)
    )
      return <LoadState />;
    return <ObjectDetails data={object} />;
  }
  return (
    <>
      <div className="cab-record-list">
        {rows.map((row, index) => {
          const subtitle = [
            'scheduledAt',
            'startsAt',
            'dueAt',
            'teacherName',
            'studentName',
            'email',
            'amount',
          ]
            .filter((key) => row[key] !== undefined && display(row[key]) !== itemTitle(row))
            .slice(0, 3)
            .map((key) => display(row[key]))
            .join(' · ');
          return (
            <button
              type="button"
              className={`cab-record ${selected === row ? 'is-selected' : ''}`}
              key={String(row.id ?? row.lessonId ?? row.subjectId ?? index)}
              onClick={() => {
                setSelected(row);
                onPick?.(row);
              }}
            >
              <span
                className={`cab-record-icon cab-tone-${['violet', 'mint', 'peach', 'blue'][index % 4]}`}
              >
                <Icon name="materials" size={18} />
              </span>
              <span className="cab-record-content">
                <strong>{itemTitle(row)}</strong>
                {subtitle && <small>{subtitle}</small>}
              </span>
              <Status value={row.status ?? row.displayStatus} />
              <Icon name="arrow" size={17} />
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="cab-row-inspector">
          <h3>{itemTitle(selected)}</h3>
          <ObjectDetails data={selected} />
        </div>
      )}
    </>
  );
}

function schemaType(schema: Schema) {
  return Array.isArray(schema.type) ? schema.type.find((item) => item !== 'null') : schema.type;
}
type Field = {
  name: string;
  schema: Schema;
  required: boolean;
  section: 'path' | 'query' | 'body';
};
function fields(operation: Operation, bodyShape: Schema): Field[] {
  return [
    ...(operation.parameters ?? [])
      .filter((p) => p.in === 'path' || p.in === 'query')
      .map((p) => ({
        name: p.name,
        schema: resolveSchema(p.schema),
        required: p.required === true || p.in === 'path',
        section: p.in as 'path' | 'query',
      })),
    ...Object.entries(bodyShape.properties ?? {}).map(([name, value]) => ({
      name,
      schema: resolveSchema(value),
      required: (bodyShape.required ?? []).includes(name),
      section: 'body' as const,
    })),
  ];
}
function inputValue(field: Field, value: FormDataEntryValue | null): unknown {
  if (typeof value !== 'string' || value === '') return undefined;
  const type = schemaType(field.schema);
  if (type === 'boolean') return value === 'true';
  if (type === 'number' || type === 'integer') {
    const number = Number(value);
    if (!Number.isFinite(number)) return undefined;
    return number;
  }
  if (type === 'object' || type === 'array') return JSON.parse(value) as unknown;
  if (field.schema.format === 'date-time' && !value.endsWith('Z'))
    return new Date(value).toISOString();
  return value;
}

function formFields(values: FormData, definitions: Field[]) {
  const params: Record<string, string> = {};
  const query: Record<string, string | number | boolean> = {};
  const body: Details = {};
  for (const field of definitions) {
    const value = inputValue(field, values.get(`${field.section}:${field.name}`));
    if (value === undefined) continue;
    if (field.section === 'path') params[field.name] = String(value);
    else if (field.section === 'query')
      query[field.name] =
        typeof value === 'object' ? JSON.stringify(value) : (value as string | boolean | number);
    else body[field.name] = value;
  }
  return { params, query, body };
}

function OperationInput({ field, hint }: { field: Field; hint?: string }) {
  const { schema, required, name, section } = field;
  const id = `${section}:${name}`;
  const type = schemaType(schema);
  const choices = schema.enum ?? (type === 'boolean' ? [true, false] : undefined);
  const multiline =
    type === 'array' || type === 'object' || /reason|description|note|comment|text/i.test(name);
  return (
    <label className="cab-form-label">
      <span>
        {fieldLabel(name)}
        {required ? ' *' : ''}
      </span>
      {choices ? (
        <select name={id} required={required} defaultValue={hint ?? ''}>
          <option value="">Выберите значение</option>
          {choices.map((value) => (
            <option key={String(value)} value={String(value)}>
              {display(value)}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          name={id}
          required={required}
          defaultValue={hint}
          rows={3}
          maxLength={schema.maxLength}
          placeholder={type === 'array' ? '[]' : type === 'object' ? '{}' : undefined}
        />
      ) : (
        <input
          name={id}
          required={required}
          defaultValue={schema.format === 'date-time' ? hint?.slice(0, 16) : hint}
          type={
            /password|^token$/i.test(name)
              ? 'password'
              : schema.format === 'date'
                ? 'date'
                : schema.format === 'date-time'
                  ? 'datetime-local'
                  : schema.format === 'email'
                    ? 'email'
                    : type === 'number' || type === 'integer'
                      ? 'number'
                      : 'text'
          }
          min={schema.minimum}
          max={schema.maximum}
          step={type === 'integer' ? 1 : type === 'number' ? 'any' : undefined}
          minLength={schema.minLength}
          maxLength={schema.maxLength}
        />
      )}
    </label>
  );
}

function initialFilters(id: string): Record<string, string | number | boolean> {
  if (id === 'listManagerSchedule') {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 86400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return {};
}
const roleReadsRequireContext = (fields: Field[], path: Details, query: Details) =>
  fields.some(
    (field) =>
      field.required &&
      (field.section === 'path'
        ? path[field.name] === undefined
        : field.section === 'query'
          ? query[field.name] === undefined
          : false),
  );

function ReadPanel({
  operation,
  context,
  revision,
  onPick,
  onRecord,
}: {
  operation: Operation;
  context: Record<string, string>;
  revision: number;
  onPick: (row: Details) => void;
  onRecord?: (value: unknown) => void;
}) {
  const definitions = fields(operation, {});
  const autoQuery = useRef(initialFilters(operation.operationId));
  const initialPath = Object.fromEntries(
    definitions
      .filter((f) => f.section === 'path' && context[f.name])
      .map((f) => [f.name, context[f.name]!]),
  );
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState<{
    params: Record<string, string>;
    query: Record<string, string | number | boolean>;
  } | null>(null);
  const path = submitted?.params ?? initialPath;
  const query = submitted?.query ?? autoQuery.current;
  const canRead = !roleReadsRequireContext(definitions, path, query);
  const result = useEndpoint<unknown>(
    canRead ? operation.operationId : null,
    path,
    query,
    revision,
  );
  useEffect(() => {
    if (result.data) onRecord?.(result.data);
  }, [result.data, onRecord]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitted(formFields(new FormData(event.currentTarget), definitions));
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  }
  const response = record(result.data);
  const more =
    typeof response.nextCursor === 'string'
      ? response.nextCursor
      : typeof record(response.pagination).nextCursor === 'string'
        ? String(record(response.pagination).nextCursor)
        : null;
  return (
    <>
      {definitions.length > 0 && (
        <details className="cab-disclosure cab-filters" open={!canRead || undefined}>
          <summary>Параметры и фильтры</summary>
          <form onSubmit={search} className="cab-fields" key={JSON.stringify([path, query])}>
            {definitions.map((field) => (
              <OperationInput
                key={`${field.section}:${field.name}`}
                field={field}
                hint={String(
                  (field.section === 'path' ? path[field.name] : query[field.name]) ?? '',
                )}
              />
            ))}
            {invalid && (
              <p className="cab-form-error" role="alert">
                Проверьте формат параметров.
              </p>
            )}
            <div className="cab-form-actions">
              <button className="cab-button cab-primary" type="submit">
                Применить
              </button>
            </div>
          </form>
        </details>
      )}
      {!canRead ? (
        <div className="cab-empty">Выберите запись или заполните обязательные параметры.</div>
      ) : result.pending || result.error ? (
        <LoadState refreshing={result.pending} error={result.error} retry={result.refresh} />
      ) : (
        <ResponseBody
          key={JSON.stringify([path, query, revision])}
          sourceId={operation.operationId}
          value={result.data}
          onPick={onPick}
        />
      )}
      {more && definitions.some((field) => field.name === 'cursor') && (
        <button
          className="cab-button cab-secondary"
          onClick={() => setSubmitted({ params: path, query: { ...query, cursor: more } })}
        >
          Следующая страница <Icon name="arrow" size={16} />
        </button>
      )}
    </>
  );
}

export function CommandPanel({
  id,
  context,
  close,
  onDone,
}: {
  id: string;
  context: Record<string, string>;
  close: () => void;
  onDone: () => void;
}) {
  const operation = operations[id]!;
  const requestShape = requestSchema(operation);
  const variants = requestShape.oneOf ?? requestShape.anyOf;
  const [variant, setVariant] = useState(0);
  const body = variants ? resolveSchema(variants[variant]) : requestShape;
  const definitions = fields(operation, body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<unknown>();
  const [done, setDone] = useState(false);
  const lease = useRef<{ fingerprint: string; key: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current || done) return;
    let values: ReturnType<typeof formFields>;
    try {
      values = formFields(new FormData(event.currentTarget), definitions);
    } catch {
      setError(new Error('PARAMETER_REQUIRED'));
      return;
    }
    const fingerprint = JSON.stringify(values);
    if (lease.current?.fingerprint !== fingerprint)
      lease.current = { fingerprint, key: crypto.randomUUID() };
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true);
    setError(null);
    try {
      setOutcome(await request(id, { ...values, signal: pending.signal, key: lease.current.key }));
      if (!pending.signal.aborted) {
        setDone(true);
        onDone();
      }
    } catch (failure) {
      if (!pending.signal.aborted) setError(failure);
    } finally {
      if (!pending.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title={operationName(id)}
      description={done ? 'Команда подтверждена сервером.' : 'Проверьте параметры перед отправкой.'}
      pending={busy}
      contentProps={{ className: 'cab-dialog' }}
    >
      {done ? (
        <>
          {outcome !== undefined && <ResponseBody sourceId={id} value={outcome} />}
          <button type="button" className="cab-button cab-primary" onClick={close}>
            Готово
          </button>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="cab-fields">
          {variants && variants.length > 1 && (
            <label className="cab-form-label">
              <span>Вариант действия</span>
              <select value={variant} onChange={(event) => setVariant(Number(event.target.value))}>
                {variants.map((entry, index) => (
                  <option key={index} value={index}>
                    {entry.$ref
                      ?.split('/')
                      .at(-1)
                      ?.replace(/([a-z])([A-Z])/g, '$1 $2') ?? `Вариант ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {definitions.map((field) => (
            <OperationInput
              key={`${variant}:${field.section}:${field.name}`}
              field={field}
              hint={context[field.name] ?? ''}
            />
          ))}
          {error != null && (
            <p className="cab-form-error" role="alert">
              {readableError(error)}
            </p>
          )}
          <div className="cab-form-actions">
            <button
              className="cab-button cab-secondary"
              type="button"
              onClick={close}
              disabled={busy}
            >
              Отмена
            </button>
            <button className="cab-button cab-primary" type="submit" disabled={busy}>
              {busy ? 'Отправляем…' : 'Подтвердить'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

const linkIds: Record<string, string[]> = {
  getStudentLessons: ['id', 'lessonId'],
  getStudentUpcomingLessons: ['id', 'lessonId'],
  getStudentHomework: ['id', 'hwId'],
  getStudentReports: ['id', 'reportId'],
  getStudentMaterials: ['fileId'],
  getStudentNotifications: ['id'],
  getStudentSessions: ['sessionId'],
  getTeacherToday: ['id', 'lessonId'],
  getTeacherHomework: ['id', 'deliveryId'],
  getTeacherEnrollments: ['id', 'enrollmentId'],
  getTeacherCheckpoints: ['checkpointId'],
  listManagerStudents: ['studentId'],
  listManagerLeads: ['leadId'],
  listManagerTasks: ['taskId'],
  listManagerSchedule: ['lessonId', 'id'],
  listManagerTeachers: ['teacherId'],
  listManagerPayments: ['paymentId'],
  listManagerRequests: ['requestId'],
  listManagerSubscriptions: ['id'],
  getDirectorDecisions: ['id'],
  listDirectorStaff: ['id'],
  listDirectorEscalations: ['id'],
  listDirectorPeriods: ['id', 'periodId'],
  listDirectorSaleConditions: ['id'],
  listDirectorAllocationCorrections: ['id'],
};
function rowContext(row: Details, operationId: string, fixed: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (key.endsWith('Id') || ['id', 'kind', 'version', 'fileName', 'mimeType'].includes(key))
      next[key] = String(value);
  }
  const identity =
    row.id ?? row.homeworkId ?? row.lessonId ?? row.studentId ?? row.teacherId ?? row.reportId;
  if (typeof identity === 'string')
    for (const key of linkIds[operationId] ?? [])
      next[key] = typeof row[key] === 'string' ? (row[key] as string) : identity;
  return { ...next, ...fixed };
}
export function OperationWorkspace({
  section,
  detailPage,
  extra,
  onPick,
}: {
  section: Section;
  detailPage?: RecordPage;
  extra?: ReactNode;
  onPick?: (operation: string, row: Details) => void;
}) {
  const reads = section.reads.filter((id) => operations[id]);
  const detailId = detailPage?.operation;
  const [active, setActive] = useState(detailId ?? reads[0] ?? '');
  const scopedParams = detailPage?.params ?? {};
  const [openedRecord, setOpenedRecord] = useState<unknown>(null);
  const [selection, setSelection] = useState<Record<string, string> | null>(null);
  const detail = record(openedRecord);
  const context = selection ?? rowContext(detail, detailId ?? '', scopedParams);
  const decisionCommands = Array.isArray(detail.commands)
    ? detail.commands.map((entry) => record(entry).operationId)
    : [];
  const commands = section.commands.filter(
    (id) => operations[id] && (detailId !== 'getDirectorDecision' || decisionCommands.includes(id)),
  );
  const [command, setCommand] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const operation = operations[active];
  return (
    <>
      {extra}
      {commands.length > 0 && (
        <details className="cab-disclosure cab-command-switch">
          <summary>
            <Icon name="tasks" size={17} /> Действия раздела
          </summary>
          <div className="cab-action-grid">
            {commands.map((id) => (
              <button className="cab-button cab-secondary" key={id} onClick={() => setCommand(id)}>
                {operationName(id)} <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        </details>
      )}
      <div className="cab-card cab-work-card">
        {reads.length > 1 && (
          <div className="cab-tabs" role="group" aria-label="Представление раздела">
            {reads.map((id) => (
              <button
                key={id}
                aria-pressed={id === active}
                type="button"
                onClick={() => {
                  setSelection(null);
                  setActive(id);
                }}
              >
                {operationName(id)}
              </button>
            ))}
          </div>
        )}
        {operation ? (
          <ReadPanel
            key={operation.operationId}
            operation={operation}
            context={context}
            revision={revision}
            {...(operation.operationId === detailId ? { onRecord: setOpenedRecord } : {})}
            onPick={(row) => {
              setSelection(rowContext(row, operation.operationId, scopedParams));
              onPick?.(operation.operationId, row);
            }}
          />
        ) : (
          <LoadState />
        )}
      </div>
      {command && (
        <CommandPanel
          key={command}
          id={command}
          context={context}
          close={() => setCommand(null)}
          onDone={() => setRevision((value) => value + 1)}
        />
      )}
    </>
  );
}

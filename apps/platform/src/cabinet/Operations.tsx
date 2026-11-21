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
import { operationName } from './sections.js';
import { actionHint, actionStyle, enumTitle, fieldTitle, t, variantTitle } from './actionCopy.js';
import { serviceFields } from './fieldCopy.js';
import { PersonCard, personFrom } from './PersonCard.js';
import type { RecordPage } from './recordRoutes.js';
import type { Section } from './sections.js';

export const fieldLabel = (key: string) => fieldTitle(key);
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

const lowerStatuses = new Set(['ok', 'stale', 'stopped', 'unknown', 'unavailable']);
export function statusLabel(value: string) {
  return /^[A-Z][A-Z0-9_]*$/.test(value) || lowerStatuses.has(value) ? enumTitle(value) : value;
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
        <span className="cab-spinner" /> {t('Загружаем данные…', 'Se încarcă datele…')}
      </div>
    );
  if (!error)
    return (
      <div className="cab-empty">
        <Icon name="circle" size={18} /> {t('Пока здесь нет записей', 'Încă nu există înregistrări')}
      </div>
    );
  return (
    <div className="cab-empty cab-empty-error" role="alert">
      <Icon name="warning" size={19} />
      <span>{readableError(error)}</span>
      {retry && (
        <button className="cab-text-button" onClick={retry}>
          {t('Повторить', 'Reîncearcă')}
        </button>
      )}
    </div>
  );
}
const zoneCities: Record<string, readonly [string, string]> = {
  'Europe/Chisinau': ['Кишинёв', 'Chișinău'],
  'Europe/Bucharest': ['Бухарест', 'București'],
  'Europe/Kyiv': ['Киев', 'Kiev'],
  'Europe/Kiev': ['Киев', 'Kiev'],
  'Europe/Moscow': ['Москва', 'Moscova'],
};
/** "Europe/Chisinau" → "Кишинёв (GMT+2)"; unknown or invalid zones are shown as given. */
export function zoneLabel(zone: string) {
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    const city = zoneCities[zone];
    const name = city ? t(city[0], city[1]) : (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
    return offset ? `${name} (${offset})` : name;
  } catch {
    return zone;
  }
}

export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('Да', 'Da') : t('Нет', 'Nu');
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value))) {
      return new Intl.DateTimeFormat(t('ru', 'ro'), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    }
    return statusLabel(value);
  }
  if (typeof value === 'number') return new Intl.NumberFormat(t('ru', 'ro')).format(value);
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
const sourceTitleKey: Record<string, string> = { getTeacherNotifications: 'type' };
function itemTitle(row: Details) {
  const key = titleKeys.find((key) => typeof row[key] === 'string' && row[key]);
  return key
    ? display(row[key])
    : typeof row.status === 'string'
      ? statusLabel(row.status)
      : t('Запись', 'Înregistrare');
}
function visibleEntries(data: Details) {
  return Object.entries(data).filter(
    ([key, value]) => !invisible.test(key) && !serviceFields.has(key) && value !== undefined,
  );
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
              <dd>
                {key === 'status' ? (
                  <Status value={value} />
                ) : /^time_?zone$/i.test(key) && typeof value === 'string' ? (
                  zoneLabel(value)
                ) : (
                  display(value)
                )}
              </dd>
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
        {t('Открыть файл', 'Deschide fișierul')} <Icon name="external" size={16} />
      </a>
    );
  if (!rows.length) {
    const person = personFrom(sourceId, object);
    if (person) return <PersonCard person={person} />;
    if (
      Object.keys(object).some((key) => Array.isArray(object[key])) &&
      visibleEntries(object)
        .filter(([key]) => !['total', 'page', 'pageSize'].includes(key))
        .every(([, item]) => Array.isArray(item) && !item.length)
    )
      return <LoadState />;
    return <ObjectDetails data={object} />;
  }
  // Event feeds have no title field: the event type is what the row is about.
  const titleKey = sourceTitleKey[sourceId];
  const rowTitle = (row: Details) =>
    titleKey && typeof row[titleKey] === 'string' ? display(row[titleKey]) : itemTitle(row);
  const selectedPerson = selected ? personFrom(sourceId, selected) : null;
  return (
    <>
      <div className="cab-record-list">
        {rows.map((row, index) => {
          const subtitle = [
            'scheduledAt',
            'startsAt',
            'dueAt',
            'occurredAt',
            'subjectName',
            'teacherName',
            'studentName',
            'email',
            'amount',
          ]
            .filter((key) => row[key] !== undefined && display(row[key]) !== rowTitle(row))
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
                <strong>{rowTitle(row)}</strong>
                {subtitle && <small>{subtitle}</small>}
              </span>
              <Status value={row.status ?? row.displayStatus} />
              <Icon name="arrow" size={17} />
            </button>
          );
        })}
      </div>
      {selected &&
        (selectedPerson ? (
          <div className="cab-row-inspector">
            <PersonCard person={selectedPerson} />
          </div>
        ) : (
          <div className="cab-row-inspector">
            <h3>{rowTitle(selected)}</h3>
            <ObjectDetails data={selected} />
          </div>
        ))}
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

const recordField = /(^id$|Id$)/;
const concurrencyField = /^(version|expectedVersion|revision|disputesRevision)$/;
function OperationInput({
  field,
  hint,
  pickedLabel,
}: {
  field: Field;
  hint?: string;
  // Command forms: a record chosen in the list fills its identifier; show the record, not the UUID.
  pickedLabel?: string;
}) {
  const { schema, required, name, section } = field;
  const id = `${section}:${name}`;
  const type = schemaType(schema);
  const choices = schema.enum ?? (type === 'boolean' ? [true, false] : undefined);
  const multiline =
    type === 'array' || type === 'object' || /reason|description|note|comment|text/i.test(name);
  const [manual, setManual] = useState(false);
  // Optimistic-concurrency tokens are prefilled from the opened record; users never edit them.
  if (hint && concurrencyField.test(name)) return <input type="hidden" name={id} value={hint} />;
  if (!manual && pickedLabel !== undefined && hint && recordField.test(name) && type === 'string') {
    const label = pickedLabel || t('выбранная запись', 'înregistrarea selectată');
    return (
      <div className="cab-form-label cab-picked-field">
        <span>{fieldLabel(name)}</span>
        <input type="hidden" name={id} value={hint} />
        <span className="cab-picked-chip">
          <Icon name="check" size={15} />
          <span>{section === 'path' ? label : t(`из записи «${label}»`, `din „${label}”`)}</span>
          {section !== 'path' && (
            <button type="button" className="cab-text-button" onClick={() => setManual(true)}>
              {t('Изменить', 'Modifică')}
            </button>
          )}
        </span>
      </div>
    );
  }
  return (
    <label className="cab-form-label">
      <span>
        {fieldLabel(name)}
        {required ? ' *' : ''}
      </span>
      {choices ? (
        <select name={id} required={required} defaultValue={hint ?? ''}>
          <option value="">{t('Выберите значение', 'Alegeți o valoare')}</option>
          {choices.map((value) => (
            <option key={String(value)} value={String(value)}>
              {typeof value === 'string' ? enumTitle(value) : display(value)}
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
          placeholder={
            recordField.test(name) && type === 'string'
              ? t('Выберите запись в списке', 'Alegeți o înregistrare din listă')
              : undefined
          }
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
// Reads whose API requires exactly one of several optional query params (OpenAPI cannot express it).
const requiresOneOf: Record<string, string[]> = {
  listManagerContacts: ['leadId', 'studentId', 'teacherId'],
};
const roleReadsRequireContext = (
  operationId: string,
  fields: Field[],
  path: Details,
  query: Details,
) =>
  (requiresOneOf[operationId]?.every((name) => query[name] === undefined || query[name] === '') ??
    false) ||
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
  fixedQuery,
}: {
  operation: Operation;
  context: Record<string, string>;
  revision: number;
  onPick: (row: Details) => void;
  onRecord?: (value: unknown) => void;
  fixedQuery?: Record<string, string>;
}) {
  const definitions = fields(operation, {}).filter(
    (field) => field.section !== 'query' || !Object.hasOwn(fixedQuery ?? {}, field.name),
  );
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
  const query = { ...(submitted?.query ?? autoQuery.current), ...fixedQuery };
  const canRead = !roleReadsRequireContext(operation.operationId, definitions, path, query);
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
          <summary>{t('Параметры и фильтры', 'Parametri și filtre')}</summary>
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
                {t('Проверьте формат параметров.', 'Verificați formatul parametrilor.')}
              </p>
            )}
            <div className="cab-form-actions">
              <button className="cab-button cab-primary" type="submit">
                {t('Применить', 'Aplică')}
              </button>
            </div>
          </form>
        </details>
      )}
      {!canRead ? (
        <div className="cab-empty">
          {t(
            'Выберите запись или заполните обязательные параметры.',
            'Alegeți o înregistrare sau completați parametrii obligatorii.',
          )}
        </div>
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
          {t('Следующая страница', 'Pagina următoare')} <Icon name="arrow" size={16} />
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
  pickedLabel,
}: {
  id: string;
  context: Record<string, string>;
  close: () => void;
  onDone: () => void;
  pickedLabel?: string;
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
      description={
        done
          ? t('Готово — изменения сохранены.', 'Gata — modificările au fost salvate.')
          : (actionHint(id) ??
            t('Заполните поля и подтвердите действие.', 'Completați câmpurile și confirmați.'))
      }
      pending={busy}
      contentProps={{ className: 'cab-dialog' }}
    >
      {done ? (
        <>
          {outcome !== undefined && <ResponseBody sourceId={id} value={outcome} />}
          <button type="button" className="cab-button cab-primary" onClick={close}>
            {t('Готово', 'Gata')}
          </button>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="cab-fields">
          {variants && variants.length > 1 && (
            <label className="cab-form-label">
              <span>{t('Вариант действия', 'Varianta acțiunii')}</span>
              <select value={variant} onChange={(event) => setVariant(Number(event.target.value))}>
                {variants.map((entry, index) => (
                  <option key={index} value={index}>
                    {variantTitle(entry.$ref?.split('/').at(-1), index)}
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
              {...(pickedLabel !== undefined ? { pickedLabel } : {})}
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
              {t('Отмена', 'Anulează')}
            </button>
            <button
              className={`cab-button ${actionStyle(id).tone === 'danger' ? 'cab-danger' : 'cab-primary'}`}
              type="submit"
              disabled={busy}
            >
              {busy ? t('Сохраняем…', 'Se salvează…') : operationName(id)}
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
  renderExtra,
  onPick,
  fixedQuery,
}: {
  section: Section;
  detailPage?: RecordPage;
  extra?: ReactNode;
  renderExtra?: (controls: {
    revision: number;
    context: Record<string, string>;
    select: (operation: string, row: Details) => void;
    openCommand: (id: string) => void;
  }) => ReactNode;
  onPick?: (operation: string, row: Details) => void;
  fixedQuery?: Record<string, string>;
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
  const [pickedTitle, setPickedTitle] = useState<string | null>(null);
  const operation = operations[active];
  const hasRecord = Object.keys(context).some((key) => recordField.test(key));
  const recordTitle = selection
    ? (pickedTitle ?? '')
    : Object.keys(detail).length
      ? itemTitle(detail)
      : '';
  function select(operationId: string, row: Details) {
    setSelection(rowContext(row, operationId, scopedParams));
    setPickedTitle(itemTitle(row));
    onPick?.(operationId, row);
  }
  return (
    <>
      {extra}
      {renderExtra?.({ revision, context, select, openCommand: setCommand })}
      {commands.length > 0 && (
        <QuickActions
          commands={commands}
          context={context}
          recordTitle={hasRecord ? recordTitle : null}
          onRun={setCommand}
        />
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
            {...(fixedQuery ? { fixedQuery } : {})}
            {...(operation.operationId === detailId ? { onRecord: setOpenedRecord } : {})}
            onPick={(row) => select(operation.operationId, row)}
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
          {...(hasRecord ? { pickedLabel: recordTitle } : {})}
        />
      )}
    </>
  );
}

function missingRecord(id: string, context: Record<string, string>) {
  const path = operations[id]?.path ?? '';
  return [...path.matchAll(/\{([^}]+)\}/g)].some(([, name]) => !name || !context[name]);
}

function QuickActions({
  commands,
  context,
  recordTitle,
  onRun,
}: {
  commands: string[];
  context: Record<string, string>;
  recordTitle: string | null;
  onRun: (id: string) => void;
}) {
  const main = commands.filter((id) => !actionStyle(id).advanced);
  const advanced = commands.filter((id) => actionStyle(id).advanced);
  const needsRecord = commands.some((id) => missingRecord(id, context));
  return (
    <section className="cab-card cab-quick" aria-labelledby="cab-quick-title">
      <header className="cab-quick-head">
        <h2 id="cab-quick-title">{t('Быстрые действия', 'Acțiuni rapide')}</h2>
        {recordTitle !== null ? (
          <span className="cab-quick-target">
            <Icon name="check" size={15} />
            {t('Для записи:', 'Pentru:')} <strong>{recordTitle || t('выбрана', 'selectată')}</strong>
          </span>
        ) : (
          needsRecord && (
            <span className="cab-quick-tip">
              <Icon name="info" size={15} />
              {t(
                'Выберите запись в списке ниже — данные подставятся в действие',
                'Alegeți o înregistrare din lista de mai jos — datele se completează automat',
              )}
            </span>
          )
        )}
      </header>
      {main.length > 0 && (
        <div className="cab-quick-grid">
          {main.map((id) => {
            const { icon, tone } = actionStyle(id);
            const hint = actionHint(id);
            const waiting = missingRecord(id, context);
            return (
              <button
                key={id}
                type="button"
                className={`cab-quick-action is-${tone}`}
                onClick={() => onRun(id)}
              >
                <span className="cab-quick-icon" aria-hidden="true">
                  <Icon name={icon} size={19} />
                </span>
                <span className="cab-quick-text">
                  <strong>{operationName(id)}</strong>
                  {hint && <small>{hint}</small>}
                  {waiting && (
                    <em className="cab-quick-badge">
                      {t('нужна запись из списка', 'necesită o înregistrare')}
                    </em>
                  )}
                </span>
                <Icon name="arrow" size={16} className="cab-quick-arrow" />
              </button>
            );
          })}
        </div>
      )}
      {advanced.length > 0 && (
        <div className="cab-quick-advanced">
          <span>{t('Служебные операции', 'Operațiuni de serviciu')}</span>
          <div>
            {advanced.map((id) => (
              <button
                key={id}
                type="button"
                className={`cab-quick-chip ${actionStyle(id).tone === 'danger' ? 'is-danger' : ''}`}
                onClick={() => onRun(id)}
              >
                <Icon name={actionStyle(id).icon} size={14} />
                {operationName(id)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

import source from '../../../../packages/api-contracts/openapi/openapi.json';
import { getCsrfToken, schoolFetch } from '@online-school/api-contracts';
import type { ClientError } from '@online-school/api-contracts';

export type Role = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'DIRECTOR' | 'TECH_OPERATOR';
export type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
export type Schema = {
  $ref?: string;
  type?: string | string[];
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: (string | number | boolean)[];
  items?: Schema;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
};
type Parameter = { name: string; in: string; required?: boolean; schema?: Schema };
type Content = { schema?: Schema };
type SpecOperation = {
  operationId: string;
  summary?: string;
  parameters?: Parameter[];
  requestBody?: { content: Record<string, Content> };
  responses?: Record<string, { content?: Record<string, Content> }>;
};
export type Operation = SpecOperation & { path: string; method: Method };

const spec = source as unknown as {
  paths: Record<string, Partial<Record<Method, SpecOperation>>>;
  components: { schemas: Record<string, Schema> };
};
export const operations = Object.fromEntries(
  Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(
        ([method, detail]) =>
          ['get', 'post', 'patch', 'put', 'delete'].includes(method) && detail?.operationId,
      )
      .map(([method, detail]) => [
        detail.operationId,
        { ...detail, path, method: method as Method },
      ]),
  ),
) as Record<string, Operation>;

export const roleNames: Record<Role, string> = {
  STUDENT: 'Ученик',
  TEACHER: 'Преподаватель',
  MANAGER: 'Менеджер',
  DIRECTOR: 'Руководитель',
  TECH_OPERATOR: 'Технический оператор',
};
export const homes: Record<Role, string> = {
  STUDENT: '/student',
  TEACHER: '/teacher',
  MANAGER: '/manager',
  DIRECTOR: '/director',
  TECH_OPERATOR: '/operator',
};

export function resolveSchema(schema?: Schema): Schema {
  if (!schema) return {};
  if (schema.$ref)
    return resolveSchema(spec.components.schemas[schema.$ref.split('/').at(-1) ?? '']);
  if (schema.allOf) {
    const layers = schema.allOf.map(resolveSchema);
    return {
      type: 'object',
      properties: Object.assign({}, ...layers.map((entry) => entry.properties)),
      required: [...new Set(layers.flatMap((entry) => entry.required ?? []))],
    };
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (variants) {
    const nonNull = variants.filter((entry) => entry.type !== 'null');
    if (nonNull.length === 1) return resolveSchema(nonNull[0]);
  }
  return schema;
}

export function requestSchema(operation: Operation) {
  return resolveSchema(operation.requestBody?.content['application/json']?.schema);
}

export class CabinetError extends Error {
  constructor(readonly issue: ClientError) {
    super(issue.code);
  }
}

export async function request<T>(
  id: string,
  options: {
    params?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
    signal?: AbortSignal;
    key?: string;
  } = {},
): Promise<T> {
  const operation = operations[id];
  if (!operation) return Promise.reject(new Error('OPERATION_UNAVAILABLE'));
  const parts = [...operation.path.matchAll(/\{([^}]+)\}/g)];
  if (parts.some(([, name]) => !name || !options.params?.[name]?.trim()))
    return Promise.reject(new Error('PARAMETER_REQUIRED'));
  const path = operation.path.replace(/\{([^}]+)\}/g, (_, name: string) =>
    encodeURIComponent(options.params?.[name]?.trim() ?? ''),
  );
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(options.query ?? {})) query.set(name, String(value));
  const messages = new Headers();
  const mutates = operation.method !== 'get';
  if (mutates) {
    const csrf = await getCsrfToken({
      cache: 'no-store',
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!csrf.ok) return Promise.reject(new CabinetError(csrf.error));
    messages.set('X-CSRF-Token', csrf.value.csrfToken);
    if (
      operation.parameters?.some(
        (p) => p.in === 'header' && p.name.toLowerCase() === 'idempotency-key',
      )
    ) {
      messages.set('Idempotency-Key', options.key ?? crypto.randomUUID());
    }
  }
  const body =
    options.body ?? (operation.requestBody?.content['application/json'] ? {} : undefined);
  if (body !== undefined) messages.set('Content-Type', 'application/json');
  const successes = Object.entries(operation.responses ?? {}).filter(([status]) =>
    status.startsWith('2'),
  );
  const response = successes[0];
  const empty =
    response?.[0] === '204' ||
    (successes.some(([status]) => status === '204') &&
      successes.every(([, spec]) => !Object.keys(spec.content ?? {}).length));
  const binary =
    response?.[1].content &&
    !response[1].content['application/json'] &&
    Object.keys(response[1].content).some((type) =>
      /^(image\/|application\/(pdf|octet-stream))/.test(type),
    );
  const result = await schoolFetch<T>(path + (query.size ? '?' + query.toString() : ''), {
    method: operation.method.toUpperCase(),
    headers: messages,
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(binary ? { binaryResponse: true } : {}),
    ...(empty ? { emptyResponse: true } : {}),
  });
  if (!result.ok) return Promise.reject(new CabinetError(result.error));
  return result.value;
}

export type Details = Record<string, unknown>;
export const record = (value: unknown): Details =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Details) : {};
export const rowsOf = (value: unknown): Details[] => {
  if (Array.isArray(value)) return value.map(record);
  const object = record(value);
  for (const key of [
    'items',
    'lessons',
    'rows',
    'reports',
    'subjects',
    'entries',
    'payments',
    'sessions',
    'teachers',
    'counts',
    'periods',
  ]) {
    const candidate = object[key];
    if (Array.isArray(candidate)) return candidate.map(record);
  }
  return [];
};
export function readableError(value: unknown) {
  if (value instanceof CabinetError) {
    switch (value.issue.status) {
      case 401:
        return 'Сессия завершена. Войдите снова.';
      case 402:
        return 'Функция приостановлена. Проверьте состояние абонемента.';
      case 403:
        return 'Для этого действия недостаточно полномочий.';
      case 404:
        return 'Запись или раздел пока недоступны.';
      case 409:
        return 'Данные изменились или команда уже выполнена. Обновите раздел.';
      case 429:
        return 'Слишком много запросов. Попробуйте позже.';
      case 422:
        return 'Проверьте введённые данные и допустимость действия.';
      default:
        return 'Не удалось получить ответ от сервера.';
    }
  }
  return value instanceof Error && value.message === 'PARAMETER_REQUIRED'
    ? 'Заполните обязательные поля.'
    : 'Не удалось выполнить действие.';
}

export function safeMeet(value: unknown) {
  if (typeof value !== 'string') return null;
  return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(value) ? value : null;
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const methods = new Set(['get', 'post', 'patch', 'put', 'delete']);
const schemaFields = new Set([
  '$ref',
  'type',
  'format',
  'properties',
  'required',
  'enum',
  'items',
  'allOf',
  'anyOf',
  'oneOf',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'pattern',
]);

// Browsers need request metadata and response media types only. Keep the full spec in api-contracts.
function cabinetContract(code: string) {
  const { paths, components } = object(JSON.parse(code));
  const definitions = object(object(components).schemas);
  const schemas: Json = {};
  function schema(input: unknown): Json {
    const result: Json = {};
    for (const [key, value] of Object.entries(object(input))) {
      if (!schemaFields.has(key)) continue;
      if (key === '$ref' && typeof value === 'string') {
        const name = value.split('/').at(-1);
        if (name && definitions[name] && !(name in schemas)) {
          schemas[name] = {};
          schemas[name] = schema(definitions[name]);
        }
      }
      result[key] =
        key === 'properties'
          ? Object.fromEntries(
              Object.entries(object(value)).map(([property, entry]) => [property, schema(entry)]),
            )
          : key === 'items'
            ? schema(value)
            : ['allOf', 'anyOf', 'oneOf'].includes(key) && Array.isArray(value)
              ? value.map(schema)
              : value;
    }
    return result;
  }
  const browserPaths: Json = {};
  for (const [path, entry] of Object.entries(object(paths))) {
    const operations: Json = {};
    for (const [method, value] of Object.entries(object(entry))) {
      if (!methods.has(method)) continue;
      const operation = object(value);
      const content = object(object(operation.requestBody).content);
      operations[method] = {
        operationId: operation.operationId,
        parameters: Array.isArray(operation.parameters)
          ? operation.parameters.map((value) => {
              const { name, in: location, required, schema: shape } = object(value);
              return { name, in: location, required, schema: schema(shape) };
            })
          : [],
        ...(content['application/json']
          ? {
              requestBody: {
                content: {
                  'application/json': {
                    schema: schema(object(content['application/json']).schema),
                  },
                },
              },
            }
          : {}),
        responses: Object.fromEntries(
          Object.entries(object(operation.responses))
            .filter(([status]) => status.startsWith('2'))
            .map(([status, response]) => [
              status,
              {
                content: Object.fromEntries(
                  Object.keys(object(object(response).content)).map((mime) => [mime, {}]),
                ),
              },
            ]),
        ),
      };
    }
    browserPaths[path] = operations;
  }
  return JSON.stringify({ paths: browserPaths, components: { schemas } });
}

export default defineConfig({
  plugins: [
    {
      name: 'cabinet-api-contract',
      enforce: 'pre',
      transform(source, id) {
        if (id.replaceAll('\\', '/').endsWith('/packages/api-contracts/openapi/openapi.json')) {
          return { code: cabinetContract(source), map: null };
        }
      },
    },
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});

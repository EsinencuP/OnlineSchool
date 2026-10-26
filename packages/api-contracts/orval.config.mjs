import { defineConfig } from 'orval';

export default defineConfig({
  school: {
    input: './openapi/openapi.json',
    output: {
      target: './src/generated/client.ts',
      client: 'fetch',
      mode: 'single',
      override: {
        mutator: { path: './src/transport.ts', name: 'schoolFetch', inferred: true },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});

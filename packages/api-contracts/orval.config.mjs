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
        operations: {
          getStudentAvatar: {
            mutator: { path: './src/transport.ts', name: 'schoolBlobFetch', inferred: true },
          },
          revokeStudentSession: {
            mutator: { path: './src/transport.ts', name: 'schoolEmptyFetch', inferred: true },
          },
          markStudentNotificationRead: {
            mutator: { path: './src/transport.ts', name: 'schoolEmptyFetch', inferred: true },
          },
          markAllStudentNotificationsRead: {
            mutator: { path: './src/transport.ts', name: 'schoolEmptyFetch', inferred: true },
          },
          markStudentReportRead: {
            mutator: { path: './src/transport.ts', name: 'schoolEmptyFetch', inferred: true },
          },
        },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  test: { environment: 'node' },
} as Parameters<typeof defineConfig>[0]);

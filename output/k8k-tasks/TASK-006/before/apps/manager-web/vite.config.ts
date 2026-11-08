import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
  base: '/manager/',
  build: { manifest: true },
  publicDir: mode === 'mock' ? 'test/public' : false,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5177,
    proxy: mode === 'mock' ? {} : { '/api': 'http://127.0.0.1:3000' },
  },
  preview: { host: '127.0.0.1', port: 4180 },
}));

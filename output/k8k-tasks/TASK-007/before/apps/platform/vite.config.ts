import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/student': 'http://127.0.0.1:5174',
      '/manager': 'http://127.0.0.1:5177',
      '/api': 'http://127.0.0.1:3000',
    },
  },
});

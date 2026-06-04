import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/services/**/*.ts',
        'src/components/TaskCard.tsx',
      ],
      exclude: [
        'src/tests/**',
        'src/**/*.test.ts',
      ],
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.BACKEND_URL || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // All API traffic goes through the same origin in dev; Vite proxies
        // it to the FastAPI backend (no CORS needed, see ADR-0004).
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      outDir: 'dist',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})

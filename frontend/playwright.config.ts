import { defineConfig } from '@playwright/test'

/**
 * E2E config. Servers are expected to be running already:
 *   backend: SIMULATE_SCAN=true uvicorn on :8000 (no real LLM calls)
 *   frontend: vite dev on :5173 (proxies /api to the backend)
 * Run: pnpm/npm exec playwright test
 *
 * Uses the system Chrome (channel: 'chrome') so no browser download is
 * needed; CI can switch to `browserName: 'chromium'` with the official
 * install step instead.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    channel: 'chrome',
  },
  projects: [{ name: 'system-chrome', use: { browserName: 'chromium' } }],
})

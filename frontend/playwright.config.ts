import { defineConfig } from '@playwright/test'

/**
 * E2E config. Servers are expected to be running already:
 *   backend: SIMULATE_SCAN=true uvicorn on :8000 (no real LLM calls)
 *   frontend: vite dev on :5173 (proxies /api to the backend)
 * Run:
 *   PLAYWRIGHT_SYSTEM_CHROME=1 npx playwright test   (local: system Chrome)
 *   npx playwright install chromium && npx playwright test  (CI: downloaded)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_SYSTEM_CHROME ? { channel: 'chrome' } : {}),
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

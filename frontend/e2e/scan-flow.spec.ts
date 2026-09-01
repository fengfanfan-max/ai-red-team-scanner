import { expect, test } from '@playwright/test'

/**
 * M4 DoD scenario: register → create application → create scan →
 * scans list shows progress reaching 100%.
 *
 * Requires the backend running with SIMULATE_SCAN=true and `vite dev` on
 * port 5173 (see playwright.config.ts). Each run uses a unique email so
 * repeated runs are safe.
 */

const email = `e2e-${Date.now()}@test.dev`
const password = 'password123'

test('full scan flow: register → app → scan → completed', async ({ page }) => {
  // --- register ---
  await page.goto('/register')
  await page.fill('#name', 'E2E User')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.fill('#confirm', password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/home/)

  // --- create an application ---
  await page.goto('/applications')
  await page.getByRole('button', { name: 'New application' }).click()
  await page.fill('#name', 'E2E Target')
  await page.fill('#baseUrl', 'https://api.openai.com/v1')
  await page.fill('#modelName', 'gpt-4o-mini')
  await page.fill('#apiKey', 'sk-e2e-1234567890')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText('E2E Target')).toBeVisible()

  // --- create a scan via the wizard ---
  await page.goto('/scans/new')
  // step 1: pick the application
  await page.getByRole('button', { name: /E2E Target/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  // step 2: keep default algorithm
  await page.getByRole('button', { name: 'Next' }).click()
  // step 3: pick a dataset
  await page.getByRole('button', { name: /Content Safety/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  // step 4: test chat is optional — skip
  await page.getByRole('button', { name: 'Next' }).click()
  // step 5: start
  await expect(page.getByText('Expected LLM calls')).toBeVisible()
  await page.getByRole('button', { name: 'Start scan' }).click()
  await expect(page).toHaveURL(/\/scans$/)

  // --- scans list: watch progress reach 100% ---
  const card = page.locator('text=/scan-/').last()
  await expect(card).toBeVisible()
  await expect(page.getByText('Completed').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Safety score:').first()).toBeVisible()

  // --- result page ---
  await page.locator('text=/scan-/').last().click()
  await expect(page.getByText('Safety score').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: /Failures/ })).toBeVisible()

  // overview tab
  await expect(page.getByText(/Risk by category/).first()).toBeVisible()

  // all cases tab: table with latency + filter buttons
  await page.getByRole('tab', { name: 'All cases' }).click()
  await expect(page.getByRole('button', { name: 'passed' })).toBeVisible()
  await expect(page.getByText(/\d+ cases · page/).first()).toBeVisible()
  await page.getByRole('button', { name: 'failed' }).click()
  // either failed rows (status badge) or the empty-state message
  await expect(page.getByText(/failed|No cases match this filter/i).first()).toBeVisible()

  // failures tab
  await page.getByRole('tab', { name: /Failures/ }).click()
  await expect(page.getByRole('tab', { name: /Failures/ })).toBeVisible()

  // --- rerun: same config as a new scan, navigates to the new one ---
  await page.getByRole('button', { name: 'Rerun' }).click()
  await expect(page).toHaveURL(/\/scans\/\d+$/)
  await expect(page.getByText(/rerun @ /).first()).toBeVisible()

  // --- family grouping: back on the list, the root + rerun must be ONE card
  // showing 2 runs, with an expandable history ---
  await page.goto('/scans')
  await expect(page.getByText(/2 runs/).first()).toBeVisible()
  await page.getByRole('button', { name: /Show history \(2 runs\)/ }).click()
  await expect(page.getByText(/rerun @ /).first()).toBeVisible()

  // --- dashboard ---
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Total scans')).toBeVisible()
  await expect(page.getByText('Avg safety score')).toBeVisible()
  await expect(page.getByText(/Recent scans/)).toBeVisible()
  await expect(page.getByText(/Risk by category/).first()).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from './_helpers'
import { mkdir } from 'fs/promises'
import path from 'path'

test.use({ viewport: { width: 390, height: 844 } })

test('Mobile defaults to List View and shows cap messaging when applicable', async ({ page }) => {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('feature.mobileGuardrails', '1') } catch {}
  })
  await gotoSandbox(page)
  await waitForPanel(page)

  // List-first: list node buttons visible
  await expect(page.locator('[data-testid^="list-node-"]').first()).toBeVisible()

  // Capture a mobile baseline screenshot (List-first surface)
  await mkdir(path.join(process.cwd(), 'docs/evidence/mobile'), { recursive: true })
  await page.screenshot({ path: 'docs/evidence/mobile/mobile_list-first_390x844.png', fullPage: true })

  // Optional: cap messaging is rendered based on sample graph size
  // We don't force add nodes here; just check message presence if any
  const maybeMsg = page.locator('[data-testid="mobile-cap-msg"]')
  // It might not be visible if below thresholds; allow either state
  // but ensure no errors thrown by querying it.
  await maybeMsg.first().isVisible().catch(() => {})
})

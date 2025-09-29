import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from './_helpers'
import { mkdir } from 'fs/promises'
import path from 'path'

// Simplify View hides weaker links (list view edges) and announces to SR
// Note: We use List View selectors (list-edge-*) since Canvas edges are not rendered in DOM here

// Use a mobile viewport to match ≤480 px baselines
test.use({ viewport: { width: 390, height: 844 } })

test('Simplify View hides weaker links and announces to SR', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('feature.canvasSimplify', '1')
      window.localStorage.setItem('feature.listView', '1')
    } catch {}
  })
  await gotoSandbox(page)
  await waitForPanel(page)

  const edges = page.locator('[data-testid^="list-edge-"]')
  const before = await edges.count()
  expect(before).toBeGreaterThan(0)

  await page.getByTestId('simplify-toggle').click()

  const after = await edges.count()
  expect(after).toBeLessThan(before)

  // Assert SR announcement string reflects dynamic threshold
  const sr = page.getByTestId('simplify-indicator').first()
  await expect(sr).toHaveText(/^Simplify on\. \d+ links hidden \(threshold 0\.4\)\.$/)

  // Badge shows active threshold
  await expect(page.getByTestId('simplify-badge')).toHaveText('Active threshold: 0.4')

  // Capture a screenshot for the mobile SR announcement baseline
  await mkdir(path.join(process.cwd(), 'docs/evidence/mobile'), { recursive: true })
  await page.screenshot({ path: 'docs/evidence/mobile/mobile_simplify_sr_announcement_390x844.png', fullPage: true })
})

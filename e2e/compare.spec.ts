import { test, expect } from '@playwright/test'
import { gotoSandbox, installFakeEventSource } from './_helpers'

// Compare snapshots E2E
// Flags: feature.snapshots=1, feature.compare=1, feature.canvasSimplify=1

test.describe('Compare', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      try { localStorage.setItem('feature.sseStreaming', '1') } catch {}
      try { localStorage.setItem('feature.snapshots', '1') } catch {}
      try { localStorage.setItem('feature.compare', '1') } catch {}
      try { localStorage.setItem('feature.canvasSimplify', '1') } catch {}
      ;(window as any).__E2E = 1
    })
    await gotoSandbox(page)
  })

  test('A vs B shows deterministic diff and SR announcement', async ({ page }) => {
    // Create snapshot A (simplify OFF by default)
    await page.getByTestId('snapshot-btn').click()

    // Toggle simplify to change edges (hide <0.2)
    await page.getByTestId('simplify-toggle').check()

    // Create snapshot B
    await page.getByTestId('snapshot-btn').click()

    // Select A and B by option values (ids). Options: [0]=placeholder, [1]=latest (B), [2]=older (A)
    const selA = page.getByTestId('compare-select-a')
    const selB = page.getByTestId('compare-select-b')
    // Ensure enough options
    await expect(selA.locator('option')).toHaveCount(3)
    const valB = await selA.locator('option').nth(1).getAttribute('value')
    const valA = await selA.locator('option').nth(2).getAttribute('value')
    await selA.selectOption(valA!)
    await selB.selectOption(valB!)

    // Expect diff list has removed e2 and e4 (hidden by simplify); ordering by id
    const diff = page.getByTestId('compare-diff-list')
    await expect(diff).toBeVisible()
    await expect(diff).toContainText('↓ e2')
    await expect(diff).toContainText('↓ e4')

    // SR announcement present (scoped to the comparison live region)
    const compareSR = page.locator('[role="status"]').filter({ hasText: /Comparison updated:/i })
    await expect(compareSR).toHaveCount(1)
  })
})

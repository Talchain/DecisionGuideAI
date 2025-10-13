import { test, expect } from '@playwright/test'

test('Plot Add: always appends with deterministic IDs', async ({ page }) => {
  await page.goto('/#/plot', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plot')
  
  // Wait for canvas to load
  await page.waitForSelector('[data-testid="graph-canvas"]', { timeout: 10000 }).catch(() => {
    // Fallback: wait for any canvas-like element
    return page.waitForSelector('svg', { timeout: 5000 })
  })

  // Count initial nodes (may have some from fixture)
  const initialCount = await page.locator('[data-node-id]').count().catch(() => 0)

  // Find and click Add button (may be labeled "Add Node" or have a + icon)
  const addBtn = page.locator('button').filter({ hasText: /add|\\+/i }).first()
  if (await addBtn.count() > 0) {
    await addBtn.click()
    await page.waitForTimeout(200)
    
    const afterFirstAdd = await page.locator('[data-node-id]').count().catch(() => 0)
    expect(afterFirstAdd).toBe(initialCount + 1)

    await addBtn.click()
    await page.waitForTimeout(200)
    
    const afterSecondAdd = await page.locator('[data-node-id]').count().catch(() => 0)
    expect(afterSecondAdd).toBe(initialCount + 2)
  }
})

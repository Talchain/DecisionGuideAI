import { test, expect } from '@playwright/test'

/**
 * Canvas boot stability test
 * Verifies that /#/canvas loads without infinite render loops or React errors
 * Does NOT overlap with route test - focuses on boot sequence and stability
 */
test('canvas boots without infinite render loop', async ({ page }) => {
  const errors: string[] = []
  
  // Capture console errors
  page.on('console', m => {
    if (m.type() === 'error') {
      errors.push(m.text())
    }
  })
  
  // Navigate to canvas route
  await page.goto('/#/canvas')
  
  // Wait for canvas to render
  await page.waitForSelector('[data-testid="react-flow-graph"]', { timeout: 10000 })
  
  // Verify boot sequence completed
  const logs = await page.evaluate(() => 
    (window as any).__SAFE_DEBUG__?.logs?.map((r: any) => r?.m) || []
  )
  expect(logs).toContain('boot:mounted-callback-called')
  
  // Verify no fatal errors captured
  const fatal = await page.evaluate(() => (window as any).__SAFE_DEBUG__?.fatal)
  expect(fatal).toBeUndefined()
  
  // Filter out known acceptable console messages
  const cleanErrors = (arr: string[]) => 
    arr.filter(e => 
      !/DevTools/i.test(e) && 
      !/CORS/i.test(e) && 
      !/plot-lite-service/i.test(e) &&
      !/Failed to load resource/i.test(e)  // Generic network errors
    )
  
  // Expect no real errors at this point
  expect(cleanErrors(errors)).toHaveLength(0)
  
  // Interact with canvas to trigger potential loops
  await page.click('[data-testid="react-flow-graph"]')
  await page.waitForTimeout(500)
  
  // Still no errors after interaction
  expect(cleanErrors(errors)).toHaveLength(0)
})

test('canvas selection updates do not cause render storms', async ({ page }) => {
  const errors: string[] = []
  
  page.on('console', m => {
    if (m.type() === 'error') {
      errors.push(m.text())
    }
  })
  
  await page.goto('/#/canvas')
  await page.waitForSelector('[data-testid="react-flow-graph"]', { timeout: 10000 })
  
  // Click canvas multiple times rapidly
  const canvas = page.locator('[data-testid="react-flow-graph"]')
  for (let i = 0; i < 5; i++) {
    await canvas.click()
    await page.waitForTimeout(100)
  }
  
  // Check for render storm warnings (dev only, but test documents expected behavior)
  const hasRenderStorm = errors.some(e => /RENDER STORM/i.test(e))
  expect(hasRenderStorm).toBe(false)
  
  // Filter and verify no real errors
  const cleanErrors = errors.filter(e => 
    !/DevTools/i.test(e) && 
    !/CORS/i.test(e) && 
    !/plot-lite-service/i.test(e) &&
    !/Failed to load resource/i.test(e)
  )
  expect(cleanErrors).toHaveLength(0)
})

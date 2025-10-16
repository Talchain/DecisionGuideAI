import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test('Tidy Layout creates single undo frame', async ({ page }) => {
  const errors = setupConsoleErrorTracking(page)
  await openCanvas(page)
  
  // Add 3 nodes
  for (let i = 0; i < 3; i++) {
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(100)
  }
  
  // Get initial positions
  const initialPositions = await page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-testid="rf-node"]')
    return Array.from(nodes).map(n => {
      const rect = n.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    })
  })
  
  // Apply layout
  await page.locator('button:has-text("�� Layout")').click()
  await page.locator('button:has-text("Apply Layout")').click()
  await page.waitForTimeout(2000)
  
  // Positions should change
  const afterLayout = await page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-testid="rf-node"]')
    return Array.from(nodes).map(n => {
      const rect = n.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    })
  })
  
  // At least one position should differ
  const changed = initialPositions.some((pos, i) => 
    Math.abs(pos.x - afterLayout[i].x) > 5 || Math.abs(pos.y - afterLayout[i].y) > 5
  )
  expect(changed).toBe(true)
  
  // Single undo should revert all changes
  await page.keyboard.press('Meta+Z')
  await page.waitForTimeout(500)
  
  const afterUndo = await page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-testid="rf-node"]')
    return Array.from(nodes).map(n => {
      const rect = n.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    })
  })
  
  // Should be back to initial positions (within tolerance)
  initialPositions.forEach((pos, i) => {
    expect(Math.abs(pos.x - afterUndo[i].x)).toBeLessThan(10)
    expect(Math.abs(pos.y - afterUndo[i].y)).toBeLessThan(10)
  })
  
  expectNoConsoleErrors(errors)
})

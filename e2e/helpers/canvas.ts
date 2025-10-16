import { Page, expect } from '@playwright/test'

/**
 * Navigate to canvas route and wait for it to be ready
 */
export async function openCanvas(page: Page): Promise<void> {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="build-badge"]')).toBeVisible()
}

/**
 * Get badge text for verification
 */
export async function getBadgeText(page: Page): Promise<string> {
  const badge = page.locator('[data-testid="build-badge"]')
  return (await badge.textContent()) || ''
}

/**
 * React Flow root accessor
 */
export function rf(page: Page) {
  return page.locator('[data-testid="rf-root"]')
}

/**
 * Get React Flow node by index or ID
 */
export function getNode(page: Page, idOrIndex: string | number) {
  if (typeof idOrIndex === 'number') {
    return page.locator('[data-testid="rf-node"]').nth(idOrIndex)
  }
  return page.locator(`[data-id="${idOrIndex}"]`)
}

/**
 * Monitor console for errors during test execution
 * Call at start of test, then await expectNoConsoleErrors() at end
 */
export function setupConsoleErrorTracking(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', err => {
    errors.push(String(err))
  })
  return errors
}

/**
 * Assert no console errors occurred
 */
export function expectNoConsoleErrors(errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(`Console errors detected:\n${errors.join('\n')}`)
  }
}

/**
 * Wait for debounced autosave to complete
 * NOTE: This is the ONLY approved use of waitForTimeout in E2E tests
 * Rationale: Autosave debounces for 2000ms, no other reliable signal available
 */
export async function waitForDebouncedAutosave(page: Page): Promise<void> {
  // Wait for 2.5s to ensure 2s debounce completes
  await page.waitForTimeout(2500)
}

/**
 * Get current node count
 */
export async function getNodeCount(page: Page): Promise<number> {
  return await page.locator('[data-testid="rf-node"]').count()
}

/**
 * Get current edge count
 */
export async function getEdgeCount(page: Page): Promise<number> {
  return await page.locator('.react-flow__edge').count()
}

/**
 * Click toolbar button by text
 */
export async function clickToolbarButton(page: Page, text: string): Promise<void> {
  await page.locator(`button:has-text("${text}")`).click()
}

/**
 * Open context menu at position
 */
export async function openContextMenu(page: Page, x: number, y: number): Promise<void> {
  await page.locator('.react-flow').click({ button: 'right', position: { x, y } })
  await expect(page.locator('div[role="menu"]')).toBeVisible()
}

/**
 * Get platform-specific modifier key
 */
export function getModKey(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control'
}

/**
 * Press keyboard shortcut with platform detection
 */
export async function pressShortcut(page: Page, key: string): Promise<void> {
  const mod = getModKey()
  await page.keyboard.press(`${mod}+${key}`)
}

/**
 * Load fixture graph into canvas
 */
export async function loadFixture(page: Page, fixtureName: string): Promise<void> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', `${fixtureName}.json`)
  const fixtureData = await fs.readFile(fixturePath, 'utf-8')
  
  await page.evaluate((json) => {
    // @ts-ignore - accessing store in test
    window.useCanvasStore.getState().importCanvas(json)
  }, fixtureData)
  
  // Wait for React Flow to render
  await page.waitForTimeout(500)
}

/**
 * Export current canvas state
 */
export async function exportCanvas(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // @ts-ignore - accessing store in test
    return window.useCanvasStore.getState().exportCanvas()
  })
}

/**
 * Get undo/redo button state
 */
export async function canUndo(page: Page): Promise<boolean> {
  const undoBtn = page.locator('button[aria-label*="Undo"]')
  return !(await undoBtn.isDisabled())
}

export async function canRedo(page: Page): Promise<boolean> {
  const redoBtn = page.locator('button[aria-label*="Redo"]')
  return !(await redoBtn.isDisabled())
}

/**
 * E2E Tests for Canvas Results Panel
 * Tests Run → Results opens, streaming, completion, and error states
 */

import { test, expect } from '@playwright/test'

test.describe('Canvas Results Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/canvas')

    // Wait for canvas to load
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('should open Results panel on Run (Cmd/Ctrl+Enter)', async ({ page }) => {
    // Trigger Run with keyboard shortcut
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

    // Results panel should open
    await expect(page.locator('[role="complementary"][aria-label="Analysis Results"]')).toBeVisible({ timeout: 5000 })

    // Should show heading
    await expect(page.locator('text=Results')).toBeVisible()
  })

  test('should show streaming progress', async ({ page }) => {
    // Trigger Run
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

    // Wait for Results panel
    await expect(page.locator('[role="complementary"][aria-label="Analysis Results"]')).toBeVisible()

    // Should show progress states (Preparing/Connecting/Streaming)
    const statusPill = page.locator('text=/Preparing|Connecting|Streaming|Complete/i')
    await expect(statusPill).toBeVisible({ timeout: 5000 })
  })

  test('should display report on completion', async ({ page }) => {
    // Trigger Run
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

    // Wait for completion (mock adapter should complete quickly)
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Should show likely value (mock adapter returns 150)
    await expect(page.locator('text=150')).toBeVisible()
  })

  test('should close Results panel on Esc', async ({ page }) => {
    // Open Results
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible()

    // Press Esc
    await page.keyboard.press('Escape')

    // Panel should close
    await expect(page.locator('[aria-label="Analysis Results"]')).not.toBeVisible()
  })

  test('should reset state with Run Again button', async ({ page }) => {
    // Run first analysis
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Click Run Again
    const runAgainButton = page.locator('button', { hasText: 'Run Again' })
    await runAgainButton.click()

    // Should return to idle state
    await expect(page.locator('text=Idle')).toBeVisible()
  })
})

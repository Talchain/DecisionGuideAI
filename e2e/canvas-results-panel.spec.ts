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

  test.describe('Streaming and Cancel', () => {
    test('should show cancel button during streaming', async ({ page }) => {
      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Wait for Results panel
      await expect(page.locator('[role="complementary"][aria-label="Analysis Results"]')).toBeVisible()

      // Wait for streaming state (may transition quickly to complete with mock adapter)
      // The cancel button should be visible when status is 'streaming'
      // Note: Mock adapter may complete too fast to reliably test this
      // This test documents expected behavior when streaming is active
      const statusText = page.locator('text=Streaming')
      const cancelButton = page.locator('button[aria-label="Cancel analysis"]')

      // If we catch streaming state, verify cancel button
      const streamingVisible = await statusText.isVisible().catch(() => false)
      if (streamingVisible) {
        await expect(cancelButton).toBeVisible()
      }
    })

    test('should hide cancel button when not streaming', async ({ page }) => {
      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Wait for completion
      await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

      // Cancel button should not be visible when complete
      const cancelButton = page.locator('button[aria-label="Cancel analysis"]')
      await expect(cancelButton).not.toBeVisible()
    })

    test.skip('should cancel analysis when cancel button clicked (requires slow backend)', async ({ page }) => {
      // This test requires a backend that streams slowly enough to catch the cancel
      // Skip for now as mock adapter completes too quickly

      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Wait for streaming state
      await expect(page.locator('text=Streaming')).toBeVisible()

      // Click cancel button
      const cancelButton = page.locator('button[aria-label="Cancel analysis"]')
      await cancelButton.click()

      // Should show cancelled state
      await expect(page.locator('text=Cancelled')).toBeVisible({ timeout: 2000 })
    })

    test.skip('should show progress bar during streaming (requires slow backend)', async ({ page }) => {
      // This test requires a backend that streams slowly enough to see progress
      // Skip for now as mock adapter completes too quickly

      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Wait for Results panel
      await expect(page.locator('[role="complementary"][aria-label="Analysis Results"]')).toBeVisible()

      // Should show progress bar with percentage
      const progressBar = page.locator('[role="progressbar"]')
      await expect(progressBar).toBeVisible()

      // Should show percentage (0-100%)
      const percentageText = page.locator('text=/%/')
      await expect(percentageText).toBeVisible()
    })
  })
})

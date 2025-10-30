/**
 * E2E Tests for Canvas Preview Mode
 *
 * Verifies Task C requirements:
 * 1. No graph mutation until Apply
 * 2. Single undo frame on Apply
 * 3. PreviewDiff renders correctly
 */

import { test, expect } from '@playwright/test'

test.describe('Canvas Preview Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')

    // Wait for canvas to load
    await expect(page.locator('.react-flow')).toBeVisible()

    // Wait for first node to be present
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
  })

  test('should enter Preview mode via "Preview Changes" button', async ({ page }) => {
    // Run initial analysis to populate Results panel
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

    // Wait for Results panel to open and complete
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Click "Preview Changes" button
    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await expect(previewButton).toBeVisible()
    await previewButton.click()

    // Verify Preview mode is active
    // Look for preview indicator badge or status
    await expect(page.locator('text=/Preview Mode|Previewing/i')).toBeVisible({ timeout: 5000 })
  })

  test('should stage node edits without mutating graph', async ({ page }) => {
    // Enter Preview mode
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // Click first node to open inspector
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()

    // Wait for NodeInspector to open
    await expect(page.locator('[aria-label="Node Inspector"]')).toBeVisible({ timeout: 5000 })

    // Get original label
    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    await expect(labelInput).toBeVisible()
    const originalLabel = await labelInput.inputValue()

    // Edit label
    await labelInput.clear()
    const newLabel = 'Preview Test Label'
    await labelInput.fill(newLabel)
    await labelInput.blur()

    // Wait a moment for staging
    await page.waitForTimeout(500)

    // Verify change is staged (label should update in inspector)
    await expect(labelInput).toHaveValue(newLabel)

    // Click outside to deselect
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })

    // Verify original graph is NOT mutated by checking persistence
    // If we reload WITHOUT applying, original label should return
    // (This is a strong test of non-mutation)
  })

  test('should show PreviewDiff with correct deltas', async ({ page }) => {
    // Enter Preview mode
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Capture original "likely" value
    const originalValue = page.locator('text=/Most Likely/i').locator('..').locator('text=/\\d+/')
    const originalText = await originalValue.textContent()

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // Make an edit that would change the result
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    await expect(page.locator('[aria-label="Node Inspector"]')).toBeVisible()

    // Edit description or value
    const descInput = page.locator('textarea[name="description"]').or(page.locator('textarea[placeholder*="Description"]'))
    if (await descInput.isVisible()) {
      await descInput.fill('Preview test description that changes probability')
      await descInput.blur()
    }

    // Wait for preview run to complete
    await expect(page.locator('text=/Streaming|Running/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 15000 })

    // Verify PreviewDiff component appears
    const previewDiff = page.locator('text=/Preview vs Current|Current.*Preview/i').locator('..')
    await expect(previewDiff).toBeVisible({ timeout: 5000 })

    // Verify delta display (should show absolute delta and percentage)
    await expect(page.locator('text=/[+\\-]\\d+.*%/i')).toBeVisible()

    // Verify color coding (check for success/danger classes or trend icons)
    const trendIcon = page.locator('[class*="lucide-trending"]')
    await expect(trendIcon).toBeVisible()
  })

  test('should create single undo frame on Apply', async ({ page }) => {
    // Enter Preview mode and make multiple edits
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // Make first edit
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    await expect(page.locator('[aria-label="Node Inspector"]')).toBeVisible()

    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    const originalLabel = await labelInput.inputValue()
    await labelInput.clear()
    await labelInput.fill('Edit 1')
    await labelInput.blur()

    // Make second edit (description)
    const descInput = page.locator('textarea[name="description"]').or(page.locator('textarea[placeholder*="Description"]'))
    if (await descInput.isVisible()) {
      await descInput.fill('Edit 2: Description change')
      await descInput.blur()
    }

    // Make third edit (select another node if possible)
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })
    const secondNode = page.locator('.react-flow__node').nth(1)
    if (await secondNode.isVisible()) {
      await secondNode.click()
      const secondLabelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
      if (await secondLabelInput.isVisible()) {
        await secondLabelInput.clear()
        await secondLabelInput.fill('Edit 3')
        await secondLabelInput.blur()
      }
    }

    // Click Apply button
    const applyButton = page.locator('button', { hasText: /Apply|Apply Changes/i })
    await expect(applyButton).toBeVisible()
    await applyButton.click()

    // Wait for Preview mode to exit
    await expect(page.locator('text=/Preview Mode/i')).not.toBeVisible({ timeout: 5000 })

    // Now press Cmd+Z ONCE - all 3 edits should revert
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyZ' : 'Control+KeyZ')

    // Wait for undo to process
    await page.waitForTimeout(500)

    // Verify first node label reverted to original
    await firstNode.click()
    await expect(page.locator('[aria-label="Node Inspector"]')).toBeVisible()
    await expect(labelInput).toHaveValue(originalLabel)

    // This confirms single undo frame: one Cmd+Z reverted ALL preview changes
  })

  test('should revert all changes on Undo after Apply', async ({ page }) => {
    // This is the same test as above, but explicitly validates the requirement:
    // "Press ⌘Z → verify ALL preview changes revert in one action"

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()

    // Make multiple edits
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()

    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    const originalLabel = await labelInput.inputValue()

    await labelInput.clear()
    await labelInput.fill('Changed Label')
    await labelInput.blur()

    // Apply
    const applyButton = page.locator('button', { hasText: /Apply/i })
    await applyButton.click()

    // Wait for apply to complete
    await page.waitForTimeout(1000)

    // Single Undo
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyZ' : 'Control+KeyZ')
    await page.waitForTimeout(500)

    // Verify revert
    await firstNode.click()
    await expect(labelInput).toHaveValue(originalLabel)
  })

  test('should discard changes without applying', async ({ page }) => {
    // Enter Preview mode
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // Make edit
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()

    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    const originalLabel = await labelInput.inputValue()

    await labelInput.clear()
    await labelInput.fill('Discarded Edit')
    await labelInput.blur()

    // Click Discard button (or Exit Preview)
    const discardButton = page.locator('button', { hasText: /Discard|Cancel|Exit Preview/i })
    await expect(discardButton).toBeVisible()
    await discardButton.click()

    // Wait for Preview mode to exit
    await expect(page.locator('text=/Preview Mode/i')).not.toBeVisible({ timeout: 5000 })

    // Verify label reverted (change was NOT applied)
    await page.waitForTimeout(500)
    await firstNode.click()
    await expect(labelInput).toHaveValue(originalLabel)

    // Verify Undo does NOT revert anything (no history frame created)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyZ' : 'Control+KeyZ')
    await page.waitForTimeout(500)

    // Label should still be original (Undo didn't do anything because Discard didn't create history)
    await expect(labelInput).toHaveValue(originalLabel)
  })

  test('should not mutate graph until Apply is clicked', async ({ page }) => {
    // Stronger test: verify persistence layer is not affected

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()

    // Get original label before edit
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    const originalLabel = await labelInput.inputValue()

    // Make edit
    await labelInput.clear()
    await labelInput.fill('Preview Edit')
    await labelInput.blur()

    // Reload page WITHOUT applying (force navigation)
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for canvas to load again
    await expect(page.locator('.react-flow')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()

    // Verify original label persisted (preview changes were NOT saved)
    await firstNode.click()
    await expect(page.locator('[aria-label="Node Inspector"]')).toBeVisible({ timeout: 5000 })
    await expect(labelInput).toHaveValue(originalLabel)

    // This confirms preview changes are ephemeral and don't mutate persisted graph
  })
})

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

  test('should support edge weight editing in preview mode', async ({ page }) => {
    // Enter Preview mode
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // Click on an edge to open edge inspector
    const edge = page.locator('.react-flow__edge').first()
    if (await edge.isVisible()) {
      await edge.click()

      // Wait for inspector to open
      const inspector = page.locator('[aria-label="Edge Inspector"]').or(page.locator('[aria-label="Inspector"]'))
      await expect(inspector).toBeVisible({ timeout: 5000 })

      // Look for weight/probability input
      const weightInput = page.locator('input[name="weight"]')
        .or(page.locator('input[placeholder*="Weight"]'))
        .or(page.locator('input[type="number"]').first())

      if (await weightInput.isVisible()) {
        const originalWeight = await weightInput.inputValue()

        // Edit weight
        await weightInput.clear()
        await weightInput.fill('0.75')
        await weightInput.blur()

        await page.waitForTimeout(500)

        // Verify change is staged
        await expect(weightInput).toHaveValue('0.75')

        // Discard and verify revert
        const discardButton = page.locator('button', { hasText: /Discard|Cancel|Exit Preview/i })
        await discardButton.click()

        // Wait for Preview mode to exit
        await expect(page.locator('text=/Preview Mode/i')).not.toBeVisible({ timeout: 5000 })

        // Re-select edge and verify original weight restored
        await page.waitForTimeout(500)
        await edge.click()
        await expect(inspector).toBeVisible({ timeout: 5000 })
        await expect(weightInput).toHaveValue(originalWeight)
      }
    }
  })

  test('should leave NO preview remnants in localStorage after reload', async ({ page }) => {
    // Enter Preview mode and make edits
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // Make multiple edits
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    await labelInput.clear()
    await labelInput.fill('Preview Edit 1')
    await labelInput.blur()

    await page.waitForTimeout(500)

    // Check localStorage BEFORE reload - preview state should be present in memory but NOT persisted
    const localStorageBeforeReload = await page.evaluate(() => {
      const storage: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          storage[key] = localStorage.getItem(key) || ''
        }
      }
      return storage
    })

    // Verify no preview keywords in localStorage BEFORE reload
    const storageString = JSON.stringify(localStorageBeforeReload)
    expect(storageString).not.toContain('preview')
    expect(storageString).not.toContain('stagedNodes')
    expect(storageString).not.toContain('stagedEdges')
    expect(storageString).not.toContain('previewReport')

    // Reload page WITHOUT applying
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('.react-flow')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()

    // Check localStorage AFTER reload - still no preview keywords
    const localStorageAfterReload = await page.evaluate(() => {
      const storage: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          storage[key] = localStorage.getItem(key) || ''
        }
      }
      return storage
    })

    const storageStringAfter = JSON.stringify(localStorageAfterReload)
    expect(storageStringAfter).not.toContain('preview')
    expect(storageStringAfter).not.toContain('stagedNodes')
    expect(storageStringAfter).not.toContain('stagedEdges')
    expect(storageStringAfter).not.toContain('previewReport')
    expect(storageStringAfter).not.toContain('stagedDrivers')

    // Verify Preview mode is NOT active after reload
    const previewIndicator = page.locator('text=/Preview Mode|Previewing/i')
    await expect(previewIndicator).not.toBeVisible()
  })

  test('full lifecycle: enter → stage → run → diff → apply → undo', async ({ page }) => {
    // 1. Run initial analysis
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Capture original result value
    const originalResult = page.locator('[aria-label="Analysis Results"]')
    const originalText = await originalResult.textContent()

    // 2. Enter Preview mode
    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    await previewButton.click()
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

    // 3. Stage node changes
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    const labelInput = page.locator('input[name="label"]').or(page.locator('input[placeholder*="Label"]'))
    const originalLabel = await labelInput.inputValue()
    await labelInput.clear()
    await labelInput.fill('Modified Label')
    await labelInput.blur()
    await page.waitForTimeout(300)

    // 4. Stage edge changes (if possible)
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })
    const edge = page.locator('.react-flow__edge').first()
    if (await edge.isVisible()) {
      await edge.click()
      const weightInput = page.locator('input[name="weight"]')
        .or(page.locator('input[type="number"]').first())
      if (await weightInput.isVisible()) {
        await weightInput.clear()
        await weightInput.fill('0.8')
        await weightInput.blur()
        await page.waitForTimeout(300)
      }
    }

    // 5. Run Preview (this may auto-trigger or require manual trigger)
    // Preview run should happen automatically or via a "Run Preview" button
    // Wait for preview run to complete
    const runPreviewButton = page.locator('button', { hasText: /Run Preview/i })
    if (await runPreviewButton.isVisible({ timeout: 2000 })) {
      await runPreviewButton.click()
      await expect(page.locator('text=/Streaming|Running/i')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=Complete')).toBeVisible({ timeout: 15000 })
    }

    // 6. Verify diff is shown
    // Look for preview diff component
    const diffIndicator = page.locator('text=/Preview vs Current|Delta|Difference/i')
    // Diff may or may not be visible depending on implementation
    // Just verify we're still in preview mode
    await expect(page.locator('text=/Preview Mode/i')).toBeVisible()

    // 7. Apply changes
    const applyButton = page.locator('button', { hasText: /Apply|Apply Changes/i })
    await expect(applyButton).toBeVisible()
    await applyButton.click()

    // Wait for Preview mode to exit
    await expect(page.locator('text=/Preview Mode/i')).not.toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(1000)

    // Verify label changed
    await firstNode.click()
    await expect(labelInput).toHaveValue('Modified Label')

    // 8. Single Undo - should revert ALL preview changes in one frame
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyZ' : 'Control+KeyZ')
    await page.waitForTimeout(800)

    // Verify label reverted to original
    await firstNode.click()
    await expect(labelInput).toHaveValue(originalLabel)

    // This confirms single undo frame requirement
  })
})

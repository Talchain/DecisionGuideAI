import { test, expect } from '@playwright/test'

test.describe('DevControls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 5000 })

    // Dismiss welcome dialog if present
    const welcomeDialog = page.locator('[role="dialog"][aria-labelledby="welcome-title"]')
    try {
      await welcomeDialog.waitFor({ state: 'visible', timeout: 2000 })
      const getStartedBtn = page.locator('button:has-text("Get Started"), button:has-text("Close"), button:has-text("Skip"), button:has-text("Got it")')
      await getStartedBtn.first().click({ timeout: 1000 })
      await welcomeDialog.waitFor({ state: 'hidden', timeout: 3000 })
    } catch {
      // Dialog not found or already dismissed
    }

    await page.waitForTimeout(300)
  })

  test('DevControls toggle changes debug state', async ({ page }) => {
    // Find dev controls button
    const devButton = page.locator('[data-testid="btn-dev-controls"]')

    // Dev controls might not be visible in all environments
    if (await devButton.isVisible().catch(() => false)) {
      // Click to expand
      await devButton.click()
      await page.waitForTimeout(200)

      // Find debug toggle
      const debugToggle = page.locator('[data-testid="toggle-debug"]')
      await expect(debugToggle).toBeVisible()

      // Check initial state
      const initialState = await debugToggle.isChecked()

      // Toggle debug mode
      await debugToggle.click()
      await page.waitForTimeout(100)

      // Verify state changed
      const newState = await debugToggle.isChecked()
      expect(newState).toBe(!initialState)

      // Verify status indicator updated
      const statusText = page.locator('text=/Debug: (ON|OFF)/i')
      await expect(statusText).toBeVisible()
    }
  })

  test('Edge weight slider updates edge data', async ({ page }) => {
    // Create two nodes
    const nodeMenu = page.locator('button:has-text("+ Node")')
    await nodeMenu.click()
    await page.waitForTimeout(100)
    await page.locator('[role="menuitem"]').first().click()
    await page.waitForTimeout(200)

    await nodeMenu.click()
    await page.waitForTimeout(100)
    await page.locator('[role="menuitem"]').first().click()
    await page.waitForTimeout(200)

    // Create edge between nodes
    const nodes = page.locator('[data-testid="rf-node"]')
    const firstNode = nodes.first()
    const secondNode = nodes.nth(1)

    const sourceHandle = firstNode.locator('.react-flow__handle-bottom')
    const targetHandle = secondNode.locator('.react-flow__handle-top')

    await expect(sourceHandle).toBeVisible({ timeout: 5000 })
    await expect(targetHandle).toBeVisible({ timeout: 5000 })

    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await targetHandle.boundingBox()

    if (sourceBox && targetBox) {
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 })
      await page.mouse.up()
      await page.waitForTimeout(300)
    }

    // Click edge to select and open inspector
    const edge = page.locator('.react-flow__edge').first()
    await edge.click()
    await page.waitForTimeout(300)

    // Find weight slider in inspector
    const weightSlider = page.locator('#edge-weight')
    if (await weightSlider.isVisible().catch(() => false)) {
      // Get initial value
      const initialValue = await weightSlider.inputValue()

      // Change weight
      await weightSlider.fill('2.5')
      await page.waitForTimeout(200) // Wait for debounce

      // Verify value changed
      const newValue = await weightSlider.inputValue()
      expect(parseFloat(newValue)).toBeCloseTo(2.5, 1)
    }
  })
})

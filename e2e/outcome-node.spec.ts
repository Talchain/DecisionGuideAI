import { test, expect } from '@playwright/test'

test.describe('Outcome Node', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage to mark welcome dialog as dismissed before loading page
    await page.goto('/#/canvas')
    await page.evaluate(() => {
      localStorage.setItem('canvas.welcome.dismissed', 'true')
    })
    await page.reload()
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 5000 })
    await page.waitForTimeout(500)
  })

  test('can mark node as outcome and run analysis', async ({ page }) => {
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

    // Wait for nodes to be present and visible
    const nodes = page.locator('[data-testid="rf-node"]')
    await expect(nodes).toHaveCount(2, { timeout: 5000 })

    // Select first node
    const firstNode = nodes.first()
    await expect(firstNode).toBeVisible({ timeout: 3000 })
    await firstNode.click()
    await page.waitForTimeout(300)

    // Mark as outcome node in inspector
    const outcomeToggle = page.locator('#outcome-toggle')
    await expect(outcomeToggle).toBeVisible()

    // Check it's not checked initially
    await expect(outcomeToggle).not.toBeChecked()

    // Check the outcome toggle
    await outcomeToggle.click()
    await page.waitForTimeout(200)

    // Verify it's now checked
    await expect(outcomeToggle).toBeChecked()

    // Verify "Target" badge appears
    const targetBadge = page.locator('text="Target"')
    await expect(targetBadge).toBeVisible()

    // Get the node label for verification
    const nodeLabel = await page.locator('#node-title').inputValue()

    // Close inspector
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Open Results panel to trigger run
    const resultsButton = page.locator('button[data-testid="btn-run-analysis"]').first()
    if (await resultsButton.isVisible()) {
      await resultsButton.click()
      await page.waitForTimeout(500)
    }

    // Verify Results panel shows outcome in empty state
    const emptyStateText = page.locator('text=/with outcome:/i')
    await expect(emptyStateText).toBeVisible({ timeout: 5000 })
    await expect(emptyStateText).toContainText(nodeLabel)

    // Note: We can't easily verify the actual API payload without mocking,
    // but the UI behavior confirms outcome_node is wired correctly
  })

  test('outcome toggle is exclusive - only one node at a time', async ({ page }) => {
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

    const nodes = page.locator('[data-testid="rf-node"]')
    await expect(nodes).toHaveCount(2, { timeout: 5000 })

    // Mark first node as outcome
    await expect(nodes.first()).toBeVisible({ timeout: 3000 })
    await nodes.first().click()
    await page.waitForTimeout(300)
    await page.locator('#outcome-toggle').click()
    await page.waitForTimeout(200)
    await expect(page.locator('#outcome-toggle')).toBeChecked()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Mark second node as outcome
    await nodes.nth(1).click()
    await page.waitForTimeout(300)
    const secondToggle = page.locator('#outcome-toggle')
    await expect(secondToggle).not.toBeChecked()
    await secondToggle.click()
    await page.waitForTimeout(200)
    await expect(secondToggle).toBeChecked()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Verify first node is no longer outcome
    await nodes.first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('#outcome-toggle')).not.toBeChecked()
  })

  test('can uncheck outcome node to clear selection', async ({ page }) => {
    // Create a node
    const nodeMenu = page.locator('button:has-text("+ Node")')
    await nodeMenu.click()
    await page.waitForTimeout(100)
    await page.locator('[role="menuitem"]').first().click()
    await page.waitForTimeout(200)

    // Wait for node to be visible
    const node = page.locator('[data-testid="rf-node"]').first()
    await expect(node).toBeVisible({ timeout: 3000 })

    // Select and mark as outcome
    await node.click()
    await page.waitForTimeout(300)

    const outcomeToggle = page.locator('#outcome-toggle')
    await outcomeToggle.click()
    await page.waitForTimeout(200)
    await expect(outcomeToggle).toBeChecked()

    // Uncheck to clear
    await outcomeToggle.click()
    await page.waitForTimeout(200)
    await expect(outcomeToggle).not.toBeChecked()

    // Verify "Target" badge is gone
    const targetBadge = page.locator('text="Target"')
    await expect(targetBadge).not.toBeVisible()
  })
})

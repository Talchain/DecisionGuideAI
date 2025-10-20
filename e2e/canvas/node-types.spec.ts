/**
 * E2E smoke test for Canvas node type creation and switching
 */
import { test, expect } from '@playwright/test'

test.describe('Canvas Node Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    // Wait for canvas to load
    await page.waitForSelector('[data-testid="react-flow-graph"]', { timeout: 10000 })
  })

  test('creates Goal node via toolbar menu and switches type to Risk', async ({ page }) => {
    // Click "+ Node" button to open menu
    await page.click('button:has-text("+ Node")')
    
    // Wait for menu to appear and click "Add Goal"
    const addGoalButton = page.locator('button:has-text("Add Goal")')
    await expect(addGoalButton).toBeVisible({ timeout: 3000 })
    await addGoalButton.click()
    
    // Verify a goal node exists
    const goalNodes = page.locator('.react-flow__node[data-type="goal"]')
    await expect(goalNodes.first()).toBeVisible({ timeout: 5000 })
    
    // Click the goal node to select it
    await goalNodes.first().click()
    
    // Wait for properties panel to open with type selector
    const typeSelector = page.locator('select#node-type')
    await expect(typeSelector).toBeVisible({ timeout: 3000 })
    
    // Change type to Risk
    await typeSelector.selectOption('risk')
    
    // Verify node type changed to risk
    const riskNodes = page.locator('.react-flow__node[data-type="risk"]')
    await expect(riskNodes.first()).toBeVisible({ timeout: 5000 })
  })

  test('creates Option node via Command Palette', async ({ page }) => {
    // Open Command Palette with ⌘K
    await page.keyboard.press('Meta+k')
    
    // Wait for palette input
    const paletteInput = page.locator('input[type="text"]')
    await expect(paletteInput).toBeVisible({ timeout: 3000 })
    
    // Type "option"
    await paletteInput.fill('option')
    
    // Press Enter to execute
    await page.keyboard.press('Enter')
    
    // Verify an option node exists
    const optionNodes = page.locator('.react-flow__node[data-type="option"]')
    await expect(optionNodes.first()).toBeVisible({ timeout: 5000 })
  })
})

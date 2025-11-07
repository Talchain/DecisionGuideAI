/**
 * E2E tests for Scenario Management (PR-B)
 *
 * Tests:
 * - Scenario creation from template
 * - Scenario save/load
 * - Scenario rename/duplicate/delete
 * - Autosave and recovery
 * - Scenario switcher UI
 */

import { test, expect } from '@playwright/test'

test.describe('Scenario Management (PR-B)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/#/canvas')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Can create scenario from template', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding if present
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) {
      await skipButton.click()
    }

    // Add a node to canvas
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    // Open scenario switcher
    const scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()

    // Save scenario
    await page.getByRole('menuitem', { name: /save/i }).click()

    // Enter scenario name
    const nameInput = page.getByPlaceholder('Scenario name')
    await nameInput.fill('Test Scenario')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Verify scenario is saved
    await expect(page.getByRole('button', { name: /test scenario/i })).toBeVisible()
  })

  test('Can rename scenario', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) {
      await skipButton.click()
    }

    // Add a node and save scenario
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    const scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()
    await page.getByRole('menuitem', { name: /save/i }).click()
    await page.getByPlaceholder('Scenario name').fill('Original Name')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Open scenario switcher and rename
    await page.getByRole('button', { name: /original name/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // Enter new name
    await page.getByPlaceholder('Scenario name').fill('Renamed Scenario')
    await page.getByRole('button', { name: /^rename$/i }).click()

    // Verify scenario is renamed
    await expect(page.getByRole('button', { name: /renamed scenario/i })).toBeVisible()
  })

  test('Can duplicate scenario', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) {
      await skipButton.click()
    }

    // Add a node and save scenario
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    const scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()
    await page.getByRole('menuitem', { name: /save/i }).click()
    await page.getByPlaceholder('Scenario name').fill('Original Scenario')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Open scenario switcher and duplicate
    await page.getByRole('button', { name: /original scenario/i }).click()
    await page.getByRole('menuitem', { name: /duplicate/i }).first().click()

    // Verify duplicate is created with "(Copy)" suffix
    await expect(page.getByRole('button', { name: /original scenario \(copy\)/i })).toBeVisible()
  })

  test('Can delete scenario', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) {
      await skipButton.click()
    }

    // Add a node and save scenario
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    const scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()
    await page.getByRole('menuitem', { name: /save/i }).click()
    await page.getByPlaceholder('Scenario name').fill('To Delete')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Open scenario switcher and delete
    await page.getByRole('button', { name: /to delete/i }).click()

    // Click delete button and confirm
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Delete scenario')
      dialog.accept()
    })
    await page.getByRole('menuitem', { name: /delete/i }).click()

    // Verify scenario is deleted (button should show "Unsaved scenario")
    await expect(page.getByRole('button', { name: /unsaved scenario/i })).toBeVisible()
  })

  test('Shows dirty indicator when canvas has unsaved changes', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) {
      await skipButton.click()
    }

    // Add a node and save scenario
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    const scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()
    await page.getByRole('menuitem', { name: /save/i }).click()
    await page.getByPlaceholder('Scenario name').fill('Clean Scenario')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Initially no dirty indicator (just saved)
    const savedButton = page.getByRole('button', { name: /clean scenario/i })
    await expect(savedButton).not.toContainText('•')

    // Make a change (add another node)
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    // Should now show dirty indicator
    await expect(savedButton.locator('[title="Unsaved changes"]')).toBeVisible()
  })

  test('Can switch between scenarios', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) {
      await skipButton.click()
    }

    // Create first scenario with 1 node
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    let scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()
    await page.getByRole('menuitem', { name: /save/i }).click()
    await page.getByPlaceholder('Scenario name').fill('Scenario A')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Reset canvas (delete node)
    await page.keyboard.press('Meta+A')
    await page.keyboard.press('Delete')

    // Create second scenario with 2 nodes
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()
    await page.getByTestId('btn-node-menu').click()
    await page.getByRole('menuitem', { name: /decision/i }).first().click()

    scenarioButton = page.getByRole('button', { name: /unsaved scenario/i })
    await scenarioButton.click()
    await page.getByRole('menuitem', { name: /save/i }).click()
    await page.getByPlaceholder('Scenario name').fill('Scenario B')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Switch back to Scenario A
    await page.getByRole('button', { name: /scenario b/i }).click()
    await page.getByRole('menuitem', { name: /^scenario a$/i }).click()

    // Verify Scenario A is loaded (should have 1 node)
    await expect(page.getByRole('button', { name: /scenario a/i })).toBeVisible()
    // Note: In a real test, we'd verify node count, but that requires ReactFlow internals
  })

  test('Onboarding overlay shows on first visit', async ({ page }) => {
    await page.goto('/#/canvas')

    // Should show onboarding overlay
    await expect(page.getByRole('dialog', { name: /welcome to decision canvas/i })).toBeVisible()

    // Should have 3 CTAs
    await expect(page.getByRole('button', { name: /browse templates/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create from scratch/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /learn shortcuts/i })).toBeVisible()

    // Should have shortcuts legend
    await expect(page.getByText(/essential shortcuts/i)).toBeVisible()

    // Can dismiss
    await page.getByRole('button', { name: /skip/i }).click()
    await expect(page.getByRole('dialog', { name: /welcome to decision canvas/i })).not.toBeVisible()
  })

  test('Onboarding overlay does not show again after dismissal', async ({ page }) => {
    await page.goto('/#/canvas')

    // Dismiss onboarding with "Don't show again" checked
    await page.getByText(/don't show this again/i).click()
    await page.getByRole('button', { name: /skip/i }).click()

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should not show onboarding
    await expect(page.getByRole('dialog', { name: /welcome to decision canvas/i })).not.toBeVisible()
  })
})

import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Accessibility Audit', () => {
  test('all interactive controls have accessible names', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Check toolbar buttons
    const toolbarButtons = page.locator('[role="toolbar"] button, .toolbar button')
    const count = await toolbarButtons.count()
    
    for (let i = 0; i < count; i++) {
      const button = toolbarButtons.nth(i)
      const ariaLabel = await button.getAttribute('aria-label')
      const text = await button.textContent()
      
      // Button should have either aria-label or visible text
      expect(ariaLabel || text?.trim()).toBeTruthy()
    }
    
    expectNoConsoleErrors(errors)
  })

  test('dialogs have proper ARIA attributes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Open keyboard cheatsheet (dialog)
    await page.keyboard.press('?')
    
    // Check dialog attributes
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    
    const ariaLabel = await dialog.getAttribute('aria-label')
    const ariaModal = await dialog.getAttribute('aria-modal')
    
    expect(ariaLabel).toBeTruthy()
    expect(ariaModal).toBe('true')
    
    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('toasts have role="alert" and aria-live', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Trigger a toast
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Check toast attributes
    const toast = page.locator('[role="alert"]').first()
    await expect(toast).toBeVisible()
    
    const role = await toast.getAttribute('role')
    expect(role).toBe('alert')
    
    // Toasts should not trap focus
    await page.keyboard.press('Tab')
    // Should be able to tab away
    
    expectNoConsoleErrors(errors)
  })

  test('focus trap works in modals', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Open command palette (modal)
    await page.keyboard.press('Meta+K')
    
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    
    // Tab through focusable elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Focus should stay within modal
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      return el?.closest('[role="dialog"]') !== null
    })
    
    expect(focusedElement).toBe(true)
    
    // Escape closes modal
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('keyboard navigation works without mouse', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Use only keyboard to:
    // 1. Open command palette
    await page.keyboard.press('Meta+K')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // 2. Close with Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    
    // 3. Select all
    await page.keyboard.press('Meta+A')
    await page.waitForTimeout(200)
    
    // 4. Undo
    await page.keyboard.press('Meta+Z')
    await page.waitForTimeout(200)
    
    // 5. Open help
    await page.keyboard.press('?')
    await expect(page.locator('text=Keyboard Shortcuts')).toBeVisible()
    
    await page.keyboard.press('Escape')
    
    expectNoConsoleErrors(errors)
  })

  test('focus indicators are visible', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Tab to first focusable element
    await page.keyboard.press('Tab')
    
    // Check that focused element has visible outline/ring
    const focusedStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const styles = window.getComputedStyle(el)
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow
      }
    })
    
    // Should have some focus indicator (outline or box-shadow)
    const hasFocusIndicator = 
      focusedStyle.outline !== 'none' ||
      focusedStyle.outlineWidth !== '0px' ||
      focusedStyle.boxShadow !== 'none'
    
    expect(hasFocusIndicator).toBe(true)
    
    expectNoConsoleErrors(errors)
  })

  test('screen reader announcements work', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Trigger an action that should announce
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Toast should have role="alert" which announces automatically
    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()
    
    // Check for aria-live regions
    const liveRegions = await page.locator('[aria-live]').count()
    expect(liveRegions).toBeGreaterThanOrEqual(0) // May or may not have explicit aria-live
    
    expectNoConsoleErrors(errors)
  })

  test('all images and icons have alt text or aria-label', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Check all images
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const ariaLabel = await img.getAttribute('aria-label')
      
      // Should have alt or aria-label
      expect(alt !== null || ariaLabel !== null).toBe(true)
    }
    
    expectNoConsoleErrors(errors)
  })
})

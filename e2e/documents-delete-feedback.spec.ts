import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut } from './helpers/canvas'
import { primeUiState, dismissAllOverlays } from './helpers/overlays'

// S8-DELETE-TOAST: Delete feedback for legacy drawer and docked Inputs → Documents

test.describe('S8-DELETE-TOAST: Documents delete feedback', () => {
  test.describe('legacy Documents drawer (dock layout flag OFF)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          // Ensure legacy drawer is used by explicitly disabling docked layout
          localStorage.setItem('feature.inputsOutputs', '0')
        } catch {}
      })

      await primeUiState(page)
      await openCanvas(page)
      await dismissAllOverlays(page)
      await page.waitForLoadState('networkidle')
    })

    test('Documents drawer delete toast includes filename (legacy layout)', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      const filename = 'legacy-delete.txt'

      // Open legacy Documents drawer directly via store to avoid shortcut flakiness
      await page.evaluate(() => {
        // @ts-ignore - accessing store in test
        const store = (window as any).useCanvasStore.getState()
        store.setShowDocumentsDrawer(true)
      })

      await expect(page.getByText('Source Documents')).toBeVisible()

      // Inject a document directly into the canvas store to keep the test stable
      await page.evaluate(name => {
        // @ts-ignore - accessing store in test
        const store = (window as any).useCanvasStore.getState()
        store.addDocument({
          name,
          type: 'txt',
          content: 'Legacy delete test content',
          size: 32,
        })
      }, filename)

      await expect(page.getByText(filename)).toBeVisible()

      // Delete the document
      await page.locator('button[aria-label="Delete document"]').first().click()

      // Toast message should include the filename ("<name> removed")
      await expect(page.getByText(new RegExp(`${filename} removed`))).toBeVisible()

      expectNoConsoleErrors(errors)
    })
  })

  test.describe('docked Inputs → Documents (dock layout flag ON)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          // Enable docked layout for Inputs/Outputs
          localStorage.setItem('feature.inputsOutputs', '1')
        } catch {}
      })

      await primeUiState(page)
      await openCanvas(page)
      await dismissAllOverlays(page)
       await page.waitForLoadState('networkidle')
    })

    test('Inputs → Documents delete toast includes filename (docked layout)', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      const inputsDock = page.getByTestId('inputs-dock')
      await expect(inputsDock).toBeVisible()

      // Ensure the dock is expanded if a toggle is present
      const toggle = page.getByRole('button', { name: /Collapse inputs dock|Expand inputs dock/ })
      const hasToggle = await toggle.first().isVisible({ timeout: 500 }).catch(() => false)
      if (hasToggle) {
        const label = await toggle.first().getAttribute('aria-label')
        if (label && label.includes('Expand')) {
          await toggle.first().click()
        }
      }

      const filename = 'docked-delete.txt'

      // Inject a document directly into the canvas store for the docked manager
      await page.evaluate(name => {
        // @ts-ignore - accessing store in test
        const store = (window as any).useCanvasStore.getState()
        store.addDocument({
          name,
          type: 'txt',
          content: 'Docked delete test content',
          size: 32,
        })
      }, filename)

      await expect(page.getByText(filename)).toBeVisible()

      // Delete the document
      await page.locator('button[aria-label="Delete document"]').first().click()

      // Toast message should include the filename ("<name> removed")
      await page.waitForTimeout(50)
      await expect(page.getByText(new RegExp(`${filename} removed`))).toBeVisible()

      expectNoConsoleErrors(errors)
    })
  })
})

import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// E2E: Guided Mode happy-path with Undo and ARIA

test('Guided Mode apply + undo with ARIA announcements', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.guidedV1', '1')
      localStorage.setItem('feature.canvasSimplify', '1')
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)

  // Simplify toggle should be present and initially unchecked
  const chk = await page.getByTestId('simplify-toggle')
  await expect(chk).not.toBeChecked()

  // Apply suggestion 0
  await page.getByTestId('guided-suggestion-0').click()
  const status = page.getByRole('status')
  await expect(status).toContainText('Suggestion applied. You can press Undo.')

  // Toggle should now be checked
  await expect(page.getByTestId('simplify-toggle')).toBeChecked()

  // Undo
  await page.getByTestId('guided-undo-btn').click()
  await expect(page.getByRole('status')).toContainText('Undone.')
  await expect(page.getByTestId('simplify-toggle')).not.toBeChecked()

  // Why tooltip presence (sr-only is not visible; check text content)
  await expect(page.getByTestId('why-tooltip')).toHaveText(/.+/)
})

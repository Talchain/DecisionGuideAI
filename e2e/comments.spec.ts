import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from './_helpers'

// E2E: Comments feature basic CRUD and persistence
// Uses British English copy and stable selectors

test('Comments panel add/persist/delete with ARIA announcements', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.comments', '1')
      localStorage.setItem('feature.listView', '1')
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Open comments for node n1
  await page.getByTestId('comment-btn-n1').click()
  const panel = page.getByTestId('comments-panel')
  await expect(panel).toBeVisible()

  // Add a comment
  await page.getByTestId('comment-input').fill('Hello there')
  await page.getByTestId('comment-add-btn').click()

  // It appears in the list and label badge present
  const list = page.getByTestId('comment-list-n1')
  await expect(list).toContainText('Hello there')
  await expect(list.locator('.comment-label-badge')).toHaveCount(1)

  // SR polite status announces
  await expect(panel.getByRole('status')).toContainText('Comment added')

  // Reload and re-open; comment should persist (localStorage)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForPanel(page)
  await page.getByTestId('comment-btn-n1').click()
  await expect(page.getByTestId('comment-list-n1')).toContainText('Hello there')

  // Delete it, expect SR announcement and item gone
  await page.getByTestId('comments-panel').getByText('Delete', { exact: true }).click()
  await expect(page.getByTestId('comments-panel').getByRole('status')).toContainText('Comment deleted')
  await expect(page.getByTestId('comment-list-n1')).not.toContainText('Hello there')
})

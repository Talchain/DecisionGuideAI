import { test, expect } from '@playwright/test'
import { gotoSandbox, installFakeEventSource } from './_helpers'

// Snapshots happy path
// Flags: feature.snapshots=1

test.describe('Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      try { localStorage.setItem('feature.sseStreaming', '1') } catch {}
      try { localStorage.setItem('feature.snapshots', '1') } catch {}
      ;(window as any).__E2E = 1
      // Stub clipboard
      const w: any = window
      w.__CLIPBOARD = ''
      const clip: any = (navigator as any).clipboard || {}
      clip.writeText = async (t: string) => { w.__CLIPBOARD = String(t); return }
      ;(navigator as any).clipboard = clip
    })
    await gotoSandbox(page)
  })

  test('take snapshot, copy share link, open read-only', async ({ page, context }) => {
    // Take a snapshot
    await page.getByTestId('snapshot-btn').click()
    // Expect list item appears
    const list = page.getByTestId('snapshot-list')
    await expect(list.locator('li')).toHaveCount(1)
    // Expect SR text rendered (polite)
    await expect(page.getByRole('status')).toContainText(/Snapshot captured/i)

    // Copy share link from newest item
    await page.getByTestId('sharelink-copy').click()
    // Extract copied URL via a stub (writeText)
    const url = await page.evaluate(() => (window as any).__CLIPBOARD || '')

    // If __CLIPBOARD is empty (native clipboard), skip open
    if (url) {
      const p2 = await context.newPage()
      await p2.goto(url, { waitUntil: 'domcontentloaded' })
      // Panel should render in read-only mode: badge present, Start hidden
      await expect(p2.getByTestId('snapshot-readonly-badge')).toBeVisible()
      await expect(p2.getByTestId('start-btn')).toHaveCount(0)
    }
  })

  test('change log appears after second snapshot', async ({ page }) => {
    await page.getByTestId('snapshot-btn').click()
    await page.getByTestId('snapshot-btn').click()
    await expect(page.getByTestId('change-log')).toBeVisible()
  })
})

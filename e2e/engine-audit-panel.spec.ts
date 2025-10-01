import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from './_helpers'
import { mkdir } from 'fs/promises'
import path from 'path'

// Engine Audit Panel E2E: verify 200 -> 304 flow with ETag and no model mutation/flicker

test('Engine Audit Panel surfaces headers and cached ETag; 304 does not mutate or flicker', async ({ page }) => {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('feature.engineMode', '1') } catch {}
    try { (window as any).__E2E = 1 } catch {}
  })

  let call = 0
  await page.route('**/draft-flows', async (route) => {
    call += 1
    if (call === 1) {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'ETag': '"etag-1"',
          'Content-Length': '27',
          'Cache-Control': 'max-age=0, must-revalidate',
          'Vary': 'Accept, If-None-Match'
        },
        body: JSON.stringify({ items: [1, 2, 3] }),
      })
    } else {
      await route.fulfill({
        status: 304,
        headers: {
          'ETag': '"etag-1"',
        },
        body: '',
      })
    }
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Panel mounted in E2E path
  const panel = page.getByTestId('audit-panel')
  await expect(panel).toBeVisible()

  // First fetch → 200
  await page.getByTestId('audit-fetch-btn').click()
  await expect(page.getByTestId('audit-last-status')).toHaveText('200')
  await expect(page.getByTestId('audit-header-etag')).toHaveText('"etag-1"')
  await expect(page.getByTestId('audit-header-content-length')).toHaveText('27')
  await expect(page.getByTestId('audit-header-cache-control')).toContainText('must-revalidate')
  await expect(page.getByTestId('audit-header-vary')).toContainText('If-None-Match')
  const hash1 = await page.getByTestId('audit-data-hash').textContent()
  const cached = await page.getByTestId('audit-cached-etag').textContent()
  expect(cached?.includes('etag-1')).toBeTruthy()

  // Second fetch → 304 (no model mutation, data hash unchanged, no flicker)
  await page.getByTestId('audit-refetch-btn').click()
  await expect(page.getByTestId('audit-last-status')).toHaveText('304')
  await expect(page.getByTestId('audit-data-hash')).toHaveText(hash1 || '')

  // Capture evidence
  await mkdir(path.join(process.cwd(), 'docs/evidence/audit'), { recursive: true })
  await page.screenshot({ path: 'docs/evidence/audit/audit_panel_200_304.png', fullPage: true })
})

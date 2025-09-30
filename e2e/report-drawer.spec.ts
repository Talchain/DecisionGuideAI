import { test, expect } from '@playwright/test'
test.describe.configure({ retries: 1 })
import { waitForPanel, gotoSandbox, installFakeEventSource } from './_helpers'

test.setTimeout(60000)

const VALID = {
  version: 1,
  seed: 777,
  route: 'critique',
  startedAt: '2025-09-23T18:00:00.000Z',
  finishedAt: '2025-09-23T18:00:02.000Z',
  totals: { inputTokens: 10, outputTokens: 2 },
  steps: [
    { id: 'plan', type: 'plan', status: 'ok', attempts: 1, durationMs: 50 },
  ],
  meta: {},
  sections: [],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('cfg.gateway')
      localStorage.removeItem('feature.reportCopy')
      localStorage.removeItem('feature.reportDownload')
      localStorage.removeItem('feature.reportPretty')
      localStorage.removeItem('report.pretty')
      localStorage.removeItem('feature.reportExpandAll')
      localStorage.setItem('feature.summaryV2', '0')
    } catch {}
  })
})

// Happy: valid JSON → no note (+ copy toast when flag on)
test('Report drawer happy path: valid report and no note', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.runReport', '1')
      localStorage.setItem('feature.realReport', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      localStorage.setItem('feature.reportCopy', '1')
      localStorage.setItem('feature.reportDownload', '1')
      localStorage.setItem('feature.reportExpandAll', '1')
      localStorage.setItem('sandbox.model', 'local-sim')
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      ;(window as any).__E2E = '1'
      // Minimal clipboard stub to capture last copied value
      ;(window as any).__copied = []
      const nav: any = (window as any).navigator || {}
      nav.clipboard = nav.clipboard || {}
      nav.clipboard.writeText = (val: string) => { (window as any).__copied.push(String(val || '')); return Promise.resolve() }
      ;(window as any).navigator = nav
    } catch {}
  })
  await installFakeEventSource(page)
  // Hook routes before navigation
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await gotoSandbox(page)

  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('done')
  })

  const btn = page.getByTestId('view-report-btn')
  await expect(btn).toBeEnabled()
  // Intercept /report just-in-time to avoid interfering with bootstrap
  await page.route('**/report**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VALID) }))
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/report') && r.ok()),
    btn.click(),
  ])
  await expect(page.getByTestId('report-drawer')).toBeVisible()
  // Ensure report payload resolved (concurrent wait above)
  await expect(page.getByTestId('report-note')).toHaveCount(0)
  await expect(page.getByTestId('report-steps')).toBeVisible()

  // Copy JSON button should be present (flag ON)
  const copyBtn = page.getByTestId('report-copy-btn')
  await expect(copyBtn).toBeVisible()
  await copyBtn.click()
  // Toast appears
  await expect(page.getByTestId('report-copy-toast')).toBeVisible()
  // Clipboard captured
  const copiedLen = await page.evaluate(() => (window as any).__copied?.length || 0)
  expect(copiedLen).toBe(1)
  // Toast hides reactively (no sleeps)
  await expect(page.getByTestId('report-copy-toast')).toHaveCount(0)

  // Download JSON button should be present (flag ON)
  const dlBtn = page.getByTestId('report-download-btn')
  await expect(dlBtn).toBeVisible()
  // Patch anchor click to capture filename deterministically
  await page.evaluate(() => {
    try {
      (window as any).__LAST_DL_NAME = ''
      const proto: any = (window as any).HTMLAnchorElement && (window as any).HTMLAnchorElement.prototype
      if (proto && !proto.__e2ePatched) {
        const origClick = proto.click
        proto.click = function () {
          try { (window as any).__LAST_DL_NAME = String((this as any).download || '') } catch {}
          return origClick ? origClick.apply(this, arguments as any) : undefined
        }
        proto.__e2ePatched = true
      }
    } catch {}
  })
  await dlBtn.click()
  // Assert captured filename
  await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_DL_NAME || ''))
    .toContain('report_v1')
  await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_DL_NAME || ''))
    .toContain('seed-777')
  await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_DL_NAME || ''))
    .toContain('model-local-sim')

  // Download toast appears then hides without sleeps
  await expect(page.getByTestId('report-download-toast')).toBeVisible()
  await expect(page.getByTestId('report-download-toast')).toHaveCount(0)

  // Expand/Collapse all (flag ON)
  const table = page.getByTestId('report-steps')
  const toggle = page.getByTestId('report-expandall-btn')
  await expect(toggle).toBeVisible()
  let rows = await table.locator('tbody tr').count()
  if (rows === 0) {
    await toggle.click() // expand
    await table.locator('tbody tr').first().waitFor()
    rows = await table.locator('tbody tr').count()
    expect(rows).toBeGreaterThan(0)
    await toggle.click() // collapse
    await expect(table.locator('tbody tr')).toHaveCount(0)
  } else {
    await toggle.click() // collapse
    await expect(table.locator('tbody tr')).toHaveCount(0)
    await toggle.click() // expand
    await table.locator('tbody tr').first().waitFor()
    rows = await table.locator('tbody tr').count()
    expect(rows).toBeGreaterThan(0)
  }
})

// Fallback: invalid JSON → fixture + note
test('Report drawer fallback: invalid JSON shows note and fixture content', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.runReport', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
  // Hook routes before navigation
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await gotoSandbox(page)

  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('done')
  })

  // Intercept /report to simulate invalid JSON response
  await page.route('**/report**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ wrong: 1 }) }))
  await page.getByTestId('view-report-btn').click()
  await expect(page.getByTestId('report-drawer')).toBeVisible()
  await expect(page.getByTestId('report-note')).toBeVisible()
  await expect(page.getByTestId('report-steps')).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// E2E: Report download filename includes seed and model via formatDownloadName

test('Report download filename includes seed and model', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.runReport', '1')
      localStorage.setItem('feature.reportDownload', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      localStorage.setItem('sandbox.seed', '4242')
      localStorage.setItem('sandbox.model', 'local-sim')
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  await gotoSandbox(page)
  await waitForPanel(page)
  // Install capture stub after app has mounted to avoid interfering with boot
  await page.evaluate(() => {
    try {
      ;(window as any).__LAST_DL_NAME = ''
      const OrigCreate = URL.createObjectURL.bind(URL)
      URL.createObjectURL = (blob: any) => {
        try { return OrigCreate(blob) } catch { return 'blob:stub' }
      }
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
  // Deterministic /report response so we can await ok()
  await page.route('**/report*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      seed: 4242,
      orgId: 'o',
      userId: 'u',
      route: 'critique',
      traceId: 't',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totals: {},
      steps: []
    }),
  }))

  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('done')
  })
  // Ensure report UI is interactive before opening drawer (enabled only after terminal state)
  await expect(page.getByTestId('view-report-btn')).toBeEnabled()

  await page.getByTestId('view-report-btn').click()
  // Ensure report payload resolved (fixture or live)
  await page.waitForResponse((r) => r.url().includes('/report') && r.ok())
  await page.getByTestId('report-steps').waitFor()
  await page.getByTestId('report-download-btn').click()
  // Capture the generated filename deterministically via anchor[download]
  await page.evaluate(() => {
    try {
      const a = document.querySelector('a[download]') as HTMLAnchorElement | null
      if (a) {
        ;(window as any).__LAST_DL_NAME = a.getAttribute('download') || ''
      }
    } catch {}
  })
  const last = await page.evaluate(() => (window as any).__LAST_DL_NAME || '')
  // Belt-and-braces: poll for the captured filename
  await expect.poll(async () => (await page.evaluate(() => (window as any).__LAST_DL_NAME || ''))).toContain('seed-')
  await expect.poll(async () => (await page.evaluate(() => (window as any).__LAST_DL_NAME || ''))).toContain('model-')
  const name = last || (await page.evaluate(() => (window as any).__LAST_DL_NAME || ''))
  expect(name).toContain('seed-4242')
  expect(name).toContain('model-local-sim')
})

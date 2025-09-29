import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

test.describe('Config persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Turn drawer + report flags ON and E2E surface
    await page.addInitScript(() => {
      try { localStorage.setItem('feature.configDrawer', '1') } catch {}
      try { localStorage.setItem('feature.runReport', '1') } catch {}
      try { localStorage.setItem('feature.sseStreaming', '1') } catch {}
      ;(window as any).__E2E = '1'
    })
    await installFakeEventSource(page)
  })

  test('SSE + Report use base from cfg.gateway', async ({ page }) => {
    await gotoSandbox(page)
    await waitForPanel(page)

    // Open drawer and set the base
    await page.getByTestId('config-btn').click()
    await page.getByTestId('cfg-gateway').fill('http://localhost:8787')
    await page.getByTestId('cfg-save-btn').click()

    // Reload to ensure LS is read on boot
    await page.reload()
    await gotoSandbox(page)

    // Start a run and assert EventSource url starts with base
    await page.getByTestId('start-btn').click()
    const urlStr = await page.evaluate(() => {
      const insts: any[] = (window as any).FakeEventSource?.instances || []
      return String(insts[insts.length - 1]?.url || '')
    })
    expect(urlStr).toContain('http://localhost:8787')

    // Force terminal by emitting done
    await page.evaluate(() => {
      const insts: any[] = (window as any).FakeEventSource?.instances || []
      const es = insts[insts.length - 1]
      es?.emit('done', { reason: 'done' })
    })
    // View report button should be enabled now
    // Intercept report request to avoid fallback and assert base strictly (must be set before click)
    await page.route('http://localhost:8787/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    const [req] = await Promise.all([
      page.waitForRequest((req) => req.url().startsWith('http://localhost:8787/report')),
      page.getByTestId('view-report-btn').click(),
    ])
    expect(req.url()).toContain('http://localhost:8787')
  })
})

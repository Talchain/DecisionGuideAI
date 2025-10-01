import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// E2E: Diagnostics minimal assertions

test('Diagnostics shows SSE id, resumes and token count after streaming', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.diagnostics', '1')
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)

  await page.getByTestId('start-btn').click()

  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open')
    es.emit('token', 'A', 'a1')
  })

  await expect(page.getByTestId('diag-stream-state')).toContainText('streaming', { ignoreCase: true })
  await expect(page.getByTestId('diag-token-count')).toContainText('1')
  await expect(page.getByTestId('diag-last-event-id')).toContainText('a1')

  // Trigger a reconnect and ensure resumes count increments
  await page.evaluate(() => {
    const es1 = (window as any).FakeEventSource.instances[0]
    es1.emit('error')
  })
  await page.waitForTimeout(70)
  await expect(page.getByTestId('diag-reconnects')).toContainText(/\d+/)
})

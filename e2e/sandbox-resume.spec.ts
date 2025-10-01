import { test, expect } from '@playwright/test'
import { waitForPanel, gotoSandbox, installFakeEventSource } from './_helpers'

test('Sandbox resume shows note once and no duplicate tokens', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.hints', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  await gotoSandbox(page)
  await waitForPanel(page)

  await page.getByTestId('start-btn').click()

  // First connection
  await page.waitForFunction(() => (window as any).FakeEventSource?.instances?.length === 1)
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('token', 'Hello ', '1')
  })

  // Trigger reconnect
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('error') })
  await page.waitForTimeout(60)
  await page.waitForFunction(() => (window as any).FakeEventSource.instances.length === 2)

  // Second connection emits duplicate id=1 (ignored) and new id=2
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[1]
    es.emit('token', 'DUP', '1'); es.emit('token', 'world', '2')
  })

  await expect(page.getByTestId('resume-note')).toBeVisible()
  await expect(page.getByTestId('stream-output')).toHaveText('Hello world')

  // Note should appear once
  await expect(page.getByTestId('resume-note')).toHaveCount(1)

  // Finish terminal to re-enable Start, then start again clears the note
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[1]; es.emit('done') })
  await expect(page.getByTestId('start-btn')).toBeEnabled()
  await page.getByTestId('start-btn').click()
  await expect(page.getByTestId('resume-note')).toHaveCount(0)
})

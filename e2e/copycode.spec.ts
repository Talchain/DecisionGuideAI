import { test, expect } from '@playwright/test'
import { waitForPanel, gotoSandbox, installFakeEventSource } from './_helpers'

test('Markdown preview Copy code copies fenced contents and announces', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.hints', '1')
      localStorage.setItem('feature.mdPreview', '1')
      localStorage.setItem('feature.copyCode', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.runReport', '1')
      localStorage.setItem('feature.shortcuts', '1')
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await page.addInitScript(() => {
    // Stub clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          ;(window as any).__lastCopied = t
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    ;(window as any).__lastCopied = ''
  })
  await installFakeEventSource(page)
  // Stub any Supabase calls the app may attempt
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  // Navigate to Sandbox via shared helper and wait for mount
  await gotoSandbox(page)
  await waitForPanel(page)
  // Wait for Start button and click
  await page.waitForSelector('[data-testid="start-btn"]', { timeout: 15000 })
  const startBtn = page.getByTestId('start-btn')
  const clicked = await startBtn.click({ trial: true }).then(() => true).catch(() => false)
  if (clicked) {
    await startBtn.click()
  } else {
    const startByRole = page.getByRole('button', { name: 'Start' })
    if (await startByRole.isVisible().catch(() => false)) {
      await startByRole.click()
    } else {
      // Fallback: dispatch keyboard shortcut directly on window (Ctrl/Cmd+Enter)
      await page.evaluate(() => {
        const isMac = navigator.platform.toLowerCase().includes('mac')
        const ev = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: !isMac, metaKey: isMac, bubbles: true })
        window.dispatchEvent(ev)
      })
    }
  }
  // Ensure UI transitioned to streaming state: Start becomes disabled quickly
  await expect(startBtn).toBeDisabled()
  // Wait for FakeEventSource instance to be created by the app (begin() called)
  await page.waitForFunction(() => (window as any).FakeEventSource?.instances?.length > 0, { timeout: 20000 })

  // Drive a minimal fenced block stream: ```js, body, ``` then done
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open')
    es.emit('token', '```js\n', '1')
    es.emit('token', "console.log('hi')\n", '2')
    es.emit('token', '```', '3')
    es.emit('done')
  })

  // Preview rendered (aria-hidden=true is expected)
  await expect(page.getByTestId('md-preview')).toBeVisible()

  // Find the copy button by test id (preview is aria-hidden, so prefer DOM query)
  await page.waitForSelector('[data-testid="copy-code-btn"]', { timeout: 15000 })
  const copyBtn = page.getByTestId('copy-code-btn').first()
  await expect(copyBtn).toBeVisible()

  await copyBtn.click()

  // Clipboard got exact fenced text (without trailing fence or language line)
  await page.waitForFunction(() => (window as any).__lastCopied === "console.log('hi')")

  // Offscreen status announces then clears
  const status = page.getByTestId('copy-aria-status')
  await expect(status).toHaveText('Copied')
  await expect(status).toHaveText('', { timeout: 2500 })

  // Optional: transient attribute on the control
  const attr = await copyBtn.getAttribute('data-copied')
  // Either present briefly or already cleared depending on timing
  expect(attr === 'true' || attr === null).toBeTruthy()
})

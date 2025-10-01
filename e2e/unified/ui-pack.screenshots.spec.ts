import { test, expect } from '@playwright/test'
import { gotoSandbox, installFakeEventSource, waitForPanel } from '../_helpers'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// @evidence Capture real UI screenshots for the UI pack

test.describe('@evidence ui-pack screenshots', () => {
  test('desktop and <=480px mobile list-view', async ({ page, browser }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('feature.sseStreaming', '1')
        localStorage.setItem('feature.listView', '1')
        ;(window as any).__E2E = 1
      } catch {}
    })
    await gotoSandbox(page)
    await waitForPanel(page)

    const outDir = path.join(process.cwd(), 'docs/evidence/ui-pack')
    await mkdir(outDir, { recursive: true })
    await page.screenshot({ path: path.join(outDir, 'screenshot.desktop.png'), fullPage: false })

    const mobile = await browser.newContext({ viewport: { width: 480, height: 800 }, deviceScaleFactor: 2 })
    const m = await mobile.newPage()
    await installFakeEventSource(m as any)
    await m.addInitScript(() => {
      try {
        localStorage.setItem('feature.sseStreaming', '1')
        localStorage.setItem('feature.listView', '1')
        ;(window as any).__E2E = 1
      } catch {}
    })
    await gotoSandbox(m as any)
    await waitForPanel(m as any)
    await m.screenshot({ path: path.join(outDir, 'screenshot.mobile.png'), fullPage: false })
  })
})

import type { Page } from '@playwright/test'

export async function waitForPanel(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle')
  // Prefer new signal first (non-fatal)
  await page
    .waitForFunction(() => (document as any)?.body?.dataset?.e2eReady === '1', undefined, { timeout: 5000 })
    .catch(() => {})
  try {
    await page.waitForSelector('[data-testid="panel-root"], [data-testid="start-btn"], [data-testid="e2e-surface"]', { state: 'visible', timeout: 15000 })
  } catch (err) {
    // Diagnostics to console and trace
    try {
      const info = await page.evaluate(() => ({ href: location.href, title: document.title, body: (document.body?.innerText || '').slice(0, 300) }))
      // eslint-disable-next-line no-console
      console.log('[waitForPanel] diagnostics:', info)
    } catch {}
    try { await page.screenshot().catch(() => {}) } catch {}
    throw new Error('panel_not_ready')
  }
}

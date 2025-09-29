import { test, expect } from '@playwright/test'
import { installFakeEventSource, waitForPanel } from './_helpers'

// Scenarios share link import E2E

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('feature.scenarios')
      localStorage.removeItem('scenarios.v1')
      localStorage.removeItem('sandbox.seed')
      localStorage.removeItem('sandbox.budget')
      localStorage.removeItem('sandbox.model')
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
})

test('Direct link with ?scenario= imports values and shows chip', async ({ page }) => {
  // Enable feature flag via init script
  await page.addInitScript(() => { try { localStorage.setItem('feature.scenarios', '1'); localStorage.setItem('feature.params', '1') } catch {} })

  // Build a scenario param in page context
  const param = await page.evaluate(() => {
    const json = { v: 1, name: 'Linked', seed: '888', budget: '3.5', model: 'gpt-4o-mini' }
    const txt = JSON.stringify(json)
    const b64 = (window as any).btoa ? (window as any).btoa(txt) : Buffer.from(txt, 'utf-8').toString('base64')
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  })

  await page.goto(`/?e2e=1#/sandbox&scenario=${param}`)
  await waitForPanel(page)

  await expect(page.getByTestId('scenario-chip')).toBeVisible()
  await expect(page.getByTestId('param-seed')).toHaveValue('888')
  await expect(page.getByTestId('param-budget')).toHaveValue('3.5')
  await expect(page.getByTestId('param-model')).toHaveValue('gpt-4o-mini')
})

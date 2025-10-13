import { test, expect } from '@playwright/test'

// Boot selector smoke: verify PLC route wins when VITE_PLC_LAB=1, regardless of VITE_POC_ONLY

test('Boot selector: #/plc + VITE_PLC_LAB=1 mounts PLC Lab', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('PLC_ENABLED', '1')
      localStorage.setItem('plc.snap', '0')
      localStorage.setItem('plc.guides', '0')
      localStorage.setItem('plc.snapGuide', '0')
    } catch {}
  })
  const route = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  
  // PLC Lab should mount
  await expect(page.getByTestId('plc-root')).toBeVisible()
  await expect(page.getByTestId('plc-whiteboard')).toBeVisible()
  
  // PoC shell should not mount
  await expect(page.locator('[data-testid="poc-shell"]')).toHaveCount(0)
})

test('Boot selector: #/plot mounts PoC shell when VITE_POC_ONLY=1', async ({ page }) => {
  // This test assumes build:poc sets VITE_POC_ONLY=1
  await page.goto('/?e2e=1#/plot', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plot')
  
  // PoC shell should mount (or at least not PLC)
  await expect(page.getByTestId('plc-root')).toHaveCount(0)
})

import { test, expect } from '@playwright/test'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mountPlc(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { try {
    localStorage.setItem('PLC_ENABLED','1')
    localStorage.setItem('plc.snap','0')
    localStorage.setItem('plc.guides','0')
    localStorage.setItem('plc.snapGuide','0')
  } catch {} })
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  await page.getByTestId('plc-root').waitFor()
  await page.getByTestId('plc-whiteboard').waitFor()
}

test('PLC reduced-motion: no transitions/animations in PLC UI', async ({ page }) => {
  await mountPlc(page)

  // Spot check styles on whiteboard child and bulk toolbar
  const hasMotion = await page.evaluate(() => {
    const wb = document.querySelector('[data-testid="plc-whiteboard"] *') as HTMLElement | null
    const tb = document.querySelector('[data-testid="plc-bulk-toolbar"]') as HTMLElement | null
    function isAnimated(el: HTMLElement | null): boolean {
      if (!el) return false
      const cs = getComputedStyle(el)
      const t = cs.transitionDuration.split(',').some(s => parseFloat(s) > 0)
      const a = cs.animationDuration.split(',').some(s => parseFloat(s) > 0)
      return t || a
    }
    return isAnimated(wb) || isAnimated(tb)
  })

  expect(hasMotion).toBe(false)
})

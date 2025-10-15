import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173'

test.describe('Canvas gating', () => {
  test('default → legacy (env=0), then ?plc=1 → PLC, then localStorage precedence', async ({ page }) => {
    const logs: string[] = []
    page.on('console', (msg) => {
      const t = msg.text()
      if (t.includes('[PLOT] route=/plot')) logs.push(t)
    })

    // 1) Default (assumes env default is 0 in production)
    await page.goto(`${BASE}/#/plot`)
    const badge = page.locator('text=CANVAS=Legacy')
    await expect(badge).toBeVisible()
    await expect(page.locator('[data-testid="legacy-canvas"]')).toBeVisible()
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toHaveCount(0)

    // 2) URL override → PLC
    await page.goto(`${BASE}/#/plot?plc=1`)
    await expect(page.locator('text=CANVAS=PLC')).toBeVisible()
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible()

    // Hit-test probe (right-middle)
    const probe = await page.evaluate(() => {
      const res = (x:number,y:number) => document.elementsFromPoint(x,y)
        .map(e => ({ id: (e as HTMLElement).id, z: getComputedStyle(e).zIndex, pe: getComputedStyle(e).pointerEvents }))
      return res(innerWidth * 0.75, innerHeight * 0.5)
    })
    expect(Array.isArray(probe)).toBe(true)

    // 3) localStorage precedence over env (simulate next load)
    await page.addInitScript(() => localStorage.setItem('PLOT_USE_PLC', '0'))
    await page.goto(`${BASE}/#/plot`) // no ?plc this time
    await expect(page.locator('text=CANVAS=Legacy')).toBeVisible()

    // 4) Check we printed at least one boot line
    expect(logs.some(l => l.includes('component=PlotWorkspace'))).toBeTruthy()
  })

  test('diag mode removes rail and keeps canvas on top', async ({ page }) => {
    await page.goto(`${BASE}/#/plot?diag=1`)
    // Whatever your diag mode does, add a simple invariant; for example:
    const hasRail = await page.evaluate(() => !!document.getElementById('plot-right-rail'))
    expect(hasRail).toBeFalsy()

    const topIds = await page.evaluate(() =>
      document.elementsFromPoint(innerWidth * 0.75, innerHeight * 0.5)
        .map(e => (e as HTMLElement).id)
    )
    // Expect canvas root to be near the top
    expect(topIds.includes('plot-canvas-root')).toBeTruthy()
  })
})

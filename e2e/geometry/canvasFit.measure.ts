/**
 * CANVAS FIT — does the graph actually fit the space left beside the dock?
 *
 * ⚠ RAISED BY A WHOLE-APP SCREENSHOT, MEASURED HERE BEFORE ANY CODE IS READ.
 * Both `wholeAppLook` captures show the graph at 50% zoom with the left column
 * and the entire bottom tier clipped. A screenshot proves something is wrong;
 * it does not say WHAT, and the plausible causes differ completely in fix:
 *
 *   · the fit ran against the FULL viewport, ignoring the 416px dock, so the
 *     graph is centred under the panel;
 *   · the fit ran before the nodes were measured, so it fitted an empty or
 *     stale bounding box;
 *   · the graph genuinely exceeds the pane at the zoom floor;
 *   · the fit never ran at all on this path.
 *
 * So this reports the numbers each of those would produce and asserts nothing.
 * Run deliberately:
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/canvasFit.measure.ts
 */
import { test, type Page } from '@playwright/test'
import {
  clearNotifications, freezeMotion, openCanvas, preparePage, seedStarterDraft,
  waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const VP = { width: 1440, height: 900 }
test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } })

async function report(page: Page, starter: StarterId) {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, starter)
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)

  const m = await page.evaluate(() => {
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const dock = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const paneBox = pane?.getBoundingClientRect()
    const dockBox = dock?.getBoundingClientRect()

    // Screen-space extent of the painted nodes.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const b = n.getBoundingClientRect()
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height)
    }
    // The transform React Flow applied (scale is the zoom).
    const tf = vpEl ? getComputedStyle(vpEl).transform : 'none'

    // How many nodes are wholly inside the space NOT covered by the dock.
    const freeRight = dockBox ? dockBox.x : window.innerWidth
    let clipped = 0
    for (const n of nodes) {
      const b = n.getBoundingClientRect()
      if (b.x < 0 || b.y < 0 || b.x + b.width > freeRight || b.y + b.height > window.innerHeight) clipped++
    }

    return {
      viewport: [window.innerWidth, window.innerHeight],
      pane: paneBox ? [Math.round(paneBox.x), Math.round(paneBox.y), Math.round(paneBox.width), Math.round(paneBox.height)] : null,
      dock: dockBox ? [Math.round(dockBox.x), Math.round(dockBox.width)] : null,
      paneCoversDock: paneBox && dockBox ? paneBox.x + paneBox.width > dockBox.x + 1 : null,
      nodeCount: nodes.length,
      nodeExtent: nodes.length
        ? [Math.round(minX), Math.round(minY), Math.round(maxX), Math.round(maxY)]
        : null,
      transform: tf,
      clipped,
    }
  })

  // eslint-disable-next-line no-console
  console.log(`[fit] ${starter}: ${JSON.stringify(m)}`)
}

for (const starter of ['build-vs-buy', 'pricing-model'] as const) {
  test(`FIT — ${starter}`, async ({ page }) => { await report(page, starter) })
}

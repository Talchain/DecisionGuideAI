/**
 * MEASUREMENT — does the "Needs input" pill cover any other top-right corner
 * occupant? Real Chromium, real layout, hermetic (no network). Not a gate.
 *
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/statusPillCorner.measure.ts
 *
 * ⭐ THE METRIC IS PILL-vs-OTHER-OCCUPANT, DELIBERATELY, and it is the same
 * metric before and after the migration. The obvious metric — pill rect vs
 * `node-corner-stack` rect — is DEGENERATE once the pill joins the stack (the
 * pill is then a CHILD, so it intersects its own parent completely and the
 * number rockets to the pill's own area). A metric that reads ~1100px² after a
 * fix that removed the overlap would be read as a catastrophic regression. This
 * one asks the question the user actually experiences: how much of another
 * badge is hidden behind the pill.
 *
 * ⚠ ARM A IS THE CONTROL AND IT MUST READ ZERO CO-OCCURRENCE. With no run
 * history there is no edited-since-run dot, so a non-zero coverage figure in
 * arm A means the instrument is measuring something other than what it names.
 *
 * Two arms, because the co-occurring state is NOT the fresh-draft state:
 *   A — fresh starter draft, no run history. Corner stack empty apart from the
 *       pill. Expect zero other occupants.
 *   B — a PRIOR RUN sits in localStorage run history. That is the state an
 *       import or a canvas reset leaves: both set `results.status` to 'idle'
 *       (store.ts:3903, :4358), which is pre-run mode and mounts the pill, while
 *       run history is a SEPARATE localStorage authority that survives both
 *       (runHistory.ts STORAGE_KEY). Every current node then has no counterpart
 *       in the run snapshot, so `diffEditedNodeIds` marks it edited and the
 *       amber dot mounts beside the pill.
 *
 * MEASURED at 1440x900, starters `vendor-selection` and `build-vs-buy`:
 *   BEFORE (pill hand-positioned `-top-2 -right-1 z-10`):
 *     arm A — 0 other occupants;  arm B — dot 25px², 15px² covered (60%)
 *   AFTER  (pill a static child of the corner stack):
 *     arm A — 0 other occupants;  arm B — dot 25px², 0px² covered
 */
import { test, expect } from '@playwright/test'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const STARTERS: StarterId[] = ['vendor-selection', 'build-vs-buy']

/** For every node showing the pill, how much of each OTHER corner occupant does it cover? */
async function census(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const PILL = '[data-testid="needs-input-pill"]'
    const nodes = Array.from(document.querySelectorAll('[data-testid^="rf__node-"]'))
    // CONTRAST CONTROL: an element that certainly exists on any seeded canvas.
    // If this reads zero the page never rendered and every other number is void.
    const glyphsControl = document.querySelectorAll('[data-testid="node-type-glyph"]').length
    const cells: unknown[] = []
    for (const node of nodes) {
      const pill = node.querySelector(PILL)
      if (!pill) continue
      const stack = node.querySelector('[data-testid^="node-corner-stack-"]')
      const pr = pill.getBoundingClientRect()
      const others = stack ? Array.from(stack.children).filter(c => c !== pill) : []
      const occupants = others.map(c => {
        const cr = c.getBoundingClientRect()
        const ix = Math.max(0, Math.min(pr.right, cr.right) - Math.max(pr.left, cr.left))
        const iy = Math.max(0, Math.min(pr.bottom, cr.bottom) - Math.max(pr.top, cr.top))
        return {
          occupant: (c as HTMLElement).dataset.testid ?? c.tagName,
          areaPx2: +(cr.width * cr.height).toFixed(2),
          coveredByPillPx2: +(ix * iy).toFixed(2),
        }
      })
      cells.push({
        node: (node.getAttribute('data-testid') ?? '').replace('rf__node-', ''),
        pillW: +pr.width.toFixed(2), pillH: +pr.height.toFixed(2),
        pillIsStackChild: !!stack && stack.contains(pill),
        occupants,
      })
    }
    return { glyphsControl, cells }
  })
}

async function drive(page: import('@playwright/test').Page, id: StarterId, seedRunHistory: boolean) {
  await preparePage(page, { width: 1440, height: 900 })
  await openCanvas(page)
  if (seedRunHistory) {
    await page.evaluate(() => {
      localStorage.setItem('olumi-canvas-run-history', JSON.stringify([{
        id: 'run-prior', ts: Date.now() - 60_000, seed: 1, adapter: 'mock',
        summary: 'prior run', graphHash: 'h-prior', report: {},
        graph: { nodes: [{ id: 'a-node-not-on-this-canvas', data: {} }], edges: [] },
      }]))
    })
  }
  await seedStarterDraft(page, id)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)
  return census(page)
}

for (const id of STARTERS) {
  test(`GEOM statusPill ${id} armA-noRunHistory`, async ({ page }) => {
    const out = await drive(page, id, false)
    console.log('GEOMJSON ' + JSON.stringify({ starter: id, arm: 'A-noRunHistory', ...out }))
    expect(out.glyphsControl, 'contrast control: canvas never rendered').toBeGreaterThan(0)
  })

  test(`GEOM statusPill ${id} armB-priorRunInHistory`, async ({ page }) => {
    const out = await drive(page, id, true)
    console.log('GEOMJSON ' + JSON.stringify({ starter: id, arm: 'B-priorRunInHistory', ...out }))
    expect(out.glyphsControl, 'contrast control: canvas never rendered').toBeGreaterThan(0)
    // The state under measurement must actually have been constructed, or the
    // zero this file reports is a zero about nothing (CLAUDE.md trap 13).
    const withOthers = out.cells.filter((c) => (c as { occupants: unknown[] }).occupants.length > 0)
    expect(withOthers.length, 'arm B never produced a pill sharing the corner').toBeGreaterThan(0)
  })
}

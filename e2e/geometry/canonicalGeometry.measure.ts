/**
 * CANONICAL GEOMETRY — a MEASUREMENT instrument, not a gate.
 *
 * Real Chromium, real layout, no references, nothing blessed, no assertions
 * about what the numbers ought to be. It exists because founder ruling R1
 * (18 Aug 2026) asks for the shipped starters to be RE-MEASURED at 1280 / 1440
 * / 1512 after the canonical-layout authority is fixed, and because jsdom
 * cannot prove a rendered size or a settled camera zoom (CLAUDE.md trap 3).
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts
 * The file is `*.measure.ts`, NOT `*.spec.ts`, precisely so the main e2e
 * config (`testDir: 'e2e'`, default testMatch) cannot collect it into a run
 * that has no dev server on its port.
 *
 * ⭐ THE POSITIVE CONTROL THIS HARNESS NEEDS, recorded because it was missing on
 * the first run and produced a perfect false negative. `applyDraftResult` — the
 * seeding path — never set the layout store's `canvasSize`, so on the PRISTINE
 * build every viewport silently fell back to `layout.ts`'s FALLBACK_CANVAS of
 * 1300 and the harness reported BEFORE and AFTER as byte-identical in all
 * fifteen cells. That reads exactly like "the change did nothing". To witness
 * the viewport dependence on a pristine tree you must first reproduce
 * `DraftChat.tsx`'s two lines (`resolveLayoutCanvasSize()` then
 * `setCanvasSize`) through Vite's module graph, and ASSERT the store took the
 * pane's width before seeding. On this tree there is nothing to reproduce —
 * the authority is gone — which is the property under test.
 *
 * Output: one `GEOMJSON {...}` line per cell on stdout.
 */
import { test } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'
// ⚠ PREFIX, NOT THE OPTIONS ID. This compared `nd.id === '__ghost-option__'`,
// so once the frontier affordance reached the factor, risk and outcome tiers it
// counted three UI placeholders as part of the user's MODEL — inflating the very
// geometry it exists to measure. Derived from the product's own owner.
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const STARTERS: StarterId[] = ['vendor-selection', 'market-entry', 'build-vs-buy', 'headcount-allocation', 'pricing-model']
const VPS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 860 },
]

for (const vp of VPS) {
  for (const id of STARTERS) {
    test(`GEOM ${id} @${vp.width}x${vp.height}`, async ({ page }) => {
      await preparePage(page, vp)
      await openCanvas(page)
      await seedStarterDraft(page, id)
      await clearNotifications(page)
      await minimiseFloatingOlumiPanel(page)
      await waitForVisualQuiescence(page)

      const m = await page.evaluate((GHOST: string) => {
        const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
        const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
        const tr = vpEl ? getComputedStyle(vpEl).transform : 'none'
        let zoom = NaN
        if (tr && tr !== 'none') { const p = tr.match(/matrix\(([^)]+)\)/); if (p) zoom = parseFloat(p[1].split(',')[0]) }
        const store = (window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }> } } }).useCanvasStore.getState()
        const dims = new Map<string, { w: number; h: number }>()
        for (const el of els) dims.set(el.dataset.id!, { w: el.offsetWidth, h: el.offsetHeight })
        const box = (skipGhost: boolean) => {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0
          for (const nd of store.nodes) {
            if (skipGhost && nd.id.startsWith(GHOST)) continue
            const d = dims.get(nd.id); if (!d) continue
            n++
            x0 = Math.min(x0, nd.position.x); y0 = Math.min(y0, nd.position.y)
            x1 = Math.max(x1, nd.position.x + d.w); y1 = Math.max(y1, nd.position.y + d.h)
          }
          return { n, w: Math.round(x1 - x0), h: Math.round(y1 - y0) }
        }
        const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
        const dock = document.querySelector('aside[aria-label="Outputs dock"]')?.getBoundingClientRect()
        const side = document.querySelector('nav[aria-label="Canvas tools"]')?.getBoundingClientRect()
        const rows = new Set(store.nodes.filter(nd => !nd.id.startsWith(GHOST)).map(nd => Math.round(nd.position.y))).size
        const sig = store.nodes.map(nd => `${nd.id}@${nd.position.x},${nd.position.y}`).sort().join('|')
        return {
          zoom,
          withGhost: box(false),
          realOnly: box(true),
          rows,
          hasGhost: store.nodes.some(nd => nd.id.startsWith(GHOST)),
          pane: { w: Math.round(flow.width), h: Math.round(flow.height) },
          dockLeft: dock ? Math.round(dock.left) : null,
          sidebarRight: side ? Math.round(side.right) : null,
          sigHash: sig.length,
          sig,
        }
      }, GHOST_ID_PREFIX)
      const fitW = m.pane.w - (m.dockLeft !== null ? Math.max(0, m.pane.w - m.dockLeft) + 16 : 0) - (m.sidebarRight !== null ? m.sidebarRight + 16 : 0)
      const fitZoomReal = Math.min(fitW / m.realOnly.w, (m.pane.h - 2 * Math.floor((m.pane.h - m.pane.h / 1.08) * 0.5)) / m.realOnly.h)
      // eslint-disable-next-line no-console
      console.log(`GEOMJSON ${JSON.stringify({ id, vp: vp.width, ...m, sig: undefined, sigDigest: hash(m.sig), fitW: Math.round(fitW), fitZoomReal: Number(fitZoomReal.toFixed(4)) })}`)
      function hash(s: string): string { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 } return (h >>> 0).toString(16) }
    })
  }
}

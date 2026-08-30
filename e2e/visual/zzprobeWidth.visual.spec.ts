import { test } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS, type StarterId,
} from './harness'

const STARTERS: StarterId[] = [
  'headcount-allocation', 'headcount-allocation', 'build-vs-buy', 'vendor-selection',
  'market-entry', 'pricing-model',
]

test.describe('PROBE extent', () => {
  STARTERS.forEach((starter, i) => {
    test(`probe ${i}-${starter}`, async ({ page }) => {
      await preparePage(page, VIEWPORTS[0])
      await openCanvas(page)
      await seedStarterDraft(page, starter)
      await clearNotifications(page)
      await freezeMotion(page)
      await waitForVisualQuiescence(page)

      const r = await page.evaluate(() => {
        const w = window as unknown as { useCanvasStore: { getState: () => { nodes: { id: string; type?: string; position: { x: number; y: number } }[] } } }
        const st = w.useCanvasStore.getState()
        // rendered card size in FLOW units from computed style
        const sizes = new Map<string, { w: number; h: number }>()
        for (const n of document.querySelectorAll('.react-flow__node')) {
          const el = n as HTMLElement
          const id = el.getAttribute('data-id') ?? ''
          const card = el.querySelector('[role="group"]') as HTMLElement | null
          if (!card) continue
          const cs = getComputedStyle(card)
          sizes.set(id, { w: parseFloat(cs.width), h: parseFloat(cs.height) })
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const n of st.nodes) {
          const s = sizes.get(n.id) ?? { w: 0, h: 0 }
          minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y)
          maxX = Math.max(maxX, n.position.x + s.w); maxY = Math.max(maxY, n.position.y + s.h)
        }
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement
        const m = (vp?.style.transform ?? '').match(/scale\(([\d.]+)\)/)
        const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
        const tierCount = new Map<string, number>()
        for (const n of st.nodes) tierCount.set(n.type ?? '?', (tierCount.get(n.type ?? '?') ?? 0) + 1)
        return {
          extentW: Math.round(maxX - minX), extentH: Math.round(maxY - minY),
          zoom: m ? parseFloat(m[1]) : null,
          paneW: Math.round(pane?.width ?? 0), paneH: Math.round(pane?.height ?? 0),
          cardW: sizes.size ? [...sizes.values()][0].w : null,
          counts: Object.fromEntries(tierCount),
        }
      })
      console.log(`\n@@@ ${starter} extentW=${r.extentW} extentH=${r.extentH} zoom=${r.zoom} pane=${r.paneW}x${r.paneH} cardW=${r.cardW} counts=${JSON.stringify(r.counts)}`)
    })
  })
})

/**
 * NODE OVERLAP — a MEASUREMENT instrument for the founder-reported defect
 * "canvas nodes are visibly touching and overlapping on deployed staging".
 *
 * DECISIVE EXPERIMENT (CLAUDE.md fixture state-class rule): this file measures
 * the FRESH state-class only — a starter drafted and laid out in THIS session,
 * in real Chromium, with real measurement. If a freshly laid-out model
 * overlaps, stale persisted positions are refuted as the cause and the layout
 * itself is wrong.
 *
 * Overlap is computed in MODEL space: store positions are model coords and a
 * `.react-flow__node`'s offsetWidth/offsetHeight are unzoomed CSS px, because
 * React Flow applies zoom as a transform on the ANCESTOR viewport. So no zoom
 * arithmetic enters the comparison and the numbers are camera-independent.
 *
 * Pairs are reported BY NODE ID (CLAUDE.md: bind by identity, never by a value
 * predicate another node could satisfy).
 *
 * Run deliberately:
 *   pnpm exec playwright test -c playwright.geometry.config.ts nodeOverlap
 * Output: one `OVERLAPJSON {...}` line per cell on stdout.
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
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const STARTERS: StarterId[] = ['vendor-selection', 'market-entry', 'build-vs-buy', 'headcount-allocation', 'pricing-model']
const VPS = [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]

for (const VP of VPS) {
for (const id of STARTERS) {
  test(`OVERLAP ${id} @${VP.width}x${VP.height}`, async ({ page }) => {
    const consoleLines: string[] = []
    page.on('console', (msg) => { const t = msg.text(); if (/layout|fallback|measur/i.test(t)) consoleLines.push(msg.type() + ': ' + t.slice(0, 200)) })
    await preparePage(page, VP)
    await openCanvas(page)
    await seedStarterDraft(page, id)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const m = await page.evaluate((GHOST: string) => {
      const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => {
            nodes: Array<{
              id: string
              type?: string
              position: { x: number; y: number }
              width?: number
              height?: number
              measured?: { width?: number; height?: number }
            }>
            layoutVersion: number
          }
        }
      }
      const store = w.useCanvasStore.getState()

      // Rendered geometry, keyed by node id.
      const rendered = new Map<string, { w: number; h: number }>()
      for (const el of els) rendered.set(el.dataset.id!, { w: el.offsetWidth, h: el.offsetHeight })

      type Box = { id: string; type: string; ghost: boolean; x: number; y: number; w: number; h: number; storeH?: number; measuredH?: number }
      const boxes: Box[] = []
      for (const nd of store.nodes) {
        const r = rendered.get(nd.id)
        if (!r) continue
        boxes.push({
          id: nd.id,
          type: nd.type ?? '?',
          ghost: nd.id.startsWith(GHOST),
          x: nd.position.x,
          y: nd.position.y,
          w: r.w,
          h: r.h,
          storeH: nd.height,
          measuredH: nd.measured?.height,
        })
      }

      // Pairwise overlap in model space. Positive overlap on BOTH axes = the
      // painted cards intersect; zero on one axis = exactly touching.
      const pairs: Array<{ a: string; b: string; ox: number; oy: number; ghostInvolved: boolean }> = []
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j]
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
          const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
          if (ox > 0 && oy > 0) pairs.push({ a: A.id, b: B.id, ox: +ox.toFixed(2), oy: +oy.toFixed(2), ghostInvolved: A.ghost || B.ghost })
        }
      }
      pairs.sort((p, q) => q.ox * q.oy - p.ox * p.oy)

      // Row structure: distinct Y anchors and the pitch between them.
      const ys = [...new Set(boxes.filter(b => !b.ghost).map(b => Math.round(b.y)))].sort((a, b) => a - b)
      const pitches = ys.slice(1).map((y, i) => y - ys[i])
      const rows = ys.map(y => ({
        y,
        heights: boxes.filter(b => !b.ghost && Math.round(b.y) === y).map(b => +b.h.toFixed(1)),
      }))

      return {
        layoutVersion: store.layoutVersion,
        nodeCount: boxes.length,
        ghostCount: boxes.filter(b => b.ghost).length,
        overlapPairs: pairs.length,
        overlapPairsNoGhost: pairs.filter(p => !p.ghostInvolved).length,
        worst: pairs.slice(0, 6),
        ys,
        pitches,
        rows,
        // What the layout SAW vs what rendered — the tell for a stale size map.
        sizeSample: boxes.filter(b => !b.ghost).slice(0, 8).map(b => ({ id: b.id, renderedH: +b.h.toFixed(1), storeH: b.storeH, measuredH: b.measuredH })),
      }
    }, GHOST_ID_PREFIX)

    // eslint-disable-next-line no-console
    console.log('OVERLAPJSON ' + JSON.stringify({ starter: id, vp: `${VP.width}x${VP.height}`, ...m, consoleLines: consoleLines.slice(0, 6) }))
  })
}
}

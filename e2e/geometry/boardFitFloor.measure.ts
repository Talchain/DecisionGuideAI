/**
 * BOARD EXTENT vs THE LEGIBILITY FLOOR — a MEASUREMENT instrument, not a gate.
 *
 * Question: what is each shipped starter's canonical board extent, and what fit
 * zoom does that extent force at the two pane widths the product actually
 * presents (dock closed / dock open)? The floor that matters is
 * `LABEL_LEGIBLE_ZOOM` (0.50) — below it `resolveLodRung` returns `'line'` and
 * every card body is hidden.
 *
 * ⚠ RUN IT DELIBERATELY, it is in no gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/boardFitFloor.measure.ts
 *
 * ⭐ WHY THE PANE SIZES ARE ARITHMETIC AND THE EXTENT IS MEASURED.
 * Founder ruling R1 makes the canonical layout a function of
 * `CANONICAL_LAYOUT_WIDTH` alone — `layoutGraph` takes no size — so the board
 * extent does not move with the viewport and one browser measurement per
 * starter is the whole truth about it. The pane widths, by contrast, are a
 * presentation fact (dock open vs closed), so the fits at the two REFERENCE
 * PANES are derived from the one measured extent. That keeps the comparison
 * free of window-chrome noise, and the measured pane is reported alongside so
 * the reference panes can be checked against a real one.
 *
 * ⭐ NON-VACUITY, asserted rather than assumed (CLAUDE.md trap 13): every cell
 * asserts a non-zero node count and a finite extent before any ratio is
 * printed. A starter that failed to seed would otherwise print a clean
 * `Infinity` that reads like a number.
 *
 * Output: one `FITJSON {...}` line per starter on stdout.
 */
import { test, expect } from '@playwright/test'
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
import { LABEL_LEGIBLE_ZOOM, resolveLodRung } from '../../src/canvas/utils/zoomLegibility'

const STARTERS: StarterId[] = [
  'vendor-selection',
  'market-entry',
  'build-vs-buy',
  'headcount-allocation',
  'pricing-model',
]

/**
 * The two panes the brief names, in CSS px. Not measured here: they are the
 * REFERENCE the before/after table is stated against, so that a change in
 * window chrome cannot move the reported fit. The measured pane is printed in
 * the same record for corroboration.
 */
const REFERENCE_PANES = [
  { name: 'dock-closed', w: 1520, h: 1080 },
  { name: 'dock-open', w: 1080, h: 1080 },
] as const

const VIEWPORT = { width: 1600, height: 1150 }

for (const id of STARTERS) {
  test(`FIT ${id}`, async ({ page }) => {
    await preparePage(page, VIEWPORT)
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, id)
    expect(seeded.nodeCount, `${id}: nothing seeded — every ratio below would be vacuous`).toBeGreaterThan(0)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const m = await page.evaluate((GHOST: string) => {
      const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
      const dims = new Map<string, { w: number; h: number }>()
      for (const el of els) dims.set(el.dataset.id!, { w: el.offsetWidth, h: el.offsetHeight })

      const store = (
        window as unknown as {
          useCanvasStore: {
            getState: () => { nodes: Array<{ id: string; position: { x: number; y: number }; data?: { kind?: string } }> }
          }
        }
      ).useCanvasStore.getState()

      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      let n = 0
      const rowYs = new Set<number>()
      const tierWidest = new Map<number, number>()
      for (const nd of store.nodes) {
        if (nd.id.startsWith(GHOST)) continue
        const d = dims.get(nd.id)
        if (!d) continue
        n++
        x0 = Math.min(x0, nd.position.x)
        y0 = Math.min(y0, nd.position.y)
        x1 = Math.max(x1, nd.position.x + d.w)
        y1 = Math.max(y1, nd.position.y + d.h)
        const ry = Math.round(nd.position.y)
        rowYs.add(ry)
        tierWidest.set(ry, (tierWidest.get(ry) ?? 0) + 1)
      }

      const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
      const tr = vpEl ? getComputedStyle(vpEl).transform : 'none'
      let zoom = NaN
      if (tr && tr !== 'none') {
        const p = tr.match(/matrix\(([^)]+)\)/)
        if (p) zoom = parseFloat(p[1].split(',')[0])
      }

      const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
      const dock = document.querySelector('aside[aria-label="Outputs dock"]')?.getBoundingClientRect()
      const side = document.querySelector('nav[aria-label="Canvas tools"]')?.getBoundingClientRect()

      /** Widest row occupancy — the row-packing input the gap lever acts on. */
      const widestRow = Math.max(...[...tierWidest.values()])
      const rows = [...rowYs].sort((a, b) => a - b)

      /**
       * PER-ROW, so a VERTICAL lever can be priced against the thing that
       * actually consumes the height. Each entry: the row's Y, how many nodes
       * sit on it, the tallest rendered card, and the gap to the next row's top
       * MINUS that tallest card — i.e. the inter-tier whitespace the layer gap
       * is supposed to govern.
       */
      const rowDetail = rows.map((ry, i) => {
        const on = store.nodes.filter((nd) => !nd.id.startsWith(GHOST) && Math.round(nd.position.y) === ry)
        const heights = on.map((nd) => dims.get(nd.id)?.h ?? 0)
        const tallest = Math.max(0, ...heights)
        const next = rows[i + 1]
        return {
          y: ry,
          count: on.length,
          tallest,
          strideToNext: next === undefined ? null : next - ry,
          whitespaceToNext: next === undefined ? null : next - ry - tallest,
          tallestId: on[heights.indexOf(tallest)]?.id ?? null,
        }
      })

      /**
       * THE RENDERED HORIZONTAL GAP between adjacent cards on the widest row —
       * in LAYOUT UNITS, from store positions and rendered widths. This is the
       * number the "two max-width cards read as separate objects" design
       * decision is about, and it is NOT `LAYOUT_NODE_GAP`: the ELK box carries
       * `LAYOUT_PADDING_X` that the card does not occupy, so the two differ.
       */
      const widestY = rowDetail.reduce((a, b) => (b.count > a.count ? b : a), rowDetail[0]).y
      const onWidest = store.nodes
        .filter((nd) => !nd.id.startsWith(GHOST) && Math.round(nd.position.y) === widestY)
        .sort((a, b) => a.position.x - b.position.x)
      const renderedGaps: number[] = []
      for (let i = 1; i < onWidest.length; i++) {
        const prev = onWidest[i - 1]
        const prevW = dims.get(prev.id)?.w ?? 0
        renderedGaps.push(Math.round(onWidest[i].position.x - (prev.position.x + prevW)))
      }
      const strides: number[] = []
      for (let i = 1; i < onWidest.length; i++) strides.push(Math.round(onWidest[i].position.x - onWidest[i - 1].position.x))

      return {
        nodes: n,
        boardW: Math.round(x1 - x0),
        boardH: Math.round(y1 - y0),
        rowCount: rows.length,
        rowDetail,
        renderedGaps,
        strides,
        widestRow,
        settledZoom: Number.isFinite(zoom) ? Number(zoom.toFixed(4)) : null,
        measuredPane: { w: Math.round(flow.width), h: Math.round(flow.height) },
        dockWidth: dock ? Math.round(dock.width) : 0,
        sidebarRight: side ? Math.round(side.right) : null,
        cardW: Math.max(...[...dims.values()].map((d) => d.w)),
      }
    }, GHOST_ID_PREFIX)

    expect(m.nodes, `${id}: zero measurable nodes`).toBeGreaterThan(0)
    expect(Number.isFinite(m.boardW) && m.boardW > 0, `${id}: board width not finite`).toBe(true)
    expect(Number.isFinite(m.boardH) && m.boardH > 0, `${id}: board height not finite`).toBe(true)

    const fits: Record<string, unknown> = {}
    for (const pane of REFERENCE_PANES) {
      const byW = pane.w / m.boardW
      const byH = pane.h / m.boardH
      const fit = Math.min(byW, byH)
      fits[pane.name] = {
        fit: Number(fit.toFixed(4)),
        byW: Number(byW.toFixed(4)),
        byH: Number(byH.toFixed(4)),
        binds: byW <= byH ? 'width' : 'height',
        clearsFloor: fit >= LABEL_LEGIBLE_ZOOM,
        rung: resolveLodRung(fit),
      }
    }

    // eslint-disable-next-line no-console
    console.log(`FITJSON ${JSON.stringify({ id, ...m, floor: LABEL_LEGIBLE_ZOOM, fits })}`)
  })
}

/**
 * WHAT IS ACTUALLY IN THE GAP — a MEASUREMENT instrument, not a gate.
 *
 * `boardFitFloor.measure.ts` established that the RENDERED separation between
 * two adjacent cards is 56 layout units horizontally and 88 vertically, while
 * the named constants are `LAYOUT_NODE_GAP = 32` and `LAYOUT_LAYER_GAP = 72`.
 * The difference in each case is `LAYOUT_PADDING_X = 24` / `LAYOUT_PADDING_Y =
 * 16` — the padding that turns a card into an ELK box.
 *
 * Before any lever touches either, this asks the question that decides whether
 * the padding is SURPLUS or LOAD-BEARING:
 *
 *   1. Does anything a node renders paint OUTSIDE the node element's own box?
 *      If quick-action controls, provenance marks or handles overhang, the
 *      horizontal padding is holding them off the neighbour and cutting it
 *      causes occlusion.
 *   2. What occupies the vertical whitespace between two tiers? Edge labels
 *      sit there. If a label is taller than the whitespace a lever would leave,
 *      cutting it causes overlap.
 *
 * ⚠ RUN IT DELIBERATELY:
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/boardGapOccupancy.measure.ts
 *
 * ⭐ THE PROBE CARRIES A CONTRAST CONTROL. "Nothing overhangs" is an ABSENCE
 * claim, and an absence probe with no positive control is vacuous (CLAUDE.md
 * trap 13). So the same pass also reports the overhang of the React Flow HANDLE
 * elements, which are known to be positioned on the card's edge and therefore
 * MUST register a non-zero overhang. Target zero + contrast zero means the
 * probe is blind and the run reports nothing.
 *
 * Output: one `GAPJSON {...}` line per starter on stdout.
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

const STARTERS: StarterId[] = [
  'vendor-selection',
  'market-entry',
  'build-vs-buy',
  'headcount-allocation',
  'pricing-model',
]

const VIEWPORT = { width: 1600, height: 1150 }

for (const id of STARTERS) {
  test(`GAP ${id}`, async ({ page }) => {
    await preparePage(page, VIEWPORT)
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, id)
    expect(seeded.nodeCount).toBeGreaterThan(0)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const m = await page.evaluate((GHOST: string) => {
      const nodeEls = [...document.querySelectorAll('.react-flow__node[data-id]')].filter(
        (el) => !(el as HTMLElement).dataset.id!.startsWith(GHOST),
      ) as HTMLElement[]

      const zoomOf = () => {
        const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
        const tr = vpEl ? getComputedStyle(vpEl).transform : 'none'
        if (!tr || tr === 'none') return NaN
        const p = tr.match(/matrix\(([^)]+)\)/)
        return p ? parseFloat(p[1].split(',')[0]) : NaN
      }
      const zoom = zoomOf()

      /**
       * Overhang of a descendant beyond its node's own border box, in LAYOUT
       * units (screen px divided by the live zoom, so the number is comparable
       * with the layout constants).
       */
      const overhangOf = (root: HTMLElement, selector: string | null) => {
        const nodeR = root.getBoundingClientRect()
        const kids = selector
          ? ([...root.querySelectorAll(selector)] as HTMLElement[])
          : ([...root.querySelectorAll('*')] as HTMLElement[])
        let left = 0
        let right = 0
        let top = 0
        let bottom = 0
        for (const k of kids) {
          const r = k.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          left = Math.max(left, nodeR.left - r.left)
          right = Math.max(right, r.right - nodeR.right)
          top = Math.max(top, nodeR.top - r.top)
          bottom = Math.max(bottom, r.bottom - nodeR.bottom)
        }
        const u = (v: number) => Math.round((v / zoom) * 10) / 10
        return { left: u(left), right: u(right), top: u(top), bottom: u(bottom) }
      }

      let allLeft = 0
      let allRight = 0
      let allTop = 0
      let allBottom = 0
      let handleLeft = 0
      let handleRight = 0
      let handleTop = 0
      let handleBottom = 0
      let worstId: string | null = null
      let worstH = -1
      for (const el of nodeEls) {
        // TARGET: everything the node renders, handles EXCLUDED, because the
        // question is whether CONTENT needs the padding.
        const nodeR = el.getBoundingClientRect()
        const kids = [...el.querySelectorAll('*')].filter(
          (k) => !(k as HTMLElement).classList.contains('react-flow__handle'),
        ) as HTMLElement[]
        for (const k of kids) {
          const r = k.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          const l = nodeR.left - r.left
          const rt = r.right - nodeR.right
          allLeft = Math.max(allLeft, l)
          allRight = Math.max(allRight, rt)
          allTop = Math.max(allTop, nodeR.top - r.top)
          allBottom = Math.max(allBottom, r.bottom - nodeR.bottom)
          if (Math.max(l, rt) > worstH) {
            worstH = Math.max(l, rt)
            worstId = el.dataset.id ?? null
          }
        }
        // CONTRAST CONTROL: the handles, which are positioned on the card edge
        // and must therefore register a non-zero overhang. If this reads zero
        // the probe cannot see overhang at all and the target zero means
        // nothing.
        const h = overhangOf(el, '.react-flow__handle')
        handleLeft = Math.max(handleLeft, h.left)
        handleRight = Math.max(handleRight, h.right)
        handleTop = Math.max(handleTop, h.top)
        handleBottom = Math.max(handleBottom, h.bottom)
      }

      const u = (v: number) => Math.round((v / zoom) * 10) / 10

      /** Edge labels — what sits in the vertical whitespace between tiers. */
      const labelEls = [...document.querySelectorAll('.react-flow__edge-textwrapper, .react-flow__edgelabel-renderer > *')] as HTMLElement[]
      const labelSizes = labelEls
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ w: u(r.width), h: u(r.height) }))
      const tallestLabel = labelSizes.length ? Math.max(...labelSizes.map((s) => s.h)) : 0
      const widestLabel = labelSizes.length ? Math.max(...labelSizes.map((s) => s.w)) : 0

      return {
        zoom: Number(zoom.toFixed(4)),
        nodeCount: nodeEls.length,
        contentOverhang: { left: u(allLeft), right: u(allRight), top: u(allTop), bottom: u(allBottom) },
        worstContentOverhangId: worstId,
        handleOverhang: { left: handleLeft, right: handleRight, top: handleTop, bottom: handleBottom },
        edgeLabels: { count: labelSizes.length, tallest: tallestLabel, widest: widestLabel },
      }
    }, GHOST_ID_PREFIX)

    expect(m.nodeCount, `${id}: no nodes to measure`).toBeGreaterThan(0)

    // eslint-disable-next-line no-console
    console.log(`GAPJSON ${JSON.stringify({ id, ...m })}`)
  })
}

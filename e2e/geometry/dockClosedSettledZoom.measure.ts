/**
 * THE PRODUCT'S OWN CAMERA WITH THE DOCK COLLAPSED — a MEASUREMENT instrument.
 *
 * `boardFitFloor.measure.ts` reports the fit a board's EXTENT forces against a
 * reference pane. That is the right number for comparing geometry, and it is
 * NOT the number a user sees: the product fits against `computeFitPadding`'s
 * frame, which reserves the tools rail, the overlay band and the dock — so the
 * real camera is always below the extent ratio.
 *
 * This measures what the product actually does, in the state the spacing change
 * is FOR: dock collapsed, then the product's own "Show whole model" affordance,
 * then the settled transform read off the DOM rather than derived.
 *
 * ⚠ RUN IT DELIBERATELY:
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/dockClosedSettledZoom.measure.ts
 *
 * ⭐ THE PRECONDITION IS PINNED IN-TEST. "The dock is collapsed" is asserted by
 * MEASURING the dock's width after the click, not by trusting that the click
 * landed — a toggle that silently no-ops would otherwise be reported as a
 * dock-closed result taken with the dock open (CLAUDE.md trap 13b).
 *
 * Output: one `DOCKJSON {...}` line per starter on stdout.
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

const VIEWPORT = { width: 1600, height: 1150 }

async function readState(page: import('@playwright/test').Page, ghost: string) {
  return page.evaluate(async (GHOST: string) => {
    /**
     * ⭐ THE PRODUCT'S OWN `computeFitPadding`, CALLED — not reproduced.
     * `showWholeModelDockBudget.measure.ts` reproduces the formula and carries
     * two documented divergences it has to keep re-justifying; resolving the
     * real module through Vite's dev graph removes the mirror entirely
     * (CLAUDE.md trap 12). The path is held in a variable because a literal is
     * a TS2307 — it exists only as a dev-server URL.
     */
    const fitPaddingPath = '/src/canvas/utils/computeFitPadding.ts'
    const fitMod = (await import(/* @vite-ignore */ fitPaddingPath)) as {
      computeFitPadding: (el?: Element | null) => Record<'top' | 'right' | 'bottom' | 'left', string>
    }
    const flowEl = document.querySelector('.react-flow')
    const rawPadding = fitMod.computeFitPadding(flowEl)
    // ⚠ IT RETURNS `'<n>px'` STRINGS, not numbers — xyflow's `PaddingWithUnit`.
    // A first cut of this probe subtracted the strings and reported a frame of
    // `null` on every cell; that it was NULL rather than plausible is luck, and
    // is why the parse is asserted below rather than assumed.
    const px = (v: string) => Number.parseFloat(v)
    const padding = {
      top: px(rawPadding.top),
      right: px(rawPadding.right),
      bottom: px(rawPadding.bottom),
      left: px(rawPadding.left),
    }
    if (!Object.values(padding).every((n) => Number.isFinite(n))) {
      throw new Error(`instrument: computeFitPadding returned ${JSON.stringify(rawPadding)}`)
    }

    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const tr = vpEl ? getComputedStyle(vpEl).transform : 'none'
    let zoom = NaN
    if (tr && tr !== 'none') {
      const p = tr.match(/matrix\(([^)]+)\)/)
      if (p) zoom = parseFloat(p[1].split(',')[0])
    }
    const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
    const dims = new Map<string, { w: number; h: number }>()
    for (const el of els) dims.set(el.dataset.id!, { w: el.offsetWidth, h: el.offsetHeight })
    const store = (
      window as unknown as {
        useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }> } }
      }
    ).useCanvasStore.getState()
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const nd of store.nodes) {
      if (nd.id.startsWith(GHOST)) continue
      const d = dims.get(nd.id)
      if (!d) continue
      x0 = Math.min(x0, nd.position.x)
      y0 = Math.min(y0, nd.position.y)
      x1 = Math.max(x1, nd.position.x + d.w)
      y1 = Math.max(y1, nd.position.y + d.h)
    }
    const rectOf = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    }
    const dock = rectOf('aside[aria-label="Outputs dock"]')
    const sidebar = rectOf('nav[aria-label="Canvas tools"]')
    const banner = rectOf('[role="banner"]')
    const band = rectOf('[data-canvas-overlay-band]')
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()

    /**
     * ⭐ THE OUTCOME METRIC, and it is NOT the fit ratio. The camera is clamped
     * at the legibility floor either way, so what a spacing change actually
     * buys is HOW MUCH OF THE MODEL SITS INSIDE THE VISIBLE CANVAS at that
     * clamp. The predicate is `showWholeModelDockBudget.measure.ts`'s
     * `outsideVisible`, reused verbatim rather than reinvented, and bound BY
     * NODE ID rather than by an x-threshold (CLAUDE.md trap 19).
     */
    const outsideVisible = (
      [...document.querySelectorAll('.react-flow__node')] as HTMLElement[]
    )
      .map((el) => ({ id: el.getAttribute('data-id') ?? '', r: el.getBoundingClientRect() }))
      .filter((n) => !n.id.startsWith(GHOST))
      .filter(
        (n) =>
          n.r.left < (sidebar ? sidebar.right : flow.left) ||
          n.r.right > (dock ? dock.left : flow.right) ||
          n.r.top < (banner ? banner.bottom : flow.top) ||
          n.r.bottom > (band ? band.top : flow.bottom),
      )
      .map((n) => n.id)
      .sort()

    const modelNodeCount = ([...document.querySelectorAll('.react-flow__node')] as HTMLElement[]).filter(
      (el) => !(el.getAttribute('data-id') ?? '').startsWith(GHOST),
    ).length

    /**
     * THE FRAME THE PRODUCT ACTUALLY FITS INTO — the pane minus the padding
     * the product's own function reserves. This is the number a user's camera
     * is computed against, and it is SMALLER than either reference pane,
     * because the padding reserves the tools rail, the top banner, the overlay
     * band AND the collapsed dock rail.
     */
    const frame = {
      w: Math.round(flow.width - padding.left - padding.right),
      h: Math.round(flow.height - padding.top - padding.bottom),
    }

    return {
      zoom: Number.isFinite(zoom) ? Number(zoom.toFixed(4)) : null,
      dockWidth: dock ? Math.round(dock.width) : 0,
      pane: { w: Math.round(flow.width), h: Math.round(flow.height) },
      padding,
      frame,
      board: { w: Math.round(x1 - x0), h: Math.round(y1 - y0) },
      modelNodeCount,
      outsideVisible,
    }
  }, ghost)
}

for (const id of STARTERS) {
  test(`DOCKCLOSED ${id}`, async ({ page }) => {
    await preparePage(page, VIEWPORT)
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, id)
    expect(seeded.nodeCount).toBeGreaterThan(0)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const withDock = await readState(page, GHOST_ID_PREFIX)
    // Precondition for the CONTRAST: the dock must start expanded, or
    // "collapsing it changed the camera" is a claim about nothing.
    expect(withDock.dockWidth, `${id}: dock did not start expanded`).toBeGreaterThan(300)

    const collapse = page.getByRole('button', { name: 'Collapse outputs dock' })
    expect(await collapse.count(), `${id}: no collapse control`).toBeGreaterThan(0)
    await collapse.first().click()
    await waitForVisualQuiescence(page)

    const collapsed = await readState(page, GHOST_ID_PREFIX)
    // The precondition ASSERTED, not assumed: the toggle actually landed.
    expect(collapsed.dockWidth, `${id}: dock still expanded after the click`).toBeLessThan(120)

    // The product's own whole-model affordance, if it is offering one.
    const showAll = page.locator('[data-testid="model-extent-show-all"]')
    const hasShowAll = (await showAll.count()) > 0
    if (hasShowAll) {
      await showAll.first().click()
      await waitForVisualQuiescence(page)
    }
    const after = await readState(page, GHOST_ID_PREFIX)

    // eslint-disable-next-line no-console
    console.log(
      `DOCKJSON ${JSON.stringify({
        id,
        board: after.board,
        pane: after.pane,
        frameDockOpen: withDock.frame,
        frameDockClosed: after.frame,
        fitInFrameDockOpen: Number(
          Math.min(withDock.frame.w / after.board.w, withDock.frame.h / after.board.h).toFixed(4),
        ),
        fitInFrameDockClosed: Number(
          Math.min(after.frame.w / after.board.w, after.frame.h / after.board.h).toFixed(4),
        ),
        dockExpandedZoom: withDock.zoom,
        dockCollapsedZoom: collapsed.zoom,
        offeredShowWholeModel: hasShowAll,
        modelNodes: after.modelNodeCount,
        outsideVisibleDockOpen: withDock.outsideVisible.length,
        outsideVisibleDockClosed: after.outsideVisible.length,
        outsideVisibleDockClosedIds: after.outsideVisible,
        finalZoom: after.zoom,
        finalRung: after.zoom === null ? null : resolveLodRung(after.zoom),
        clearsFloor: after.zoom !== null && after.zoom >= LABEL_LEGIBLE_ZOOM,
        dockWidthAfter: after.dockWidth,
        floor: LABEL_LEGIBLE_ZOOM,
      })}`,
    )
  })
}

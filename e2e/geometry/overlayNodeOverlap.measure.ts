/**
 * OVERLAYNODEOVERLAP — does any canvas overlay cover a node, or another overlay?
 *
 * THE FOUNDER'S RULE, MEASURED: *one slot, one occupant, never over a node.*
 *
 * ⭐ THE BEFORE-PICTURE IS CI-RENDERED, NOT INFERRED. The reference capture at
 * staging `f59ffc26` (`e2e/visual/references/linux/fresh-draft--1280x800.png`)
 * shows both halves of the report: the first-model notice drawn across the
 * decision node so only "Us… / Bi… / To…" of its title is readable, and
 * "Showing 9 of 19 elements" with its "Show whole model" button clipped by the
 * minimised Olumi pill. This measure is the same question asked in numbers, so
 * the fix can be shown rather than asserted.
 *
 * Run it at the merge base and at the tip:
 *
 *   GEOMETRY_PORT=5391 pnpm exec playwright test -c playwright.geometry.config.ts --grep OVERLAP
 *
 * ⚠ THE PILL IS COUNTED AS AN OVERLAY, and that is the point of half of this.
 * `floating-olumi-panel-pill` is `position: fixed` and NOT user-movable — it
 * docks to the bottom-right corner derived from the viewport and the dock inset
 * — so it lands in a known place, inside the band's vertical range. An overlay
 * band that did not reserve that corner would move the notices to the bottom
 * and REPRODUCE the truncation at a new address. Counting the pill is what
 * makes that visible instead of merely believed.
 *
 * ⚠ VACUITY IS REPORTED, NEVER SWALLOWED (trap 13). "Zero overlaps" is exactly
 * what a run with no overlays on screen also produces, and that is the failure
 * mode this whole class of measurement dies of. Every reading carries
 * `overlaysVisible`, and the assertion refuses to pass on a run that saw none.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  preparePage,
  openCanvas,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  freezeMotion,
  VIEWPORTS,
  type StarterId,
} from '../visual/harness'

const STARTERS: StarterId[] = [
  'vendor-selection',
  'market-entry',
  'build-vs-buy',
  'headcount-allocation',
  'pricing-model',
]

/**
 * Every overlay that can draw over the canvas, by testid. The band's occupants
 * plus the minimised pill they must not collide with.
 */
const OVERLAY_TESTIDS = [
  'starter-provenance-banner',
  'first-model-notice',
  'model-extent-notice',
  'canvas-lod-notice',
  'assistant-focus-chip',
  'focus-mode-chip',
  'lens-info-panel',
  'floating-olumi-panel-pill',
]

/**
 * ⚠ COPIED, NOT IMPORTED — `assertPaneCanRenderGeometry` is private to
 * `ghostDoorVisibility.measure.ts`. A HIDDEN PANE VOIDS EVERY GEOMETRY CLAIM:
 * `innerWidth` reads 0, rAF never fires, React Flow never measures, and
 * screenshots still paint, so the run looks fine and every rect is a lie.
 *
 * Note which checks discriminate. A synthetic element with an explicit width
 * and height reports a NON-ZERO rect even in a dead pane, so rect-measurability
 * is a control that CANNOT FAIL. The discriminators are rAF actually firing and
 * `innerWidth !== 0`. This fails hard rather than skipping, deliberately.
 */
async function assertPaneCanRenderGeometry(page: Page): Promise<void> {
  const reading = await page.evaluate(async () => {
    const w = window as unknown as {
      __pwClock?: { builtins?: { requestAnimationFrame?: typeof requestAnimationFrame; setTimeout?: typeof setTimeout } }
    }
    // `page.clock.setFixedTime` replaces both window functions with ONE faked
    // dispatcher, so the window pair are two entries on the same queue and
    // cannot race each other. Prefer the saved builtins.
    const raf = w.__pwClock?.builtins?.requestAnimationFrame ?? window.requestAnimationFrame
    const timer = w.__pwClock?.builtins?.setTimeout ?? window.setTimeout
    const usedBuiltins = Boolean(w.__pwClock?.builtins?.requestAnimationFrame)
    const windowRafIsNative = /\[native code\]/.test(String(window.requestAnimationFrame))

    const rafFired = await new Promise<boolean>((resolve) => {
      let settled = false
      raf.call(window, () => { if (!settled) { settled = true; resolve(true) } })
      timer.call(window, () => { if (!settled) { settled = true; resolve(false) } }, 3000)
    })

    const flow = document.querySelector('.react-flow') as HTMLElement | null
    return {
      usedBuiltins,
      windowRafIsNative,
      rafFired,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      clientW: flow?.clientWidth ?? 0,
      clientH: flow?.clientHeight ?? 0,
    }
  })

  expect(
    reading.usedBuiltins || reading.windowRafIsNative,
    'neither rAF channel can be shown real — the rAF check below would prove nothing',
  ).toBe(true)
  expect(reading.innerW * reading.innerH, 'the pane has zero viewport — geometry is void').toBeGreaterThan(0)
  expect(reading.clientW * reading.clientH, '.react-flow has zero size — geometry is void').toBeGreaterThan(0)
  expect(reading.rafFired, 'rAF never fired — the pane is not rendering; every rect is a lie').toBe(true)
}

/** Poll the flow transform until it stops changing, so the fit has settled. */
async function cameraSettled(page: Page, timeoutMs = 12_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let last = ''
  let stable = 0
  while (Date.now() < deadline) {
    const t = await page.evaluate(() => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
      return vp ? getComputedStyle(vp).transform : ''
    })
    if (t && t === last) {
      stable += 1
      if (stable >= 5) return
    } else {
      stable = 0
      last = t
    }
    await page.waitForTimeout(50)
  }
}

interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }
interface Reading {
  overlays: Array<{ id: string; rect: Rect }>
  nodesMeasured: number
  overlayNodeHits: Array<{ overlay: string; node: string; area: number }>
  overlayOverlayHits: Array<{ a: string; b: string; area: number }>
  paneW: number
  paneH: number
  bandTop: number | null
  lowestNodeBottom: number
  effectiveBottomInset: number | null
}

async function measure(page: Page, testids: string[]): Promise<Reading> {
  return page.evaluate((ids) => {
    const vis = (el: Element): boolean => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return false
      const cs = getComputedStyle(el as HTMLElement)
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.01
    }
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    }
    const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      return w > 0 && h > 0 ? w * h : 0
    }

    const overlays: Array<{ id: string; rect: ReturnType<typeof box> }> = []
    for (const id of ids) {
      const el = document.querySelector(`[data-testid="${id}"]`)
      if (el && vis(el)) overlays.push({ id, rect: box(el) })
    }

    // Model nodes only. `__ghost-` entries are structural placeholders, not
    // things a person reads, so covering one is not the reported harm.
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')).filter((n) => {
      const id = (n as HTMLElement).dataset.id ?? ''
      return !id.startsWith('__ghost-') && vis(n)
    })

    const overlayNodeHits: Array<{ overlay: string; node: string; area: number }> = []
    for (const o of overlays) {
      for (const n of nodes) {
        const area = overlap(o.rect, box(n))
        if (area > 0) overlayNodeHits.push({ overlay: o.id, node: (n as HTMLElement).dataset.id ?? '?', area: Math.round(area) })
      }
    }

    const overlayOverlayHits: Array<{ a: string; b: string; area: number }> = []
    for (let i = 0; i < overlays.length; i += 1) {
      for (let j = i + 1; j < overlays.length; j += 1) {
        const area = overlap(overlays[i].rect, overlays[j].rect)
        if (area > 0) overlayOverlayHits.push({ a: overlays[i].id, b: overlays[j].id, area: Math.round(area) })
      }
    }

    const flow = document.querySelector('.react-flow') as HTMLElement | null
    // Diagnostic, not an assertion: is the band actually in the DOM at measure
    // time, and where did the fit leave the lowest node? Together these say
    // whether a bottom overlap is the band failing to reserve, or the product's
    // fit never having run with the reservation (the mount-`fitView`-prop path
    // `useFitViewOnLayoutVersion` documents).
    const bandEl = document.querySelector('[data-canvas-overlay-band]')
    const band = bandEl ? box(bandEl) : null
    const flowBox = flow ? box(flow) : null
    let lowestNodeBottom = 0
    for (const n of nodes) lowestNodeBottom = Math.max(lowestNodeBottom, box(n).bottom)

    return {
      overlays,
      nodesMeasured: nodes.length,
      overlayNodeHits,
      overlayOverlayHits,
      paneW: flow?.clientWidth ?? 0,
      paneH: flow?.clientHeight ?? 0,
      bandTop: band ? Math.round(band.top) : null,
      lowestNodeBottom: Math.round(lowestNodeBottom),
      effectiveBottomInset: flowBox ? Math.round(flowBox.bottom - lowestNodeBottom) : null,
    }
  }, testids)
}

for (const viewport of VIEWPORTS) {
  for (const starter of STARTERS) {
    test(`OVERLAP ${starter} @ ${viewport.name}`, async ({ page }) => {
      await preparePage(page, viewport)
      await openCanvas(page)
      await assertPaneCanRenderGeometry(page)

      const seeded = await seedStarterDraft(page, starter)
      expect(seeded.nodeCount, 'nothing was seeded — the run would measure an empty canvas').toBeGreaterThan(0)

      await clearNotifications(page)
      // Produces the minimised pill, which is the state the reference capture
      // was taken in and the one where the truncation was reported.
      await minimiseFloatingOlumiPanel(page)
      await freezeMotion(page)
      await waitForVisualQuiescence(page)
      await cameraSettled(page)

      const r = await measure(page, OVERLAY_TESTIDS)

      console.log(
        `OVERLAPJSON ${JSON.stringify({
          starter,
          viewport: viewport.name,
          overlaysVisible: r.overlays.map((o) => ({
            id: o.id,
            h: Math.round(o.rect.height),
            w: Math.round(o.rect.width),
            top: Math.round(o.rect.top),
            bottom: Math.round(o.rect.bottom),
          })),
          nodesMeasured: r.nodesMeasured,
          overlayNodeHits: r.overlayNodeHits,
          overlayOverlayHits: r.overlayOverlayHits,
          paneW: r.paneW,
          paneH: r.paneH,
          bandTop: r.bandTop,
          lowestNodeBottom: r.lowestNodeBottom,
          effectiveBottomInset: r.effectiveBottomInset,
        })}`,
      )

      // ── vacuity gate ──────────────────────────────────────────────────────
      // A run that saw no overlays produces the same two zeros as a perfect
      // one. Refuse to score it either way.
      expect(r.nodesMeasured, 'no model nodes were measured — the reading is vacuous').toBeGreaterThan(0)
      expect(
        r.overlays.length,
        'NO OVERLAY WAS VISIBLE — "zero overlaps" here is vacuous, not a pass. ' +
          'Expect at least the minimised Olumi pill in this state.',
      ).toBeGreaterThan(0)

      // ── the founder's rule ────────────────────────────────────────────────
      expect(
        r.overlayNodeHits,
        `an overlay is drawn over a model node: ${JSON.stringify(r.overlayNodeHits)}`,
      ).toEqual([])
      expect(
        r.overlayOverlayHits,
        `two overlays occupy the same space: ${JSON.stringify(r.overlayOverlayHits)}`,
      ).toEqual([])
    })
  }
}

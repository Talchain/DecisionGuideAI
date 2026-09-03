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

      // ⚠⚠ `asStarter` IS LOAD-BEARING, AND ITS ABSENCE MADE THIS MEASURE BLIND
      // TO ITS OWN SUBJECT. Seeding via `applyDraftResult` alone never stamps
      // `starterId`, so `StarterProvenanceBanner` — the component whose
      // `fixed top-[72px]` IS the motivating defect, drawn over the decision
      // node's title — did not mount in a single capture at any tip. The
      // measure was reporting "no overlay covers the decision node" about a
      // corpus that did not contain the overlay in question.
      //
      // It also changes the bottom-centre winner: unstamped, the banner is
      // absent and a lower-priority notice occupies the cell, so the rects here
      // were a different element's. Both facts were found by review, not by
      // this file, which is why the mode is now asserted inside the harness
      // rather than trusted.
      const seeded = await seedStarterDraft(page, starter, { asStarter: true })
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

      // ── ONE SLOT, ONE OCCUPANT ────────────────────────────────────────────
      // Directly the founder's second complaint: "Showing 9 of 19 elements"
      // and its "Show whole model" button clipped by the Olumi pill. Measured
      // at the merge base in 5 of these 10 cases, always the same pair
      // (model-extent-notice x floating-olumi-panel-pill). Zero is achievable
      // here and is asserted strictly.
      expect(
        r.overlayOverlayHits,
        `two overlays occupy the same space: ${JSON.stringify(r.overlayOverlayHits)}`,
      ).toEqual([])

      // ── AN OCCUPANT MUST FIT INSIDE THE BAND ──────────────────────────────
      // The band reserves a FIXED height and its cells align to the bottom, so
      // an occupant taller than the band grows UPWARD, out of the reserved area
      // and back over the canvas — reintroducing exactly the defect this change
      // removes, with every unit test still green. Measured here because
      // wrapped text is a rendering fact, not something jsdom can see.
      //
      // ⚠ 64 IS RESTATED HERE, NOT IMPORTED — AND THAT IS A MEASURED CHOICE,
      // NOT LAZINESS. Importing `OVERLAY_BAND_HEIGHT` from the component pulls
      // `CanvasOverlayBand.tsx` (and through `FloatingOlumiPanel`, most of the
      // React app) into `tsconfig.tooling.json`, which compiles this file:
      // measured at +168 diagnostics and a typecheck-ratchet RED in
      // `src/lib/auth/accessValidation.ts`, a file this branch never touches.
      // `computeFitPadding.ts` restates `OVERLAY_BAND_SELECTOR` for the same
      // reason, and is guarded the same way.
      //
      // So the mirror is made to FAIL LOUD instead of being abolished:
      // `overlayBandHeight.sourceScan.spec.ts` reads THIS FILE'S BYTES and REDs
      // if this number and `OVERLAY_BAND_HEIGHT` ever disagree. Keep the
      // literal on the next line in the form `const BAND_H = <number>` — the
      // scan binds to that shape.
      const BAND_H = 64
      // The pill is excluded because it is NOT a band occupant — it is the
      // fixed corner element the band must AVOID, and it is legitimately
      // taller than a band cell.
      const tooTall = r.overlays.filter(
        (o) => o.id !== 'floating-olumi-panel-pill' && o.rect.height > BAND_H,
      )
      expect(
        tooTall.map((o) => `${o.id}:${Math.round(o.rect.height)}px`),
        `an overlay is taller than the ${BAND_H}px band and spills above it, over the canvas`,
      ).toEqual([])

      // ── WITHDRAWN: "THE EXTENT NOTICE MUST BE REACHABLE HERE" ────────────
      // This asserted `model-extent-notice` is visible in every reading. It was
      // written against a corpus that COULD NOT MOUNT `StarterProvenanceBanner`
      // — the harness never stamped `starterId` — and in that corpus the extent
      // notice did win bottom-centre.
      //
      // With the banner mounting (as the product does for a saved example) the
      // banner OUTRANKS it, correctly and by the declared table, so the extent
      // notice does not render and the assertion is simply false. Re-derived
      // rather than relaxed: when the corpus changed, every claim resting on it
      // had to be re-checked, and this one did not survive.
      //
      // The reachability question is real but belongs where the extent notice
      // can actually win — a NON-starter graph — and no measure covers that
      // today. Recorded here rather than deleted silently, and rowed in the PR.

      // ── NEVER OVER THE DECISION NODE ──────────────────────────────────────
      // ⚠ THIS IS DELIBERATELY NARROWER THAN "NEVER OVER A NODE", AND THE
      // REASON IS A MEASUREMENT, NOT A CONVENIENCE — so it is stated rather
      // than quietly assumed.
      //
      // "Never over a node" is not reachable by reserving fit padding, because
      // THE MODEL IS NOT FITTED INTO THE PANE IN THE FIRST PLACE. The product
      // fit is floored at the legibility zoom, so a large model deliberately
      // overflows: `effectiveBottomInset` on these ten runs is NEGATIVE in
      // eight of them, from -36px to -618px. That overflow is the whole reason
      // `ModelExtentNotice` exists to say "Showing 9 of 19 elements". Padding
      // bounds a fit; it cannot bound a graph that is intentionally not fitted,
      // so SOME node sits behind any overlay wherever the overlay is put.
      //
      // ⚠⚠ THE BASE→TIP NUMBERS THAT USED TO SIT HERE ARE WITHDRAWN, AND WHY
      // MATTERS MORE THAN WHAT THEY SAID. They read "decision/goal contact 12
      // hits / 65,270px^2 -> 4 hits / 9,880px^2 ... count 22 -> 28 ... area
      // 97,687 -> 92,993px^2", and every one of them was taken from a corpus
      // that COULD NOT MOUNT `StarterProvenanceBanner`: the harness seeded via
      // `applyDraftResult`, which never stamps `starterId`. So the measure was
      // reporting improvements about a graph from which the component carrying
      // the motivating defect was ABSENT. They were also taken at `176a512d`,
      // before the priority table changed, so a different occupant held
      // bottom-centre. Two independent reasons they describe another corpus.
      //
      // MEASURED AT THIS TIP, banner mounted in 10/10 readings (asserted by the
      // harness, not hoped for):
      //   - `starter-provenance-banner` is 63px against the 64px band — it FITS,
      //     and at `py-2` it did not (71px, spilling upward over the canvas in
      //     all ten).
      //   - node contact 28 hits / 128,000px^2, and **zero `dec_` decision
      //     nodes touched** — which is the harm this assertion pins.
      //   - 0 overlay-overlay collisions.
      //   - `effectiveBottomInset` is NEGATIVE in 8/10: the model genuinely
      //     overflows the pane, which is why "never over a node" is not the
      //     claim being made.
      //
      // ⚠ NO BASE COMPARISON EXISTS WITH THE BANNER MOUNTED. The base harness
      // cannot mount it either, so a base run would measure the same absence.
      // A before/after is only a measurement when the corpus is FIXED, and this
      // corpus changed — so the honest statement is an absolute reading at the
      // tip, not an improvement. Closing the residual contact means bounding the
      // overflow itself, which lives in the fit hook, not here.
      const decisionNodesOnScreen = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.react-flow__node'))
          .map((n) => (n as HTMLElement).dataset.id ?? '')
          .filter((id) => id.startsWith('dec_')).length,
      )
      expect(
        decisionNodesOnScreen,
        'no decision node was on screen — the assertion below would be vacuous',
      ).toBeGreaterThan(0)

      const decisionHits = r.overlayNodeHits.filter((h) => h.node.startsWith('dec_'))
      expect(
        decisionHits,
        `an overlay is drawn over the DECISION node — the reported defect: ${JSON.stringify(decisionHits)}`,
      ).toEqual([])

      // The residual, printed on every run so it cannot quietly grow unnoticed.
      console.log(
        `OVERLAPRESIDUAL ${JSON.stringify({
          starter,
          viewport: viewport.name,
          nonDecisionNodeHits: r.overlayNodeHits.length,
          occludedArea: r.overlayNodeHits.reduce((a, h) => a + h.area, 0),
          effectiveBottomInset: r.effectiveBottomInset,
        })}`,
      )
    })
  }
}

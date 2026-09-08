/**
 * THE FIRST VIEW CONTAINS THE DECISION AND EVERY OPTION.
 *
 * WHY THIS EXISTS. Measured 30 Aug 2026, Chromium at 1280x800, on the five
 * shipped starters. Every starter's auto-fit clamps at `LABEL_LEGIBLE_ZOOM`,
 * and xyflow honours a floor by clamping AND RE-CENTRING — so a model taller
 * than the frame was cropped equally at top and bottom. The two ends are not
 * equally valuable:
 *
 *     starter               framing        decision  option  factor
 *     build-vs-buy          centred           0/1      0/4     8/8
 *                           top-anchored      1/1      4/4     4/8
 *     vendor-selection      centred           0/1      4/4     8/8
 *                           top-anchored      1/1      4/4     8/8
 *     market-entry          centred           0/1      3/3     8/8
 *                           top-anchored      1/1      3/3     7/8
 *
 * `build-vs-buy`'s first view contained NO decision and NOT ONE of its four
 * options — eight factor cards and nothing else. A colleague opening that
 * starter alone forms a view of a decision model without seeing the decision,
 * the goal, or any risk that qualifies it. That is not a legibility complaint:
 * it is the product's over-claiming defect expressed in geometry, because every
 * caveat sits below the confident content it qualifies.
 *
 * WHAT THIS ASSERTS, AND WHY THESE TWO KINDS. The decision and the options are
 * what a decision model IS. Factors, outcomes, risks and goals are supporting
 * detail reachable by scrolling, and the `model-extent-notice` states how much
 * of them is out of view. So this pins the two kinds whose absence makes the
 * first view incoherent, and deliberately does NOT pin the rest — a spec that
 * demanded everything would fail on models that genuinely cannot fit, and would
 * push a future lane to satisfy it by zooming below the legibility floor.
 *
 * ⚠ IT MUST FAIL IF THE CAMERA IS NOT ACTUALLY DOING THIS. The environment is
 * asserted in the same read as the measurement (`document.hidden === false`, a
 * non-zero pane), because a hidden pane suppresses `fitView` entirely and would
 * make every assertion here meaningless while looking like a pass.
 */

import { test, expect } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS, type StarterId,
} from './harness'

const STARTERS: StarterId[] = [
  'build-vs-buy', 'vendor-selection', 'market-entry', 'pricing-model', 'headcount-allocation',
]

/** Wait until the camera transform stops moving — the fit is animated. */
async function cameraSettled(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!vp) return false
    const w = window as unknown as { __tf?: string; __n?: number }
    const tf = getComputedStyle(vp).transform
    if (w.__tf === tf) w.__n = (w.__n ?? 0) + 1
    else { w.__tf = tf; w.__n = 0 }
    return (w.__n ?? 0) >= 5
  }, undefined, { timeout: 10_000, polling: 50 })
}

test.describe('the first view contains the decision and its options', () => {
  for (const starter of STARTERS) {
    test(`${starter} [${VIEWPORTS[0].name}]`, async ({ page }) => {
      await preparePage(page, VIEWPORTS[0])
      await openCanvas(page)
      await seedStarterDraft(page, starter)
      await clearNotifications(page)
      await freezeMotion(page)
      await waitForVisualQuiescence(page)
      await cameraSettled(page)

      const m = await page.evaluate(() => {
        const pane = document.querySelector('.react-flow') as HTMLElement | null
        const rect = pane?.getBoundingClientRect()

        /**
         * ⭐ THE OCCLUDERS — because "inside the pane" is NOT "the user can see it".
         *
         * This guard exists to prove the first view CONTAINS the decision and its
         * options. It used to test containment against the `.react-flow` pane rect
         * alone, and every panel on this screen is painted ON TOP of that pane —
         * so a card sitting entirely underneath the Outputs dock scored as inside.
         * That is how an option sat 13% under the panel at this guard's own
         * viewport with the whole suite green. A guard measuring the wrong
         * rectangle is worse than no guard: it reports coverage it never had.
         *
         * ⚠ DELIBERATELY NOT `computeFitPadding`, and the reason is a ruling this
         * estate has already paid for once. That function answers "what box should
         * the CAMERA fit into?" and it excludes the floating conversation panel on
         * purpose. This asks "what can the USER SEE?", which cannot exclude it.
         * Two authorities, two questions — they are named apart here rather than
         * aligned, exactly as the fit-vs-notice pair was.
         *
         * Selectors are read as LIVE RECTS, never as constants: each of these has
         * already moved once, and a hard-coded height would be a hand-maintained
         * mirror of a CSS value owned by another module. An absent occluder simply
         * contributes nothing, so this degrades to the old behaviour rather than
         * throwing when a surface is not mounted.
         */
        const OCCLUDER_SELECTORS = [
          '[data-testid="outputs-dock"]',
          '[data-testid="floating-olumi-panel"]',
          '[data-testid="left-sidebar"]',
          'header[role="banner"]',
          '[data-testid="canvas-overlay-band"]',
        ]
        const occluders = OCCLUDER_SELECTORS.flatMap((sel) => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (!el) return []
          const cs = getComputedStyle(el)
          // An element that paints nothing occludes nothing.
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return []
          const r = el.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0) return []
          return [{ sel, top: r.top, bottom: r.bottom, left: r.left, right: r.right }]
        })
        const overlaps = (
          a: { top: number; bottom: number; left: number; right: number },
          b: { top: number; bottom: number; left: number; right: number },
        ) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
        const w = window as unknown as {
          useCanvasStore: { getState: () => { nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }> } }
        }
        const kindOf = new Map(
          w.useCanvasStore.getState().nodes.map(n => [n.id, (n.type ?? (n.data as Record<string, unknown> | undefined)?.kind) as string]),
        )
        const byKind: Record<string, { full: number; total: number; missing: string[] }> = {}
        for (const el of document.querySelectorAll('.react-flow__node')) {
          const id = el.getAttribute('data-id') ?? ''
          const k = kindOf.get(id) ?? '?'
          const r = el.getBoundingClientRect()
          const inPane = !!rect
            && r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1
            && r.left >= rect.left - 1 && r.right <= rect.right + 1
          // Any intersection with a painted panel means part of this card is
          // hidden from the reader. Containment in the pane is necessary and
          // was never sufficient.
          const hitBy = occluders.filter((o) => overlaps(r, o)).map((o) => o.sel)
          const visible = inPane && hitBy.length === 0
          byKind[k] = byKind[k] ?? { full: 0, total: 0, missing: [] }
          byKind[k].total++
          if (visible) byKind[k].full++
          else {
            const why = !inPane ? 'outside the pane' : `under ${hitBy.join(' + ')}`
            byKind[k].missing.push(`${(el.textContent ?? '').trim().slice(0, 32)} [${why}]`)
          }
        }
        return {
          hidden: document.hidden,
          paneW: rect ? Math.round(rect.width) : 0,
          paneH: rect ? Math.round(rect.height) : 0,
          // Reported so a zero is visible as a BLIND INSTRUMENT rather than as a
          // clean result: if no occluder is mounted this guard has silently
          // reverted to the pane-only test it was written to replace.
          occluderCount: occluders.length,
          occluderSelectors: occluders.map((o) => o.sel),
          byKind,
        }
      })

      // ENVIRONMENT, asserted in the SAME read — a hidden pane suppresses the
      // fit, so without this the assertions below could pass on a camera that
      // never ran.
      expect(m.hidden, 'document.hidden — the fit is suppressed and this proves nothing').toBe(false)
      expect(m.paneW, 'the canvas pane has no width — nothing was measured').toBeGreaterThan(0)
      expect(m.paneH, 'the canvas pane has no height — nothing was measured').toBeGreaterThan(0)
      // ⭐ THE INSTRUMENT'S OWN PRECONDITION. With no occluder found, `visible`
      // collapses to `inPane` and this file becomes the guard it replaced —
      // passing for the wrong reason, silently. The dock is always mounted on
      // the canvas route, so zero here means the selectors have drifted, not
      // that the screen is clear.
      expect(
        m.occluderCount,
        'no occluder was measured — this guard has silently reverted to a pane-only test and proves nothing',
      ).toBeGreaterThan(0)

      const decision = m.byKind['decision']
      const option = m.byKind['option']
      expect(decision, `${starter} mounted no decision node — the fixture changed`).toBeTruthy()
      expect(option, `${starter} mounted no option nodes — the fixture changed`).toBeTruthy()
      expect(option!.total, `${starter} should have options to frame`).toBeGreaterThan(0)

      expect(
        decision!.full,
        `the decision is not fully in the first view of ${starter}: ${JSON.stringify(decision!.missing)}`,
      ).toBe(decision!.total)

      expect(
        option!.full,
        `${option!.total - option!.full} of ${option!.total} options are outside the first view of ${starter}: ${JSON.stringify(option!.missing)}`,
      ).toBe(option!.total)
    })
  }
})

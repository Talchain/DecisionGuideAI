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
          const inside = !!rect
            && r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1
            && r.left >= rect.left - 1 && r.right <= rect.right + 1
          byKind[k] = byKind[k] ?? { full: 0, total: 0, missing: [] }
          byKind[k].total++
          if (inside) byKind[k].full++
          else byKind[k].missing.push((el.textContent ?? '').trim().slice(0, 40))
        }
        return {
          hidden: document.hidden,
          paneW: rect ? Math.round(rect.width) : 0,
          paneH: rect ? Math.round(rect.height) : 0,
          byKind,
        }
      })

      // ENVIRONMENT, asserted in the SAME read — a hidden pane suppresses the
      // fit, so without this the assertions below could pass on a camera that
      // never ran.
      expect(m.hidden, 'document.hidden — the fit is suppressed and this proves nothing').toBe(false)
      expect(m.paneW, 'the canvas pane has no width — nothing was measured').toBeGreaterThan(0)
      expect(m.paneH, 'the canvas pane has no height — nothing was measured').toBeGreaterThan(0)

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

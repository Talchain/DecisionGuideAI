/**
 * The founder's states — captured at two laptop viewports and compared against
 * committed references.
 *
 * These are the surfaces a human was, until now, the only instrument for. Each
 * one names the identity anchors that must be mounted before the shutter opens,
 * so a flag move or a refactor that stops rendering the surface REDs here
 * instead of quietly screenshotting something else (CLAUDE.md trap 3b/19).
 *
 * NOT COVERED, AND WHY — completed analysis.
 * The founder's list includes a completed-analysis state. It is deliberately
 * ABSENT, because it cannot be seeded deterministically AND TRUTHFULLY at this
 * tip, and a flaky-or-fabricated reference is worse than no reference:
 *   - there is no backend in this harness by design;
 *   - `resultsComplete`/`applyV5State` can be driven directly, but the only
 *     real captured analysis turns in the repo
 *     (`src/v5/__tests__/fixtures/live-analysis-turn-*.json`) carry NO graph and
 *     their option ids do not correspond to any starter graph — measured
 *     overlap is at most 2 of 4 options (`opt_status_quo`, `opt_sales`) against
 *     `headcount-allocation`, and 1 of 4 against the rest. Pairing them would
 *     render an incoherent surface that we would then bless as canonical;
 *   - the remaining option is a hand-written report, i.e. a fixture from the
 *     author's head presented as the product's output (CLAUDE.md trap 16).
 * The unblocking step is a captured CEE analysis turn for one of the five
 * starter graphs, committed next to them with the same provenance discipline.
 * Until that exists this state stays uncovered and SAID to be uncovered.
 *
 * NOT COVERED, AND WHY — inspector with a node selected. MEASURED AND REMOVED.
 * It was built, blessed, and then dropped on evidence. Clicking a node opens the
 * inspector AND starts a focus/lens transition ("Showing paths from X to goal"),
 * and the right-hand dock races between the inspector's content and the
 * pre-analysis readiness surface (whose fetch returns the harness's hermetic 503
 * and offers a Retry). Measured at 1280x800:
 *   - 389 differing pixels between two independent blessing runs — 76% of the
 *     whole tolerance budget consumed by noise alone;
 *   - 15,182 differing pixels across four fresh browser contexts, IDENTICAL for
 *     runs 1/2/3 against run 0, i.e. BIMODAL rather than random: the first
 *     (cold) capture lands in one dock state and every later one in the other.
 * A stronger wait was attempted and did not settle it. Every other state was
 * pixel-IDENTICAL across the same two independent runs, so this is specific to
 * this state, not to the harness.
 *
 * A state that flakes at 30x the tolerance would get the whole harness muted
 * inside a week, which is worse than not covering it. The unblocking step is a
 * deterministic readiness condition for "the dock has settled on the inspector"
 * — most likely a testid on the inspector's dock takeover plus a settled
 * readiness state — at which point it can be re-added to STATE_NAMES.
 */

import { test, expect } from '@playwright/test'
import {
  VIEWPORTS,
  captureState,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  openCanvas,
  preparePage,
  seedStarterDraft,
  postureReport,
} from './harness'

/**
 * One starter for every state. `build-vs-buy` is the original 2026-07-24
 * capture and the largest of the five (19 nodes / 37 edges), so it exercises
 * the graph/panel relationship the regressions actually live in.
 */
const STARTER = 'build-vs-buy' as const

test.describe('visual regression — founder states', () => {
  test.beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log('[visreg] run posture\n' + postureReport())
  })

  for (const vp of VIEWPORTS) {
    test.describe(`@ ${vp.name}`, () => {
      test(`fresh draft — graph and right-hand panel [${vp.name}]`, async ({ page }, testInfo) => {
        await preparePage(page, vp)
        await openCanvas(page)
        const seeded = await seedStarterDraft(page, STARTER)
        expect(seeded.nodeCount, 'build-vs-buy capture is 19 nodes; a different count means the fixture drifted').toBe(19)
        await clearNotifications(page)

        // Full viewport on purpose: the defects being caught are the
        // RELATIONSHIP between the graph and the dock, so they must share a
        // frame. A clipped dock shot cannot see a panel that has eaten the graph.
        await captureState(page, testInfo, `fresh-draft--${vp.name}`, vp, {
          anchors: ['[data-testid="rf-root"]', '[data-testid="outputs-dock"]', '.react-flow__node'],
        })
      })

      test(`blocked / provisional — not ready for analysis [${vp.name}]`, async ({ page }, testInfo) => {
        await preparePage(page, vp)
        await openCanvas(page)
        await seedStarterDraft(page, STARTER)
        await clearNotifications(page)

        // The readiness verdict lives in the dock. Clipped to the dock so a
        // one-word copy change in the blocker is not lost in a 1.15-megapixel
        // full-viewport diff.
        await captureState(page, testInfo, `blocked-provisional--${vp.name}`, vp, {
          clip: '[data-testid="outputs-dock"]',
          // Under the pinned posture this is the preAnalysisV3 surface
          // (`VITE_FEATURE_PRE_ANALYSIS_V3 = "1"` in netlify.toml). The legacy
          // `sticky-footer` does NOT mount here — asserting it would have bound
          // this state to a surface no staging user sees (trap 3b).
          anchors: [
            '[data-testid="outputs-dock"]',
            '[data-testid="pre-analysis-v3"]',
            '[data-testid="pre-analysis-v3-footer"]',
            '[data-testid="pre-analysis-v3-analyse"]',
          ],
        })
      })

      test(`Model tab [${vp.name}]`, async ({ page }, testInfo) => {
        await preparePage(page, vp)
        await openCanvas(page)
        await seedStarterDraft(page, STARTER)
        await clearNotifications(page)

        // "Model" is the LABEL; `diagnostics` is the id. OutputsDock.tsx warns
        // about exactly this ("IDENTITY TRAP") — bind to the testid, assert the
        // rendered label, so a swap of either is caught.
        const modelTab = page.getByTestId('outputs-dock-tab-diagnostics')
        await expect(modelTab).toBeVisible({ timeout: 20_000 })
        await expect(modelTab).toContainText('Model')
        // A REAL MOUSE CLICK, deliberately. At 42f6cb6a this tab was occluded by
        // `button[aria-label="Collapse outputs dock"]` in a 280px dock and had to
        // be driven by keyboard; the 416px restore (#754/#755) fixed it. Clicking
        // rather than focus+Enter means a future re-narrowing that re-occludes
        // this tab REDS here instead of being routed around silently.
        await modelTab.click()

        await captureState(page, testInfo, `model-tab--${vp.name}`, vp, {
          clip: '[data-testid="outputs-dock"]',
          anchors: ['[data-testid="outputs-dock"]', '[data-testid="model-tab"]'],
        })
      })

      test(`Olumi conversation tab [${vp.name}]`, async ({ page }, testInfo) => {
        await preparePage(page, vp)
        await openCanvas(page)
        await seedStarterDraft(page, STARTER)
        await clearNotifications(page)

        const olumiTab = page.getByTestId('outputs-dock-tab-olumi')
        await expect(olumiTab).toBeVisible({ timeout: 20_000 })
        await expect(olumiTab).toContainText('Olumi')
        await olumiTab.click()

        await captureState(page, testInfo, `olumi-tab--${vp.name}`, vp, {
          clip: '[data-testid="outputs-dock"]',
          anchors: ['[data-testid="outputs-dock"]', '[data-testid="olumi-tab-wrapper"]'],
        })
      })

      test(`graph at default zoom [${vp.name}]`, async ({ page }, testInfo) => {
        await preparePage(page, vp)
        await openCanvas(page)
        await seedStarterDraft(page, STARTER)
        await clearNotifications(page)
        await minimiseFloatingOlumiPanel(page)

        // "Default zoom" = the product's own fit-to-view, which is a pure
        // function of viewport and graph extent and therefore deterministic
        // for a fixed starter at a fixed viewport.
        await page.getByRole('button', { name: /fit to view/i }).first().click({ timeout: 20_000 })

        await captureState(page, testInfo, `graph-default-zoom--${vp.name}`, vp, {
          anchors: ['[data-testid="rf-root"]', '.react-flow__viewport', '.react-flow__node'],
        })
      })
    })
  }
})

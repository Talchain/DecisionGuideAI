/**
 * "SHOW WHOLE MODEL" REACHES THE COMPUTED FIT — AND IS STILL THERE A SECOND LATER.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A DUPLICATE OF `modelExtent.visual.spec.ts`.
 * That spec asserts the OUTCOME a user sees ("every node is inside the pane").
 * It caught defect #1051 and could not say what was wrong, because "nodes are
 * outside the pane" is equally consistent with a fit that computed the wrong
 * target, a fit that never ran, and a fit that ran and was overwritten. This
 * spec pins the CAMERA against the fit DERIVED FROM THE MODEL'S OWN EXTENTS, and
 * samples it twice, so those three become three different failures:
 *
 *   - wrong target      -> the scale is wrong at the first sample
 *   - never ran         -> the scale is the pre-click scale at both samples
 *   - overwritten later -> the first sample is right and the second is not
 *
 * #1051 is the third. Measured locally in Chromium 1280x800 on `build-vs-buy`
 * with `panZoom.setViewport` wrapped so each camera write named its caller: the
 * user's overview landed at 0.2630 (19 of 19 nodes inside the pane) and the
 * product's own reserved-box re-fit overwrote it 155ms later at 0.5000, the
 * legibility floor, with 9 of 19 inside. See `src/canvas/utils/userCameraClaim.ts`.
 *
 * ⭐ THE MODEL'S EXTENT IS A FUNCTION OF THE CAMERA, WHICH IS WHY THE TOLERANCE
 * IS 5% AND NOT 0 — MEASURED, 31 Aug 2026, not chosen for comfort. Below
 * `LABEL_LEGIBLE_ZOOM` the level-of-detail view simplifies node bodies, the
 * nodes get shorter, and `build-vs-buy` loses 54 flow units of height. So a
 * CORRECT overview lands at 0.2630 — the fit of the model as it was when the
 * user clicked — while the fit derivable from the render it produces is 0.2685.
 * A 2.1% disagreement that is the LOD change, not a camera defect.
 *
 * ⚠ AND THE COMPARISON IS MADE ENTIRELY WITHIN ONE STATE, THE POST-CLICK ONE.
 * Comparing against a PRE-click derivation was tried first and is itself
 * unstable: taken a few hundred milliseconds apart it read the same model at
 * 2408 and 2654 flow units of height, a 10% swing in the expectation. Both
 * readings are of the same instant here, so only the LOD slack has to be
 * tolerated. At the defect the ratio is 1.72; the fixed ratio is 0.980.
 *
 * ⚠ THE EXPECTED SCALE IS DERIVED, NEVER TYPED. A hardcoded 0.263 would pass for
 * the wrong reason the moment a starter, a font, a node size or the dock width
 * moves — and it would still pass if the fit were computed over half the model,
 * which is precisely the hypothesis #1051 spent a day excluding. The expectation
 * here is recomputed in-page from the live node extents, the live pane and the
 * product's own `computeFitPadding()`, so it tracks whatever the model actually is.
 *
 * ⚠ WHAT IT DOES NOT PROVE. It proves nothing about a camera the user then moves
 * by hand, nor about any surface other than the main canvas, and each case is a
 * single-viewport measurement (the defect case at 1280x800, the smallest desktop
 * this PoC commits to; the twin at a size where its precondition is reachable at
 * all — see there). It is a real browser with real layout, so unlike a jsdom
 * guard it does prove visibility — but only of the states it drives.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS,
} from './harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

/**
 * How far the camera may sit from the fit derived at the same instant before it
 * is not a fit. 5% covers the 2.1% level-of-detail extent change measured above
 * with room to spare, and is two orders of magnitude tighter than the defect
 * (which lands 72% high).
 */
const FIT_TOLERANCE = 0.05

/**
 * Wait until the camera transform stops changing. Copied in shape from
 * `modelExtent.visual.spec.ts`; the layout store is silent about the camera, so
 * quiescence there returns while a fit is still in flight.
 */
async function waitForCameraSettled(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!vp) return false
      const w = window as unknown as { __lastTf?: string; __tfStableFrames?: number }
      const tf = getComputedStyle(vp).transform
      if (w.__lastTf === tf) { w.__tfStableFrames = (w.__tfStableFrames ?? 0) + 1 }
      else { w.__lastTf = tf; w.__tfStableFrames = 0 }
      return (w.__tfStableFrames ?? 0) >= 5
    },
    undefined,
    { timeout: timeoutMs, polling: 50 },
  )
}

/**
 * Wait until the MODEL'S OWN EXTENT stops changing.
 *
 * ⚠ NOT COSMETIC — it is what makes the derived expectation trustworthy.
 * `waitForVisualQuiescence` watches the layout store and returns while nodes are
 * still reaching their rendered height. A derivation taken inside that window
 * measured `build-vs-buy` at 2408 flow units of height on one run and 2654 on
 * the next, i.e. a 10% swing in the expectation this spec compares the camera
 * against — large enough to fail a correct fix intermittently. Stability is
 * asserted before anything is derived from it.
 */
async function waitForExtentsSettled(page: Page, ghostPrefix: string, timeoutMs = 10_000): Promise<void> {
  await page.waitForFunction(
    (prefix: string) => {
      const els = [...document.querySelectorAll('.react-flow__node')].filter(
        (el) => !((el as HTMLElement).dataset.id ?? '').startsWith(prefix),
      ) as HTMLElement[]
      if (els.length === 0) return false
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const el of els) {
        if (!el.offsetWidth || !el.offsetHeight) return false
        const t = new DOMMatrixReadOnly(getComputedStyle(el).transform)
        minX = Math.min(minX, t.e); minY = Math.min(minY, t.f)
        maxX = Math.max(maxX, t.e + el.offsetWidth); maxY = Math.max(maxY, t.f + el.offsetHeight)
      }
      const sig = `${els.length}:${Math.round(maxX - minX)}x${Math.round(maxY - minY)}`
      const w = window as unknown as { __extentSig?: string; __extentStable?: number }
      if (w.__extentSig === sig) { w.__extentStable = (w.__extentStable ?? 0) + 1 }
      else { w.__extentSig = sig; w.__extentStable = 0 }
      return (w.__extentStable ?? 0) >= 5
    },
    ghostPrefix,
    { timeout: timeoutMs, polling: 50 },
  )
}

interface CameraReading {
  ok: boolean
  why: string
  /** The live camera scale, read from the rendered viewport transform. */
  scale: number
  /** The scale that would frame every model node inside the reserved box. */
  derivedFit: number
  modelNodes: number
  unmeasured: number
  fullyVisible: number
  hidden: boolean
}

/**
 * Derive the fit this model needs, and read the camera that is actually applied.
 *
 * The derivation uses the product's OWN `computeFitPadding()` — imported through
 * the dev server rather than restated — so a change to what the panels reserve
 * moves the expectation with the product instead of falsifying this spec.
 */
async function readCamera(page: Page): Promise<CameraReading> {
  return page.evaluate(async (ghostPrefix: string) => {
    const fail = (why: string): CameraReading => ({
      ok: false, why, scale: NaN, derivedFit: NaN,
      modelNodes: 0, unmeasured: 0, fullyVisible: 0, hidden: document.hidden,
    })

    const pane = document.querySelector('.react-flow') as HTMLElement | null
    if (!pane) return fail('no .react-flow element')
    const paneRect = pane.getBoundingClientRect()
    if (paneRect.width <= 0 || paneRect.height <= 0) return fail('pane has no size')

    // ⚠ THE EXTENTS COME FROM THE RENDERED NODES, NOT FROM THE CANVAS STORE.
    // The store's `measured` sizes lagged the DOM by one layout pass on this
    // path, and a derivation taken from them computed a fit 7% smaller than the
    // one xyflow computes — a spec that would then have failed a correct fix.
    // A node element's own layout box is in FLOW units (the viewport transform
    // scales its ancestor, not its offsetWidth), and its `transform` carries its
    // flow position, so this measures what is actually on the canvas.
    const els = [...document.querySelectorAll('.react-flow__node')].filter(
      (el) => !((el as HTMLElement).dataset.id ?? '').startsWith(ghostPrefix),
    ) as HTMLElement[]
    if (els.length === 0) return fail('no model nodes rendered')

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let unmeasured = 0
    for (const el of els) {
      const w = el.offsetWidth, h = el.offsetHeight
      if (!w || !h) { unmeasured += 1; continue }
      const t = new DOMMatrixReadOnly(getComputedStyle(el).transform)
      minX = Math.min(minX, t.e)
      minY = Math.min(minY, t.f)
      maxX = Math.max(maxX, t.e + w)
      maxY = Math.max(maxY, t.f + h)
    }
    if (unmeasured > 0) return { ...fail(`${unmeasured} node(s) have no rendered size`), modelNodes: els.length, unmeasured }

    // The product's own reserved box — imported, not restated. Resolved by the
    // BROWSER against Vite's dev module graph; the path is held in a variable
    // because a string literal here is a TS2307 against a URL that only exists
    // on the dev server (the same reason `harness.seedStarterDraft` does it).
    const modulePath = '/src/canvas/utils/computeFitPadding.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as {
      computeFitPadding: () => { top: string; right: string; bottom: string; left: string }
    }
    const pad = mod.computeFitPadding()
    const px = (v: string) => Number.parseFloat(v)
    const availW = paneRect.width - px(pad.left) - px(pad.right)
    const availH = paneRect.height - px(pad.top) - px(pad.bottom)
    if (!(availW > 0 && availH > 0)) return fail('reserved box left no room to fit into')

    const derivedFit = Math.min(availW / (maxX - minX), availH / (maxY - minY))

    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!vpEl) return fail('no .react-flow__viewport element')
    const m = new DOMMatrixReadOnly(getComputedStyle(vpEl).transform)

    const fullyVisible = els.filter((el) => {
      const r = el.getBoundingClientRect()
      return r.top >= paneRect.top - 1 && r.bottom <= paneRect.bottom + 1
        && r.left >= paneRect.left - 1 && r.right <= paneRect.right + 1
    }).length

    return {
      ok: true, why: '', scale: m.a, derivedFit,
      modelNodes: els.length, unmeasured, fullyVisible, hidden: document.hidden,
    }
  }, GHOST_ID_PREFIX)
}

test.describe('the overview the user asks for is the overview they keep', () => {
  test('build-vs-buy: "Show whole model" reaches the derived fit and stays there', async ({ page }) => {
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'build-vs-buy')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)
    await waitForExtentsSettled(page, GHOST_ID_PREFIX)

    // ENVIRONMENT AND PRECONDITIONS, PINNED IN-TEST — every number below is void
    // without them (a hidden tab measures 0x0; an unmeasured node is silently
    // dropped from xyflow's own bounds).
    const before = await readCamera(page)
    expect(before.ok, `the reading is not trustworthy: ${before.why}`).toBe(true)
    expect(before.hidden, 'document.hidden — a hidden tab measures nothing').toBe(false)
    expect(before.unmeasured, 'unmeasured nodes are dropped from the fit bounds').toBe(0)
    expect(before.modelNodes, 'no model nodes').toBeGreaterThan(0)

    // THE PRECONDITION THIS SPEC EXISTS FOR: this model needs to be zoomed OUT
    // to be seen whole. Without it the assertions below could pass on a model
    // that was already framed, which is the tautology the twin below guards.
    expect(
      before.derivedFit,
      `build-vs-buy is expected to need zooming out; derived fit was ${before.derivedFit}`,
    ).toBeLessThan(1)
    expect(
      before.scale,
      `the camera is already at the whole-model fit before the click (${before.scale}); nothing would be tested`,
    ).toBeGreaterThan(before.derivedFit * (1 + FIT_TOLERANCE))

    await page.getByTestId('model-extent-show-all').click()
    await waitForCameraSettled(page)

    const after = await readCamera(page)
    expect(after.ok, after.why).toBe(true)
    expect(
      Math.abs(after.scale - after.derivedFit) / after.derivedFit,
      `"Show whole model" left the camera at ${after.scale} when the model's own extents ` +
      `need ${after.derivedFit} — ${after.modelNodes - after.fullyVisible} of ${after.modelNodes} ` +
      `elements are outside the pane`,
    ).toBeLessThanOrEqual(FIT_TOLERANCE)
    expect(after.fullyVisible, 'the derived fit was reached but elements are still outside the pane').toBe(after.modelNodes)

    // ⭐ AND IT IS STILL THERE. This is the half that fails at pristine: the fit
    // above lands correctly and the product's own re-fit overwrites it ~155ms
    // later. A single sample taken at the right instant reports a working button.
    await page.waitForTimeout(1500)
    const settled = await readCamera(page)
    expect(settled.ok, settled.why).toBe(true)
    expect(
      Math.abs(settled.scale - settled.derivedFit) / settled.derivedFit,
      `the camera was moved OFF the user's overview after the fact: ${after.scale} -> ${settled.scale} ` +
      `(derived fit ${settled.derivedFit}); ${settled.modelNodes - settled.fullyVisible} of ` +
      `${settled.modelNodes} elements are outside the pane again`,
    ).toBeLessThanOrEqual(FIT_TOLERANCE)
    expect(settled.fullyVisible, 'elements left the pane again after the overview').toBe(settled.modelNodes)
  })

  test('a model that already fits is neither zoomed away from nor re-framed', async ({ page }) => {
    // ⭐ THE DISCRIMINATING TWIN, and it fails on a different assertion from the
    // test above. Everything above is satisfied by a change that simply makes the
    // camera zoom out further and stop re-fitting; this one is not. It pins the
    // other direction: on a model that is ALREADY entirely visible, the fit
    // action must land ON the derived fit — neither below it (zoomed away from a
    // view that was fine) nor above it (elements pushed out).
    //
    // ⚠ THE VIEWPORT IS PART OF THE FIXTURE, NOT A CLAIM ABOUT SUPPORTED SIZES.
    // At 1280x800 every shipped starter overflows (the table in
    // `ModelExtentNotice`'s header measures this), so at that size the twin's
    // precondition — "already fits" — is unreachable and the test would prove
    // nothing. This size is chosen so the precondition HOLDS, and it is asserted
    // in-test rather than assumed; the skip below fires loudly if it stops holding.
    await preparePage(page, { width: 1600, height: 1200 })
    await openCanvas(page)
    await seedStarterDraft(page, 'headcount-allocation')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)
    await waitForExtentsSettled(page, GHOST_ID_PREFIX)

    const before = await readCamera(page)
    expect(before.ok, before.why).toBe(true)
    expect(before.hidden).toBe(false)
    expect(before.unmeasured).toBe(0)
    expect(before.modelNodes).toBeGreaterThan(0)

    if (before.fullyVisible !== before.modelNodes) {
      // Honest about its own precondition rather than passing on the branch that
      // proves nothing (the same rule `modelExtent.visual.spec.ts` follows).
      test.info().annotations.push({
        type: 'warning',
        description: `headcount-allocation did not already fit (${before.fullyVisible}/${before.modelNodes}); the twin was NOT exercised`,
      })
      test.skip()
      return
    }

    await page.getByRole('button', { name: 'Fit to view' }).click()
    await waitForCameraSettled(page)
    await page.waitForTimeout(1500)

    const after = await readCamera(page)
    expect(after.ok, after.why).toBe(true)
    expect(
      after.fullyVisible,
      `the model was entirely visible and the fit action pushed ${after.modelNodes - after.fullyVisible} element(s) out of the pane`,
    ).toBe(after.modelNodes)
    expect(
      Math.abs(after.scale - after.derivedFit) / after.derivedFit,
      `the model already fitted and the fit action moved the camera to ${after.scale}, away from the derived fit ${after.derivedFit}`,
    ).toBeLessThanOrEqual(FIT_TOLERANCE)
  })
})

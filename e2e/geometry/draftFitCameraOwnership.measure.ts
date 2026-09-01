/**
 * "SHOW WHOLE MODEL" SHOWS THE WHOLE MODEL — AND STILL DOES A SECOND LATER.
 * Real Chromium, real layout, real viewport transform against real node bounds.
 *
 * ⚠ RUN IT DELIBERATELY. It is a `*.measure.ts`, so the main e2e config cannot
 * collect it, and **`Staging Gate` runs no Playwright job at all**. Nothing here
 * gates a merge; the gated half of this fix is
 * `src/canvas/__tests__/useFitViewOnLayoutVersion.userOverview.spec.tsx`.
 *
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/draftFitCameraOwnership.measure.ts
 *
 * ⭐⭐ WHY IT EXISTS, AND WHY THE INSTRUMENT ASSERTION AT THE TOP IS THE MOST
 * IMPORTANT LINE IN THE FILE.
 *
 * This defect was first filed from a browser pane whose `document.visibilityState`
 * was `hidden`. xyflow drives every animated camera move through a d3 transition
 * on `requestAnimationFrame`, so in that page the transition applied its first
 * frame and never advanced: the camera froze part-way, at a zoom the product's
 * own auto-fit is forbidden to choose, and each subsequent fit crept a little
 * further. Measured on deployed staging in exactly that state — 390% zoom,
 * "Showing 0 of 14 elements", and repeated fits landing 3.788 -> 2.770 -> 2.245.
 * Every one of those numbers is the instrument, not the product: the same page
 * reported `requestAnimationFrame` frames = 0 over 500ms.
 *
 * **A starved render loop and a broken fit are indistinguishable from the
 * output alone**, and a forced paint (a screenshot) does NOT resume a d3
 * transition — so the usual "force a paint before trusting geometry" precaution
 * does not defend against this one. Hence `assertRenderLoopAlive`, first, loudly,
 * before a single camera number is believed. (CLAUDE.md trap 13: an absence
 * probe needs a positive control; here the control is the render loop itself.)
 *
 * ⭐ THE PRODUCT DEFECT THIS PINS, measured with the loop asserted live at
 * 1280x720 on the five shipped starters:
 *
 *     starter                lv          after "Show whole model"
 *     vendor-selection       4 -> 6      0.5000, 7 of 19 off-pane
 *     pricing-model          2 -> 4      0.5000, 1 of 15 off-pane
 *     build-vs-buy           3 -> 5      0.5000, 10 of 19 off-pane
 *     headcount-allocation   2 -> 4      0.5000, 1 of 16 off-pane
 *     market-entry           4 -> 4      0.3208, 0 of 18 off-pane  <- CONTROL
 *
 * `market-entry` is the control that names the mechanism instead of guessing at
 * it: the ONE starter where no corrective layout fired is the ONE where the
 * overview survived. 0.5000 is `LABEL_LEGIBLE_ZOOM` — not a fit that fell short
 * but the product's own floored re-fit wearing the user's click, which is the
 * same arithmetic `utils/userCameraClaim.ts` records for the reserved-box
 * trigger. The loop is started by the click itself: below the legibility floor
 * the cards drop to level-of-detail, their measured heights change, and
 * `useMeasureThenLayout`'s corrective pass lays out again.
 *
 * ⚠ WHAT IT DOES NOT PROVE. Nothing about a camera the user then moves by hand,
 * nothing about any surface but the main canvas, and nothing at any other
 * viewport — each case is a single-size measurement at 1280x720, the pane the
 * defect was filed against.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, type StarterId,
} from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'
import { LABEL_LEGIBLE_ZOOM, AUTO_FIT_MAX_ZOOM } from '../../src/canvas/utils/zoomLegibility'

const SIZE = { width: 1280, height: 720 }
const STARTERS: StarterId[] = [
  'vendor-selection', 'pricing-model', 'build-vs-buy', 'market-entry', 'headcount-allocation',
]

/**
 * ⭐ THE INSTRUMENT COMES FIRST. Without this every assertion below is equally
 * satisfied by a page that is not rendering at all — see the header.
 */
async function assertRenderLoopAlive(page: Page): Promise<number> {
  const live = await page.evaluate(async () => {
    let frames = 0
    await new Promise<void>((resolve) => {
      const t0 = performance.now()
      const tick = () => { frames += 1; if (performance.now() - t0 >= 600) resolve(); else requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
      setTimeout(resolve, 5_000)
    })
    return { frames, visibility: document.visibilityState }
  })
  expect(live.visibility, 'the page is HIDDEN — rAF is starved, so every camera number below is the instrument').toBe('visible')
  expect(
    live.frames,
    `requestAnimationFrame produced ${live.frames} frames in 600ms — an animated fit cannot complete, so a frozen camera proves NOTHING`,
  ).toBeGreaterThan(20)
  return live.frames
}

/** Wait until the viewport transform stops changing — the CAMERA, not the layout. */
async function waitForCameraSettled(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!vp) return false
    const w = window as unknown as { __ltf?: string; __stable?: number }
    const tf = getComputedStyle(vp).transform
    if (w.__ltf === tf) w.__stable = (w.__stable ?? 0) + 1
    else { w.__ltf = tf; w.__stable = 0 }
    return (w.__stable ?? 0) > 25
  }, undefined, { timeout: timeoutMs, polling: 'raf' }).catch(() => undefined)
}

/**
 * Wait until no layout is pending or running. The camera settle alone is not
 * enough before a final reading: ELK blocks the main thread, so a corrective
 * layout can delay the fit's animation past a fixed wait and leave the sample
 * INSIDE the walk. Measured on `build-vs-buy` — one run read 0.4586 with 10
 * nodes off-pane while the very next sample of the same state read 0.2766 with
 * none.
 */
async function waitForLayoutQuiescent(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(() => {
    const st = (window as unknown as {
      useCanvasStore: { getState: () => { pendingLayout: boolean; layoutInProgress: boolean } }
    }).useCanvasStore.getState()
    return !st.pendingLayout && !st.layoutInProgress
  }, undefined, { timeout: timeoutMs }).catch(() => undefined)
}

interface Frame {
  transform: string
  zoom: number
  layoutVersion: number
  modelN: number
  /** Model nodes whose RENDERED box leaves the pane. Real geometry, not presence. */
  offPane: string[]
  notice: string | null
  noticeButtonPresent: boolean
}

async function frameOf(page: Page): Promise<Frame> {
  return page.evaluate((ghostPrefix: string) => {
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
    const model = els.filter((e) => !(e.dataset.id ?? '').startsWith(ghostPrefix))
    const offPane: string[] = []
    for (const el of model) {
      const r = el.getBoundingClientRect()
      if (r.left < flow.left || r.top < flow.top || r.right > flow.right || r.bottom > flow.bottom) {
        offPane.push(el.dataset.id!)
      }
    }
    const transform = vpEl ? getComputedStyle(vpEl).transform : 'NO-VIEWPORT-EL'
    const m = /matrix\(([-0-9.eE]+)/.exec(transform)
    const s = (window as unknown as {
      useCanvasStore: { getState: () => { layoutVersion: number } }
    }).useCanvasStore.getState()
    return {
      transform,
      zoom: m ? Number(m[1]) : NaN,
      layoutVersion: s.layoutVersion,
      modelN: model.length,
      offPane,
      notice: document.querySelector('[data-testid="model-extent-count"]')?.textContent ?? null,
      noticeButtonPresent: document.querySelector('[data-testid="model-extent-show-all"]') !== null,
    }
  }, GHOST_ID_PREFIX)
}

function report(phase: string, extra: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`CAMOWN ${JSON.stringify({ phase, ...extra })}`)
}

for (const starter of STARTERS) {
  test(`"Show whole model" holds on ${starter}`, async ({ page }) => {
    test.setTimeout(300_000)
    await preparePage(page, SIZE)
    // ⚠ NOT reduced motion. `cameraDuration` collapses every duration to 0 under
    // `reduce`, which removes the animation entirely — and the animation is half
    // of what this file is about. The real user path is animated.
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
    // ⚠ WARM THE DEV SERVER FIRST. `openCanvas` allows 30s for `.react-flow` to
    // appear, and Vite's FIRST compile of the canvas bundle on a loaded machine
    // exceeds that — the first test in a run failed here while every later test
    // mounted in ~20s. Navigating once and discarding the result makes the
    // measured navigation a warm one, so a failure below is about the product.
    await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' }).catch(() => undefined)
    await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 120_000 }).catch(() => undefined)
    await openCanvas(page)
    const rafFrames = await assertRenderLoopAlive(page)

    const seeded = await seedStarterDraft(page, starter)
    await clearNotifications(page).catch(() => undefined)
    await minimiseFloatingOlumiPanel(page).catch(() => undefined)
    await waitForCameraSettled(page)

    const afterDraft = await frameOf(page)
    report('afterDraft', { starter, rafFrames, seeded, ...afterDraft })

    // PRECONDITIONS, PINNED IN-TEST — each of these failing would make every
    // assertion below vacuous rather than wrong (trap 13b).
    expect(afterDraft.modelN, 'no model nodes rendered — the geometry checks would be vacuous').toBeGreaterThan(0)
    expect(afterDraft.layoutVersion, 'no layout ran — this is not the post-draft state class').toBeGreaterThan(0)
    expect(Number.isFinite(afterDraft.zoom), 'no viewport matrix — the zoom checks would be vacuous').toBe(true)

    // ⭐ THE PRODUCT'S OWN BAND, BOTH ENDS. `fitBoundsFor('product')` is the rule
    // every automatic fit runs under; a camera outside it after a draft means the
    // last write was not a product fit at all. This is what read 3.788 in the
    // starved-rAF page and what makes that reading self-evidently the instrument.
    expect(
      afterDraft.zoom,
      `after the draft the camera sits at ${afterDraft.zoom}, outside the band an automatic fit may choose`,
    ).toBeGreaterThanOrEqual(LABEL_LEGIBLE_ZOOM)
    expect(afterDraft.zoom).toBeLessThanOrEqual(AUTO_FIT_MAX_ZOOM)

    if (!afterDraft.noticeButtonPresent) {
      // ⭐ THE TWIN, AND IT IS NOT A SKIP. A model that already fits must be left
      // alone: no notice means nothing is out of view, and the product must not
      // have zoomed in to manufacture one.
      expect(afterDraft.offPane, `${starter}: no extent notice, yet nodes are off-pane`).toEqual([])
      report('alreadyFits', { starter })
      return
    }

    /* ── THE SUBJECT ─────────────────────────────────────────────────────── */
    const btn = page.getByTestId('model-extent-show-all')
    await btn.focus()
    await page.keyboard.press('Enter')
    await waitForCameraSettled(page)

    const justAfter = await frameOf(page)
    report('justAfterClick', { starter, ...justAfter })

    // AND STILL THERE A SECOND LATER — the whole point. The defect did not stop
    // the button working; it took the result back ~1s afterwards, so a single
    // sample immediately after the click would have passed at the defect.
    await waitForLayoutQuiescent(page)
    await page.waitForTimeout(2_500)
    await waitForCameraSettled(page)
    const settled = await frameOf(page)
    report('settled', { starter, ...settled })

    expect(
      settled.offPane,
      `${starter}: "Show whole model" left ${settled.offPane.length} of ${settled.modelN} model nodes off-pane (zoom ${settled.zoom}, layoutVersion ${afterDraft.layoutVersion} -> ${settled.layoutVersion})`,
    ).toEqual([])
    expect(
      settled.notice,
      `${starter}: the extent notice still claims elements are hidden after the overview`,
    ).toBeNull()

    /* ── THE OPPOSITE-DIRECTION TWINS, IN REAL GEOMETRY ─────────────────────
     * A fit that always defers is a different defect from one that always fits,
     * so both directions are measured here and neither alone would be evidence.
     *
     * ⚠ EACH TWIN DISPATCHES `applyLayout` WITH AN EXPLICIT `initiatedBy` AND
     * ASSERTS `laidOut`, AND BOTH HALVES ARE LOAD-BEARING. Written first without
     * them, this twin measured a RACE rather than the rule: a bare
     * `applyLayout()` can return `{laidOut:false}` — superseded by the
     * stale-request guard, or bounced by the re-entry guard — while a CONCURRENT
     * automatic corrective pass commits instead and bumps `layoutVersion`
     * anyway. The camera then reflects a layout the test did not dispatch. It
     * read "Auto-arrange is inert" on market-entry and "parked outside the band"
     * on vendor-selection, and BOTH readings were the harness, not the product.
     * Quiescing first and asserting the commit is what makes the initiator the
     * only thing that varies. */
    await waitForLayoutQuiescent(page)

    const dispatchLayout = (initiatedBy: 'user' | 'product') =>
      page.evaluate(async (who: 'user' | 'product') => {
        const r = await (window as unknown as {
          useCanvasStore: {
            getState: () => {
              applyLayout: (o: { skipHistory?: boolean; initiatedBy: 'user' | 'product' }) =>
                Promise<{ laidOut: boolean }>
            }
          }
        }).useCanvasStore.getState().applyLayout({ skipHistory: who === 'product', initiatedBy: who })
        return r
      }, initiatedBy)

    // TWIN 1 — an AUTOMATIC layout of the same model must leave the overview alone.
    const beforeAuto = settled.transform
    const autoResult = await dispatchLayout('product')
    expect(autoResult.laidOut, `${starter}: the automatic layout never committed — this twin would be vacuous`).toBe(true)
    await waitForLayoutQuiescent(page)
    // The SAME fixed wait as twin 2, and here it is what stops the twin being
    // VACUOUS rather than early: "the transform did not change" is trivially true
    // if it is read before a fit could have started moving it. This gives the
    // defect a full animation's worth of chance to happen.
    await page.waitForTimeout(2_000)
    await waitForCameraSettled(page)
    const afterAuto = await frameOf(page)
    report('afterAutomaticLayout', { starter, before: beforeAuto, ...afterAuto })
    expect(
      afterAuto.transform,
      `${starter}: an automatic re-layout moved the camera off the user's overview`,
    ).toBe(beforeAuto)
    expect(afterAuto.offPane, `${starter}: the overview lost nodes to an automatic re-layout`).toEqual([])

    // TWIN 2 — a layout the USER asked for must still re-frame, claim or no claim.
    // Otherwise Auto-arrange re-arranges every node under a camera framed for the
    // old arrangement and never shows the result.
    const userResult = await dispatchLayout('user')
    expect(userResult.laidOut, `${starter}: the user layout never committed — this twin would be vacuous`).toBe(true)
    await waitForLayoutQuiescent(page)
    // ⚠ A FIXED WAIT BEFORE THE SETTLE, AND IT IS NOT PADDING. `waitForCameraSettled`
    // asks "has the transform stopped changing?", which is TRUE in the window
    // between the layout committing and the fit's rAF starting the animation — so
    // on its own it returns a PRE-fit reading and calls it settled. Traced at 16ms
    // on all five starters, every one of them walks from the overview to exactly
    // `matrix(0.5, …)` over ~400ms; sampling early read the first two steps of
    // that walk and reported "the re-frame parked outside the band". The
    // assertion was right and the harness was early — which is the same class of
    // error as the starved rAF this file's header is about, one layer up.
    await page.waitForTimeout(2_000)
    await waitForCameraSettled(page)
    const afterUser = await frameOf(page)
    report('afterUserLayout', { starter, before: afterAuto.transform, ...afterUser })
    expect(
      afterUser.transform,
      `${starter}: a user-initiated layout did not re-frame — the fix over-applied and Auto-arrange is now inert`,
    ).not.toBe(afterAuto.transform)
    expect(
      afterUser.zoom,
      `${starter}: the user-initiated re-frame parked at ${afterUser.zoom}, outside the band an automatic fit may choose`,
    ).toBeGreaterThanOrEqual(LABEL_LEGIBLE_ZOOM)
    expect(afterUser.zoom).toBeLessThanOrEqual(AUTO_FIT_MAX_ZOOM)
  })
}

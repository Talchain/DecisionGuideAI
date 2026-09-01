/**
 * "SHOW WHOLE MODEL" MUST SURVIVE A RE-LAYOUT OF THE SAME MODEL.
 *
 * ⚠ RUN IT DELIBERATELY. It is a `*.measure.ts`, so the main e2e config cannot
 * collect it and no merge gate runs it:
 *
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/showWholeModel.measure.ts
 *
 * WHY IT EXISTS. `claimCameraForUser()` (#1051) stopped the RESERVED-BOX trigger
 * taking the user's overview away. It did not stop the LAYOUT trigger, which
 * calls `releaseUserCameraClaim()` unconditionally before re-fitting — so the
 * user's overview survives only until the next layout pass.
 *
 * MEASURED, real Chromium, real clock, 1280x800, `build-vs-buy` (19 model
 * nodes), at `8220f48d`. Sampling the rendered transform every frame after the
 * click:
 *
 *     t=1     zoom=0.5000  x=181  y=61   the camera before the click
 *     t=681   zoom=0.2907  x=480  y=67   the user's overview lands — whole model
 *     t=1279  zoom=0.5000  x=181  y=61   returned to EXACTLY the pre-click camera
 *
 * and the named triggers, same run:
 *
 *     +17632ms  showAll
 *     +17633ms  claimCameraForUser
 *     +18219ms  layoutTrigger fire (layoutVersion 4 -> 5)
 *     +18220ms  releaseUserCameraClaim      <- the claim is discarded
 *     +18220ms  fitNow                      <- floored product fit, back to 0.50
 *
 * ⚠ WHY THIS FORCES THE LAYOUT RATHER THAN RACING IT. In the wild the layout
 * that steals the camera is a CORRECTIVE one — `useMeasureThenLayout` re-lays
 * out when a card grows taller than the height the committed layout was
 * computed against, and on this starter `dec_billing` was measured growing
 * 94 -> 198 -> 295px across successive passes. Whether one is still in flight
 * when the user clicks is a matter of machine load, which is exactly why this
 * defect reads as intermittent and why instrumenting the page can hide it. This
 * probe therefore DRIVES the condition: it waits for layout to settle, clicks,
 * and then asks the store for one more layout of the SAME model. That is the
 * corrective pass, deterministically, with no timing to lose.
 *
 * THE STATE CLASS IS NAMED (status-ladder fixture rule): FRESH seeded draft, no
 * prior camera, real clock, animations ON (`reducedMotion: no-preference`).
 * Freezing motion collapses `cameraDuration` to 0 and the fit becomes
 * instantaneous, which changes what this measures.
 *
 * ⚠ WHAT THIS ASSERTS, STATED NARROWLY — AND THE RESIDUAL IT DELIBERATELY DOES
 * NOT CLAIM TO HAVE CLOSED.
 *
 * The assertion is that no model node is left OUTSIDE THE GENUINELY-VISIBLE
 * CANVAS — behind the dock, the sidebar or the banner, or off the pane. That is
 * the button's promise and the user-facing harm.
 *
 * It is NOT the stronger claim that the fit honours every pixel of the padding
 * it asked for. Measured at this tip after the fix, on `build-vs-buy`:
 * `goal_billing` renders with its bottom edge at y=797.6 against a fit that
 * requested a 29px bottom margin (frame bottom 771) — 26.5px inside its own
 * breathing room, though still wholly on screen and clear of every panel. The
 * extent notice counts against that padded frame and is therefore RIGHT to keep
 * reporting "Showing 18 of 19 elements": the notice is not lying, the fit is
 * landing low.
 *
 * ⚠ AND THE HYPOTHESIS THAT WAS REFUTED, recorded so it is not re-inherited: the
 * residual is NOT the notice and the fit disagreeing about the frame. Measured
 * in the same run, `readFocusCamera`'s `insets`, its `padding` and
 * `computeFitPadding()` are byte-identical (top 73 / right 444 / bottom 29 /
 * left 76) and the floating companion is ABSENT, so the companion-aware comfort
 * frame and the fit frame do not diverge in this state at all. The likely cause
 * is that the fit computes its bounds at click time and the camera then crosses
 * the level-of-detail threshold, which changes what each card renders and so
 * changes the model's extent underneath the frame that was just computed. That
 * is a separate question from the one this file measures.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft } from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'
import { LABEL_LEGIBLE_ZOOM } from '../../src/canvas/utils/zoomLegibility'

interface Frame {
  zoom: number
  x: number
  y: number
  /** Model nodes (ghosts excluded) whose rendered box leaves the genuinely-visible canvas. */
  outsideVisible: string[]
  /** Model nodes whose rendered box leaves the pane entirely. */
  outsidePane: string[]
  modelNodeCount: number
  notice: string | null
  layoutVersion: number
}

/**
 * The genuinely-visible canvas: the flow rect less the three occluders
 * `computeFitPadding` reserves for — the OutputsDock, the LeftSidebar and the
 * floating TopBar pill. Read from the LIVE rects, never from named numbers, so
 * this cannot drift when a panel's width or the bar's height changes.
 */
async function frameOf(page: Page): Promise<Frame> {
  return page.evaluate((ghostPrefix: string) => {
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
    const m = new DOMMatrixReadOnly(getComputedStyle(vpEl).transform)
    const rectOf = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    }
    const dock = rectOf('aside[aria-label="Outputs dock"]')
    const sidebar = rectOf('nav[aria-label="Canvas tools"]')
    const banner = rectOf('[role="banner"]')
    const visible = {
      left: sidebar ? sidebar.right : flow.left,
      right: dock ? dock.left : flow.right,
      top: banner ? banner.bottom : flow.top,
      bottom: flow.bottom,
    }
    const nodes = (Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[])
      .map((el) => ({ id: el.getAttribute('data-id') ?? '', r: el.getBoundingClientRect() }))
      .filter((n) => !n.id.startsWith(ghostPrefix))
    const out = (box: { left: number; right: number; top: number; bottom: number }) =>
      nodes
        .filter((n) => n.r.left < box.left || n.r.right > box.right || n.r.top < box.top || n.r.bottom > box.bottom)
        .map((n) => n.id)
        .sort()
    const w = window as unknown as { useCanvasStore: { getState: () => { layoutVersion: number } } }
    return {
      zoom: m.a,
      x: m.e,
      y: m.f,
      outsideVisible: out(visible),
      outsidePane: out({ left: flow.left, right: flow.right, top: flow.top, bottom: flow.bottom }),
      modelNodeCount: nodes.length,
      notice: document.querySelector('[data-testid="model-extent-count"]')?.textContent ?? null,
      layoutVersion: w.useCanvasStore.getState().layoutVersion,
    }
  }, ghostPrefix())
}

function ghostPrefix(): string {
  return GHOST_ID_PREFIX
}

/** Block until the rendered transform has not moved for `stableMs`. */
async function cameraSettled(page: Page, stableMs = 500, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as { __lastT?: string; __since?: number }
      const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!el) return false
      const t = getComputedStyle(el).transform
      const now = performance.now()
      if (w.__lastT !== t) {
        w.__lastT = t
        w.__since = now
        return false
      }
      return now - (w.__since ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 50 },
  )
}

/** Block until `layoutVersion` has not moved for `stableMs`. */
async function layoutSettled(page: Page, stableMs = 1500, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as {
        useCanvasStore: { getState: () => { layoutVersion: number; pendingLayout: boolean; layoutInProgress: boolean } }
        __lastLv?: number
        __lvSince?: number
      }
      const s = w.useCanvasStore.getState()
      if (s.pendingLayout || s.layoutInProgress) return false
      const now = performance.now()
      if (w.__lastLv !== s.layoutVersion) {
        w.__lastLv = s.layoutVersion
        w.__lvSince = now
        return false
      }
      return now - (w.__lvSince ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 100 },
  )
}

test('the user\'s overview survives a re-layout of the same model', async ({ page }) => {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch {
        /* the visible-anchor assertions below catch a dead storage */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  // ⚠ ANIMATIONS ON, DELIBERATELY. `cameraDuration` collapses to 0 under
  // reduced-motion, which removes the 400ms window this defect lives in.
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })

  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 150_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore
        ?.getState === 'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)

  const seeded = await seedStarterDraft(page, 'build-vs-buy')
  expect(seeded.nodeCount, 'starter seeded no nodes').toBeGreaterThan(0)
  await layoutSettled(page)
  await cameraSettled(page)

  // ── The precondition, asserted rather than assumed ────────────────────────
  // If the notice is absent there is no defect to measure and every assertion
  // below would pass vacuously (CLAUDE.md trap 13).
  const before = await frameOf(page)
  const btn = page.locator('[data-testid="model-extent-show-all"]')
  expect(await btn.count(), 'no extent notice — nothing to measure').toBe(1)
  expect(
    before.outsideVisible.length,
    'precondition: part of the model must start outside the visible canvas',
  ).toBeGreaterThan(0)

  // ── The button's promise ──────────────────────────────────────────────────
  await btn.click()
  await cameraSettled(page)
  const framed = await frameOf(page)
  expect(
    framed.outsideVisible,
    `"Show whole model" left ${framed.outsideVisible.length} of ${framed.modelNodeCount} model nodes outside the visible canvas`,
  ).toEqual([])

  // ── AND IT MUST STILL BE TRUE AFTER THE SAME MODEL IS LAID OUT AGAIN ──────
  // This is the corrective pass `useMeasureThenLayout` runs when a card's
  // measured height changes. The MODEL is untouched: same nodes, same edges,
  // same ids — only its geometry is recomputed.
  const lvBefore = framed.layoutVersion
  await page.evaluate(async () => {
    const w = window as unknown as {
      useCanvasStore: { getState: () => { applyLayout: (o?: { skipHistory?: boolean }) => Promise<unknown> } }
    }
    await w.useCanvasStore.getState().applyLayout({ skipHistory: true })
  })
  await layoutSettled(page)
  await cameraSettled(page)
  const after = await frameOf(page)

  // The re-layout must actually have happened, or the assertion below is vacuous.
  expect(after.layoutVersion, 'the forced re-layout did not run — the check below would be vacuous').toBeGreaterThan(
    lvBefore,
  )
  expect(
    after.outsideVisible,
    `after a re-layout of the SAME model, ${after.outsideVisible.length} of ${after.modelNodeCount} model nodes are outside the visible canvas again — the user's overview was discarded`,
  ).toEqual([])
  // Bind to the SIGNATURE of the defect, not merely to "something moved": the
  // product's automatic fit is floored at LABEL_LEGIBLE_ZOOM, so a camera that
  // has been taken back lands at or above the floor on a model that cannot fit
  // there. Framing below the floor is the user's choice and must be preserved.
  expect(
    after.zoom,
    `camera returned to the product's floored fit (${after.zoom}) — the automatic re-fit overwrote the user's overview`,
  ).toBeLessThan(LABEL_LEGIBLE_ZOOM)
})

/**
 * THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b).
 *
 * The fix above has TWO conjuncts — the user owns the camera, AND the model is
 * the one the product already framed. The first alone would pass the test above
 * just as happily, and would be WRONG: it would strand the camera on the old
 * model's frame when a new one arrives, which is the harm
 * `utils/userCameraClaim.ts` warns about in its scope note. This test is what
 * makes the second conjunct load-bearing rather than decorative.
 *
 * Proven by the discriminating pair, measured:
 *   - revert the fix entirely            -> the test above REDs, this one passes
 *   - keep only `if (userOwnsCamera())`  -> the test above passes, this one REDs
 * Neither mutant alone shows the binding; the pair does.
 */
test('a NEW model is still framed by the product, even after the user claimed the camera', async ({
  page,
}) => {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch {
        /* the visible-anchor assertions below catch a dead storage */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })

  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 150_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore
        ?.getState === 'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)

  await seedStarterDraft(page, 'build-vs-buy')
  await layoutSettled(page)
  await cameraSettled(page)

  const btn = page.locator('[data-testid="model-extent-show-all"]')
  expect(await btn.count(), 'no extent notice — the claim could not be made').toBe(1)
  await btn.click()
  await cameraSettled(page)

  const claimed = await frameOf(page)
  // The precondition for this test: the user really is below the product's
  // floor, so "the product re-framed" is distinguishable from "nothing moved".
  expect(
    claimed.zoom,
    'precondition: the user overview must sit below the legibility floor',
  ).toBeLessThan(LABEL_LEGIBLE_ZOOM)

  // ── A DIFFERENT MODEL ARRIVES ─────────────────────────────────────────────
  await seedStarterDraft(page, 'market-entry')
  await layoutSettled(page)
  await cameraSettled(page)
  const arrived = await frameOf(page)

  // The product's automatic fit is floored at LABEL_LEGIBLE_ZOOM, so a camera
  // it has aimed cannot sit below the floor. Still sitting at the user's
  // overview zoom means the new model was never framed at all.
  expect(
    arrived.zoom,
    `a new model arrived and the camera was never re-aimed (zoom ${arrived.zoom}) — a stale user claim stranded it`,
  ).toBeGreaterThanOrEqual(LABEL_LEGIBLE_ZOOM)
})

/**
 * "SHOW WHOLE MODEL" AND THE DOCK — THE FRAME BUDGET, DERIVED.
 *
 * ⚠ RUN IT DELIBERATELY. `*.measure.ts` is not collected by the main e2e config
 * and no merge gate runs it:
 *
 *     GEOMETRY_PORT=5417 pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/showWholeModelDockBudget.measure.ts
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐⭐ WHY IT EXISTS, AND THE PREMISE IT CORRECTS.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This file was commissioned to fix a stated defect: *"'Show whole model' does
 * not show the whole model; the fit does not account for the 416px OutputsDock,
 * so elements land behind it."* **MEASURED, THAT PREMISE IS FALSE, AND THE
 * MEASUREMENT IS THE DELIVERABLE.**
 *
 * `computeFitPadding` measures the dock's live rect and reserves it: at 1280x800
 * with the dock at its 416px default it returns `right: 444px`, and the fit
 * frames into the 760px of canvas actually left over. Driven in real Chromium on
 * five shipped starters x two viewports x two state classes, at BOTH the build
 * the complaint was taken on (`a1fd39cc`) and the current base, **every arm ends
 * the click with ZERO model nodes behind the dock.** The button reaches the
 * dock-aware overview and stays there.
 *
 * ⭐ WHAT WAS ACTUALLY SEEN IS THE **DEFAULT VIEW**, NOT THE BUTTON — and it
 * reproduces exactly. `headcount-allocation` at 1280x800, dock expanded, after
 * the product's own automatic fit and before any click:
 *
 *     zoom 0.5000   notice "Showing 10 of 16 elements"
 *     behind the dock: ["fac_quota_attainment", "opt_sales"]   (a factor, an option)
 *
 * — the same counter, the same element classes. The button was blamed for the
 * state it is offered *in*.
 *
 * ⭐⭐ AND THE MECHANISM, WHICH IS A BUDGET AND NOT A BUG.
 *
 * The product's automatic fit is floored at `LABEL_LEGIBLE_ZOOM` (0.5) — below
 * it every node body renders blank, so an automatic fit is not allowed to park
 * there. `topAnchoredViewportWhenClamped` then pins the model's top-LEFT inside
 * the fit frame, which is the best available placement. Whatever will not fit at
 * 0.5 therefore overflows the frame's RIGHT edge — and the right edge is where a
 * 416px opaque panel is. The dock does not cause the loss; it decides that the
 * loss reads as *"an option has vanished"* rather than *"the model continues off
 * the edge"*.
 *
 * ⭐⭐⭐ THE NUMBER THAT SETTLES THE TRADE, AND IT IS NOT THE DOCK.
 * At 1280x800 the binding constraint is VERTICAL on all five starters. The fit
 * frame is 760 x **635**: the window's 800px of height less 73 (the floating
 * TopBar pill) and 92 (the `CanvasOverlayBand`) — **165px, 21% of the window,
 * spent on chrome before the model gets any.** The zoom each starter needs to be
 * shown whole, against a floor of 0.50:
 *
 *     build-vs-buy          0.243     vendor-selection      0.291
 *     market-entry          0.276     headcount-allocation  0.417
 *     pricing-model         0.413
 *
 * **Not one of them clears the floor.** Collapsing the dock cannot change that:
 * it buys horizontal room, and the constraint is vertical. `headcount-allocation`
 * needs 1524 model-px of height at zoom 0.5 = 762px of frame, and has 635.
 *
 * So the honest statement of the product position is: **at 1280x800 no shipped
 * starter can be both fully visible and legible, and "Show whole model" is the
 * user choosing visibility over legibility — correctly, and with no floor, which
 * is why it works.** Widening what a user can see whole is a chrome-budget or
 * legibility-floor decision, not a padding one.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE ASSERTS, AND WHAT IT ONLY RECORDS.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * HARD ASSERTION — one, and it is the button's promise against the dock:
 * **after the click, no model node's rendered box crosses `dock.left`.** That is
 * the regression guard the premise deserved: it passes today, and it REDs the
 * moment the dock stops being reserved. Proven to bite by a DISCRIMINATING
 * MUTANT PAIR (CLAUDE.md trap 19) — deleting the DOCK branch of
 * `computeFitPadding` REDs it; deleting the SIDEBAR branch leaves it GREEN, so
 * it is bound to the dock and not merely to "the padding changed".
 *
 * RECORDED, NEVER ASSERTED — the frame budget and the default view. A product
 * assertion on those would be this lane deciding the legibility/visibility trade
 * silently, which is a founder decision, and it would abort the run on the first
 * arm and cost the rest.
 *
 * ⭐ THE INSTRUMENT IS ASSERTED BEFORE ANY COUNT (CLAUDE.md trap 13). A sibling
 * lane's harness measured zero because its fixture never mounted the component
 * under test, and a zero for the wrong reason is indistinguishable from a pass.
 * So every arm proves, before it counts anything: the pane renders, the model
 * nodes are PRESENT and agree with the store, and the dock is present, EXPANDED,
 * and at its ~416px default width. A collapsed dock would make the central
 * assertion vacuous — there would be nothing to hide behind.
 *
 * ⚠ THE VISIBLE CANVAS HERE INCLUDES THE OVERLAY BAND, AND THE TWO OLDER
 * "show whole model" MEASURES DO NOT. `showWholeModel.measure.ts` and
 * `savedExampleShowWholeModel.measure.ts` both take `bottom: flow.bottom`,
 * which predates `CanvasOverlayBand` (#1162) and is now a fourth occluder they
 * cannot see. Measured on `headcount-allocation`'s default view, counting the
 * band moves the outside-the-visible-canvas set from 3 nodes to 6. That is
 * REPORTED here rather than edited into files this lane does not own.
 *
 * STATE CLASS (status-ladder fixture rule): FRESH seeded starter draft, no prior
 * camera, real clock, animations ON (`reducedMotion: no-preference`) — freezing
 * motion collapses `cameraDuration` to 0 and removes the window the camera
 * animates through.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft, type StarterId } from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'
import { LABEL_LEGIBLE_ZOOM } from '../../src/canvas/utils/zoomLegibility'

const STARTERS: StarterId[] = [
  'build-vs-buy',
  'vendor-selection',
  'market-entry',
  'headcount-allocation',
  'pricing-model',
]

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]

/**
 * The dock's expanded default is `--dock-right-expanded: 26rem` = 416px
 * (`OutputsDock.tsx` `asideStyle`). The band is deliberately wide rather than a
 * literal: the dock is user-resizable and the assertion means "expanded at
 * something like its default", not "exactly 416".
 */
const DOCK_EXPANDED_MIN = 380
const DOCK_EXPANDED_MAX = 500

interface Reading {
  zoom: number
  x: number
  y: number
  /** Model nodes whose rendered box crosses `dock.left` — the guarded set. */
  behindDock: string[]
  /** Model nodes whose rendered box crosses the overlay band's top edge. */
  underBand: string[]
  /** Model nodes leaving the visible canvas by ANY edge (band included). */
  outsideVisible: string[]
  /** Model nodes leaving the pane entirely. */
  outsidePane: string[]
  modelNodeCount: number
  storeModelNodeCount: number
  notice: string | null
  showAllPresent: boolean
  /** The fit frame, derived from the live occluder rects. */
  frame: { left: number; right: number; top: number; bottom: number }
  /** The model's extent in flow units, from the store's measured node boxes. */
  extent: { width: number; height: number }
  /** Occluder presence — the instrument's own witness. */
  occluders: { dock: boolean; dockWidth: number; dockComposition: string | null; sidebar: boolean; banner: boolean; band: boolean }
  paneWidth: number
  paneHeight: number
}

/**
 * ⚠ THE FRAME IS DERIVED FROM THE LIVE RECTS, NEVER FROM NAMED NUMBERS, and it
 * reproduces `computeFitPadding`'s four contributors — dock, sidebar, TopBar
 * banner, overlay band — including its 16px `GAP`. Restating the numbers here
 * would be a hand-maintained mirror of the module under measurement (trap 12),
 * and a mirror that drifts would read GREEN.
 */
const FIT_GAP = 16

async function readFrame(page: Page, ghostPrefix: string): Promise<Reading> {
  return page.evaluate((gp: string) => {
    const GAP = 16
    const flowEl = document.querySelector('.react-flow')
    if (!flowEl) throw new Error('instrument: no .react-flow')
    const flow = flowEl.getBoundingClientRect()
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!vpEl) throw new Error('instrument: no .react-flow__viewport')
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
    const band = rectOf('[data-canvas-overlay-band]')

    // The genuinely-visible canvas, reserving each occluder's own GAP exactly as
    // `computeFitPadding` does, so this frame IS the frame the fit targets.
    const frame = {
      left: sidebar ? sidebar.right + GAP : flow.left,
      right: dock ? dock.left - GAP : flow.right,
      top: banner ? banner.bottom + GAP : flow.top,
      bottom: band ? band.top - GAP : flow.bottom,
    }

    const nodes = (Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[])
      .map((el) => ({ id: el.getAttribute('data-id') ?? '', r: el.getBoundingClientRect() }))
      .filter((n) => !n.id.startsWith(gp))

    // BOUND BY IDENTITY, NEVER BY A VALUE PREDICATE (trap 19): the guarded set is
    // "nodes crossing the rect of the element whose aria-label is the dock's",
    // named by node id — not "nodes beyond some x".
    const behindDock = dock
      ? nodes.filter((n) => n.r.right > dock.left).map((n) => n.id).sort()
      : []
    const underBand = band
      ? nodes.filter((n) => n.r.bottom > band.top).map((n) => n.id).sort()
      : []
    const outsideVisible = nodes
      .filter(
        (n) =>
          n.r.left < (sidebar ? sidebar.right : flow.left) ||
          n.r.right > (dock ? dock.left : flow.right) ||
          n.r.top < (banner ? banner.bottom : flow.top) ||
          n.r.bottom > (band ? band.top : flow.bottom),
      )
      .map((n) => n.id)
      .sort()
    const outsidePane = nodes
      .filter((n) => n.r.left < flow.left || n.r.right > flow.right || n.r.top < flow.top || n.r.bottom > flow.bottom)
      .map((n) => n.id)
      .sort()

    const w = window as unknown as {
      useCanvasStore: {
        getState: () => {
          nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>
        }
      }
    }
    const storeNodes = w.useCanvasStore.getState().nodes.filter((n) => !n.id.startsWith(gp))
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of storeNodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + (n.measured?.width ?? 0))
      maxY = Math.max(maxY, n.position.y + (n.measured?.height ?? 0))
    }

    return {
      zoom: m.a,
      x: m.e,
      y: m.f,
      behindDock,
      underBand,
      outsideVisible,
      outsidePane,
      modelNodeCount: nodes.length,
      storeModelNodeCount: storeNodes.length,
      notice: document.querySelector('[data-testid="model-extent-count"]')?.textContent ?? null,
      showAllPresent: !!document.querySelector('[data-testid="model-extent-show-all"]'),
      frame,
      extent: {
        width: Number.isFinite(maxX - minX) ? Math.round(maxX - minX) : 0,
        height: Number.isFinite(maxY - minY) ? Math.round(maxY - minY) : 0,
      },
      occluders: {
        dock: !!dock,
        dockWidth: dock ? Math.round(dock.width) : 0,
        dockComposition:
          (document.querySelector('aside[aria-label="Outputs dock"]') as HTMLElement | null)?.getAttribute(
            'data-panel-composition',
          ) ?? null,
        sidebar: !!sidebar,
        banner: !!banner,
        band: !!band,
      },
      paneWidth: flow.width,
      paneHeight: flow.height,
    }
  }, ghostPrefix)
}

/** Block until `layoutVersion` has not moved and no layout is pending. */
async function layoutSettled(page: Page, stableMs = 1500, timeoutMs = 45_000): Promise<void> {
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => { layoutVersion: number; pendingLayout: boolean; layoutInProgress: boolean }
        }
        __lvLast?: number
        __lvSince?: number
      }
      const s = w.useCanvasStore.getState()
      if (s.pendingLayout || s.layoutInProgress) return false
      const now = performance.now()
      if (w.__lvLast !== s.layoutVersion) {
        w.__lvLast = s.layoutVersion
        w.__lvSince = now
        return false
      }
      return now - (w.__lvSince ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 100 },
  )
}

/**
 * ⚠ A FIXED SETTLE, NOT A "has the transform stopped moving" POLL — and the
 * difference cost this lane a false defect before it was caught.
 *
 * A stability poll that keeps its `lastTransform` on `window` between calls
 * returns TRUE IMMEDIATELY on the next call, because the pre-click transform is
 * still in place for the ~160ms between the click and the animation's first
 * frame and already satisfies the stability window from the PREVIOUS call. The
 * reading then lands mid-animation and reads as "the button stopped short".
 * Measured: it reported `vendor-selection` settling at zoom 0.485 with 7 nodes
 * outside, on a run that in fact reached 0.289 with none.
 *
 * `showWholeModel.measure.ts` and `savedExampleShowWholeModel.measure.ts` share
 * that helper shape. Neither is bitten at this tip — both arms happen to read
 * after the animation — but the latch is stale in both. REPORTED, not edited.
 */
const SETTLE_MS = 3000

async function boot(page: Page, starter: StarterId, size: { width: number; height: number }): Promise<void> {
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
        /* the instrument assertions below catch a dead storage */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize(size)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })
  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 150_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState ===
      'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
  const seeded = await seedStarterDraft(page, starter)
  expect(seeded.nodeCount, `instrument: ${starter} seeded no nodes`).toBeGreaterThan(0)
  await layoutSettled(page)
  await page.waitForTimeout(1200)
}

for (const size of SIZES) {
  for (const starter of STARTERS) {
    test(`"Show whole model" clears the dock — ${starter} @${size.width}x${size.height}`, async ({ page }) => {
      await boot(page, starter, size)

      const before = await readFrame(page, GHOST_ID_PREFIX)

      // ── THE INSTRUMENT, ASSERTED BEFORE ANY COUNT ──────────────────────────
      // Each of these can independently make the guard below vacuous: no nodes
      // to hide, a store the DOM disagrees with, or a dock too narrow to hide
      // anything behind.
      expect(before.modelNodeCount, `instrument: no model nodes rendered (${starter})`).toBeGreaterThan(0)
      expect(
        before.modelNodeCount,
        `instrument: DOM/store node counts disagree (${starter}) — the count is measuring the wrong set`,
      ).toBe(before.storeModelNodeCount)
      expect(before.occluders.dock, `instrument: the OutputsDock is not mounted (${starter})`).toBe(true)
      expect(
        before.occluders.dockComposition,
        `instrument: the dock is not EXPANDED — nothing could hide behind it (${starter})`,
      ).toBe('expanded')
      expect(
        before.occluders.dockWidth,
        `instrument: dock width ${before.occluders.dockWidth}px is outside its expanded default band (${starter})`,
      ).toBeGreaterThanOrEqual(DOCK_EXPANDED_MIN)
      expect(before.occluders.dockWidth).toBeLessThanOrEqual(DOCK_EXPANDED_MAX)
      expect(before.extent.width, `instrument: the model has no measured extent (${starter})`).toBeGreaterThan(0)
      expect(before.extent.height).toBeGreaterThan(0)

      // ── THE FRAME BUDGET — RECORDED, NEVER ASSERTED ────────────────────────
      const frameW = before.frame.right - before.frame.left
      const frameH = before.frame.bottom - before.frame.top
      const zoomToShowWhole = Math.min(frameW / before.extent.width, frameH / before.extent.height)
      const bindingAxis = frameW / before.extent.width < frameH / before.extent.height ? 'width' : 'height'
      const chromeVertical = before.paneHeight - frameH
      const chromeHorizontal = before.paneWidth - frameW

      const clicked = before.showAllPresent
      let after: Reading | null = null
      if (clicked) {
        await page.locator('[data-testid="model-extent-show-all"]').click()
        await page.waitForTimeout(SETTLE_MS)
        after = await readFrame(page, GHOST_ID_PREFIX)
      }

      // eslint-disable-next-line no-console
      console.log(
        'DOCKFITJSON ' +
          JSON.stringify({
            starter,
            viewport: `${size.width}x${size.height}`,
            stateClass: 'FRESH',
            gap: FIT_GAP,
            legibilityFloor: LABEL_LEGIBLE_ZOOM,
            budget: {
              pane: { width: before.paneWidth, height: before.paneHeight },
              frame: { width: Math.round(frameW), height: Math.round(frameH) },
              chrome: { horizontal: Math.round(chromeHorizontal), vertical: Math.round(chromeVertical) },
              extent: before.extent,
              zoomToShowWhole: +zoomToShowWhole.toFixed(4),
              bindingAxis,
              clearsLegibilityFloor: zoomToShowWhole >= LABEL_LEGIBLE_ZOOM,
            },
            defaultView: {
              zoom: +before.zoom.toFixed(4),
              notice: before.notice,
              behindDock: before.behindDock,
              underBand: before.underBand,
              outsideVisible: before.outsideVisible,
              outsidePane: before.outsidePane,
            },
            afterClick: after
              ? {
                  zoom: +after.zoom.toFixed(4),
                  notice: after.notice,
                  behindDock: after.behindDock,
                  underBand: after.underBand,
                  outsideVisible: after.outsideVisible,
                  outsidePane: after.outsidePane,
                }
              : null,
            clicked,
            occluders: before.occluders,
          }),
      )

      // ── THE ONE HARD PRODUCT ASSERTION: THE BUTTON CLEARS THE DOCK ─────────
      // Skipped, loudly, when the notice is absent — there is no button to press
      // and asserting on the default view would be asserting the trade this file
      // deliberately only records.
      if (!clicked) {
        test.info().annotations.push({
          type: 'note',
          description: `${starter} @${size.width}x${size.height}: the model already fits the visible canvas, so no "Show whole model" is offered — nothing to assert.`,
        })
        return
      }
      expect(after, 'instrument: no post-click reading').not.toBeNull()
      expect(
        after!.occluders.dock,
        'instrument: the dock disappeared across the click — the assertion below would be vacuous',
      ).toBe(true)
      expect(
        after!.behindDock,
        `"Show whole model" left ${after!.behindDock.length} of ${after!.modelNodeCount} model nodes behind the ` +
          `${after!.occluders.dockWidth}px OutputsDock (settled zoom ${after!.zoom.toFixed(4)}, ` +
          `notice ${JSON.stringify(after!.notice)})`,
      ).toEqual([])
    })
  }
}

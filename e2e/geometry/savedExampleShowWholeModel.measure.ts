/**
 * DOES "SHOW WHOLE MODEL" SHOW THE WHOLE MODEL ON A **SAVED EXAMPLE**?
 *
 * ⚠ RUN IT DELIBERATELY. `*.measure.ts` is not collected by the main e2e config
 * and no merge gate runs it:
 *
 *     GEOMETRY_PORT=5289 pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/savedExampleShowWholeModel.measure.ts
 *
 * ⭐ WHY IT EXISTS, AND WHY IT IS NOT `showWholeModel.measure.ts`.
 * That file names its state class in its own docblock: "FRESH seeded draft, no
 * prior camera". The RESTORE class — the product's own autosave rehydrated after
 * a reload, i.e. what a user gets when they re-open a saved example — has no
 * coverage of this button at all. `viewportRestoreFit.measure.ts` records that on
 * that path `layoutVersion` stays 0, which latches off BOTH of the fit owner's
 * triggers, so the graph keeps whatever xyflow's own `fitView` PROP produced at
 * mount. Whether the notice's button can still move the camera out of that state
 * is exactly the open question.
 *
 * ⭐ THIS FILE MEASURES; IT DOES NOT JUDGE.
 * Every arm emits one `SWMJSON` line and the only hard failures are INSTRUMENT
 * failures — a pane that cannot render, a starter that did not seed, a restore
 * that restored nothing. A product assertion here would abort the run on the
 * first bad arm and cost the other nineteen. The verdict is computed from the
 * emitted rows afterwards, where a non-reproduction is as reportable as a defect.
 *
 * ⭐ THE INSTRUMENT IS ASSERTED FIRST, EVERY ARM (CLAUDE.md trap 13).
 * `assertPaneCanRenderGeometry` is reproduced from
 * `ghostDoorVisibility.measure.ts:198` rather than imported, because importing a
 * `*.measure.ts` would re-register its whole suite inside this file. Its two real
 * discriminators are kept intact and are the ones that actually bite:
 * **rAF genuinely firing** and **innerWidth*innerHeight > 0**. Measuring a
 * synthetic element's rect is NOT among them and must not be added — a hidden
 * pane still returns a plausible rect, so a rect check is a control that cannot
 * fail. A prior reading of this very question was voided by exactly that.
 *
 * ⭐ NO `page.clock` HERE, DELIBERATELY. Under Playwright's clock, rAF and
 * setTimeout become two entries on ONE faked queue and cannot discriminate each
 * other; the reproduced guard handles that via `__pwClock.builtins`, but not
 * installing a clock at all means `window.requestAnimationFrame` is genuinely
 * native and the guard runs on its strongest branch. Geometry needs no frozen
 * time.
 *
 * ⭐ THE CAMERA IS SAMPLED OVER TIME, NOT ONCE.
 * The known defect shape on the FRESH path (`showWholeModel.measure.ts`) is
 * move-then-revert: the overview lands at t≈681ms and the camera is back at the
 * pre-click transform by t≈1279ms. A single post-click reading cannot tell
 * "never moved" from "moved and was taken back", and those have different causes
 * and different fixes. So the transform is sampled for 2.5s after the click and
 * both the settled value and whether it EVER differed are recorded.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft, type StarterId } from '../visual/harness'
import { OVERLAY_BAND_SELECTOR } from '../../src/canvas/utils/computeFitPadding'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

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

type StateClass = 'FRESH' | 'RESTORED'

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * REPRODUCED VERBATIM IN SUBSTANCE from `ghostDoorVisibility.measure.ts:198`.
 * See this file's header for why it is copied rather than imported. The two
 * load-bearing checks — real rAF, non-zero viewport — are unchanged.
 * ══════════════════════════════════════════════════════════════════════════════
 */
async function assertPaneCanRenderGeometry(page: Page): Promise<void> {
  const pane = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pwClock = (window as any).__pwClock
    const builtinRaf = pwClock?.builtins?.requestAnimationFrame
    const builtinTimer = pwClock?.builtins?.setTimeout
    const raf: typeof window.requestAnimationFrame = builtinRaf ?? window.requestAnimationFrame
    const timer: typeof window.setTimeout = builtinTimer ?? window.setTimeout

    const rafFired = await new Promise<boolean>((resolve) => {
      let settled = false
      raf.call(window, () => {
        if (!settled) {
          settled = true
          resolve(true)
        }
      })
      timer.call(
        window,
        () => {
          if (!settled) {
            settled = true
            resolve(false)
          }
        },
        3000,
      )
    })

    // A SUSTAINED frame count, not a single tick: a starved loop can emit one
    // frame and then stall, and one tick cannot tell that from a healthy pane.
    let frames = 0
    await new Promise<void>((resolve) => {
      const t0 = performance.now()
      const tick = () => {
        frames += 1
        if (performance.now() - t0 >= 500) resolve()
        else raf.call(window, tick)
      }
      raf.call(window, tick)
    })

    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      clientW: document.documentElement.clientWidth,
      clientH: document.documentElement.clientHeight,
      rafFired,
      frames,
      visibilityState: document.visibilityState,
      clockInstalled: !!pwClock,
      usedBuiltins: !!(builtinRaf && builtinTimer),
      windowRafIsNative: /\[native code\]/.test(String(window.requestAnimationFrame)),
    }
  })

  // eslint-disable-next-line no-console
  console.log(`SWMPANE ${JSON.stringify(pane)}`)

  expect(
    pane.usedBuiltins || pane.windowRafIsNative,
    'neither timing channel could be shown to be real — this guard would have raced two entries on the SAME faked queue and could not detect a non-painting pane.',
  ).toBe(true)

  expect(
    pane.innerW * pane.innerH,
    `the browser pane has no viewport (${pane.innerW}x${pane.innerH}, visibilityState="${pane.visibilityState}") — React Flow cannot measure in this state and every number below would be an artefact of the dead pane.`,
  ).toBeGreaterThan(0)

  expect(
    pane.clientW * pane.clientH,
    `the document has no layout box (${pane.clientW}x${pane.clientH}) — nothing has been laid out.`,
  ).toBeGreaterThan(0)

  expect(
    pane.rafFired,
    'requestAnimationFrame never fired — the render loop is starved, so an unchanged camera transform would prove NOTHING.',
  ).toBe(true)

  expect(
    pane.frames,
    `requestAnimationFrame produced only ${pane.frames} frames in 500ms — the render loop is starved.`,
  ).toBeGreaterThan(15)

  expect(pane.visibilityState, 'the page is in a HIDDEN tab — rAF is throttled or dead.').toBe(
    'visible',
  )
}

interface Reading {
  transform: string
  zoom: number
  x: number
  y: number
  /** DOM `.react-flow__node` elements, ghosts INCLUDED. */
  domNodeCount: number
  /** DOM nodes whose id starts with GHOST_ID_PREFIX. */
  ghostNodeCount: number
  /** DOM nodes that are model nodes (ghosts excluded). */
  modelNodeCount: number
  /** `useCanvasStore.getState().nodes.length`. */
  storeNodeCount: number
  /** Store nodes that are model nodes. */
  storeModelNodeCount: number
  layoutVersion: number
  /** Exact text of `[data-testid="model-extent-count"]`, or null if absent. */
  notice: string | null
  noticePresent: boolean
  showAllPresent: boolean
  /** Model nodes outside the genuinely-visible canvas (dock/sidebar/banner excluded). */
  outsideVisible: string[]
  /** Model nodes outside the pane entirely. */
  outsidePane: string[]
  /** How the visible frame was computed, echoed so the number is auditable. */
  frame: { left: number; right: number; top: number; bottom: number }
  occluders: { dock: boolean; sidebar: boolean; banner: boolean; dockByTestId: boolean; band: boolean }
  flowCount: number
}

/**
 * The genuinely-visible canvas: the flow rect less the three occluders
 * `computeFitPadding` reserves for. Read from LIVE rects, never named numbers —
 * identical in method to `showWholeModel.measure.ts:frameOf`, so the two files'
 * numbers are comparable. `dockByTestId` is recorded only to prove the two
 * selectors resolve to the same element.
 */
async function readingOf(page: Page): Promise<Reading> {
  return page.evaluate(({ ghostPrefix, bandSelector }: { ghostPrefix: string; bandSelector: string }) => {
    const flowEl = document.querySelector('.react-flow')
    const flow = flowEl!.getBoundingClientRect()
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const transform = vpEl ? getComputedStyle(vpEl).transform : 'NO-VIEWPORT-EL'
    const m = vpEl ? new DOMMatrixReadOnly(transform) : null

    const rectOf = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    }
    const dock = rectOf('aside[aria-label="Outputs dock"]')
    const dockByTestId = rectOf('[data-testid="outputs-dock"]')
    const sidebar = rectOf('nav[aria-label="Canvas tools"]')
    const banner = rectOf('[role="banner"]')
    // ⭐⭐ THE FOURTH OCCLUDER. The bottom edge was `flow.bottom` — the pane's own
    // edge — which counts the strip the canvas overlay band occupies as visible
    // canvas. It is not: the band sits at `z-index 250` over the flow, it is a
    // PERMANENT reservation rather than a conditional one, and
    // `computeFitPadding` reserves for it by exactly this measurement. So every
    // `outsideVisible` this file has ever emitted was an UNDERCOUNT (one measured
    // case: 2 reported where 6 were occluded), and this file's whole output is
    // before/after comparison — an instrument with a systematic undercount is
    // not a comparison, it is a bias.
    //
    // ⚠ IMPORTED, NOT RESTATED: `src/canvas/utils/computeFitPadding.ts` has ZERO
    // imports and is a pure DOM-measurement module, so taking its selector pulls
    // no React into `tsconfig.tooling.json` and mints no mirror.
    const band = rectOf(bandSelector)

    const visible = {
      left: sidebar ? sidebar.right : flow.left,
      right: dock ? dock.left : flow.right,
      top: banner ? banner.bottom : flow.top,
      bottom: band ? band.top : flow.bottom,
    }

    const els = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const all = els.map((el) => ({ id: el.getAttribute('data-id') ?? '', r: el.getBoundingClientRect() }))
    const model = all.filter((n) => !n.id.startsWith(ghostPrefix))

    const out = (box: { left: number; right: number; top: number; bottom: number }) =>
      model
        .filter(
          (n) => n.r.left < box.left || n.r.right > box.right || n.r.top < box.top || n.r.bottom > box.bottom,
        )
        .map((n) => n.id)
        .sort()

    const w = window as unknown as {
      useCanvasStore: { getState: () => { nodes: Array<{ id: string }>; layoutVersion: number } }
    }
    const store = w.useCanvasStore.getState()

    return {
      transform,
      zoom: m ? m.a : NaN,
      x: m ? m.e : NaN,
      y: m ? m.f : NaN,
      domNodeCount: all.length,
      ghostNodeCount: all.length - model.length,
      modelNodeCount: model.length,
      storeNodeCount: store.nodes.length,
      storeModelNodeCount: store.nodes.filter((n) => !n.id.startsWith(ghostPrefix)).length,
      layoutVersion: store.layoutVersion,
      notice: document.querySelector('[data-testid="model-extent-count"]')?.textContent ?? null,
      noticePresent: !!document.querySelector('[data-testid="model-extent-notice"]'),
      showAllPresent: !!document.querySelector('[data-testid="model-extent-show-all"]'),
      outsideVisible: out(visible),
      outsidePane: out({ left: flow.left, right: flow.right, top: flow.top, bottom: flow.bottom }),
      frame: visible,
      occluders: {
        dock: dock !== null,
        sidebar: sidebar !== null,
        banner: banner !== null,
        dockByTestId: dockByTestId !== null,
        // Reported so a reading taken with the band ABSENT — where `bottom`
        // falls back to the pane edge and the frame is the old, blind one —
        // cannot be read as a reading that accounted for it.
        band: band !== null,
      },
      flowCount: document.querySelectorAll('.react-flow').length,
    }
  }, { ghostPrefix: GHOST_ID_PREFIX, bandSelector: OVERLAY_BAND_SELECTOR })
}

/**
 * ⭐⭐ THE LATCH IS CLEARED BEFORE EVERY WAIT, AND WITHOUT THAT THESE HELPERS
 * RETURN TRUE HAVING WAITED FOR NOTHING.
 *
 * `waitForFunction` evaluates its predicate IN THE PAGE, so `__swmLastT` /
 * `__swmSince` are page globals that SURVIVE the call that wrote them. On every
 * call after the first, the predicate's opening poll finds `__swmLastT` already
 * equal to the current transform and `__swmSince` set seconds ago, so
 * `now - __swmSince >= stable` holds on poll one and the helper resolves
 * IMMEDIATELY — inside the ~160ms before a newly-started camera animation paints
 * its first frame. Whatever is read next is the PREVIOUS camera.
 *
 * ⚠ AND THE DIRECTION OF THE ERROR IS THE EXPENSIVE ONE: this cannot hang and
 * cannot time out, so it never presents as an instrument failure. It presents as
 * a PRODUCT DEFECT — "the camera never moved" — and it produced exactly that
 * false red on 2 Sep 2026. Clearing first makes the stability window one this
 * call OBSERVED rather than one it inherited. `layoutSettled` carries the same
 * defect with `__swmLastLv`/`__swmLvSince` and is fixed the same way: the class,
 * not the instance that happened to be caught.
 */
async function clearSettleLatch(page: Page, keys: readonly string[]): Promise<void> {
  await page.evaluate((ks: readonly string[]) => {
    for (const k of ks) delete (window as unknown as Record<string, unknown>)[k]
  }, keys)
}

/** Block until the rendered transform has not moved for `stableMs`. */
async function cameraSettled(page: Page, stableMs = 500, timeoutMs = 20_000): Promise<void> {
  await clearSettleLatch(page, ['__swmLastT', '__swmSince'])
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as { __swmLastT?: string; __swmSince?: number }
      const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!el) return false
      const t = getComputedStyle(el).transform
      const now = performance.now()
      if (w.__swmLastT !== t) {
        w.__swmLastT = t
        w.__swmSince = now
        return false
      }
      return now - (w.__swmSince ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 50 },
  )
}

/** Block until `layoutVersion` has not moved for `stableMs`. */
async function layoutSettled(page: Page, stableMs = 1200, timeoutMs = 40_000): Promise<void> {
  await clearSettleLatch(page, ['__swmLastLv', '__swmLvSince'])
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => { layoutVersion: number; pendingLayout: boolean; layoutInProgress: boolean }
        }
        __swmLastLv?: number
        __swmLvSince?: number
      }
      const s = w.useCanvasStore.getState()
      if (s.pendingLayout || s.layoutInProgress) return false
      const now = performance.now()
      if (w.__swmLastLv !== s.layoutVersion) {
        w.__swmLastLv = s.layoutVersion
        w.__swmLvSince = now
        return false
      }
      return now - (w.__swmLvSince ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 100 },
  )
}

/**
 * Sample the rendered transform every ~50ms for `durationMs`, in the PAGE, so
 * the sampling is not bottlenecked by CDP round-trips. Distinguishes "the camera
 * never moved" from "the camera moved and was taken back".
 */
async function sampleTransform(
  page: Page,
  durationMs: number,
): Promise<{ samples: Array<{ t: number; transform: string }>; distinct: string[] }> {
  return page.evaluate(async (ms: number) => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const samples: Array<{ t: number; transform: string }> = []
    const t0 = performance.now()
    let last = ''
    while (performance.now() - t0 < ms) {
      const t = el ? getComputedStyle(el).transform : 'NO-VIEWPORT-EL'
      if (t !== last) {
        samples.push({ t: Math.round(performance.now() - t0), transform: t })
        last = t
      }
      await new Promise((r) => setTimeout(r, 50))
    }
    return { samples, distinct: [...new Set(samples.map((s) => s.transform))] }
  }, durationMs)
}

async function pinFlags(page: Page, keepStorage: boolean): Promise<void> {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins, keep }: { flagPins: Array<{ storageKey: string; value: string }>; keep: boolean }) => {
      try {
        // ⚠ THE RESTORE CLASS DEPENDS ON THIS BRANCH. Clearing localStorage on
        // every navigation would wipe the autosave the product's own restore
        // path reads, so a reload after it is not the restore class at all.
        // `sessionStorage` survives a reload and `localStorage.clear()` does not
        // touch it, so it is the once-per-tab marker.
        if (!keep) {
          localStorage.clear()
          sessionStorage.clear()
        } else if (!sessionStorage.getItem('__swmPrepared')) {
          localStorage.clear()
          sessionStorage.clear()
          sessionStorage.setItem('__swmPrepared', '1')
        }
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch {
        /* the instrument assertions catch a dead storage */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })), keep: keepStorage },
  )
}

async function waitForCanvasReady(page: Page): Promise<void> {
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 120_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore
        ?.getState === 'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
}

for (const size of SIZES) {
  for (const starter of STARTERS) {
    for (const stateClass of ['FRESH', 'RESTORED'] as StateClass[]) {
      test(`${stateClass} ${starter} @${size.width}x${size.height}`, async ({ page }) => {
        test.setTimeout(240_000)
        const consoleLines: string[] = []
        page.on('console', (msg) => {
          const t = msg.text()
          if (/\[layout\]|fallback heights|Warning|error/i.test(t)) consoleLines.push(t.slice(0, 300))
        })

        await pinFlags(page, stateClass === 'RESTORED')
        await page.setViewportSize(size)
        // Reduced motion collapses `cameraDuration` to 0, so a working fit lands
        // instantly and "did it move" is not a race against a 400ms transition.
        // The move-then-revert shape is still caught by `sampleTransform`.
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
        await page.route('**/*', (r) => {
          const u = new URL(r.request().url())
          return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
        })

        await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
        await waitForCanvasReady(page)

        // ── INSTRUMENT FIRST, ALWAYS. A hard error, never a skip. ────────────
        await assertPaneCanRenderGeometry(page)

        const seeded = await seedStarterDraft(page, starter)
        await layoutSettled(page)
        await cameraSettled(page)

        if (stateClass === 'RESTORED') {
          // The product's own restore path: reload and let the autosave rehydrate.
          await page.reload({ waitUntil: 'domcontentloaded' })
          await waitForCanvasReady(page)
          await assertPaneCanRenderGeometry(page)
          await page.waitForFunction(
            () =>
              (window as unknown as { useCanvasStore: { getState: () => { nodes: unknown[] } } })
                .useCanvasStore.getState().nodes.length > 0,
            undefined,
            { timeout: 40_000 },
          )
          await page.evaluate(() => document.fonts?.ready)
          await cameraSettled(page)
          // Let any post-restore settling finish without forcing a layout.
          await page.waitForTimeout(1_500)
        }

        const before = await readingOf(page)

        // ── INSTRUMENT VALIDITY, per arm ────────────────────────────────────
        expect(before.flowCount, 'more than one .react-flow — measurements ambiguous').toBe(1)
        expect(
          before.storeNodeCount,
          `${stateClass}: nothing in the store — this arm did not reach its state class`,
        ).toBeGreaterThan(0)
        expect(
          before.modelNodeCount,
          `${stateClass}: no model nodes rendered — every geometry number would be vacuous`,
        ).toBeGreaterThan(0)
        if (stateClass === 'RESTORED') {
          expect(
            before.storeNodeCount,
            'the reload did not reproduce the restore path — store count differs from what was seeded',
          ).toBe(seeded.nodeCount)
        }

        // ── THE CLICK ───────────────────────────────────────────────────────
        let after: Reading | null = null
        let sampled: { samples: Array<{ t: number; transform: string }>; distinct: string[] } | null = null
        let clicked = false

        if (before.showAllPresent) {
          const btn = page.locator('[data-testid="model-extent-show-all"]')
          await btn.click()
          clicked = true
          sampled = await sampleTransform(page, 2_500)
          await cameraSettled(page).catch(() => undefined)
          after = await readingOf(page)
        }

        // eslint-disable-next-line no-console
        console.log(
          `SWMJSON ${JSON.stringify({
            sha: 'f59ffc26810e46c42e85e556d7f54d73a8786dab',
            artefact: 'local-vite-dev-server',
            stateClass,
            starter,
            viewport: `${size.width}x${size.height}`,
            seeded,
            clicked,
            before,
            after,
            transformChanged: after ? after.transform !== before.transform : null,
            // Did THIS arm demonstrate the probe can return a non-empty answer?
            contrastEstablished: before.outsideVisible.length > 0,
            everMoved: sampled ? sampled.distinct.length > 1 : null,
            returnedToStart: sampled && after ? after.transform === before.transform : null,
            sampleCount: sampled ? sampled.samples.length : null,
            samples: sampled ? sampled.samples : null,
            console: consoleLines.slice(0, 12),
          })}`,
        )

        /*
         * ── THE ONE PRODUCT ASSERTION ────────────────────────────────────────
         *
         * The button's whole promise: after it is pressed, no model node is left
         * outside the genuinely-visible canvas. Guarded on the button existing,
         * because `ModelExtentNotice` renders `null` when nothing is out of
         * frame — 3 of 20 arms are legitimately in that state and an
         * unconditional assertion would fail them for being CORRECT.
         *
         * ⚠ AND THE PRECONDITION THAT IS DELIBERATELY *NOT* ASSERTED. The
         * obvious contrast control — "before the click, something must be
         * outside" — is FALSE on a real arm and would be a fabricated
         * precondition. Measured on this tip, RESTORED/pricing-model @1440x900:
         * the notice reads "Showing 14 of 15 elements" while this file's
         * occluder frame finds ZERO nodes outside. The two frames are different
         * questions — the notice counts against the PADDED fit frame
         * (`computeFitPadding` insets), this file against the raw occluder
         * frame — so they may legitimately disagree by a node at the margin.
         * The contrast is therefore established ACROSS arms and recorded as
         * `contrastEstablished`, not asserted per arm.
         *
         * The probe's discriminating power is evidenced rather than assumed:
         * the SAME function on the SAME page returned 11 ids before the click
         * and 0 after it, so an empty result is a measurement and not a blind
         * instrument returning its default.
         */
        if (clicked && after) {
          expect(
            after.outsideVisible,
            `"Show whole model" left ${after.outsideVisible.length} of ${after.modelNodeCount} model nodes outside the visible canvas (${stateClass} ${starter} @${size.width}x${size.height})`,
          ).toEqual([])
        }
      })
    }
  }
}

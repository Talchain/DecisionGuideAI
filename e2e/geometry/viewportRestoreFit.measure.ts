/**
 * THE RESTORE FIT — real Chromium, real reload, real geometry.
 *
 * ⚠ RUN IT DELIBERATELY. It is a `*.measure.ts`, so the main e2e config cannot
 * collect it, and **`Staging Gate` runs no Playwright job at all** (the gate is
 * `tsc` / `typecheck-selftest` / `vitest` / `vitest-summary` / `build` —
 * `.github/workflows/staging-full-tests.yml`). Nothing here gates a merge; the
 * gated half of this fix is
 * `src/canvas/__tests__/useFitViewOnLayoutVersion.restore.spec.tsx`.
 *
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/viewportRestoreFit.measure.ts
 *
 * WHY IT EXISTS. jsdom cannot prove a rendered transform or a node's position on
 * screen (CLAUDE.md trap 3), and presence assertions are exactly what stayed
 * green while this shipped. The postcondition here is BEHAVIOURAL and PIXEL-LEVEL:
 * after a reload the camera must have been aimed at the restored model, the frame
 * must follow the window, and no model node may sit off-screen or behind the
 * floating header banner.
 *
 * ⚠ READ THE SCOPE OF EACH ARM. Two lanes measured this build and appeared to
 * disagree; the third test in this file reconciles them, and BOTH readings are
 * recorded here as true. What is NOT true, and must not be repeated: "the
 * viewport controls are inert after a reload" and "the restore never re-fits".
 * The second test below asserts the controls ARE live, precisely so this file
 * cannot be cited for the refuted claim.
 *
 * MEASURED AT PRISTINE (frozen base `2b6ec553`), headed, instrument asserted
 * live: `layoutVersion` stays 0 on every restore path, which latches off both
 * of the fit owner's triggers, so the graph keeps whatever xyflow's own
 * `fitView` PROP produced at mount — with xyflow's DEFAULT padding, carrying
 * none of `computeFitPadding`'s reservations. Reloading AT each size, the
 * Decision node lands behind the floating header banner at 1280x800 (clean at
 * 1440x900 and 1512x982); reloading once and then RESIZING, the frame does not
 * follow the window at all.
 *
 * STATE CLASS IS NAMED, NEVER ASSUMED (status-ladder fixture rule): the FRESH
 * case is the POSITIVE CONTROL — it passed at pristine and must keep passing, so
 * a failure in the RESTORE case is about the restore and not about the probe.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import {
  openCanvas,
  freezeMotion,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  FROZEN_TIME,
} from '../visual/harness'

const GHOST = '__ghost-option__'
const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 982 },
]

/**
 * `harness.preparePage` clears storage on EVERY navigation, which would wipe the
 * autosave the product's own restore path reads — so a reload after it is not the
 * restore state class at all. This clears once per tab: `sessionStorage` survives
 * a reload and `localStorage.clear()` does not touch it, so it is the marker.
 */
async function prepareKeepingStorage(page: Page, vp: { width: number; height: number }) {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        if (!sessionStorage.getItem('__restoreProbePrepared')) {
          localStorage.clear()
          sessionStorage.clear()
          sessionStorage.setItem('__restoreProbePrepared', '1')
        }
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch { /* the visible-anchor assertions below catch a dead storage */ }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize(vp)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.clock.setFixedTime(FROZEN_TIME)
  await page.route('**/bff/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })
}

interface Frame {
  transform: string
  layoutVersion: number
  storeNodeCount: number
  modelNodeCount: number
  flowCount: number
  /** Model nodes whose rendered box leaves the pane. */
  offPane: string[]
  /** Model nodes whose rendered box intersects the floating header banner. */
  behindBanner: string[]
  bannerFound: boolean
}

async function frameOf(page: Page): Promise<Frame> {
  return page.evaluate((ghost: string) => {
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    const banner = document.querySelector('[role="banner"]')?.getBoundingClientRect() ?? null
    const store = (window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string }>; layoutVersion: number } } }).useCanvasStore.getState()
    const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
    const model = els.filter((e) => e.dataset.id !== ghost)
    const offPane: string[] = []
    const behindBanner: string[] = []
    for (const el of model) {
      const r = el.getBoundingClientRect()
      if (r.left < flow.left || r.top < flow.top || r.right > flow.right || r.bottom > flow.bottom) {
        offPane.push(el.dataset.id!)
      }
      if (banner && r.left < banner.right && r.right > banner.left && r.top < banner.bottom && r.bottom > banner.top) {
        behindBanner.push(el.dataset.id!)
      }
    }
    return {
      transform: vpEl ? getComputedStyle(vpEl).transform : 'NO-VIEWPORT-EL',
      layoutVersion: store.layoutVersion,
      storeNodeCount: store.nodes.length,
      modelNodeCount: model.length,
      flowCount: document.querySelectorAll('.react-flow').length,
      offPane,
      behindBanner,
      bannerFound: banner !== null,
    }
  }, GHOST)
}

function report(phase: string, extra: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`RESTOREFIT ${JSON.stringify({ phase, ...extra })}`)
}

test('the restored model is framed, and the frame follows the window', async ({ page }) => {
  test.setTimeout(600_000)
  await prepareKeepingStorage(page, SIZES[0])
  await openCanvas(page)

  /* ── POSITIVE CONTROL: the FRESH state class ──────────────────────────── */
  const seeded = await seedStarterDraft(page, 'vendor-selection')
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  /* ── INSTRUMENT VALIDITY — PROVE THE BROWSER IS ALIVE BEFORE TRUSTING A WORD
   * OF IT (added 20 Aug 2026 after a sibling instrument was refuted).
   *
   * A page rendered in a PERMANENTLY HIDDEN tab reproduces the exact symptom
   * this file exists to measure: `requestAnimationFrame` never fires, so every
   * camera move — which xyflow drives through a d3 transition on rAF —
   * silently no-ops, and the viewport transform reads BYTE-IDENTICAL at every
   * window size. A blind instrument and a broken product are indistinguishable
   * from the output alone. So the instrument is asserted first, and loudly.
   */
  const liveness = await page.evaluate(async () => {
    let frames = 0
    await new Promise<void>((resolve) => {
      const t0 = performance.now()
      const tick = () => {
        frames += 1
        if (performance.now() - t0 >= 600) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    return { frames, visibility: document.visibilityState, innerWidth: window.innerWidth, innerHeight: window.innerHeight }
  })
  report('instrument', liveness)
  expect(liveness.visibility, 'the page is in a HIDDEN tab — rAF is starved and every camera measurement below is worthless').toBe('visible')
  expect(liveness.innerWidth, 'window.innerWidth is 0 — this surface is not laying the page out').toBeGreaterThan(0)
  expect(liveness.frames, 'requestAnimationFrame produced almost no frames in 600ms — the render loop is starved, so an unchanged transform proves NOTHING').toBeGreaterThan(20)

  const fresh = await frameOf(page)
  report('fresh', { seeded, ...fresh })
  // The probe must be able to SEE the properties it will assert about, or an
  // absence of complaints proves nothing (trap 13).
  expect(fresh.bannerFound, 'no [role="banner"] — the behind-banner check would be vacuous').toBe(true)
  expect(fresh.modelNodeCount, 'no model nodes rendered — every geometry check below would be vacuous').toBeGreaterThan(0)
  expect(fresh.layoutVersion, 'fresh draft never laid out — this is not the fresh state class').toBeGreaterThan(0)
  expect(fresh.flowCount, 'more than one .react-flow — the measurements would be ambiguous').toBe(1)
  expect(fresh.behindBanner, 'FRESH: a model node sits behind the header banner — the control itself is broken').toEqual([])
  // ⚠ REPORTED, NOT FIXED, AND DELIBERATELY NOT ASSERTED TO BE EMPTY.
  // Measured 20 Aug 2026 on the FRESH path at 1280x800, with a completed layout
  // and the canonical panel-aware fit: `offPane: ["goal_cdp"]` in two of three
  // runs. It tracks the fresh fit zoom, which itself varied run to run
  // (0.622103 vs 0.594549) — i.e. the fresh path's own last fit sometimes lands
  // against a reserved box that has since moved. So "no model node is ever
  // off-screen at fit" is NOT a property this product currently has, on either
  // state class, and asserting it here would be this lane silently adopting a
  // second defect (and an intermittent one, which is how a harness gets muted).
  // The restore case below is therefore held to the product's OWN standard —
  // no worse than its fresh fit at the same window — which is exactly the claim
  // this lane is entitled to make.
  const freshOffPane = new Set(fresh.offPane)

  /* ── THE SUBJECT: the RESTORE state class ─────────────────────────────── */
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(
    () => typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState === 'function',
    undefined, { timeout: 30_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
  await freezeMotion(page)
  await page.waitForFunction(
    () => ((window as unknown as { useCanvasStore: { getState: () => { nodes: unknown[] } } }).useCanvasStore.getState().nodes.length) > 0,
    undefined, { timeout: 30_000 },
  )
  await clearNotifications(page).catch(() => undefined)
  await minimiseFloatingOlumiPanel(page).catch(() => undefined)
  await waitForVisualQuiescence(page)

  const frames: Frame[] = []
  for (const vp of SIZES) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(1_500)
    const f = await frameOf(page)
    report('restore', { vp: `${vp.width}x${vp.height}`, ...f })
    frames.push(f)
  }

  // PIN THE PRECONDITION: this must still be the state class the defect lives
  // in. If a layout ran, the LAYOUT trigger aimed the camera and this proves
  // nothing about the restore path.
  expect(frames[0].layoutVersion, 'a layout ran on reload — no longer the restore state class').toBe(0)
  expect(frames[0].storeNodeCount, 'nothing was restored — the reload did not reproduce the restore path')
    .toBe(seeded.nodeCount)
  expect(frames[0].modelNodeCount, 'no model nodes rendered after restore').toBeGreaterThan(0)
  expect(frames[0].bannerFound).toBe(true)

  // (a) THE FRAME FOLLOWS THE WINDOW. At pristine all three were the byte-identical
  //     `matrix(0.666667, 0, 0, 0.666667, 196, 20)`.
  const transforms = frames.map((f) => f.transform)
  expect(new Set(transforms).size, `viewport transform never changed with the window: ${JSON.stringify(transforms)}`)
    .toBe(SIZES.length)

  // (b) NOTHING BEHIND THE HEADER BANNER, at every size. The UX gate measured
  //     the Decision node 31px / 24.4% behind it on the restore path, with 2 of 4
  //     hit-test probes returning the banner's own controls. `computeFitPadding`
  //     has reserved the banner since #786 (`a3938981`) — it simply was never
  //     APPLIED on this path, because no fit ever ran.
  for (let i = 0; i < SIZES.length; i++) {
    const size = `${SIZES[i].width}x${SIZES[i].height}`
    expect(frames[i].behindBanner, `RESTORE @${size}: model nodes behind the header banner`).toEqual([])
  }

  // (c) NO WORSE OFF-SCREEN THAN THE PRODUCT'S OWN FRESH FIT at the same window.
  //     At pristine the restored graph was framed by xyflow's DEFAULT padding and
  //     the UX gate measured 1 node fully hidden and 4 more >=5% clipped at
  //     1280x800; the fresh fit at that size hides `freshOffPane` and no more.
  const restoreOffPane1280 = frames[0].offPane
  report('offPaneComparison', { fresh: [...freshOffPane], restore: restoreOffPane1280 })
  expect(
    restoreOffPane1280.filter((id) => !freshOffPane.has(id)),
    `RESTORE @1280x800: model nodes off-screen that the fresh fit at the same window keeps on-screen`,
  ).toEqual([])
})

/**
 * The four viewport controls, after a reload.
 *
 * ⚠ ACTIVATED BY KEYBOARD. A mouse click is intercepted by the Tooltip portal the
 * previous hover leaves behind — measured in this harness: `.click()` retried 230
 * times against `div[role="tooltip"]` and never landed. Keyboard activation is a
 * real user path and routes round it, so an inert result here is the control's
 * doing and not the tooltip's. (Same occlusion class `harness.minimiseFloatingOlumiPanel`
 * records; it is why a mouse-driven probe can report a working control as dead.)
 */
test('the four viewport controls move the camera after a reload', async ({ page }) => {
  test.setTimeout(600_000)
  await prepareKeepingStorage(page, SIZES[0])
  await openCanvas(page)
  await seedStarterDraft(page, 'vendor-selection')
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(
    () => ((window as unknown as { useCanvasStore?: { getState?: () => { nodes: unknown[] } } }).useCanvasStore?.getState?.().nodes.length ?? 0) > 0,
    undefined, { timeout: 30_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
  await freezeMotion(page)
  await clearNotifications(page).catch(() => undefined)
  await minimiseFloatingOlumiPanel(page).catch(() => undefined)
  await waitForVisualQuiescence(page)

  const nav = page.locator('nav[aria-label="Viewport controls"]')
  const controls: Array<{ label: string; name: string | RegExp }> = [
    { label: 'Fit to view', name: 'Fit to view' },
    { label: 'Zoom in', name: 'Zoom in' },
    { label: 'Zoom out', name: 'Zoom out' },
    { label: 'Zoom reset', name: /Click to reset to 100%/ },
  ]

  for (const { label, name } of controls) {
    const before = (await frameOf(page)).transform
    const btn = nav.getByRole('button', { name })
    await expect(btn, `${label}: not found`).toHaveCount(1)
    await expect(btn, `${label}: disabled`).toBeEnabled()
    await btn.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(700)
    const after = (await frameOf(page)).transform
    report('control', { control: label, before, after, changed: before !== after })
    expect(after, `${label} did not move the camera after a reload (inert control)`).not.toBe(before)
  }
})

/**
 * THE ARRIVE-AT-SIZE PROTOCOL — the same question asked the other way, because
 * two lanes measured this build and appeared to disagree (20 Aug 2026).
 *
 * The other lane RELOADED AT each viewport and found the arrival transform
 * DIFFERENT at every size, concluding "it is a per-viewport auto-fit, the
 * restore does re-fit". This lane reloaded ONCE and then RESIZED, and found the
 * transform BYTE-IDENTICAL at every size.
 *
 * BOTH ARE TRUE, AND ONE MECHANISM EXPLAINS BOTH: xyflow's own `fitView` PROP
 * fits once at mount, against whatever the pane measured at that instant — so
 * arriving at a different size gives a different frame — while the PRODUCT's
 * fit owner (`useFitViewOnLayoutVersion`) never runs at all on a restored
 * graph, so nothing re-frames when the window later changes. A per-viewport
 * arrival fit is not evidence that the product re-fits; it is evidence that
 * xyflow mounted.
 *
 * ⭐ AND THE HARM DOES NOT DEPEND ON WHICH PROTOCOL YOU USE, which is why this
 * arm exists: xyflow's prop fit uses xyflow's DEFAULT padding and knows nothing
 * about `[role="banner"]`, the OutputsDock or the LeftSidebar. The banner inset
 * added in #786 lives in `computeFitPadding`, and `computeFitPadding` is only
 * ever reached through the fit owner. So on the restore path the top row of the
 * model lands under the floating header at EVERY viewport, however you arrive.
 */
test('arriving at a size still lands the model under the header banner (the other lane\'s protocol)', async ({ page }) => {
  test.setTimeout(600_000)
  await prepareKeepingStorage(page, SIZES[0])
  await openCanvas(page)
  await seedStarterDraft(page, 'vendor-selection')
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  const arrivals: Frame[] = []
  for (const vp of SIZES) {
    // Size FIRST, then reload — so each arrival gets its own mount-time fit.
    await page.setViewportSize(vp)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
    await page.waitForFunction(
      () => ((window as unknown as { useCanvasStore?: { getState?: () => { nodes: unknown[] } } }).useCanvasStore?.getState?.().nodes.length ?? 0) > 0,
      undefined, { timeout: 30_000 },
    )
    await page.evaluate(() => document.fonts?.ready)
    await freezeMotion(page)
    await clearNotifications(page).catch(() => undefined)
    await minimiseFloatingOlumiPanel(page).catch(() => undefined)
    await waitForVisualQuiescence(page)
    const f = await frameOf(page)
    report('arrive', { vp: `${vp.width}x${vp.height}`, ...f })
    arrivals.push(f)
  }

  // The arrival transform DOES vary by size — xyflow's prop fit ran at each
  // mount. Asserted so this file records the other lane's finding as TRUE.
  expect(new Set(arrivals.map((a) => a.transform)).size,
    'arrival transforms did not vary by viewport — then even xyflow\'s own mount fit is not running').toBe(SIZES.length)
  // …and every arrival is still a restore (no product layout ran).
  for (const a of arrivals) expect(a.layoutVersion, 'a layout ran — not the restore state class').toBe(0)

  // THE CLAIM THAT SURVIVES BOTH PROTOCOLS.
  for (let i = 0; i < SIZES.length; i++) {
    expect(arrivals[i].behindBanner, `ARRIVE @${SIZES[i].width}x${SIZES[i].height}: model nodes behind the header banner`).toEqual([])
  }
})

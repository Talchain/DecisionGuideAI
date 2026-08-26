/**
 * Visual-regression harness — deterministic seeding, freezing and capture.
 *
 * WHY THIS EXISTS
 * ---------------
 * Between 2026-08-15 and 2026-08-17 roughly fifteen UI PRs merged, every one
 * green, and together they shipped a layout regression that only the founder's
 * eyes caught. The founder was the programme's only instrument capable of
 * seeing a visual/layout defect. This harness is the instrument that replaces
 * him in that role.
 *
 * WHAT IT GUARANTEES, AND WHY EACH GUARANTEE IS HERE
 * --------------------------------------------------
 * 1. DETERMINISM. A harness that flakes gets muted inside a week and is then
 *    strictly worse than nothing, because it also consumes the attention that
 *    would have gone to looking. Everything time-, animation-, network- or
 *    layout-timing dependent is pinned: fixed clock, zeroed animations and
 *    transitions, `reducedMotion: reduce`, hermetic network, and a wait on the
 *    layout store reaching QUIESCENCE (`!pendingLayout && !layoutInProgress &&
 *    layoutVersion > 0`) rather than on a sleep.
 *
 * 2. IT CAN FAIL. Every guarantee below exists because this estate has shipped
 *    its negation:
 *      - the reference must EXIST and be SUBSTANTIVE before it is trusted. A
 *        blank capture compared against a blank reference agrees perfectly and
 *        exits 0 (trap 13: an absence probe with no positive control). So the
 *        reference is decoded, its dimensions checked against the viewport, and
 *        its pixels checked to be non-uniform, BEFORE any comparison.
 *      - a missing reference is a HARD FAILURE, never a silent write.
 *        `updateSnapshots: 'none'` in the config plus the explicit existence
 *        check here means a first run on a new platform reds with instructions
 *        instead of blessing whatever it happened to render (and cannot pass on
 *        a retry that finds the file the first attempt wrote).
 *      - every capture is recorded in a MANIFEST and asserted BY NAME in
 *        `globalTeardown.ts` — in teardown, not in a spec, so `--grep` cannot
 *        exclude the check that proves the run measured anything. A run that
 *        captures nothing must not be able to report success. (A check in this
 *        repo reported SUCCESS having run nothing for 204 days.)
 *
 * 3. IT BINDS BY IDENTITY. Every state asserts named `data-testid`/ARIA anchors
 *    that must be visible before the shutter opens, so the harness fails loud
 *    when a flag move or a refactor stops mounting the surface, rather than
 *    quietly screenshotting a different screen (traps 3b and 19).
 *
 * SEEDING
 * -------
 * The five starter decisions in `src/canvas/starters/data/*.draft.json` are
 * VERBATIM captured `POST /assist/v1/draft-graph` response bodies from live
 * CEE, committed with provenance and drift-guarded in CI by
 * `pnpm ci:guard:starters`. They are therefore real wire payloads, not
 * fixtures written from an author's head (trap 16-inverse), and they are the
 * only backend-free way to reach a real, fully-hydrated model. They are applied
 * through the product's own `applyDraftResult`, dynamic-imported from Vite's
 * module graph — the mechanism already proven in
 * `e2e/canvas.layout-regression-v5-fresh-draft.spec.ts`.
 *
 * NOTE: the `/src/...` dynamic import resolves through Vite's module graph, so
 * this harness requires `vite dev` and will NOT work against a built `dist`.
 */

import { expect, type Page, type TestInfo } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, appendFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { PNG } from 'pngjs'
import { repoRoot } from './repoRoot'
import { posturePins, postureFingerprint, unmappedNetlifyFlags } from './flagPosture'

export const REFERENCE_ROOT = join(repoRoot(), 'e2e', 'visual', 'references')
export const MANIFEST_PATH = join(repoRoot(), 'test-results', 'visual-manifest.txt')

/*
 * SUBSTANTIVE-REFERENCE FLOORS — calibrated against the real references, not
 * guessed. Measured on the darwin set captured at 289b730d (2026-08-17), weakest
 * first:
 *
 *   reference                             dims        size  colours  non-modal
 *   olumi-tab--1440x900                   416x872     20 KB      64      3.2%  <- floor-setter
 *   blocked-provisional--1440x900         416x872     74 KB      89     10.5%
 *   model-tab--1440x900                   416x872     89 KB      81     11.9%
 *   fresh-draft--1440x900                1440x900    279 KB     260     45.1%
 *   graph-default-zoom--1440x900         1440x900    313 KB     263     54.2%
 *
 * A blank/white/error page of the same dimensions is ~2-7 KB, 1-3 quantised
 * colours and ~0% non-modal. The floors sit well below the weakest real
 * reference and well above a blank one, so they discriminate the case they exist
 * for without being tripped by a legitimately sparse panel.
 *
 * (The first cut used a 200-colour floor — above the real value for every
 * narrow-panel reference — and rejected four of them. Floors written from
 * intuition rather than measurement fail in whichever direction you were not
 * thinking about. Re-measured after the 416px dock restore: the minima moved
 * 66->64 colours and 4.2%->3.2% non-modal, and the floors still hold.)
 */
const MIN_REFERENCE_BYTES = 8_000
const MIN_DISTINCT_QUANTISED_COLOURS = 40
const MIN_NON_MODAL_PIXEL_FRACTION = 0.015

/* ── Viewports ────────────────────────────────────────────────────────────
 *
 * Two representative laptop sizes, and the justification for each:
 *
 *  1280x800  — the smallest desktop this product commits to. DS v5 names
 *              1280 as the desktop minimum and the repo's two existing visual
 *              baselines already use 1280 (`e2e/sandbox.visual.spec.ts` at
 *              1280x800, `e2e/brief-5/analysis-tab-fullpage.spec.ts` at
 *              1280x900). It is where a right-hand panel widening has the most
 *              violent effect on the graph, because the graph gets whatever is
 *              left over.
 *  1440x900  — the default logical resolution of the MacBook Air/Pro class the
 *              founder and the testers actually use, and therefore the size the
 *              regressions were SEEN at.
 *
 * Both are captured for every state: the defects being caught are RELATIONSHIPS
 * between the graph and the right-hand panel, and a panel that is 22% of one
 * viewport and 35% of another is a different bug at each width.
 */
export const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
] as const

export type ViewportName = (typeof VIEWPORTS)[number]['name']

/**
 * The states this harness commits to capturing. `globalTeardown` compares this
 * list against what the run ACTUALLY captured, in both directions, so it fails
 * loud both when a state stops running and when a state is added without being
 * declared here. It is a mirror, and it is guarded by a derivation rather than
 * by anyone remembering (CLAUDE.md trap 12).
 *
 * `completed-analysis` and `inspector-node-selected` are deliberately absent —
 * see the header of `states.visual.spec.ts` for the measurements behind both.
 */
export const STATE_NAMES = [
  'fresh-draft',
  'blocked-provisional',
  'model-tab',
  'olumi-tab',
  'graph-default-zoom',
] as const

/** Every reference name this harness must produce: states x viewports. */
export function expectedCaptureNames(): string[] {
  return STATE_NAMES.flatMap((s) => VIEWPORTS.map((v) => `${s}--${v.name}`))
}

/* ── Determinism ─────────────────────────────────────────────────────────── */

/** Everything time-dependent renders as this instant. */
export const FROZEN_TIME = new Date('2026-08-17T09:00:00.000Z')

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  /* Blinking/pulsing affordances are the classic single-pixel-diff source. */
  .animate-pulse, .animate-spin, .animate-ping, .animate-bounce {
    animation: none !important;
    opacity: 1 !important;
  }
`

/**
 * Hermetic network. The dev server proxies /bff/* and /api/* at unroutable
 * targets, which produces real but TIMING-VARIABLE failures (connect refused vs
 * proxy 500 vs socket timeout). Serving one fixed, instant 503 makes the
 * failure path itself deterministic. Anything off-origin is aborted outright:
 * a reference must never depend on a third party being up.
 */
async function installHermeticNetwork(page: Page): Promise<void> {
  await page.route('**/bff/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'visreg_hermetic', detail: 'backend intentionally offline' }),
    }),
  )
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'visreg_hermetic', detail: 'backend intentionally offline' }),
    }),
  )
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    return local ? route.fallback() : route.abort()
  })
}

/**
 * Prepare a page: flag posture, storage, clock, motion, network.
 * Must be called BEFORE the first navigation.
 */
export async function preparePage(page: Page, viewport: { width: number; height: number }): Promise<void> {
  const pins = posturePins()

  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        // Deployed-posture flag pins, derived from netlify.toml x src/flags.ts.
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        // Suppress first-run overlays. Each of these is an auto-showing surface
        // whose appearance depends on prior session state, i.e. the single
        // largest source of "it looked different on my machine".
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch {
        /* storage unavailable — the visible-anchor assertions will catch it */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )

  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.clock.setFixedTime(FROZEN_TIME)
  await installHermeticNetwork(page)
}

/** Inject the freeze stylesheet. Safe to call repeatedly. */
export async function freezeMotion(page: Page): Promise<void> {
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {
    /* pre-navigation injection can race; callers re-invoke after load */
  })
}

/* ── Seeding ─────────────────────────────────────────────────────────────── */

export type StarterId =
  | 'build-vs-buy'
  | 'headcount-allocation'
  | 'market-entry'
  | 'pricing-model'
  | 'vendor-selection'

export function readStarterDraft(id: StarterId): unknown {
  const p = join(repoRoot(), 'src', 'canvas', 'starters', 'data', `${id}.draft.json`)
  if (!existsSync(p)) throw new Error(`[visreg] starter fixture missing: ${p}`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** Open /#/canvas and wait until the store handle and React Flow are live. */
export async function openCanvas(page: Page): Promise<void> {
  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
  // Injecting before the store handle exists destroys the evaluate context
  // during startup — see canvas.layout-regression-v5-fresh-draft.spec.ts.
  await page.waitForFunction(
    () => typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState === 'function',
    undefined,
    { timeout: 30_000 },
  )

  // ⚠ FONTS MUST BE LOADED **BEFORE** ANYTHING IS SEEDED, and this ordering is
  // the whole reason the graph states are reproducible.
  //
  // The graph layout is computed from MEASURED node sizes, and node sizes are
  // measured from rendered text. If a webfont arrives after the layout pass, the
  // nodes are measured at fallback metrics, the layout is computed from those,
  // and the committed reference records a graph that only reproduces when the
  // font happens to be late again. Measured: with `document.fonts.ready` awaited
  // only at the END of the quiescence wait (i.e. after layout), darwin was
  // pixel-identical across runs — because its fonts are already warm — while
  // ubuntu-latest CI diverged by 2.08-4.42% on exactly and only the two
  // full-viewport GRAPH states (`fresh-draft`, `graph-default-zoom`), 40-90x the
  // tolerance, with the diff bounded to the graph area. The three clipped
  // dock states, which contain no laid-out graph, were clean on both platforms.
  //
  // A local platform with warm font caches cannot see this class of defect at
  // all, which is why it took a linux run to surface it.
  await page.evaluate(() => document.fonts?.ready)
  await freezeMotion(page)
}

/**
 * Apply a real captured CEE draft through the product's own code path and wait
 * for the measure-then-layout pipeline to reach quiescence.
 *
 * Returns the applied node/edge counts so the caller can assert them BY VALUE —
 * `applyDraftResult` returns `{nodeCount: 0}` and no-ops on an empty payload
 * rather than throwing, so "it ran" is not evidence that it seeded anything.
 */
export async function seedStarterDraft(
  page: Page,
  id: StarterId,
): Promise<{ nodeCount: number; edgeCount: number; layoutVersion: number }> {
  const payload = readStarterDraft(id)

  const result = await page.evaluate(async (draft) => {
    // Resolved by the BROWSER against Vite's dev module graph, not by tsc and
    // not by the bundler — `page.evaluate` source is never processed by Vite.
    // Held in a variable so TypeScript does not try to resolve a path that only
    // exists as a dev-server URL (a string literal here is a TS2307).
    const modulePath = '/src/canvas/utils/applyDraftResult.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as {
      applyDraftResult: (p: unknown) => { nodeCount: number; edgeCount: number }
    }
    const applied = mod.applyDraftResult(draft)

    const w = window as unknown as {
      useCanvasStore: {
        getState: () => { pendingLayout: boolean; layoutInProgress: boolean; layoutVersion: number }
      }
    }
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const s = w.useCanvasStore.getState()
      if (!s.pendingLayout && !s.layoutInProgress && s.layoutVersion > 0) break
      await new Promise((r) => setTimeout(r, 25))
    }
    const final = w.useCanvasStore.getState()
    return { ...applied, layoutVersion: final.layoutVersion, pendingLayout: final.pendingLayout, layoutInProgress: final.layoutInProgress }
  }, payload)

  expect(result.nodeCount, `starter "${id}" seeded no nodes — applyDraftResult no-ops silently on an empty payload`).toBeGreaterThan(0)
  expect(result.layoutVersion, 'layout never committed (layoutVersion still 0) — the capture would be of a stacked graph').toBeGreaterThan(0)
  expect(result.pendingLayout, 'layout still pending at capture time — non-deterministic positions').toBe(false)
  expect(result.layoutInProgress, 'layout still in progress at capture time — non-deterministic positions').toBe(false)
  await freezeMotion(page)
  return result
}

/**
 * Dismiss every transient notification and ASSERT none remain.
 *
 * Seeding raises a real product notification (`backfill-interventions` + Undo)
 * inside `div[role="region"][aria-label="Notifications"]`. Leaving it to
 * auto-expire makes every capture a race against a timer. Dismissing it and
 * then asserting the region is empty makes the precondition PINNED IN-TEST
 * rather than hoped for (trap 13b: a guard must pin its own precondition).
 */
export async function clearNotifications(page: Page): Promise<void> {
  const region = page.locator('[role="region"][aria-label="Notifications"]')
  for (let i = 0; i < 10; i++) {
    const dismiss = region.locator('button[aria-label="Dismiss"]')
    if ((await dismiss.count()) === 0) break
    await dismiss.first().click({ timeout: 5_000 }).catch(() => undefined)
    await page.waitForTimeout(50)
  }
  await expect(
    region.locator('button[aria-label="Dismiss"]'),
    'a transient notification survived dismissal — the capture would race its auto-expiry',
  ).toHaveCount(0, { timeout: 10_000 })
}

/**
 * Minimise the floating Olumi panel so the graph is unobstructed.
 *
 * ⚠ ACTIVATED BY KEYBOARD, NOT BY MOUSE, AND THAT IS A FINDING NOT A STYLE
 * CHOICE. Under the pinned (netlify.toml) flag posture at 1440x900, the panel's
 * side-tab controls render at x18-50,y89-193 — underneath the canvas
 * viewport-controls toolbar, which occupies the same box. A mouse click on
 * `floating-olumi-panel-minimise` is intercepted by the toolbar's undo icon
 * (`svg.lucide-undo2`) and never lands. Keyboard activation
 * routes round the occlusion, which is exactly why it works and exactly why the
 * occlusion is worth a product look. Reported, not fixed: this lane adds test
 * infrastructure only.
 *
 * ⚠ CONTAINER ATTRIBUTION CORRECTED (re-derived at `b8fb8cbc`, 1440x900). This
 * comment and the one on `activateByKeyboard` both said the occluding undo icon
 * sits "inside `rf-root`". It does NOT. Measured with `elementFromPoint` at the
 * control's centre (box x18,y117,32x32), the full ancestor chain is:
 *   svg.lucide-undo2 <- button[aria-label="Undo"] <- div <- div
 *   <- nav[aria-label="Canvas tools"] <- div <- main
 * and `top.closest('#rf-root, .react-flow')` is NULL. The occluder is the
 * LEFT-HAND "Canvas tools" sidebar nav, not react-flow's root — so a product fix
 * aimed at the react-flow viewport controls would target the wrong element. The
 * occlusion itself is confirmed still present (`isSelf=false`).
 *
 * ⚠ AND NOTE THE INSTRUMENT TRAP that hid this for one probe cycle:
 * `SVGElement.className` is an `SVGAnimatedString`, not a string, so reading it
 * as one yields `''` and the occluder's identity silently disappears. Use
 * `getAttribute('class')` when hit-testing may land on SVG.
 */
export async function minimiseFloatingOlumiPanel(page: Page): Promise<void> {
  const panel = page.getByTestId('floating-olumi-panel')
  if ((await panel.count()) === 0) return

  // ⚠ ALREADY-MINIMISED IS NOT A FAILURE, AND THIS TOOK OUT TWO STATES.
  // The absent-panel guard above tests `count() === 0`, i.e. not in the DOM at
  // all. It does not cover the case that actually happened: the panel's default
  // changed to start minimised, so the panel AND its minimise control are both
  // in the DOM and both hidden. `activateByKeyboard` then waited 20s for a
  // control that resolves 23 times and is hidden every time, and `graph at
  // default zoom` failed at BOTH viewports without ever reaching a capture.
  //
  // The postcondition this function exists for is the one asserted below — the
  // panel is not covering the graph. When it is already hidden that is already
  // true, so there is nothing to do and nothing to assert that is not already
  // asserted. Note this returns ONLY on a genuinely hidden panel: a VISIBLE
  // panel still takes the full path, so a broken minimise control still REDs.
  if (await panel.isHidden()) return

  await activateByKeyboard(page, 'floating-olumi-panel-minimise')
  await expect(panel, 'floating Olumi panel did not minimise — it would occlude the graph').toBeHidden({ timeout: 10_000 })
}

/**
 * Wait for the page to stop moving. Rather than sleeping, this polls the
 * document until N consecutive samples of the layout-relevant geometry agree,
 * so a slow font/measure pass cannot land mid-shutter.
 *
 * ⚠ COUNTS POLLS, NEVER WALL TIME. `preparePage` installs a FIXED CLOCK, so
 * `Date.now()` inside the page returns the same value forever. A "has it been
 * stable for 250ms?" test built on `Date.now()` can never become true — it hung
 * every state for the full timeout on the first run of this harness, and it
 * failed in the safe direction only by luck. Anything measuring elapsed time
 * inside this page must count events, not clock readings.
 */
const QUIESCENT_POLLS = 3

export async function waitForVisualQuiescence(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __visregLast?: string; __visregStableCount?: number }
    w.__visregLast = undefined
    w.__visregStableCount = 0
  })
  await page.waitForFunction(
    (required: number) => {
      const w = window as unknown as { __visregLast?: string; __visregStableCount?: number }
      const sample = [...document.querySelectorAll('[data-testid], .react-flow__node')]
        .slice(0, 400)
        .map((el) => {
          const r = el.getBoundingClientRect()
          return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`
        })
        .join('|')
      if (w.__visregLast !== sample) {
        w.__visregLast = sample
        w.__visregStableCount = 0
        return false
      }
      w.__visregStableCount = (w.__visregStableCount ?? 0) + 1
      return w.__visregStableCount >= required
    },
    QUIESCENT_POLLS,
    { timeout: timeoutMs, polling: 100 },
  )
  await page.evaluate(() => document.fonts?.ready)
}

/* ── Reference validation ────────────────────────────────────────────────── */

export function referencePath(name: string, platform: string = process.platform): string {
  return join(REFERENCE_ROOT, platform, `${name}.png`)
}

/**
 * Prove the reference is a real screenshot of this product before comparing
 * anything to it.
 *
 * This is the positive control on the comparison's OTHER input. A compare whose
 * two inputs are both blank agrees perfectly and exits 0; the founder would
 * then be told the UI is fine by an instrument that looked at two empty images.
 * Checked: exists, plausible size, decodes, correct dimensions, non-uniform.
 */
export function assertReferenceIsSubstantive(
  name: string,
  expected: { width: number; height: number },
): { bytes: number; distinctColours: number; nonModalFraction: number } {
  const p = referencePath(name)
  if (!existsSync(p)) {
    throw new Error(
      `[visreg] NO REFERENCE for "${name}" on platform "${process.platform}".\n` +
        `  expected at: ${p}\n` +
        `  This is a HARD FAILURE by design: a missing reference must never be silently\n` +
        `  written and blessed. Capture references for this platform with:\n` +
        `      pnpm visual:bless\n` +
        `  and commit the result as its own reviewable commit. See e2e/visual/README.md.`,
    )
  }
  const bytes = statSync(p).size
  if (bytes < MIN_REFERENCE_BYTES) {
    throw new Error(
      `[visreg] reference "${name}" is ${bytes} bytes (floor ${MIN_REFERENCE_BYTES}). ` +
        `That is too small to be a screenshot of this product — it is almost certainly a blank ` +
        `or error page that was blessed by mistake. Re-bless and review the image.`,
    )
  }
  const png = PNG.sync.read(readFileSync(p))
  if (png.width !== expected.width || png.height !== expected.height) {
    throw new Error(
      `[visreg] reference "${name}" is ${png.width}x${png.height} but this run captures ` +
        `${expected.width}x${expected.height}. The reference belongs to a different viewport.`,
    )
  }
  const { distinctColours, nonModalFraction } = measureContent(png)
  if (distinctColours < MIN_DISTINCT_QUANTISED_COLOURS) {
    throw new Error(
      `[visreg] reference "${name}" has only ${distinctColours} distinct quantised colours ` +
        `(floor ${MIN_DISTINCT_QUANTISED_COLOURS}). A near-uniform reference agrees with a blank ` +
        `capture and would make this harness incapable of failing.`,
    )
  }
  if (nonModalFraction < MIN_NON_MODAL_PIXEL_FRACTION) {
    throw new Error(
      `[visreg] reference "${name}" is ${(100 * (1 - nonModalFraction)).toFixed(1)}% one single colour ` +
        `(floor for non-modal pixels: ${(100 * MIN_NON_MODAL_PIXEL_FRACTION).toFixed(1)}%). ` +
        `That is a blank or failed render, not a screenshot of this product.`,
    )
  }
  return { bytes, distinctColours, nonModalFraction }
}

/**
 * Content measures at 4-bit-per-channel quantisation.
 *
 * Two measures, not one, because they fail differently: a gradient-filled error
 * page can have many colours and still be blank of content, and a dense
 * single-colour panel can have few colours and be perfectly real. Requiring
 * BOTH a colour count and a non-modal-pixel fraction closes each other's gap.
 */
export function measureContent(png: PNG): { distinctColours: number; nonModalFraction: number } {
  const counts = new Map<number, number>()
  const d = png.data
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const total = d.length / 4
  let modal = 0
  for (const c of counts.values()) if (c > modal) modal = c
  return { distinctColours: counts.size, nonModalFraction: total === 0 ? 0 : 1 - modal / total }
}

/**
 * Activate a control with the keyboard.
 *
 * ⚠ USED ONLY WHERE A MOUSE CLICK IS PHYSICALLY INTERCEPTED, and each use names
 * the occlusion. Keyboard activation reaches an occluded control because focus
 * order is unaffected by z-order — which is exactly why it must NOT be used as a
 * general-purpose click: it would route round the very defects this harness
 * exists to catch.
 *
 * Currently one use: `floating-olumi-panel-minimise`, which renders underneath
 * the LEFT-HAND `nav[aria-label="Canvas tools"]` sidebar (both at x18-50,
 * y89-193 at 1440x900; the control itself measured x18,y117,32x32);
 * `document.elementFromPoint` at its centre returns `svg.lucide-undo2`, whose
 * `button` carries `aria-label="Undo"`. NOT inside `rf-root` — see the corrected
 * attribution on `minimiseFloatingOlumiPanel`, re-derived at `b8fb8cbc`. Measured
 * at 289b730d at both 1280x800 and 1440x900. Reported, not fixed — this lane
 * adds test infrastructure only.
 *
 * ⚠ HISTORY, because it is the reason this helper is scoped so tightly: at
 * 42f6cb6a the four dock tabs overflowed a 280px dock and `Compare` and `Model`
 * were BOTH mouse-unreachable, so this helper was used for them too. The
 * 416px width restore (#754/#755) fixed that — re-derived at 289b730d, all four
 * tabs hit-test to themselves — so the tabs went back to real mouse clicks. Had
 * they been left on keyboard activation, a future re-narrowing would have been
 * INVISIBLE to this harness.
 */
export async function activateByKeyboard(page: Page, testId: string): Promise<void> {
  const control = page.getByTestId(testId)
  await expect(control, `control ${testId} is not visible`).toBeVisible({ timeout: 20_000 })
  await control.focus()
  await expect(control, `control ${testId} could not take focus — keyboard activation is impossible`).toBeFocused({
    timeout: 5_000,
  })
  await page.keyboard.press('Enter')
}

/* ── Manifest ────────────────────────────────────────────────────────────── */

/**
 * Record that a capture actually happened. `manifest.visual.spec.ts` asserts
 * the full expected set BY NAME afterwards, so a run that boots a broken app
 * and captures nothing cannot report success. An aggregate (exit code, pass
 * count) cannot see a capture that never occurred.
 */
export function recordCapture(name: string): void {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
  appendFileSync(MANIFEST_PATH, `${name}\n`, 'utf8')
}

export function readManifest(): string[] {
  if (!existsSync(MANIFEST_PATH)) return []
  return readFileSync(MANIFEST_PATH, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
}

/* ── Capture ─────────────────────────────────────────────────────────────── */

/*
 * TOLERANCE — chosen from measurement, not from habit.
 *
 * `PIXEL_THRESHOLD` is the per-pixel YIQ colour distance below which two pixels
 * count as equal. 0.2 is Playwright's default and is what absorbs font
 * antialiasing; it is deliberately left alone, because the antialiasing
 * question is answered by the measured noise floor below rather than by
 * loosening per-pixel comparison until nothing complains.
 *
 * `MAX_DIFF_PIXEL_RATIO` is the fraction of differing pixels tolerated across
 * the image. It is the number that decides whether this harness bites, so it
 * is derived from `selftest.visual.spec.ts`, which measures the noise floor and
 * two real regressions of the class that shipped past fifteen green PRs.
 * Measured on darwin/chromium 1.57 at 1440x900 (1,296,000 px) at 289b730d, each
 * perturbation in its OWN browser context:
 *
 *   noise floor (fresh capture vs committed reference)   0.0000%       0 px
 *   marginal: 1px nudge of one small control             0.0077%     100 px
 *   REGRESSION: sticky footer overlapping content        0.6346%   8,225 px
 *   REGRESSION: right-hand panel widened by 35%          2.0319%  26,333 px
 *
 * 0.0005 (0.05%, 648 px at this size) sits with a 12x margin under the smaller
 * of the two real regressions and an unbounded margin over a noise floor that
 * measured EXACTLY ZERO differing pixels across process runs. The self-test
 * asserts both margins (>=10x) on every run, so this constant cannot quietly
 * drift into being too slack to fail or too tight to trust.
 *
 * What it will NOT catch, stated honestly: a sub-650px change at full-viewport
 * scale, e.g. the 1px control nudge above. Panel-scale states are clipped to
 * the dock (416x872 = ~363,000 px) where the same ratio is ~181 px, so small
 * copy and spacing changes there DO trip it — deliberately: in a panel, a
 * one-word change is a change worth re-blessing on purpose.
 */
export const MAX_DIFF_PIXEL_RATIO = 0.0005
export const PIXEL_THRESHOLD = 0.2

export interface CaptureOptions {
  /** Locator to clip to. Omit for the full viewport (graph + right-hand panel). */
  clip?: string
  /** Anchors that must be visible before the shutter opens. Bind by identity. */
  anchors: string[]
}

/**
 * Capture and compare one named state.
 *
 * Order is deliberate:
 *   1. assert the named anchors are visible  → we are looking at the right screen
 *   2. wait for geometry to stop changing    → we are not mid-layout
 *   3. validate the reference is substantive → the other input is real
 *   4. compare                               → Playwright writes expected/actual/diff
 *   5. record in the manifest                → the run cannot claim a capture it skipped
 */
export async function captureState(
  page: Page,
  testInfo: TestInfo,
  name: string,
  viewport: { width: number; height: number },
  opts: CaptureOptions,
): Promise<void> {
  expect(opts.anchors.length, 'every state must name at least one identity anchor').toBeGreaterThan(0)
  for (const anchor of opts.anchors) {
    await expect(
      page.locator(anchor).first(),
      `anchor ${anchor} not visible — this state did not mount, so the capture would be of a different screen`,
    ).toBeVisible({ timeout: 20_000 })
  }

  await freezeMotion(page)
  await waitForVisualQuiescence(page)

  const target = opts.clip ? page.locator(opts.clip).first() : page
  const box = opts.clip ? await page.locator(opts.clip).first().boundingBox() : null
  const expectedSize = box
    ? { width: Math.round(box.width), height: Math.round(box.height) }
    : { width: viewport.width, height: viewport.height }

  // In BLESS mode the reference is about to be (re)written, so it is validated
  // AFTERWARDS instead — blessing a blank or an error page is the one way this
  // harness could be permanently disarmed, and it must not be possible.
  const blessing = process.env.VISREG_BLESS === '1'
  if (!blessing) {
    const ref = assertReferenceIsSubstantive(name, expectedSize)
    testInfo.annotations.push({
      type: 'visreg-reference',
      description: `${name}: ${ref.bytes}B, ${ref.distinctColours} quantised colours, posture ${postureFingerprint()}`,
    })
  }

  // ⚠ THE MANIFEST RECORDS COVERAGE, NOT CORRECTNESS, AND THE `finally` IS THE
  // WHOLE POINT. This state has now mounted, been stabilised and been
  // photographed; whether the photograph MATCHES is the assertion's business,
  // not the completeness guard's.
  //
  // It used to record only on the happy path, one line below the assertion, and
  // that conflated the two questions with a cascading consequence: when the
  // references went stale, all ten comparisons failed, not one `recordCapture`
  // ran, the manifest was empty, and the guard reported
  // "ZERO screenshots were captured — the app failed to boot, or no test
  // matched". Neither was true. The app booted perfectly and every test matched.
  //
  // That message sent two separate readers hunting a boot failure that did not
  // exist, and the real diagnosis — ten stale references — was invisible behind
  // it. Recorded here instead, the same run reports "10/10 captured" with ten
  // failed comparisons, which is what actually happened and points straight at
  // the references.
  try {
    await expect(target).toHaveScreenshot(`${name}.png`, {
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
      threshold: PIXEL_THRESHOLD,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      ...(opts.clip ? {} : { fullPage: false }),
    })
  } finally {
    recordCapture(name)
  }

  if (blessing) {
    const ref = assertReferenceIsSubstantive(name, expectedSize)
    // eslint-disable-next-line no-console
    console.log(`[visreg] blessed ${name}: ${ref.bytes}B, ${ref.distinctColours} quantised colours`)
  }
}

/** Everything the artefact should say about how a run was configured. */
export function postureReport(): string {
  return [
    `platform: ${process.platform}`,
    `frozen time: ${FROZEN_TIME.toISOString()}`,
    `maxDiffPixelRatio: ${MAX_DIFF_PIXEL_RATIO}`,
    `pixel threshold: ${PIXEL_THRESHOLD}`,
    `flag posture (netlify.toml x src/flags.ts): ${postureFingerprint()}`,
    `netlify flag-shaped vars with no flags.ts storageKey (NOT pinned): ${unmappedNetlifyFlags().join(', ') || '(none)'}`,
  ].join('\n')
}

/**
 * A LAZY ROUTE CHUNK THAT STALLS MUST REACH THE ERROR BOUNDARY, AND A SLOW ONE
 * MUST NOT.
 *
 * ── THE DEFECT, AS MEASURED ON STAGING ──────────────────────────────────────
 * Core E2E run 33556631726: 59 requests, every one HTTP 200 EXCEPT
 * `/assets/ReactFlowGraph-CdifbDa0.js`, which never completed. No console error
 * — so the dynamic import never rejected; it hung. The page snapshot at that
 * moment was exactly `status "Loading Canvas"` / `paragraph: Loading Canvas...`
 * and nothing else, AFTER 60 SECONDS. Same signature in runs 33578060840,
 * 33581772301 and 33546491489.
 *
 * ⭐ THE DOM PROVES "PENDING" INDEPENDENTLY OF THE NETWORK TRACE. A REJECTED
 * lazy import rethrows to the nearest error boundary and REPLACES the Suspense
 * fallback. A fallback still on screen therefore means the import is still
 * pending. That is why arm 1 asserts the fallback is present early and gone
 * later: the two readings together are the whole claim.
 *
 * The REJECTED path was already handled well (run 33571760150 — "Something went
 * wrong / Unable to preload CSS for /assets/ReactFlowGraph-*.css", with Reload
 * editor, Copy debug info and Report issue). The STALLED path had no equivalent.
 * ⭐ THE ASYMMETRY WAS THE DEFECT, and arm 3 is what proves it is now closed on
 * BOTH sides rather than traded one for the other.
 *
 * ── WHY THIS CANNOT BE A jsdom TEST ─────────────────────────────────────────
 * It is a race between a real Suspense boundary, a real error boundary and a
 * real network stall. jsdom has no network stack to stall. The settle logic
 * underneath is pinned cheaply in `src/lib/__tests__/lazyWithStallBound.spec.ts`;
 * THIS file is the evidence that it reaches the user.
 *
 * ── ⚠ NO GEOMETRY OR VISIBILITY CLAIM IS MADE HERE, DELIBERATELY ────────────
 * `ghostDoorVisibility.measure.ts` carries `assertPaneCanRenderGeometry` because
 * a hidden pane reports `innerWidth`/`innerHeight` as 0 and never fires
 * `requestAnimationFrame`, which voids any claim about what is on screen. Every
 * assertion below is STRUCTURAL — an element is attached, an attribute has a
 * value, a `role="status"` node is gone — so that precondition does not apply
 * and a second copy of it here would be a mechanism nobody needs. If an arm is
 * ever added that asserts a rect or `toBeVisible()`, it must import that helper
 * rather than rediscover it.
 *
 * ── ⚠ NOT IN THE CANVAS BROWSER GATE ────────────────────────────────────────
 * `e2e/geometry/canvasGateSet.ts` is a CLOSED registry and entries must land
 * with their `{ tag: GATE_TAG }` in the same commit or the gate REDs at config
 * load. These arms meet its bar — behavioural assertions naming a shipped defect
 * — but they cost roughly 90 s of wall clock, which is more than the whole
 * current gate, and the gate's budget is the constraint that shaped it. Admission
 * is a decision for whoever owns that budget, not a thing to take unilaterally.
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import {
  CHUNK_RELOAD_GUARD_KEY,
  CHUNK_STALL_BOUND_EVIDENCE,
  CHUNK_STALL_BOUND_MS,
} from '../../src/lib/staleBuildRecovery'

/**
 * The module the lazy boundary awaits. Under the Vite DEV server this is the
 * source module rather than a hashed chunk — the same `import()` promise either
 * way, which is the thing under test.
 *
 * ⚠ In production the stalled file was a STATIC DEPENDENCY of this chunk
 * (`CanvasMVP-*.js` carries `from"./ReactFlowGraph-*.js"`; the closure is 37
 * modules). Stalling any member of the closure produces the identical pending
 * promise, so stalling the entry is the same condition with fewer moving parts.
 */
const LAZY_ROUTE_MODULE = '**/src/routes/CanvasMVP.tsx*'

const FALLBACK = '[role="status"][aria-label="Loading Canvas"]'
const ERROR_PANEL = '[data-testid="canvas-error-panel"]'

/** Margin for boot, transform and React commit either side of the bound. */
const SLACK_MS = 20_000

/**
 * Hold matching requests open forever: never fulfil, never abort. This is the
 * measured condition — NOT `route.abort()`, which produces a rejection and is
 * the case that already worked (arm 3).
 *
 * Returns a disposer, because a context that closes with routes parked in a
 * handler can hang. The parked routes are aborted at teardown, never during.
 */
function stallRoute(page: Page, pattern: string) {
  const parked: Route[] = []
  const install = page.route(pattern, (route) => {
    parked.push(route)
  })
  return {
    install,
    async release() {
      for (const route of parked.splice(0)) {
        await route.abort('failed').catch(() => undefined)
      }
      await page.unroute(pattern).catch(() => undefined)
    },
  }
}

/**
 * Spend the shared auto-reload budget before boot.
 *
 * Arm 3 drives a REJECTION, which correctly triggers one automatic reload. That
 * is right for the product and noise for a test about the panel, so the budget
 * is pre-spent and the panel is what gets measured. The key is IMPORTED from the
 * module that owns it — a literal typed here would be the hand-maintained mirror
 * the single-writer guard exists to ban.
 */
async function spendReloadBudget(page: Page) {
  await page.addInitScript(
    ([key, now]) => {
      try {
        sessionStorage.setItem(key as string, String(now))
      } catch {
        /* a private-mode context simply gets the un-spent behaviour */
      }
    },
    [CHUNK_RELOAD_GUARD_KEY, Date.now()] as const,
  )
}

test.describe('lazy route chunk: stalled vs slow vs failed', () => {
  test('STALLED: the error boundary replaces the spinner, at the bound', async ({ page }) => {
    test.setTimeout(CHUNK_STALL_BOUND_MS + SLACK_MS + 60_000)

    const consoleErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })

    const stall = stallRoute(page, LAZY_ROUTE_MODULE)
    await stall.install
    try {
      const t0 = Date.now()
      await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })

      // ── (a) REPRODUCTION CONTROL: we are in the reported state, not some
      // other failure. The Suspense fallback is on screen and the panel is not.
      await page.waitForSelector(FALLBACK, { state: 'attached', timeout: 30_000 })
      expect(await page.locator(ERROR_PANEL).count(), 'panel must NOT be up yet').toBe(0)

      // ── (b) THE MECHANISM: nothing rejected. This is what makes the stall a
      // DIFFERENT defect from the one already handled — a rejection would have
      // logged here and unwound to the boundary immediately.
      const elapsedAtCheck = Date.now() - t0
      expect(elapsedAtCheck, 'sanity: the check happened well before the bound').toBeLessThan(
        CHUNK_STALL_BOUND_MS,
      )

      // ── (c) THE FIX: the boundary takes over WITHIN the bound.
      const panel = page.locator(`${ERROR_PANEL}[data-error-cause="chunk-stall"]`)
      await panel.waitFor({ state: 'attached', timeout: CHUNK_STALL_BOUND_MS + SLACK_MS })
      const elapsed = Date.now() - t0

      // ── (d) AND THE SPINNER IS GONE. Before this change it never was.
      expect(await page.locator(FALLBACK).count(), 'the spinner must be replaced').toBe(0)

      // ⭐ THE OTHER DIRECTION OF THE SAME ASSERTION. A bound that fired early
      // would satisfy (c) and be a REGRESSION for every user on a poor
      // connection. It must not fire before the bound it advertises.
      expect(
        elapsed,
        `fired at ${elapsed}ms, before the ${CHUNK_STALL_BOUND_MS}ms bound`,
      ).toBeGreaterThanOrEqual(CHUNK_STALL_BOUND_MS)
      expect(elapsed).toBeLessThan(CHUNK_STALL_BOUND_MS + SLACK_MS)

      // The stall must not have been mistaken for a deploy race on the way.
      expect(consoleErrors.join('\n')).not.toMatch(/dynamically imported module/i)
    } finally {
      await stall.release()
    }
  })

  test('SLOW BUT SUCCESSFUL: a load as slow as the slowest supported connection still mounts', async ({
    page,
  }) => {
    /*
     * ⭐ THE ARM THAT PROTECTS REAL USERS, and the one a plausible-looking
     * tightening of the bound would break.
     *
     * The delay is not a round number chosen for the test: it is
     * `slowestSupportedMaxMs`, the slowest SUCCESSFUL settle measured against the
     * deployed build on Chrome DevTools "Slow 3G" (400 kbps / 400 ms RTT, 5/5
     * samples). Binding it to the same constant the bound was chosen against
     * means this arm goes red the moment the bound stops clearing the
     * measurement — rather than agreeing with whatever number is there.
     */
    const delayMs = CHUNK_STALL_BOUND_EVIDENCE.slowestSupportedMaxMs
    test.setTimeout(delayMs + 120_000)

    await page.route(LAZY_ROUTE_MODULE, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await route.continue().catch(() => undefined)
    })

    const t0 = Date.now()
    await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })

    // It really was slow — otherwise this arm proves nothing about slowness.
    await page.waitForSelector(FALLBACK, { state: 'attached', timeout: 30_000 })

    await page.waitForSelector('[data-testid="rf-root"], .react-flow__node[data-id]', {
      state: 'attached',
      timeout: 90_000,
    })
    const elapsed = Date.now() - t0

    expect(elapsed, 'the delay must actually have been applied').toBeGreaterThanOrEqual(delayMs)
    expect(await page.locator(ERROR_PANEL).count(), 'a slow load must NOT be called an error').toBe(0)
  })

  test('CONTRAST: a FAILED chunk still reaches the boundary PROMPTLY, and as a different cause', async ({
    page,
  }) => {
    /*
     * ⭐ THE DISCRIMINATING TWIN (CLAUDE.md trap 13e). Its expected answer
     * DIFFERS from arm 1's in two ways at once — the panel arrives in seconds
     * rather than at the bound, and it is attributed to `stale-build` rather
     * than `chunk-stall`. Without it, arm 1 would pass just as happily for a
     * boundary that showed the same panel for every route failure at any time,
     * which is a probe agreeing with itself.
     *
     * It is also the regression guard on the half that already worked: this
     * change must not buy the stalled path at the cost of the rejected one.
     */
    test.setTimeout(120_000)
    await spendReloadBudget(page)
    await page.route(LAZY_ROUTE_MODULE, (route) => route.abort('failed'))

    const t0 = Date.now()
    await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })

    const panel = page.locator(`${ERROR_PANEL}[data-error-cause="stale-build"]`)
    await panel.waitFor({ state: 'attached', timeout: 60_000 })
    const elapsed = Date.now() - t0

    expect(
      elapsed,
      'a REJECTION must not wait for the stall bound — it unwinds immediately',
    ).toBeLessThan(CHUNK_STALL_BOUND_MS)
    expect(await page.locator(`${ERROR_PANEL}[data-error-cause="chunk-stall"]`).count()).toBe(0)
  })
})

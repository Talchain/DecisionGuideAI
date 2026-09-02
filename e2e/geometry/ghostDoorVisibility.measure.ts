/**
 * THE FOUR REASONING-FRONTIER DOORS ARE VISIBLE TO A SIGHTED USER — in Chromium.
 *
 * ⭐ WHY THIS LIVES IN A REAL BROWSER AND NOT IN THE VITEST GATE.
 *
 * The defect was `visibility: hidden`. jsdom cannot prove visibility (CLAUDE.md
 * trap 3) — it has no layout, `innerText` is not layout-aware there, and
 * `.focus()` succeeds on elements a browser refuses to focus. Every jsdom
 * assertion about these doors was GREEN throughout the whole period they were
 * invisible, which is exactly why the surviving evidence has to be a browser.
 *
 * The MECHANISM is pinned separately, in the gate, by
 * `src/canvas/store/__tests__/nodeChangeIdentity.spec.ts`. That spec asserts the
 * array-identity property; this file asserts what a user can see. Neither
 * replaces the other: the store property could hold while some future change
 * hides the doors another way, and the doors could be visible on a build whose
 * store had quietly gone back to churning.
 *
 * ── WHAT WENT WRONG, at the bytes ─────────────────────────────────────────────
 *
 * `applyNodeChanges` always mints a new array (`@xyflow/react@12.10.2`,
 * `dist/esm/index.mjs:591-666`). React Flow measures the injected doors and
 * reports `dimensions` changes for ids the canvas store does not hold; the store
 * answered each one with a new `nodes` array; the canvas re-rendered; the memo
 * rebuilt the door objects; `adoptUserNodes` discarded their measurement
 * (`@xyflow/system@0.0.76:1620-1626`); `nodeHasDimensions` read false; React Flow
 * painted `visibility: hidden` (`index.mjs:2237`) and re-observed — which produced
 * the next measurement. A livelock, so the hidden state was PERMANENT, not a
 * mount transient.
 *
 * Measured here at pristine `a0b77f6c`, vendor-selection: 1,668 re-observations
 * and 1,660 ResizeObserver callbacks for four elements whose box never changed,
 * inside a ~3s window; 4/4 doors `hidden` in all 12 samples; 19/19 real nodes
 * visible. After the fix, on the same instrument: 40 re-observations, 4/4 visible
 * in all 12 samples, all four focusable.
 *
 * ── THE CONTROLS ──────────────────────────────────────────────────────────────
 *
 *  - POSITIVE CONTROL FOR THE HIDDEN READING. "Everything reads visible" is also
 *    what a probe that cannot see `hidden` reports. So the probe is shown a
 *    deliberately hidden clone of a real door, in the same DOM, through the same
 *    reader, and must call it hidden and unfocusable. Without this the pass is
 *    vacuous (trap 13).
 *  - LIVELOCK COUNTER. A door could be visible at rest and still be re-measured
 *    hundreds of times a second. The re-observation count is asserted, so the
 *    mechanism cannot come back wearing a passing appearance.
 *  - DIRECTION B. The frontier is deliberately WITHDRAWN after an analysis in
 *    every view but Expert (`frontierIsVisible`). The fix must not make doors
 *    appear where the product says they should not be, so the gate is flipped and
 *    the DOM must hold none.
 *  - REAL NODES STILL MEASURE. The fix suppresses a store write. If it suppressed
 *    too much, real nodes would stop persisting their dimensions — so their
 *    `measured` is asserted present, which is the same write arriving.
 *
 * ⚠ THE HARNESS FREEZES THE CLOCK, so `Date.now()` deltas inside the page are 0
 * and prove nothing about elapsed time. Sample COUNT is the honest unit here, and
 * the waits are real because `setTimeout` still runs.
 *
 * ⚠ AND THAT MATTERS MORE SINCE THE PANE PRECONDITION BELOW LANDED: a HARD
 * FAILURE THAT NEVER RUNS IS A SKIP WITH EXTRA STEPS. `e2e/geometry/` is
 * referenced by zero workflows, so everything in this file — including the guard
 * that refuses to measure an unrendered pane — protects MANUAL runs only. The
 * authorised geometry CI job is what would give it teeth, and it is deliberately
 * not built here.
 *
 * Run it deliberately — it is in no gate:
 *     GEOMETRY_PORT=5393 pnpm exec playwright test -c playwright.geometry.config.ts --grep GHOST
 */
import { test, expect } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const STARTERS: StarterId[] = ['vendor-selection', 'market-entry', 'build-vs-buy', 'headcount-allocation', 'pricing-model']

/**
 * Counts every ResizeObserver re-observation, keyed by node id.
 *
 * Installed before any app code runs. It is what turns "the doors look fine now"
 * into a statement about the livelock: at pristine this read 1,668 for four
 * elements; a healthy mount reads tens.
 */
const INSTRUMENT = () => {
  const w = window as unknown as { __RO_LOG__: { observes: string[]; entries: string[] } }
  w.__RO_LOG__ = { observes: [], entries: [] }
  const Native = window.ResizeObserver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).ResizeObserver = class extends Native {
    constructor(cb: ResizeObserverCallback) {
      super((entries, obs) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).getAttribute?.('data-id')
          if (id) w.__RO_LOG__.entries.push(id)
        }
        cb(entries, obs)
      })
    }
    observe(t: Element, o?: ResizeObserverOptions) {
      const id = (t as HTMLElement).getAttribute?.('data-id')
      if (id) w.__RO_LOG__.observes.push(id)
      super.observe(t, o)
    }
  }
}

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ THE PANE MUST BE ABLE TO RENDER GEOMETRY AT ALL — a hard precondition,
 * never a skip. Added 2 Sep 2026, after it produced a confident, fully-formed,
 * completely void "the doors are hidden" report.
 *
 * A hidden browser pane reads `window.innerWidth`/`innerHeight` as **0** and
 * does not fire `requestAnimationFrame`. In that state React Flow never
 * measures the injected doors, so `nodeHasDimensions` is false and they render
 * `visibility: hidden` BY CONSTRUCTION — with the guard present and executing,
 * on a perfectly healthy build. Every symptom of the livelock appears, and none
 * of the cause is there.
 *
 * ⚠ AND THE READING THAT DID *NOT* CATCH IT IS THE POINT. The report carried a
 * contrast control — "19 of 19 real nodes visible" — and it read green, which is
 * what made the verdict feel safe. Real nodes carry stored positions and do not
 * depend on live measurement, so they stay visible through a total measurement
 * outage. **The control was present, green, and structurally incapable of
 * detecting the specific way the instrument had failed.** That is the whole
 * lesson: a control has to be sensitive to the failure mode you actually have,
 * not merely adjacent to the thing you are measuring (CLAUDE.md trap 13, and its
 * sharper form 13e — a control that fires proves the probe sees SOMETHING, never
 * that it sees the thing that broke).
 *
 * The other tell was read backwards too: two per-frame loops "timed out", which
 * is exactly what a frame loop does when frames never come. A timeout was
 * treated as a stuck renderer rather than as the measurement itself.
 *
 * ⚠ HARD FAILURE, NOT A SKIP, DELIBERATELY. A skipped geometry measure is a
 * green run that proves nothing, and this file's entire job is to be the thing
 * that cannot be satisfied by an environment which never rendered. If the pane
 * cannot paint, the correct outcome is a loud red naming why.
 *
 * ⚠⚠ AND THE FIRST VERSION OF THIS GUARD COULD NOT FIRE INSIDE ITS OWN HARNESS.
 * It raced `window.requestAnimationFrame` against `window.setTimeout`, under the
 * comment "setTimeout still runs while frames starve, so this is the
 * discrimination". That is true of a real browser and FALSE HERE.
 * `preparePage` calls `page.clock.setFixedTime` (`harness.ts:263`), and
 * playwright-core 1.57.0's clock replaces BOTH functions with the same generic
 * dispatcher — measured at the bytes in this harness: `__pwClock` present,
 * `Date.isFake` true, and `String(window.requestAnimationFrame) ===
 * String(window.setTimeout)`, both being `(...args) => api[method].apply(api,
 * args)`. So the "two independent channels" were two entries on ONE queue,
 * pumped by one native timer. Measured as a triple with the clock as the only
 * variable: no clock + rAF killed → detected; no clock + healthy → passes; clock
 * + rAF killed → **MISSED**. The harness under review was the missing cell.
 *
 * It now reads `__pwClock.builtins.*` — the real functions the clock keeps aside
 * and does not replace — and falls back to the window ones only when no clock is
 * installed, so the guard works in a plain browser too. And if a clock IS
 * installed while `builtins` is unavailable, this FAILS LOUD rather than
 * silently falling back to the faked pair: a Playwright upgrade that renames
 * that property would otherwise re-open this exact hole with no red anywhere
 * (CLAUDE.md trap 12 — a mirror must fail on drift, never assume-good).
 *
 * ⭐ THE SUBTLEST LESSON, AND THE REASON THIS PARAGRAPH IS LONG. The original
 * guard shipped with a fault-injection proof that PASSED: kill rAF, watch it go
 * red, applied-check confirming the fault landed and was no false survivor. All
 * of that was true — and it settled less than it looked like it settled, because
 * **the fault injected was not the condition being guarded against**. Killing
 * `window.requestAnimationFrame` is not the same event as a pane that never
 * paints, and only the second one also silences the timer the guard was racing.
 * A green applied-check proves the fault landed; it says nothing about whether
 * the fault is the hazard. Injecting the REAL condition — or, as here, varying
 * the environment that distinguishes them — is the only thing that does.
 * ══════════════════════════════════════════════════════════════════════════════
 */
async function assertPaneCanRenderGeometry(page: import('@playwright/test').Page): Promise<void> {
  const pane = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pwClock = (window as any).__pwClock
    const builtinRaf = pwClock?.builtins?.requestAnimationFrame
    const builtinTimer = pwClock?.builtins?.setTimeout
    // The REAL channels. See the header: under `page.clock`, the window pair are
    // two entries on one faked queue and cannot discriminate each other.
    const raf: typeof window.requestAnimationFrame = builtinRaf ?? window.requestAnimationFrame
    const timer: typeof window.setTimeout = builtinTimer ?? window.setTimeout

    const rafFired = await new Promise<boolean>((resolve) => {
      let settled = false
      raf.call(window, () => { if (!settled) { settled = true; resolve(true) } })
      timer.call(window, () => { if (!settled) { settled = true; resolve(false) } }, 3000)
    })
    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      clientW: document.documentElement.clientWidth,
      clientH: document.documentElement.clientHeight,
      rafFired,
      visibilityState: document.visibilityState,
      clockInstalled: !!pwClock,
      usedBuiltins: !!(builtinRaf && builtinTimer),
    }
  })

  /*
   * Fail loud on drift rather than fall back to the faked pair. If a clock is
   * installed and `builtins` has moved or been renamed by a Playwright upgrade,
   * the race below would silently become window-vs-window again — which is
   * precisely the hole this guard was rewritten to close, and it would close it
   * with no red anywhere.
   */
  expect(
    pane.clockInstalled && !pane.usedBuiltins,
    'a Playwright clock is installed but `__pwClock.builtins` is unavailable, so this guard would have raced two entries on the SAME faked queue and could not detect a non-painting pane. The property has moved — re-derive it against this playwright-core version before trusting any reading in this file.',
  ).toBe(false)

  expect(
    pane.innerW * pane.innerH,
    `the browser pane has no viewport (${pane.innerW}x${pane.innerH}, document.visibilityState="${pane.visibilityState}") — it is hidden or unrendered. React Flow cannot measure a node in this state, so every door would read visibility:hidden BY CONSTRUCTION and this run would report a defect that is not there. This is a HARD FAILURE on purpose: show the pane and re-run.`,
  ).toBeGreaterThan(0)

  expect(
    pane.clientW * pane.clientH,
    `the document has no layout box (${pane.clientW}x${pane.clientH}) — nothing on this page has been laid out, so no geometry reading from it means anything.`,
  ).toBeGreaterThan(0)

  expect(
    pane.rafFired,
    `requestAnimationFrame did not fire within 3s (viewport ${pane.innerW}x${pane.innerH}, document.visibilityState="${pane.visibilityState}", clock=${pane.clockInstalled ? 'installed, builtins' : 'none, window'}) — the pane is not painting. Every per-frame sample below would stall and every door would read visibility:hidden because React Flow never measures. A per-frame loop that "times out" IS this condition, not a stuck renderer.`,
  ).toBe(true)
}

for (const id of STARTERS) {
  test(`GHOST doors are visible and focusable — ${id}`, async ({ page }) => {
    await page.addInitScript(INSTRUMENT)
    await preparePage(page, { width: 1440, height: 900 })
    await openCanvas(page)
    await assertPaneCanRenderGeometry(page)
    await seedStarterDraft(page, id)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const m = await page.evaluate(async (GHOST: string) => {
      // ONE reader, used for the doors AND for the positive control, so a
      // control that agrees cannot be agreeing through a different code path.
      const readOne = (el: HTMLElement) => ({
        id: el.dataset.id ?? el.id,
        visibility: getComputedStyle(el).visibility,
        w: el.offsetWidth,
        h: el.offsetHeight,
        // Layout-aware: it is EMPTY for a `visibility: hidden` subtree, which is
        // why the original founder report recorded "label text (empty)". That
        // was a consequence of the defect, not a second defect.
        innerText: (el.innerText || '').trim(),
        textContent: (el.textContent || '').trim(),
        tabIndex: el.tabIndex,
      })
      const focusable = (el: HTMLElement | null | undefined) => {
        if (!el) return false
        el.focus()
        const ok = document.activeElement === el
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        return ok
      }
      /*
       * ⚠ THE DOOR'S CONTROL IS FOUND BY WHAT IT IS, NEVER BY WHERE IT SITS.
       *
       * This read `el.firstElementChild`, which is a claim about DEPTH, and the
       * claim is about to stop being true: PR #1129 wraps every node's contents
       * in a `display: contents` scope div, which becomes the node's first
       * element child. That branch shares NO FILE with this one, so no textual
       * conflict could ever have warned either lane — this instrument would
       * simply have started reporting `innerRole: null` and `focusesControl:
       * false` for four doors that were perfectly fine, and a browser measure
       * that cries wolf gets deleted rather than fixed.
       *
       * A descendant query is depth-independent, so it reads the same door
       * through zero wrappers or three. `arity` is returned alongside so the
       * query cannot silently start resolving to SOMETHING ELSE: it is asserted
       * to be exactly 1, which binds this reading to the door's own control by
       * identity rather than to whatever happens to be found first
       * (CLAUDE.md trap 19).
       */
      const CONTROL = '[role="button"]'
      const controlIn = (el: HTMLElement | null | undefined) =>
        (el?.querySelector(CONTROL) as HTMLElement | null) ?? null
      const controlArity = (el: HTMLElement | null | undefined) =>
        el ? el.querySelectorAll(CONTROL).length : 0
      const ghostEls = () =>
        ([...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]).filter((el) =>
          (el.dataset.id ?? '').startsWith(GHOST),
        )
      const realEls = () =>
        ([...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]).filter(
          (el) => !(el.dataset.id ?? '').startsWith(GHOST),
        )

      // Sample repeatedly. A single snapshot cannot tell a permanent hidden state
      // from a transient one, and this lane's history is of exactly that error.
      const samples: Array<{ hiddenGhosts: number; visibleGhosts: number; visibleReal: number }> = []
      for (let i = 0; i < 12; i++) {
        samples.push({
          hiddenGhosts: ghostEls().filter((el) => getComputedStyle(el).visibility === 'hidden').length,
          visibleGhosts: ghostEls().filter((el) => getComputedStyle(el).visibility !== 'hidden').length,
          visibleReal: realEls().filter((el) => getComputedStyle(el).visibility !== 'hidden').length,
        })
        await new Promise((r) => setTimeout(r, 250))
      }

      const doors = ghostEls().map((el) => ({
        ...readOne(el),
        focusesWrapper: focusable(el),
        focusesControl: focusable(controlIn(el)),
        controlArity: controlArity(el),
        innerRole: controlIn(el)?.getAttribute('role') ?? null,
      }))

      // POSITIVE CONTROL: the same reader, shown a door it should call hidden.
      let control: { visibility: string; innerText: string; focusable: boolean; controlArity: number } | null = null
      const first = ghostEls()[0]
      if (first) {
        const clone = first.cloneNode(true) as HTMLElement
        clone.removeAttribute('data-id')
        clone.style.visibility = 'hidden'
        first.parentElement!.appendChild(clone)
        control = {
          visibility: getComputedStyle(clone).visibility,
          innerText: (clone.innerText || '').trim(),
          focusable: focusable(controlIn(clone)),
          controlArity: controlArity(clone),
        }
        clone.remove()
      }

      const ro = (window as unknown as { __RO_LOG__: { observes: string[]; entries: string[] } }).__RO_LOG__
      const store = (window as unknown as {
        useCanvasStore: {
          getState: () => {
            nodes: Array<{ id: string; measured?: { width?: number; height?: number } }>
            results: { status: string }
            viewMode: string
          }
        }
      }).useCanvasStore.getState()

      return {
        samples,
        doors,
        control,
        realVisible: realEls().filter((el) => getComputedStyle(el).visibility !== 'hidden').length,
        realTotal: realEls().length,
        ghostReobserves: ro.observes.filter((o) => o.startsWith(GHOST)).length,
        realReobserves: ro.observes.filter((o) => !o.startsWith(GHOST)).length,
        realMeasuredCount: store.nodes.filter((n) => n.measured?.width && n.measured?.height).length,
        storeRealCount: store.nodes.length,
        resultsStatus: store.results?.status,
        viewMode: store.viewMode,
      }
    }, GHOST_ID_PREFIX)

    // eslint-disable-next-line no-console
    console.log(`GHOSTJSON ${JSON.stringify({ id, ...m, doors: m.doors.map((d) => d.id) })}`)

    // ── the positive control first: if the probe cannot see `hidden`, nothing
    //    below is evidence.
    expect(m.control, 'no door was placed at all, so the control could not be built').not.toBeNull()
    expect(m.control!.visibility, 'the reader could not see a deliberately hidden door — every verdict below is vacuous').toBe('hidden')
    expect(m.control!.innerText, 'innerText was not layout-aware, so the emptiness signal is not being read').toBe('')
    expect(m.control!.focusable, 'a hidden control was focusable, so the focus probe does not discriminate').toBe(false)
    expect(m.control!.controlArity, 'the control resolver stopped finding exactly one control — it is reading something else now').toBe(1)

    // ── the frontier is placed at all
    expect(m.doors.length, 'the frontier placed no doors on this starter').toBeGreaterThan(0)

    // ── DIRECTION A: every placed door is visible, sized, labelled and focusable
    for (const d of m.doors) {
      expect(d.visibility, `${d.id} is not visible to a sighted user`).not.toBe('hidden')
      expect(d.w * d.h, `${d.id} has a zero-area box`).toBeGreaterThan(0)
      expect(d.innerText.length, `${d.id} renders no visible label`).toBeGreaterThan(0)
      expect(d.innerText, `${d.id}'s visible label disagrees with its DOM text`).toBe(d.textContent)
      expect(d.controlArity, `${d.id} does not hold exactly one control, so this reading is not bound to the door's own affordance`).toBe(1)
      expect(d.innerRole, `${d.id} is not exposed as a control`).toBe('button')
      // Both channels must agree, and this is the assertion that says so: the
      // control a screen reader can reach is the control a sighted user sees.
      expect(d.focusesControl, `${d.id} is announced as a button but cannot be focused`).toBe(true)
    }

    // ── stability: not one frame of luck
    for (const s of m.samples) {
      expect(s.hiddenGhosts, 'a door was hidden in at least one sample').toBe(0)
      expect(s.visibleGhosts, 'the doors came and went between samples').toBe(m.doors.length)
    }

    // ── contrast: the real nodes, in the same snapshot
    expect(m.realTotal).toBeGreaterThan(0)
    expect(m.realVisible).toBe(m.realTotal)

    // ── the livelock is gone. Pristine measured 1,668 ghost re-observations in
    //    this window; a healthy mount measures tens. The bound is deliberately
    //    loose — it is discriminating against a 40x signal, not tuning a limit.
    expect(m.ghostReobserves, 'the measure/discard livelock is back').toBeLessThan(200)

    // ── the fix suppressed a store write; prove it did not suppress the real one
    expect(m.realMeasuredCount, 'real nodes stopped persisting their measured dimensions').toBe(m.storeRealCount)
  })
}

test('GHOST doors are ABSENT once the frontier is withdrawn — post-analysis, non-Expert view', async ({ page }) => {
  await preparePage(page, { width: 1440, height: 900 })
  await openCanvas(page)
    await assertPaneCanRenderGeometry(page)
  await seedStarterDraft(page, 'vendor-selection')
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  const before = await page.evaluate(
    (GHOST: string) => document.querySelectorAll(`.react-flow__node[data-id^="${GHOST}"]`).length,
    GHOST_ID_PREFIX,
  )
  // The precondition is PINNED rather than hoped for: if no door was placed, the
  // "none present" assertion below would pass for the wrong reason (trap 13b).
  expect(before, 'no door was placed before the gate was flipped, so the absence proves nothing').toBeGreaterThan(0)

  await page.evaluate(() => {
    const w = window as unknown as {
      useCanvasStore: {
        getState: () => { setViewMode: (m: 'standard' | 'expert') => void; results: Record<string, unknown> }
        setState: (p: Record<string, unknown>) => void
      }
    }
    w.useCanvasStore.getState().setViewMode('standard')
    w.useCanvasStore.setState({ results: { ...w.useCanvasStore.getState().results, status: 'complete' } })
  })
  await page.waitForTimeout(500)

  const after = await page.evaluate(
    (GHOST: string) => document.querySelectorAll(`.react-flow__node[data-id^="${GHOST}"]`).length,
    GHOST_ID_PREFIX,
  )
  expect(after, 'the frontier is meant to withdraw after an analysis outside Expert view').toBe(0)
})

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐⭐ THE TWO CLASSES THE EVIDENCE ABOVE DOES NOT COVER — added 2 Sep 2026.
 *
 * Everything above seeds with the harness's `seedStarterDraft`, which calls
 * `applyDraftResult` DIRECTLY and asserts `layoutVersion > 0`. That is ONE
 * route into ONE state class: a freshly drafted graph that has just been laid
 * out. A user reaches neither of those from the landing screen.
 *
 * ⚠ THE ROUTE. Clicking a saved-example card runs `applyStarter`
 * (`starters/loadStarter.ts`), not `applyDraftResult`, and it does two things
 * the seeded path never does: `stampStarterProvenance` REPLACES every node
 * object after the ingest, and it writes the autosave itself. Both are extra
 * churn through exactly the seam #1136 repaired, and no browser evidence
 * touched them.
 *
 * ⚠ THE ENTRY PATH. `seedStarterDraft` reaches the store by calling
 * `applyDraftResult` in the page that is already open. A RETURNING user's graph
 * arrives instead through the BOOT restore — `loadState()` → `hydrateGraphSlice`
 * — in a document that has just loaded. That path was invisible to this file,
 * and it is what the second test below covers.
 *
 * ⚠⚠ WHAT IT DOES **NOT** COVER, STATED PLAINLY BECAUSE THE FIRST VERSION OF
 * THIS COMMENT GOT IT WRONG. `hooks/useRestoredLayoutWidth.ts` is built on a
 * restored model never laying out (`layoutVersion === 0`), and this file claimed
 * to exercise that. **It does not.** Measured on this fixture: `layoutVersion`
 * reads **2 in 3 of 3 full-suite runs** and 0 in 5 of 6 standalone runs — so a
 * layout usually DOES run here, and never reliably does not. The no-layout
 * property is therefore UNCOVERED by this file and belongs to the layout lane;
 * the door readings below are unaffected either way (0 hidden frames in every
 * one of those runs). Saying "the restored class" without this paragraph would
 * be a test whose stated precondition is not the one it achieves.
 *
 * That scoping gap is what allowed a report of "the deployed fix does not work
 * for real users" to stand for a day: the fix's evidence and the failure report
 * were about different state classes, and nothing here could say so.
 *
 * ⭐ SAMPLED PER ANIMATION FRAME, not on a 250ms timer. The livelock oscillates
 * at frame rate — the pre-fix arm below re-observes ~14,000 times in 20s and
 * mints ~2,400 node arrays, roughly one per frame — so a door can PAINT for a
 * frame and be discarded before the next sample. A sampler slower than the
 * phenomenon reports a steady state that is not steady, in either direction: a
 * founder sampling at 1.5s saw only `hidden` and a screenshot caught them
 * painted. Frames are the honest unit.
 *
 * MEASURED, production builds, `build-vs-buy` opened by its card, one reader,
 * positive control firing in BOTH arms (a discriminating pair — one arm alone
 * proves nothing):
 *
 *                                      53cc5196    #1136 guard reverted
 *   frames with any door hidden        0 / 2402       2398 / 2398
 *   doors at rest                      4/4 visible    4/4 HIDDEN
 *   nodes-array identities in 20s      0              2,397
 *   ghost re-observations              44             12,960
 *   real nodes visible (contrast)      19 / 19        19 / 19
 *
 * and through a real document reload (the boot-restore path): 0 / 2401 hidden at
 * `53cc5196`, 2395 / 2395 hidden with the guard reverted, 14,088
 * re-observations.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/** The saved-example card is the product's own route in. Bound by test id. */
const SAVED_EXAMPLE: StarterId = 'build-vs-buy'

/**
 * Open a saved example the way a user does — the CARD, not `applyDraftResult`.
 *
 * The card's presence is asserted before the click so a renamed test id fails
 * loudly here rather than turning every assertion below into a statement about
 * an empty canvas.
 */
async function openSavedExample(page: import('@playwright/test').Page): Promise<void> {
  const card = page.locator(`[data-testid="starter-decision-${SAVED_EXAMPLE}"]`)
  await expect(card, 'the saved-example card is not on the landing screen — this route no longer exists').toBeVisible({ timeout: 30_000 })
  await card.click()
  await page.waitForFunction(
    () => (window as unknown as { useCanvasStore: { getState: () => { nodes: unknown[] } } }).useCanvasStore.getState().nodes.length > 0,
    undefined,
    { timeout: 30_000 },
  )
}

/**
 * Sample every animation frame, and read the doors, the contrast control, the
 * livelock counter and the positive control through ONE reader — so a control
 * that agrees cannot be agreeing through a different code path.
 */
const FRAME_READER = async (GHOST: string) => {
  const ghostEls = () =>
    ([...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]).filter((el) =>
      (el.dataset.id ?? '').startsWith(GHOST),
    )
  const realEls = () =>
    ([...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]).filter(
      (el) => !(el.dataset.id ?? '').startsWith(GHOST),
    )
  const focusable = (el: HTMLElement | null | undefined) => {
    if (!el) return false
    el.focus()
    const ok = document.activeElement === el
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    return ok
  }
  const CONTROL = '[role="button"]'
  const controlIn = (el: HTMLElement | null | undefined) =>
    (el?.querySelector(CONTROL) as HTMLElement | null) ?? null

  const FRAMES = 240
  /*
   * Frames at the head of the window that are NOT asserted on. Measured across
   * six runs, the doors read hidden in 0-2 frames and always at the very start
   * (indices [], [0], [0,1]) — a settle transient, not the defect. 40 frames is
   * an order of magnitude of headroom over the largest transient seen and still
   * leaves 200 consecutive frames (~1.7s) under assertion. It is a SETTLE
   * window, not a tolerance on the defect: the livelock reads hidden in every
   * frame of the window including the last, so no choice of settle within the
   * window could hide it.
   */
  const SETTLE_FRAMES = 40
  let framesWithADoorHidden = 0
  let framesWithNoDoor = 0
  let framesAllDoorsVisible = 0
  /*
   * ⚠ COUNTED IN THE LOOP, NOT DERIVED FROM `hiddenFrameIndices` — and this cost
   * a real defect on the way in. The indices array is CAPPED at 12 entries for
   * legibility, so a run whose hidden frames start at index 0 fills it before
   * index 40 and a count derived from it can never exceed 0 however long the
   * livelock runs. Measured on the reverted arm: 240 of 240 frames hidden and
   * the derived figure read ZERO — the settle assertion was structurally
   * incapable of failing, and only the per-door at-rest reading caught the
   * defect. A guard that cannot fail is not a guard (CLAUDE.md trap 13). The
   * capped array stays, for diagnostics only.
   */
  let framesHiddenAfterSettle = 0
  const hiddenFrameIndices: number[] = []
  for (let i = 0; i < FRAMES; i++) {
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const g = ghostEls()
    if (g.length === 0) framesWithNoDoor++
    else if (g.some((el) => getComputedStyle(el).visibility === 'hidden')) {
      framesWithADoorHidden++
      if (i >= SETTLE_FRAMES) framesHiddenAfterSettle++
      if (hiddenFrameIndices.length < 12) hiddenFrameIndices.push(i)
    } else framesAllDoorsVisible++
  }

  const doors = ghostEls().map((el) => ({
    id: el.dataset.id ?? el.id,
    visibility: getComputedStyle(el).visibility,
    w: el.offsetWidth,
    h: el.offsetHeight,
    innerText: (el.innerText || '').trim(),
    textContent: (el.textContent || '').trim(),
    controlArity: el.querySelectorAll(CONTROL).length,
    innerRole: controlIn(el)?.getAttribute('role') ?? null,
    focusesControl: focusable(controlIn(el)),
  }))

  // POSITIVE CONTROL: the same reader, shown a door it must call hidden.
  let control: { visibility: string; innerText: string; focusable: boolean } | null = null
  const first = ghostEls()[0]
  if (first) {
    const clone = first.cloneNode(true) as HTMLElement
    clone.removeAttribute('data-id')
    clone.style.visibility = 'hidden'
    first.parentElement!.appendChild(clone)
    control = {
      visibility: getComputedStyle(clone).visibility,
      innerText: (clone.innerText || '').trim(),
      focusable: focusable(controlIn(clone)),
    }
    clone.remove()
  }

  const ro = (window as unknown as { __RO_LOG__: { observes: string[]; entries: string[] } }).__RO_LOG__
  const store = (window as unknown as {
    useCanvasStore: {
      getState: () => {
        nodes: Array<{ id: string; measured?: { width?: number; height?: number }; data?: { starterId?: unknown } }>
        layoutVersion: number
      }
    }
  }).useCanvasStore.getState()

  return {
    frames: FRAMES,
    framesWithADoorHidden,
    framesWithNoDoor,
    framesAllDoorsVisible,
    hiddenFrameIndices,
    settleFrames: SETTLE_FRAMES,
    // Hidden frames AFTER the settle window. See the assertion for why this, and
    // not the raw count, is the honest discriminator — and see the loop above
    // for why it is counted there rather than derived here.
    framesHiddenAfterSettle,
    doors,
    control,
    realTotal: realEls().length,
    realVisible: realEls().filter((el) => getComputedStyle(el).visibility !== 'hidden').length,
    ghostReobserves: ro.observes.filter((o) => o.startsWith(GHOST)).length,
    realReobserves: ro.observes.filter((o) => !o.startsWith(GHOST)).length,
    layoutVersion: store.layoutVersion,
    /*
     * Whether this DOCUMENT is the post-reload one, stamped by the same init
     * script that carries the persisted records across the harness's storage
     * wipe — so it can only be present in a document entered by that reload.
     *
     * ⚠ NOT `performance.getEntriesByType('navigation')`, which was the obvious
     * choice and is EMPTY here: `preparePage` freezes the clock
     * (`page.clock.setFixedTime`), and the navigation timing entry does not
     * survive it. Asserting `.type === 'reload'` against that read `null` and
     * failed loudly, which is the only reason it was caught rather than becoming
     * a class pin that could never hold.
     */
    postReloadDocument: (window as unknown as { __GHOST_POST_RELOAD__?: boolean }).__GHOST_POST_RELOAD__ === true,
    storeNodeCount: store.nodes.length,
    realMeasuredCount: store.nodes.filter((n) => n.measured?.width && n.measured?.height).length,
    starterStamped: store.nodes.filter((n) => typeof n.data?.starterId === 'string').length,
  }
}

/** Every assertion both new classes share, so the two cannot drift apart. */
function assertFrontierIsUsable(m: Awaited<ReturnType<typeof FRAME_READER>>, where: string): void {
  // The control first: if the reader cannot see `hidden`, nothing below is evidence.
  expect(m.control, `${where}: no door was placed at all, so the control could not be built`).not.toBeNull()
  expect(m.control!.visibility, `${where}: the reader could not see a deliberately hidden door — every verdict below is vacuous`).toBe('hidden')
  expect(m.control!.innerText, `${where}: innerText was not layout-aware, so the emptiness signal is not being read`).toBe('')
  expect(m.control!.focusable, `${where}: a hidden control was focusable, so the focus probe does not discriminate`).toBe(false)

  expect(m.doors.length, `${where}: the frontier placed no doors`).toBeGreaterThan(0)
  for (const d of m.doors) {
    expect(d.visibility, `${where}: ${d.id} is not visible to a sighted user`).not.toBe('hidden')
    expect(d.w * d.h, `${where}: ${d.id} has a zero-area box`).toBeGreaterThan(0)
    expect(d.innerText.length, `${where}: ${d.id} renders no visible label`).toBeGreaterThan(0)
    expect(d.innerText, `${where}: ${d.id}'s visible label disagrees with its DOM text`).toBe(d.textContent)
    expect(d.controlArity, `${where}: ${d.id} does not hold exactly one control, so this reading is not bound to the door's own affordance`).toBe(1)
    expect(d.innerRole, `${where}: ${d.id} is not exposed as a control`).toBe('button')
    expect(d.focusesControl, `${where}: ${d.id} is announced as a button but cannot be focused`).toBe(true)
  }

  expect(m.framesWithNoDoor, `${where}: the doors vanished from the DOM in ${m.framesWithNoDoor} of ${m.frames} frames`).toBe(0)

  /*
   * ⚠ THE DEFECT IS PERMANENCE, AND THIS ASSERTION SAYS SO RATHER THAN PICKING
   * A TOLERANCE. Reverted, all four doors read hidden in 240 of 240 frames — the
   * first, the last and every one between. At this tip the reading is 0-2 frames
   * and always at the very start of the window. So the honest statement is not
   * "a few hidden frames are acceptable" — a tuned limit, and one that would
   * still pass at 20 scattered through the window — but "the hidden state must
   * not survive the settle". A livelock cannot satisfy that at any settle value.
   *
   * ⚠ NAMED HONESTLY: I have not established WHAT paints those first frames. It
   * is consistent with React Flow painting a node hidden until its first
   * measurement, but sampling starts long after quiescence, so that is a
   * plausible reading and not a derivation. The bound does not depend on the
   * answer — only on the frames not repeating — but the gap is recorded rather
   * than papered over, and it is worth resolving if this ever climbs.
   */
  expect(
    m.framesHiddenAfterSettle,
    `${where}: a door was hidden after the ${m.settleFrames}-frame settle — ${m.framesWithADoorHidden} of ${m.frames} frames hidden, at indices ${JSON.stringify(m.hiddenFrameIndices)}. The livelock reading is 240 of 240, every frame, including the last.`,
  ).toBe(0)

  // Contrast: the real nodes, in the same snapshot. A "hidden" reading is only
  // a finding if something else in the same DOM reads visible.
  expect(m.realTotal, `${where}: no real nodes to contrast against`).toBeGreaterThan(0)
  expect(m.realVisible, `${where}: real nodes were hidden too, so this is not a ghost-specific reading`).toBe(m.realTotal)

  // The livelock. Pre-fix this measured 12,960-14,088 re-observations of four
  // elements whose box never changed; a healthy mount measures tens. The bound
  // discriminates against a ~300x signal, it does not tune a limit.
  expect(m.ghostReobserves, `${where}: the measure/discard livelock is back (${m.ghostReobserves} re-observations)`).toBeLessThan(200)

  // The fix suppresses a store write; prove it did not suppress the real one.
  expect(m.realMeasuredCount, `${where}: real nodes stopped persisting their measured dimensions`).toBe(m.storeNodeCount)
}

test('GHOST doors are visible on the SAVED-EXAMPLE route — applyStarter, not applyDraftResult', async ({ page }) => {
  await page.addInitScript(INSTRUMENT)
  await preparePage(page, { width: 1440, height: 900 })
  await openCanvas(page)
    await assertPaneCanRenderGeometry(page)
  await openSavedExample(page)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  const m = await page.evaluate(FRAME_READER, GHOST_ID_PREFIX)
  // eslint-disable-next-line no-console
  console.log(`GHOSTJSON ${JSON.stringify({ where: 'saved-example', ...m, doors: m.doors.map((d) => d.id) })}`)

  // THE ROUTE IS PINNED IN-TEST. `applyStarter` is the only thing that stamps
  // `starterId`, so this asserts the graph arrived through the route this test
  // exists to cover — without it, a change that silently rerouted the card
  // through `applyDraftResult` would leave this passing as a duplicate of the
  // tests above.
  expect(m.starterStamped, 'the graph carries no starter stamp, so it did not arrive through applyStarter — this test is no longer about the saved-example route').toBe(m.storeNodeCount)

  assertFrontierIsUsable(m, 'saved-example')
})

test('GHOST doors are visible in the RESTORED class — a saved example after a real reload', async ({ page }) => {
  await page.addInitScript(INSTRUMENT)
  await preparePage(page, { width: 1440, height: 900 })
  await openCanvas(page)
    await assertPaneCanRenderGeometry(page)
  await openSavedExample(page)
  await waitForVisualQuiescence(page)

  /*
   * ⚠ THE HARNESS WIPES STORAGE ON EVERY NAVIGATION, AND THAT INCLUDES THE
   * RELOAD. `preparePage` registers an init script calling `localStorage.clear()`
   * so each capture starts from a pinned posture — correct for every other test
   * here, and fatal for this one: it deletes the autosave the boot arbiter is
   * about to restore FROM, so the reload lands on an empty canvas and the
   * assertions below would pass or fail for reasons that have nothing to do with
   * the doors. Measured: `olumi-canvas-autosave` 30,433 bytes before the reload,
   * key absent after.
   *
   * So the records the product itself just wrote are carried across by hand and
   * re-seeded by a LATER init script — later, therefore after the clear, because
   * Playwright runs init scripts in registration order. Nothing is synthesised:
   * every value is read back out of `localStorage`, and the boot path and
   * `hydrateGraphSlice` then run exactly as they do for a returning user.
   *
   * ⚠ WHICH RESTORE PATH THIS EXERCISES, NAMED RATHER THAN LEFT TO INFERENCE.
   * A guest opening a saved example gets NO scenario pointer
   * (`olumi-canvas-current-scenario-id` is null, measured), so the boot arbiter's
   * scenario/autosave branch does not claim it and `ReactFlowGraph`'s init effect
   * falls through to `loadState()` → `hydrateGraphSlice`. Both keys are carried
   * because the branch taken is the product's decision, not this test's: the
   * autosave alone restores nothing here, which is exactly the trap of seeding
   * the record you assumed would be read. What the class is defined by — real
   * positions, `hydrateGraphSlice`, and no layout ever running — is asserted
   * below, not assumed.
   */
  const carried = await page.evaluate(() => ({
    autosave: localStorage.getItem('olumi-canvas-autosave'),
    scenarioId: localStorage.getItem('olumi-canvas-current-scenario-id'),
    canvasStorage: localStorage.getItem('canvas-storage'),
  }))
  expect(
    carried.autosave || carried.canvasStorage,
    'the saved example persisted nothing, so there is nothing for a reload to restore and this test would measure an empty canvas',
  ).toBeTruthy()
  await page.addInitScript((c: { autosave: string | null; scenarioId: string | null; canvasStorage: string | null }) => {
    try {
      if (c.autosave) localStorage.setItem('olumi-canvas-autosave', c.autosave)
      if (c.scenarioId) localStorage.setItem('olumi-canvas-current-scenario-id', c.scenarioId)
      if (c.canvasStorage) localStorage.setItem('canvas-storage', c.canvasStorage)
    } catch { /* storage unavailable — the node-count wait below will catch it */ }
    // Stamp the document this script runs in. Registered after the first load,
    // so it marks the RELOADED document and nothing else — the class pin below
    // reads it.
    ;(window as unknown as { __GHOST_POST_RELOAD__?: boolean }).__GHOST_POST_RELOAD__ = true
  }, carried)

  // A REAL document reload. Not a hash change and not a store reset: the
  // restore has to run, which is the whole point of this class.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(
    () => typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState === 'function',
    undefined,
    { timeout: 30_000 },
  )
  await page.waitForFunction(
    () => (window as unknown as { useCanvasStore: { getState: () => { nodes: unknown[] } } }).useCanvasStore.getState().nodes.length > 0,
    undefined,
    { timeout: 30_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  const m = await page.evaluate(FRAME_READER, GHOST_ID_PREFIX)
  // eslint-disable-next-line no-console
  console.log(`GHOSTJSON ${JSON.stringify({ where: 'restored', ...m, doors: m.doors.map((d) => d.id) })}`)

  expect(m.storeNodeCount, 'the reload restored no model').toBeGreaterThan(0)

  // The doors are asserted BEFORE the entry-path pins, deliberately: both are
  // enforced in the same run, so the test cannot pass on the wrong path either
  // way, and the order only decides which truth you are told first. The door
  // reading is the one this file exists for — with #1136 reverted it is 4/4
  // hidden in 240 of 240 frames, and that should be the first thing a failing
  // run says.
  assertFrontierIsUsable(m, 'restored')

  /*
   * ⭐ WHAT THIS TEST COVERS, PINNED IN-TEST — CLAUDE.md trap 13b, a guard must
   * pin its own precondition. Without these two, a change that stopped the
   * reload restoring (or started re-seeding after it) would leave this green
   * while silently becoming a third copy of the fresh-draft test above.
   *
   * THE CLAIM IS THE ENTRY PATH, AND ONLY THAT: this document is the one the
   * RELOAD produced, and it holds a stamped saved-example graph. Nothing in this
   * document applies a draft after the reload, so a graph that is here arrived
   * through the BOOT RESTORE (`loadState()` → `hydrateGraphSlice`). Both halves
   * are asserted, so the claim cannot quietly stop being true.
   *
   * ⚠⚠ IT DOES NOT CLAIM `layoutVersion === 0`, AND AN EARLIER VERSION OF THIS
   * COMMENT EFFECTIVELY DID — which is the vacuity pattern appearing inside the
   * file written to close a scoping gap. That property is what
   * `hooks/useRestoredLayoutWidth.ts` depends on, it was my first choice of pin,
   * and this fixture does not produce it: measured **2 in 3 of 3 full-suite runs**
   * (the ordering a gate would use) and 0 in 5 of 6 standalone runs. Asserting it
   * would red on ordering alone; describing the test as covering it would be a
   * stated precondition the test never achieves. So it is neither asserted nor
   * claimed — only REPORTED in the JSON below as a diagnostic, and handed to the
   * layout lane as genuinely uncovered. The door verdict is unaffected: 0 hidden
   * frames in every one of those runs, at both values.
   */
  expect(m.postReloadDocument, 'this document is not the one the reload produced, so the graph on screen was not restored — this test is not measuring the restored class').toBe(true)
  expect(m.starterStamped, 'the restored graph carries no starter stamp, so it is not the saved example this test opened').toBe(m.storeNodeCount)
})

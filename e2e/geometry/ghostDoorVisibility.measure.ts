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

for (const id of STARTERS) {
  test(`GHOST doors are visible and focusable — ${id}`, async ({ page }) => {
    await page.addInitScript(INSTRUMENT)
    await preparePage(page, { width: 1440, height: 900 })
    await openCanvas(page)
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

/**
 * THE DOORS ON A RESTORED MODEL — the state class #1136 did not cover.
 *
 * ⭐⭐ AND THE CONTROL THAT HAD TO COME FIRST: AN INSTRUMENT THAT CANNOT SEE.
 *
 * #1136 fixed a measure/discard livelock and was verified on ONE state class:
 * a fresh seeded draft. A restored model — one arriving already built — was
 * then reported still broken, 4/4 doors hidden with 19/19 real nodes visible.
 *
 * Chasing that in a browser pane produced a beautiful, entirely false reading:
 * React Flow appeared never to measure ANY node, and the doors appeared
 * permanently hidden. The pane was not painting. `document.visibilityState`
 * read `hidden`, `requestAnimationFrame` never fired, and a FRESH ResizeObserver
 * on a throwaway element delivered ZERO callbacks — initial and after a real
 * resize. ResizeObserver delivery is rAF-driven, so in a non-painting context
 * nothing is ever measured, and every node that depends on measurement is
 * hidden by construction.
 *
 * ⚠⚠ AND THE CONTRAST CONTROL DOES NOT CATCH IT ON THIS STATE CLASS. That is
 * the trap worth writing down. "19/19 real nodes visible while 4/4 doors are
 * hidden" reads like a discriminating measurement, and on a FRESH DRAFT it is
 * one — there the real nodes need measuring too, so a blind instrument would
 * hide them as well. On a RESTORED model the real nodes arrive with `measured`
 * already on them, so they are visible WITHOUT any measurement ever happening.
 * The contrast control is therefore satisfied by a completely blind browser,
 * and it is satisfied in exactly the state class where it is being relied on.
 *
 * So this file asserts its own ability to see BEFORE it asserts anything about
 * the product. If rAF is frozen or a fresh ResizeObserver does not deliver, it
 * FAILS LOUD rather than reporting four hidden doors (CLAUDE.md trap 13 — an
 * absence probe with no positive control; and trap 20 — a probe that returns the
 * same convenient answer for every item is reporting on itself).
 *
 * Run it deliberately:
 *     GEOMETRY_PORT=5397 pnpm exec playwright test -c playwright.geometry.config.ts --grep RESTORED
 */
import { test, expect, type Page } from '@playwright/test'
import {
  openCanvas,
  seedStarterDraft,
  clearNotifications,
  freezeMotion,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  FROZEN_TIME,
  type StarterId,
} from '../visual/harness'
import { posturePins } from '../visual/flagPosture'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

/**
 * ⚠ `harness.preparePage` CLEARS STORAGE ON EVERY NAVIGATION, so a reload after
 * it is NOT the restore state class — it is an empty canvas. The recipe below is
 * `viewportRestoreFit.measure.ts`'s, reused rather than reinvented: clear once
 * per tab, marked by a `sessionStorage` sentinel that survives the reload and
 * that `localStorage.clear()` cannot touch.
 */
async function prepareKeepingStorage(page: Page, vp: { width: number; height: number }) {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        if (!sessionStorage.getItem('__ghostRestoreProbePrepared')) {
          localStorage.clear()
          sessionStorage.clear()
          sessionStorage.setItem('__ghostRestoreProbePrepared', '1')
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
}

const STARTERS: StarterId[] = ['vendor-selection', 'market-entry', 'build-vs-buy']

/**
 * Can this browser see anything at all?
 *
 * Returns the four readings that decide it. A caller must assert them BEFORE
 * reading any visibility, because a non-painting context reports every
 * measurement-dependent node as hidden and looks exactly like the defect.
 *
 * ⚠ WHICH LIMB IS LOAD-BEARING — MEASURED, NOT ASSUMED, and the first answer was
 * wrong. Blinding the page's `requestAnimationFrame` (a no-op stub, applied via
 * `addInitScript`) did NOT make this control fire: the whole suite still passed.
 * Chromium delivers ResizeObserver callbacks internally, not through the page's
 * `requestAnimationFrame` binding, so the `raf` limb can read healthy while
 * delivery is dead. It is kept because it read 0 alongside the RO limbs in the
 * real blind case, but it must never be relied on alone.
 *
 * The LOAD-BEARING limbs are `initial` and `afterResize`. Replacing
 * `ResizeObserver` with a non-delivering stub REDs this control on all three
 * starters, at the sight assertion rather than at a door assertion — which is
 * the property that matters: a blind browser is reported as BLIND, not as four
 * hidden doors.
 *
 * ⚠ And note how the first mutant lied: its applied-check confirmed the stub was
 * in the FILE and never that rAF was actually stubbed IN THE PAGE at measurement
 * time. An unapplied mutation is indistinguishable from an equivalent one. The
 * second mutant asserts application in-page before believing the survival.
 */
const CAN_SEE = async (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const probe = document.createElement('div')
    probe.style.cssText = 'width:50px;height:50px;position:fixed;left:-9999px'
    document.body.appendChild(probe)
    let fired = 0
    const ro = new ResizeObserver(() => { fired++ })
    ro.observe(probe)
    await new Promise((r) => setTimeout(r, 600))
    const initial = fired
    probe.style.width = '120px'
    await new Promise((r) => setTimeout(r, 600))
    const afterResize = fired
    let raf = 0
    requestAnimationFrame(() => { raf++ })
    await new Promise((r) => setTimeout(r, 400))
    ro.disconnect()
    probe.remove()
    return { visibilityState: document.visibilityState, raf, initial, afterResize }
  })

for (const id of STARTERS) {
  test(`RESTORED model — the doors survive a reload: ${id}`, async ({ page }) => {
    await prepareKeepingStorage(page, { width: 1440, height: 900 })
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, id)

    /*
     * THE STATE CLASS, MADE not assumed. A reload drops every in-session React
     * tree and every store instance; the graph comes back through `loadState()`,
     * so the nodes ARRIVE ALREADY BUILT rather than being drafted in-session.
     * That is the structural feature of the reported class — the doors are
     * injected beside a model nobody drafted in front of them.
     */
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
    // PIN THE PRECONDITION IN-TEST: this must be the RESTORE class, not a fresh
    // draft wearing its clothes. `layoutVersion === 0` says no layout ran, and
    // the node count says the autosave — not a re-draft — is what came back.
    const restored = await page.evaluate(() => {
      const s = (window as unknown as { useCanvasStore: { getState: () => { nodes: unknown[]; layoutVersion: number } } }).useCanvasStore.getState()
      return { nodes: s.nodes.length, layoutVersion: s.layoutVersion }
    })
    expect(restored.nodes, 'nothing was restored — the reload did not reproduce the restore path').toBe(seeded.nodeCount)
    expect(restored.layoutVersion, 'a layout ran on reload — this is no longer the restore state class').toBe(0)
    await clearNotifications(page).catch(() => undefined)
    await minimiseFloatingOlumiPanel(page).catch(() => undefined)
    await waitForVisualQuiescence(page).catch(() => undefined)

    // ── THE INSTRUMENT'S OWN EYES, asserted before anything about the product.
    const sight = await CAN_SEE(page)
    expect(sight.visibilityState, 'the page is not being painted — every visibility reading below would be false').toBe('visible')
    expect(sight.raf, 'requestAnimationFrame never fired — ResizeObserver delivery is rAF-driven, so nothing can be measured').toBeGreaterThan(0)
    expect(sight.initial, 'a fresh ResizeObserver delivered no initial callback — this browser cannot measure').toBeGreaterThan(0)
    expect(sight.afterResize, 'a fresh ResizeObserver did not report a real resize — this browser cannot measure').toBeGreaterThan(sight.initial - 1)

    const m = await page.evaluate(async (GHOST: string) => {
      const all = () => [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
      const ghosts = () => all().filter((e) => (e.dataset.id ?? '').startsWith(GHOST))
      const reals = () => all().filter((e) => !(e.dataset.id ?? '').startsWith(GHOST))
      const samples: Array<{ hidden: number; visible: number; realVisible: number }> = []
      for (let i = 0; i < 10; i++) {
        samples.push({
          hidden: ghosts().filter((e) => getComputedStyle(e).visibility === 'hidden').length,
          visible: ghosts().filter((e) => getComputedStyle(e).visibility !== 'hidden').length,
          realVisible: reals().filter((e) => getComputedStyle(e).visibility !== 'hidden').length,
        })
        await new Promise((r) => setTimeout(r, 300))
      }
      const focusable = (el: HTMLElement | null) => {
        if (!el) return false
        el.focus()
        const ok = document.activeElement === el
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        return ok
      }
      const store = (window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; measured?: { width?: number } }> } } }).useCanvasStore.getState()
      return {
        samples,
        doors: ghosts().map((e) => ({
          id: e.dataset.id!,
          visibility: getComputedStyle(e).visibility,
          box: `${e.offsetWidth}x${e.offsetHeight}`,
          innerText: (e.innerText || '').trim(),
          focusesControl: focusable(e.querySelector('[role="button"]') as HTMLElement | null),
          controlArity: e.querySelectorAll('[role="button"]').length,
        })),
        realTotal: reals().length,
        realVisible: reals().filter((e) => getComputedStyle(e).visibility !== 'hidden').length,
        /*
         * ⭐ THE FIGURE THAT EXPLAINS WHY THE CONTRAST CONTROL IS BLIND HERE.
         * On a restored model the persisted nodes carry `measured`, so they do
         * not need React Flow to measure them. Recorded so the report can say
         * so rather than assert it.
         */
        restoredNodesCarryingMeasured: store.nodes.filter((n) => n.measured?.width).length,
        storeNodeCount: store.nodes.length,
      }
    }, GHOST_ID_PREFIX)

    // eslint-disable-next-line no-console
    console.log(`RESTOREDJSON ${JSON.stringify({ id, sight, ...m })}`)

    expect(m.doors.length, 'the frontier placed no doors after the reload').toBeGreaterThan(0)
    for (const d of m.doors) {
      expect(d.visibility, `${d.id} is hidden on a RESTORED model`).not.toBe('hidden')
      expect(d.controlArity, `${d.id} does not hold exactly one control`).toBe(1)
      expect(d.innerText.length, `${d.id} renders no visible label`).toBeGreaterThan(0)
      expect(d.focusesControl, `${d.id} cannot be focused`).toBe(true)
    }
    for (const s of m.samples) {
      expect(s.hidden, 'a door was hidden in at least one sample after the reload').toBe(0)
    }
    expect(m.realVisible).toBe(m.realTotal)
  })
}

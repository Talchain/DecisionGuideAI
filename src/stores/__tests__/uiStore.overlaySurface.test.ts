/**
 * uiStore — OVERLAY SURFACE concept (PR3, UI agency).
 *
 * WHY THIS CONCEPT IS SEPARATE (trap 21: write down the question each
 * authority answers before reconciling them). The store now answers three
 * DIFFERENT questions, and they must not be collapsed into one predicate:
 *   - `activeOutputTab`        — which tab is fronted INSIDE the dock?
 *   - `activeRightPanel`       — which PERSISTENT right-side region owns the slot?
 *   - `activeOverlaySurface`   — which TRANSIENT overlay is currently raised?
 * An overlay surface is anchored to a control, self-dismissing, and closed by
 * default (a menu, a pop-up, a coach-mark). It is not a docked region, so it
 * does not belong on `activeRightPanel`.
 *
 * THE USER-AGENCY INVARIANT THIS FILE EXISTS TO PIN.
 * `close_panel` / `close_inspector` were deliberately REJECTED from the
 * ui_directive design — the assistant taking surfaces AWAY from the user
 * inverts the channel's charter. Lifting overlay state out of component-local
 * `useState` into a globally-reachable store is exactly the change that could
 * make AI-driven closing possible BY ACCIDENT. So the assistant-facing action
 * is open-only by construction, and this file proves it two independent ways:
 *   (1) a DERIVED guard iterating the canonical id list — proves every consumer
 *       agrees with the list;
 *   (2) a HAND-WRITTEN adversarial corpus — proves the list is not the only
 *       thing standing between a hostile argument and a closed menu.
 * Trap 12d: derivation moves the risk, it does not remove it. Ship both.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  useUIStore,
  OVERLAY_SURFACE_IDS,
  type OverlaySurfaceId,
} from '../uiStore'

/** Pristine overlay slice. Deliberately does NOT touch the tab/panel slices —
 *  this concept is independent of them and a shared reset would hide a leak. */
function resetOverlaySlice() {
  useUIStore.setState({ activeOverlaySurface: null, overlaySurfaceOrigin: null })
}

describe('uiStore — overlay surface (assistant-drivable, open-only)', () => {
  beforeEach(resetOverlaySlice)

  // ⚠ Reads getInitialState(), NOT getState(). `resetOverlaySlice` uses
  // `setState`, which in Zustand MERGES arbitrary keys — so a `getState()`
  // assertion here would pass because the RESET wrote the value, not because
  // the store declares the default. That is a guard agreeing with itself
  // (trap 13b): it was green at pristine, before the fields existed at all.
  // `getInitialState()` returns the creator's own initial object and no
  // `setState` can reach it, so this binds to the declaration.
  it('declares the overlay slice closed and unstamped in its initial state', () => {
    const initial = useUIStore.getInitialState()
    expect(initial.activeOverlaySurface).toBeNull()
    expect(initial.overlaySurfaceOrigin).toBeNull()
    // Precondition pinned in-test: the reset really can write these keys, so
    // the assertion above is about the declaration and not about an absence.
    useUIStore.setState({ activeOverlaySurface: 'top_bar_menu' })
    expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
    expect(useUIStore.getInitialState().activeOverlaySurface).toBeNull()
  })

  // ── The USER path: may open AND close ────────────────────────────────────
  it('setOverlaySurface opens a surface and stamps origin "user"', () => {
    useUIStore.getState().setOverlaySurface('top_bar_menu')
    expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')
  })

  it('setOverlaySurface(null) closes and clears the origin', () => {
    useUIStore.getState().setOverlaySurface('top_bar_menu')
    useUIStore.getState().setOverlaySurface(null)
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBeNull()
  })

  // ── The ASSISTANT path: may open, and ONLY open ──────────────────────────
  it('requestOverlaySurface opens a surface, stamps origin "assistant", returns true', () => {
    const opened = useUIStore.getState().requestOverlaySurface('top_bar_menu')
    // Assert the POSITIVE outcome — `not.toBe(false)` would pass for undefined.
    expect(opened).toBe(true)
    expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('assistant')
  })

  it('a user can always take back a surface the assistant raised', () => {
    useUIStore.getState().requestOverlaySurface('top_bar_menu')
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('assistant')
    useUIStore.getState().setOverlaySurface(null)
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBeNull()
  })

  // ── (1) DERIVED guard: every canonical id works on BOTH paths ────────────
  // Structurally blind to a MISSING id (that is what the corpus below is for),
  // but it does prove no consumer has drifted from the canonical list.
  it('every canonical overlay id opens on both the user and the assistant path', () => {
    expect(OVERLAY_SURFACE_IDS.length).toBeGreaterThan(0)
    for (const id of OVERLAY_SURFACE_IDS) {
      resetOverlaySlice()
      useUIStore.getState().setOverlaySurface(id)
      expect(useUIStore.getState().activeOverlaySurface).toBe(id)

      resetOverlaySlice()
      expect(useUIStore.getState().requestOverlaySurface(id)).toBe(true)
      expect(useUIStore.getState().activeOverlaySurface).toBe(id)
      expect(useUIStore.getState().overlaySurfaceOrigin).toBe('assistant')
    }
  })

  // ── (2) HAND-WRITTEN adversarial corpus: the open-only invariant ─────────
  // Written from OUTSIDE the enum (trap 22: a corpus drawn only from the
  // author's canonical list cannot see the class the list does not contain).
  // The precondition is PINNED IN-TEST: a user-opened menu must be present
  // BEFORE each hostile call, otherwise "still null" would pass vacuously and
  // the test would agree with itself (trap 13b).
  const HOSTILE_ARGUMENTS: ReadonlyArray<[label: string, value: unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['whitespace-padded id', ' top_bar_menu '],
    ['wrong case', 'TOP_BAR_MENU'],
    ['id without separators', 'topbarmenu'],
    ['a close-sounding verb', 'close'],
    ['a panel mode from the OTHER concept', 'provenance'],
    ['an output tab from the OTHER concept', 'results'],
    ['prototype key', '__proto__'],
    ['number zero', 0],
    ['boolean false', false],
    ['NaN', Number.NaN],
    ['empty object', {}],
    ['empty array', []],
    ['array containing a valid id', ['top_bar_menu']],
    ['object shaped like a ui_target', { kind: 'overlay', id: 'top_bar_menu' }],
  ]

  it.each(HOSTILE_ARGUMENTS)(
    'requestOverlaySurface(%s) cannot close a surface the user opened',
    (_label, value) => {
      // PRECONDITION, pinned in-test: the user has a menu open right now.
      useUIStore.getState().setOverlaySurface('top_bar_menu')
      expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
      expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')

      const opened = (
        useUIStore.getState().requestOverlaySurface as unknown as (v: unknown) => boolean
      )(value)

      expect(opened).toBe(false)
      // The user's surface is UNTOUCHED — not merely "not closed".
      expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
      expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')
    },
  )

  it('a rejected request on a CLOSED store leaves it closed and unstamped', () => {
    const opened = (
      useUIStore.getState().requestOverlaySurface as unknown as (v: unknown) => boolean
    )('not_a_surface')
    expect(opened).toBe(false)
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBeNull()
  })

  // ── The canonical list must contain the surface the deployed TopBar uses ──
  // Union assertion (trap 12d): the id TopBar binds to is not free to drift out
  // of the canonical list without this failing.
  it('the canonical list contains the TopBar kebab surface', () => {
    const topBarSurface: OverlaySurfaceId = 'top_bar_menu'
    expect(OVERLAY_SURFACE_IDS).toContain(topBarSurface)
  })
})

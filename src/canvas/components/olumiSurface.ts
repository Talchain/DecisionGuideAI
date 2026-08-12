/**
 * Olumi composer surface — single source of truth.
 *
 * Three components can host the Olumi conversation composer, and exactly one
 * may be visible at a time:
 *   - hero      → FirstUseComposer (large centred surface on an empty canvas)
 *   - docked    → OlumiTabBody (right-dock "Olumi" tab, when the dock is expanded)
 *   - floating  → FloatingOlumiPanel (draggable window)
 *
 * Historically the "which surface" decision was smeared across several
 * imperative effects/guards in OutputsDock + FloatingOlumiPanel. Each enforced
 * "never show two" but none guaranteed "never show zero" — so requesting the
 * docked Olumi tab on an empty canvas (where the dock collapses to a rail and
 * cannot host the composer) closed the floating/hero surface AND showed no
 * docked surface, stranding the user with no composer at all.
 *
 * This module centralises the decision so the surfaces derive from one rule.
 * `dockHostsOlumi` is the pivotal predicate: the floating/hero surface must be
 * retired ONLY when the docked composer will actually take over.
 *
 * Pure + dependency-free → exhaustively unit-tested in
 * `__tests__/olumiSurfaceInvariant.spec.ts`.
 */

import type { OutputTab } from '../../stores/uiStore'

/**
 * Derived from the store's union rather than hand-mirrored (12 Aug 2026 —
 * this was the THIRD hand-maintained copy of the dock-tab union; adding the
 * 'altview' tab surfaced it via a TS2322). Type-only import: the module stays
 * runtime-dependency-free, `dockHostsOlumi` only ever compares to 'olumi'.
 */
export type OlumiDockTab = OutputTab

export type OlumiSurface = 'hero' | 'docked' | 'floating' | 'none'

export type OlumiFloatingSource = 'system-first-use' | 'user'

export interface OlumiSurfaceInput {
  /** True when the canvas has no nodes (the first-use state). */
  isEmptyCanvas: boolean
  /** The dock's selected tab. */
  dockTab: OlumiDockTab
  /**
   * Whether the dock is VISUALLY showing its body (NOT the collapsed / first-use
   * rail). This is the dock's `effectiveIsOpen` — i.e. `isFirstUse ? false : isOpen`,
   * already resolved by the caller (each surface computes it from the inputs it has).
   */
  dockEffectiveOpen: boolean
  /** Whether a floating/hero Olumi surface is currently open. */
  floatingOpen: boolean
  /** Who opened the floating/hero surface. */
  floatingSource: OlumiFloatingSource
}

/**
 * True when the docked Olumi composer is actually on screen: the Olumi tab is
 * selected AND the dock is showing its body (not the rail). This is the ONLY
 * condition under which the floating/hero surface should be retired in favour
 * of the dock — closing it in any other state strands the user (the bug).
 */
export function dockHostsOlumi(
  i: Pick<OlumiSurfaceInput, 'dockTab' | 'dockEffectiveOpen'>,
): boolean {
  return i.dockEffectiveOpen && i.dockTab === 'olumi'
}

/**
 * The single Olumi composer surface that should be visible for a given state.
 * Total (always returns a value) and mutually exclusive (one surface).
 *
 *   1. docked composer on screen     → 'docked'
 *   2. EMPTY canvas (first-use)       → 'floating' if a USER-opened window is up,
 *                                       else 'hero' (the always-on entry point —
 *                                       NEVER 'none', incl. when nothing is open:
 *                                       the re-engage effect opens it)
 *   3. a floating/hero surface open   → 'floating'
 *   4. otherwise (populated, idle)    → 'none' (user dismissed; reopen from rail)
 *
 * The invariant: on an empty canvas a composer is ALWAYS available, and whenever
 * a floating surface is open OR the dock is hosting Olumi, a composer is visible
 * — never zero. Two earlier dead-ends are closed here:
 *   - retiring the open surface when the Olumi tab was merely *selected* even
 *     though the dock couldn't host it (`dockHostsOlumi`); and
 *   - leaving an empty canvas with NO composer after the dock that hosted Olumi
 *     was collapsed back to the rail (open-dock → close-dock). On an empty
 *     canvas that is 'hero', not 'none'.
 *
 * 'none' is reserved for a POPULATED canvas the user has deliberately left idle
 * (dock collapsed, no floating) — reachable again via the rail, not a dead end.
 */
export function resolveOlumiSurface(i: OlumiSurfaceInput): OlumiSurface {
  if (dockHostsOlumi(i)) return 'docked'
  if (i.isEmptyCanvas) {
    return i.floatingOpen && i.floatingSource === 'user' ? 'floating' : 'hero'
  }
  if (i.floatingOpen) return 'floating'
  return 'none'
}

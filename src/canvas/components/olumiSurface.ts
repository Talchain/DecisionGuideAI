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

export type OlumiDockTab = 'olumi' | 'results' | 'compare' | 'diagnostics' | 'journey'

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
 *   1. docked composer on screen        → 'docked'
 *   2. no floating/hero surface open     → 'none'   (idle/redirect, or the user
 *                                                     collapsed the dock — reachable
 *                                                     via the rail, NOT a dead end)
 *   3. empty canvas + system first-use   → 'hero'
 *   4. otherwise                         → 'floating'
 *
 * The invariant this guarantees: whenever a floating/hero surface is open
 * (`floatingOpen`) OR the dock is hosting Olumi, a composer is visible — never
 * zero. The previous code could reach zero because it retired the open surface
 * whenever the Olumi tab was merely *selected*, regardless of whether the dock
 * could actually host it (`dockHostsOlumi`).
 */
export function resolveOlumiSurface(i: OlumiSurfaceInput): OlumiSurface {
  if (dockHostsOlumi(i)) return 'docked'
  if (!i.floatingOpen) return 'none'
  if (i.isEmptyCanvas && i.floatingSource === 'system-first-use') return 'hero'
  return 'floating'
}

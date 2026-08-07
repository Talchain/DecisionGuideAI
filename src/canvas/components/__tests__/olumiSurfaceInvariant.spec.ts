/**
 * Olumi-surface invariant — guards the single source of truth that decides
 * which Olumi composer surface is visible (hero | docked | floating | none).
 *
 * WHY THIS EXISTS
 * ---------------
 * On an empty canvas, requesting the docked "Olumi" tab (via `?tab=olumi` or a
 * persisted dock preference) used to close the floating/hero composer one frame
 * after it appeared, while the dock — collapsed to a 40px rail on an empty
 * canvas — showed no docked composer either. Net: the Olumi logo + text box
 * flashed, then vanished, leaving no way to type. Reproduced live.
 *
 * ROOT CAUSE: "which surface" was smeared across ~7 imperative effects/guards
 * (OutputsDock + FloatingOlumiPanel) that each enforced "never two" but none
 * enforced "never zero". The pivotal mistake was retiring the open surface
 * whenever the Olumi tab was merely SELECTED, regardless of whether the dock
 * could actually host it.
 *
 * THE FIX: `resolveOlumiSurface` / `dockHostsOlumi` (../olumiSurface) are the
 * single rule. The floating/hero surface is retired ONLY when `dockHostsOlumi`
 * (the dock is showing its body AND the Olumi tab is selected) — i.e. the
 * docked composer genuinely takes over. OutputsDock's close-effect and
 * FloatingOlumiPanel's yield both derive from this predicate.
 *
 * This file imports the PRODUCTION selector (not a copy), so it guards the real
 * behaviour against regression. The absence of this pure seam is exactly why
 * the original bug was invisible to the suite — OutputsDock is ~150 transitive
 * imports and render-tested in CI only.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveOlumiSurface,
  dockHostsOlumi,
  type OlumiSurface,
  type OlumiSurfaceInput,
  type OlumiDockTab,
  type OlumiFloatingSource,
} from '../olumiSurface'

/** Cartesian product of every relevant state dimension. */
function allStates(): OlumiSurfaceInput[] {
  const out: OlumiSurfaceInput[] = []
  for (const isEmptyCanvas of [true, false]) {
    for (const dockTab of ['olumi', 'results'] as OlumiDockTab[]) {
      for (const dockEffectiveOpen of [true, false]) {
        for (const floatingOpen of [true, false]) {
          for (const floatingSource of ['system-first-use', 'user'] as OlumiFloatingSource[]) {
            out.push({ isEmptyCanvas, dockTab, dockEffectiveOpen, floatingOpen, floatingSource })
          }
        }
      }
    }
  }
  return out
}

/** Is an Olumi composer currently engaged? An EMPTY canvas is always engaged —
 *  the first-use hero is its always-on entry point (re-engaged if nothing else
 *  is open), so an empty canvas must never resolve to 'none'. Otherwise: a
 *  floating/hero surface is open, or the dock is hosting Olumi. */
function olumiEngaged(s: OlumiSurfaceInput): boolean {
  return s.isEmptyCanvas || s.floatingOpen || dockHostsOlumi(s)
}

describe('resolveOlumiSurface — invariants over the full state matrix', () => {
  const states = allStates()

  it('covers the full state matrix', () => {
    // 2 empty × 2 tab × 2 dockOpen × 2 floating × 2 source = 32
    expect(states).toHaveLength(32)
  })

  it('I1 — never zero composers while an Olumi surface is engaged', () => {
    const violations = states.filter((s) => olumiEngaged(s) && resolveOlumiSurface(s) === 'none')
    expect(violations).toEqual([])
  })

  it('I1 — resolves to none ONLY when nothing is engaged (idle / user-dismissed)', () => {
    const wrong = states.filter((s) => !olumiEngaged(s) && resolveOlumiSurface(s) !== 'none')
    expect(wrong).toEqual([])
  })

  it('I2 — always exactly one valid surface', () => {
    const valid: OlumiSurface[] = ['hero', 'docked', 'floating', 'none']
    for (const s of states) expect(valid).toContain(resolveOlumiSurface(s))
  })

  it('pivot — the docked surface wins iff dockHostsOlumi (the retire-condition for floating)', () => {
    for (const s of states) {
      expect(resolveOlumiSurface(s) === 'docked').toBe(dockHostsOlumi(s))
    }
  })
})

describe('Dead-states the OLD code reached (proven live) — now resolved', () => {
  // D1 — CONFIRMED LIVE, the reported bug. Empty canvas + ?tab=olumi (or persisted)
  // + the auto-opened first-use hero. Dock is a rail (dockEffectiveOpen=false), so
  // dockHostsOlumi=false → the hero is NOT retired and stays visible.
  it('D1: empty + olumi tab + system hero open → hero', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: true,
        dockTab: 'olumi',
        dockEffectiveOpen: false,
        floatingOpen: true,
        floatingSource: 'system-first-use',
      }),
    ).toBe('hero')
  })

  // D2 — empty canvas + a USER-opened floating panel while the Olumi tab is selected.
  // dockHostsOlumi=false → the floating window is kept (a valid composer). (Showing
  // the *hero* here would require decoupling the hero from its system source — a
  // deferred refinement; a floating composer already satisfies the never-zero rule.)
  it('D2: empty + olumi tab + user-opened floating → floating', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: true,
        dockTab: 'olumi',
        dockEffectiveOpen: false,
        floatingOpen: true,
        floatingSource: 'user',
      }),
    ).toBe('floating')
  })

  // D3 — populated canvas, Olumi tab selected, but the user COLLAPSED the dock and
  // has no floating panel open. This is a user dismissal, not a system dead-end: the
  // composer is one click away on the rail's expand chevron. 'none' is correct here;
  // we intentionally do NOT pop a floating panel and fight the user's collapse.
  it('D3: populated + olumi tab + dock collapsed + no floating → none (reachable via rail)', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: false,
        dockTab: 'olumi',
        dockEffectiveOpen: false,
        floatingOpen: false,
        floatingSource: 'user',
      }),
    ).toBe('none')
  })
})

describe('Healthy states (must stay correct through the refactor)', () => {
  it('populated + olumi tab + dock expanded → docked composer', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: false,
        dockTab: 'olumi',
        dockEffectiveOpen: true,
        floatingOpen: false,
        floatingSource: 'user',
      }),
    ).toBe('docked')
  })

  it('populated + non-olumi tab + floating open → floating composer', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: false,
        dockTab: 'results',
        dockEffectiveOpen: true,
        floatingOpen: true,
        floatingSource: 'user',
      }),
    ).toBe('floating')
  })

  it('empty canvas, nothing open → hero (first-use is always available, never a dead end)', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: true,
        dockTab: 'results',
        dockEffectiveOpen: false,
        floatingOpen: false,
        floatingSource: 'user',
      }),
    ).toBe('hero')
  })

  // D4 — the open-dock-on-Olumi → close-dock dead-end (reported live). Empty
  // canvas, the dock has collapsed back to the rail (dockEffectiveOpen=false) so
  // dockHostsOlumi=false, the hero was retired and nothing is open. On an empty
  // canvas this MUST re-engage the hero, not strand the user with no composer.
  it('D4: empty + olumi tab + dock collapsed + nothing open → hero (re-engages)', () => {
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: true,
        dockTab: 'olumi',
        dockEffectiveOpen: false,
        floatingOpen: false,
        floatingSource: 'user',
      }),
    ).toBe('hero')
  })

  it('docked wins even if a floating surface is also (transiently) open', () => {
    // E2 + the floating yield converge to a single surface; the selector prefers
    // 'docked' so there is never a readable duplicate during the transition.
    expect(
      resolveOlumiSurface({
        isEmptyCanvas: false,
        dockTab: 'olumi',
        dockEffectiveOpen: true,
        floatingOpen: true,
        floatingSource: 'user',
      }),
    ).toBe('docked')
  })
})

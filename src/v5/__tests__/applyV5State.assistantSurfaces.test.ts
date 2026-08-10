/**
 * The assistant's UI-surface seam is OPEN-ONLY, enforced in TYPES.
 *
 * WHY A TYPE AND NOT A COMMENT. `close_panel` / `close_inspector` were
 * deliberately REJECTED from the ui_directive design: the assistant taking
 * surfaces AWAY from the user inverts the channel's charter. Before this
 * change that rule was protected only by the fact that overlay state was
 * unreachable — component-local `useState`. Lifting it into `uiStore` puts a
 * global, non-render-reachable handle on the user's screen, and `uiStore`'s
 * full action set contains `closeRightPanel`, `openRightPanel(null)` and
 * `setOverlaySurface(null)`. Nothing but discipline would have stopped a
 * later lane wiring one of those to a verb.
 *
 * So `applyV5State`'s ui_directive site no longer holds the whole store. It
 * holds `AssistantUiSurfaceActions` — a narrowed handle carrying ONLY actions
 * that RAISE a surface. A close does not typecheck at that seam.
 *
 * HOW THIS GUARD BITES, in both directions:
 *   - widen the seam (add a closing action to `AssistantUiSurfaceActions`) and
 *     the `@ts-expect-error` suppressions below become UNUSED, which `tsc`
 *     reports as an error — the gate goes RED on the widening itself;
 *   - remove a raising action the dispatcher needs and the calls stop
 *     compiling.
 * The repo's typecheck gate derives its file set from `git ls-files` (see
 * scripts/ci/typecheck-gate.sh), so this spec is compiled by the required
 * "Staging Gate" check. The guard is not decorative.
 */
import { describe, it, expect } from 'vitest'
import { useUIStore, type AssistantUiSurfaceActions } from '../../stores/uiStore'

// ── Compile-time half. Exported so they are unambiguously used. ────────────
// Each line asserts an action is ABSENT from the assistant-facing seam.

// @ts-expect-error — the assistant seam must not carry a right-panel close.
export type _NoCloseRightPanel = AssistantUiSurfaceActions['closeRightPanel']

// @ts-expect-error — `openRightPanel(null)` is a close in disguise.
export type _NoOpenRightPanel = AssistantUiSurfaceActions['openRightPanel']

// @ts-expect-error — `setOverlaySurface(null)` is the USER's close action.
export type _NoSetOverlaySurface = AssistantUiSurfaceActions['setOverlaySurface']

// @ts-expect-error — a bare tab set does not front the dock; it is not a raise.
export type _NoSetActiveOutputTab = AssistantUiSurfaceActions['setActiveOutputTab']

describe('assistant UI-surface seam is open-only', () => {
  it('exposes exactly the RAISING actions the directive dispatcher needs', () => {
    const surfaces: AssistantUiSurfaceActions = useUIStore.getState()

    // Every gesture the dispatcher performs today, plus the overlay seam the
    // menu / pop-up / coach-mark verbs will use. All three RAISE something.
    expect(typeof surfaces.forceActivateOutputTab).toBe('function')
    expect(typeof surfaces.requestModelTabSection).toBe('function')
    expect(typeof surfaces.requestOverlaySurface).toBe('function')
  })

  it('the raising actions reject a close-shaped argument', () => {
    const surfaces: AssistantUiSurfaceActions = useUIStore.getState()

    // @ts-expect-error — there is no null overlay id; a raise cannot be a lower.
    const rejected = surfaces.requestOverlaySurface(null)
    expect(rejected).toBe(false)
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
  })

  it('narrows the SEAM without removing the user-facing closes from the store', () => {
    // The guard is about what the assistant can reach, not about deleting the
    // user's own actions — those must still exist for TopBar / OutputsDock.
    expect(typeof useUIStore.getState().closeRightPanel).toBe('function')
    expect(typeof useUIStore.getState().setOverlaySurface).toBe('function')
    expect(typeof useUIStore.getState().openRightPanel).toBe('function')
  })
})

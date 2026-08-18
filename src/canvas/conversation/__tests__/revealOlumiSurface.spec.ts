/**
 * ONE OLUMI, WHEREVER THE USER LEFT IT — `revealOlumiSurface` convergence.
 *
 * ## The defect
 *
 * `revealOlumiSurface()` is THE convergence primitive: every Ask-Olumi, chip,
 * coaching and rerun action launched from the Graph, the Analysis surface or
 * the Inspector funnels through it (six direct call sites plus
 * `withOlumiReveal`, which wraps every guidance-store send). It did two things
 * unconditionally:
 *
 *   forceActivateOutputTab('olumi')   // claim the DOCK
 *   focusFloating()                   // focus the FLOATING panel
 *
 * Those fight each other. Forcing the docked Olumi tab makes `dockHostsOlumi`
 * true, and `FloatingOlumiPanel` returns null the moment it does. So a user
 * working in the floating Olumi window who clicked "Ask Olumi" on a node had
 * that window CLOSED and the conversation relocated to the dock; and the
 * surface that took over — the docked composer — got no focus, because nothing
 * had ever registered a channel for it.
 *
 * ## Binding
 *
 * The two focus channels are DIFFERENT registries, and a test that only
 * counted "something was focused" would pass on the defect. Every case
 * therefore asserts BOTH directions: the channel that must fire, and the one
 * that must not — the opposite-direction twin.
 *
 * These tests drive the REAL registries rather than mocking them, because the
 * production rule is precisely "a registration is the surface's own statement
 * that it is visible". Mocking that away would test a different function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  forceActivateOutputTab: vi.fn(),
  aiPanelV2: true,
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({ forceActivateOutputTab: mocks.forceActivateOutputTab }),
  },
}))

vi.mock('../../../flags', () => ({
  isAiPanelV2Enabled: () => mocks.aiPanelV2,
}))

import { revealOlumiSurface } from '../revealOlumi'
import { registerFloatingFocus } from '../../hooks/useFloatingFocus'
import { registerDockedOlumiFocus } from '../dockedOlumiFocus'

let floatingFocused = 0
let dockedFocused = 0
const unregister: Array<() => void> = []

/** A floating/hero composer is on screen: it has registered its channel. */
function floatingSurfaceIsVisible(): void {
  unregister.push(registerFloatingFocus(() => { floatingFocused++ }))
}

/** The docked composer is rendering a textarea: it has registered its channel. */
function dockedComposerIsMounted(): void {
  unregister.push(registerDockedOlumiFocus(() => { dockedFocused++ }))
}

beforeEach(() => {
  mocks.forceActivateOutputTab.mockClear()
  mocks.aiPanelV2 = true
  floatingFocused = 0
  dockedFocused = 0
})

afterEach(async () => {
  // Unregister FIRST, then drain a frame. `revealOlumiSurface` schedules a
  // deferred retry on the next animation frame; without this drain a retry
  // armed by one case fires during the NEXT one and lands on that case's
  // freshly-registered channel — cross-test contamination that reads as a
  // real focus call. Draining while nothing is registered makes it a no-op.
  while (unregister.length > 0) unregister.pop()!()
  await new Promise<void>((resolve) => setTimeout(resolve, 32))
})

describe('the user already has a floating or first-use Olumi composer on screen', () => {
  beforeEach(floatingSurfaceIsVisible)

  it('⭐ does NOT claim the dock — claiming it would close the window it is revealing', () => {
    revealOlumiSurface()
    expect(mocks.forceActivateOutputTab).not.toHaveBeenCalled()
  })

  it('focuses the FLOATING composer and not the docked one', () => {
    revealOlumiSurface()
    expect(floatingFocused).toBe(1)
    expect(dockedFocused).toBe(0)
  })

  it('still prefers the floating surface even when a docked composer is also registered', () => {
    // Not reachable on the deployed posture (the two surfaces are mutually
    // exclusive), but it pins the PREFERENCE rather than an accident of which
    // registry happened to be empty — otherwise this suite would pass on a
    // version that simply tried the dock first.
    dockedComposerIsMounted()
    revealOlumiSurface()
    expect(mocks.forceActivateOutputTab).not.toHaveBeenCalled()
    expect(floatingFocused).toBe(1)
    expect(dockedFocused).toBe(0)
  })
})

describe('no floating composer is on screen', () => {
  it('claims the docked Olumi tab', () => {
    dockedComposerIsMounted()
    revealOlumiSurface()
    expect(mocks.forceActivateOutputTab).toHaveBeenCalledWith('olumi')
  })

  it('⭐ focuses the DOCKED composer, not the floating one', () => {
    dockedComposerIsMounted()
    revealOlumiSurface()
    expect(dockedFocused).toBe(1)
    expect(floatingFocused).toBe(0)
  })

  it('claims the dock even when no composer is registered anywhere yet', () => {
    // The dock is always available; force-activating is what makes it appear.
    revealOlumiSurface()
    expect(mocks.forceActivateOutputTab).toHaveBeenCalledWith('olumi')
    expect(floatingFocused).toBe(0)
  })

  it('⭐ never falls back to the floating channel after claiming the dock', async () => {
    // The regression guard for the original defect: a floating panel that is
    // registered when the deferred retry runs (i.e. one that is about to
    // yield) must NOT receive focus. The retry is scheduled on the next
    // animation frame, so the assertion waits for that frame to pass — without
    // the wait this case would assert on a retry that had not run yet, and
    // would pass whatever the retry did (trap 13: a probe that cannot observe
    // the thing it names).
    revealOlumiSurface()
    floatingSurfaceIsVisible()
    dockedComposerIsMounted()
    await new Promise<void>((resolve) => setTimeout(resolve, 32))
    // POSITIVE CONTROL — the deferred retry DID run, and reached the docked
    // channel that registered after the first attempt failed.
    expect(dockedFocused).toBe(1)
    expect(floatingFocused).toBe(0)
  })
})

describe('aiPanelV2 OFF (rollback posture)', () => {
  beforeEach(() => { mocks.aiPanelV2 = false })

  it('never touches the dock — OutputsDock redirects olumi→results when the flag is off', () => {
    floatingSurfaceIsVisible()
    revealOlumiSurface()
    expect(mocks.forceActivateOutputTab).not.toHaveBeenCalled()
    // CONTRAST CONTROL: the legacy best-effort floating focus is preserved, so
    // this case is not passing merely because nothing ran.
    expect(floatingFocused).toBe(1)
  })

  it('does not reach for the docked channel on the rollback path', () => {
    dockedComposerIsMounted()
    revealOlumiSurface()
    expect(dockedFocused).toBe(0)
  })
})

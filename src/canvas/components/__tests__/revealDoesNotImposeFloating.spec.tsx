/**
 * UX GATE 7a — AN AUTOMATIC REVEAL NO LONGER IMPOSES A FLOATING WINDOW.
 *
 * ⚠ WHAT THIS FILE DOES NOT CLAIM (platform trap 3, stated before the
 * assertions). jsdom runs no CSS layout. Nothing here proves that a docked
 * conversation stops covering the graph, or that hidden graph area goes
 * 40% -> 0%. Those are BROWSER claims measured with bounding rects and
 * hit-tests, and they are carried in the PR. What this file proves is the
 * WIRING: which surface an automatic reveal fronts, in every ownership state.
 *
 * THE DEFECT. After the first draft, `FirstUseComposer` minimises the
 * transcript-less hero so the model gets the canvas. `isOpen` stays TRUE while
 * minimised (the panel is kept mounted at `display: none`), so
 * `FloatingOlumiPanel` still registered the module-level focus channel — and
 * its handler called `restore()`. `revealOlumiSurface` reads that registration
 * as "a floating surface is on screen", so from the first draft onward every
 * automatic reveal (and `withOlumiReveal` wraps EVERY guidance-store send, so
 * analysis coaching is one) re-opened a 400x550 window over the model. Measured
 * on the deployed build `4d1e650b` at fit-to-view: 40% / 33% / 28% of the graph
 * hidden at 1280 / 1440 / 1512.
 *
 * ⭐⭐ THE FOUNDER RULING THIS MUST NOT VIOLATE, and the reason half of these
 * tests exist:
 *
 *   > "DO NOT remove floating/concurrent Olumi... FLOATING AND LAYOUT-RESERVING
 *   > ARE DIFFERENT CONCEPTS... FIX THE COMPOSITION, NOT THE CAPABILITY."
 *
 * A suite that only proved "the imposing case now docks" would be a guard
 * watching one door (trap 22b): it would pass just as happily if the change had
 * deleted floating altogether. So EVERY case below has its OPPOSITE-DIRECTION
 * TWIN — for each state that must now dock, a neighbouring state that must
 * still float, differing in exactly one field.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))
// MUTABLE, not a `vi.fn`: this config sets `mockReset: true`, which in vitest 1.x
// resets a spy's implementation to `undefined` — a flag mock built as a spy would
// silently read FALSE in every test after the first. Plain state is immune, and
// `beforeEach` re-pins the default so the flag-OFF twin cannot leak.
const flagState = vi.hoisted(() => ({ aiPanelV2: true }))
vi.mock('../../../flags', async (io) => ({
  ...(await io<Record<string, unknown>>()),
  isAiPanelV2Enabled: () => flagState.aiPanelV2,
}))

const canvasMockState = {
  nodes: [{ id: 'n1' }],
  edges: [] as Array<unknown>,
  results: { status: 'idle' as const },
  _internal: {} as Record<string, unknown>,
  selection: null as null | { id: string; label: string; kind: string },
  ceeAnalysisReady: null as unknown,
  graphHealth: null as unknown,
  runMeta: {} as Record<string, unknown>,
}
vi.mock('../../store', () => {
  const useCanvasStore: any = (selector: (s: any) => any) => selector(canvasMockState)
  useCanvasStore.getState = () => canvasMockState
  useCanvasStore.setState = (patch: any) => Object.assign(canvasMockState, patch)
  useCanvasStore.subscribe = () => () => {}
  return {
    useCanvasStore,
    selectResultsStatus: (s: any) => s.results?.status,
    selectReport: (s: any) => s.results?.report,
    selectError: (s: any) => s.results?.error,
    selectResultsSource: (s: any) => s.results?.source,
  }
})
vi.mock('../../conversation/ConversationPanel', () => ({ ConversationPanel: () => null }))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({ useStageAwarePlaceholder: () => 'Ask' }))
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      return {
        messages: [], isThinking: false, longRunningHint: null, sendMessage,
        sendSystemEvent: vi.fn(), sendChip: vi.fn(), retryLast: vi.fn(),
        patchBlockStates: new Map(), setPatchBlockState: vi.fn(),
        patchRejections: new Map(), setPatchRejection: vi.fn(),
      }
    },
    isNonConversationalContent: () => false,
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FloatingOlumiPanel } from '../FloatingOlumiPanel'
import {
  useFloatingPanelState,
  canAutoDock,
  revealWouldImposeFloating,
  type FloatingPanelSource,
} from '../../hooks/useFloatingPanelState'
import { focusFloating } from '../../hooks/useFloatingFocus'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { useUIStore } from '../../../stores/uiStore'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

/** The state a fresh user is in after their first draft: the system opened the
 *  hero, the user never touched it, and the post-draft transition minimised it. */
const IMPOSING = { source: 'system-first-use' as FloatingPanelSource, userRepositioned: false, isMinimised: true }

/**
 * Mount the panel in a given ownership/visibility state AND PIN THE
 * PRECONDITION IN-TEST (trap 13b).
 *
 * ⚠ EVERY ASSERTION IN THIS FILE IS VACUOUS UNLESS THE PANEL IS ACTUALLY
 * MOUNTED AND NOT YIELDING, and that is not hypothetical — it happened while
 * this file was being written. `FloatingOlumiPanel` also suppresses itself when
 * the dock hosts Olumi (`yieldToDockedOlumi`), and the
 * `revealOlumiSurface()` test above leaves `activeOutputTab === 'olumi'` in the
 * SHARED ui store. Every later test then measured a panel that had yielded, so
 * `focusFloating()` was false for a reason that had nothing to do with the
 * predicate under test — a suite that would have gone green the moment the
 * three twins were deleted. The `beforeEach` reset closes the leak; this
 * assertion is what makes a future leak RED instead of silent.
 */
function mountPanelIn(state: { source: FloatingPanelSource; userRepositioned: boolean; isMinimised: boolean }) {
  useFloatingPanelState.setState({ isOpen: true, ...state })
  const utils = render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
  expect(
    document.querySelector('[data-testid="floating-olumi-panel"]'),
    'PRECONDITION: the panel must be mounted and not yielding, or focusFloating() is answering a different question',
  ).not.toBeNull()
  return utils
}

beforeEach(() => {
  flagState.aiPanelV2 = true
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  useFloatingPanelState.getState().reset()
  // The dock tab is REAL product state and is not reset by vitest's mock
  // hygiene. Leaving it on 'olumi' makes the panel yield — see mountPanelIn.
  useUIStore.setState({ activeOutputTab: 'results' })
  sessionStorage.clear()
})
afterEach(() => {
  useFloatingPanelState.getState().reset()
})

describe('revealWouldImposeFloating — the predicate (UX gate 7a)', () => {
  const SOURCES: FloatingPanelSource[] = ['system-first-use', 'user']
  const BOOLS = [false, true]

  it('is true for EXACTLY ONE of the SIXTEEN ownership/visibility states', () => {
    // Enumerated, not sampled. `FloatingPanelSource` is a closed two-value
    // union, so 2x2x2x2 is the WHOLE space and this cannot be short.
    //
    // ⚠ IT WAS EIGHT STATES UNTIL THE #786 REVIEW, and the missing axis was the
    // defect: `userChoseFloating` did not exist, so the cell "user restored it
    // from the pill, then minimised it again" fell into the imposing bucket and
    // the product moved their conversation to the dock. An enumeration is only
    // exhaustive over the axes it knows about.
    const trueStates: string[] = []
    for (const source of SOURCES) {
      for (const userRepositioned of BOOLS) {
        for (const isMinimised of BOOLS) {
          for (const userChoseFloating of BOOLS) {
            if (revealWouldImposeFloating({ source, userRepositioned, isMinimised, userChoseFloating })) {
              trueStates.push(
                `${source}/${userRepositioned ? 'moved' : 'unmoved'}/${isMinimised ? 'minimised' : 'visible'}/${userChoseFloating ? 'chosen' : 'not-chosen'}`,
              )
            }
          }
        }
      }
    }
    expect(trueStates).toEqual(['system-first-use/unmoved/minimised/not-chosen'])
  })

  it('is a DIFFERENT question from canAutoDock — they disagree on a reachable state', () => {
    // Trap 21: two concepts under similar names is how one fix re-opens
    // another's defect. This pins that they are not interchangeable, so a later
    // tidy-up cannot collapse them without a red.
    const visibleSystemPanel = { source: 'system-first-use' as FloatingPanelSource, userRepositioned: false, isMinimised: false, userChoseFloating: false }
    expect(canAutoDock(visibleSystemPanel)).toBe(true)
    expect(revealWouldImposeFloating(visibleSystemPanel)).toBe(false)
  })

  it('CELL-9: pill-restore ownership is recorded WITHOUT widening canAutoDock', () => {
    // The forbidden fix was to make restore() set source:'user' — which would
    // have flipped canAutoDock too, changing whether the post-draft transition
    // may reposition the panel. A different question, answered by accident.
    // This pins that the two moved independently.
    useFloatingPanelState.getState().open('system-first-use')
    useFloatingPanelState.getState().minimise()
    const before = useFloatingPanelState.getState()
    expect(canAutoDock(before)).toBe(true)
    expect(revealWouldImposeFloating(before)).toBe(true)

    useFloatingPanelState.getState().restoreByUser()
    const after = useFloatingPanelState.getState()
    expect(after.userChoseFloating).toBe(true)
    expect(after.source, 'source must NOT be rewritten').toBe('system-first-use')
    expect(after.userRepositioned, 'userRepositioned must NOT be rewritten').toBe(false)
    expect(canAutoDock(after), 'canAutoDock must be untouched by a pill restore').toBe(true)
  })

  it("CONTROL: the AUTOMATIC restore() still confers no ownership — that is why the field exists", () => {
    // The measured fact the review found: restore() sets only isMinimised.
    // If a later tidy-up merges restoreByUser into restore, this REDs.
    useFloatingPanelState.getState().open('system-first-use')
    useFloatingPanelState.getState().minimise()
    useFloatingPanelState.getState().restore()
    expect(useFloatingPanelState.getState().userChoseFloating).toBe(false)
  })
})

describe('the focus channel stops lying about being on screen (UX gate 7a)', () => {
  it('a minimised, system-opened, never-moved panel does NOT register — so focusFloating() is false', () => {
    mountPanelIn(IMPOSING)
    expect(focusFloating()).toBe(false)
    // ...and nothing restored it. The old handler called restore() here, which
    // is exactly how the window arrived over the model.
    expect(useFloatingPanelState.getState().isMinimised).toBe(true)
  })

  it('and revealOlumiSurface() therefore fronts the DOCK, not a floating window', () => {
    mountPanelIn(IMPOSING)
    const spy = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    expect(revealOlumiSurface()).toBe(true)
    expect(spy).toHaveBeenCalledWith('olumi')
    expect(useFloatingPanelState.getState().isMinimised).toBe(true)
  })

  // ── OPPOSITE-DIRECTION TWINS: floating is not removed ────────────────────
  // Each differs from IMPOSING in exactly ONE field, and each must still float.

  it('TWIN (isMinimised): a VISIBLE system panel still registers and is still fronted', () => {
    mountPanelIn({ ...IMPOSING, isMinimised: false })
    expect(focusFloating()).toBe(true)
    const spy = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    expect(revealOlumiSurface()).toBe(true)
    expect(spy, 'a surface the user is looking at must be fronted, never replaced by the dock').not.toHaveBeenCalled()
  })

  it('TWIN (source): a minimised panel the USER opened still registers and RESTORES to floating', () => {
    mountPanelIn({ ...IMPOSING, source: 'user' })
    expect(focusFloating()).toBe(true)
    expect(useFloatingPanelState.getState().isMinimised, 'the user chose floating — reveal must give it back').toBe(false)
  })

  it('TWIN (userRepositioned): a minimised panel the user MOVED still registers and RESTORES to floating', () => {
    mountPanelIn({ ...IMPOSING, userRepositioned: true })
    expect(focusFloating()).toBe(true)
    expect(useFloatingPanelState.getState().isMinimised).toBe(false)
  })

  it('CELL-9: a user who CHOSE floating from the pill keeps it after minimising again', () => {
    // ⭐ THE CELL THE FIRST VERSION OF THIS CHANGE MISSED, driven through the
    // real control rather than through the store: mount in the imposing state,
    // CLICK THE PILL, minimise again, and the channel must be back.
    const { rerender } = mountPanelIn(IMPOSING)
    expect(focusFloating(), 'precondition: the imposing cell starts dark').toBe(false)

    // The pill is rendered even while the channel is dark — that is what makes
    // this reachable, and it is the user's only in-place route to floating.
    const pill = screen.getByTestId('floating-olumi-panel-pill')
    act(() => { fireEvent.click(pill) })
    expect(useFloatingPanelState.getState().isMinimised).toBe(false)
    expect(useFloatingPanelState.getState().userChoseFloating, 'the click IS the choice').toBe(true)

    act(() => { useFloatingPanelState.getState().minimise() })
    rerender(<FloatingOlumiPanel onDock={() => {}} />)
    expect(
      focusFloating(),
      'a user who chose floating must not be silently relocated to the dock on the next reveal',
    ).toBe(true)
    expect(useFloatingPanelState.getState().isMinimised, 'and the reveal restores it').toBe(false)
  })

  it('the panel re-registers the moment the user drags it — the effect is subscribed, not snapshotted', () => {
    // Bound to the real failure mode: reading userRepositioned via getState()
    // instead of a store subscription leaves the channel deregistered for the
    // rest of the session after the user makes it theirs. That defect is
    // invisible to every test above.
    const { rerender } = mountPanelIn(IMPOSING)
    expect(focusFloating()).toBe(false)
    act(() => {
      useFloatingPanelState.getState().setPosition({ x: 100, y: 100 }) // flips userRepositioned
    })
    rerender(<FloatingOlumiPanel onDock={() => {}} />)
    expect(focusFloating(), 'a dragged panel is a user-owned surface again').toBe(true)
  })

  it('TWIN (flag): with aiPanelV2 OFF the imposing cell STILL registers — the dock cannot host Olumi', () => {
    // ⭐ THE OPPOSITE-DIRECTION TWIN FOR THE *FLAG* AXIS. Every case above runs
    // with the flag ON, where the dock genuinely hosts Olumi and routing the
    // imposing cell there is honest. `VITE_FEATURE_AI_PANEL_V2` is set only
    // under `[context.staging.environment]` (netlify.toml), so OFF is
    // production and every rollback posture — and there `OutputsDock`
    // redirects tab 'olumi' -> 'results'. An UNGATED guard would therefore
    // deregister this channel while nothing else can take it:
    // `revealOlumiSurface()` returns `focusFloating()` on that branch, so an
    // automatic reveal would return false HAVING FRONTED NOTHING AT ALL.
    //
    // Without this case the guard's flag-dependence is unpinned: a tidy-up
    // that drops the `isAiPanelV2Enabled()` conjunct at
    // `FloatingOlumiPanel.tsx` goes fully green. Revert that conjunct and this
    // test — and only this test — REDs.
    flagState.aiPanelV2 = false
    mountPanelIn(IMPOSING)
    expect(
      focusFloating(),
      'flag OFF: the dock cannot host Olumi, so the floating channel must stay registered',
    ).toBe(true)
    // ...and the reveal primitive therefore fronts something rather than nothing.
    expect(
      revealOlumiSurface(),
      'flag OFF: reveal must front the floating surface, not return false having fronted nothing',
    ).toBe(true)
  })
})

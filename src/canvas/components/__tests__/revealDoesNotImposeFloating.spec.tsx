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
import { act, render } from '@testing-library/react'
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
vi.mock('../../../flags', async (io) => ({
  ...(await io<Record<string, unknown>>()),
  isAiPanelV2Enabled: () => true,
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

function mountPanelIn(state: { source: FloatingPanelSource; userRepositioned: boolean; isMinimised: boolean }) {
  useFloatingPanelState.setState({ isOpen: true, ...state })
  return render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  useFloatingPanelState.getState().reset()
})
afterEach(() => {
  useFloatingPanelState.getState().reset()
})

describe('revealWouldImposeFloating — the predicate (UX gate 7a)', () => {
  const SOURCES: FloatingPanelSource[] = ['system-first-use', 'user']
  const BOOLS = [false, true]

  it('is true for EXACTLY ONE of the eight ownership/visibility states', () => {
    // Enumerated, not sampled: the whole state space, with the true-set pinned
    // by identity. A widening of the predicate REDs here rather than silently
    // taking floating away from a user who chose it.
    const trueStates: string[] = []
    for (const source of SOURCES) {
      for (const userRepositioned of BOOLS) {
        for (const isMinimised of BOOLS) {
          if (revealWouldImposeFloating({ source, userRepositioned, isMinimised })) {
            trueStates.push(`${source}/${userRepositioned ? 'moved' : 'unmoved'}/${isMinimised ? 'minimised' : 'visible'}`)
          }
        }
      }
    }
    expect(trueStates).toEqual(['system-first-use/unmoved/minimised'])
  })

  it('is a DIFFERENT question from canAutoDock — they disagree on a reachable state', () => {
    // Trap 21: two concepts under similar names is how one fix re-opens
    // another's defect. This pins that they are not interchangeable, so a later
    // tidy-up cannot collapse them without a red.
    const visibleSystemPanel = { source: 'system-first-use' as FloatingPanelSource, userRepositioned: false, isMinimised: false }
    expect(canAutoDock(visibleSystemPanel)).toBe(true)
    expect(revealWouldImposeFloating(visibleSystemPanel)).toBe(false)
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
    rerender(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />)
    expect(focusFloating(), 'a dragged panel is a user-owned surface again').toBe(true)
  })
})

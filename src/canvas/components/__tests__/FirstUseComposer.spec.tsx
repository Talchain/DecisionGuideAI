/**
 * FirstUseComposer — auto-reposition receipt + reduced-motion verification.
 *
 * Round-3 UX correction: the post-graph behaviour is now REPOSITION (not
 * close). The floating panel stays open, slides to a bottom-right anchor
 * near the Analysis dock, and the Analysis tab activates so the user can
 * see AI and analysis side by side.
 *
 *   1. The auto-reposition effect MUST trigger the "Model drafted. Review
 *      readiness." receipt via useTransitionReceipt.show.
 *
 *   3. When prefers-reduced-motion is set, auto-reposition fires
 *      synchronously (no 300 ms setTimeout). This test asserts the
 *      receipt + reposition both happen WITHIN the same render tick,
 *      without advancing fake timers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

// Stub the heavy supabase / threadService import chain that
// ConversationContext → useConversation pulls in. Same pattern as the
// parity spec.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))

// Mutable mocks the tests reconfigure between cases.
const canvasMockState: {
  nodes: Array<{ id: string }>
  edges: Array<unknown>
  results: { status: string; hash?: string; graphHash?: string }
  _internal: { graphHash?: string }
  selection: null
} = { nodes: [], edges: [], results: { status: 'idle' }, _internal: {}, selection: null }
vi.mock('../../store', () => {
  // The mock acts both as a selector hook AND exposes getState() so the
  // FirstUseComposer's reset-debounce effect (which reads live state via
  // useCanvasStore.getState()) can observe the current node count.
  const useCanvasStore: any = (selector: (s: any) => any) => selector(canvasMockState)
  useCanvasStore.getState = () => canvasMockState
  return {
    useCanvasStore,
    selectResultsStatus: (s: any) => s.results?.status,
    selectReport: (s: any) => s.results?.report,
    selectError: (s: any) => s.results?.error,
    selectResultsSource: (s: any) => s.results?.source,
  }
})
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))
vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => null,
}))

// Mutable mocked messages — tests reconfigure to simulate the user-sent
// signal that distinguishes a first-use submission from a hydration/import
// 0→N node bump.
const messagesMockState: { messages: Array<{ id: string; role: string; synthetic?: boolean }> } = {
  messages: [],
}
// Pin sendMessage etc. with stable identities — same pattern as the
// interactions spec's vi.mock of useConversation.
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages: messagesMockState.messages,
        isThinking: false,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage,
        sendSystemEvent,
        sendChip,
        retryLast,
        patchBlockStates: new Map(),
        setPatchBlockState,
        patchRejections: new Map(),
        setPatchRejection,
      }
    },
  }
})

// Reduced-motion flag the tests toggle.
const reducedMotionState: { value: boolean } = { value: false }
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}))

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FirstUseComposer } from '../FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useUIStore } from '../../../stores/uiStore'
import { useTransitionReceipt } from '../../hooks/useTransitionReceipt'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useTransitionReceipt.getState().clear()
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  canvasMockState.nodes = []
  messagesMockState.messages = []
  reducedMotionState.value = false
  vi.useRealTimers()
})

/**
 * Helper: drive the realistic first-use submission flow.
 *   1. Initial render with empty canvas → auto-open fires (source =
 *      system-first-use).
 *   2. Type a brief in the first-use textarea and press Enter — AIInputBar's
 *      handleSend dispatches sendMessage (mocked) then invokes onAfterSend,
 *      which flips FirstUseComposer's userSentFromFirstUseRef.
 *
 * This exercises the same explicit signal pathway used in the real app —
 * NOT a mocked message-array mutation. The signal cannot be faked by
 * hydration / import / session resume, which is the regression guard we
 * care about.
 *
 * Returns the test-library `rerender` for the caller to drive the
 * subsequent 0→N+ node transition.
 */
function driveUserSubmittedViaFirstUse(): { rerender: (ui: React.ReactElement) => void } {
  const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
  expect(useFloatingPanelState.getState().isOpen).toBe(true)
  expect(useFloatingPanelState.getState().source).toBe('system-first-use')
  const textarea = screen.getByTestId('first-use-input-bar-textarea') as HTMLTextAreaElement
  act(() => {
    fireEvent.change(textarea, { target: { value: 'help me decide which option' } })
  })
  act(() => {
    fireEvent.keyDown(textarea, { key: 'Enter' })
  })
  return { rerender }
}

describe('FirstUseComposer — auto-reposition fires the transition receipt (gap #1)', () => {
  it('shows the receipt after the 300 ms slide delay when reduced motion is off', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()

    // 0 → 2 nodes: triggers the auto-reposition effect.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)

    // Receipt is not yet shown — the 300 ms setTimeout has not fired.
    expect(useTransitionReceipt.getState().receipt).toBeNull()
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)
    // Position not yet repositioned either.
    expect(useFloatingPanelState.getState().position).toBeNull()

    // Advance past the slide delay (300ms for performReposition to run) +
    // rAF deferral (jsdom's rAF is implemented as a ~16ms timer) so the
    // position write committed inside requestAnimationFrame is observable.
    act(() => {
      vi.advanceTimersByTime(300)
    })
    // performReposition has run: receipt is committed, isAutoRepositioning
    // is true, but position is still pending the rAF.
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isAutoRepositioning).toBe(true)
    // Flush the rAF + the 450ms clear timeout that owner-clears the flag.
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // All four side effects now committed:
    //   - receipt fired
    //   - Analysis tab activated (forceActivateOutputTab → version++)
    //   - floating panel stays OPEN, position set to a bottom-right anchor
    //   - isAutoRepositioning has been owner-cleared after the slide window
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
    expect(useFloatingPanelState.getState().isAutoRepositioning).toBe(false)
    // Position is now set (was null before) and exactly equals the
    // dock-aware bottom-right anchor. This proves the rAF-deferred write
    // inside performAutoReposition actually ran — not just that some
    // value landed.
    // jsdom default viewport: 1024×768. Default panel size: 400×550.
    // dockInset = 0 (no aria-label="Outputs dock" in this test render).
    //   anchorRaw.x = 1024 - 0 - 400 - 16 = 608
    //   anchorRaw.y = 768 - 550 - 16 = 202
    // clampPositionToViewport leaves both unchanged (both within margins).
    const pos = useFloatingPanelState.getState().position
    expect(pos).toEqual({ x: 608, y: 202 })
    // userRepositioned must NOT flip — automatic reposition uses direct
    // setState, not the setPosition setter, so canAutoDock on subsequent
    // transitions still respects the system-vs-user origin.
    expect(useFloatingPanelState.getState().userRepositioned).toBe(false)
  })

  it('does NOT trigger the receipt when userRepositioned blocks auto-reposition', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()

    // Simulate a user drag AFTER they sent — should disqualify auto-dock.
    act(() => {
      useFloatingPanelState.getState().setPosition({ x: 100, y: 100 })
    })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)

    // 0 → 2 nodes: the auto-dock effect runs but the canAutoDock guard
    // returns false, so performDock never executes.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(useTransitionReceipt.getState().receipt).toBeNull()
    // Floating still open; nothing was committed.
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)
  })
})

describe('FirstUseComposer — reduced motion (gap #3)', () => {
  it('auto-repositions synchronously without the 300 ms slide delay when prefers-reduced-motion is set', () => {
    reducedMotionState.value = true
    // Critical: use REAL timers. The reduced-motion branch should not call
    // setTimeout at all — if it does, the test would still pass under fake
    // timers (vi.advanceTimersByTime would flush them) but fail to prove the
    // sync path. Asserting under real timers proves the receipt commits in
    // the same microtask as the node-count transition.
    vi.useRealTimers()

    const { rerender } = driveUserSubmittedViaFirstUse()

    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)

    // No setTimeout means all side effects commit synchronously: receipt
    // shows, Analysis tab activated, floating panel stays open and is
    // repositioned to bottom-right.
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
    expect(useFloatingPanelState.getState().position).not.toBeNull()
  })
})

describe('FirstUseComposer — responsive width (P1.2)', () => {
  it('uses a CSS clamp so the composer never overflows narrow viewports', () => {
    // Render and inspect the inline style. We assert the responsive shape
    // (min(...) for width, max(...) for left/top) rather than computed
    // pixels because jsdom does not evaluate CSS clamp() at runtime.
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const dialog = screen.getByTestId('first-use-composer') as HTMLElement
    const style = dialog.getAttribute('style') ?? ''
    expect(style).toMatch(/width:\s*min\(/i)
    expect(style).toMatch(/calc\(100vw\s*-\s*32px\)/i)
    expect(style).toMatch(/left:\s*max\(/i)
    expect(style).toMatch(/top:\s*max\(/i)
    // Defensive: no raw px-only width that would have overflowed.
    expect(style).not.toMatch(/width:\s*480px/i)
  })
})

describe('FirstUseComposer — welcome hero (round-3 UX correction)', () => {
  it('uses the concise guidance copy and hero min-height', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const dialog = screen.getByTestId('first-use-composer') as HTMLElement

    // Concise copy — reviewer-approved string verbatim.
    expect(
      screen.getByText(/Describe the decision, options, goal and constraints\./i),
    ).toBeInTheDocument()
    // Previous verbose copy must NOT leak through.
    expect(
      screen.queryByText(/Describe your decision, the options you're weighing/i),
    ).toBeNull()

    // Hero min-height: 460px floor so the welcome surface reads as a
    // prominent invitation rather than a small utility panel. The cap is
    // 70vh (max-height) so it never dominates tall screens.
    const style = dialog.getAttribute('style') ?? ''
    expect(style).toMatch(/min-height:\s*460px/i)
    expect(style).toMatch(/max-height:\s*70vh/i)
    expect(style).not.toMatch(/(^|[^-])height:\s*\d+px/i)
  })

  it('renders the welcome heading "What are you deciding?"', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const heading = screen.getByTestId('first-use-heading')
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toBe('What are you deciding?')
    expect(heading.tagName).toBe('H2')
  })

  it('renders the six ambient drift shapes behind the hero content', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const shapeContainer = screen.getByTestId('first-use-ambient-shapes')
    expect(shapeContainer).toBeInTheDocument()
    expect(shapeContainer.getAttribute('aria-hidden')).toBe('true')
    // Six shapes — goal, decision, option, factor, risk, outcome.
    const kinds = Array.from(shapeContainer.querySelectorAll('[data-shape]'))
      .map((el) => el.getAttribute('data-shape'))
    expect(kinds.sort()).toEqual(
      ['decision', 'factor', 'goal', 'option', 'outcome', 'risk'],
    )
  })

  it('renders the Olumi logo as decorative imagery above the heading', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const dialog = screen.getByTestId('first-use-composer')
    const img = dialog.querySelector('img[src*="olumi-logo"]') as HTMLImageElement | null
    expect(img).not.toBeNull()
    // Logo is decorative — heading carries the semantic label.
    expect(img?.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses the welcome variant of AIInputBar (three visible lines at rest)', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const textarea = screen.getByTestId('first-use-input-bar-textarea') as HTMLTextAreaElement
    // Welcome variant sets minHeight: 18 * 3 + 16 = 70px.
    expect(textarea.style.minHeight).toBe('70px')
  })

  it('does NOT render prompt-suggestion chips (explicitly excluded)', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(screen.queryByTestId('suggested-chips')).toBeNull()
    // Defensive: no buttons claiming to seed a prompt suggestion. The hero
    // has only the AIInputBar's cog + send buttons.
    const dialog = screen.getByTestId('first-use-composer')
    const buttons = dialog.querySelectorAll('button')
    const labels = Array.from(buttons).map((b) => b.getAttribute('aria-label') ?? '')
    expect(labels.every((l) => /^(Settings|Send)$/.test(l))).toBe(true)
  })

  it('keeps the cog button inside the input field (welcome-cog invariant)', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(screen.getByTestId('first-use-input-bar-cog')).toBeInTheDocument()
  })
})

describe('FirstUseComposer — auto-dock does NOT misfire on hydration/import (review #2)', () => {
  // The reviewer flagged: auto-dock should only fire for a graph produced by
  // the user submitting via the first-use composer — NOT for any 0→N+ node
  // transition. These tests cover the misfire surfaces: scenario hydration,
  // session resume (synthetic-only messages), graph import, async backend
  // restore.

  it('does NOT auto-dock when nodes appear without a prior user message (hydration/import)', () => {
    vi.useFakeTimers()
    // Render with empty canvas + empty messages. Auto-open fires →
    // source=system-first-use, isOpen=true. This is the same state a user
    // would land in on first navigation; whether the next event is "user
    // sends a brief" or "scenario hydration completes" is what we want to
    // distinguish.
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useFloatingPanelState.getState().source).toBe('system-first-use')

    // Hydration / import path: nodes appear WITHOUT any prior user message.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // No receipt, no dock-close, no version bump. Floating stays open so
    // the user can still interact (a separate auto-close-on-non-empty-canvas
    // policy could decide that later; for now we just confirm we did NOT
    // commit the auto-dock side effects).
    expect(useTransitionReceipt.getState().receipt).toBeNull()
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTab).toBe('results') // unchanged
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0) // unchanged
  })

  it('does NOT auto-dock when only a synthetic boundary message exists (session resume)', () => {
    vi.useFakeTimers()
    // Pre-seed a synthetic session-boundary message — useConversation injects
    // this on scenario resume. The shouldRender check in FirstUseComposer
    // filters synthetic messages out via realMessageCount.
    messagesMockState.messages = [{ id: 'boundary-0', role: 'assistant', synthetic: true }]
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    // Auto-open still fires because realMessageCount === 0 (synthetic filtered).
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useFloatingPanelState.getState().source).toBe('system-first-use')

    // Now scenario hydration completes — nodes appear without the user ever
    // typing in the first-use textarea (no onAfterSend fired).
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(useTransitionReceipt.getState().receipt).toBeNull()
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)
  })

  it('does NOT auto-dock when real historical messages restore before nodes (thread hydration edge)', () => {
    // Reviewer-flagged edge: if persisted thread hydration restores REAL
    // (non-synthetic) messages BEFORE graph nodes hydrate, the previous
    // realMessageCount-based inference would have mis-flipped the guard.
    // The explicit onAfterSend signal makes that impossible — the callback
    // only fires from AIInputBar.handleSend in this composer instance,
    // never from message-array mutation.
    vi.useFakeTimers()
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isOpen).toBe(true)

    // Step 1: thread hydration completes first — historical user + assistant
    // turns appear (not synthetic). The composer is still rendered (canvas
    // is empty) but the user has NOT typed anything in this composer.
    act(() => {
      messagesMockState.messages = [
        { id: 'hist-0', role: 'user' },
        { id: 'hist-1', role: 'assistant' },
      ]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)

    // Step 2: graph hydration completes — nodes appear. This is the 0→N+
    // transition that the auto-dock effect watches.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // No auto-dock — the explicit onAfterSend signal was never invoked.
    expect(useTransitionReceipt.getState().receipt).toBeNull()
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)
  })

  it('AUTO-REPOSITIONS when the user submits BEFORE nodes appear (the legitimate first-use path)', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()
    // onAfterSend has flipped userSentFromFirstUseRef. Now graph builds.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    // 300ms slide trigger + 16ms rAF + 450ms owner-clear → 800ms total to
    // observe the full reposition completion.
    act(() => {
      vi.advanceTimersByTime(800)
    })

    // Auto-reposition fires — proves the explicit-signal guard does not
    // break the legitimate first-use path. Floating stays OPEN (round-3
    // change from auto-close to auto-reposition).
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useFloatingPanelState.getState().position).not.toBeNull()
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
  })
})

describe('FirstUseComposer — canvas reset debounce (round-3 robustness)', () => {
  // Round-3 raised concern: the reset effect was firing on any N→0
  // transition, including transient hydration/import clears where the
  // canvas store briefly reports zero nodes before the new graph
  // populates. The debounce waits 500ms and re-reads live state — if a
  // new graph has already loaded, the reset is treated as transient and
  // skipped.
  //
  // Tests start with a NON-empty canvas so the one-shot initial auto-open
  // guard (`hasAutoOpenedRef`) doesn't fire on mount and conflate the
  // reset re-engage with the initial open. The floating panel's source is
  // pre-flipped to 'user' so we can observe whether the reset effect
  // flips it back to 'system-first-use'.

  it('does NOT re-engage the hero when nodes re-populate within the debounce window (transient hydration)', () => {
    vi.useFakeTimers()
    // Initial state: canvas has nodes (skips initial auto-open). Floating
    // panel was previously opened by the user (so source='user').
    canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    useFloatingPanelState.getState().open('user')
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().source).toBe('user')

    // Transient: nodes briefly clear (scenario switch / import).
    act(() => {
      canvasMockState.nodes = []
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    // ...then repopulate before the 500ms debounce expires.
    act(() => {
      vi.advanceTimersByTime(200)
      canvasMockState.nodes = [{ id: 'n3' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // The debounce checks live state — nodeCount === 1 so re-engage is
    // skipped. Source stays 'user' (not flipped back to 'system-first-use'
    // by the reset effect).
    expect(useFloatingPanelState.getState().source).toBe('user')
  })

  it('DOES re-engage the hero when nodes stay at 0 past the debounce window (intentional reset)', () => {
    vi.useFakeTimers()
    // Initial state: canvas has nodes, floating was opened by user.
    canvasMockState.nodes = [{ id: 'n1' }]
    useFloatingPanelState.getState().open('user')
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().source).toBe('user')

    // Intentional canvas reset: nodes clear and stay cleared.
    act(() => {
      canvasMockState.nodes = []
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    // Past the debounce window with zero nodes still live.
    act(() => {
      vi.advanceTimersByTime(600)
    })

    // The debounce confirmed empty state — re-engage fired and flipped
    // source back to 'system-first-use' so the hero re-appears.
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useFloatingPanelState.getState().source).toBe('system-first-use')
  })
})

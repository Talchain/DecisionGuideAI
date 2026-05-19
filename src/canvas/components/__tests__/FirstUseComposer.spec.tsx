/**
 * FirstUseComposer — auto-dock receipt + reduced-motion verification.
 *
 * Closes verification gaps #1 and #3 from the integration sign-off:
 *
 *   1. The auto-dock effect itself MUST trigger the "Model drafted. Review
 *      readiness." receipt via useTransitionReceipt.show. The browser
 *      walkthrough re-triggered the receipt manually after expiry — this
 *      test proves the actual auto-dock transition fires it.
 *
 *   3. When prefers-reduced-motion is set, auto-dock fires synchronously
 *      (no 300 ms setTimeout). This test asserts the receipt + dock-close
 *      both happen WITHIN the same render tick, without advancing fake
 *      timers.
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
vi.mock('../../store', () => ({
  useCanvasStore: (selector: (s: any) => any) => selector(canvasMockState),
  selectResultsStatus: (s: any) => s.results?.status,
  selectReport: (s: any) => s.results?.report,
  selectError: (s: any) => s.results?.error,
  selectResultsSource: (s: any) => s.results?.source,
}))
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

describe('FirstUseComposer — auto-dock fires the transition receipt (gap #1)', () => {
  it('shows the receipt after the 300 ms slide delay when reduced motion is off', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()

    // 0 → 2 nodes: triggers the auto-dock effect.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)

    // Receipt is not yet shown — the 300 ms setTimeout has not fired.
    expect(useTransitionReceipt.getState().receipt).toBeNull()
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)

    // Advance past the slide delay.
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // performDock has now committed all three side effects together:
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
  })

  it('does NOT trigger the receipt when userRepositioned blocks auto-dock', () => {
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
  it('auto-docks synchronously without the 300 ms slide delay when prefers-reduced-motion is set', () => {
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

    // No setTimeout means all three side effects commit synchronously.
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
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

  it('AUTO-DOCKS when the user submits BEFORE nodes appear (the legitimate first-use path)', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()
    // onAfterSend has flipped userSentFromFirstUseRef. Now graph builds.
    act(() => {
      canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    })
    rerender(<FirstUseComposer onCogClick={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Auto-dock fires — proves the explicit-signal guard does not break the
    // legitimate first-use path.
    expect(useTransitionReceipt.getState().receipt).toBe('model-drafted')
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
  })
})

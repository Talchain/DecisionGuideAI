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
import { act, render } from '@testing-library/react'
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

// Pin sendMessage etc. with stable identities — same pattern as the
// interactions spec's vi.mock of useConversation.
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [messages] = useState<any[]>([])
      const [sendMessage] = useState(() => vi.fn())
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages,
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
  reducedMotionState.value = false
  vi.useRealTimers()
})

describe('FirstUseComposer — auto-dock fires the transition receipt (gap #1)', () => {
  it('shows the receipt after the 300 ms slide delay when reduced motion is off', () => {
    vi.useFakeTimers()
    // First render: empty canvas. The auto-open effect runs synchronously
    // inside React's commit phase, so the panel becomes open before we add
    // nodes in the next render.
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useFloatingPanelState.getState().source).toBe('system-first-use')

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
    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().source).toBe('system-first-use')

    // Simulate a user drag — should disqualify auto-dock.
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

    const { rerender } = render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useFloatingPanelState.getState().source).toBe('system-first-use')

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

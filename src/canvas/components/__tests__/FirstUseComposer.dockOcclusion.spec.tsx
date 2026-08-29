/**
 * FirstUseComposer — the composer must not be centred UNDER the outputs dock.
 *
 * MEASURED DEFECT (deployed a9fc1564, driven in a controlled-state profile,
 * 28 Aug 2026). The first-use composer positions itself with
 *   width: min(960px, calc(100vw - 32px))
 *   left:  max(16px, calc(50% - 480px))
 * i.e. centred on the FULL viewport, at zIndex 300 — while the outputs dock
 * is `position: fixed` at zIndex 900 over the same area. With the dock open
 * the composer's right-hand end, INCLUDING ITS SEND BUTTON, sits underneath
 * it and stops receiving pointer events:
 *
 *   1440x900, dock 416px at left=1012 → Send spans x 1007-1039,
 *             11% of its pixels hit-testable, centre returns the dock body
 *   1280x800, dock 416px at left=852  → Send spans x 927-959,
 *             *** 0% hit-testable — entirely behind the dock ***
 *
 * A first-time user with the dock open cannot submit their brief. 1280 is the
 * DS v5 desktop minimum, and the dock's own empty state invites the user to
 * "Describe your decision to Olumi" — pointing at the composer it is covering.
 *
 * THE FIX BINDS TO `measureDockInset()` — the estate's single existing
 * authority for how much room the dock occupies (12 call sites in
 * FloatingOlumiPanel, which solves this identical problem for the floating
 * surface, and already imported by FirstUseComposer). These tests assert the
 * composer's geometry is DERIVED FROM THAT INSET, not that it equals some
 * hand-copied number — so they still bite if the dock's width changes.
 *
 * ⚠ THE LIMIT OF THIS SPEC, STATED SO NOBODY OVER-TRUSTS IT. These tests pin
 * the inset the composer reads AT MOUNT. They do NOT exercise the component
 * re-reading it when the dock later collapses, expands or is dragged — jsdom
 * fires neither ResizeObserver nor a real style mutation here.
 *
 * That gap is not hypothetical: the first cut of this fix used a
 * ResizeObserver alone, PASSED ALL FOUR OF THESE TESTS, and was still broken
 * on a real build — the observer attached to a dock that had not mounted yet,
 * so the inset stayed pinned at the collapsed 52px while the dock sat expanded
 * at 428 and the Send button remained 0% hit-testable. It was caught by
 * driving the product in a browser, not by this file. Anything that changes
 * HOW the inset is kept current must be re-verified the same way.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))

const canvasMockState: {
  nodes: Array<{ id: string }>
  edges: Array<unknown>
  results: { status: string }
  _internal: Record<string, unknown>
  selection: null
} = { nodes: [], edges: [], results: { status: 'idle' }, _internal: {}, selection: null }
vi.mock('../../store', () => {
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
vi.mock('../../hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }))
vi.mock('../../../adapters/plot', () => ({
  plot: { templates: () => new Promise(() => {}) },
}))

// The dock inset the component must respect. importOriginal-spread so the
// module's other exports stay real (CLAUDE.md trap 12: a bare factory REPLACES
// the module and silently drops everything it does not list).
const dockInsetMock = { value: 0 }
vi.mock('../FloatingOlumiPanel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../FloatingOlumiPanel')>()
  return { ...actual, measureDockInset: () => dockInsetMock.value }
})

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
        messages: [], isThinking: false, longRunningHint: null, lastSendFailure: null,
        sendMessage, sendSystemEvent, sendChip, retryLast,
        patchBlockStates: new Map(), setPatchBlockState,
        patchRejections: new Map(), setPatchRejection,
      }
    },
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FirstUseComposer } from '../FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

function renderComposer() {
  render(<FirstUseComposer />, { wrapper: Wrapper })
  return screen.getByTestId('first-use-composer')
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useFloatingPanelState.getState().open('system-first-use')
  canvasMockState.nodes = []
  dockInsetMock.value = 0
})

describe('FirstUseComposer — must not be centred under the outputs dock', () => {
  // PRECONDITION. Without this a renamed testid makes every assertion below
  // pass vacuously (CLAUDE.md trap 13).
  it('PRECONDITION: the composer renders and carries positioning styles', () => {
    const el = renderComposer()
    expect(el).toBeTruthy()
    expect(el.style.width).not.toBe('')
    expect(el.style.left).not.toBe('')
  })

  it('reserves the dock inset in BOTH width and left when the dock is open', () => {
    dockInsetMock.value = 428 // 416px dock + 12px right gap, as measured live

    const el = renderComposer()

    // width folds the inset into one subtraction: 428 + 2*16 margin = 460.
    expect(el.style.width).toContain('460')
    // left centres within the dock-free area, so it carries the raw inset.
    expect(el.style.left).toContain('428')
  })

  it('DERIVES the geometry from the inset — a different inset moves it', () => {
    dockInsetMock.value = 292 // a 280px dock + 12px gap
    const el = renderComposer()

    // Binds to the inset itself, not to a hand-copied constant that would
    // survive the dock changing width underneath it.
    expect(el.style.width).toContain('324') // 292 + 32
    expect(el.style.left).toContain('292')
    expect(el.style.width).not.toContain('460')
  })

  it('CONTRAST CONTROL: with no dock the composer is centred on the full viewport', () => {
    dockInsetMock.value = 0
    const el = renderComposer()

    // Proves the assertions above are observing the inset and not merely
    // matching any string the component happens to emit.
    expect(el.style.width).not.toContain('460')
    expect(el.style.width).not.toContain('324')
    // And pins the no-dock case as BYTE-IDENTICAL to what this surface has
    // always emitted, which is what lets FirstUseComposer.spec.tsx's
    // responsive-width contract keep passing unchanged.
    expect(el.style.width).toMatch(/calc\(100vw\s*-\s*32px\)/i)
  })
})

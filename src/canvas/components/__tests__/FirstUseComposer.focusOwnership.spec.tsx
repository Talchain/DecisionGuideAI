/**
 * FirstUseComposer — THE INVITATION MUST BE THE FIELD THAT RECEIVES THE TYPING.
 *
 * ── THE DEFECT, MEASURED ON THE DEPLOYED BUILD ────────────────────────────
 * Driven in a real browser against staging `b5f9bdbb` (2026-09-01), guest,
 * "Continue without an account":
 *
 *   t = 207 ms after a genuine document load
 *     · `first-use-input-bar-textarea` is mounted, ENABLED, 654x75 px
 *     · `document.activeElement` is **BODY**
 *     · 64 characters typed at that instant appear NOWHERE in the DOM —
 *       not in this textarea, not in any other, not in `draft`
 *
 * The user's first keystrokes are silently discarded. Two independent lanes
 * misread this as "the composer is prefilled with an example brief" and
 * "my text went into a hidden textarea"; there is no hidden textarea — the
 * keystrokes went to `document.body` and were dropped on the floor.
 *
 * ── WHY NO EXISTING TEST SEES IT ──────────────────────────────────────────
 * Every jsdom spec for this surface drives the textarea DIRECTLY
 * (`fireEvent.change(input, …)`), so they all assert what happens to text
 * that has ALREADY reached the field. The question they cannot ask is the
 * one before it: does a keystroke reach the field at all? These tests bind
 * to `document.activeElement`, which is the only thing that decides.
 *
 * ── THE SECOND HALF: THE RESTORE SWAP ─────────────────────────────────────
 * A returning guest holds a 36-byte scenario pointer in localStorage;
 * `useServerGraphHydration` reads the model back from CEE and
 * `mergeServerGraph.ts:235` hydrates an EMPTY canvas in full. nodeCount goes
 * 0 → N about 1-2 s after boot and this portal is torn out from under
 * whoever is typing. The TEXT survives (`draft` lives in
 * ConversationContext, which outlives the portal, and the floating composer
 * binds the same buffer) — the CARET does not. Hence a handoff.
 *
 * ⚠ OPPOSITE-DIRECTION TWIN, deliberately paired with every claim: focus is
 * only ever CLAIMED when it is going nowhere, and only ever HANDED ON when
 * the user has text at risk in a swap they did not cause.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))

// A REAL zustand store, not a static object: these tests must drive the
// 0 → N node transition and observe what the component does about it, which
// a non-subscribing mock cannot express.
vi.mock('../../store', async () => {
  const { create } = await import('zustand')
  const useCanvasStore = create(() => ({
    nodes: [] as Array<{ id: string }>,
    edges: [] as unknown[],
    results: { status: 'idle' },
    _internal: {},
    selection: null,
  }))
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
vi.mock('../../../adapters/plot', () => ({ plot: { templates: () => new Promise(() => {}) } }))

const thinkingMockState: { isThinking: boolean } = { isThinking: false }

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
        messages: [],
        isThinking: thinkingMockState.isThinking,
        longRunningHint: null,
        lastSendFailure: null,
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

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FirstUseComposer } from '../FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { registerFloatingFocus } from '../../hooks/useFloatingFocus'
import { useCanvasStore } from '../../store'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

const HERO_TEXTAREA = 'first-use-input-bar-textarea'

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useFloatingPanelState.getState().open('system-first-use')
  ;(useCanvasStore as any).setState({ nodes: [], edges: [] })
  thinkingMockState.isThinking = false
})

afterEach(() => {
  document.body.innerHTML === '' // no-op guard; RTL cleans up
})

describe('FirstUseComposer — focus ownership at the first paintable moment', () => {
  it('claims focus when it is the way in, so the first keystroke lands in the composer', async () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })

    const input = screen.getByTestId(HERO_TEXTAREA) as HTMLTextAreaElement

    // THE assertion. Bound by IDENTITY to this exact textarea, never to
    // "some focused element" — another field satisfying a predicate is
    // precisely the failure mode this is written against.
    await waitFor(() => expect(document.activeElement).toBe(input))

    // And it must genuinely receive typing, not merely hold the caret.
    fireEvent.change(input, { target: { value: 'should we rebuild billing in-house' } })
    expect(input.value).toBe('should we rebuild billing in-house')
  })

  it('OPPOSITE TWIN: never steals focus from a field the user already chose', async () => {
    const other = document.createElement('input')
    other.setAttribute('data-testid', 'someone-elses-field')
    document.body.appendChild(other)
    other.focus()
    expect(document.activeElement).toBe(other)

    render(<FirstUseComposer />, { wrapper: Wrapper })

    const input = screen.getByTestId(HERO_TEXTAREA)
    // Give the focus effect every chance to misbehave before asserting.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(document.activeElement).toBe(other)
    expect(document.activeElement).not.toBe(input)

    other.remove()
  })

  it('does not claim focus while the draft is generating (the textarea is disabled in that window)', async () => {
    thinkingMockState.isThinking = true

    render(<FirstUseComposer />, { wrapper: Wrapper })

    const input = screen.getByTestId(HERO_TEXTAREA) as HTMLTextAreaElement
    expect(input.disabled).toBe(true)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(document.activeElement).not.toBe(input)
  })

  it('re-arms after a canvas reset: focus is claimed again when the hero returns', async () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    const first = screen.getByTestId(HERO_TEXTAREA)
    await waitFor(() => expect(document.activeElement).toBe(first))

    // A graph arrives — hero unmounts, focus goes elsewhere.
    act(() => {
      ;(useCanvasStore as any).setState({ nodes: [{ id: 'n1' }] })
    })
    expect(screen.queryByTestId(HERO_TEXTAREA)).toBeNull()
    ;(document.activeElement as HTMLElement | null)?.blur?.()

    // Canvas reset back to empty — the hero is the way in again.
    act(() => {
      ;(useCanvasStore as any).setState({ nodes: [] })
    })
    const again = screen.getByTestId(HERO_TEXTAREA)
    await waitFor(() => expect(document.activeElement).toBe(again))
  })
})

describe('FirstUseComposer — focus continuity across the restore swap', () => {
  it('hands focus to the floating composer when a restore takes the surface mid-typing', async () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })

    const input = screen.getByTestId(HERO_TEXTAREA) as HTMLTextAreaElement
    await waitFor(() => expect(document.activeElement).toBe(input))
    fireEvent.change(input, { target: { value: 'PROBE we must decide on billing' } })

    // The server-hydration swap: 0 → N nodes the user did NOT cause.
    act(() => {
      ;(useCanvasStore as any).setState({ nodes: [{ id: 'n1' }, { id: 'n2' }] })
    })
    expect(screen.queryByTestId(HERO_TEXTAREA)).toBeNull()

    // The floating panel registers its channel on the commit after the
    // hero's teardown; stand in for it here.
    const floatingFocus = vi.fn()
    const unregister = registerFloatingFocus(floatingFocus)

    await waitFor(() => expect(floatingFocus).toHaveBeenCalledTimes(1))
    unregister()
  })

  it('OPPOSITE TWIN: no handoff when the user had typed nothing — focus is left alone', async () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId(HERO_TEXTAREA)),
    )

    act(() => {
      ;(useCanvasStore as any).setState({ nodes: [{ id: 'n1' }] })
    })

    const floatingFocus = vi.fn()
    const unregister = registerFloatingFocus(floatingFocus)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(floatingFocus).not.toHaveBeenCalled()
    unregister()
  })
})

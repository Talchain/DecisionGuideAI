/**
 * useFocusNow container — enforces the two boundaries the presentational layer
 * cannot: (1) the uncertified coaching_summary is gated OFF; (2) the row action
 * MERGES the prompt into the LIVE chat composer (ConversationContext draft, which
 * the visible AIInputBar renders) and reveals the chat, but NEVER sends and never
 * runs analysis. Also maps the live freshness source to the banner, and gates the
 * action controls off when there is no live chat / aiPanelV2 is disabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const h = vi.hoisted(() => {
  const draftBox = { draft: '' }
  return {
    draftBox,
    setDraft: vi.fn((text: string) => {
      draftBox.draft = text
    }),
    sendMessage: vi.fn(),
    runV2Analysis: vi.fn(),
    forceActivateOutputTab: vi.fn(),
    focusFloating: vi.fn(),
    aiPanelV2: vi.fn(() => true),
    hasConversation: { value: true },
  }
})

vi.mock('@/canvas/store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) =>
    sel({
      ceeAnalysisReady: { coaching_summary: 'live CEE prose that is not claim-certified' },
      analysisFreshness: { freshness: 'stale' },
      analysisFreshnessDirty: false,
    }),
}))
vi.mock('@/canvas/hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: h.runV2Analysis, isRunning: false, cancelRun: vi.fn(), error: null }),
}))
vi.mock('@/canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () =>
    h.hasConversation.value
      ? { draft: h.draftBox.draft, setDraft: h.setDraft, sendMessage: h.sendMessage }
      : null,
}))
vi.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(() => undefined, {
    getState: () => ({ forceActivateOutputTab: h.forceActivateOutputTab }),
  }),
}))
vi.mock('@/canvas/hooks/useFloatingFocus', () => ({ focusFloating: h.focusFloating }))
vi.mock('@/flags', () => ({ isAiPanelV2Enabled: h.aiPanelV2 }))

import { useFocusNow } from '../useFocusNow'

describe('useFocusNow container', () => {
  beforeEach(() => {
    h.draftBox.draft = ''
    h.hasConversation.value = true
    h.aiPanelV2.mockReturnValue(true)
    h.setDraft.mockClear()
    h.sendMessage.mockClear()
    h.runV2Analysis.mockClear()
    h.forceActivateOutputTab.mockClear()
    h.focusFloating.mockClear()
  })

  it('gates the uncertified coaching_summary OFF (summary is null despite live data)', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.summary).toBeNull()
  })

  it('still surfaces the static rows and maps freshness to the banner', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.rows.length).toBeGreaterThan(0)
    expect(result.current.rows.every((r) => r.ownership === 'static_hygiene')).toBe(true)
    expect(result.current.banner).toEqual({ kind: 'stale', canRerun: true })
  })

  it('onPrefill writes the prompt to the live chat draft, reveals the chat, and never sends', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onPrefill?.('Help me add a risk.')
    // writes the prompt into the ConversationContext draft (what AIInputBar renders)
    expect(h.setDraft).toHaveBeenCalledWith('Help me add a risk.')
    // reveals the Olumi chat surface (docked tab + best-effort floating focus)
    expect(h.forceActivateOutputTab).toHaveBeenCalledWith('olumi')
    expect(h.focusFloating).toHaveBeenCalled()
    // never auto-sends, never triggers a re-run, never touches the legacy draft store
    expect(h.sendMessage).not.toHaveBeenCalled()
    expect(h.runV2Analysis).not.toHaveBeenCalled()
  })

  it('onPrefill APPENDS to an unsent draft — never clobbers it', () => {
    h.draftBox.draft = 'I am leaning towards option A'
    const { result } = renderHook(() => useFocusNow())
    result.current.onPrefill?.('Help me add a risk.')
    expect(h.setDraft).toHaveBeenCalledWith('I am leaning towards option A\n\nHelp me add a risk.')
  })

  it('exposes actionsEnabled=true when aiPanelV2 is on and a live chat exists', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.actionsEnabled).toBe(true)
  })

  it('exposes actionsEnabled=false when aiPanelV2 is off (controls must hide, not be dead)', () => {
    h.aiPanelV2.mockReturnValue(false)
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.actionsEnabled).toBe(false)
  })

  it('exposes actionsEnabled=false when there is no live conversation (cannot reach the composer)', () => {
    h.hasConversation.value = false
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.actionsEnabled).toBe(false)
  })

  it('onRerun triggers a re-run', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onRerun?.()
    expect(h.runV2Analysis).toHaveBeenCalledTimes(1)
  })
})

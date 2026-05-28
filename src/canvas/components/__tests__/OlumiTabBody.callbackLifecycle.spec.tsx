/**
 * OlumiTabBody — guidance-store callback lifecycle regression guard
 * (pre-analysis-power-v2 post-deploy review).
 *
 * The minimal `_sendMessage` / `_prefillChat` registration in
 * OlumiTabBody must survive the populated → empty conversation
 * transition. ConversationPanel's cleanup nulls those callbacks on
 * unmount; the fix adds `realMessageCount` to OlumiTabBody's useEffect
 * deps so the effect re-runs on the same render pass and re-registers
 * them. Without this, scenario reset / `clearHistory` / hydration
 * failure leaves `DiscussWithAiButton` rendering null.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactNode } from 'react'

// Mock ConversationContext so we control message count directly.
const conversationState = {
  messages: [] as Array<{ synthetic?: boolean }>,
  sendMessage: vi.fn(),
  setDraft: vi.fn(),
}
vi.mock('../../conversation/ConversationContext', () => ({
  useConversationContext: () => conversationState,
}))

// Mock ConversationPanel so we can faithfully reproduce its
// register-on-mount / null-on-unmount lifecycle without dragging in the
// real implementation's heavy dependencies.
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: ({ children: _children }: { children?: ReactNode }) => {
    // Mirror the real cleanup contract:
    // - on mount: overwrites callbacks with a richer set (here: marker strings)
    // - on unmount: nulls everything
    return (
      <div data-testid="conv-panel-mock">
        <ConvPanelEffect />
      </div>
    )
  },
}))

import { useEffect } from 'react'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { OlumiTabBody } from '../OlumiTabBody'
import { ConversationProvider } from '../../conversation/ConversationContext'

function ConvPanelEffect() {
  useEffect(() => {
    useGuidanceStore.setState({
      _sendMessage: (() => {}) as never,
      _prefillChat: (() => {}) as never,
    })
    return () => {
      useGuidanceStore.setState({
        _sendMessage: null,
        _prefillChat: null,
      })
    }
  }, [])
  return null
}

// Note: ConversationProvider is imported but not used in render — the
// `useConversationContext` mock above bypasses it. Importing it just to
// keep the surface honest if the mock is removed.
void ConversationProvider

beforeEach(() => {
  conversationState.messages = []
  conversationState.sendMessage = vi.fn()
  conversationState.setDraft = vi.fn()
  // Reset guidance store to a known empty state.
  useGuidanceStore.setState({
    _sendMessage: null,
    _prefillChat: null,
  })
})

describe('OlumiTabBody — callback re-registration lifecycle', () => {
  it('registers _sendMessage and _prefillChat on initial mount with empty conversation', () => {
    render(<OlumiTabBody />)
    const s = useGuidanceStore.getState()
    expect(typeof s._sendMessage).toBe('function')
    expect(typeof s._prefillChat).toBe('function')
  })

  it('keeps callbacks registered when conversation transitions empty → populated → empty', () => {
    const { rerender } = render(<OlumiTabBody />)
    // Empty → registered by OlumiTabBody.
    expect(typeof useGuidanceStore.getState()._sendMessage).toBe('function')

    // Empty → populated: ConversationPanel mounts and overwrites.
    act(() => {
      conversationState.messages = [{ synthetic: false }]
    })
    rerender(<OlumiTabBody />)
    expect(typeof useGuidanceStore.getState()._sendMessage).toBe('function')

    // Populated → empty: ConversationPanel unmounts (nulls callbacks).
    // The fix: realMessageCount in deps makes OlumiTabBody's effect
    // re-run on the same render pass and re-register.
    act(() => {
      conversationState.messages = []
    })
    rerender(<OlumiTabBody />)
    const finalState = useGuidanceStore.getState()
    expect(typeof finalState._sendMessage).toBe('function')
    expect(typeof finalState._prefillChat).toBe('function')
  })

  it('re-registers after clearHistory-style reset (multiple cycles)', () => {
    const { rerender } = render(<OlumiTabBody />)
    for (let i = 0; i < 3; i++) {
      act(() => {
        conversationState.messages = [{ synthetic: false }]
      })
      rerender(<OlumiTabBody />)
      act(() => {
        conversationState.messages = []
      })
      rerender(<OlumiTabBody />)
      expect(typeof useGuidanceStore.getState()._sendMessage).toBe('function')
      expect(typeof useGuidanceStore.getState()._prefillChat).toBe('function')
    }
  })

  it('_prefillChat writes to the conversation draft when invoked', () => {
    render(<OlumiTabBody />)
    const prefill = useGuidanceStore.getState()._prefillChat
    expect(prefill).not.toBeNull()
    prefill!('hello from a priority card')
    expect(conversationState.setDraft).toHaveBeenCalledWith('hello from a priority card')
  })

  it('_sendMessage delegates to the conversation sendMessage', () => {
    render(<OlumiTabBody />)
    const send = useGuidanceStore.getState()._sendMessage
    expect(send).not.toBeNull()
    send!('discuss this')
    expect(conversationState.sendMessage).toHaveBeenCalledWith('discuss this')
  })
})

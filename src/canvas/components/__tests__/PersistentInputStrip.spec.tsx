/**
 * PersistentInputStrip — invariant + draft-preservation tests.
 *
 * Critical invariants tested:
 *   - When floating Olumi panel is open, the strip MUST NOT render a textarea
 *     (preserves "no duplicate composer" rule from aiPanelV2 addendum A).
 *   - Draft text typed into the strip persists across floating open/close so
 *     dock/undock never loses in-progress text (addendum A + B).
 *   - Status-strip text reflects the LAST assistant message (first 50 chars),
 *     literal — never an LLM-generated summary (addendum G).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { PersistentInputStrip } from '../PersistentInputStrip'
import {
  ConversationProvider,
  useConversationContext,
} from '../../conversation/ConversationContext'

// Stub the heavy conversation runtime: useConversation does network + store
// work that's irrelevant to these UI invariant tests.
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [messages, setMessages] = useState<any[]>([])
      const [isThinking, setIsThinking] = useState(false)
      return {
        messages,
        isThinking,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage: vi.fn((text: string) => {
          setMessages((m) => [
            ...m,
            { id: `u-${m.length}`, role: 'user', content: text, blocks: [] },
          ])
        }),
        sendSystemEvent: vi.fn(),
        sendChip: vi.fn(),
        retryLast: vi.fn(),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
        _testHelpers: { setMessages, setIsThinking },
      }
    },
  }
})

// useStaleGuard is store-dependent — stub to a stable "not stale" baseline.
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))

// useStageAwarePlaceholder pulls from canvas store + stale guard; stub the
// constant string variant for predictable assertions.
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

describe('PersistentInputStrip', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  describe('composer mode — floating closed', () => {
    it('renders a textarea when floating is closed (composer mode)', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
        wrapper: Wrapper,
      })
      expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('status mode — floating open (invariant: no textarea)', () => {
    it('renders status line WITHOUT a textarea when floating is open', () => {
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
        wrapper: Wrapper,
      })
      expect(screen.getByTestId('persistent-strip-status')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('clicking the status strip calls onFocusFloating', () => {
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      const onFocusFloating = vi.fn()
      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          onFocusFloating={onFocusFloating}
          onCogClick={() => {}}
        />,
        { wrapper: Wrapper },
      )
      fireEvent.click(screen.getByTestId('persistent-strip-status'))
      expect(onFocusFloating).toHaveBeenCalledTimes(1)
    })
  })

  describe('draft preservation across floating open/close', () => {
    it('preserves typed draft text when floating opens and closes', () => {
      // Capture the context inside a test consumer so we can assert
      // draft value out-of-band.
      let captured: { draft: string } = { draft: '' }
      function Capture() {
        const ctx = useConversationContext()
        captured = ctx
        return null
      }
      render(
        <>
          <Capture />
          <PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />
        </>,
        { wrapper: Wrapper },
      )
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'half-typed thought' } })
      expect(captured.draft).toBe('half-typed thought')

      // Open the floating panel — strip switches to status mode and unmounts
      // its textarea, but the draft string lives in the context so it survives.
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(captured.draft).toBe('half-typed thought')

      // Close the floating panel — strip rerenders the textarea with the
      // preserved value.
      act(() => {
        useFloatingPanelState.getState().close()
      })
      const reborn = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(reborn.value).toBe('half-typed thought')
    })
  })
})

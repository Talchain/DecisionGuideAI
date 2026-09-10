/**
 * OlumiTabBody — a coaching click on a FRESH, EMPTY chat must carry its context.
 *
 * ⚠⚠ THE DEFECT THIS PINS DID NOT LOOK LIKE A FAILURE, WHICH IS WHY IT SURVIVED.
 * `NodeChip` dispatches a coaching prompt through three tiers: `_dispatchAction`
 * (the only bridge that carries chip metadata), else `_sendMessage` — whose own
 * comment reads *"Legacy bridge — metadata cannot travel; the message still
 * lands"* — else a visible "Olumi is unavailable here" state.
 *
 * On a fresh, empty conversation the FULL callback set is not registered:
 * `ConversationPanel` is the only caller of `registerConversationCallbacks` and
 * it mounts on OlumiTabBody's POPULATED branch. So the click took tier 2 and
 * `action_type`, `parameters.chip_id` and `source` were silently dropped — the
 * request went out, the CONTEXT did not, and a stripped request still returns
 * something, so nothing looked broken.
 *
 * These tests bind to the registration CONTRACT, by identity of the callback
 * being registered — not to any component's rendering of it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(),
}))

const conversationState = {
  messages: [] as Array<{ synthetic?: boolean }>,
  sendMessage: vi.fn(),
  setDraft: vi.fn(),
  dispatchAction: vi.fn(() => Promise.resolve()) as unknown as (opts: unknown) => Promise<void>,
}
vi.mock('../../conversation/ConversationContext', () => ({
  useConversationContext: () => conversationState,
}))
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: ({ children: _children }: { children?: ReactNode }) => (
    <div data-testid="conv-panel-mock" />
  ),
}))

import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { OlumiTabBody } from '../OlumiTabBody'

const mockReveal = revealOlumiSurface as unknown as ReturnType<typeof vi.fn>

/**
 * ⚠ DERIVED FROM A LIVE CALL SITE, NOT INVENTED — corrected after review.
 *
 * This fixture paired `chip_id: 'risk_what_reduces'` with
 * `action_type: 'explore_risk'`. **That pairing exists nowhere in the product.**
 * `explore_risk` had exactly 2 hits in `src`, both inside this file, against a
 * contrast of 22 files for `explain_results`; and the real caller of
 * `risk_what_reduces` (`RiskNode.tsx:182`) passes `actionType={null}`.
 *
 * A fixture the producer cannot emit proves the bridge carries A payload, never
 * that it carries the payload a chip actually sends — a self-authored input is
 * not evidence about the wire (trap 16-inverse). Re-bound to a pairing that
 * ships: `OptionNode.tsx:1142`.
 */
const CHIP_OPTS = {
  action_type: 'explain_results',
  parameters: { chip_id: 'option_why_win_lose' },
  label: 'Why does this do better or worse on your goal?',
  message: 'Why does the baseline do better or worse against my goal than the other options?',
  source: 'chip',
}

beforeEach(() => {
  conversationState.messages = []
  conversationState.sendMessage = vi.fn()
  conversationState.setDraft = vi.fn()
  conversationState.dispatchAction = vi.fn(() =>
    Promise.resolve(),
  ) as unknown as (opts: unknown) => Promise<void>
  mockReveal.mockClear()
  useGuidanceStore.setState({
    _sendMessage: null,
    _prefillChat: null,
    _dispatchAction: null,
  })
})

describe('OlumiTabBody — the fresh-chat dispatcher carries chip context', () => {
  it('registers _dispatchAction on initial mount with an EMPTY conversation', () => {
    render(<OlumiTabBody />)
    expect(typeof useGuidanceStore.getState()._dispatchAction).toBe('function')
  })

  it('delegates with the chip metadata INTACT — action_type, parameters and source all travel', () => {
    render(<OlumiTabBody />)
    const dispatch = useGuidanceStore.getState()._dispatchAction
    expect(dispatch).not.toBeNull()
    act(() => {
      dispatch!(CHIP_OPTS)
    })
    expect(conversationState.dispatchAction).toHaveBeenCalledTimes(1)
    expect(conversationState.dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'explain_results',
        parameters: { chip_id: 'option_why_win_lose' },
        source: 'chip',
      }),
    )
  })

  it('⭐ REVEALS the Olumi surface — the Class-8 guarantee this raw setState would otherwise bypass', () => {
    render(<OlumiTabBody />)
    const dispatch = useGuidanceStore.getState()._dispatchAction
    act(() => {
      dispatch!(CHIP_OPTS)
    })
    expect(mockReveal).toHaveBeenCalledTimes(1)
  })

  it('REPORTS a rejected dispatch rather than dropping it, and never throws at the call site', async () => {
    const err = new Error('CEE refused')
    conversationState.dispatchAction = vi.fn(() =>
      Promise.reject(err),
    ) as unknown as (opts: unknown) => Promise<void>
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OlumiTabBody />)
    const dispatch = useGuidanceStore.getState()._dispatchAction
    expect(() => dispatch!(CHIP_OPTS)).not.toThrow()
    await act(async () => {
      await Promise.resolve()
    })
    expect(spy).toHaveBeenCalledWith('[OlumiTabBody] dispatchAction failed:', err)
    spy.mockRestore()
  })

  it('⚠ NEVER nulls a dispatcher a fuller host already registered — child effects run first', () => {
    const richer = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: richer as never })
    ;(conversationState as unknown as { dispatchAction?: unknown }).dispatchAction = undefined
    render(<OlumiTabBody />)
    expect(useGuidanceStore.getState()._dispatchAction).toBe(richer)
  })
})

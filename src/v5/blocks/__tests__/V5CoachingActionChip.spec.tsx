/**
 * ROADMAP 2.225 — the coaching action pill becomes ACTUALLY ACTIONABLE.
 *
 * THE DEFECT THIS PINS. CEE already emits `action_intent`/`action_label` on
 * coaching blocks ("Confirm this assumption", "Re-run analysis"). The UI
 * rendered `action_label` as a bare <span> and `action_intent` as an
 * invisible data-attribute with zero readers: no onClick, no keyboard reach.
 * Testers saw a dead button.
 *
 * THE CONTRACT (@talchain/schemas 0.31.0, CoachingBlockSchema.action_prompt).
 * The producer authors the turn text; the consumer dispatches it VERBATIM.
 * The schema states the failure semantics explicitly, and this spec pins
 * BOTH ends of them:
 *
 *   "FAIL CLOSED, AND SILENTLY. Absence means the producer authored no
 *    prompt, and the consumer renders NO dispatching chip. It must not fall
 *    back to composing one from `action_intent` or `action_label`: that
 *    fallback IS the defect. A card with a label and no prompt is a
 *    non-interactive card, which is the honest degradation."
 *
 * So the two load-bearing assertions here are adversarial to each other:
 *   - WITH `action_prompt`  → a real <button> that dispatches it verbatim.
 *   - WITHOUT `action_prompt` → the inert pill stays, and NO button appears
 *     even though `action_label` is present and would be a tempting
 *     fallback. That test is the one that bites if someone "helpfully"
 *     restores `action_prompt ?? action_label`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { V5CoachingBlock } from '../V5CoachingBlock'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../../canvas/conversation/types'

const BASE: V5CoachingBlockType = {
  type: 'v5_coaching',
  block_id: '7e0855c7-d79d-5d16-9fee-19e68ece297d',
  title: 'An assumption to check',
  body: 'The relationship between Technical Leadership Capacity and throughput remains stable.',
  coaching_kind: 'assumption_check',
  source: 'decision_review',
  target_refs: [],
  priority_rank: 120,
  freshness: 'fresh',
}

/** Producer-authored turn text. Deliberately NOT a paraphrase of the label. */
const PRODUCER_PROMPT =
  'You said the leadership capacity holds steady through Q3. What would have to be true for that to break?'

afterEach(() => {
  useGuidanceStore.setState({ _sendChip: null })
})

describe('V5CoachingBlock — action chip dispatch (2.225)', () => {
  let sendChip: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
  })

  it('renders a real BUTTON (not a span) when the producer authored a prompt', () => {
    render(
      <V5CoachingBlock
        block={{
          ...BASE,
          action_intent: 'confirm_factor',
          action_label: 'Confirm this assumption',
          action_prompt: PRODUCER_PROMPT,
        }}
      />,
    )
    const action = screen.getByTestId('v5-coaching-action')
    // The whole point of the row: a real button, so role + keyboard reach
    // come for free. `getByRole` would pass on a span with role="button";
    // the tagName assertion is what pins a NATIVE button.
    expect(action.tagName).toBe('BUTTON')
    expect(action).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Confirm this assumption' })).toBe(action)
  })

  it('dispatches the producer action_prompt VERBATIM — the UI composes nothing', async () => {
    const user = userEvent.setup()
    render(
      <V5CoachingBlock
        block={{
          ...BASE,
          action_intent: 'confirm_factor',
          action_label: 'Confirm this assumption',
          action_prompt: PRODUCER_PROMPT,
        }}
      />,
    )
    await user.click(screen.getByTestId('v5-coaching-action'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    // label = what the chip DISPLAYS; message = what is SENT. Both producer
    // copy, neither templated, interpolated or appended to.
    expect(sendChip).toHaveBeenCalledWith('Confirm this assumption', PRODUCER_PROMPT)
    const [, message] = sendChip.mock.calls[0] as [string, string]
    expect(message).toBe(PRODUCER_PROMPT)
    // Guard against a composed message that merely CONTAINS the producer text.
    expect(message.length).toBe(PRODUCER_PROMPT.length)
  })

  it('is reachable and firable by KEYBOARD alone', async () => {
    const user = userEvent.setup()
    render(
      <V5CoachingBlock
        block={{ ...BASE, action_label: 'Re-run analysis', action_prompt: PRODUCER_PROMPT }}
      />,
    )
    await user.tab()
    expect(screen.getByTestId('v5-coaching-action')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(sendChip).toHaveBeenCalledWith('Re-run analysis', PRODUCER_PROMPT)
  })

  it('fires at most once — a settled chip does not re-send', async () => {
    const user = userEvent.setup()
    render(
      <V5CoachingBlock
        block={{ ...BASE, action_label: 'Re-run analysis', action_prompt: PRODUCER_PROMPT }}
      />,
    )
    const action = screen.getByTestId('v5-coaching-action')
    await user.click(action)
    await user.click(action)
    await user.click(action)
    expect(sendChip).toHaveBeenCalledTimes(1)
    // Settled state is visually distinct AND announced through the native
    // disabled semantics (CHIP_CLASS carries disabled:opacity-40).
    expect(action).toBeDisabled()
    expect(action).toHaveAttribute('data-settled', 'true')
  })

  it('carries action_intent as a data attribute only — never as visible copy', () => {
    render(
      <V5CoachingBlock
        block={{
          ...BASE,
          action_intent: 'gather_evidence',
          action_label: 'Add evidence',
          action_prompt: PRODUCER_PROMPT,
        }}
      />,
    )
    const action = screen.getByTestId('v5-coaching-action')
    expect(action).toHaveAttribute('data-action-intent', 'gather_evidence')
    expect(action).toHaveTextContent('Add evidence')
    expect(screen.getByTestId('v5-coaching').textContent).not.toMatch(/gather_evidence/)
  })
})

describe('V5CoachingBlock — fail-closed semantics (2.225)', () => {
  it('renders NO dispatching button when the producer authored no prompt', () => {
    // The adversarial test. `action_label` IS present and IS producer copy,
    // so falling back to it is superficially defensible — the contract names
    // that fallback as the defect. A label with no prompt is a
    // NON-INTERACTIVE card, which is the honest degradation.
    useGuidanceStore.setState({ _sendChip: vi.fn() })
    render(
      <V5CoachingBlock
        block={{ ...BASE, action_intent: 'confirm_factor', action_label: 'Confirm this assumption' }}
      />,
    )
    const action = screen.getByTestId('v5-coaching-action')
    expect(action.tagName).not.toBe('BUTTON')
    expect(screen.queryByRole('button', { name: 'Confirm this assumption' })).not.toBeInTheDocument()
    // The label still renders verbatim — we degrade the AFFORDANCE, never the copy.
    expect(action).toHaveTextContent('Confirm this assumption')
  })

  it('renders no action element at all when the producer sent no label', () => {
    render(<V5CoachingBlock block={{ ...BASE, action_prompt: PRODUCER_PROMPT }} />)
    expect(screen.queryByTestId('v5-coaching-action')).not.toBeInTheDocument()
  })

  it('fail-closed with no conversation host: click is a safe no-op and does NOT settle', async () => {
    // Mirrors V5HeldProposalBlock: with no host registered there is nothing
    // to send, so acknowledging would be a false claim. The affordance stays
    // live so the user can act once a host registers.
    useGuidanceStore.setState({ _sendChip: null })
    const user = userEvent.setup()
    render(
      <V5CoachingBlock
        block={{ ...BASE, action_label: 'Re-run analysis', action_prompt: PRODUCER_PROMPT }}
      />,
    )
    const action = screen.getByTestId('v5-coaching-action')
    await user.click(action)
    expect(action).not.toBeDisabled()
    expect(action).not.toHaveAttribute('data-settled')
  })
})

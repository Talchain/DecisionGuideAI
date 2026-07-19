/**
 * R8 (roadmap 2.27) — DOM + wiring contract for the held-proposal card.
 *
 * Contract:
 *   - WHAT: producer `summary` rendered verbatim.
 *   - WHY: UI copy for reason_code (raw literal pinned here per
 *     DESIGN_SYSTEM.md "Canonical State Copy" — a reworded constant must not
 *     silently drift from the sentence the test promises).
 *   - No internal vocabulary in visible text: the `held_proposal` token, raw
 *     reason_code, mutation_class, and proposal_id ride as data-* only.
 *   - Confirm routes through the guidance store `_sendChip` seam (single
 *     writer); dismiss dispatches the decline action when present, else is
 *     local-only. Fail-closed when `_sendChip` is unavailable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { V5HeldProposalBlock } from '../V5HeldProposalBlock'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import type { V5HeldProposalBlock as V5HeldProposalBlockType } from '../../../canvas/conversation/types'

const BLOCK: V5HeldProposalBlockType = {
  type: 'v5_held_proposal',
  proposal_id: 'gmh_ab12cd34ef56',
  summary: 'Add a "regulatory delay" risk feeding into Launch on time',
  mutation_class: 'structural',
  reason_code: 'STRUCTURAL_APPLY_HELD',
  confirm: { label: 'Continue with this change', message: 'Yes' },
}

const STRUCTURAL_HELD_SENTENCE =
  'This reshapes your model, so it needs your go-ahead before it is applied.'

beforeEach(() => {
  useGuidanceStore.setState({ _sendChip: null })
})

describe('V5HeldProposalBlock', () => {
  it('renders the producer summary verbatim and the humanised held reason', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    expect(screen.getByTestId('v5-held-proposal-summary')).toHaveTextContent(BLOCK.summary)
    expect(screen.getByTestId('v5-held-proposal-reason')).toHaveTextContent(
      STRUCTURAL_HELD_SENTENCE,
    )
    expect(screen.getByTestId('v5-held-proposal-heading')).toHaveTextContent(
      'Waiting for your go-ahead',
    )
  })

  it('renders the producer confirm label verbatim and a UI-owned dismiss label', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    expect(screen.getByTestId('v5-held-proposal-confirm')).toHaveTextContent(
      'Continue with this change',
    )
    expect(screen.getByTestId('v5-held-proposal-dismiss')).toHaveTextContent('Not now')
  })

  it('never renders internal vocabulary as visible text', () => {
    const { container } = render(<V5HeldProposalBlock block={BLOCK} />)
    const visible = container.textContent ?? ''
    expect(visible).not.toContain('held_proposal')
    expect(visible).not.toContain('STRUCTURAL_APPLY_HELD')
    expect(visible).not.toContain('mutation_class')
    expect(visible).not.toContain('structural')
    expect(visible).not.toContain('gmh_ab12cd34ef56')
  })

  it('carries internal identifiers as data-* attributes only', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    const card = screen.getByTestId('v5-held-proposal')
    expect(card).toHaveAttribute('data-block-id', 'gmh_ab12cd34ef56')
    expect(card).toHaveAttribute('data-mutation-class', 'structural')
    expect(card).toHaveAttribute('data-reason-code', 'STRUCTURAL_APPLY_HELD')
  })

  it('confirm dispatches the producer message through the _sendChip seam (single writer)', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<V5HeldProposalBlock block={BLOCK} />)

    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith('Continue with this change', 'Yes')
    // Settled: actions replaced by an honest acknowledgement (no "applied" claim).
    expect(screen.queryByTestId('v5-held-proposal-actions')).toBeNull()
    expect(screen.getByTestId('v5-held-proposal-settled')).toHaveTextContent('Sent for you to apply.')
  })

  it('does not double-dispatch on a second confirm click', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<V5HeldProposalBlock block={BLOCK} />)
    const btn = screen.getByTestId('v5-held-proposal-confirm')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(sendChip).toHaveBeenCalledTimes(1)
  })

  it('dismiss with no decline action is local-only (no turn sent)', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<V5HeldProposalBlock block={BLOCK} />)

    fireEvent.click(screen.getByTestId('v5-held-proposal-dismiss'))

    expect(sendChip).not.toHaveBeenCalled()
    expect(screen.getByTestId('v5-held-proposal-settled')).toHaveTextContent('Dismissed.')
  })

  it('dismiss dispatches the decline action when CEE emits one', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(
      <V5HeldProposalBlock
        block={{ ...BLOCK, decline: { label: 'Adjust it first', message: 'Let me adjust' } }}
      />,
    )
    expect(screen.getByTestId('v5-held-proposal-dismiss')).toHaveTextContent('Adjust it first')

    fireEvent.click(screen.getByTestId('v5-held-proposal-dismiss'))

    expect(sendChip).toHaveBeenCalledWith('Adjust it first', 'Let me adjust')
  })

  it('fails closed when _sendChip is unavailable (confirm is a safe no-op)', () => {
    useGuidanceStore.setState({ _sendChip: null })
    render(<V5HeldProposalBlock block={BLOCK} />)
    expect(() => fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))).not.toThrow()
    // Still settles so the affordance cannot be re-fired endlessly.
    expect(screen.getByTestId('v5-held-proposal-settled')).toBeTruthy()
  })
})

/**
 * ProposalBlockRenderer — proposal confirm/cancel behaviour
 *
 * Verifies:
 * - Apply calls onProposalConfirm with proposal_id and transitions to 'accepted'
 * - Cancel transitions to 'cancelled' without calling onProposalConfirm
 * - confirmation_required: false auto-applies (no buttons rendered)
 * - confirmation_required: true (or absent) shows Apply/Cancel buttons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { ProposalBlock } from '../types'
import type { ConversationBlock } from '../types'

// ---------------------------------------------------------------------------
// Flag & posthog mocks
// ---------------------------------------------------------------------------

vi.mock('../../../flags', () => ({
  isDeterministicCeeEnabled: vi.fn(() => true),
  isPreAnalysisEnrichedEnabled: vi.fn(() => false),
  isOrchestratorRenderingV2Enabled: vi.fn(() => false),
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

function makeProposal(overrides: Partial<ProposalBlock> = {}): ProposalBlock {
  return {
    type: 'proposal',
    action_type: 'add_factor',
    description: 'Add Regulatory Risk as a new factor',
    proposal_id: 'abc-123',
    changes: [
      { operation: 'add', target: 'Regulatory Risk', detail: 'New factor node' },
    ],
    consequences: ['May increase model complexity'],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProposalBlockRenderer', () => {
  let onProposalConfirm: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onProposalConfirm = vi.fn()
  })

  it('auto-applies when confirmation_required is absent (no buttons)', () => {
    const block = makeProposal()
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )
    expect(screen.queryByTestId('proposal-apply')).not.toBeInTheDocument()
    expect(screen.queryByTestId('proposal-cancel')).not.toBeInTheDocument()
    expect(screen.getAllByText('Change accepted').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Apply/Cancel buttons when confirmation_required is true', () => {
    const block = makeProposal({ confirmation_required: true })
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )
    expect(screen.getByTestId('proposal-apply')).toBeInTheDocument()
    expect(screen.getByTestId('proposal-cancel')).toBeInTheDocument()
  })

  it('Apply calls onProposalConfirm with proposal_id and transitions to accepted', () => {
    const block = makeProposal({ confirmation_required: true })
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )

    fireEvent.click(screen.getByTestId('proposal-apply'))

    expect(onProposalConfirm).toHaveBeenCalledTimes(1)
    expect(onProposalConfirm).toHaveBeenCalledWith('abc-123')
    // Eyebrow and status span show state-derived label
    expect(screen.getAllByText('Change accepted').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTestId('proposal-apply')).not.toBeInTheDocument()
    expect(screen.queryByTestId('proposal-cancel')).not.toBeInTheDocument()
  })

  it('Cancel transitions to cancelled without calling onProposalConfirm', () => {
    const block = makeProposal({ confirmation_required: true })
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )

    fireEvent.click(screen.getByTestId('proposal-cancel'))

    expect(onProposalConfirm).not.toHaveBeenCalled()
    // Eyebrow and status span show state-derived label
    expect(screen.getAllByText('Change dismissed').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTestId('proposal-apply')).not.toBeInTheDocument()
  })

  it('auto-applies when confirmation_required is false (no buttons)', () => {
    const block = makeProposal({ confirmation_required: false })
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )

    // No Apply/Cancel buttons rendered
    expect(screen.queryByTestId('proposal-apply')).not.toBeInTheDocument()
    expect(screen.queryByTestId('proposal-cancel')).not.toBeInTheDocument()
    // Eyebrow and status span show state-derived label
    expect(screen.getAllByText('Change accepted').length).toBeGreaterThanOrEqual(1)
  })

  it('renders description, changes, and consequences', () => {
    const block = makeProposal()
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )
    expect(screen.getByText('Add Regulatory Risk as a new factor')).toBeInTheDocument()
    expect(screen.getByText('New factor node')).toBeInTheDocument()
    expect(screen.getByText('add')).toBeInTheDocument()
    expect(screen.getByText('Regulatory Risk')).toBeInTheDocument()
    expect(screen.getByText(/May increase model complexity/)).toBeInTheDocument()
  })

  it('Apply button has aria-label for accessibility', () => {
    const block = makeProposal({ confirmation_required: true })
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )
    expect(screen.getByTestId('proposal-apply')).toHaveAttribute('aria-label', 'Apply proposed changes')
    expect(screen.getByTestId('proposal-cancel')).toHaveAttribute('aria-label', 'Dismiss proposed changes')
  })
})

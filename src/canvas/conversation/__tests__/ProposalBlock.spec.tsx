/**
 * ProposalBlockRenderer — proposal confirm/cancel behaviour
 *
 * Verifies:
 * - Apply calls onProposalConfirm with proposal_id and transitions to 'accepted'
 * - Cancel transitions to 'cancelled' without calling onProposalConfirm
 * - confirmation_required: false auto-applies (no buttons rendered)
 * - confirmation_required: true (or absent) shows Apply/Cancel buttons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('settled-state status row renders without inline style attributes', () => {
    const block = makeProposal()
    const { container } = render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onProposalConfirm}
      />,
    )
    // Auto-applied → settled state, status span should use CSS module classes only
    const statusSpans = container.querySelectorAll('[data-testid="block-proposal"] span')
    const statusRow = Array.from(statusSpans).find(el => el.textContent?.includes('Change accepted'))
    expect(statusRow).toBeDefined()
    expect(statusRow!.getAttribute('style')).toBeNull()
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

// ---------------------------------------------------------------------------
// Render matrix: all ProposalBlock states → header text, badge icon, colour
// ---------------------------------------------------------------------------

describe('ProposalBlockRenderer — render matrix (all states)', () => {
  it.each([
    {
      name: 'pending (confirmation_required)',
      overrides: { confirmation_required: true } as Partial<ProposalBlock>,
      clickAction: null as 'apply' | 'cancel' | null,
      expectedHeader: 'Suggested change',
      expectedBadgeIcon: null as string | null,
      expectedBadgeColour: null as string | null,
      buttonsVisible: true,
    },
    {
      name: 'accepted (auto-apply, confirmation absent)',
      overrides: {} as Partial<ProposalBlock>,
      clickAction: null,
      expectedHeader: 'Change accepted',
      expectedBadgeIcon: 'lucide-check',
      expectedBadgeColour: 'text-success',
      buttonsVisible: false,
    },
    {
      name: 'accepted (user clicks Apply)',
      overrides: { confirmation_required: true } as Partial<ProposalBlock>,
      clickAction: 'apply' as const,
      expectedHeader: 'Change accepted',
      expectedBadgeIcon: 'lucide-check',
      expectedBadgeColour: 'text-success',
      buttonsVisible: false,
    },
    {
      name: 'cancelled (user clicks Cancel)',
      overrides: { confirmation_required: true } as Partial<ProposalBlock>,
      clickAction: 'cancel' as const,
      expectedHeader: 'Change dismissed',
      expectedBadgeIcon: null,
      expectedBadgeColour: null,
      buttonsVisible: false,
    },
  ])('$name: header="$expectedHeader", icon=$expectedBadgeIcon, colour=$expectedBadgeColour', ({
    overrides,
    clickAction,
    expectedHeader,
    expectedBadgeIcon,
    expectedBadgeColour,
    buttonsVisible,
  }) => {
    const onConfirm = vi.fn()
    const block = makeProposal(overrides)
    render(
      <InlineBlocks
        blocks={[block as unknown as ConversationBlock]}
        onProposalConfirm={onConfirm}
      />,
    )

    if (clickAction === 'apply') fireEvent.click(screen.getByTestId('proposal-apply'))
    if (clickAction === 'cancel') fireEvent.click(screen.getByTestId('proposal-cancel'))

    // Header text
    expect(screen.getAllByText(expectedHeader).length).toBeGreaterThanOrEqual(1)

    // Badge icon + colour on the status span (only rendered when not pending)
    if (expectedBadgeIcon) {
      const statusSpans = screen.getAllByText(expectedHeader)
      const statusWithIcon = statusSpans.find(el => el.querySelector('svg'))
      expect(statusWithIcon).toBeDefined()
      const svg = statusWithIcon!.querySelector('svg')!
      expect(svg.classList.contains(expectedBadgeIcon)).toBe(true)
      if (expectedBadgeColour) {
        expect(svg.classList.contains(expectedBadgeColour)).toBe(true)
      }
    }

    // Buttons
    if (buttonsVisible) {
      expect(screen.getByTestId('proposal-apply')).toBeInTheDocument()
      expect(screen.getByTestId('proposal-cancel')).toBeInTheDocument()
    } else {
      expect(screen.queryByTestId('proposal-apply')).not.toBeInTheDocument()
      expect(screen.queryByTestId('proposal-cancel')).not.toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// R3 (UI-SEAMLESSNESS-REVIEW) — target badge click-to-focus.
//
// ProposalBlock.changes[].target is a bare string (no id, no kind), so it
// resolves against the canvas via the RATIFIED string-target rule:
// exact node/edge id match, else UNIQUE exact node-label match (trimmed,
// case-sensitive), else the badge stays today's inert <span>. Resolution
// happens at render time (labels drift while proposals sit on screen).
// Uses the REAL focusHelpers singleton with registered spies.
// ---------------------------------------------------------------------------

import { registerFocusHelpers } from '../../utils/focusHelpers'
import { useCanvasStore } from '../../store'

describe('ProposalBlockRenderer — target badge click-to-focus (R3)', () => {
  const focusNode = vi.fn()
  const focusEdge = vi.fn()
  let unregister: () => void

  beforeEach(() => {
    focusNode.mockClear()
    focusEdge.mockClear()
    unregister = registerFocusHelpers(focusNode, focusEdge)
    useCanvasStore.setState({
      nodes: [
        { id: 'node_reg_risk', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Regulatory Risk' } } as any,
        { id: 'node_other', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Something Else' } } as any,
      ],
      edges: [{ id: 'e7', source: 'node_reg_risk', target: 'node_other' } as any],
    })
  })

  afterEach(() => {
    unregister()
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  function renderProposal(target: string) {
    const block = makeProposal({
      changes: [{ operation: 'add', target, detail: 'Change detail' }],
    })
    render(<InlineBlocks blocks={[block as unknown as ConversationBlock]} />)
  }

  it('exact node-id target renders a clickable badge; click focuses the node', () => {
    renderProposal('node_reg_risk')
    const btn = screen.getByRole('button', { name: /highlight node_reg_risk on the canvas/i })
    fireEvent.click(btn)
    expect(focusNode).toHaveBeenCalledWith('node_reg_risk')
  })

  it('exact edge-id target focuses the edge', () => {
    renderProposal('e7')
    fireEvent.click(screen.getByRole('button', { name: /highlight e7 on the canvas/i }))
    expect(focusEdge).toHaveBeenCalledWith('e7')
  })

  it('UNIQUE exact label match resolves to the labelled node', () => {
    renderProposal('Regulatory Risk')
    fireEvent.click(screen.getByRole('button', { name: /highlight regulatory risk on the canvas/i }))
    expect(focusNode).toHaveBeenCalledWith('node_reg_risk')
  })

  it('label matching is trimmed: surrounding whitespace on the target still resolves', () => {
    renderProposal('  Regulatory Risk  ')
    fireEvent.click(screen.getByRole('button'))
    expect(focusNode).toHaveBeenCalledWith('node_reg_risk')
  })

  it('label matching is case-sensitive: a case-mismatched target stays an inert span', () => {
    renderProposal('regulatory risk')
    expect(screen.queryByRole('button', { name: /highlight/i })).not.toBeInTheDocument()
    expect(screen.getByText('regulatory risk')).toBeInTheDocument()
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('AMBIGUOUS label (two nodes share it) stays an inert span — no guessing', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'node_reg_risk', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Regulatory Risk' } } as any,
        { id: 'node_dupe', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Regulatory Risk' } } as any,
      ],
      edges: [],
    })
    renderProposal('Regulatory Risk')
    expect(screen.queryByRole('button', { name: /highlight/i })).not.toBeInTheDocument()
    expect(screen.getByText('Regulatory Risk')).toBeInTheDocument()
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('unresolvable target stays an inert span with the copy verbatim', () => {
    renderProposal('Ghost Target')
    expect(screen.queryByRole('button', { name: /highlight/i })).not.toBeInTheDocument()
    expect(screen.getByText('Ghost Target')).toBeInTheDocument()
  })

  it('resolution is render-time: renaming the node away de-links the badge', () => {
    const block = makeProposal({
      changes: [{ operation: 'add', target: 'Regulatory Risk', detail: 'Change detail' }],
    })
    const { rerender } = render(
      <InlineBlocks blocks={[block as unknown as ConversationBlock]} />,
    )
    expect(screen.getByRole('button', { name: /highlight regulatory risk/i })).toBeInTheDocument()
    useCanvasStore.setState({
      nodes: [
        { id: 'node_reg_risk', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Renamed Risk' } } as any,
      ],
      edges: [],
    })
    rerender(<InlineBlocks blocks={[block as unknown as ConversationBlock]} />)
    expect(screen.queryByRole('button', { name: /highlight regulatory risk/i })).not.toBeInTheDocument()
    expect(screen.getByText('Regulatory Risk')).toBeInTheDocument()
  })
})

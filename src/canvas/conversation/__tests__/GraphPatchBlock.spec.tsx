/**
 * Tests for GraphPatchBlock rendering in InlineBlocks
 *
 * Verifies:
 * - Renders with summary text, Accept, and Dismiss buttons
 * - Accept calls onPatchAccept
 * - Dismiss calls onPatchDismiss
 * - Buttons disabled after state transition from 'proposed'
 * - Block shows "Applied", "Rejected", "Dismissed" status labels
 * - Rejection info displays inline
 * - Respects DS v2.1 tokens (CSS variables, not raw Tailwind)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { GraphPatchBlock } from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'

const storeMocks = vi.hoisted(() => ({
  mockSelectNodeWithoutHistory: vi.fn(),
  mockSelectNodes: vi.fn(),
  mockSetShowInspectorPanel: vi.fn(),
  mockSetHighlightedNodes: vi.fn(),
  mockSetHighlightedEdges: vi.fn(),
}))

vi.mock('../../store', () => {
  const mockState = {
    selectNodeWithoutHistory: storeMocks.mockSelectNodeWithoutHistory,
    selectNodes: storeMocks.mockSelectNodes,
    setShowInspectorPanel: storeMocks.mockSetShowInspectorPanel,
    setHighlightedNodes: storeMocks.mockSetHighlightedNodes,
    setHighlightedEdges: storeMocks.mockSetHighlightedEdges,
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: any) => any) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatchBlock(overrides?: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-1',
    summary: "Add 'competitor response' as a risk factor",
    operations: [
      { op: 'add_node', target_id: 'n-new', data: { type: 'risk', label: 'Competitor response' } },
    ],
    target_graph_hash: 'abc123',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphPatchBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with summary text, Accept, and Dismiss buttons', () => {
    const block = makePatchBlock()
    render(
      <InlineBlocks blocks={[block]} />,
    )

    expect(screen.getByText("Add 'competitor response' as a risk factor")).toBeInTheDocument()
    expect(screen.getByText('Review suggested changes')).toBeInTheDocument()
    expect(screen.getByText('1 risk')).toBeInTheDocument()
    expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
  })

  it('renders proposal review rows when proposal items are present', () => {
    const block = makePatchBlock({
      proposal_items: [
        { description: 'Add competitor response as a tracked risk', changeLabel: 'Add node', elementLabel: 'Competitor response' },
      ],
      proposal_items_source: 'backend',
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByTestId('patch-proposal-list')).toBeInTheDocument()
    expect(screen.getByText('Add competitor response as a tracked risk')).toBeInTheDocument()
    expect(screen.getByText('Add node')).toBeInTheDocument()
    expect(screen.getByText('Competitor response')).toBeInTheDocument()
    expect(screen.getByText('Apply')).toBeInTheDocument()
    expect(screen.getByText('Not what I meant')).toBeInTheDocument()
  })

  it('keeps op-derived proposal details behind disclosure by default', () => {
    const block = makePatchBlock({
      proposal_items: [
        { description: 'Add competitor response', changeLabel: 'Add node', elementLabel: 'Competitor response' },
      ],
      proposal_items_source: 'derived_ops',
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.queryByTestId('patch-proposal-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('patch-proposal-details-toggle')).toHaveTextContent('Show details')

    fireEvent.click(screen.getByTestId('patch-proposal-details-toggle'))

    expect(screen.getByTestId('patch-proposal-list')).toBeInTheDocument()
    expect(screen.getByText('Add competitor response')).toBeInTheDocument()
  })

  it('uses generic action labels when derived_ops items are hidden behind disclosure', () => {
    const block = makePatchBlock({
      proposal_items: [
        { description: 'Add competitor response', changeLabel: 'Add node', elementLabel: 'Competitor response' },
      ],
      proposal_items_source: 'derived_ops',
    })
    render(<InlineBlocks blocks={[block]} />)

    // Items hidden → should use generic Accept/Dismiss labels, not Apply/Not what I meant
    expect(screen.getByTestId('patch-accept')).toHaveTextContent('Accept')
    expect(screen.getByTestId('patch-dismiss')).toHaveTextContent('Dismiss')
  })

  it('keeps applied change details behind disclosure even when proposal items are present', () => {
    const block = makePatchBlock({
      auto_apply: true,
      proposal_items: [
        { description: 'Added competitor response as a tracked risk', changeLabel: 'Add node', elementLabel: 'Competitor response' },
      ],
      proposal_items_source: 'backend',
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('Changes applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-proposal-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('patch-proposal-details-toggle')).toBeInTheDocument()
  })

  it('calls onPatchAccept when Accept is clicked', () => {
    const block = makePatchBlock()
    const onAccept = vi.fn()
    render(
      <InlineBlocks blocks={[block]} onPatchAccept={onAccept} />,
    )

    fireEvent.click(screen.getByTestId('patch-accept'))
    expect(onAccept).toHaveBeenCalledWith('patch-1', block)
  })

  it('calls onPatchDismiss when Dismiss is clicked', () => {
    const block = makePatchBlock()
    const onDismiss = vi.fn()
    render(
      <InlineBlocks blocks={[block]} onPatchDismiss={onDismiss} />,
    )

    fireEvent.click(screen.getByTestId('patch-dismiss'))
    expect(onDismiss).toHaveBeenCalledWith('patch-1')
  })

  it('shows "Applied" status and hides buttons when accepted', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    expect(screen.getByTestId('patch-status-applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
    expect(screen.getByTestId('patch-show-changes')).toBeInTheDocument()
    expect(screen.getByText('Changes applied')).toBeInTheDocument()
  })

  it('renders accepted receipt when backend marks the patch accepted', () => {
    const block = makePatchBlock({ status: 'accepted' })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByTestId('patch-status-applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.getByText('Changes applied')).toBeInTheDocument()
  })

  it('reveals applied node changes using existing canvas focus/highlight hooks', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    fireEvent.click(screen.getByTestId('patch-show-changes'))

    expect(storeMocks.mockSelectNodeWithoutHistory).toHaveBeenCalledWith('n-new')
    expect(storeMocks.mockSetShowInspectorPanel).toHaveBeenCalledWith(true)
    expect(storeMocks.mockSetHighlightedNodes).toHaveBeenCalledWith(['n-new'])
  })

  it('cancels prior highlight reset timers when show changes is triggered repeatedly', () => {
    vi.useFakeTimers()

    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    fireEvent.click(screen.getByTestId('patch-show-changes'))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.click(screen.getByTestId('patch-show-changes'))
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(storeMocks.mockSetHighlightedNodes).not.toHaveBeenCalledWith([])

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(storeMocks.mockSetHighlightedNodes).toHaveBeenCalledWith([])
    vi.useRealTimers()
  })

  it('clears pending highlight reset timers on unmount', () => {
    vi.useFakeTimers()

    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    const { unmount } = render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    fireEvent.click(screen.getByTestId('patch-show-changes'))
    unmount()
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(storeMocks.mockSetHighlightedNodes).not.toHaveBeenCalledWith([])
    vi.useRealTimers()
  })

  it('shows "Dismissed" status and hides buttons when dismissed', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'dismissed']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    expect(screen.getByTestId('patch-status-dismissed')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
  })

  it('shows rejection info inline when rejected', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'rejected']])
    const rejections = new Map<string, PatchRejectionInfo>([
      ['patch-1', {
        code: 'INVALID_NODE',
        message: 'Node type not supported',
        violations: ['Missing label field', 'Invalid edge weight'],
      }],
    ])
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={states}
        patchRejections={rejections}
      />,
    )

    expect(screen.getByTestId('patch-status-rejected')).toBeInTheDocument()
    expect(screen.getByText(/INVALID_NODE/)).toBeInTheDocument()
    expect(screen.getByText(/Node type not supported/)).toBeInTheDocument()
    expect(screen.getByText('Missing label field')).toBeInTheDocument()
  })

  it('shows "Show more" toggle for multiple violations', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'rejected']])
    const rejections = new Map<string, PatchRejectionInfo>([
      ['patch-1', {
        code: 'MULTI_VIOLATION',
        message: 'Multiple issues found',
        violations: ['Violation 1', 'Violation 2', 'Violation 3'],
      }],
    ])
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={states}
        patchRejections={rejections}
      />,
    )

    // First violation visible
    expect(screen.getByText('Violation 1')).toBeInTheDocument()
    // Toggle should show
    expect(screen.getByText('Show 2 more')).toBeInTheDocument()
  })

  it('renders multiple operations count', () => {
    const block = makePatchBlock({
      operations: [
        { op: 'add_node', target_id: 'n1', data: {} },
        { op: 'add_edge', target_id: 'e1', data: { source: 'n1', target: 'n2' } },
        { op: 'update_node', target_id: 'n2', data: { label: 'Updated' } },
      ],
    })
    render(
      <InlineBlocks blocks={[block]} />,
    )

    expect(screen.getByText('2 nodes, 1 edge')).toBeInTheDocument()
  })

  it('falls back to op-summary as primary text when block summary is empty', () => {
    const block = makePatchBlock({
      summary: '',
      operations: [
        { op: 'add_node', target_id: 'n1', data: { kind: 'factor', label: 'Revenue' } },
        { op: 'add_node', target_id: 'n2', data: { kind: 'factor', label: 'Churn' } },
        { op: 'add_node', target_id: 'n3', data: { kind: 'option', label: 'Option A' } },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)

    // Op summary should appear as the primary text (since summary is empty)
    expect(screen.getByText('2 factors, 1 option')).toBeInTheDocument()
  })

  it('shows retry button on network error (block stays proposed)', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'proposed']])
    const rejections = new Map<string, PatchRejectionInfo>([
      ['patch-1', { code: 'NETWORK_ERROR', message: 'Failed to apply — try again' }],
    ])
    const onAccept = vi.fn()
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={states}
        patchRejections={rejections}
        onPatchAccept={onAccept}
      />,
    )

    expect(screen.getByTestId('patch-retry-error')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try again'))
    expect(onAccept).toHaveBeenCalledWith('patch-1', block)
  })
})

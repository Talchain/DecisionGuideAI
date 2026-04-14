/**
 * Tests for GraphPatchBlock rendering in InlineBlocks
 *
 * Verifies:
 * - Renders with summary text, Accept, and Dismiss buttons
 * - Accept calls onPatchAccept
 * - Dismiss calls onPatchDismiss
 * - Buttons disabled after state transition from 'proposed'
 * - Block shows state-derived status labels (via getPatchCardLabels)
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
  // Canvas node list — set per test by assigning an array of { id } objects
  canvasNodes: [] as Array<{ id: string }>,
}))

vi.mock('../../store', () => {
  const mockState = {
    get nodes() { return storeMocks.canvasNodes },
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

// Helper: build a canvas node list from IDs
function canvasNodes(...ids: string[]): Array<{ id: string }> {
  return ids.map(id => ({ id }))
}

describe('GraphPatchBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.canvasNodes = []
  })

  it('renders with summary text, Accept, and Dismiss buttons', () => {
    const block = makePatchBlock()
    render(
      <InlineBlocks blocks={[block]} />,
    )

    // Block shows CEE's semantic summary (block.summary) when present —
    // coaching-grade language wins over the count-based opSummary fallback.
    expect(screen.getByText("Add 'competitor response' as a risk factor")).toBeInTheDocument()
    expect(screen.getByText('Suggested change')).toBeInTheDocument()
    expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
  })

  it('proposed state: header "Suggested change", no badge, Accept/Dismiss visible, summary shows CEE text', () => {
    const block = makePatchBlock({ summary: 'This adds a market risk factor to your model.' })
    render(<InlineBlocks blocks={[block]} />)

    // Header derived from proposed state
    expect(screen.getByText('Suggested change')).toBeInTheDocument()
    // No status badge (no patch-status-* testid rendered)
    expect(screen.queryByTestId('patch-status-applied')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-status-auto-applied')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-status-rejected')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-status-dismissed')).not.toBeInTheDocument()
    // Accept/Dismiss buttons visible
    expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
    // Summary shows CEE text
    expect(screen.getByText('This adds a market risk factor to your model.')).toBeInTheDocument()
  })

  it('proposed state: contextual fallback when CEE summary is empty', () => {
    const block = makePatchBlock({ summary: '' })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('Suggested change')).toBeInTheDocument()
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

    expect(screen.getAllByText('Model updated').length).toBeGreaterThanOrEqual(1)
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

  it('shows "Change accepted" status and hides buttons when accepted', () => {
    // n-new is the target; provide enough canvas nodes so coverage < 80%
    storeMocks.canvasNodes = canvasNodes('n-new', 'n-existing-1', 'n-existing-2', 'n-existing-3')
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    expect(screen.getByTestId('patch-status-applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
    expect(screen.getByTestId('patch-show-changes')).toBeInTheDocument()
    expect(screen.getAllByText('Change accepted').length).toBeGreaterThanOrEqual(1)
  })

  it('renders accepted receipt when backend marks the patch accepted', () => {
    const block = makePatchBlock({ status: 'accepted' })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByTestId('patch-status-applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.getAllByText('Change accepted').length).toBeGreaterThanOrEqual(1)
  })

  it('reveals applied node changes using existing canvas focus/highlight hooks', () => {
    storeMocks.canvasNodes = canvasNodes('n-new', 'n-existing-1', 'n-existing-2', 'n-existing-3')
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
    storeMocks.canvasNodes = canvasNodes('n-new', 'n-existing-1', 'n-existing-2', 'n-existing-3')
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
    storeMocks.canvasNodes = canvasNodes('n-new', 'n-existing-1', 'n-existing-2', 'n-existing-3')
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

  it('uses contextual fallback for empty summary — incremental patch', () => {
    const block = makePatchBlock({
      summary: '',
      operations: [
        { op: 'add_node', target_id: 'n1', data: {} },
        { op: 'add_edge', target_id: 'e1', data: { source: 'n1', target: 'n2' } },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)

    // Contextual fallback, never count-based
    expect(screen.getByText('Review the suggested change.')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ node/)).not.toBeInTheDocument()
  })

  it('uses full_draft fallback for empty summary on full_draft patch', () => {
    const block = makePatchBlock({
      summary: '',
      patch_type: 'full_draft',
      auto_apply: true,
      operations: [
        { op: 'add_node', target_id: 'n1', data: { kind: 'factor', label: 'Revenue' } },
        { op: 'add_node', target_id: 'n2', data: { kind: 'factor', label: 'Churn' } },
        { op: 'add_node', target_id: 'n3', data: { kind: 'option', label: 'Option A' } },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('Review the proposed model.')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ factors?/)).not.toBeInTheDocument()
  })

  it('prefers CEE summary over contextual fallback when both are possible', () => {
    const block = makePatchBlock({
      summary: 'Restructured the model around customer churn',
      operations: [
        { op: 'add_node', target_id: 'n1', data: { kind: 'factor', label: 'Churn' } },
        { op: 'add_edge', target_id: 'e1', data: { source: 'n1', target: 'n2' } },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('Restructured the model around customer churn')).toBeInTheDocument()
    // Neither count-based nor contextual fallback should appear
    expect(screen.queryByText('Review the suggested change.')).not.toBeInTheDocument()
  })

  it('shows contextual fallback when CEE summary is empty (never shows counts)', () => {
    const block = makePatchBlock({
      summary: '',
      operations: [],
    })
    render(<InlineBlocks blocks={[block]} />)

    // Header still renders.
    expect(screen.getByText('Suggested change')).toBeInTheDocument()
    // Contextual fallback shown instead of count-based summary
    expect(screen.getByText('Review the suggested change.')).toBeInTheDocument()
    // No count-based noise
    expect(screen.queryByText(/0 operations/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ factors?/)).not.toBeInTheDocument()
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

// ---------------------------------------------------------------------------
// Show on graph — full-graph suppression (Task 2)
// ---------------------------------------------------------------------------

describe('Show on graph — full-graph suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.canvasNodes = []
  })

  it('hides Show on graph when target set covers ≥80% of canvas nodes (only counting in-graph IDs)', () => {
    // Canvas has n1..n5; patch updates all 5 → 100% → hide
    storeMocks.canvasNodes = canvasNodes('n1', 'n2', 'n3', 'n4', 'n5')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'update_node', target_id: 'n1', data: {} },
        { op: 'update_node', target_id: 'n2', data: {} },
        { op: 'update_node', target_id: 'n3', data: {} },
        { op: 'update_node', target_id: 'n4', data: {} },
        { op: 'update_node', target_id: 'n5', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    expect(screen.queryByTestId('patch-show-changes')).not.toBeInTheDocument()
  })

  it('shows Show on graph when target set is a meaningful in-graph subset (<80%)', () => {
    // Canvas has 10 nodes; patch updates 2 known nodes → 20% → show
    storeMocks.canvasNodes = canvasNodes('n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'update_node', target_id: 'n1', data: {} },
        { op: 'update_node', target_id: 'n2', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    expect(screen.getByTestId('patch-show-changes')).toBeInTheDocument()
  })

  it('hides Show on graph when exactly 80% of canvas nodes are targeted', () => {
    // Canvas has 5 nodes; patch targets 4 known nodes → 80% boundary → hide
    storeMocks.canvasNodes = canvasNodes('n1', 'n2', 'n3', 'n4', 'n5')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'update_node', target_id: 'n1', data: {} },
        { op: 'update_node', target_id: 'n2', data: {} },
        { op: 'update_node', target_id: 'n3', data: {} },
        { op: 'update_node', target_id: 'n4', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    expect(screen.queryByTestId('patch-show-changes')).not.toBeInTheDocument()
  })

  it('stale IDs (not on canvas) are not counted toward coverage, keeping subset visible', () => {
    // Canvas has n1..n10; patch references n1 + stale-id that no longer exists → 10% → show
    storeMocks.canvasNodes = canvasNodes('n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'update_node', target_id: 'n1', data: {} },
        { op: 'update_node', target_id: 'stale-deleted-id', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    // Only n1 is valid; 1/10 = 10% → show
    expect(screen.getByTestId('patch-show-changes')).toBeInTheDocument()
  })

  it('hides Show on graph for generative draft (auto_apply with ≥3 add_node ops as majority)', () => {
    // Initial draft: 4 add_node, 1 add_edge → 4/5 ops are add_node → generative draft → hide
    storeMocks.canvasNodes = canvasNodes('n1', 'n2', 'n3', 'n4')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'add_node', target_id: 'n1', data: {} },
        { op: 'add_node', target_id: 'n2', data: {} },
        { op: 'add_node', target_id: 'n3', data: {} },
        { op: 'add_node', target_id: 'n4', data: {} },
        { op: 'add_edge', target_id: 'e1', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    expect(screen.queryByTestId('patch-show-changes')).not.toBeInTheDocument()
  })

  it('shows Show on graph for a non-draft auto_apply edit (update ops, not add_node majority)', () => {
    // Auto-applied edit that updates 2 out of 10 nodes → not a draft → show
    storeMocks.canvasNodes = canvasNodes('n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'update_node', target_id: 'n1', data: {} },
        { op: 'update_node', target_id: 'n2', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    expect(screen.getByTestId('patch-show-changes')).toBeInTheDocument()
  })

  it('highlights only the subset nodes (deduped, in-graph) when Show on graph is clicked', () => {
    storeMocks.canvasNodes = canvasNodes('node-a', 'node-b', 'node-c', 'node-d', 'node-e',
      'node-f', 'node-g', 'node-h', 'node-i', 'node-j')
    const block = makePatchBlock({
      auto_apply: true,
      operations: [
        { op: 'update_node', target_id: 'node-a', data: {} },
        { op: 'update_node', target_id: 'node-b', data: {} },
        // Duplicate — must not appear twice in highlight call
        { op: 'update_node', target_id: 'node-a', data: {} },
      ],
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)
    fireEvent.click(screen.getByTestId('patch-show-changes'))
    expect(storeMocks.mockSetHighlightedNodes).toHaveBeenCalledWith(['node-a', 'node-b'])
  })
})

// ---------------------------------------------------------------------------
// Render matrix: all 6 patch states → header text, badge icon, badge colour
// ---------------------------------------------------------------------------

describe('GraphPatchBlock — render matrix (all states)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.canvasNodes = canvasNodes('n-new', 'n-x1', 'n-x2', 'n-x3')
  })

  it.each([
    {
      name: 'proposed',
      overrides: {},
      stateMap: undefined as Map<string, PatchBlockState> | undefined,
      rejections: undefined as Map<string, PatchRejectionInfo> | undefined,
      expectedHeader: 'Suggested change',
      expectedBadgeTestId: null,
      expectedBadgeIcon: null,
      expectedBadgeColour: null,
      buttonsVisible: true,
    },
    {
      name: 'accepted (user click)',
      overrides: {},
      stateMap: new Map([['patch-1', 'accepted' as PatchBlockState]]),
      rejections: undefined,
      expectedHeader: 'Change accepted',
      expectedBadgeTestId: 'patch-status-applied',
      expectedBadgeIcon: 'lucide-check',
      expectedBadgeColour: 'text-success',
      buttonsVisible: false,
    },
    {
      name: 'auto_applied',
      overrides: { auto_apply: true },
      stateMap: undefined,
      rejections: undefined,
      expectedHeader: 'Model updated',
      expectedBadgeTestId: 'patch-status-auto-applied',
      expectedBadgeIcon: 'lucide-check',
      expectedBadgeColour: 'text-success',
      buttonsVisible: false,
    },
    {
      name: 'rejected',
      overrides: {},
      stateMap: new Map([['patch-1', 'rejected' as PatchBlockState]]),
      rejections: new Map([['patch-1', { code: 'VALIDATION_FAILED', message: 'Bad patch' }]]),
      expectedHeader: 'Change rejected',
      expectedBadgeTestId: 'patch-status-rejected',
      expectedBadgeIcon: 'lucide-x',
      expectedBadgeColour: 'text-danger',
      buttonsVisible: false,
    },
    {
      name: 'dismissed',
      overrides: {},
      stateMap: new Map([['patch-1', 'dismissed' as PatchBlockState]]),
      rejections: undefined,
      expectedHeader: 'Change dismissed',
      expectedBadgeTestId: 'patch-status-dismissed',
      expectedBadgeIcon: null,
      expectedBadgeColour: null,
      buttonsVisible: false,
    },
    {
      name: 'error (NETWORK_ERROR)',
      overrides: {},
      stateMap: new Map([['patch-1', 'proposed' as PatchBlockState]]),
      rejections: new Map([['patch-1', { code: 'NETWORK_ERROR', message: 'Failed to apply' }]]),
      expectedHeader: 'Something went wrong',
      expectedBadgeTestId: 'patch-retry-error',
      expectedBadgeIcon: 'lucide-alert-triangle',
      expectedBadgeColour: 'text-danger',
      buttonsVisible: false,
    },
  ])('$name: header="$expectedHeader", icon=$expectedBadgeIcon, colour=$expectedBadgeColour', ({
    overrides,
    stateMap,
    rejections,
    expectedHeader,
    expectedBadgeTestId,
    expectedBadgeIcon,
    expectedBadgeColour,
    buttonsVisible,
  }) => {
    const block = makePatchBlock(overrides)
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={stateMap}
        patchRejections={rejections}
      />,
    )

    // Header text appears (may appear in both header span and status area)
    expect(screen.getAllByText(expectedHeader).length).toBeGreaterThanOrEqual(1)

    // Badge icon + colour
    if (expectedBadgeTestId && expectedBadgeIcon) {
      const statusEl = screen.getByTestId(expectedBadgeTestId)
      const svg = statusEl.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg!.classList.contains(expectedBadgeIcon)).toBe(true)
      if (expectedBadgeColour) {
        expect(svg!.classList.contains(expectedBadgeColour)).toBe(true)
      }
    }

    // Accept/Dismiss buttons
    if (buttonsVisible) {
      expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
      expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
    } else {
      expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
      expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// Tense cleanup: defensive "Proposing to " prefix stripping on accepted cards
// ---------------------------------------------------------------------------

describe('GraphPatchBlock — tense cleanup on accepted cards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.canvasNodes = canvasNodes('n-new', 'n-x1', 'n-x2', 'n-x3')
  })

  it('strips leading "Proposing to " from block.summary when card is accepted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const block = makePatchBlock({ summary: 'Proposing to update Existing Team Seniority' })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)

    expect(screen.getByText('update Existing Team Seniority')).toBeInTheDocument()
    expect(screen.queryByText(/^Proposing to /)).not.toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith('[UI-TENSE] Stripped proposal prefix on accepted card')
    warnSpy.mockRestore()
  })

  it('strips leading "Proposing to " from proposal_items[].description when accepted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const block = makePatchBlock({
      summary: 'Updated factor',
      proposal_items: [
        { description: 'Proposing to update Existing Team Seniority', changeLabel: 'Update', elementLabel: 'Existing Team Seniority' },
      ],
      proposal_items_source: 'backend',
    })
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(<InlineBlocks blocks={[block]} patchBlockStates={states} />)

    fireEvent.click(screen.getByTestId('patch-proposal-details-toggle'))
    expect(screen.getByText('update Existing Team Seniority')).toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith('[UI-TENSE] Stripped proposal prefix on accepted card')
    warnSpy.mockRestore()
  })

  it('preserves "Proposing to " prefix when card is still proposed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const block = makePatchBlock({ summary: 'Proposing to update Existing Team Seniority' })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('Proposing to update Existing Team Seniority')).toBeInTheDocument()
    expect(warnSpy).not.toHaveBeenCalledWith('[UI-TENSE] Stripped proposal prefix on accepted card')
    warnSpy.mockRestore()
  })

  it('strips prefix on auto_applied cards as well', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const block = makePatchBlock({
      summary: 'Proposing to update Existing Team Seniority',
      auto_apply: true,
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('update Existing Team Seniority')).toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith('[UI-TENSE] Stripped proposal prefix on accepted card')
    warnSpy.mockRestore()
  })
})

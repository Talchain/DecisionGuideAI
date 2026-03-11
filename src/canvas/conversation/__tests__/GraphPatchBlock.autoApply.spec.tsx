/**
 * Tests for GraphPatchBlock auto_apply flag and custom actions[] in InlineBlocks
 *
 * Verifies:
 * - auto_apply=true renders as applied immediately, no Accept/Dismiss buttons
 * - auto_apply=false (default) renders proposed with actions
 * - actions[] present → CEE-provided buttons rendered, correct callbacks fired
 * - actions[] absent → default Accept/Dismiss (backward compat)
 * - State machine authority: settled state disables buttons even with actions[]
 * - patch_accepted payload includes operations[]
 * - patch_dismissed payload includes block_id (patch_id)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { GraphPatchBlock, BlockAction } from '../types'
import type { PatchBlockState } from '../useConversation'

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

function makePatchBlock(overrides?: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-auto',
    summary: 'Add market factor',
    operations: [
      { op: 'add_node', target_id: 'n-new', data: { type: 'factor', label: 'Market size' } },
    ],
    target_graph_hash: 'h1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// auto_apply
// ---------------------------------------------------------------------------

describe('GraphPatchBlock — auto_apply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders as applied immediately when auto_apply=true (no Accept/Dismiss buttons)', () => {
    render(<InlineBlocks blocks={[makePatchBlock({ auto_apply: true })]} />)

    expect(screen.getByTestId('patch-status-auto-applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
    expect(screen.getByTestId('patch-show-changes')).toBeInTheDocument()
  })

  it('reveals auto-applied changes on canvas', () => {
    render(<InlineBlocks blocks={[makePatchBlock({ auto_apply: true })]} />)

    fireEvent.click(screen.getByTestId('patch-show-changes'))

    expect(storeMocks.mockSelectNodeWithoutHistory).toHaveBeenCalledWith('n-new')
    expect(storeMocks.mockSetShowInspectorPanel).toHaveBeenCalledWith(true)
    expect(storeMocks.mockSetHighlightedNodes).toHaveBeenCalledWith(['n-new'])
  })

  it('renders Accept/Dismiss when auto_apply=false', () => {
    render(<InlineBlocks blocks={[makePatchBlock({ auto_apply: false })]} />)

    expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-status-auto-applied')).not.toBeInTheDocument()
  })

  it('renders Accept/Dismiss when auto_apply is absent (backward compat)', () => {
    render(<InlineBlocks blocks={[makePatchBlock({ auto_apply: undefined })]} />)

    expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Custom actions[]
// ---------------------------------------------------------------------------

describe('GraphPatchBlock — custom actions[]', () => {
  const customActions: BlockAction[] = [
    { action_type: 'accept', label: 'Apply changes', variant: 'primary' },
    { action_type: 'dismiss', label: 'Skip this', variant: 'secondary' },
  ]

  it('renders CEE-provided action buttons when actions[] present', () => {
    render(<InlineBlocks blocks={[makePatchBlock({ actions: customActions })]} />)

    expect(screen.getByText('Apply changes')).toBeInTheDocument()
    expect(screen.getByText('Skip this')).toBeInTheDocument()
    // Default buttons should NOT appear
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
  })

  it('calls onPatchAccept when action_type=accept is clicked', () => {
    const onAccept = vi.fn()
    const block = makePatchBlock({ actions: customActions })
    render(<InlineBlocks blocks={[block]} onPatchAccept={onAccept} />)

    fireEvent.click(screen.getByTestId('patch-action-accept'))
    expect(onAccept).toHaveBeenCalledWith('patch-auto', block)
  })

  it('calls onPatchDismiss when action_type=dismiss is clicked', () => {
    const onDismiss = vi.fn()
    render(<InlineBlocks blocks={[makePatchBlock({ actions: customActions })]} onPatchDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId('patch-action-dismiss'))
    expect(onDismiss).toHaveBeenCalledWith('patch-auto')
  })

  it('uses default Accept/Dismiss when actions[] absent', () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()
    const block = makePatchBlock({ actions: undefined })
    render(
      <InlineBlocks
        blocks={[block]}
        onPatchAccept={onAccept}
        onPatchDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByTestId('patch-accept'))
    expect(onAccept).toHaveBeenCalledWith('patch-auto', block)

    fireEvent.click(screen.queryByTestId('patch-dismiss') as Element)
    expect(onDismiss).toHaveBeenCalledWith('patch-auto')
  })

  it('disables CEE action buttons after state transition (state machine authority)', () => {
    const states = new Map<string, PatchBlockState>([['patch-auto', 'accepted']])
    render(
      <InlineBlocks
        blocks={[makePatchBlock({ actions: customActions })]}
        patchBlockStates={states}
      />,
    )

    // Accepted state: action buttons not rendered (isSettled check)
    expect(screen.queryByText('Apply changes')).not.toBeInTheDocument()
    expect(screen.getByTestId('patch-status-applied')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Patch action dispatch payload tests (via onPatchAccept / onPatchDismiss)
// ---------------------------------------------------------------------------

describe('GraphPatchBlock — action dispatch payload', () => {
  it('onPatchAccept receives block with operations[] included', () => {
    const onAccept = vi.fn()
    const block = makePatchBlock()
    render(<InlineBlocks blocks={[block]} onPatchAccept={onAccept} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    expect(onAccept).toHaveBeenCalledTimes(1)
    const [calledPatchId, calledBlock] = onAccept.mock.calls[0]
    expect(calledPatchId).toBe('patch-auto')
    expect(calledBlock.operations).toHaveLength(1)
    expect(calledBlock.operations[0].op).toBe('add_node')
  })

  it('onPatchDismiss receives patch_id (block_id)', () => {
    const onDismiss = vi.fn()
    render(<InlineBlocks blocks={[makePatchBlock()]} onPatchDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId('patch-dismiss'))

    expect(onDismiss).toHaveBeenCalledWith('patch-auto')
  })
})

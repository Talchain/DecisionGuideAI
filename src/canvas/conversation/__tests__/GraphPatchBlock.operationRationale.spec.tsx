/**
 * Tests for OperationRationale rendering inside GraphPatchBlock
 *
 * Verifies:
 * - "More" chevron renders when an operation has a rationale via operation_meta[index]
 * - No chevron when operation_meta is absent or the entry has no rationale
 * - Clicking "More" expands to reveal the rationale text and changes the label to "Less"
 * - Rationale text uses panelMeta typography + text-text-light
 * - Expanded content uses DS v5 §19 border-left indent (border-l-2 border-panel-border)
 * - Each operation's rationale is paired by array index, not by op identity
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { GraphPatchBlock } from '../types'

const storeMocks = vi.hoisted(() => ({
  mockSelectNodeWithoutHistory: vi.fn(),
  mockSelectNodes: vi.fn(),
  mockSetShowInspectorPanel: vi.fn(),
  mockSetHighlightedNodes: vi.fn(),
  mockSetHighlightedEdges: vi.fn(),
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

function makePatchBlockWithRationales(
  operation_meta?: GraphPatchBlock['operation_meta'],
): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-rationale',
    summary: 'Multi-op edit',
    operations: [
      { op: 'add_node', target_id: 'fac_competitor', data: { type: 'risk', label: 'Competitor response' } },
      { op: 'update_node', target_id: 'fac_price', data: { value: 59 } },
    ],
    proposal_items: [
      { description: 'Add competitor response as a tracked risk', changeLabel: 'Add node', elementLabel: 'Competitor response' },
      { description: 'Update price to 59', changeLabel: 'Update', elementLabel: 'Price' },
    ],
    proposal_items_source: 'backend',
    target_graph_hash: 'abc123',
    ...(operation_meta !== undefined && { operation_meta }),
  }
}

describe('GraphPatchBlock — OperationRationale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.canvasNodes = []
  })

  it('renders the More chevron for each operation that has a rationale', () => {
    const block = makePatchBlockWithRationales([
      { impact: 'high', rationale: 'Competitor pricing pressure is the dominant driver in the brief.' },
      { impact: 'medium', rationale: 'Updating price to match the brief example.' },
    ])

    render(<InlineBlocks blocks={[block]} />)

    const moreButtons = screen.getAllByText('More')
    expect(moreButtons).toHaveLength(2)
  })

  it('renders no chevron when operation_meta is absent', () => {
    const block = makePatchBlockWithRationales(undefined)

    render(<InlineBlocks blocks={[block]} />)

    expect(screen.queryByText('More')).not.toBeInTheDocument()
    expect(screen.queryByText('Less')).not.toBeInTheDocument()
  })

  it('renders no chevron for an entry whose rationale is empty', () => {
    const block = makePatchBlockWithRationales([
      { impact: 'low', rationale: '' },
      { impact: 'low', rationale: '' },
    ])

    render(<InlineBlocks blocks={[block]} />)

    expect(screen.queryByText('More')).not.toBeInTheDocument()
  })

  it('renders the chevron only on the operation index that has a rationale', () => {
    // First op has rationale, second does not
    const block = makePatchBlockWithRationales([
      { impact: 'high', rationale: 'Only the first op has reasoning attached.' },
      { impact: 'low', rationale: '' },
    ])

    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getAllByText('More')).toHaveLength(1)
  })

  it('expands to reveal the rationale text and switches the label to Less', () => {
    const rationaleText = 'Competitor pricing pressure is the dominant driver in the brief.'
    const block = makePatchBlockWithRationales([
      { impact: 'high', rationale: rationaleText },
      { impact: 'medium', rationale: 'Updating price to match the brief example.' },
    ])

    render(<InlineBlocks blocks={[block]} />)

    // Collapsed state — rationale text not visible
    expect(screen.queryByText(rationaleText)).not.toBeInTheDocument()

    const firstMore = screen.getAllByText('More')[0]
    fireEvent.click(firstMore)

    // Expanded — rationale text visible, label flipped to "Less"
    expect(screen.getByText(rationaleText)).toBeInTheDocument()
    // The other (untouched) entry still says More
    expect(screen.getAllByText('More')).toHaveLength(1)
    expect(screen.getAllByText('Less')).toHaveLength(1)
  })

  it('collapses again when Less is clicked', () => {
    const rationaleText = 'Single rationale for the only operation that needs explaining.'
    const block = makePatchBlockWithRationales([
      { impact: 'high', rationale: rationaleText },
      { impact: 'low', rationale: '' },
    ])

    render(<InlineBlocks blocks={[block]} />)

    fireEvent.click(screen.getByText('More'))
    expect(screen.getByText(rationaleText)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Less'))
    expect(screen.queryByText(rationaleText)).not.toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('uses panelMeta + text-text-light typography on the expanded rationale text', () => {
    const rationaleText = 'Typography compliance check.'
    const block = makePatchBlockWithRationales([
      { impact: 'high', rationale: rationaleText },
      { impact: 'low', rationale: '' },
    ])

    render(<InlineBlocks blocks={[block]} />)
    fireEvent.click(screen.getByText('More'))

    const para = screen.getByText(rationaleText)
    expect(para.tagName).toBe('P')
    // panelMeta token resolves at runtime; assert the text-text-light token is present
    // and that the parent block carries the DS v5 §19 indent classes.
    expect(para.className).toContain('text-text-light')
    const indent = para.parentElement
    expect(indent).not.toBeNull()
    expect(indent!.className).toContain('border-l-2')
    expect(indent!.className).toContain('border-panel-border')
    expect(indent!.className).toContain('pl-3')
    expect(indent!.className).toContain('mt-2')
  })
})

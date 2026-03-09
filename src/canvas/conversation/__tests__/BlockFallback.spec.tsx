/**
 * Tests for InlineBlocks unknown block type fallback
 *
 * Verifies:
 * - Unknown block_type renders nothing visible (suppressed)
 * - Known blocks still render normally alongside unknown ones
 * - Block budget "Show more" toggle works with 5 blocks
 * - graph_patch with proposed status appears in first 4 visible slots
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { ConversationBlock, GraphPatchBlock } from '../types'
import type { PatchBlockState } from '../useConversation'

describe('InlineBlocks — unknown block type fallback', () => {
  it('renders nothing visible for unknown block_type, does not throw', () => {
    const unknownBlock = { type: 'future_block_v99', some_field: 'value' } as unknown as ConversationBlock
    const { container } = render(<InlineBlocks blocks={[unknownBlock]} />)
    // Unknown blocks are suppressed — no visible content rendered
    expect(container.querySelector('[data-testid^="block-unknown"]')).toBeNull()
  })

  it('does not render "Unsupported block:" text for unknown types', () => {
    const unknownBlock = { type: 'super_fancy_block' } as unknown as ConversationBlock
    render(<InlineBlocks blocks={[unknownBlock]} />)
    expect(screen.queryByText(/Unsupported block/)).not.toBeInTheDocument()
  })

  it('known blocks still render alongside unknown blocks', () => {
    const blocks: ConversationBlock[] = [
      { type: 'commentary', text: 'Hello world' },
      { type: 'unknown_type_xyz' } as unknown as ConversationBlock,
    ]
    render(<InlineBlocks blocks={blocks} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    // Unknown block suppressed
    expect(screen.queryByText(/unknown_type_xyz/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Block budget: 5 blocks → 4 visible + "Show 1 more"
// ---------------------------------------------------------------------------

describe('InlineBlocks — block budget', () => {
  function makeCommentary(text: string): ConversationBlock {
    return { type: 'commentary', text }
  }

  function makePatchBlock(patch_id: string): GraphPatchBlock {
    return {
      type: 'graph_patch',
      patch_id,
      summary: `Patch ${patch_id}`,
      operations: [{ op: 'add_node', target_id: 'n1', data: {} }],
      target_graph_hash: 'h1',
    }
  }

  it('shows 4 blocks when 5 provided + "Show 1 more" toggle', () => {
    const blocks: ConversationBlock[] = [
      makeCommentary('Block 1'),
      makeCommentary('Block 2'),
      makeCommentary('Block 3'),
      makeCommentary('Block 4'),
      makeCommentary('Block 5'),
    ]
    render(<InlineBlocks blocks={blocks} />)

    expect(screen.getByText('Block 1')).toBeInTheDocument()
    expect(screen.getByText('Block 4')).toBeInTheDocument()
    expect(screen.queryByText('Block 5')).not.toBeInTheDocument()
    expect(screen.getByText('Show 1 more')).toBeInTheDocument()
  })

  it('shows all blocks after clicking "Show 1 more"', () => {
    const blocks: ConversationBlock[] = Array.from({ length: 5 }, (_, i) =>
      makeCommentary(`Block ${i + 1}`),
    )
    render(<InlineBlocks blocks={blocks} />)

    fireEvent.click(screen.getByText('Show 1 more'))

    expect(screen.getByText('Block 5')).toBeInTheDocument()
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('graph_patch with proposed status is first in array (priority visible)', () => {
    // Upstream (useConversation) pushes graph_patch blocks to front.
    // Test that graph_patch appears in position 0 when it arrives first.
    const patchBlock = makePatchBlock('p1')
    const blocks: ConversationBlock[] = [
      patchBlock, // first slot — always visible
      makeCommentary('C1'),
      makeCommentary('C2'),
      makeCommentary('C3'),
      makeCommentary('C4'),  // 5th block, would be hidden without patch taking priority
    ]

    render(<InlineBlocks blocks={blocks} />)

    // Patch block is visible (it's first)
    expect(screen.getByTestId('block-graph-patch-p1')).toBeInTheDocument()
    // First 3 commentary blocks visible (positions 1-3)
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('C3')).toBeInTheDocument()
    // 5th block (C4) hidden behind toggle
    expect(screen.queryByText('C4')).not.toBeInTheDocument()
    expect(screen.getByText('Show 1 more')).toBeInTheDocument()
  })
})

/**
 * Tests for InlineBlocks unknown block type fallback
 *
 * Verifies:
 * - Unknown block_type renders the honest fallback card (seamlessness R7 —
 *   silent suppression was retired; schema-skew must be visible)
 * - Known blocks still render normally alongside unknown ones
 * - Inline commentary is never demoted (PX-B composition ruling)
 * - The disclosure makes every demoted card reachable in one interaction
 * - graph_patch is pinned top-level by CLASS, even arriving last
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { ConversationBlock, GraphPatchBlock } from '../types'
import type { PatchBlockState } from '../useConversation'

describe('InlineBlocks — unknown block type fallback', () => {
  it('renders the fallback card for unknown block_type, does not throw', () => {
    const unknownBlock = { type: 'future_block_v99', some_field: 'value' } as unknown as ConversationBlock
    render(<InlineBlocks blocks={[unknownBlock]} />)
    // R7: unknown blocks surface as the honest fallback card
    expect(screen.getByTestId('v5-unsupported-block')).toHaveAttribute(
      'data-block-type',
      'future_block_v99',
    )
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
    // R7: the unknown block renders as the fallback card, not silence
    expect(screen.getByTestId('v5-unsupported-block')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Exposure: what a turn shows first, and what the disclosure holds (PX-B)
// ---------------------------------------------------------------------------

describe('InlineBlocks — initial exposure and the single disclosure', () => {
  function makeCommentary(text: string): ConversationBlock {
    return { type: 'commentary', text }
  }

  /** A point CANDIDATE — unlike commentary, these are the bordered cards the cap governs. */
  function makeCoaching(title: string): ConversationBlock {
    return {
      type: 'v5_coaching', block_id: `co_${title}`, title,
      body: `Body for ${title}`, coaching_kind: 'assumption_check',
      source: 'decision_review', target_refs: [], freshness: 'fresh',
    } as unknown as ConversationBlock
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

  // Tranche 1 item 9: standalone digits wrap in .md-number, so "Block 5" is
  // rendered as two adjacent nodes within a <p>. Match the immediate parent
  // element whose own textContent (after trimming) equals the expected text.
  const hasText = (text: string) =>
    (_content: string, node: Element | null) => {
      if (!node) return false
      const own = (node.textContent ?? '').trim()
      if (own !== text) return false
      // Prefer the innermost matching element: only accept this node if NO
      // child element has the same textContent (i.e. we're at the leaf
      // container that wraps the text + any inline spans).
      return !Array.from(node.children).some(
        (child) => (child.textContent ?? '').trim() === text,
      )
    }

  /**
   * ⚠ REWRITTEN FOR THE PX-B COMPOSITION RULING (15 Aug), not weakened.
   *
   * These three cases previously pinned `MAX_VISIBLE_BLOCKS_PER_TURN` — 5
   * commentary blocks render 4, the 5th sits behind "Show 1 more". That
   * constant now has ZERO consumers: exposure is decided by
   * `composeMessage`, which classifies `commentary` as PINNED because
   * commentary renders INLINE — no card, no border, no badge dot (DS v5
   * §21.2) — and was therefore never part of the panels-within-panels harm
   * the cap exists to fix. Capping body prose at four paragraphs and hiding
   * the fifth was the old rule counting things it should not have counted.
   *
   * So the COUNT pins are obsolete and are replaced by the property that
   * actually matters and outlives any cap: TOTAL PARTITION — every block is
   * reachable, nothing is silently dropped. The `graph_patch` guarantee is
   * not merely preserved below, it is pinned harder than before.
   */
  it('never demotes inline commentary — five paragraphs of body prose all render', () => {
    const blocks: ConversationBlock[] = [
      makeCommentary('Block 1'),
      makeCommentary('Block 2'),
      makeCommentary('Block 3'),
      makeCommentary('Block 4'),
      makeCommentary('Block 5'),
    ]
    render(<InlineBlocks blocks={blocks} />)

    for (const label of ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5']) {
      expect(screen.getByText(hasText(label))).toBeInTheDocument()
    }
    // No disclosure at all: nothing was demoted, so offering to reveal
    // "more" would be an affordance pointing at nothing.
    expect(screen.queryByTestId('block-detail-toggle')).not.toBeInTheDocument()
  })

  it('reveals every demoted block through ONE interaction — nothing is dropped', () => {
    // A genuinely demotable mix: four coaching cards exceed the point cap, so
    // the overflow is demoted. Control first — the demotion must actually be
    // happening, or the reveal below proves nothing (an earlier draft of this
    // rewrite used commentary only, which demotes nothing and passed vacuously).
    const blocks: ConversationBlock[] = [
      makeCoaching('Card 1'), makeCoaching('Card 2'),
      makeCoaching('Card 3'), makeCoaching('Card 4'),
    ]
    render(<InlineBlocks blocks={blocks} />)
    expect(screen.queryByText('Card 4')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('block-detail-toggle'))

    // Total partition at the render layer: every block is on screen exactly once.
    for (const label of ['Card 1', 'Card 2', 'Card 3', 'Card 4']) {
      expect(screen.getAllByText(label)).toHaveLength(1)
    }
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('keeps a proposed graph_patch top-level by CLASS — even arriving LAST behind a flood', () => {
    // STRENGTHENED, not relaxed. The old case put the patch at index 0 and
    // concluded it was visible "because it's first" — an assertion any block
    // in slot 0 would have satisfied, so it never bound the patch guarantee
    // (platform trap 19: bind by identity, not by a predicate something else
    // can satisfy). `composeMessage` pins graph_patch by TYPE, so the honest
    // pin puts it in the WORST position — last, behind enough coaching cards
    // to exhaust the point cap — and demands it still render top-level.
    // Demoting a consent affordance into a closed disclosure would hide the
    // thing the user is being asked to agree to.
    const blocks: ConversationBlock[] = [
      makeCoaching('C1'), makeCoaching('C2'), makeCoaching('C3'), makeCoaching('C4'),
      makePatchBlock('p1'),
    ]

    render(<InlineBlocks blocks={blocks} />)

    // Control: the cap IS engaged on this turn, so "top-level" is a real claim.
    expect(screen.queryByText('C4')).not.toBeInTheDocument()
    expect(screen.getByTestId('block-detail-toggle')).toBeInTheDocument()

    // The patch is visible WITHOUT opening the disclosure, and is not inside it.
    const patch = screen.getByTestId('block-graph-patch-p1')
    expect(patch).toBeInTheDocument()
    expect(screen.queryByTestId('block-detail-body')).not.toBeInTheDocument()
  })
})

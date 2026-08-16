/**
 * Integration test: mixed blocks in an assistant message
 *
 * Simulates a full assistant turn with:
 *   - assistant_text
 *   - blocks pre-ordered by prioritiseBlocks
 *   - 2 suggested_action chips
 *
 * Verifies, under the PX-B composition ruling (15 Aug):
 *   - a turn of pinned blocks (graph_patch + inline commentary) demotes
 *     NOTHING and offers no disclosure
 *   - a turn of bordered coaching cards demotes the overflow, and ONE
 *     interaction makes every one of them reachable
 *   - a pinned graph_patch stays top-level and never lands in the
 *     disclosure body — a consent affordance is not supporting detail
 *
 * ⚠ These previously pinned `MAX_VISIBLE_BLOCKS_PER_TURN` (4 visible,
 * "Show 2 more"). That constant now has zero consumers; the count pins are
 * replaced by the properties that outlive any particular cap.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import { prioritiseBlocks } from '../useConversation'
import type { ConversationMessage, ConversationBlock, ActionChip, GraphPatchBlock } from '../types'

function makePatch(patch_id: string): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id,
    summary: 'Add goal node',
    operations: [{ op: 'add_node', target_id: 'n1', data: {} }],
    target_graph_hash: 'hash-abc',
  }
}

/** A point CANDIDATE — the bordered card family the exposure cap actually governs. */
function makeCoaching(title: string): ConversationBlock {
  return {
    type: 'v5_coaching', block_id: `co_${title}`, title,
    body: `Body for ${title}`, coaching_kind: 'assumption_check',
    source: 'decision_review', target_refs: [], freshness: 'fresh',
  } as unknown as ConversationBlock
}

function makeCommentary(text: string): ConversationBlock {
  return { type: 'commentary', text }
}

function makeChip(id: string, label: string): ActionChip {
  return { id, label, intent: 'primary', message: label }
}

describe('Mixed blocks integration — full assistant message', () => {
  it('a turn of pinned blocks demotes nothing — patch and all commentary render, no disclosure', () => {
    // Build 6 blocks: 1 patch + 5 commentary, then prioritise (patch moves first)
    const rawBlocks: ConversationBlock[] = [
      makeCommentary('Commentary A'),
      makeCommentary('Commentary B'),
      makePatch('patch-1'),
      makeCommentary('Commentary C'),
      makeCommentary('Commentary D'),
      makeCommentary('Commentary E'),
    ]
    const orderedBlocks = prioritiseBlocks(rawBlocks)

    const message: ConversationMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Here is my analysis.',
      blocks: orderedBlocks,
      actionChips: [
        makeChip('chip-a', 'Run analysis'),
        makeChip('chip-b', 'Add factor'),
      ],
      timestamp: new Date(),
    }

    render(
      <MessageBubble
        message={message}
        onChipClick={vi.fn()}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
      />,
    )

    // assistant_text renders
    expect(screen.getByText('Here is my analysis.')).toBeInTheDocument()

    // graph_patch is first (prioritised) and visible
    expect(screen.getByTestId('block-graph-patch-patch-1')).toBeInTheDocument()

    // ⚠ REWRITTEN FOR THE PX-B COMPOSITION RULING (15 Aug). This previously
    // asserted "Show 2 more" and that Commentary D/E were hidden — the
    // `MAX_VISIBLE_BLOCKS_PER_TURN` rule, which now has zero consumers.
    // `composeMessage` PINS both types on this turn: graph_patch because it
    // carries the accept/dismiss consent the user is being asked to give, and
    // commentary because it renders inline as body prose (DS v5 §21.2) and was
    // never one of the stacked bordered cards the cap exists to control.
    // So this turn demotes NOTHING, and the honest pin is that all six blocks
    // are present with no affordance offering to reveal what isn't hidden.
    for (const label of ['Commentary A', 'Commentary B', 'Commentary C', 'Commentary D', 'Commentary E']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('block-detail-toggle')).not.toBeInTheDocument()

    // Inline ActionChipRow removed (Task 2: DS v5 compliance) —
    // chips are rendered externally by SuggestedChips, not inside MessageBubble
  })

  it('the disclosure reveals every demoted card, with the pinned patch staying top-level', () => {
    // Rewritten for the composition ruling: the demoted class must be blocks
    // the cap actually governs (bordered coaching cards), not inline
    // commentary. The patch rides along to pin the two-class interaction —
    // a pinned block stays out of the disclosure while cards go into it.
    const rawBlocks: ConversationBlock[] = [
      makePatch('patch-2'),
      makeCoaching('C1'),
      makeCoaching('C2'),
      makeCoaching('C3'),
      makeCoaching('C4'),
      makeCoaching('C5'),
    ]
    const orderedBlocks = prioritiseBlocks(rawBlocks)

    const message: ConversationMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Analysis complete.',
      blocks: orderedBlocks,
      actionChips: [makeChip('chip-x', 'Continue')],
      timestamp: new Date(),
    }

    render(
      <MessageBubble
        message={message}
        onChipClick={vi.fn()}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
      />,
    )

    // Control: the cap IS engaged — C4/C5 are demoted, so the reveal below is
    // a real test of the disclosure and not a no-op on an already-full turn.
    expect(screen.queryByText('C4')).not.toBeInTheDocument()
    expect(screen.queryByText('C5')).not.toBeInTheDocument()
    // The pinned patch is top-level BEFORE the disclosure is opened.
    expect(screen.getByTestId('block-graph-patch-patch-2')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('block-detail-toggle'))

    // Everything is reachable through ONE interaction, each exactly once.
    for (const label of ['C1', 'C2', 'C3', 'C4', 'C5']) {
      expect(screen.getAllByText(label)).toHaveLength(1)
    }
    // The pinned patch did NOT get swept into the disclosure body.
    const body = screen.getByTestId('block-detail-body')
    expect(within(body).queryByTestId('block-graph-patch-patch-2')).not.toBeInTheDocument()
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })
})

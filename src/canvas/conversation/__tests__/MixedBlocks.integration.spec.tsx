/**
 * Integration test: mixed blocks in an assistant message
 *
 * Simulates a full assistant turn with:
 *   - assistant_text
 *   - 6 blocks (1 graph_patch + 5 commentary), pre-ordered by prioritiseBlocks
 *   - 2 suggested_action chips
 *
 * Verifies:
 *   - 4 blocks visible (budget collapse), "Show 2 more" toggle present
 *   - graph_patch block is in the visible set (prioritised to front)
 *   - chips render below the block list
 *   - "Show 2 more" toggle reveals remaining 2 blocks
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

function makeCommentary(text: string): ConversationBlock {
  return { type: 'commentary', text }
}

function makeChip(id: string, label: string): ActionChip {
  return { id, label, intent: 'primary', message: label }
}

describe('Mixed blocks integration — full assistant message', () => {
  it('shows 4 blocks + "Show 2 more" toggle; graph_patch in visible set; chips render below', () => {
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

    // "Show 2 more" toggle present (6 blocks - 4 visible = 2 hidden)
    expect(screen.getByText('Show 2 more')).toBeInTheDocument()

    // 5th and 6th blocks (Commentary D, E) are hidden
    expect(screen.queryByText('Commentary D')).not.toBeInTheDocument()
    expect(screen.queryByText('Commentary E')).not.toBeInTheDocument()

    // Chips render in the chip row
    expect(screen.getByTestId('chip-chip-a')).toBeInTheDocument()
    expect(screen.getByTestId('chip-chip-b')).toBeInTheDocument()

    // Chips are below blocks (chip row has role=group)
    const chipGroup = screen.getByRole('group', { name: 'Suggested actions' })
    expect(chipGroup).toBeInTheDocument()
  })

  it('toggle reveals remaining 2 blocks', () => {
    const rawBlocks: ConversationBlock[] = [
      makePatch('patch-2'),
      makeCommentary('C1'),
      makeCommentary('C2'),
      makeCommentary('C3'),
      makeCommentary('C4'),
      makeCommentary('C5'),
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

    // C4 and C5 hidden initially
    expect(screen.queryByText('C4')).not.toBeInTheDocument()
    expect(screen.queryByText('C5')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Show 2 more'))

    // All blocks now visible
    expect(screen.getByText('C4')).toBeInTheDocument()
    expect(screen.getByText('C5')).toBeInTheDocument()
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })
})

/**
 * MessageBubble freshness pill rendering.
 *
 * Verifies the StalenessPill is rendered as a sibling above the message
 * bubble (not nested inside it) when the message's graph_patch block has
 * analysis_ready.freshness === 'stale' | 'unknown'. Fresh, none, and
 * absent freshness produce no pill (legacy behaviour).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../Conversation.module.css', () => ({
  default: {
    messageBubbleUser: 'messageBubbleUser',
    messageBubbleAssistant: 'messageBubbleAssistant',
    markdownContent: 'markdownContent',
    streamingThinking: 'streamingThinking',
    streamingDot: 'streamingDot',
  },
}))

vi.mock('../../../styles/typography', () => ({
  typography: { bodySmall: 'bodySmall', panelMeta: 'panelMeta', caption: 'caption', body: 'body' },
}))

vi.mock('../utils/markdown', () => ({
  sanitizeMarkdown: (s: string) => s,
}))

vi.mock('../InlineBlocks', () => ({
  InlineBlocks: () => null,
}))

vi.mock('../FeedbackRow', () => ({
  FeedbackRow: () => null,
}))

vi.mock('../useConversation', () => ({
  SYSTEM_MESSAGE_SENTINEL: '[system]',
  isNonConversationalContent: () => false,
}))

import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage, GraphPatchBlock } from '../types'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

function makePatchBlock(freshness?: CEEAnalysisReady['freshness']): GraphPatchBlock {
  const analysis_ready: CEEAnalysisReady | undefined = freshness === undefined
    ? undefined
    : ({
        options: [],
        goal_node_id: 'goal',
        status: 'ready',
        freshness,
      } as unknown as CEEAnalysisReady)
  return {
    type: 'graph_patch',
    patch_id: 'p1',
    summary: 'Patch',
    operations: [],
    target_graph_hash: 'h1',
    ...(analysis_ready ? { analysis_ready } : {}),
  } as GraphPatchBlock
}

function makeMsg(freshness?: CEEAnalysisReady['freshness']): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Result text',
    timestamp: new Date(),
    blocks: [makePatchBlock(freshness)],
  } as ConversationMessage
}

const noop = async () => {}

describe('MessageBubble — staleness pill', () => {
  it('renders stale pill when freshness is "stale"', () => {
    render(<MessageBubble message={makeMsg('stale')} onChipClick={noop} />)
    const pill = screen.getByTestId('staleness-pill')
    expect(pill.getAttribute('data-freshness')).toBe('stale')
    expect(pill.textContent).toContain('Model changed since last analysis')
  })

  it('renders unknown pill when freshness is "unknown"', () => {
    render(<MessageBubble message={makeMsg('unknown')} onChipClick={noop} />)
    const pill = screen.getByTestId('staleness-pill')
    expect(pill.getAttribute('data-freshness')).toBe('unknown')
    expect(pill.textContent).toContain('Based on latest available analysis')
  })

  it('renders no pill when freshness is "fresh"', () => {
    render(<MessageBubble message={makeMsg('fresh')} onChipClick={noop} />)
    expect(screen.queryByTestId('staleness-pill')).toBeNull()
  })

  it('renders no pill when freshness is "none"', () => {
    render(<MessageBubble message={makeMsg('none')} onChipClick={noop} />)
    expect(screen.queryByTestId('staleness-pill')).toBeNull()
  })

  it('renders no pill on legacy responses (freshness absent)', () => {
    render(<MessageBubble message={makeMsg(undefined)} onChipClick={noop} />)
    expect(screen.queryByTestId('staleness-pill')).toBeNull()
  })

  it('renders no pill on user messages', () => {
    const msg = { ...makeMsg('stale'), role: 'user' as const }
    render(<MessageBubble message={msg} onChipClick={noop} />)
    expect(screen.queryByTestId('staleness-pill')).toBeNull()
  })

  it('places the pill OUTSIDE the message bubble (sibling, not nested)', () => {
    render(<MessageBubble message={makeMsg('stale')} onChipClick={noop} />)
    const bubble = screen.getByTestId('message-assistant')
    // Pill must not be a descendant of the bubble — it sits above it.
    expect(bubble.querySelector('[data-testid="staleness-pill"]')).toBeNull()
    // And the pill must exist somewhere in the rendered tree.
    expect(screen.getByTestId('staleness-pill')).toBeTruthy()
  })
})

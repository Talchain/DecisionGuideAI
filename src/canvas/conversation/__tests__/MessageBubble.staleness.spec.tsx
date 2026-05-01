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

// Integration test below uses the real normaliseAnalysisReady. The other
// exports stay mocked because MessageBubble pulls them in unrelated paths.
vi.mock('../useConversation', async () => {
  const actual = await vi.importActual<typeof import('../useConversation')>('../useConversation')
  return {
    SYSTEM_MESSAGE_SENTINEL: '[system]',
    isNonConversationalContent: () => false,
    normaliseAnalysisReady: actual.normaliseAnalysisReady,
  }
})

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

  it('coerces an absent-freshness payload to "unknown" and renders the unknown pill (integration via normaliseAnalysisReady)', async () => {
    // Brief 5.8A post-D7 round 2: the unit test above passes
    // `freshness: undefined` directly to MessageBubble, which is a vacuous
    // legacy-behaviour assertion. The real flow runs the payload through
    // `normaliseAnalysisReady` first (useConversation.ts:609-616), which
    // coerces missing freshness to 'unknown' so legacy responses surface
    // a neutral pill rather than silently treating stale results as fresh.
    // This integration test asserts that documented coercion path.
    const { normaliseAnalysisReady } = await import('../useConversation')
    // Minimal payload that passes validateAnalysisReadyContract (status,
    // goal_node_id, non-empty options with id + label + status). No
    // freshness field — exactly what a legacy CEE response looks like.
    const rawPayload = {
      status: 'ready',
      goal_node_id: 'goal',
      options: [
        {
          id: 'o1',
          label: 'Option 1',
          status: 'ready',
          interventions: {},
        },
      ],
      // freshness deliberately absent — legacy CEE response shape.
    }
    const normalised = normaliseAnalysisReady(rawPayload)
    expect(normalised).toBeDefined()
    expect(normalised!.freshness).toBe('unknown')

    // Now feed the normalised payload through MessageBubble and assert
    // the unknown pill renders.
    const message: ConversationMessage = {
      id: 'msg-legacy',
      role: 'assistant',
      content: 'Legacy result',
      timestamp: new Date(),
      blocks: [{
        type: 'graph_patch',
        patch_id: 'p1',
        summary: 'Patch',
        operations: [],
        target_graph_hash: 'h1',
        analysis_ready: normalised,
      } as GraphPatchBlock],
    } as ConversationMessage

    render(<MessageBubble message={message} onChipClick={noop} />)
    const pill = screen.getByTestId('staleness-pill')
    expect(pill.getAttribute('data-freshness')).toBe('unknown')
    expect(pill.textContent).toContain('Based on latest available analysis')
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

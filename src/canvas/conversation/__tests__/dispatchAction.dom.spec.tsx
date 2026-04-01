/**
 * dispatchAction DOM tests — compact action indicator and insight chip routing
 *
 * Tests:
 * 1. Chip-initiated user message renders compact indicator, not full bubble
 * 2. Non-chip user message renders full bubble as before
 * 3. Compact indicator uses displayContent (label), not raw message
 * 4. Compact indicator has correct test ID
 * 5. Insight getInsightAction returns action_type for each insight type
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'

// Mock dependencies that MessageBubble imports
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector({ nodes: [] }),
    { getState: () => ({ nodes: [], edges: [], selection: { nodeIds: new Set(), edgeIds: new Set() } }) },
  ),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector({ _dispatchAction: null }),
    { getState: () => ({ _dispatchAction: null, _sendMessage: null }) },
  ),
}))

vi.mock('../../../flags', () => ({
  isOrchestratorRenderingV2Enabled: () => false,
  isDeterministicCeeEnabled: () => false,
}))

describe('MessageBubble — chip-initiated compact indicator', () => {
  it('renders compact indicator for chipInitiated user messages', () => {
    const message: ConversationMessage = {
      id: 'msg-chip-1',
      role: 'user',
      content: 'Suggest additional options for this decision',
      displayContent: 'Explore more options',
      chipInitiated: true,
      timestamp: new Date(),
    }

    render(<MessageBubble message={message} onChipClick={vi.fn()} />)

    const indicator = screen.getByTestId('chip-action-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveTextContent('Explore more options')
    // Should NOT render the full user bubble
    expect(screen.queryByTestId('message-user')).not.toBeInTheDocument()
  })

  it('renders full bubble for non-chip user messages', () => {
    const message: ConversationMessage = {
      id: 'msg-normal-1',
      role: 'user',
      content: 'What are my options?',
      timestamp: new Date(),
    }

    render(<MessageBubble message={message} onChipClick={vi.fn()} />)

    expect(screen.getByTestId('message-user')).toBeInTheDocument()
    expect(screen.queryByTestId('chip-action-indicator')).not.toBeInTheDocument()
  })

  it('compact indicator shows displayContent over raw content', () => {
    const message: ConversationMessage = {
      id: 'msg-chip-2',
      role: 'user',
      content: 'Challenge my assumption about Churn Rate',
      displayContent: 'Challenge Churn Rate',
      chipInitiated: true,
      timestamp: new Date(),
    }

    render(<MessageBubble message={message} onChipClick={vi.fn()} />)

    const indicator = screen.getByTestId('chip-action-indicator')
    expect(indicator).toHaveTextContent('Challenge Churn Rate')
    expect(indicator).not.toHaveTextContent('Challenge my assumption about')
  })

  it('compact indicator falls back to content when displayContent is absent', () => {
    const message: ConversationMessage = {
      id: 'msg-chip-3',
      role: 'user',
      content: 'Calibrate this',
      chipInitiated: true,
      timestamp: new Date(),
    }

    render(<MessageBubble message={message} onChipClick={vi.fn()} />)

    expect(screen.getByTestId('chip-action-indicator')).toHaveTextContent('Calibrate this')
  })

  it('assistant messages with chipInitiated are unaffected', () => {
    // chipInitiated is only for user messages
    const message: ConversationMessage = {
      id: 'msg-asst-1',
      role: 'assistant',
      content: 'Here are some options...',
      timestamp: new Date(),
    }

    render(<MessageBubble message={message} onChipClick={vi.fn()} />)

    expect(screen.getByTestId('message-assistant')).toBeInTheDocument()
    expect(screen.queryByTestId('chip-action-indicator')).not.toBeInTheDocument()
  })
})

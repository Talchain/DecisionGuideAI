/**
 * Caller-level surfacing when a system-event send FAILS (F-lane: no silent
 * drops). The real ConversationPanel is rendered with a mock conversation whose
 * `sendSystemEvent` REJECTS — which the seam spec
 * (useConversation.systemEventFailure.spec.ts) proves is exactly what happens
 * on a real failed POST (network / 4xx / 5xx). Here we lock the two callers'
 * reactions to that rejection:
 *
 *   1. FeedbackRow (PR #435) — the optimistic thumbs vote REVERTS, re-enabling
 *      the buttons for retry. Pre-fix (sendSystemEvent resolved) this never
 *      fired; the vote stuck silently on a failed POST.
 *   2. handlePatchAccept — the failure surfaces via the EXISTING NETWORK_ERROR
 *      retry affordance (block returns to 'proposed'). Pre-fix the send was
 *      fire-and-forget, so a failed POST was dropped silently.
 *
 * No new UI surface is introduced — both reuse affordances that already exist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConversationPanel } from '../ConversationPanel'
import { useCanvasStore } from '../../store'
import type { ConversationMessage, GraphPatchBlock } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

// ---------------------------------------------------------------------------
// Mock: PLoT adapter (patch accept path validates through this)
// ---------------------------------------------------------------------------

const mockValidatePatch = vi.fn()
vi.mock('../../../adapters/plot', () => ({
  plot: {
    validatePatch: (...args: unknown[]) => mockValidatePatch(...args),
  },
}))

// ---------------------------------------------------------------------------
// Harness — mirrors patchAcceptLogic.spec.tsx, but sendSystemEvent is
// injectable so a test can make it REJECT.
// ---------------------------------------------------------------------------

const INITIAL_NODES = [
  { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
  { id: 'n2', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Option A' } },
]
const INITIAL_EDGES = [
  { id: 'e1', source: 'n1', target: 'n2', type: 'styled', data: { weight: 1 } },
]

function makePatchBlock(overrides?: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-1',
    summary: "Add 'competitor response' as a risk factor",
    operations: [
      { op: 'add_node', target_id: 'n-new', data: { type: 'risk', label: 'Competitor response' } },
    ],
    target_graph_hash: 'hash-1',
    ...overrides,
  }
}

function makePatchMessage(block: GraphPatchBlock): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'I suggest adding a risk factor.',
    blocks: [block],
    timestamp: new Date(),
    clientTurnId: 'turn-1',
  }
}

function makeFeedbackMessage(): ConversationMessage {
  // Assistant, non-synthetic, real conversational content + a clientTurnId →
  // MessageBubble renders FeedbackRow with a defined turnId.
  return {
    id: 'msg-fb',
    role: 'assistant',
    content: 'Here is my analysis of your decision.',
    timestamp: new Date(),
    clientTurnId: 'turn-fb-1',
  }
}

function makeMockConversation(
  messages: ConversationMessage[],
  sendSystemEvent: ReturnType<typeof vi.fn>,
): {
  conversation: UseConversationReturn
  patchStates: Map<string, PatchBlockState>
  patchRejections: Map<string, PatchRejectionInfo>
} {
  const patchStates = new Map<string, PatchBlockState>()
  const patchRejections = new Map<string, PatchRejectionInfo>()

  const conversation: UseConversationReturn = {
    messages,
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction: vi.fn().mockResolvedValue(undefined),
    cancelTurn: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent,
    sendChip: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: patchStates,
    setPatchBlockState: (key: string, state: PatchBlockState) => {
      patchStates.set(key, state)
    },
    patchRejections,
    setPatchRejection: (key: string, info: PatchRejectionInfo) => {
      patchRejections.set(key, info)
    },
  }

  return { conversation, patchStates, patchRejections }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mockValidatePatch.mockReset()
  useCanvasStore.setState({
    nodes: [...INITIAL_NODES],
    edges: [...INITIAL_EDGES],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    currentScenarioLastResultHash: 'hash-1',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' } as never,
    _externalMutationActive: 0,
  } as never)
})

afterEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// FeedbackRow — reverts the optimistic vote on a failed send
// ---------------------------------------------------------------------------

describe('FeedbackRow revert on a failed feedback send', () => {
  it('re-enables the thumbs after the feedback turn rejects (optimistic revert)', async () => {
    const sendSystemEvent = vi.fn().mockRejectedValue(new Error('send failed'))
    const { conversation } = makeMockConversation([makeFeedbackMessage()], sendSystemEvent)

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    const thumbsUp = screen.getByRole('button', { name: 'Helpful' })
    fireEvent.click(thumbsUp)

    // Optimistic disable is synchronous on click.
    expect(screen.getByRole('button', { name: 'Helpful' })).toBeDisabled()

    // The feedback POST was dispatched as a system event…
    expect(sendSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'feedback_submitted',
        payload: { turn_id: 'turn-fb-1', rating: 'up' },
      }),
    )

    // …and once its rejection settles, the buttons re-enable for retry.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Helpful' })).not.toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'Not helpful' })).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// handlePatchAccept — surfaces via the existing NETWORK_ERROR retry affordance
// ---------------------------------------------------------------------------

describe('handlePatchAccept surfaces a failed patch_accepted send', () => {
  it('returns the block to proposed + NETWORK_ERROR retry when the send rejects', async () => {
    mockValidatePatch.mockResolvedValue({
      valid: true,
      graph: {
        nodes: [
          ...INITIAL_NODES,
          { id: 'n-new', type: 'risk', position: { x: 200, y: 0 }, data: { label: 'Competitor response' } },
        ],
        edges: [...INITIAL_EDGES],
      },
    })
    const sendSystemEvent = vi.fn().mockRejectedValue(new Error('send failed'))
    const { conversation, patchStates, patchRejections } = makeMockConversation(
      [makePatchMessage(makePatchBlock())],
      sendSystemEvent,
    )

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    // The patch_accepted notification was attempted…
    await waitFor(() => {
      expect(sendSystemEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'patch_accepted' }),
      )
    })

    // …and its rejection surfaces via the existing NETWORK_ERROR retry
    // affordance: the block returns to 'proposed' (so GraphPatchBlockRenderer's
    // `patch-retry-error` "Try again" card renders) with the NETWORK_ERROR
    // rejection info — no new UI surface. (Asserted on the state maps, as the
    // sibling patchAcceptLogic.spec.tsx does — the mock's setters mutate Maps
    // and do not trigger a parent re-render.)
    await waitFor(() => {
      expect(patchRejections.get('msg-1:patch-1')?.code).toBe('NETWORK_ERROR')
    })
    expect(patchStates.get('msg-1:patch-1')).toBe('proposed')
  })
})

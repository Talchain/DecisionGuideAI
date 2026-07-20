/**
 * Tests for patch acceptance logic in ConversationPanel
 *
 * Renders the real ConversationPanel component with a mock conversation
 * containing graph_patch blocks, then clicks Accept/Dismiss and asserts:
 * - Store mutations (validated graph applied, or no mutation on rejection)
 * - System events dispatched (patch_accepted / patch_dismissed)
 * - PLoT validatePatch called or not called as appropriate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConversationPanel } from '../ConversationPanel'
import { useCanvasStore } from '../../store'
import type { ConversationMessage, GraphPatchBlock } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

// ---------------------------------------------------------------------------
// Mock: PLoT adapter
// ---------------------------------------------------------------------------

const mockValidatePatch = vi.fn()
vi.mock('../../../adapters/plot', () => ({
  plot: {
    validatePatch: (...args: unknown[]) => mockValidatePatch(...args),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
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

function makeMessage(block: GraphPatchBlock): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'I suggest adding a risk factor.',
    blocks: [block],
    timestamp: new Date(),
    clientTurnId: 'turn-1',
  }
}

/**
 * Creates a mock UseConversationReturn with controllable state maps.
 * The patchBlockStates and patchRejections are real Maps that get updated
 * via setPatchBlockState / setPatchRejection so we can inspect them.
 */
function makeMockConversation(messages: ConversationMessage[]): {
  conversation: UseConversationReturn
  patchStates: Map<string, PatchBlockState>
  patchRejections: Map<string, PatchRejectionInfo>
  sendSystemEvent: ReturnType<typeof vi.fn>
} {
  const patchStates = new Map<string, PatchBlockState>()
  const patchRejections = new Map<string, PatchRejectionInfo>()
  const sendSystemEvent = vi.fn().mockResolvedValue(undefined)

  const conversation: UseConversationReturn = {
    messages,
    isThinking: false,
    longRunningHint: null,
    // Completing the UseConversationReturn shape — these three were already
    // missing before this change (pre-existing TS2739 in the wide config).
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

  return { conversation, patchStates, patchRejections, sendSystemEvent }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()

  mockValidatePatch.mockReset()

  useCanvasStore.setState({
    nodes: [...INITIAL_NODES],
    edges: [...INITIAL_EDGES],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    currentScenarioLastResultHash: 'hash-1',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' } as any,
    _externalMutationActive: 0,
  } as any)
})

afterEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
  })
})

// ---------------------------------------------------------------------------
// Fix 1: Validated graph preference
// ---------------------------------------------------------------------------

describe('handlePatchAccept — validated graph preference', () => {
  it('applies PLoT validated graph directly via setState (not op replay)', async () => {
    const validatedGraph = {
      nodes: [
        ...INITIAL_NODES,
        { id: 'n-new', type: 'risk', position: { x: 200, y: 0 }, data: { label: 'Competitor response' } },
      ],
      edges: [
        ...INITIAL_EDGES,
        { id: 'e2', source: 'n-new', target: 'n1', type: 'styled', data: { weight: 0.5 } },
      ],
    }

    mockValidatePatch.mockResolvedValue({ valid: true, graph: validatedGraph })

    // Spy on pushHistory to verify atomicity — must be called exactly once
    const pushHistorySpy = vi.spyOn(useCanvasStore.getState(), 'pushHistory')

    const block = makePatchBlock()
    const msg = makeMessage(block)
    const { conversation, patchStates, sendSystemEvent } = makeMockConversation([msg])

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    await waitFor(() => {
      expect(patchStates.get('msg-1:patch-1')).toBe('accepted')
    })

    // Store should have the validated graph — 3 nodes, 2 edges
    const state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(3)
    expect(state.nodes.find((n) => n.id === 'n-new')).toBeTruthy()
    expect(state.edges).toHaveLength(2)

    // Atomicity: pushHistory called exactly once before setState
    expect(pushHistorySpy).toHaveBeenCalledTimes(1)

    // patch_accepted system event dispatched with enriched payload (operations included)
    expect(sendSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'patch_accepted',
        payload: expect.objectContaining({
          patch_id: 'patch-1',
          operations: expect.arrayContaining([
            expect.objectContaining({ op: 'add_node', target_id: 'n-new' }),
          ]),
        }),
      }),
    )

    // validatePatch was called
    expect(mockValidatePatch).toHaveBeenCalledTimes(1)

    pushHistorySpy.mockRestore()
  })

  it('accepts validated_graph key as alternative to graph', async () => {
    const validatedGraph = {
      nodes: [
        ...INITIAL_NODES,
        { id: 'n-alt', type: 'risk', position: { x: 200, y: 0 }, data: { label: 'Alt risk' } },
      ],
      edges: [...INITIAL_EDGES],
    }

    // Response uses validated_graph instead of graph
    mockValidatePatch.mockResolvedValue({ valid: true, validated_graph: validatedGraph })

    // Spy on pushHistory to verify atomicity on alternate key path
    const pushHistorySpy = vi.spyOn(useCanvasStore.getState(), 'pushHistory')

    const block = makePatchBlock()
    const msg = makeMessage(block)
    const { conversation, patchStates } = makeMockConversation([msg])

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    await waitFor(() => {
      expect(patchStates.get('msg-1:patch-1')).toBe('accepted')
    })

    // Store should have the validated graph with n-alt
    const state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(3)
    expect(state.nodes.find((n) => n.id === 'n-alt')).toBeTruthy()

    // Atomicity: pushHistory called exactly once (same as graph key path)
    expect(pushHistorySpy).toHaveBeenCalledTimes(1)

    pushHistorySpy.mockRestore()
  })

  it('falls back to op replay when validate response has no graph', async () => {
    mockValidatePatch.mockResolvedValue({ valid: true })

    const block = makePatchBlock({
      operations: [
        { op: 'update_node', target_id: 'n2', data: { label: 'Updated Option' } },
      ],
    })
    const msg = makeMessage(block)
    const { conversation, patchStates } = makeMockConversation([msg])

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    await waitFor(() => {
      expect(patchStates.get('msg-1:patch-1')).toBe('accepted')
    })

    // Op replay should have updated n2's data
    const n2 = useCanvasStore.getState().nodes.find((n) => n.id === 'n2')
    expect(n2?.data).toEqual(expect.objectContaining({ label: 'Updated Option' }))
  })
})

// ---------------------------------------------------------------------------
// Fix 2: Unknown operation guard
// ---------------------------------------------------------------------------

describe('handlePatchAccept — unknown operation guard', () => {
  it('rejects patch with unknown op, no store mutation, sends patch_dismissed', async () => {
    const block = makePatchBlock({
      operations: [
        { op: 'merge_nodes' as any, target_id: 'n1', data: { merge_with: 'n2' } },
      ],
    })
    const msg = makeMessage(block)
    const { conversation, patchStates, patchRejections, sendSystemEvent } = makeMockConversation([msg])

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    await waitFor(() => {
      expect(patchStates.get('msg-1:patch-1')).toBe('rejected')
    })

    // Store untouched
    expect(useCanvasStore.getState().nodes).toEqual(INITIAL_NODES)
    expect(useCanvasStore.getState().edges).toEqual(INITIAL_EDGES)

    // Rejection info — assert on stable code, not human-readable message
    const rejection = patchRejections.get('msg-1:patch-1')
    expect(rejection?.code).toBe('UNSUPPORTED_OPERATION')

    // validatePatch was NOT called (guard fires before network call)
    expect(mockValidatePatch).not.toHaveBeenCalled()

    // patch_dismissed system event dispatched with correct reason
    expect(sendSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'patch_dismissed',
        payload: { patch_id: 'patch-1', reason: 'unsupported_operation' },
      }),
    )
  })

  it('rejects entire patch when mix of known + unknown ops', async () => {
    const block = makePatchBlock({
      operations: [
        { op: 'add_node', target_id: 'n3', data: { type: 'factor', label: 'Factor' } },
        { op: 'split_node' as any, target_id: 'n1', data: {} },
      ],
    })
    const msg = makeMessage(block)
    const { conversation, patchStates, patchRejections } = makeMockConversation([msg])

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-accept'))

    await waitFor(() => {
      expect(patchStates.get('msg-1:patch-1')).toBe('rejected')
    })

    // No partial application — store untouched (no n3 added)
    expect(useCanvasStore.getState().nodes).toEqual(INITIAL_NODES)
    expect(mockValidatePatch).not.toHaveBeenCalled()

    // Assert stable rejection code (not message string)
    expect(patchRejections.get('msg-1:patch-1')?.code).toBe('UNSUPPORTED_OPERATION')
  })
})

// ---------------------------------------------------------------------------
// Dismiss handler
// ---------------------------------------------------------------------------

describe('handlePatchDismiss', () => {
  it('transitions block to dismissed and sends patch_dismissed event', () => {
    const block = makePatchBlock()
    const msg = makeMessage(block)
    const { conversation, patchStates, sendSystemEvent } = makeMockConversation([msg])

    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} />)

    fireEvent.click(screen.getByTestId('patch-dismiss'))

    expect(patchStates.get('msg-1:patch-1')).toBe('dismissed')
    expect(sendSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'patch_dismissed',
        payload: { patch_id: 'patch-1' },
      }),
    )

    // Store untouched
    expect(useCanvasStore.getState().nodes).toEqual(INITIAL_NODES)
    expect(mockValidatePatch).not.toHaveBeenCalled()
  })
})

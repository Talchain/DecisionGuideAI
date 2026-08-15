/**
 * Delayed V5 response ownership on the mounted production conversation path.
 *
 * A and B intentionally reuse the same node id. That makes this regression
 * distinguish a real response fence from a presentation-only identity check:
 * without the fence, applyV5State can resolve the id in B, publish an
 * assistant focus, move the mounted camera bridge, and advance B's stage.
 */
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'

import { AssistantFocusChip } from '../../components/AssistantFocusChip'
import { useCanvasStore } from '../../store'
import {
  dismissAssistantFocus,
  useAssistantFocusStore,
} from '../../stores/assistantFocusStore'
import { useResultsStore } from '../../stores/resultsStore'
import { registerAssistantFocusCamera } from '../../utils/assistantFocusCamera'
import {
  ConversationProvider,
  useConversationContext,
} from '../ConversationContext'

const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true as const }),
    isV5CanonicalRunPath: () => false,
  }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))

const SCENARIO_A = '11111111-2222-4333-8444-555555555555'
const SCENARIO_B = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const SHARED_ID = 'factor-shared'
const USER_B_ID = 'factor-user-b'

const A_SHARED: Node = {
  id: SHARED_ID,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Scenario A factor' },
}

const B_SHARED: Node = {
  id: SHARED_ID,
  type: 'factor',
  position: { x: 400, y: 0 },
  data: { label: 'Scenario B factor' },
}

const B_USER_NODE: Node = {
  id: USER_B_ID,
  type: 'factor',
  position: { x: 0, y: 200 },
  data: { label: 'B user selection' },
  selected: true,
}

function lateFocusResponse() {
  return {
    kind: 'response' as const,
    response: {
      response_version: 2,
      assistant_text: 'Late answer for scenario A',
      blocks: [{
        type: 'ui_directive',
        verb: 'focus',
        targets: [{ id: SHARED_ID, kind: 'factor', label: 'Scenario A factor' }],
        duration_ms: 10_000,
      }],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    },
  }
}

function Harness() {
  const { messages, sendMessage } = useConversationContext()
  const [settled, setSettled] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void sendMessage('Question from scenario A').finally(() => setSettled(true))
        }}
      >
        Send from A
      </button>
      <output data-testid="turn-state">{settled ? 'settled' : 'pending'}</output>
      <div data-testid="transcript">
        {messages.map((message) => <p key={message.id}>{message.content}</p>)}
      </div>
      <AssistantFocusChip />
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  mockCallTurn.mockReset()
  mockStreamTurn.mockReset()
  mockCallV5Turn.mockReset()
  dismissAssistantFocus()

  useResultsStore.setState({
    results: {
      status: 'idle',
      progress: 0,
      analysisSummary: undefined,
      lastSnapshotId: undefined,
    },
  } as never)

  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_A,
    currentStage: 'frame',
    nodes: [A_SHARED] as never,
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
  })
})

afterEach(() => {
  cleanup()
  dismissAssistantFocus()
  vi.clearAllMocks()
})

describe('useConversation — delayed response scenario ownership', () => {
  it('drops an A response after switching to B even when B reuses the focus id', async () => {
    let resolveResponse!: (value: ReturnType<typeof lateFocusResponse>) => void
    mockCallV5Turn.mockImplementation(() => new Promise((resolve) => {
      resolveResponse = resolve
    }))

    const focusNode = vi.fn()
    const focusEdge = vi.fn()
    const unregisterCamera = registerAssistantFocusCamera(focusNode, focusEdge)

    render(
      <ConversationProvider>
        <Harness />
      </ConversationProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send from A' }))
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    expect(mockCallV5Turn.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ scenario_id: SCENARIO_A }),
    )

    // The user moves to B while A is still on the wire. B deliberately has
    // the same target id, plus independent selection and pulse authorities.
    act(() => {
      useCanvasStore.setState({
        currentScenarioId: SCENARIO_B,
        currentStage: 'frame',
        nodes: [B_SHARED, B_USER_NODE] as never,
        edges: [],
        selection: {
          nodeIds: new Set([USER_B_ID]),
          edgeIds: new Set(),
          anchorPosition: null,
        },
        highlightedNodes: new Set([USER_B_ID]),
        highlightedEdges: new Set(),
      })
    })

    await act(async () => {
      resolveResponse(lateFocusResponse())
    })
    await waitFor(() => expect(screen.getByTestId('turn-state')).toHaveTextContent('settled'))

    const live = useCanvasStore.getState()
    expect(live.currentScenarioId).toBe(SCENARIO_B)
    expect(live.currentStage).toBe('frame')
    expect([...live.selection.nodeIds]).toEqual([USER_B_ID])
    expect([...live.highlightedNodes]).toEqual([USER_B_ID])
    expect(live.nodes.find((node) => node.id === SHARED_ID)?.data.label).toBe('Scenario B factor')

    expect(useAssistantFocusStore.getState().target).toBeNull()
    expect(screen.queryByTestId('assistant-focus-chip')).not.toBeInTheDocument()
    expect(focusNode).not.toHaveBeenCalled()
    expect(focusEdge).not.toHaveBeenCalled()
    expect(screen.getByTestId('transcript')).not.toHaveTextContent('Late answer for scenario A')

    unregisterCamera()
  })
})

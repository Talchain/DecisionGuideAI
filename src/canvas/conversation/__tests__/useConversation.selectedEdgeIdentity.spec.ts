/**
 * Selected-edge identity production on the LIVE V5 send path.
 *
 * This mounts the real `useConversation` hook and captures the payload passed
 * to `callV5Turn`. The selected relationship starts as React Flow's opaque
 * local id (`e5`), then the sole production builder (`buildV5Payload`) must
 * resolve that exact live edge and emit CEE's existing canonical endpoint
 * composite. No hand-built payload or mirrored builder participates here.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useResultsStore } from '../../stores/resultsStore'

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

const FACTOR: Node = {
  id: 'factor_salary',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Engineer salary' },
}

const GOAL: Node = {
  id: 'goal_growth',
  type: 'goal',
  position: { x: 300, y: 0 },
  data: { label: 'Grow revenue' },
}

const OTHER: Node = {
  id: 'factor_marketing',
  type: 'factor',
  position: { x: 0, y: 180 },
  data: { label: 'Marketing reach' },
}

// Deliberately first: an array-head substitution would emit the wrong edge.
const UNRELATED_EDGE: Edge = {
  id: 'e4',
  source: 'factor_marketing',
  target: 'goal_growth',
}

const SELECTED_EDGE: Edge = {
  id: 'e5',
  source: 'factor_salary',
  target: 'goal_growth',
}

const NODES = [FACTOR, GOAL, OTHER]
const EDGES = [UNRELATED_EDGE, SELECTED_EDGE]
const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

function successResult() {
  return {
    kind: 'response' as const,
    response: {
      response_version: 2,
      assistant_text: 'I will use the selected context.',
      blocks: [] as unknown[],
      suggested_actions: [] as unknown[],
      insights: [] as unknown[],
      stage_indicator: 'analyse',
    },
  }
}

function selectOnCanvas(nodes: readonly Node[], edges: readonly Edge[]): void {
  useCanvasStore.getState().onSelectionChange({ nodes, edges } as never)
}

function capturedMessagePayload(): Record<string, unknown> {
  expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  const payload = mockCallV5Turn.mock.calls[0]?.[0] as Record<string, unknown> | undefined
  expect(payload).toBeDefined()
  return payload!
}

async function sendFromMountedConversation(message = 'Why does this relationship matter?') {
  const hook = renderHook(() => useConversation())
  await act(async () => {
    await hook.result.current.sendMessage(message)
  })
  return hook
}

beforeEach(() => {
  localStorage.clear()
  mockCallTurn.mockReset()
  mockStreamTurn.mockReset()
  mockCallV5Turn.mockReset()
  mockCallV5Turn.mockResolvedValue(successResult())

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
    currentScenarioId: SCENARIO_ID,
    nodes: NODES as never,
    edges: EDGES as never,
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

describe('useConversation — selected edge identity reaches the V5 wire honestly', () => {
  it('maps selected e5 to its exact endpoints and never sends the unrelated first edge or opaque id', async () => {
    selectOnCanvas([], [SELECTED_EDGE])
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e5'])

    await sendFromMountedConversation()
    const payload = capturedMessagePayload()

    expect(payload.selected_elements).toEqual([
      { id: 'factor_salary→goal_growth', kind: 'edge' },
    ])
    expect(JSON.stringify(payload.selected_elements)).not.toContain('e5')
    expect(JSON.stringify(payload.selected_elements)).not.toContain(
      'factor_marketing→goal_growth',
    )
    expect(() => OrchestratorTurnPayloadSchema.parse(payload)).not.toThrow()
  })

  it('omits a stale/fuzzy e5 instead of fabricating a composite from e4 or e50', async () => {
    selectOnCanvas([], [SELECTED_EDGE])
    useCanvasStore.setState({
      edges: [
        UNRELATED_EDGE,
        { id: 'e50', source: 'factor_salary', target: 'goal_growth' },
      ] as never,
      // Preserve the stale selection exactly as a deletion race can leave it.
      selection: {
        ...useCanvasStore.getState().selection,
        edgeIds: new Set(['e5']),
      },
    })
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e5'])

    await sendFromMountedConversation()
    const payload = capturedMessagePayload()

    expect(payload.selected_elements).toBeUndefined()
    expect('selected_elements' in payload).toBe(false)
  })

  it('preserves the node ref and appends the exact selected edge ref in a mixed selection', async () => {
    selectOnCanvas([FACTOR], [SELECTED_EDGE])
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['factor_salary'])
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e5'])

    await sendFromMountedConversation('Use both selected elements.')

    expect(capturedMessagePayload().selected_elements).toEqual([
      { id: 'factor_salary', kind: 'factor', label: 'Engineer salary' },
      { id: 'factor_salary→goal_growth', kind: 'edge' },
    ])
  })

  it('does not mutate graph or selection across provider remounts', async () => {
    selectOnCanvas([], [SELECTED_EDGE])
    const before = {
      nodes: structuredClone(useCanvasStore.getState().nodes),
      edges: structuredClone(useCanvasStore.getState().edges),
      nodeIds: [...useCanvasStore.getState().selection.nodeIds],
      edgeIds: [...useCanvasStore.getState().selection.edgeIds],
    }

    const first = await sendFromMountedConversation('First mount.')
    expect(capturedMessagePayload().selected_elements).toEqual([
      { id: 'factor_salary→goal_growth', kind: 'edge' },
    ])
    first.unmount()

    mockCallV5Turn.mockClear()
    const second = await sendFromMountedConversation('Second mount.')
    expect(capturedMessagePayload().selected_elements).toEqual([
      { id: 'factor_salary→goal_growth', kind: 'edge' },
    ])
    second.unmount()

    const after = useCanvasStore.getState()
    expect(after.nodes).toEqual(before.nodes)
    expect(after.edges).toEqual(before.edges)
    expect([...after.selection.nodeIds]).toEqual(before.nodeIds)
    expect([...after.selection.edgeIds]).toEqual(before.edgeIds)
  })
})

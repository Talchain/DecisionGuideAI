import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { WireSystemEvent } from '../../canvas/conversation/types'

const sendSystemEvent = vi.fn<[WireSystemEvent], Promise<string>>(() => Promise.resolve('SENT'))
vi.mock('../../canvas/conversation/ConversationContext', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))

import { useCanvasStore } from '../../canvas/store'
import { useModelEditAuthority } from '../../canvas/hooks/useModelEditAuthority'
import { serverStatedStrengthOf } from '../../canvas/conversation/edgeServerStatedStrength'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { parseV5Response } from '../responseParser'

const EDGE = 'client_edge_cost_delivery'
const OTHER = 'client_edge_capacity_delivery'
const FROM = 'fac_cost'
const TO = 'goal_delivery'

function edgeData(id = EDGE) {
  return useCanvasStore.getState().edges.find(edge => edge.id === id)!.data!
}

function sentStrengthPayload(index: number): Record<string, unknown> {
  const event = sendSystemEvent.mock.calls[index]?.[0]
  if (event?.type !== 'edge_strength_edit' || !event.payload) {
    throw new Error(`Expected edge_strength_edit with a payload at call ${index}`)
  }
  return event.payload
}

// Shape emitted by CEE 88b4db2c adjust-edge-strength.ts:352–410 and compose.ts:596–609.
// This is a producer-shaped fixture, not a recorded live response.
function acknowledgement(target = `${FROM}→${TO}`, status = 'applied', mean = -0.7) {
  return {
    response_version: 2,
    assistant_text: '', blocks: [{
      type: 'graph_patch', operation: 'adjust_edge_strength', status, target_id: target,
      before: { from: FROM, to: TO, strength: { mean: -0.4, std: 0.15 }, effect_direction: 'negative' },
      after: { from: FROM, to: TO, strength: { mean, std: 0.15 }, effect_direction: 'negative' },
    }],
    suggested_actions: [], insights: [], stage_indicator: 'frame',
  }
}

async function receive(body: unknown, status = 200) {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  }))
  if (parsed.kind !== 'response') return { parsed }
  let result: ReturnType<typeof applyV5State> | undefined
  act(() => {
    const state = useCanvasStore.getState()
    // Use the real store operations without unrelated optional store contracts.
    const store: V5ApplicatorStore = {
      nodes: state.nodes, edges: state.edges,
      setCurrentStage: state.setCurrentStage,
      updateNode: state.updateNode,
      updateEdgeData: state.updateEdgeData,
      setRunMeta: state.setRunMeta,
      setCeeAnalysisReady: state.setCeeAnalysisReady,
    }
    result = applyV5State(parsed.response, store)
  })
  return { parsed, result }
}

beforeEach(() => {
  sendSystemEvent.mockClear()
  useCanvasStore.setState({
    nodes: [],
    edges: [
      { id: EDGE, source: FROM, target: TO, data: {
        weight: 0.4, belief: 0.85, direction: 'negative', strengthStd: 0.15,
        serverStrength: { mean: -0.4, effect_direction: 'negative' },
      } },
      { id: OTHER, source: 'fac_capacity', target: TO, data: {
        weight: 0.4, belief: 0.65, direction: 'negative',
        serverStrength: { mean: -0.4, effect_direction: 'negative' },
      } },
    ],
  } as never)
})

describe('accepted relationship strength acknowledgement', () => {
  it('updates the same edge and feeds the accepted tuple to the second edit', async () => {
    const unrelated = edgeData(OTHER)
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    act(() => { expect(result.current.proposeEdgeStrength(EDGE, -0.7, { directionStated: false })).toBe('dispatched') })
    expect(sentStrengthPayload(0).expected).toEqual({ mean: -0.4, effect_direction: 'negative' })
    expect(serverStatedStrengthOf(edgeData())).toEqual({ mean: -0.4, effect_direction: 'negative' })
    const receipt = await receive(acknowledgement())
    expect(receipt.parsed.kind).toBe('response')
    expect.soft(receipt.result?.deferred).toEqual([])
    expect.soft(serverStatedStrengthOf(edgeData())).toEqual({ mean: -0.7, effect_direction: 'negative' })
    expect(edgeData()).toMatchObject({ weight: 0.7, belief: 0.85, direction: 'negative', strengthStd: 0.15 })
    act(() => { expect(result.current.proposeEdgeStrength(EDGE, -0.8, { directionStated: false })).toBe('dispatched') })
    expect(sentStrengthPayload(1).expected).toEqual({ mean: -0.7, effect_direction: 'negative' })
    expect(edgeData(OTHER)).toBe(unrelated)
  })

  it('does not clear weight or belief when the client id already matches the receipt', async () => {
    const receipt = await receive(acknowledgement(EDGE))
    expect(receipt.parsed.kind).toBe('response')
    expect(edgeData()).toMatchObject({ weight: 0.7, belief: 0.85, direction: 'negative' })
    expect(serverStatedStrengthOf(edgeData())).toEqual({ mean: -0.7, effect_direction: 'negative' })
  })

  it('does not advance server knowledge for a rejected write', async () => {
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    act(() => { result.current.proposeEdgeStrength(EDGE, -0.7, { directionStated: false }) })
    const receipt = await receive({
      error: 'GRAPH_DIVERGED', boundary: 'B1', direction: 'ingress',
      validator: 'EdgeStrengthEditEvent', request_id: 'rejected-strength-edit',
      details: { reason: 'edge_expected_tuple_mismatch' }, retryable: false,
    }, 409)
    expect(receipt.parsed.kind).toBe('boundary_error')
    expect(serverStatedStrengthOf(edgeData())).toEqual({ mean: -0.4, effect_direction: 'negative' })
    act(() => { result.current.proposeEdgeStrength(EDGE, -0.8, { directionStated: false }) })
    expect(sentStrengthPayload(1).expected).toEqual({ mean: -0.4, effect_direction: 'negative' })
  })

  it('does not treat an unaddressable applied receipt as a write to another edge', async () => {
    const before = useCanvasStore.getState().edges
    const body = acknowledgement('missing→edge')
    body.blocks[0].after.from = 'missing'
    body.blocks[0].after.to = 'edge'
    body.blocks[0].before.from = 'missing'
    body.blocks[0].before.to = 'edge'
    const receipt = await receive(body)
    expect(receipt.result?.deferred).toHaveLength(1)
    expect(useCanvasStore.getState().edges).toBe(before)
  })

  it('leaves non-applied receipts unchanged', async () => {
    const before = useCanvasStore.getState().edges
    await receive(acknowledgement(undefined, 'noop'))
    expect(useCanvasStore.getState().edges).toBe(before)
  })

  it('preserves a negative direction at zero and the next edit uses that accepted tuple', async () => {
    await receive(acknowledgement(undefined, 'applied', 0))
    expect(edgeData()).toMatchObject({ weight: 0, direction: 'negative', belief: 0.85 })
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    act(() => { result.current.proposeEdgeStrength(EDGE, -0.2, { directionStated: false }) })
    expect(sentStrengthPayload(0).expected).toEqual({ mean: -0, effect_direction: 'negative' })
  })

  it('refuses a client-id target whose snapshot describes a different edge', async () => {
    const before = useCanvasStore.getState().edges
    const receipt = await receive(acknowledgement(OTHER))
    expect(receipt.result?.deferred).toHaveLength(1)
    expect(useCanvasStore.getState().edges).toBe(before)
  })

  it('refuses an ambiguous endpoint pair rather than choosing the first client edge', async () => {
    useCanvasStore.setState(state => ({ edges: [
      ...state.edges,
      { ...state.edges[0], id: 'duplicate_client_edge' },
    ] }))
    const before = useCanvasStore.getState().edges
    const receipt = await receive(acknowledgement())
    expect(receipt.result?.deferred).toHaveLength(1)
    expect(useCanvasStore.getState().edges).toBe(before)
  })

  it('does not record an invalid signed-mean/direction pair as server knowledge', async () => {
    const before = useCanvasStore.getState().edges
    const receipt = await receive(acknowledgement(EDGE, 'applied', 0.7))
    expect(receipt.result?.deferred).toHaveLength(1)
    expect(useCanvasStore.getState().edges).toBe(before)
  })
})

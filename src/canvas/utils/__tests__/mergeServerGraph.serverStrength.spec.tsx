import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Edge } from '@xyflow/react'
import type { WireSystemEvent } from '../../conversation/types'
import type { EdgeData } from '../../domain/edges'

const sendSystemEvent = vi.fn<[WireSystemEvent], Promise<string>>(() => Promise.resolve('SENT'))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))

import { useCanvasStore } from '../../store'
import { useModelEditAuthority } from '../../hooks/useModelEditAuthority'
import { edgeStrengthEditIsAssertable } from '../../conversation/edgeStrengthEdit'
import { serverStatedStrengthOf } from '../../conversation/edgeServerStatedStrength'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { overlayEdge } from '../mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { __resetAppliedEditPulseForTests, PULSE_COALESCE_MS } from '../appliedEditPulse'

const EDGE = 'local_edge_124ec3bb_72ede081'
const OTHER = 'local_edge_other'
const FROM = '124ec3bb'
const TO = '72ede081'
const NODES = [
  { id: FROM, kind: 'factor', label: 'Coordination overhead' },
  { id: TO, kind: 'goal', label: 'Delivery' },
]

// ⚠ FIXTURE UPDATED 23 Sep 2026 (reload shows the saved model): the unrelated
// canvas edge `OTHER` is now also in every server graph below. It used to be
// omitted, which was harmless while boot never removed anything; under the new
// rule an edge the saved model lacks is TAKEN OFF (a model change), so omitting
// it would turn "an unrelated edge is left untouched" and "acquisition is not an
// edit" into measurements of a removal instead.
const OTHER_WIRE = { from: 'other-factor', to: TO }
const serverGraph = (...edges: Array<Record<string, unknown>>) => ({ nodes: NODES, edges: [...edges, OTHER_WIRE] })

// Exact tuple/endpoints extracted from the saved 2026-09-06 C8-restored-server-graph
// scenario_graph.v1 response (request 1e72ae7a-aeb9-42aa-bdef-a70e47382bf7).
// This is not claimed to be Panel's later 33-edge capture.
const CAPTURED_STRENGTH = { mean: -0.3518518518518518, std: 0.08444444444444442 }

function currentEdge(id = EDGE) {
  const edge = useCanvasStore.getState().edges.find(item => item.id === id)
  if (!edge) throw new Error(`Missing fixture edge ${id}`)
  return edge
}

function seedMatchingValues(wireFields: Record<string, unknown>) {
  const wire = { from: FROM, to: TO, ...wireFields }
  const mapped = mapDraftEdgeToCanvas(wire, 0)
  const dataWithoutServerTuple = { ...mapped.data }
  delete dataWithoutServerTuple.serverStrength
  const data = { ...dataWithoutServerTuple, userReviewedStrength: true }
  useCanvasStore.setState({
    currentScenarioId: '01ce6982-a7f7-4397-bf6b-fbe4a75050ad',
    importPendingServerRegistration: false,
    nodes: NODES.map(node => ({
      id: node.id, type: node.kind, position: { x: 40, y: 80 },
      data: { label: node.label, kind: node.kind },
    })),
    edges: [
      { ...mapped, id: EDGE, selected: true, data },
      { id: OTHER, source: 'other-factor', target: TO, data: { weight: 0.3, direction: 'positive' } },
    ],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  })
  expect(serverStatedStrengthOf(currentEdge().data)).toBeNull()
  return { wire, mapped }
}

beforeEach(() => { sendSystemEvent.mockClear() })

describe('boot hydration records a valid server tuple even when visible values already match', () => {
  it.each([
    ['captured nested negative', { strength: CAPTURED_STRENGTH, effect_direction: 'negative' }, -0.3518518518518518, 'negative'],
    ['default-equal positive', { strength: { mean: 0.5 }, effect_direction: 'positive' }, 0.5, 'positive'],
    ['flat fractional negative', { strength_mean: -0.405, effect_direction: 'negative' }, -0.405, 'negative'],
    ['negative zero', { strength: { mean: 0 }, effect_direction: 'negative' }, -0, 'negative'],
    ['positive zero', { strength_mean: 0, effect_direction: 'positive' }, 0, 'positive'],
  ] as const)('%s enables the first real Model edit with the exact expected tuple', (_name, fields, mean, direction) => {
    const { wire, mapped } = seedMatchingValues(fields)
    const expected = { mean, effect_direction: direction }
    expect(mapped.data.serverStrength, 'the mapper must actually validate this tuple').toEqual(expected)
    expect(edgeStrengthEditIsAssertable(currentEdge())).toBe(false)
    const before = currentEdge()
    const unrelated = currentEdge(OTHER)
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    act(() => {
      expect(result.current.proposeEdgeStrength(EDGE, 0.8, { directionStated: false })).toBe('refused_unassertable')
    })
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(currentEdge()).toBe(before)

    act(() => {
      expect(mergeServerGraphOnHydrate(serverGraph(wire)).accepted).toBe(true)
    })
    expect(serverStatedStrengthOf(currentEdge().data)).toEqual(expected)
    expect(edgeStrengthEditIsAssertable(currentEdge())).toBe(true)
    expect(currentEdge().data).toMatchObject({
      weight: before.data!.weight, direction, userReviewedStrength: true,
      weightSource: before.data!.weightSource, directionSource: before.data!.directionSource,
    })
    expect(currentEdge().selected).toBe(true)
    expect(currentEdge(OTHER)).toBe(unrelated)

    const hydrated = useCanvasStore.getState().edges
    act(() => {
      const repeat = mergeServerGraphOnHydrate(serverGraph(wire))
      expect(repeat.updatedEdgeCount).toBe(0)
    })
    expect(useCanvasStore.getState().edges).toBe(hydrated)

    act(() => {
      expect(result.current.proposeEdgeStrength(EDGE, 0.8, { directionStated: false })).toBe('dispatched')
    })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const event = sendSystemEvent.mock.calls[0]?.[0]
    if (event?.type !== 'edge_strength_edit' || !event.payload) throw new Error('Expected strength edit payload')
    expect(event.payload).toEqual({
      from: FROM, to: TO, magnitude: 0.8, direction_intent: 'preserve', expected, intent: 'set',
    })
    expect(serverStatedStrengthOf(currentEdge().data), 'an unacknowledged local edit is not server authority').toEqual(expected)
    expect(currentEdge(OTHER)).toBe(unrelated)
  })
})

describe('unknown or invalid wire values do not manufacture first-edit authority', () => {
  it.each([
    ['no tuple', {}],
    ['mean only', { strength_mean: 0.5 }],
    ['direction only', { effect_direction: 'positive' }],
    ['contradictory direction', { strength_mean: 0.5, effect_direction: 'negative' }],
    ['out of contract range', { strength_mean: 1.5, effect_direction: 'positive' }],
    ['nonfinite mean', { strength_mean: Number.NaN, effect_direction: 'positive' }],
  ] as const)('%s remains unassertable after hydrate', (_name, fields) => {
    const { wire, mapped } = seedMatchingValues(fields)
    expect(mapped.data.serverStrength).toBeUndefined()
    act(() => { mergeServerGraphOnHydrate(serverGraph(wire)) })
    expect(serverStatedStrengthOf(currentEdge().data)).toBeNull()
    const before = currentEdge()
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    act(() => {
      expect(result.current.proposeEdgeStrength(EDGE, 0.8, { directionStated: false })).toBe('refused_unassertable')
    })
    expect(currentEdge()).toBe(before)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})

// ⛔ RETITLED 23 Sep (Codex 5798417040, #1913) from "receipt overlay retains its
// separate no-op policy". The receipt caller now passes
// `acquireServerStrengthOnNoop` too, so these cases pin the option-less
// PRIMITIVE only; the receipt's acquisition is witnessed in
// `mergeAppliedGraph.receiptServerStrength.spec.ts`.
describe('option-less overlayEdge primitive keeps a strict metadata no-op', () => {
  it('does not add server authority when only metadata would change', () => {
    const { wire } = seedMatchingValues({ strength_mean: 0.5, effect_direction: 'positive' })
    const before = currentEdge()
    expect(overlayEdge(before, wire)).toBe(before)
    expect(serverStatedStrengthOf(before.data)).toBeNull()
  })

  it('still carries a validated tuple alongside a real receipt value change', () => {
    const { wire } = seedMatchingValues({ strength_mean: 0.5, effect_direction: 'positive' })
    const next = overlayEdge(currentEdge(), { ...wire, strength_mean: 0.7 })
    expect(next.data.weight).toBe(0.7)
    expect(serverStatedStrengthOf(next.data)).toEqual({ mean: 0.7, effect_direction: 'positive' })
  })
})

describe('authority acquisition is not an analytical edit', () => {
  beforeEach(() => {
    __resetAppliedEditPulseForTests()
    vi.useFakeTimers()
  })
  afterEach(() => {
    __resetAppliedEditPulseForTests()
    vi.useRealTimers()
  })

  function seedCurrentAnalysis() {
    const fixture = seedMatchingValues({ strength_mean: 0.5, effect_direction: 'positive' })
    useCanvasStore.setState(state => ({
      edges: state.edges.map((edge): Edge<EdgeData> => {
        if (edge.id !== EDGE) return edge
        if (!edge.data) throw new Error('Expected mapped fixture edge data')
        return { ...edge, data: { ...edge.data, weightSource: 'user', directionSource: 'user' } }
      }),
      graphEditedSinceLastRun: false, analysisStateReady: true, analysisFreshnessDirty: false,
      highlightedNodes: new Set(), highlightedEdges: new Set(),
    }))
    return fixture
  }

  it('retains fresh analysis, undo history and user provenance without pulsing unchanged values', () => {
    const { wire } = seedCurrentAnalysis()
    const history = useCanvasStore.getState().history
    const beforeData = currentEdge().data
    const result = mergeServerGraphOnHydrate(serverGraph(wire))
    expect(result.accepted).toBe(true)
    expect(result.changed, 'the authority record is actually stored').toBe(true)
    expect(serverStatedStrengthOf(currentEdge().data)).toEqual({ mean: 0.5, effect_direction: 'positive' })
    expect.soft(currentEdge().data).toEqual({ ...beforeData, serverStrength: { mean: 0.5, effect_direction: 'positive' } })
    expect.soft(useCanvasStore.getState().history).toBe(history)
    expect.soft(useCanvasStore.getState()).toMatchObject({
      graphEditedSinceLastRun: false, analysisStateReady: true, analysisFreshnessDirty: false,
    })
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect.soft(useCanvasStore.getState().highlightedEdges.size).toBe(0)
    expect.soft(useCanvasStore.getState().highlightedNodes.size).toBe(0)
  })

  it('acquires a server-stated edge origin silently: no pulse, no undo entry, analysis stays fresh', () => {
    // R2 (C46): a canvas saved before `origin` was carried holds none; the read
    // does. Acquiring it is a record of what the server holds, exactly like the
    // strength tuple above: never a changed value the user must be shown.
    const { wire } = seedCurrentAnalysis()
    const history = useCanvasStore.getState().history
    expect(currentEdge().data?.origin).toBeUndefined()
    const result = mergeServerGraphOnHydrate(serverGraph({ ...wire, origin: 'repair' }))
    expect(result.accepted).toBe(true)
    expect(currentEdge().data?.origin).toBe('repair')
    expect.soft(useCanvasStore.getState().history).toBe(history)
    expect.soft(useCanvasStore.getState()).toMatchObject({
      graphEditedSinceLastRun: false, analysisStateReady: true, analysisFreshnessDirty: false,
    })
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect.soft(useCanvasStore.getState().highlightedEdges.size).toBe(0)
  })

  it('acquires a server-stated natural effect silently (#2107): no pulse, no undo entry, analysis stays fresh', () => {
    // The magnitude contract's size in the target's units (`provenance.natural_effect`)
    // is the server's record of the β the edge already carries. A canvas saved before
    // #2107 holds none; the first reload after MG PR1 serves acquires it. Like `origin`
    // and the strength tuple, that is never a changed value the user must be shown.
    const { wire } = seedCurrentAnalysis()
    const history = useCanvasStore.getState().history
    expect(currentEdge().data?.naturalEffect).toBeUndefined()
    // MG PR1's FINAL key names (#70 5846999581); read by #2107's reader after its key follow-up.
    const natural = {
      amount: 5, amount_unit: 'customers', per_source_change: 1, per_source_change_unit: 'switch',
      strength_mean: 0.5, strength_mean_frame: 'edge_strength',
    }
    const result = mergeServerGraphOnHydrate(serverGraph({ ...wire, provenance: { magnitude: 'olumi_estimate', natural_effect: natural } }))
    expect(result.accepted).toBe(true)
    expect(currentEdge().data?.naturalEffect).toEqual({
      amount: 5, unit: 'customers', perSourceChange: 1, sourceUnit: 'switch', strengthMean: 0.5, author: 'olumi_estimate',
    })
    expect.soft(useCanvasStore.getState().history).toBe(history)
    expect.soft(useCanvasStore.getState()).toMatchObject({
      graphEditedSinceLastRun: false, analysisStateReady: true, analysisFreshnessDirty: false,
    })
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect.soft(useCanvasStore.getState().highlightedEdges.size).toBe(0)
  })

  it('still invalidates, snapshots and pulses a genuine edge-value overwrite', () => {
    const { wire } = seedCurrentAnalysis()
    const result = mergeServerGraphOnHydrate(serverGraph({ ...wire, strength_mean: 0.7 }))
    expect(result.updatedEdgeCount).toBe(1)
    expect(currentEdge().data?.weight).toBe(0.7)
    expect(useCanvasStore.getState().history.past).toHaveLength(1)
    expect(useCanvasStore.getState()).toMatchObject({
      graphEditedSinceLastRun: true, analysisStateReady: false, analysisFreshnessDirty: true,
    })
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect([...useCanvasStore.getState().highlightedEdges]).toEqual([EDGE])
  })

  it('still invalidates an addition without inventing an overwritten value or pulse', () => {
    const { wire } = seedCurrentAnalysis()
    const history = useCanvasStore.getState().history
    const result = mergeServerGraphOnHydrate({
      nodes: [...NODES, { id: 'new-factor', kind: 'factor', label: 'New factor' }], edges: [wire, OTHER_WIRE],
    })
    expect(result.addedNodeCount).toBe(1)
    expect(useCanvasStore.getState().nodes.some(node => node.id === 'new-factor')).toBe(true)
    expect.soft(useCanvasStore.getState().history).toBe(history)
    expect(useCanvasStore.getState()).toMatchObject({
      graphEditedSinceLastRun: true, analysisStateReady: false, analysisFreshnessDirty: true,
    })
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect.soft(useCanvasStore.getState().highlightedEdges.size).toBe(0)
  })
})

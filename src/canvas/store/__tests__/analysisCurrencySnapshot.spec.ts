import { beforeEach, describe, expect, it } from 'vitest'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import { ANALYSIS_CURRENCY_KEYS, useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { captureAnalysisCurrency, restoreAnalysisCurrencyAfterRevert } from '../analysisCurrencySnapshot'

const ready: CEEAnalysisReady = { goal_node_id: 'g', options: [] }
const observed = { value: 0.5 }

beforeEach(() => {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    nodes: [
      { id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { observedState: { ...observed } } },
      { id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [{ id: 'e', source: 'f', target: 'g', data: { ...DEFAULT_EDGE_DATA, weight: 0.62 } }],
    ceeAnalysisReady: ready,
    ceeAnalysisReadyNodeIds: ['f', 'g'],
    analysisFreshnessDirty: false,
  })
})

describe('analysis currency snapshot — graph equality and object identity', () => {
  it('restored: an exact analytical revert restores every captured field by identity', () => {
    const snapshot = captureAnalysisCurrency()
    const store = useCanvasStore.getState()
    store.updateEdge('e', { data: { ...DEFAULT_EDGE_DATA, weight: 0.3 } })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    store.updateEdge('e', { data: { ...DEFAULT_EDGE_DATA, weight: 0.62 } })
    expect(restoreAnalysisCurrencyAfterRevert(snapshot)).toBe('restored')
    for (const key of ANALYSIS_CURRENCY_KEYS) {
      expect(useCanvasStore.getState()[key], key).toBe(snapshot.fields[key])
    }
    expect(useCanvasStore.getState().ceeAnalysisReady).toBe(ready)
  })

  it('graph_differs: an analytical edge edit leaves the current field objects untouched', () => {
    const snapshot = captureAnalysisCurrency()
    useCanvasStore.getState().updateEdge('e', { data: { ...DEFAULT_EDGE_DATA, weight: 0.3 } })
    const before = captureAnalysisCurrency().fields
    expect(restoreAnalysisCurrencyAfterRevert(snapshot)).toBe('graph_differs')
    for (const key of ANALYSIS_CURRENCY_KEYS) expect(useCanvasStore.getState()[key], key).toBe(before[key])
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBe(ready)
  })

  it('analysis_replaced: a value-equal NEW readiness object is preserved by identity', () => {
    const snapshot = captureAnalysisCurrency()
    const newer: CEEAnalysisReady = { ...ready }
    const newerIds = ['g', 'f']
    useCanvasStore.setState({ ceeAnalysisReady: newer, ceeAnalysisReadyNodeIds: newerIds, analysisFreshnessDirty: true })
    const before = captureAnalysisCurrency().fields
    expect(restoreAnalysisCurrencyAfterRevert(snapshot)).toBe('analysis_replaced')
    for (const key of ANALYSIS_CURRENCY_KEYS) expect(useCanvasStore.getState()[key], key).toBe(before[key])
    expect(useCanvasStore.getState().ceeAnalysisReady).toBe(newer)
    expect(useCanvasStore.getState().ceeAnalysisReadyNodeIds).toBe(newerIds)
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBe(ready)
  })

  it('cosmetic position, selection and label changes do not block restoration', () => {
    const snapshot = captureAnalysisCurrency()
    useCanvasStore.getState().updateEdge('e', { data: { ...DEFAULT_EDGE_DATA, weight: 0.3 } })
    useCanvasStore.getState().updateNode('f', { position: { x: 100, y: 200 }, selected: true, data: { label: 'Renamed' } })
    useCanvasStore.getState().updateEdge('e', { data: { ...DEFAULT_EDGE_DATA, weight: 0.62, label: 'Renamed link' } })
    expect(restoreAnalysisCurrencyAfterRevert(snapshot)).toBe('restored')
    expect(useCanvasStore.getState().ceeAnalysisReady).toBe(ready)
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 100, y: 200 })
    expect(useCanvasStore.getState().nodes[0].selected).toBe(true)
  })

  it('captured analytical values are copies, so nested mutation cannot alter the baseline', () => {
    const snapshot = captureAnalysisCurrency()
    const data = useCanvasStore.getState().nodes[0].data
    const currentObserved = data.observedState as { value: number }
    currentObserved.value = 0.9
    expect(snapshot.graph.nodes[0].data.observedState).toEqual(observed)
    expect(restoreAnalysisCurrencyAfterRevert(snapshot)).toBe('graph_differs')
  })

  it.each(['node_type', 'node_value', 'edge_endpoint', 'node_added', 'edge_removed'] as const)(
    'graph_differs uses the store taxonomy for %s', (change) => {
      const snapshot = captureAnalysisCurrency()
      const state = useCanvasStore.getState()
      if (change === 'node_type') state.updateNode('f', { type: 'goal' })
      if (change === 'node_value') state.updateNode('f', { data: { observedState: { value: 0.8 } } })
      if (change === 'edge_endpoint') state.updateEdge('e', { target: 'f' })
      if (change === 'node_added') useCanvasStore.setState({ nodes: [...state.nodes, { id: 'new', type: 'factor', position: { x: 0, y: 0 }, data: {} }] })
      if (change === 'edge_removed') useCanvasStore.setState({ edges: [] })
      const before = captureAnalysisCurrency().fields
      expect(restoreAnalysisCurrencyAfterRevert(snapshot)).toBe('graph_differs')
      for (const key of ANALYSIS_CURRENCY_KEYS) expect(useCanvasStore.getState()[key], key).toBe(before[key])
    },
  )
})

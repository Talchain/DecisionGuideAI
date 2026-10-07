import { ANALYSIS_CURRENCY_KEYS, useCanvasStore } from '../store'
import {
  ANALYTICAL_NODE_DATA_FIELDS,
  ANALYTICAL_EDGE_FIELDS,
  hasAnalyticalGraphChange,
  type AnalyticalGraphState,
} from '../domain/analyticalChange'

type CurrencyFields = Pick<ReturnType<typeof useCanvasStore.getState>, typeof ANALYSIS_CURRENCY_KEYS[number]>

export interface AnalysisCurrencySnapshot {
  readonly fields: CurrencyFields
  readonly graph: AnalyticalGraphState
}

/** Clone only the registry-backed analytical values; currency keeps its object identities. */
function analyticalData(data: unknown, fields: readonly string[]): Record<string, unknown> {
  const source = (data ?? {}) as Record<string, unknown>
  return structuredClone(Object.fromEntries(fields.map((key) => [key, source[key]])))
}

export function captureAnalysisCurrency(): AnalysisCurrencySnapshot {
  const state = useCanvasStore.getState()
  return {
    fields: Object.fromEntries(ANALYSIS_CURRENCY_KEYS.map((key) => [key, state[key]])) as CurrencyFields,
    graph: {
      nodes: state.nodes.map((node) => ({
        ...node, data: analyticalData(node.data, ANALYTICAL_NODE_DATA_FIELDS),
      })),
      edges: state.edges.map((edge) => ({
        ...edge, data: analyticalData(edge.data, ANALYTICAL_EDGE_FIELDS),
      })),
    },
  }
}

/** Only a proven revert to the original analytical graph can regain its currency. */
export function restoreAnalysisCurrencyAfterRevert(
  snapshot: AnalysisCurrencySnapshot,
): 'restored' | 'graph_differs' | 'analysis_replaced' {
  const state = useCanvasStore.getState()
  if (hasAnalyticalGraphChange(snapshot.graph, state)) return 'graph_differs'
  if (state.ceeAnalysisReady !== null && state.ceeAnalysisReady !== snapshot.fields.ceeAnalysisReady) {
    return 'analysis_replaced'
  }
  useCanvasStore.setState(snapshot.fields)
  return 'restored'
}

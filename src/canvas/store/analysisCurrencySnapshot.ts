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

/**
 * The Run a readiness describes: CEE's `graph_hash_at_run` + `computed_at`, both carried on `analysis_ready`.
 * Null when either is absent — never a guess.
 */
function runIdentityOf(ready: unknown): string | null {
  const r = ready as { graph_hash_at_run?: unknown; computed_at?: unknown } | null
  const hash = r?.graph_hash_at_run
  const at = r?.computed_at
  return typeof hash === 'string' && hash !== '' && typeof at === 'string' && at !== '' ? `${hash}\u0000${at}` : null
}

/**
 * A readiness that arrived after the snapshot describes a DIFFERENT Run. Bound to the Run's identity, never to the
 * object: CEE's refusal reply carries the user's current Run back as a new object (served witness draws 4a/4a-2,
 * UI d16ccc87, CEE a5d3b0e), and reading that as a replacement left a refused edit saying "Rerun — model changed".
 * An arrival without a readable identity counts as a replacement.
 */
export function analysisReplacedSince(snapshot: AnalysisCurrencySnapshot): boolean {
  const now = useCanvasStore.getState().ceeAnalysisReady
  const then = snapshot.fields.ceeAnalysisReady
  if (now === null || now === then) return false
  const nowRun = runIdentityOf(now)
  return nowRun === null || nowRun !== runIdentityOf(then)
}

/** Only a proven revert to the original analytical graph can regain its currency. */
export function restoreAnalysisCurrencyAfterRevert(
  snapshot: AnalysisCurrencySnapshot,
): 'restored' | 'graph_differs' | 'analysis_replaced' {
  const state = useCanvasStore.getState()
  if (hasAnalyticalGraphChange(snapshot.graph, state)) return 'graph_differs'
  if (analysisReplacedSince(snapshot)) return 'analysis_replaced'
  useCanvasStore.setState(snapshot.fields)
  return 'restored'
}

import type { V1CompleteData, V1LimitsResponse } from './types'
import { V1_LIMITS } from './types'

/**
 * SDK-style helpers for diagnostics and limits on top of the v1 transport layer.
 * These are internal helpers, not exported to the UI directly.
 */

export type SdkDiagnostics = {
  resumes: number
  trims: 0 | 1
  recovered_events: number
  correlation_id?: string
}

/**
 * Extract diagnostics snapshot from a COMPLETE event.
 * Returns undefined when no diagnostics payload is present.
 */
export function getDiagnosticsFromCompleteEvent(event: V1CompleteData): SdkDiagnostics | undefined {
  const d = event.diagnostics
  if (!d) return undefined

  return {
    resumes: typeof d.resumes === 'number' ? d.resumes : 0,
    trims: d.trims === 1 ? 1 : 0,
    recovered_events: typeof d.recovered_events === 'number' ? d.recovered_events : 0,
    correlation_id: typeof d.correlation_id === 'string' ? d.correlation_id : undefined,
  }
}

export type GraphCaps = {
  maxNodes: number
  maxEdges: number
  maxBodyKb?: number
}

/**
 * Normalise V1 limits response into simple graph caps.
 * Prefers top-level max_* fields and falls back to nested nodes/edges
 * and static V1_LIMITS when necessary.
 */
export function getGraphCaps(limits: V1LimitsResponse): GraphCaps {
  const maxNodes = typeof limits.max_nodes === 'number'
    ? limits.max_nodes
    : limits.nodes?.max ?? V1_LIMITS.MAX_NODES

  const maxEdges = typeof limits.max_edges === 'number'
    ? limits.max_edges
    : limits.edges?.max ?? V1_LIMITS.MAX_EDGES

  const maxBodyKb = typeof limits.max_body_kb === 'number'
    ? limits.max_body_kb
    : undefined

  return { maxNodes, maxEdges, maxBodyKb }
}

/**
 * Returns true when SCM-lite is explicitly enabled in flags.
 */
export function isScmLiteActive(limits: V1LimitsResponse): boolean {
  return limits.flags?.scm_lite === 1
}

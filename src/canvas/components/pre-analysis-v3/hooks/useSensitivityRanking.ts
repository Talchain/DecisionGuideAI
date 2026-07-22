/**
 * useSensitivityRanking — keeps store.preAnalysisSensitivity fresh while the
 * v3 panel is mounted, via PLoT's deterministic pre-analysis sensitivity
 * endpoint (same-origin proxy `${plotProxyBase}/v1/pre-analysis-sensitivity`,
 * liveness verified on staging 2026-06-10 with the existing payload builder).
 *
 * Behaviour:
 * - Debounced 500ms on a structural fingerprint (ids, kinds, connections) —
 *   value edits never refetch; structure changes do.
 * - The fetched fingerprint is stamped (ref): a payload is only treated as
 *   current when BOTH its factor ids match AND it was fetched for this exact
 *   structure. Edge-only changes (connect, rewire, delete a connection)
 *   therefore refetch — factor-id matching alone would keep serving influence
 *   computed for a different topology. A payload already in the store on
 *   mount (draft ingestion) is adopted for the current structure once.
 * - The graph is built by the existing V2 request builder (normalised ids);
 *   response influence keys are mapped back to canvas ids before storing.
 *   A response that lands after an abort (structure changed mid-flight) is
 *   discarded.
 * - On failure the store is left untouched: the stale-id guard in
 *   computeEstimateRanking degrades ranking to degree weighting, so a failed
 *   refresh can never surface a mismatched payload.
 *
 * Mounted only inside PreAnalysisPanelV3 — flag off means this never runs.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../../../store'
import { plotProxyBase } from '../../../../lib/config'
import { plotFetch } from '../../../../lib/plotFetch'
import { buildV2Request } from '../../../../adapters/plot/v2/adapter'
import type { PreAnalysisSensitivity } from '../../../../adapters/cee/types'
import { computeGraphFacts, kindOf } from '../selectors/graphFacts'
import { sensitivityMatchesGraph } from '../selectors/computeEstimateRanking'
import type { Node } from '@xyflow/react'
import type { Edge } from '@xyflow/react'

const DEBOUNCE_MS = 500

function structuralFingerprint(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): string {
  const n = nodes
    .map(x => `${x.id}:${kindOf(x)}`)
    .sort()
    .join('|')
  const e = edges
    .map(x => `${x.source}>${x.target}`)
    .sort()
    .join('|')
  return `${n}||${e}`
}

function remapKeys(
  record: Record<string, number>,
  reverse: Map<string, string>,
  composite: boolean,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(record)) {
    if (composite) {
      const [a, b] = key.split('::')
      out[`${reverse.get(a) ?? a}::${reverse.get(b) ?? b}`] = value
    } else {
      out[reverse.get(key) ?? key] = value
    }
  }
  return out
}

export function useSensitivityRanking(enabled: boolean): void {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const fingerprint = enabled ? structuralFingerprint(nodes, edges) : ''
  /** The structure the current store payload is known to belong to. */
  const stampedFingerprintRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || fingerprint === '') return

    const state = useCanvasStore.getState()
    const facts = computeGraphFacts(state.nodes)
    if (!facts.goalNode || facts.factorNodes.length === 0) return

    const existing = state.preAnalysisSensitivity
    const idsMatch =
      existing?.factor_influence != null &&
      sensitivityMatchesGraph(existing.factor_influence, facts.factorNodes)

    if (idsMatch) {
      // Adopt an unstamped payload (draft ingestion / first mount) for the
      // current structure exactly once; afterwards a fingerprint change
      // refetches even though factor ids still match (edge-only changes).
      if (stampedFingerprintRef.current === null) {
        stampedFingerprintRef.current = fingerprint
        return
      }
      if (stampedFingerprintRef.current === fingerprint) return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const current = useCanvasStore.getState()
        const { request, reverseIdMap } = buildV2Request(
          current.nodes as never,
          current.edges as never,
          [],
          facts.goalNode!.id,
        )
        const res = await plotFetch(`${plotProxyBase}/v1/pre-analysis-sensitivity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ graph: request.graph, goal_node_id: request.goal_node_id }),
          signal: controller.signal,
        })
        if (!res.ok) {
          if (import.meta.env.DEV) {
            console.warn('[pre-analysis-v3] sensitivity fetch failed:', res.status)
          }
          return
        }
        const body = (await res.json()) as PreAnalysisSensitivity
        // The structure may have changed while the body streamed in; a
        // cleanup-aborted request must not stamp or store a stale payload.
        if (controller.signal.aborted) return
        if (!body?.factor_influence) return
        const remapped: PreAnalysisSensitivity = {
          factor_influence: remapKeys(body.factor_influence, reverseIdMap, false),
          edge_influence: remapKeys(body.edge_influence ?? {}, reverseIdMap, true),
          method: body.method,
        }
        stampedFingerprintRef.current = fingerprint
        useCanvasStore.getState().setPreAnalysisSensitivity(remapped)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (import.meta.env.DEV) {
          console.warn('[pre-analysis-v3] sensitivity fetch error — degree fallback stays active:', err)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, fingerprint])
}

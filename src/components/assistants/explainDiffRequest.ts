/**
 * Maps a V5 applied-edit receipt into the request CEE's explain-diff route expects.
 *
 * ── WHY A MAPPER EXISTS AT ALL ──────────────────────────────────────────────
 * The two ends speak different vocabularies and neither can be changed cheaply:
 *
 *   the receipt card  { operation, target_id, before, after }
 *   the explain route { patch: { adds: {nodes, edges}, updates, removes } }
 *
 * Every V5 operation — `set_factor_value`, `add_constraint`, `adjust_edge_strength`
 * — modifies something that already exists. NONE of them is a node or edge ADD.
 * So every receipt maps into `updates[]`, and `adds`/`removes` are always empty.
 *
 * ── WHY THIS IS A SEPARATE, TESTED MODULE ───────────────────────────────────
 * CEE types `updates` as `z.array(z.any())`. A wrong mapping is therefore
 * ACCEPTED SILENTLY — no schema error, no red anywhere — and would surface only
 * as a vague or wrong explanation that reads like a bad model day. A permissive
 * schema is exactly where a mapping drifts unnoticed, so the shape is pinned in
 * explainDiffRequest.spec.ts rather than left implicit inside a component.
 *
 * ── WHAT IS DELIBERATELY NOT SENT ───────────────────────────────────────────
 * `brief` is omitted. It is optional upstream but carries a MINIMUM LENGTH, so
 * passing a short or synthesised string would earn a 400 rather than better
 * context. Only facts the card actually holds are sent.
 */
import type { V5GraphPatchBlock } from '../../canvas/conversation/types'

/** One entry in the route's `updates[]`. Mirrors the receipt, renamed to nothing. */
export interface ExplainDiffUpdate {
  target_id: string
  operation: V5GraphPatchBlock['operation']
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface ExplainDiffRequest {
  patch: {
    adds: { nodes: never[]; edges: never[] }
    updates: ExplainDiffUpdate[]
    removes: never[]
  }
  graph_summary?: { node_count: number; edge_count: number }
}

/** A single rationale as the server returns it. */
export interface ExplainDiffRationale {
  target: string
  why: string
  provenance_source?: string
}

export function buildExplainDiffRequest(
  block: V5GraphPatchBlock,
  graphSummary?: { node_count: number; edge_count: number },
): ExplainDiffRequest {
  return {
    patch: {
      adds: { nodes: [], edges: [] },
      updates: [
        {
          target_id: block.target_id,
          operation: block.operation,
          before: block.before,
          after: block.after,
        },
      ],
      removes: [],
    },
    ...(graphSummary ? { graph_summary: graphSummary } : {}),
  }
}

/**
 * Narrow an unknown server response to the rationales we will render.
 *
 * ⚠ THE POINT OF THIS FUNCTION IS TO REFUSE, NOT TO REPAIR.
 *
 * The version of this feature that shipped dark read `data.explanation` — a key
 * this route has never returned — and on `undefined` rendered the literal string
 * "No explanation available". That is a FALSE FAILURE REPORT: it tells the user
 * the server had nothing to say at the exact moment the server answered fully.
 * It is the mirror of the fabrication risk and just as damaging to trust.
 *
 * So: return the rationales when they are genuinely there and usable, and return
 * `null` otherwise. `null` means "we could not get an answer" and the caller must
 * say so plainly. There is deliberately no partial-credit path, no placeholder
 * text, and no client-side narrative — an invented explanation of a real edit to
 * the user's own model is worse than no explanation.
 */
export function parseExplainDiffResponse(data: unknown): ExplainDiffRationale[] | null {
  if (typeof data !== 'object' || data === null) return null
  const rationales = (data as { rationales?: unknown }).rationales
  if (!Array.isArray(rationales)) return null

  const usable = rationales.filter(
    (r): r is ExplainDiffRationale =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as ExplainDiffRationale).target === 'string' &&
      typeof (r as ExplainDiffRationale).why === 'string' &&
      (r as ExplainDiffRationale).why.trim().length > 0,
  )

  return usable.length > 0 ? usable : null
}

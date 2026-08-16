/**
 * Goal-threshold + goal-node resolvers.
 *
 * These are PURE functions with no transport, no store access and no React.
 * They lived inside `useV2Run.ts` until ROADMAP 2.1229 retired that hook along
 * with the direct browser→PLoT `/v2/run` seam — but their live consumers were
 * never the direct-run path:
 *
 *   - `resolveActiveGoalNodeId` — OutputsDock (canonical run affordance),
 *     DefineSuccessModal
 *   - `capForUnit` / `resolveChipGoalThreshold` — DefineSuccessModal, and the
 *     V5/canonical chip parameter boundary (UI-SEM-058 V5 leg)
 *   - `normaliseGoalThresholdForRequest` / `resolveGoalThresholdCap` /
 *     `resolveMeasureUnitCap` — the shared normalisation chain both legs use
 *
 * They are extracted rather than deleted for exactly that reason: deleting the
 * hook must not take the canonical path's resolvers with it. Behaviour is
 * unchanged — these bodies are moved verbatim.
 */

/**
 * UI-SEM-058: raw → normalised goal-threshold conversion for the PLoT request.
 *
 * store.goalThreshold holds USER UNITS by default (raw), but since Lane 5 its
 * representation is carried explicitly by store.goalThresholdRepresentation
 * ('raw' | 'normalised' | null) — a CEE bare-sync can store an already-0-1
 * value tagged 'normalised', in which case resolveChipGoalThreshold
 * short-circuits and never divides by a cap. PLoT's `goal_threshold` contract
 * is normalised 0-1 (adapter.ts request builder). Convert raw/cap when the CEE
 * cap exists.
 * Without a cap, raw ≡ normalised only when the value already lies in [0,1].
 * Anything that cannot be proven normalised is OMITTED (returns undefined)
 * so the request builder's own `analysisReady.goal_threshold` (already
 * normalised) stands — a missing threshold degrades to "no probability_of_goal",
 * never to a corrupt analysis. Format conversion only (same class as UI-SEM-001).
 */
export function normaliseGoalThresholdForRequest(
  raw: number | null | undefined,
  cap: unknown,
): number | undefined {
  if (raw == null || !Number.isFinite(raw)) return undefined
  const capNumber = typeof cap === 'number' && Number.isFinite(cap) && cap > 0 ? cap : null
  let normalised = capNumber != null ? raw / capNumber : raw
  // Floating-point guard: a threshold set exactly at the cap must normalise
  // to 1.0 even when the division lands one ULP above it — a legitimate
  // 100% target must never be dropped over the last bit of a float.
  if (normalised > 1 && normalised < 1 + 1e-9) normalised = 1
  if (normalised < 0 || normalised > 1) {
    console.warn(
      '[goalThresholdResolvers] goal threshold override omitted — cannot prove normalised form',
      { raw, cap: capNumber, normalised },
    )
    return undefined
  }
  return normalised
}

/**
 * Lane 5 (Codex P1) — the ONE goal-node resolution used for request
 * construction, cap lookup and threshold commitment across V2 and V5, so the
 * legs can never resolve different nodes. Precedence: the CEE-certified
 * `analysis_ready.goal_node_id`, then the store's `outcomeNodeId`, then the
 * first goal node — but each candidate is validated to EXIST in the current
 * graph, so a stale `outcomeNodeId` (retained across a scenario replacement)
 * is skipped rather than silently resolved to a reseeded-away id.
 *
 * Before this, the V2 cap used `outcomeNodeId` while the adapter + V5 chip
 * preferred `analysis_ready.goal_node_id`: with divergent ids and caps, V2
 * could normalise against one node's cap while the request named the other.
 */
export function resolveActiveGoalNodeId(state: {
  ceeAnalysisReady?: { goal_node_id?: string | null } | null
  outcomeNodeId?: string | null
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }>
}): string | null {
  const exists = (id: string | null | undefined): id is string =>
    !!id && state.nodes.some((n) => n.id === id)
  if (exists(state.ceeAnalysisReady?.goal_node_id)) return state.ceeAnalysisReady!.goal_node_id!
  if (exists(state.outcomeNodeId)) return state.outcomeNodeId!
  const goalNode = state.nodes.find(
    (n) => n.type === 'goal' || (n.data as { type?: string } | undefined)?.type === 'goal',
  )
  return goalNode?.id ?? null
}

/**
 * Resolve the goal-threshold scale cap for the request boundary using the
 * SAME fallback chain the display path uses (useResultsSectionData
 * goalThresholdCap: analysis_ready first, then the goal node's data — CEE
 * fields are spread onto the node by DraftChat). Without the node fallback
 * the two boundaries could disagree: the display would denormalise outcomes
 * against a node-held cap while the request boundary, blind to it, dropped
 * the user's threshold override.
 */
export function resolveGoalThresholdCap(
  analysisReady: { goal_threshold_cap?: unknown } | null,
  nodes: ReadonlyArray<{ id: string; data?: unknown }>,
  goalNodeId: string | null | undefined,
): number | undefined {
  const goalNode = goalNodeId ? nodes.find((n) => n.id === goalNodeId) : undefined
  const data = goalNode?.data as
    | { goal_threshold_cap?: unknown; threshold_cap?: unknown; scale_max?: unknown }
    | undefined
  for (const candidate of [
    analysisReady?.goal_threshold_cap,
    data?.goal_threshold_cap,
    data?.threshold_cap,
    data?.scale_max,
  ]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }
  return undefined
}

/**
 * UI-SEM-081 — unit-derived goal-threshold cap. A "%" unit stated by the USER
 * (Define-success unit picker / saved success measure) is a definitional cap
 * of 100 — user input, not fabrication. Every other unit has no definitional
 * scale, so no cap is invented (fail-closed omission stands). Consulted only
 * as the LAST resort after the producer/node cap chain (UI-SEM-058).
 */
export function capForUnit(unit: string | null | undefined): number | undefined {
  return typeof unit === 'string' && unit.trim() === '%' ? 100 : undefined
}

/**
 * UI-SEM-081 provenance guard (adversarial-review blocker fold): the saved
 * measure's unit may cap ONLY a store threshold that provably CAME from that
 * measure (identical raw value). The store field can hold values from other
 * writers in other scales — CEE-sync writes capless NORMALISED values into it
 * (store.ts bare-sync), and the field survives scenario switches while the
 * measure is scenario-keyed — so pairing the measure's "%" with a foreign
 * store value ships a silently wrong wire number (0.6 → 0.006, a 100× target
 * shrink). No provenance → no unit cap (fail closed).
 */
export function resolveMeasureUnitCap(
  measure: { threshold: number; unit: string } | null | undefined,
  rawThreshold: number | null | undefined,
): number | undefined {
  if (!measure || rawThreshold == null) return undefined
  return measure.threshold === rawThreshold ? capForUnit(measure.unit) : undefined
}

/**
 * UI-SEM-058 (V5 leg) — normalise a goal_threshold for a CANONICAL/V5 chip
 * parameter. The store holds RAW user units; the V5 path (buildPayload)
 * forwards chip parameters VERBATIM. So any chip that carries goal_threshold
 * must carry the NORMALISED 0-1 form, and OMIT it when normalisation cannot be
 * proven — a raw value on the V5 wire is silently ignored by PLoT while it
 * retains a stale target (Codex final-audit B3: entering 60% shipped
 * goal_threshold:60, HTTP 200, old 0.53 retained, all lenses unavailable).
 * Returns undefined → the caller must omit the parameter (fail closed), never
 * send raw.
 *
 * ctx.unitCap (UI-SEM-081) is consulted only when the producer/node chain
 * yields no cap — live staging drafts carry neither `goal_threshold_cap` nor
 * `scale_max`, which silently swallowed every %-unit target (V-P0-1,
 * 2026-07-13 wire evidence).
 *
 * ctx.representation (Lane 5, Codex P0-1) makes the value's UNITS EXPLICIT
 * rather than inferred from cap availability. A value tagged 'normalised'
 * (the store's bare-sync writes CEE's already-0-1 goal_threshold) is passed
 * through iff ∈[0,1] and NEVER divided by any cap — inferring "raw because a
 * cap exists" divided a normalised 0.6 by the node's cap 100 → 0.006. A
 * 'raw' or absent tag keeps the cap-chain conversion (backward compatible).
 */
export function resolveChipGoalThreshold(
  rawThreshold: number | null | undefined,
  ctx: {
    analysisReady: { goal_threshold_cap?: unknown } | null
    nodes: ReadonlyArray<{ id: string; data?: unknown }>
    goalNodeId: string | null | undefined
    unitCap?: number
    representation?: 'raw' | 'normalised' | null
  },
): number | undefined {
  // Lane 5: an explicitly-normalised value is already 0-1 — validate and
  // pass through, never apply a cap (cap division is a raw→normalised op).
  if (ctx.representation === 'normalised') {
    return normaliseGoalThresholdForRequest(rawThreshold, undefined)
  }
  const chainCap = resolveGoalThresholdCap(ctx.analysisReady, ctx.nodes, ctx.goalNodeId)
  const unitCap =
    typeof ctx.unitCap === 'number' && Number.isFinite(ctx.unitCap) && ctx.unitCap > 0
      ? ctx.unitCap
      : undefined
  return normaliseGoalThresholdForRequest(rawThreshold, chainCap ?? unitCap)
}

/**
 * THE ONE ASSUMED RELATIONSHIP WORTH RESOLVING NEXT (P4 — model-first elicitation).
 *
 * Pure: no I/O, no store read, no clock. A total function of (producer robustness
 * rows, canvas edges, node labels) — so it can be replayed over a captured
 * analysis and give the same answer.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A drafted model arrives with EVERY edge strength assumed: `DEFAULT_EDGE_DATA`
 * pins `weight: 0.5` and `USER_EDGE_DEFAULTS` pins `0.3`, neither carrying a
 * source stamp (`canvas/domain/edges.ts:368, :391` — "These numbers are
 * ASSUMPTIONS, not measurements"). The product already knows WHICH relationships
 * the result is sensitive to (`fragile_edges`, surfaced as a canvas badge and an
 * EdgePanel "NN% flip risk" line), and it already knows WHICH strengths nobody
 * set (`edgeValueSource`). Nothing joined the two, so a team was never told
 * which of its own assumptions to pin down first.
 *
 * This module is that join and NOTHING else. It mints no metric: among rows that
 * are BOTH decision-relevant AND still assumed, it selects the maximum of the
 * producer's existing `switch_probability` measurement.
 *
 * ── THE THREE AUTHORITIES THIS CONSUMES (none of them re-derived here) ──────
 *   1. WHICH EDGE MATTERS — `getFragileEdgeSwitchProbability`
 *      (`canvas/utils/fragileEdgeMatch.ts:101`). It owns the dual-format match
 *      (`edge_id` vs `from_id`/`to_id`), the visibility floor
 *      (`THRESHOLDS.FRAGILE_EDGE_FILTER`, UI-SEM-013), and — load-bearing — the
 *      rule that `marginal_switch_probability` is a DIFFERENT Monte Carlo and is
 *      NEVER a fallback for a rendered number. Calling that helper rather than
 *      reading `row.switch_probability` here is what keeps those three rules in
 *      ONE place; a local read would be a fourth copy of the floor.
 *   2. IS IT ASSUMED — the canvas's existing value and edge provenance:
 *      `edgeValueSource(data, 'weight')`, `provenanceDisplay`, and `origin`.
 *      A user-set strength is resolved. `ai_inferred` / `origin: 'ai'` remains
 *      provisional even when CEE supplied a numeric strength and therefore
 *      stamped `weightSource: 'cee'`. Edge creation provenance never overrides
 *      the more specific user value stamp, so an AI-created edge stops being
 *      eligible after the user sets its strength through the existing editor.
 *   3. WHICH ELIGIBLE EDGE COMES FIRST — `switch_probability` itself, BY VALUE.
 *      The ISL response model declares the score but makes NO ordering promise,
 *      and the producer returns enhanced rows in its edge-map insertion order.
 *
 *      ⚠ THIS REVERSES THE #704/#707 RULING THAT USED TO SIT HERE, AND THE
 *      REASON MATTERS MORE THAN THE VERDICT — otherwise the next lane reverts
 *      it. That ruling read: "ISL emits `fragile_edges` sorted descending by
 *      `switch_probability` (measured across all nine committed live captures).
 *      We preserve that order exactly and take the FIRST qualifying row. No
 *      `Math.max`, no re-sort." **Re-measured at staging `7153fbd7`, that
 *      sentence is TRUE INSIDE ITS OWN SCOPE and FALSE AS A GENERALISATION.**
 *      It was never a lie; it was a corpus that excluded the counter-examples.
 *
 *      Measured over EVERY committed JSON carrying `fragile_edges` (25 files;
 *      20 distinct arrays with ≥2 numeric rows, after collapsing the debug
 *      bundles that repeat one array at six JSON paths each):
 *        • THE NINE LIVE CAPTURES  — 10 arrays, 10 descending, 0 not.
 *        • EVERYTHING ELSE         — 10 arrays,  5 descending, 5 not.
 *      The nine are identified by the `factor_evppi` magnitude this same header
 *      cites below (26 rows), which lands on exactly nine files. So re-running
 *      the original measurement REPRODUCES the original answer — which is
 *      precisely why array position must stop being read as rank.
 *
 *      Two of those non-descending arrays change the ANSWER once the visibility
 *      floor (`THRESHOLDS.FRAGILE_EDGE_FILTER`, 0.15) is applied, i.e. the old
 *      `[0]` rule named a relationship that was NOT the most switch-prone one
 *      on screen:
 *        • `staging-bundles/olumi-debug-a4b32ee2-20260510.pre-fix.json`
 *          above-floor [0.22, 0.544, …, 0.548, 0.344] — took 0.22, max 0.548
 *        • `v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json`
 *          above-floor [0.164, 0.24, 0.213] — took 0.164, max 0.24
 *      ⚠ SCOPE, STATED PRECISELY: 2 of 17 above-floor arrays, not "about half".
 *      Non-descending is NOT the same claim as index-0-is-not-the-maximum —
 *      three further non-descending arrays (including the staging-real-shape
 *      capture, whose 0.084 sits BELOW the floor) still have their maximum at
 *      index 0 and are unaffected by this change. Correcting the rule is still
 *      right: an untruthful superlative does not need a high hit-rate to be
 *      untruthful, and nothing upstream bounds the rate.
 *
 *      So: take the MAXIMUM existing score among eligible rows, and use edge id
 *      only to make equal-score ties deterministic. The tie-break carries no
 *      scientific claim, and no new metric is minted — the value compared is the
 *      producer's own, unmodified.
 *
 * ── WHAT `switch_probability` ACTUALLY MEANS, AND WHAT THE COPY MAY THEREFORE
 *    CLAIM ──────────────────────────────────────────────────────────────────
 * Derived from the PRODUCER's own declaration, not from the field name
 * (ISL `src/models/response_v2.py:569-575`, staging `28fe0c95`), verbatim:
 *
 *     switch_probability — "Proportion of MC samples where alternative wins
 *     WHEN EDGE IS WEAK. 0.0 if same option wins (stable), null only if no data
 *     available."
 *
 * It is therefore a CONDITIONAL quantity: P(alternative wins | this edge weak).
 * It is NOT "the probability this edge flips the decision", and it is NOT an
 * isolating measure of this edge's own contribution — the isolating one is
 * `marginal_switch_probability` ("Probability of decision flip when ONLY this
 * edge varies", `:576-582`), which is a different sweep, is capped to the top 10
 * edges (`robustness_analyzer_v2.py:182 MARGINAL_MAX_EDGES`), and measured ZERO
 * in 83 of the 98 rows that carry it across the live captures — it cannot
 * single anything out.
 *
 * So the licensed sentence is the CONDITIONAL one — "if this link turns out to
 * be weak, the run lands on {alternative} in NN% of samples" — and the
 * prohibited one is any unconditional "this is the most important relationship"
 * or "this edge decides it". The conditional framing is not a hedge bolted on:
 * it is the correct description of a quantity computed by partitioning samples
 * on the edge being weak, and it happens to be exactly the right thing to say
 * about a strength NOBODY SET, because "we assumed this, and we do not know it
 * is not weak" is the user's actual epistemic position.
 *
 * ── WHY NOT `factor_evppi`, THE OBVIOUS CANDIDATE ───────────────────────────
 * Measured, not assumed. Across all nine committed captures, `factor_evppi`
 * carries 26 rows: 5 have a non-zero `evppi` and ALL 5 are `below_resolution`;
 * 2 are labelled `resolved` and BOTH have `evppi: 0`, `evppi_raw: 0`,
 * `noise_floor: 0`, and `baseline_max_expected_utility ===
 * conditional_max_expected_utility` exactly. ZERO rows are both resolved and
 * non-zero. Those two `resolved` labels are degenerate — ISL's test is
 * `abs(delta) < noise_floor`, and with a zero floor `abs(0) < 0` is false — so
 * ranking on them would name a factor whose measured decision value is exactly
 * nothing as "the single highest-value thing to resolve". Separately, EVPPI is
 * in OUTCOME units with no licensed rendering and ISL's science validation
 * states "EVPI user-facing language remains banned pending doctrine"
 * (`docs/science-validation/REPORT.md` §5, staging `28fe0c95`). Both roads are
 * closed; `factor_evppi`'s existing Resolve-next ranking is untouched by this
 * module.
 *
 * ── ABSENCE IS A VERDICT ────────────────────────────────────────────────────
 * Every refusal is NAMED. "No fragile edges above the floor" and "every fragile
 * edge's strength is already set" are DIFFERENT facts about the model and the
 * surface says different things about them — collapsing them would make a
 * well-specified model indistinguishable from an unanalysed one. And no refusal
 * ever licenses a denial: absent data means we say nothing, never "there is
 * nothing left to pin down" (the UI-SEM-060 doctrine — silence, not `'tied'`).
 */

import { getFragileEdgeSwitchProbability } from '../../../canvas/utils/fragileEdgeMatch'
import type { FragileEdgeCandidate } from '../../../canvas/utils/fragileEdgeMatch'
import { edgeValueSource } from '../../../canvas/domain/edgeValueProvenance'

/** The canvas edge shape this join needs. Structural, so callers pass store edges directly. */
export interface ElicitationCanvasEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown>
}

/**
 * Why no assumption was named. Closed enum — each member is a DIFFERENT fact
 * about the model, and the surface renders them differently.
 */
export type AssumedStrengthRefusal =
  /** No `fragile_edges` block at all — not computed, or no run yet. */
  | 'no_robustness_data'
  /** The block exists but nothing clears the visibility floor. */
  | 'no_fragile_edges'
  /** Fragile edges exist, but none has an unresolved assumed strength. */
  | 'all_strengths_set'
  /** Fragile rows exist but none matched a canvas edge we can name and focus. */
  | 'no_edge_identity'

/** The one named relationship. Identity-bearing, and carries only MEASURED values. */
export interface AssumedStrengthSelection {
  /** Canvas edge id — the focus target AND the address `setStrength` mutates. */
  readonly edgeId: string
  /** Canvas node labels. A row we cannot name is skipped, never id-shaped. */
  readonly fromLabel: string
  readonly toLabel: string
  /**
   * The producer's MEASURED `switch_probability`, above the floor. Conditional:
   * P(alternative wins | this edge weak). Never the marginal quantity.
   */
  readonly switchProbability: number
  /** ISL's "option that wins when edge is weak". `null` when the producer omitted it. */
  readonly alternativeWinnerLabel: string | null
  /** Existing graph provenance, reduced only to the two unresolved copy cases. */
  readonly strengthProvenance: 'ai_inferred' | 'missing'
}

export interface AssumedStrengthDecision {
  readonly selected: AssumedStrengthSelection | null
  readonly refusalReason: AssumedStrengthRefusal | null
  /**
   * How many fragile edges (above the floor, canvas-matched) still have an
   * assumed strength. `selected` has their highest measured switch probability. Drives
   * the "and N others" clause, so it counts the SAME population the selection
   * came from — never all edges, never all fragile rows.
   */
  readonly assumedFragileCount: number
}

export interface SelectAssumedStrengthInput {
  /** `report.robustness.fragile_edges`, as carried by the mapper. Unknown by design. */
  fragileEdges: unknown
  /** Canvas edges, for provenance and identity. */
  edges: readonly ElicitationCanvasEdge[]
  /** Node id → label. A node we cannot name yields a skipped row. */
  nodeLabels: ReadonlyMap<string, string>
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Whether this strength still needs human judgement.
 *
 * `weightSource` is field-specific, while `provenanceDisplay` / `origin` describe
 * how the edge entered the model. That fixes the precedence: a later user edit
 * resolves an AI-created edge, but merely drawing an edge does not resolve its
 * default strength, and a CEE numeric estimate does not resolve itself merely
 * because ingestion stamped `weightSource: 'cee'`.
 *
 * Unknown/older provenance keeps the previous absence-safe rule: only a
 * recognised value source counts as resolved. No new provenance is inferred.
 */
function unresolvedStrengthProvenance(
  data: Record<string, unknown> | undefined,
): AssumedStrengthSelection['strengthProvenance'] | null {
  const valueSource = edgeValueSource(data, 'weight')

  // The strength editor writes this field-specific stamp and deliberately
  // leaves the edge's creation origin intact. It therefore has precedence.
  if (valueSource === 'user') {
    return null
  }

  if (data?.provenanceDisplay === 'ai_inferred' || data?.origin === 'ai') {
    // Edge-creation provenance cannot prove a numeric strength was estimated.
    // The field-specific source does: `cee` means a producer supplied it; null
    // means the AI-created edge is still carrying a UI fallback/default.
    if (valueSource === 'cee') return 'ai_inferred'
    if (valueSource === null) return 'missing'
    return null
  }

  return valueSource === null ? 'missing' : null
}

/**
 * Resolve a producer row to a canvas edge. Dual-format, MIRRORING the matching
 * tier in `fragileEdgeMatch` rather than inventing a third convention:
 * `edge_id` first, then the `from_id`/`to_id` pair.
 */
function matchCanvasEdge(
  row: Record<string, unknown>,
  edges: readonly ElicitationCanvasEdge[],
): ElicitationCanvasEdge | null {
  const edgeId = nonEmptyString(row.edge_id) ?? nonEmptyString(row.edgeId)
  if (edgeId !== null) {
    const byId = edges.find((e) => e.id === edgeId)
    if (byId !== undefined) return byId
  }
  const from = nonEmptyString(row.from_id) ?? nonEmptyString(row.fromId)
  const to = nonEmptyString(row.to_id) ?? nonEmptyString(row.toId)
  if (from === null || to === null) return null
  return edges.find((e) => e.source === from && e.target === to) ?? null
}

/**
 * The one assumed relationship worth resolving next, or a NAMED refusal.
 * Total: every input shape returns a decision, and `selected === null` always
 * carries a reason.
 */
export function selectAssumedStrengthToResolve({
  fragileEdges,
  edges,
  nodeLabels,
}: SelectAssumedStrengthInput): AssumedStrengthDecision {
  if (!Array.isArray(fragileEdges) || fragileEdges.length === 0) {
    return { selected: null, refusalReason: 'no_robustness_data', assumedFragileCount: 0 }
  }

  let selected: AssumedStrengthSelection | null = null
  let assumedFragileCount = 0
  /** A row cleared the floor and matched a canvas edge — so the block is not vacuous. */
  let sawAnyFragibleAboveFloor = false
  /** A row cleared the floor but matched no nameable canvas edge. */
  let sawUnmatchedRow = false
  /** Canvas edges already counted — one edge is one assumption, however many rows name it. */
  const countedEdgeIds = new Set<string>()

  for (const raw of fragileEdges) {
    const row = readRecord(raw)
    if (row === null) continue

    const edge = matchCanvasEdge(row, edges)
    if (edge === null) {
      sawUnmatchedRow = true
      continue
    }

    // The floor, the dual-format match and the never-fall-back-to-marginal rule
    // all come from the ONE helper. `null` here means below the floor or not
    // measured — both "do not surface this row".
    // Pass THIS row only. Besides keeping the score bound to the row whose
    // identity/copy we carry, this prevents a duplicated edge row earlier in the
    // payload from lending its number to a later row.
    const measured = getFragileEdgeSwitchProbability(
      edge.id,
      edge.source,
      edge.target,
      [row as FragileEdgeCandidate],
    )
    // Producer contract is a probability in [0, 1]. A non-finite/out-of-range
    // wire value cannot license either a maximum or user-facing percentage.
    if (measured === null || !Number.isFinite(measured) || measured > 1) continue

    const fromLabel = nonEmptyString(nodeLabels.get(edge.source))
    const toLabel = nonEmptyString(nodeLabels.get(edge.target))
    if (fromLabel === null || toLabel === null) {
      // Nameable identity is a precondition for BOTH halves of the interaction:
      // the sentence names the relationship, and the user has to recognise it
      // to resolve it. An id-shaped label is not a name.
      sawUnmatchedRow = true
      continue
    }

    sawAnyFragibleAboveFloor = true

    // A CEE number is still provisional when the edge says AI inferred it.
    // Conversely, the field-specific user stamp wins over the edge's retained
    // AI creation origin after the existing editor writes the user's value.
    const strengthProvenance = unresolvedStrengthProvenance(edge.data)
    if (strengthProvenance === null) continue

    // COUNT DISTINCT EDGES, NOT ROWS. The producer may name one canvas edge in
    // more than one row (a repeated pair, or an `edge_id` row alongside its
    // from/to twin), and "and N others" is a claim about how many RELATIONSHIPS
    // still carry an unconfirmed strength. Counting rows would inflate it — and the
    // inflation would be invisible, because the sentence reads perfectly well
    // with a wrong number in it. Not reachable on observed data (nine captures,
    // zero duplicates), which is exactly why it needs pinning rather than
    // trusting: a producer change would make it reachable silently.
    if (!countedEdgeIds.has(edge.id)) {
      countedEdgeIds.add(edge.id)
      assumedFragileCount += 1
    }

    const candidate: AssumedStrengthSelection = {
      edgeId: edge.id,
      fromLabel,
      toLabel,
      switchProbability: measured,
      alternativeWinnerLabel:
        nonEmptyString(row.alternative_winner_label) ?? nonEmptyString(row.alternativeWinnerLabel),
      strengthProvenance,
    }
    if (
      selected === null ||
      candidate.switchProbability > selected.switchProbability ||
      (candidate.switchProbability === selected.switchProbability &&
        candidate.edgeId.localeCompare(selected.edgeId) < 0)
    ) {
      selected = candidate
    }
  }

  if (selected !== null) {
    return { selected, refusalReason: null, assumedFragileCount }
  }

  // Order matters: a model whose fragile strengths are all SET is a different
  // (and better) state than one whose rows we could not name.
  if (sawAnyFragibleAboveFloor) {
    return { selected: null, refusalReason: 'all_strengths_set', assumedFragileCount: 0 }
  }
  if (sawUnmatchedRow) {
    return { selected: null, refusalReason: 'no_edge_identity', assumedFragileCount: 0 }
  }
  return { selected: null, refusalReason: 'no_fragile_edges', assumedFragileCount: 0 }
}

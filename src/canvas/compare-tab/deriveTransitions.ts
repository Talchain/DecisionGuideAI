/**
 * Transition Derivation
 *
 * Pure function that derives Transition objects from consecutive
 * AnalysisSnapshot pairs. Handles both regular and cumulative
 * (synthetic first→latest) transitions.
 */
import type {
  AnalysisSnapshot,
  Transition,
  FactorSensitivitySummary,
  StructureComparison,
} from './types'
import {
  classifyGraphProjections,
  fieldDisplayLabel,
  formatChangeValue,
  NOT_COMPARABLE_VERDICT,
  UNCHARACTERISED_CHANGE_VERDICT,
  UNDETAILED_STRUCTURAL_VERDICT,
  NO_EDITS_SUMMARY,
  UNCHARACTERISED_SUMMARY,
  UNCHARACTERISED_CHANGE_SUMMARY,
  type GraphChangeKind,
  type GraphChangeVerdict,
} from './graphChangeDiff'

// ---------------------------------------------------------------------------
// Magnitude classification
// ---------------------------------------------------------------------------

function classifyMagnitude(delta: number): 'major' | 'refinement' | 'minor' {
  const abs = Math.abs(delta)
  if (abs >= 10) return 'major'
  if (abs >= 3) return 'refinement'
  return 'minor'
}

// ---------------------------------------------------------------------------
// Affected factors derivation
// ---------------------------------------------------------------------------

/** Factors whose elasticity rank changed by >=2 or elasticity changed by >20% */
function deriveAffectedFactors(
  fromFactors: FactorSensitivitySummary[],
  toFactors: FactorSensitivitySummary[],
): { ids: string[]; labels: string[] } {
  const ids = new Set<string>()
  const labelMap = new Map<string, string>()

  // Build rank maps
  const fromRank = new Map(fromFactors.map((f, i) => [f.id, i]))
  const toRank = new Map(toFactors.map((f, i) => [f.id, i]))
  const fromElasticity = new Map(fromFactors.map(f => [f.id, f.elasticity]))

  for (const factor of toFactors) {
    const prevRank = fromRank.get(factor.id)
    const prevElasticity = fromElasticity.get(factor.id)

    // Rank changed by 2+ positions
    if (prevRank !== undefined) {
      const currentRank = toRank.get(factor.id) ?? 0
      if (Math.abs(currentRank - prevRank) >= 2) {
        ids.add(factor.id)
        labelMap.set(factor.id, factor.label)
      }
    }

    // Elasticity changed by >20% relative
    if (prevElasticity !== undefined && prevElasticity !== 0) {
      const change = Math.abs(factor.elasticity - prevElasticity) / Math.abs(prevElasticity)
      if (change > 0.2) {
        ids.add(factor.id)
        labelMap.set(factor.id, factor.label)
      }
    }

    // New factor not in previous top list
    if (prevRank === undefined) {
      ids.add(factor.id)
      labelMap.set(factor.id, factor.label)
    }
  }

  const sortedIds = [...ids]
  return {
    ids: sortedIds,
    labels: sortedIds.map(id => labelMap.get(id) ?? id),
  }
}

// ---------------------------------------------------------------------------
// Deterministic anchor
// ---------------------------------------------------------------------------

function deriveDeterministicAnchor(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): string {
  const fromTop = from.topFactors[0]
  const toTop = to.topFactors[0]

  if (!toTop) return ''
  if (!fromTop) return `Based on: ${toTop.label} is the top influence factor`

  if (fromTop.id === toTop.id) {
    return `Based on: ${toTop.label} remained the top influence factor (elasticity ${toTop.elasticity.toFixed(2)})`
  }
  return `Based on: ${toTop.label} overtook ${fromTop.label} as the top influence factor`
}

// ---------------------------------------------------------------------------
// Structure change detection
// ---------------------------------------------------------------------------

/**
 * Can these two snapshots' `graphHash` values be compared at all?
 *
 * ⚠ HASH REGIMES NEVER COMPARE. A session snapshot's hash is the UI's
 * `generateGraphHash(nodes, edges)`; a persisted run's is CEE's
 * analysis-affecting `aag_v1` (`result.graph_hash_at_run`). Two hashes from
 * different regimes are ALWAYS unequal, so an unguarded `!==` would assert
 * "structure changed" on every transition from a rebuilt run into a
 * session-captured one — a claim about the user's model manufactured entirely
 * out of a provenance boundary. Absence is likewise not evidence: 55 of the
 * 773 live persisted runs carry no hash at all.
 */
function hashesAreComparable(from: AnalysisSnapshot, to: AnalysisSnapshot): boolean {
  return (
    from.graphHash != null &&
    to.graphHash != null &&
    from.source === to.source
  )
}

/**
 * The THREE-valued structure comparison (ROADMAP 2.113a slice 2).
 *
 * `Transition.structureChanged` is a boolean because a transition card only
 * ever *warns*; the side-by-side pair view has a row to fill, and "we could not
 * compare these two models" is a different answer from "they are the same".
 * Collapsing the two is how a provenance boundary becomes a claim about the
 * user's graph, which is the defect the regime guard above exists to stop.
 *
 * WHAT LICENSES WHAT:
 *  · `'changed'`        — a same-regime hash INEQUALITY, or a node/edge count
 *                         that differs with both ends measured.
 *  · `'unchanged'`      — ONLY a same-regime hash EQUALITY. Equal counts do
 *                         NOT license it: a rewired graph keeps its counts, so
 *                         "unchanged" from counts alone would be a claim the
 *                         evidence cannot support.
 *  · `'not_comparable'` — cross-regime, or a hash absent at either end
 *                         (`graph_hash_at_run` was absent in 55 of the 773
 *                         persisted runs measured for slice 1).
 *
 * `detectStructureChange` is defined as `=== 'changed'`, so the boolean the
 * existing transition cards render is unchanged by construction — there is one
 * regime rule in this file, not two.
 */
export function compareStructure(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): StructureComparison {
  // ROADMAP 2.578 — a pure projection of the ONE verdict. This function no
  // longer holds any evidence rules of its own; that is what stops the pair
  // view and the transition card answering differently about the same pair.
  return structureForChangeKind(classifyChange(from, to).kind)
}

/**
 * The projection itself, five verdict kinds onto three structure answers.
 *
 * Split out (ROADMAP 2.578 F1) so a caller that has already classified a pair
 * can obtain BOTH the verdict kind and the structure answer from ONE
 * classification — `deriveRunPairComparison` needs both, and calling
 * `classifyChange` twice would leave two derivations to keep in step. There is
 * still exactly one mapping in this file, which is the property that stops the
 * pair view and the transition card answering differently about the same pair.
 *
 * ⚠ THIS FUNCTION IS LOSSY BY DESIGN, and that is what the F1 review found:
 * two of its three outputs have more than one preimage, so copy written against
 * its RESULT cannot state a truth condition. Explanatory copy keys off the KIND.
 */
export function structureForChangeKind(kind: GraphChangeKind): StructureComparison {
  switch (kind) {
    case 'structural':
      return 'changed'
    case 'value_only':
    case 'unchanged':
      // The VALUES moved but the shape did not — and "did the structure change?"
      // is the only question this function answers.
      return 'unchanged'
    default:
      // `uncharacterised_change` lands here too, and deliberately: knowing that
      // something moved is not knowing that the SHAPE moved.
      return 'not_comparable'
  }
}

/**
 * THE ONE CHANGE CLASSIFICATION for a pair of runs. Every label on the Compare
 * surface reads this, and every piece of evidence is weighed here — there is no
 * second place that decides what changed.
 *
 * Evidence, strongest first:
 *  1. Cross-regime ⇒ nothing is comparable (the same guard `hashesAreComparable`
 *     applies to hashes: a session projection and a persisted one describe
 *     different things).
 *  2. A projection at BOTH ends ⇒ authoritative, with per-field before/after.
 *  3. No projection, but node/edge COUNTS measured at both ends and differing
 *     ⇒ genuinely structural, though we cannot name the elements.
 *  4. No projection, same-regime hashes that DIFFER ⇒ something changed;
 *     these are CONTENT hashes, so this is not a claim about shape.
 *  5. No projection, same-regime hashes that MATCH ⇒ unchanged (equal content
 *     implies equal shape — the sound direction).
 *  6. Otherwise ⇒ no claim.
 */
export function classifyChange(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): GraphChangeVerdict {
  if (from.source !== to.source) return NOT_COMPARABLE_VERDICT

  const projected = classifyGraphProjections(from.graphProjection, to.graphProjection)
  if (projected.kind !== 'not_comparable') return projected

  const countsDiffer =
    (from.nodeCount != null && to.nodeCount != null && from.nodeCount !== to.nodeCount) ||
    (from.edgeCount != null && to.edgeCount != null && from.edgeCount !== to.edgeCount)
  if (countsDiffer) return UNDETAILED_STRUCTURAL_VERDICT

  if (hashesAreComparable(from, to)) {
    return from.graphHash === to.graphHash
      ? { kind: 'unchanged', fieldChanges: [], membershipChanges: [] }
      : UNCHARACTERISED_CHANGE_VERDICT
  }

  return NOT_COMPARABLE_VERDICT
}

/**
 * T2b: a structure CHANGE is only claimable from a signal that was actually
 * measured at BOTH ends. Where no comparable signal exists the answer is
 * "no evidence of a change" — the same posture `robustnessChanged` already
 * takes — not "changed".
 */
function detectStructureChange(from: AnalysisSnapshot, to: AnalysisSnapshot): boolean {
  return compareStructure(from, to) === 'changed'
}

// ---------------------------------------------------------------------------
// Warning diffs
// ---------------------------------------------------------------------------

function deriveWarningDiffs(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): { resolved: string[]; introduced: string[] } {
  const fromSet = new Set(from.inferenceWarnings)
  const toSet = new Set(to.inferenceWarnings)
  return {
    resolved: from.inferenceWarnings.filter(w => !toSet.has(w)),
    introduced: to.inferenceWarnings.filter(w => !fromSet.has(w)),
  }
}

// ---------------------------------------------------------------------------
// E-value: lowest among affected edges
// ---------------------------------------------------------------------------

function findLowestEValue(
  snapshot: AnalysisSnapshot,
  affectedFactorIds: string[],
): { eValue: number | null; edgeLabel: string | null } {
  if (snapshot.edgeEValues.length === 0) return { eValue: null, edgeLabel: null }

  // If we have affected factors, prefer edges connected to them
  const affectedSet = new Set(affectedFactorIds)
  const relevant = affectedSet.size > 0
    ? snapshot.edgeEValues.filter(ev => {
        const parts = ev.edgeId.split('->')
        return parts.some(p => affectedSet.has(p))
      })
    : snapshot.edgeEValues

  const candidates = relevant.length > 0 ? relevant : snapshot.edgeEValues
  if (candidates.length === 0) return { eValue: null, edgeLabel: null }

  const lowest = candidates.reduce((a, b) => a.eValue < b.eValue ? a : b)
  return { eValue: lowest.eValue, edgeLabel: lowest.edgeLabel }
}

// ---------------------------------------------------------------------------
// Conditional winner for affected factors
// ---------------------------------------------------------------------------

function findConditionalWinner(
  snapshot: AnalysisSnapshot,
  affectedFactorIds: string[],
): string | null {
  if (snapshot.conditionalWinners.length === 0) return null
  const affectedSet = new Set(affectedFactorIds)
  const match = snapshot.conditionalWinners.find(cw => affectedSet.has(cw.factorId))
  if (!match) return null
  return match.condition
    ? `${match.condition}, ${match.winner} takes over`
    : null
}

// ---------------------------------------------------------------------------
// Build a single transition between two consecutive snapshots
// ---------------------------------------------------------------------------

/**
 * The card's one-line edit summary, derived from the graph verdict.
 *
 * ⚠ THE ASYMMETRY THIS ENCODES (ROADMAP 2.578). The scenario event log is
 * evidence of PRESENCE and never evidence of ABSENCE — an empty log is its
 * normal state on the deployed build even after a real edit (see the note in
 * `deriveEditSummary`). So:
 *  · "no edits" is published ONLY when the graph projection proves the two runs
 *    are identical — never because the log was quiet.
 *  · when the graph proves a change, the change list is authoritative and the
 *    log is not consulted at all.
 *  · when no projection exists, a POSITIVE log summary ("Accepted draft
 *    changes") is still worth showing — it asserts something happened — but the
 *    fabricated no-edit sentinel is suppressed, and the honest
 *    "could not be characterised" is shown instead.
 */
function deriveEditLines(verdict: GraphChangeVerdict, to: AnalysisSnapshot): string[] {
  if (verdict.kind === 'unchanged') return [NO_EDITS_SUMMARY]

  if (verdict.kind === 'value_only' || verdict.kind === 'structural') {
    const lines: string[] = []
    for (const c of verdict.membershipChanges) {
      lines.push(`${c.op === 'added' ? 'Added' : 'Removed'} ${c.element} "${c.label}"`)
    }
    for (const c of verdict.fieldChanges) {
      lines.push(
        `${c.label}: ${fieldDisplayLabel(c.field)} ${formatChangeValue(c.before)} → ${formatChangeValue(c.after)}`,
      )
    }
    return lines
  }

  // Something moved, but no graph survives to say what.
  if (verdict.kind === 'uncharacterised_change') {
    const logged = to.editSummary
    return logged && logged !== NO_EDITS_SUMMARY ? [logged] : [UNCHARACTERISED_CHANGE_SUMMARY]
  }

  // not_comparable
  const logged = to.editSummary
  if (logged && logged !== NO_EDITS_SUMMARY) return [logged]
  return [UNCHARACTERISED_SUMMARY]
}

function buildTransition(from: AnalysisSnapshot, to: AnalysisSnapshot): Transition {
  const delta = to.winnerProbability - from.winnerProbability
  const changeVerdict = classifyChange(from, to)
  const { ids: affectedFactorIds, labels: affectedFactorLabels } =
    deriveAffectedFactors(from.topFactors, to.topFactors)
  const { resolved, introduced } = deriveWarningDiffs(from, to)
  const { eValue, edgeLabel } = findLowestEValue(to, affectedFactorIds)

  const goalProbDelta = (from.goalProbability != null && to.goalProbability != null)
    ? to.goalProbability - from.goalProbability
    : null

  return {
    fromRunNumber: from.runNumber,
    toRunNumber: to.runNumber,
    magnitude: classifyMagnitude(delta),
    edits: deriveEditLines(changeVerdict, to),
    winnerProbDelta: delta,
    // T2b: a robustness CHANGE can only be claimed when both ends were
    // actually assessed. Comparing a null against a real label would report
    // "robustness changed" purely because one run had no robustness data.
    robustnessChanged: from.stabilityLabel != null
      && to.stabilityLabel != null
      && from.stabilityLabel !== to.stabilityLabel,
    robustnessFrom: from.stabilityLabel,
    robustnessTo: to.stabilityLabel,
    goalProbDelta,
    affectedFactorIds,
    affectedFactorLabels,
    deterministicAnchor: deriveDeterministicAnchor(from, to),
    changeVerdict,
    // Derived from the SAME verdict the edits line above reads — that identity
    // is the fix, not an implementation detail (ROADMAP 2.578).
    structureChanged: detectStructureChange(from, to),
    eValue,
    eValueEdge: edgeLabel,
    conditionalWinner: findConditionalWinner(to, affectedFactorIds),
    warningsResolved: resolved,
    warningsIntroduced: introduced,
    isCumulative: false,
    cumulativeCaveats: [],
    reason: null,
    aiContext: null,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Derive transitions from consecutive snapshot pairs */
export function deriveTransitions(snapshots: AnalysisSnapshot[]): Transition[] {
  if (snapshots.length < 2) return []
  const transitions: Transition[] = []
  for (let i = 1; i < snapshots.length; i++) {
    transitions.push(buildTransition(snapshots[i - 1], snapshots[i]))
  }
  return transitions
}

/**
 * Build the transition for an ARBITRARY ordered pair of runs (ROADMAP 2.113a
 * slice 2), indices into the same ordered snapshot list the tab renders.
 *
 * ⚠ WHY THIS IS NOT `buildTransition(a, b)` FOR A NON-ADJACENT PAIR. A
 * snapshot's `editSummary` describes the edits made since the run IMMEDIATELY
 * BEFORE it — that is how `deriveEditSummary` builds it, from the scenario
 * events between two consecutive run timestamps. Handing `buildTransition` a
 * pair three runs apart would print run B's *last-leg* edit summary under a
 * heading claiming it covers A→B: a true sentence attached to the wrong
 * interval, which is a fabrication even though every character of it is real.
 * So the edits for a span are the CONCATENATION of the per-leg summaries in
 * `(fromIndex, toIndex]` — the derivation `buildCumulativeTransition` already
 * used for first→latest, generalised rather than mirrored (CLAUDE.md trap 12).
 *
 * Returns null for an out-of-range or non-forward pair; an adjacent pair
 * returns exactly the plain pairwise card.
 */
export function buildRangeTransition(
  snapshots: AnalysisSnapshot[],
  fromIndex: number,
  toIndex: number,
): Transition | null {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return null
  if (fromIndex < 0 || toIndex > snapshots.length - 1) return null
  if (fromIndex >= toIndex) return null

  const base = buildTransition(snapshots[fromIndex], snapshots[toIndex])

  // Adjacent: there is nothing between the two runs, so there is no cumulative
  // caveat to make and the card is the ordinary pairwise one.
  const span = toIndex - fromIndex
  if (span === 1) return base

  const intermediates = span - 1
  const caveats: string[] = [
    `Includes ${intermediates} intermediate refinement${intermediates > 1 ? 's' : ''}`,
  ]

  // Legs strictly inside the range: each compares a snapshot with the one
  // before it, so the window starts at fromIndex + 1.
  const legs = snapshots.slice(fromIndex + 1, toIndex + 1)

  const flipCount = legs.filter((s, i) =>
    s.winnerId !== snapshots[fromIndex + i].winnerId
  ).length
  if (flipCount > 0) {
    caveats.push(`Result flipped ${flipCount === 1 ? 'once' : `${flipCount} times`}`)
  }

  // ROADMAP 2.578 — per-leg, through the ONE classifier. This used to be a
  // per-leg hash inequality, which is the same content-hash-as-structure defect
  // the pairwise path carried: every value-only edit in the span raised
  // "Structure changed during this period".
  const legVerdicts = legs.map((s, i) => classifyChange(snapshots[fromIndex + i], s))
  if (legVerdicts.some(v => v.kind === 'structural')) {
    caveats.push('Structure changed during this period')
  }

  return {
    ...base,
    // Each leg's lines, in span order — the same derivation the pairwise card
    // uses, so a leg cannot describe itself one way here and another way there.
    edits: legVerdicts.flatMap((v, i) => deriveEditLines(v, legs[i])),
    isCumulative: true,
    cumulativeCaveats: caveats,
  }
}

/** Build a synthetic cumulative transition from first to latest */
export function buildCumulativeTransition(snapshots: AnalysisSnapshot[]): Transition | null {
  if (snapshots.length < 3) return null // meaningless at 2 runs (same as prev)
  return buildRangeTransition(snapshots, 0, snapshots.length - 1)
}

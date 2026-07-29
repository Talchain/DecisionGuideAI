/**
 * Transition Derivation
 *
 * Pure function that derives Transition objects from consecutive
 * AnalysisSnapshot pairs. Handles both regular and cumulative
 * (synthetic first→latest) transitions.
 */
import type { AnalysisSnapshot, Transition, FactorSensitivitySummary } from './types'

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
 * T2b: a structure CHANGE is only claimable from a signal that was actually
 * measured at BOTH ends. Where no comparable signal exists the answer is
 * "no evidence of a change" — the same posture `robustnessChanged` already
 * takes — not "changed".
 */
function detectStructureChange(from: AnalysisSnapshot, to: AnalysisSnapshot): boolean {
  if (hashesAreComparable(from, to) && from.graphHash !== to.graphHash) return true
  if (from.nodeCount != null && to.nodeCount != null && from.nodeCount !== to.nodeCount) return true
  if (from.edgeCount != null && to.edgeCount != null && from.edgeCount !== to.edgeCount) return true
  return false
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

function buildTransition(from: AnalysisSnapshot, to: AnalysisSnapshot): Transition {
  const delta = to.winnerProbability - from.winnerProbability
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
    edits: to.editSummary ? [to.editSummary] : [],
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

/** Build a synthetic cumulative transition from first to latest */
export function buildCumulativeTransition(snapshots: AnalysisSnapshot[]): Transition | null {
  if (snapshots.length < 3) return null // meaningless at 2 runs (same as prev)

  const first = snapshots[0]
  const latest = snapshots[snapshots.length - 1]
  const base = buildTransition(first, latest)

  // Caveats from intermediate snapshots
  const caveats: string[] = []
  caveats.push(`Includes ${snapshots.length - 2} intermediate refinement${snapshots.length - 2 > 1 ? 's' : ''}`)

  // Check for any intermediate flips
  const flipCount = snapshots.slice(1).filter((s, i) =>
    s.winnerId !== snapshots[i].winnerId
  ).length
  if (flipCount > 0) {
    caveats.push(`Result flipped ${flipCount === 1 ? 'once' : `${flipCount} times`}`)
  }

  // Check for any structure changes. Same regime guard as the pairwise case —
  // a cross-source or absent-ended hash pair is no evidence, not a change.
  const structureChanged = snapshots.slice(1).some((s, i) =>
    hashesAreComparable(snapshots[i], s) && s.graphHash !== snapshots[i].graphHash
  )
  if (structureChanged) {
    caveats.push('Structure changed during this period')
  }

  // Collect all edits across all transitions
  const allEdits = snapshots.slice(1).map(s => s.editSummary).filter(Boolean)

  return {
    ...base,
    edits: allEdits,
    isCumulative: true,
    cumulativeCaveats: caveats,
  }
}

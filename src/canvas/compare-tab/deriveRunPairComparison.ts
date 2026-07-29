/**
 * Pick-two-runs comparison — ROADMAP 2.113a slice 2.
 *
 * Pure derivation over TWO `AnalysisSnapshot`s. Every value it produces comes
 * from two persisted facts, one on each side; there is no baseline, no default
 * and no re-derivation anywhere in this file.
 *
 * THE THREE RULES THIS MODULE ENFORCES
 * ------------------------------------------------------------------
 * 1. **A delta needs two measurements.** An option or factor present on only
 *    one side gets `presence: 'only_from' | 'only_to'` and `delta*: null` —
 *    never a subtraction against an implied 0. That is the draft-variance case
 *    (ROADMAP 2.127): two runs of the same scenario may score different option
 *    or factor sets. Measured live 2026-07-29: **0 of 83** consecutive owned
 *    run pairs differ today, so this is producer-drift insurance rather than a
 *    case a tester will hit — implemented and pinned because the alternative
 *    is a fabricated baseline the moment 2.127 makes it reachable.
 *
 * 2. **Leader language is QUOTED, never derived.** Each side's claim comes
 *    from that run's own `leaderVerdict` (`src/lib/decisionVerdict.ts`, the one
 *    module entitled to produce it), not from `winnerId` — which is a
 *    client-side argmax and exactly the "Authority 3" that module deleted. A
 *    run whose producer sent no applicable signal is `'unclaimed'`: SILENCE,
 *    never a denial, and never a comparison.
 *
 * 3. **Hash regimes never compare.** Structure goes through `compareStructure`,
 *    the single regime rule in `deriveTransitions.ts`, which refuses a
 *    cross-source or absent-ended pair with `'not_comparable'`.
 */
import type {
  AnalysisSnapshot,
  FactorDelta,
  LeaderClaim,
  OptionDelta,
  RunPairComparison,
} from './types'
import { compareStructure } from './deriveTransitions'

// ---------------------------------------------------------------------------
// Leader claim — quoted from the run's own verdict
// ---------------------------------------------------------------------------

/**
 * What THIS run's producer entitles us to say about its leading option.
 *
 * Note the last guard: an entitled verdict whose `leaderId` is not among the
 * run's own options cannot be NAMED, and a leader we cannot name must not be
 * announced. It falls to `'unclaimed'` (silence) rather than rendering a bare
 * id or an empty label — the "Calibrate ␣" class of defect this estate has
 * already paid for once.
 */
export function deriveLeaderClaim(snapshot: AnalysisSnapshot): LeaderClaim {
  const verdict = snapshot.leaderVerdict

  if (verdict.hasLeadingOption && verdict.leaderId != null) {
    const option = snapshot.options.find(o => o.id === verdict.leaderId)
    if (option != null && option.label.length > 0) {
      return { kind: 'named', optionId: option.id, label: option.label }
    }
    return { kind: 'unclaimed', optionId: null, label: null }
  }

  // `'tied'` is the producer's own "no clear leading option". `'unknown'` is
  // its silence — and `decisionVerdict`'s doctrine is that silence licenses no
  // claim in EITHER direction, so it must not collapse into 'tied'.
  if (verdict.separation === 'tied') {
    return { kind: 'tied', optionId: null, label: null }
  }
  return { kind: 'unclaimed', optionId: null, label: null }
}

// ---------------------------------------------------------------------------
// Option deltas — union, matched by option id
// ---------------------------------------------------------------------------

function deriveOptionDeltas(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): OptionDelta[] {
  const fromById = new Map(from.options.map(o => [o.id, o]))
  const toById = new Map(to.options.map(o => [o.id, o]))

  const ids: string[] = []
  for (const o of to.options) ids.push(o.id)
  for (const o of from.options) if (!toById.has(o.id)) ids.push(o.id)

  const rows = ids.map((id): OptionDelta => {
    const a = fromById.get(id) ?? null
    const b = toById.get(id) ?? null

    if (a != null && b != null) {
      return {
        optionId: id,
        // The later run's label leads: the pair is presented chronologically,
        // so the current name is the one the user is looking at now. A rename
        // is disclosed rather than dropped.
        label: b.label,
        previousLabel: a.label !== b.label ? a.label : null,
        fromProbability: a.winProbability,
        toProbability: b.winProbability,
        deltaPp: b.winProbability - a.winProbability,
        presence: 'both',
      }
    }

    const only = (a ?? b)!
    return {
      optionId: id,
      label: only.label,
      previousLabel: null,
      fromProbability: a != null ? a.winProbability : null,
      toProbability: b != null ? b.winProbability : null,
      // ⚠ NEVER a number here. `b - 0` would publish the later run's whole
      // probability as a "gain" against a run that never scored this option.
      deltaPp: null,
      presence: a != null ? 'only_from' : 'only_to',
    }
  })

  // Strongest first, on whichever side measured it — an ordering, not a claim.
  return rows.sort((x, y) => strongest(y) - strongest(x))
}

function strongest(row: OptionDelta): number {
  return Math.max(row.toProbability ?? -Infinity, row.fromProbability ?? -Infinity)
}

// ---------------------------------------------------------------------------
// Factor deltas — union of the two runs' TOP factors, matched by factor id
// ---------------------------------------------------------------------------
//
// ⚠ THIS SECTION READS NO RAW CLAIM FIELD, DELIBERATELY. `elasticity` /
// `sensitivity_score` are a registered claim family with NO owner selector, so
// their debt is frozen shrink-only and a NEW raw read is a hard RED in
// `claim-ownership.drift.spec.ts`. The first draft of this module read
// `.elasticity` five times and the gate caught it — correctly. The compliant
// route, quoted from `elasticityClaimDebt.ts`, is "consume an already-derived
// value from a surface that has one": each run's `topFactors` is ALREADY sorted
// by |elasticity| descending (`extractTopFactors`), so a factor's POSITION in
// that list is that run's own influence ranking. Comparing two positions makes
// no normalisation, sign or threshold choice — which is exactly what an unowned
// family cannot sanction a consumer to make.

/** 1-indexed rank of each factor within its own run's top list. */
function rankMap(snapshot: AnalysisSnapshot): Map<string, number> {
  return new Map(snapshot.topFactors.map((f, i) => [f.id, i + 1]))
}

function deriveFactorDeltas(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): FactorDelta[] {
  const fromRanks = rankMap(from)
  const toRanks = rankMap(to)
  const labels = new Map<string, string>()
  for (const f of from.topFactors) labels.set(f.id, f.label)
  for (const f of to.topFactors) labels.set(f.id, f.label)

  const ids: string[] = []
  for (const f of to.topFactors) ids.push(f.id)
  for (const f of from.topFactors) if (!toRanks.has(f.id)) ids.push(f.id)

  const rows = ids.map((id): FactorDelta => {
    const a = fromRanks.get(id) ?? null
    const b = toRanks.get(id) ?? null
    const label = labels.get(id) ?? id

    if (a != null && b != null) {
      return {
        factorId: id,
        label,
        fromRank: a,
        toRank: b,
        // Positive = moved UP the influence order (rank 3 → 1 is +2 places).
        rankDelta: a - b,
        presence: 'both',
      }
    }

    return {
      factorId: id,
      label,
      fromRank: a,
      toRank: b,
      // A factor that ENTERED or LEFT the top list has no before-or-after
      // position to subtract. It is a MEMBERSHIP change, reported as one.
      rankDelta: null,
      presence: a != null ? 'only_from' : 'only_to',
    }
  })

  return rows.sort((x, y) => bestRank(x) - bestRank(y))
}

/** Best (lowest) rank the factor reached on either side — an ordering, not a claim. */
function bestRank(row: FactorDelta): number {
  return Math.min(row.toRank ?? Infinity, row.fromRank ?? Infinity)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two runs. `from` is the EARLIER run and `to` the later one — the
 * caller (`CompareTabBody`) normalises the user's pick chronologically so that
 * every delta on the screen has the same sign convention as the rest of the
 * tab (later minus earlier).
 */
export function deriveRunPairComparison(
  from: AnalysisSnapshot,
  to: AnalysisSnapshot,
): RunPairComparison {
  const fromLeader = deriveLeaderClaim(from)
  const toLeader = deriveLeaderClaim(to)

  // A leader CHANGE is only claimable when both runs named one. Two runs that
  // both declined to name a leader have no leader to report as unchanged, and
  // a named-vs-unclaimed pair is a change in what the PRODUCER would say, not
  // a measured change in the model.
  const leaderChange: RunPairComparison['leaderChange'] =
    fromLeader.kind === 'named' && toLeader.kind === 'named'
      ? (fromLeader.optionId === toLeader.optionId ? 'unchanged' : 'changed')
      : 'not_comparable'

  const fromWarnings = new Set(from.inferenceWarnings)
  const toWarnings = new Set(to.inferenceWarnings)

  return {
    from,
    to,
    options: deriveOptionDeltas(from, to),
    factors: deriveFactorDeltas(from, to),
    structure: compareStructure(from, to),
    fromLeader,
    toLeader,
    leaderChange,
    // T2b: both ends or nothing. A goal probability is absent on every live
    // persisted run measured (0 of 2,850 option entries carry one), so this is
    // null in practice and the row renders "Not assessed" on both sides.
    goalProbabilityDeltaPp:
      from.goalProbability != null && to.goalProbability != null
        ? to.goalProbability - from.goalProbability
        : null,
    fromEvidenceCoverage: from.evidenceCoverage,
    toEvidenceCoverage: to.evidenceCoverage,
    warningsResolved: from.inferenceWarnings.filter(w => !toWarnings.has(w)),
    warningsIntroduced: to.inferenceWarnings.filter(w => !fromWarnings.has(w)),
  }
}

/**
 * `LeaderClaim` — the ONE derivation entitled to turn a run's verdict into
 * something a surface may SAY (ROADMAP 2.835).
 *
 * ## Why this is its own module
 *
 * It began inside `deriveRunPairComparison`, serving the pick-two-runs table.
 * ROADMAP 2.835 retired the client-side ARGMAX trio
 * (`winnerId` / `winnerLabel` / `winnerProbability`) as a display source across
 * the whole Compare tab, so the hero sentence, the dot progression, the
 * trajectory chart and the transition deltas all need this same answer — and
 * `deriveTransitions` is imported BY `deriveRunPairComparison`, so leaving it
 * there would have made the two modules mutually importing.
 *
 * A shared rule that SIX modules quote belongs in one place they can all reach
 * without a cycle — `Hero`, `DotProgression`, `TrajectorySection`,
 * `deriveCompareState`, `deriveRunPairComparison` and `deriveTransitions`.
 * That is the whole point: sixteen modules once classified a leader for
 * themselves (`src/lib/decisionVerdict.ts` header), and this tab is not
 * becoming the seventeenth.
 */
import type { AnalysisSnapshot, LeaderClaim } from './types'

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
      // ROADMAP 2.835 — the probability comes from the SAME option object the
      // label came from, so the name and the number this surface prints cannot
      // describe two different options. It is not re-derived and there is no
      // fallback: an option the producer never scored was already dropped by
      // `extractOptions`, so it is not findable here at all and the claim falls
      // to 'unclaimed' below. That is what makes the old
      // `win_probability ?? 0` unreachable rather than merely handled.
      return {
        kind: 'named',
        optionId: option.id,
        label: option.label,
        winProbability: option.winProbability,
      }
    }
    return { kind: 'unclaimed', optionId: null, label: null, winProbability: null }
  }

  // `'tied'` is the producer's own "no clear leading option". `'unknown'` is
  // its silence — and `decisionVerdict`'s doctrine is that silence licenses no
  // claim in EITHER direction, so it must not collapse into 'tied'.
  if (verdict.separation === 'tied') {
    return { kind: 'tied', optionId: null, label: null, winProbability: null }
  }
  return { kind: 'unclaimed', optionId: null, label: null, winProbability: null }
}

/**
 * One run's probability FOR A NAMED OPTION — the only way this tab reads a
 * win probability out of a run other than its own leader claim (ROADMAP 2.835).
 *
 * ⚠ WHY THIS EXISTS RATHER THAN `snapshot.winnerProbability`. Every series and
 * delta on this tab compares "the leader" across runs, and the retired argmax
 * gave each run its OWN winner — so a row labelled with the latest run's leader
 * plotted earlier runs' *different* options along it, and a delta subtracted
 * one option's probability from another's. Both read as one option's
 * trajectory. Binding to an explicit `optionId` makes the comparison
 * identity-matched, the same rule `deriveOptionDeltas` already enforces.
 *
 * Returns null when that run did not score the option — never 0. Absence on
 * one side is not a measurement of zero on that side.
 */
export function optionProbabilityIn(
  snapshot: AnalysisSnapshot,
  optionId: string | null,
): number | null {
  if (optionId == null) return null
  const option = snapshot.options.find(o => o.id === optionId)
  return option != null ? option.winProbability : null
}

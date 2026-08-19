/**
 * Compare Tab State Machine
 *
 * Pure function deriving the current CompareState from snapshots
 * and graph staleness. No side effects.
 *
 * Precedence: stale > flipped > noWinner > unclaimed > converged > improving
 *
 * ## ROADMAP 2.835 — this file used to be a SEVENTEENTH leader authority
 *
 * `src/lib/decisionVerdict.ts` exists because a repo-wide sweep found sixteen
 * live modules each classifying a leader verdict for themselves, across six
 * mutually-inconsistent "too close to call" thresholds. This function was one
 * of them, and it decided which sentence the hero prints:
 *
 *     if (previous.winnerId !== latest.winnerId) return 'flipped'
 *     if (Math.abs(latest.winnerProbability - (latest.runnerUpProbability ?? 0)) < 10)
 *       return 'noWinner'
 *
 * Both predicates read the client-side ARGMAX — the "Authority 3" that module
 * deleted — and both fabricated their inputs:
 *
 *   · `winnerId` is `winner?.option_id ?? ''`, so a run the producer did not
 *     score compared as `''`. Against a scored run that is an INEQUALITY, and
 *     the tab announced "Result changed: X now leads at N%" about a run in
 *     which nothing was measured.
 *   · `winnerProbability` was `(winner?.win_probability ?? 0) * 100`, and the
 *     `?? 0` on the runner-up completed the pair. Two unscored options gave
 *     `|0 - 0| = 0 < 10` — so the arm that DENIES a leader ("No clear leading
 *     option") was selected by two numbers nobody produced.
 *
 * The thresholds were the smaller problem. The `10` here duplicated PLoT's own
 * `computeNearTie` threshold of 0.10, so the UI was re-answering, from
 * fabricated inputs, a question the producer had already answered on the wire.
 *
 * Every predicate below now quotes `deriveLeaderClaim` / `leaderVerdict`. The
 * one rule that matters: **a state whose copy makes a leader claim may only be
 * selected when the producer entitled us to make it.**
 */
import type { AnalysisSnapshot, CompareState } from './types'
import { deriveLeaderClaim, optionProbabilityIn } from './leaderClaim'

/** Below this, three runs agreeing on one leader count as converged. */
const CONVERGED_MAX_MOVEMENT_PP = 3

export function deriveCompareState(
  snapshots: AnalysisSnapshot[],
  graphIsStale: boolean,
): CompareState {
  if (snapshots.length < 2) return 'improving' // caller should show empty state

  if (graphIsStale) return 'stale'

  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots[snapshots.length - 2]
  const latestClaim = deriveLeaderClaim(latest)
  const previousClaim = deriveLeaderClaim(previous)

  // Flipped outranks noWinner: a flip is the most psychologically significant
  // event. It is claimable only when BOTH runs NAMED a leader — the same rule
  // `deriveRunPairComparison.leaderChange` already enforces for the pair view,
  // so the two surfaces cannot disagree about whether the leader moved. A
  // named-vs-unclaimed pair is a change in what the PRODUCER would say, not a
  // measured change in the model, and must not be announced as one.
  if (
    latestClaim.kind === 'named'
    && previousClaim.kind === 'named'
    && latestClaim.optionId !== previousClaim.optionId
  ) {
    return 'flipped'
  }

  // No clear winner — the PRODUCER's own tie verdict, and nothing else.
  //
  // ⚠ `separation === 'tied'`, never `!hasLeadingOption`. The latter is also
  // true of `'unknown'`, which is the producer's SILENCE; this arm's copy
  // DENIES a leading option, and a denial is a claim. Silence licenses no
  // claim in either direction (decisionVerdict.ts, CEE #711), so it falls
  // through to `'unclaimed'` below.
  if (latest.leaderVerdict.separation === 'tied') return 'noWinner'

  // Nothing nameable. Every remaining state's copy names a leader, so this is
  // where a run the producer said nothing about has to stop.
  if (latestClaim.kind !== 'named') return 'unclaimed'

  // Converged: the last 3 runs agree on the leader and its own probability
  // barely moved. Both halves are identity-bound to `latestClaim.optionId` —
  // "the same option, measured three times", not "each run's own best option",
  // which is what made the old `winnerId`/`winnerProbability` version compare
  // different options across the window.
  if (snapshots.length >= 3) {
    const lastThree = snapshots.slice(-3)
    const allSameLeader = lastThree.every(s => {
      const claim = deriveLeaderClaim(s)
      return claim.kind === 'named' && claim.optionId === latestClaim.optionId
    })
    if (allSameLeader) {
      const series = lastThree.map(s => optionProbabilityIn(s, latestClaim.optionId))
      // A movement needs two measurements. If any run in the window did not
      // score the leader, convergence is not something this data can show.
      if (series.every((v): v is number => v != null)) {
        const maxDelta = Math.max(
          ...series.slice(1).map((v, i) => Math.abs(v - series[i]!)),
        )
        if (maxDelta < CONVERGED_MAX_MOVEMENT_PP) return 'converged'
      }
    }
  }

  return 'improving'
}

/**
 * Is a flip narrow enough that the hero should counsel care?
 *
 * ROADMAP 2.835: this was a third copy of the same fabricated 10pp predicate
 * (`|winnerProbability - (runnerUpProbability ?? 0)| < 10`). The producer
 * already grades exactly this — `separation` is `'clear'` when the leader is
 * well ahead and `'slight'` when the margin is modest — so the UI quotes that
 * band instead of re-deriving one from numbers it may not have.
 *
 * Note the fail-closed direction: `'unknown'` is not narrow. This is only
 * reached from the `'flipped'` arm, which already requires a named claim on
 * both sides, so an unentitled verdict cannot get here at all.
 */
export function isNarrowFlip(latest: AnalysisSnapshot): boolean {
  return latest.leaderVerdict.separation === 'slight'
}

/**
 * Compare Tab State Machine
 *
 * Pure function deriving the current CompareState from snapshots
 * and graph staleness. No side effects.
 *
 * Precedence: stale > flipped > noWinner > converged > improving
 */
import type { AnalysisSnapshot, CompareState } from './types'

export function deriveCompareState(
  snapshots: AnalysisSnapshot[],
  graphIsStale: boolean,
): CompareState {
  if (snapshots.length < 2) return 'improving' // caller should show empty state

  if (graphIsStale) return 'stale'

  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots[snapshots.length - 2]

  // Flipped outranks noWinner: a flip is the most psychologically significant event
  if (previous.winnerId !== latest.winnerId) return 'flipped'

  // No clear winner: top options within 10pp
  if (Math.abs(latest.winnerProbability - (latest.runnerUpProbability ?? 0)) < 10) {
    return 'noWinner'
  }

  // Converged: last 3 runs agree on winner with <3pp variation
  if (snapshots.length >= 3) {
    const lastThree = snapshots.slice(-3)
    const allSameWinner = lastThree.every(s => s.winnerId === latest.winnerId)
    if (allSameWinner) {
      const maxDelta = Math.max(
        ...lastThree.slice(1).map((s, i) =>
          Math.abs(s.winnerProbability - lastThree[i].winnerProbability)
        ),
      )
      if (maxDelta < 3) return 'converged'
    }
  }

  return 'improving'
}

/**
 * Check if a flipped state has a narrow margin (<10pp).
 * Used for the "narrow margin" variant of hero copy.
 */
export function isNarrowFlip(latest: AnalysisSnapshot): boolean {
  return Math.abs(latest.winnerProbability - (latest.runnerUpProbability ?? 0)) < 10
}

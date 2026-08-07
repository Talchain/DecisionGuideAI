/**
 * The A/B pick's selection rules — ROADMAP 2.113a slice 2.
 *
 * Pure, so the two invariants that keep the side-by-side view honest are
 * testable without a render:
 *
 *   1. **The two ends are never the same run.** A self-comparison would print
 *      a column of `+0pp` deltas and "Leader unchanged" — a screenful of
 *      measurements about nothing. Picking the run already at the other end
 *      SWAPS the two rather than collapsing them, so the state is unreachable.
 *
 *   2. **The pair is always chronological** (`from` = earlier). Every delta in
 *      this tab is later-minus-earlier; letting the user invert the pair would
 *      put two opposite sign conventions on one screen.
 *
 * Both selects list every run, so any pair is reachable in at most two picks.
 */
import type { RunPair } from './types'

function ordered(from: number, to: number): RunPair {
  return from <= to ? { from, to } : { from: to, to: from }
}

/**
 * Resolve a requested pair against the runs that actually exist right now.
 *
 * Re-hydration renumbers the journey (`hydrateFromPersisted` stamps 1..N), so
 * a selection made before a scenario switch or a new run can name a run number
 * that no longer exists. Each end is clamped independently; a pair that
 * collapses onto one run falls back to first-vs-latest rather than rendering a
 * comparison of a run with itself.
 *
 * Returns null when fewer than two runs exist — the tab does not render the
 * journey at all below that, and there is nothing to pick between.
 */
export function normaliseRunPair(
  runNumbers: readonly number[],
  requested: RunPair | null,
): RunPair | null {
  if (runNumbers.length < 2) return null

  const sorted = [...runNumbers].sort((a, b) => a - b)
  const fallback: RunPair = { from: sorted[0], to: sorted[sorted.length - 1] }
  if (requested == null) return fallback

  const available = new Set(sorted)
  const from = available.has(requested.from) ? requested.from : fallback.from
  const to = available.has(requested.to) ? requested.to : fallback.to
  if (from === to) return fallback

  return ordered(from, to)
}

/**
 * Apply one select's change. Choosing the run already at the OTHER end swaps
 * the pair instead of collapsing it (invariant 1), and the result is always
 * ordered (invariant 2).
 */
export function applyRunPairChange(
  current: RunPair,
  endpoint: 'from' | 'to',
  runNumber: number,
): RunPair {
  if (endpoint === 'from') {
    return runNumber === current.to
      ? ordered(runNumber, current.from)
      : ordered(runNumber, current.to)
  }
  return runNumber === current.from
    ? ordered(current.to, runNumber)
    : ordered(current.from, runNumber)
}

/**
 * Shared presentation order for option surfaces.
 *
 * OptionCards (V14.2, same order as WinGauge segments) and the analysis
 * hero must number and order options identically — the staging trust
 * review found the hero ranking rows by expected value while the cards
 * below ranked by win probability, so one screen showed the same option
 * as #1 and #4 simultaneously.
 *
 * Rule (extracted verbatim from OptionCards): win probability descending
 * when EVERY option carries one — mixed coverage would treat missing
 * values as 0 and fabricate rankings — otherwise expected value
 * (falling back to goalProbability) descending. Array.prototype.sort is
 * stable, so ties keep the caller's presentation order (deterministic
 * with allOptions[] input). Selection/ordering of existing producer
 * values only — no new values are computed.
 */
import type { OptionResult } from '../types'

type DisplayOrderFields = Pick<OptionResult, 'winProbability' | 'expected' | 'goalProbability'>

export function sortOptionsForDisplay<T extends DisplayOrderFields>(options: readonly T[]): T[] {
  // Number.isFinite (not `!= null`): a NaN winProbability would pass the
  // null check, poison the comparator (NaN ?? 0 stays NaN), and make the
  // order arbitrary — mixed/invalid coverage must fall back to expected.
  const allHaveWinProb =
    options.length > 0 && options.every(o => typeof o.winProbability === 'number' && Number.isFinite(o.winProbability))
  return [...options].sort((a, b) => {
    if (allHaveWinProb) return (b.winProbability ?? 0) - (a.winProbability ?? 0)
    return (b.expected ?? b.goalProbability ?? -Infinity) - (a.expected ?? a.goalProbability ?? -Infinity)
  })
}

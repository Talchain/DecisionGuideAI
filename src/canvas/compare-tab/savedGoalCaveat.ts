/**
 * ⭐ A SAVED GOAL FIGURE CARRIES ITS BASE CAVEAT (ISL #207; CODEX DELIVERY LEAD #72 5879597435).
 *
 * The live result row says when a goal figure is measured from a level Olumi worked out rather than
 * one the user gave (#2280). Compare replays the SAME figure from saved runs — the run-pair goal row,
 * the progression's Target row, the trajectory chart's goal line and the transition's goal delta —
 * so each of those shows the same sentence beside it, or the saved view would present an
 * estimate-based figure bare. The snapshot stores the chooser's caveat
 * (`AnalysisSnapshot.goalBaseCaveat`); this module is the one place Compare reads it.
 */
import { goalFitBaseCaveatCopy } from '../../components/results/utils/goalFitBasisCaveatCopy'
import type { GoalFitBaseCaveat } from '../../components/results/utils/selectGoalProbability'
import type { AnalysisSnapshot } from './types'

export type SavedGoal = Pick<AnalysisSnapshot, 'runNumber' | 'goalProbability' | 'goalBaseCaveat'>

const CAVEAT_ORDER: readonly GoalFitBaseCaveat[] = ['olumi_estimate', 'from_inputs']

/** THE reader: the caveat a saved goal figure needs; null when the run shows no goal figure. */
export function snapshotGoalBaseCaveat(s: SavedGoal): GoalFitBaseCaveat | null {
  return s.goalProbability != null ? (s.goalBaseCaveat ?? null) : null
}

/**
 * One sentence per distinct caveat among the runs whose goal figures are on screen. A caveat that
 * covers every shown figure is said once; one that covers only some names its runs, so a figure the
 * user's own level backs is never read as caveated, nor an estimate-based one as the user's.
 */
export function savedGoalCaveatLines(runs: ReadonlyArray<SavedGoal>): string[] {
  const shown = runs.filter((r) => r.goalProbability != null)
  const lines: string[] = []
  for (const caveat of CAVEAT_ORDER) {
    const carrying = shown.filter((r) => snapshotGoalBaseCaveat(r) === caveat)
    const copy = goalFitBaseCaveatCopy(caveat)
    if (carrying.length === 0 || copy === null) continue
    if (carrying.length === shown.length) {
      lines.push(copy)
      continue
    }
    const runNumbers = carrying.map((r) => r.runNumber)
    lines.push(`${runNumbers.length === 1 ? 'Run' : 'Runs'} ${runNumbers.join(', ')}: ${copy}`)
  }
  return lines
}

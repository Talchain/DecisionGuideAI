/**
 * ⭐ A SAVED GOAL FIGURE CARRIES ITS BASE CAVEAT (ISL #207; CODEX DELIVERY LEAD #72 5879597435).
 *
 * The live result row says when a goal figure is measured from a level Olumi worked out rather than
 * one the user gave (#2280). Compare replays the SAME figure from saved runs — the run-pair goal row,
 * the progression's Target row, the trajectory chart's goal line and the transition's goal delta —
 * so each of those shows the same sentence beside it, or the saved view would present an
 * estimate-based figure bare. The snapshot stores the chooser's caveat
 * (`AnalysisSnapshot.goalBaseCaveat`); this module is the one place Compare reads it.
 *
 * ⛔ ABSENT IS NOT NULL (Codex CR #2282 5880059759). An explicit `null` means the chooser evaluated
 * the run's basis and found no caveat due. An ABSENT key means the basis was never recorded (a
 * snapshot saved before the field existed), and nothing in the snapshot proves such a run predates
 * ISL #207 serving. So its goal figure — and any delta built on it — is WITHHELD, and the surface says
 * why; it is never shown bare.
 */
import { goalFitBaseCaveatCopy } from '../../components/results/utils/goalFitBasisCaveatCopy'
import type { GoalFitBaseCaveat } from '../../components/results/utils/selectGoalProbability'
import type { AnalysisSnapshot } from './types'

export type SavedGoal = Pick<AnalysisSnapshot, 'runNumber' | 'goalProbability' | 'goalBaseCaveat'>

const CAVEAT_ORDER: readonly GoalFitBaseCaveat[] = ['olumi_estimate', 'from_inputs']

/** Why a saved goal figure is not shown, beside the withheld cells and under the rows. */
export const SAVED_GOAL_BASIS_UNRECORDED_COPY =
  'goal figure not shown: saved before Olumi recorded what it was measured from.'

/** A saved run that HAS a goal figure whose basis was never recorded (the key is absent). */
export function savedGoalBasisUnrecorded(s: SavedGoal): boolean {
  return s.goalProbability != null && s.goalBaseCaveat === undefined
}

/**
 * THE saved goal figure a Compare surface may print or subtract: the run's `goalProbability`, or
 * null when its basis was never recorded (withheld, never bare).
 */
export function savedGoalFigure(s: SavedGoal): number | null {
  return savedGoalBasisUnrecorded(s) ? null : s.goalProbability
}

/** THE caveat reader: the caveat a shown saved goal figure needs; null when none or no figure shown. */
export function snapshotGoalBaseCaveat(s: SavedGoal): GoalFitBaseCaveat | null {
  return savedGoalFigure(s) != null ? (s.goalBaseCaveat ?? null) : null
}

function runsPrefix(runs: ReadonlyArray<SavedGoal>): string {
  const runNumbers = runs.map((r) => r.runNumber)
  return `${runNumbers.length === 1 ? 'Run' : 'Runs'} ${runNumbers.join(', ')}`
}

/**
 * One sentence per distinct caveat among the runs whose goal figures are on screen, then one naming
 * any run whose figure is withheld. A caveat that covers every shown figure is said once; one that
 * covers only some names its runs, so a figure the user's own level backs is never read as caveated,
 * nor an estimate-based one as the user's.
 */
export function savedGoalCaveatLines(runs: ReadonlyArray<SavedGoal>): string[] {
  const shown = runs.filter((r) => savedGoalFigure(r) != null)
  const lines: string[] = []
  for (const caveat of CAVEAT_ORDER) {
    const carrying = shown.filter((r) => snapshotGoalBaseCaveat(r) === caveat)
    const copy = goalFitBaseCaveatCopy(caveat)
    if (carrying.length === 0 || copy === null) continue
    lines.push(carrying.length === shown.length ? copy : `${runsPrefix(carrying)}: ${copy}`)
  }
  const unrecorded = runs.filter(savedGoalBasisUnrecorded)
  if (unrecorded.length > 0) lines.push(`${runsPrefix(unrecorded)}: ${SAVED_GOAL_BASIS_UNRECORDED_COPY}`)
  return lines
}

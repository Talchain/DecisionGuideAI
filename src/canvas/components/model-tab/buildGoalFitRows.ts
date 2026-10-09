import { runViewOf, type RunView, type OptionChanceCell, type OptionChanceCellContext } from '../../runView/runView'
/**
 * buildGoalFitRows — per-option goal-fit rows for the Model tab's goal card
 * (journey-walk 2026-08-03 §10.4 tab-parity: goal probability rendered on the
 * Analysis tab only; the report data was already in ModelTabBody's hands).
 *
 * Display comes from RunView's chance cell; numeric compatibility fields carry only the
 * licence's whole-percent figure. The caller supplies the held view and label context.
 * Producer order is preserved, without a local ranking or winner designation.
 */

/**
 * ⏳ PRODUCTION-ORPHANED, KEPT ON PURPOSE — WITH A RE-SURFACE TRIGGER.
 *
 * As of the v1 Model-tab removal (2026-09-11) this module has NO production
 * caller. Its only consumer was `<GoalSection>`, deleted with that stack. It is
 * kept on fitness-for-v2 grounds (§7.5 KEEP), not because a spec pins it — and
 * a parked thing with no trigger is how this estate loses work: the register
 * almost always has the row, what dies is anything that re-surfaces it.
 *
 * RE-SURFACE TRIGGER — whichever comes first:
 *   (a) DEPENDENCY — any file under `src/canvas/model-tab-v2/` renders a
 *       per-option goal-probability or goal-fit surface. At that moment this
 *       module is either the implementation or it is provably redundant.
 *   (b) DATE — 2026-12-11 (three months). If v2 has not grown that surface by
 *       then, the fitness-for-v2 premise has not held and is no longer a reason
 *       to keep the file.
 *
 * ACTION WHEN IT FIRES: wire it, or delete it together with its four specs.
 * "Keep it a bit longer" is not an outcome — it is this comment being reset,
 * which is the drift the trigger exists to stop.
 *
 * ⚠ Do NOT read the mentions in `ModelTabBody.tsx:27` or `OutputsDock.tsx:1979`
 * as call sites: both are doctrine COMMENTS, not executable references. Derived
 * at the deletion head — the only executable callers are the specs.
 */
import { buildCanvasLabelMap, resolveCanvasLabel, UNNAMED_ELEMENT_LABEL } from '../../domain/canvasLabels'
import type { Node } from '@xyflow/react'
import {
  goalProbabilityDetails,
  type GoalProbabilityInput,
  type GoalFitBaseCaveat,
} from '../../../components/results/utils/selectGoalProbability'

export interface GoalFitRow {
  id: string
  label: string
  /** The licensed whole percent divided by 100; null when no figure is licensed. */
  chanceCell: OptionChanceCell
  probability: number | null
  /** Possessive gate: basis 'joint_goal_substituted' withholds "your goal". */
  isSubstitutedJoint: boolean
  /** Doctrine B: `GOAL_FIT_BASIS_CAVEAT_COPY` must render adjacent when true. */
  modelledBasis: boolean
  /** ISL #207: `goalFitBaseCaveatCopy(baseCaveat)` must render adjacent when non-null. */
  baseCaveat: GoalFitBaseCaveat | null
  /**
   * ⭐ ROADMAP 2.334 — the Monte-Carlo sample count behind `probability`,
   * or `null` when the producer did not supply one.
   *
   * This is what makes the rows READABLE. Without it every sub-1% figure
   * renders as the register floor "< 1%", so the walk's run printed five
   * identical strings over five different numbers: the ordering was correct,
   * sourced and completely invisible, and the status-quo-lowest signature
   * could not be seen at all. The count was on the wire the entire time —
   * this builder simply did not carry it.
   *
   * `null` is meaningful and must NOT be defaulted: absent ≠ zero, and
   * absent ≠ "assume 10000". A run without a count falls back to the floor,
   * which understates rather than inventing a resolution the sampler never
   * had.
   */
  nValidSamples: number | null
}

/**
 * The response mapper's guard, applied at this seam too rather than trusted
 * from upstream (`adapters/plot/v2/responseMapper.ts` uses the same rule on
 * the same field). A zero count would make the display resolution `1/0`, and
 * a fractional one is not a sample count at all — both are rejected to the
 * floor arm rather than propagated into a precision claim.
 */
function positiveIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function buildGoalFitRows(
  optionNodes: ReadonlyArray<Node>,
  optionProbabilities: Record<string, unknown> | null | undefined,
  view: RunView = runViewOf({ option_probabilities: optionProbabilities }),
  context?: OptionChanceCellContext,
): GoalFitRow[] | null {
  if (optionNodes.length === 0) return null
  // ONE map for the whole build — the same policy the canonical outline uses.
  const optionLabels = buildCanvasLabelMap(optionNodes)
  const rows: GoalFitRow[] = []
  for (const node of optionNodes) {
    const entry = optionProbabilities?.[node.id]
    const details = goalProbabilityDetails(entry as GoalProbabilityInput)
    const chance = view.chanceOf(node.id)
    // The legacy goal-fit builder receives target-backed rows; explicit caller context still gates targetless views.
    // Preserve row/count/order metadata while withholding the unlicensed numeric figure.
    const chanceCell = view.chanceCellOf(node.id, context ?? { hasGoalTarget: true, goalChanceHeroSays: view.goalChance !== null, labelOf: id => resolveCanvasLabel(id, optionLabels) })
    if (chanceCell.kind === 'none') continue
    // Read straight off the producer entry this row was scored from, so the
    // count and the probability cannot come from different options.
    const outcome = (entry as { outcome?: Record<string, unknown> } | null | undefined)?.outcome
    rows.push({
      id: node.id,
      // THE ONE id → label policy. This read was `… : node.id`, so an option
      // whose label is absent (or is itself id-shaped) put a raw wire id —
      // `opt_hire_two_aes` — into a sentence about the user's goal. Fixed in
      // place rather than pinned in the removal residual, on the same ground
      // as `ContestedEdgeCard`: this builder OUTLIVES the duplicate editor
      // (`ModelTabBody` owns it), so the leak would have become permanent.
      label: resolveCanvasLabel(node.id, optionLabels) ?? UNNAMED_ELEMENT_LABEL,
      chanceCell,
      probability: chance.kind === 'figure' ? chance.pct / 100 : null,
      isSubstitutedJoint: false,
      modelledBasis: false,
      baseCaveat: chance.kind === 'figure' ? details.baseCaveat : null,
      nValidSamples: positiveIntegerOrNull(outcome?.n_valid_samples),
    })
  }
  return rows.length > 0 ? rows : null
}

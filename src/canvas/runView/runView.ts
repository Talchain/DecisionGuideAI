/**
 * ⭐ RUNVIEW: ONE PER-OPTION VIEW OF A RUN (data layer Phase 1, PR 1; design: programme-docs
 * `design/RUNVIEW-PHASE1-DESIGN-20261008.md`, DL APPROVED 8 Oct).
 *
 * The client used to read the goal chance from two sources (CEE's licence via `readGoalChanceLicence`, and the report's
 * `option_probabilities` via `selectGoalProbability`), and every surface re-read the licence itself. This module is the
 * ONE production reader of the licence for a Run. Every surface takes the Run's view from `runViewOf(report)`, built once
 * per report object (cached by identity, so a reload that keeps the held report keeps its view, and a new report gets a
 * new view without any extra writer).
 *
 * The chance has ONE source: CEE's licence (`pct_by_option`, CEE's whole-percent step). A Run with no licence record
 * but with goal figures in its report (a Run saved before the licence existed) is NOT shown from the report: it fails
 * closed, withheld with "Run the analysis again to see the chance." (DL ruling 1, 8 Oct: one source means one source; a
 * re-run produces the licence). A Run with no goal figures at all has no chance to show.
 *
 * Pure: no store reads. Formatters read only this view.
 */
import { readGoalChanceLicence, type GoalChanceLicence } from '../../components/results/utils/goalChanceLicence'
import { readGoalChanceRange, type GoalChanceRange } from '../../components/results/utils/goalChanceRange'
import { goalProbabilityWords } from '../../components/results/utils/goalAnchorCopy'
import { optionParticipationOf, type OptionParticipationEntry } from '../state/storedOptionParticipation'

/** DL ruling 1 (8 Oct): the words for a Run that carries goal figures but no licence. */
export const RUN_AGAIN_FOR_CHANCE = 'Run the analysis again to see the chance.'
/** c6 (6 Oct): an option CEE withheld for its own path keeps its place and says so. */
export const OPTION_CHANCE_WITHHELD = 'Olumi can’t yet say its chance of meeting your goal, in this model.'

export type OptionChance =
  /** CEE's licensed figure: `pct` is CEE's whole percent; `words` its display ("about 7%", "less than 1%"). */
  | { readonly kind: 'figure'; readonly pct: number; readonly words: string }
  /** Not shown. `reason` is the sentence the surface says in its place. */
  | { readonly kind: 'withheld'; readonly reason: string; readonly by: 'licence' | 'no_licence' }
  /** No goal chance on this Run for this option (no goal, no target, or not compared). */
  | { readonly kind: 'none' }

export interface RunView {
  /** CEE's licence for this Run, read ONCE here. Formatters that word the Run's sentences read it from the view. */
  readonly goalChance: GoalChanceLicence | null
  /** CEE's per-option goal-chance ranges for this Run, read once here. */
  readonly goalChanceRange: GoalChanceRange | null
  /** True when the report carries goal figures but no licence (the fail-closed case). */
  readonly unlicensedGoalFigures: boolean
  /** The chance for one option; `none` for an id the Run does not name. */
  readonly chanceOf: (optionId: string) => OptionChance
  /**
   * ⭐ PR 1b: why an option is OUTSIDE this Run's ordinary comparison (CEE's participation fact, read once on the report;
   * e.g. `excluded_olumi_proposed`), or null when it is in it or nothing was recorded.
   */
  readonly participationOf: (optionId: string) => OptionParticipationEntry | null
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The option ids whose report entry carries a goal figure (either field), for the fail-closed case only. */
function optionsWithGoalFigures(report: Rec): Set<string> {
  const out = new Set<string>()
  const probs = report.option_probabilities
  if (!isRec(probs)) return out
  for (const [id, p] of Object.entries(probs)) {
    if (isRec(p) && (typeof p.goal_probability === 'number' || typeof p.probability_of_goal === 'number')) out.add(id)
  }
  return out
}

const NONE: OptionChance = { kind: 'none' }
const EMPTY: RunView = { goalChance: null, goalChanceRange: null, unlicensedGoalFigures: false, chanceOf: () => NONE, participationOf: () => null }
const cache = new WeakMap<object, RunView>()

/** Build the view for one report (or any object carrying the Run's `inference_warnings`). Pure. */
export function buildRunView(report: unknown): RunView {
  if (!isRec(report)) return EMPTY
  const warnings = report.inference_warnings
  const licence = readGoalChanceLicence(warnings)
  const range = readGoalChanceRange(warnings)
  const chances = new Map<string, OptionChance>()
  if (licence !== null) {
    for (const id of licence.optionIds) {
      chances.set(id, licence.withheldOptionIds.includes(id)
        ? { kind: 'withheld', reason: OPTION_CHANCE_WITHHELD, by: 'licence' }
        : { kind: 'figure', pct: licence.pctByOption[id] as number, words: goalProbabilityWords(`${licence.pctByOption[id]}%`) })
    }
  }
  const unlicensed = licence === null ? optionsWithGoalFigures(report) : new Set<string>()
  for (const id of unlicensed) chances.set(id, { kind: 'withheld', reason: RUN_AGAIN_FOR_CHANCE, by: 'no_licence' })
  return {
    goalChance: licence,
    goalChanceRange: range,
    unlicensedGoalFigures: unlicensed.size > 0,
    chanceOf: (optionId) => chances.get(optionId) ?? NONE,
    participationOf: (optionId) => optionParticipationOf(report as { option_participation?: readonly OptionParticipationEntry[] }, optionId),
  }
}

/** The Run's view, built once per report object. `null`/non-object reports get the empty view. */
export function runViewOf(report: unknown): RunView {
  if (!isRec(report)) return EMPTY
  const cached = cache.get(report)
  if (cached !== undefined) return cached
  const view = buildRunView(report)
  cache.set(report, view)
  return view
}

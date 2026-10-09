/**
 * ⭐ RUNVIEW: ONE PER-OPTION VIEW OF A RUN (data layer Phase 1, PR 1; design: programme-docs
 * `design/RUNVIEW-PHASE1-DESIGN-20261008.md`, DL APPROVED 8 Oct).
 *
 * The client used to read the goal chance from two sources (CEE's licence via `readGoalChanceLicence`, and the report's
 * `option_probabilities` via `selectGoalProbability`), and every surface re-read the licence itself. This module is the
 * ONE production reader of the licence for a Run. Every surface takes the Run's view from `runViewOf(report)`, built once
 * per report and canonical READ/TURN projection (cached by identity, so an unchanged pair keeps its view; a new pair gets a
 * new view without any extra writer).
 *
 * Chance cell text comes only from CEE's matching canonical READ or TURN projection.
 * Eligible options without matching authority show the ACKed static absence face.
 *
 * Pure: no store reads. Formatters read only this view.
 */
import type { CanonicalAnalysisView } from './canonicalAnalysisView'
import { readGoalChanceLicence, goalChanceDriverOf, type GoalChanceDriver, type GoalChanceLicence } from '../../components/results/utils/goalChanceLicence'
import { readGoalChanceRange, type GoalChanceRange } from '../../components/results/utils/goalChanceRange'
import { goalProbabilityWords } from '../../components/results/utils/goalAnchorCopy'
import { goalChanceOptionLines } from '../../components/results/analysis-hero/goalChanceCopy'
import { optionParticipationOf, type OptionParticipationEntry } from '../state/storedOptionParticipation'

/** CEE 1c's ACKed withheld face; DL 87114: static absence, never a derived reason. */
export const CHANCE_NOT_SHOWN_YET = 'Chance not shown yet'

export type OptionChance =
  /** CEE's licensed figure: `pct` is CEE's whole percent; `words` its display ("about 7%", "less than 1%"). */
  | { readonly kind: 'figure'; readonly pct: number; readonly words: string }
  /** Numeric projection records withholding, without composing display words. */
  | { readonly kind: 'withheld'; readonly by: 'licence' | 'no_licence' }
  /** No goal chance on this Run for this option (no goal, no target, or not compared). */
  | { readonly kind: 'none' }

/** The chance cell shared by Results and both canvas option-card zoom levels. No-source cells have no copy. */
export type OptionChanceCell =
  | { readonly kind: 'figure' | 'range' | 'withheld'; readonly text: string; readonly why?: string }
  | { readonly kind: 'none'; readonly text: null }

/** Only the Results context that cannot be read from the held report. */
export interface OptionChanceCellContext {
  /** Whether Results applies this Run's licensed hero wording. */
  readonly goalChanceHeroSays: boolean
  readonly goalFiguresWithheldMessage?: string | null
  readonly goalCertaintyUnearned?: { readonly say: string | null } | null
  /** Legacy context retained for callers; canonical cell text does not depend on it. */
  readonly hasGoalTarget?: boolean
  readonly notAnalysed?: boolean
  readonly notAnalysedMessage?: string | null
  readonly labelOf: (optionId: string) => string | null
  readonly rangeLabelOf?: (nodeId: string) => string | null
}

export interface RunView {
  /** CEE's licence for this Run, read ONCE here. Formatters that word the Run's sentences read it from the view. */
  readonly goalChance: GoalChanceLicence | null
  /** CEE's per-option goal-chance ranges for this Run, read once here. */
  readonly goalChanceRange: GoalChanceRange | null
  /** True when the report carries goal figures but no licence (the fail-closed case). */
  readonly unlicensedGoalFigures: boolean
  /** The chance for one option; `none` for an id the Run does not name. */
  readonly chanceOf: (optionId: string) => OptionChance
  /** Canonical main_driver for a matching Run, otherwise the existing licence driver. */
  readonly mainDriverOf: (optionId: string) => GoalChanceDriver | null
  /** Sole per-option display resolution. `none` leaves the matrix's existing empty-cell copy to the matrix. */
  readonly chanceCellOf: (optionId: string, ctx: OptionChanceCellContext) => OptionChanceCell
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
const NO_CELL: OptionChanceCell = { kind: 'none', text: null }
const EMPTY: RunView = {
  goalChance: null, goalChanceRange: null, unlicensedGoalFigures: false, chanceOf: () => NONE, mainDriverOf: () => null,
  chanceCellOf: (optionId, ctx) => optionChanceCell(EMPTY, optionId, ctx), participationOf: () => null,
}
const cache = new WeakMap<object, { canonical: CanonicalAnalysisView | null; view: RunView }>()
const canonicalByView = new WeakMap<RunView, CanonicalAnalysisView>()

/** Match the held report, never today's graph or its locally derived response hash. */
function matchesCanonicalRun(report: Rec, canonical: CanonicalAnalysisView): boolean {
  const run = canonical.run
  if (run === null) return false
  if (typeof report.run_id === 'string' && report.run_id.length > 0 && run.run_id) return run.run_id === report.run_id
  const hash = report.computed_against_hash
  // ReportV1's producer timestamp is meta.computed_at (also used by assembleAnalysisInputsSummary).
  const computedAt = isRec(report.meta) ? report.meta.computed_at : undefined
  return typeof hash === 'string' && hash.length > 0 && run.graph_hash_at_run === hash
    && typeof computedAt === 'string' && computedAt.length > 0 && run.computed_at === computedAt
}

/**
 * Historical chat result-block presentation from persisted enrichment (DL: later).
 * This wrapper is outside RunView cell resolution.
 */
export function licensedOptionChanceLines(...args: Parameters<typeof goalChanceOptionLines>): ReturnType<typeof goalChanceOptionLines> {
  return goalChanceOptionLines(...args)
}

/** Producer cell text, or the static DL 87114 absence state for an eligible held Run. */
export function optionChanceCell(view: RunView, optionId: string, ctx: OptionChanceCellContext): OptionChanceCell {
  const canonical = canonicalByView.get(view)
  if (!canonical) {
    // Existing per-option Run classification: a licence or held goal figures, never a derived chance.
    const hasTarget = ctx.hasGoalTarget ?? (view.goalChance !== null)
    const eligible = view.chanceOf(optionId).kind !== 'none'
      || view.goalChance?.optionIds.includes(optionId) === true
      || (view.goalChanceRange !== null && Object.prototype.hasOwnProperty.call(view.goalChanceRange.rangeByOption, optionId))
    if (hasTarget && ctx.notAnalysed !== true && eligible) {
      return { kind: 'withheld', text: CHANCE_NOT_SHOWN_YET }
    }
    return NO_CELL
  }
  if (canonical.staleness.stale === null) return NO_CELL
  if (canonical.staleness.stale === true && canonical.run !== null) {
    return canonical.face_when_stale === undefined ? NO_CELL : { kind: 'withheld', text: canonical.face_when_stale }
  }
  const cell = canonical.options.find(option => option.option_id === optionId)?.cell
  if (cell?.kind === 'figure' || cell?.kind === 'range') {
    // Historical projections without a face retain only the server's display fragment.
    return { kind: cell.kind, text: cell.face ?? cell.display }
  }
  if (cell?.kind === 'withheld' && cell.face !== undefined) return { kind: 'withheld', text: cell.face,
    ...(cell.why === undefined ? {} : { why: cell.why }) }
  return NO_CELL
}

/** Build the view for one report and its scenario-bound READ/TURN projection. Pure; scenario selection belongs to Results. */
export function buildRunView(report: unknown, canonical: CanonicalAnalysisView | null = null): RunView {
  if (!isRec(report)) return EMPTY
  const warnings = report.inference_warnings
  const licence = readGoalChanceLicence(warnings)
  const range = readGoalChanceRange(warnings)
  const chances = new Map<string, OptionChance>()
  if (licence !== null) {
    for (const id of licence.optionIds) {
      chances.set(id, licence.withheldOptionIds.includes(id)
        ? { kind: 'withheld', by: 'licence' }
        : { kind: 'figure', pct: licence.pctByOption[id] as number, words: goalProbabilityWords(`${licence.pctByOption[id]}%`) })
    }
  }
  const unlicensed = licence === null ? optionsWithGoalFigures(report) : new Set<string>()
  for (const id of unlicensed) chances.set(id, { kind: 'withheld', by: 'no_licence' })
  const view: RunView = {
    goalChance: licence,
    goalChanceRange: range,
    unlicensedGoalFigures: unlicensed.size > 0,
    chanceOf: (optionId) => chances.get(optionId) ?? NONE,
    mainDriverOf: (optionId) => {
      const held = canonicalByView.get(view)
      if (held && held.staleness.stale !== null) {
        if (held.staleness.stale) return null
        const driver = held.options.find(o => o.option_id === optionId)?.main_driver
        return driver?.kind === 'available' ? goalChanceDriverOf(driver.driver) : null
      }
      return licence?.driverByOption?.[optionId] ?? null
    },
    chanceCellOf: (optionId, ctx) => optionChanceCell(view, optionId, ctx),
    participationOf: (optionId) => optionParticipationOf(report as { option_participation?: readonly OptionParticipationEntry[] }, optionId),
  }
  if (canonical && matchesCanonicalRun(report, canonical)) canonicalByView.set(view, canonical)
  return view
}

/** The Run's view, cached by report and scenario-bound canonical projection. Non-object reports get the empty view. */
export function runViewOf(report: unknown, canonical: CanonicalAnalysisView | null = null): RunView {
  if (!isRec(report)) return EMPTY
  const cached = cache.get(report)
  if (cached !== undefined && cached.canonical === canonical) return cached.view
  const view = buildRunView(report, canonical)
  cache.set(report, { canonical, view })
  return view
}

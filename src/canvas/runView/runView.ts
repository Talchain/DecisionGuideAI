/**
 * ⭐ RUNVIEW: ONE PER-OPTION VIEW OF A RUN (data layer Phase 1, PR 1; design: programme-docs
 * `design/RUNVIEW-PHASE1-DESIGN-20261008.md`, DL APPROVED 8 Oct).
 *
 * The client used to read the goal chance from two sources (CEE's licence via `readGoalChanceLicence`, and the report's
 * `option_probabilities` via `selectGoalProbability`), and every surface re-read the licence itself. This module is the
 * ONE production reader of the licence for a Run. Every surface takes the Run's view from `runViewOf(report)`, built once
 * per report and canonical READ projection (cached by identity, so an unchanged pair keeps its view; a new pair gets a
 * new view without any extra writer).
 *
 * Chance cells prefer CEE's canonical READ projection when it identifies the held Run. Otherwise they retain the
 * existing licence resolution (`pct_by_option`, CEE's whole-percent step). A Run with no licence record
 * but with goal figures in its report (a Run saved before the licence existed) is NOT shown from the report: it fails
 * closed, withheld with "Run the analysis again to see the chance." (DL ruling 1, 8 Oct: one source means one source; a
 * re-run produces the licence). A Run with no goal figures at all has no chance to show.
 *
 * Pure: no store reads. Formatters read only this view.
 */
import type { CanonicalAnalysisView } from './canonicalAnalysisView'
import { readGoalChanceLicence, type GoalChanceLicence } from '../../components/results/utils/goalChanceLicence'
import { readGoalChanceRange, type GoalChanceRange } from '../../components/results/utils/goalChanceRange'
import { goalProbabilityWords } from '../../components/results/utils/goalAnchorCopy'
import { goalChanceOptionLines, goalChanceRangeLine } from '../../components/results/analysis-hero/goalChanceCopy'
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

/** The chance cell shared by Results and both canvas option-card zoom levels. No-source cells have no copy. */
export type OptionChanceCell =
  | { readonly kind: 'figure' | 'range' | 'withheld'; readonly text: string }
  | { readonly kind: 'none'; readonly text: null }

/** Only the Results context that cannot be read from the held report. */
export interface OptionChanceCellContext {
  /** Whether Results applies this Run's licensed hero wording. */
  readonly goalChanceHeroSays: boolean
  readonly goalFiguresWithheldMessage?: string | null
  readonly goalCertaintyUnearned?: { readonly say: string | null } | null
  /** Graph-derived comparison eligibility; preserves Results' fallback-figure gate. */
  readonly notAnalysed?: boolean
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
  goalChance: null, goalChanceRange: null, unlicensedGoalFigures: false, chanceOf: () => NONE,
  chanceCellOf: (optionId, ctx) => optionChanceCell(EMPTY, optionId, ctx), participationOf: () => null,
}
const cache = new WeakMap<object, { canonical: CanonicalAnalysisView | null; view: RunView }>()
const canonicalByView = new WeakMap<RunView, CanonicalAnalysisView>()

/** Match the held report, never today's graph or its locally derived response hash. */
function matchesCanonicalRun(report: Rec, canonical: CanonicalAnalysisView): boolean {
  const run = canonical.run
  if (run === null) return false
  if (typeof report.run_id === 'string' && report.run_id.length > 0) return run.run_id === report.run_id
  const hash = report.computed_against_hash
  return typeof hash === 'string' && hash.length > 0 && run.graph_hash_at_run === hash
}

/**
 * Existing whole-Run hero/block presentation, routed through the same licence authority.
 * Kept for those surfaces' quoted-option/driver wording; it does not select a card headline.
 */
export function licensedOptionChanceLines(...args: Parameters<typeof goalChanceOptionLines>): ReturnType<typeof goalChanceOptionLines> {
  return goalChanceOptionLines(...args)
}

/** Compatibility for legacy hero projections that carry a parsed licence but no RunView. */
export function licensedOptionHasFigure(licence: GoalChanceLicence, optionId: string): boolean {
  return licence.optionIds.includes(optionId) && !licence.withheldOptionIds.includes(optionId)
}

/**
 * ONE chance-cell authority, replacing DecisionMatrix's former per-option resolution.
 * A valid range takes precedence even when its own cause sets a withheld sentence; unresolved range labels
 * fail closed. Then the Run/option withhold, licensed line, no-licence sentence and permitted fallback figure.
 * The small context surface is the seam for a future server-produced RunView; callers do not read wire figures.
 */
export function optionChanceCell(view: RunView, optionId: string, ctx: OptionChanceCellContext): OptionChanceCell {
  const canonical = canonicalByView.get(view)
  if (canonical && canonical.staleness.stale !== null) {
    if (canonical.staleness.stale === true && canonical.run !== null) {
      return { kind: 'withheld', text: RUN_AGAIN_FOR_CHANCE }
    }
    const cell = canonical.options.find(option => option.option_id === optionId)?.cell
    if (cell?.kind === 'figure' || cell?.kind === 'range') {
      const licensed = licensedChanceCell(view, optionId, ctx)
      // CEE's display is a fragment. Preserve the existing licensed sentence when its kind agrees.
      // A figure may never quote a percentage that contradicts the canonical view.
      const percentages = cell.display.match(/\d+(?:\.\d+)?\s*%/g)
      const chance = view.chanceOf(optionId)
      const licensedPercentages = chance.kind === 'figure' ? chance.words.match(/\d+(?:\.\d+)?\s*%/g) : null
      const agrees = cell.kind === 'range' || (percentages !== null && percentages.every(pct =>
        licensedPercentages?.some(value => value.replace(/\s/g, '') === pct.replace(/\s/g, ''))
        && licensed.text?.match(/\d+(?:\.\d+)?\s*%/g)?.some(value => value.replace(/\s/g, '') === pct.replace(/\s/g, ''))))
      return { kind: cell.kind, text: licensed.kind === cell.kind && agrees ? licensed.text : cell.display }
    }
    if (cell?.kind === 'withheld') return { kind: 'withheld', text: cell.reasons[0]?.message ?? OPTION_CHANCE_WITHHELD }
    if (cell?.kind === 'none') return NO_CELL
  }
  return licensedChanceCell(view, optionId, ctx)
}

/** Existing resolution, also used to retain licensed sentences under a canonical kind. */
function licensedChanceCell(view: RunView, optionId: string, ctx: OptionChanceCellContext): OptionChanceCell {
  const range = view.goalChanceRange
  const rangeEntry = range?.rangeByOption[optionId]
  if (rangeEntry !== undefined) {
    const labelOf = ctx.rangeLabelOf ?? ctx.labelOf
    const line = goalChanceRangeLine(rangeEntry, labelOf(optionId), labelOf, range?.target)
    if (line === null) return NO_CELL
    // S3's link-range sentence ends here. Stated-time ranges have no separate driver clause.
    const boundary = ' chance of meeting your goal, in this model. '
    const index = line.indexOf(boundary)
    return { kind: 'range', text: index === -1 ? line : line.slice(0, index + boundary.length - 1) }
  }
  const withheld = ctx.goalFiguresWithheldMessage ?? ctx.goalCertaintyUnearned?.say ?? null
  if (withheld !== null) return { kind: 'withheld', text: withheld }
  const licence = ctx.goalChanceHeroSays ? view.goalChance : null
  const chanceLines = licence === null ? null : licensedOptionChanceLines(licence, ctx.labelOf)
  const chance = view.chanceOf(optionId)
  if (licence !== null && chanceLines !== null && licence.optionIds.includes(optionId)) {
    const text = chanceLines[licence.optionIds.indexOf(optionId)]
    if (text !== undefined) return { kind: licensedOptionHasFigure(licence, optionId) ? 'figure' : 'withheld', text }
  }
  if (ctx.notAnalysed === true) return NO_CELL
  if (chance.kind === 'withheld' && chance.by === 'no_licence') return { kind: 'withheld', text: chance.reason }
  return chance.kind === 'figure' ? { kind: 'figure', text: chance.words } : NO_CELL
}

/** Build the view for one report and its scenario-bound READ projection. Pure; scenario selection belongs to Results. */
export function buildRunView(report: unknown, canonical: CanonicalAnalysisView | null = null): RunView {
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
  const view: RunView = {
    goalChance: licence,
    goalChanceRange: range,
    unlicensedGoalFigures: unlicensed.size > 0,
    chanceOf: (optionId) => chances.get(optionId) ?? NONE,
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

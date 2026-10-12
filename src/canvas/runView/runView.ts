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
import type { CanonicalAnalysisView, CanonicalGoalChanceDetail } from './canonicalAnalysisView'
import { readGoalChanceLicence, goalChanceDriverOf, type GoalChanceDriver, type GoalChanceLicence } from '../../components/results/utils/goalChanceLicence'
import { readGoalChanceRange, type GoalChanceRange } from '../../components/results/utils/goalChanceRange'
import { goalProbabilityWords } from '../../components/results/utils/goalAnchorCopy'
import type { RunDeltaGoalChanceRow } from '../../components/results/analysisNew/runDeltaView'
import { goalChanceDetailLines, goalChanceOptionLines } from '../../components/results/analysis-hero/goalChanceCopy'
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

/** A goal-chance number a surface may show: CEE's whole percent and the canonical cell's own words for it. */
export interface ChanceFigure { readonly pct: number; readonly words: string }

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
  /**
   * CEE's per-option goal-chance ranges for this Run, through the authority gate (#2747 re-scope): only for a Run known to
   * be current, and only for the options whose matching canonical cell is a range; otherwise null.
   */
  readonly goalChanceRange: GoalChanceRange | null
  /** True when the report carries goal figures but no licence (the fail-closed case). */
  readonly unlicensedGoalFigures: boolean
  /**
   * The chance for one option, through the authority gate: a figure only from `chanceFigureOf`; a licensed withholding
   * (no number); otherwise `none`.
   */
  readonly chanceOf: (optionId: string) => OptionChance
  /** ⭐ The authority gate itself (`chanceFigureFromCanonical`). */
  readonly chanceFigureOf: (optionId: string) => ChanceFigure | null
  /** The current canonical main_driver for a matching Run; otherwise null (never the licence's own driver, #2747). */
  readonly mainDriverOf: (optionId: string) => GoalChanceDriver | null
  /** Sole per-option display resolution. `none` leaves the matrix's existing empty-cell copy to the matrix. */
  readonly chanceCellOf: (optionId: string, ctx: OptionChanceCellContext) => OptionChanceCell
  /**
   * #2747 r2: CEE's reason codes on this option's withheld cell, for a matching Run known to be current; otherwise none.
   * The chat card uses them to say each option's own reason (`why`) once, never a line of its own composing.
   */
  readonly withheldReasonCodesOf: (optionId: string) => readonly string[]
  /**
   * ⭐ PR 1b: why an option is OUTSIDE this Run's ordinary comparison (CEE's participation fact, read once on the report;
   * e.g. `excluded_olumi_proposed`), or null when it is in it or nothing was recorded.
   */
  readonly participationOf: (optionId: string) => OptionParticipationEntry | null
  /**
   * Recovery Batch C: the Run's goal-chance detail (chance words, notes, status quo, several targets) from the matching
   * canonical projection, under the cells' own freshness rule: only for a Run known to be current, else null.
   */
  readonly goalChanceDetail: () => CanonicalGoalChanceDetail | null
  /**
   * Recovery Batch C (#2747 r1): true when a matching canonical projection says this Run is not known to be current;
   * `chanceOf` then quotes no figure (the cells' own freshness rule), and `notCurrentLine` is CEE's sentence, if any.
   */
  readonly chancesNotCurrent: () => boolean
  readonly notCurrentLine: () => string | null
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The option ids whose report entry carries a goal figure (either field), for the fail-closed case only. */
function optionsWithGoalFigures(report: Rec): Set<string> {
  const out = new Set<string>()
  const probs = report.option_probabilities
  if (!isRec(probs)) return out
  for (const [id, p] of Object.entries(probs)) {
    // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: gate: inside the gate function that decides this figure
    if (isRec(p) && (typeof p.goal_probability === 'number' || typeof p.probability_of_goal === 'number')) out.add(id)
  }
  return out
}

const NONE: OptionChance = { kind: 'none' }
const NO_CELL: OptionChanceCell = { kind: 'none', text: null }
const EMPTY: RunView = {
  goalChance: null, goalChanceRange: null, unlicensedGoalFigures: false, chanceOf: () => NONE, mainDriverOf: () => null,
  chanceFigureOf: () => null, chanceCellOf: (optionId, ctx) => optionChanceCell(EMPTY, optionId, ctx), withheldReasonCodesOf: () => [],
  participationOf: () => null,
  goalChanceDetail: () => null, chancesNotCurrent: () => false, notCurrentLine: () => null,
}

/**
 * The persisted chat card's Batch C lines (CEE's words, the screen's order), for THIS Run: the joint's withheld line and
 * bound, each target on its own, then the notes. The status-quo line is left to the option lines when they say it.
 */
export function licensedGoalChanceDetailLines(...args: Parameters<typeof goalChanceDetailLines>): ReturnType<typeof goalChanceDetailLines> {
  return goalChanceDetailLines(...args)
}
const cache = new WeakMap<object, { canonical: CanonicalAnalysisView | null; view: RunView }>()
const canonicalByView = new WeakMap<RunView, CanonicalAnalysisView>()
/** The Run's own ranged option ids (ungated), for the static absence face's eligibility only: never a number. */
const rangedIdsByView = new WeakMap<RunView, ReadonlySet<string>>()

/** How a report is matched to the canonical Run: a Results report by its Run, a chat card by run id AND graph hash. */
type RunMatch = 'run' | 'card'

/**
 * Match the held report, never today's graph or its locally derived response hash.
 *
 * #2747 r2 (BLOCKING 3): a chat card is matched `by: 'card'`, by Run IDENTITY: the run id its turn's canonical view
 * stamped on it (`turnCanonicalRunOf`) AND the wire block's graph hash. The hash alone is not identity (three Runs of one
 * graph share it); a card with no stamped run id is unknown and binds to nothing.
 */
function matchesCanonicalRun(report: Rec, canonical: CanonicalAnalysisView, by: RunMatch = 'run'): boolean {
  const run = canonical.run
  if (run === null) return false
  if (by === 'card') {
    return typeof report.run_id === 'string' && report.run_id.length > 0 && run.run_id === report.run_id
      && typeof report.computed_against_hash === 'string' && report.computed_against_hash.length > 0
      && run.graph_hash_at_run === report.computed_against_hash
  }
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
    const ranged = rangedIdsByView.get(view) ?? new Set(view.goalChanceRange?.optionIds ?? [])
    const eligible = view.chanceOf(optionId).kind !== 'none'
      || view.goalChance?.optionIds.includes(optionId) === true
      || ranged.has(optionId)
    // The producer's own withheld sentence (goal identity) outranks the static face, verbatim.
    const producerWithheld = typeof ctx.goalFiguresWithheldMessage === 'string' && ctx.goalFiguresWithheldMessage.trim() !== ''
      ? ctx.goalFiguresWithheldMessage : null
    if (hasTarget && ctx.notAnalysed !== true && eligible) {
      return { kind: 'withheld', text: producerWithheld ?? CHANCE_NOT_SHOWN_YET }
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
/**
 * ⭐⭐ THE ONE AUTHORITY GATE FOR EVERY GOAL-CHANCE NUMBER (#2747 re-scope, DL after Codex round 2).
 *
 * A figure ONLY when CEE's canonical cell for this option licenses it (`kind: 'figure'`) on the matching Run, known to be
 * current (`staleness.stale === false`), and the licence holds the option's whole percent. Otherwise null: no canonical
 * view, a different Run, a stale or unknown Run, a range or withheld cell, or no percent. Every surface that shows a
 * chance (WinGauge, hero, option cards, chat card, Model tab, canvas) reads it through here; the census spec
 * (`__tests__/chanceAuthorityGate.census.spec.ts`) fails on any other production read of a goal-chance number.
 */
export function chanceFigureFromCanonical(view: RunView, optionId: string): ChanceFigure | null {
  return view.chanceFigureOf(optionId)
}

/**
 * Compare's goal-chance rows through the gate (DL ruling (b)): the pair's rows only when its Latest Run is the current
 * canonical Run (`latestRunIsCurrentCanonical`) and some side carries a figure; `notCurrent` when it carries figures
 * but its Latest Run is not current (the row then shows no figure, only why).
 */
export function gatedCompareGoalChances(
  view: { readonly goalChances?: readonly RunDeltaGoalChanceRow[] }, latestIsCurrent: boolean,
): { readonly rows: readonly RunDeltaGoalChanceRow[] | null; readonly notCurrent: boolean } {
  // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: gate: inside the gate function that decides this figure
  const rows = view.goalChances
  const figures = rows !== undefined && rows.some((g) => [g.prior, g.current].some((side) => side.kind === 'point' || side.kind === 'range'))
  return { rows: figures && latestIsCurrent ? rows : null, notCurrent: figures && !latestIsCurrent }
}

/**
 * The same gate for Compare's goal-chance row (#2747, DL ruling (b)): the pair's Latest Run must be the scenario's current
 * canonical Run (the same CEE run id, `staleness.stale === false`); otherwise the row shows no figures.
 */
export function latestRunIsCurrentCanonical(canonical: CanonicalAnalysisView | null, latestRunId: string | null | undefined): boolean {
  return canonical !== null && canonical.staleness.stale === false && typeof latestRunId === 'string' && latestRunId.length > 0
    && canonical.run?.run_id === latestRunId
}

/**
 * The gate's arithmetic, on one held licence and canonical view (pure). The licence's number and the canonical cell's
 * words must say the same figure (Ruling 4's wording of that percent); if they do not, neither is shown.
 */
function gatedFigure(licence: GoalChanceLicence | null, current: CanonicalAnalysisView | null, optionId: string): ChanceFigure | null {
  if (licence === null || current === null || licence.withheldOptionIds.includes(optionId)) return null
  const cell = current.options.find(option => option.option_id === optionId)?.cell
  // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: gate: inside the gate function that decides this figure
  const pct = licence.pctByOption[optionId]
  if (cell?.kind !== 'figure' || typeof pct !== 'number' || !Number.isFinite(pct)) return null
  return cell.display === goalProbabilityWords(`${pct}%`) ? { pct, words: cell.display } : null
}

/**
 * The licence's ranges, kept only for the options whose current canonical cell is a range that says the SAME bounds.
 *
 * #2747 r2 (BLOCKING 2): a matching kind is not enough (a stored 5–95% beside a canonical 20–30% was shown). CEE words a
 * range cell from its bounds by the screen's rule (`goal-chance-range-agent.ts`): "between <low> and <high>", each end
 * as the displayed figure is said, the high end without its "about". The licence's bounds must say exactly those words.
 */
function gatedRange(range: GoalChanceRange | null, current: CanonicalAnalysisView | null): GoalChanceRange | null {
  if (range === null || current === null) return null
  const sameBounds = (id: string): boolean => {
    const cell = current.options.find(option => option.option_id === id)?.cell
    const entry = range.rangeByOption[id]
    if (cell?.kind !== 'range' || entry === undefined) return false
    // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: gate: inside the gate function that decides this figure
    const low = goalProbabilityWords(`${entry.lowPct}%`)
    // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: gate: inside the gate function that decides this figure
    const high = goalProbabilityWords(`${entry.highPct}%`).replace(/^about /, '')
    return cell.display === `between ${low} and ${high}`
  }
  const optionIds = range.optionIds.filter(sameBounds)
  if (optionIds.length === 0) return null
  const rangeByOption: Record<string, GoalChanceRange['rangeByOption'][string]> = Object.create(null)
  for (const id of optionIds) rangeByOption[id] = range.rangeByOption[id]
  return { ...range, optionIds, rangeByOption }
}

export function buildRunView(report: unknown, canonical: CanonicalAnalysisView | null = null, by: RunMatch = 'run'): RunView {
  if (!isRec(report)) return EMPTY
  const warnings = report.inference_warnings
  return runViewFromParts(report, readGoalChanceLicence(warnings), readGoalChanceRange(warnings), canonical, by)
}

/** The view from a report's already-read licence and ranges (`buildRunView` reads them); the gate is the same. */
export function runViewFromParts(
  report: Record<string, unknown>, licence: GoalChanceLicence | null, range: GoalChanceRange | null,
  canonical: CanonicalAnalysisView | null = null, by: RunMatch = 'run',
): RunView {
  const held = canonical !== null && matchesCanonicalRun(report, canonical, by) ? canonical : null
  const current = held !== null && held.staleness.stale === false ? held : null
  const unlicensed = licence === null ? optionsWithGoalFigures(report) : new Set<string>()
  const view: RunView = {
    goalChance: licence,
    goalChanceRange: gatedRange(range, current),
    unlicensedGoalFigures: unlicensed.size > 0,
    chanceFigureOf: (optionId) => gatedFigure(licence, current, optionId),
    chanceOf: (optionId) => {
      const figure = gatedFigure(licence, current, optionId)
      if (figure !== null) return { kind: 'figure', ...figure }
      if (licence?.withheldOptionIds.includes(optionId)) return { kind: 'withheld', by: 'licence' }
      return unlicensed.has(optionId) ? { kind: 'withheld', by: 'no_licence' } : NONE
    },
    // A driver line quotes chances ("the chance falls to …"), so it is gated like a figure: the current canonical
    // driver only, never the licence's own (#2747 re-scope).
    mainDriverOf: (optionId) => {
      const driver = current?.options.find(o => o.option_id === optionId)?.main_driver
      return driver?.kind === 'available' ? goalChanceDriverOf(driver.driver) : null
    },
    chanceCellOf: (optionId, ctx) => optionChanceCell(view, optionId, ctx),
    withheldReasonCodesOf: (optionId) => {
      const cell = current?.options.find(o => o.option_id === optionId)?.cell
      return cell?.kind === 'withheld' ? cell.reasons.map(reason => reason.code) : []
    },
    participationOf: (optionId) => optionParticipationOf(report as { option_participation?: readonly OptionParticipationEntry[] }, optionId),
    goalChanceDetail: () => {
      const held = canonicalByView.get(view)
      return held !== undefined && held.staleness.stale === false ? held.goal_chance ?? null : null
    },
    chancesNotCurrent: () => {
      const held = canonicalByView.get(view)
      return held !== undefined && held.staleness.stale !== false
    },
    notCurrentLine: () => {
      const held = canonicalByView.get(view)
      return held !== undefined && held.staleness.stale === true && held.run !== null ? held.face_when_stale ?? null : null
    },
  }
  if (held !== null) canonicalByView.set(view, held)
  rangedIdsByView.set(view, new Set(range?.optionIds ?? []))
  return view
}

/**
 * A persisted chat card's view of ITS OWN Run (#2747 re-scope): the card's stored licence, through the same gate, against
 * the scenario's canonical view matched by Run IDENTITY (the stamped run id AND the wire block's `computed_against_hash`).
 * A card for an older Run (even one sharing the graph hash), for a Run not known to be current, or stored without its id
 * or hash quotes no chance. Only the stamped id counts: any run id inside the enrichment is overwritten.
 */
export function chatCardRunViewOf(
  block: { readonly enrichment?: Record<string, unknown>; readonly computed_against_hash?: string; readonly run_id?: string },
  canonical: CanonicalAnalysisView | null,
): RunView {
  if (!isRec(block.enrichment)) return EMPTY
  return buildRunView({ ...block.enrichment, computed_against_hash: block.computed_against_hash, run_id: block.run_id }, canonical, 'card')
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

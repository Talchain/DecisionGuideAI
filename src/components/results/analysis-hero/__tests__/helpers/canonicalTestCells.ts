import { useCanonicalAnalysisViewStore } from '../../../../../canvas/stores/canonicalAnalysisViewStore'
import type { ResultsSectionDataReturn } from '../../../useResultsSectionData'
import { buildRunView, runViewFromParts, type OptionChanceCellContext } from '../../../../../canvas/runView/runView'
import { goalProbabilityWords } from '../../../utils/goalAnchorCopy'
import { readGoalChanceRange, type GoalChanceRange, type GoalChanceRangeEntry } from '../../../utils/goalChanceRange'
import type { CanonicalAnalysisView, CanonicalAnalysisCell } from '../../../../../canvas/runView/canonicalAnalysisView'
import { fixtureOptionLines } from './fixtureOptionLines'
import { gateWordsOf } from './gateWords'

/** SELF-AUTHORED UI fixtures, not served evidence. Positive display tests explicitly supply
 * canonical cells; D1/served-byte/turn suites never use this helper. The historical chat
 * formatter supplies fixture words only, so its existing copy tests retain their scope. */
/** CEE's served range `display` (`goal-chance-range-agent.ts`): "between <low> and <high>", the high end without "about". */
export const servedRangeDisplay = (entry: GoalChanceRangeEntry): string =>
  `between ${goalProbabilityWords(`${entry.lowPct}%`)} and ${goalProbabilityWords(`${entry.highPct}%`).replace(/^about /, '')}`

/**
 * A SELF-AUTHORED stand-in for CEE's served face of a link range (#2747 re-scope 2: production no longer words a range;
 * the UI shows CEE's `face` verbatim). A stated-time range has no stand-in here: a fixture that needs one supplies it
 * (`statedFaces`, by option id).
 */
const fixtureRangeFace = (entry: GoalChanceRangeEntry, label: string | null, stated?: string): string | null =>
  entry.kind === 'stated_time' ? stated ?? null
    : label === null || label.trim() === '' ? null
      : `‘${label}’: ${servedRangeDisplay(entry)} chance of meeting your goal, in this model.`

export function canonicalTestCellsOf(data: ResultsSectionDataReturn, run: CanonicalAnalysisView['run'] = { run_id: 'synthetic-ui-fixture', graph_hash_at_run: null, computed_at: null },
  rawRange: GoalChanceRange | null = null, statedFaces: Readonly<Record<string, string>> = {}): CanonicalAnalysisView {
  const licence = data.goalChanceLicence ?? data.runView?.goalChance ?? null
  const range = data.goalChanceRange ?? data.runView?.goalChanceRange ?? rawRange
  const options = data.recommendation.allOptions
  const labelOf = (id: string) => options.find(o => o.id === id)?.label ?? null
  const lines = data.goalChanceLicence ? fixtureOptionLines(data.goalChanceLicence, labelOf, gateWordsOf(data.goalChanceLicence)) : null
  const canonical: CanonicalAnalysisView = {
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    run,
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
      limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    leader_licence: 'withheld',
    options: options.map(option => {
      const entry = range?.rangeByOption[option.id]
      const rangeText = entry ? fixtureRangeFace(entry, labelOf(option.id), statedFaces[option.id]) : null
      const line = licence && lines ? lines[licence.optionIds.indexOf(option.id)] : undefined
      const face = line
      const withheld = data.recommendation.goalFiguresWithheldMessage ?? option.goalCertaintyUnearned?.say
      const pct = licence?.pctByOption[option.id] ?? null
      // Served shape (#2747): `display` is the figure's words ("about 17%"), the option's sentence is its `face`.
      const display = pct === null ? null : goalProbabilityWords(`${pct}%`)
      // Served shape (#2747 r2): a range cell's `display` is CEE's bounds words; the sentence is its `face`.
      const cell: CanonicalAnalysisCell = rangeText !== null && entry ? { kind: 'range', display: servedRangeDisplay(entry),
        face: rangeText, detail: {} }
        : withheld ? { kind: 'withheld', face: withheld, reasons: [] }
        : face !== undefined ? licence!.withheldOptionIds.includes(option.id) ? { kind: 'withheld', face, reasons: [] }
          : { kind: 'figure', display: display ?? face, face }
        : display !== null ? { kind: 'figure', display } : { kind: 'none' }
      const driver = licence?.driverByOption?.[option.id]
      const wireDriver = driver ? { ...driver, authored_by: driver.authoredBy,
        ...('userStatedLink' in driver ? { user_stated_link: driver.userStatedLink } : {}),
        ...('pctIfSide' in driver ? { pct_if_side: driver.pctIfSide } : {}),
        ...(driver.kind === 'factor_value' ? { factor_id: driver.factorId, cut_value: driver.cutValue,
          ...(driver.cutUnit === null ? {} : { cut_unit: driver.cutUnit }) } : {}),
      } : null
      return { option_id: option.id, cell, main_driver: wireDriver ? { kind: 'available', driver: wireDriver } : { kind: 'not_recorded' } }
    }),
  }
  return canonical
}

/**
 * The data's licence and ranges, held with their self-authored current canonical view, through the REAL gate (#2747).
 * `rawRange` is the Run's own range record, for data whose hook ran with no canonical view (its ranges are then gated
 * away); the returned data carries the view's gated ranges.
 */
export function withCanonicalTestCells(data: ResultsSectionDataReturn, rawRange: GoalChanceRange | null = null,
  statedFaces: Readonly<Record<string, string>> = {}): ResultsSectionDataReturn {
  const range = data.goalChanceRange ?? data.runView?.goalChanceRange ?? rawRange
  const view = runViewFromParts({ run_id: 'synthetic-ui-fixture' }, data.goalChanceLicence ?? data.runView?.goalChance ?? null,
    range, canonicalTestCellsOf(data, undefined, rawRange, statedFaces))
  return { ...data, runView: view, goalChanceRange: view.goalChanceRange }
}

/** The Run's own range record (test-only read; the view's ranges are gated by the canonical view this fixture supplies). */
export const rawRangeOf = (report: unknown) => readGoalChanceRange((report as { inference_warnings?: unknown } | null)?.inference_warnings)

/** Explicit synthetic canonical projection for isolated card layout tests. */
export function canonicalFixtureRunView(report: unknown, ctx: OptionChanceCellContext) {
  const view = buildRunView(report)
  // #2747: the view's own ranges are gated (none without a canonical view), so the fixture reads the Run's range record.
  const range = rawRangeOf(report)
  const ids = [...new Set([...(view.goalChance?.optionIds ?? []), ...(range?.optionIds ?? [])])]
  return withCanonicalTestCells({
    runView: view, goalChanceLicence: ctx.goalChanceHeroSays ? view.goalChance : null,
    goalChanceRange: range,
    goalChanceDriverNames: { labelOf: ctx.rangeLabelOf ?? ctx.labelOf },
    recommendation: { allOptions: ids.map(id => ({ id, label: ctx.labelOf(id) ?? '',
      goalCertaintyUnearned: ctx.goalCertaintyUnearned })), goalFiguresWithheldMessage: ctx.goalFiguresWithheldMessage },
  } as ResultsSectionDataReturn).runView!
}

/** Mount fixtures explicitly install their self-authored, scenario-bound canonical view once. */
export function installCanonicalFixtureState<T extends { results?: { report?: unknown }; nodes?: readonly { id: string; data?: { label?: unknown; [key: string]: unknown } }[]; currentScenarioId?: string | null }>(state: T, unlicensedFace?: string): T {
  const report = state.results?.report
  if (!report || typeof report !== 'object') return state
  const view = buildRunView(report)
  const range = rawRangeOf(report)
  const probabilities = (report as { option_probabilities?: Record<string, { win_probability?: unknown }> }).option_probabilities ?? {}
  const ids = [...new Set([...(view.goalChance?.optionIds ?? []), ...(range?.optionIds ?? []),
    ...(unlicensedFace ? Object.keys(probabilities).filter(id => typeof probabilities[id].win_probability === 'number') : [])])]
  if (ids.length === 0) return state
  const scenarioId = state.currentScenarioId ?? 'synthetic-card-scenario'
  const canonical = canonicalTestCellsOf({ runView: view, goalChanceLicence: view.goalChance, goalChanceRange: range,
    recommendation: { allOptions: ids.map(id => ({ id, label: String(state.nodes?.find(n => n.id === id)?.data?.label ?? id) })) },
    goalChanceDriverNames: { labelOf: (id: string) => String(state.nodes?.find(n => n.id === id)?.data?.label ?? id) },
  } as ResultsSectionDataReturn)
  const fixture = unlicensedFace ? { ...canonical, options: canonical.options.map(option => option.cell.kind === 'none'
    ? { ...option, cell: { kind: 'withheld' as const, face: unlicensedFace, reasons: [] } } : option) } : canonical
  useCanonicalAnalysisViewStore.getState().adopt(scenarioId, fixture)
  return { ...state, currentScenarioId: scenarioId, results: { ...state.results, report: { ...report, run_id: 'synthetic-ui-fixture' } } }
}

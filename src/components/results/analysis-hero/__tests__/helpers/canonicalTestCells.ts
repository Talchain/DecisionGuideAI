import { useCanonicalAnalysisViewStore } from '../../../../../canvas/stores/canonicalAnalysisViewStore'
import type { ResultsSectionDataReturn } from '../../../useResultsSectionData'
import { buildRunView, type OptionChanceCellContext } from '../../../../../canvas/runView/runView'
import type { CanonicalAnalysisView, CanonicalAnalysisCell } from '../../../../../canvas/runView/canonicalAnalysisView'
import { goalChanceOptionLines, goalChanceRangeLine } from '../../goalChanceCopy'

/** SELF-AUTHORED UI fixtures, not served evidence. Positive display tests explicitly supply
 * canonical cells; D1/served-byte/turn suites never use this helper. The historical chat
 * formatter supplies fixture words only, so its existing copy tests retain their scope. */
export function canonicalTestCellsOf(data: ResultsSectionDataReturn, run: CanonicalAnalysisView['run'] = { run_id: 'synthetic-ui-fixture', graph_hash_at_run: null, computed_at: null }): CanonicalAnalysisView {
  const licence = data.goalChanceLicence ?? data.runView?.goalChance ?? null
  const range = data.goalChanceRange ?? data.runView?.goalChanceRange ?? null
  const options = data.recommendation.allOptions
  const labelOf = (id: string) => options.find(o => o.id === id)?.label ?? null
  const lines = data.goalChanceLicence ? goalChanceOptionLines(data.goalChanceLicence, labelOf) : null
  const canonical: CanonicalAnalysisView = {
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    run,
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
      limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    leader_licence: 'withheld',
    options: options.map(option => {
      const entry = range?.rangeByOption[option.id]
      const rangeText = entry ? goalChanceRangeLine(entry, labelOf(option.id), data.goalChanceDriverNames?.labelOf ?? labelOf, range?.target) : null
      const line = licence && lines ? lines[licence.optionIds.indexOf(option.id)] : undefined
      const face = line
      const withheld = data.recommendation.goalFiguresWithheldMessage ?? option.goalCertaintyUnearned?.say
      const pct = licence?.pctByOption[option.id] ?? null
      const display = pct === null ? null : pct < 1 ? 'less than 1%' : pct > 99 ? 'more than 99%' : `about ${pct}%`
      const cell: CanonicalAnalysisCell = rangeText !== null ? { kind: 'range', display: rangeText,
        face: rangeText.includes(' chance of meeting your goal, in this model. ')
          ? rangeText.split(' chance of meeting your goal, in this model. ')[0] + ' chance of meeting your goal, in this model.' : rangeText, detail: {} }
        : withheld ? { kind: 'withheld', face: withheld, reasons: [] }
        : face !== undefined ? licence!.withheldOptionIds.includes(option.id) ? { kind: 'withheld', face, reasons: [] }
          : { kind: 'figure', display: face, face }
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

export function withCanonicalTestCells(data: ResultsSectionDataReturn): ResultsSectionDataReturn {
  const view = buildRunView({ run_id: 'synthetic-ui-fixture' }, canonicalTestCellsOf(data))
  Object.assign(view, { goalChance: data.goalChanceLicence ?? data.runView?.goalChance ?? null,
    goalChanceRange: data.goalChanceRange ?? data.runView?.goalChanceRange ?? null,
    ...(data.runView ? { chanceOf: data.runView.chanceOf } : {}),
  })
  return { ...data, runView: view }
}

/** Explicit synthetic canonical projection for isolated card layout tests. */
export function canonicalFixtureRunView(report: unknown, ctx: OptionChanceCellContext) {
  const view = buildRunView(report)
  const ids = [...new Set([...(view.goalChance?.optionIds ?? []), ...(view.goalChanceRange?.optionIds ?? [])])]
  return withCanonicalTestCells({
    runView: view, goalChanceLicence: ctx.goalChanceHeroSays ? view.goalChance : null,
    goalChanceRange: view.goalChanceRange,
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
  const probabilities = (report as { option_probabilities?: Record<string, { win_probability?: unknown }> }).option_probabilities ?? {}
  const ids = [...new Set([...(view.goalChance?.optionIds ?? []), ...(view.goalChanceRange?.optionIds ?? []),
    ...(unlicensedFace ? Object.keys(probabilities).filter(id => typeof probabilities[id].win_probability === 'number') : [])])]
  if (ids.length === 0) return state
  const scenarioId = state.currentScenarioId ?? 'synthetic-card-scenario'
  const canonical = canonicalTestCellsOf({ runView: view, goalChanceLicence: view.goalChance, goalChanceRange: view.goalChanceRange,
    recommendation: { allOptions: ids.map(id => ({ id, label: String(state.nodes?.find(n => n.id === id)?.data?.label ?? id) })) },
    goalChanceDriverNames: { labelOf: (id: string) => String(state.nodes?.find(n => n.id === id)?.data?.label ?? id) },
  } as ResultsSectionDataReturn)
  const fixture = unlicensedFace ? { ...canonical, options: canonical.options.map(option => option.cell.kind === 'none'
    ? { ...option, cell: { kind: 'withheld' as const, face: unlicensedFace, reasons: [] } } : option) } : canonical
  useCanonicalAnalysisViewStore.getState().adopt(scenarioId, fixture)
  return { ...state, currentScenarioId: scenarioId, results: { ...state.results, report: { ...report, run_id: 'synthetic-ui-fixture' } } }
}

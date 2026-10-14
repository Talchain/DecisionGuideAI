/**
 * Existing synthetic tests predate RunView. Give their explicitly supplied goal quantity a
 * test licence so they keep exercising their positive branch; joint-only, identity-held and
 * certainty-held entries remain unlicensed. S1's served-byte parity suite independently tests
 * disagreeing/withheld/range cells and a raw figure with no licence.
 *
 * #2747 chance authority gate: a licence alone no longer shows a figure. `licensedTestReport`
 * stamps the Run id and adds the licence only, so a spec that pins the no-canonical face
 * ("Chance not shown yet") keeps its premise. A spec that needs the gate OPEN uses
 * `licensedTestReportHeld`, which also adopts the Run's matching, CURRENT canonical view (CEE's
 * served shape: a figure cell whose `display` says the licensed whole percent) for the store's
 * current scenario; direct callers use `licensedTestCanonical` / `licensedTestView`.
 */
import { useCanvasStore } from '../../../store'
import { useCanonicalAnalysisViewStore } from '../../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView, type CanonicalAnalysisView } from '../../canonicalAnalysisView'
import { runViewOf, type RunView } from '../../runView'
import { goalProbabilityWords } from '../../../../components/results/utils/goalAnchorCopy'

export const LICENSED_TEST_RUN_ID = 'licensed-test-run'

type Rec = Record<string, any>
const licenceOf = (report: Rec): Rec | undefined => report.inference_warnings?.find((w: any) => w?.code === 'GOAL_CHANCE_LICENSED')

/** The licensed Run's canonical view: current, matching its Run id, a figure cell per licensed (not withheld) option. */
export function licensedTestCanonical(report: unknown): CanonicalAnalysisView | null {
  if (!report || typeof report !== 'object') return null
  const record = report as Rec
  const licence = licenceOf(record)
  if (!licence) return null
  const withheld = new Set<string>(licence.withheld_option_ids ?? [])
  return parseCanonicalAnalysisView({
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', leader_licence: 'withheld',
    run: { run_id: typeof record.run_id === 'string' ? record.run_id : LICENSED_TEST_RUN_ID, graph_hash_at_run: null, computed_at: null },
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
      limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    options: (licence.option_ids as string[]).map(option_id => ({ option_id, main_driver: { kind: 'not_recorded' },
      cell: withheld.has(option_id) || typeof licence.pct_by_option?.[option_id] !== 'number' ? { kind: 'withheld', reasons: [] }
        : { kind: 'figure', display: goalProbabilityWords(`${licence.pct_by_option[option_id]}%`) } })),
  })
}

/** A direct caller's view of the licensed report, held with its canonical view (the real gate). */
export function licensedTestView(report: unknown): RunView {
  const licensed = licensedTestReport(report)
  return runViewOf(licensed, licensedTestCanonical(licensed))
}

export function licensedTestReport<T>(report: T): T {
  if (!report || typeof report !== 'object') return report
  const record = report as Rec
  if (licenceOf(record)) return report
  const entries = Object.entries(record.option_probabilities ?? {}).filter(([, value]) => {
    const p = value as any
    return p && p.goalIdentityWithheld !== true && p.goalCertaintyUnearned === undefined
      && typeof (p.goal_probability ?? p.probability_of_goal) === 'number'
  })
  if (entries.length === 0) return report
  // The licence schema compares at least two options; singleton fixtures name a separate control.
  if (entries.length === 1) entries.push(['s1_control_option', { goal_probability: 0 }])
  const licensed = { ...record, run_id: typeof record.run_id === 'string' ? record.run_id : LICENSED_TEST_RUN_ID,
    inference_warnings: [...(record.inference_warnings ?? []), {
      code: 'GOAL_CHANCE_LICENSED', form: 'each', severity: 'info', message: 'licensed',
      target: { unit: 'GBP', value: 100, comparator: 'at_least' },
      option_ids: entries.map(([id]) => id),
      pct_by_option: Object.fromEntries(entries.map(([id, p]) => [id, Math.round(((p as any).goal_probability ?? (p as any).probability_of_goal) * 100)])),
    }] }
  return licensed as T
}

/** The licensed report, AND its matching current canonical view adopted for the store's current scenario (gate open). */
export function licensedTestReportHeld<T>(report: T): T {
  const licensed = licensedTestReport(report)
  // The store's current scenario at the call (a mocked store without one reads `undefined`, and so does the consumer).
  const scenarioId = (useCanvasStore as unknown as { getState?: () => { currentScenarioId?: string | null } } | undefined)
    ?.getState?.()?.currentScenarioId
  useCanonicalAnalysisViewStore.getState().adopt(scenarioId as string, licensedTestCanonical(licensed))
  return licensed
}

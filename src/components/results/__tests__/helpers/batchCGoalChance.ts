/**
 * Recovery Batch C (UI): Paul's two journeys as the C CEE serves them, for the Results surfaces.
 *
 * WORDS: every sentence here is copied from C CEE's own specs at 5d5552c
 * (`goal-target/__tests__/batch-c-goal-chance-licence.test.ts`: the licence's `chance_words`, `notes`, `status_quo`,
 * `targets`; the hiring faces from its "hiring on the screen" case; the marketing withheld `why` from its "screen cells
 * quote the joint" case). The marketing licensed faces follow CEE's face rule (`goal-chance-screen-lines.ts:64`:
 * `‘label’: about N% ${chance_words}, in this model.`). The UI must say them as served and compose no chance of its own.
 *
 * SHAPE: the Run goes through the REAL V5 mapper (`mapV5AnalysisToReport`) and the canonical view through the REAL
 * parser (`parseCanonicalAnalysisView`) into the scenario-bound store, exactly as READ/TURN adopt it.
 * `probability_of_goal` on marketing is the NEW CUSTOMERS marginal (60 / 70); the joint (35 / 48) is the headline.
 */
import { useCanvasStore } from '../../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'

type Rec = Record<string, unknown>

export const HIRING_WORDS = 'chance of ‘Productivity’ being at least 10% higher than today at three months'
export const HIRING_TWO_DEVS_FACE = '‘Hire two developers’: about 31% chance of ‘Productivity’ being at least 10% higher than today at three months, in this model.'
export const HIRING_TECH_LEAD_FACE = '‘Hire a tech lead’: about 46% chance of ‘Productivity’ being at least 10% higher than today at three months, in this model.'
export const HIRING_STATUS_QUO_FACE = 'No change, by assumption'
export const HIRING_STATUS_QUO_LINE = 'Doing nothing: no change to ‘Productivity’ in this model, by assumption.'
export const HIRING_NOTES = [
  'This assumes carrying on as now leaves ‘Productivity’ unchanged through month three; each option is measured against that.',
  'Each option’s effects are read as their size at month three, including recruitment and ramp-up '
    + '(% of today’s productivity per added person, at month three), and are added together: twice the change counts twice, '
    + 'with no diminishing returns, interactions or extra onboarding drag modelled.',
  'This chance covers ‘Productivity’ only. It does not include: ‘First-year hiring cost’ at most £200,000; code quality maintained.',
]

export const MARKETING_WORDS = 'chance of ‘New customers’ being at least 20 customers and ‘Conversion rate’ being above 15% over the first three months after launch'
export const MARKETING_NEW_CUSTOMERS_WORDS = '‘New customers’ being at least 20 customers over the first three months after launch'
export const MARKETING_CONVERSION_WORDS = '‘Conversion rate’ being above 15% over the first three months after launch'
export const MARKETING_JOINT_WITHHELD_LINE = 'The chance of meeting both together isn’t calculated yet.'
export const MARKETING_FRECHET_LINE = 'Meeting both is no more likely than the lower of the two chances.'
export const MARKETING_NEW_CUSTOMERS_TARGET_LINE = 'On its own, the chance of ‘New customers’ being at least 20 customers over the first three months after launch, '
  + 'in this model: ‘Hire a marketing manager’ about 60%; ‘AI planning plus advertising’ about 70%.'
export const MARKETING_CONVERSION_TARGET_LINE = 'On its own, the chance of ‘Conversion rate’ being above 15% over the first three months after launch, '
  + 'in this model: ‘Hire a marketing manager’ about 42%; ‘AI planning plus advertising’ about 55%.'
export const MARKETING_NOTES = [
  'This assumes carrying on as now leaves ‘New customers’ and ‘Conversion rate’ unchanged over that period; each option is measured against that.',
]
export const marketingFace = (label: string, pct: number) => `‘${label}’: about ${pct}% ${MARKETING_WORDS}, in this model.`

const outcome = (mean: number) => ({ mean, std: 2, p10: mean - 3, p50: mean, p90: mean + 3, n_samples: 10000, n_valid_samples: 10000, validity_ratio: 1 })
const entry = (id: string, label: string, extra: Rec) => ({ id, option_id: id, label, option_label: label, status: 'computed', ...extra })
const STALENESS = { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
  limitation: 'Hash equality cannot detect brief, framing or stage changes.' }
const node = (id: string, kind: string, label: string, data: Rec = {}) => ({ id, type: kind, position: { x: 0, y: 0 }, data: { label, type: kind, kind, ...data } })

export const MARKETING_TARGET_ROWS = [
  { constraint_id: 'target:new_customers', node_id: 'new_customers', operator: '>=', value: 20, unit: 'customers', value_frame: 'level', role: 'goal_target' },
  { constraint_id: 'target:conversion_rate', node_id: 'conversion_rate', operator: '>=', operator_as_stated: '>', value: 15, unit: '%', value_frame: 'level', role: 'goal_target' },
]

interface Journey { scenarioId: string; nodes: Rec[]; block: Rec; canonical: Rec; analysisReady: Rec; goalConstraints?: Rec[] }

const HIRING_LICENCE = {
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
  option_ids: ['hire_a_tech_lead', 'hire_two_developers', 'carry_on'], pct_by_option: { hire_a_tech_lead: 46, hire_two_developers: 31 },
  withheld_option_ids: ['carry_on'], target: { comparator: 'at_least', value: 10, unit: '%', frame: 'change_abs' },
  chance_words: HIRING_WORDS, notes: HIRING_NOTES, status_quo: { option_id: 'carry_on', line: HIRING_STATUS_QUO_LINE },
}

export function hiringJourney(): Journey {
  return {
    scenarioId: 'batch-c-hiring',
    nodes: [
      node('productivity', 'goal', 'Productivity', { goal_threshold_raw: 10, goal_threshold_unit: '%', goal_threshold_frame: 'change_abs', goal_direction: '>=' }),
      node('hire_a_tech_lead', 'option', 'Hire a tech lead'),
      node('hire_two_developers', 'option', 'Hire two developers'),
      node('carry_on', 'option', 'Carry on with the current team'),
      node('cost', 'factor', 'First-year hiring cost'),
    ],
    block: { type: 'analysis_result', run_id: 'run-batch-c-hiring', summary: 'Hiring', leading_option_id: null,
      enrichment: { option_comparison: [
        entry('hire_a_tech_lead', 'Hire a tech lead', { probability_of_goal: 0.46, win_probability: 0.55, outcome: outcome(12) }),
        entry('hire_two_developers', 'Hire two developers', { probability_of_goal: 0.31, win_probability: 0.4, outcome: outcome(9) }),
        entry('carry_on', 'Carry on with the current team', { probability_of_goal: 0, win_probability: 0.05, outcome: outcome(0) }),
      ], inference_warnings: [HIRING_LICENCE] } },
    canonical: { schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
      run: { run_id: 'run-batch-c-hiring', graph_hash_at_run: null, computed_at: null }, staleness: STALENESS, leader_licence: 'withheld',
      options: [
        { option_id: 'hire_a_tech_lead', cell: { kind: 'figure', display: 'about 46%', face: HIRING_TECH_LEAD_FACE }, main_driver: { kind: 'not_recorded' } },
        { option_id: 'hire_two_developers', cell: { kind: 'figure', display: 'about 31%', face: HIRING_TWO_DEVS_FACE }, main_driver: { kind: 'not_recorded' } },
        { option_id: 'carry_on', cell: { kind: 'withheld', face: HIRING_STATUS_QUO_FACE, why: HIRING_STATUS_QUO_LINE,
          reasons: [{ code: 'status_quo_by_assumption', message: HIRING_STATUS_QUO_LINE }] }, main_driver: { kind: 'not_recorded' } },
      ],
      goal_chance: { chance_words: HIRING_WORDS, notes: HIRING_NOTES, status_quo: { option_id: 'carry_on', line: HIRING_STATUS_QUO_LINE } } },
    analysisReady: { goal_threshold_raw: 10, goal_threshold_unit: '%' },
  }
}

const PER_TARGET = [
  { constraint_id: 'target:new_customers', words: MARKETING_NEW_CUSTOMERS_WORDS,
    options: [{ option_id: 'hire_manager', display: 'about 60%' }, { option_id: 'ai_plus_ads', display: 'about 70%' }] },
  { constraint_id: 'target:conversion_rate', words: MARKETING_CONVERSION_WORDS,
    options: [{ option_id: 'hire_manager', display: 'about 42%' }, { option_id: 'ai_plus_ads', display: 'about 55%' }] },
]

/** `licensed`: the same-draw joint is quoted (35 / 48). `withheld`: no joint precision, so no option is quoted. */
export function marketingJourney(joint: 'licensed' | 'withheld'): Journey {
  const licensed = joint === 'licensed'
  const licence = { code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
    option_ids: ['hire_manager', 'ai_plus_ads'], pct_by_option: licensed ? { hire_manager: 35, ai_plus_ads: 48 } : {},
    withheld_option_ids: licensed ? [] : ['hire_manager', 'ai_plus_ads'],
    target: { comparator: 'at_least', value: 20, unit: 'customers' }, chance_words: MARKETING_WORDS, notes: MARKETING_NOTES,
    targets: { joint: licensed ? { status: 'licensed', words: MARKETING_WORDS }
      : { status: 'withheld', reason: 'precision_missing', line: MARKETING_JOINT_WITHHELD_LINE, frechet_line: MARKETING_FRECHET_LINE },
    per_target: PER_TARGET.map(t => ({ ...t, pct_by_option: Object.fromEntries(t.options.map(o => [o.option_id, Number(o.display.replace(/\D/g, ''))])) })) } }
  const withheldWhy = `${MARKETING_JOINT_WITHHELD_LINE} ${MARKETING_FRECHET_LINE}`
  const cell = (label: string, pct: number) => licensed ? { kind: 'figure', display: `about ${pct}%`, face: marketingFace(label, pct) }
    : { kind: 'withheld', face: 'Chance not shown yet', why: withheldWhy, reasons: [{ code: 'goal_joint_not_shown', message: withheldWhy }] }
  const precision = licensed ? { probability_of_joint_goal_precision: { n_informative: 10000, standard_error: 0.005 } } : {}
  return {
    scenarioId: `batch-c-marketing-${joint}`,
    nodes: [
      node('new_customers', 'goal', 'New customers', { goal_threshold_raw: 20, goal_threshold_unit: 'customers', goal_threshold_frame: 'level', goal_direction: '>=' }),
      node('conversion_rate', 'factor', 'Conversion rate'),
      node('hire_manager', 'option', 'Hire a marketing manager'),
      node('ai_plus_ads', 'option', 'AI planning plus advertising'),
    ],
    block: { type: 'analysis_result', run_id: `run-batch-c-marketing-${joint}`, summary: 'Marketing', leading_option_id: null,
      enrichment: { option_comparison: [
        entry('hire_manager', 'Hire a marketing manager', { probability_of_goal: 0.6, probability_of_joint_goal: 0.35, ...precision, win_probability: 0.4, outcome: outcome(18) }),
        entry('ai_plus_ads', 'AI planning plus advertising', { probability_of_goal: 0.7, probability_of_joint_goal: 0.48, ...precision, win_probability: 0.6, outcome: outcome(21) }),
      ], inference_warnings: [licence] } },
    canonical: { schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
      run: { run_id: `run-batch-c-marketing-${joint}`, graph_hash_at_run: null, computed_at: null }, staleness: STALENESS, leader_licence: 'withheld',
      options: [
        { option_id: 'hire_manager', cell: cell('Hire a marketing manager', 35), main_driver: { kind: 'not_recorded' } },
        { option_id: 'ai_plus_ads', cell: cell('AI planning plus advertising', 48), main_driver: { kind: 'not_recorded' } },
      ],
      goal_chance: { chance_words: MARKETING_WORDS, notes: MARKETING_NOTES, targets: {
        joint: licensed ? { status: 'licensed', words: MARKETING_WORDS }
          : { status: 'withheld', line: MARKETING_JOINT_WITHHELD_LINE, frechet_line: MARKETING_FRECHET_LINE },
        per_target: PER_TARGET } } },
    analysisReady: { goal_threshold_raw: 20, goal_threshold_unit: 'customers' },
    goalConstraints: MARKETING_TARGET_ROWS,
  }
}

/** Seed the canvas store with the journey's Run and adopt its canonical view through the READ parser. */
export function seedJourney(journey: Journey, canonical: Rec | null = journey.canonical): void {
  const report = mapV5AnalysisToReport(journey.block as never) as unknown as Rec
  useCanvasStore.setState({
    nodes: journey.nodes, edges: [], ceeAnalysisReady: journey.analysisReady, viewMode: 'standard', analysisStateV1: null,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-10-12T02:00:00.000Z' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: journey.scenarioId,
    v5AnalysisFact: { scenarioId: journey.scenarioId, analysisHash: String(journey.block.run_id), hasRunAnalysisFact: true },
    hasCompletedFirstRun: true, goalConstraints: journey.goalConstraints ?? null,
    results: { status: 'complete', hash: String(journey.block.run_id), report },
  } as never)
  useCanonicalAnalysisViewStore.getState().adopt(journey.scenarioId, canonical === null ? null : parseCanonicalAnalysisView(canonical))
}

export function resetJourney(): void {
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, ceeAnalysisReady: null,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null }, goalConstraints: null,
    nodes: [], edges: [], currentScenarioId: null,
  } as never)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
}

/**
 * #2747 re-scope 2 (U1): THE SENTINEL RUN, for the behavioural census (`chanceSentinel.census.spec.tsx`).
 *
 * Every raw probability-like field on the Run holds a UNIQUE value, so any rendering of it is attributable to that field:
 * its whole percent ("37%"), its one-decimal percent ("37.2"), its fraction ("0.37"), "37 in 100", and, for the fields a
 * surface has banded, its nearest-5 band. CEE's canonical view comes in two forms:
 *  - WITHHELD: no option licensed; every cell says CEE's withheld face and why, with no figure;
 *  - LICENSED: served strings whose numbers NO raw field holds (64%, 18–26%, 88/79/91/72%, 34%), so a served figure on
 *    the screen can only have come from the served string;
 *  - SAME_BOUNDS: as LICENSED, but the range cell's served bounds ARE the raw range's (23–29%), the checker's finding-2
 *    reproduction: a surface that composes its own range sentence from the bounds is then visible by its WORDS.
 * The outcome values (means 12 / 9 / 0, ±3) are model outcomes, not chances; no sentinel or served figure is one of them.
 *
 * SELF-AUTHORED, not served evidence: it tests what the UI does with raw numbers. The words follow CEE's shapes (the face
 * rule `‘label’: about N% <chance words>, in this model.`, the status-quo line, the range display) but are fixture words.
 * The Run goes through the REAL V5 mapper and the canonical view through the REAL parser into the scenario-bound store,
 * as `helpers/batchCGoalChance.ts` does.
 */
import { DEFAULT_EDGE_DATA } from '../../../domain/edges'
import { useCanvasStore } from '../../../store'
import { useCanonicalAnalysisViewStore } from '../../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../canonicalAnalysisView'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { AnalysisStateV1Schema, type RunDelta } from '@talchain/schemas/boundary'
import { runChangeDelta } from '../../../compare-tab/__tests__/__fixtures__/runChangeArtefact'

type Rec = Record<string, unknown>

export const SCENARIO = 'chance-sentinel'
export const RUN_ID = 'run-chance-sentinel'
export const GRAPH_HASH = 'graph-hash-chance-sentinel'
export const A = 'opt_alder'
export const B = 'opt_birch'
export const SQ = 'carry_on'
export const LABEL = { [A]: 'Alder plan', [B]: 'Birch plan', [SQ]: 'Carry on as now' } as const

/** The raw fields, each with a unique value (fractions as the wire carries them; whole percents where the wire does). */
export const RAW = {
  probability_of_goal: { [A]: 0.3719, [B]: 0.2683, [SQ]: 0.1347 },
  probability_of_joint_goal: { [A]: 0.4391, [B]: 0.3861 },
  win_probability: { [A]: 0.5273, [B]: 0.3317, [SQ]: 0.1411 },
  root_probability_of_goal: 0.7836,
  pct_by_option: { [A]: 71, [B]: 62 },
  per_target_productivity: { [A]: 76, [B]: 68 },
  per_target_morale: { [A]: 81, [B]: 57 },
  range_low_pct: 23,
  range_high_pct: 29,
  driver_pct_if_side: 17,
  constraint_probability: 0.8423,
  conditional_probability: 0.9167,
  marginal_probability: 0.6613,
  run_delta_prior: 47,
  run_delta_current: 58,
  run_delta_win: { priorA: 0.6143, currentA: 0.6529, priorB: 0.2219, currentB: 0.1906 },
  snapshot_headline_share: 0.4812,
  conditional_win: { high: 0.6871, low: 0.4129 },
  prob_satisfied: 0.5389,
  constraint_probability_by_option: 0.4627,
  joint_probability: 0.3121,
  switch_probability: 0.8619,
} as const

/** CEE's `user_link_existence.one_in` ("a 1-in-N chance each"): a count, so it has its own renderings. */
export const ONE_IN = 7

/** The fields a surface has drawn in nearest-5 bands (WinGauge, option shares); the others are matched exactly. */
const BANDED = new Set(['probability_of_goal', 'win_probability'])

export interface Sentinel { readonly field: string; readonly pct: number; readonly fraction: number | null; readonly banded: boolean }

/** Every sentinel, one per raw value. */
export const SENTINELS: readonly Sentinel[] = Object.entries(RAW).flatMap(([field, v]) => {
  const one = (x: number): Sentinel => x <= 1
    ? { field, pct: Math.round(x * 100), fraction: x, banded: BANDED.has(field) }
    : { field, pct: x, fraction: null, banded: false }
  return typeof v === 'number' ? [one(v)] : Object.values(v as Record<string, number>).map(one)
})

/** The renderings of one sentinel that a surface could produce. */
export function sentinelPatterns(s: Sentinel): RegExp[] {
  const p = s.pct
  const out = [
    new RegExp(`(?<![\\d.])${p}(?:\\.\\d+)?\\s*%`),
    new RegExp(`(?<![\\d.])${p}\\s+(?:in|out of)\\s+100\\b`),
  ]
  if (s.fraction !== null) {
    // The raw value itself, as a stored record or a payload carries it ("0.5273").
    out.push(new RegExp(`(?<![\\d.])${String(s.fraction).replace('.', '\\.')}(?!\\d)`))
    out.push(new RegExp(`(?<![\\d.])0\\.${String(Math.round(s.fraction * 100)).padStart(2, '0')}(?!\\d*%)`))
    out.push(new RegExp(`(?<![\\d.])${(s.fraction * 100).toFixed(1).replace('.', '\\.')}(?!\\d)`))
  }
  if (s.banded) {
    const band = Math.max(5, Math.min(95, Math.round(p / 5) * 5))
    if (band !== p) out.push(new RegExp(`(?<![\\d.])${band}\\s*%`))
  }
  return out
}

/** Every sentinel rendering found in a text, as "field=pct (form)". `served` names fields whose value is a served string here. */
export function sentinelHits(text: string, served: readonly string[] = []): string[] {
  const hits: string[] = []
  for (const s of SENTINELS) {
    if (served.includes(s.field)) continue
    for (const re of sentinelPatterns(s)) {
      const m = re.exec(text)
      if (m) hits.push(`${s.field}=${s.pct} "${text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).replace(/\s+/g, ' ')}"`)
    }
  }
  const oneIn = new RegExp(`\\b1[-\\s]in[-\\s]${ONE_IN}\\b`).exec(text)
  if (oneIn) hits.push(`user_link_existence.one_in=${ONE_IN} "${text.slice(Math.max(0, oneIn.index - 30), oneIn.index + oneIn[0].length + 10)}"`)
  return hits
}

// ─── CEE's served strings (LICENSED form). None of their numbers is a raw value above. ───
export const CHANCE_WORDS = 'chance of ‘Productivity’ being at least 10% higher than today at three months'
export const PROVISIONAL = 'using Olumi’s estimates for 1 starting value (see Check estimates)'
export const FACE_A = `‘Alder plan’: about 64% ${CHANCE_WORDS}, in this model, ${PROVISIONAL}.`
export const DISPLAY_A = 'about 64%'
export const DISPLAY_B = 'between about 18% and 26%'
export const FACE_B = `‘Birch plan’: between about 18% and 26% ${CHANCE_WORDS}, in this model, depending on how strongly ‘Ramp-up time’ affects ‘Productivity’.`
export const SQ_FACE = 'No change, by assumption'
export const SQ_LINE = 'Carrying on as now: no change to ‘Productivity’ in this model, by assumption.'
export const DRIVER_DETAIL_A = '‘Alder plan’’s chance rests most on ‘Ramp-up time’: about 34% if it runs past four months.'
export const NOTES = ['This assumes carrying on as now leaves ‘Productivity’ unchanged through month three; each option is measured against that.']
export const PER_TARGET_WORDS = { productivity: '‘Productivity’ being at least 10% higher than today at three months',
  morale: '‘Morale’ being at least 6 points at three months' }
export const PER_TARGET_DISPLAY = { productivity: { [A]: 'about 88%', [B]: 'about 79%' }, morale: { [A]: 'about 91%', [B]: 'about 72%' } }
export const JOINT_WORDS = 'chance of ‘Productivity’ being at least 10% higher than today and ‘Morale’ being at least 6 points at three months'
/** The served figures, as a surface would show them; they may appear ONLY on the journey-path (U0) surfaces. */
export const SERVED_FIGURES = ['64%', '18%', '26%', '88%', '79%', '91%', '72%', '34%']
/** SAME_BOUNDS: the range cell says the raw bounds (finding 2), in CEE's words with the target meaning and provisional clause. */
export const DISPLAY_B_SAME = 'between about 23% and 29%'
export const FACE_B_SAME = `‘Birch plan’: between about 23% and 29% ${CHANCE_WORDS}, in this model, depending on how strongly ‘Ramp-up time’ affects ‘Productivity’.`
/**
 * AGREEING_LOW: the licence's figures and CEE's cells AGREE for every option (the served happy path, as on a level goal:
 * the gate passes each figure through, so the Results cards draw their goal row) and each is under 10%, so the
 * value-dependent branches (floors, low-chance badges) are on the screen for the census. In the other licensed forms
 * the licence's raw figures and the cells disagree, and the status quo is withheld, so no card goal row draws at all.
 */
export const LOW_PCT = { [A]: 6, [B]: 8, [SQ]: 4 } as const
export const LOW_DISPLAY = { [A]: `about ${LOW_PCT[A]}%`, [B]: `about ${LOW_PCT[B]}%`, [SQ]: `about ${LOW_PCT[SQ]}%` } as const
export const LOW_FACE = {
  [A]: `‘Alder plan’: ${LOW_DISPLAY[A]} ${CHANCE_WORDS}, in this model, ${PROVISIONAL}.`,
  [B]: `‘Birch plan’: ${LOW_DISPLAY[B]} ${CHANCE_WORDS}, in this model.`,
  [SQ]: `‘Carry on as now’: ${LOW_DISPLAY[SQ]} ${CHANCE_WORDS}, in this model.`,
} as const
/**
 * NO_WORDS: licensed as (b), but CEE serves no `chance_words` (the licence and the canonical view): the UI's own target words
 * are then the only words for what the chance is OF, so the target-in-its-own-frame readers (finding 3) are on the screen.
 */
export type SentinelForm = 'withheld' | 'licensed' | 'same_bounds' | 'agreeing_low' | 'no_words'

// ─── CEE's served strings (WITHHELD form): no figure anywhere. ───
export const WITHHELD_FACE = 'Chance not shown yet'
export const WHY_A = '‘Alder plan’ rests on a starting value Olumi has not been given yet.'
export const WHY_B = '‘Birch plan’ rests on a link nobody has sized yet.'
export const JOINT_WITHHELD_LINE = 'The chance of meeting both together isn’t calculated yet.'
export const DRIVER_NONE_REASON = 'No main driver is recorded for a chance that is not shown.'

/** UI-composed chance phrases that must not appear where served words exist. */
export const GENERIC_CHANCE_PHRASES = [/chance of meeting your goal/i, /\byour goal\b/i, /chance of meeting (?:the|this) goal/i]

const outcome = (mean: number) => ({ mean, std: 2, p10: mean - 3, p50: mean, p90: mean + 3, n_samples: 10000, n_valid_samples: 10000, validity_ratio: 1 })
const entry = (id: string, extra: Rec) => ({ id, option_id: id, label: LABEL[id as keyof typeof LABEL], option_label: LABEL[id as keyof typeof LABEL], status: 'computed', ...extra })
const node = (id: string, kind: string, label: string, data: Rec = {}) => ({ id, type: kind, position: { x: 0, y: 0 }, data: { label, type: kind, kind, ...data } })
const STALENESS = { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
  limitation: 'Hash equality cannot detect brief, framing or stage changes.' }

export const NODES = [
  node('decide', 'decision', 'How should we lift productivity?'),
  node('productivity', 'goal', 'Productivity', { quantity_frame: 'change', goal_threshold_raw: 10, goal_threshold_unit: '%', goal_threshold_frame: 'change_abs', goal_direction: '>=' }),
  node(A, 'option', LABEL[A]),
  node(B, 'option', LABEL[B]),
  node(SQ, 'option', LABEL[SQ]),
  node('ramp_up', 'factor', 'Ramp-up time'),
  node('morale', 'factor', 'Morale'),
  node('delay_risk', 'risk', 'Hiring delay'),
  node('delivery', 'outcome', 'Delivery speed'),
]

/**
 * The model's links: the decision to each option, each option to the factors it sets, the factors to the goal, and the risk
 * to the outcome. Surfaces that list a node's neighbours (the decision's options, an option's impact, a risk's options)
 * read these, so with no links they would mount empty and the census would pass vacuously (#2747 re-scope 2).
 */
const edge = (source: string, target: string) => ({ id: `${source}->${target}`, source, target, data: { ...DEFAULT_EDGE_DATA } })
export const EDGES = [
  edge('decide', A), edge('decide', B), edge('decide', SQ),
  edge(A, 'ramp_up'), edge(B, 'ramp_up'), edge(B, 'morale'),
  edge('ramp_up', 'productivity'), edge('morale', 'productivity'),
  edge('delay_risk', 'delivery'), edge(A, 'delay_risk'), edge('delivery', 'productivity'),
]

const TARGET_ROWS = [
  { constraint_id: 'target:productivity', node_id: 'productivity', operator: '>=', value: 10, unit: '%', value_frame: 'change_abs', role: 'goal_target' },
  { constraint_id: 'target:morale', node_id: 'morale', operator: '>=', value: 6, unit: 'points', value_frame: 'level', role: 'goal_target' },
]

/** The raw Run: every field above, through the real V5 block shape. */
export function sentinelBlock(form: SentinelForm = 'licensed'): Rec {
  const licence = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
    option_ids: [A, B, SQ], pct_by_option: form === 'agreeing_low' ? { ...LOW_PCT } : { ...RAW.pct_by_option },
    withheld_option_ids: form === 'agreeing_low' ? [] : [SQ],
    target: { comparator: 'at_least', value: 10, unit: '%', frame: 'change_abs' },
    ...(form === 'no_words' ? {} : { chance_words: CHANCE_WORDS }), notes: NOTES,
    ...(form === 'agreeing_low' ? {} : { status_quo: { option_id: SQ, line: SQ_LINE } }),
    user_link_existence: { links: 2, one_in: ONE_IN },
    driver_by_option: { [A]: { kind: 'factor_value', factor_id: 'ramp_up', side: 'high', cut_value: 4, cut_unit: 'months',
      pct_if_side: RAW.driver_pct_if_side, authored_by: 'olumi' } },
    targets: { joint: { status: 'licensed', words: JOINT_WORDS }, per_target: [
      { constraint_id: 'target:productivity', words: PER_TARGET_WORDS.productivity, pct_by_option: { ...RAW.per_target_productivity },
        options: [{ option_id: A, display: `about ${RAW.per_target_productivity[A]}%` }, { option_id: B, display: `about ${RAW.per_target_productivity[B]}%` }] },
      { constraint_id: 'target:morale', words: PER_TARGET_WORDS.morale, pct_by_option: { ...RAW.per_target_morale },
        options: [{ option_id: A, display: `about ${RAW.per_target_morale[A]}%` }, { option_id: B, display: `about ${RAW.per_target_morale[B]}%` }] },
    ] },
  }
  const range = { code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: [B],
    range_by_option: { [B]: { low_pct: RAW.range_low_pct, high_pct: RAW.range_high_pct, low_rounding: 'whole', high_rounding: 'whole',
      kind: 'link_strength', from: 'ramp_up', to: 'productivity', among: 'all' } } }
  const precision = { probability_of_joint_goal_precision: { n_informative: 10000, standard_error: 0.005 } }
  return {
    type: 'analysis_result', run_id: RUN_ID, computed_against_hash: GRAPH_HASH, summary: 'Sentinel run', leading_option_id: null,
    win_probabilities: { [LABEL[A]]: RAW.win_probability[A], [LABEL[B]]: RAW.win_probability[B], [LABEL[SQ]]: RAW.win_probability[SQ] },
    enrichment: {
      option_comparison: [
        entry(A, { probability_of_goal: RAW.probability_of_goal[A], probability_of_joint_goal: RAW.probability_of_joint_goal[A], ...precision,
          win_probability: RAW.win_probability[A], outcome: outcome(12),
          // The per-limit fields (`prob_satisfied`, `constraint_probabilities`, `joint_probability`), as the producer's entry carries them.
          constraint_probabilities: { 'target:morale': RAW.constraint_probability_by_option },
          constraint_analysis: { constraints: [{ constraint_id: 'target:morale', node_id: 'morale', label: 'Morale', direction: 'min',
            threshold: 6, prob_satisfied: RAW.prob_satisfied }], joint_probability: RAW.joint_probability } }),
        entry(B, { probability_of_goal: RAW.probability_of_goal[B], probability_of_joint_goal: RAW.probability_of_joint_goal[B], ...precision,
          win_probability: RAW.win_probability[B], outcome: outcome(9) }),
        entry(SQ, { probability_of_goal: RAW.probability_of_goal[SQ], win_probability: RAW.win_probability[SQ], outcome: outcome(0) }),
      ],
      factor_sensitivity: [{ factor_id: 'ramp_up', factor_label: 'Ramp-up time', elasticity: -0.21, direction: 'negative' }],
      // A fragile link with its measured switch probability and the option it would switch towards (robustness lens, hero).
      robustness: { fragile_edges: [{ edge_id: 'ramp_up->productivity', from_id: 'ramp_up', to_id: 'productivity', from_label: 'Ramp-up time',
        to_label: 'Productivity', switch_probability: RAW.switch_probability, alternative_winner_id: B, alternative_winner_label: LABEL[B] }] },
      // The Analysis tab's conditional-scenario cards (ConditionalWinnerCards) draw each side's win share.
      conditional_winners: [{ factor_id: 'ramp_up', factor_label: 'Ramp-up time', split_value: 4, split_unit: 'months', winner_flips: true,
        high_bucket: { winner_id: A, winner_label: LABEL[A], win_probability: RAW.conditional_win.high },
        low_bucket: { winner_id: B, winner_label: LABEL[B], win_probability: RAW.conditional_win.low } }],
      conditional_probabilities: [{ constraint_a_id: 'target:productivity', constraint_a_label: 'Productivity', constraint_b_id: 'target:morale',
        constraint_b_label: 'Morale', conditional_probability: RAW.conditional_probability, marginal_probability: RAW.marginal_probability }],
      inference_warnings: [licence, range],
    },
  }
}

/** CEE's canonical view for the Run, in each form. */
export function sentinelCanonical(form: SentinelForm): Rec {
  const run = { run_id: RUN_ID, graph_hash_at_run: GRAPH_HASH, computed_at: null }
  const sq = { option_id: SQ, cell: { kind: 'withheld', face: SQ_FACE, why: SQ_LINE, reasons: [{ code: 'status_quo_by_assumption', message: SQ_LINE }] },
    main_driver: { kind: 'none_licensed', reason: DRIVER_NONE_REASON } }
  const base = { schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', run, staleness: STALENESS, leader_licence: 'withheld' }
  if (form === 'withheld') {
    const withheld = (why: string) => ({ kind: 'withheld', face: WITHHELD_FACE, why, reasons: [{ code: 'value_unconfirmed', message: why }] })
    return { ...base,
      options: [
        { option_id: A, cell: withheld(WHY_A), main_driver: { kind: 'none_licensed', reason: DRIVER_NONE_REASON } },
        { option_id: B, cell: withheld(WHY_B), main_driver: { kind: 'none_licensed', reason: DRIVER_NONE_REASON } },
        sq,
      ],
      goal_chance: { chance_words: CHANCE_WORDS, notes: NOTES, status_quo: { option_id: SQ, line: SQ_LINE },
        targets: { joint: { status: 'withheld', line: JOINT_WITHHELD_LINE }, per_target: [] } } }
  }
  const driver = { kind: 'factor_value', factor_id: 'ramp_up', side: 'high', cut_value: 4, cut_unit: 'months', pct_if_side: RAW.driver_pct_if_side, authored_by: 'olumi' }
  return { ...base,
    options: [
      { option_id: A, cell: form === 'agreeing_low' ? { kind: 'figure', display: LOW_DISPLAY[A], face: LOW_FACE[A] }
        : { kind: 'figure', display: DISPLAY_A, face: FACE_A }, main_driver: { kind: 'available', driver, detail: DRIVER_DETAIL_A } },
      // A driver record with NO served detail: its raw figure must never become a sentence.
      { option_id: B, cell: form === 'same_bounds'
        ? { kind: 'range', display: DISPLAY_B_SAME, face: FACE_B_SAME, detail: { range: DISPLAY_B_SAME } }
        : form === 'agreeing_low' ? { kind: 'figure', display: LOW_DISPLAY[B], face: LOW_FACE[B] }
        : { kind: 'range', display: DISPLAY_B, face: FACE_B, detail: { range: DISPLAY_B } }, main_driver: { kind: 'available', driver: { ...driver, factor_id: 'morale' } } },
      form === 'agreeing_low'
        ? { option_id: SQ, cell: { kind: 'figure', display: LOW_DISPLAY[SQ], face: LOW_FACE[SQ] }, main_driver: { kind: 'none_licensed', reason: DRIVER_NONE_REASON } }
        : sq,
    ],
    goal_chance: { ...(form === 'no_words' ? {} : { chance_words: CHANCE_WORDS }), notes: NOTES,
      ...(form === 'agreeing_low' ? {} : { status_quo: { option_id: SQ, line: SQ_LINE } }),
      targets: { joint: { status: 'licensed', words: JOINT_WORDS }, per_target: [
        { constraint_id: 'target:productivity', words: PER_TARGET_WORDS.productivity,
          options: [{ option_id: A, display: PER_TARGET_DISPLAY.productivity[A] }, { option_id: B, display: PER_TARGET_DISPLAY.productivity[B] }] },
        { constraint_id: 'target:morale', words: PER_TARGET_WORDS.morale,
          options: [{ option_id: A, display: PER_TARGET_DISPLAY.morale[A] }, { option_id: B, display: PER_TARGET_DISPLAY.morale[B] }] },
      ] } } }
}

/** The mapped report, with the report-level raw fields the mapper does not carry from a V5 block (per-limit chances). */
export function sentinelReport(form: SentinelForm = 'licensed'): Rec {
  const report = mapV5AnalysisToReport(sentinelBlock(form) as never) as unknown as Rec
  // Leader permission GRANTED: every surface that draws a win share under it is then on the screen for the census (DL
  // ruling (A): none may in C). A withheld permission would hide them and the census would pass vacuously.
  // The Run's pointer to an option (`robustness.recommended_option_id`): the goal and outcome cards read a chance through
  // it, so without it their chance branches are never on the screen for the census.
  const robustness = { ...((report.robustness as Rec | undefined) ?? {}), recommended_option_id: A }
  return { ...report, robustness, probability_of_goal: RAW.root_probability_of_goal, producer_leader_permission: { permitted: true },
    goal_constraints: [{ constraint_id: 'target:morale', node_id: 'morale', operator: '>=', value: 6, unit: 'points', label: 'Morale',
      probability: RAW.constraint_probability }] }
}

/** The Run's delta from the Run before it: Compare's goal chances and run shares, as sentinels. Latest = this Run. */
export function sentinelRunDelta(): RunDelta {
  return runChangeDelta({
    win_probabilities: [
      { option_id: A, prior: RAW.run_delta_win.priorA, current: RAW.run_delta_win.currentA, noise_verdict: 'signal' },
      { option_id: B, prior: RAW.run_delta_win.priorB, current: RAW.run_delta_win.currentB, noise_verdict: 'within_noise' },
    ],
    goal_chances: [
      { option_id: A, prior: { kind: 'point', pct: RAW.run_delta_prior, rounding: 'whole' }, current: { kind: 'point', pct: RAW.run_delta_current, rounding: 'whole' } },
    ],
    endpoints: { prior: { run_id: 'run-before-sentinel', computed_at: '2026-10-12T01:00:00.000Z' },
      current: { run_id: RUN_ID, computed_at: '2026-10-12T02:00:00.000Z' } },
  } as Partial<RunDelta>)
}

let formNow: SentinelForm = 'licensed'
/** The form last seeded: a surface mounted from its own copy of the Run (the chat card's block) takes the same form. */
export const seededForm = (): SentinelForm => formNow

/** Seed the canvas store with the sentinel Run and adopt CEE's canonical view (either form) through the READ parser. */
export function seedSentinel(form: SentinelForm): string {
  formNow = form
  const report = sentinelReport(form)
  const hash = String((report.model_card as { response_hash?: unknown } | undefined)?.response_hash ?? RUN_ID)
  useCanvasStore.setState({
    nodes: NODES, edges: EDGES, ceeAnalysisReady: { goal_threshold_raw: 10, goal_threshold_unit: '%' }, viewMode: 'standard',
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-10-12T02:00:00.000Z' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: SCENARIO,
    v5AnalysisFact: { scenarioId: SCENARIO, analysisHash: hash, hasRunAnalysisFact: true },
    hasCompletedFirstRun: true, goalConstraints: TARGET_ROWS, outcomeNodeId: 'productivity', goalThreshold: 10,
    results: { status: 'complete', progress: 100, hash, report },
    runDelta: { delta: sentinelRunDelta(), analysisHash: hash, scenarioId: SCENARIO },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-10-12T02:00:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }),
  } as never)
  const view = parseCanonicalAnalysisView(sentinelCanonical(form))
  if (view === null) throw new Error(`sentinel canonical view (${form}) did not parse`)
  useCanonicalAnalysisViewStore.getState().adopt(SCENARIO, view)
  return hash
}

export function resetSentinel(): void {
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, ceeAnalysisReady: null,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null }, goalConstraints: null,
    nodes: [], edges: [], currentScenarioId: null, runDelta: null, outcomeNodeId: null, goalThreshold: null,
    lens: { ...useCanvasStore.getState().lens, active: 'full' },
  } as never)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
}

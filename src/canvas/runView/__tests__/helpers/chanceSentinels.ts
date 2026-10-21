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
 * The outcome values (means 112 / 210 / 300, ±3) are model outcomes, not chances; they are printed in the goal's unit (%)
 * on some surfaces, so no outcome value, band or bound is a sentinel, a served figure or a boundary rounding (round 2).
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

/**
 * The raw fields, each with a unique value (fractions as the wire carries them; whole percents where the wire does).
 * Round 2 (rule C): every fraction's hundredths part is under .5, so its floor and its rounding are the same whole percent
 * and every rounding variant a surface could print ("37%", "37.2", "37.19", "0.37", "0.372", "0.3719") is attributable.
 */
export const RAW = {
  probability_of_goal: { [A]: 0.3719, [B]: 0.2713, [SQ]: 0.1347 },
  probability_of_joint_goal: { [A]: 0.4413, [B]: 0.3913 },
  win_probability: { [A]: 0.5317, [B]: 0.3317, [SQ]: 0.1411 },
  root_probability_of_goal: 0.7836,
  pct_by_option: { [A]: 71, [B]: 62 },
  per_target_productivity: { [A]: 76, [B]: 68 },
  per_target_morale: { [A]: 81, [B]: 57 },
  range_low_pct: 23,
  range_high_pct: 29,
  driver_pct_if_side: 17,
  constraint_probability: 0.8423,
  conditional_probability: 0.9217,
  marginal_probability: 0.6613,
  run_delta_prior: 47,
  run_delta_current: 58,
  run_delta_win: { priorA: 0.6143, currentA: 0.6529, priorB: 0.2219, currentB: 0.1906 },
  snapshot_headline_share: 0.4812,
  conditional_win: { high: 0.6917, low: 0.4129 },
  prob_satisfied: 0.5419,
  constraint_probability_by_option: 0.4627,
  joint_probability: 0.3121,
  switch_probability: 0.8619,
  // Round 2 (A): fields the schema-derived census found unseeded.
  marginal_switch_probability: 0.7419,
  recommendation_stability: 0.5913,
  evpi_percentage_points: 43,
  p_win_sensitivity: 0.2511,
  current_winner_probability: 0.3512,
  near_tie_gap: 0.2814,
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

/** The renderings of one sentinel that a surface could produce: every rounding of it (round 2, rule C). */
export function sentinelPatterns(s: Sentinel): RegExp[] {
  const p = s.pct
  const out = [
    new RegExp(`(?<![\\d.])${p}(?:\\.\\d+)?\\s*%`),
    new RegExp(`(?<![\\d.])${p}\\s+(?:in|out of)\\s+100\\b`),
    // Percentage points ("43 points", "43 pp", "43 percentage points"): a change in a chance, said as a figure.
    new RegExp(`(?<![\\d.])${p}(?:\\.\\d+)?\\s*(?:percentage points|points|pp)\\b`),
  ]
  if (s.fraction !== null) {
    // The raw value itself, as a stored record or a payload carries it ("0.5317"), and every rounding of it: the
    // fraction to two and three places ("0.53", "0.532"), the percent to one and two places ("53.2", "53.17").
    out.push(new RegExp(`(?<![\\d.])${String(s.fraction).replace('.', '\\.')}(?!\\d)`))
    out.push(new RegExp(`(?<![\\d.])0\\.${String(Math.round(s.fraction * 100)).padStart(2, '0')}(?!\\d*%)`))
    out.push(new RegExp(`(?<![\\d.])${s.fraction.toFixed(3).replace('.', '\\.')}(?!\\d)`))
    out.push(new RegExp(`(?<![\\d.])${(s.fraction * 100).toFixed(1).replace('.', '\\.')}(?!\\d)`))
    out.push(new RegExp(`(?<![\\d.])${(s.fraction * 100).toFixed(2).replace('.', '\\.')}(?!\\d)`))
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
/**
 * #2747 re-scope 2 round 2 (DL, restoring what staging said): CEE's own notes on A's chance, on the licence record, byte
 * for byte in CEE's shapes — its without-downside spread sentence and a shortfall sentence naming A's label.
 */
export const SPREAD_NOTE = 'Its typical result falls short of your target: this chance comes from its wider spread, which also means it could fall further short.'
export const SHORTFALL_A = 'In its worst 1 in 20 runs of this model, ‘Alder plan’ falls short of your target by 2 points or more.'
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
export type SentinelForm = 'withheld' | 'licensed' | 'same_bounds' | 'agreeing_low' | 'no_words' | 'boundary'

/**
 * BOUNDARY (round 2, rule C; Codex r1 blocking 1 and 2): CEE's boundary displays, "less than 1%" and "more than 99%",
 * over raw values whose roundings a surface could print instead (0.0031 → "0%", "0.3%", "0.31", "0.003", "< 1%";
 * 0.9973 → "100%", "99.7%", "99.73", "0.997", "99%"). The licence's figures agree with the cells, so the gate passes every
 * one (the Results cards draw their goal rows); the licence names the highest (`highest`, B over A), so leader-dependent
 * branches are on the screen; CEE serves no chance words; and the licence's target carries NO frame, so a reader that
 * defaulted a missing frame to a level would be on the screen too.
 */
export const BOUNDARY_RAW = { [A]: 0.0031, [B]: 0.9973 } as const
export const BOUNDARY_DISPLAY = { [A]: 'less than 1%', [B]: 'more than 99%', [SQ]: 'about 4%' } as const
export const BOUNDARY_FACE = {
  [A]: `‘Alder plan’: ${BOUNDARY_DISPLAY[A]} ${CHANCE_WORDS}, in this model, ${PROVISIONAL}.`,
  [B]: `‘Birch plan’: ${BOUNDARY_DISPLAY[B]} ${CHANCE_WORDS}, in this model.`,
  [SQ]: `‘Carry on as now’: ${BOUNDARY_DISPLAY[SQ]} ${CHANCE_WORDS}, in this model.`,
} as const
/** Every rounding of the boundary raw values that is not CEE's served display (checked outside CEE's served strings). */
export const BOUNDARY_VARIANTS: readonly RegExp[] = [
  /(?<![\d.])0(?:\.\d+)?\s*%/, /(?<![\d.])0\.31(?!\d)/, /(?<![\d.])0\.003(?!\d)/, /(?<![\d.])0\.0031(?!\d)/, /<\s*1\s*%/,
  /(?<![\d.])1\s*%/, /(?<![\d.])100(?:\.\d+)?\s*%/, /(?<![\d.])99(?:\.\d+)?\s*%/, /(?<![\d.])99\.7(?!\d)/, /(?<![\d.])99\.73(?!\d)/,
  /(?<![\d.])0\.997(?!\d)/, /(?<![\d.])0\.9973(?!\d)/, /(?<![\d.])1\.00(?!\d)/,
]

// ─── CEE's served strings (WITHHELD form): no figure anywhere. ───
export const WITHHELD_FACE = 'Chance not shown yet'
export const WHY_A = '‘Alder plan’ rests on a starting value Olumi has not been given yet.'
export const WHY_B = '‘Birch plan’ rests on a link nobody has sized yet.'
export const JOINT_WITHHELD_LINE = 'The chance of meeting both together isn’t calculated yet.'
export const DRIVER_NONE_REASON = 'No main driver is recorded for a chance that is not shown.'

/** UI-composed chance phrases that must not appear where served words exist. */
export const GENERIC_CHANCE_PHRASES = [/chance of meeting your goal/i, /chance of meeting (?:the|this) goal/i,
  // "your goal" beside a chance or a figure (round 2: a sentence about the goal that says no chance, such as the Model tab's
  // "no connector path shown to your goal", is not a chance phrase).
  /(?:chance|likel\w*|probab\w*|\d\s*%)[^.]{0,60}\byour goal\b|\byour goal\b[^.]{0,40}(?:chance|likel\w*|probab\w*|\d\s*%)/i,
  // Round 2: the joint register the UI's own goal claims used ("meets every target this run scored", "on track to meet").
  /every target this run scored/i, /\bon track to meet\b/i]
/** UI-composed labels a surface has set beside a chance (DL 12 Oct: a label beside a chance is CEE's served words or none). */
export const UI_CHANCE_LABELS = [/\bHits target\b/i]

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
  const agreeing = form === 'agreeing_low' || form === 'boundary'
  const licence = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: form === 'boundary' ? 'highest' : 'each',
    option_ids: [A, B, SQ], pct_by_option: form === 'agreeing_low' ? { ...LOW_PCT } : form === 'boundary' ? { [A]: 0, [B]: 100, [SQ]: LOW_PCT[SQ] }
      : { ...RAW.pct_by_option },
    withheld_option_ids: agreeing ? [] : [SQ],
    ...(form === 'boundary' ? { leader_option_id: B, next_option_id: A } : {}),
    // BOUNDARY: the target carries no frame (Codex r1 blocking 2's reproduction), so no reader may default it to a level.
    target: form === 'boundary' ? { comparator: 'at_least', value: 10, unit: '%' } : { comparator: 'at_least', value: 10, unit: '%', frame: 'change_abs' },
    ...(form === 'no_words' || form === 'boundary' ? {} : { chance_words: CHANCE_WORDS }), notes: NOTES,
    ...(agreeing ? {} : { status_quo: { option_id: SQ, line: SQ_LINE } }),
    user_link_existence: { links: 2, one_in: ONE_IN },
    ...(form === 'boundary' ? {} : { spread_note_by_option: { [A]: SPREAD_NOTE }, shortfall_note_by_option: { [A]: SHORTFALL_A } }),
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
    // BOUNDARY names CEE's leader (B, as its licence does), so the leader-dependent sections (the stress test) draw.
    type: 'analysis_result', run_id: RUN_ID, computed_against_hash: GRAPH_HASH, summary: 'Sentinel run',
    leading_option_id: form === 'boundary' ? B : null,
    win_probabilities: { [LABEL[A]]: RAW.win_probability[A], [LABEL[B]]: RAW.win_probability[B], [LABEL[SQ]]: RAW.win_probability[SQ] },
    enrichment: {
      option_comparison: [
        entry(A, { probability_of_goal: form === 'boundary' ? BOUNDARY_RAW[A] : RAW.probability_of_goal[A], probability_of_joint_goal: RAW.probability_of_joint_goal[A], ...precision,
          win_probability: RAW.win_probability[A], outcome: outcome(112),
          // The per-limit fields (`prob_satisfied`, `constraint_probabilities`, `joint_probability`), as the producer's entry carries them.
          constraint_probabilities: { 'target:morale': RAW.constraint_probability_by_option },
          constraint_analysis: { constraints: [{ constraint_id: 'target:morale', node_id: 'morale', label: 'Morale', direction: 'min',
            threshold: 6, prob_satisfied: RAW.prob_satisfied }], joint_probability: RAW.joint_probability } }),
        entry(B, { probability_of_goal: form === 'boundary' ? BOUNDARY_RAW[B] : RAW.probability_of_goal[B], probability_of_joint_goal: RAW.probability_of_joint_goal[B], ...precision,
          win_probability: RAW.win_probability[B], outcome: outcome(210) }),
        entry(SQ, { probability_of_goal: RAW.probability_of_goal[SQ], win_probability: RAW.win_probability[SQ], outcome: outcome(300) }),
      ],
      factor_sensitivity: [{ factor_id: 'ramp_up', factor_label: 'Ramp-up time', elasticity: -0.21, direction: 'negative',
        evpi_percentage_points: RAW.evpi_percentage_points }],
      // The value-of-information block's per-factor win sensitivity (an open record shape at the producer).
      p_win_sensitivity: [{ factor_id: 'ramp_up', factor_label: 'Ramp-up time', p_win_delta: RAW.p_win_sensitivity }],
      // A fragile link with its measured switch probability and the option it would switch towards (robustness lens, hero).
      robustness: { fragile_edges: [{ edge_id: 'ramp_up->productivity', from_id: 'ramp_up', to_id: 'productivity', from_label: 'Ramp-up time',
        to_label: 'Productivity', switch_probability: RAW.switch_probability, marginal_switch_probability: RAW.marginal_switch_probability,
        alternative_winner_id: B, alternative_winner_label: LABEL[B] }],
        // The share of runs the recommendation holds, and the near-tie gap between the top two: win-share figures (A).
        recommendation_stability: RAW.recommendation_stability,
        near_tie: { is_tie: false, top_option_id: A, second_option_id: B, tied_option_ids: [], gap: RAW.near_tie_gap, threshold: 0.05 } },
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
  // Form (f)'s licence names B highest; CEE's canonical leader says the same (`goal_chance_leader`), so the ruled headline is
  // drawn and its identity-bound exemption is exercised (DL, 21 Oct 2026). No other form names a goal-chance leader.
  const leader = form === 'boundary'
    ? { leader: { licence: 'withheld', option_id: null, goal_chance_leader: B, similar_option_ids: [], near_tie: false, robustness: null } } : {}
  const base = { schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', run, staleness: STALENESS, leader_licence: 'withheld', ...leader }
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
        : form === 'boundary' ? { kind: 'figure', display: BOUNDARY_DISPLAY[A], face: BOUNDARY_FACE[A] }
        : { kind: 'figure', display: DISPLAY_A, face: FACE_A }, main_driver: { kind: 'available', driver, detail: DRIVER_DETAIL_A } },
      // A driver record with NO served detail: its raw figure must never become a sentence.
      { option_id: B, cell: form === 'same_bounds'
        ? { kind: 'range', display: DISPLAY_B_SAME, face: FACE_B_SAME, detail: { range: DISPLAY_B_SAME } }
        : form === 'agreeing_low' ? { kind: 'figure', display: LOW_DISPLAY[B], face: LOW_FACE[B] }
        : form === 'boundary' ? { kind: 'figure', display: BOUNDARY_DISPLAY[B], face: BOUNDARY_FACE[B] }
        : { kind: 'range', display: DISPLAY_B, face: FACE_B, detail: { range: DISPLAY_B } }, main_driver: { kind: 'available', driver: { ...driver, factor_id: 'morale' } } },
      form === 'agreeing_low' || form === 'boundary'
        ? { option_id: SQ, cell: { kind: 'figure', display: LOW_DISPLAY[SQ], face: form === 'boundary' ? BOUNDARY_FACE[SQ] : LOW_FACE[SQ] },
          main_driver: { kind: 'none_licensed', reason: DRIVER_NONE_REASON } }
        : sq,
    ],
    goal_chance: { ...(form === 'no_words' || form === 'boundary' ? {} : { chance_words: CHANCE_WORDS }), notes: NOTES,
      ...(form === 'agreeing_low' || form === 'boundary' ? {} : { status_quo: { option_id: SQ, line: SQ_LINE } }),
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

/**
 * Round 2 (DL, restoring staging's range row): the one state where a Results card draws a figure row AND a served RANGE row —
 * the agreeing figures of form (d), except B, whose current canonical cell is a range with the licence range's own bounds.
 */
export function seedServedRangeState(): string {
  const hash = seedSentinel('agreeing_low')
  const canonical = sentinelCanonical('agreeing_low') as Rec & { options: Rec[] }
  const options = canonical.options.map(o => o.option_id === B
    ? { ...o, cell: { kind: 'range', display: DISPLAY_B_SAME, face: FACE_B_SAME, detail: { range: DISPLAY_B_SAME } } } : o)
  const view = parseCanonicalAnalysisView({ ...canonical, options })
  if (view === null) throw new Error('served-range canonical view did not parse')
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

/** The chat's flip-analysis block (`flip_analysis`), with its current winner's share as a sentinel (A: `current_winner`). */
export function sentinelFlipAnalysisBlock(): Rec {
  return { type: 'flip_analysis', narrative: 'What could change the result.',
    current_winner: { id: A, label: LABEL[A], probability: RAW.current_winner_probability },
    flip_conditions: [{ assumption: 'Ramp-up time', current_value: '3 months', flip_threshold: '4 months', direction: 'rises',
      alternative_winner: LABEL[B] }] }
}

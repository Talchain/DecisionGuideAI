/**
 * Pre-analysis panel v3 — bar labels, thresholds and all user-facing copy.
 *
 * Copy rules: communication glossary v1 (model not graph; factor, option,
 * goal, outcome, risk; connection not edge; no "recommended", "winner",
 * "blocked", "well framed"), British English, sentence case, no em dashes.
 * Every string here is scanned by the glossary test in
 * signals/__tests__/registry.spec.ts.
 */

import type { BarKey, BarState } from './types'

/**
 * Bar labels — single constants object by design. The alternative set
 * ("The question" / "Options" / "Risks" / "Your input") is a pending product
 * decision; switching is a one-line change here. "Scenarios" was rejected on
 * glossary grounds (reserved for simulation language).
 */
export const BAR_LABELS: Record<BarKey, string> = {
  frame: 'Frame',
  options: 'Options',
  risks: 'Risks',
  estimates: 'Estimates',
}

/**
 * UI-SEM-051: bar state colour thresholds (display formatting). Semantic
 * state only: warning below 0.40, success at or above 0.75, neutral
 * "building" between. Keep — display formatting (legitimate).
 */
export const BAR_STATE_THRESHOLDS = { warning: 0.4, success: 0.75 } as const

/** Compact state cues per bar state (no percentages; counts stay in the tooltip). */
export const BAR_STATE_WORDS: Record<BarState, string> = {
  warning: 'low',
  building: 'medium',
  success: 'good',
}

export function barStateFor(fill: number): BarState {
  if (fill >= BAR_STATE_THRESHOLDS.success) return 'success'
  if (fill < BAR_STATE_THRESHOLDS.warning) return 'warning'
  return 'building'
}

/**
 * UI-SEM-052: bar fill denominators (display formatting). Honest-fill rule:
 * bars count live signals only; affordances never inflate fill. Options and
 * risks saturate at three (documented product-tunable constants, not service
 * data); the frame bar is thirds over its three live components; the
 * estimates bar is influence-weighted coverage with a structural
 * degree-plus-one fallback weight so unconnected estimates still count.
 * Keep — display formatting (legitimate).
 */
export const OPTIONS_SATURATION_COUNT = 3
export const RISKS_SATURATION_COUNT = 3
export const DEGREE_FALLBACK_BASE_WEIGHT = 1

/**
 * UI-SEM-053: segment quantisation of bar fill (display formatting). Each bar
 * renders as a vertical stack of GAUGE_SEGMENTS discrete segments; the lit
 * count is round(fill * segments), clamped to [1, segments] for any positive
 * fill and 0 when the bar is empty — an empty gauge reads as "nothing yet",
 * mirroring an empty continuous bar (no state colour shown at zero, same as
 * today). Discrete steps make the level easier to read at a glance than a
 * continuous height. Keep — display formatting (legitimate).
 */
export const GAUGE_SEGMENTS = 4

export function litSegments(fill: number, segments: number = GAUGE_SEGMENTS): number {
  if (!(fill > 0)) return 0
  return Math.min(segments, Math.max(1, Math.round(fill * segments)))
}

/** Sharpen shows this many rows by default; the rest sit behind "Show N more". */
export const SHARPEN_DEFAULT_VISIBLE = 2

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export const PANEL_COPY = {
  eyebrow: 'Before analysis',
  sharpenTitle: 'Sharpen your thinking',
  sharpenMeta: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  yourDecisionTitle: 'Your decision',
  showMore: (n: number) => `Show ${n} more`,
  showFewer: 'Show fewer',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  advancedTitle: 'Advanced',
  advancedMeta: 'analysis set-up',
  advancedRelationshipNote: 'More technical relationship detail will appear here when available.',
  bestNextStep: 'Best next step',
} as const

export const LADDER_COPY = {
  set_goal: 'Set the goal this decision serves, so every option can be judged against it.',
  set_success: 'Define what success means here, so the analysis can judge the options.',
  calibrate_top: (label: string) =>
    `Check ${label}, it may matter most to the analysis.`,
  readiness_fallback: 'Analysis is not available yet.',
  run_first: 'Run your first analysis, then stress-test what it depends on.',
} as const

export const SIGNAL_COPY = {
  goalMissing: {
    lead: 'No goal set yet.',
    emphasis: 'Name the outcome this decision serves.',
    rationale:
      'Outcome framing: a goal stated as an outcome, not an action, lets every option be compared on what it achieves.',
  },
  successMissing: {
    lead: 'Success is not defined yet.',
    emphasis: 'A success measure lets the analysis judge every option against it.',
    rationale:
      'Success measures: a concrete target turns a vague aim into something the analysis can score options against.',
  },
  optionBreadthOne: {
    lead: 'Only one option so far.',
    emphasis: 'Add an alternative so the analysis has something to compare.',
  },
  optionBreadth: (n: number) => ({
    lead: `You are comparing ${n === 2 ? 'two' : String(n)} options.`,
    emphasis: 'A materially different route widens the comparison.',
  }),
  optionRationale:
    'Option generation: comparing only similar routes narrows what the analysis can see. A structurally different option often reveals a better or lower-regret path.',
  riskNone: {
    lead: 'No risks captured yet.',
    emphasis: 'A pre-mortem typically surfaces failure modes before they arrive.',
  },
  riskCount: (n: number, allOlumi: boolean) => ({
    lead: `${n === 1 ? 'One risk' : `${n} risks`} captured${allOlumi ? ", all Olumi's so far" : ''}.`,
    emphasis: 'A pre-mortem typically surfaces failure modes you have not listed.',
  }),
  riskRationale:
    'Pre-mortem (Klein): imagine the choice failed, then ask what went wrong. It typically surfaces risks that planning misses.',
  estimates: (n: number, topLabel: string | null) => ({
    lead: `Olumi estimated ${n === 1 ? 'one value' : `${n} values`} from your brief.`,
    emphasis: topLabel
      ? `Check ${topLabel} first, it may matter most.`
      : 'Replacing them with your judgement usually helps the analysis.',
  }),
  estimatesRationale:
    'Checking estimates: replacing the highest-influence estimates with your judgement usually helps the analysis. Influence comes from a quick structural pass of your model.',
  ceeBiasRationale:
    'A reflective check from Olumi, based on the structure of your model. Worth a thought, not a verdict.',
} as const

export const ATTRIBUTION_COPY = {
  olumiNoticed: 'Olumi noticed',
  olumiPrefix: 'Olumi:',
  olumiEstimate: 'Olumi estimate',
  /**
   * User-set success target (lane 35 fix 2): the stored goal constraint
   * carries provenance 'explicit' — the user stated this number in their
   * brief, so the chip credits them, never Olumi.
   */
  yourTarget: 'Your target',
  checkedByYou: 'checked by you',
  needsValue: 'needs a value',
  unchecked: 'not checked yet',
  set: 'set',
  needsSetting: 'needs setting',
} as const

export const RANK_LABEL_COPY = {
  top: 'check first',
  next: 'check next',
  lower: 'lower priority',
} as const

export const MODEL_VIEW_COPY = {
  frameGroup: 'Frame',
  frameCoach: 'Is the goal an outcome rather than an action, and is this the right question?',
  optionsGroup: 'Options',
  optionsCoach: 'Are these materially different routes to the goal?',
  optionsAddPlaceholder: 'Add another option',
  risksGroup: 'Risks and upside',
  risksCoach: 'What could go wrong, and what could go better than expected?',
  risksAddPlaceholder: 'Add a risk',
  estimatesGroup: 'What this depends on',
  estimatesCoach:
    "Ranked by likely influence on your goal. Replace Olumi's estimates with your judgement, starting at the top.",
  estimatesCoachFallback:
    'Ordered by how connected each factor is in your model. Replace estimates with your judgement, starting at the top.',
  estimatesMeta: (checked: number, checkable: number, needValues: number) =>
    `${checked} of ${checkable} checked${
      needValues > 0 ? ` · ${needValues === 1 ? '1 needs a value' : `${needValues} need values`}` : ''
    }`,
  goalRow: (label: string) => `Goal: ${label}`,
  successRow: 'Success measure',
} as const

export const FOOTER_COPY = {
  ready: 'Analysis available',
  readySubSuccessUnset: 'First pass will be provisional until success is defined',
  readySubEstimates: 'Checking top estimates usually sharpens the result',
  readySubAllSet: 'Ready when you are',
  notReady: 'Not ready for analysis yet',
  notReadySubFallback: 'Add a decision, a goal and at least two options',
  running: 'Analysis running',
  runningSub: 'Hold on while the first pass completes',
  analyse: 'Analyse first pass',
} as const

/**
 * Safe coaching fallbacks for CEE text degraded by the runtime glossary
 * guard (signals/ceeTextGuard.ts). Each line still reads as coaching with
 * Olumi attribution at the render site — never a dead or empty row.
 */
export const CEE_FALLBACK_COPY = {
  /** Hero slot renders "Olumi:" + this text. Generic fallback. */
  heroCoaching: 'something in this set-up is worth a closer look before analysis.',
  /** Category-aware hero fallbacks (chosen from the original coaching's theme
   *  when it cannot be sanitised in place). All render after the "Olumi:"
   *  prefix and assert no verdict, only that something is worth a look. */
  heroFraming: 'a framing pattern here is worth a closer look before analysis.',
  heroAssumption: 'an assumption here is worth a closer look before analysis.',
  heroComparison: 'a comparison pattern here is worth a closer look before analysis.',
  /** Bias row renders "Olumi noticed" + this text. */
  biasRow: 'a pattern worth checking before you run the analysis.',
} as const

export const FIELD_FEEDBACK_COPY = {
  successFormatHint: 'Enter a number, like 20 or 15%',
  successNeedsGoalHint: 'Set the goal first, then define success',
  goalEmptyHint: 'Enter a name for the goal',
  numberHint: 'Enter a number, like 20 or 15%',
  modelSizeLimit: 'The model is at its size limit',
  saved: 'Saved',
  olumiUnavailable: 'Olumi is unavailable right now. Open the Olumi panel and try again.',
  addValue: 'Add value',
  check: 'Check',
} as const

export const HERO_COPY = {
  goalFieldLabel: 'Goal',
  successFieldLabel: 'Success',
  successPlaceholder: 'What would count as success?',
  goalPlaceholder: 'What outcome do you want?',
  decisionFallback: 'Your decision',
  saveSuccess: 'Save success measure',
  pressureTestDecision: 'Ask Olumi: is this the right question, and does it fit your wider goals?',
  pressureTestGoal: 'Olumi can help reframe this as the outcome you want, so every option is comparable',
  defineSuccess: 'Olumi can help define a measurable success target',
} as const

/**
 * Actions overflow menu — named methods, every item resolves to a prefilled
 * conversation prompt (sent immediately via the existing chip convention).
 * No contract intents are attached: routing happens from the message text,
 * so none of the dead-end intents can be emitted.
 */
export interface ActionsMenuItem {
  id: string
  label: string
  prompt: string
}

export const ACTIONS_MENU: ReadonlyArray<ActionsMenuItem> = [
  {
    id: 'pressure_test_frame',
    label: 'Pressure-test the frame',
    prompt: 'Is this the right question to be asking, and does it fit my wider goals?',
  },
  {
    id: 'widen_options',
    label: 'Widen the options',
    prompt: 'Suggest materially different options that work through a different mechanism from the ones I already have.',
  },
  {
    id: 'outside_view',
    label: 'Take the outside view',
    prompt: 'Take the outside view on this decision: what do similar decisions and base rates suggest?',
  },
  {
    id: 'pre_mortem',
    label: 'Run a pre-mortem',
    prompt: 'Run a pre-mortem with me: imagine this choice failed a year from now. What went wrong?',
  },
  {
    id: 'risks_upside',
    label: 'Find risks and upside',
    prompt: 'What risks and best-case upsides are missing from my model?',
  },
  {
    id: 'calibrate_estimates',
    label: 'Check estimates',
    prompt: 'Help me check the estimates that matter most to the analysis.',
  },
  {
    id: 'compare_view',
    label: 'Compare my view with Olumi',
    prompt: 'Compare my view of this decision with yours. Where do we differ, and why?',
  },
  {
    id: 'prepare_first_analysis',
    label: 'Prepare first analysis',
    prompt: 'What should I check before running the first analysis?',
  },
]

export const SPARK_PROMPTS = {
  widenOptions: {
    label: 'Widen the options',
    prompt: 'Suggest materially different options that work through a different mechanism from the ones I already have.',
  },
  preMortem: {
    label: 'Run a pre-mortem',
    prompt: 'Run a pre-mortem with me: imagine this choice failed a year from now. What went wrong?',
  },
  calibrate: {
    label: 'Check estimates',
    prompt: 'Help me check the estimates that matter most to the analysis.',
  },
  pressureTestFrame: {
    label: 'Pressure-test the frame',
    prompt: 'Is this the right question to be asking, and does it fit my wider goals?',
  },
  defineSuccess: {
    label: 'Define success with Olumi',
    prompt: 'Help me define a measurable success target for this goal.',
  },
  findRisks: {
    label: 'Find risks and upside',
    prompt: 'What risks and best-case upsides are missing from my model?',
  },
  reflectBias: {
    label: 'Talk it through with Olumi',
    prompt: 'You flagged a possible blind spot in how my model leans. Help me think it through.',
  },
} as const

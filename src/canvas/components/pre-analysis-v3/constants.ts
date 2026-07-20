/**
 * Pre-analysis panel v3 — bar labels, thresholds and all user-facing copy.
 *
 * Copy rules: communication glossary v1 (model not graph; factor, option,
 * goal, outcome, risk; connection not edge; no "recommended", "winner",
 * "blocked", "well framed"), British English, sentence case, no em dashes.
 * Every string here is scanned by the glossary test in
 * signals/__tests__/registry.spec.ts.
 */

import type { BarKey, BarState, SparkPrompt } from './types'

export type { SparkPrompt } from './types'

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
 * Actions overflow menu — named methods, every item a SparkPrompt with
 * EXPLICIT wire intent.
 *
 * History: this registry previously attached NO intent ("routing happens
 * from the message text") — a deliberate choice to avoid emitting dead-end
 * intents. That choice was reversed on A1's meta-decision diagnosis
 * (2026-07-20): CEE re-infers anonymous text with a draft-shape regex, and
 * on an empty canvas EVERY spark here matched it — the "Prepare first
 * analysis" spark was captured as a decision BRIEF and the drafter modelled
 * the meta-decision ("should we run the analysis?") instead of coaching.
 * The product knows the intent at authoring time; discarding it and
 * re-inferring by regex IS the defect mechanism.
 *
 * `action_type` is the wire intent: a @talchain/schemas ActionType enum
 * value (strict at CEE ingress — out-of-enum values 422), a declared
 * pending value (PENDING_WIRE_ACTION_TYPES in conversation/chipMeta.ts —
 * mapped now, WITHHELD from the wire by buildV5Payload's schema-derived
 * gate until the re-vendor publishes it), or `null` when no honest entry
 * exists — we do NOT force a wrong one. Every spark still ships its
 * identity as `chip.parameters.spark_id`, the deterministic hook CEE's
 * routing half keys on. The contract test in
 * __tests__/sparkIntentContract.spec.ts validates values against the enum
 * itself (derived, never a hand-kept list).
 *
 * `analysis_readiness` (signed off for 0.20.0) means "assess/coach
 * readiness for analysis". Mapped ONLY where that is the spark's honest
 * intent — elicitation/reflection sparks whose readiness link is incidental
 * stay null rather than being recast as analysis-gate conversations.
 */
export type ActionsMenuItem = SparkPrompt

export const ACTIONS_MENU = [
  {
    id: 'pressure_test_frame',
    label: 'Pressure-test the frame',
    prompt: 'Is this the right question to be asking, and does it fit my wider goals?',
    // Frame-challenge coaching. explain_from_structure EXPLAINS the model;
    // this spark challenges it — no honest vocabulary entry.
    action_type: null,
  },
  {
    id: 'widen_options',
    label: 'Widen the options',
    prompt: 'Suggest materially different options that work through a different mechanism from the ones I already have.',
    // Option-elicitation coaching; the boundary enum has no add_option.
    action_type: null,
  },
  {
    id: 'outside_view',
    label: 'Take the outside view',
    prompt: 'Take the outside view on this decision: what do similar decisions and base rates suggest?',
    // Base-rate coaching — no vocabulary entry.
    action_type: null,
  },
  {
    id: 'pre_mortem',
    label: 'Run a pre-mortem',
    prompt: 'Run a pre-mortem with me: imagine this choice failed a year from now. What went wrong?',
    // Failure-imagination coaching — no vocabulary entry.
    action_type: null,
  },
  {
    id: 'risks_upside',
    label: 'Find risks and upside',
    prompt: 'What risks and best-case upsides are missing from my model?',
    // Gap-elicitation coaching (what is MISSING) — explain_* describes what
    // is present; no honest entry.
    action_type: null,
  },
  {
    id: 'calibrate_estimates',
    label: 'Check estimates',
    prompt: 'Help me check the estimates that matter most to the analysis.',
    // Analysis-preparation coaching: "the estimates that matter most to
    // the ANALYSIS" is readiness-directed — the readiness capability's
    // estimate-gap signals are the honest answer. NOT what_would_flip
    // (post-analysis sensitivity; its deterministic handler demands prior
    // analysis facts). Pending: withheld until the 0.20.0 re-vendor.
    action_type: 'analysis_readiness',
  },
  {
    id: 'compare_view',
    label: 'Compare my view with Olumi',
    prompt: 'Compare my view of this decision with yours. Where do we differ, and why?',
    // compare_options compares DECISION OPTIONS, not the user's view vs the
    // model's — stamping it would misdeclare the intent.
    action_type: null,
  },
  {
    id: 'prepare_first_analysis',
    label: 'Prepare first analysis',
    prompt: 'What should I check before running the first analysis?',
    // THE readiness spark (A1's defect reproduction) — the verbatim intent
    // analysis_readiness was coined for. NOT run_analysis, which would RUN
    // the analysis the user is asking how to prepare for — the exact
    // wrongness class this metadata exists to kill. Pending: withheld
    // until the 0.20.0 re-vendor.
    action_type: 'analysis_readiness',
  },
] as const satisfies ReadonlyArray<ActionsMenuItem>

/** The ids ACTIONS_MENU actually declares — derived, so it cannot go stale. */
type ActionsMenuId = (typeof ACTIONS_MENU)[number]['id']

/**
 * Look an ACTIONS_MENU entry up by id.
 *
 * The parameter is the DERIVED id union, so a typo or a removed menu entry is
 * a COMPILE error, not a runtime surprise. The throw is unreachable given that
 * constraint — it exists only to discharge `.find`'s `| undefined` without an
 * assertion that would silently pass `undefined` through if the constraint
 * were ever loosened.
 */
function fromActionsMenu(id: ActionsMenuId): SparkPrompt {
  const entry = ACTIONS_MENU.find(item => item.id === id)
  if (!entry) throw new Error(`SPARK_PROMPTS: no ACTIONS_MENU entry for id "${id}"`)
  return entry
}

/**
 * The sparks the panel surfaces directly (hero, model section, signal registry).
 *
 * DERIVED from ACTIONS_MENU by id — five of these entries used to be
 * byte-identical COPIES of menu entries, including the `action_type`
 * adjudication. That made every intent decision a two-place edit with nothing
 * checking the two agreed: `sparkIntentContract.spec.ts` asserted id-uniqueness
 * WITHIN each collection but never that a shared id carried the same
 * label/prompt/action_type in both, so a one-sided edit shipped green. The
 * `analysis_readiness` mapping is exactly the kind of adjudication that must
 * never diverge between the menu and the panel.
 *
 * Only the two sparks with NO menu equivalent are declared inline below.
 */
export const SPARK_PROMPTS = {
  widenOptions: fromActionsMenu('widen_options'),
  preMortem: fromActionsMenu('pre_mortem'),
  calibrate: fromActionsMenu('calibrate_estimates'),
  pressureTestFrame: fromActionsMenu('pressure_test_frame'),
  findRisks: fromActionsMenu('risks_upside'),
  // --- panel-only sparks: no ACTIONS_MENU counterpart ---
  defineSuccess: {
    id: 'define_success',
    label: 'Define success with Olumi',
    prompt: 'Help me define a measurable success target for this goal.',
    // Goal-target coaching; set_factor_value is a validated mutation, not
    // a conversation — no honest entry.
    action_type: null,
  },
  reflectBias: {
    id: 'reflect_bias',
    label: 'Talk it through with Olumi',
    prompt: 'You flagged a possible blind spot in how my model leans. Help me think it through.',
    action_type: null,
  },
} satisfies Record<string, SparkPrompt>

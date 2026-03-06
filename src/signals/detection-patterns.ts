/**
 * Detection patterns — single source of truth for brief readiness detection.
 *
 * UI imports these directly. CEE duplicates the values with a sync comment
 * pointing here. Conformance is enforced via shared test fixtures, not
 * cross-repo imports.
 */

// ---------------------------------------------------------------------------
// Stage A: Decision framing phrases (require Stage B to count)
// ---------------------------------------------------------------------------

export const DECISION_FRAMING_PHRASES: string[] = [
  'should we',
  'should i',
  'whether to',
  'whether we should',
  'deciding between',
  'trying to decide',
  'considering whether',
  'debating whether',
  'weighing up',
  'weighing whether',
  'thinking about whether',
]

// ---------------------------------------------------------------------------
// Stage B: Distinct alternative markers
// ---------------------------------------------------------------------------

export const ALTERNATIVE_MARKERS: string[] = [
  'option a',
  'option b',
  'option c',
  'option 1',
  'option 2',
  'option 3',
  'alternative 1',
  'alternative 2',
  'plan a',
  'plan b',
  'scenario a',
  'scenario b',
  'choice a',
  'choice b',
  'path a',
  'path b',
  'approach a',
  'approach b',
  'or instead',
  'or alternatively',
  'versus',
  'vs',
  'compared to',
  'as opposed to',
  'rather than',
  'instead of',
  'on the other hand',
  'alternatively',
]

// ---------------------------------------------------------------------------
// Goal verbs (explicit goal, no metric required)
// ---------------------------------------------------------------------------

export const GOAL_VERBS: string[] = [
  'improve',
  'increase',
  'decrease',
  'reduce',
  'grow',
  'maximise',
  'maximize',
  'minimise',
  'minimize',
  'boost',
  'lower',
  'raise',
  'cut',
  'achieve',
  'reach',
  'hit',
  'maintain',
  'sustain',
  'double',
  'triple',
  'halve',
]

// ---------------------------------------------------------------------------
// Target verbs (near a number -> measurable outcome)
// ---------------------------------------------------------------------------

export const TARGET_VERBS: string[] = [
  'increase',
  'decrease',
  'reduce',
  'grow',
  'raise',
  'cut',
  'achieve',
  'reach',
  'hit',
  'boost',
  'lower',
  'double',
  'triple',
  'halve',
  'target',
  'aim for',
  'get to',
  'bring to',
  'push to',
  'drive to',
  'move to',
  'exceed',
  'surpass',
  'maintain',
]

// ---------------------------------------------------------------------------
// Metric tokens
// ---------------------------------------------------------------------------

export const METRIC_TOKENS: string[] = [
  'revenue',
  'mrr',
  'arr',
  'churn',
  'retention',
  'conversion',
  'margin',
  'profit',
  'cost',
  'cac',
  'ltv',
  'nps',
  'arpu',
  'aov',
  'roi',
  'roas',
  'ctr',
  'dau',
  'mau',
  'burn rate',
  'runway',
  'growth rate',
  'market share',
  'headcount',
  'pipeline',
  'quota',
  'throughput',
  'uptime',
  'latency',
  'satisfaction',
]

// ---------------------------------------------------------------------------
// Baseline patterns
// ---------------------------------------------------------------------------

export const BASELINE_PRESENT_PATTERNS: string[] = [
  'currently',
  'right now',
  'at the moment',
  'at present',
  'today',
  'existing',
  'as of',
  'from',
  'starting from',
  'baseline',
  'current',
  'presently',
]

/** Process verbs that invalidate "currently" as a baseline indicator */
export const BASELINE_PROCESS_VERBS: string[] = [
  'thinking',
  'debating',
  'considering',
  'exploring',
  'discussing',
  'evaluating',
  'wondering',
  'pondering',
  'deliberating',
  'weighing',
]

export const BASELINE_UNKNOWN_PATTERNS: string[] = [
  "don't know the baseline",
  'baseline unknown',
  'no baseline',
  'unsure of current',
  'not sure where we stand',
]

// ---------------------------------------------------------------------------
// Constraint and risk words
// ---------------------------------------------------------------------------

export const CONSTRAINT_WORDS: string[] = [
  'budget',
  'deadline',
  'limit',
  'cap',
  'ceiling',
  'floor',
  'maximum',
  'minimum',
  'constraint',
  'restriction',
  'requirement',
  'must not exceed',
  'cannot exceed',
  'no more than',
  'no less than',
  'at most',
  'at least',
  'within',
  'by end of',
  'before',
]

export const RISK_WORDS: string[] = [
  'risk',
  'worried',
  'concern',
  'fear',
  'threat',
  'downside',
  'worst case',
  'if it fails',
  'danger',
  'exposure',
  'vulnerability',
  'uncertainty',
  'volatile',
  'unstable',
]

// ---------------------------------------------------------------------------
// Bias detection
// ---------------------------------------------------------------------------

export const SUNK_COST_PHRASES: string[] = [
  'already spent',
  'already invested',
  'already put in',
  "we've spent",
  "we've invested",
  "i've spent",
  "i've invested",
  'sunk cost',
  'too far to stop',
  'too late to turn back',
  'after all the work',
  'after all the effort',
  'after all the time',
  'after all the money',
  'come this far',
  'gone this far',
  'all the work we',
  'all the effort we',
  "can't walk away",
  "can't give up now",
  'throwing away',
  'waste all',
  'wasted if',
]

/** Year range excluded from anchoring number count */
export const YEAR_RANGE: [number, number] = [1900, 2099]

/**
 * Patterns excluded from anchoring: ordinals, version-like, option/step
 * numbering. Matched case-insensitively against the token context.
 */
export const ANCHORING_EXCLUSION_PATTERNS: RegExp[] = [
  /\bphase\s+\d+/i,
  /\bstep\s+\d+/i,
  /\bstage\s+\d+/i,
  /\boption\s+\d+/i,
  /\bv\d+/i,
  /\bversion\s+\d+/i,
  /\b\d+(?:st|nd|rd|th)\b/i,
]

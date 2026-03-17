/**
 * extractLocalBIL — client-side Brief Intelligence Layer preview.
 *
 * Local preview — intentionally lighter than CEE's authoritative extraction.
 * No DSK cues, simpler regex for goal/option/constraint/factor detection —
 * these heuristics may diverge from CEE results.
 *
 * CAUSAL_PHRASES and SPECIFICITY_PATTERNS (v1.1.0) are **identical** to CEE's
 * constants and must stay in sync. See JSDoc on each constant.
 *
 * Pure function, synchronous, < 10ms on a 500-word brief.
 * The 500ms debounce is the caller's responsibility.
 *
 * @param briefText The raw brief text entered by the user.
 * @returns A BriefIntelligence snapshot derived from local heuristics.
 */

import type { BriefIntelligence } from '../../types/brief-intelligence'

// ─────────────────────────────────────────────────────────────────────────────
// Pattern banks
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_PATTERNS = [
  /\b(?:achieve|reach|maximise|maximize|increase|improve|reduce|minimise|minimize)\b\s+\S/i,
  /\b(?:want to|aiming (?:for|to)|trying to|goal is|objective is|need to|hope to|plan to|intend to)\b\s+\S/i,
  /\bincrease\s+\S+\s+to\s+\S/i,
]

const MEASURABLE_PATTERNS = [
  /\d+\s*%/,
  /\$[\d,.]+/,
  /\b\d+\s*(?:percent|points?|units?|dollars?|euros?|pounds?)\b/i,
  /\bby\s+\d/i,
  /\bfrom\s+\d.*\bto\s+\d/i,
]

const CONSTRAINT_HARD_LIMIT = [
  /\bmust\s+not\b/i,
  /\bno\s+more\s+than\b/i,
  /\bcannot\s+exceed\b/i,
  /\bmaximum\s+(?:of\s+)?\S/i,
  /\bnever\s+(?:exceed|go\s+above|go\s+below)\b/i,
]

const CONSTRAINT_SUCCESS = [
  /\bat\s+least\b/i,
  /\bminimum\s+(?:of\s+)?\S/i,
  /\bmust\s+(?:achieve|reach|meet|maintain)\b/i,
]

const CONSTRAINT_GUARDRAIL = [
  /\bwithin\s+budget\b/i,
  /\bby\s+(?:the\s+end\s+of|Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December|\d{4})\b/i,
  /\bdeadline\b/i,
  /\bno\s+later\s+than\b/i,
  /\bregulat(?:ory|ion)\b/i,
  /\bcompliance\b/i,
]

const FACTOR_PATTERNS = [
  /\b(\S+(?:\s+\S+){0,3})\s+(?:affects?|drives?|influences?|depends?\s+on|impacts?|determines?)\b/i,
  /\bbecause\s+(?:of\s+)?(\S+(?:\s+\S+){0,3})\b/i,
  /\b(?:if|when)\s+(\S+(?:\s+\S+){0,3})\s+(?:increases?|decreases?|changes?|improves?|worsens?)\b/i,
  /\b(?:leads?\s+to|results?\s+in|caused?\s+by)\b/i,
]

const TIME_HORIZON_PATTERNS = [
  /\bby\s+(?:Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  /\bwithin\s+\d+\s+(?:days?|weeks?|months?|years?|quarters?)\b/i,
  /\bbefore\s+(?:Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December|\d{4})\b/i,
  /\b(?:timeline|time\s*frame|time\s*horizon|deadline)\b/i,
  /\b\d{4}\b/, // bare year
]

const STATUS_QUO_PATTERNS = [
  /\bstatus\s*quo\b/i,
  /\bkeep\s+current\b/i,
  /\bdo\s+nothing\b/i,
  /\bno\s+change\b/i,
  /\bremain\s+(?:as|with)\b/i,
  /\bstay\s+(?:the\s+same|with|as)\b/i,
]

const RISK_PATTERNS = [
  /\brisk(?:s|y)?\b/i,
  /\bdownside\b/i,
  /\bthreat\b/i,
  /\bworst[\s-]case\b/i,
  /\bfailure\b/i,
  /\bdanger\b/i,
]

/**
 * Causal phrases — must be identical to CEE's `CAUSAL_PHRASES` constant.
 * @internal Exported for contract tests only.
 * @see CEE cee/brief_intelligence/causal.py::CAUSAL_PHRASES
 */
export const CAUSAL_PHRASES = [
  'because', 'leads to', 'causes', 'results in', 'drives', 'affects',
  'increases', 'reduces', 'prevents', 'depends on',
] as const

/**
 * Specificity patterns — must be identical to CEE's `SPECIFICITY_PATTERNS` constant.
 * @internal Exported for contract tests only.
 * @see CEE cee/brief_intelligence/specificity.py::SPECIFICITY_PATTERNS
 */
export const SPECIFICITY_PATTERNS: RegExp[] = [
  /\d+%/,
  /[£$€]\s?\d+/,
  /\d{1,3}(?:,\d{3})+/,
  /\d+k\b/i,
  /\d+m\b/i,
  /\b(?:Q[1-4]|H[12])\s?\d{4}\b/,
  /\b(202[0-9]|2030)\b/,
]

const AMBIGUITY_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\bimprove\s+things\b/i, flag: 'Vague goal: "improve things" — specify what and by how much' },
  { pattern: /\bmake\s+it\s+better\b/i, flag: 'Vague goal: "make it better" — specify measurable outcome' },
  { pattern: /\bsomehow\b/i, flag: 'Ambiguous method: "somehow" — clarify approach' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text))
}

function extractSentence(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text)
  if (!match) return null
  // Find sentence boundaries around the match
  const before = text.slice(0, match.index)
  const after = text.slice(match.index)
  const sentStart = Math.max(before.lastIndexOf('.') + 1, before.lastIndexOf('\n') + 1, 0)
  const sentEndRel = after.search(/[.!?\n]/)
  const sentEnd = sentEndRel >= 0 ? match.index + sentEndRel + 1 : text.length
  return text.slice(sentStart, sentEnd).trim().slice(0, 200)
}

function extractOptions(text: string): Array<{ label: string; confidence: number }> {
  const options: Array<{ label: string; confidence: number }> = []
  const seen = new Set<string>()

  // "should we X or Y" / "between X and Y"
  const orMatch = /\bshould\s+(?:we|I)\s+(.+?)\s+or\s+(.+?)(?:[.,;?]|$)/i.exec(text)
  if (orMatch) {
    for (const opt of [orMatch[1], orMatch[2]]) {
      const label = opt.trim().slice(0, 100)
      const key = label.toLowerCase()
      if (label && !seen.has(key)) { seen.add(key); options.push({ label, confidence: 0.7 }) }
    }
  }

  const betweenMatch = /\bbetween\s+(.+?)\s+and\s+(.+?)(?:[.,;?]|$)/i.exec(text)
  if (betweenMatch) {
    for (const opt of [betweenMatch[1], betweenMatch[2]]) {
      const label = opt.trim().slice(0, 100)
      const key = label.toLowerCase()
      if (label && !seen.has(key)) { seen.add(key); options.push({ label, confidence: 0.7 }) }
    }
  }

  // "Option A", "Option B"
  const optionLabelRe = /\boption\s*([A-Z1-9])\b/gi
  let m: RegExpExecArray | null
  while ((m = optionLabelRe.exec(text)) !== null) {
    const label = `Option ${m[1]}`
    const key = label.toLowerCase()
    if (!seen.has(key)) { seen.add(key); options.push({ label, confidence: 0.8 }) }
  }

  // Bullet/numbered list items (cap at 10)
  const bulletRe = /(?:^|\n)\s*(?:[-*•]|\d+[.)]\s)\s*(.+)/g
  while ((m = bulletRe.exec(text)) !== null && options.length < 10) {
    const label = m[1].trim().slice(0, 100)
    const key = label.toLowerCase()
    if (label.length >= 3 && !seen.has(key)) {
      seen.add(key)
      options.push({ label, confidence: 0.6 })
    }
  }

  return options.slice(0, 10)
}

function extractConstraints(
  text: string,
): Array<{ label: string; type: 'hard_limit' | 'success_condition' | 'guardrail'; confidence: number }> {
  const constraints: Array<{ label: string; type: 'hard_limit' | 'success_condition' | 'guardrail'; confidence: number }> = []
  const seen = new Set<string>()

  for (const pattern of CONSTRAINT_HARD_LIMIT) {
    const label = extractSentence(text, pattern)
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase())
      constraints.push({ label, type: 'hard_limit', confidence: 0.7 })
    }
  }

  for (const pattern of CONSTRAINT_SUCCESS) {
    const label = extractSentence(text, pattern)
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase())
      constraints.push({ label, type: 'success_condition', confidence: 0.7 })
    }
  }

  for (const pattern of CONSTRAINT_GUARDRAIL) {
    const label = extractSentence(text, pattern)
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase())
      constraints.push({ label, type: 'guardrail', confidence: 0.6 })
    }
  }

  return constraints.slice(0, 10)
}

function extractFactors(text: string): Array<{ label: string; confidence: number }> {
  const factors: Array<{ label: string; confidence: number }> = []
  const seen = new Set<string>()

  for (const pattern of FACTOR_PATTERNS) {
    const label = extractSentence(text, pattern)
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase())
      factors.push({ label, confidence: 0.6 })
    }
  }

  return factors.slice(0, 10)
}

function scoreCausalFraming(text: string): BriefIntelligence['causal_framing_score'] {
  let count = 0
  for (const phrase of CAUSAL_PHRASES) {
    const re = new RegExp(`\\b${phrase}\\b`, 'i')
    if (re.test(text)) count++
  }
  if (count >= 3) return 'strong'
  if (count >= 1) return 'moderate'
  return 'weak'
}

function scoreSpecificity(text: string): BriefIntelligence['specificity_score'] {
  let count = 0
  for (const pattern of SPECIFICITY_PATTERNS) {
    if (pattern.test(text)) count++
  }
  if (count >= 2) return 'specific'
  if (count === 1) return 'moderate'
  return 'vague'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main extractor
// ─────────────────────────────────────────────────────────────────────────────

export function extractLocalBIL(briefText: string): BriefIntelligence {
  const text = briefText.trim()

  if (!text) {
    return {
      goal: null,
      options: [],
      constraints: [],
      factors: [],
      completeness_band: 'low',
      ambiguity_flags: [],
      missing_elements: ['goal', 'constraints', 'time_horizon', 'success_metric', 'status_quo_option', 'risk_factors'],
      causal_framing_score: 'weak',
      specificity_score: 'vague',
      dsk_cues: [],
    }
  }

  // Goal detection
  let goal: BriefIntelligence['goal'] = null
  for (const pattern of GOAL_PATTERNS) {
    const label = extractSentence(text, pattern)
    if (label) {
      const measurable = MEASURABLE_PATTERNS.some(p => p.test(label))
      goal = { label, measurable, confidence: 0.7 }
      break
    }
  }

  // Options
  const options = extractOptions(text)

  // Constraints
  const constraints = extractConstraints(text)

  // Factors
  const factors = extractFactors(text)

  // Missing elements
  const missing: BriefIntelligence['missing_elements'] = []
  if (!goal) missing.push('goal')
  if (constraints.length === 0) missing.push('constraints')
  if (!matchAny(text, TIME_HORIZON_PATTERNS)) missing.push('time_horizon')
  if (!goal?.measurable) missing.push('success_metric')
  if (!matchAny(text, STATUS_QUO_PATTERNS)) missing.push('status_quo_option')
  if (!matchAny(text, RISK_PATTERNS)) missing.push('risk_factors')

  // Completeness band
  const hasGoal = goal !== null
  const hasOptions = options.length >= 1
  const hasConstraint = constraints.length >= 1
  const hasFactor = factors.length >= 1
  let completeness_band: BriefIntelligence['completeness_band'] = 'low'
  if (hasGoal && hasOptions && hasConstraint && hasFactor) {
    completeness_band = 'high'
  } else if (hasGoal && hasOptions) {
    completeness_band = 'medium'
  }

  // Ambiguity flags
  const ambiguity_flags: string[] = []
  for (const { pattern, flag } of AMBIGUITY_PATTERNS) {
    if (pattern.test(text)) {
      ambiguity_flags.push(flag)
    }
  }

  return {
    goal,
    options,
    constraints,
    factors,
    completeness_band,
    ambiguity_flags,
    missing_elements: missing,
    causal_framing_score: scoreCausalFraming(text),
    specificity_score: scoreSpecificity(text),
    dsk_cues: [], // Always empty client-side — no DSK bundle access
  }
}

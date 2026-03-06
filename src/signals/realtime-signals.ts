/**
 * extractRealtimeSignals — pure, synchronous brief readiness detection.
 *
 * Runs client-side on debounced brief text (<20ms typical). The caller
 * handles the 800ms debounce; this function is stateless.
 *
 * Detection patterns are imported from `./detection-patterns.ts`, the single
 * source of truth shared (by value) with CEE test conformance.
 *
 * @param text  The current brief text (post-debounce).
 * @returns     Structural booleans, readiness level, and bias detection.
 */

import {
  DECISION_FRAMING_PHRASES,
  ALTERNATIVE_MARKERS,
  TARGET_VERBS,
  METRIC_TOKENS,
  BASELINE_PRESENT_PATTERNS,
  BASELINE_PROCESS_VERBS,
  BASELINE_UNKNOWN_PATTERNS,
  CONSTRAINT_WORDS,
  RISK_WORDS,
  SUNK_COST_PHRASES,
  YEAR_RANGE,
  ANCHORING_EXCLUSION_PATTERNS,
} from './detection-patterns'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RealtimeSignals {
  has_alternative: boolean
  has_measurable_outcome: boolean
  has_baseline: boolean
  has_constraint: boolean
  has_risk: boolean
  has_constraint_or_risk: boolean
  bias_detected: 'sunk_cost' | 'anchoring' | null
  readiness: 'low' | 'ok' | 'strong'
}

// ---------------------------------------------------------------------------
// Helpers — word-boundary regex builders
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordBoundaryMatch(text: string, phrases: string[]): string | null {
  const lower = text.toLowerCase()
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
    if (re.test(lower)) return phrase
  }
  return null
}

function wordBoundaryMatchAll(text: string, phrases: string[]): string[] {
  const lower = text.toLowerCase()
  const matches: string[] = []
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
    if (re.test(lower)) matches.push(phrase)
  }
  return matches
}

// ---------------------------------------------------------------------------
// Sentence splitting
// ---------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  return text.split(/[.?!]+/).map(s => s.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Number extraction (for anchoring and outcome detection)
// ---------------------------------------------------------------------------

/** Match numbers including currency prefixes, k/m/b suffixes, % */
const NUMBER_RE = /[£$€]\s*\d[\d,]*(?:\.\d+)?(?:\s*[kmb](?!\w))?|\d[\d,]*(?:\.\d+)?(?:\s*[kmb](?!\w))?\s*%?/gi

interface ExtractedNumber {
  value: number
  raw: string
  hasCurrency: boolean
  hasPercent: boolean
  index: number
}

function extractNumbers(text: string): ExtractedNumber[] {
  const results: ExtractedNumber[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(NUMBER_RE.source, 'gi')
  while ((match = re.exec(text)) !== null) {
    const raw = match[0]
    const hasCurrency = /[£$€]/.test(raw)
    const hasPercent = /%/.test(raw)
    // Parse numeric value: strip currency, commas, interpret k/m/b suffixes
    let numStr = raw.replace(/[£$€,%\s]/g, '')
    let multiplier = 1
    if (/k$/i.test(numStr)) { multiplier = 1_000; numStr = numStr.slice(0, -1) }
    else if (/m$/i.test(numStr)) { multiplier = 1_000_000; numStr = numStr.slice(0, -1) }
    else if (/b$/i.test(numStr)) { multiplier = 1_000_000_000; numStr = numStr.slice(0, -1) }
    const value = parseFloat(numStr) * multiplier
    if (!isNaN(value)) {
      results.push({ value, raw, hasCurrency, hasPercent, index: match.index })
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Detection: Alternative option (two-stage)
// ---------------------------------------------------------------------------

/**
 * Stage A: Decision framing detected (alone never counts).
 * Stage B: Distinct alternatives detected.
 * has_alternative = (A + B) OR (explicit multi-option markers without A).
 *
 * "or"-joined verb phrases: require a verb before AND after "or".
 * Noun-list "or" ("revenue or profit") does NOT count.
 */
function detectAlternative(text: string): boolean {
  const lower = text.toLowerCase()

  // Check for explicit multi-option markers (these work without Stage A)
  const hasExplicitMarker = ALTERNATIVE_MARKERS.some(marker => {
    const re = new RegExp(`\\b${escapeRegex(marker)}\\b`, 'i')
    return re.test(lower)
  })

  if (hasExplicitMarker) return true

  // Stage A: decision framing phrase
  const stageA = wordBoundaryMatch(text, DECISION_FRAMING_PHRASES) !== null

  if (!stageA) return false

  // Stage B: "or"-joined verb phrases (verb ... or ... verb)
  // Match patterns like "raise prices or stay", "expand or consolidate"
  const COMMON_VERBS = /\b(?:raise|lower|stay|keep|expand|consolidate|hire|fire|build|buy|sell|launch|delay|invest|cut|grow|move|wait|switch|change|continue|stop|start|merge|split|enter|exit|close|open|adopt|drop|partner|acquire|outsource|insource|pivot|scale|downsize|upgrade|maintain|replace|retain|remove)\b/i
  const orParts = lower.split(/\bor\b/)
  if (orParts.length >= 2) {
    const hasVerbBefore = COMMON_VERBS.test(orParts[0])
    const hasVerbAfter = orParts.slice(1).some(part => COMMON_VERBS.test(part))
    if (hasVerbBefore && hasVerbAfter) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Detection: Measurable outcome (same-sentence only, v1)
// ---------------------------------------------------------------------------

/**
 * Requires target verb + metric token or number with currency/% in the
 * SAME sentence. Goal verbs alone (without number/metric) do NOT qualify.
 */
function detectMeasurableOutcome(text: string): boolean {
  const sentences = splitSentences(text)

  for (const sentence of sentences) {
    const hasTargetVerb = wordBoundaryMatch(sentence, TARGET_VERBS) !== null
    if (!hasTargetVerb) continue

    // Check for number with currency or % unit
    const numbers = extractNumbers(sentence)
    const hasQualifiedNumber = numbers.some(n => n.hasCurrency || n.hasPercent)

    // Metric token + plain number (e.g., "reduce churn to 4")
    const hasMetric = wordBoundaryMatch(sentence, METRIC_TOKENS) !== null
    const hasPlainNumber = numbers.length > 0

    if (hasQualifiedNumber || (hasPlainNumber && hasMetric)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Detection: Baseline
// ---------------------------------------------------------------------------

/**
 * Present pattern + value within ~6 tokens. Value = number, or
 * adjective/noun phrase ("high churn", "strong pipeline").
 * Guard: "currently" + process verb does NOT count.
 */
function detectBaseline(text: string): boolean {
  const lower = text.toLowerCase()

  // Guard: explicit "unknown baseline" language overrides any present-pattern match
  if (wordBoundaryMatch(text, BASELINE_UNKNOWN_PATTERNS) !== null) return false

  // Special case: "from X to Y" pattern
  if (/\bfrom\s+(?:[£$€]?\s*[\d,]+(?:\.\d+)?(?:\s*[kmb])?%?|[a-z]+(?:\s+[a-z]+)?)\s+to\s+(?:[£$€]?\s*[\d,]+(?:\.\d+)?(?:\s*[kmb])?%?|[a-z]+(?:\s+[a-z]+)?)\b/i.test(lower)) {
    return true
  }

  for (const pattern of BASELINE_PRESENT_PATTERNS) {
    const re = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i')
    const match = re.exec(lower)
    if (!match) continue

    // Guard: check for process verb following "currently" / similar
    const afterMatch = lower.slice(match.index + match[0].length, match.index + match[0].length + 40)
    const isProcessVerb = BASELINE_PROCESS_VERBS.some(verb => {
      const verbRe = new RegExp(`^\\s+${escapeRegex(verb)}\\b`, 'i')
      return verbRe.test(afterMatch)
    })
    if (isProcessVerb) continue

    // Check for value within ~6 tokens after the pattern match
    const windowStart = match.index + match[0].length
    const tokens = lower.slice(windowStart, windowStart + 80).split(/\s+/).filter(Boolean)
    const window = tokens.slice(0, 6).join(' ')

    // Value = number
    if (extractNumbers(window).length > 0) return true

    // Value = adjective/noun phrase (e.g., "high churn", "strong pipeline")
    // or noun + "is" + adjective (e.g., "pipeline is strong")
    if (/\b(?:high|low|strong|weak|poor|good|great|bad|flat|steady|declining|growing|rising|falling|stable|unstable)\s+\w+/i.test(window)) {
      return true
    }
    if (/\b\w+\s+(?:is|are)\s+(?:high|low|strong|weak|poor|good|great|bad|flat|steady|declining|growing|rising|falling|stable|unstable)\b/i.test(window)) {
      return true
    }

    // Value = standalone meaningful descriptor
    if (/\b(?:zero|none|nil|nothing|minimal|significant|substantial)\b/i.test(window)) {
      return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Detection: Constraint and risk
// ---------------------------------------------------------------------------

function detectConstraint(text: string): boolean {
  return wordBoundaryMatch(text, CONSTRAINT_WORDS) !== null
}

function detectRisk(text: string): boolean {
  return wordBoundaryMatch(text, RISK_WORDS) !== null
}

// ---------------------------------------------------------------------------
// Detection: Bias — sunk cost
// ---------------------------------------------------------------------------

function detectSunkCost(text: string): string | null {
  return wordBoundaryMatch(text, SUNK_COST_PHRASES)
}

// ---------------------------------------------------------------------------
// Detection: Bias — anchoring
// ---------------------------------------------------------------------------

/**
 * Count distinct numbers excluding:
 * - Years in YEAR_RANGE
 * - Numbers <= 99 without currency or % unit
 * - Ordinals ("1st", "2nd"), version numbers ("v3"), phase/step/option numbering
 *
 * Anchoring = exactly 1 qualifying number AND (in first sentence OR repeated 2+ times).
 */
function detectAnchoring(text: string): boolean {
  const numbers = extractNumbers(text)
  const lower = text.toLowerCase()

  // Filter out excluded numbers
  const qualifying = numbers.filter(n => {
    // Exclude years
    if (n.value >= YEAR_RANGE[0] && n.value <= YEAR_RANGE[1] && !n.hasCurrency && !n.hasPercent) {
      // Check if it looks like a year (4-digit integer)
      if (Number.isInteger(n.value) && n.raw.trim().replace(/[,\s]/g, '').match(/^\d{4}$/)) return false
    }

    // Exclude small numbers without currency or %
    if (n.value <= 99 && !n.hasCurrency && !n.hasPercent) return false

    // Exclude ordinals and version-like patterns: check context around the number
    const contextStart = Math.max(0, n.index - 15)
    const contextEnd = Math.min(lower.length, n.index + n.raw.length + 10)
    const context = lower.slice(contextStart, contextEnd)
    for (const pattern of ANCHORING_EXCLUSION_PATTERNS) {
      if (pattern.test(context)) return false
    }

    return true
  })

  // Deduplicate by value
  const distinctValues = new Set(qualifying.map(n => n.value))

  if (distinctValues.size !== 1) return false

  // Check: in first sentence OR repeated 2+ times
  const sentences = splitSentences(text)
  const firstSentence = sentences[0] ?? ''
  const firstSentenceNumbers = extractNumbers(firstSentence).filter(n => {
    if (n.value <= 99 && !n.hasCurrency && !n.hasPercent) return false
    if (n.value >= YEAR_RANGE[0] && n.value <= YEAR_RANGE[1] && !n.hasCurrency && !n.hasPercent) {
      if (Number.isInteger(n.value) && n.raw.trim().replace(/[,\s]/g, '').match(/^\d{4}$/)) return false
    }
    return true
  })

  const inFirstSentence = firstSentenceNumbers.some(n => n.value === [...distinctValues][0])
  const repeatedTwice = qualifying.length >= 2

  return inFirstSentence || repeatedTwice
}

// ---------------------------------------------------------------------------
// Readiness computation
// ---------------------------------------------------------------------------

function computeReadiness(
  alt: boolean, outcome: boolean, baseline: boolean, constraintOrRisk: boolean,
): 'low' | 'ok' | 'strong' {
  const count = [alt, outcome, baseline, constraintOrRisk].filter(Boolean).length
  if (count >= 4) return 'strong'
  if (count >= 2) return 'ok'
  return 'low'
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function extractRealtimeSignals(text: string): RealtimeSignals {
  const has_alternative = detectAlternative(text)
  const has_measurable_outcome = detectMeasurableOutcome(text)
  const has_baseline = detectBaseline(text)
  const has_constraint = detectConstraint(text)
  const has_risk = detectRisk(text)
  const has_constraint_or_risk = has_constraint || has_risk
  const bias_detected = detectSunkCost(text)
    ? 'sunk_cost' as const
    : detectAnchoring(text)
      ? 'anchoring' as const
      : null
  const readiness = computeReadiness(has_alternative, has_measurable_outcome, has_baseline, has_constraint_or_risk)

  return {
    has_alternative,
    has_measurable_outcome,
    has_baseline,
    has_constraint,
    has_risk,
    has_constraint_or_risk,
    bias_detected,
    readiness,
  }
}

// ---------------------------------------------------------------------------
// Snippet extraction — called by popover, not part of RealtimeSignals
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '\u2026'
}

/**
 * Extract a snippet for the "alternative" popover row.
 * Returns the first matched multi-option marker phrase, truncated to 32 chars.
 */
export function extractAlternativeSnippet(text: string): string | null {
  const lower = text.toLowerCase()
  for (const marker of ALTERNATIVE_MARKERS) {
    const re = new RegExp(`\\b${escapeRegex(marker)}\\b`, 'i')
    const match = re.exec(lower)
    if (match) {
      // Grab some surrounding context
      const start = Math.max(0, match.index)
      const end = Math.min(text.length, match.index + marker.length + 16)
      return truncate(text.slice(start, end).trim(), 32)
    }
  }
  // Fallback: if Stage A + or-joined verbs matched, use generic
  if (detectAlternative(text)) return 'Alternatives detected'
  return null
}

/**
 * Extract a snippet for the "measurable outcome" popover row.
 * Returns the first target number + following 3-5 tokens.
 */
export function extractOutcomeSnippet(text: string): string | null {
  const sentences = splitSentences(text)
  for (const sentence of sentences) {
    const hasVerb = wordBoundaryMatch(sentence, TARGET_VERBS) !== null
    if (!hasVerb) continue
    const numbers = extractNumbers(sentence)
    if (numbers.length > 0) {
      const n = numbers[0]
      const after = sentence.slice(n.index + n.raw.length).trim().split(/\s+/).slice(0, 4).join(' ')
      return truncate(`${n.raw} ${after}`.trim(), 32)
    }
  }
  return null
}

/**
 * Extract a snippet for the "baseline" popover row.
 * Prefers "from X to Y" match, else "currently ..." phrase.
 */
export function extractBaselineSnippet(text: string): string | null {
  // "from X to Y"
  const fromTo = text.match(/\bfrom\s+[£$€]?\s*[\d,]+(?:\.\d+)?(?:\s*[kmb])?%?\s+to\s+[£$€]?\s*[\d,]+(?:\.\d+)?(?:\s*[kmb])?%?/i)
  if (fromTo) return truncate(fromTo[0], 32)

  // "currently ..." with value
  const currently = text.match(/\bcurrently\s+\S+(?:\s+\S+){0,3}/i)
  if (currently) {
    // Guard: exclude process verbs
    const afterCurrently = currently[0].replace(/^currently\s+/i, '')
    const isProcess = BASELINE_PROCESS_VERBS.some(v =>
      new RegExp(`^${escapeRegex(v)}\\b`, 'i').test(afterCurrently),
    )
    if (!isProcess) return truncate(currently[0], 32)
  }

  return null
}

/**
 * Extract a snippet for the "constraint/risk" popover row.
 * Prefers constraint with numeric value, else constraint without, else risk phrase.
 */
export function extractConstraintRiskSnippet(text: string): string | null {
  const lower = text.toLowerCase()

  // Constraint with number
  for (const word of CONSTRAINT_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    const match = re.exec(lower)
    if (match) {
      const context = text.slice(match.index, match.index + 40).trim()
      if (extractNumbers(context).length > 0) {
        return truncate(context, 32)
      }
    }
  }

  // Constraint without number
  for (const word of CONSTRAINT_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    const match = re.exec(lower)
    if (match) {
      return truncate(text.slice(match.index, match.index + 32).trim(), 32)
    }
  }

  // Risk phrase
  for (const word of RISK_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    const match = re.exec(lower)
    if (match) {
      return truncate(text.slice(match.index, match.index + 32).trim(), 32)
    }
  }

  return null
}

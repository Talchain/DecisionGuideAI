/**
 * coachingConfig — centralised coaching card text for all inspector panels.
 *
 * Each entry is keyed by panel/context so callers can import exactly what they need.
 * Moving these here prevents coaching copy from drifting silently across 8 files.
 *
 * § Contextual templates
 * Some entries have a `template` variant that accepts placeholder substitutions.
 * Use `resolveCoaching(key, context)` to get the best available text.
 * Supported placeholders: {factorName}, {sensitivityRank}, {evidenceTier}, {sourceName}, {targetName}
 */

export const COACHING = {
  /** EdgePanel — auto-generated weight calibration nudge */
  edgeWeight: 'This value was generated automatically. Even a rough calibration \u2014 is the effect strong, moderate, or weak? \u2014 would improve the analysis.',

  /** DecisionPanel — option differentiation nudge */
  decisionOptions: 'Consider options that pull different levers to increase differentiation.',

  /** OptionPanel — factor coverage nudge */
  optionCoverage: 'Consider whether this option changes enough factors to differentiate from alternatives.',

  /** FactorControllablePanel — evidence quality nudge */
  factorControllableEvidence: "This factor\u2019s evidence quality could be improved. Consider anchoring with an industry benchmark.",

  /** FactorObservablePanel — data freshness nudge */
  factorObservableData: 'If you have more recent data for this measurement, updating it would sharpen the analysis.',

  /** FactorExternalPanel — uncertainty calibration nudge */
  factorExternalUncertainty: 'This is a source of uncertainty. Even a rough estimate would significantly sharpen the analysis.',

  /** OutcomePanel — model completeness nudge */
  outcomeCompleteness: 'Consider whether all the relevant factors driving this outcome are captured in the model.',

  /** RiskPanel — control levers nudge */
  riskControlLevers: 'Consider which factors you control that most affect this risk, and whether options address them.',

  /** GoalPanel — connections completeness nudge */
  goalConnections: 'Consider whether all relevant outcomes and risks are connected to your goal.',

  /** GoalPanel — success target unlock nudge */
  goalNoTarget: 'Adding a specific target unlocks probability calculations',
} as const

export type CoachingKey = keyof typeof COACHING

/** Context values for template substitution */
export interface CoachingContext {
  factorName?: string
  sensitivityRank?: number | null
  evidenceTier?: string
  sourceName?: string
  targetName?: string
}

/**
 * Template overrides for contextual coaching.
 * Each entry maps a CoachingKey to a template string with `{placeholder}` slots.
 * `resolveCoaching` uses these when all required placeholders are available,
 * falling back to the static COACHING text otherwise.
 */
const COACHING_TEMPLATES: Partial<Record<CoachingKey, string>> = {
  factorControllableEvidence: '{factorName} may benefit from an industry benchmark — even a rough anchor would improve confidence.',
  factorExternalUncertainty: '{factorName} is a source of uncertainty. Even a rough estimate would significantly sharpen the analysis.',
  factorObservableData: 'If you have more recent data for {factorName}, updating it would sharpen the analysis.',
}

/**
 * Resolve the best coaching text for a given key and context.
 * Uses the contextual template when all required placeholders are available,
 * falls back to the static text when any placeholder is missing.
 */
export function resolveCoaching(key: CoachingKey, context: CoachingContext = {}): string {
  const template = COACHING_TEMPLATES[key]
  if (!template) return COACHING[key]

  // Replace all placeholders, returning null for any that are unavailable
  let resolved = template
  const placeholders: Array<keyof CoachingContext> = ['factorName', 'sensitivityRank', 'evidenceTier', 'sourceName', 'targetName']

  for (const placeholder of placeholders) {
    const marker = `{${placeholder}}`
    if (!resolved.includes(marker)) continue
    const value = context[placeholder]
    if (value == null || value === '') return COACHING[key] // fallback: placeholder required but missing
    resolved = resolved.replace(marker, String(value))
  }

  return resolved
}

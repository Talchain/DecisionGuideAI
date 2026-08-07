/**
 * coachingConfig: centralised coaching card text for all inspector panels.
 *
 * Each entry is keyed by panel/context so callers can import exactly what they need.
 * Moving these here prevents coaching copy from drifting silently across 8 files.
 *
 * Contextual templates
 * Some entries have a `template` variant that accepts placeholder substitutions.
 * Use `resolveCoaching(key, context)` to get the best available text.
 * Supported placeholders: {factorName}, {sensitivityRank}, {evidenceTier}, {sourceName}, {targetName}
 *
 * A COACHING STRING MAY NOT ASSERT A PROVENANCE
 * ---------------------------------------------
 * Static copy cannot know where a number came from, so any sentence of the
 * form "this value was <verb-of-origin>" is a claim the code cannot establish.
 * Provenance sentences are DERIVED (see `resolveEdgeValuesCoaching`); the
 * static entries below are limited to advice, which is true whatever the
 * origin. Audited at the bytes for this lane: `edgeWeight` was the only
 * origin-asserting entry (its *"This value was generated automatically."* was
 * rendered on values `USER_EDGE_DEFAULTS` had fabricated AND on values the
 * user had just typed). The remainder make claims of a different kind —
 * `factorControllableEvidence`'s "could be improved" and
 * `factorExternalUncertainty`'s "is a source of uncertainty" follow from the
 * factor's declared TYPE, which the panel does know, and everything else is
 * hedged advice ("Consider whether…", "If you have…").
 */

import type { EdgeValueSource } from '../../domain/edgeValueProvenance'

export const COACHING = {
  /**
   * EdgePanel: strength calibration nudge — the PROVENANCE-FREE half only.
   *
   * ⚠ This entry used to open *"This value was generated automatically."* and
   * was rendered unconditionally beneath the edge panel's strength control and
   * "Does this connection exist?" slider. NOTHING generated those values on a
   * freshly drawn edge: they are `USER_EDGE_DEFAULTS` (weight 0.3, beliefExists
   * 0.8). The sentence was the worst variant of the fabrication class, because
   * it answers the user's natural question — "where did this number come
   * from?" — with a specific, false answer, and it was equally false for a
   * value the USER had just typed.
   *
   * The provenance sentence is now DERIVED per edge by
   * `resolveEdgeValuesCoaching`; this key carries only the advice, which is
   * true regardless of where the number came from.
   */
  edgeWeight: 'To improve the analysis, consider whether the effect is strong, moderate, or weak.',

  /** DecisionPanel: option differentiation nudge */
  decisionOptions: 'Consider options that pull different levers to increase differentiation.',

  /** OptionPanel: factor coverage nudge */
  optionCoverage: 'Consider whether this option changes enough factors to differentiate from alternatives.',

  /** FactorControllablePanel: evidence quality nudge */
  factorControllableEvidence: "This factor\u2019s evidence quality could be improved. Consider anchoring with an industry benchmark.",

  /** FactorObservablePanel: data freshness nudge */
  factorObservableData: 'If you have more recent data for this measurement, updating it would sharpen the analysis.',

  /** FactorExternalPanel: uncertainty calibration nudge */
  factorExternalUncertainty: 'This is a source of uncertainty. Even a rough estimate would significantly sharpen the analysis.',

  /** OutcomePanel: model completeness nudge */
  outcomeCompleteness: 'Consider whether all the relevant factors driving this outcome are captured in the model.',

  /** RiskPanel: control levers nudge */
  riskControlLevers: 'Consider which factors you control that most affect this risk, and whether options address them.',

  /** GoalPanel: connections completeness nudge */
  goalConnections: 'Consider whether all relevant outcomes and risks are connected to your goal.',

  /** GoalPanel: evidence quality nudge */
  goalEvidence: 'Consider whether the goal threshold and constraints reflect current business reality.',

  /** GoalPanel: success target unlock nudge */
  goalNoTarget: 'Adding a specific target unlocks probability calculations',
} as const

export type CoachingKey = keyof typeof COACHING

/**
 * PROVENANCE DISCLOSURE — the sentence that answers "where did this number
 * come from?", derived per edge instead of asserted.
 *
 * WHY A RECORD AND NOT A CHAIN OF `if`s
 * -------------------------------------
 * The key type is `EdgeValueSource | 'not_set'`, taken from
 * `canvas/domain/edgeValueProvenance`. Adding a fourth source there (say
 * `'import'`) makes THIS object a type error until someone writes the sentence
 * for it — the disclosure cannot silently inherit another source's wording.
 * A `switch` with a `default` would have quietly mislabelled it, which is the
 * hand-maintained-mirror failure this whole lane exists to remove.
 *
 * `not_set` is the state every UI default lands in. It gets the only sentence
 * that makes no claim about an origin, because there isn't one.
 */
type EdgeProvenanceKey = EdgeValueSource | 'not_set'

const STRENGTH_PROVENANCE_COPY: Record<EdgeProvenanceKey, string> = {
  cee: 'Olumi estimated this strength from your description.',
  template: 'This strength came with the template you started from — it was authored for the template, not estimated for your decision.',
  user: 'You set this strength.',
  not_set: 'No strength has been set for this connection yet — the control below starts at a neutral position, not at a measurement.',
}

const EXISTENCE_PROVENANCE_COPY: Record<EdgeProvenanceKey, string> = {
  cee: 'Olumi estimated how likely this connection is to exist.',
  template: 'The likelihood that this connection exists came with the template.',
  user: 'You set how likely this connection is to exist.',
  not_set: 'Nobody has said how likely this connection is to exist yet.',
}

/**
 * Build the edge panel's coaching text from what is ACTUALLY known about the
 * two provenanced values on this edge.
 *
 * Pass the resolved sources (`edgeValueSource(data, 'weight')` /
 * `edgeValueSource(data, 'beliefExists')`), not the numbers.
 */
export function resolveEdgeValuesCoaching(sources: {
  strength: EdgeValueSource | null
  existence: EdgeValueSource | null
}): string {
  const strengthKey: EdgeProvenanceKey = sources.strength ?? 'not_set'
  const existenceKey: EdgeProvenanceKey = sources.existence ?? 'not_set'
  return [
    STRENGTH_PROVENANCE_COPY[strengthKey],
    EXISTENCE_PROVENANCE_COPY[existenceKey],
    COACHING.edgeWeight,
  ].join(' ')
}

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
  factorControllableEvidence: '{factorName} may benefit from an industry benchmark. Even a rough anchor would improve confidence.',
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

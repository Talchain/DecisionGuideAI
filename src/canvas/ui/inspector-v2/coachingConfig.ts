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
import { STRENGTH_HOLDS_BY_DEFINITION } from '../../domain/strengthDefinitional'

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

  /**
   * FactorExternalPanel: uncertainty calibration nudge.
   *
   * ⚠ THIS LINE HAS BEEN WRONG TWICE, IN OPPOSITE DIRECTIONS.
   * It first read *"Even a rough estimate would significantly sharpen the
   * analysis."* — a promise about an edit the user cannot make. The correction
   * then went too far the other way (*"A recorded range makes that uncertainty
   * explicit in the model"*, written alongside a panel note denying any
   * analytical effect at all), understating a field that IS an analysis input:
   * `prior.{range_min,range_max}` passes `transformNodeToV2` untouched and is
   * declared on CEE's graph contract as what ISL samples for external factors
   * (`schemas/cee-v3.ts:184-185`).
   *
   * What is entitled here, per this file's own header: the factor's declared
   * TYPE supports "source of uncertainty"; the field's declared role supports
   * "analysis input". What is NOT entitled is any advice to go and set it —
   * the Inspector is wrapped in an unconditional disabled fieldset, so the
   * only action this card's button performs is `handleAsk`. (This sentence
   * also cited `NODE_SETTER_AUTHORITY.setPriorRange`; that manifest was
   * deleted on 27 Aug 2026, PR #886, as an unenforced mirror with zero code
   * consumers. The fieldset is the enforcement.) The nudge therefore points at asking, which is
   * exactly what the button does.
   */
  factorExternalUncertainty: 'This is a source of uncertainty. Its recorded range is an analysis input, so it is worth asking whether that range reflects what you know.',

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

/**
 * POM-8 (27 Sep 2026): the strength is CEE's PLACEHOLDER (`isStrengthPlaceholder`)
 * — a `'cee'` source, but not an estimate. The `cee` sentence above ("Olumi
 * estimated this strength") was untrue of it; this one says what it is and what
 * the reader can do about it.
 */
const STRENGTH_PLACEHOLDER_COPY =
  'Strength not judged yet. Olumi put in a placeholder so the model can run — it is not an estimate. Set it if you know it.'

/**
 * MG 0ebb952a (1 Oct 2026): the link holds BY DEFINITION (`isStrengthDefinitional`)
 * — a part to its total, or a risk's exposure to the goal. Arithmetic, not anyone's
 * estimate, so neither the `cee` strength sentence nor the `cee` existence sentence
 * above is true of it, and there is nothing to confirm.
 */
// One spelling, shared with the surfaces that show it where a strength editor would be.
const STRENGTH_DEFINITIONAL_COPY = STRENGTH_HOLDS_BY_DEFINITION
const EXISTENCE_DEFINITIONAL_COPY = 'By definition, this connection always exists.'

const EXISTENCE_PROVENANCE_COPY: Record<EdgeProvenanceKey, string> = {
  cee: 'Olumi estimated how likely this connection is to exist.',
  template: 'The likelihood that this connection exists came with the template.',
  user: 'You set how likely this connection is to exist.',
  not_set: 'Nobody has said how likely this connection is to exist yet.',
}

/**
 * "From your brief: increase of about £49 / month per 1 subscriber. Olumi sized this link from it." — the size and
 * its author words come from `edgeSizePhrase` (one vocabulary with the hover card and the Model tab), never re-typed.
 */
function usersFigureSentence(f: { readonly size: string; readonly whose: string; readonly ofRange?: string }): string {
  const whose = f.whose === '' ? 'Your figure' : `${f.whose.charAt(0).toUpperCase()}${f.whose.slice(1)}`
  const size = `${f.size.charAt(0).toLowerCase()}${f.size.slice(1)}`
  // A4 (R3 C1): a size from one end of the user's range is never said without the range.
  return `${whose}: ${size}${f.ofRange ?? ''}. Olumi sized this link from it.`
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
  /** POM-8: the strength is CEE's placeholder (`isStrengthPlaceholder`). */
  strengthPlaceholder?: boolean
  /** MG 0ebb952a: the link holds by definition (`isStrengthDefinitional`). */
  strengthDefinitional?: boolean
  /**
   * ⭐ Beat 1 (Canvas lane, 4 Oct 2026): the link's size is the USER's own stated figure (`edgeSizePhrase`, only when
   * `usersFigure`), so the β was sized from it and "Olumi estimated this strength" is untrue of it.
   */
  usersFigure?: { readonly size: string; readonly whose: string; readonly ofRange?: string } | null
}): string {
  return `${resolveEdgeValuesProvenance(sources)} ${COACHING.edgeWeight}`
}

/**
 * ⭐ v3.1 (DESIGN-GAP-v31 row 32): the two PROVENANCE sentences on their own —
 * who set this connection's strength and its likelihood of existing. They used
 * to reach the reader only inside the generic lightbulb card (as the first two
 * sentences of `resolveEdgeValuesCoaching`); v3.1 drops that card, and these are
 * element-grounded FACTS, not coaching, so the edge pane states them flat. The
 * generic third sentence (`COACHING.edgeWeight`) is the part that left.
 */
export function resolveEdgeValuesProvenance(sources: {
  strength: EdgeValueSource | null
  existence: EdgeValueSource | null
  /** POM-8: the strength is CEE's placeholder (`isStrengthPlaceholder`). */
  strengthPlaceholder?: boolean
  /** MG 0ebb952a: the link holds by definition (`isStrengthDefinitional`). */
  strengthDefinitional?: boolean
  /**
   * ⭐ Beat 1 (Canvas lane, 4 Oct 2026): the link's size is the USER's own stated figure (`edgeSizePhrase`, only when
   * `usersFigure`), so the β was sized from it and "Olumi estimated this strength" is untrue of it.
   */
  usersFigure?: { readonly size: string; readonly whose: string; readonly ofRange?: string } | null
}): string {
  const strengthKey: EdgeProvenanceKey = sources.strength ?? 'not_set'
  const existenceKey: EdgeProvenanceKey = sources.existence ?? 'not_set'
  // Both flags only ever narrow a `'cee'` claim: neither can relabel a strength
  // the person set, a template's, or an unset one. A definition is checked first.
  const definitional = sources.strengthDefinitional === true && strengthKey === 'cee'
  const strengthSentence = definitional
    ? STRENGTH_DEFINITIONAL_COPY
    : sources.strengthPlaceholder === true && strengthKey === 'cee'
      ? STRENGTH_PLACEHOLDER_COPY
      : sources.usersFigure != null && strengthKey === 'cee'
        ? usersFigureSentence(sources.usersFigure)
        : STRENGTH_PROVENANCE_COPY[strengthKey]
  const existenceSentence = definitional && existenceKey === 'cee'
    ? EXISTENCE_DEFINITIONAL_COPY
    : EXISTENCE_PROVENANCE_COPY[existenceKey]
  return `${strengthSentence} ${existenceSentence}`
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
  factorExternalUncertainty: '{factorName} is a source of uncertainty. Its recorded range is an analysis input, so it is worth asking whether that range reflects what you know.',
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

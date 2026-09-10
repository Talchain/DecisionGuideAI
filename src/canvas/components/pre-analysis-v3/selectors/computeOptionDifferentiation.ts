/**
 * computeOptionDifferentiation — do the options assign the same VALUES to the
 * factors they share?
 *
 * ⚠ NAMED APART FROM `computeStructuralAbsence.shared_mechanism`, DELIBERATELY.
 * That selector answers a STRUCTURAL question — "do the options act on the same
 * parts of the model?" — from nodes and edges. This one answers a MAGNITUDE
 * question — "having reached the same parts, do they say anything different
 * about them?" — from the producer's resolved values. A model can fail either
 * without failing the other: options can touch different parts and still carry
 * the same numbers on the parts they do share, and options can touch identical
 * parts while differing on every number. Two questions, two names; reconciling
 * them into one would delete a real finding.
 *
 * WHY THIS EXISTS. The pre-run validator already computes an
 * `IDENTICAL_OPTIONS_SUSPECTED` warning (`canvas/hooks/usePreRunValidation.ts`),
 * but nothing renders it: its only consumer is `canvas/hooks/usePreAnalysisData.ts`,
 * which has no product importer, and the live panel is v3, which never calls the
 * validator at all. That predicate is also all-or-nothing — it fires only when
 * two options are identical on EVERY value — so a set differing on a single axis
 * escapes it entirely, which is the shape measured on staging. This selector is
 * the rendered, partial-overlap answer.
 *
 * SOURCE OF TRUTH. Values come from `analysis_ready.options[].interventions`,
 * the producer's own resolved numbers (`CEEOptionV3`), never a canvas-side
 * re-derivation — the panel and the analyser must not disagree about what the
 * options say.
 *
 * ⚠⚠ TWO WIRE SHAPES, BOTH LIVE. THIS SELECTOR SHIPPED DARK READING ONLY ONE.
 * `interventions` arrives in either of two forms, and the store hands this
 * selector whichever one CEE sent: `normaliseV5AnalysisReady`
 * (`v5/applyV5State.ts:268-274`) maps `option_id` to `id` and then passes
 * `interventions` through UNCHANGED, with no value unwrapping anywhere on the
 * path. So the raw producer shape reaches this code verbatim.
 *
 *   FLAT   `Record<nodeId, number>`        e.g. `{ "1ed89ca0": 0.5 }`
 *   NESTED `Record<nodeId, { value, … }>`  e.g. `{ "fac_dev_time": { value: 0.85 } }`
 *
 * MEASURED, not assumed, across the repo's two capture corpora:
 *   FLAT   — 6/6 live turn captures carrying options in
 *            `lib/coherence/__tests__/fixtures/captures/`, and 7/7 in
 *            `v5/__tests__/fixtures/`. This is the real CEE wire.
 *   NESTED — 5/5 saved starter examples in `docs/evidence/starters/raw/`.
 *
 * This selector originally read `intervention?.value` alone, which is
 * `undefined` on a bare number. Every comparable option therefore fell out at
 * `statedValues`, `comparable` was always empty, and the finding could never
 * fire on a real CEE turn — while the starter path kept it green. The spec's
 * own fixture builder emitted the nested shape only, so nothing in the suite
 * could see it: a fixture you wrote yourself is not evidence about the wire.
 * Read BOTH shapes; neither is a legacy form.
 *
 * ⚠ NEVER INVENT AN ABSENCE. Every precondition below returns `null` rather than
 * a zeroed finding, so "we could not look" is never rendered as "we looked and
 * found nothing".
 */

/** Producer-shaped read model. Deliberately structural — no import coupling. */
interface InterventionLike {
  value?: unknown
}
/** Either live wire form. See the two-shapes note in the file header. */
type InterventionLikeValue = number | InterventionLike | null | undefined
interface OptionLike {
  id?: unknown
  label?: unknown
  status?: unknown
  is_baseline?: unknown
  interventions?: Record<string, InterventionLikeValue> | null
}

export interface OptionDifferentiation {
  /** Comparable options considered (ready, non-baseline, with stated values). */
  optionCount: number
  /** Factors every one of those options states a value for. */
  sharedCount: number
  /** Of the shared factors, how many carry one value across every option. */
  identicalCount: number
}

/**
 * Normalise to nine decimal places before comparing.
 *
 * The same normalisation the existing `checkIdenticalOptions` predicate uses,
 * so the two can never disagree about whether two values are "the same"; it
 * also keeps float noise (0.1 + 0.2) from reading as a genuine difference,
 * which would silently suppress the finding.
 */
function key(value: number): string {
  return value.toFixed(9)
}

/**
 * Resolve one intervention to its stated number, whichever wire shape it is in.
 *
 * Returns `null` for anything that is not a finite number, so a non-finite or
 * absent value is EXCLUDED from the comparison rather than coerced into one.
 * `NaN`/`Infinity` must not become a shared factor: they would compare unequal
 * to themselves through `key`, which silently suppresses the finding.
 */
function readInterventionValue(intervention: InterventionLikeValue): number | null {
  // FLAT — the live CEE turn shape, `Record<nodeId, number>`.
  if (typeof intervention === 'number') {
    return Number.isFinite(intervention) ? intervention : null
  }
  // NESTED — `CEEInterventionV3 { value, source, … }`, the saved-example shape.
  if (intervention && typeof intervention === 'object') {
    const value = intervention.value
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function statedValues(option: OptionLike): Map<string, number> | null {
  const raw = option.interventions
  if (!raw || typeof raw !== 'object') return null
  const out = new Map<string, number>()
  for (const [nodeId, intervention] of Object.entries(raw)) {
    const value = readInterventionValue(intervention)
    if (value !== null) out.set(nodeId, value)
  }
  return out.size > 0 ? out : null
}

export function computeOptionDifferentiation(
  analysisReady: { options?: unknown } | null | undefined,
): OptionDifferentiation | null {
  const rawOptions = analysisReady?.options
  if (!Array.isArray(rawOptions)) return null

  // PRECONDITION: only options the producer calls ready carry resolved values.
  // The baseline arm is excluded by construction — a do-nothing option is
  // *meant* to differ from the others by having no stated change, and counting
  // it would either suppress the finding (no shared factors) or report the
  // status quo as a modelling defect.
  const comparable: Array<Map<string, number>> = []
  for (const raw of rawOptions as OptionLike[]) {
    if (!raw || typeof raw !== 'object') continue
    if (raw.status !== 'ready') continue
    if (raw.is_baseline === true) continue
    const values = statedValues(raw)
    if (values) comparable.push(values)
  }

  // PRECONDITION: a comparison needs two things to compare.
  if (comparable.length < 2) return null

  // Shared ground = factors EVERY comparable option states a value for. A
  // factor only one option mentions says nothing about whether the options
  // agree, so it belongs to neither count.
  const [first, ...rest] = comparable
  const shared: string[] = []
  for (const nodeId of first.keys()) {
    if (rest.every(m => m.has(nodeId))) shared.push(nodeId)
  }

  // PRECONDITION: with no shared ground the question does not apply. This is
  // the honest null — not "the options are well differentiated".
  if (shared.length === 0) return null

  let identicalCount = 0
  for (const nodeId of shared) {
    const reference = key(first.get(nodeId)!)
    if (rest.every(m => key(m.get(nodeId)!) === reference)) identicalCount += 1
  }

  // Nothing identical means the options genuinely say different things on
  // every factor they share — there is no finding to report.
  if (identicalCount === 0) return null

  return {
    optionCount: comparable.length,
    sharedCount: shared.length,
    identicalCount,
  }
}

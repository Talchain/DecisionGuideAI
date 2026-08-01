/**
 * factorDirection — THE one normalizer for a producer's factor `direction`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * The 0.30 boundary contract deliberately leaves `direction` open and
 * documents the observed domain `positive | negative | mixed | unknown`
 * (`olumi-schemas/src/boundary/enrichment.ts:262-295`); PLoT emits that domain
 * or null. The UI narrowed it to TWO values in two different places, and in
 * both places the leftovers fell back to THE SIGN OF THE MAGNITUDE:
 *
 *     direction = explicit ?? (magnitude >= 0 ? 'positive' : 'negative')
 *
 * The magnitude fields in question — `sensitivity_score`, `sensitivity`,
 * `importance_score` — are ordinarily NON-NEGATIVE. So `mixed` became
 * `positive`, `unknown` became `positive`, and an absent direction became
 * `positive`, each of them ending up as an "up" arrow and the screen-reader
 * sentence "increases the outcome". The UI asserted a causal direction the
 * producer had explicitly declined to assert. That is a false scientific
 * claim, not a missing disclosure (ROADMAP 2.234 / Codex audit B, B-03).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RULES
 * ─────────────────────────────────────────────────────────────────────────
 * 1. NEVER INFER DIRECTION FROM A MAGNITUDE. Not from an unsigned one, and
 *    not from a signed one either — the caller cannot tell which field it got
 *    without re-deriving the producer's own priority order, and a rule that
 *    depends on remembering which of four aliases happens to be signed is the
 *    hand-maintained mirror this codebase keeps paying for. Direction comes
 *    from the direction field or it does not come at all.
 * 2. ABSENCE STAYS ABSENCE. No producer value → `null`. Never a default.
 * 3. AN UNRECOGNISED VALUE FAILS CLOSED to `'unknown'` — a value we cannot
 *    interpret is precisely a direction we do not know, and it must not
 *    become a directional claim by falling through.
 * 4. ONLY `positive` AND `negative` LICENSE DIRECTIONAL RENDERING.
 *
 *    ⚠ CORRECTED (2.234 review). This used to justify itself by citing
 *    `KeyDriversPanel` ("renders `~`"), `DriverChips` ("no glyph") and
 *    `InsightsPanel` ("excludes the row"). ALL THREE HAVE ZERO NON-TEST JSX
 *    MOUNTS — `InsightsPanel`'s apparent hits are JSDoc. The claim was true of
 *    components nobody sees, and it hid the fact that the ONE LIVE driver
 *    surface, `DriversSection` (`ResultsBody.tsx:559`), still rendered
 *    `mixed`/`unknown`/absent identically to positive in its tooltip. Fixed at
 *    `elasticityShiftCopy` and pinned; it needed ONE new string, flagged for
 *    sign-off. A "the renderers already handle it" argument must name a
 *    MOUNTED renderer.
 *
 * 5. ⚠ THIS IS NOT THE ONLY PRODUCER OF `ReportV1`. `adapters/plot/v2/
 *    responseMapper.ts:993-999` carries this defect VERBATIM
 *    (`sensitivityVal >= 0 ? 'up' : 'down'` off the same unsigned chain) and is
 *    reachable ungated via `hydrateAnalysis.ts:118` ← `useScenario.ts:667` on
 *    every scenario load with `analysis_status === 'ready'`. It is NOT fixed
 *    here and is rowed. Say "the V5 mapper and the results hook" — never "all
 *    consumers".
 *
 * The alias sets below are the union of the two collapsed implementations, so
 * no payload that used to normalise now stops normalising.
 */

/** The producer's documented domain. `null` (absent) is modelled separately. */
export type FactorDirection = 'positive' | 'negative' | 'mixed' | 'unknown'

/** What a driver row renders. Already the domain of `ReportV1.drivers[].polarity`. */
export type FactorPolarity = 'up' | 'down' | 'neutral'

const POSITIVE_ALIASES = new Set(['positive', 'increases', 'increase', 'up', '+'])
const NEGATIVE_ALIASES = new Set(['negative', 'decreases', 'decrease', 'down', '-'])

/**
 * Normalise one producer `direction` value to the contract domain.
 *
 * @returns `null` when the producer sent nothing (absent / null / empty), a
 *   domain member otherwise. Never throws, never infers, never defaults to a
 *   directional value.
 */
export function normaliseFactorDirection(raw: unknown): FactorDirection | null {
  if (raw == null) return null
  if (typeof raw !== 'string' && typeof raw !== 'number') return 'unknown'

  const value = String(raw).toLowerCase().trim()
  if (value === '') return null

  if (POSITIVE_ALIASES.has(value)) return 'positive'
  if (NEGATIVE_ALIASES.has(value)) return 'negative'
  if (value === 'mixed') return 'mixed'
  if (value === 'unknown') return 'unknown'

  // Rule 3 — fail closed. A direction we cannot read is a direction we do not
  // know, and saying so is the honest outcome.
  return 'unknown'
}

/**
 * True only for the two states that license an arrow, a +/− glyph, a colour,
 * or the "increases/decreases the outcome" sentence.
 *
 * Every render site asking "should I draw a direction?" must ask THIS, not
 * `direction != null` — `'mixed'` and `'unknown'` are present values that
 * still forbid a directional claim.
 */
export function isDirectionalFactor(
  direction: FactorDirection | null | undefined,
): direction is 'positive' | 'negative' {
  return direction === 'positive' || direction === 'negative'
}

/**
 * The driver-row polarity for a normalised direction. `mixed`, `unknown` and
 * absence all take the pre-existing neutral affordance.
 */
export function factorDirectionToPolarity(
  direction: FactorDirection | null | undefined,
): FactorPolarity {
  if (direction === 'positive') return 'up'
  if (direction === 'negative') return 'down'
  return 'neutral'
}

/**
 * The inverse, for the one legacy seam that reconstructs a factor row from an
 * already-rendered `drivers[]` entry (`useResultsSectionData`'s "Source 2").
 * Lossy by nature — that is a property of the legacy shape, not of this
 * function — but `neutral` must map back to a NON-directional value rather
 * than silently becoming `positive`, which is what it did before.
 */
export function polarityToFactorDirection(
  polarity: FactorPolarity | null | undefined,
): FactorDirection | null {
  if (polarity === 'up') return 'positive'
  if (polarity === 'down') return 'negative'
  if (polarity === 'neutral') return 'unknown'
  return null
}

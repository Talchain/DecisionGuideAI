/**
 * THE single predicate for "what is a usable intervention value?".
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This rule was, until now, hand-written FOUR times in this repo:
 *
 *   1. `unwrapInterventionValue`   (canvas/utils/labelUtils.ts)   — display reads
 *   2. `flattenInterventions`      (adapters/plot/v2/adapter.ts)  — the PLoT wire edge
 *   3. `canvasInterventionsToCEE`  (adapters/plot/v2/adapter.ts)  — canvas → CEE V3
 *   4. an inline copy inside `useScenarioComparison.startComparison`
 *
 * Copies 1 and 2 agreed. Copy 3 did NOT: it checked `typeof inner === 'number'`
 * with no `Number.isFinite`, so it accepted `NaN` and `±Infinity` where the other
 * two rejected them. That is precisely the defect class that produced PLoT's own
 * `INVALID_INTERVENTION_VALUE` bug — two hand-written answers to "is this a valid
 * intervention?" drifting apart, with the looser one sitting nearer the wire.
 *
 * Every site that needs to answer that question MUST call this function. Do not
 * add a fifth copy; if a caller needs different behaviour, change it here and
 * fix the fallout, so the divergence is visible in one diff instead of silent.
 *
 * THE RULE
 * --------
 * An intervention value is usable iff it resolves to a FINITE number, either as
 * a bare scalar or at the `.value` property of a wrapper object. Nothing is
 * coerced: `Number(null) === 0` and `Number('foo') === NaN` have both caused
 * live defects here (see the `unwrapInterventionValue` docblock).
 *
 * Accepted:  `0.5` · `-2` · `0` · `{ value: 0.5 }` · `{ value: 0, unit: '%' }`
 * Rejected:  `null` · `undefined` · `NaN` · `Infinity` · `'0.5'` · `true` · `[]`
 *            `{ value: null }` · `{ value: 'tbd' }` · `{ value: NaN }` · `{}`
 */

/**
 * Resolve an intervention entry to its finite numeric value.
 *
 * @returns the finite number, or `null` when the entry carries no usable one.
 *   `null` is unambiguous here because a usable value is always a number —
 *   including `0`, so callers must test `=== null`, never falsiness.
 */
export function interventionNumericValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
    const inner = (raw as { value: unknown }).value
    if (typeof inner === 'number' && Number.isFinite(inner)) return inner
  }
  return null
}

/**
 * Does this entry *present itself* as an intervention, whether or not its value
 * is usable?
 *
 * This is the discriminator behind the disposal doctrine: "the user authored an
 * intervention here but its value is unusable" (→ MUST be surfaced) is a
 * different state from "there is no intervention here" (→ nothing to say).
 *
 * True for any bare number (including `NaN`/`Infinity`) and any non-array object
 * carrying a `value` key (whatever that key holds). False for `null`,
 * `undefined`, strings, booleans, arrays, and objects with no `value` key.
 */
export function looksLikeIntervention(raw: unknown): boolean {
  if (typeof raw === 'number') return true
  return raw != null && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw
}

/**
 * The result of splitting an intervention MAP into what can be analysed and
 * what was authored but cannot.
 */
export interface InterventionPartition {
  /** Every entry that resolved to a finite number, keyed by target id. */
  usable: Record<string, number>
  /**
   * Target ids that are present in the map but carry no usable value.
   * ORDER: the map's own key order, so messages read in authoring order.
   */
  unusableTargets: string[]
}

/**
 * Split an intervention map into its usable and unusable halves.
 *
 * WHY THIS EXISTS SEPARATELY FROM `interventionNumericValue`
 * ---------------------------------------------------------
 * The single-value predicate answers "is this value usable?". It cannot answer
 * the question the disposal doctrine actually asks, which is about the MAP:
 * "did this option lose anything on the way to the wire?" Every consumer that
 * used to answer that by walking the map and silently skipping failures now
 * calls this instead, so the skipped keys are always available to report.
 *
 * KEY PRESENCE IS THE AUTHORING SIGNAL — and that is deliberately NOT
 * `looksLikeIntervention`.
 * `looksLikeIntervention` discriminates a lone VALUE ("is this thing an
 * intervention at all?"), which is the right question at `extractOptionsFromNodes`
 * where a value arrives with no surrounding context. Inside a map it is the
 * wrong question, and answering it here would reopen the defect: an entry of a
 * bare `null` (`{ fac_a: null }`) fails `looksLikeIntervention`, yet the KEY
 * names a target, so something authored an intervention on `fac_a` and gave it
 * no value. PR #499 measured that exact shape arriving from CEE and being
 * written verbatim into `node.data.interventions`. Treating it as "no
 * intervention here" would silently drop it — the thing this module exists to
 * prevent. The contract agrees: `CEEOptionV3.interventions` is
 * `Record<string, CEEInterventionV3>`, so every key is a target by definition.
 *
 * Callers that must ignore keys for a DIFFERENT reason — a stale target that is
 * no longer on the canvas, or an option targeting itself — filter
 * `unusableTargets` themselves. Those are separate failures with their own
 * handling, and folding them in here would blur two distinct diagnoses.
 *
 * Non-object input yields two empty halves, matching the historical
 * `flattenInterventions` guard exactly.
 */
export function partitionInterventions(raw: unknown): InterventionPartition {
  const usable: Record<string, number> = {}
  const unusableTargets: string[] = []
  if (!raw || typeof raw !== 'object') return { usable, unusableTargets }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const numeric = interventionNumericValue(value)
    if (numeric !== null) usable[key] = numeric
    else unusableTargets.push(key)
  }
  return { usable, unusableTargets }
}

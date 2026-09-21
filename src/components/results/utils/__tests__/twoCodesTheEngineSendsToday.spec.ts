/**
 * ⭐⭐ TWO CODES THE ENGINE SENDS TODAY, RENDERED AS ONE SENTENCE THAT SAYS
 * NOTHING — TWICE, ON ONE SCREEN.
 *
 * ── THE DEFECT, WITNESSED LIVE ─────────────────────────────────────────────
 * Manual testing on 21 Sep 2026 (debug bundle `olumi-debug-95b92672`) produced
 * a Reasoning tab whose "Model gaps the analysis worked around" group held TWO
 * rows, both reading, verbatim:
 *
 *     "Part of this analysis was limited"
 *
 * The producer had in fact sent two different, specific and useful messages:
 *
 *   EDGE_E_VALUE_NON_FINITE_DROPPED  "... an unflippable edge, whose current
 *     and flip means coincide, has no evidence ratio ... shorter because those
 *     entries could not be represented, not because they were computed empty.
 *     All other analyses are unaffected."
 *
 *   FACTOR_EVPPI_NOT_COMPUTED  "Value-of-information ran but produced no rows.
 *     The reason is not known at this layer and has deliberately not been
 *     inferred."
 *
 * ⭐ THE FALLBACK WAS NOT AT FAULT AND IS NOT CHANGED. Neither code was in
 * `ISL_INFERENCE_WARNING_KINDS`, so both landed on the deliberately
 * claim-nothing generic template — which is that template working exactly as
 * designed. `humaniseCritique.inferenceWarningVocabulary.spec.ts` predicted
 * this in terms: *"the classification map is a cross-repo, cross-language
 * mirror and will drift the day ISL adds code 29."* These are codes 29 and 30,
 * and they arrived precisely as described. The fix is to teach the map, never
 * to loosen the fallback.
 *
 * ⚠ WHY IT MATTERED MORE THAN A TIDINESS POINT. `FACTOR_EVPPI_NOT_COMPUTED` is
 * the EXPLANATION for the empty value-of-information area sitting directly
 * above it on the same screen. The producer said why there were no rows; the
 * panel replaced that with "this version has no wording for it yet" — so the
 * one sentence that answered the reader's question was the one suppressed.
 */
import { describe, it, expect } from 'vitest'
import { humaniseCritique, ISL_INFERENCE_WARNING_KINDS } from '../humaniseCritique'

/** The generic fallback's title. Quoted to detect it, never to assert it. */
const FALLBACK_TITLE = 'Part of this analysis was limited'

/** The defect class this whole module exists to kill. */
const FACTOR_BLAME = /review this factor|this factor'?s inputs|assess this factor|your inputs|check your inputs/i
const UNRESOLVED_LABEL = /This factor/

/**
 * ⭐⭐ THE UNMAPPED CODES, FOUND BY SWEEP RATHER THAN BY SIGHTING.
 *
 * After the two above were caught on one screenshot, all **945 captured debug
 * bundles** were read for `inference_warnings[].code`. Twelve distinct codes are
 * actually emitted in the wild, and `humaniseCritique` was then CALLED for each at
 * pristine `origin/staging` — because a text grep over that file truncates at an
 * inner brace and cannot see its label-aware map, which is how a first pass
 * wrongly scored `CONSTRAINT_TARGET_UNRELIABLE` as unmapped when it has had
 * label-naming copy all along. Derived, THREE had no template, so every run
 * carrying one rendered "Part of this analysis was limited" instead of what the
 * producer said. Fixing the class beats fixing the instance that happened to be
 * screenshotted — the other two would have surfaced as "new" defects later.
 *
 * ⚠ A RECORD, NOT A FIXTURE. These are codes and counts actually observed.
 * APPEND-ONLY: if the producer's vocabulary changes, add a row, never edit one.
 */
const UNMAPPED_UNTIL_2026_09_21 = [
  { code: 'EDGE_E_VALUE_NON_FINITE_DROPPED', kind: 'compute_degradation', occurrences: 30 },
  { code: 'FACTOR_EVPPI_NOT_COMPUTED', kind: 'compute_degradation', occurrences: 6 },
  { code: 'EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE', kind: 'compute_degradation', occurrences: 1 },
] as const

/** The pair witnessed together on one screen, which is where this started. */
const AS_RECEIVED_95B92672 = UNMAPPED_UNTIL_2026_09_21.filter(
  (w) => w.code === 'EDGE_E_VALUE_NON_FINITE_DROPPED' || w.code === 'FACTOR_EVPPI_NOT_COMPUTED',
)

const humanise = (code: string) => humaniseCritique({ code, message: '' } as never)

describe('the two codes the engine sent on 95b92672', () => {
  /**
   * ⛔ THE PRECONDITION. Every assertion below reads a humanised result. If
   * `humaniseCritique` ever stopped returning one, they could all pass on
   * `undefined` and this file would certify nothing.
   */
  it('PRECONDITION: both codes humanise to something', () => {
    for (const { code } of AS_RECEIVED_95B92672) {
      expect(humanise(code)?.title, code).toBeTruthy()
    }
  })

  it.each(AS_RECEIVED_95B92672)('$code is classified, not unmapped', ({ code, kind }) => {
    expect(ISL_INFERENCE_WARNING_KINDS[code]).toBe(kind)
  })

  it.each(AS_RECEIVED_95B92672)('$code no longer renders the generic fallback', ({ code }) => {
    expect(humanise(code).title).not.toBe(FALLBACK_TITLE)
  })

  /**
   * ⛔⛔ THE DEFECT ITSELF, AND THE ONLY ASSERTION THAT WOULD HAVE CAUGHT WHAT
   * PAUL SAW. Both codes resolving to a template is not enough — resolving to
   * the SAME template would reproduce two identical rows exactly as before.
   */
  it('the two rows are DIFFERENT findings, not one sentence twice', () => {
    const a = humanise('EDGE_E_VALUE_NON_FINITE_DROPPED')
    const b = humanise('FACTOR_EVPPI_NOT_COMPUTED')
    expect(a.title).not.toBe(b.title)
    expect(a.description).not.toBe(b.description)
  })

  /**
   * ⛔ IT MUST NOT BORROW A SIBLING'S CAUSE. `FACTOR_EVPPI_UNAVAILABLE` is an
   * estimator FAILURE and honestly prescribes a re-run. This code's producer
   * states the reason is NOT KNOWN, so claiming a failure or promising a retry
   * would be inventing a cause the engine declined to give.
   */
  it('FACTOR_EVPPI_NOT_COMPUTED invents neither a cause nor a retry', () => {
    const { title, description } = humanise('FACTOR_EVPPI_NOT_COMPUTED')
    const text = `${title} ${description}`
    expect(text).not.toMatch(/re-?run|try again|retry/i)
    expect(text).not.toMatch(/failed|failure|error|broke/i)
    // It must still say the step RAN and returned nothing — that is the fact.
    expect(text).toMatch(/ran|completed/i)
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. The EDGE code's producer DOES assert the
   * rest of the analysis stands, so that clause is carried here and must be —
   * without it a reader reads a short evidence list as a dropped computation.
   */
  it('EDGE_E_VALUE_NON_FINITE_DROPPED says the shortfall is not a failure', () => {
    const { title, description } = humanise('EDGE_E_VALUE_NON_FINITE_DROPPED')
    const text = `${title} ${description}`
    expect(text).toMatch(/stands|unaffected/i)
    expect(text).not.toMatch(/failed|failure|error/i)
  })

  it.each(AS_RECEIVED_95B92672)('$code blames no factor and leaks no label', ({ code }) => {
    const { title, description } = humanise(code)
    const text = `${title} ${description}`
    expect(text).not.toMatch(FACTOR_BLAME)
    expect(text).not.toMatch(UNRESOLVED_LABEL)
  })

  it.each(UNMAPPED_UNTIL_2026_09_21)(
    '$code ($occurrences occurrences in 945 bundles) now has real copy',
    ({ code, kind }) => {
      expect(ISL_INFERENCE_WARNING_KINDS[code], `${code} unclassified`).toBe(kind)
      const { title, description } = humanise(code)
      expect(title, `${code} still on the fallback`).not.toBe(FALLBACK_TITLE)
      expect(`${title} ${description}`).not.toMatch(FACTOR_BLAME)
      expect(`${title} ${description}`).not.toMatch(UNRESOLVED_LABEL)
    },
  )

  /**
   * ⛔⛔ ALL FOUR ARE DIFFERENT SENTENCES. Four codes resolving to templates is
   * not the fix if two of them resolve to the SAME template — that reproduces
   * the defect with extra steps.
   */
  it('all three are distinct findings', () => {
    const titles = UNMAPPED_UNTIL_2026_09_21.map((w) => humanise(w.code).title)
    expect(new Set(titles).size).toBe(UNMAPPED_UNTIL_2026_09_21.length)
  })

  /**
   * ⛔⛔ THE CONTRAST CONTROL, AND IT IS THE POINT OF THE WHOLE CHANGE. Teaching
   * the map two codes must NOT widen the fallback. A code nobody has heard of
   * must still land on the honest claim-nothing sentence — property (4) of the
   * vocabulary spec, which is the protection that actually matters, because it
   * is the one that covers code 31.
   */
  it('CONTRAST: an unknown code still gets the honest fallback', () => {
    expect(humanise('SOME_CODE_ISL_HAS_NOT_WRITTEN_YET').title).toBe(FALLBACK_TITLE)
    expect(ISL_INFERENCE_WARNING_KINDS['SOME_CODE_ISL_HAS_NOT_WRITTEN_YET']).toBeUndefined()
  })
})

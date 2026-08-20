/**
 * The ISL inference-warning vocabulary: honest copy BY KIND.
 *
 * WHAT THIS PINS AND WHY IT IS SHAPED THIS WAY.
 *
 * ISL emits `inference_warnings` with a bare `str` code — there is no registry
 * for the vocabulary anywhere in ISL (a registry sweep reads zero). The 28
 * codes were enumerated by an AST walk over every `InferenceWarning(...)`
 * construction site at ISL `staging` 28fe0c95 (14 literal sites + 4 dynamic
 * sites resolved: `_optional_phase_unavailable_warning` -> 5 codes, the two
 * `refuse()` closures -> 3 further codes, and `resolve_range_fits` ->
 * the 7-member closed `RangeFitRefusalCode` Literal). 26 of the 28 reach the
 * UI; PLoT drops the other two at `run.ts:3759`, which requires a derivable
 * message, and `STRENGTH_MEAN_CLAMPED` / `EXISTS_PROBABILITY_DEFAULT` carry
 * neither `detail.message` nor `detail.reason`.
 *
 * ⭐ EVERY ASSERTION BINDS BY CODE, NEVER BY THE PROSE BEING REPLACED.
 * A test that pins the exact sentence a fix just wrote is vacuous the moment
 * anyone rewords it, and it certifies nothing about honesty. So the pins here
 * are PROPERTIES over the code -> kind classification:
 *   1. completeness  — every classified code resolves to a template, not the
 *                      generic fallback;
 *   2. no factor-blame on compute degradation — the actual defect being fixed;
 *   3. no `${label}` leakage — the payload carries no node identity for ANY of
 *      these codes, so "This factor" is a category error here;
 *   4. the FALLBACK itself is honest — which is the LOAD-BEARING protection,
 *      because the classification map is a cross-repo, cross-language mirror
 *      and will drift the day ISL adds code 29.
 *
 * ⚠ THE HONEST LIMIT OF (1). A guard derived from the map proves the map and
 * the templates AGREE. It can never prove the map is COMPLETE — nothing in
 * this repo can see an ISL code that was added after this file was written.
 * That is exactly why (4) exists and why (4), not (1), is the protection that
 * matters: a code we have never heard of must still land on true copy.
 */
import { describe, it, expect } from 'vitest'
import {
  humaniseCritique,
  ISL_INFERENCE_WARNING_KINDS,
  type InferenceWarningKind,
} from '../humaniseCritique'

/**
 * The defect this lane exists to kill: copy that blames the user's factor
 * inputs. Deliberately a SHAPE, not a sentence — rewording the fallback must
 * not make this guard stop biting.
 */
const FACTOR_BLAME = /review this factor|this factor'?s inputs|assess this factor|your inputs|check your inputs/i

/** `resolveFactorLabel`'s no-identity fallback. Leaking it is a category error
 *  for this vocabulary, because PLoT forwards no `affected_nodes` at all. */
const UNRESOLVED_LABEL = /This factor/

function humaniseCode(code: string) {
  return humaniseCritique({ code, message: '' } as never)
}

const CODES = Object.keys(ISL_INFERENCE_WARNING_KINDS).sort()

function codesOfKind(kind: InferenceWarningKind): string[] {
  return CODES.filter((c) => ISL_INFERENCE_WARNING_KINDS[c] === kind)
}

describe('ISL inference-warning vocabulary — the derived code set', () => {
  it('classifies exactly the 26 codes that reach the UI', () => {
    // Pinned as a COUNT plus a spot-check of one member per kind. The count is
    // the AST-derived 28 minus the two PLoT drops; if ISL grows the vocabulary
    // this number is expected to change deliberately, with the map.
    expect(CODES).toHaveLength(26)
    expect(CODES).toContain('E_VALUES_UNAVAILABLE')
    expect(CODES).toContain('RANGE_OPEN_ENDED')
    expect(CODES).toContain('ROOT_NODE_DEFAULT_VALUE')
  })

  it('does NOT classify the two codes PLoT drops for lacking a message', () => {
    // run.ts:3759 requires w.message ?? detail.message ?? detail.reason.
    // Both of these carry only structured numerics, so they never arrive.
    expect(CODES).not.toContain('STRENGTH_MEAN_CLAMPED')
    expect(CODES).not.toContain('EXISTS_PROBABILITY_DEFAULT')
  })
})

describe('ISL inference-warning vocabulary — completeness (agreement, not completeness)', () => {
  it.each(CODES)('%s resolves to a template, not the generic fallback', (code) => {
    const generic = humaniseCode('__DEFINITELY_NOT_A_REAL_CODE__')
    const result = humaniseCode(code)
    expect(result.title).not.toBe(generic.title)
    expect(result.title.length).toBeGreaterThan(0)
  })
})

describe('ISL inference-warning vocabulary — honesty by kind', () => {
  it.each(CODES)('%s never blames the user’s factor inputs', (code) => {
    const { title, description } = humaniseCode(code)
    expect(title).not.toMatch(FACTOR_BLAME)
    expect(description).not.toMatch(FACTOR_BLAME)
  })

  it.each(CODES)('%s never leaks the unresolved "This factor" label', (code) => {
    // PLoT forwards no affected_nodes for ANY inference warning, so every
    // template here must ignore the resolved label entirely.
    const { title, description } = humaniseCode(code)
    expect(title).not.toMatch(UNRESOLVED_LABEL)
    expect(description).not.toMatch(UNRESOLVED_LABEL)
  })

  it.each(codesOfKind('compute_degradation'))(
    '%s (compute degradation) does not prescribe an input change',
    (code) => {
      // THE ACTIVE LIE BEING FIXED. These fire when a phase ran out of budget
      // or its estimator failed. Telling the user to change their inputs is
      // both false about the cause and futile as an action.
      const { title } = humaniseCode(code)
      expect(title).not.toMatch(/\b(add|set|state|restate|record|correct)\b[^.]*\b(value|values|range|bound|bounds|input|inputs)\b/i)
    },
  )

  it.each(codesOfKind('compute_degradation'))(
    '%s (compute degradation) says the rest of the result still stands',
    (code) => {
      // The producer says so at every one of these sites ("Base analysis is
      // unaffected"), and a caveat that does not say it reads as "your whole
      // result is suspect" — overstating the limitation is as dishonest as
      // understating it.
      const { title } = humaniseCode(code)
      expect(title).toMatch(/results? (stand|are unaffected)|ranked correctly/i)
    },
  )

  it.each(codesOfKind('model_shape'))(
    '%s (model shape) carries a route the user can actually take',
    (code) => {
      const { title } = humaniseCode(code)
      expect(title).toMatch(/\b(state|restate|add|connect|give|record|move|try)\b/i)
    },
  )

  it.each(CODES.filter((c) => c.startsWith('RANGE_')))(
    '%s says the confirmed value is still used (compute was untouched)',
    (code) => {
      // models/range_fit.py: "A refusal always means: the value stays disclosed
      // as confirmed, NO distribution is produced, compute is untouched."
      // Without this the user reads a range refusal as a broken analysis.
      const { title } = humaniseCode(code)
      expect(title).toMatch(/still used/i)
    },
  )
})

describe('the generic fallback — the load-bearing protection', () => {
  const UNKNOWN = '__A_CODE_THIS_BUILD_HAS_NEVER_SEEN__'

  it('is not factor-framed', () => {
    // This is what stops the defect recurring when ISL adds code 29: the map
    // cannot know about it, but the fallback still has to be TRUE of it.
    const { title, description } = humaniseCritique({ code: UNKNOWN, message: '' } as never)
    expect(title).not.toMatch(FACTOR_BLAME)
    expect(description).not.toMatch(FACTOR_BLAME)
  })

  it('does not prescribe an action it cannot know is warranted', () => {
    const { title } = humaniseCritique({ code: UNKNOWN, message: '' } as never)
    expect(title).not.toMatch(/\b(add|set|state|restate|record|correct|review)\b/i)
  })

  it('still refuses to echo the producer message', () => {
    const leaky = 'root node ‘fac_customer_churn’ observed_state.value intercept=0'
    const { title, description } = humaniseCritique({ code: UNKNOWN, message: leaky } as never)
    expect(title).not.toContain('fac_customer_churn')
    expect(description).not.toContain('fac_customer_churn')
    expect(title).not.toContain('observed_state')
  })
})

/**
 * A PRODUCER PLACEHOLDER IS NOT EVIDENCE — AND TREATING IT AS EVIDENCE WAS
 * WITHHOLDING A BIAS WARNING FROM EXACTLY THE FACTORS IT EXISTS TO CATCH.
 *
 * ⭐ THE DEFECT. CEE sends `uncertainty_drivers: ['Not provided']` on factors it
 * has no evidence for. `PreAnalysisPanel` raises an OVERCONFIDENCE warning for
 * an AI-sourced factor with no supporting evidence — *"X is among the
 * highest-priority factors to review but has no supporting evidence. Validate
 * it before relying on it."* Its test was `!drivers || drivers.length === 0`.
 *
 * A placeholder array has length ONE. So the warning did not fire, on every
 * factor carrying the placeholder. **The product went quiet precisely where it
 * had most to say, and it read as working** — no error, no empty state, just a
 * coaching line that never appeared.
 *
 * The rendered card had the milder twin of the same bug: it printed the word
 * "Not provided" under a heading promising evidence.
 *
 * ⛔ THE REAL FIX IS CEE'S — send `[]` or omit the key, rather than a sentence
 * saying there is nothing. This is the mitigation, and the census below is
 * pinned so that when the producer changes, this suite says so rather than the
 * product silently going quiet again in the other direction.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  meaningfulUncertaintyDrivers,
  isPlaceholderEvidence,
  PLACEHOLDER_EVIDENCE_STRINGS,
} from '../observedStateHelpers'

describe('the placeholder is refused', () => {
  it('treats the measured placeholder as no evidence at all', () => {
    expect(meaningfulUncertaintyDrivers(['Not provided'])).toEqual([])
  })

  it('is case- and whitespace-insensitive, because capitalisation is not a distinction', () => {
    expect(isPlaceholderEvidence('  NOT PROVIDED ')).toBe(true)
    expect(isPlaceholderEvidence('n/a')).toBe(true)
  })

  it('drops empty and non-string entries without throwing', () => {
    expect(meaningfulUncertaintyDrivers(['', '   ', null, 7, undefined])).toEqual([])
    expect(meaningfulUncertaintyDrivers(undefined)).toEqual([])
    expect(meaningfulUncertaintyDrivers('not an array')).toEqual([])
  })
})

describe('⛔ real evidence survives — this is not a keyword filter', () => {
  /**
   * ⭐ THE CASE THAT DECIDES THE IMPLEMENTATION. Two of the nine genuine driver
   * strings in the captures CONTAIN a placeholder word: *"Onboarding complexity
   * unknown"* and *"Actual usage patterns of large accounts unknown"*. A
   * substring test would delete both — silencing real evidence in order to
   * silence a placeholder, which is a worse defect than the one being fixed.
   * Matching is WHOLE-STRING for exactly this reason.
   */
  it('keeps a real driver that contains a placeholder word', () => {
    const real = ['Onboarding complexity unknown', 'Actual usage patterns of large accounts unknown']
    expect(meaningfulUncertaintyDrivers(real)).toEqual(real)
  })

  it('keeps the real drivers and drops only the placeholder from a mixed list', () => {
    expect(meaningfulUncertaintyDrivers(['Not provided', 'Top 10 accounts are 40% of revenue']))
      .toEqual(['Top 10 accounts are 40% of revenue'])
  })
})

/**
 * ⭐⭐ THE CENSUS, DERIVED FROM THE COMMITTED CAPTURES RATHER THAN RESTATED.
 *
 * This is what makes the placeholder list something other than a guess: every
 * assertion below is computed from the starter captures at run time, so it
 * cannot drift from them. If the producer stops sending the placeholder these
 * numbers change and this suite REDs — which is the signal to delete the
 * mitigation, not a failure.
 */
describe('the census that justifies the list', () => {
  const dir = resolve(__dirname, '../../starters/data')
  const allDrivers: string[] = (() => {
    const out: string[] = []
    for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
      let j: Record<string, unknown>
      try { j = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) } catch { continue }
      const nodes = ((j.nodes ?? (j.graph as Record<string, unknown>)?.nodes) ?? []) as Array<Record<string, unknown>>
      for (const n of nodes) {
        const os = n.observed_state as Record<string, unknown> | undefined
        const d = os?.uncertainty_drivers
        if (Array.isArray(d)) out.push(...d.filter((x): x is string => typeof x === 'string'))
      }
    }
    return out
  })()

  it('found drivers at all — or every count below is a blind probe', () => {
    expect(allDrivers.length).toBeGreaterThan(0)
  })

  it('MEASURED: two thirds of all factor "evidence" is the placeholder', () => {
    const placeholders = allDrivers.filter(isPlaceholderEvidence)
    expect(allDrivers.length).toBe(24)
    expect(placeholders.length).toBe(16)
  })

  it('and every genuine driver survives the filter', () => {
    expect(meaningfulUncertaintyDrivers(allDrivers).length).toBe(allDrivers.length - 16)
  })

  /**
   * ⚠ HONEST SCOPE OF THE LIST. Only `'not provided'` has ever been WITNESSED.
   * The other four are the same producer gesture, cost nothing to refuse, and
   * are unwitnessed — recorded here so nobody later reads the set as a census.
   */
  it('records which members are witnessed and which are precautionary', () => {
    const witnessed = new Set(allDrivers.filter(isPlaceholderEvidence).map(s => s.trim().toLowerCase()))
    expect([...witnessed]).toEqual(['not provided'])
    expect(PLACEHOLDER_EVIDENCE_STRINGS.size).toBeGreaterThan(witnessed.size)
  })
})

/**
 * ⭐ ONE PREDICATE, BOTH CONSUMERS — bound at the SOURCE.
 *
 * The card that RENDERS drivers and the check that COUNTS them must not be able
 * to disagree about what a driver is. If they diverge the failure is invisible:
 * a card showing a bullet while the coaching beside it says there is no
 * evidence. That is two answers to one question (trap 21), and it is exactly
 * how this defect existed in the first place — one test, written for a shape
 * the producer does not send.
 */
/**
 * ⛔⛔ THERE ARE FIVE CONSUMERS, NOT TWO, AND SAYING "BOTH" IS WHAT LET THREE SHIP
 * BROKEN.
 *
 * The first version of this fix wired the factor card and the pre-analysis
 * overconfidence check and called that "one predicate, both consumers". A
 * witness on the SERVED build then found "Not provided" still painted once, and
 * a proper sweep found three more readers — including `useScienceIcons`, which
 * carried the SAME `!drivers || length === 0` gate the placeholder defeats, so
 * a second coaching signal was suppressed on exactly the factors it targets.
 *
 * This list is derived by NAME here so the next reader cannot repeat the
 * mistake by counting from memory. If a sixth consumer appears it must be added
 * — and the honest way to find one is `grep uncertainty_drivers`, not recall.
 */
const DRIVER_CONSUMERS: Array<[string, string]> = [
  ['../../nodes/FactorNode.tsx', 'meaningfulUncertaintyDrivers(observedState?.uncertainty_drivers)'],
  ['../../components/pre-analysis/PreAnalysisPanel.tsx', 'meaningfulUncertaintyDrivers(os?.uncertainty_drivers)'],
  ['../../hooks/useScienceIcons.ts', 'meaningfulUncertaintyDrivers(observedState?.uncertainty_drivers)'],
  ['../../ui/inspector-v2/panels/FactorControllablePanel.tsx', 'meaningfulUncertaintyDrivers('],
  ['../../components/pre-analysis/AllImprovements.tsx', 'meaningfulUncertaintyDrivers(item.uncertaintyDrivers)'],
]

describe('every consumer asks the same question — all five', () => {
  const readRaw = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

  it.each(DRIVER_CONSUMERS)('%s routes through the shared predicate', (rel, needle) => {
    expect(readRaw(rel)).toContain(needle)
  })

  /**
   * ⭐ AND THE GATES SPECIFICALLY. Two surfaces do not render drivers, they
   * COUNT them — and a length-zero test against a raw array is the exact defect
   * the placeholder defeats. Neither may test the raw field again.
   */
  it.each([
    ['../../components/pre-analysis/PreAnalysisPanel.tsx'],
    ['../../hooks/useScienceIcons.ts'],
  ])('%s no longer length-tests a raw drivers array', (rel) => {
    const code = readRaw(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/!\s*drivers\s*\|\|\s*drivers\.length === 0/)
    expect(code).not.toMatch(/!\s*uncertaintyDrivers\s*\|\|\s*uncertaintyDrivers\.length === 0/)
  })
})

describe('both consumers ask the same question', () => {
  /**
   * ⚠ COMMENTS ARE STRIPPED BEFORE THE NEGATIVE ASSERTIONS, AND THE FIRST
   * VERSION OF THIS SPEC FAILED BECAUSE THEY WERE NOT.
   *
   * The `not.toContain` checks below ask *"does the CODE still do this?"*. Read
   * against the raw file they also match any comment QUOTING the old test —
   * and the fix's own comment quotes it, deliberately, so the next reader knows
   * what changed. So the naive version reported the defect as still present in
   * a file where it had just been removed: a FALSE RED whose only cause was
   * prose. Left in place as a lesson rather than deleted, because the inverse —
   * a comment that makes a real defect invisible to a source assertion — is the
   * same mechanism pointing the other way.
   */
  const read = (p: string) => {
    const raw = readFileSync(resolve(__dirname, p), 'utf8')
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // Precondition: stripping must not have eaten the file (trap 13 — a probe
    // over an empty string agrees with everything).
    expect(stripped.length).toBeGreaterThan(raw.length / 3)
    return stripped
  }

  it('the factor card filters through the shared predicate', () => {
    const src = read('../../nodes/FactorNode.tsx')
    expect(src).toContain('meaningfulUncertaintyDrivers(observedState?.uncertainty_drivers)')
    /**
     * ⛔ THE NEGATIVE HALF OF THIS ASSERTION HAS BEEN DELETED, AND A MUTANT IS
     * WHY. It read `expect(src).not.toContain('observedState.uncertainty_drivers.map(')`.
     * A mutant re-introduced the raw read as `...uncertainty_drivers.map && (`
     * and SURVIVED — the assertion was bound to a punctuation mark rather than
     * to a behaviour, so any respelling of the defect walked past it, green.
     *
     * It is not replaced by a cleverer string. The behaviour is now pinned at
     * the DOM by `FactorNode.placeholderDrivers.spec.tsx`, which asks the only
     * question that matters: does a user read the word "Not provided" under a
     * heading that says Uncertainty drivers? That mutant now bites there.
     *
     * The POSITIVE assertion above stays: it binds the card to the shared
     * predicate, which is what stops the two consumers drifting apart.
     */
  })

  it('the overconfidence check counts through the shared predicate', () => {
    const src = read('../../components/pre-analysis/PreAnalysisPanel.tsx')
    expect(src).toContain('meaningfulUncertaintyDrivers(os?.uncertainty_drivers)')
    // The old length-zero-on-raw test must be gone, or the warning stays suppressed.
    expect(src).not.toContain('!drivers || drivers.length === 0')
  })
})

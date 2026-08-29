/**
 * THE LIST AND THE STRING CANNOT DISAGREE.
 *
 * `deriveReadinessDisplay` is "the one owner" of this verdict — the pre-analysis
 * footer AND `AnalysisReadinessBar` both call it. So the array that renders as a
 * list and the string that renders in the bar and the Analyse tooltip come from
 * ONE derivation in ONE call.
 *
 * ⚠ THE SUBTLETY THAT MAKES THIS MORE THAN A PASS-THROUGH. `gateBlockedSubline`
 * runs `vetBlockedReason`, which does not merely accept or reject — it can
 * SUBSTITUTE a UI-composed fallback for the producer's text. Handing the array
 * through blindly would then render the fallback in the bar and the producer's
 * sentences in the footer: two surfaces telling different stories about one
 * state, which is the defect this seam exists to end.
 *
 * ── WHAT CHANGED, AND WHY THE OLD INVARIANT HAD TO GO ──────────────────────
 * This file used to assert ONE equality — `sentences.join(' ') === subline` —
 * and read it as the answer to everything. It was answering TWO questions at
 * once, and they came apart in production: the gate appends a generated
 * `" (+N more issues)"` to `reason` as soon as a second blocker exists, so on a
 * model with a validation error AND missing option values the equality failed
 * and the whole blocker list was dropped. The user was told there was a problem
 * and not told what to supply. (`blockerListSurvivesSummary.spec.ts` pins that
 * case end to end, from the real gate.)
 *
 * The two questions are now asked separately, and this file asserts both:
 *   1. PROVENANCE — the listing's PUBLISHED summary is the very `blockedReason`
 *      being rendered beside it. Bytes from the producer, never a regex over
 *      user-visible prose.
 *   2. VET INTEGRITY — per sentence. An in-place glossary substitution is a
 *      legitimate pass and the substituted text is what renders; a DEGRADE to
 *      the non-committal fallback withholds the WHOLE list, never a subset.
 *
 * The join-equality still holds in the single-reason case, and is asserted as
 * such — it is a CONSEQUENCE now, not the rule.
 */
import { describe, it, expect } from 'vitest'
import { deriveReadinessDisplay } from '../readinessDisplay'
import { BLOCKED_REASON_FALLBACK, vetBlockedReason } from '../../../../utils/vetBlockedReason'
import { BLOCKED_REASON_COPY } from '../../../../utils/composeBlockedReason'

const REAL = [
  'Choose the missing effect value for "keep what we have" on "Current CRM Capability Gap".',
  'Choose the missing effect value for "migrate to Salesforce instead" on "Salesforce Switching Cost".',
]

const shutGate = (sentences?: readonly string[], reason?: string) =>
  deriveReadinessDisplay({
    readinessCheck: null,
    isAnalysing: false,
    canRun: false,
    blockedReason: reason ?? sentences?.join(' '),
    // The listing always states ITS OWN summary — the sentences' join. Passing
    // a different `reason` is therefore a genuine provenance mismatch, which is
    // exactly what the withholding cases below need to exercise.
    blockedListing:
      sentences === undefined ? undefined : { summary: sentences.join(' '), sentences },
    nothingHasAnswered: false,
    resting: { dot: 'success', headline: 'x', subline: '' },
  })

describe('deriveReadinessDisplay — producer sentences survive as a list', () => {
  it('PRECONDITION: the fixture is multi-sentence, so a join defect is observable', () => {
    expect(REAL.length).toBeGreaterThan(1)
    expect(REAL.join(' ')).toContain('. ')
  })

  it('carries the sentences when the listing summary IS the reason beside it', () => {
    expect(shutGate(REAL).sublineSentences).toEqual(REAL)
  })

  it('THE SINGLE-REASON CONSEQUENCE: subline is exactly the sentences’ join', () => {
    // True whenever the gate composed no `(+N more issues)` suffix — i.e. one
    // blocking reason. Asserted as a consequence of provenance, not as the rule.
    const d = shutGate(REAL)
    expect(d.sublineSentences).toBeDefined()
    expect(d.sublineSentences!.join(' ')).toBe(d.subline)
  })

  it('WITHHOLDS the list when the string and the listing disagree — a mismatch is never trusted', () => {
    const d = shutGate(REAL, 'A completely different sentence.')
    expect(d.sublineSentences).toBeUndefined()
    expect(d.subline).not.toBe(REAL.join(' '))
  })

  it('WITHHOLDS the list whenever the vet DEGRADED a sentence — never UI copy beside producer bullets', () => {
    const unsafe = BLOCKED_REASON_COPY.canonicalOneBlocker('graph')
    // PIN THE PRECONDITION IN-TEST: if this fixture stopped degrading, the case
    // below would pass while guarding nothing.
    expect(vetBlockedReason(unsafe)).toBe(BLOCKED_REASON_FALLBACK)
    expect(shutGate([unsafe, REAL[0]]).sublineSentences).toBeUndefined()
  })

  it('AN IN-PLACE SUBSTITUTION IS A PASS, and the SUBSTITUTED text is what renders', () => {
    // The opposite-direction twin of the case above, and the one the old single
    // equality got wrong: a legitimate glossary swap is not a reason to withhold
    // a whole list. It IS a reason never to render the raw bytes.
    const raw = 'Edge from "Speed" to "Revenue" has no effect direction'
    const vetted = vetBlockedReason(raw)
    expect(vetted).not.toBe(raw)
    expect(vetted).not.toBe(BLOCKED_REASON_FALLBACK)
    expect(shutGate([raw, REAL[0]]).sublineSentences).toEqual([vetted, REAL[0]])
  })

  it('THE ONE-BLOCKER TWIN: one sentence carries as one item', () => {
    const d = shutGate([REAL[0]])
    expect(d.sublineSentences).toEqual([REAL[0]])
    expect(d.sublineSentences!.join(' ')).toBe(d.subline)
  })

  it('no listing supplied → no list, and the string is unchanged from today', () => {
    const d = shutGate(undefined, REAL.join(' '))
    expect(d.sublineSentences).toBeUndefined()
    expect(d.subline).toBe(REAL.join(' '))
  })

  it('an OPEN gate carries no sentences — this is the blocked arm only', () => {
    const d = deriveReadinessDisplay({
      readinessCheck: null, isAnalysing: false, canRun: true,
      nothingHasAnswered: false,
      resting: { dot: 'success', headline: 'Ready', subline: 'all set' },
    })
    expect(d.sublineSentences).toBeUndefined()
  })
})

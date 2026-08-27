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
 * So the list is used ONLY when the vetted string is byte-identical to the
 * list's own join. Byte-identity is ENFORCED AT THE POINT OF USE, never assumed.
 */
import { describe, it, expect } from 'vitest'
import { deriveReadinessDisplay } from '../readinessDisplay'

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
    blockedSentences: sentences,
    nothingHasAnswered: false,
    resting: { dot: 'success', headline: 'x', subline: '' },
  })

describe('deriveReadinessDisplay — producer sentences survive as a list', () => {
  it('PRECONDITION: the fixture is multi-sentence, so a join defect is observable', () => {
    expect(REAL.length).toBeGreaterThan(1)
    expect(REAL.join(' ')).toContain('. ')
  })

  it('carries the sentences when the vetted string IS their join', () => {
    expect(shutGate(REAL).sublineSentences).toEqual(REAL)
  })

  it('THE INVARIANT: whenever sentences are present, subline is exactly their join', () => {
    const d = shutGate(REAL)
    expect(d.sublineSentences).toBeDefined()
    expect(d.sublineSentences!.join(' ')).toBe(d.subline)
  })

  it('WITHHOLDS the list when the string and the array disagree — a mismatch is never trusted', () => {
    const d = shutGate(REAL, 'A completely different sentence.')
    expect(d.sublineSentences).toBeUndefined()
    expect(d.subline).not.toBe(REAL.join(' '))
  })

  it('WITHHOLDS the list whenever the vet SUBSTITUTED — never UI copy beside producer bullets', () => {
    const unsafe = ['The graph is fine.', 'Nothing to do.']
    const d = shutGate(unsafe)
    if (d.subline !== unsafe.join(' ')) expect(d.sublineSentences).toBeUndefined()
    if (d.sublineSentences) expect(d.sublineSentences.join(' ')).toBe(d.subline)
  })

  it('THE ONE-BLOCKER TWIN: one sentence carries as one item', () => {
    const d = shutGate([REAL[0]])
    expect(d.sublineSentences).toEqual([REAL[0]])
    expect(d.sublineSentences!.join(' ')).toBe(d.subline)
  })

  it('no sentences supplied → no list, and the string is unchanged from today', () => {
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

/**
 * `draftStreamInFlight` — may the user still stop this draft? (ROADMAP 2.134)
 *
 * Kept in its own file so #525's `draftStreamOwnership.spec.ts` stays byte-for-
 * byte unchanged: this slice adds a CALLER of the abort machinery, and the
 * evidence for that is worth more if none of the machinery's own suites moved.
 *
 * Enumerated over the whole union for the reason the M15/M16 survivors taught:
 * a phase predicate expressed as a two-clause boolean at a call site is a
 * predicate no test can see, and a mutant that drops a clause survives.
 */
import { describe, it, expect } from 'vitest'

import { draftStreamInFlight, draftValuesAreUnsettled, type DraftStreamPhase } from '../draftStore'

const ALL_PHASES: readonly DraftStreamPhase[] = ['idle', 'drafting', 'settling', 'unsettled']

describe('draftStreamInFlight — exhaustive over the union', () => {
  it('classifies every phase, via a compiler-checked switch', () => {
    // Adding a phase to DraftStreamPhase without classifying it is a TS error in
    // the implementation's own switch, so this table cannot silently go stale.
    const expected: Record<DraftStreamPhase, boolean> = {
      idle: false,
      drafting: true,
      settling: true,
      unsettled: false,
    }
    for (const phase of ALL_PHASES) {
      expect(draftStreamInFlight(phase)).toBe(expected[phase])
    }
  })

  it('`settling` is in flight — the turn runs on for ~25 s after the graph lands', () => {
    // The window the live measurement caught a tester in: the model is visible,
    // the wait reads as vestigial, and Stop is exactly what they reach for. It is
    // also the only window in which an abort has a structure to keep and mark.
    expect(draftStreamInFlight('settling')).toBe(true)
  })

  it('`unsettled` is NOT in flight — it is the state a stop PRODUCES', () => {
    // Offering Stop here would be a control over nothing: drafting has already
    // ended, the structure is already marked, and the gate is already shut.
    expect(draftStreamInFlight('unsettled')).toBe(false)
  })

  it('is deliberately NOT the complement of `draftValuesAreUnsettled`', () => {
    // The two predicates answer different questions, and the table below is the
    // whole reason neither may be expressed in terms of the other:
    //
    //   phase      | inFlight | valuesUnsettled
    //   idle       |  false   |  false          ← agree
    //   drafting   |  TRUE    |  false          ← differ
    //   settling   |  TRUE    |  TRUE           ← agree (the load-bearing one)
    //   unsettled  |  false   |  TRUE           ← differ
    //
    // `settling` is BOTH: its numbers are not final (gate shut) and its turn is
    // still running (Stop is honest). `drafting` is in flight with nothing yet
    // to be wrong about; `unsettled` is wrong-about-something with nothing left
    // to stop.
    const agree = ALL_PHASES.filter((p) => draftStreamInFlight(p) === draftValuesAreUnsettled(p))
    expect(agree).toEqual(['idle', 'settling'])
    const differ = ALL_PHASES.filter((p) => draftStreamInFlight(p) !== draftValuesAreUnsettled(p))
    expect(differ).toEqual(['drafting', 'unsettled'])
  })
})

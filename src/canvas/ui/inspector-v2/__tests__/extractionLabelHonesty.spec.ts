/**
 * OLUMI MUST NOT CLAIM AN ESTIMATE IT DID NOT MAKE.
 *
 * ⛔ THE DEFECT, third instance of one shape. `getExtractionLabel`'s DEFAULT ARM
 * IS A CLAIM — `return 'Estimated by Olumi'` — so every source it does not
 * literally list prints the machine claiming authorship of a number. This file's
 * own header already records two rounds of exactly that:
 *
 *   · `getExtractionLabel('user_confirmed')` returned "Estimated by Olumi" —
 *     "the machine claiming a number the user had explicitly confirmed"
 *   · `getExtractionLabel('panel_elicited')` returned "Estimated by Olumi" —
 *     "The machine claiming authorship of a named colleague's number, on three
 *     unflagged inspector panels. That is the SAME defect this file's header
 *     records for `user_confirmed`, reintroduced by the very slice written to
 *     end it."
 *
 * ROADMAP 2.638 S2 closed the USER-OWNED kinds via `ATTRIBUTED_LABEL`, but left
 * `brief: null` so "producer kinds keep each function's own pre-existing copy".
 * That copy lists only `brief_extraction`. `valueProvenance.ts:154` classifies
 * `explicit` as kind `brief`, and `:143` calls `brief_extraction`/`explicit`
 * alike "extraction from the user's brief" — so a value the USER STATED IN THEIR
 * BRIEF falls through to the default and is labelled as Olumi's estimate.
 *
 * And `!source` — a factor carrying NO NUMBER AT ALL — returns "Estimated by
 * Olumi" too: an estimate claimed over nothing, while the honest sibling
 * `getProvenanceLabel` returns 'No evidence yet' for the identical input.
 *
 * ⭐ THE STRUCTURAL HALF, which is why this is not a two-line copy patch: a
 * default arm that ASSERTS will keep producing this defect every time a new
 * source is added upstream, which is precisely how it recurred twice. The
 * default must be honest, so the failure mode of an unlisted source is silence
 * rather than a false claim.
 *
 * ⚠ NON-VACUITY, deliberately pinned below: "Estimated by Olumi" must STILL be
 * returned when Olumi genuinely did infer the value. A test that merely proved
 * the string had been deleted everywhere would pass while destroying the honest
 * disclosure this surface exists to make.
 *
 * Renders on THREE deployed-mounted, unflagged panels — `FactorExternalPanel`
 * :304, `FactorObservablePanel` :235, `FactorControllablePanel` :612, all behind
 * `InspectorModal.tsx:17 const USE_INSPECTOR_V2 = true` (a module literal, no
 * env flag).
 */
import { describe, it, expect } from 'vitest'
import { getExtractionLabel, getProvenanceLabel } from '../inspectorStrings'

const CLAIM = 'Estimated by Olumi'

describe('getExtractionLabel never claims an estimate Olumi did not make', () => {
  it('⛔ NO VALUE AT ALL must not be labelled as an estimate', () => {
    expect(getExtractionLabel(undefined)).not.toBe(CLAIM)
    // It must agree with its honest sibling over the identical input, rather
    // than inventing a third answer for "nothing is known".
    expect(getExtractionLabel(undefined)).toBe(getProvenanceLabel(undefined))
    expect(getExtractionLabel(undefined)).toBe('No evidence yet')
  })

  it('⛔ a value the USER STATED in their brief is theirs, not Olumi\'s', () => {
    // valueProvenance.ts:154 — `explicit: 'brief'`; :143 — "`brief_extraction`/
    // `explicit` — extraction from the user's brief". BADGE_TOOLTIPS.explicit
    // says "This value was stated in your decision brief".
    expect(getExtractionLabel('explicit')).not.toBe(CLAIM)
    expect(getExtractionLabel('explicit')).toBe('From your brief')
  })

  it('⛔ an UNLISTED source must not fall through to a claim — the structural fix', () => {
    // The shape that produced this defect twice already. Any source added
    // upstream and not listed here must fail SILENT, never ASSERTIVE.
    for (const unlisted of ['some_future_source', 'panel_elicited_v2', 'human_override']) {
      expect(getExtractionLabel(unlisted)).not.toBe(CLAIM)
    }
  })

  it('CONTRAST CONTROL — brief_extraction already worked and must keep working', () => {
    expect(getExtractionLabel('brief_extraction')).toBe('From your brief')
  })

  it('⚠ NON-VACUITY — the claim MUST survive where Olumi genuinely inferred', () => {
    // If this ever fails, the fix has deleted an honest disclosure rather than
    // removing a false one. `InterventionRow.tsx:28` pins this pairing too.
    expect(getExtractionLabel('cee_inference')).toBe(CLAIM)
    expect(getExtractionLabel('inferred')).toBe(CLAIM)
  })

  it('the user-owned arm closed by ROADMAP 2.638 S2 is not regressed', () => {
    // These were the first two instances of this defect; they must stay fixed.
    expect(getExtractionLabel('user_confirmed')).not.toBe(CLAIM)
    expect(getExtractionLabel('panel_elicited')).not.toBe(CLAIM)
  })
})

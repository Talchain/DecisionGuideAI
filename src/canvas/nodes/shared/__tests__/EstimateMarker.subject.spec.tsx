/**
 * ⭐⭐ ONE GLYPH, TWO DIFFERENT OBJECTS — AND THEY MUST STAY NAMED APART.
 *
 * Paul, 31 Aug 2026: "`est.` is on almost every node and explains nothing. It
 * is the most repeated word on the canvas and it is an abbreviation nobody
 * asked for."
 *
 * The marker has three call sites and they do NOT mark the same thing:
 *
 *   · `FactorNode`            → the factor's OWN VALUE is inferred.
 *   · `RiskNode` / `OutcomeNode` → the BRIDGE WEIGHT is unconfirmed — a
 *                               property of the connection to the goal, not of
 *                               the card the glyph is drawn on.
 *
 * ⛔ THE FIX THAT WOULD HAVE BEEN WRONG. The tempting reading of "est. explains
 * nothing" is to merge the three into one clearer sentence. That is this
 * estate's signature defect (CLAUDE.md trap 21 — one name, two questions):
 * aligning two things that answer different questions makes the shared answer
 * false for both. On a risk card the unconfirmed thing is not even the number
 * nearest the marker. So the glyph stays one glyph and the HOVER TEXT learns
 * the distinction.
 *
 * ⚠ WHAT IS DELIBERATELY NOT TESTED HERE: that the visible token changed. It
 * did not, and must not — `lodMetric.riskOutcome.spec.tsx` pins
 * `'Strength 50% est.'` byte-for-byte at low zoom, and the caption column is
 * content-sized on a 230px card. The rendered-token assertion below is a
 * REGRESSION guard, not a description of the change.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EstimateMarker } from '../EstimateMarker'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../../domain/vocabulary'

const title = () => screen.getByTestId('estimate-marker').getAttribute('title') ?? ''

describe('EstimateMarker — the two objects are named apart', () => {
  it('the visible token is unchanged — `est.`, and nothing longer', () => {
    // Pins the constraint the low-zoom ladder and the card width impose. A
    // "clearer" word here breaks a byte-exact spec one module over.
    render(<EstimateMarker />)
    expect(screen.getByTestId('estimate-marker').textContent).toBe('est.')
  })

  it('the VALUE subject speaks about the value', () => {
    render(<EstimateMarker subject="value" />)
    expect(title()).toContain('this value')
    expect(title()).not.toContain('connection')
  })

  it('the STRENGTH subject speaks about the connection, not the card', () => {
    render(<EstimateMarker subject="strength" />)
    expect(title()).toContain('strength of this connection')
  })

  it('⭐ THE DISCRIMINATING PAIR: the two subjects say DIFFERENT things', () => {
    // The assertion that makes this file worth having. Each test above would
    // pass against a single hardcoded sentence containing both phrases; only
    // comparing the two outputs proves the prop is READ. If a later hand
    // merges them back under one sentence, this REDs and the others may not.
    const a = render(<EstimateMarker subject="value" />)
    const valueTitle = title()
    a.unmount()
    render(<EstimateMarker subject="strength" />)
    const strengthTitle = title()

    expect(valueTitle).not.toBe(strengthTitle)
    // …and both are real sentences, so the inequality is not two blanks.
    expect(valueTitle.length).toBeGreaterThan(30)
    expect(strengthTitle.length).toBeGreaterThan(30)
  })

  it('defaults to the value subject, so an un-passed call site is still true', () => {
    // `FactorNode` calls `<EstimateMarker />` bare and marks its own value.
    // The default must be the arm that is true for it.
    const a = render(<EstimateMarker />)
    const bare = title()
    a.unmount()
    render(<EstimateMarker subject="value" />)
    expect(bare).toBe(title())
  })

  it('both titles are DERIVED from the domain vocabulary, not re-typed', () => {
    // `UNCONFIRMED_ESTIMATE_LABEL` owns the semantics ("nobody has confirmed
    // it" — explicitly NOT a provenance claim). Building both arms from it is
    // what stops the marker drifting into an authorship claim in words.
    for (const subject of ['value', 'strength'] as const) {
      const r = render(<EstimateMarker subject={subject} />)
      expect(title(), `${subject} does not carry the shared label`).toContain(UNCONFIRMED_ESTIMATE_LABEL)
      r.unmount()
    }
    // Precondition pinned: the constant is a real sentence, so `toContain`
    // above is not trivially satisfied by an empty string.
    expect(UNCONFIRMED_ESTIMATE_LABEL.length).toBeGreaterThan(10)
  })

  it('⛔ neither title claims an AUTHOR — `est.` is not a provenance badge', () => {
    // `bridgeIsEstimated` includes "defaulted, with no source at all", so any
    // wording implying Olumi or an AI wrote the number would be a fabrication.
    // This is the guard on the ⛔ ruling in the component header.
    for (const subject of ['value', 'strength'] as const) {
      const r = render(<EstimateMarker subject={subject} />)
      const t = title().toLowerCase()
      expect(t, `${subject} names an author`).not.toMatch(/\bolumi\b/)
      expect(t, `${subject} names an author`).not.toMatch(/\bai\b/)
      expect(t, `${subject} names an author`).not.toMatch(/\bsuggested\b/)
      r.unmount()
    }
  })

  it('an explicit title still wins, for a caller with a genuinely third object', () => {
    render(<EstimateMarker subject="strength" title="Something else entirely" />)
    expect(title()).toBe('Something else entirely')
  })
})

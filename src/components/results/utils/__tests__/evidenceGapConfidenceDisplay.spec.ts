/**
 * F6 — an absent evidence-gap confidence must not be printed as a zero.
 *
 * `useResultsSectionData` mapped `confidence: gap.confidence ?? 0`, and the
 * triage card asserted the result: "This factor has 0% confidence." plus a
 * "No data" pill derived from `confidence <= 0`.
 *
 * Every absence assertion below is paired with a PRESENCE assertion on the
 * same code path (trap 13) — including a presence case for a genuine
 * producer `0`, which is the whole point: a real zero and a missing value
 * must NOT render the same way.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveEvidenceGapConfidenceDisplay,
  evidenceGapGenericText,
  evidenceGapSourcePill,
} from '../evidenceGapConfidenceDisplay'

describe('resolveEvidenceGapConfidenceDisplay', () => {
  it('POSITIVE CONTROL: a real producer value is shown', () => {
    expect(resolveEvidenceGapConfidenceDisplay(35)).toEqual({ show: true, pct: 35 })
  })

  it('a genuine producer ZERO is a value and IS shown', () => {
    expect(resolveEvidenceGapConfidenceDisplay(0)).toEqual({ show: true, pct: 0 })
  })

  it('null / undefined / NaN / Infinity are absences, not zeros', () => {
    expect(resolveEvidenceGapConfidenceDisplay(null)).toEqual({ show: false })
    expect(resolveEvidenceGapConfidenceDisplay(undefined)).toEqual({ show: false })
    expect(resolveEvidenceGapConfidenceDisplay(Number.NaN)).toEqual({ show: false })
    expect(resolveEvidenceGapConfidenceDisplay(Number.POSITIVE_INFINITY)).toEqual({ show: false })
  })
})

describe('evidenceGapGenericText — the sentence F6 was about', () => {
  it('POSITIVE CONTROL: states the figure when there is one', () => {
    const text = evidenceGapGenericText(resolveEvidenceGapConfidenceDisplay(35))
    expect(text).toBe('This factor has 35% confidence. Improving it could change the result.')
  })

  it('DROPS the confidence clause when the producer sent nothing — never prints 0%', () => {
    const text = evidenceGapGenericText(resolveEvidenceGapConfidenceDisplay(null))
    expect(text).not.toContain('0%')
    expect(text).not.toContain('confidence')
    // NON-VACUOUS: the row keeps a real sentence — the gap itself is a genuine
    // producer finding, only the number is missing.
    expect(text).toBe('Improving this factor could change the result.')
  })

  it('a real 0 and a missing value produce DIFFERENT sentences (the whole point)', () => {
    const realZero = evidenceGapGenericText(resolveEvidenceGapConfidenceDisplay(0))
    const missing = evidenceGapGenericText(resolveEvidenceGapConfidenceDisplay(null))
    expect(realZero).toBe('This factor has 0% confidence. Improving it could change the result.')
    expect(realZero).not.toBe(missing)
  })
})

describe('evidenceGapSourcePill — a provenance claim needs a value', () => {
  it('POSITIVE CONTROL: the three bands still resolve', () => {
    expect(evidenceGapSourcePill(resolveEvidenceGapConfidenceDisplay(0))?.label).toBe('No data')
    expect(evidenceGapSourcePill(resolveEvidenceGapConfidenceDisplay(20))?.label).toBe('AI estimate')
    expect(evidenceGapSourcePill(resolveEvidenceGapConfidenceDisplay(75))?.label).toBe('Estimated')
  })

  it('emits NO pill at all when nothing was sent', () => {
    expect(evidenceGapSourcePill(resolveEvidenceGapConfidenceDisplay(null))).toBeNull()
  })

  it('does not reach the "No data" band by way of a fabricated zero', () => {
    // Before F6 a missing value became 0 upstream and landed here as "No data".
    // Near-enough copy, wrong route — and the same fabricated 0 was speaking
    // "0% confidence" one line away.
    expect(evidenceGapSourcePill(resolveEvidenceGapConfidenceDisplay(null))).toBeNull()
    expect(evidenceGapSourcePill(resolveEvidenceGapConfidenceDisplay(0))?.label).toBe('No data')
  })
})

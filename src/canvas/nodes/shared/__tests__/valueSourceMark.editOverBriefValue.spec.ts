/**
 * A4 (PR #2046) — a person's number typed over a BRIEF value must not be
 * credited to the brief while it awaits its receipt.
 *
 * THE DEFECT. The writers (`setObservedValue`, `applyV5State`'s
 * `set_factor_value` path) keep the OLD `source` and withdraw the extraction
 * marker (`extractionType: null`) until the receipt stamps `user_override`.
 * Rule 4 recognised that signature only for an Olumi-kind `source`. Over a
 * `brief_extraction` value, rule 3 ("a brief stamp") matched first, so both
 * the card mark and the inspector pill read "From your brief" over the
 * number the user had just typed — the false-provenance class A4 removes.
 *
 * THE RULE. A withdrawn marker is written only by an edit, so a brief-kind
 * `source` with a withdrawn marker is an edit awaiting its receipt: "no
 * source" on the card, "Your edit — not saved" on the pill — exactly rule 4.
 * An untouched brief value (marker `explicit`, or never written) still reads
 * "From your brief".
 */
import { describe, it, expect } from 'vitest'
import { factorValueSourceMark, factorValueAwaitsReceipt } from '../valueSourceMark'

const untouchedBriefExplicit = () => ({
  observedState: { value: 0.8, source: 'brief_extraction', extractionType: 'explicit' },
})
const untouchedBriefNoMarker = () => ({
  observedState: { value: 0.8, source: 'brief_extraction' },
})
const editedOverBrief = () => ({
  observedState: { value: 0.7, source: 'brief_extraction', extractionType: null },
})
const receiptLanded = () => ({
  observedState: { value: 0.7, source: 'user_override' },
})

describe('an edit over a brief value is not credited to the brief', () => {
  it('CONTRAST: an untouched brief value reads "From your brief" and awaits nothing', () => {
    for (const d of [untouchedBriefExplicit(), untouchedBriefNoMarker()]) {
      expect(factorValueSourceMark(d)?.kind).toBe('brief')
      expect(factorValueAwaitsReceipt(d)).toBe(false)
    }
  })

  it('a person typed over the brief value (marker withdrawn): "no source", awaiting its receipt', () => {
    expect(factorValueSourceMark(editedOverBrief())?.kind).toBe('unknown')
    expect(factorValueAwaitsReceipt(editedOverBrief())).toBe(true)
  })

  it('the same holds after an autosave/restore JSON round trip', () => {
    const restored = JSON.parse(JSON.stringify(editedOverBrief()))
    expect(factorValueSourceMark(restored)?.kind).toBe('unknown')
    expect(factorValueAwaitsReceipt(restored)).toBe(true)
  })

  it('CONTRAST: once the receipt stamps the user, it reads "Set by you" and awaits nothing', () => {
    expect(factorValueSourceMark(receiptLanded())?.kind).toBe('you')
    expect(factorValueAwaitsReceipt(receiptLanded())).toBe(false)
  })
})

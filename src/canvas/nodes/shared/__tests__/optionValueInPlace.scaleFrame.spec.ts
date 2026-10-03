/**
 * Served 29 Sep (MRR `823bc028`, "Referral programme spend": observed £0, no cap, CEE `scale_frame: 500000`): the card
 * read "£24k/year" and its editor opened at "0.048". With CEE's frame as the conversion reference the editor opens in
 * the card's own unit and a typed £ amount is converted by the one raw→model rule.
 */
import { describe, it, expect } from 'vitest'
import { optionValueInPlace } from '../optionValueInPlace'
import { optionEntryScaleOf } from '../../../ui/inspector-v2/shared/optionTargetEntry'

const SERVED = { value: 0.048, unit: '£/year', observedValue: 0, observedRawValue: 0 }

describe('an option value on a factor framed only by CEE’s scale_frame', () => {
  it('opens in the card\'s unit (seed 24,000, "£/year" beside it); "30k" and "£30k" both propose 0.06', () => {
    const e = optionValueInPlace({ ...SERVED, cap: optionEntryScaleOf(undefined, 500000) })!
    expect(e.seedText.replace(/,/g, '')).toBe('24000')
    expect(e.scaleHint).toBe('£/year')
    for (const typed of ['30k', '£30k', '£30,000']) {
      const a = e.admit(typed)
      expect(a, typed).toMatchObject({ ok: true })
      expect((a as { value: number }).value).toBeCloseTo(0.06, 9)
    }
  })

  it('CONTRAST — another currency on a £ row is still refused', () => {
    const e = optionValueInPlace({ ...SERVED, cap: 500000 })!
    expect(e.admit('$30k')).toMatchObject({ ok: false })
  })

  it('CONTRAST — no cap and no frame: the model scale, as before (never a defaulted frame)', () => {
    expect(optionEntryScaleOf(undefined, undefined)).toBeUndefined()
    expect(optionEntryScaleOf(undefined, 0)).toBeUndefined()
    expect(optionValueInPlace({ ...SERVED, cap: undefined })!.seedText).toBe('0.048')
  })

  it("the factor's own cap still wins over the frame", () => {
    expect(optionEntryScaleOf(100000, 500000)).toBe(100000)
  })
})

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

describe('the card editor reads the whole entry, or refuses it (DL 23 Oct: café "£ per customer")', () => {
  const cafe = () => optionValueInPlace({ value: 0.25, unit: '£ per customer', cap: 20, observedValue: 0.25, observedRawValue: 5 })!

  it('".5" proposes £0.50 (0.025), never £5 — RED at fc60b62a (0.25)', () => {
    const a = cafe().admit('.5')
    expect(a).toMatchObject({ ok: true })
    expect((a as { value: number }).value).toBeCloseTo(0.025, 12)
  })

  it('"-£6.80", "6.8junk" and "6.80 EUR" are refused with a sentence — RED at fc60b62a (all admitted)', () => {
    expect(cafe().admit('-£6.80')).toEqual({ ok: false, reason: 'Not saved · must be between £0 / customer and £20 / customer for this factor.' })
    expect(cafe().admit('6.8junk')).toEqual({ ok: false, reason: 'Not saved · not a number this row can read. Enter an amount such as £5 / customer.' })
    expect(cafe().admit('6.80 EUR')).toEqual({ ok: false, reason: 'Not saved · this row is in £ per customer. Enter the amount without another unit.' })
  })

  it('CONTRAST — "£6.80" proposes 0.34', () => {
    const a = cafe().admit('£6.80')
    expect((a as { value: number }).value).toBeCloseTo(0.34, 12)
  })
})

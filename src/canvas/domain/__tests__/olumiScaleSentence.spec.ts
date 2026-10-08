/**
 * The factor line that says OLUMI chose the scale (CEE `observed_state.frame_source: 'olumi_convention'`, #2848).
 * Words approved by Science (CEE #2848, comment 6060704017). The unit corpus is the 15 commonest units on capped factors
 * in stored model versions (shared DB, 10 days to 8 Oct), not units invented for the test.
 */
import { describe, it, expect } from 'vitest'
import { olumiScaleLines, olumiScaleSentence, olumiScaleRangeText } from '../olumiScaleSentence'

const stamped = (cap: number, unit?: string) => ({ value: 0.5, cap, ...(unit !== undefined ? { unit } : {}), frame_source: 'olumi_convention' })

describe('olumiScaleLines: plain line first, the full sentence behind Why?', () => {
  it('the visible line is Science\'s short words verbatim; the why is the approved sentence', () => {
    expect(olumiScaleLines({ label: 'Pro plan price', observedState: stamped(98, '£/month') })).toEqual({
      short: "Sizing scale (Olumi's): £0\u2013£98 a month",
      why: 'Olumi reads \u2018Pro plan price\u2019 on a scale of £0 to £98 a month: a scale for reading sizes, not a forecast or a limit.',
    })
  })
  it.each([
    ['%', 13, "Sizing scale (Olumi's): 0%\u201313%"],
    ['hours/week', 40, "Sizing scale (Olumi's): 0\u201340 hours a week"],
    ['GBP per café per month', 4000, "Sizing scale (Olumi's): GBP 0\u2013GBP 4,000 per café per month"],
  ] as const)('%s → %s', (unit, cap, short) => {
    expect(olumiScaleLines({ label: 'X', observedState: stamped(cap, unit) })?.short).toBe(short)
  })
  it('no stamp → nothing at all', () => {
    expect(olumiScaleLines({ label: 'Pro plan price', observedState: { value: 0.5, cap: 98, unit: '£/month' } })).toBeNull()
  })
})

describe('olumiScaleSentence', () => {
  it('says the approved words verbatim for the approved example', () => {
    expect(olumiScaleSentence({ label: 'Pro plan price', observedState: stamped(98, '£/month') })).toBe(
      'Olumi reads ‘Pro plan price’ on a scale of £0 to £98 a month: a scale for reading sizes, not a forecast or a limit.',
    )
  })

  it('says nothing when Olumi did not choose the scale', () => {
    const { frame_source: _omit, ...unstamped } = stamped(98, '£/month')
    expect(olumiScaleSentence({ label: 'Pro plan price', observedState: unstamped })).toBeNull()
    expect(olumiScaleSentence({ label: 'Pro plan price', observedState: { ...stamped(98, '£/month'), frame_source: 'user_stated' } })).toBeNull()
    expect(olumiScaleSentence({ label: 'Pro plan price', observedState: undefined })).toBeNull()
  })

  it('says nothing it cannot say truthfully', () => {
    for (const cap of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(olumiScaleSentence({ label: 'Churn', observedState: stamped(cap, '%') })).toBeNull()
    }
    expect(olumiScaleSentence({ label: 'Churn', observedState: { frame_source: 'olumi_convention', cap: '13' } })).toBeNull()
    expect(olumiScaleSentence({ label: '   ', observedState: stamped(13, '%') })).toBeNull()
  })
})

describe('olumiScaleRangeText over the stored unit corpus', () => {
  const rows: ReadonlyArray<readonly [string | undefined, number, string]> = [
    ['%', 13, '0% to 13%'],
    ['£/month', 98, '£0 to £98 a month'],
    ['£ per subscriber per month', 98, '£0 to £98 per subscriber per month'],
    ['subscribers', 2000, '0 to 2,000 subscribers'],
    ['customers', 500, '0 to 500 customers'],
    ['GBP/month', 98, 'GBP 0 to GBP 98 a month'],
    ['agents', 40, '0 to 40 agents'],
    ['tickets/month', 600, '0 to 600 tickets a month'],
    ['shops', 12, '0 to 12 shops'],
    ['hires', 6, '0 to 6 hires'],
    ['cafés', 9, '0 to 9 cafés'],
    ['GBP per café per month', 4000, 'GBP 0 to GBP 4,000 per café per month'],
    ['GBP', 200000, 'GBP 0 to GBP 200,000'],
    ['GBP per subscriber per month', 98, 'GBP 0 to GBP 98 per subscriber per month'],
    ['hours/week', 40, '0 to 40 hours a week'],
    [undefined, 98, '0 to 98'],
    ['£', 60000, '£0 to £60,000'],
  ]
  it.each(rows)('%s, cap %d → %s', (unit, cap, want) => {
    expect(olumiScaleRangeText(cap, unit)).toBe(want)
  })

  it('a pathological unit is never read, and fast', () => {
    const ws = ' '.repeat(20000)
    const t0 = performance.now()
    expect(olumiScaleRangeText(98, `£${ws}/${ws}month`)).toBeNull()
    expect(olumiScaleSentence({ label: 'Pro plan price', observedState: stamped(98, `£${ws}/${ws}month`) })).toBeNull()
    expect(performance.now() - t0).toBeLessThan(250)
  })
})

import { describe, expect, it } from 'vitest'
import { readGoalChanceRange } from '../goalChanceRange'
import { readGoalChanceLicence } from '../goalChanceLicence'

const ENTRY = {
  low_pct: 23, high_pct: 90, low_rounding: 'whole', high_rounding: 'nearest_5',
  kind: 'link_strength', from: 'price', to: 'revenue', among: 'all',
}
const RECORD = {
  code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range',
  option_ids: ['starter'], range_by_option: { starter: ENTRY },
}
const LICENCE = {
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
  option_ids: ['a', 'b'], pct_by_option: { a: 62, b: 41 },
  target: { comparator: 'at_least', value: 20000, unit: '£' },
}
const HORIZON = 'This model doesn’t yet say whether any option gets there within 9 months.'

describe('readGoalChanceRange: CEE record identity and shape', () => {
  it('reads the valid record verbatim, including rounding provenance and model order', () => {
    expect(readGoalChanceRange([{ code: 'ANOTHER_RANGE', ...ENTRY }, RECORD])).toEqual({
      optionIds: ['starter'], horizonLine: null,
      rangeByOption: { starter: {
        lowPct: 23, highPct: 90, lowRounding: 'whole', highRounding: 'nearest_5',
        kind: 'link_strength', from: 'price', to: 'revenue', among: 'all',
      } },
    })
  })

  it.each([
    ['null', null], ['not an array', RECORD], ['absent', []], ['duplicate', [RECORD, RECORD]],
    ['wrong code', [{ ...RECORD, code: 'GOAL_CHANCE_LICENSED' }]],
    ['wrong severity', [{ ...RECORD, severity: 'warning' }]],
    ['missing message', [{ ...RECORD, message: undefined }]],
    ['blank message', [{ ...RECORD, message: ' ' }]],
    ['no ids', [{ ...RECORD, option_ids: [] }]],
    ['non-array ids', [{ ...RECORD, option_ids: 'starter' }]],
    ['blank id', [{ ...RECORD, option_ids: [' '] }]],
    ['non-string id', [{ ...RECORD, option_ids: [1] }]],
    ['duplicate ids', [{ ...RECORD, option_ids: ['starter', 'starter'] }]],
    ['missing ranges', [{ ...RECORD, range_by_option: undefined }]],
    ['array ranges', [{ ...RECORD, range_by_option: [ENTRY] }]],
    ['no entries', [{ ...RECORD, range_by_option: {} }]],
    ['entry id not licensed', [{ ...RECORD, range_by_option: { other: ENTRY } }]],
  ])('refuses %s', (_name, warnings) => {
    expect(readGoalChanceRange(warnings)).toBeNull()
  })

  it.each([
    ['equal bounds', { low_pct: 90 }], ['reversed bounds', { low_pct: 95 }],
    ['fractional low', { low_pct: 23.5 }], ['fractional high', { high_pct: 89.5 }],
    ['negative low', { low_pct: -1 }], ['high over 100', { high_pct: 101 }],
    ['NaN low', { low_pct: NaN }], ['infinite high', { high_pct: Infinity }],
    ['string low', { low_pct: '23' }], ['missing high', { high_pct: undefined }],
    ['missing low rounding', { low_rounding: undefined }], ['unknown high rounding', { high_rounding: 'nearest_10' }],
    ['unknown kind', { kind: 'factor_value' }], ['unknown among', { among: 'some' }],
    ['blank from', { from: ' ' }], ['missing to', { to: undefined }], ['numeric endpoint', { to: 2 }],
  ])('drops %s, while retaining a valid sibling in model order', (_name, patch) => {
    const bad = { ...ENTRY, ...patch }
    expect(readGoalChanceRange([{ ...RECORD, range_by_option: { starter: bad } }])).toBeNull()
    expect(readGoalChanceRange([{
      ...RECORD, option_ids: ['bad', 'starter'], range_by_option: { bad, starter: ENTRY },
    }])?.optionIds).toEqual(['starter'])
  })

  it.each([null, [], 'range', 1])('drops a non-record entry %j', (entry) => {
    expect(readGoalChanceRange([{ ...RECORD, range_by_option: { starter: entry } }])).toBeNull()
  })

  it('drops an unknown entry without losing valid named entries; missing named entries say nothing', () => {
    expect(readGoalChanceRange([{
      ...RECORD, option_ids: ['missing', 'starter'], range_by_option: { unknown: ENTRY, starter: ENTRY },
    }])?.optionIds).toEqual(['starter'])
  })

  it('accepts whole percentage endpoints at 0 and 100 without recomputing them', () => {
    expect(readGoalChanceRange([{ ...RECORD, range_by_option: { starter: { ...ENTRY, low_pct: 0, high_pct: 100 } } }])
      ?.rangeByOption.starter).toMatchObject({ lowPct: 0, highPct: 100 })
  })

  it('reads strength/existence and all/unsized_links by identity', () => {
    expect(readGoalChanceRange([{ ...RECORD, range_by_option: { starter: { ...ENTRY, kind: 'link_existence', among: 'unsized_links' } } }])
      ?.rangeByOption.starter).toMatchObject({ kind: 'link_existence', among: 'unsized_links' })
  })
})

describe('both goal-chance records read the deadline only when well formed', () => {
  it.each([
    [{ horizon_untested: true, horizon_line: HORIZON }, HORIZON],
    [{ horizon_untested: true, horizon_line: ` ${HORIZON} ` }, ` ${HORIZON} `],
    [{}, null], [{ horizon_line: HORIZON }, null], [{ horizon_untested: false, horizon_line: HORIZON }, null],
    [{ horizon_untested: 'true', horizon_line: HORIZON }, null], [{ horizon_untested: true }, null],
    [{ horizon_untested: true, horizon_line: '' }, null], [{ horizon_untested: true, horizon_line: ' ' }, null],
    [{ horizon_untested: true, horizon_line: 9 }, null],
  ])('reads %j as %j without dropping the valid chance record', (fields, expected) => {
    expect(readGoalChanceRange([{ ...RECORD, ...fields }])?.horizonLine).toBe(expected)
    expect(readGoalChanceLicence([{ ...LICENCE, ...fields }])?.horizonLine).toBe(expected)
  })
})

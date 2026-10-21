/**
 * D3 step 2 — the reader refuses every record that disagrees with itself (Codex sol-high buddy, #2545 r1 findings 2–5).
 * A refused record is `null`, and every surface then says what it said before. CONTROL: each well-formed form is read.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../goalChanceLicence'

const T = { comparator: 'at_least', value: 20000, unit: '£' }
const rec = (extra: Record<string, unknown>) => [{ code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', option_ids: ['a', 'b', 'c'],
  pct_by_option: { a: 62, b: 41, c: 20 }, target: T, form: 'each', ...extra }]

describe('readGoalChanceLicence refuses self-contradicting records', () => {
  it('CONTROL: each well-formed form is read', () => {
    expect(readGoalChanceLicence(rec({}))?.form).toBe('each')
    expect(readGoalChanceLicence(rec({ form: 'highest', leader_option_id: 'a', next_option_id: 'b' }))?.leaderOptionId).toBe('a')
    expect(readGoalChanceLicence(rec({ form: 'similar', similar_option_ids: ['a', 'b'] }))?.similarOptionIds).toEqual(['a', 'b'])
    expect(readGoalChanceLicence(rec({ pct_by_option: { a: 62, b: 41 }, withheld_option_ids: ['c'] }))?.withheldOptionIds).toEqual(['c'])
  })

  it('(2) a leader under a non-superlative form, or a superlative comparing an option with itself', () => {
    expect(readGoalChanceLicence(rec({ leader_option_id: 'a' }))).toBeNull()
    expect(readGoalChanceLicence(rec({ next_option_id: 'b' }))).toBeNull()
    expect(readGoalChanceLicence(rec({ form: 'highest', leader_option_id: 'a', next_option_id: 'a' }))).toBeNull()
  })

  it('(3) a withheld option that also carries a figure', () => {
    expect(readGoalChanceLicence(rec({ pct_by_option: { a: 62, b: 41, c: 0.5 }, withheld_option_ids: ['c'] }))).toBeNull()
  })

  it('(4) a similar list outside `similar`, or one that names fewer than two DISTINCT options', () => {
    expect(readGoalChanceLicence(rec({ similar_option_ids: ['a'] }))).toBeNull()
    expect(readGoalChanceLicence(rec({ form: 'similar', similar_option_ids: ['a', 'a'] }))).toBeNull()
  })

  it('(5) a percentage outside 0–100', () => {
    expect(readGoalChanceLicence(rec({ pct_by_option: { a: 162, b: 41, c: 20 } }))).toBeNull()
    expect(readGoalChanceLicence(rec({ pct_by_option: { a: 62, b: -41, c: 20 } }))).toBeNull()
  })
})

describe('a resolved shortfall does not block the summary (Science via DL, 21 Oct 2026)', () => {
  const sq = { pct_by_option: { a: 69, b: 16 }, withheld_option_ids: ['c'] }
  const highest = { form: 'highest', leader_option_id: 'a', next_option_id: 'b' }

  it('accepts: highest, with carrying on as now withheld and resolved → the leader, and c still withheld (no figure)', () => {
    const l = readGoalChanceLicence(rec({ ...sq, ...highest, resolved_withheld_option_ids: ['c'] }))
    expect(l?.form).toBe('highest')
    expect(l?.leaderOptionId).toBe('a')
    expect(l?.withheldOptionIds).toEqual(['c'])
    expect(l?.pctByOption).not.toHaveProperty('c')
  })

  it('refuses: highest with a withheld id that is not resolved (contrast: the same record with it resolved is read above)', () => {
    expect(readGoalChanceLicence(rec({ ...sq, ...highest }))).toBeNull()
    expect(readGoalChanceLicence(rec({ ...sq, ...highest, resolved_withheld_option_ids: [] }))).toBeNull()
    expect(readGoalChanceLicence(rec({ pct_by_option: { a: 69 }, withheld_option_ids: ['b', 'c'], form: 'all_likely_to_miss',
      resolved_withheld_option_ids: ['c'] }))).toBeNull()
  })

  it('refuses: a resolved id outside the withheld list, a repeat, or a superlative naming a withheld option', () => {
    expect(readGoalChanceLicence(rec({ ...sq, ...highest, resolved_withheld_option_ids: ['b'] }))).toBeNull()
    expect(readGoalChanceLicence(rec({ ...sq, ...highest, resolved_withheld_option_ids: ['c', 'c'] }))).toBeNull()
    expect(readGoalChanceLicence(rec({ ...sq, form: 'highest', leader_option_id: 'a', next_option_id: 'c',
      resolved_withheld_option_ids: ['c'] }))).toBeNull()
  })

  it('an old record (no field) reads exactly as before: each with a withheld id is read; highest with one is refused', () => {
    expect(readGoalChanceLicence(rec(sq))?.withheldOptionIds).toEqual(['c'])
    expect(readGoalChanceLicence(rec({ ...sq, ...highest }))).toBeNull()
  })
})

describe('share-by-date target reader', () => {
  const share = { comparator: 'at_least', value: 100, unit: '% of the feature launch' }
  it('carries a real YYYY-MM-DD date verbatim, including leap day', () => {
    for (const by_date of ['2027-04-07', '2028-02-29']) {
      expect(readGoalChanceLicence(rec({ target: { ...share, by_date } }))?.target).toEqual({ ...share, by_date })
    }
  })
  it.each(['2027-4-7', '07 April 2027', '2027-02-29', '2027-02-30', '2027-13-01', '', null, 20270407])(
    'rejects malformed by_date %j without losing the existing licence', (by_date) => {
      expect(readGoalChanceLicence(rec({ target: { ...share, by_date } }))?.target).toEqual(share)
    },
  )
})

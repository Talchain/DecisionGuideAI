/**
 * ⭐ D3 step 2 (DL 0df0e1 6 Oct): Rehearsal12 served "…reaches the target in the most model runs (48%)" at a 4.4-point
 * gap. Where the Run carries CEE's goal-chance licence, `selectGoalLeader` — the ONE crown every goal superlative selects
 * through (hero headline/subline/row crown, the Reasoning tab's implication) — crowns only the option CEE named under a
 * superlative form (≥ 10 points), by id. A Run with no licence decides exactly as before (CONTROL).
 */
import { describe, expect, it } from 'vitest'
import { selectGoalLeader } from '../selectGoalLeader'
import type { GoalChanceLicence } from '../goalChanceLicence'

type Row = { id: string; p: number }
const R12: Row[] = [{ id: 'starter', p: 0.477 }, { id: 'raise', p: 0.4328 }, { id: 'keep', p: 0.004 }]
const GATES = { designationsWithheld: false, hasUserTarget: true }
const lic = (form: GoalChanceLicence['form'], leader: string | null = null): GoalChanceLicence => ({
  form, optionIds: R12.map((r) => r.id), pctByOption: { starter: 48, raise: 43, keep: 0 }, withheldOptionIds: [],
  similarOptionIds: form === 'similar' ? ['starter', 'raise'] : [], userLinkExistence: null,
  leaderOptionId: leader, nextOptionId: leader === null ? null : 'raise', target: { comparator: 'at_least', value: 1, unit: '£' },
})
const pick = (licence: GoalChanceLicence | null | undefined, idOf = (r: Row) => r.id) =>
  selectGoalLeader(R12, (r) => r.p, { ...GATES, goalChanceLicence: licence }, idOf)?.id ?? null

describe('selectGoalLeader under CEE\'s goal-chance licence', () => {
  it('CONTROL: no licence on the Run → the argmax, exactly as before (this is what Rehearsal12 served)', () => {
    expect(pick(undefined)).toBe('starter')
    expect(pick(null)).toBe('starter')
  })

  it('Rehearsal12 under CEE\'s licence (`similar`, 4.4 points) → NO crown', () => {
    expect(pick(lic('similar'))).toBeNull()
    expect(pick(lic('each'))).toBeNull()
    expect(pick(lic('all_likely_to_miss'))).toBeNull()
  })

  it('a superlative licence crowns ONLY the option it names, by id', () => {
    expect(pick(lic('highest', 'starter'))).toBe('starter')
    expect(pick(lic('highest', 'raise'))).toBeNull() // the argmax is not the licensed leader → no crown
    expect(selectGoalLeader(R12, (r) => r.p, { ...GATES, goalChanceLicence: lic('highest', 'starter') })).toBeNull() // a caller that cannot say ids gets no crown
  })
})

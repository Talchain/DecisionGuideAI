/**
 * Run-4 judge B3 (DL 12 Oct, §7.3 witness row "a stated range kept, with any derived value identified"): hiring's user
 * said "between 20% and 30%" for non-development time. The stored model keeps that range (`observed_state.range`
 * {low 20, high 30, source 'user_override', meaning 'min_max'}) and the value 25 it derived, but the canvas card printed
 * only "25% of monthly team capacity".
 *
 * Node data: run-4 hiring reopen, `fac_capacity_used_for_non_development_tasks` (live/runs/2026-10-12T172858Z/hiring/
 * reopen.json, after.state.node_data; UI 616bbf21, CEE a770ce49), verbatim except the long source quote is shortened.
 * Capacity's missing range is CEE's (its stored model holds none) and is not tested here.
 * F UI check round 1 (DL 12 Oct, blocking): only a range the user AUTHORED is "your range"; a confirmed one
 * (`user_confirmed`) is not, and neither is a third party's range quoted in the brief (`brief_extraction`). The negatives
 * below keep the served 20–30 bounds so only the source differs.
 */
import { describe, expect, it } from 'vitest'
import { resolveFactorStatedRangeOnCard } from '../shared/factorStatedRange'

const SERVED = {
  ref: 'F7', category: 'external', label: 'Capacity used for non-development tasks', kind: 'factor',
  observedState: {
    cap: 100, unit: '% of monthly team capacity',
    range: { low: 20, high: 30, source: 'user_override', meaning: 'min_max',
      source_quote: 'currently they spend between 20% and 30% of their time on non-development tasks' },
    value: 0.25, source: 'user_override', raw_value: 25, declared_scale: 'unit_interval', extractionType: 'explicit',
  },
}
const withRange = (range: Record<string, unknown> | undefined) =>
  ({ ...SERVED, observedState: { ...SERVED.observedState, range } })

describe('run 4 B3: the user\'s stated range is kept on the canvas card', () => {
  it('the words come from the owner: the same formatter as the value line, both ends', () => {
    expect(resolveFactorStatedRangeOnCard(SERVED)).toBe('20%–30% of monthly team capacity (your range)')
    const tickets = { label: 'Support capacity per additional specialist', category: 'external',
      observedState: { cap: 100, unit: 'tickets per week per specialist', value: 0.2, raw_value: 20, source: 'user_override',
        range: { low: 10, high: 30, source: 'user_override', meaning: 'min_max' } } }
    expect(resolveFactorStatedRangeOnCard(tickets)).toBe('10–30 tickets per week per specialist (your range)')
  })

  it('CONTRAST: a range Olumi chose is not "your range" (no line), with the served 20–30 bounds unchanged', () => {
    for (const source of ['cee_inference', 'inferred', 'cee_repair']) {
      expect(resolveFactorStatedRangeOnCard(withRange({ low: 20, high: 30, source, meaning: 'min_max' }))).toBeNull()
    }
  })

  // F UI check round 1 (DL 12 Oct, blocking): confirming a range does not make the user its author. Only a range they
  // typed, or one from their brief, is "your range".
  it('⭐ NEGATIVE: a CONFIRMED range (user_confirmed 20–30) is not "your range": no line', () => {
    const confirmed = withRange({ low: 20, high: 30, source: 'user_confirmed', meaning: 'min_max' })
    expect(resolveFactorStatedRangeOnCard(confirmed)).toBeNull()
  })

  it('NEGATIVE: other user-owned or adopted stamps that do not say the user wrote it get no line', () => {
    for (const range of [
      { low: 20, high: 30, source: 'user_assumption', meaning: 'min_max' },
      { low: 20, high: 30, source: 'user_assumption', meaning: 'min_max', reviewed_by_user: { intent: 'confirm' } },
      { low: 20, high: 30, source: 'panel_elicited', meaning: 'min_max' },
    ]) {
      expect(resolveFactorStatedRangeOnCard(withRange(range))).toBeNull()
    }
  })

  // CEE stamps a factor range `brief_extraction` only for a THIRD PARTY's range quoted in the brief (admit-model.ts
  // `withStatedLevelRange` → `briefAttributedLevelRange`, attributed sentences only; CEE staging a770ce49). The user's own
  // range is `user_override`. So a brief-kind range is someone else's, never "your range".
  it('⭐ NEGATIVE: a third party\'s range quoted in the brief (brief_extraction / explicit) is not "your range"', () => {
    for (const source of ['brief_extraction', 'explicit']) {
      expect(resolveFactorStatedRangeOnCard(withRange({ low: 20, high: 30, source, meaning: 'min_max',
        source_quote: 'Our consultants estimate the team spends between 20% and 30% of its time on non-development work.' })), source)
        .toBeNull()
    }
  })

  it('POSITIVE CONTROL: every authored stamp (CEE\'s user_override, the client\'s typed stamps) says the line, same words', () => {
    for (const source of ['user_override', 'user', 'user_edited', 'user_calibration']) {
      expect(resolveFactorStatedRangeOnCard(withRange({ low: 20, high: 30, source, meaning: 'min_max' })), source)
        .toBe('20%–30% of monthly team capacity (your range)')
    }
  })

  it('CONTRAST: no range, a malformed range, or an unknown source says nothing', () => {
    for (const range of [undefined, { low: 20, source: 'user_override' }, { low: '20', high: 30, source: 'user_override' },
      { low: 20, high: Number.NaN, source: 'user_override' }, { low: 20, high: 30 }]) {
      expect(resolveFactorStatedRangeOnCard(withRange(range as never))).toBeNull()
    }
  })
})

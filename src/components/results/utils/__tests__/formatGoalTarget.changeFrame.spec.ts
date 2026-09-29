/**
 * ⭐ R1 S4-core — A GOAL TARGET STATED AS A CHANGE FROM TODAY IS SAID AS THE CHANGE (MG's goal half, #72 5879952291;
 * `@talchain/schemas` 0.61.0 `goal_threshold_frame`; Canvas claim 5880085897).
 *
 * The producer's wire, as MG states it: "cut the cloud bill by 15%" is `goal_threshold_frame: 'change_rel'`,
 * `goal_threshold_raw: -0.15` (a FRACTION of today's level), `goal_threshold_unit` = the METRIC's unit. Read as a
 * level, the card printed that as a price: "Target: -0.15 GBP per month" — MG's own "never" example. MG's words:
 * "say it as {cut|grow} by 15% from today (or down/up by £5,000 from today)"; the UI uses the neutral down/up form for
 * both, so a cost and a revenue read alike. The scale is the CONTRACT's (`change_rel` is a fraction by definition),
 * never inferred from a magnitude.
 */
import { describe, it, expect } from 'vitest'
import { formatGoalChangeBound, formatGoalTarget } from '../formatGoalTarget'
import { resolveGoalTarget, goalHeldComparatorOf, goalTargetChangeFrameOf, goalTargetFrameIsUnread, statedGoalTargetRaw } from '../../../../canvas/domain/goalTarget'

describe('formatGoalTarget says a change-framed target as the change', () => {
  it('RED: change_rel −0.15 on a GBP/month metric → "down 15% from today", never "-0.15 GBP per month"', () => {
    const said = formatGoalTarget(-0.15, 'GBP/month', 'change_rel')
    expect(said).toBe('down 15% from today')
    expect(said).not.toMatch(/0\.15|GBP|month/)
  })

  it('RED: a rise — change_rel 0.2 → "up 20% from today"; the unit is the metric\'s and is not said', () => {
    expect(formatGoalTarget(0.2, 'GBP', 'change_rel')).toBe('up 20% from today')
    expect(formatGoalTarget(0.125, '%', 'change_rel')).toBe('up 12.5% from today')
  })

  it('RED: change_abs keeps the metric\'s unit through the one money formatter — "down £5,000 from today"', () => {
    expect(formatGoalTarget(-5000, 'GBP', 'change_abs')).toBe('down £5,000 from today')
    expect(formatGoalTarget(2, 'points', 'change_abs')).toBe('up 2 points from today')
  })

  it('a non-finite change is no target, as for a level (callers show none, never "down NaN%")', () => {
    expect(formatGoalTarget(Number.NaN, 'GBP', 'change_rel')).toBeNull()
  })
})

describe('⛔ CONTRAST — a level is byte-identical, and so are an absent frame and legacy delta', () => {
  it.each([
    [250000, '£'],
    [99.5, '%'],
    [11, '£M ARR'],
    [20000, 'GBP/month'],
    [-3, 'points'],
  ])('%s %s', (value, unit) => {
    const before = formatGoalTarget(value, unit)
    expect(formatGoalTarget(value, unit, 'level')).toBe(before)
    expect(formatGoalTarget(value, unit, 'delta')).toBe(before)
    expect(formatGoalTarget(value, unit, undefined)).toBe(before)
    expect(formatGoalTarget(value, unit, null)).toBe(before)
  })
})

describe('⛔ AIQ 5880974047 — a frame this UI cannot read fails CLOSED: no number, never a level', () => {
  it.each(['CHANGE_REL', 'change', 'bogus', 7])('RED: frame %s → no figure, no resolved target, no stated raw', (frame) => {
    expect(formatGoalTarget(-0.15, 'GBP/month', frame)).toBeNull()
    expect(resolveGoalTarget({ goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month', goal_threshold_frame: frame })).toBeNull()
    expect(statedGoalTargetRaw({ goal_threshold_raw: -0.15, goal_threshold_frame: frame })).toBeNull()
    expect(goalTargetFrameIsUnread(frame)).toBe(true)
  })

  it('CONTRAST: absent, null, level, delta and the change frames are read', () => {
    for (const f of [undefined, null, 'level', 'delta', 'change_rel', 'change_abs']) expect(goalTargetFrameIsUnread(f), String(f)).toBe(false)
  })
})

describe('UI #2287 review — "what success means" is the bound the node\'s HELD comparator states', () => {
  it('a comparator with the move is a floor: `<=` −15% → "down at least", `<` → "down more than", `>=` +£5,000 → "up at least"', () => {
    expect(formatGoalChangeBound(-0.15, 'GBP/month', 'change_rel', '<=')).toBe('down at least 15% from today')
    expect(formatGoalChangeBound(-0.15, 'GBP/month', 'change_rel', '<')).toBe('down more than 15% from today')
    expect(formatGoalChangeBound(5000, 'GBP', 'change_abs', '>=')).toBe('up at least £5,000 from today')
  })

  it('a comparator against the move is a CEILING: `<=` +10% → "up no more than", `>` −15% → "down less than"', () => {
    expect(formatGoalChangeBound(0.1, '%', 'change_rel', '<=')).toBe('up no more than 10% from today')
    expect(formatGoalChangeBound(0.1, '%', 'change_rel', '<')).toBe('up less than 10% from today')
    expect(formatGoalChangeBound(-0.15, '%', 'change_rel', '>=')).toBe('down no more than 15% from today')
    expect(formatGoalChangeBound(-0.15, '%', 'change_rel', '>')).toBe('down less than 15% from today')
  })

  it('⛔ no readable comparator, or a zero change → null (the caller says no number)', () => {
    for (const op of [undefined, null, true, 'minimise', '\u2265', '=>', '=']) {
      expect(formatGoalChangeBound(-0.15, 'GBP/month', 'change_rel', op), String(op)).toBeNull()
      expect(goalHeldComparatorOf(op), String(op)).toBeNull()
    }
    expect(formatGoalChangeBound(0, '%', 'change_rel', '>=')).toBeNull()
  })

  it('CONTRAST: a level (or an unread frame) is not a change bound', () => {
    expect(formatGoalChangeBound(38000, 'GBP', 'level', '>=')).toBeNull()
    expect(formatGoalChangeBound(-0.15, 'GBP', 'bogus', '<=')).toBeNull()
  })
})

describe('the resolver carries the frame beside the figure', () => {
  const changeGoal = { goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month', goal_threshold_frame: 'change_rel' }

  it('RED: resolveGoalTarget returns the node\'s change frame with its raw', () => {
    expect(resolveGoalTarget(changeGoal)).toEqual({ raw: -0.15, unit: 'GBP/month', source: 'unrecorded', frame: 'change_rel' })
  })

  it('CONTRAST: a level goal resolves to exactly the object it did before (no frame key)', () => {
    expect(resolveGoalTarget({ goal_threshold_raw: 250000, goal_threshold_unit: '£' })).toEqual({ raw: 250000, unit: '£', source: 'unrecorded' })
    expect(Object.keys(resolveGoalTarget({ goal_threshold_raw: 250000, goal_threshold_frame: 'level' })!)).not.toContain('frame')
    expect(Object.keys(resolveGoalTarget({ goal_threshold_raw: 250000, goal_threshold_frame: 'delta' })!)).not.toContain('frame')
  })

  it('goalTargetChangeFrameOf answers only the two change frames', () => {
    expect(goalTargetChangeFrameOf('change_rel')).toBe('change_rel')
    expect(goalTargetChangeFrameOf('change_abs')).toBe('change_abs')
    for (const f of [undefined, null, 'level', 'delta', 'change', 'CHANGE_REL', 1]) expect(goalTargetChangeFrameOf(f), String(f)).toBeNull()
  })
})

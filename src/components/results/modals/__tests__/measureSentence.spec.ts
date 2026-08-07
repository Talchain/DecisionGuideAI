/**
 * Assembled-sentence matrix for the Define-success preview — the AUTHORED
 * shape (direction phrase split around the metric), not the prototype's
 * buggy runtime word order.
 */
import { describe, it, expect } from 'vitest'

import { buildMeasureSentence, DIRECTION_OPTIONS, UNIT_OPTIONS } from '../measureSentence'

describe('buildMeasureSentence', () => {
  it('assembles the authored increase shape', () => {
    expect(
      buildMeasureSentence({
        metric: 'Productivity',
        direction: 'increase_by_at_least',
        threshold: '20',
        unit: '%',
        timeframe: 'Within 6 months',
      }),
    ).toBe('Success means: increase Productivity by at least 20% within 6 months.')
  })

  it('assembles the reach-at-least shape with the metric leading', () => {
    expect(
      buildMeasureSentence({
        metric: 'Revenue',
        direction: 'reach_at_least',
        threshold: '120',
        unit: '£',
        timeframe: 'Within 12 months',
      }),
    ).toBe('Success means: Revenue reaches at least 120£ within 12 months.')
  })

  it('assembles the keep-below shape with the direction split around the metric', () => {
    expect(
      buildMeasureSentence({
        metric: 'Churn',
        direction: 'keep_below',
        threshold: '4',
        unit: '%',
        timeframe: 'Within 6 months',
      }),
    ).toBe('Success means: keep Churn below 4% within 6 months.')
  })

  it('falls back to the prototype placeholder tokens when fields are empty', () => {
    expect(
      buildMeasureSentence({
        metric: '',
        direction: 'increase_by_at_least',
        threshold: '',
        unit: '%',
        timeframe: '',
      }),
    ).toBe('Success means: increase [outcome] by at least [number]% [timeframe].')
  })

  it('lowercases the timeframe and concatenates threshold+unit with no space', () => {
    const sentence = buildMeasureSentence({
      metric: 'Output',
      direction: 'reach_at_least',
      threshold: '3',
      unit: 'projects',
      timeframe: 'By Q3',
    })
    expect(sentence).toContain('3projects')
    expect(sentence).toContain('by q3')
    expect(sentence).not.toContain('By Q3')
  })

  it('trims whitespace-only fields down to placeholders', () => {
    expect(
      buildMeasureSentence({
        metric: '   ',
        direction: 'keep_below',
        threshold: '  ',
        unit: 'weeks',
        timeframe: '  ',
      }),
    ).toBe('Success means: keep [outcome] below [number]weeks [timeframe].')
  })

  it('exposes the spec option lists in prototype order', () => {
    expect(DIRECTION_OPTIONS.map((d) => d.label)).toEqual([
      'Increase by at least',
      'Reach at least',
      'Keep below',
    ])
    expect([...UNIT_OPTIONS]).toEqual(['%', 'projects', 'weeks', '£'])
  })
})

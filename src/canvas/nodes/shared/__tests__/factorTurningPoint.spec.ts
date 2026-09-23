/**
 * The turning-point READER — Paul 23 Sep contract feedback point 3.
 * Read, never computed: a PLoT `flip_thresholds[]` row with `flip_reason ===
 * 'found'` only; ISL's 0.5 default is never read.
 */
import { describe, it, expect } from 'vitest'
import {
  selectFactorTurningPoint,
  selectFactorTurningPointState,
  turningPointUnitsCompatible,
} from '../factorTurningPoint'

const found = {
  node_id: 'f1',
  label: 'Trial conversion',
  current_value: 8,
  flip_value: 6.5,
  unit: '%',
  flip_reason: 'found',
  value_scale: 'display',
  alternative_winner_label: 'Two Developers',
}

describe('selectFactorTurningPoint — option scope', () => {
  it('carries the producer’s alternative_winner_label verbatim (trimmed)', () => {
    const tp = selectFactorTurningPoint({ flip_thresholds: [{ ...found, alternative_winner_label: '  Two Developers ' }] }, 'f1')
    expect(tp).toMatchObject({ currentValue: 8, flipValue: 6.5, displayScale: true, alternativeLabel: 'Two Developers' })
  })

  it('an absent or blank alternative is null, never invented', () => {
    const noAlt: Record<string, unknown> = { ...found }
    delete noAlt.alternative_winner_label
    expect(selectFactorTurningPoint({ flip_thresholds: [noAlt] }, 'f1')!.alternativeLabel).toBeNull()
    expect(selectFactorTurningPoint({ flip_thresholds: [{ ...found, alternative_winner_label: ' ' }] }, 'f1')!.alternativeLabel).toBeNull()
  })

  it('⛔ an ISL-style 0.5 row with no `found` reason is not a turning point — control: the found row is', () => {
    expect(selectFactorTurningPoint({ flip_thresholds: [{ node_id: 'f1', current_value: 0.6, flip_value: 0.5 }] }, 'f1')).toBeNull()
    expect(selectFactorTurningPoint({ flip_thresholds: [found] }, 'f1')).not.toBeNull()
  })
})

describe('selectFactorTurningPointState — the first-class fallback', () => {
  it('found → the turning point', () => {
    const s = selectFactorTurningPointState({ flip_thresholds: [found] }, 'f1')
    expect(s.kind).toBe('found')
  })

  it.each(['no_effect_within_bounds', 'structurally_invariant'])('%s → none, ATTESTED', (reason) => {
    const s = selectFactorTurningPointState({ flip_thresholds: [{ ...found, flip_value: null, flip_reason: reason }] }, 'f1')
    expect(s).toEqual({ kind: 'none', attested: true })
  })

  it.each(['timeout', 'candidate_cap_exceeded', 'some_future_token', undefined])(
    '⛔ %s → none, NOT attested (a probe that established nothing is never an absence)',
    (reason) => {
      const s = selectFactorTurningPointState({ flip_thresholds: [{ ...found, flip_value: null, flip_reason: reason }] }, 'f1')
      expect(s).toEqual({ kind: 'none', attested: false })
    },
  )

  it('no row for this factor → none, not attested — control: another factor’s attested row does not leak', () => {
    const report = { flip_thresholds: [{ ...found, node_id: 'other', flip_value: null, flip_reason: 'no_effect_within_bounds' }] }
    expect(selectFactorTurningPointState(report, 'f1')).toEqual({ kind: 'none', attested: false })
    expect(selectFactorTurningPointState(report, 'other')).toEqual({ kind: 'none', attested: true })
  })

  it('no flip_thresholds at all → none, not attested', () => {
    expect(selectFactorTurningPointState({}, 'f1')).toEqual({ kind: 'none', attested: false })
    expect(selectFactorTurningPointState(null, 'f1')).toEqual({ kind: 'none', attested: false })
  })
})

describe('turningPointUnitsCompatible', () => {
  it.each([
    ['%', '%', true],
    ['%', 'percent', true],
    ['£', '£', true],
    ['seats', 'seats', true],
    [undefined, undefined, true],
    [undefined, '', true],
    ['%', 'seats', false],
    ['£', '$', false],
    ['%', undefined, false],
    [undefined, 'months', false],
  ] as const)('row %s vs factor %s → %s', (row, factor, ok) => {
    expect(turningPointUnitsCompatible(row, factor)).toBe(ok)
  })
})

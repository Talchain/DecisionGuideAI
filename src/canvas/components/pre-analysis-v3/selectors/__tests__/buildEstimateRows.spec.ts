import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { buildEstimateRows, topUncalibrated } from '../buildEstimateRows'
import type { RankingResult } from '../../types'

function factor(id: string, label: string, observedState: Record<string, unknown> | undefined, extra?: Record<string, unknown>): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', label, ...(observedState ? { observedState } : {}), ...extra },
  } as Node
}

function ranking(ordered: string[], weights?: Record<string, number>): RankingResult {
  return {
    source: 'sensitivity',
    ordered,
    weights: weights ?? Object.fromEntries(ordered.map((id, i) => [id, ordered.length - i])),
  }
}

describe('buildEstimateRows — value-scale guard', () => {
  it('shows display-scale text from raw_value + unit, never the normalised value', () => {
    const rows = buildEstimateRows(
      [factor('f1', 'Vendor spend', { raw_value: 26000, value: 0.52, unit: '£', source: 'cee_inference' })],
      ranking(['f1']),
      null,
    )
    expect(rows[0].displayText).toBe('£26,000')
    expect(rows[0].displayText).not.toContain('0.52')
    expect(rows[0].canEditValue).toBe(true)
    expect(rows[0].rawPrefill).toBe(26000)
  })

  it('CEE display_value renders verbatim when no raw+unit pair exists', () => {
    const rows = buildEstimateRows(
      [factor('f1', 'Tech lead presence', { value: 0, source: 'cee_inference' }, { display_value: 'No dedicated tech lead' })],
      ranking(['f1']),
      null,
    )
    expect(rows[0].displayText).toBe('No dedicated tech lead')
  })

  it('degrades to confirm-only when only a model-scale value exists (ambiguous display scale)', () => {
    const rows = buildEstimateRows(
      [factor('f1', 'Coordination drag', { value: 0.42, source: 'cee_inference', factor_type: 'continuous' })],
      ranking(['f1']),
      null,
    )
    expect(rows[0].displayText).toBeNull()
    expect(rows[0].canEditValue).toBe(false)
    expect(rows[0].needsValue).toBe(false)
  })

  it('flags factors with no value at all as needing a value (still editable)', () => {
    const rows = buildEstimateRows(
      [factor('f1', 'Churn rate', { source: 'cee_inference' })],
      ranking(['f1']),
      null,
    )
    expect(rows[0].needsValue).toBe(true)
    expect(rows[0].canEditValue).toBe(true)
    expect(rows[0].rawPrefill).toBeNull()
  })

  it('marks reviewed rows with person attribution; unreviewed with Olumi', () => {
    const rows = buildEstimateRows(
      [
        factor('f1', 'A', { raw_value: 5, unit: '%', source: 'user_confirmed' }),
        factor('f2', 'B', { raw_value: 9, unit: '%', source: 'cee_inference' }),
      ],
      ranking(['f1', 'f2']),
      { kind: 'person', displayName: 'Paul' },
    )
    expect(rows[0].reviewed).toBe(true)
    expect(rows[0].attribution).toEqual({ kind: 'person', displayName: 'Paul' })
    expect(rows[1].reviewed).toBe(false)
    expect(rows[1].attribution).toEqual({ kind: 'olumi' })
  })

  it('positional rank labels follow ranking order', () => {
    const rows = buildEstimateRows(
      [
        factor('f1', 'A', { raw_value: 1, unit: '%', source: 'cee_inference' }),
        factor('f2', 'B', { raw_value: 1, unit: '%', source: 'cee_inference' }),
        factor('f3', 'C', { raw_value: 1, unit: '%', source: 'cee_inference' }),
        factor('f4', 'D', { raw_value: 1, unit: '%', source: 'cee_inference' }),
      ],
      ranking(['f3', 'f1', 'f4', 'f2']),
      null,
    )
    expect(rows.map(r => [r.nodeId, r.rankLabel])).toEqual([
      ['f3', 'top'],
      ['f1', 'next'],
      ['f4', 'lower'],
      ['f2', 'lower'],
    ])
  })

  it('topUncalibrated returns the first unreviewed row with a value, in rank order', () => {
    const rows = buildEstimateRows(
      [
        factor('f1', 'A', { raw_value: 5, unit: '%', source: 'user_confirmed' }),
        factor('f2', 'B', { source: 'cee_inference' }), // needs value — skipped
        factor('f3', 'C', { raw_value: 9, unit: '%', source: 'cee_inference' }),
      ],
      ranking(['f1', 'f2', 'f3']),
      null,
    )
    expect(topUncalibrated(rows)).toEqual({ id: 'f3', label: 'C' })
  })

  it('topUncalibrated is null when every valued estimate is reviewed', () => {
    const rows = buildEstimateRows(
      [factor('f1', 'A', { raw_value: 5, unit: '%', source: 'user_override' })],
      ranking(['f1']),
      null,
    )
    expect(topUncalibrated(rows)).toBeNull()
  })

  it('aiSourced reflects the actual source (no false Olumi badge on unknown provenance)', () => {
    const rows = buildEstimateRows(
      [
        factor('f1', 'A', { raw_value: 5, unit: '%', source: 'cee_inference' }),
        factor('f2', 'B', { raw_value: 9, unit: '%' }), // value, no source
      ],
      ranking(['f1', 'f2']),
      null,
    )
    expect(rows[0].aiSourced).toBe(true)
    expect(rows[1].aiSourced).toBe(false)
    expect(rows[1].needsValue).toBe(false)
  })

  it('priority labels sequence over unreviewed rows only (a checked row never reads check first)', () => {
    const rows = buildEstimateRows(
      [
        factor('f1', 'A', { raw_value: 5, unit: '%', source: 'user_confirmed' }),
        factor('f2', 'B', { raw_value: 9, unit: '%', source: 'cee_inference' }),
        factor('f3', 'C', { raw_value: 9, unit: '%', source: 'cee_inference' }),
      ],
      ranking(['f1', 'f2', 'f3']),
      null,
    )
    expect(rows[0].reviewed).toBe(true)
    expect(rows[1].rankLabel).toBe('top') // the top unreviewed row reads check first
    expect(rows[2].rankLabel).toBe('next')
  })
})

/** AIQ 5909634999: a ✓ is earned only by data READ and PASSED — never by the no-report default. */
import { describe, it, expect } from 'vitest'
import { degradedAnalysisTypes } from '../degradedAnalysisTypes'

const tick = (d: Parameters<typeof degradedAnalysisTypes>[0], name: string) => degradedAnalysisTypes(d).find((t) => t.name === name)?.available

describe('the dock banner ticks', () => {
  it('RED: the report is absent (the hook\'s default "computed" with no options) → Comparison is NOT ticked', () => {
    expect(tick({ recommendation: { analysisStatus: 'computed', allOptions: [] }, drivers: { driversStatus: 'failed' } }, 'Comparison')).toBe(false)
  })
  it('CONTROL: a report present and computed, with options read → Comparison ✓', () => {
    expect(tick({ recommendation: { analysisStatus: 'computed', allOptions: [{ id: 'a' }, { id: 'b' }] } }, 'Comparison')).toBe(true)
  })
  it('Drivers and Robustness keep their own statuses; no data → no ticks at all', () => {
    expect(tick({ drivers: { driversStatus: 'computed' } }, 'Drivers')).toBe(true)
    expect(tick({ confidence: { robustnessStatus: 'partial' } }, 'Robustness')).toBe(false)
    expect(degradedAnalysisTypes(null)).toEqual([])
  })
})

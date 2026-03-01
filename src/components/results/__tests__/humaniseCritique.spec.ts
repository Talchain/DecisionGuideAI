import { describe, it, expect } from 'vitest'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { UncertaintyItem } from '../types'

function makeItem(overrides: Partial<UncertaintyItem> = {}): UncertaintyItem {
  return {
    code: 'MISSING_OBSERVED_STATE',
    message: 'observed_state.value is missing for constraint_fac_churn_max',
    affectedNodes: ['fac_churn'],
    ...overrides,
  }
}

const nodeLabels = new Map([
  ['fac_churn', 'Customer churn'],
  ['fac_budget', 'Budget'],
  ['fac_timeline', 'Timeline'],
])

describe('humaniseCritique', () => {
  it('maps MISSING_OBSERVED_STATE with resolved label', () => {
    const result = humaniseCritique(makeItem(), nodeLabels)
    expect(result.title).toBe('Customer churn is missing a current value')
    expect(result.factorId).toBe('fac_churn')
    expect(result.suggestion).toContain('Customer churn')
  })

  it('never exposes raw message for unknown codes', () => {
    const result = humaniseCritique(
      makeItem({ code: 'BRAND_NEW_CODE', message: 'intercept=0 for fac_churn' }),
      nodeLabels,
    )
    expect(result.title).not.toContain('intercept=0')
    expect(result.description).not.toContain('intercept=0')
    expect(result.factorId).toBe('fac_churn')
  })

  // ── Constraint codes (V11.1 Fix 1) ──────────────────────────────────────

  it('maps CONSTRAINT_TARGET_NO_OBSERVED_VALUE', () => {
    const result = humaniseCritique(
      makeItem({ code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE', affectedNodes: ['fac_budget'] }),
      nodeLabels,
    )
    expect(result.title).toBe('Budget has no estimate set')
    expect(result.suggestion).toBe('Set estimate')
    expect(result.factorId).toBe('fac_budget')
  })

  it('maps CONSTRAINT_MISSING_RANGE', () => {
    const result = humaniseCritique(
      makeItem({ code: 'CONSTRAINT_MISSING_RANGE', affectedNodes: ['fac_timeline'] }),
      nodeLabels,
    )
    expect(result.title).toBe('Timeline is missing a range for its constraint')
    expect(result.suggestion).toBe('Set range')
    expect(result.factorId).toBe('fac_timeline')
  })

  it('maps CONSTRAINT_FILTERED_TEMPORAL with no suggestion', () => {
    const result = humaniseCritique(
      makeItem({ code: 'CONSTRAINT_FILTERED_TEMPORAL', affectedNodes: [] }),
      nodeLabels,
    )
    expect(result.title).toContain('time-based constraints')
    expect(result.suggestion).toBeUndefined()
  })

  it('maps CONSTRAINT_OUT_OF_DOMAIN', () => {
    const result = humaniseCritique(
      makeItem({ code: 'CONSTRAINT_OUT_OF_DOMAIN', affectedNodes: ['fac_churn'] }),
      nodeLabels,
    )
    expect(result.title).toBe('Customer churn constraint value is outside the expected range')
    expect(result.suggestion).toBe('Review')
    expect(result.factorId).toBe('fac_churn')
  })

  it('V12.2: derives label from ID when node not in labels map', () => {
    const result = humaniseCritique(
      makeItem({ code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE', affectedNodes: ['fac_unknown'] }),
      nodeLabels,
    )
    // V12.2: fac_unknown → Unknown (not "This factor")
    expect(result.title).toBe('Unknown has no estimate set')
    expect(result.factorId).toBe('fac_unknown')
  })

  // ── Review fix: no message parsing, correct fallback ────────────────────

  it('does not parse nodeId from message (global rule)', () => {
    // affectedNodes is empty, message contains fac_churn — should NOT extract it
    const result = humaniseCritique(
      makeItem({
        code: 'MISSING_OBSERVED_STATE',
        affectedNodes: [],
        message: 'observed_state.value is missing for constraint_fac_churn_max',
      }),
      nodeLabels,
    )
    // Should use fallback "This factor", NOT "Customer churn" from message parsing
    expect(result.title).toBe('This factor is missing a current value')
    expect(result.factorId).toBeUndefined()
  })

  it('uses "This factor" when no affectedNodes at all', () => {
    const result = humaniseCritique(
      makeItem({ code: 'MISSING_OBSERVED_STATE', affectedNodes: undefined }),
      nodeLabels,
    )
    expect(result.title).toBe('This factor is missing a current value')
    expect(result.factorId).toBeUndefined()
  })
})

/**
 * analyticalChange — risk probability/impact pin (P1.7).
 *
 * A risk's defining probability × impact pair is analysis-affecting (it is
 * passed through to PLoT by the V2 adapter and consumed by calculateRiskSeverity),
 * so an edit MUST stale the analysis exactly like a factor observedState edit.
 * These pins prove hasAnalyticalNodeChange recognises both fields.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { hasAnalyticalNodeChange } from '../analyticalChange'

const riskNode = (data: Record<string, unknown>): Node =>
  ({ id: 'risk1', type: 'risk', position: { x: 0, y: 0 }, data } as Node)

describe('hasAnalyticalNodeChange — risk probability/impact', () => {
  it('flags a probability change as analysis-affecting', () => {
    const old = riskNode({ probability: 0.2, impact: 'high' })
    expect(hasAnalyticalNodeChange(old, { data: { probability: 0.8, impact: 'high' } })).toBe(true)
  })

  it('flags an impact change as analysis-affecting', () => {
    const old = riskNode({ probability: 0.5, impact: 'low' })
    expect(hasAnalyticalNodeChange(old, { data: { probability: 0.5, impact: 'critical' } })).toBe(true)
  })

  it('flags setting probability from absent as analysis-affecting', () => {
    const old = riskNode({ label: 'Churn' })
    expect(hasAnalyticalNodeChange(old, { data: { probability: 0.4 } })).toBe(true)
  })

  it('does not flag an identical probability/impact re-send', () => {
    const old = riskNode({ probability: 0.5, impact: 'medium' })
    expect(hasAnalyticalNodeChange(old, { data: { probability: 0.5, impact: 'medium' } })).toBe(false)
  })
})
